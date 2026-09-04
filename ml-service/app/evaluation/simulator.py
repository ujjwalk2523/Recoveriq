import random
import numpy as np
from typing import Dict, Any, List, Tuple
from ..schemas.context import ContextVector
from ..features.context_encoder import ContextEncoder
from ..bandits.contextual_thompson import ContextualThompsonSampling
from ..bandits.action_space import APPROVED_ACTIONS, ActionSpace
from ..rewards.reward_calculator import RewardCalculator
from .evaluator import BanditEvaluator, EvaluationMetrics

class OfflineBanditSimulator:
    """
    Offline synthetic transaction simulator to benchmark Contextual Thompson Sampling
    against a static baseline strategy without touching production payments.
    """
    
    def __init__(self, seed: int = 42):
        self.rng = random.Random(seed)
        self.np_rng = np.random.default_rng(seed)

    def generate_synthetic_context(self, idx: int) -> ContextVector:
        categories = ["TECHNICAL", "INSUFFICIENT_FUNDS", "USER_AUTHENTICATION", "GATEWAY_DOWNTIME", "RISK_AND_FRAUD"]
        cat_weights = [0.40, 0.30, 0.15, 0.10, 0.05]
        failure_category = self.rng.choices(categories, weights=cat_weights, k=1)[0]
        
        methods = ["UPI", "CARD", "NETBANKING"]
        method_weights = [0.65, 0.25, 0.10]
        payment_method = self.rng.choices(methods, weights=method_weights, k=1)[0]

        is_vip = self.rng.random() < 0.05
        if is_vip:
            amount = round(self.rng.uniform(30000.0, 95000.0), 2)
        elif failure_category == "TECHNICAL":
            amount = round(self.rng.uniform(400.0, 4500.0), 2)
        else:
            amount = round(self.rng.uniform(800.0, 15000.0), 2)

        fatigue_score = round(self.rng.uniform(5.0, 85.0), 1)
        risk_score = round(self.rng.uniform(2.0, 30.0), 1)
        if failure_category == "RISK_AND_FRAUD":
            risk_score = round(self.rng.uniform(75.0, 95.0), 1)

        p_rec = 0.85 if failure_category == "TECHNICAL" else (0.45 if failure_category == "INSUFFICIENT_FUNDS" else 0.65)

        return ContextVector(
            amount=amount,
            payment_method=payment_method,
            failure_category=failure_category,
            failure_code=f"ERR_{failure_category}_SIM_{idx % 100}",
            hour=self.rng.randint(0, 23),
            day_of_week=self.rng.randint(0, 6),
            time_since_last_payment_minutes=round(self.rng.uniform(5.0, 600.0), 1),
            customer_transaction_count=self.rng.randint(1, 40),
            customer_success_rate=round(self.rng.uniform(0.70, 0.98), 2),
            customer_recovery_rate=round(self.rng.uniform(0.40, 0.85), 2),
            upi_success_rate=0.88,
            card_success_rate=0.82,
            avg_recovery_delay_minutes=15.0,
            previous_retry_count=self.rng.randint(0, 3),
            previous_recovery_count=self.rng.randint(0, 5),
            fatigue_score=fatigue_score,
            risk_score=risk_score,
            merchant_recovery_rate=0.72,
            phase6_2_recovery_probability=p_rec,
            phase6_3_strategy_probabilities={
                "IMMEDIATE_RETRY": 0.40 if failure_category == "TECHNICAL" else 0.10,
                "OPTIMAL_DELAYED_RETRY": 0.50 if failure_category == "INSUFFICIENT_FUNDS" else 0.20,
                "PAYMENT_LINK": 0.30,
                "WHATSAPP_NUDGE": 0.20,
            },
            phase6_4_timing_probabilities={
                "IMMEDIATE": 0.60 if failure_category == "TECHNICAL" else 0.10,
                "MEDIUM_DELAY": 0.50 if failure_category == "INSUFFICIENT_FUNDS" else 0.20,
            },
        )

    def simulate_environment_outcome(
        self,
        context: ContextVector,
        action: str,
    ) -> Tuple[float, float, float, float, bool]:
        """
        Simulates ground truth environment response for (context, action).
        Returns: (recovered_amount, action_cost, experience_penalty, risk_penalty, is_recovered)
        """
        act_def = APPROVED_ACTIONS[action]
        cost = act_def.base_cost
        
        # Penalties
        exp_penalty = (context.fatigue_score / 100.0) * (25.0 if act_def.contact_required else 2.0)
        risk_penalty = (context.risk_score / 100.0) * (50.0 if act_def.risk_level != "NONE" else 0.0)

        # Base recovery probability depending on contextual match
        prob = 0.10 # fallback default
        
        if context.failure_category == "RISK_AND_FRAUD":
            # Any recovery action on fraud is heavily penalized with high chargeback risk
            if action == "DO_NOT_RECOVER":
                return (0.0, 0.0, 0.0, 0.0, False)
            else:
                return (0.0, cost, exp_penalty, risk_penalty + 150.0, False)

        if context.fatigue_score > 75.0 and act_def.contact_required:
            prob = 0.05
            exp_penalty += 80.0
        elif context.failure_category == "TECHNICAL":
            if action == "IMMEDIATE_RETRY":
                prob = 0.88
            elif action == "OPTIMAL_DELAYED_RETRY":
                prob = 0.70
            elif action == "PAYMENT_LINK":
                prob = 0.55
        elif context.failure_category == "INSUFFICIENT_FUNDS":
            if action == "OPTIMAL_DELAYED_RETRY":
                prob = 0.68
            elif action == "PAYMENT_LINK":
                prob = 0.52
            elif action == "IMMEDIATE_RETRY":
                prob = 0.08 # Immediate retry on insufficient funds fails 92% of the time!
        elif context.amount > 30000.0:
            if action == "HUMAN_ESCALATION":
                prob = 0.84
            elif action == "PAYMENT_LINK":
                prob = 0.50
        else:
            if action in ("PAYMENT_LINK", "WHATSAPP_NUDGE"):
                prob = 0.65
            elif action == "OPTIMAL_DELAYED_RETRY":
                prob = 0.55

        # Stochastic outcome draw
        is_recovered = self.rng.random() < prob
        recovered_amount = context.amount if is_recovered else 0.0

        return (recovered_amount, cost, exp_penalty, risk_penalty, is_recovered)

    def run_simulation(
        self,
        num_samples: int = 10000,
    ) -> Dict[str, Any]:
        bandit = ContextualThompsonSampling(dimension=28, lambda_prior=1.0, exploration_variance=0.25)
        candidates = ActionSpace.get_all_action_ids()

        bandit_rewards: List[float] = []
        bandit_optimal_rewards: List[float] = []
        bandit_actions: List[str] = []
        bandit_modes: List[str] = []
        bandit_recovered_amounts: List[float] = []
        bandit_net_revenues: List[float] = []

        baseline_rewards: List[float] = []
        baseline_net_revenues: List[float] = []

        for i in range(num_samples):
            ctx = self.generate_synthetic_context(i)
            x = ContextEncoder.encode(ctx)

            # 1. Bandit Action Selection
            (
                selected_action,
                best_expected,
                selection_mode,
                action_scores,
                exp_r,
                exp_prob,
            ) = bandit.select_action(x, candidates)

            # 2. Simulate Environment Outcome for Bandit
            rec_amt, cost, exp_pen, risk_pen, is_rec = self.simulate_environment_outcome(ctx, selected_action)
            b_breakdown = RewardCalculator.calculate_reward(rec_amt, cost, exp_pen, risk_pen, ctx.amount)
            
            # Online Bayesian Update for Bandit
            bandit.update(selected_action, x, b_breakdown.normalized_reward)

            # 3. Simulate Environment Outcome for Static Baseline (e.g. naive static retry or payment link)
            baseline_action = "OPTIMAL_DELAYED_RETRY" if ctx.amount < 15000 else "PAYMENT_LINK"
            base_rec, base_cost, base_exp, base_risk, _ = self.simulate_environment_outcome(ctx, baseline_action)
            base_breakdown = RewardCalculator.calculate_reward(base_rec, base_cost, base_exp, base_risk, ctx.amount)

            # 4. Approximate Optimal Action for Regret Calculation
            all_possible_rewards = [
                self.simulate_environment_outcome(ctx, a) for a in candidates
            ]
            opt_raw = max(
                RewardCalculator.calculate_reward(r[0], r[1], r[2], r[3], ctx.amount).raw_reward
                for r in all_possible_rewards
            )

            bandit_rewards.append(b_breakdown.raw_reward)
            bandit_optimal_rewards.append(opt_raw)
            bandit_actions.append(selected_action)
            bandit_modes.append(selection_mode)
            bandit_recovered_amounts.append(rec_amt)
            bandit_net_revenues.append(b_breakdown.raw_reward)

            baseline_rewards.append(base_breakdown.raw_reward)
            baseline_net_revenues.append(base_breakdown.raw_reward)

        # Evaluate Metrics
        bandit_metrics = BanditEvaluator.evaluate(
            rewards=bandit_rewards,
            optimal_rewards=bandit_optimal_rewards,
            actions=bandit_actions,
            modes=bandit_modes,
            amounts_recovered=bandit_recovered_amounts,
            net_revenues=bandit_net_revenues,
        )

        baseline_net_total = round(float(sum(baseline_net_revenues)), 2)
        bandit_net_total = bandit_metrics.net_recovery_revenue
        incremental_revenue = round(bandit_net_total - baseline_net_total, 2)
        pct_improvement = round((incremental_revenue / max(baseline_net_total, 1.0)) * 100, 2)

        return {
            "isSyntheticDevelopmentData": True,
            "totalSamples": num_samples,
            "baseline": {
                "netRecoveryRevenue": baseline_net_total,
                "averageReward": round(float(np.mean(baseline_rewards)), 4),
            },
            "bandit": bandit_metrics.model_dump(),
            "comparison": {
                "incrementalNetRecovery": incremental_revenue,
                "percentageImprovement": pct_improvement,
            },
        }
