import math
import numpy as np
from typing import Dict, Any
from ..schemas.context import ContextVector

FEATURE_DIMENSION = 28

class ContextEncoder:
    """
    Encodes decision-time ContextVector into fixed-dimension NumPy vector.
    Enforces strict zero-leakage of future outcomes.
    """
    
    @staticmethod
    def encode(context: ContextVector) -> np.ndarray:
        vec = np.zeros(FEATURE_DIMENSION, dtype=np.float64)
        
        # 0. Intercept
        vec[0] = 1.0
        
        # 1. Financial: Log-scaled amount
        vec[1] = math.log1p(max(0.0, context.amount)) / 10.0
        
        # 2-4. Temporal
        vec[2] = context.hour / 24.0
        vec[3] = context.day_of_week / 7.0
        vec[4] = min(context.time_since_last_payment_minutes, 1440.0) / 1440.0
        
        # 5-7. Customer History
        vec[5] = min(float(context.customer_transaction_count), 50.0) / 50.0
        vec[6] = float(context.customer_success_rate)
        vec[7] = float(context.customer_recovery_rate)
        
        # 8-9. Rail Health
        vec[8] = float(context.upi_success_rate)
        vec[9] = float(context.card_success_rate)
        
        # 10-13. Friction & Risk
        vec[10] = min(float(context.previous_retry_count), 10.0) / 10.0
        vec[11] = float(context.fatigue_score) / 100.0
        vec[12] = float(context.risk_score) / 100.0
        vec[13] = float(context.merchant_recovery_rate)
        
        # 14. Phase 6.2 ML Baseline Recovery Probability
        vec[14] = float(context.phase6_2_recovery_probability)
        
        # 15-18. Payment Method One-Hot
        pm = context.payment_method.upper()
        if pm == "UPI":
            vec[15] = 1.0
        elif pm == "CARD":
            vec[16] = 1.0
        elif pm == "NETBANKING":
            vec[17] = 1.0
        else:
            vec[18] = 1.0
            
        # 19-23. Failure Category One-Hot
        fc = context.failure_category.upper()
        if fc == "TECHNICAL":
            vec[19] = 1.0
        elif fc == "INSUFFICIENT_FUNDS":
            vec[20] = 1.0
        elif fc == "USER_AUTHENTICATION":
            vec[21] = 1.0
        elif fc == "GATEWAY_DOWNTIME":
            vec[22] = 1.0
        else:
            vec[23] = 1.0
            
        # 24-27. Phase 6.3 Strategy Priors
        strat_probs = context.phase6_3_strategy_probabilities or {}
        vec[24] = float(strat_probs.get("IMMEDIATE_RETRY", 0.0))
        vec[25] = float(strat_probs.get("OPTIMAL_DELAYED_RETRY", 0.0))
        vec[26] = float(strat_probs.get("PAYMENT_LINK", 0.0))
        vec[27] = float(strat_probs.get("WHATSAPP_NUDGE", 0.0))
        
        # Protection against NaNs or Infinities
        vec = np.nan_to_num(vec, nan=0.0, posinf=1.0, neginf=-1.0)
        return vec
