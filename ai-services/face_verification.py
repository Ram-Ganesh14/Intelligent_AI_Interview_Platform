"""
Feature A3 — Continuous Face Verification (Proxy Candidate Detector)
Verifies the candidate who started the interview is still present.
Uses face embedding comparison (cosine similarity) to detect identity drift.

GitHub Source: github.com/serengil/deepface
Install: pip install deepface opencv-python
"""

import cv2
import time
from deepface import DeepFace


class FaceVerifier:
    """Continuous face verification during interview session."""

    def __init__(self, verify_interval: int = 60):
        self.verify_interval = verify_interval
        self.reference_path = "/tmp/candidate_reference.jpg"
        self.verification_log = []
        self.enrolled = False

    def enroll_candidate(self, frame) -> bool:
        """
        Call once at interview start.
        Stores the reference face for this candidate.
        """
        try:
            # Verify a face is present
            DeepFace.analyze(
                frame, actions=["emotion"], enforce_detection=True
            )
            cv2.imwrite(self.reference_path, frame)
            self.enrolled = True
            print("[ENROLL] Reference face saved.")
            return True
        except Exception as e:
            print(f"[ENROLL ERROR] {e}")
            return False

    def verify_candidate(self, current_frame_path: str) -> tuple:
        """
        Returns (is_same_person: bool, distance: float).
        """
        try:
            result = DeepFace.verify(
                img1_path=self.reference_path,
                img2_path=current_frame_path,
                model_name="VGG-Face",
                distance_metric="cosine",
                enforce_detection=False,
            )
            return result["verified"], result["distance"]
        except Exception:
            return False, 1.0  # no face = treat as mismatch

    def run(self, duration_seconds: int = 300) -> dict:
        """Run continuous verification loop."""
        cap = cv2.VideoCapture(0)
        last_verify_time = time.time()
        start_time = time.time()

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if time.time() - start_time > duration_seconds:
                break

            # Enroll on first frame
            if not self.enrolled:
                self.enroll_candidate(frame)

            # Verify every VERIFY_INTERVAL seconds
            if time.time() - last_verify_time > self.verify_interval:
                tmp_path = "/tmp/verify_frame.jpg"
                cv2.imwrite(tmp_path, frame)
                same, dist = self.verify_candidate(tmp_path)

                self.verification_log.append(
                    {
                        "ts": time.time(),
                        "same": same,
                        "distance": round(dist, 4),
                    }
                )

                if not same:
                    print(f"[ALERT] Identity mismatch! Distance={dist:.3f}")

                last_verify_time = time.time()

            cv2.imshow("Verification Monitor", frame)
            if cv2.waitKey(1) == 27:
                break

        cap.release()
        cv2.destroyAllWindows()

        mismatches = sum(1 for v in self.verification_log if not v["same"])
        return {
            "verification_log": self.verification_log,
            "total_checks": len(self.verification_log),
            "mismatches": mismatches,
            "identity_flag": mismatches > 0,
        }


if __name__ == "__main__":
    verifier = FaceVerifier(verify_interval=10)
    report = verifier.run(duration_seconds=30)
    print("Verification Report:", report)
