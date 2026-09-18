import asyncio
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Query, status
from pydantic import BaseModel

app = FastAPI(
    title="Mock Payment Gateway Service",
    version="1.0.0",
    description="Simulates external inter-bank clearing network (e.g. Faster Payments / BACS)",
)

# In-memory outage simulator for resilience testing
simulation_state = {
    "outage_enabled": False,
    "latency_seconds": 0.0,
}


class PaymentClearanceRequest(BaseModel):
    reference: str
    amount: int
    currency: str
    destination_account: str


class ClearanceResponse(BaseModel):
    status: str
    clearance_id: str
    original_reference: str
    amount: int
    currency: str
    cleared_at: str


@app.get("/health")
async def health():
    return {
        "status": "up" if not simulation_state["outage_enabled"] else "outage",
        "service": "mock-payment-gateway",
    }


@app.post("/simulate/outage")
async def toggle_outage(enable: bool = Query(...), latency: float = Query(0.0)):
    simulation_state["outage_enabled"] = enable
    simulation_state["latency_seconds"] = latency
    return {"message": "Simulation updated", "state": simulation_state}


@app.post("/payments/clear", response_model=ClearanceResponse, status_code=status.HTTP_200_OK)
async def clear_payment(
    payment: PaymentClearanceRequest,
    x_simulate_failure: Optional[str] = Header(None),
):
    if simulation_state["latency_seconds"] > 0:
        await asyncio.sleep(simulation_state["latency_seconds"])

    if simulation_state["outage_enabled"] or x_simulate_failure == "true":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="External clearing network unavailable or connection timed out",
        )

    return ClearanceResponse(
        status="CLEARED",
        clearance_id=f"CLR-{uuid.uuid4().hex[:10].upper()}",
        original_reference=payment.reference,
        amount=payment.amount,
        currency=payment.currency,
        cleared_at=datetime.now(timezone.utc).isoformat(),
    )
