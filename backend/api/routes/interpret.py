"""
Interpret API route.

Provides additional interpretation endpoints beyond the main ingest flow.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from interpreter.classifier import classify
from interpreter.measurements import compute_all_measurements
from models.schemas import LeadTimeseries, Measurements

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["interpret"])


class DirectInterpretRequest(BaseModel):
    """Request body for direct interpretation from timeseries data."""
    leads: list[LeadTimeseries]


@router.post("/interpret/direct")
async def interpret_direct(request: DirectInterpretRequest):
    """
    Interpret pre-digitized ECG timeseries directly.

    Useful when the frontend has already digitized the signal
    (e.g., from a digital ECG device) and just needs interpretation.
    """
    if not request.leads:
        raise HTTPException(status_code=400, detail="No lead data provided")

    try:
        # Compute measurements
        measurements = compute_all_measurements(request.leads)

        # Classify
        classifier_output = classify(measurements)

        return {
            "measurements": measurements.model_dump(),
            "classification": {
                "primary_finding": classifier_output.primary_finding,
                "differentials": [d.model_dump() for d in classifier_output.differentials],
                "rhythm": classifier_output.rhythm,
                "conduction_abnormalities": classifier_output.conduction_abnormalities,
            },
        }

    except Exception as e:
        logger.error(f"Direct interpretation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Interpretation failed: {str(e)}",
        )
