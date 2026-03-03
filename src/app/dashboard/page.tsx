"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
    FiZap, FiArrowRight, FiCalendar, FiBarChart2, FiClock, FiTarget,
    FiTrendingUp, FiAward, FiPlay, FiFileText, FiUser, FiLogOut,
    FiChevronRight, FiCheckCircle, FiAlertTriangle, FiLoader,
} from "react-icons/fi";
import { getSessions } from "@/lib/api";

function getScoreColor(s: number) {
    if (s >= 80) return "var(--accent-green)";
    if (s >= 60) return "var(--accent-orange)";
    return "var(--accent-red)";
}

export default function DashboardPage() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSessions()
            .then(data => setSessions(data.sessions || []))
            .catch(() => setSessions([]))
            .finally(() => setLoading(false));
    }, []);

    const avgScore = sessions.length
        ? Math.round(sessions.reduce((a, s) => a + (s.avg_score || 0), 0) / sessions.length * 10)
        : 0;
    const totalSessions = sessions.length;

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            {/* Topbar */}
            <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(10,10,15,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border-glass)", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FiZap size={16} color="#fff" />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>InterviewAI</span>
                    </Link>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>/ Dashboard</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-glass)" }}>
                        <FiUser size={14} style={{ color: "var(--text-secondary)" }} />
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Candidate</span>
                    </div>
                    <Link href="/login" style={{ color: "var(--text-muted)" }}><FiLogOut size={18} /></Link>
                </div>
            </nav>

            <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
                {/* Header */}
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>Welcome back 👋</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Track your progress, identify weak areas, and prepare for your next interview.</p>
                </div>

                {/* Quick Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                    {[
                        { icon: FiBarChart2, label: "Average Score", value: `${avgScore}%`, color: getScoreColor(avgScore) },
                        { icon: FiCalendar, label: "Total Sessions", value: totalSessions.toString(), color: "var(--accent-blue)" },
                        { icon: FiTarget, label: "Readiness", value: totalSessions > 0 ? `${Math.min(100, avgScore + 10)}%` : "N/A", color: "var(--accent-cyan)" },
                    ].map((s) => (
                        <div key={s.label} className="glass-card" style={{ padding: "20px 24px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                                <s.icon size={18} style={{ color: s.color }} />
                                <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontWeight: 500 }}>{s.label}</span>
                            </div>
                            <div style={{ fontSize: "1.8rem", fontWeight: 800, color: s.color }}>{s.value}</div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap" }}>
                    <Link href="/upload" className="btn-primary"><FiPlay size={16} /> Start New Interview</Link>
                    <Link href="/upload" className="btn-secondary"><FiFileText size={16} /> Upload Resume</Link>
                </div>

                {loading ? (
                    <div style={{ textAlign: "center", padding: 40 }}>
                        <FiLoader size={24} style={{ color: "var(--accent-blue)", animation: "rotate-gradient 2s linear infinite" }} />
                        <p style={{ color: "var(--text-muted)", marginTop: 12, fontSize: "0.9rem" }}>Loading sessions...</p>
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
                        <FiCalendar size={32} style={{ color: "var(--text-muted)", marginBottom: 12 }} />
                        <h3 style={{ fontWeight: 700, marginBottom: 8 }}>No sessions yet</h3>
                        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 20 }}>
                            Start your first interview to see your results here.
                        </p>
                        <Link href="/upload" className="btn-primary"><FiPlay size={16} /> Start Interview</Link>
                    </div>
                ) : (
                    <div>
                        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                            <FiCalendar size={18} style={{ color: "var(--accent-blue)" }} /> Session History
                        </h2>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {sessions.map((s) => (
                                <Link key={s.id} href={`/report/${s.id}`} style={{ textDecoration: "none" }}>
                                    <div className="glass-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${getScoreColor(Math.round(s.avg_score * 10))}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                {s.status === "COMPLETE" ? <FiCheckCircle size={18} style={{ color: getScoreColor(Math.round(s.avg_score * 10)) }} /> : <FiClock size={18} style={{ color: "var(--accent-orange)" }} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: "0.92rem", color: "var(--text-primary)" }}>{s.candidate_name || "Interview"}</div>
                                                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>
                                                    {s.created_at?.split("T")[0]} · {s.answered}/{s.total_questions} questions · {s.difficulty}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <span style={{ fontSize: "1.1rem", fontWeight: 700, color: getScoreColor(Math.round(s.avg_score * 10)) }}>
                                                {Math.round(s.avg_score * 10)}%
                                            </span>
                                            <FiChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
