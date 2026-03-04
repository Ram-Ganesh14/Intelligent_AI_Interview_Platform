"""
NeuralHire — Tab Switch & Fullscreen Event Logging Backend
FastAPI service that receives, stores, and reports integrity events
from the AI Interview Platform frontend.

Start: uvicorn integrity_service:app --reload --port 8001
"""

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid
import sqlite3
import json
import os

# ─────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────
MAX_TAB_SWITCHES   = 3
DB_PATH            = "integrity_logs.db"
API_SECRET         = os.getenv("API_SECRET", "neuralhire-secret-key")

app = FastAPI(
    title="NeuralHire Integrity Service",
    description="Logs tab switch and fullscreen violations during interviews.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
#  DATABASE SETUP
# ─────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id      TEXT PRIMARY KEY,
                candidate_id    TEXT NOT NULL,
                candidate_name  TEXT,
                role            TEXT,
                started_at      TEXT NOT NULL,
                ended_at        TEXT,
                status          TEXT DEFAULT 'active',
                tab_switches    INTEGER DEFAULT 0,
                focus_losses    INTEGER DEFAULT 0,
                fullscreen_exits INTEGER DEFAULT 0,
                integrity_score INTEGER DEFAULT 100,
                terminated_reason TEXT
            );

            CREATE TABLE IF NOT EXISTS events (
                event_id        TEXT PRIMARY KEY,
                session_id      TEXT NOT NULL,
                event_type      TEXT NOT NULL,
                occurred_at     TEXT NOT NULL,
                elapsed_seconds INTEGER,
                question_index  INTEGER,
                severity        TEXT,
                meta            TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            );
        """)

init_db()

# ─────────────────────────────────────────────
#  AUTH
# ─────────────────────────────────────────────
def verify_token(x_api_key: str = Header(...)):
    if x_api_key != API_SECRET:
        raise HTTPException(status_code=401, detail="Invalid API key.")
    return x_api_key

# ─────────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────────
class StartSessionRequest(BaseModel):
    candidate_id:   str
    candidate_name: Optional[str] = None
    role:           Optional[str] = None

class StartSessionResponse(BaseModel):
    session_id:  str
    started_at:  str
    status:      str
    message:     str

class EventRequest(BaseModel):
    session_id:      str
    event_type:      Literal["tab_switch", "fullscreen_exit", "fullscreen_restore", "focus_loss"]
    elapsed_seconds: int   = Field(..., ge=0, description="Seconds since session start")
    question_index:  int   = Field(0,   ge=0)
    meta:            Optional[dict] = None

class EventResponse(BaseModel):
    event_id:         str
    session_id:       str
    event_type:       str
    severity:         str
    tab_switches:     int
    remaining_switches: int
    terminated:       bool
    message:          str

class SessionReport(BaseModel):
    session_id:        str
    candidate_id:      str
    candidate_name:    Optional[str]
    role:              Optional[str]
    status:            str
    started_at:        str
    ended_at:          Optional[str]
    duration_seconds:  Optional[int]
    tab_switches:      int
    focus_losses:      int
    fullscreen_exits:  int
    integrity_score:   int
    terminated_reason: Optional[str]
    events:            list

# ─────────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────────
def compute_severity(event_type: str, switch_count: int) -> str:
    if event_type == "tab_switch":
        if switch_count == 1: return "MEDIUM"
        if switch_count == 2: return "HIGH"
        return "CRITICAL"
    if event_type == "fullscreen_exit":
        return "HIGH"
    return "LOW"


def recalc_integrity(tab_switches: int, focus_losses: int, fullscreen_exits: int) -> int:
    score = 100
    score -= tab_switches    * 20
    score -= focus_losses    *  5
    score -= fullscreen_exits * 10
    return max(0, score)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

# ─────────────────────────────────────────────
#  ROUTES
# ─────────────────────────────────────────────

@app.post("/sessions/start", response_model=StartSessionResponse)
def start_session(
    body: StartSessionRequest,
    db:   sqlite3.Connection = Depends(get_db),
    _:    str = Depends(verify_token),
):
    """Create a new interview session."""
    session_id = str(uuid.uuid4())
    started_at = now_iso()
    db.execute(
        """INSERT INTO sessions
           (session_id, candidate_id, candidate_name, role, started_at)
           VALUES (?, ?, ?, ?, ?)""",
        (session_id, body.candidate_id, body.candidate_name, body.role, started_at),
    )
    db.commit()
    return StartSessionResponse(
        session_id=session_id,
        started_at=started_at,
        status="active",
        message="Session started. Integrity monitoring is active.",
    )


@app.post("/events/log", response_model=EventResponse)
def log_event(
    body: EventRequest,
    db:   sqlite3.Connection = Depends(get_db),
    _:    str = Depends(verify_token),
):
    """Log a tab switch, fullscreen exit, or focus loss event."""

    # Fetch session
    row = db.execute(
        "SELECT * FROM sessions WHERE session_id = ?", (body.session_id,)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    if row["status"] == "terminated":
        raise HTTPException(status_code=409, detail="Session already terminated.")

    # Update counters
    tab_switches     = row["tab_switches"]
    focus_losses     = row["focus_losses"]
    fullscreen_exits = row["fullscreen_exits"]

    if body.event_type == "tab_switch":
        tab_switches += 1
    elif body.event_type == "focus_loss":
        focus_losses += 1
    elif body.event_type == "fullscreen_exit":
        fullscreen_exits += 1

    integrity_score = recalc_integrity(tab_switches, focus_losses, fullscreen_exits)
    severity        = compute_severity(body.event_type, tab_switches)
    terminated      = tab_switches >= MAX_TAB_SWITCHES and body.event_type == "tab_switch"
    new_status      = "terminated" if terminated else row["status"]
    ended_at        = now_iso() if terminated else row["ended_at"]
    term_reason     = f"Exceeded {MAX_TAB_SWITCHES} tab switches" if terminated else row["terminated_reason"]

    # Persist event
    event_id = str(uuid.uuid4())
    db.execute(
        """INSERT INTO events
           (event_id, session_id, event_type, occurred_at,
            elapsed_seconds, question_index, severity, meta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            event_id, body.session_id, body.event_type, now_iso(),
            body.elapsed_seconds, body.question_index, severity,
            json.dumps(body.meta or {}),
        ),
    )

    # Update session
    db.execute(
        """UPDATE sessions SET
            tab_switches=?, focus_losses=?, fullscreen_exits=?,
            integrity_score=?, status=?, ended_at=?, terminated_reason=?
           WHERE session_id=?""",
        (
            tab_switches, focus_losses, fullscreen_exits,
            integrity_score, new_status, ended_at, term_reason,
            body.session_id,
        ),
    )
    db.commit()

    remaining = max(0, MAX_TAB_SWITCHES - tab_switches)
    msg = (
        f"Interview terminated after {MAX_TAB_SWITCHES} tab switches."
        if terminated
        else f"Tab switch #{tab_switches} logged. {remaining} remaining before termination."
        if body.event_type == "tab_switch"
        else f"Event '{body.event_type}' recorded."
    )

    return EventResponse(
        event_id=event_id,
        session_id=body.session_id,
        event_type=body.event_type,
        severity=severity,
        tab_switches=tab_switches,
        remaining_switches=remaining,
        terminated=terminated,
        message=msg,
    )


@app.get("/sessions/{session_id}/report", response_model=SessionReport)
def get_report(
    session_id: str,
    db: sqlite3.Connection = Depends(get_db),
    _:  str = Depends(verify_token),
):
    """Full integrity report for a session — intended for recruiters."""
    row = db.execute(
        "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")

    events = db.execute(
        """SELECT event_id, event_type, occurred_at,
                  elapsed_seconds, question_index, severity, meta
           FROM events WHERE session_id = ?
           ORDER BY occurred_at ASC""",
        (session_id,),
    ).fetchall()

    # Compute duration
    duration = None
    if row["started_at"] and row["ended_at"]:
        try:
            s = datetime.fromisoformat(row["started_at"])
            e = datetime.fromisoformat(row["ended_at"])
            duration = int((e - s).total_seconds())
        except Exception:
            pass

    return SessionReport(
        session_id=row["session_id"],
        candidate_id=row["candidate_id"],
        candidate_name=row["candidate_name"],
        role=row["role"],
        status=row["status"],
        started_at=row["started_at"],
        ended_at=row["ended_at"],
        duration_seconds=duration,
        tab_switches=row["tab_switches"],
        focus_losses=row["focus_losses"],
        fullscreen_exits=row["fullscreen_exits"],
        integrity_score=row["integrity_score"],
        terminated_reason=row["terminated_reason"],
        events=[
            {
                "event_id":        e["event_id"],
                "event_type":      e["event_type"],
                "occurred_at":     e["occurred_at"],
                "elapsed_seconds": e["elapsed_seconds"],
                "question_index":  e["question_index"],
                "severity":        e["severity"],
                "meta":            json.loads(e["meta"] or "{}"),
            }
            for e in events
        ],
    )


@app.post("/sessions/{session_id}/end")
def end_session(
    session_id: str,
    db: sqlite3.Connection = Depends(get_db),
    _:  str = Depends(verify_token),
):
    """Mark a session as completed normally."""
    row = db.execute(
        "SELECT status FROM sessions WHERE session_id = ?", (session_id,)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")
    if row["status"] == "terminated":
        raise HTTPException(status_code=409, detail="Session was already terminated.")

    db.execute(
        "UPDATE sessions SET status='completed', ended_at=? WHERE session_id=?",
        (now_iso(), session_id),
    )
    db.commit()
    return {"session_id": session_id, "status": "completed", "message": "Session ended normally."}


@app.get("/sessions/{session_id}/status")
def session_status(
    session_id: str,
    db: sqlite3.Connection = Depends(get_db),
    _:  str = Depends(verify_token),
):
    """Quick status check — used by frontend to verify termination state."""
    row = db.execute(
        """SELECT status, tab_switches, integrity_score, terminated_reason
           FROM sessions WHERE session_id = ?""",
        (session_id,),
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Session not found.")

    return {
        "session_id":        session_id,
        "status":            row["status"],
        "tab_switches":      row["tab_switches"],
        "remaining_switches": max(0, MAX_TAB_SWITCHES - row["tab_switches"]),
        "integrity_score":   row["integrity_score"],
        "terminated_reason": row["terminated_reason"],
    }


# ─────────────────────────────────────────────
#  ENTRYPOINT
# ─────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("integrity_service:app", host="0.0.0.0", port=8001, reload=True)
