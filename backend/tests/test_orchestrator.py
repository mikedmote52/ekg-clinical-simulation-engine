"""
Tests for the pipeline orchestrator.
"""

import numpy as np
import pytest
from PIL import Image

from agents.orchestrator import Orchestrator


@pytest.fixture
def orchestrator():
    return Orchestrator()


@pytest.fixture
def synthetic_ecg_image():
    """Create a simple synthetic ECG-like image for testing."""
    # Create a white image with some dark lines (simulating ECG traces)
    width, height = 800, 400
    img_array = np.ones((height, width, 3), dtype=np.uint8) * 255

    # Draw horizontal grid lines (light red)
    for y in range(0, height, 20):
        img_array[y, :] = [200, 200, 240]

    # Draw vertical grid lines
    for x in range(0, width, 20):
        img_array[:, x] = [200, 200, 240]

    # Draw a simple waveform in each lead region
    row_height = height // 3
    col_width = width // 4

    for row in range(3):
        for col in range(4):
            x_start = col * col_width + 10
            y_center = row * row_height + row_height // 2

            for x in range(x_start, x_start + col_width - 20):
                # Simple sine-like waveform with QRS spikes
                t = (x - x_start) / (col_width - 20) * 4 * np.pi
                y = int(y_center - 30 * np.sin(t) * np.exp(-((t % (2 * np.pi) - np.pi) ** 2) / 0.5))
                y = max(0, min(height - 1, y))
                img_array[y, x] = [0, 0, 0]

    return Image.fromarray(img_array)


class TestOrchestrator:
    def test_always_returns_visualization(self, orchestrator, synthetic_ecg_image):
        """Pipeline must always return a VisualizationParameterJSON."""
        result = orchestrator.run(image=synthetic_ecg_image, session_id="test-1")
        assert result.visualization is not None
        assert result.visualization.session_id == "test-1"

    def test_handles_no_input(self, orchestrator):
        """Pipeline should handle no image gracefully."""
        result = orchestrator.run(session_id="test-empty")
        assert result.visualization is not None
        assert result.visualization.pipeline_degraded is True
        assert len(result.visualization.pipeline_warnings) > 0

    def test_records_timings(self, orchestrator, synthetic_ecg_image):
        """Pipeline should record per-agent timing."""
        result = orchestrator.run(image=synthetic_ecg_image, session_id="test-timing")
        assert "ecg_specialist" in result.agent_timings
        assert result.agent_timings["ecg_specialist"] > 0

    def test_fallback_on_failure(self, orchestrator):
        """Pipeline should produce fallback output when all agents fail."""
        result = orchestrator.run(session_id="test-fail")
        viz = result.visualization
        assert viz.pipeline_degraded is True
        assert viz.mechanical_archetype == "normal_sinus"
