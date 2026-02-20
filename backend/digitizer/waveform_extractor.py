"""
Waveform extraction from preprocessed ECG images.

For each of 12 lead regions:
- Isolate lead box
- Remove grid lines
- Trace waveform centerline
- Convert to calibrated timeseries at 500 Hz equivalent
- Assess confidence and detect stitching
"""

from __future__ import annotations

import logging
from typing import Optional

import cv2
import numpy as np
from scipy import signal as scipy_signal

from digitizer.grid_detector import remove_grid_combined
from digitizer.lead_segmenter import LeadRegion, segment_leads_grid, detect_rhythm_strip
from models.schemas import (
    GridCharacterization,
    LeadTimeseries,
    DigitizedECG,
    ECGMetadata,
    AcquisitionType,
    LeadDigitizationConfidence,
)

logger = logging.getLogger(__name__)

TARGET_SAMPLE_RATE = 500.0  # Hz


def extract_waveform_from_region(
    gray: np.ndarray,
    region: LeadRegion,
    grid: GridCharacterization,
) -> LeadTimeseries:
    """
    Extract a calibrated timeseries from a single lead region.

    Steps:
    1. Crop the lead region
    2. Remove grid lines
    3. Trace waveform centerline using column-wise intensity minimum
    4. Convert pixel coordinates to time/amplitude
    5. Resample to 500 Hz
    """
    # Step 1: Crop
    lead_image = region.crop(gray)
    if lead_image.size == 0:
        return _failed_lead(region.lead_name, "Empty lead region")

    lead_h, lead_w = lead_image.shape[:2]
    if lead_w < 10 or lead_h < 10:
        return _failed_lead(region.lead_name, f"Lead region too small: {lead_w}x{lead_h}")

    # Step 2: Remove grid
    try:
        cleaned = remove_grid_combined(lead_image, grid.small_square_px)
    except Exception as e:
        logger.warning(f"Grid removal failed for {region.lead_name}: {e}")
        cleaned = lead_image.copy()

    # Step 3: Trace waveform centerline
    trace_y, confidence_per_col = _trace_centerline(cleaned)

    if trace_y is None:
        return _failed_lead(region.lead_name, "Waveform tracing failed")

    # Step 4: Convert pixel coordinates to physical units
    # Time: pixels -> mm -> seconds
    px_per_mm = grid.small_square_px  # 1 small square = 1mm
    if px_per_mm <= 0:
        px_per_mm = 4.0  # fallback

    mm_per_s = grid.paper_speed_mm_per_s  # typically 25 mm/s
    px_per_s = px_per_mm * mm_per_s

    # Amplitude: pixels -> mm -> mV
    mm_per_mv = grid.amplitude_scale_mm_per_mv  # typically 10 mm/mV
    px_per_mv = px_per_mm * mm_per_mv

    # Baseline: assume the median y position is the baseline
    baseline_y = np.median(trace_y)

    # Convert to time (ms) and amplitude (mV)
    n_cols = len(trace_y)
    time_px = np.arange(n_cols, dtype=np.float64)
    time_s = time_px / px_per_s
    time_ms = (time_s * 1000.0).tolist()

    # Amplitude: image y-axis is inverted (0 at top)
    # So deflection upward = lower y value = positive amplitude
    amplitude_mv = ((baseline_y - trace_y) / px_per_mv).tolist()

    # Step 5: Resample to 500 Hz
    duration_s = n_cols / px_per_s
    n_target_samples = max(int(duration_s * TARGET_SAMPLE_RATE), 2)

    try:
        resampled_amplitude = scipy_signal.resample(amplitude_mv, n_target_samples).tolist()
        resampled_time = np.linspace(0, duration_s * 1000, n_target_samples).tolist()
    except Exception as e:
        logger.warning(f"Resampling failed for {region.lead_name}: {e}")
        resampled_time = time_ms
        resampled_amplitude = amplitude_mv

    # Overall confidence
    valid_cols = confidence_per_col[confidence_per_col > 0.3]
    overall_confidence = float(len(valid_cols) / max(len(confidence_per_col), 1))
    overall_confidence = min(max(overall_confidence, 0.0), 1.0)

    return LeadTimeseries(
        lead_name=region.lead_name,
        time_ms=resampled_time,
        amplitude_mv=resampled_amplitude,
        sample_rate_hz=TARGET_SAMPLE_RATE,
        confidence=overall_confidence,
    )


def _trace_centerline(
    cleaned: np.ndarray,
) -> tuple[Optional[np.ndarray], np.ndarray]:
    """
    Trace the waveform centerline using column-wise intensity minimum detection.

    For each column, find the darkest pixel (waveform trace).
    Apply continuity constraints to reject noise.
    """
    h, w = cleaned.shape[:2]

    if w == 0 or h == 0:
        return None, np.array([])

    # Invert so waveform pixels are brightest
    inverted = 255 - cleaned

    # Apply vertical Gaussian blur to smooth noise within each column
    blurred = cv2.GaussianBlur(inverted, (1, 5), 0)

    # For each column, find the intensity-weighted centroid of the darkest region
    trace_y = np.zeros(w, dtype=np.float64)
    confidence = np.zeros(w, dtype=np.float64)

    for col in range(w):
        column = blurred[:, col].astype(np.float64)

        if column.max() < 10:
            # No significant signal in this column
            trace_y[col] = h / 2
            confidence[col] = 0.0
            continue

        # Threshold at 40% of column max to isolate waveform
        threshold = column.max() * 0.4
        mask = column > threshold

        if not np.any(mask):
            trace_y[col] = h / 2
            confidence[col] = 0.0
            continue

        # Intensity-weighted centroid
        indices = np.arange(h, dtype=np.float64)
        weights = column * mask
        total_weight = weights.sum()

        if total_weight > 0:
            centroid = (indices * weights).sum() / total_weight
            trace_y[col] = centroid
            # Confidence based on peak sharpness
            peak_width = np.sum(mask)
            confidence[col] = min(1.0, 5.0 / max(peak_width, 1))
        else:
            trace_y[col] = h / 2
            confidence[col] = 0.0

    # Apply continuity filter: reject jumps > 20% of image height
    trace_y = _apply_continuity_filter(trace_y, confidence, max_jump_fraction=0.2, height=h)

    # Smooth the trace
    if len(trace_y) > 5:
        kernel_size = min(5, len(trace_y))
        if kernel_size % 2 == 0:
            kernel_size -= 1
        if kernel_size >= 3:
            trace_y = scipy_signal.medfilt(trace_y, kernel_size=kernel_size)

    return trace_y, confidence


def _apply_continuity_filter(
    trace_y: np.ndarray,
    confidence: np.ndarray,
    max_jump_fraction: float,
    height: int,
) -> np.ndarray:
    """
    Filter out discontinuities in the traced waveform.

    If a column's y-value jumps too far from its neighbors,
    interpolate from surrounding valid points.
    """
    max_jump = height * max_jump_fraction
    result = trace_y.copy()

    for i in range(1, len(result) - 1):
        if confidence[i] < 0.1:
            continue

        left_jump = abs(result[i] - result[i - 1])
        right_jump = abs(result[i] - result[i + 1])

        if left_jump > max_jump and right_jump > max_jump:
            # This point is an outlier — interpolate
            result[i] = (result[i - 1] + result[i + 1]) / 2
            confidence[i] *= 0.5

    return result


def detect_stitching(leads: list[LeadTimeseries]) -> bool:
    """
    Detect whether leads appear time-coherent (simultaneous) or stitched.

    Stitched ECGs show each lead recorded sequentially rather than simultaneously.
    Signs of stitching:
    - Each lead covers only ~2.5 seconds (at 25mm/s on standard paper)
    - Heart rate variation between leads
    """
    if len(leads) < 4:
        return False

    durations = []
    for lead in leads:
        if lead.time_ms and lead.failure_reason is None:
            duration = lead.time_ms[-1] - lead.time_ms[0]
            durations.append(duration)

    if not durations:
        return False

    # Simultaneous 12-lead typically shows 10 seconds per lead
    # Stitched typically shows 2.5 seconds per lead
    median_duration = np.median(durations)

    # If median duration is less than 4 seconds, likely stitched
    return median_duration < 4000.0


def extract_all_leads(
    gray: np.ndarray,
    grid: GridCharacterization,
    session_id: str,
    lead_regions: Optional[list[LeadRegion]] = None,
) -> DigitizedECG:
    """
    Extract waveforms from all 12 leads.

    Args:
        gray: Preprocessed grayscale image
        grid: Grid characterization from preprocessor
        session_id: Session identifier
        lead_regions: Pre-detected lead regions (auto-detected if None)

    Returns:
        Complete digitized ECG with all lead timeseries
    """
    warnings: list[str] = []

    # Segment leads if not provided
    if lead_regions is None:
        lead_regions = segment_leads_grid(gray, grid)
        logger.info(f"Auto-segmented {len(lead_regions)} lead regions")

    # Check for rhythm strip
    rhythm_strip = detect_rhythm_strip(gray, lead_regions)
    if rhythm_strip:
        lead_regions.append(rhythm_strip)
        logger.info("Rhythm strip detected at bottom of image")

    # Extract each lead
    leads: list[LeadTimeseries] = []
    confidences: list[LeadDigitizationConfidence] = []

    for region in lead_regions:
        logger.info(f"Extracting lead {region.lead_name}...")
        ts = extract_waveform_from_region(gray, region, grid)
        leads.append(ts)

        confidences.append(LeadDigitizationConfidence(
            lead_name=ts.lead_name,
            confidence=ts.confidence,
            failure_reason=ts.failure_reason,
        ))

        if ts.failure_reason:
            warnings.append(f"Lead {ts.lead_name}: {ts.failure_reason}")

    # Detect stitching
    is_stitched = detect_stitching(leads)
    if is_stitched:
        warnings.append("Leads appear to be sequentially acquired (stitched), not simultaneous")

    # Check overall readiness
    successful_leads = [l for l in leads if l.failure_reason is None]
    ready = len(successful_leads) >= 6  # Need at least 6 good leads

    if not ready:
        warnings.append(
            f"Only {len(successful_leads)}/{len(leads)} leads extracted successfully; "
            "interpretation quality may be degraded"
        )

    # Build metadata
    metadata = ECGMetadata(
        paper_speed=grid.paper_speed_mm_per_s,
        amplitude_scale=grid.amplitude_scale_mm_per_mv,
        lead_count=len(leads),
        acquisition_type=AcquisitionType.STITCHED if is_stitched else AcquisitionType.SIMULTANEOUS,
        digitization_confidence=confidences,
    )

    return DigitizedECG(
        session_id=session_id,
        metadata=metadata,
        leads=leads,
        is_stitched=is_stitched,
        warnings=warnings,
        ready_for_interpretation=ready,
    )


def _failed_lead(lead_name: str, reason: str) -> LeadTimeseries:
    """Create a failed LeadTimeseries with zero data."""
    return LeadTimeseries(
        lead_name=lead_name,
        time_ms=[0.0],
        amplitude_mv=[0.0],
        sample_rate_hz=TARGET_SAMPLE_RATE,
        confidence=0.0,
        failure_reason=reason,
    )
