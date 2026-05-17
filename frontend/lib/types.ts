export type Verdict = "RED" | "AMBER" | "GREEN";

export interface ClauseAnalysis {
  clause_id: string;
  clause_type: string;
  original_text: string;
  verdict: Verdict;
  severity: string;
  risk_type: string;
  plain_english: string;
  worst_case: string;
  defense_argument: string;
  defense_strength: string;
  negotiation_script: string;
  suggested_redline: string;
  industry_norm: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence_snippet: string;
  risk_hunter_argument: string;
  defense_counterpoint: string;
}

export interface ActionPlan {
  recommendation: "SIGN" | "NEGOTIATE_FIRST" | "WALK_AWAY" | string;
  urgency: "LOW" | "MEDIUM" | "HIGH" | "IMMEDIATE" | string;
  rationale: string;
  downside_if_ignored: string;
  next_steps: string[];
}

export interface RiskTaxonomyCounts {
  EXPLOIT: number;
  LIABILITY: number;
  AMBIGUITY: number;
  PRACTICAL_RISK: number;
  MISSING: number;
}

export interface AdversarialMetrics {
  disagreements_count: number;
  defenses_overturned: number;
  defensible_clauses: number;
}

export interface LexGuardAnalysis {
  analysis_id: string;
  doc_type: string;
  weaker_party: string;
  lexscore: number;
  lexscore_label: string;
  status: string;
  summary: {
    total_clauses: number;
    red_clauses: number;
    amber_clauses: number;
    green_clauses: number;
    critical_issues: string[];
  };
  clauses: ClauseAnalysis[];
  missing_protections: string[];
  risk_taxonomy_counts: RiskTaxonomyCounts;
  action_plan: ActionPlan;
  adversarial_metrics: AdversarialMetrics;
  document_benchmark: {
    percentile: number;
    industry_comparison: string;
  };
  raw_meta?: {
    orchestrator?: {
      jurisdiction_hints?: string[];
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

export interface StreamEvent {
  agent?: string;
  status?: string;
  type?: string;
  data?: LexGuardAnalysis;
  message?: string;
  clause_count?: number;
  flagged?: number;
}
