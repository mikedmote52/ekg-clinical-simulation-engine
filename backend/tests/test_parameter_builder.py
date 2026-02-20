"""
Tests for the parameter builder.
"""

import pytest

from interpreter.classifier import classify
from interpreter.measurements import compute_all_measurements
from mapper.parameter_builder import build_visualization_parameters
from models.schemas import AcquisitionType, ECGMetadata


class TestParameterBuilder:
    def test_builds_full_visualization(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        classifier_output = classify(measurements)
        metadata = ECGMetadata(paper_speed=25.0, amplitude_scale=10.0)

        viz = build_visualization_parameters(
            classifier_output=classifier_output,
            measurements=measurements,
            metadata=metadata,
            session_id="test-session",
        )

        assert viz.session_id == "test-session"
        assert viz.ecg_metadata.paper_speed == 25.0
        assert viz.measurements.rate.value > 0
        assert viz.interpretation.primary_diagnosis != ""
        assert len(viz.activation_sequence) > 0
        assert viz.mechanical_archetype in [
            "normal_sinus", "RBBB_typical", "LBBB_typical", "LAFB",
            "inferior_STEMI_explanatory", "anterior_STEMI_explanatory",
            "afib_typical", "third_degree_block", "WPW_typical", "LVH_typical",
        ]

    def test_display_contract_populated(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        classifier_output = classify(measurements)
        metadata = ECGMetadata(paper_speed=25.0, amplitude_scale=10.0)

        viz = build_visualization_parameters(
            classifier_output=classifier_output,
            measurements=measurements,
            metadata=metadata,
        )

        assert len(viz.display_contract.evidence_supported) > 0
        assert len(viz.display_contract.modeled_assumption) > 0

    def test_uncertainty_always_present(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        classifier_output = classify(measurements)
        metadata = ECGMetadata(paper_speed=25.0, amplitude_scale=10.0)

        viz = build_visualization_parameters(
            classifier_output=classifier_output,
            measurements=measurements,
            metadata=metadata,
        )

        # Activation sequence is always flagged as underdetermined
        assert len(viz.uncertainty.underdetermined_parameters) > 0
        assert any(
            "activation" in p.lower()
            for p in viz.uncertainty.underdetermined_parameters
        )

    def test_serializes_to_json(self, sample_sinus_rhythm_leads):
        measurements = compute_all_measurements(sample_sinus_rhythm_leads)
        classifier_output = classify(measurements)
        metadata = ECGMetadata(paper_speed=25.0, amplitude_scale=10.0)

        viz = build_visualization_parameters(
            classifier_output=classifier_output,
            measurements=measurements,
            metadata=metadata,
        )

        # Should serialize without error
        json_str = viz.model_dump_json()
        assert len(json_str) > 100  # Non-trivial output
        assert "activation_sequence" in json_str
        assert "display_contract" in json_str
