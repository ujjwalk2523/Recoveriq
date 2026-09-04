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

def test_decide_endpoint_and_action_space():
    payload = {
        "merchant_id": "mer_test_01",
        "transaction_id": "txn_decide_test_01",
        "context": {
            "amount": 2500.0,
            "payment_method": "UPI",
            "failure_category": "TECHNICAL",
            "failure_code": "NPCI_TIMEOUT",
            "hour": 15,
            "day_of_week": 2,
            "time_since_last_payment_minutes": 10.0,
            "customer_transaction_count": 5,
            "customer_success_rate": 0.90,
            "customer_recovery_rate": 0.80,
            "upi_success_rate": 0.88,
            "card_success_rate": 0.80,
            "avg_recovery_delay_minutes": 15.0,
            "previous_retry_count": 0,
            "previous_recovery_count": 1,
            "fatigue_score": 10.0,
            "risk_score": 5.0,
            "merchant_recovery_rate": 0.75,
            "phase6_2_recovery_probability": 0.85,
        },
        "candidate_actions": ["IMMEDIATE_RETRY", "OPTIMAL_DELAYED_RETRY", "PAYMENT_LINK"],
    }
    response = client.post("/v1/bandit/decide", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["selected_action"] in payload["candidate_actions"]
    assert data["selection_mode"] in ("EXPLOIT", "EXPLORE")
    assert data["algorithm"] == "CONTEXTUAL_THOMPSON_SAMPLING"
    assert "confidence" in data
    assert data["merchant_scope"] == "MERCHANT"

def test_get_model_endpoint():
    response = client.get("/v1/bandit/model?merchant_id=mer_model_test")
    assert response.status_code == 200
    data = response.json()
    assert data["model_version"] == "bandit-v1.0"
    assert data["algorithm"] == "CONTEXTUAL_THOMPSON_SAMPLING"
    assert "actions" in data
    assert "IMMEDIATE_RETRY" in data["actions"]
    assert "PAYMENT_LINK" in data["actions"]

def test_invalid_candidate_action_rejected():
    payload = {
        "merchant_id": "mer_test_01",
        "transaction_id": "txn_invalid_act",
        "context": {
            "amount": 1000.0,
            "payment_method": "UPI",
            "failure_category": "TECHNICAL",
            "failure_code": "ERR_01",
            "hour": 12,
            "day_of_week": 1,
        },
        "candidate_actions": ["NON_EXISTENT_ACTION_FOO"],
    }
    response = client.post("/v1/bandit/decide", json=payload)
    assert response.status_code == 400
