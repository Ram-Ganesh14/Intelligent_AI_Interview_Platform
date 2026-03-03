"""
Feature B1 — AI-Generated Answer Detection
Detects whether a candidate's text answer was written by an AI using:
1. Statistical perplexity analysis (GPT-2)
2. Stylometric fingerprinting against warm-up baseline

Install: pip install transformers torch
"""

import re
import math
import numpy as np
from transformers import GPT2LMHeadModel, GPT2TokenizerFast
import torch


# ── LOAD GPT-2 FOR PERPLEXITY SCORING ────────────────────────────
print("[AI DETECTOR] Loading GPT-2 model...")
tokenizer = GPT2TokenizerFast.from_pretrained("gpt2")
model = GPT2LMHeadModel.from_pretrained("gpt2")
model.eval()
print("[AI DETECTOR] Model loaded.")


def compute_perplexity(text: str) -> float:
    """
    Lower perplexity = text is more 'expected' = likely AI-generated.
    Human text has higher perplexity (more unpredictable patterns).
    """
    inputs = tokenizer(
        text, return_tensors="pt", truncation=True, max_length=512
    )
    with torch.no_grad():
        outputs = model(**inputs, labels=inputs["input_ids"])
    loss = outputs.loss.item()
    return math.exp(loss)


def extract_style_features(text: str) -> dict:
    """Extract stylometric features from text."""
    words = text.split()
    sentences = re.split(r"[.!?]+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    filler_words = ["um", "uh", "like", "you know", "basically", "actually"]
    filler_count = sum(text.lower().count(f) for f in filler_words)

    return {
        "avg_word_len": (
            np.mean([len(w) for w in words]) if words else 0
        ),
        "avg_sent_len": (
            np.mean([len(s.split()) for s in sentences]) if sentences else 0
        ),
        "vocab_richness": (
            len(set(w.lower() for w in words)) / max(len(words), 1)
        ),
        "filler_ratio": filler_count / max(len(words), 1),
        "perplexity": compute_perplexity(text),
    }


def build_baseline(warmup_answers: list) -> dict:
    """
    Build a writing style baseline from warm-up question answers.
    Pass list of strings from warm-up questions.
    """
    all_features = [extract_style_features(a) for a in warmup_answers]
    baseline = {
        k: np.mean([f[k] for f in all_features]) for k in all_features[0]
    }
    return baseline


def detect_ai_answer(
    answer: str, baseline: dict, threshold: float = 0.35
) -> dict:
    """
    Compare an interview answer against the candidate's warm-up baseline.
    Returns ai_risk_score (0-1) and explanation flags.
    """
    feat = extract_style_features(answer)
    flags = []

    # Low perplexity = AI-like
    if feat["perplexity"] < 50:
        flags.append("LOW_PERPLEXITY: answer reads like AI text")

    # Sudden vocabulary jump
    vocab_jump = feat["vocab_richness"] - baseline["vocab_richness"]
    if vocab_jump > threshold:
        flags.append(f"VOCAB_JUMP: +{vocab_jump:.2f} above baseline")

    # Sudden sentence length increase
    sent_jump = feat["avg_sent_len"] - baseline["avg_sent_len"]
    if sent_jump > 8:
        flags.append(f"SENT_LEN_JUMP: +{sent_jump:.1f} words/sentence")

    # Filler words disappear (AI text has no fillers)
    if baseline["filler_ratio"] > 0.01 and feat["filler_ratio"] < 0.002:
        flags.append(
            "NO_FILLERS: candidate normally uses fillers but none here"
        )

    ai_risk_score = min(len(flags) / 4.0, 1.0)

    return {
        "ai_risk_score": round(ai_risk_score, 2),
        "flags": flags,
        "perplexity": round(feat["perplexity"], 1),
        "ai_flagged": ai_risk_score >= 0.5,
    }


if __name__ == "__main__":
    # ── EXAMPLE USAGE ─────────────────────────────────────────────
    warmup = [
        "Yeah so I've been coding for about 3 years, mostly web stuff",
        "I like Python a lot, um, mainly because it's pretty readable",
    ]
    baseline = build_baseline(warmup)

    interview_answer = (
        "The Factory design pattern is a creational pattern that provides "
        "an interface for creating objects in a superclass, allowing "
        "subclasses to alter the type of objects that will be created."
    )

    result = detect_ai_answer(interview_answer, baseline)
    print("AI Detection Result:")
    print(f"  Risk score: {result['ai_risk_score']}")
    print(f"  Perplexity: {result['perplexity']}")
    print(f"  Flagged: {result['ai_flagged']}")
    print(f"  Flags: {result['flags']}")
