export const API = "http://localhost:8000";
export const INTEGRITY_API = "http://localhost:8001";
const INTEGRITY_KEY = "neuralhire-secret-key";

export async function startSession(): Promise<string> {
    const res = await fetch(`${API}/api/start-session`, { method: "POST" });
    const data = await res.json();
    return data.session_id;
}

export async function parseResume(file: File, sessionId: string, jdSkills: string) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("session_id", sessionId);
    fd.append("jd_skills", jdSkills);
    const res = await fetch(`${API}/api/parse-resume`, { method: "POST", body: fd });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(err.detail || `Parse failed (${res.status})`);
    }
    return res.json();
}

export async function generateQuestions(sessionId: string, selfIntro: string, jdSkills: string[]) {
    const res = await fetch(`${API}/api/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, self_intro: selfIntro, jd_skills: jdSkills }),
    });
    return res.json();
}

export async function analyzeFrame(sessionId: string, frameB64: string, enroll = false) {
    const res = await fetch(`${API}/api/analyze-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, frame_b64: frameB64, enroll }),
    });
    return res.json();
}

export async function submitAnswer(
    sessionId: string, questionIndex: number, question: string, answer: string, skill: string
) {
    const res = await fetch(`${API}/api/submit-answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            session_id: sessionId, question_index: questionIndex, question, answer, skill,
        }),
    });
    return res.json();
}

export async function getSession(sessionId: string) {
    const res = await fetch(`${API}/api/session/${sessionId}`);
    return res.json();
}

export async function getSessions() {
    const res = await fetch(`${API}/api/sessions`);
    return res.json();
}

export async function detectContradictions(sessionId: string) {
    const res = await fetch(`${API}/api/detect-contradictions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
    });
    return res.json();
}

// ── Integrity Service (port 8001) ──────────────────────────────

export async function startIntegritySession(candidateId: string, candidateName?: string, role?: string) {
    const res = await fetch(`${INTEGRITY_API}/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": INTEGRITY_KEY },
        body: JSON.stringify({ candidate_id: candidateId, candidate_name: candidateName, role }),
    });
    return res.json();
}

export async function logIntegrityEvent(
    sessionId: string,
    eventType: "tab_switch" | "fullscreen_exit" | "fullscreen_restore" | "focus_loss",
    elapsedSeconds: number,
    questionIndex: number,
    meta?: Record<string, unknown>
) {
    try {
        const res = await fetch(`${INTEGRITY_API}/events/log`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": INTEGRITY_KEY },
            body: JSON.stringify({
                session_id: sessionId,
                event_type: eventType,
                elapsed_seconds: elapsedSeconds,
                question_index: questionIndex,
                meta,
            }),
        });
        return res.json();
    } catch {
        return null; // non-fatal — integrity logging should not break the interview
    }
}

export async function getIntegrityReport(sessionId: string) {
    const res = await fetch(`${INTEGRITY_API}/sessions/${sessionId}/report`, {
        headers: { "x-api-key": INTEGRITY_KEY },
    });
    return res.json();
}

export async function endIntegritySession(sessionId: string) {
    try {
        const res = await fetch(`${INTEGRITY_API}/sessions/${sessionId}/end`, {
            method: "POST",
            headers: { "x-api-key": INTEGRITY_KEY },
        });
        return res.json();
    } catch {
        return null;
    }
}
