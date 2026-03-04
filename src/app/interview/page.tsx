"use client";

import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    FiZap, FiClock, FiSend, FiCode, FiMessageSquare, FiMic,
    FiEye, FiSmile, FiShield, FiChevronRight,
    FiAlertTriangle, FiMonitor, FiCheckCircle, FiSkipForward,
    FiTarget, FiMaximize,
} from "react-icons/fi";
import {
    analyzeFrame, submitAnswer, detectContradictions,
    logIntegrityEvent, startIntegritySession, endIntegritySession,
} from "@/lib/api";

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
    questionIndex?: number;
}

/* ── Constants ── */
const MAX_STRIKES = 3;
const TERMINATION_DELAY_MS = 3500;

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

    // ── STRIKE SYSTEM STATE ──
    const [strikes, setStrikes] = useState(0);
    const [showWarningOverlay, setShowWarningOverlay] = useState(false);
    const [showTerminationOverlay, setShowTerminationOverlay] = useState(false);
    const [terminationCountdown, setTerminationCountdown] = useState(3.5);
    const [lastSwitchTime, setLastSwitchTime] = useState<string>("");
    const [lastSwitchQuestion, setLastSwitchQuestion] = useState(0);

    // ── FULLSCREEN STATE ──
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showFullscreenGate, setShowFullscreenGate] = useState(true);
    const [showFullscreenRestore, setShowFullscreenRestore] = useState(false);
    const [fullscreenExits, setFullscreenExits] = useState(0);

    // ── INTEGRITY SESSION ──
    const [integritySessionId, setIntegritySessionId] = useState("");
    const sessionStartTimeRef = useRef(Date.now());

    const switchCountRef = useRef(0);
    const focusLogRef = useRef<FocusEvent[]>([]);
    const strikesRef = useRef(0);

    // Session ID from sessionStorage
    const [sessionId, setSessionId] = useState("");

    // Webcam ref
    const videoRef = useRef<HTMLVideoElement>(null);
    const isFirstFrame = useRef(true);

    // Current question ref (for closures)
    const currentQRef = useRef(0);
    useEffect(() => { currentQRef.current = currentQ; }, [currentQ]);

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

    // ── Start integrity session ──
    useEffect(() => {
        if (!sessionId) return;
        sessionStartTimeRef.current = Date.now();
        startIntegritySession(sessionId, candidateName, role)
            .then(data => {
                if (data?.session_id) {
                    setIntegritySessionId(data.session_id);
                    sessionStorage.setItem("integritySessionId", data.session_id);
                }
            })
            .catch(() => { /* non-fatal */ });
    }, [sessionId, candidateName, role]);

    // ── FULLSCREEN ENFORCEMENT ──
    const enterFullscreen = useCallback(async () => {
        try {
            await document.documentElement.requestFullscreen();
            setIsFullscreen(true);
            setShowFullscreenGate(false);
            setShowFullscreenRestore(false);
        } catch {
            console.warn("Fullscreen request denied");
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const isFull = !!document.fullscreenElement;
            setIsFullscreen(isFull);

            if (!isFull && !showFullscreenGate) {
                // Exited fullscreen mid-interview
                setShowFullscreenRestore(true);
                setFullscreenExits(prev => prev + 1);
                setIntegrityScore(prev => Math.max(0, prev - 10));

                // Log to integrity service
                const elapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
                if (integritySessionId) {
                    logIntegrityEvent(
                        integritySessionId,
                        "fullscreen_exit",
                        elapsed,
                        currentQRef.current,
                    );
                }
            }
        };

        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [showFullscreenGate, integritySessionId]);

    // ── Webcam + Frame Analysis ──
    useEffect(() => {
        if (!sessionId || showFullscreenGate) return;

        navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
            if (videoRef.current) videoRef.current.srcObject = stream;
        }).catch(() => {
            console.warn("Could not access webcam — proctoring will use fallback data");
        });

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

                if (result.emotion) setEmotion(result.emotion.charAt(0).toUpperCase() + result.emotion.slice(1));
                if (result.face_verified !== null) setFaceVerified(result.face_verified);
                if (result.face_count !== undefined) setFaceCount(result.face_count);

                // Gaze from new gaze tracker
                if (result.gaze_direction) {
                    setGazeStatus(result.gaze_direction === "ON_SCREEN" ? "ON_SCREEN" : "OFF_SCREEN");
                } else {
                    setGazeStatus(result.face_verified !== false ? "ON_SCREEN" : "OFF_SCREEN");
                }

                if (result.alerts && result.alerts.length > 0) {
                    for (const alert of result.alerts) {
                        if (alert === "IDENTITY_MISMATCH") {
                            setIntegrityScore(prev => Math.max(0, prev - 10));
                        }
                        if (typeof alert === "string" && (alert.startsWith("MULTIPLE_FACES") || alert.startsWith("MULTIPLE_PERSONS"))) {
                            setIntegrityScore(prev => Math.max(0, prev - 15));
                        }
                    }
                }
            } catch (e) {
                console.warn("Frame analysis failed:", e);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [sessionId, showFullscreenGate]);

    // Timer
    useEffect(() => {
        if (!sessionActive || timeLeft <= 0 || showFullscreenGate) return;
        const t = setInterval(() => setTimeLeft((v) => v - 1), 1000);
        return () => clearInterval(t);
    }, [sessionActive, timeLeft, showFullscreenGate]);

    // ── TAB SWITCH DETECTION WITH STRIKE SYSTEM ──
    useEffect(() => {
        if (showFullscreenGate) return;

        const handleVisibility = () => {
            const ts = Date.now();
            if (document.hidden) {
                switchCountRef.current++;
                strikesRef.current++;
                const currentStrikes = strikesRef.current;

                setTabSwitches(switchCountRef.current);
                setStrikes(currentStrikes);
                setLastSwitchTime(new Date(ts).toLocaleTimeString());
                setLastSwitchQuestion(currentQRef.current + 1);
                setIntegrityScore((prev) => Math.max(0, prev - 20));

                focusLogRef.current.push({
                    event: "TAB_HIDDEN",
                    ts,
                    switchCount: switchCountRef.current,
                    questionIndex: currentQRef.current,
                });

                // Log to integrity service
                const elapsed = Math.floor((ts - sessionStartTimeRef.current) / 1000);
                if (integritySessionId) {
                    logIntegrityEvent(
                        integritySessionId,
                        "tab_switch",
                        elapsed,
                        currentQRef.current,
                        { switchCount: switchCountRef.current },
                    );
                }

                if (currentStrikes >= MAX_STRIKES) {
                    // TERMINATION
                    setShowTerminationOverlay(true);
                } else {
                    // Show warning
                    setShowWarningOverlay(true);
                }
            } else {
                focusLogRef.current.push({ event: "TAB_VISIBLE", ts });
            }
        };

        const handleBlur = () => {
            const ts = Date.now();
            focusLogRef.current.push({ event: "WINDOW_BLUR", ts });

            // Log focus loss to integrity service
            const elapsed = Math.floor((ts - sessionStartTimeRef.current) / 1000);
            if (integritySessionId) {
                logIntegrityEvent(
                    integritySessionId,
                    "focus_loss",
                    elapsed,
                    currentQRef.current,
                );
            }
        };

        document.addEventListener("visibilitychange", handleVisibility);
        window.addEventListener("blur", handleBlur);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("blur", handleBlur);
        };
    }, [showFullscreenGate, integritySessionId]);

    // ── TERMINATION COUNTDOWN ──
    useEffect(() => {
        if (!showTerminationOverlay) return;

        setTerminationCountdown(3.5);
        const start = Date.now();
        const interval = setInterval(() => {
            const elapsed = (Date.now() - start) / 1000;
            const remaining = Math.max(0, 3.5 - elapsed);
            setTerminationCountdown(remaining);

            if (remaining <= 0) {
                clearInterval(interval);
                // End integrity session
                if (integritySessionId) {
                    endIntegritySession(integritySessionId);
                }
                // Navigate to report
                setSessionActive(false);
                setShowTerminationOverlay(false);
                setShowResults(true);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [showTerminationOverlay, integritySessionId]);

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
                try {
                    await detectContradictions(sessionId);
                } catch { /* non-fatal */ }
                if (integritySessionId) endIntegritySession(integritySessionId);
                setSessionActive(false);
                setShowResults(true);
            }
        } catch (err) {
            console.error("Submit failed:", err);
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
    }, [answer, currentQ, difficulty, questions, isRecording, sessionId, integritySessionId]);

    if (!loaded) return null;

    const q = questions[currentQ];

    // ══════════════════════════════════════════════════════════════
    // FULLSCREEN GATE OVERLAY
    // ══════════════════════════════════════════════════════════════
    if (showFullscreenGate) {
        return (
            <div style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "linear-gradient(135deg, #0a0a12 0%, #1a1a2e 50%, #0d0d1a 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <div style={{
                    textAlign: "center", maxWidth: 480, padding: 48,
                    background: "rgba(255,255,255,0.03)", borderRadius: 24,
                    border: "1px solid rgba(255,255,255,0.08)",
                    backdropFilter: "blur(24px)",
                }}>
                    <div style={{
                        width: 80, height: 80, borderRadius: "50%",
                        background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 24px", boxShadow: "0 0 40px rgba(59,130,246,0.3)",
                    }}>
                        <FiMaximize size={36} color="#fff" />
                    </div>

                    <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", marginBottom: 12 }}>
                        Fullscreen Required
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem", lineHeight: 1.7, marginBottom: 8 }}>
                        To ensure interview integrity, you must enter fullscreen mode before proceeding.
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem", lineHeight: 1.5, marginBottom: 32 }}>
                        Exiting fullscreen during the interview will be logged as a violation.
                        Tab switches are limited to <strong style={{ color: "#ef4444" }}>3 strikes</strong> before auto-termination.
                    </p>

                    <button
                        onClick={enterFullscreen}
                        style={{
                            padding: "14px 40px", borderRadius: 12,
                            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
                            border: "none", color: "#fff", fontSize: "1rem",
                            fontWeight: 700, cursor: "pointer",
                            boxShadow: "0 4px 20px rgba(59,130,246,0.4)",
                            transition: "transform 0.2s, box-shadow 0.2s",
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 8px 30px rgba(59,130,246,0.5)";
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "0 4px 20px rgba(59,130,246,0.4)";
                        }}
                    >
                        <FiMaximize size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />
                        Enter Fullscreen & Begin
                    </button>

                    <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 24 }}>
                        {[
                            { icon: FiShield, label: "Proctored" },
                            { icon: FiEye, label: "Gaze Tracked" },
                            { icon: FiMonitor, label: "Tab Monitored" },
                        ].map((item) => (
                            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.35)", fontSize: "0.72rem" }}>
                                <item.icon size={12} />
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════
    // FULLSCREEN RESTORE OVERLAY
    // ══════════════════════════════════════════════════════════════
    if (showFullscreenRestore) {
        return (
            <div style={{
                position: "fixed", inset: 0, zIndex: 9998,
                background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <div style={{
                    textAlign: "center", maxWidth: 440, padding: 40,
                    background: "rgba(239,68,68,0.05)", borderRadius: 20,
                    border: "1px solid rgba(239,68,68,0.2)",
                }}>
                    <FiAlertTriangle size={48} style={{ color: "#ef4444", marginBottom: 20 }} />
                    <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: 10 }}>
                        Fullscreen Exited
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", marginBottom: 24 }}>
                        You must return to fullscreen to continue the interview.
                        This violation has been recorded.
                    </p>
                    <button
                        onClick={enterFullscreen}
                        style={{
                            padding: "12px 32px", borderRadius: 10,
                            background: "linear-gradient(135deg, #ef4444, #dc2626)",
                            border: "none", color: "#fff", fontSize: "0.95rem",
                            fontWeight: 700, cursor: "pointer",
                        }}
                    >
                        <FiMaximize size={14} style={{ marginRight: 8, verticalAlign: "middle" }} />
                        Re-enter Fullscreen
                    </button>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════
    // TERMINATION OVERLAY (3.5s countdown, NO dismiss)
    // ══════════════════════════════════════════════════════════════
    if (showTerminationOverlay) {
        return (
            <div style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "rgba(0,0,0,0.95)", backdropFilter: "blur(16px)",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <div style={{
                    textAlign: "center", maxWidth: 500, padding: 48,
                    background: "rgba(239,68,68,0.06)", borderRadius: 24,
                    border: "2px solid rgba(239,68,68,0.3)",
                }}>
                    <div style={{
                        width: 90, height: 90, borderRadius: "50%",
                        background: "rgba(239,68,68,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 24px",
                        border: "3px solid #ef4444",
                        animation: "pulse 1s ease-in-out infinite",
                    }}>
                        <FiAlertTriangle size={40} color="#ef4444" />
                    </div>

                    <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#ef4444", marginBottom: 12 }}>
                        Interview Terminated
                    </h2>
                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1rem", marginBottom: 8 }}>
                        You have exceeded the maximum of <strong>{MAX_STRIKES} tab switches</strong>.
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: 28 }}>
                        This session is being terminated for integrity violations.
                    </p>

                    {/* Strike dots — all red */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 28 }}>
                        {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                            <div key={i} style={{
                                width: 20, height: 20, borderRadius: "50%",
                                background: "#ef4444",
                                boxShadow: "0 0 12px rgba(239,68,68,0.6)",
                            }} />
                        ))}
                    </div>

                    <div style={{
                        fontSize: "2.5rem", fontWeight: 800, color: "#ef4444",
                        fontFamily: "var(--font-mono)",
                    }}>
                        {terminationCountdown.toFixed(1)}s
                    </div>
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem", marginTop: 8 }}>
                        Redirecting to report...
                    </p>
                </div>
            </div>
        );
    }

    // ══════════════════════════════════════════════════════════════
    // WARNING OVERLAY (dismissible)
    // ══════════════════════════════════════════════════════════════
    const warningOverlay = showWarningOverlay ? (
        <div style={{
            position: "fixed", inset: 0, zIndex: 9997,
            background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
        }}>
            <div style={{
                textAlign: "center", maxWidth: 460, padding: 40,
                background: "rgba(245,158,11,0.06)", borderRadius: 20,
                border: "1px solid rgba(245,158,11,0.25)",
            }}>
                <FiAlertTriangle size={40} style={{ color: "#f59e0b", marginBottom: 16 }} />

                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", marginBottom: 10 }}>
                    Tab Switch Detected!
                </h2>

                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.92rem", marginBottom: 6 }}>
                    Strike <strong style={{ color: "#f59e0b" }}>{strikes}</strong> of <strong>{MAX_STRIKES}</strong>
                </p>

                {lastSwitchTime && (
                    <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.82rem", marginBottom: 4 }}>
                        Detected at {lastSwitchTime} • Question {lastSwitchQuestion}
                    </p>
                )}

                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.82rem", marginBottom: 24 }}>
                    {MAX_STRIKES - strikes} switch{MAX_STRIKES - strikes !== 1 ? "es" : ""} remaining before auto-termination.
                </p>

                {/* Strike dots */}
                <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 28 }}>
                    {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                        <div key={i} style={{
                            width: 18, height: 18, borderRadius: "50%",
                            background: i < strikes ? "#ef4444" : "rgba(255,255,255,0.15)",
                            border: i < strikes ? "2px solid #ef4444" : "2px solid rgba(255,255,255,0.2)",
                            boxShadow: i < strikes ? "0 0 10px rgba(239,68,68,0.5)" : "none",
                            transition: "all 0.3s ease",
                        }} />
                    ))}
                </div>

                <button
                    onClick={() => setShowWarningOverlay(false)}
                    style={{
                        padding: "12px 32px", borderRadius: 10,
                        background: "linear-gradient(135deg, #f59e0b, #d97706)",
                        border: "none", color: "#000", fontSize: "0.9rem",
                        fontWeight: 700, cursor: "pointer",
                    }}
                >
                    I Understand — Continue
                </button>
            </div>
        </div>
    ) : null;

    if (showResults) {
        const totalScore = Object.values(scores);
        const avg = totalScore.length ? Math.round((totalScore.reduce((a, b) => a + b, 0) / totalScore.length) * 10) : 0;

        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="glass-card animate-fade-in-up" style={{ maxWidth: 680, width: "100%", padding: 40, textAlign: "center" }}>
                    <div style={{ width: 80, height: 80, borderRadius: "50%", background: strikes >= MAX_STRIKES ? "linear-gradient(135deg, #ef4444, #dc2626)" : "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                        {strikes >= MAX_STRIKES
                            ? <FiAlertTriangle size={36} color="#fff" />
                            : <FiCheckCircle size={36} color="#fff" />
                        }
                    </div>
                    <h2 style={{ fontSize: "1.6rem", fontWeight: 800, marginBottom: 8 }}>
                        {strikes >= MAX_STRIKES ? "Interview Terminated" : "Interview Complete!"}
                    </h2>
                    <p style={{ color: "var(--text-secondary)", marginBottom: 28 }}>
                        {strikes >= MAX_STRIKES
                            ? `Session terminated after ${MAX_STRIKES} tab switch violations.`
                            : candidateName ? `Great work, ${candidateName}!` : "Here's your session summary"
                        }
                    </p>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
                        <div className="glass-card" style={{ padding: 14 }}>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-blue)" }}>{avg}%</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Score</div>
                        </div>
                        <div className="glass-card" style={{ padding: 14 }}>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--accent-cyan)" }}>{Object.keys(submitted).length}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Answered</div>
                        </div>
                        <div className="glass-card" style={{ padding: 14 }}>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: integrityScore >= 70 ? "var(--accent-green)" : "var(--accent-red)" }}>{integrityScore}%</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Integrity</div>
                        </div>
                        <div className="glass-card" style={{ padding: 14 }}>
                            <div style={{ fontSize: "1.4rem", fontWeight: 800, color: strikes > 0 ? "var(--accent-red)" : "var(--accent-green)" }}>{strikes}</div>
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Strikes</div>
                        </div>
                    </div>

                    {/* Violation Log Table */}
                    {focusLogRef.current.filter(e => e.event === "TAB_HIDDEN").length > 0 && (
                        <div style={{ textAlign: "left", marginBottom: 24 }}>
                            <h3 style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                                Violation Log
                            </h3>
                            <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-glass)" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
                                    <thead>
                                        <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                                            <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>#</th>
                                            <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Time</th>
                                            <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Question</th>
                                            <th style={{ padding: "8px 12px", textAlign: "left", color: "var(--text-muted)", fontWeight: 600 }}>Severity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {focusLogRef.current
                                            .filter(e => e.event === "TAB_HIDDEN")
                                            .map((e, i) => {
                                                const severity = (i + 1) === 1 ? "MEDIUM" : (i + 1) === 2 ? "HIGH" : "CRITICAL";
                                                const sevColor = severity === "MEDIUM" ? "#f59e0b" : severity === "HIGH" ? "#f97316" : "#ef4444";
                                                return (
                                                    <tr key={i} style={{ borderTop: "1px solid var(--border-glass)" }}>
                                                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>{i + 1}</td>
                                                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
                                                            {new Date(e.ts).toLocaleTimeString()}
                                                        </td>
                                                        <td style={{ padding: "8px 12px", color: "var(--text-secondary)" }}>
                                                            Q{(e.questionIndex ?? 0) + 1}
                                                        </td>
                                                        <td style={{ padding: "8px 12px" }}>
                                                            <span style={{
                                                                padding: "2px 8px", borderRadius: 6, fontSize: "0.7rem",
                                                                fontWeight: 700, background: `${sevColor}20`, color: sevColor,
                                                            }}>
                                                                {severity}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

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
            {/* Warning overlay */}
            {warningOverlay}

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
                    {/* Strike dots in top bar */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 4 }}>
                        {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                            <div
                                key={i}
                                title={`Strike ${i + 1}${i < strikes ? " — triggered" : ""}`}
                                style={{
                                    width: 10, height: 10, borderRadius: "50%",
                                    background: i < strikes ? "#ef4444" : "rgba(255,255,255,0.15)",
                                    border: i < strikes ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.1)",
                                    boxShadow: i < strikes ? "0 0 6px rgba(239,68,68,0.5)" : "none",
                                    transition: "all 0.3s ease",
                                }}
                            />
                        ))}
                    </div>
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

                    {/* Tab Switches with Strike Dots */}
                    <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                            <FiMonitor size={14} style={{ color: "var(--accent-orange)" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>Tab Focus</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                            {strikes > 0 ? <FiAlertTriangle size={14} style={{ color: "var(--accent-red)" }} /> : <FiCheckCircle size={14} style={{ color: "var(--accent-green)" }} />}
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: strikes > 0 ? "var(--accent-red)" : "var(--text-secondary)" }}>
                                {tabSwitches} switches
                            </span>
                        </div>
                        {/* Strike dots */}
                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            {Array.from({ length: MAX_STRIKES }).map((_, i) => (
                                <div key={i} style={{
                                    width: 14, height: 14, borderRadius: "50%",
                                    background: i < strikes ? "#ef4444" : "rgba(255,255,255,0.1)",
                                    border: i < strikes ? "2px solid #ef4444" : "2px solid rgba(255,255,255,0.15)",
                                    boxShadow: i < strikes ? "0 0 8px rgba(239,68,68,0.5)" : "none",
                                    transition: "all 0.3s ease",
                                }} title={`Strike ${i + 1}`} />
                            ))}
                            <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginLeft: 4 }}>
                                {MAX_STRIKES - strikes} left
                            </span>
                        </div>
                    </div>

                    {/* Fullscreen Compliance */}
                    <div className="glass-card" style={{ padding: 14, marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <FiMaximize size={14} style={{ color: isFullscreen ? "var(--accent-green)" : "var(--accent-red)" }} />
                            <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-secondary)" }}>Fullscreen</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span className={`status-dot ${isFullscreen ? "active" : "danger"}`} />
                            <span style={{ fontSize: "0.78rem", color: isFullscreen ? "var(--accent-green)" : "var(--accent-red)" }}>
                                {isFullscreen ? "Active" : "Exited"}
                            </span>
                            {fullscreenExits > 0 && (
                                <span style={{ fontSize: "0.68rem", color: "var(--accent-red)", marginLeft: "auto" }}>
                                    {fullscreenExits} exit{fullscreenExits !== 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
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
