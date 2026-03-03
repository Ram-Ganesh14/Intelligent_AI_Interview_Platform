"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
    FiZap, FiBarChart2, FiCheckCircle, FiAlertTriangle, FiDownload,
    FiArrowLeft, FiShield, FiEye, FiSmile, FiMonitor, FiCode,
    FiMessageSquare, FiMic, FiTarget, FiTrendingUp, FiUser, FiLoader,
} from "react-icons/fi";
import { getSession } from "@/lib/api";

function getScoreColor(s: number) {
    if (s >= 80) return "var(--accent-green)";
    if (s >= 60) return "var(--accent-orange)";
    return "var(--accent-red)";
}

export default function ReportPage() {
    const params = useParams();
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!params.id) return;
        getSession(params.id as string)
            .then(data => {
                if (data.detail) {
                    setReport(null);
                } else {
                    setReport(data);
                }
            })
            .catch(() => setReport(null))
            .finally(() => setLoading(false));
    }, [params.id]);

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center" }}>
                    <FiLoader size={32} style={{ color: "var(--accent-blue)", animation: "rotate-gradient 2s linear infinite", marginBottom: 16 }} />
                    <p style={{ color: "var(--text-secondary)" }}>Loading report...</p>
                </div>
            </div>
        );
    }

    if (!report) {
        return (
            <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className="glass-card" style={{ padding: 40, textAlign: "center", maxWidth: 500 }}>
                    <FiAlertTriangle size={40} style={{ color: "var(--accent-orange)", marginBottom: 16 }} />
                    <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Report Not Found</h2>
                    <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>This session doesn&apos;t exist or the server is not running.</p>
                    <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
                </div>
            </div>
        );
    }

    const summary = report.summary || {};
    const answers = report.answers || [];
    const contradictions = report.contradictions || [];
    const candidateName = report.resume?.name || "Candidate";
    const overallScore = summary.avg_score ? Math.round(summary.avg_score * 10) : 0;
    const emotionDist = summary.emotion_distribution || {};
    const stressPct = summary.stress_pct || 0;
    const identityMismatches = summary.identity_mismatches || 0;
    const multiFaceIncidents = summary.multi_face_incidents || 0;
    const aiFlaggedCount = summary.ai_flagged_answers || 0;
    const skillScores = summary.skill_scores || {};

    // Compute integrity score
    const integrityScore = Math.max(0, 100 - (identityMismatches * 15) - (multiFaceIncidents * 10) - (aiFlaggedCount * 20));

    // Build dimensions from skill scores
    const dimensions = Object.entries(skillScores).map(([name, score]: [string, any]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        score: Math.round(score * 10),
        max: 100,
    }));

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            {/* Topbar */}
            <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border-glass)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Link href="/dashboard" style={{ color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6, textDecoration: "none", fontSize: "0.88rem" }}>
                        <FiArrowLeft size={16} /> Back
                    </Link>
                    <span style={{ color: "var(--text-muted)" }}>|</span>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>Interview Report</span>
                </div>
                <button className="btn-secondary btn-sm"><FiDownload size={14} /> Export PDF</button>
            </nav>

            <div className="container" style={{ paddingTop: 32, paddingBottom: 60, maxWidth: 960 }}>
                {/* Header */}
                <div className="glass-card" style={{ padding: 28, marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 16 }}>
                        <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff" }}>
                                    {candidateName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>{candidateName}</h1>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                        {report.difficulty} · {report.created_at?.split("T")[0]} · {summary.answered}/{summary.total_questions} answered
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 12 }}>
                            <div style={{ textAlign: "center", padding: "12px 20px", borderRadius: 12, background: `${getScoreColor(overallScore)}10`, border: `1px solid ${getScoreColor(overallScore)}30` }}>
                                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: getScoreColor(overallScore) }}>{overallScore}%</div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Overall</div>
                            </div>
                            <div style={{ textAlign: "center", padding: "12px 20px", borderRadius: 12, background: `${getScoreColor(integrityScore)}10`, border: `1px solid ${getScoreColor(integrityScore)}30` }}>
                                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: getScoreColor(integrityScore) }}>{integrityScore}%</div>
                                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Integrity</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Skill Scores */}
                {dimensions.length > 0 && (
                    <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                            <FiBarChart2 size={18} style={{ color: "var(--accent-blue)" }} />
                            Skill Breakdown
                        </h2>
                        {dimensions.map((d) => (
                            <div key={d.name} style={{ marginBottom: 16 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                                    <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-secondary)" }}>{d.name}</span>
                                    <span style={{ fontWeight: 700, color: getScoreColor(d.score), fontSize: "0.9rem" }}>{d.score}%</span>
                                </div>
                                <div className="progress-bar" style={{ height: 8 }}>
                                    <div className="progress-bar-fill" style={{ width: `${d.score}%`, background: d.score >= 80 ? "var(--gradient-accent)" : d.score >= 60 ? "var(--gradient-warm)" : "linear-gradient(135deg, var(--accent-red), var(--accent-orange))" }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Per-Question Breakdown */}
                {answers.length > 0 && (
                    <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 18 }}>Per-Question Breakdown</h2>
                        {answers.map((a: any, i: number) => (
                            <div key={i} style={{ padding: "14px 0", borderBottom: "1px solid var(--border-glass)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--accent-blue)" }}>Q{i + 1}</span>
                                        <span className="badge badge-cyan" style={{ fontSize: "0.6rem" }}>{a.skill || "general"}</span>
                                        {a.ai_flagged && <span className="badge badge-red" style={{ fontSize: "0.6rem" }}><FiAlertTriangle size={8} /> AI DETECTED</span>}
                                    </div>
                                    <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>{a.question}</div>
                                </div>
                                <div style={{ textAlign: "center", minWidth: 50 }}>
                                    <div style={{ fontSize: "1.2rem", fontWeight: 800, color: getScoreColor(a.score * 10) }}>{a.score}</div>
                                    <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>/ 10</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Proctoring Report */}
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                    <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                        <FiShield size={18} style={{ color: "var(--accent-purple)" }} />
                        Proctoring &amp; Integrity Report
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                        {[
                            { icon: FiSmile, label: "Stress Level", value: `${stressPct}%`, color: stressPct > 30 ? "var(--accent-red)" : "var(--accent-green)" },
                            { icon: FiUser, label: "Identity Mismatches", value: identityMismatches.toString(), color: identityMismatches > 0 ? "var(--accent-red)" : "var(--accent-green)" },
                            { icon: FiShield, label: "AI Detection Flags", value: aiFlaggedCount.toString(), color: aiFlaggedCount > 0 ? "var(--accent-red)" : "var(--accent-green)" },
                            { icon: FiTarget, label: "Multi-Face Events", value: multiFaceIncidents.toString(), color: multiFaceIncidents > 0 ? "var(--accent-red)" : "var(--accent-green)" },
                        ].map((s) => (
                            <div key={s.label} style={{ padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-glass)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                    <s.icon size={14} style={{ color: s.color }} />
                                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{s.label}</span>
                                </div>
                                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                            </div>
                        ))}
                    </div>

                    {/* Emotion Distribution */}
                    {Object.keys(emotionDist).length > 0 && (
                        <div style={{ marginTop: 18 }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>Emotion Distribution</div>
                            <div style={{ display: "flex", gap: 4, height: 24, borderRadius: 6, overflow: "hidden" }}>
                                {Object.entries(emotionDist).map(([k, v]: [string, any]) => {
                                    const total = Object.values(emotionDist).reduce((a: number, b: any) => a + b, 0) as number;
                                    const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                                    return (
                                        <div key={k} style={{ flex: v, background: k === "neutral" ? "var(--accent-blue)" : k === "happy" ? "var(--accent-green)" : k === "surprised" ? "var(--accent-purple)" : k === "fearful" ? "var(--accent-red)" : k === "sad" ? "var(--accent-orange)" : "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 700, color: "#fff" }}>
                                            {pct > 8 ? `${k} ${pct}%` : ""}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Contradictions */}
                {contradictions.length > 0 && (
                    <div className="glass-card" style={{ padding: 24, borderLeft: "3px solid var(--accent-red)" }}>
                        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                            <FiAlertTriangle size={18} style={{ color: "var(--accent-red)" }} />
                            Resume–Answer Contradictions
                        </h2>
                        {contradictions.map((c: any, i: number) => (
                            <div key={i} style={{ padding: 16, borderRadius: 10, background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.15)", marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                    <span className="badge badge-red">{c.severity}</span>
                                </div>
                                <div style={{ fontSize: "0.88rem", marginBottom: 4 }}><strong style={{ color: "var(--text-secondary)" }}>Claimed:</strong> {c.claimed}</div>
                                <div style={{ fontSize: "0.88rem", marginBottom: 4 }}><strong style={{ color: "var(--text-secondary)" }}>Demonstrated:</strong> {c.demonstrated}</div>
                                <div style={{ fontSize: "0.82rem", color: "var(--accent-orange)", marginTop: 6 }}>💡 {c.recommendation}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
