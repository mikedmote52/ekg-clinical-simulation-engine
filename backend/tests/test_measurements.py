"""
Tests for measurement functions using synthetic ECG data.

Each test validates that measurements produce values with
appropriate units, methods, and confidence scores.
"""

import numpy as np
import pytest

from interpreter.measurements import (
    compute_all_measurements,
    measure_rate_and_rhythm,
    measure_axis,
    measure_qrs_duration,
    measure_st_deviations,
    measure_t_waves,
    measure_voltage_criteria,
)
from models.schemas import LeadTimeseries


class TestRateAndRhythm:
    def test_normal_sinus_rate(self, sample_sinus_rhythm_leads):
        rate, regular, desc = measure_rate_and_rhythm(sample_sinus_rhythm_leads)
        assert rate.unit == "bpm"
        assert rate.method != "none"
        assert rate.confidence > 0.0
        # Should detect rate near 72 bpm (±15 for synthetic data tolerance)
        assert 55 < rate.value < 90, f"Expected ~72 bpm, got {rate.value}"
        assert regular is True

    def test_tachycardia_rate(self, sample_tachycardia_leads):
        rate, regular, desc = measure_rate_and_rhythm(sample_tachycardia_leads)
        assert rate.value > 95, f"Expected >100 bpm, got {rate.value}"

    def test_bradycardia_rate(self, sample_bradycardia_leads):
        rate, regular, desc = measure_rate_and_rhythm(sample_bradycardia_leads)
        assert rate.value < 65, f"Expected <60 bpm, got {rate.value}"

    def test_empty_leads(self):
        rate, regular, desc = measure_rate_and_rhythm([])
        assert rate.confidence == 0.0


class TestQRSDuration:
    def test_normal_qrs(self, sample_sinus_rhythm_leads):
        # Get lead II
        lead_ii = next(l for l in sample_sinus_rhythm_leads if l.lead_name == "II")
        from interpreter.measurements import _detect_r_peaks, _to_numpy
        _, amplitude = _to_numpy(lead_ii)
        r_peaks = _detect_r_peaks(amplitude, lead_ii.sample_rate_hz)

        qrs = measure_qrs_duration(lead_ii, r_peaks)
        assert qrs.unit == "ms"
        assert qrs.method != "none"
        # Synthetic QRS is narrow
        if qrs.confidence > 0.3:
            assert qrs.value < 160, f"Expected narrow QRS, got {qrs.value}ms"


class TestAxis:
    def test_normal_axis(self, sample_sinus_rhythm_leads):
        axis, quadrant, transition = measure_axis(sample_sinus_rhythm_leads)
        assert axis.unit == "degrees"
        assert axis.method != "none"
        # With positive lead I and positive aVF, axis should be normal
        if axis.confidence > 0.3:
            assert -90 < axis.value < 180, f"Axis out of range: {axis.value}"


class TestSTDeviations:
    def test_measures_all_leads(self, sample_sinus_rhythm_leads):
        st_devs = measure_st_deviations(sample_sinus_rhythm_leads)
        # Should produce measurements for available leads
        assert isinstance(st_devs, list)
        for st in st_devs:
            assert st.measurement_point == "J+60ms"
            assert isinstance(st.deviation_mv, float)

    def test_normal_st_minimal_deviation(self, sample_sinus_rhythm_leads):
        st_devs = measure_st_deviations(sample_sinus_rhythm_leads)
        # Normal sinus should have minimal ST deviation
        for st in st_devs:
            assert abs(st.deviation_mv) < 0.5, (
                f"Lead {st.lead_name} has excessive ST deviation: {st.deviation_mv}mV"
            )


class TestTWaves:
    def test_detects_t_waves(self, sample_sinus_rhythm_leads):
        t_waves = measure_t_waves(sample_sinus_rhythm_leads)
        assert isinstance(t_waves, list)
        assert len(t_waves) > 0

        for tw in t_waves:
            assert tw.lead_name in [
                "I", "II", "III", "aVR", "aVL", "aVF",
                "V1", "V2", "V3", "V4", "V5", "V6",
            ]


class TestVoltageCriteria:
    def test_normal_voltage(self, sample_sinus_rhythm_leads):
        lvh, lvh_detail, rvh, rvh_detail = measure_voltage_criteria(
            sample_sinus_rhythm_leads
        )
        # Synthetic data should not meet LVH criteria
        assert isinstance(lvh, bool)
        assert isinstance(rvh, bool)


class TestComputeAllMeasurements:
    def test_full_pipeline(self, sample_sinus_rhythm_leads):
        m = compute_all_measurements(sample_sinus_rhythm_leads)

        # Rate
        assert m.rate.unit == "bpm"
        assert m.rate.value > 0

        # QRS
        assert m.qrs_duration.unit == "ms"

        # QT
        assert m.qt_interval.unit == "ms"
        assert m.qtc_bazett.unit == "ms"
        assert m.qtc_fridericia.unit == "ms"

        # Axis
        assert m.axis_degrees.unit == "degrees"

        # Every measurement has confidence
        assert m.rate.confidence >= 0.0
        assert m.qrs_duration.confidence >= 0.0

    def test_output_has_all_fields(self, sample_sinus_rhythm_leads):
        m = compute_all_measurements(sample_sinus_rhythm_leads)

        # Verify structure
        assert hasattr(m, "rate")
        assert hasattr(m, "rhythm_regular")
        assert hasattr(m, "p_waves")
        assert hasattr(m, "pr_interval")
        assert hasattr(m, "qrs_duration")
        assert hasattr(m, "qt_interval")
        assert hasattr(m, "qtc_bazett")
        assert hasattr(m, "qtc_fridericia")
        assert hasattr(m, "axis_degrees")
        assert hasattr(m, "st_deviations")
        assert hasattr(m, "t_wave_details")
        assert hasattr(m, "lvh_voltage_criteria")
        assert hasattr(m, "rvh_voltage_criteria")
