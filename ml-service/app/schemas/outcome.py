from pydantic import BaseModel, Field, model_validator
from typing import Optional, Dict, Any

class OutcomeRequest(BaseModel):
    bandit_decision_id: Optional[str] = None
    decision_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    
    merchant_id: str = Field(..., description="SaaS Merchant ID")
    transaction_id: str = Field(..., description="Transaction ID")
    selected_action: str = Field(..., description="Action that was executed")
    
    recovered_amount: Optional[float] = Field(default=None, ge=0.0)
    recovered_revenue: Optional[float] = Field(default=None, ge=0.0)
    
    recovery_cost: float = Field(0.0, ge=0.0, description="Direct execution cost")
    experience_penalty: Optional[float] = Field(default=None, ge=0.0)
    fatigue_penalty: Optional[float] = Field(default=None, ge=0.0)
    risk_penalty: float = Field(0.0, ge=0.0, description="Risk penalty")
    
    reward: Optional[float] = None
    outcome: str = Field(..., description="RECOVERED, FAILED, EXPIRED, CANCELLED, SUPPRESSED, etc.")
    context_snapshot: Optional[Dict[str, Any]] = Field(default=None, description="Original decision-time context vector")

    @model_validator(mode="before")
    @classmethod
    def resolve_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Resolve decision ID
            if "decision_id" in data and "bandit_decision_id" not in data:
                data["bandit_decision_id"] = data["decision_id"]
            elif "bandit_decision_id" in data and "decision_id" not in data:
                data["decision_id"] = data["bandit_decision_id"]

            # Resolve recovered revenue/amount
            if "recovered_revenue" in data and "recovered_amount" not in data:
                data["recovered_amount"] = data["recovered_revenue"]
            elif "recovered_amount" in data and "recovered_revenue" not in data:
                data["recovered_revenue"] = data["recovered_amount"]
            elif "recovered_amount" not in data and "recovered_revenue" not in data:
                data["recovered_amount"] = 0.0
                data["recovered_revenue"] = 0.0

            # Resolve fatigue/experience penalty
            if "fatigue_penalty" in data and "experience_penalty" not in data:
                data["experience_penalty"] = data["fatigue_penalty"]
            elif "experience_penalty" in data and "fatigue_penalty" not in data:
                data["fatigue_penalty"] = data["experience_penalty"]
            elif "experience_penalty" not in data and "fatigue_penalty" not in data:
                data["experience_penalty"] = 0.0
                data["fatigue_penalty"] = 0.0

            # Default idempotency key if missing
            if not data.get("idempotency_key"):
                dec_id = data.get("bandit_decision_id") or data.get("decision_id") or "unknown"
                act = data.get("selected_action") or "unknown"
                m_id = data.get("merchant_id") or "global"
                data["idempotency_key"] = f"{m_id}:{dec_id}:{act}"

        return data

class OutcomeResponse(BaseModel):
    bandit_decision_id: str
    decision_id: str
    idempotency_key: str
    status: str
    raw_reward: float
    normalized_reward: float
    updated_action: str
    total_action_observations: int
    is_idempotent_duplicate: bool
    recorded_at: str
