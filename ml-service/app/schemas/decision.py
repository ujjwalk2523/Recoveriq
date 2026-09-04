from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from .context import ContextVector

class DecisionRequest(BaseModel):
    merchant_id: str = Field(..., description="SaaS Merchant ID for tenancy isolation")
    transaction_id: str = Field(..., description="Unique transaction ID")
    context: ContextVector
    candidate_actions: Optional[List[str]] = Field(default=None, description="Subset of approved actions to consider")
    model_version: Optional[str] = Field(default="bandit-v1.0")
    random_seed: Optional[int] = Field(default=None, description="Optional seed for deterministic sampling in tests")

class DecisionResponse(BaseModel):
    transaction_id: str
    merchant_id: str
    merchant_scope: str = "MERCHANT"
    selected_action: str
    best_expected_action: str
    selection_mode: str = Field(..., description="'EXPLOIT' or 'EXPLORE'")
    exploration_mode: str = Field(..., description="Alias for selection_mode ('EXPLOIT' or 'EXPLORE')")
    action_scores: Dict[str, float]
    expected_reward: float
    confidence: float = Field(..., ge=0.0, le=1.0, description="Model certainty score for selected action")
    exploration_probability: float
    algorithm: str = "CONTEXTUAL_THOMPSON_SAMPLING"
    model_version: str = "bandit-v1.0"
    explanation: str
    generated_at: str
