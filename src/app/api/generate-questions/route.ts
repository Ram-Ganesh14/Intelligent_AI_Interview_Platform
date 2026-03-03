import { NextRequest, NextResponse } from "next/server";

/**
 * QUESTION GENERATION PIPELINE
 * 
 * Input:  Resume (parsed JSON) + Self-Introduction (transcript) + Job Role
 * Output: 8-12 unique, personalised interview questions
 * 
 * Pipeline Steps:
 *   1. Parse resume → extract skills, experience, companies, projects
 *   2. Analyse self-intro → extract tone, vocabulary level, claimed strengths
 *   3. Build skill gap matrix → compare claimed skills vs role requirements
 *   4. Construct structured LLM prompt with all context
 *   5. LLM generates unique questions tailored to THIS specific candidate
 */

// ── Role-specific skill requirements ─────────────────────────────
const ROLE_REQUIREMENTS: Record<string, string[]> = {
    "Backend Engineer": ["Python", "Java", "REST APIs", "SQL", "Docker", "Kubernetes", "Redis", "PostgreSQL", "System Design", "CI/CD", "Microservices"],
    "Frontend Developer": ["React", "TypeScript", "HTML/CSS", "JavaScript", "Next.js", "REST APIs", "Testing", "Performance", "Accessibility", "State Management"],
    "Full Stack": ["React", "Node.js", "TypeScript", "SQL", "REST APIs", "Docker", "Git", "Testing", "System Design", "MongoDB"],
    "ML Engineer": ["Python", "PyTorch", "TensorFlow", "Scikit-learn", "NLP", "Deep Learning", "MLOps", "Data Pipelines", "Statistics", "Feature Engineering"],
    "Data Analyst": ["SQL", "Python", "Pandas", "Data Visualization", "Statistics", "Excel", "Tableau", "ETL", "A/B Testing", "Business Intelligence"],
    "DevOps Engineer": ["Docker", "Kubernetes", "CI/CD", "AWS", "Terraform", "Linux", "Monitoring", "Networking", "Scripting", "Security"],
    "System Design": ["Distributed Systems", "Scalability", "Databases", "Caching", "Load Balancing", "Message Queues", "API Design", "Microservices", "CAP Theorem", "Consistency"],
};

// ── Difficulty calibration from experience ───────────────────────
function getDifficultyLevel(years: number): string {
    if (years < 1) return "BEGINNER";
    if (years < 3) return "JUNIOR";
    if (years < 6) return "MID";
    if (years < 10) return "SENIOR";
    return "PRINCIPAL";
}

// ── Build skill gap matrix ───────────────────────────────────────
function buildGapMatrix(candidateSkills: string[], roleSkills: string[]) {
    const claimed = new Set(candidateSkills.map(s => s.toLowerCase()));
    const required = new Set(roleSkills.map(s => s.toLowerCase()));

    const matched = [...claimed].filter(s => required.has(s));
    const missing = [...required].filter(s => !claimed.has(s));
    const extra = [...claimed].filter(s => !required.has(s));

    return { matched, missing, extra, coverage: matched.length / Math.max(required.size, 1) };
}

// ── Analyse self-introduction ────────────────────────────────────
function analyseSelfIntro(text: string) {
    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim());

    const techKeywords = [
        "api", "database", "server", "deploy", "algorithm", "framework",
        "architecture", "microservice", "pipeline", "model", "training",
        "cloud", "docker", "kubernetes", "react", "python", "java",
        "machine learning", "deep learning", "sql", "nosql", "redis",
        "aws", "gcp", "azure", "ci/cd", "devops", "agile", "scrum",
    ];

    const mentionedTech = techKeywords.filter(kw => text.toLowerCase().includes(kw));
    const avgSentenceLen = sentences.length > 0
        ? Math.round(words.length / sentences.length)
        : 0;

    const fillerWords = ["um", "uh", "like", "basically", "actually", "you know"];
    const fillerCount = fillerWords.reduce((c, f) => c + (text.toLowerCase().split(f).length - 1), 0);

    return {
        wordCount: words.length,
        avgSentenceLen,
        techTermsMentioned: mentionedTech,
        vocabularyLevel: mentionedTech.length > 5 ? "advanced" : mentionedTech.length > 2 ? "intermediate" : "basic",
        confidence: fillerCount < 3 ? "high" : fillerCount < 6 ? "medium" : "low",
        fillerCount,
        claimedStrengths: mentionedTech.slice(0, 5),
    };
}

// ── Build the structured LLM prompt ──────────────────────────────
function buildQuestionGenerationPrompt(
    resume: {
        name: string;
        skills: string[];
        total_exp_years: number;
        education: string[];
        companies: string[];
        designations: string[];
        projects?: string[];
    },
    selfIntro: string,
    role: string,
    introAnalysis: ReturnType<typeof analyseSelfIntro>,
    gap: ReturnType<typeof buildGapMatrix>,
    difficulty: string,
) {
    return `You are an expert technical interviewer conducting a ${role} interview.

═══════════════════════════════════════════════
CANDIDATE PROFILE (extracted from resume)
═══════════════════════════════════════════════
• Name: ${resume.name}
• Experience: ${resume.total_exp_years} years
• Companies: ${resume.companies.join(", ") || "Not specified"}
• Designations: ${resume.designations.join(", ") || "Not specified"}
• Education: ${resume.education.join(", ") || "Not specified"}
• Claimed Skills: ${resume.skills.join(", ")}
${resume.projects ? `• Notable Projects: ${resume.projects.join(", ")}` : ""}

═══════════════════════════════════════════════
SELF-INTRODUCTION ANALYSIS
═══════════════════════════════════════════════
• Transcript: "${selfIntro}"
• Vocabulary Level: ${introAnalysis.vocabularyLevel}
• Confidence Level: ${introAnalysis.confidence}
• Tech Terms Mentioned: ${introAnalysis.techTermsMentioned.join(", ") || "none"}
• Claimed Strengths: ${introAnalysis.claimedStrengths.join(", ") || "none specific"}

═══════════════════════════════════════════════
SKILL GAP ANALYSIS (vs ${role} requirements)
═══════════════════════════════════════════════
• Matched Skills: ${gap.matched.join(", ") || "none"}
• MISSING Skills (PROBE THESE): ${gap.missing.join(", ") || "none"}
• Extra Skills: ${gap.extra.join(", ") || "none"}
• Coverage: ${Math.round(gap.coverage * 100)}%

═══════════════════════════════════════════════
CALIBRATION
═══════════════════════════════════════════════
• Difficulty Level: ${difficulty}
• Interview Role: ${role}

═══════════════════════════════════════════════
GENERATION RULES
═══════════════════════════════════════════════
Generate exactly 10 interview questions following these rules:

1. PERSONALISE every question — reference the candidate's actual companies, projects, or claimed experience where natural
2. PROBE MISSING SKILLS FIRST — at least 3 questions must target skills from the gap analysis
3. VERIFY CLAIMED SKILLS — at least 2 questions must test skills they claim to have (catch resume inflation)
4. REFERENCE SELF-INTRO — at least 1 question must dig deeper into something they mentioned in their introduction
5. MIX FORMATS — include: 4 technical text questions, 3 coding challenges, 2 behavioral/situational, 1 system design
6. CALIBRATE DIFFICULTY to ${difficulty} level:
   - BEGINNER: Conceptual, definition-level, simple examples
   - JUNIOR: Apply concepts, write basic code, explain tradeoffs
   - MID: Design solutions, debug complex scenarios, compare approaches  
   - SENIOR: Architect systems, evaluate tradeoffs at scale, lead decisions
   - PRINCIPAL: Novel problem solving, cross-system design, mentor-level depth
7. MAKE QUESTIONS IMPOSSIBLE TO ANSWER WITH GENERIC AI RESPONSES — require specific, contextual detail
8. Each question MUST be unique — never repeat concepts or topics

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation, no code fences):
[
  {
    "id": 1,
    "text": "The full question text, personalised to this candidate",
    "topic": "The specific skill or topic being tested",
    "difficulty": <1-5 number>,
    "format": "text" | "code" | "behavioral" | "system_design",
    "probe_type": "GAP" | "VERIFY" | "INTRO_FOLLOWUP" | "GENERAL",
    "why": "One sentence explaining why this question was chosen for THIS candidate"
  }
]`;
}

// ── Simulated LLM response (for when no API key is set) ──────────
function generateFallbackQuestions(
    resume: { name: string; skills: string[]; total_exp_years: number; companies: string[]; designations: string[] },
    selfIntro: string,
    role: string,
    gap: ReturnType<typeof buildGapMatrix>,
    difficulty: string,
    introAnalysis: ReturnType<typeof analyseSelfIntro>,
) {
    const questions: Array<{
        id: number; text: string; topic: string; difficulty: number;
        format: string; probe_type: string; why: string;
    }> = [];
    let id = 1;

    const company = resume.companies[0] || "your previous company";
    const diffNum = ["BEGINNER", "JUNIOR", "MID", "SENIOR", "PRINCIPAL"].indexOf(difficulty) + 1;

    // Probe missing skills
    for (const skill of gap.missing.slice(0, 3)) {
        questions.push({
            id: id++,
            text: `Your resume doesn't mention ${skill}, but it's critical for a ${role}. ${diffNum <= 2
                ? `Can you explain what ${skill} is and how it's used in a real project?`
                : `Walk me through how you would use ${skill} to solve a production-level problem at ${company}.`
                }`,
            topic: skill,
            difficulty: diffNum,
            format: "text",
            probe_type: "GAP",
            why: `${skill} is missing from resume but required for ${role}`
        });
    }

    // Verify claimed skills
    for (const skill of gap.matched.slice(0, 2)) {
        questions.push({
            id: id++,
            text: `You list ${skill} on your resume and have ${resume.total_exp_years} years of experience. ${diffNum <= 2
                ? `Explain the core concepts of ${skill} and give a practical example from your work at ${company}.`
                : `Describe the most complex ${skill} problem you solved at ${company}. What tradeoffs did you consider?`
                }`,
            topic: skill,
            difficulty: diffNum,
            format: "text",
            probe_type: "VERIFY",
            why: `Candidate claims ${skill} — verifying depth matches ${resume.total_exp_years} years experience`
        });
    }

    // Follow up from self-intro
    if (introAnalysis.techTermsMentioned.length > 0) {
        const tech = introAnalysis.techTermsMentioned[0];
        questions.push({
            id: id++,
            text: `In your introduction, you mentioned ${tech}. Can you walk me through a specific project where you used ${tech}, the challenges you faced, and how you solved them?`,
            topic: tech,
            difficulty: diffNum,
            format: "behavioral",
            probe_type: "INTRO_FOLLOWUP",
            why: `Candidate specifically mentioned ${tech} in self-intro — probing depth`
        });
    } else {
        questions.push({
            id: id++,
            text: `Tell me about the most technically challenging project you worked on at ${company}. What was your specific role and contribution?`,
            topic: "Project Experience",
            difficulty: diffNum,
            format: "behavioral",
            probe_type: "INTRO_FOLLOWUP",
            why: "Self-intro lacked specific technical mentions — probing for depth"
        });
    }

    // Coding questions
    const codingQuestions = [
        { text: `Write a function that takes a list of ${gap.matched[0] || "API"} endpoints and groups them by HTTP method. Handle edge cases.`, topic: gap.matched[0] || "Coding" },
        { text: `Given your experience at ${company}, write a function to validate and parse a configuration object. It should handle nested keys, type checking, and return meaningful error messages.`, topic: "Problem Solving" },
        { text: `Implement a simple rate limiter class that allows N requests per minute. Include the data structure choice and explain the time complexity.`, topic: "Data Structures" },
    ];
    for (const cq of codingQuestions.slice(0, 3)) {
        questions.push({
            id: id++,
            text: cq.text,
            topic: cq.topic,
            difficulty: diffNum,
            format: "code",
            probe_type: "GENERAL",
            why: `Coding challenge calibrated to ${difficulty} for ${role}`
        });
    }

    // System design
    questions.push({
        id: id++,
        text: `Based on your experience at ${company}${resume.designations[0] ? ` as a ${resume.designations[0]}` : ""}, design a ${role.includes("ML") ? "real-time ML prediction serving system" :
            role.includes("Frontend") ? "component library with versioning and automated testing" :
                role.includes("Data") ? "data pipeline that processes 10M events/day with exactly-once semantics" :
                    "service that handles 10K requests/second with 99.9% uptime"
            }. Walk me through your architecture decisions.`,
        topic: "System Design",
        difficulty: Math.min(diffNum + 1, 5),
        format: "system_design",
        probe_type: "GENERAL",
        why: `System design calibrated to ${difficulty} for ${role}, referencing their ${company} experience`
    });

    // Behavioral
    questions.push({
        id: id++,
        text: `As a ${resume.designations[0] || role} at ${company}, describe a time when you disagreed with your team's technical approach. How did you handle it, and what was the outcome?`,
        topic: "Leadership & Conflict",
        difficulty: diffNum,
        format: "behavioral",
        probe_type: "GENERAL",
        why: `Behavioral question contextualised to their designation and company`
    });

    return questions;
}

// ── API HANDLER ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { resume, selfIntro, role } = body;

        if (!resume || !selfIntro || !role) {
            return NextResponse.json(
                { error: "Missing required fields: resume, selfIntro, role" },
                { status: 400 }
            );
        }

        // Step 1: Get role requirements
        const roleSkills = ROLE_REQUIREMENTS[role] || ROLE_REQUIREMENTS["Backend Engineer"];

        // Step 2: Build skill gap matrix
        const gap = buildGapMatrix(resume.skills || [], roleSkills);

        // Step 3: Analyse self-introduction
        const introAnalysis = analyseSelfIntro(selfIntro);

        // Step 4: Calibrate difficulty
        const difficulty = getDifficultyLevel(resume.total_exp_years || 0);

        // Step 5: Build structured prompt
        const prompt = buildQuestionGenerationPrompt(
            resume, selfIntro, role, introAnalysis, gap, difficulty
        );

        // Step 6: Generate questions via LLM
        // Priority: Ollama (local, free) → OpenAI → Anthropic → Rule-based fallback
        let questions;
        let llmSource = "fallback";

        // ── PRIORITY 1: Ollama (local LLM — no API key needed) ────
        // Ollama runs at http://localhost:11434 by default
        // Install: https://ollama.com  →  ollama pull llama3.2
        // It uses the OpenAI-compatible /v1/chat/completions endpoint
        const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
        const ollamaModel = process.env.OLLAMA_MODEL || "llama3.2";

        try {
            // Quick health check — don't wait more than 2s
            const healthCheck = await fetch(`${ollamaUrl}/api/tags`, {
                signal: AbortSignal.timeout(2000),
            });

            if (healthCheck.ok) {
                console.log(`[PIPELINE] Ollama detected at ${ollamaUrl}, using model: ${ollamaModel}`);

                const response = await fetch(`${ollamaUrl}/v1/chat/completions`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        model: ollamaModel,
                        messages: [
                            {
                                role: "system",
                                content: "You are an expert technical interviewer. Always respond with valid JSON arrays only. No markdown, no explanation, no code fences."
                            },
                            { role: "user", content: prompt }
                        ],
                        temperature: 0.8,
                        stream: false,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    const raw = data.choices?.[0]?.message?.content?.trim() || "";
                    // Clean any markdown fences the model might add
                    const cleaned = raw
                        .replace(/```json\s*/gi, "")
                        .replace(/```\s*/g, "")
                        .replace(/^\s*\n/, "")
                        .trim();

                    // Find the JSON array in the response
                    const jsonStart = cleaned.indexOf("[");
                    const jsonEnd = cleaned.lastIndexOf("]");
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);
                        questions = JSON.parse(jsonStr);
                        llmSource = `ollama/${ollamaModel}`;
                        console.log(`[PIPELINE] ✓ Generated ${questions.length} questions via Ollama (${ollamaModel})`);
                    }
                }
            }
        } catch (e) {
            // Ollama not running — continue to next option
            console.log("[PIPELINE] Ollama not available, trying cloud APIs...");
        }

        // ── PRIORITY 2: OpenAI (cloud, needs API key) ─────────────
        if (!questions && process.env.OPENAI_API_KEY) {
            try {
                const response = await fetch("https://api.openai.com/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: "gpt-4o-mini",
                        messages: [{ role: "user", content: prompt }],
                        temperature: 0.8,
                        max_tokens: 3000,
                    }),
                });
                const data = await response.json();
                const raw = data.choices?.[0]?.message?.content?.trim() || "";
                const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
                questions = JSON.parse(cleaned);
                llmSource = "openai/gpt-4o-mini";
            } catch {
                console.log("[PIPELINE] OpenAI failed, trying Anthropic...");
            }
        }

        // ── PRIORITY 3: Anthropic (cloud, needs API key) ──────────
        if (!questions && process.env.ANTHROPIC_API_KEY) {
            try {
                const response = await fetch("https://api.anthropic.com/v1/messages", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-api-key": process.env.ANTHROPIC_API_KEY!,
                        "anthropic-version": "2023-06-01",
                    },
                    body: JSON.stringify({
                        model: "claude-sonnet-4-20250514",
                        max_tokens: 3000,
                        messages: [{ role: "user", content: prompt }],
                    }),
                });
                const data = await response.json();
                const raw = data.content?.[0]?.text?.trim() || "";
                const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();
                questions = JSON.parse(cleaned);
                llmSource = "anthropic/claude-sonnet";
            } catch {
                console.log("[PIPELINE] Anthropic failed, using rule-based fallback...");
            }
        }

        // ── PRIORITY 4: Rule-based fallback (no LLM needed) ──────
        if (!questions) {
            questions = generateFallbackQuestions(resume, selfIntro, role, gap, difficulty, introAnalysis);
            llmSource = "rule-based-fallback";
            console.log("[PIPELINE] Using rule-based fallback for question generation");
        }

        return NextResponse.json({
            success: true,
            candidate: resume.name,
            role,
            difficulty,
            llm_source: llmSource,
            gap_analysis: {
                matched: gap.matched,
                missing: gap.missing,
                coverage: Math.round(gap.coverage * 100),
            },
            intro_analysis: {
                vocabulary_level: introAnalysis.vocabularyLevel,
                confidence: introAnalysis.confidence,
                tech_terms: introAnalysis.techTermsMentioned,
            },
            prompt_used: prompt,
            questions,
        });
    } catch (error) {
        console.error("Question generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate questions" },
            { status: 500 }
        );
    }
}
