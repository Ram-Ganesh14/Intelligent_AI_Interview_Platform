"""
Comprehensive test script for all AI services.
Tests each service with sample data (no camera required).
"""
import sys, json, traceback

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
results = []

def test(name, func):
    try:
        func()
        print(f"  {PASS}  {name}")
        results.append(("PASS", name))
    except Exception as e:
        print(f"  {FAIL}  {name}")
        print(f"         Error: {e}")
        traceback.print_exc()
        results.append(("FAIL", name))

# ── 1. RESUME PARSER ─────────────────────────────────────────────
print("\n" + "=" * 60)
print("1. RESUME PARSER")
print("=" * 60)

def test_resume_parser():
    from resume_parser import build_gap_matrix, get_difficulty_level
    resume = {"name": "Raj", "skills": ["Python", "Docker", "React"], "total_exp_years": 4}
    gap = build_gap_matrix(resume, ["Python", "FastAPI", "Docker", "Kubernetes"])
    assert "matched_skills" in gap and "missing_skills" in gap
    assert "python" in gap["matched_skills"]
    assert "kubernetes" in gap["missing_skills"]
    assert get_difficulty_level(resume) == "MID"

test("build_gap_matrix + get_difficulty_level", test_resume_parser)

# ── 2. QUESTION GENERATOR ────────────────────────────────────────
print("\n" + "=" * 60)
print("2. QUESTION GENERATOR")
print("=" * 60)

def test_question_gen():
    from question_generator import generate_interview_questions, select_next_difficulty
    resume = {"name": "Raj", "companies": ["Flipkart"], "skills": ["Python"]}
    gap = {"missing_skills": ["kubernetes", "aws"], "matched_skills": ["python"]}
    qs = generate_interview_questions(resume, gap, "MID", 3)
    assert isinstance(qs, list) and len(qs) > 0
    for q in qs:
        assert all(k in q for k in ["question", "skill", "difficulty", "probe_type"])

def test_difficulty():
    from question_generator import select_next_difficulty
    assert select_next_difficulty(9, "MID") == "SENIOR"
    assert select_next_difficulty(3, "MID") == "JUNIOR"
    assert select_next_difficulty(6, "MID") == "MID"

test("generate_interview_questions (fallback)", test_question_gen)
test("select_next_difficulty", test_difficulty)

# ── 3. CONTRADICTION ENGINE ──────────────────────────────────────
print("\n" + "=" * 60)
print("3. CONTRADICTION ENGINE")
print("=" * 60)

def test_contradictions():
    from contradiction_engine import detect_contradictions
    resume = {"skills": ["Python", "Kubernetes"], "total_exp_years": 4, "designations": []}
    qa = [{"question": "How does Kubernetes schedule pods?", "answer": "Idk", "score": 2},
          {"question": "Explain Python generators.", "answer": "Yield stuff", "score": 7}]
    result = detect_contradictions(resume, qa)
    assert isinstance(result, list) and len(result) > 0
    assert any("Kubernetes" in c.get("claimed", "") for c in result)

def test_no_contradictions():
    from contradiction_engine import detect_contradictions
    resume = {"skills": ["Python"], "total_exp_years": 2, "designations": []}
    qa = [{"question": "Explain Python.", "answer": "Great answer.", "score": 9}]
    assert detect_contradictions(resume, qa) == []

test("detect_contradictions (rule-based)", test_contradictions)
test("no contradictions for strong answers", test_no_contradictions)

# ── 4. AI ANSWER DETECTION ───────────────────────────────────────
print("\n" + "=" * 60)
print("4. AI ANSWER DETECTION (loads GPT-2, may take a moment)")
print("=" * 60)

def test_ai_detection():
    from ai_answer_detection import build_baseline, detect_ai_answer
    warmup = ["Yeah so I've been coding for 3 years, mostly web stuff",
              "I like Python a lot, um, mainly because it's readable"]
    baseline = build_baseline(warmup)
    assert "perplexity" in baseline and "vocab_richness" in baseline
    ai_answer = ("The Factory design pattern is a creational pattern that provides "
                 "an interface for creating objects in a superclass.")
    result = detect_ai_answer(ai_answer, baseline)
    assert all(k in result for k in ["ai_risk_score", "flags", "perplexity", "ai_flagged"])
    assert 0 <= result["ai_risk_score"] <= 1

test("build_baseline + detect_ai_answer (GPT-2)", test_ai_detection)

# ── 5. EMOTION DETECTION (no camera) ─────────────────────────────
print("\n" + "=" * 60)
print("5. EMOTION DETECTION")
print("=" * 60)

def test_emotion():
    from emotion_detection import EmotionTracker
    t = EmotionTracker(sample_every=10)
    assert t.sample_every == 10 and t.emotion_timeline == []
    t.emotion_timeline = [
        {"ts": 1, "emotion": "happy", "scores": {}, "frame_no": 15},
        {"ts": 2, "emotion": "fearful", "scores": {}, "frame_no": 30},
    ]
    report = t.build_report()
    assert "distribution" in report and "stress_pct" in report
    assert report["distribution"]["happy"] == 1

test("EmotionTracker init + build_report (simulated)", test_emotion)

# ── 6. FACE VERIFICATION (no camera) ─────────────────────────────
print("\n" + "=" * 60)
print("6. FACE VERIFICATION")
print("=" * 60)

def test_face():
    from face_verification import FaceVerifier
    v = FaceVerifier(verify_interval=30)
    assert v.verify_interval == 30 and v.enrolled is False

test("FaceVerifier init", test_face)

# ── 7. GAZE TRACKING (no camera) ─────────────────────────────────
print("\n" + "=" * 60)
print("7. GAZE TRACKING")
print("=" * 60)

def test_gaze():
    from gaze_tracker import run_gaze_tracking
    assert run_gaze_tracking is not None

test("GazeTracking import + init", test_gaze)

# ── 8. PERSON DETECTION (no camera) ──────────────────────────────
print("\n" + "=" * 60)
print("8. PERSON DETECTION")
print("=" * 60)

def test_person():
    from person_detection import PersonDetector
    d = PersonDetector(check_every=10)
    assert d.check_every == 10 and d.multi_face_log == []

test("PersonDetector init", test_person)

# ── SUMMARY ──────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("TEST SUMMARY")
print("=" * 60)
passed = sum(1 for r in results if r[0] == "PASS")
failed = sum(1 for r in results if r[0] == "FAIL")
print(f"\n  Total: {len(results)}  |  Passed: {passed}  |  Failed: {failed}")
if failed == 0:
    print(f"\n  ALL TESTS PASSED!")
else:
    print(f"\n  {failed} test(s) failed:")
    for s, n in results:
        if s == "FAIL": print(f"    - {n}")
print()
