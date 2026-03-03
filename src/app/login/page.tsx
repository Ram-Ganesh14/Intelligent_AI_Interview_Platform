"use client";

import Link from "next/link";
import { useState } from "react";
import { FiZap, FiMail, FiLock, FiArrowRight, FiEye, FiEyeOff } from "react-icons/fi";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [role, setRole] = useState("candidate");

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        window.location.href = role === "candidate" ? "/dashboard" : "/admin";
    };

    return (
        <div
            className="bg-grid-pattern"
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Orbs */}
            <div className="orb orb-blue" style={{ width: 400, height: 400, top: -100, left: -100 }} />
            <div className="orb orb-purple" style={{ width: 300, height: 300, bottom: -80, right: -60 }} />

            <div className="glass-card animate-fade-in-up" style={{ width: "100%", maxWidth: 440, padding: "40px", position: "relative", zIndex: 1 }}>
                {/* Logo */}
                <div style={{ textAlign: "center", marginBottom: "32px" }}>
                    <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <FiZap size={20} color="#fff" />
                        </div>
                        <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>InterviewAI</span>
                    </Link>
                    <p style={{ marginTop: "12px", color: "var(--text-secondary)", fontSize: "0.92rem" }}>Sign in to continue</p>
                </div>

                {/* Role Selector */}
                <div className="tab-nav" style={{ marginBottom: "24px" }}>
                    {["candidate", "recruiter", "admin"].map((r) => (
                        <button
                            key={r}
                            className={`tab-btn ${role === r ? "active" : ""}`}
                            onClick={() => setRole(r)}
                            style={{ flex: 1, textTransform: "capitalize" }}
                        >
                            {r}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: "16px" }}>
                        <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 500, display: "block", marginBottom: "6px" }}>Email</label>
                        <div style={{ position: "relative" }}>
                            <FiMail size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--text-muted)" }} />
                            <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ paddingLeft: 40 }} />
                        </div>
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                        <label style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 500, display: "block", marginBottom: "6px" }}>Password</label>
                        <div style={{ position: "relative" }}>
                            <FiLock size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--text-muted)" }} />
                            <input className="input-field" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: 40, paddingRight: 40 }} />
                            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 14, top: 12, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                                {showPw ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: "100%", justifyContent: "center", padding: "14px" }}>
                        Sign In <FiArrowRight size={16} />
                    </button>
                </form>

                <p style={{ textAlign: "center", marginTop: "20px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                    Don&apos;t have an account?{" "}
                    <Link href="/register" style={{ color: "var(--accent-blue)", textDecoration: "none", fontWeight: 600 }}>Register</Link>
                </p>
            </div>
        </div>
    );
}
