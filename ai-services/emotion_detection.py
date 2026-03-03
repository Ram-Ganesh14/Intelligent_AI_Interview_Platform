"""
Feature A2 — Real-Time Emotion Detection Timeline
Classifies facial emotion every frame into 7 categories:
Angry, Disgusted, Fearful, Happy, Neutral, Sad, Surprised.

Builds a timeline mapped against question timestamps.

GitHub Source: github.com/atulapra/Emotion-detection
Model: Deep CNN trained on FER-2013 (35,887 images, 7 emotions)
Install: pip install deepface opencv-python
"""

import cv2
import time
from collections import Counter
from deepface import DeepFace


class EmotionTracker:
    """Tracks facial emotions throughout an interview session."""

    def __init__(self, sample_every: int = 15):
        self.sample_every = sample_every
        self.emotion_timeline = []
        self.question_markers = []
        self.frame_count = 0

    def add_question_marker(self, q_id: str, q_text: str):
        """Call this whenever a new question starts."""
        self.question_markers.append(
            {"ts": time.time(), "q_id": q_id, "q_text": q_text}
        )

    def run(self, duration_seconds: int = 300) -> dict:
        """Run emotion detection for the specified duration."""
        cap = cv2.VideoCapture(0)
        start_time = time.time()

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if time.time() - start_time > duration_seconds:
                break

            self.frame_count += 1

            # ── ANALYSE EVERY Nth FRAME ───────────────────────────
            if self.frame_count % self.sample_every == 0:
                try:
                    result = DeepFace.analyze(
                        frame,
                        actions=["emotion"],
                        enforce_detection=False,
                        silent=True,
                    )
                    dominant = result[0]["dominant_emotion"]
                    scores = result[0]["emotion"]

                    self.emotion_timeline.append(
                        {
                            "ts": time.time(),
                            "emotion": dominant,
                            "scores": scores,
                            "frame_no": self.frame_count,
                        }
                    )

                    # ── LIVE OVERLAY ─────────────────────────────
                    cv2.putText(
                        frame,
                        f"Emotion: {dominant}",
                        (30, 50),
                        cv2.FONT_HERSHEY_DUPLEX,
                        1.0,
                        (0, 200, 100),
                        2,
                    )
                except Exception:
                    pass  # no face detected in this frame

            cv2.imshow("Emotion Monitor", frame)
            if cv2.waitKey(1) == 27:
                break

        cap.release()
        cv2.destroyAllWindows()

        return self.build_report()

    def build_report(self) -> dict:
        """Build the emotion report from collected timeline data."""
        emotion_counts = Counter(e["emotion"] for e in self.emotion_timeline)
        total = max(len(self.emotion_timeline), 1)

        stress_pct = (
            (
                emotion_counts.get("fearful", 0)
                + emotion_counts.get("angry", 0)
                + emotion_counts.get("disgusted", 0)
            )
            / total
            * 100
        )

        return {
            "timeline": self.emotion_timeline,
            "question_markers": self.question_markers,
            "distribution": dict(emotion_counts),
            "stress_pct": round(stress_pct, 2),
            "stress_flag": stress_pct > 40,
        }


if __name__ == "__main__":
    tracker = EmotionTracker(sample_every=15)
    tracker.add_question_marker("q1", "Tell me about yourself")
    report = tracker.run(duration_seconds=15)
    print("Emotion Report:")
    print(f"  Distribution: {report['distribution']}")
    print(f"  Stress %: {report['stress_pct']}%")
    print(f"  Stress flag: {report['stress_flag']}")
