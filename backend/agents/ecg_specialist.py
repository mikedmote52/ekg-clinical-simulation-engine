"""
ECG Specialist agent.

Responsible for digitization and measurement extraction.
Takes raw image data and produces calibrated measurements.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image

from digitizer.preprocessor import preprocess
from digitizer.waveform_extractor import extract_all_leads
from interpreter.measurements import compute_all_measurements
from models.schemas import DigitizedECG, Measurements

logger = logging.getLogger(__name__)


@dataclass
class ECGSpecialistInput:
    """Input to the ECG Specialist agent."""
    image: Optional[Image.Image] = None
    pdf_bytes: Optional[bytes] = None
    session_id: str = ""


@dataclass
class ECGSpecialistOutput:
    """Output from the ECG Specialist agent."""
    digitized_ecg: Optional[DigitizedECG] = None
    measurements: Optional[Measurements] = None
    preprocessed_gray: Optional[np.ndarray] = None
    debug_overlay: Optional[np.ndarray] = None
    success: bool = True
    error: Optional[str] = None
    warnings: list[str] = None

    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class ECGSpecialist:
    """
    Digitizes ECG images and computes measurements.

    Pipeline:
    1. Preprocess image (perspective correction, grid detection)
    2. Extract waveforms from all leads
    3. Compute all measurements from extracted timeseries
    """

    def process(self, input_data: ECGSpecialistInput) -> ECGSpecialistOutput:
        """Execute the ECG specialist pipeline."""
        output = ECGSpecialistOutput()

        try:
            # Determine source type
            if input_data.pdf_bytes:
                source = input_data.pdf_bytes
                is_pdf = True
            elif input_data.image:
                source = input_data.image
                is_pdf = False
            else:
                output.success = False
                output.error = "No image or PDF provided"
                return output

            # Step 1: Preprocess
            logger.info("ECG Specialist: Preprocessing image...")
            gray, debug_overlay, grid, preprocessed, corrected_bgr = preprocess(
                source=source,
                session_id=input_data.session_id,
                is_pdf=is_pdf,
            )
            output.preprocessed_gray = gray
            output.debug_overlay = debug_overlay
            output.warnings.extend(preprocessed.warnings)

            # Step 2: Extract waveforms (pass BGR for color-aware grid removal)
            logger.info("ECG Specialist: Extracting waveforms...")
            digitized = extract_all_leads(
                gray=gray,
                grid=grid,
                session_id=input_data.session_id,
                bgr_image=corrected_bgr,
            )
            output.digitized_ecg = digitized
            output.warnings.extend(digitized.warnings)

            if not digitized.ready_for_interpretation:
                output.warnings.append(
                    "ECG digitization quality is low; measurements may be unreliable"
                )

            # Step 3: Compute measurements
            logger.info("ECG Specialist: Computing measurements...")
            measurements = compute_all_measurements(digitized.leads)
            output.measurements = measurements

            logger.info(
                f"ECG Specialist complete: rate={measurements.rate.value}bpm, "
                f"QRS={measurements.qrs_duration.value}ms, "
                f"axis={measurements.axis_degrees.value}°"
            )

        except Exception as e:
            logger.error(f"ECG Specialist failed: {e}", exc_info=True)
            output.success = False
            output.error = str(e)

        return output
