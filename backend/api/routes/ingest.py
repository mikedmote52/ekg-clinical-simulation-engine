"""
Ingest API route.

POST /api/ingest — Accept ECG file upload, digitize, return preview.
POST /api/interpret — Accept session_id, run full pipeline.
GET  /api/session/{session_id}/overlay — Return debug overlay image.
"""

from __future__ import annotations

import io
import logging
import uuid

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image

from agents.orchestrator import Orchestrator
from digitizer.preprocessor import preprocess
from digitizer.waveform_extractor import extract_all_leads
from models.schemas import LeadDigitizationConfidence, VisualizationParameterJSON

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["ingest"])

# In-memory session store (replaced by Redis in production via session_store module)
# Import will fallback to this dict if Redis is unavailable
_sessions: dict[str, dict] = {}

orchestrator = Orchestrator()


def _get_session_store():
    """Get the session store (Redis or in-memory fallback)."""
    try:
        from api.session_store import session_store
        return session_store
    except ImportError:
        return None


def _save_session(session_id: str, data: dict):
    """Save session data."""
    store = _get_session_store()
    if store:
        store.save(session_id, data)
    else:
        _sessions[session_id] = data


def _load_session(session_id: str) -> dict | None:
    """Load session data."""
    store = _get_session_store()
    if store:
        return store.load(session_id)
    return _sessions.get(session_id)


# ---------------------------------------------------------------------------
# POST /api/ingest
# ---------------------------------------------------------------------------

@router.post("/ingest")
async def ingest_ecg(file: UploadFile = File(...)):
    """
    Upload an ECG image or PDF for digitization.

    Returns session_id, per-lead confidence, and readiness status.
    """
    session_id = str(uuid.uuid4())

    # Validate file type
    content_type = file.content_type or ""
    filename = file.filename or ""
    is_pdf = "pdf" in content_type.lower() or filename.lower().endswith(".pdf")
    is_image = any(
        ext in content_type.lower() or filename.lower().endswith(ext)
        for ext in ["image", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"]
    )

    if not is_pdf and not is_image:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a PDF or image (PNG, JPG, TIFF, BMP).",
        )

    # Read file
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        # Preprocess
        if is_pdf:
            gray, debug_overlay, grid, preprocessed = preprocess(
                source=file_bytes, session_id=session_id, is_pdf=True
            )
        else:
            pil_image = Image.open(io.BytesIO(file_bytes))
            gray, debug_overlay, grid, preprocessed = preprocess(
                source=pil_image, session_id=session_id, is_pdf=False
            )

        # Extract waveforms
        digitized = extract_all_leads(
            gray=gray, grid=grid, session_id=session_id
        )

        # Store in session for later interpretation
        _save_session(session_id, {
            "file_bytes": file_bytes,
            "is_pdf": is_pdf,
            "gray": gray,
            "debug_overlay": debug_overlay,
            "grid": grid,
            "digitized": digitized,
        })

        # Build response
        per_lead_confidence = [
            {
                "lead_name": lc.lead_name,
                "confidence": lc.confidence,
                "failure_reason": lc.failure_reason,
            }
            for lc in digitized.metadata.digitization_confidence
        ]

        return {
            "session_id": session_id,
            "digitization_preview_image_url": f"/api/session/{session_id}/overlay",
            "per_lead_confidence": per_lead_confidence,
            "warnings": preprocessed.warnings + digitized.warnings,
            "ready_for_interpretation": digitized.ready_for_interpretation,
            "metadata": {
                "paper_speed": grid.paper_speed_mm_per_s,
                "amplitude_scale": grid.amplitude_scale_mm_per_mv,
                "grid_small_square_px": grid.small_square_px,
                "calibration_detected": grid.calibration_pulse_detected,
                "is_stitched": digitized.is_stitched,
                "lead_count": len(digitized.leads),
            },
        }

    except Exception as e:
        logger.error(f"Ingest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Digitization failed: {str(e)}")


# ---------------------------------------------------------------------------
# POST /api/interpret
# ---------------------------------------------------------------------------

@router.post("/interpret")
async def interpret_ecg(payload: dict):
    """
    Run full interpretation pipeline on a previously ingested ECG.

    Accepts: { "session_id": "..." }
    Returns: Full VisualizationParameterJSON
    """
    session_id = payload.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    session = _load_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found. Upload an ECG first via /api/ingest.",
        )

    try:
        # Re-open the image for the orchestrator
        file_bytes = session.get("file_bytes")
        is_pdf = session.get("is_pdf", False)

        if is_pdf:
            result = orchestrator.run(
                pdf_bytes=file_bytes, session_id=session_id
            )
        else:
            pil_image = Image.open(io.BytesIO(file_bytes))
            result = orchestrator.run(
                image=pil_image, session_id=session_id
            )

        # Update session with full result
        session["result"] = result
        _save_session(session_id, session)

        return result.visualization.model_dump()

    except Exception as e:
        logger.error(f"Interpretation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Interpretation pipeline failed: {str(e)}",
        )


# ---------------------------------------------------------------------------
# GET /api/session/{session_id}/overlay
# ---------------------------------------------------------------------------

@router.get("/session/{session_id}/overlay")
async def get_overlay(session_id: str):
    """Return the debug overlay image for a session."""
    session = _load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    debug_overlay = session.get("debug_overlay")
    if debug_overlay is None:
        raise HTTPException(status_code=404, detail="No debug overlay available")

    # Encode as PNG
    success, buffer = cv2.imencode(".png", debug_overlay)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode overlay image")

    return StreamingResponse(
        io.BytesIO(buffer.tobytes()),
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=overlay_{session_id}.png"},
    )
