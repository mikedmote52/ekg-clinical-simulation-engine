"""
Artist / Parameterizer agent.

Takes all upstream outputs and assembles the final
VisualizationParameterJSON for the frontend.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from mapper.parameter_builder import build_visualization_parameters
from models.schemas import (
    ClassifierOutput,
    ECGMetadata,
    Measurements,
    Uncertainty,
    VisualizationParameterJSON,
)

logger = logging.getLogger(__name__)


@dataclass
class ArtistInput:
    """Input to the Artist agent."""
    classifier_output: ClassifierOutput
    measurements: Measurements
    metadata: ECGMetadata
    archetype_id: str = "normal_sinus"
    uncertainty: Optional[Uncertainty] = None
    session_id: Optional[str] = None


@dataclass
class ArtistOutput:
    """Output from the Artist agent."""
    visualization: Optional[VisualizationParameterJSON] = None
    success: bool = True
    error: Optional[str] = None
    warnings: list[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class ArtistParameterizer:
    """
    Assembles the final VisualizationParameterJSON.

    Takes all upstream results and produces the single output
    contract that drives the 3D heart visualization.
    """

    def process(self, input_data: ArtistInput) -> ArtistOutput:
        """Execute the artist parameterization pipeline."""
        output = ArtistOutput()

        try:
            logger.info("Artist: Building visualization parameters...")

            viz = build_visualization_parameters(
                classifier_output=input_data.classifier_output,
                measurements=input_data.measurements,
                metadata=input_data.metadata,
                session_id=input_data.session_id,
            )

            # Override archetype if the physiologist selected a different one
            if input_data.archetype_id != viz.mechanical_archetype:
                viz.mechanical_archetype = input_data.archetype_id

            # Merge uncertainty from physiologist if provided
            if input_data.uncertainty:
                # Combine underdetermined parameters (deduplicate)
                existing = set(viz.uncertainty.underdetermined_parameters)
                for param in input_data.uncertainty.underdetermined_parameters:
                    if param not in existing:
                        viz.uncertainty.underdetermined_parameters.append(param)

                # Combine alternate models
                existing_descs = {m.description for m in viz.uncertainty.alternate_models}
                for model in input_data.uncertainty.alternate_models:
                    if model.description not in existing_descs:
                        viz.uncertainty.alternate_models.append(model)

            output.visualization = viz

            logger.info(
                f"Artist complete: archetype='{viz.mechanical_archetype}', "
                f"{len(viz.activation_sequence)} activation events, "
                f"{len(viz.display_contract.evidence_supported)} evidence items, "
                f"{len(viz.display_contract.modeled_assumption)} modeled items"
            )

        except Exception as e:
            logger.error(f"Artist failed: {e}", exc_info=True)
            output.success = False
            output.error = str(e)

        return output
