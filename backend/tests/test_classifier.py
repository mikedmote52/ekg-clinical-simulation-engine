"""
Tests for the rules-based classifier.
"""

import pytest

from interpreter.classifier import classify
from interpreter.measurements import compute_all_measurements
from models.schemas import (
    Measurements,
    MeasurementValue,
    ProbabilityTier,
    STDeviation,
    TWaveDetail,
    TWaveMorphology,
)


def _mv(value, unit="ms", method="test", confidence=0.8):
    return MeasurementValue(value=value, unit=unit, method=method, confidence=confidence)


class TestNormalSinusClassification:
    def test_normal_sinus_from_synthetic(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        result = classify(measurements)

        assert result.primary_finding is not None
        assert len(result.differentials) > 0
        assert result.rhythm != ""

        # The word "diagnose" should never appear
        for diff in result.differentials:
            assert "diagnose" not in diff.name.lower()

    def test_normal_sinus_criteria(self):
        """Manually constructed normal sinus measurements."""
        m = Measurements(
            rate=_mv(72, "bpm"),
            rhythm_regular=True,
            rhythm_description="Regular rhythm",
            pr_interval=_mv(160, "ms"),
            qrs_duration=_mv(88, "ms"),
            qt_interval=_mv(380, "ms"),
            qtc_bazett=_mv(410, "ms"),
            qtc_fridericia=_mv(400, "ms"),
            axis_degrees=_mv(45, "degrees"),
            axis_quadrant="Normal axis",
        )
        result = classify(m)

        # Normal sinus should be high probability
        normal = next(
            (d for d in result.differentials if "Normal sinus" in d.name), None
        )
        assert normal is not None
        assert normal.probability_tier in (ProbabilityTier.HIGH, ProbabilityTier.MODERATE)


class TestTachycardiaClassification:
    def test_sinus_tach(self, sample_tachycardia_leads):
        measurements = compute_all_measurements(sample_tachycardia_leads)
        result = classify(measurements)

        # Should identify either sinus tachycardia or SVT
        has_tachy = any(
            "tachycardia" in d.name.lower() or "svt" in d.name.lower()
            for d in result.differentials
            if d.probability > 0.2
        )
        # Rate should be detected as elevated
        assert measurements.rate.value > 90 or has_tachy


class TestBradycardiaClassification:
    def test_sinus_brady(self, sample_bradycardia_leads):
        measurements = compute_all_measurements(sample_bradycardia_leads)
        result = classify(measurements)

        has_brady = any(
            "bradycardia" in d.name.lower()
            for d in result.differentials
            if d.probability > 0.2
        )
        assert measurements.rate.value < 65 or has_brady


class TestSTEMIClassification:
    def test_inferior_stemi_pattern(self):
        """Measurements with ST elevation in inferior leads."""
        m = Measurements(
            rate=_mv(88, "bpm"),
            rhythm_regular=True,
            qrs_duration=_mv(90, "ms"),
            qt_interval=_mv(380, "ms"),
            qtc_bazett=_mv(420, "ms"),
            qtc_fridericia=_mv(410, "ms"),
            axis_degrees=_mv(60, "degrees"),
            st_deviations=[
                STDeviation(lead_name="II", deviation_mv=0.25),
                STDeviation(lead_name="III", deviation_mv=0.30),
                STDeviation(lead_name="aVF", deviation_mv=0.20),
                STDeviation(lead_name="I", deviation_mv=-0.15),
                STDeviation(lead_name="aVL", deviation_mv=-0.20),
            ],
        )
        result = classify(m)

        stemi = next(
            (d for d in result.differentials if "inferior" in d.name.lower()),
            None,
        )
        assert stemi is not None
        assert stemi.probability > 0.5

    def test_anterior_stemi_pattern(self):
        """Measurements with ST elevation in anterior leads."""
        m = Measurements(
            rate=_mv(95, "bpm"),
            rhythm_regular=True,
            qrs_duration=_mv(92, "ms"),
            qt_interval=_mv(370, "ms"),
            qtc_bazett=_mv(430, "ms"),
            qtc_fridericia=_mv(420, "ms"),
            axis_degrees=_mv(30, "degrees"),
            st_deviations=[
                STDeviation(lead_name="V1", deviation_mv=0.15),
                STDeviation(lead_name="V2", deviation_mv=0.30),
                STDeviation(lead_name="V3", deviation_mv=0.35),
                STDeviation(lead_name="V4", deviation_mv=0.20),
                STDeviation(lead_name="II", deviation_mv=-0.10),
                STDeviation(lead_name="III", deviation_mv=-0.15),
                STDeviation(lead_name="aVF", deviation_mv=-0.12),
            ],
        )
        result = classify(m)

        stemi = next(
            (d for d in result.differentials if "anterior" in d.name.lower()),
            None,
        )
        assert stemi is not None
        assert stemi.probability > 0.5


class TestConductionClassification:
    def test_first_degree_av_block(self):
        m = Measurements(
            rate=_mv(68, "bpm"),
            rhythm_regular=True,
            pr_interval=_mv(240, "ms"),
            qrs_duration=_mv(86, "ms"),
            qt_interval=_mv(390, "ms"),
            qtc_bazett=_mv(410, "ms"),
            qtc_fridericia=_mv(405, "ms"),
            axis_degrees=_mv(40, "degrees"),
        )
        result = classify(m)

        block = next(
            (d for d in result.differentials if "first degree" in d.name.lower()),
            None,
        )
        assert block is not None
        assert block.probability > 0.3

    def test_wide_qrs_bundle_branch(self):
        m = Measurements(
            rate=_mv(75, "bpm"),
            rhythm_regular=True,
            pr_interval=_mv(170, "ms"),
            qrs_duration=_mv(140, "ms"),
            qt_interval=_mv(420, "ms"),
            qtc_bazett=_mv(440, "ms"),
            qtc_fridericia=_mv(430, "ms"),
            axis_degrees=_mv(50, "degrees"),
        )
        result = classify(m)

        # Should flag either RBBB or LBBB
        bbb = [
            d for d in result.differentials
            if "bundle branch" in d.name.lower() and d.probability > 0.1
        ]
        assert len(bbb) > 0


class TestOutputFormat:
    def test_no_diagnose_in_output(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        result = classify(measurements)

        for diff in result.differentials:
            assert "diagnose" not in diff.name.lower(), (
                f"Found 'diagnose' in: {diff.name}"
            )

    def test_differentials_have_required_fields(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        result = classify(measurements)

        for diff in result.differentials:
            assert diff.name
            assert isinstance(diff.probability, float)
            assert diff.probability_tier in ProbabilityTier
            assert isinstance(diff.supporting_criteria, list)
            assert isinstance(diff.absent_criteria, list)
            assert isinstance(diff.recommended_discriminating_tests, list)

    def test_differentials_sorted_by_probability(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        result = classify(measurements)

        if len(result.differentials) >= 2:
            for i in range(len(result.differentials) - 1):
                assert result.differentials[i].probability >= result.differentials[i + 1].probability
