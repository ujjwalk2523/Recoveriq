from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from .schemas.decision import DecisionRequest, DecisionResponse
from .schemas.outcome import OutcomeRequest, OutcomeResponse
from .services.bandit_service import BanditService
from .config import config

app = FastAPI(
    title=config.service_name,
    version=config.service_version,
    description="Production Contextual Bandit Learning Service for RecoverIQ Autonomous Revenue Recovery",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "service": config.service_name,
        "status": "RUNNING",
        "docs": "/docs",
        "health": "/v1/bandit/health",
    }

@app.get("/v1/bandit/health")
def get_health():
    return BanditService.get_health()

@app.get("/v1/bandit/model")
def get_model(merchant_id: str = "global"):
    return BanditService.get_model_info(merchant_id)

@app.post("/v1/bandit/decide", response_model=DecisionResponse)
def decide(request: DecisionRequest):
    try:
        return BanditService.decide(request)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bandit inference error: {str(e)}",
        )

@app.post("/v1/bandit/outcome", response_model=OutcomeResponse)
def record_outcome(request: OutcomeRequest):
    try:
        return BanditService.record_outcome(request)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Bandit outcome update error: {str(e)}",
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=config.host, port=config.port, reload=True)
