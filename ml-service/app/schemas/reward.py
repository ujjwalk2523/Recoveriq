from pydantic import BaseModel, Field

class RewardBreakdown(BaseModel):
    recovered_revenue: float = Field(..., description="Revenue collected from transaction (0 if failed)")
    recovery_cost: float = Field(..., ge=0.0, description="Direct cost of action execution")
    experience_penalty: float = Field(..., ge=0.0, description="Customer friction and fatigue penalty")
    risk_penalty: float = Field(..., ge=0.0, description="Dispute / chargeback penalty")
    raw_reward: float = Field(..., description="Net financial reward in INR")
    normalized_reward: float = Field(..., description="Scaled reward used for Bayesian regression")
