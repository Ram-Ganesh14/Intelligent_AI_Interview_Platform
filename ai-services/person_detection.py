"""
Feature B3 — Background Person Detection (Coaching Alert)
Detects if a second person appears in the camera frame.
Uses DeepFace multi-person detection to count faces.

Install: pip install deepface opencv-python
"""

import cv2
import time
from deepface import DeepFace


class PersonDetector:
    """Detects multiple people in camera frame during interview."""

    def __init__(self, check_every: int = 20):
        self.check_every = check_every
        self.multi_face_log = []
        self.total_frames = 0
        self.multi_face_count = 0

    def run(self, duration_seconds: int = 300) -> dict:
        """Run multi-person detection for the specified duration."""
        cap = cv2.VideoCapture(0)
        start_time = time.time()

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if time.time() - start_time > duration_seconds:
                break

            self.total_frames += 1

            # ── DETECT ALL FACES IN FRAME ─────────────────────────
            if self.total_frames % self.check_every == 0:
                try:
                    faces = DeepFace.extract_faces(
                        frame,
                        enforce_detection=False,
                        detector_backend="opencv",
                    )
                    face_count = len(faces)

                    if face_count > 1:
                        self.multi_face_count += 1
                        event = {
                            "ts": time.time(),
                            "face_count": face_count,
                            "frame_no": self.total_frames,
                        }
                        self.multi_face_log.append(event)
                        print(
                            f"[ALERT] {face_count} faces detected! "
                            f"Possible coaching."
                        )

                        # Draw red border on frame as visual alert
                        h, w = frame.shape[:2]
                        cv2.rectangle(frame, (0, 0), (w, h), (0, 0, 255), 8)
                        cv2.putText(
                            frame,
                            f"ALERT: {face_count} FACES",
                            (30, 60),
                            cv2.FONT_HERSHEY_DUPLEX,
                            1.2,
                            (0, 0, 255),
                            2,
                        )
                except Exception:
                    pass

            cv2.imshow("Multi-Person Monitor", frame)
            if cv2.waitKey(1) == 27:
                break

        cap.release()
        cv2.destroyAllWindows()

        return {
            "multi_face_incidents": self.multi_face_count,
            "multi_face_log": self.multi_face_log,
            "coaching_flag": self.multi_face_count >= 3,
        }


if __name__ == "__main__":
    detector = PersonDetector(check_every=20)
    report = detector.run(duration_seconds=15)
    print("Multi-Person Report:")
    print(f"  Incidents: {report['multi_face_incidents']}")
    print(f"  Coaching flag: {report['coaching_flag']}")
