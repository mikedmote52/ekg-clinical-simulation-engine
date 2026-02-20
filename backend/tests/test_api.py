"""
Tests for API routes.
"""

import io

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from api.main import app

client = TestClient(app)


def _create_test_image_bytes() -> bytes:
    """Create a simple test image as PNG bytes."""
    img = np.ones((400, 800, 3), dtype=np.uint8) * 255
    # Add some grid lines
    for y in range(0, 400, 20):
        img[y, :] = [200, 200, 240]
    for x in range(0, 800, 20):
        img[:, x] = [200, 200, 240]
    # Add a simple trace
    for x in range(50, 750):
        y = int(200 + 50 * np.sin(x / 30.0))
        img[y, x] = [0, 0, 0]

    pil_img = Image.fromarray(img)
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


class TestRootEndpoint:
    def test_root(self):
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "service" in data
        assert data["service"] == "ECG Heart Interpreter"


class TestHealthEndpoint:
    def test_health(self):
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["archetypes_loaded"] >= 10


class TestArchetypesEndpoint:
    def test_list_archetypes(self):
        response = client.get("/api/archetypes")
        assert response.status_code == 200
        data = response.json()
        assert "archetypes" in data
        assert len(data["archetypes"]) >= 10

    def test_get_archetype_detail(self):
        response = client.get("/api/archetypes/normal_sinus")
        assert response.status_code == 200
        data = response.json()
        assert data["archetype_id"] == "normal_sinus"
        assert "activation_sequence" in data
        assert "teaching_note" in data

    def test_get_nonexistent_archetype(self):
        response = client.get("/api/archetypes/nonexistent")
        assert response.status_code == 404


class TestIngestEndpoint:
    def test_ingest_image(self):
        img_bytes = _create_test_image_bytes()
        response = client.post(
            "/api/ingest",
            files={"file": ("test_ecg.png", img_bytes, "image/png")},
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "per_lead_confidence" in data
        assert "warnings" in data
        assert "ready_for_interpretation" in data

    def test_ingest_empty_file(self):
        response = client.post(
            "/api/ingest",
            files={"file": ("empty.png", b"", "image/png")},
        )
        assert response.status_code == 400

    def test_ingest_unsupported_type(self):
        response = client.post(
            "/api/ingest",
            files={"file": ("test.xyz", b"data", "application/octet-stream")},
        )
        assert response.status_code == 400


class TestInterpretEndpoint:
    def test_interpret_after_ingest(self):
        # First ingest
        img_bytes = _create_test_image_bytes()
        ingest_response = client.post(
            "/api/ingest",
            files={"file": ("test_ecg.png", img_bytes, "image/png")},
        )
        assert ingest_response.status_code == 200
        session_id = ingest_response.json()["session_id"]

        # Then interpret
        interpret_response = client.post(
            "/api/interpret",
            json={"session_id": session_id},
        )
        assert interpret_response.status_code == 200
        data = interpret_response.json()
        assert "ecg_metadata" in data
        assert "measurements" in data
        assert "interpretation" in data
        assert "activation_sequence" in data
        assert "display_contract" in data

    def test_interpret_missing_session(self):
        response = client.post(
            "/api/interpret",
            json={"session_id": "nonexistent-session"},
        )
        assert response.status_code == 404

    def test_interpret_no_session_id(self):
        response = client.post("/api/interpret", json={})
        assert response.status_code == 400


class TestOverlayEndpoint:
    def test_get_overlay(self):
        # Ingest first
        img_bytes = _create_test_image_bytes()
        ingest_response = client.post(
            "/api/ingest",
            files={"file": ("test_ecg.png", img_bytes, "image/png")},
        )
        session_id = ingest_response.json()["session_id"]

        # Get overlay
        overlay_response = client.get(f"/api/session/{session_id}/overlay")
        assert overlay_response.status_code == 200
        assert overlay_response.headers["content-type"] == "image/png"

    def test_overlay_missing_session(self):
        response = client.get("/api/session/nonexistent/overlay")
        assert response.status_code == 404
