import type { ClauseAnalysis, Verdict } from "./types";

/** Score penalty applied per clause severity; mirrors the synthesis agent's impact scale. */
export const SEVERITY_PENALTY: Record<string, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 4,
  LOW: 1,
  CLEAN: 0,
};

const VERDICT_ORDER: Record<Verdict, number> = { RED: 0, AMBER: 1, GREEN: 2 };

/** Map a 0-100 LEXSCORE to its label band. */
export function scoreLabel(score: number): string {
  if (score <= 19) return "HOSTILE";
  if (score <= 39) return "PREDATORY";
  if (score <= 59) return "HIGH_RISK";
  if (score <= 79) return "MODERATE";
  if (score <= 89) return "GOOD";
  return "EXCELLENT";
}

/** RED and AMBER clauses, i.e. the ones worth negotiating. */
export function riskyClauses(clauses: ClauseAnalysis[]): ClauseAnalysis[] {
  return clauses.filter((c) => c.verdict === "RED" || c.verdict === "AMBER");
}

/** Score the contract would reach if the selected risky clauses were successfully negotiated away. */
export function projectScore(
  baseScore: number,
  clauses: ClauseAnalysis[],
  resolvedIds: ReadonlySet<string>,
): number {
  let uplift = 0;
  for (const clause of riskyClauses(clauses)) {
    if (resolvedIds.has(clause.clause_id)) uplift += SEVERITY_PENALTY[clause.severity] ?? 0;
  }
  return Math.max(0, Math.min(100, baseScore + uplift));
}

/** Sort clauses RED → AMBER → GREEN, optionally keeping only one verdict. */
export function filterAndSortClauses(
  clauses: ClauseAnalysis[],
  filter: "ALL" | Verdict,
): ClauseAnalysis[] {
  return clauses
    .filter((c) => filter === "ALL" || c.verdict === filter)
    .sort((a, b) => (VERDICT_ORDER[a.verdict] ?? 3) - (VERDICT_ORDER[b.verdict] ?? 3));
}
