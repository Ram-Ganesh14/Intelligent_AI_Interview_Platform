"""
Feature 1.1 — Face Detection & Gaze Tracking (Full Proctoring Suite)

Capabilities:
  • Face Presence   — MediaPipe Face Mesh (468 landmarks), checks face is centred & in-frame
  • Gaze Tracking   — Iris landmark gaze-vector estimation; flags off-screen looks
  • Head Pose       — cv2.solvePnP (pitch / yaw / roll) detects reading from hidden notes
  • Multi-Person    — YOLOv8 object detector; >1 person = instant alert
  • Blink Analysis  — EAR (Eye Aspect Ratio); flags deviation from 12–20 blinks/min

Alert thresholds:
  3 s off-screen  → SOFT_FLAG
  10 s off-screen → HARD_FLAG + screenshot saved

Output: JSON flag log with timestamp, severity, type — visible in reviewer dashboard.

Install:
  pip install mediapipe opencv-python numpy ultralytics
"""

import cv2
import time
import math
import os
import numpy as np
from collections import deque
from datetime import datetime, timezone

try:
    import mediapipe as mp
    _MP_AVAILABLE = True
except ImportError:
    _MP_AVAILABLE = False

try:
    from ultralytics import YOLO
    _YOLO_AVAILABLE = True
except ImportError:
    _YOLO_AVAILABLE = False


# ═══════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════

# MediaPipe Face Mesh landmark indices
# Left eye outline
LEFT_EYE = [362, 385, 387, 263, 373, 380]
# Right eye outline
RIGHT_EYE = [33, 160, 158, 133, 153, 144]
# Left iris centre
LEFT_IRIS = [468, 469, 470, 471, 472]
# Right iris centre
RIGHT_IRIS = [473, 474, 475, 476, 477]

# 6 canonical 3D face points for solvePnP (nose tip, chin, left/right eye corner,
# left/right mouth corner) — in a generic head model coordinate system
MODEL_POINTS_3D = np.array([
    (0.0, 0.0, 0.0),           # Nose tip
    (0.0, -330.0, -65.0),      # Chin
    (-225.0, 170.0, -135.0),   # Left eye left corner
    (225.0, 170.0, -135.0),    # Right eye right corner
    (-150.0, -150.0, -125.0),  # Left mouth corner
    (150.0, -150.0, -125.0),   # Right mouth corner
], dtype=np.float64)

# MediaPipe landmark indices matching the 6 model points above
POSE_LANDMARK_IDS = [1, 152, 263, 33, 287, 57]

# Blink detection
EAR_BLINK_THRESHOLD = 0.21       # below this = eye closed
NORMAL_BLINK_RANGE = (12, 20)    # blinks per minute

# Gaze thresholds
GAZE_OFF_SCREEN_RATIO = 0.35     # iris offset ratio beyond which = off-screen
SOFT_FLAG_SECS = 3.0
HARD_FLAG_SECS = 10.0

# Head pose thresholds (degrees)
HEAD_YAW_THRESHOLD = 25.0        # looking sideways
HEAD_PITCH_DOWN_THRESHOLD = -20.0 # looking down (reading)

# Face presence — how far from centre is acceptable (fraction of frame)
FACE_CENTRE_TOLERANCE = 0.30

# YOLO confidence threshold
YOLO_PERSON_CONF = 0.45


# ═══════════════════════════════════════════════════════════════════
# GAZE TRACKER CLASS
# ═══════════════════════════════════════════════════════════════════

class GazeTracker:
    """
    Comprehensive face & gaze proctoring engine.

    Designed for **per-frame stateful analysis** so it works both as:
      • standalone webcam loop  (self.run())
      • frame-by-frame from FastAPI (self.analyze_frame())
    """

    def __init__(self, screenshot_dir: str = "screenshots"):
        # ── MediaPipe Face Mesh ───────────────────────────────────
        if _MP_AVAILABLE:
            self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
                max_num_faces=1,
                refine_landmarks=True,   # enables iris landmarks 468-477
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        else:
            self.mp_face_mesh = None

        # ── YOLO v8 for multi-person ─────────────────────────────
        if _YOLO_AVAILABLE:
            try:
                self.yolo = YOLO("yolov8n.pt")
            except Exception:
                self.yolo = None
        else:
            self.yolo = None

        # ── State ────────────────────────────────────────────────
        self.screenshot_dir = screenshot_dir
        self.flag_log: list[dict] = []
        self.gaze_log: list[dict] = []
        self.blink_timestamps: list[float] = []
        self.frame_count: int = 0
        self.total_off_screen_frames: int = 0

        # Off-screen streak tracker
        self._off_screen_start: float | None = None
        self._soft_flagged: bool = False

        # EAR blink state
        self._prev_ear: float = 0.3
        self._eye_closed: bool = False

        # Rolling window for blink rate (last 60 s of blink times)
        self._blink_window = deque(maxlen=200)

    # ─────────────────────────────────────────────────────────────
    # PUBLIC: analyse a single frame (main integration point)
    # ─────────────────────────────────────────────────────────────

    def analyze_frame(self, frame: np.ndarray) -> dict:
        """
        Process one BGR frame.  Returns a dict with all detection results
        suitable for merging into the /api/analyze-frame response.
        """
        self.frame_count += 1
        ts = time.time()
        h, w = frame.shape[:2]

        result = {
            "ts": ts,
            "face_present": False,
            "face_centred": False,
            "gaze_direction": "UNDETECTED",
            "head_pose": {"yaw": 0.0, "pitch": 0.0, "roll": 0.0},
            "ear_left": 0.0,
            "ear_right": 0.0,
            "blink_detected": False,
            "blinks_per_min": 0.0,
            "blink_flag": False,
            "person_count": 1,
            "alerts": [],
        }

        # ── 1. MEDIAPIPE FACE MESH ───────────────────────────────
        landmarks = None
        if self.mp_face_mesh is not None:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mesh_results = self.mp_face_mesh.process(rgb)

            if mesh_results.multi_face_landmarks:
                face_lm = mesh_results.multi_face_landmarks[0]
                landmarks = face_lm.landmark
                result["face_present"] = True

                # 1a — Face presence & centering
                result["face_centred"] = self._check_face_centred(
                    landmarks, w, h
                )
                if not result["face_centred"]:
                    result["alerts"].append(self._make_alert(
                        ts, "LOW", "FACE_NOT_CENTRED",
                        "Face is not centred in the frame"
                    ))

                # 1b — Gaze direction
                result["gaze_direction"] = self._estimate_gaze(
                    landmarks, w, h
                )

                # 1c — Head pose
                result["head_pose"] = self._estimate_head_pose(
                    landmarks, w, h
                )

                # 1d — Blink (EAR)
                ear_l = self._compute_ear(landmarks, LEFT_EYE, w, h)
                ear_r = self._compute_ear(landmarks, RIGHT_EYE, w, h)
                result["ear_left"] = round(ear_l, 4)
                result["ear_right"] = round(ear_r, 4)

                avg_ear = (ear_l + ear_r) / 2.0
                blink = self._process_blink(avg_ear, ts)
                result["blink_detected"] = blink

                bpm = self._blinks_per_minute(ts)
                result["blinks_per_min"] = round(bpm, 1)
                if bpm > 0 and not (
                    NORMAL_BLINK_RANGE[0] <= bpm <= NORMAL_BLINK_RANGE[1]
                ):
                    result["blink_flag"] = True
                    result["alerts"].append(self._make_alert(
                        ts, "MEDIUM", "ABNORMAL_BLINK_RATE",
                        f"Blink rate {bpm:.1f}/min outside normal "
                        f"{NORMAL_BLINK_RANGE[0]}–{NORMAL_BLINK_RANGE[1]} range"
                    ))
            else:
                # No face detected at all
                result["alerts"].append(self._make_alert(
                    ts, "HIGH", "NO_FACE_DETECTED",
                    "No face found in frame"
                ))

        # ── 2. OFF-SCREEN GAZE STREAK ────────────────────────────
        is_off = result["gaze_direction"] in (
            "LOOKING_LEFT", "LOOKING_RIGHT", "LOOKING_DOWN", "LOOKING_UP"
        )
        self._update_off_screen_streak(is_off, ts, frame)
        if is_off:
            self.total_off_screen_frames += 1

        # ── 3. HEAD POSE ALERTS ──────────────────────────────────
        yaw = result["head_pose"]["yaw"]
        pitch = result["head_pose"]["pitch"]
        if abs(yaw) > HEAD_YAW_THRESHOLD:
            result["alerts"].append(self._make_alert(
                ts, "MEDIUM", "HEAD_TURNED",
                f"Head yaw {yaw:.1f}° exceeds ±{HEAD_YAW_THRESHOLD}° "
                f"— possible second monitor / hidden notes"
            ))
        if pitch < HEAD_PITCH_DOWN_THRESHOLD:
            result["alerts"].append(self._make_alert(
                ts, "LOW", "HEAD_DOWN",
                f"Head pitch {pitch:.1f}° — possible reading"
            ))

        # ── 4. MULTI-PERSON (YOLO) ───────────────────────────────
        person_count = self._detect_persons(frame)
        result["person_count"] = person_count
        if person_count > 1:
            alert = self._make_alert(
                ts, "CRITICAL", "MULTIPLE_PERSONS",
                f"{person_count} people detected in frame"
            )
            result["alerts"].append(alert)
            self.flag_log.append(alert)

        # ── 5. PERSIST ───────────────────────────────────────────
        self.gaze_log.append({
            "ts": ts,
            "direction": result["gaze_direction"],
            "head_pose": result["head_pose"],
            "ear_left": result["ear_left"],
            "ear_right": result["ear_right"],
        })

        # Persist non-empty alerts
        for a in result["alerts"]:
            if a not in self.flag_log:
                self.flag_log.append(a)

        return result

    # ─────────────────────────────────────────────────────────────
    # PUBLIC: standalone webcam loop (for testing / CLI)
    # ─────────────────────────────────────────────────────────────

    def run(self, duration_seconds: int = 300) -> dict:
        """Run the full proctoring suite on live webcam."""
        cap = cv2.VideoCapture(0)
        start = time.time()

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if time.time() - start > duration_seconds:
                break

            result = self.analyze_frame(frame)

            # ── overlay for local testing ────────────────────────
            info = (
                f"Gaze: {result['gaze_direction']}  "
                f"Blink/min: {result['blinks_per_min']:.0f}  "
                f"Persons: {result['person_count']}"
            )
            cv2.putText(
                frame, info, (20, 40),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2,
            )
            yaw = result["head_pose"]["yaw"]
            pitch = result["head_pose"]["pitch"]
            cv2.putText(
                frame,
                f"Yaw: {yaw:.1f}  Pitch: {pitch:.1f}",
                (20, 75),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 0), 1,
            )

            if result["alerts"]:
                cv2.putText(
                    frame,
                    f"ALERTS: {len(result['alerts'])}",
                    (20, 110),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2,
                )

            cv2.imshow("Gaze & Face Proctoring", frame)
            if cv2.waitKey(1) == 27:
                break

        cap.release()
        cv2.destroyAllWindows()
        return self.build_report()

    # ─────────────────────────────────────────────────────────────
    # PUBLIC: aggregate report
    # ─────────────────────────────────────────────────────────────

    def build_report(self) -> dict:
        """Build the final proctoring report from collected data."""
        total = max(self.frame_count, 1)
        off_pct = (self.total_off_screen_frames / total) * 100

        bpm = self._blinks_per_minute(time.time())

        severity_counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        for f in self.flag_log:
            sev = f.get("severity", "LOW")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        return {
            "total_frames": self.frame_count,
            "off_screen_pct": round(off_pct, 2),
            "blinks_per_min": round(bpm, 1),
            "blink_flag": bpm > 0 and not (
                NORMAL_BLINK_RANGE[0] <= bpm <= NORMAL_BLINK_RANGE[1]
            ),
            "total_alerts": len(self.flag_log),
            "severity_counts": severity_counts,
            "flag_log": self.flag_log,
            "integrity_flag": off_pct > 30 or severity_counts["CRITICAL"] > 0,
        }

    # ═══════════════════════════════════════════════════════════════
    # PRIVATE HELPERS
    # ═══════════════════════════════════════════════════════════════

    # ── Face centering ───────────────────────────────────────────

    @staticmethod
    def _check_face_centred(landmarks, w: int, h: int) -> bool:
        """Check that the nose tip (landmark 1) is near the frame centre."""
        nose = landmarks[1]
        cx, cy = nose.x, nose.y   # normalised 0-1
        return (
            abs(cx - 0.5) < FACE_CENTRE_TOLERANCE
            and abs(cy - 0.5) < FACE_CENTRE_TOLERANCE
        )

    # ── Gaze estimation via iris position ────────────────────────

    @staticmethod
    def _estimate_gaze(landmarks, w: int, h: int) -> str:
        """
        Compare iris centre position to eye outline bounding box.
        Returns: ON_SCREEN | LOOKING_LEFT | LOOKING_RIGHT |
                 LOOKING_UP | LOOKING_DOWN
        """
        def _iris_offset(iris_ids, eye_ids):
            """Compute normalised iris offset within eye bounding box."""
            ix = np.mean([landmarks[i].x for i in iris_ids])
            iy = np.mean([landmarks[i].y for i in iris_ids])

            xs = [landmarks[i].x for i in eye_ids]
            ys = [landmarks[i].y for i in eye_ids]

            ex_min, ex_max = min(xs), max(xs)
            ey_min, ey_max = min(ys), max(ys)

            eye_w = max(ex_max - ex_min, 1e-6)
            eye_h = max(ey_max - ey_min, 1e-6)

            offset_x = (ix - (ex_min + ex_max) / 2) / eye_w
            offset_y = (iy - (ey_min + ey_max) / 2) / eye_h

            return offset_x, offset_y

        try:
            ox_l, oy_l = _iris_offset(LEFT_IRIS, LEFT_EYE)
            ox_r, oy_r = _iris_offset(RIGHT_IRIS, RIGHT_EYE)

            avg_ox = (ox_l + ox_r) / 2.0
            avg_oy = (oy_l + oy_r) / 2.0

            if avg_ox < -GAZE_OFF_SCREEN_RATIO:
                return "LOOKING_RIGHT"   # mirrored in webcam
            if avg_ox > GAZE_OFF_SCREEN_RATIO:
                return "LOOKING_LEFT"
            if avg_oy < -GAZE_OFF_SCREEN_RATIO:
                return "LOOKING_UP"
            if avg_oy > GAZE_OFF_SCREEN_RATIO:
                return "LOOKING_DOWN"

            return "ON_SCREEN"
        except (IndexError, ZeroDivisionError):
            return "UNDETECTED"

    # ── Head pose (solvePnP) ─────────────────────────────────────

    @staticmethod
    def _estimate_head_pose(
        landmarks, w: int, h: int
    ) -> dict:
        """
        Estimate yaw / pitch / roll using cv2.solvePnP with 6 key
        face landmarks mapped to a canonical 3D head model.
        """
        try:
            image_points = np.array([
                (landmarks[idx].x * w, landmarks[idx].y * h)
                for idx in POSE_LANDMARK_IDS
            ], dtype=np.float64)

            focal_length = w
            centre = (w / 2, h / 2)
            camera_matrix = np.array([
                [focal_length, 0, centre[0]],
                [0, focal_length, centre[1]],
                [0, 0, 1],
            ], dtype=np.float64)
            dist_coeffs = np.zeros((4, 1))

            success, rvec, tvec = cv2.solvePnP(
                MODEL_POINTS_3D, image_points,
                camera_matrix, dist_coeffs,
                flags=cv2.SOLVEPNP_ITERATIVE,
            )

            if not success:
                return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

            rmat, _ = cv2.Rodrigues(rvec)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)

            return {
                "yaw": round(float(angles[1]), 2),
                "pitch": round(float(angles[0]), 2),
                "roll": round(float(angles[2]), 2),
            }
        except Exception:
            return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

    # ── Eye Aspect Ratio (EAR) ───────────────────────────────────

    @staticmethod
    def _compute_ear(landmarks, eye_ids: list, w: int, h: int) -> float:
        """
        EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
        Eye landmark order: [p1, p2, p3, p4, p5, p6] matching
        the eye outline indices in LEFT_EYE / RIGHT_EYE.
        """
        try:
            pts = [
                np.array([landmarks[idx].x * w, landmarks[idx].y * h])
                for idx in eye_ids
            ]
            # vertical distances
            v1 = np.linalg.norm(pts[1] - pts[5])
            v2 = np.linalg.norm(pts[2] - pts[4])
            # horizontal distance
            hz = np.linalg.norm(pts[0] - pts[3])
            if hz < 1e-6:
                return 0.3
            return (v1 + v2) / (2.0 * hz)
        except (IndexError, Exception):
            return 0.3

    def _process_blink(self, avg_ear: float, ts: float) -> bool:
        """Detect blink transition (open → closed → open)."""
        blink = False
        if avg_ear < EAR_BLINK_THRESHOLD:
            self._eye_closed = True
        else:
            if self._eye_closed:
                # rising edge = blink completed
                blink = True
                self._blink_window.append(ts)
                self.blink_timestamps.append(ts)
            self._eye_closed = False
        self._prev_ear = avg_ear
        return blink

    def _blinks_per_minute(self, now: float) -> float:
        """Compute blink rate over the last 60 seconds."""
        cutoff = now - 60.0
        recent = [t for t in self._blink_window if t >= cutoff]
        elapsed = min(now - (recent[0] if recent else now), 60.0)
        if elapsed < 5.0:
            return 0.0  # not enough data yet
        return (len(recent) / elapsed) * 60.0

    # ── Off-screen streak & flagging ─────────────────────────────

    def _update_off_screen_streak(
        self, is_off: bool, ts: float, frame: np.ndarray
    ):
        """Track continuous off-screen duration; emit soft/hard flags."""
        if is_off:
            if self._off_screen_start is None:
                self._off_screen_start = ts
                self._soft_flagged = False

            streak = ts - self._off_screen_start

            # Soft flag at 3 s
            if streak >= SOFT_FLAG_SECS and not self._soft_flagged:
                alert = self._make_alert(
                    ts, "MEDIUM", "GAZE_OFF_SCREEN_SOFT",
                    f"Off-screen gaze for {streak:.1f}s (≥{SOFT_FLAG_SECS}s)"
                )
                self.flag_log.append(alert)
                self._soft_flagged = True

            # Hard flag at 10 s
            if streak >= HARD_FLAG_SECS:
                screenshot_path = self._save_screenshot(frame, ts)
                alert = self._make_alert(
                    ts, "HIGH", "GAZE_OFF_SCREEN_HARD",
                    f"Off-screen gaze for {streak:.1f}s (≥{HARD_FLAG_SECS}s). "
                    f"Screenshot: {screenshot_path}"
                )
                self.flag_log.append(alert)
                # reset so we don't spam every frame
                self._off_screen_start = ts
                self._soft_flagged = False
        else:
            self._off_screen_start = None
            self._soft_flagged = False

    def _save_screenshot(self, frame: np.ndarray, ts: float) -> str:
        """Save a timestamped screenshot for evidence."""
        os.makedirs(self.screenshot_dir, exist_ok=True)
        fname = f"gaze_flag_{int(ts)}.jpg"
        path = os.path.join(self.screenshot_dir, fname)
        try:
            cv2.imwrite(path, frame)
        except Exception:
            path = "screenshot_failed"
        return path

    # ── Multi-person detection (YOLO v8) ─────────────────────────

    def _detect_persons(self, frame: np.ndarray) -> int:
        """Run YOLOv8 on the frame; return number of persons detected."""
        if self.yolo is None:
            return 1  # default fallback

        # Only run YOLO every 10th frame for performance
        if self.frame_count % 10 != 0:
            return 1

        try:
            results = self.yolo(frame, verbose=False, conf=YOLO_PERSON_CONF)
            person_count = 0
            for r in results:
                for box in r.boxes:
                    # class 0 = person in COCO
                    if int(box.cls[0]) == 0:
                        person_count += 1
            return max(person_count, 0)
        except Exception:
            return 1

    # ── Alert helper ─────────────────────────────────────────────

    @staticmethod
    def _make_alert(
        ts: float, severity: str, alert_type: str, detail: str
    ) -> dict:
        return {
            "timestamp": ts,
            "datetime": datetime.fromtimestamp(ts, tz=timezone.utc).isoformat(),
            "severity": severity,        # LOW | MEDIUM | HIGH | CRITICAL
            "type": alert_type,
            "detail": detail,
        }


# ═══════════════════════════════════════════════════════════════════
# CLI — standalone test
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    tracker = GazeTracker()
    report = tracker.run(duration_seconds=30)

    print("\nGaze & Face Proctoring Report")
    print("=" * 50)
    print(f"  Total frames analysed : {report['total_frames']}")
    print(f"  Off-screen %          : {report['off_screen_pct']}%")
    print(f"  Blinks/min            : {report['blinks_per_min']}")
    print(f"  Blink flag            : {report['blink_flag']}")
    print(f"  Total alerts          : {report['total_alerts']}")
    print(f"  Severity breakdown    : {report['severity_counts']}")
    print(f"  Integrity flag        : {report['integrity_flag']}")
    if report['flag_log']:
        print(f"\n  Recent flags:")
        for f in report['flag_log'][-5:]:
            print(f"    [{f['severity']}] {f['type']}: {f['detail']}")
