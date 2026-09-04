import numpy as np
from typing import Dict, List, Any
from pydantic import BaseModel

class EvaluationMetrics(BaseModel):
    is_synthetic_development_data: bool = True
    total_samples: int
    cumulative_reward: float
    average_reward: float
    cumulative_regret: float
    average_regret: float
    exploration_rate: float
    total_recovered_revenue: float
    net_recovery_revenue: float
    action_distribution: Dict[str, int]
    action_percentages: Dict[str, float]

class BanditEvaluator:
    @staticmethod
    def evaluate(
        rewards: List[float],
        optimal_rewards: List[float],
        actions: List[str],
        modes: List[str],
        amounts_recovered: List[float],
        net_revenues: List[float],
    ) -> EvaluationMetrics:
        n = max(len(rewards), 1)
        r_arr = np.array(rewards, dtype=np.float64)
        opt_arr = np.array(optimal_rewards, dtype=np.float64)
        regrets = np.maximum(0.0, opt_arr - r_arr)

        action_dist: Dict[str, int] = {}
        for a in actions:
            action_dist[a] = action_dist.get(a, 0) + 1

        action_pcts = {k: round((v / n) * 100, 2) for k, v in action_dist.items()}
        explore_count = sum(1 for m in modes if m == "EXPLORE")
        explore_rate = round(explore_count / n, 4)

        return EvaluationMetrics(
            is_synthetic_development_data=True,
            total_samples=len(rewards),
            cumulative_reward=round(float(np.sum(r_arr)), 2),
            average_reward=round(float(np.mean(r_arr)), 4),
            cumulative_regret=round(float(np.sum(regrets)), 2),
            average_regret=round(float(np.mean(regrets)), 4),
            exploration_rate=explore_rate,
            total_recovered_revenue=round(float(sum(amounts_recovered)), 2),
            net_recovery_revenue=round(float(sum(net_revenues)), 2),
            action_distribution=action_dist,
            action_percentages=action_pcts,
        )
