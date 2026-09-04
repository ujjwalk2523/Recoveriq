from pydantic import BaseModel, Field, model_validator
from typing import Dict, Any

FORBIDDEN_FUTURE_KEYS = {
    "target_recovered",
    "recovered_amount",
    "actual_recovered",
    "target_time_to_recover_minutes",
    "actual_outcome",
    "future_payment_outcome",
    "future_fatigue",
    "recovery_status",
    "payment_captured",
    "final_transaction_status",
    "recovery_time",
    "future_recovery_attempts",
    "final_reward",
    "post_decision_events",
}

class ContextVector(BaseModel):
    amount: float = Field(..., ge=0.0, description="Transaction amount in INR")
    payment_method: str = Field(..., description="UPI, CARD, NETBANKING, WALLET")
    failure_category: str = Field(..., description="TECHNICAL, INSUFFICIENT_FUNDS, etc.")
    failure_code: str = Field(..., description="Gateway specific or standard failure code")
    
    hour: int = Field(..., ge=0, le=23, description="Hour of day (0-23)")
    day_of_week: int = Field(..., ge=0, le=6, description="Day of week (0=Sunday)")
    time_since_last_payment_minutes: float = Field(0.0, ge=0.0)
    
    customer_transaction_count: int = Field(0, ge=0)
    customer_success_rate: float = Field(0.0, ge=0.0, le=1.0)
    customer_recovery_rate: float = Field(0.0, ge=0.0, le=1.0)
    
    upi_success_rate: float = Field(0.85, ge=0.0, le=1.0)
    card_success_rate: float = Field(0.80, ge=0.0, le=1.0)
    avg_recovery_delay_minutes: float = Field(15.0, ge=0.0)
    
    previous_retry_count: int = Field(0, ge=0)
    previous_recovery_count: int = Field(0, ge=0)
    fatigue_score: float = Field(0.0, ge=0.0, le=100.0)
    risk_score: float = Field(0.0, ge=0.0, le=100.0)
    merchant_recovery_rate: float = Field(0.70, ge=0.0, le=1.0)
    
    # ML pre-decision signals (Phases 6.2 - 6.4)
    phase6_2_recovery_probability: float = Field(0.50, ge=0.0, le=1.0)
    phase6_3_strategy_probabilities: Dict[str, float] = Field(default_factory=dict)
    phase6_4_timing_probabilities: Dict[str, float] = Field(default_factory=dict)

    @model_validator(mode="before")
    @classmethod
    def check_anti_leakage(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in data.keys():
                normalized_key = key.lower().strip()
                if normalized_key in FORBIDDEN_FUTURE_KEYS:
                    raise ValueError(
                        f"Anti-leakage violation: Future outcome field '{key}' cannot be present in decision-time context vector!"
                    )
        return data
