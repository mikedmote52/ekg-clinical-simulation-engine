"""
Tests for Pydantic schema validation.
"""

import pytest

from models.schemas import (
    ActivationEvent,
    AcquisitionType,
    ConductionSystem,
    DifferentialDiagnosis,
    DisplayContract,
    ECGMetadata,
    Interpretation,
    LeadDigitizationConfidence,
    LeadTimeseries,
    Measurements,
    MeasurementValue,
    ProbabilityTier,
    PropagationVector,
    Repolarization,
    Uncertainty,
    VisualizationParameterJSON,
)


def _make_measurement(value=72, unit="bpm", method="test", confidence=0.9):
    return MeasurementValue(value=value, unit=unit, method=method, confidence=confidence)


def _make_minimal_measurements():
    return Measurements(
        rate=_make_measurement(72, "bpm"),
        rhythm_regular=True,
        qrs_duration=_make_measurement(88, "ms"),
        qt_interval=_make_measurement(380, "ms"),
        qtc_bazett=_make_measurement(410, "ms"),
        qtc_fridericia=_make_measurement(400, "ms"),
        axis_degrees=_make_measurement(45, "degrees"),
    )


class TestMeasurementValue:
    def test_valid_measurement(self):
        m = MeasurementValue(value=72, unit="bpm", method="r_peak", confidence=0.9)
        assert m.value == 72
        assert m.confidence == 0.9

    def test_confidence_bounds(self):
        with pytest.raises(Exception):
            MeasurementValue(value=72, unit="bpm", method="test", confidence=1.5)

        with pytest.raises(Exception):
            MeasurementValue(value=72, unit="bpm", method="test", confidence=-0.1)


class TestECGMetadata:
    def test_default_values(self):
        meta = ECGMetadata(paper_speed=25.0, amplitude_scale=10.0)
        assert meta.lead_count == 12
        assert meta.acquisition_type == AcquisitionType.SIMULTANEOUS

    def test_stitched_acquisition(self):
        meta = ECGMetadata(
            paper_speed=25.0,
            amplitude_scale=10.0,
            acquisition_type=AcquisitionType.STITCHED,
        )
        assert meta.acquisition_type == AcquisitionType.STITCHED


class TestVisualizationParameterJSON:
    def test_minimal_construction(self):
        viz = VisualizationParameterJSON(
            ecg_metadata=ECGMetadata(paper_speed=25.0, amplitude_scale=10.0),
            measurements=_make_minimal_measurements(),
            interpretation=Interpretation(primary_diagnosis="Normal sinus rhythm"),
        )
        assert viz.mechanical_archetype == "normal_sinus"
        assert not viz.pipeline_degraded

    def test_full_construction(self):
        viz = VisualizationParameterJSON(
            session_id="test-123",
            ecg_metadata=ECGMetadata(paper_speed=25.0, amplitude_scale=10.0),
            measurements=_make_minimal_measurements(),
            interpretation=Interpretation(
                primary_diagnosis="Normal sinus rhythm",
                rhythm="Normal sinus rhythm",
                differentials=[
                    DifferentialDiagnosis(
                        name="Normal sinus rhythm",
                        probability=0.95,
                        probability_tier=ProbabilityTier.HIGH,
                    )
                ],
            ),
            activation_sequence=[
                ActivationEvent(
                    structure_name="sa_node",
                    onset_ms=0,
                    offset_ms=5,
                    propagation_direction_vector=PropagationVector(x=0, y=-1, z=0),
                    confidence=0.8,
                )
            ],
            conduction_system=ConductionSystem(sa_node_rate=72),
            repolarization=Repolarization(),
            mechanical_archetype="normal_sinus",
            uncertainty=Uncertainty(
                underdetermined_parameters=["Internal activation sequence"],
            ),
            display_contract=DisplayContract(
                evidence_supported=["Heart rate: 72 bpm"],
                modeled_assumption=["Activation sequence from archetype"],
            ),
        )
        assert viz.session_id == "test-123"
        assert len(viz.activation_sequence) == 1
        assert viz.conduction_system.sa_node_rate == 72

    def test_serialization_roundtrip(self):
        viz = VisualizationParameterJSON(
            ecg_metadata=ECGMetadata(paper_speed=25.0, amplitude_scale=10.0),
            measurements=_make_minimal_measurements(),
            interpretation=Interpretation(primary_diagnosis="Test"),
        )
        json_str = viz.model_dump_json()
        restored = VisualizationParameterJSON.model_validate_json(json_str)
        assert restored.interpretation.primary_diagnosis == "Test"


class TestLeadTimeseries:
    def test_valid_lead(self):
        lead = LeadTimeseries(
            lead_name="II",
            time_ms=[0, 2, 4, 6],
            amplitude_mv=[0.0, 0.1, 0.5, 0.0],
            confidence=0.85,
        )
        assert lead.sample_rate_hz == 500.0
        assert lead.failure_reason is None

    def test_failed_lead(self):
        lead = LeadTimeseries(
            lead_name="V3",
            time_ms=[0],
            amplitude_mv=[0],
            confidence=0.0,
            failure_reason="Grid removal failed",
        )
        assert lead.confidence == 0.0
        assert "Grid" in lead.failure_reason
