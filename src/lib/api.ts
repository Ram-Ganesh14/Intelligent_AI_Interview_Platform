export const API = "http://localhost:8000";

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
