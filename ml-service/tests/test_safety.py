import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.storage.bandit_state import state_store

client = TestClient(app)

@pytest.fixture(autouse=True)
def cleanup_state():
    state_store.reset_state()
    yield
    state_store.reset_state()

def test_idempotent_duplicate_outcomes():
    payload = {
        "bandit_decision_id": "dec_idempotency_test_01",
        "merchant_id": "mer_safe_01",
        "transaction_id": "txn_safe_01",
        "selected_action": "PAYMENT_LINK",
        "recovered_amount": 5000.0,
        "recovery_cost": 8.0,
        "experience_penalty": 10.0,
        "risk_penalty": 0.0,
        "outcome": "RECOVERED",
    }
    # First attempt
    res1 = client.post("/v1/bandit/outcome", json=payload)
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["status"] == "LEARNED"
    assert d1["is_idempotent_duplicate"] is False
    assert d1["total_action_observations"] == 1

    # Duplicate attempt with identical key
    res2 = client.post("/v1/bandit/outcome", json=payload)
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["status"] == "ALREADY_PROCESSED"
    assert d2["is_idempotent_duplicate"] is True

def test_merchant_isolation():
    # Merchant A gets 10 successful outcomes on IMMEDIATE_RETRY
    for i in range(10):
        client.post("/v1/bandit/outcome", json={
            "bandit_decision_id": f"dec_merA_{i}",
            "merchant_id": "mer_A",
            "transaction_id": f"txn_A_{i}",
            "selected_action": "IMMEDIATE_RETRY",
            "recovered_amount": 3000.0,
            "outcome": "RECOVERED",
        })

    bandit_A = state_store.get_bandit("mer_A")
    bandit_B = state_store.get_bandit("mer_B")

    # Merchant A should have 10 observations on IMMEDIATE_RETRY
    assert bandit_A.action_models["IMMEDIATE_RETRY"].observations_count == 10
    # Merchant B should have 0 observations (strict isolation)
    assert bandit_B.action_models["IMMEDIATE_RETRY"].observations_count == 0
