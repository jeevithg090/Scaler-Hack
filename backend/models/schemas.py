from typing import Any, Literal

from pydantic import BaseModel, Field

Verdict = Literal["RED", "AMBER", "GREEN"]
Severity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "CLEAN"]
LexScoreLabel = str  # HOSTILE | PREDATORY | HIGH_RISK | MODERATE | FAIR | GOOD | EXCELLENT


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
    model: str
    agents: list[str]


class AnalyzeResponse(BaseModel):
    analysis_id: str


class AnalysisSummary(BaseModel):
    total_clauses: int = 0
    red_clauses: int = 0
    amber_clauses: int = 0
    green_clauses: int = 0
    critical_issues: list[str] = Field(default_factory=list)


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
    document_benchmark: DocumentBenchmark = Field(default_factory=DocumentBenchmark)
    raw_meta: dict[str, Any] = Field(default_factory=dict)
