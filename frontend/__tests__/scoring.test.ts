import { describe, expect, it } from "vitest";
import { filterAndSortClauses, projectScore, riskyClauses, scoreLabel } from "@/lib/scoring";
import type { ClauseAnalysis, Verdict } from "@/lib/types";

function clause(id: string, verdict: Verdict, severity = "LOW"): ClauseAnalysis {
  return {
    clause_id: id,
    clause_type: "termination",
    original_text: "",
    verdict,
    severity,
    risk_type: "EXPLOIT",
    plain_english: "",
    worst_case: "",
    defense_argument: "",
    defense_strength: "",
    negotiation_script: "",
    suggested_redline: "",
    industry_norm: "",
    confidence: "MEDIUM",
    evidence_snippet: "",
    risk_hunter_argument: "",
    defense_counterpoint: "",
  };
}

describe("scoreLabel", () => {
  it.each([
    [0, "HOSTILE"],
    [19, "HOSTILE"],
    [20, "PREDATORY"],
    [59, "HIGH_RISK"],
    [60, "MODERATE"],
    [85, "GOOD"],
    [90, "EXCELLENT"],
    [100, "EXCELLENT"],
  ])("maps %i to %s", (score, label) => {
    expect(scoreLabel(score)).toBe(label);
  });
});

describe("projectScore", () => {
  const clauses = [
    clause("C001", "RED", "CRITICAL"),
    clause("C002", "AMBER", "MEDIUM"),
    clause("C003", "GREEN", "HIGH"),
  ];

  it("returns the base score when nothing is resolved", () => {
    expect(projectScore(50, clauses, new Set())).toBe(50);
  });

  it("adds the severity penalty back for resolved risky clauses", () => {
    expect(projectScore(50, clauses, new Set(["C001", "C002"]))).toBe(69);
  });

  it("ignores GREEN clauses and caps at 100", () => {
    expect(projectScore(95, clauses, new Set(["C001", "C003"]))).toBe(100);
    expect(projectScore(50, clauses, new Set(["C003"]))).toBe(50);
  });
});

describe("clause selectors", () => {
  const clauses = [clause("C1", "GREEN"), clause("C2", "RED"), clause("C3", "AMBER")];

  it("selects only RED and AMBER clauses", () => {
    expect(riskyClauses(clauses).map((c) => c.clause_id)).toEqual(["C2", "C3"]);
  });

  it("sorts by verdict severity and filters", () => {
    expect(filterAndSortClauses(clauses, "ALL").map((c) => c.verdict)).toEqual([
      "RED",
      "AMBER",
      "GREEN",
    ]);
    expect(filterAndSortClauses(clauses, "AMBER").map((c) => c.clause_id)).toEqual(["C3"]);
  });

  it("does not mutate the input array", () => {
    const copy = [...clauses];
    filterAndSortClauses(clauses, "ALL");
    expect(clauses).toEqual(copy);
  });
});
