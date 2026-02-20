"""
Cardiologist agent.

Takes measurements and produces a differential finding list
using the rules-based classifier.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from interpreter.classifier import classify
from models.schemas import ClassifierOutput, Measurements

logger = logging.getLogger(__name__)


@dataclass
class CardiologistInput:
    """Input to the Cardiologist agent."""
    measurements: Measurements


@dataclass
class CardiologistOutput:
    """Output from the Cardiologist agent."""
    classifier_output: Optional[ClassifierOutput] = None
    success: bool = True
    error: Optional[str] = None
    warnings: list[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class Cardiologist:
    """
    Classifies ECG findings using rules-based decision tree.

    Takes calibrated measurements and produces a ranked differential
    of findings with supporting evidence.
    """

    def process(self, input_data: CardiologistInput) -> CardiologistOutput:
        """Execute the cardiologist classification pipeline."""
        output = CardiologistOutput()

        try:
            logger.info("Cardiologist: Running classifier...")
            classifier_output = classify(input_data.measurements)
            output.classifier_output = classifier_output

            n_findings = len(classifier_output.differentials)
            logger.info(
                f"Cardiologist complete: primary='{classifier_output.primary_finding}', "
                f"{n_findings} differentials, "
                f"rhythm='{classifier_output.rhythm}'"
            )

            # Validate output quality
            if not classifier_output.differentials:
                output.warnings.append(
                    "No differential findings generated — measurements may be insufficient"
                )

            # Flag if the top finding has low probability
            if classifier_output.differentials:
                top = classifier_output.differentials[0]
                if top.probability < 0.3:
                    output.warnings.append(
                        f"Highest probability finding is only {top.probability:.0%} — "
                        "interpretation is uncertain"
                    )

        except Exception as e:
            logger.error(f"Cardiologist failed: {e}", exc_info=True)
            output.success = False
            output.error = str(e)

        return output
