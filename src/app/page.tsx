"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FiMenu,
  FiX,
  FiZap,
  FiShield,
  FiFileText,
  FiBarChart2,
  FiCpu,
  FiEye,
  FiUsers,
  FiTarget,
  FiArrowRight,
  FiCode,
  FiMic,
  FiMonitor,
  FiLock,
  FiTrendingUp,
  FiAward,
  FiCheckCircle,
  FiGitBranch,
  FiLayers,
} from "react-icons/fi";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Tech Stack", href: "#tech-stack" },
  { label: "Architecture", href: "#architecture" },
];

const FEATURES = [
  {
    icon: FiCpu,
    title: "Adaptive AI Engine",
    desc: "IRT + RL-based questioning that adapts difficulty in real-time based on candidate responses, confidence, and depth.",
    badge: "Core AI",
    badgeClass: "badge-blue",
    gradient: "linear-gradient(135deg, #4f8cff22, #8b5cf622)",
  },
  {
    icon: FiEye,
    title: "Gaze & Emotion Tracking",
    desc: "Real-time gaze direction monitoring and emotion timeline mapped against each question for deep behavioral analysis.",
    badge: "Computer Vision",
    badgeClass: "badge-purple",
    gradient: "linear-gradient(135deg, #8b5cf622, #f472b622)",
  },
  {
    icon: FiShield,
    title: "Anti-Cheating System",
    desc: "AI-generated answer detection, tab switch monitoring, proxy candidate alerts, and stylometric baseline fingerprinting.",
    badge: "Security",
    badgeClass: "badge-red",
    gradient: "linear-gradient(135deg, #ef444422, #fb923c22)",
  },
  {
    icon: FiFileText,
    title: "Resume Intelligence",
    desc: "Parse resumes to JSON, build skill gap matrices, generate personalized questions, and detect resume-answer contradictions.",
    badge: "NLP",
    badgeClass: "badge-cyan",
    gradient: "linear-gradient(135deg, #06d6a022, #4f8cff22)",
  },
  {
    icon: FiCode,
    title: "Code Sandbox Judge",
    desc: "Isolated Docker execution with test cases, static analysis, Big-O estimation, and code plagiarism detection.",
    badge: "Execution",
    badgeClass: "badge-orange",
    gradient: "linear-gradient(135deg, #fb923c22, #f472b622)",
  },
  {
    icon: FiBarChart2,
    title: "Multi-Factor Scoring",
    desc: "6+ scoring dimensions with SHAP explainability, confidence intervals, and weighted rubric configurable per role.",
    badge: "Analytics",
    badgeClass: "badge-green",
    gradient: "linear-gradient(135deg, #22c55e22, #06d6a022)",
  },
  {
    icon: FiMic,
    title: "Voice & Behavioral Analysis",
    desc: "Speech-to-text via Whisper, STAR format detection, filler word analysis, and accent-neutral semantic scoring.",
    badge: "Speech AI",
    badgeClass: "badge-pink",
    gradient: "linear-gradient(135deg, #f472b622, #8b5cf622)",
  },
  {
    icon: FiTrendingUp,
    title: "Longitudinal Progress",
    desc: "Track candidate growth across sessions with skill heatmaps, learning velocity, and readiness predictions.",
    badge: "Growth",
    badgeClass: "badge-blue",
    gradient: "linear-gradient(135deg, #4f8cff22, #06d6a022)",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Upload Resume",
    desc: "Candidate uploads resume → auto-parsed to JSON → skill gap matrix built against job requirements.",
    icon: FiFileText,
  },
  {
    num: "02",
    title: "Calibrate & Warm-Up",
    desc: "Difficulty calibrated from experience. 2-3 warm-up questions build a writing style baseline for AI detection.",
    icon: FiTarget,
  },
  {
    num: "03",
    title: "Adaptive Interview",
    desc: "AI conducts full interview with adaptive difficulty. All proctoring active: gaze, emotion, tab focus, face verification.",
    icon: FiCpu,
  },
  {
    num: "04",
    title: "Multi-Modal Evaluation",
    desc: "Text via NLP rubric, code via sandbox judge, voice via Whisper — all scored on 6+ dimensions with SHAP explainability.",
    icon: FiBarChart2,
  },
  {
    num: "05",
    title: "Report & Review",
    desc: "PDF report with per-question breakdown, contradiction analysis, integrity flags, and human-in-the-loop override.",
    icon: FiAward,
  },
];

const TECH_STACK = [
  { layer: "Frontend", items: ["Next.js", "TypeScript", "Tailwind CSS", "Monaco Editor", "WebRTC", "Chart.js"] },
  { layer: "Backend", items: ["Spring Boot", "FastAPI", "PostgreSQL", "Redis", "JWT / OAuth2"] },
  { layer: "AI / ML", items: ["PyTorch", "HuggingFace", "GPT-4 / Claude", "Whisper STT", "SBERT", "FAISS"] },
  { layer: "CV & Vision", items: ["DeepFace", "GazeTracking", "OpenCV", "dlib", "FER-2013 CNN"] },
  { layer: "DevOps", items: ["Docker", "Kubernetes", "GitHub Actions", "Prometheus", "Grafana", "Sentry"] },
  { layer: "Security", items: ["AES-256", "TLS 1.3", "WAF", "seccomp", "RBAC", "Stylometry"] },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* ───── Navbar ───── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          background: "rgba(10,10,15,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid var(--border-glass)",
        }}
      >
        <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "64px" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiZap size={18} color="#fff" />
            </div>
            <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-primary)" }}>InterviewAI</span>
          </Link>

          {/* Desktop Nav */}
          <div style={{ display: "flex", alignItems: "center", gap: "32px" }} className="hidden md:flex">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.9rem", fontWeight: 500, transition: "color 0.2s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                {l.label}
              </a>
            ))}
            <Link href="/login" className="btn-secondary btn-sm">Sign In</Link>
            <Link href="/dashboard" className="btn-primary btn-sm">Launch Platform <FiArrowRight size={14} /></Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", color: "var(--text-primary)", cursor: "pointer" }}>
            {menuOpen ? <FiX size={24} /> : <FiMenu size={24} />}
          </button>
        </div>

        {/* Mobile Nav */}
        {menuOpen && (
          <div className="md:hidden" style={{ padding: "16px 24px", borderTop: "1px solid var(--border-glass)", background: "rgba(10,10,15,0.95)" }}>
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "12px 0", color: "var(--text-secondary)", textDecoration: "none", fontSize: "0.95rem" }}>
                {l.label}
              </a>
            ))}
            <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
              <Link href="/login" className="btn-secondary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Sign In</Link>
              <Link href="/dashboard" className="btn-primary btn-sm" style={{ flex: 1, justifyContent: "center" }}>Launch</Link>
            </div>
          </div>
        )}
      </nav>

      {/* ───── Hero ───── */}
      <section
        style={{
          position: "relative",
          paddingTop: "160px",
          paddingBottom: "100px",
          overflow: "hidden",
          textAlign: "center",
        }}
        className="bg-grid-pattern"
      >
        {/* Orbs */}
        <div className="orb orb-blue" style={{ width: 400, height: 400, top: -100, left: -100 }} />
        <div className="orb orb-purple" style={{ width: 350, height: 350, top: 50, right: -80 }} />
        <div className="orb orb-pink" style={{ width: 250, height: 250, bottom: -50, left: "40%" }} />

        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div className="animate-fade-in-up" style={{ marginBottom: "24px" }}>
            <span className="badge badge-blue" style={{ fontSize: "0.8rem", padding: "6px 16px" }}>
              <FiZap size={12} /> AI-Powered · Adaptive · Research-Grade
            </span>
          </div>
          <h1
            className="animate-fade-in-up delay-100"
            style={{
              fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
              fontWeight: 900,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: "900px",
              margin: "0 auto 24px",
            }}
          >
            Intelligent Adaptive{" "}
            <span className="gradient-text">AI Interviewing</span>{" "}
            Platform
          </h1>
          <p
            className="animate-fade-in-up delay-200"
            style={{
              fontSize: "1.15rem",
              color: "var(--text-secondary)",
              maxWidth: "650px",
              margin: "0 auto 40px",
              lineHeight: 1.7,
            }}
          >
            Autonomously conduct, evaluate, and improve technical & behavioral
            interviews with computer vision proctoring, adaptive AI questioning,
            anti-cheating detection, and multi-factor explainable scoring.
          </p>
          <div
            className="animate-fade-in-up delay-300"
            style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link href="/interview" className="btn-primary" style={{ padding: "14px 36px", fontSize: "1rem" }}>
              Start Mock Interview <FiArrowRight size={16} />
            </Link>
            <Link href="/upload" className="btn-secondary" style={{ padding: "14px 36px", fontSize: "1rem" }}>
              <FiFileText size={16} /> Upload Resume
            </Link>
          </div>

          {/* Stats */}
          <div
            className="animate-fade-in-up delay-400"
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "48px",
              marginTop: "60px",
              flexWrap: "wrap",
            }}
          >
            {[
              { val: "6+", label: "Scoring Dimensions" },
              { val: "50+", label: "Seed Questions" },
              { val: "7", label: "Emotion Classes" },
              { val: "3", label: "CV Modules" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div className="gradient-text" style={{ fontSize: "2rem", fontWeight: 800 }}>{s.val}</div>
                <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="section" style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <span className="badge badge-purple" style={{ marginBottom: "16px" }}>
              <FiLayers size={12} /> Platform Capabilities
            </span>
            <h2 className="section-title" style={{ margin: "0 auto" }}>
              Everything You Need for{" "}
              <span className="gradient-text">AI-Driven Interviews</span>
            </h2>
            <p className="section-subtitle" style={{ margin: "12px auto 0" }}>
              From adaptive questioning to computer vision proctoring — every feature backed by real AI research.
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="glass-card animate-fade-in-up"
                style={{
                  padding: "28px",
                  animationDelay: `${i * 0.08}s`,
                  opacity: 0,
                  background: f.gradient,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                  <div
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      background: "rgba(255,255,255,0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <f.icon size={20} style={{ color: "var(--accent-blue)" }} />
                  </div>
                  <span className={`badge ${f.badgeClass}`}>{f.badge}</span>
                </div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "8px" }}>{f.title}</h3>
                <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section id="how-it-works" className="section bg-grid-pattern" style={{ position: "relative" }}>
        <div className="orb orb-cyan" style={{ width: 300, height: 300, bottom: 0, right: -50, opacity: 0.15 }} />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: "60px" }}>
            <span className="badge badge-cyan" style={{ marginBottom: "16px" }}>
              <FiGitBranch size={12} /> End-to-End Flow
            </span>
            <h2 className="section-title">
              How <span className="gradient-text-accent">InterviewAI</span> Works
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "700px", margin: "0 auto" }}>
            {STEPS.map((s, i) => (
              <div
                key={s.num}
                className="glass-card animate-fade-in-up"
                style={{
                  padding: "24px 28px",
                  display: "flex",
                  gap: "20px",
                  alignItems: "flex-start",
                  animationDelay: `${i * 0.1}s`,
                  opacity: 0,
                }}
              >
                <div
                  style={{
                    minWidth: 48,
                    height: 48,
                    borderRadius: 14,
                    background: "var(--gradient-primary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "0.9rem",
                  }}
                >
                  {s.num}
                </div>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "6px" }}>{s.title}</h3>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Tech Stack ───── */}
      <section id="tech-stack" className="section" style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span className="badge badge-orange" style={{ marginBottom: "16px" }}>
              <FiMonitor size={12} /> Technology
            </span>
            <h2 className="section-title">
              Built With <span className="gradient-text">Best-in-Class</span> Tech
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
            {TECH_STACK.map((t) => (
              <div key={t.layer} className="glass-card" style={{ padding: "24px" }}>
                <h4 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--accent-blue)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                  {t.layer}
                </h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {t.items.map((item) => (
                    <span
                      key={item}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        fontSize: "0.82rem",
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Architecture ───── */}
      <section id="architecture" className="section bg-grid-pattern" style={{ position: "relative" }}>
        <div className="orb orb-purple" style={{ width: 350, height: 350, top: -50, left: -80, opacity: 0.12 }} />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span className="badge badge-purple" style={{ marginBottom: "16px" }}>
              <FiLayers size={12} /> System Design
            </span>
            <h2 className="section-title">
              Microservice <span className="gradient-text">Architecture</span>
            </h2>
          </div>

          <div className="glass-card" style={{ padding: "32px", fontFamily: "var(--font-mono)", fontSize: "0.78rem", lineHeight: "2", color: "var(--text-secondary)", overflowX: "auto" }}>
            <pre style={{ margin: 0 }}>{`
┌─────────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                               │
│   React/Next.js  ·  Monaco Editor  ·  WebRTC  ·  Chart.js          │
│   Candidate UI  │  Admin Dashboard  │  Report Viewer  │  Upload     │
└────────┬────────────────┬──────────────────┬────────────────────────┘
         │                │                  │
         ▼                ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY                                   │
│   JWT Auth  ·  Rate Limiting  ·  Input Sanitisation  ·  RBAC       │
└────────┬────────────────┬──────────────────┬────────────────────────┘
         │                │                  │
    ┌────▼────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │Interview│    │  Scoring &  │    │  Proctoring │
    │Orchestr.│    │  Evaluation │    │   Engine    │
    │  (FSM)  │    │   Engine    │    │             │
    └────┬────┘    └──────┬──────┘    └──────┬──────┘
         │                │                  │
    ┌────▼────────────────▼──────────────────▼────┐
    │              AI / ML SERVICES                │
    │  LLM Generator  │  NLP Evaluator  │  STT    │
    │  Code Sandbox   │  SBERT Scorer   │  IRT    │
    │  DeepFace CV    │  GazeTracking   │  SHAP   │
    └────┬────────────────┬──────────────────┬────┘
         │                │                  │
    ┌────▼────────────────▼──────────────────▼────┐
    │               DATA LAYER                     │
    │  PostgreSQL  │  Redis  │  FAISS  │  S3/MinIO │
    └─────────────────────────────────────────────┘`}
            </pre>
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="section" style={{ textAlign: "center", position: "relative" }}>
        <div className="orb orb-blue" style={{ width: 300, height: 300, top: -80, left: "50%", transform: "translateX(-50%)", opacity: 0.15 }} />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <h2 style={{ fontSize: "2.2rem", fontWeight: 800, marginBottom: "16px" }}>
            Ready to <span className="gradient-text">Transform</span> Your Interviews?
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "32px", fontSize: "1.05rem" }}>
            Start with a mock interview, upload a resume, or explore the admin dashboard.
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/interview" className="btn-primary" style={{ padding: "14px 32px" }}>
              <FiZap size={16} /> Start Interview
            </Link>
            <Link href="/admin" className="btn-secondary" style={{ padding: "14px 32px" }}>
              <FiUsers size={16} /> Admin Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer
        style={{
          borderTop: "1px solid var(--border-glass)",
          padding: "32px 0",
          textAlign: "center",
        }}
      >
        <div className="container">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "12px" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FiZap size={14} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>InterviewAI</span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
            Intelligent Adaptive AI Interviewing Platform · Built with Next.js, FastAPI, PyTorch & DeepFace
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: "24px", marginTop: "16px", fontSize: "0.82rem" }}>
            <Link href="/login" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Sign In</Link>
            <Link href="/register" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Register</Link>
            <Link href="/dashboard" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Dashboard</Link>
            <Link href="/admin" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Admin</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
