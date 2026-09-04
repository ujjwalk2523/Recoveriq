import pytest
import numpy as np
from app.schemas.context import ContextVector
from app.features.context_encoder import ContextEncoder, FEATURE_DIMENSION

def test_valid_context_encoding():
    ctx = ContextVector(
        amount=1500.0,
        payment_method="UPI",
        failure_category="TECHNICAL",
        failure_code="BAD_REQUEST_TIMEOUT",
        hour=14,
        day_of_week=3,
        time_since_last_payment_minutes=45.0,
        customer_transaction_count=8,
        customer_success_rate=0.90,
        customer_recovery_rate=0.75,
        upi_success_rate=0.92,
        card_success_rate=0.85,
        avg_recovery_delay_minutes=12.0,
        previous_retry_count=1,
        previous_recovery_count=2,
        fatigue_score=15.0,
        risk_score=10.0,
        merchant_recovery_rate=0.78,
        phase6_2_recovery_probability=0.82,
        phase6_3_strategy_probabilities={"IMMEDIATE_RETRY": 0.65},
        phase6_4_timing_probabilities={"IMMEDIATE": 0.70},
    )
    vec = ContextEncoder.encode(ctx)
    assert isinstance(vec, np.ndarray)
    assert vec.shape == (FEATURE_DIMENSION,)
    assert vec[0] == 1.0  # Intercept
    assert not np.isnan(vec).any()
    assert not np.isinf(vec).any()

def test_anti_leakage_rejection():
    with pytest.raises(ValueError, match="Anti-leakage violation"):
        ContextVector.model_validate({
            "amount": 1000.0,
            "payment_method": "UPI",
            "failure_category": "TECHNICAL",
            "failure_code": "ERR_01",
            "hour": 10,
            "day_of_week": 1,
            "target_recovered": 1, # FORBIDDEN FUTURE LEAK
        })
