# RecoverIQ Contextual Bandit Service (Phase 6.7)

Production contextual bandit optimization service for RecoverIQ's autonomous payment recovery platform.

## Architecture
- **Algorithm**: Contextual Thompson Sampling with Bayesian Linear Regression
- **Action Space**: 7 Approved RecoverIQ Recovery Strategies
- **Reward Function**: Net Financial Surplus ($\text{Revenue} - \text{Cost} - \text{Fatigue} - \text{Risk}$)
- **Tenancy**: Merchant-scoped isolated posterior models
- **Framework**: FastAPI, Pydantic, NumPy

## API Endpoints
- `POST /v1/bandit/decide`: Selects optimal recovery action given 28-dimension decision-time context.
- `POST /v1/bandit/outcome`: Ingests payment outcome and updates posterior model parameters.
- `GET /v1/bandit/health`: Returns model telemetry, active action count, and total observations.

## Development & Testing
```bash
# Run Unit Tests
pytest tests/

# Run 10,000-sample Offline Simulation
python run_simulation.py 10000
```
