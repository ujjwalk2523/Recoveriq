from ..schemas.reward import RewardBreakdown

class RewardCalculator:
    """
    Calculates the Net Recovery Reward:
    Reward = Recovered Revenue - Recovery Cost - Customer Experience Penalty - Risk Penalty
    """
    
    @staticmethod
    def calculate_reward(
        recovered_amount: float,
        recovery_cost: float,
        experience_penalty: float,
        risk_penalty: float,
        reference_amount: float = 1000.0,
    ) -> RewardBreakdown:
        # 1. Financial Net Reward
        raw_reward = (
            float(recovered_amount)
            - float(recovery_cost)
            - float(experience_penalty)
            - float(risk_penalty)
        )
        
        # 2. Normalized Reward for Bayesian regression stability
        # Scaled by reference amount and clipped to [-2.0, 1.0]
        denom = max(float(reference_amount), 500.0)
        normalized = raw_reward / denom
        normalized_clipped = max(-2.0, min(1.0, normalized))
        
        return RewardBreakdown(
            recovered_revenue=float(recovered_amount),
            recovery_cost=float(recovery_cost),
            experience_penalty=float(experience_penalty),
            risk_penalty=float(risk_penalty),
            raw_reward=round(raw_reward, 2),
            normalized_reward=round(normalized_clipped, 4),
        )
