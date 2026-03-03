"use client";

import Link from "next/link";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
    FiZap, FiUpload, FiFileText, FiCheckCircle,
    FiArrowRight, FiBarChart2, FiUser,
    FiX, FiPlay, FiMessageSquare, FiLoader,
} from "react-icons/fi";
import { startSession, parseResume, generateQuestions } from "@/lib/api";

function UploadContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [role] = useState(searchParams?.get("role") || "Software Engineer");

    const [step, setStep] = useState<"upload" | "intro" | "generating" | "ready">("upload");
    const [file, setFile] = useState<File | null>(null);
    const [parsed, setParsed] = useState<any>(null);
    const [selfIntro, setSelfIntro] = useState("");
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // Create session on mount
    useEffect(() => {
        startSession().then(id => {
            setSessionId(id);
            sessionStorage.setItem("sessionId", id);
        });
    }, []);

    // Step 1: Parse resume via FastAPI
    const handleUpload = async () => {
        if (!file || !sessionId) return;
        setLoading(true);

        try {
            const jdSkills = "python,docker,kubernetes,aws,fastapi,postgresql,redis,react,system design,ci/cd";
            const data = await parseResume(file, sessionId, jdSkills);

            setParsed(data.resume);
            sessionStorage.setItem("candidateName", data.resume?.name || "");
            sessionStorage.setItem("interviewDifficulty", data.difficulty || "MID");
            sessionStorage.setItem("gapAnalysis", JSON.stringify(data.gap_matrix));
            setLoading(false);
            setStep("intro");
        } catch (err) {
            console.error(err);
            alert("Failed to parse resume. Is the FastAPI server running on port 8000?");
            setLoading(false);
        }
    };

    // Step 2: Generate questions from resume + self-intro
    const handleGenerateQuestions = async () => {
        if (!parsed || !selfIntro.trim() || !sessionId) return;

        setStep("generating");
        setLoading(true);

        try {
            const gapRaw = sessionStorage.getItem("gapAnalysis");
            const gap = gapRaw ? JSON.parse(gapRaw) : {};
            const missingSkills = gap.missing_skills || [];

            const data = await generateQuestions(sessionId, selfIntro, missingSkills);

            if (data.questions && data.questions.length > 0) {
                sessionStorage.setItem("interviewQuestions", JSON.stringify(data.questions));
                sessionStorage.setItem("interviewRole", role);
                sessionStorage.setItem("interviewDifficulty", data.difficulty || "MID");
                setStep("ready");
            } else {
                alert("No questions generated. Please try again.");
                setStep("intro");
            }
        } catch (err) {
            console.error(err);
            alert("Failed to generate questions. Check FastAPI server.");
            setStep("intro");
        }

        setLoading(false);
    };

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border-glass)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", gap: 12 }}>
                <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <FiZap size={16} color="#fff" />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>InterviewAI</span>
                </Link>
                <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>/ Interview Setup</span>
            </nav>

            <div className="container" style={{ paddingTop: 40, paddingBottom: 60, maxWidth: 800 }}>
                {/* Progress Steps */}
                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginBottom: 40 }}>
                    {[
                        { label: "Resume", num: 1, key: "upload" },
                        { label: "Profile", num: 2, key: "intro" },
                        { label: "Environment Setup", num: 3, key: "generating" },
                    ].map((s, i) => {
                        const stepOrder = ["upload", "intro", "generating", "ready"];
                        const currentIdx = stepOrder.indexOf(step) > 2 ? 2 : stepOrder.indexOf(step);
                        const thisIdx = i;
                        const isActive = thisIdx <= currentIdx;
                        return (
                            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 32, height: 32, borderRadius: "50%", background: isActive ? "var(--gradient-primary)" : "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 700, color: isActive ? "#fff" : "var(--text-muted)" }}>
                                    {thisIdx < currentIdx || step === "ready" ? <FiCheckCircle size={14} /> : s.num}
                                </div>
                                <span style={{ fontSize: "0.78rem", color: isActive ? "var(--text-primary)" : "var(--text-muted)", fontWeight: isActive ? 600 : 400 }}>{s.label}</span>
                                {i < 2 && <div style={{ width: 40, height: 2, background: thisIdx < currentIdx || step === "ready" ? "var(--accent-blue)" : "rgba(255,255,255,0.06)", borderRadius: 1 }} />}
                            </div>
                        );
                    })}
                </div>

                {/* ── STEP 1: Upload Resume ── */}
                {step === "upload" && (
                    <div className="animate-fade-in-up">
                        <div style={{ textAlign: "center", marginBottom: 32 }}>
                            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>
                                Upload <span className="gradient-text">Your Resume</span>
                            </h1>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                                We will use your resume to tailor the interview to your specific experiences for the <strong>{role}</strong> position.
                            </p>
                        </div>

                        <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                            <div
                                style={{ border: "2px dashed rgba(79,140,255,0.3)", borderRadius: 16, padding: "48px 24px", marginBottom: 20, background: "rgba(79,140,255,0.03)", cursor: "pointer" }}
                                onClick={() => document.getElementById("fileInput")?.click()}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
                            >
                                <FiUpload size={40} style={{ color: "var(--accent-blue)", marginBottom: 16 }} />
                                <p style={{ fontSize: "1rem", fontWeight: 600, marginBottom: 6 }}>{file ? file.name : "Drop your resume here or click to browse"}</p>
                                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Supports PDF and DOCX</p>
                                <input id="fileInput" type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
                            </div>

                            {file && (
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 20 }}>
                                    <FiFileText size={16} style={{ color: "var(--accent-cyan)" }} />
                                    <span style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>{file.name}</span>
                                    <button onClick={() => setFile(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}><FiX size={16} /></button>
                                </div>
                            )}

                            <button onClick={handleUpload} disabled={!file || loading || !sessionId} className="btn-primary" style={{ padding: "14px 36px", opacity: file && sessionId ? 1 : 0.5 }}>
                                {loading ? "Processing..." : <><FiFileText size={16} /> Continue</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 2: Self-Introduction ── */}
                {step === "intro" && parsed && (
                    <div className="animate-fade-in-up">
                        <div style={{ textAlign: "center", marginBottom: 24 }}>
                            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>
                                <span className="gradient-text">Self-Introduction</span>
                            </h1>
                            <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
                                Briefly introduce yourself and what you&apos;re passionate about.
                            </p>
                        </div>

                        <div className="glass-card" style={{ padding: 24 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                <FiMessageSquare size={16} style={{ color: "var(--accent-cyan)" }} />
                                <span style={{ fontSize: "0.88rem", fontWeight: 600 }}>Tell us about yourself</span>
                            </div>
                            <textarea
                                value={selfIntro}
                                onChange={(e) => setSelfIntro(e.target.value)}
                                placeholder="Hi, I'm Raj. I've been working as a backend engineer for 4 years, primarily at Flipkart where I built microservices..."
                                className="input-field"
                                style={{ minHeight: 160, resize: "vertical", lineHeight: 1.7, fontSize: "0.92rem", marginBottom: 16 }}
                            />
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <span style={{ fontSize: "0.78rem", color: selfIntro.split(/\s+/).filter(Boolean).length >= 15 ? "var(--accent-green)" : "var(--text-muted)" }}>
                                    {selfIntro.split(/\s+/).filter(Boolean).length} words
                                </span>
                                <button
                                    onClick={handleGenerateQuestions}
                                    disabled={selfIntro.split(/\s+/).filter(Boolean).length < 10}
                                    className="btn-primary"
                                    style={{ opacity: selfIntro.split(/\s+/).filter(Boolean).length >= 10 ? 1 : 0.5 }}
                                >
                                    Proceed to Setup <FiArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: Generating ── */}
                {step === "generating" && (
                    <div className="animate-fade-in-up" style={{ textAlign: "center", padding: "60px 0" }}>
                        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "pulse-glow 2s ease-in-out infinite" }}>
                            <FiLoader size={32} color="#fff" style={{ animation: "rotate-gradient 2s linear infinite" }} />
                        </div>
                        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 8 }}>Preparing Interview Environment...</h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.92rem" }}>Analyzing profile and setting up your workspace for the {role} position. This may take a moment.</p>
                    </div>
                )}

                {/* ── STEP 4: Ready ── */}
                {step === "ready" && (
                    <div className="animate-fade-in-up" style={{ textAlign: "center", padding: "40px 0" }}>
                        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--gradient-accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                            <FiCheckCircle size={36} color="#fff" />
                        </div>
                        <h2 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 12 }}>
                            Your Interview is Ready!
                        </h2>
                        <p style={{ color: "var(--text-secondary)", fontSize: "1rem", marginBottom: 40 }}>
                            We have tailored the session for the <strong>{role}</strong> position.<br />
                            Please ensure your camera and microphone are connected. Proctoring will begin immediately.
                        </p>

                        <div style={{ textAlign: "center" }}>
                            <Link href="/interview" className="btn-primary" style={{ padding: "18px 48px", fontSize: "1.1rem", borderRadius: "100px", boxShadow: "0 8px 32px rgba(79, 140, 255, 0.4)" }}>
                                <FiPlay size={20} /> Start Interview Now
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={<div style={{ textAlign: "center", padding: 100, color: "white" }}>Loading...</div>}>
            <UploadContent />
        </Suspense>
    );
}
