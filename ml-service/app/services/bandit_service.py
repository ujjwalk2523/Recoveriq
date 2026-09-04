from datetime import datetime, timezone
from typing import Dict, Any, Optional
from ..schemas.decision import DecisionRequest, DecisionResponse
from ..schemas.outcome import OutcomeRequest, OutcomeResponse
from ..features.context_encoder import ContextEncoder
from ..bandits.action_space import ActionSpace, APPROVED_ACTIONS
from ..rewards.reward_calculator import RewardCalculator
from ..storage.bandit_state import state_store
from ..config import config

class BanditService:
    @staticmethod
    def decide(request: DecisionRequest) -> DecisionResponse:
        # 1. Encode Context
        x = ContextEncoder.encode(request.context)
        
        # 2. Filter Candidate Actions
        candidates = ActionSpace.filter_candidate_actions(request.candidate_actions)
        
        # 3. Get Merchant Bandit (Merchant Tenancy Scope)
        bandit = state_store.get_bandit(request.merchant_id)
        
        # 4. Thompson Sampling Action Selection
        (
            selected_action,
            best_expected_action,
            selection_mode,
            action_scores,
            expected_reward,
            exploration_prob,
        ) = bandit.select_action(
            context_vector=x,
            candidate_actions=candidates,
            random_seed=request.random_seed,
        )
        
        # 5. Generate Structured Explanation
        act_meta = ActionSpace.get_action(selected_action)
        disp_name = act_meta.display_name if act_meta else selected_action
        
        if selection_mode == "EXPLOIT":
            explanation = (
                f"{disp_name} selected because Contextual Thompson Sampling estimated the highest "
                f"expected net reward ({expected_reward}) for this transaction context (amount: ₹{request.context.amount:,.2f}, "
                f"failure: {request.context.failure_category}, fatigue: {request.context.fatigue_score}/100)."
            )
        else:
            explanation = (
                f"{disp_name} selected for guided exploration (sampling score: {action_scores[selected_action]}) "
                f"to reduce model uncertainty and uncover potentially superior recovery performance."
            )

        now_iso = datetime.now(timezone.utc).isoformat()
        confidence = round(float(max(0.50, min(0.98, 1.0 - (exploration_prob * 0.75)))), 4)

        return DecisionResponse(
            transaction_id=request.transaction_id,
            merchant_id=request.merchant_id,
            merchant_scope="MERCHANT",
            selected_action=selected_action,
            best_expected_action=best_expected_action,
            selection_mode=selection_mode,
            exploration_mode=selection_mode,
            action_scores=action_scores,
            expected_reward=expected_reward,
            confidence=confidence,
            exploration_probability=exploration_prob,
            algorithm=config.algorithm,
            model_version=request.model_version or config.model_version,
            explanation=explanation,
            generated_at=now_iso,
        )

    @staticmethod
    def record_outcome(request: OutcomeRequest) -> OutcomeResponse:
        now_iso = datetime.now(timezone.utc).isoformat()
        decision_id = request.bandit_decision_id or request.decision_id or "unknown"
        idempotency_key = request.idempotency_key or f"{request.merchant_id}:{decision_id}:{request.selected_action}"
        
        # 1. Idempotency Check
        if state_store.is_outcome_processed(idempotency_key):
            return OutcomeResponse(
                bandit_decision_id=decision_id,
                decision_id=decision_id,
                idempotency_key=idempotency_key,
                status="ALREADY_PROCESSED",
                raw_reward=0.0,
                normalized_reward=0.0,
                updated_action=request.selected_action,
                total_action_observations=0,
                is_idempotent_duplicate=True,
                recorded_at=now_iso,
            )

        # 2. Calculate Net Recovery Reward
        rec_amt = request.recovered_amount if request.recovered_amount is not None else (request.recovered_revenue or 0.0)
        exp_pen = request.experience_penalty if request.experience_penalty is not None else (request.fatigue_penalty or 0.0)
        ref_amount = rec_amt if rec_amt > 0 else 1000.0

        reward_breakdown = RewardCalculator.calculate_reward(
            recovered_amount=rec_amt,
            recovery_cost=request.recovery_cost,
            experience_penalty=exp_pen,
            risk_penalty=request.risk_penalty,
            reference_amount=ref_amount,
        )

        # 3. Context Reconstruction
        if request.context_snapshot:
            try:
                from ..schemas.context import ContextVector
                ctx = ContextVector(**request.context_snapshot)
                x = ContextEncoder.encode(ctx)
            except Exception:
                from ..features.context_encoder import FEATURE_DIMENSION
                import numpy as np
                x = np.zeros(FEATURE_DIMENSION, dtype=np.float64)
                x[0] = 1.0
        else:
            from ..features.context_encoder import FEATURE_DIMENSION
            import numpy as np
            x = np.zeros(FEATURE_DIMENSION, dtype=np.float64)
            x[0] = 1.0

        # 4. Bayesian Update
        bandit = state_store.get_bandit(request.merchant_id)
        bandit.update(
            action=request.selected_action,
            context_vector=x,
            reward=reward_breakdown.normalized_reward,
        )
        state_store.save_bandit(request.merchant_id)
        state_store.mark_outcome_processed(idempotency_key)

        obs_count = bandit.action_models.get(request.selected_action, None)
        total_obs = obs_count.observations_count if obs_count else 1

        return OutcomeResponse(
            bandit_decision_id=decision_id,
            decision_id=decision_id,
            idempotency_key=idempotency_key,
            status="LEARNED",
            raw_reward=reward_breakdown.raw_reward,
            normalized_reward=reward_breakdown.normalized_reward,
            updated_action=request.selected_action,
            total_action_observations=total_obs,
            is_idempotent_duplicate=False,
            recorded_at=now_iso,
        )

    @staticmethod
    def get_model_info(merchant_id: Optional[str] = "global") -> Dict[str, Any]:
        m_id = merchant_id or "global"
        bandit = state_store.get_bandit(m_id)
        
        actions_info = {}
        total_obs = 0
        for act_id, act_def in APPROVED_ACTIONS.items():
            model_params = bandit.action_models.get(act_id)
            cnt = model_params.observations_count if model_params else 0
            total_obs += cnt
            actions_info[act_id] = {
                "display_name": act_def.display_name,
                "base_cost": act_def.base_cost,
                "contact_required": act_def.contact_required,
                "risk_level": act_def.risk_level,
                "observations_count": cnt,
            }

        return {
            "model_version": config.model_version,
            "algorithm": config.algorithm,
            "merchant_id": m_id,
            "dimension": bandit.dimension,
            "lambda_prior": bandit.lambda_prior,
            "exploration_variance": bandit.v2,
            "total_observations": total_obs,
            "actions": actions_info,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def get_health() -> Dict[str, Any]:
        global_bandit = state_store.get_bandit("global")
        total_obs = sum(m.observations_count for m in global_bandit.action_models.values())
        return {
            "status": "HEALTHY",
            "service_name": config.service_name,
            "service_version": config.service_version,
            "model_version": config.model_version,
            "algorithm": config.algorithm,
            "active_action_count": len(global_bandit.action_ids),
            "global_total_observations": total_obs,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
