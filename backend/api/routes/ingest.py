"""
API routes matching the frontend contract.

Frontend expects:
  POST /api/ingest                       → { session_id }
  GET  /api/session/{id}                 → { digitization, viz_params? }
  POST /api/session/{id}/interpret       → VisualizationParameterJSON
  GET  /api/session/{id}/overlay         → image/png
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
from api.routes.frontend_adapter import adapt_to_frontend_viz_params
from digitizer.preprocessor import preprocess
from digitizer.waveform_extractor import extract_all_leads

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["ingest"])

# ---------------------------------------------------------------------------
# Session store
# ---------------------------------------------------------------------------

_sessions: dict[str, dict] = {}

orchestrator = Orchestrator()


def _get_session_store():
    try:
        from api.session_store import session_store
        return session_store
    except ImportError:
        return None


def _save_session(session_id: str, data: dict):
    store = _get_session_store()
    if store:
        store.save(session_id, data)
    else:
        _sessions[session_id] = data


def _load_session(session_id: str) -> dict | None:
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
    Returns: { session_id }
    """
    session_id = str(uuid.uuid4())

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

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        if is_pdf:
            gray, debug_overlay, grid, preprocessed, corrected_bgr = preprocess(
                source=file_bytes, session_id=session_id, is_pdf=True
            )
        else:
            pil_image = Image.open(io.BytesIO(file_bytes))
            gray, debug_overlay, grid, preprocessed, corrected_bgr = preprocess(
                source=pil_image, session_id=session_id, is_pdf=False
            )

        # Pass BGR image for color-aware grid removal
        digitized = extract_all_leads(
            gray=gray, grid=grid, session_id=session_id, bgr_image=corrected_bgr
        )

        _save_session(session_id, {
            "file_bytes": file_bytes,
            "is_pdf": is_pdf,
            "gray": gray,
            "debug_overlay": debug_overlay,
            "grid": grid,
            "digitized": digitized,
            "warnings": preprocessed.warnings + digitized.warnings,
            "ready_for_interpretation": digitized.ready_for_interpretation,
        })

        return {"session_id": session_id}

    except Exception as e:
        logger.error(f"Ingest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Digitization failed: {str(e)}")


# ---------------------------------------------------------------------------
# GET /api/session/{session_id}
# ---------------------------------------------------------------------------

@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """
    Return digitization result for a session.
    Matches frontend DigitizationResult type.
    """
    session = _load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    digitized = session.get("digitized")

    # Build per-lead confidence matching frontend's PerLeadConfidence
    per_lead_confidence = []
    if digitized:
        for lc in digitized.metadata.digitization_confidence:
            per_lead_confidence.append({
                "lead_id": lc.lead_name,
                "confidence": lc.confidence,
            })

    digitization = {
        "per_lead_confidence": per_lead_confidence,
        "warnings": session.get("warnings", []),
        "overlay_image_url": f"/api/session/{session_id}/overlay",
        "ready_for_interpretation": session.get("ready_for_interpretation", False),
    }

    response: dict = {"digitization": digitization}

    # Include viz_params if interpretation already ran
    if "viz_params" in session:
        response["viz_params"] = session["viz_params"]

    return response


# ---------------------------------------------------------------------------
# POST /api/session/{session_id}/interpret
# ---------------------------------------------------------------------------

@router.post("/session/{session_id}/interpret")
async def interpret_ecg(session_id: str):
    """
    Run the full interpretation pipeline.
    Returns VisualizationParameterJSON matching the frontend TypeScript interface.
    """
    session = _load_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} not found. Upload an ECG first via /api/ingest.",
        )

    try:
        file_bytes = session.get("file_bytes")
        is_pdf = session.get("is_pdf", False)

        if is_pdf:
            result = orchestrator.run(pdf_bytes=file_bytes, session_id=session_id)
        else:
            pil_image = Image.open(io.BytesIO(file_bytes))
            result = orchestrator.run(image=pil_image, session_id=session_id)

        # Adapt the internal schema to match the frontend's VisualizationParameterJSON
        frontend_viz = adapt_to_frontend_viz_params(result)

        # Cache in session
        session["result"] = result
        session["viz_params"] = frontend_viz
        _save_session(session_id, session)

        return frontend_viz

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
    """Return the debug overlay image as PNG."""
    session = _load_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    debug_overlay = session.get("debug_overlay")
    if debug_overlay is None:
        raise HTTPException(status_code=404, detail="No debug overlay available")

    success, buffer = cv2.imencode(".png", debug_overlay)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode overlay image")

    return StreamingResponse(
        io.BytesIO(buffer.tobytes()),
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename=overlay_{session_id}.png"},
    )
