"""
Physiologist agent.

Maps classifier findings to electromechanical archetypes
and builds the uncertainty model.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from mapper.archetype_library import find_best_archetype, get_archetype
from mapper.uncertainty_engine import assess_uncertainty
from models.schemas import ClassifierOutput, Measurements, Uncertainty

logger = logging.getLogger(__name__)


@dataclass
class PhysiologistInput:
    """Input to the Physiologist agent."""
    classifier_output: ClassifierOutput
    measurements: Measurements


@dataclass
class PhysiologistOutput:
    """Output from the Physiologist agent."""
    archetype_id: str = "normal_sinus"
    uncertainty: Optional[Uncertainty] = None
    success: bool = True
    error: Optional[str] = None
    warnings: list[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class Physiologist:
    """
    Maps findings to physiologic archetypes and assesses uncertainty.

    Bridges the gap between clinical findings and the visualization
    model by selecting the best electromechanical archetype and
    flagging areas of diagnostic uncertainty.
    """

    def process(self, input_data: PhysiologistInput) -> PhysiologistOutput:
        """Execute the physiologist mapping pipeline."""
        output = PhysiologistOutput()

        try:
            # Find the primary finding key
            primary = input_data.classifier_output.primary_finding
            logger.info(f"Physiologist: Mapping '{primary}' to archetype...")

            # Map to archetype via the classifier's internal name
            # Extract from differentials if available
            finding_key = self._resolve_finding_key(input_data.classifier_output)
            archetype_id = find_best_archetype(finding_key)
            archetype = get_archetype(archetype_id)

            if archetype is None:
                output.warnings.append(
                    f"No archetype found for '{finding_key}'; using normal_sinus"
                )
                archetype_id = "normal_sinus"

            output.archetype_id = archetype_id
            logger.info(f"Physiologist: Selected archetype '{archetype_id}'")

            # Assess uncertainty
            logger.info("Physiologist: Assessing uncertainty...")
            uncertainty = assess_uncertainty(
                input_data.classifier_output,
                input_data.measurements,
            )
            output.uncertainty = uncertainty

            if uncertainty.alternate_models:
                output.warnings.append(
                    f"{len(uncertainty.alternate_models)} alternate interpretation(s) identified"
                )

        except Exception as e:
            logger.error(f"Physiologist failed: {e}", exc_info=True)
            output.success = False
            output.error = str(e)

        return output

    def _resolve_finding_key(self, classifier_output: ClassifierOutput) -> str:
        """
        Resolve the primary finding to a simple key for archetype lookup.

        Tries to match from the differentials list first,
        then falls back to heuristic name matching.
        """
        # Check differentials for high-probability findings
        for diff in classifier_output.differentials:
            if diff.probability >= 0.5:
                key = self._name_to_key(diff.name)
                if key:
                    return key

        # Fallback: parse the primary finding string
        return self._name_to_key(classifier_output.primary_finding) or "normal_sinus"

    @staticmethod
    def _name_to_key(name: str) -> Optional[str]:
        """Convert a display name to a finding key."""
        name_lower = name.lower()

        key_patterns = {
            "normal sinus": "normal_sinus",
            "sinus tachycardia": "sinus_tachycardia",
            "sinus bradycardia": "sinus_bradycardia",
            "atrial fibrillation": "atrial_fibrillation",
            "atrial flutter": "atrial_flutter",
            "supraventricular tachycardia": "svt",
            "right bundle branch": "rbbb",
            "left bundle branch": "lbbb",
            "left anterior fascicular": "lafb",
            "left posterior fascicular": "lpfb",
            "first degree": "first_degree_av_block",
            "mobitz type i": "second_degree_mobitz_i",
            "wenckebach": "second_degree_mobitz_i",
            "mobitz type ii": "second_degree_mobitz_ii",
            "third degree": "third_degree_av_block",
            "complete": "third_degree_av_block",
            "wolff-parkinson-white": "wpw",
            "left ventricular hypertrophy": "lvh",
            "right ventricular hypertrophy": "rvh",
            "inferior": "inferior_stemi",
            "anterior": "anterior_stemi",
            "lateral": "lateral_stemi",
            "posterior": "posterior_stemi",
            "non-st": "nstemi",
            "early repolarization": "early_repolarization",
            "pericarditis": "pericarditis",
            "digitalis": "digitalis_effect",
            "hypokalemia": "hypokalemia",
            "hyperkalemia": "hyperkalemia",
        }

        for pattern, key in key_patterns.items():
            if pattern in name_lower:
                return key

        return None
