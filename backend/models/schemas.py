from typing import Any, Literal

from pydantic import BaseModel, Field

Verdict = Literal["RED", "AMBER", "GREEN"]
Severity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "CLEAN"]
LexScoreLabel = str  # HOSTILE | PREDATORY | HIGH_RISK | MODERATE | FAIR | GOOD | EXCELLENT
Confidence = Literal["HIGH", "MEDIUM", "LOW"]


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.2.0"
    model: str
    agents: list[str]
    uptime_seconds: int = 0
    queue_depth: dict[str, int] = Field(default_factory=dict)
    environment: dict[str, bool] = Field(default_factory=dict)


class AnalyzeResponse(BaseModel):
    analysis_id: str


class AnalysisSummary(BaseModel):
    total_clauses: int = 0
    red_clauses: int = 0
    amber_clauses: int = 0
    green_clauses: int = 0
    critical_issues: list[str] = Field(default_factory=list)


class RiskTaxonomyCounts(BaseModel):
    EXPLOIT: int = 0
    LIABILITY: int = 0
    AMBIGUITY: int = 0
    PRACTICAL_RISK: int = 0
    MISSING: int = 0


class ActionPlan(BaseModel):
    recommendation: str = "NEGOTIATE_FIRST"  # SIGN | NEGOTIATE_FIRST | WALK_AWAY
    urgency: str = "MEDIUM"  # LOW | MEDIUM | HIGH | IMMEDIATE
    rationale: str = ""
    downside_if_ignored: str = ""
    next_steps: list[str] = Field(default_factory=list)


class AdversarialMetrics(BaseModel):
    disagreements_count: int = 0
    defenses_overturned: int = 0
    defensible_clauses: int = 0


class DocumentBenchmark(BaseModel):
    percentile: int = 50
    industry_comparison: str = ""


class ClauseAnalysis(BaseModel):
    clause_id: str
    clause_type: str = ""
    original_text: str = ""
    verdict: Verdict = "GREEN"
    severity: Severity = "LOW"
    risk_type: str = ""
    plain_english: str = ""
    worst_case: str = ""
    defense_argument: str = ""
    defense_strength: str = ""
    negotiation_script: str = ""
    suggested_redline: str = ""
    industry_norm: str = ""
    confidence: Confidence = "MEDIUM"
    evidence_snippet: str = ""
    risk_hunter_argument: str = ""
    defense_counterpoint: str = ""


class LexGuardAnalysis(BaseModel):
    analysis_id: str
    doc_type: str = "other"
    weaker_party: str = "unknown"
    lexscore: int = 100
    lexscore_label: str = "EXCELLENT"
    created_at: str = ""
    status: str = "pending"
    summary: AnalysisSummary = Field(default_factory=AnalysisSummary)
    clauses: list[ClauseAnalysis] = Field(default_factory=list)
    missing_protections: list[str] = Field(default_factory=list)
    risk_taxonomy_counts: RiskTaxonomyCounts = Field(default_factory=RiskTaxonomyCounts)
    action_plan: ActionPlan = Field(default_factory=ActionPlan)
    adversarial_metrics: AdversarialMetrics = Field(default_factory=AdversarialMetrics)
    document_benchmark: DocumentBenchmark = Field(default_factory=DocumentBenchmark)
    raw_meta: dict[str, Any] = Field(default_factory=dict)
