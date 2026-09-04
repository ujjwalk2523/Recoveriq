import numpy as np
from app.bandits.contextual_thompson import ContextualThompsonSampling

def test_deterministic_seed():
    bandit = ContextualThompsonSampling(dimension=4, lambda_prior=1.0)
    x = np.array([1.0, 0.5, 0.2, 0.1])
    candidates = ["IMMEDIATE_RETRY", "OPTIMAL_DELAYED_RETRY", "PAYMENT_LINK"]

    res1 = bandit.select_action(x, candidates, random_seed=123)
    res2 = bandit.select_action(x, candidates, random_seed=123)

    assert res1[0] == res2[0] # Same selected action
    assert res1[3] == res2[3] # Same action scores

def test_bayesian_learning_convergence():
    bandit = ContextualThompsonSampling(dimension=4, lambda_prior=1.0)
    x = np.array([1.0, 0.8, 0.1, 0.0])
    candidates = ["IMMEDIATE_RETRY", "PAYMENT_LINK"]

    # Provide 20 positive rewards for IMMEDIATE_RETRY and negative for PAYMENT_LINK
    for _ in range(20):
        bandit.update("IMMEDIATE_RETRY", x, 1.0)
        bandit.update("PAYMENT_LINK", x, -1.0)

    # Exploitation should now strongly favor IMMEDIATE_RETRY
    res = bandit.select_action(x, candidates, random_seed=42)
    assert res[1] == "IMMEDIATE_RETRY" # best_expected_action
    assert res[3]["IMMEDIATE_RETRY"] > res[3]["PAYMENT_LINK"]
