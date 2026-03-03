"use client";

import Link from "next/link";
import {
    FiZap, FiUsers, FiBarChart2, FiAlertTriangle, FiCheckCircle,
    FiSearch, FiFilter, FiChevronRight, FiUser, FiLogOut,
    FiEye, FiShield, FiMonitor, FiClock, FiFileText,
} from "react-icons/fi";

const CANDIDATES = [
    { id: "c1", name: "Raj Sharma", role: "Backend Engineer", date: "2026-03-01", score: 82, integrity: 95, status: "completed", flag: false },
    { id: "c2", name: "Priya Patel", role: "ML Engineer", date: "2026-03-01", score: 67, integrity: 88, status: "completed", flag: false },
    { id: "c3", name: "Amit Desai", role: "System Design", date: "2026-02-28", score: 91, integrity: 100, status: "completed", flag: false },
    { id: "c4", name: "Sara Khan", role: "Data Analyst", date: "2026-02-27", score: 55, integrity: 42, status: "flagged", flag: true },
    { id: "c5", name: "Vikram Singh", role: "Frontend Dev", date: "2026-02-26", score: 73, integrity: 78, status: "completed", flag: false },
    { id: "c6", name: "Neha Reddy", role: "DevOps Engineer", date: "2026-02-25", score: 45, integrity: 35, status: "flagged", flag: true },
    { id: "c7", name: "Arjun Mehta", role: "Full Stack", date: "2026-02-24", score: 88, integrity: 97, status: "completed", flag: false },
    { id: "c8", name: "Divya Nair", role: "ML Engineer", date: "2026-02-23", score: 60, integrity: 62, status: "review", flag: true },
];

function getScoreColor(s: number) {
    if (s >= 80) return "var(--accent-green)";
    if (s >= 60) return "var(--accent-orange)";
    return "var(--accent-red)";
}

export default function AdminPage() {
    const flagged = CANDIDATES.filter((c) => c.flag).length;
    const avgScore = Math.round(CANDIDATES.reduce((a, c) => a + c.score, 0) / CANDIDATES.length);
    const avgIntegrity = Math.round(CANDIDATES.reduce((a, c) => a + c.integrity, 0) / CANDIDATES.length);

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
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>/ Admin Console</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-glass)" }}>
                        <FiShield size={14} style={{ color: "var(--accent-purple)" }} />
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Admin</span>
                    </div>
                    <Link href="/login" style={{ color: "var(--text-muted)" }}><FiLogOut size={18} /></Link>
                </div>
            </nav>

            <div className="container" style={{ paddingTop: 32, paddingBottom: 60 }}>
                <div style={{ marginBottom: 32 }}>
                    <h1 style={{ fontSize: "1.8rem", fontWeight: 800, marginBottom: 8 }}>Admin Dashboard</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>Review sessions, manage candidates, and oversee AI evaluations with human-in-the-loop controls.</p>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
                    {[
                        { icon: FiUsers, label: "Total Candidates", value: CANDIDATES.length.toString(), color: "var(--accent-blue)" },
                        { icon: FiBarChart2, label: "Avg Score", value: `${avgScore}%`, color: getScoreColor(avgScore) },
                        { icon: FiShield, label: "Avg Integrity", value: `${avgIntegrity}%`, color: getScoreColor(avgIntegrity) },
                        { icon: FiAlertTriangle, label: "Flagged Sessions", value: flagged.toString(), color: "var(--accent-red)" },
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

                {/* Search & Filter */}
                <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 12, flex: 1 }}>
                        <div style={{ position: "relative", width: "100%", maxWidth: 300 }}>
                            <FiSearch size={16} style={{ position: "absolute", left: 14, top: 13, color: "var(--text-muted)" }} />
                            <input className="input-field" placeholder="Search candidates..." style={{ paddingLeft: 40 }} />
                        </div>
                        <button className="btn-secondary btn-sm"><FiFilter size={14} /> Filter</button>
                    </div>
                    <Link href="/admin/invite" className="btn-primary btn-sm" style={{ padding: "8px 16px" }}>
                        <FiUser style={{ marginRight: 6 }} /> Invite Candidate
                    </Link>
                </div>

                {/* Candidate Table */}
                <div className="glass-card" style={{ overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr style={{ borderBottom: "1px solid var(--border-glass)" }}>
                                    {["Candidate", "Role", "Date", "Score", "Integrity", "Status", "Actions"].map((h) => (
                                        <th key={h} style={{ padding: "14px 18px", textAlign: "left", fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {CANDIDATES.map((c) => (
                                    <tr key={c.id} style={{ borderBottom: "1px solid var(--border-glass)", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                        <td style={{ padding: "14px 18px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, color: "#fff" }}>
                                                    {c.name.split(" ").map(n => n[0]).join("")}
                                                </div>
                                                <span style={{ fontWeight: 600, fontSize: "0.88rem" }}>{c.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: "14px 18px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>{c.role}</td>
                                        <td style={{ padding: "14px 18px", fontSize: "0.82rem", color: "var(--text-muted)" }}>{c.date}</td>
                                        <td style={{ padding: "14px 18px" }}>
                                            <span style={{ fontWeight: 700, color: getScoreColor(c.score) }}>{c.score}%</span>
                                        </td>
                                        <td style={{ padding: "14px 18px" }}>
                                            <span style={{ fontWeight: 700, color: getScoreColor(c.integrity) }}>{c.integrity}%</span>
                                        </td>
                                        <td style={{ padding: "14px 18px" }}>
                                            <span className={`badge ${c.status === "flagged" ? "badge-red" : c.status === "review" ? "badge-orange" : "badge-green"}`}>
                                                {c.status === "flagged" && <FiAlertTriangle size={10} />}
                                                {c.status === "completed" && <FiCheckCircle size={10} />}
                                                {c.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: "14px 18px" }}>
                                            <Link href={`/report/${c.id}`} className="btn-secondary btn-sm" style={{ padding: "6px 12px", fontSize: "0.75rem" }}>
                                                <FiEye size={12} /> View
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Flagged Session Detail */}
                <div style={{ marginTop: 32 }}>
                    <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                        <FiAlertTriangle size={18} style={{ color: "var(--accent-red)" }} />
                        Flagged Sessions — Human Review Required
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
                        {CANDIDATES.filter(c => c.flag).map((c) => (
                            <div key={c.id} className="glass-card" style={{ padding: 20, borderLeft: "3px solid var(--accent-red)" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: "1rem" }}>{c.name}</div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{c.role} · {c.date}</div>
                                    </div>
                                    <span className="badge badge-red"><FiAlertTriangle size={10} /> Flagged</span>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                                    <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Score</div>
                                        <div style={{ fontWeight: 700, color: getScoreColor(c.score) }}>{c.score}%</div>
                                    </div>
                                    <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,255,255,0.03)" }}>
                                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Integrity</div>
                                        <div style={{ fontWeight: 700, color: getScoreColor(c.integrity) }}>{c.integrity}%</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
                                    {c.integrity < 50 ? "⚠ High tab-switch count, low gaze on-screen %, possible AI-generated answers detected." : "⚠ Borderline scores — review recommended before final assessment."}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button className="btn-primary btn-sm"><FiEye size={12} /> Review Transcript</button>
                                    <button className="btn-secondary btn-sm"><FiCheckCircle size={12} /> Approve</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
