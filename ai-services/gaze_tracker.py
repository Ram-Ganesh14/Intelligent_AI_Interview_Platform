"""
Feature A1 — Real-Time Gaze Tracking (Off-Screen Detection)
Uses GazeTracking library to detect WHERE the candidate is looking.
Flags sustained off-screen gaze as a potential cheating signal.

GitHub Source: github.com/antoinelame/GazeTracking
Install: pip install gaze-tracking opencv-python
"""

import cv2
import time
from gaze_tracking import GazeTracking


def run_gaze_tracking(duration_seconds: int = 300) -> dict:
    """
    Run real-time gaze tracking for the specified duration.
    Returns a gaze integrity report with off-screen percentage.
    """
    gaze = GazeTracking()
    cap = cv2.VideoCapture(0)

    log = []
    off_screen_count = 0
    total_frames = 0
    start_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Check duration
        if time.time() - start_time > duration_seconds:
            break

        gaze.refresh(frame)
        total_frames += 1
        ts = time.time()

        # ── CLASSIFY GAZE ────────────────────────────────────────
        if gaze.is_blinking():
            direction = "BLINKING"
        elif gaze.is_right():
            direction = "LOOKING_RIGHT"
            off_screen_count += 1
        elif gaze.is_left():
            direction = "LOOKING_LEFT"
            off_screen_count += 1
        elif gaze.is_center():
            direction = "ON_SCREEN"
        else:
            direction = "UNDETECTED"

        log.append({"ts": ts, "direction": direction})

        # ── REAL-TIME OVERLAY (for testing) ──────────────────────
        frame = gaze.annotated_frame()
        cv2.putText(
            frame,
            direction,
            (60, 60),
            cv2.FONT_HERSHEY_DUPLEX,
            1.2,
            (0, 0, 200),
            2,
        )

        # ── PUPIL COORDINATES (for evidence logging) ─────────────
        lp = gaze.pupil_left_coords()
        rp = gaze.pupil_right_coords()
        cv2.putText(
            frame,
            f"L:{lp}  R:{rp}",
            (60, 110),
            cv2.FONT_HERSHEY_DUPLEX,
            0.8,
            (50, 200, 50),
            1,
        )

        cv2.imshow("Gaze Monitor", frame)
        if cv2.waitKey(1) == 27:  # ESC to stop
            break

    cap.release()
    cv2.destroyAllWindows()

    # ── COMPUTE INTEGRITY SCORE ──────────────────────────────────
    off_pct = (off_screen_count / max(total_frames, 1)) * 100

    gaze_report = {
        "total_frames": total_frames,
        "off_screen_pct": round(off_pct, 2),
        "gaze_log": log,
        "integrity_flag": off_pct > 30,  # flag if >30% off-screen
    }

    return gaze_report


if __name__ == "__main__":
    report = run_gaze_tracking(duration_seconds=30)
    print("Gaze Integrity Report:")
    print(f"  Total frames: {report['total_frames']}")
    print(f"  Off-screen %: {report['off_screen_pct']}%")
    print(f"  Integrity flag: {report['integrity_flag']}")
