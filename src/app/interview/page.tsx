"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    FiZap, FiClock, FiSend, FiCode, FiMessageSquare, FiMic,
    FiEye, FiSmile, FiShield, FiChevronRight,
    FiAlertTriangle, FiMonitor, FiCheckCircle, FiSkipForward,
    FiTarget,
} from "react-icons/fi";
import { analyzeFrame, submitAnswer, detectContradictions } from "@/lib/api";

/* ── Types ── */
interface Question {
    id: number;
    text: string;
    topic: string;
    difficulty: number;
    format: string;
    probe_type?: string;
    why?: string;
}

/* ── Fallback questions ── */
const FALLBACK_QUESTIONS: Question[] = [
    { id: 1, text: "Tell me about yourself and your technical background.", topic: "Introduction", difficulty: 1, format: "behavioral" },
    { id: 2, text: "Explain a technical concept you recently learned and how you would teach it to a junior developer.", topic: "Communication", difficulty: 2, format: "text" },
    { id: 3, text: "Write a function to reverse a string without using built-in reverse methods.", topic: "Coding", difficulty: 2, format: "code" },
];

/* ── Tab Switch Detection ── */
interface FocusEvent {
    event: string;
    ts: number;
    switchCount?: number;
    duration_ms?: number;
}

/* ── Main Component ── */
export default function InterviewPage() {
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [answer, setAnswer] = useState("");
    const [timeLeft, setTimeLeft] = useState(45 * 60);
    const [submitted, setSubmitted] = useState<Record<number, string>>({});
    const [scores, setScores] = useState<Record<number, number>>({});
    const [sessionActive, setSessionActive] = useState(true);
    const [showResults, setShowResults] = useState(false);
    const [difficulty, setDifficulty] = useState(2);
    const [role, setRole] = useState("");
    const [candidateName, setCandidateName] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Audio recording state
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef<any>(null);

    // Proctoring state — now driven by FastAPI
    const [gazeStatus, setGazeStatus] = useState<"ON_SCREEN" | "OFF_SCREEN">("ON_SCREEN");
    const [emotion, setEmotion] = useState("Neutral");
    const [tabSwitches, setTabSwitches] = useState(0);
    const [integrityScore, setIntegrityScore] = useState(100);
    const [faceVerified, setFaceVerified] = useState(true);
    const [faceCount, setFaceCount] = useState(1);

    const switchCountRef = useRef(0);
    const focusLogRef = useRef<FocusEvent[]>([]);

    // Session ID from sessionStorage
    const [sessionId, setSessionId] = useState("");

    // Webcam ref
    const videoRef = useRef<HTMLVideoElement>(null);
    const isFirstFrame = useRef(true);

    // Speech Recognition Setup
    useEffect(() => {
        if (typeof window !== "undefined") {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            if (SpeechRecognition) {
                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = "en-US";

                recognition.onresult = (event: any) => {
                    let transcript = "";
                    for (let i = 0; i < event.results.length; ++i) {
                        transcript += event.results[i][0].transcript;
                    }
                    setAnswer(transcript);
                };

                recognition.onend = () => {
                    setIsRecording(false);
                };

                recognitionRef.current = recognition;
            }
        }
    }, []);

    const toggleRecording = () => {
        if (!recognitionRef.current) {
            alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
            return;
        }
        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            setAnswer("");
            recognitionRef.current.start();
            setIsRecording(true);
        }
    };

    // ── Load questions + session from sessionStorage ──
    useEffect(() => {
        const stored = sessionStorage.getItem("interviewQuestions");
        const storedRole = sessionStorage.getItem("interviewRole");
        const storedDiff = sessionStorage.getItem("interviewDifficulty");
        const storedName = sessionStorage.getItem("candidateName");
        const storedSession = sessionStorage.getItem("sessionId");

        if (storedSession) setSessionId(storedSession);

        if (stored) {
            try {
                const parsed = JSON.parse(stored) as Question[];
                setQuestions(parsed);
                setRole(storedRole || "");
                setCandidateName(storedName || "");
                const diffMap: Record<string, number> = { BEGINNER: 1, JUNIOR: 2, MID: 3, SENIOR: 4, PRINCIPAL: 5 };
                setDifficulty(diffMap[storedDiff || "MID"] || 3);
            } catch {
                setQuestions(FALLBACK_QUESTIONS);
            }
        } else {
            setQuestions(FALLBACK_QUESTIONS);
        }
        setLoaded(true);
    }, []);

    // ── Webcam + Frame Analysis (replaces Math.random() proctoring) ──
    useEffect(() => {
        if (!sessionId) return;

        // Start webcam
        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            if (videoRef.current) videoRef.current.srcObject = stream;
        }).catch(() => {
            console.warn("Could not access webcam — proctoring will use fallback data");
        });

        // Send frame every 3 seconds
        const interval = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;

            try {
                const canvas = document.createElement("canvas");
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);

                const b64 = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

                const result = await analyzeFrame(sessionId, b64, isFirstFrame.current);
                isFirstFrame.current = false;

                // Update proctoring sidebar
                if (result.emotion) setEmotion(result.emotion.charAt(0).toUpperCase() + result.emotion.slice(1));
                if (result.face_verified !== null) setFaceVerified(result.face_verified);
                if (result.face_count !== undefined) setFaceCount(result.face_count);

                // Infer gaze from emotion (if face detected = on screen)
                setGazeStatus(result.face_verified !== false ? "ON_SCREEN" : "OFF_SCREEN");

                // Handle alerts
                if (result.alerts && result.alerts.length > 0) {
                    for (const alert of result.alerts) {
                        if (alert === "IDENTITY_MISMATCH") {
                            setIntegrityScore(prev => Math.max(0, prev - 10));
                        }
                        if (alert.startsWith("MULTIPLE_FACES")) {
                            setIntegrityScore(prev => Math.max(0, prev - 15));
                        }
                    }
                }
            } catch (e) {
                console.warn("Frame analysis failed:", e);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [sessionId]);

    // Timer
    useEffect(() => {
        if (!sessionActive || timeLeft <= 0) return;
        const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);
        return () => clearInterval(t);
    }, [sessionActive, timeLeft]);

    // Tab Switch Detection
    useEffect(() => {
        const handleVisibility = () => {
            const ts = Date.now();
            if (document.hidden) {
                switchCountRef.current++;
                setTabSwitches(switchCountRef.current);
                focusLogRef.current.push({ event: "TAB_HIDDEN", ts, switchCount: switchCountRef.current });
                setIntegrityScore((prev) => Math.max(0, prev - 8));
            } else {
                focusLogRef.current.push({ event: "TAB_VISIBLE", ts });
            }
        };

        const handleBlur = () => {
            focusLogRef.current.push({ event: "WINDOW_BLUR", ts: Date.now() });
        };

        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("blur", handleBlur);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("blur", handleBlur);
        };
    }, []);

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    };

    // ── Submit answer to FastAPI ──
    const handleSubmit = useCallback(async () => {
        if (isRecording && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }

        const currentMode = questions[currentQ]?.format === "code" ? "code" : "voice";
        if ((currentMode === "code" && !answer.trim()) || questions.length === 0) return;

        setSubmitting(true);

        try {
            const q = questions[currentQ];
            const answerText = currentMode === "code" ? answer : (answer || "Voice Answer Recorded");

            // Call FastAPI for scoring + AI detection
            const result = await submitAnswer(
                sessionId,
                currentQ,
                q.text,
                answerText,
                q.topic
            );

            const score = result.score || 5;

            setSubmitted((prev) => ({ ...prev, [currentQ]: answerText }));
            setScores((prev) => ({ ...prev, [currentQ]: score }));

            if (score >= 7 && difficulty < 5) setDifficulty((d) => d + 1);
            else if (score <= 4 && difficulty > 1) setDifficulty((d) => d - 1);

            setAnswer("");
            if (currentQ < questions.length - 1) {
                setCurrentQ((p) => p + 1);
            } else {
                // Interview done — detect contradictions then show results
                try {
                    await detectContradictions(sessionId);
                } catch { /* non-fatal */ }
                setSessionActive(false);
                setShowResults(true);
            }
        } catch (err) {
            console.error("Submit failed:", err);
            // Fallback: still advance
            setSubmitted((prev) => ({ ...prev, [currentQ]: answer || "Voice Answer Recorded" }));
            setScores((prev) => ({ ...prev, [currentQ]: 5 }));
            setAnswer("");
            if (currentQ < questions.length - 1) {
                setCurrentQ((p) => p + 1);
            } else {
                setSessionActive(false);
                setShowResults(true);
            }
        }

        setSubmitting(false);
    }, [answer, currentQ, difficulty, questions, isRecording, sessionId]);

    if (!loaded) return null;

    const q = questions[currentQ];

    if (showResults) {
        const totalScore = Object.values(scores);
        const avg = totalScore.length ? Math.round((totalScore.reduce((a, b) => a + b, 0) / totalScore.length) * 10) : 0;

        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="glass-card animate-fade-in-up" style={{ maxWidth: 600, width: "100%", padding: 40, textAlign: "center" }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                        <FiCheckCircle size={36} color="#fff" />
                    </div>
                    <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: 8 }}>Interview Complete!</h2>
                    <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>
                        {candidateName ? `Great work, ${candidateName}!` : "Here's your session summary"}
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-blue)" }}>{avg}%</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Overall Score</div>
                        </div>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--accent-cyan)" }}>{Object.keys(submitted).length}</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Answered</div>
                        </div>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: integrityScore >= 70 ? "var(--accent-green)" : "var(--accent-red)" }}>{integrityScore}%</div>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Integrity</div>
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                        <Link href={`/report/${sessionId || "latest"}`} className="btn-primary"><FiChevronRight size={16} /> View Full Report</Link>
                        <Link href="/dashboard" className="btn-secondary">Dashboard</Link>
                    </div>
                </div>
            </div>
        );
    }

    if (!q) return null;

    const effectiveMode = q.format === "code" ? "code" : "voice";

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
            {/* Hidden webcam video element for frame capture */}
            <video ref={videoRef} autoPlay muted playsInline style={{ display: "none" }} />

            {/* Top Bar */}
            <div style={{ height: 56, borderBottom: "1px solid var(--border-glass)", background: "rgba(10,10,15,0.9)", backdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", position: "sticky", top: 0, zIndex: 50 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FiZap size={18} style={{ color: "var(--accent-blue)" }} />
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        {candidateName ? `${candidateName}'s Interview` : "Live Interview"}
                    </span>
                    {role && <span className="badge badge-blue">{role}</span>}
                    <span className="badge badge-purple">
                        <FiTarget size={10} /> {q.topic}
                    </span>
                    {q.probe_type && (
                        <span className={`badge ${q.probe_type === "GAP" ? "badge-red" : q.probe_type === "VERIFY" ? "badge-orange" : "badge-cyan"}`} style={{ fontSize: "0.65rem" }}>
                            {q.probe_type}
                        </span>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: timeLeft < 300 ? "var(--accent-red)" : "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "0.9rem", fontWeight: 600 }}>
                        <FiClock size={16} /> {formatTime(timeLeft)}
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Q {currentQ + 1}/{questions.length}</span>
                </div>
            </div>

            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", overflow: "hidden" }}>
                {/* Main Interview Area */}
                <div style={{ display: "flex", flexDirection: "column", overflow: "auto" }}>
                    {/* Question */}
                    <div style={{ padding: "28px 32px", borderBottom: "1px solid var(--border-glass)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--accent-blue)" }}>QUESTION {currentQ + 1}</span>
                            <span className={`badge ${q.format === "code" ? "badge-orange" : q.format === "behavioral" ? "badge-pink" : q.format === "system_design" ? "badge-purple" : "badge-cyan"}`} style={{ fontSize: "0.65rem" }}>
                                {q.format.toUpperCase().replace("_", " ")}
                            </span>
                            <span className="badge badge-green" style={{ fontSize: "0.65rem" }}>Difficulty {q.difficulty}/5</span>
                        </div>
                        <p style={{ fontSize: "1.05rem", lineHeight: 1.7, color: "var(--text-primary)", fontWeight: 500 }}>{q.text}</p>
                        {q.why && (
                            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8, fontStyle: "italic" }}>
                                📌 This question was generated because: {q.why}
                            </p>
                        )}
                    </div>

                    {/* Answer Area */}
                    <div style={{ flex: 1, padding: "20px 32px", display: "flex", flexDirection: "column" }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                            {effectiveMode === "code" ? (
                                <button className="btn-sm btn-primary" style={{ padding: "8px 16px" }}>
                                    <FiCode size={14} /> Code
                                </button>
                            ) : (
                                <button className="btn-sm btn-primary" style={{ padding: "8px 16px" }}>
                                    <FiMic size={14} /> Voice Response
                                </button>
                            )}
                            <button className="btn-secondary btn-sm" style={{ padding: "8px 16px", marginLeft: "auto", opacity: 0.7 }}>
                                {effectiveMode === "code" ? "Syntax Highlighting Enabled" : "Microphone Active"}
                            </button>
                        </div>

                        {effectiveMode === "code" ? (
                            <textarea
                                value={answer}
                                onChange={(e) => setAnswer(e.target.value)}
                                placeholder="// Write your code here..."
                                style={{
                                    flex: 1, minHeight: 280, background: "rgba(0,0,0,0.3)",
                                    border: "1px solid var(--border-glass)", borderRadius: "var(--radius-md)",
                                    padding: 20, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)",
                                    fontSize: "0.88rem", lineHeight: 1.6, resize: "none", outline: "none",
                                }}
                            />
                        ) : (
                            <div style={{
                                flex: 1, minHeight: 280, display: "flex", flexDirection: "column",
                                alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.2)",
                                border: "1px dashed var(--border-glass)", borderRadius: "var(--radius-md)",
                                padding: 20
                            }}>
                                <div
                                    onClick={toggleRecording}
                                    style={{
                                        width: 80, height: 80, borderRadius: "50%",
                                        background: isRecording ? "rgba(239, 68, 68, 0.1)" : "rgba(59, 130, 246, 0.1)",
                                        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
                                        border: `2px solid ${isRecording ? "var(--accent-red)" : "var(--accent-blue)"}`,
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                        transform: isRecording ? "scale(1.05)" : "scale(1)"
                                    }}>
                                    <FiMic size={32} color={isRecording ? "var(--accent-red)" : "var(--accent-blue)"} />
                                </div>
                                <p style={{ color: "var(--text-secondary)", fontSize: "1.1rem", fontWeight: 500 }}>
                                    {isRecording ? "Listening..." : "Click microphone to start recording"}
                                </p>
                                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: 8 }}>
                                    {isRecording ? "Speak clearly. Click mic again to stop." : (answer ? "Answer recorded. Click Submit or re-record." : "Your answer will be transcribed automatically.")}
                                </p>

                                {answer && (
                                    <div style={{
                                        marginTop: 24, padding: 16, background: "rgba(0,0,0,0.3)",
                                        border: "1px solid var(--border-glass)", borderRadius: "var(--radius-sm)",
                                        width: "100%", maxWidth: 600, maxHeight: 120, overflowY: "auto",
                                        fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.6
                                    }}>
                                        <span style={{ color: "var(--accent-blue)", fontWeight: 600, fontSize: "0.75rem", display: "block", marginBottom: 4 }}>TRANSCRIPT</span>
                                        {answer}
                                    </div>
                                )}
                            </div>
                        )}

                        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
                            <button onClick={() => {
                                if (isRecording && recognitionRef.current) {
                                    recognitionRef.current.stop();
                                    setIsRecording(false);
                                }
                                setAnswer("");
                                setCurrentQ(p => Math.min(p + 1, questions.length - 1));
                            }} className="btn-secondary btn-sm">
                                <FiSkipForward size={14} /> Skip
                            </button>
                            <button onClick={handleSubmit} className="btn-primary" disabled={submitting || (effectiveMode === "code" && !answer.trim())} style={{ opacity: (effectiveMode !== "code" || answer.trim()) && !submitting ? 1 : 0.5 }}>
                                <FiSend size={16} /> {submitting ? "Scoring..." : "Submit Answer"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Proctoring Sidebar */}
                <div style={{ borderLeft: "1px solid var(--border-glass)", background: "var(--bg-secondary)", padding: 20, overflow: "auto" }}>
                    <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
                        <FiShield size={14} style={{ marginRight: 6, verticalAlign: "middle" }} />
                        Proctoring
                    </h3>

                    {/* Integrity Score */}
                    <div className="glass-card" style={{ padding: 16, marginBottom: 12, textAlign: "center" }}>
                        <div style={{ fontSize: "1.6rem", fontWeight: 800, color: integrityScore >= 70 ? "var(--accent-green)" : integrityScore >= 40 ? "var(--accent-orange)" : "var(--accent-red)" }}>
                            {integrityScore}%
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>Integrity Score</div>
                    </div>

                    {/* Gaze */}
                    <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <FiEye size={14} style={{ color: "var(--accent-purple)" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>Gaze Tracking</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className={`status-dot ${gazeStatus === "ON_SCREEN" ? "active" : "danger"}`} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 500, color: gazeStatus === "ON_SCREEN" ? "var(--accent-green)" : "var(--accent-red)" }}>
                                {gazeStatus === "ON_SCREEN" ? "On Screen" : "Off Screen!"}
                            </span>
                        </div>
                    </div>

                    {/* Emotion */}
                    <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <FiSmile size={14} style={{ color: "var(--accent-cyan)" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>Emotion</span>
                        </div>
                        <span className={`badge ${emotion === "Fearful" ? "badge-red" : emotion === "Happy" ? "badge-green" : "badge-blue"}`}>
                            {emotion}
                        </span>
                    </div>

                    {/* Tab Switches */}
                    <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <FiMonitor size={14} style={{ color: "var(--accent-orange)" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>Tab Focus</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {tabSwitches > 3 ? <FiAlertTriangle size={14} style={{ color: "var(--accent-red)" }} /> : <FiCheckCircle size={14} style={{ color: "var(--accent-green)" }} />}
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: tabSwitches > 3 ? "var(--accent-red)" : "var(--text-secondary)" }}>
                                {tabSwitches} switches
                            </span>
                        </div>
                    </div>

                    {/* Face Verify */}
                    <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <FiShield size={14} style={{ color: faceVerified ? "var(--accent-green)" : "var(--accent-red)" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>Identity</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className={`status-dot ${faceVerified ? "active" : "danger"}`} />
                            <span style={{ fontSize: "0.78rem", color: faceVerified ? "var(--accent-green)" : "var(--accent-red)" }}>
                                {faceVerified ? "Verified" : "Mismatch!"}
                            </span>
                        </div>
                    </div>

                    {/* Multi-Face */}
                    {faceCount > 1 && (
                        <div className="glass-card" style={{ padding: 14, marginBottom: 10, borderLeft: "3px solid var(--accent-red)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <FiAlertTriangle size={14} style={{ color: "var(--accent-red)" }} />
                                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--accent-red)" }}>
                                    {faceCount} faces detected!
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Answered Log */}
                    <div style={{ marginTop: 16 }}>
                        <h4 style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Answered</h4>
                        {Object.entries(scores).map(([idx, score]) => (
                            <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-glass)" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                                    Q{Number(idx) + 1} · {questions[Number(idx)]?.topic || ""}
                                </span>
                                <span style={{ fontSize: "0.75rem", fontWeight: 600, color: score >= 7 ? "var(--accent-green)" : score >= 5 ? "var(--accent-orange)" : "var(--accent-red)" }}>
                                    {score}/10
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
