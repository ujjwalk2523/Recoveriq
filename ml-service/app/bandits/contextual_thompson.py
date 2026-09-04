import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from .base import AbstractBandit
from .action_space import ActionSpace, APPROVED_ACTIONS

class ActionModelParams:
    def __init__(self, dimension: int, lambda_prior: float = 1.0):
        self.dimension = dimension
        self.lambda_prior = lambda_prior
        # A matrix = X^T X + lambda * I
        self.A = np.eye(dimension, dtype=np.float64) * lambda_prior
        # b vector = X^T y
        self.b = np.zeros(dimension, dtype=np.float64)
        self.observations_count = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "A": self.A.tolist(),
            "b": self.b.tolist(),
            "observations_count": self.observations_count,
            "dimension": self.dimension,
            "lambda_prior": self.lambda_prior,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ActionModelParams":
        instance = cls(dimension=data["dimension"], lambda_prior=data["lambda_prior"])
        instance.A = np.array(data["A"], dtype=np.float64)
        instance.b = np.array(data["b"], dtype=np.float64)
        instance.observations_count = data.get("observations_count", 0)
        return instance

class ContextualThompsonSampling(AbstractBandit):
    """
    Contextual Thompson Sampling with Bayesian Linear Regression.
    Maintains A_a and b_a for each action.
    Samples theta_a ~ N(A_a^{-1} b_a, v^2 A_a^{-1})
    """
    
    def __init__(
        self,
        dimension: int = 28,
        lambda_prior: float = 1.0,
        exploration_variance: float = 0.25,
        actions: Optional[List[str]] = None,
    ):
        self.dimension = dimension
        self.lambda_prior = lambda_prior
        self.v2 = exploration_variance
        self.action_ids = actions or ActionSpace.get_all_action_ids()
        
        self.action_models: Dict[str, ActionModelParams] = {
            a: ActionModelParams(dimension, lambda_prior) for a in self.action_ids
        }

    def select_action(
        self,
        context_vector: np.ndarray,
        candidate_actions: List[str],
        random_seed: Optional[int] = None,
    ) -> Tuple[str, str, str, Dict[str, float], float, float]:
        if random_seed is not None:
            rng = np.random.default_rng(random_seed)
        else:
            rng = np.random.default_rng()

        x = np.nan_to_num(context_vector, nan=0.0, posinf=1.0, neginf=-1.0)
        
        sampled_scores: Dict[str, float] = {}
        expected_scores: Dict[str, float] = {}
        action_variances: Dict[str, float] = {}

        for action_id in candidate_actions:
            if action_id not in self.action_models:
                self.action_models[action_id] = ActionModelParams(self.dimension, self.lambda_prior)
                
            model = self.action_models[action_id]
            
            # Robust matrix inversion with diagonal stabilization
            try:
                A_inv = np.linalg.inv(model.A)
            except np.linalg.LinAlgError:
                A_inv = np.linalg.pinv(model.A + np.eye(self.dimension) * 1e-4)

            # Posterior Mean: theta_hat = A^{-1} b
            theta_hat = A_inv @ model.b
            expected_score = float(x @ theta_hat)
            expected_scores[action_id] = expected_score

            # Covariance for action: sigma2 = v^2 * x^T A^{-1} x
            cov_matrix = self.v2 * A_inv
            action_variance = max(float(x @ cov_matrix @ x), 1e-6)
            action_variances[action_id] = action_variance

            # Thompson Sampling: sample theta ~ N(theta_hat, cov_matrix)
            try:
                # Symmetrize covariance matrix
                cov_sym = 0.5 * (cov_matrix + cov_matrix.T) + np.eye(self.dimension) * 1e-6
                sampled_theta = rng.multivariate_normal(theta_hat, cov_sym)
            except Exception:
                # Fallback to independent diagonal sampling if covariance is ill-conditioned
                std_diag = np.sqrt(np.maximum(np.diag(cov_matrix), 1e-6))
                sampled_theta = rng.normal(theta_hat, std_diag)

            sampled_score = float(x @ sampled_theta)
            sampled_scores[action_id] = round(sampled_score, 4)

        # 1. Best expected action (Exploitation choice)
        best_expected_action = max(candidate_actions, key=lambda a: expected_scores[a])

        # 2. Selected action (Thompson sample choice)
        selected_action = max(candidate_actions, key=lambda a: sampled_scores[a])

        # 3. Selection Mode
        selection_mode = "EXPLOIT" if selected_action == best_expected_action else "EXPLORE"

        # 4. Approximate exploration probability
        # Higher total variance -> higher probability of exploration
        avg_var = float(np.mean(list(action_variances.values())))
        exploration_prob = round(float(np.clip(avg_var / (avg_var + 1.0), 0.05, 0.40)), 4)

        expected_reward = round(expected_scores[selected_action], 4)

        return (
            selected_action,
            best_expected_action,
            selection_mode,
            sampled_scores,
            expected_reward,
            exploration_prob,
        )

    def update(
        self,
        action: str,
        context_vector: np.ndarray,
        reward: float,
    ) -> None:
        if action not in self.action_models:
            self.action_models[action] = ActionModelParams(self.dimension, self.lambda_prior)
            
        x = np.nan_to_num(context_vector, nan=0.0, posinf=1.0, neginf=-1.0).reshape(-1, 1)
        r = float(reward)

        model = self.action_models[action]
        # Bayesian update: A = A + x x^T
        model.A += x @ x.T
        # b = b + r * x
        model.b += (r * x).flatten()
        model.observations_count += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimension": self.dimension,
            "lambda_prior": self.lambda_prior,
            "exploration_variance": self.v2,
            "action_models": {k: v.to_dict() for k, v in self.action_models.items()},
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ContextualThompsonSampling":
        instance = cls(
            dimension=data["dimension"],
            lambda_prior=data["lambda_prior"],
            exploration_variance=data["exploration_variance"],
        )
        instance.action_models = {
            k: ActionModelParams.from_dict(v) for k, v in data["action_models"].items()
        }
        return instance
