"""
ECG Heart Interpreter — FastAPI Application.

Main entry point for the API server.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI

from api.middleware.cors import setup_cors
from api.routes.ingest import router as ingest_router
from api.routes.interpret import router as interpret_router
from api.routes.visualize import router as visualize_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="ECG Heart Interpreter",
    description=(
        "ECG digitization, interpretation, and 3D heart visualization parameter engine. "
        "Accepts ECG images or PDFs, extracts waveforms, computes measurements, "
        "classifies findings, and produces visualization parameters for a 3D heart model."
    ),
    version="0.1.0",
)

# Middleware
setup_cors(app)

# Routes
app.include_router(ingest_router)
app.include_router(interpret_router)
app.include_router(visualize_router)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "ECG Heart Interpreter",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": {
            "ingest": "POST /api/ingest",
            "interpret": "POST /api/interpret",
            "interpret_direct": "POST /api/interpret/direct",
            "overlay": "GET /api/session/{session_id}/overlay",
            "archetypes": "GET /api/archetypes",
            "health": "GET /api/health",
        },
    }
