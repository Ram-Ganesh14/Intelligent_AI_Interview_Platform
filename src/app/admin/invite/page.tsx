"use client";

import Link from "next/link";
import { useState } from "react";
import {
    FiZap, FiUserPlus, FiCopy, FiCheckCircle,
    FiLogOut, FiShield, FiBriefcase
} from "react-icons/fi";

const ROLES = [
    "Software Engineer",
    "Backend Engineer",
    "Frontend Developer",
    "Full Stack",
    "ML Engineer",
    "Data Analyst",
    "DevOps Engineer",
    "System Design",
];

export default function InvitePage() {
    const [role, setRole] = useState("Backend Engineer");
    const [copied, setCopied] = useState(false);

    // Generate link based on current location and selected role
    const getInviteLink = () => {
        if (typeof window !== "undefined") {
            const baseUrl = window.location.origin;
            return `${baseUrl}/upload?role=${encodeURIComponent(role)}`;
        }
        return `http://localhost:3000/upload?role=${encodeURIComponent(role)}`;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(getInviteLink());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
                    <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        <Link href="/admin" style={{ color: "var(--text-muted)", textDecoration: "none" }}>/ Admin Console</Link> / Invite
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-glass)" }}>
                        <FiShield size={14} style={{ color: "var(--accent-purple)" }} />
                        <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Admin</span>
                    </div>
                    <Link href="/login" style={{ color: "var(--text-muted)" }}><FiLogOut size={18} /></Link>
                </div>
            </nav>

            <div className="container animate-fade-in-up" style={{ paddingTop: 60, paddingBottom: 60, maxWidth: 600 }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <FiUserPlus size={28} color="#fff" />
                    </div>
                    <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: 8 }}>Invite Candidate</h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>Generate a specific interview link for a candidate.</p>
                </div>

                <div className="glass-card" style={{ padding: 32 }}>
                    <label style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontWeight: 600, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <FiBriefcase size={16} style={{ color: "var(--accent-blue)" }} /> Select Interview Role
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 32 }}>
                        {ROLES.map(r => (
                            <button
                                key={r}
                                onClick={() => setRole(r)}
                                className={role === r ? "btn-primary btn-sm" : "btn-secondary btn-sm"}
                                style={{ fontSize: "0.85rem", padding: "8px 16px" }}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 12, padding: 20, border: "1px solid var(--border-glass)" }}>
                        <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600, display: "block", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Candidate Invite Link
                        </label>
                        <div style={{ display: "flex", gap: 12 }}>
                            <input
                                readOnly
                                value={getInviteLink()}
                                className="input-field"
                                style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--accent-cyan)", cursor: "text" }}
                            />
                            <button onClick={handleCopy} className={copied ? "btn-primary" : "btn-secondary"} style={{ minWidth: 100 }}>
                                {copied ? <><FiCheckCircle size={16} /> Copied</> : <><FiCopy size={16} /> Copy</>}
                            </button>
                        </div>
                        <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 12, lineHeight: 1.5 }}>
                            Send this link to the candidate. When they open it, the system will automatically tailor the interview to their resume against the <strong>{role}</strong> profile requirements.
                        </p>
                    </div>
                </div>

                <div style={{ textAlign: "center", marginTop: 24 }}>
                    <Link href="/admin" style={{ color: "var(--text-muted)", fontSize: "0.9rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        ← Back to Admin Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
