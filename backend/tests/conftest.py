"""
Shared test fixtures and helpers.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

# Ensure project root is on path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from models.schemas import LeadTimeseries, MeasurementValue, Measurements


@pytest.fixture
def sample_sinus_rhythm_leads() -> list[LeadTimeseries]:
    """
    Generate synthetic 12-lead ECG data resembling normal sinus rhythm.

    Creates a 10-second strip at 500 Hz with synthetic QRS complexes.
    """
    fs = 500.0
    duration = 10.0  # seconds
    n_samples = int(fs * duration)
    t = np.linspace(0, duration * 1000, n_samples)  # time in ms

    leads = []
    lead_names = ["I", "II", "III", "aVR", "aVL", "aVF",
                  "V1", "V2", "V3", "V4", "V5", "V6"]

    # Amplitude multipliers per lead (approximate)
    lead_amplitudes = {
        "I": 0.8, "II": 1.0, "III": 0.5, "aVR": -0.6, "aVL": 0.3, "aVF": 0.7,
        "V1": -0.5, "V2": 0.3, "V3": 0.8, "V4": 1.2, "V5": 1.0, "V6": 0.7,
    }

    heart_rate = 72  # bpm
    beat_interval_ms = 60000 / heart_rate
    beat_times = np.arange(0, duration * 1000, beat_interval_ms)

    for lead_name in lead_names:
        amp_scale = lead_amplitudes.get(lead_name, 1.0)
        signal = np.zeros(n_samples)

        for beat_time in beat_times:
            # P wave: small gaussian 150ms before R
            p_center = beat_time - 150
            p_idx = np.argmin(np.abs(t - p_center))
            p_wave = 0.15 * amp_scale * np.exp(-0.5 * ((t - p_center) / 30) ** 2)

            # QRS complex: sharp peak
            qrs_center = beat_time
            qrs_idx = np.argmin(np.abs(t - qrs_center))
            # R wave
            r_wave = 1.0 * amp_scale * np.exp(-0.5 * ((t - qrs_center) / 10) ** 2)
            # Q wave (small negative before R)
            q_center = beat_time - 20
            q_wave = -0.1 * abs(amp_scale) * np.exp(-0.5 * ((t - q_center) / 8) ** 2)
            # S wave (small negative after R)
            s_center = beat_time + 20
            s_wave = -0.15 * abs(amp_scale) * np.exp(-0.5 * ((t - s_center) / 8) ** 2)

            # T wave: medium gaussian 250ms after R
            t_center = beat_time + 250
            t_wave = 0.3 * amp_scale * np.exp(-0.5 * ((t - t_center) / 50) ** 2)

            signal += p_wave + q_wave + r_wave + s_wave + t_wave

        # Add small noise
        signal += np.random.normal(0, 0.01, n_samples)

        leads.append(LeadTimeseries(
            lead_name=lead_name,
            time_ms=t.tolist(),
            amplitude_mv=signal.tolist(),
            sample_rate_hz=fs,
            confidence=0.9,
        ))

    return leads


@pytest.fixture
def sample_tachycardia_leads() -> list[LeadTimeseries]:
    """Generate synthetic leads with sinus tachycardia (rate ~120 bpm)."""
    fs = 500.0
    duration = 10.0
    n_samples = int(fs * duration)
    t = np.linspace(0, duration * 1000, n_samples)

    heart_rate = 120
    beat_interval_ms = 60000 / heart_rate
    beat_times = np.arange(0, duration * 1000, beat_interval_ms)

    leads = []
    for lead_name in ["I", "II", "III", "aVR", "aVL", "aVF",
                      "V1", "V2", "V3", "V4", "V5", "V6"]:
        signal = np.zeros(n_samples)
        amp = 1.0 if lead_name == "II" else 0.7

        for beat_time in beat_times:
            # P wave
            signal += 0.15 * amp * np.exp(-0.5 * ((t - (beat_time - 120)) / 25) ** 2)
            # QRS
            signal += 1.0 * amp * np.exp(-0.5 * ((t - beat_time) / 10) ** 2)
            # T wave
            signal += 0.25 * amp * np.exp(-0.5 * ((t - (beat_time + 200)) / 40) ** 2)

        signal += np.random.normal(0, 0.01, n_samples)

        leads.append(LeadTimeseries(
            lead_name=lead_name,
            time_ms=t.tolist(),
            amplitude_mv=signal.tolist(),
            sample_rate_hz=fs,
            confidence=0.9,
        ))

    return leads


@pytest.fixture
def sample_bradycardia_leads() -> list[LeadTimeseries]:
    """Generate synthetic leads with sinus bradycardia (rate ~50 bpm)."""
    fs = 500.0
    duration = 10.0
    n_samples = int(fs * duration)
    t = np.linspace(0, duration * 1000, n_samples)

    heart_rate = 50
    beat_interval_ms = 60000 / heart_rate
    beat_times = np.arange(0, duration * 1000, beat_interval_ms)

    leads = []
    for lead_name in ["I", "II", "III", "aVR", "aVL", "aVF",
                      "V1", "V2", "V3", "V4", "V5", "V6"]:
        signal = np.zeros(n_samples)
        amp = 1.0 if lead_name == "II" else 0.7

        for beat_time in beat_times:
            signal += 0.15 * amp * np.exp(-0.5 * ((t - (beat_time - 160)) / 35) ** 2)
            signal += 1.0 * amp * np.exp(-0.5 * ((t - beat_time) / 10) ** 2)
            signal += 0.3 * amp * np.exp(-0.5 * ((t - (beat_time + 280)) / 55) ** 2)

        signal += np.random.normal(0, 0.01, n_samples)

        leads.append(LeadTimeseries(
            lead_name=lead_name,
            time_ms=t.tolist(),
            amplitude_mv=signal.tolist(),
            sample_rate_hz=fs,
            confidence=0.9,
        ))

    return leads
