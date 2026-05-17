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
  document_benchmark: {
    percentile: number;
    industry_comparison: string;
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
