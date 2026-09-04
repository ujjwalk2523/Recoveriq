from app.rewards.reward_calculator import RewardCalculator

def test_successful_net_reward_calculation():
    # Transaction amount = 10,000, recovered = 10,000, cost = 20, exp = 100, risk = 50
    breakdown = RewardCalculator.calculate_reward(
        recovered_amount=10000.0,
        recovery_cost=20.0,
        experience_penalty=100.0,
        risk_penalty=50.0,
        reference_amount=10000.0,
    )
    assert breakdown.raw_reward == 9830.0
    assert 0.95 <= breakdown.normalized_reward <= 1.0

def test_failed_recovery_penalties():
    # Transaction failed: recovered = 0, cost = 10, exp = 30, risk = 20
    breakdown = RewardCalculator.calculate_reward(
        recovered_amount=0.0,
        recovery_cost=10.0,
        experience_penalty=30.0,
        risk_penalty=20.0,
        reference_amount=2000.0,
    )
    assert breakdown.raw_reward == -60.0
    assert breakdown.normalized_reward < 0.0
