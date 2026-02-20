"""
Pipeline orchestrator.

Runs agents in sequence: ECGSpecialist -> Cardiologist -> Physiologist -> ArtistParameterizer.

Catches per-agent failures, logs them, and returns partial results with
failure flags rather than crashing. Output is always a VisualizationParameterJSON,
even if degraded.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from PIL import Image

from agents.artist import ArtistInput, ArtistOutput, ArtistParameterizer
from agents.cardiologist import CardiologistInput, CardiologistOutput, Cardiologist
from agents.ecg_specialist import ECGSpecialist, ECGSpecialistInput, ECGSpecialistOutput
from agents.physiologist import PhysiologistInput, PhysiologistOutput, Physiologist
from models.schemas import (
    ClassifierOutput,
    ConductionSystem,
    DisplayContract,
    ECGMetadata,
    Interpretation,
    Measurements,
    MeasurementValue,
    Repolarization,
    Uncertainty,
    VisualizationParameterJSON,
)

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    """Complete result of the interpretation pipeline."""
    visualization: VisualizationParameterJSON
    digitized_ecg: Optional[object] = None
    preprocessed_gray: Optional[np.ndarray] = None
    debug_overlay: Optional[np.ndarray] = None
    agent_timings: dict[str, float] = field(default_factory=dict)
    agent_errors: dict[str, str] = field(default_factory=dict)
    all_warnings: list[str] = field(default_factory=list)


class Orchestrator:
    """
    Synchronous agent pipeline orchestrator.

    Runs each agent in sequence, passing outputs forward.
    If an agent fails, constructs the best possible partial output
    from what succeeded and flags degradation.
    """

    def __init__(self):
        self.ecg_specialist = ECGSpecialist()
        self.cardiologist = Cardiologist()
        self.physiologist = Physiologist()
        self.artist = ArtistParameterizer()

    def run(
        self,
        image: Optional[Image.Image] = None,
        pdf_bytes: Optional[bytes] = None,
        session_id: str = "",
    ) -> PipelineResult:
        """
        Execute the full interpretation pipeline.

        Args:
            image: PIL Image of ECG
            pdf_bytes: PDF bytes of ECG
            session_id: Session identifier for tracking

        Returns:
            PipelineResult with VisualizationParameterJSON (possibly degraded)
        """
        timings: dict[str, float] = {}
        errors: dict[str, str] = {}
        warnings: list[str] = []
        degraded = False

        # --------------- Agent 1: ECG Specialist ---------------
        ecg_output = self._run_ecg_specialist(
            image, pdf_bytes, session_id, timings, errors, warnings
        )
        if not ecg_output.success:
            degraded = True

        # --------------- Agent 2: Cardiologist ---------------
        cardio_output = self._run_cardiologist(
            ecg_output, timings, errors, warnings
        )
        if not cardio_output.success:
            degraded = True

        # --------------- Agent 3: Physiologist ---------------
        physio_output = self._run_physiologist(
            cardio_output, ecg_output, timings, errors, warnings
        )
        if not physio_output.success:
            degraded = True

        # --------------- Agent 4: Artist Parameterizer ---------------
        artist_output = self._run_artist(
            cardio_output, ecg_output, physio_output, session_id,
            timings, errors, warnings
        )
        if not artist_output.success:
            degraded = True

        # --------------- Assemble final result ---------------
        viz = artist_output.visualization
        if viz is None:
            viz = self._build_fallback_visualization(
                session_id, ecg_output, warnings
            )

        viz.pipeline_degraded = degraded
        viz.pipeline_warnings = warnings

        return PipelineResult(
            visualization=viz,
            digitized_ecg=ecg_output.digitized_ecg if ecg_output.success else None,
            preprocessed_gray=ecg_output.preprocessed_gray,
            debug_overlay=ecg_output.debug_overlay,
            agent_timings=timings,
            agent_errors=errors,
            all_warnings=warnings,
        )

    def _run_ecg_specialist(
        self,
        image, pdf_bytes, session_id, timings, errors, warnings,
    ) -> ECGSpecialistOutput:
        """Run ECG Specialist agent with error handling."""
        t0 = time.monotonic()
        try:
            ecg_input = ECGSpecialistInput(
                image=image,
                pdf_bytes=pdf_bytes,
                session_id=session_id,
            )
            output = self.ecg_specialist.process(ecg_input)
            if output.warnings:
                warnings.extend(output.warnings)
            if not output.success:
                errors["ecg_specialist"] = output.error or "Unknown error"
                warnings.append(f"ECG Specialist failed: {output.error}")
        except Exception as e:
            logger.error(f"ECG Specialist crashed: {e}", exc_info=True)
            output = ECGSpecialistOutput(success=False, error=str(e))
            errors["ecg_specialist"] = str(e)
            warnings.append(f"ECG Specialist crashed: {e}")

        timings["ecg_specialist"] = time.monotonic() - t0
        return output

    def _run_cardiologist(
        self,
        ecg_output: ECGSpecialistOutput,
        timings, errors, warnings,
    ) -> CardiologistOutput:
        """Run Cardiologist agent with error handling."""
        t0 = time.monotonic()

        if ecg_output.measurements is None:
            warnings.append("Cardiologist skipped: no measurements available")
            output = CardiologistOutput(success=False, error="No measurements input")
            errors["cardiologist"] = "Skipped — no input measurements"
            timings["cardiologist"] = time.monotonic() - t0
            return output

        try:
            cardio_input = CardiologistInput(measurements=ecg_output.measurements)
            output = self.cardiologist.process(cardio_input)
            if output.warnings:
                warnings.extend(output.warnings)
            if not output.success:
                errors["cardiologist"] = output.error or "Unknown error"
                warnings.append(f"Cardiologist failed: {output.error}")
        except Exception as e:
            logger.error(f"Cardiologist crashed: {e}", exc_info=True)
            output = CardiologistOutput(success=False, error=str(e))
            errors["cardiologist"] = str(e)
            warnings.append(f"Cardiologist crashed: {e}")

        timings["cardiologist"] = time.monotonic() - t0
        return output

    def _run_physiologist(
        self,
        cardio_output: CardiologistOutput,
        ecg_output: ECGSpecialistOutput,
        timings, errors, warnings,
    ) -> PhysiologistOutput:
        """Run Physiologist agent with error handling."""
        t0 = time.monotonic()

        if cardio_output.classifier_output is None or ecg_output.measurements is None:
            warnings.append("Physiologist skipped: missing classifier or measurement data")
            output = PhysiologistOutput(success=False, error="Missing input data")
            errors["physiologist"] = "Skipped — missing input"
            timings["physiologist"] = time.monotonic() - t0
            return output

        try:
            physio_input = PhysiologistInput(
                classifier_output=cardio_output.classifier_output,
                measurements=ecg_output.measurements,
            )
            output = self.physiologist.process(physio_input)
            if output.warnings:
                warnings.extend(output.warnings)
            if not output.success:
                errors["physiologist"] = output.error or "Unknown error"
                warnings.append(f"Physiologist failed: {output.error}")
        except Exception as e:
            logger.error(f"Physiologist crashed: {e}", exc_info=True)
            output = PhysiologistOutput(success=False, error=str(e))
            errors["physiologist"] = str(e)
            warnings.append(f"Physiologist crashed: {e}")

        timings["physiologist"] = time.monotonic() - t0
        return output

    def _run_artist(
        self,
        cardio_output: CardiologistOutput,
        ecg_output: ECGSpecialistOutput,
        physio_output: PhysiologistOutput,
        session_id: str,
        timings, errors, warnings,
    ) -> ArtistOutput:
        """Run Artist Parameterizer agent with error handling."""
        t0 = time.monotonic()

        if (
            cardio_output.classifier_output is None
            or ecg_output.measurements is None
            or ecg_output.digitized_ecg is None
        ):
            warnings.append("Artist skipped: missing upstream data")
            output = ArtistOutput(success=False, error="Missing input data")
            errors["artist"] = "Skipped — missing input"
            timings["artist"] = time.monotonic() - t0
            return output

        try:
            artist_input = ArtistInput(
                classifier_output=cardio_output.classifier_output,
                measurements=ecg_output.measurements,
                metadata=ecg_output.digitized_ecg.metadata,
                archetype_id=physio_output.archetype_id,
                uncertainty=physio_output.uncertainty,
                session_id=session_id,
            )
            output = self.artist.process(artist_input)
            if output.warnings:
                warnings.extend(output.warnings)
            if not output.success:
                errors["artist"] = output.error or "Unknown error"
                warnings.append(f"Artist failed: {output.error}")
        except Exception as e:
            logger.error(f"Artist crashed: {e}", exc_info=True)
            output = ArtistOutput(success=False, error=str(e))
            errors["artist"] = str(e)
            warnings.append(f"Artist crashed: {e}")

        timings["artist"] = time.monotonic() - t0
        return output

    @staticmethod
    def _build_fallback_visualization(
        session_id: str,
        ecg_output: ECGSpecialistOutput,
        warnings: list[str],
    ) -> VisualizationParameterJSON:
        """
        Build a minimal fallback VisualizationParameterJSON when the pipeline fails.

        Uses whatever data is available, falling back to defaults for everything else.
        """
        # Use available metadata or defaults
        if ecg_output.digitized_ecg:
            metadata = ecg_output.digitized_ecg.metadata
        else:
            metadata = ECGMetadata(
                paper_speed=25.0,
                amplitude_scale=10.0,
                lead_count=12,
            )

        # Use available measurements or create minimal defaults
        if ecg_output.measurements:
            measurements = ecg_output.measurements
        else:
            zero_mv = MeasurementValue(value=0, unit="", method="fallback", confidence=0.0)
            measurements = Measurements(
                rate=zero_mv,
                rhythm_regular=False,
                qrs_duration=zero_mv,
                qt_interval=zero_mv,
                qtc_bazett=zero_mv,
                qtc_fridericia=zero_mv,
                axis_degrees=zero_mv,
            )

        return VisualizationParameterJSON(
            session_id=session_id,
            ecg_metadata=metadata,
            measurements=measurements,
            interpretation=Interpretation(
                primary_diagnosis="Interpretation unavailable — pipeline degraded",
                rhythm="Unable to classify",
            ),
            conduction_system=ConductionSystem(),
            repolarization=Repolarization(),
            mechanical_archetype="normal_sinus",
            uncertainty=Uncertainty(
                underdetermined_parameters=[
                    "All parameters — pipeline failed before completion"
                ],
            ),
            display_contract=DisplayContract(
                evidence_supported=[],
                modeled_assumption=[
                    "All visualization elements are default values due to pipeline failure"
                ],
            ),
            pipeline_degraded=True,
            pipeline_warnings=warnings,
        )
