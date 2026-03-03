"""
FastAPI Server — AI Interview Platform
Wraps all 8 Python AI services as REST endpoints.
CORS enabled for localhost:3000 (Next.js dev server).

Start: uvicorn main:app --reload --port 8000
Docs:  http://localhost:8000/docs
"""

import uuid
import base64
import tempfile
import os
import time
from datetime import datetime
from typing import Optional
from collections import Counter

import cv2
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── IMPORT AI SERVICES ────────────────────────────────────────────
from resume_parser import parse_resume, build_gap_matrix, get_difficulty_level
from question_generator import generate_interview_questions
from ai_answer_detection import build_baseline, detect_ai_answer
from contradiction_engine import detect_contradictions
from emotion_detection import EmotionTracker
from face_verification import FaceVerifier
from person_detection import PersonDetector

# ── APP SETUP ─────────────────────────────────────────────────────
app = FastAPI(title="AI Interview Platform", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── IN-MEMORY SESSION STORE ──────────────────────────────────────
sessions: dict[str, dict] = {}
baselines: dict[str, dict] = {}
face_verifiers: dict[str, FaceVerifier] = {}


# ── PYDANTIC MODELS ──────────────────────────────────────────────

class GenerateQuestionsRequest(BaseModel):
    session_id: str
    self_intro: Optional[str] = ""
    jd_skills: Optional[list[str]] = []

class DetectAIRequest(BaseModel):
    session_id: str
    answer: str

class SubmitAnswerRequest(BaseModel):
    session_id: str
    question_index: int
    question: str
    answer: str
    skill: Optional[str] = ""

class ContradictionRequest(BaseModel):
    session_id: str

class AnalyzeFrameRequest(BaseModel):
    session_id: str
    frame_b64: str
    enroll: Optional[bool] = False


# ── HELPER ────────────────────────────────────────────────────────

def b64_to_cv2(frame_b64: str) -> np.ndarray:
    img_bytes = base64.b64decode(frame_b64)
    np_arr = np.frombuffer(img_bytes, np.uint8)
    frame = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image from base64 data")
    return frame


# ═══════════════════════════════════════════════════════════════════
# 1 — Health Check
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ═══════════════════════════════════════════════════════════════════
# 2 — Start Session
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/start-session")
def start_session():
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "id": session_id,
        "created_at": datetime.utcnow().isoformat(),
        "resume": None,
        "gap_matrix": None,
        "difficulty": "MID",
        "questions": [],
        "answers": [],
        "proctoring_events": [],
        "contradictions": [],
        "status": "UPLOAD",
    }
    return {"session_id": session_id}


# ═══════════════════════════════════════════════════════════════════
# 3 — Parse Resume
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/parse-resume")
async def api_parse_resume(
    file: UploadFile = File(...),
    session_id: str = Form(...),
    jd_skills: str = Form(""),
):
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    suffix = ".pdf" if file.filename.endswith(".pdf") else ".docx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        resume_data = parse_resume(tmp_path)
    except Exception as e:
        print(f"[WARN] pyresparser failed: {e}. Using fallback resume data.")
        # Fallback: return skeleton so the flow continues
        name_from_file = (file.filename or "candidate").rsplit(".", 1)[0].replace("_", " ").replace("-", " ").title()
        resume_data = {
            "name": name_from_file,
            "email": "",
            "mobile": "",
            "skills": [],
            "total_exp_years": 0,
            "education": [],
            "companies": [],
            "designations": [],
            "no_of_pages": 1,
        }
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    jd_list = [s.strip().lower() for s in jd_skills.split(",") if s.strip()]
    gap_matrix = build_gap_matrix(resume_data, jd_list) if jd_list else {
        "matched_skills": [],
        "missing_skills": [],
        "extra_skills": resume_data.get("skills", []),
        "gap_score": 1.0,
        "coverage_pct": 100.0,
    }
    difficulty = get_difficulty_level(resume_data)

    sessions[session_id]["resume"] = resume_data
    sessions[session_id]["gap_matrix"] = gap_matrix
    sessions[session_id]["difficulty"] = difficulty

    return {
        "resume": resume_data,
        "gap_matrix": gap_matrix,
        "difficulty": difficulty,
    }


# ═══════════════════════════════════════════════════════════════════
# 4 — Generate Questions
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/generate-questions")
def api_generate_questions(body: GenerateQuestionsRequest):
    session = sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session["resume"]:
        raise HTTPException(status_code=400, detail="Parse resume first")

    gap_matrix = session["gap_matrix"]
    if body.jd_skills:
        gap_matrix = build_gap_matrix(session["resume"], body.jd_skills)
        sessions[body.session_id]["gap_matrix"] = gap_matrix

    raw_questions = generate_interview_questions(
        resume_data=session["resume"],
        gap_matrix=gap_matrix,
        difficulty=session["difficulty"],
        num_questions=10,
    )

    # Transform to match frontend Question interface:
    # Backend returns: {question, skill, difficulty, probe_type}
    # Frontend expects: {id, text, topic, difficulty, format, probe_type, why}
    diff_map = {"BEGINNER": 1, "JUNIOR": 2, "MID": 3, "SENIOR": 4, "PRINCIPAL": 5}
    code_keywords = {"implement", "write", "code", "function", "algorithm", "lru", "cache"}
    questions = []
    for i, q in enumerate(raw_questions):
        q_text = q.get("question", "")
        q_lower = q_text.lower()
        is_code = any(kw in q_lower for kw in code_keywords)
        questions.append({
            "id": i + 1,
            "text": q_text,
            "topic": q.get("skill", "general"),
            "difficulty": diff_map.get(q.get("difficulty", "MID"), 3),
            "format": "code" if is_code else "text",
            "probe_type": q.get("probe_type", ""),
            "why": f"{'Gap' if q.get('probe_type') == 'GAP' else 'Verify'}: {q.get('skill', 'general')} skill",
        })

    sessions[body.session_id]["questions"] = questions
    sessions[body.session_id]["status"] = "INTERVIEW"

    if body.self_intro:
        try:
            baselines[body.session_id] = build_baseline([body.self_intro])
        except Exception:
            pass

    return {"questions": questions, "difficulty": session["difficulty"]}


# ═══════════════════════════════════════════════════════════════════
# 5 — Analyze Webcam Frame (Emotion + Face Verify + Multi-Person)
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/analyze-frame")
def api_analyze_frame(body: AnalyzeFrameRequest):
    session = sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        frame = b64_to_cv2(body.frame_b64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    result = {
        "ts": time.time(),
        "emotion": None,
        "emotion_scores": {},
        "face_verified": None,
        "face_distance": None,
        "face_count": 1,
        "alerts": [],
    }

    # ── EMOTION DETECTION ─────────────────────────────────────────
    try:
        from deepface import DeepFace
        analysis = DeepFace.analyze(
            frame, actions=["emotion"], enforce_detection=False, silent=True
        )
        result["emotion"] = analysis[0]["dominant_emotion"]
        result["emotion_scores"] = analysis[0]["emotion"]
    except Exception:
        result["emotion"] = "unknown"

    # ── FACE VERIFICATION ─────────────────────────────────────────
    try:
        if body.session_id not in face_verifiers:
            face_verifiers[body.session_id] = FaceVerifier()

        verifier = face_verifiers[body.session_id]

        if body.enroll or not verifier.enrolled:
            verifier.enroll_candidate(frame)
            result["face_verified"] = True
            result["face_distance"] = 0.0
        else:
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
                cv2.imwrite(tmp.name, frame)
                tmp_path = tmp.name
            same, dist = verifier.verify_candidate(tmp_path)
            os.unlink(tmp_path)

            result["face_verified"] = same
            result["face_distance"] = round(dist, 4)

            if not same:
                result["alerts"].append("IDENTITY_MISMATCH")
    except Exception:
        pass

    # ── MULTI-PERSON DETECTION ────────────────────────────────────
    try:
        from deepface import DeepFace
        faces = DeepFace.extract_faces(
            frame, enforce_detection=False, detector_backend="opencv"
        )
        result["face_count"] = len(faces)
        if len(faces) > 1:
            result["alerts"].append(f"MULTIPLE_FACES:{len(faces)}")
    except Exception:
        pass

    sessions[body.session_id]["proctoring_events"].append(result)
    return result


# ═══════════════════════════════════════════════════════════════════
# 6 — Submit Answer + Score
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/submit-answer")
def api_submit_answer(body: SubmitAnswerRequest):
    session = sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Basic scoring heuristic (word count)
    word_count = len(body.answer.split())
    if word_count < 10:
        score = 2
    elif word_count < 30:
        score = 4
    elif word_count < 60:
        score = 6
    elif word_count < 100:
        score = 8
    else:
        score = 9

    if body.skill and body.skill.lower() in body.answer.lower():
        score = min(score + 1, 10)

    # AI detection
    ai_result = {"ai_risk_score": 0, "flags": [], "ai_flagged": False}
    baseline = baselines.get(body.session_id)
    if baseline:
        try:
            ai_result = detect_ai_answer(body.answer, baseline)
        except Exception:
            pass

    answer_record = {
        "question_index": body.question_index,
        "question": body.question,
        "answer": body.answer,
        "skill": body.skill,
        "score": score,
        "ai_risk_score": ai_result["ai_risk_score"],
        "ai_flagged": ai_result["ai_flagged"],
        "ai_flags": ai_result["flags"],
    }
    sessions[body.session_id]["answers"].append(answer_record)

    return {
        "score": score,
        "ai_risk_score": ai_result["ai_risk_score"],
        "ai_flagged": ai_result["ai_flagged"],
        "ai_flags": ai_result["flags"],
    }


# ═══════════════════════════════════════════════════════════════════
# 7 — Detect AI Answer (standalone)
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/detect-ai-answer")
def api_detect_ai_answer(body: DetectAIRequest):
    baseline = baselines.get(body.session_id)
    if not baseline:
        raise HTTPException(
            status_code=400,
            detail="No baseline found. Generate questions with a self_intro first."
        )
    return detect_ai_answer(body.answer, baseline)


# ═══════════════════════════════════════════════════════════════════
# 8 — Detect Contradictions
# ═══════════════════════════════════════════════════════════════════

@app.post("/api/detect-contradictions")
def api_detect_contradictions(body: ContradictionRequest):
    session = sessions.get(body.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if not session["resume"]:
        raise HTTPException(status_code=400, detail="No resume in session")

    contradictions = detect_contradictions(
        resume_data=session["resume"],
        qa_pairs=session["answers"],
    )
    sessions[body.session_id]["contradictions"] = contradictions
    return {"contradictions": contradictions}


# ═══════════════════════════════════════════════════════════════════
# 9 — Get Session (Report Page)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/session/{session_id}")
def get_session(session_id: str):
    session = sessions.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = session["answers"]
    proctoring = session["proctoring_events"]

    avg_score = (
        round(sum(a["score"] for a in answers) / len(answers), 1)
        if answers else 0
    )
    ai_flagged_count = sum(1 for a in answers if a.get("ai_flagged"))

    emotions = [e["emotion"] for e in proctoring if e.get("emotion")]
    emotion_dist = dict(Counter(emotions))

    stress_emotions = {"fearful", "angry", "disgusted"}
    stress_count = sum(emotion_dist.get(e, 0) for e in stress_emotions)
    total_emotion_samples = max(len(emotions), 1)
    stress_pct = round(stress_count / total_emotion_samples * 100, 1)

    identity_mismatches = sum(
        1 for e in proctoring if "IDENTITY_MISMATCH" in e.get("alerts", [])
    )
    multi_face_incidents = sum(
        1 for e in proctoring
        if any(a.startswith("MULTIPLE_FACES") for a in e.get("alerts", []))
    )

    skill_scores: dict[str, list] = {}
    for a in answers:
        skill = a.get("skill", "general")
        skill_scores.setdefault(skill, []).append(a["score"])
    skill_summary = {
        skill: round(sum(scores) / len(scores), 1)
        for skill, scores in skill_scores.items()
    }

    return {
        **session,
        "summary": {
            "avg_score": avg_score,
            "total_questions": len(session["questions"]),
            "answered": len(answers),
            "ai_flagged_answers": ai_flagged_count,
            "stress_pct": stress_pct,
            "emotion_distribution": emotion_dist,
            "identity_mismatches": identity_mismatches,
            "multi_face_incidents": multi_face_incidents,
            "skill_scores": skill_summary,
        },
    }


# ═══════════════════════════════════════════════════════════════════
# 10 — List All Sessions (Dashboard)
# ═══════════════════════════════════════════════════════════════════

@app.get("/api/sessions")
def list_sessions():
    result = []
    for s in sessions.values():
        answers = s["answers"]
        avg_score = (
            round(sum(a["score"] for a in answers) / len(answers), 1)
            if answers else 0
        )
        result.append({
            "id": s["id"],
            "created_at": s["created_at"],
            "status": s["status"],
            "candidate_name": (s["resume"] or {}).get("name", "Unknown"),
            "avg_score": avg_score,
            "answered": len(answers),
            "total_questions": len(s["questions"]),
            "difficulty": s["difficulty"],
        })

    result.sort(key=lambda x: x["created_at"], reverse=True)
    return {"sessions": result}
