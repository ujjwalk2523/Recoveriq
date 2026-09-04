import os
from pydantic import BaseModel

class BanditConfig(BaseModel):
    service_name: str = "RecoverIQ Contextual Bandit Service"
    service_version: str = "1.0.0"
    model_version: str = "bandit-v1.0"
    algorithm: str = "CONTEXTUAL_THOMPSON_SAMPLING"
    host: str = os.getenv("BANDIT_HOST", "127.0.0.1")
    port: int = int(os.getenv("BANDIT_PORT", "8001"))
    
    # Bayesian Linear Regression Hyperparameters
    lambda_prior: float = 1.0  # L2 regularizer parameter for precision matrix A = X^T X + lambda * I
    exploration_variance: float = 0.25  # v^2 for posterior sampling variance
    
    # Storage
    state_dir: str = os.getenv("BANDIT_STATE_DIR", os.path.join(os.path.dirname(__file__), "..", "data", "state"))

config = BanditConfig()
