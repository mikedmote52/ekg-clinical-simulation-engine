"""
Deterministic ECG measurements from 12-lead timeseries.

Every measurement outputs value, unit, method, and confidence.
No ML — pure signal processing and rule-based detection.
"""

from __future__ import annotations

import logging
import math
from typing import Optional

import numpy as np
from scipy import signal as scipy_signal

from models.schemas import (
    LeadTimeseries,
    Measurements,
    MeasurementValue,
    PWaveDetail,
    PWaveMorphology,
    STDeviation,
    TWaveDetail,
    TWaveMorphology,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Utility helpers
# ---------------------------------------------------------------------------


def _get_lead(leads: list[LeadTimeseries], name: str) -> Optional[LeadTimeseries]:
    """Find a lead by name."""
    for lead in leads:
        if lead.lead_name == name and lead.failure_reason is None:
            return lead
    return None


def _to_numpy(lead: LeadTimeseries) -> tuple[np.ndarray, np.ndarray]:
    """Convert a lead to numpy arrays."""
    return np.array(lead.time_ms), np.array(lead.amplitude_mv)


def _bandpass_filter(
    sig: np.ndarray,
    fs: float,
    low: float = 0.5,
    high: float = 40.0,
) -> np.ndarray:
    """Apply a bandpass Butterworth filter."""
    nyq = fs / 2.0
    if high >= nyq:
        high = nyq - 1.0
    if low <= 0:
        low = 0.1
    b, a = scipy_signal.butter(3, [low / nyq, high / nyq], btype="band")
    return scipy_signal.filtfilt(b, a, sig)


def _detect_r_peaks(
    amplitude: np.ndarray,
    fs: float,
) -> np.ndarray:
    """
    Detect R peaks using energy-based method.

    Uses differentiated signal energy followed by adaptive thresholding.
    """
    # Bandpass filter to isolate QRS complex
    filtered = _bandpass_filter(amplitude, fs, low=5.0, high=30.0)

    # Differentiate and square
    diff = np.diff(filtered)
    squared = diff ** 2

    # Moving average (150ms window)
    window_size = max(int(0.15 * fs), 3)
    kernel = np.ones(window_size) / window_size
    energy = np.convolve(squared, kernel, mode="same")

    # Adaptive threshold
    threshold = np.mean(energy) + 0.5 * np.std(energy)

    # Find peaks with minimum distance of 200ms (300 bpm max)
    min_distance = int(0.2 * fs)
    peaks, properties = scipy_signal.find_peaks(
        energy,
        height=threshold,
        distance=min_distance,
    )

    # Refine: find the actual R peak (maximum amplitude) near each energy peak
    refined_peaks = []
    search_window = int(0.05 * fs)  # 50ms search window

    for peak in peaks:
        start = max(0, peak - search_window)
        end = min(len(amplitude), peak + search_window)
        local_max = start + np.argmax(amplitude[start:end])
        refined_peaks.append(local_max)

    return np.array(refined_peaks, dtype=int)


def _compute_rr_intervals(r_peaks: np.ndarray, fs: float) -> np.ndarray:
    """Compute RR intervals in ms."""
    if len(r_peaks) < 2:
        return np.array([])
    rr_samples = np.diff(r_peaks)
    rr_ms = rr_samples / fs * 1000.0
    return rr_ms


# ---------------------------------------------------------------------------
# Core measurement functions
# ---------------------------------------------------------------------------


def measure_rate_and_rhythm(
    leads: list[LeadTimeseries],
) -> tuple[MeasurementValue, bool, str]:
    """
    Compute heart rate and rhythm regularity.

    Uses lead II preferentially, falls back to longest available lead.
    """
    # Prefer lead II for rate/rhythm
    lead = _get_lead(leads, "II") or _get_lead(leads, "II_rhythm")
    if lead is None:
        # Fall back to any available lead
        available = [l for l in leads if l.failure_reason is None]
        if not available:
            return (
                MeasurementValue(value=0, unit="bpm", method="none", confidence=0.0),
                False,
                "No usable leads",
            )
        lead = max(available, key=lambda l: len(l.amplitude_mv))

    _, amplitude = _to_numpy(lead)
    fs = lead.sample_rate_hz

    r_peaks = _detect_r_peaks(amplitude, fs)

    if len(r_peaks) < 2:
        return (
            MeasurementValue(value=0, unit="bpm", method="r_peak_detection", confidence=0.2),
            False,
            "Insufficient R peaks detected",
        )

    rr_ms = _compute_rr_intervals(r_peaks, fs)
    mean_rr = float(np.mean(rr_ms))
    rate = 60000.0 / mean_rr if mean_rr > 0 else 0

    # Rhythm regularity: coefficient of variation of RR intervals
    cv = float(np.std(rr_ms) / mean_rr) if mean_rr > 0 else 1.0
    regular = cv < 0.15  # <15% variation = regular

    if regular:
        rhythm_desc = "Regular rhythm"
    elif cv < 0.30:
        rhythm_desc = "Mildly irregular rhythm"
    else:
        rhythm_desc = "Irregularly irregular rhythm"

    confidence = min(1.0, len(r_peaks) / 5.0)  # More beats = more confidence

    rate_mv = MeasurementValue(
        value=round(rate, 1),
        unit="bpm",
        method="R-R interval from lead II energy-based peak detection",
        confidence=round(confidence, 2),
    )

    return rate_mv, regular, rhythm_desc


def detect_p_waves(
    leads: list[LeadTimeseries],
    r_peaks_lead2: np.ndarray,
) -> list[PWaveDetail]:
    """
    Detect P waves in multiple leads.

    Looks for a deflection in the 200ms window before each R peak.
    """
    results: list[PWaveDetail] = []

    for lead_name in ["I", "II", "III", "aVR", "aVL", "aVF", "V1"]:
        lead = _get_lead(leads, lead_name)
        if lead is None:
            results.append(PWaveDetail(
                lead_name=lead_name,
                detected=False,
            ))
            continue

        _, amplitude = _to_numpy(lead)
        fs = lead.sample_rate_hz

        # Detect R peaks in this lead
        r_peaks = _detect_r_peaks(amplitude, fs)
        if len(r_peaks) < 2:
            results.append(PWaveDetail(lead_name=lead_name, detected=False))
            continue

        # Search for P waves 120-200ms before each R peak
        p_detected = False
        p_durations = []
        p_amplitudes = []

        for r_idx in r_peaks:
            search_start = max(0, int(r_idx - 0.28 * fs))
            search_end = max(0, int(r_idx - 0.08 * fs))

            if search_end <= search_start:
                continue

            segment = amplitude[search_start:search_end]
            if len(segment) < 3:
                continue

            # Look for a peak in this region
            peaks, props = scipy_signal.find_peaks(segment, prominence=0.02)

            if len(peaks) > 0:
                p_detected = True
                # P wave duration: approximate from the peak width
                widths = scipy_signal.peak_widths(segment, peaks, rel_height=0.5)
                if widths[0].size > 0:
                    p_dur_samples = float(widths[0][0])
                    p_durations.append(p_dur_samples / fs * 1000)
                p_amplitudes.append(float(segment[peaks[0]]))

        if p_detected and p_durations:
            mean_dur = float(np.mean(p_durations))
            mean_amp = float(np.mean(p_amplitudes))

            # Determine morphology
            if lead_name == "aVR":
                morph = PWaveMorphology.RETROGRADE if mean_amp < 0 else PWaveMorphology.NORMAL
            elif mean_amp > 0.25:
                morph = PWaveMorphology.PEAKED
            else:
                morph = PWaveMorphology.NORMAL

            results.append(PWaveDetail(
                lead_name=lead_name,
                detected=True,
                duration_ms=MeasurementValue(
                    value=round(mean_dur, 1),
                    unit="ms",
                    method="peak_width_at_half_prominence",
                    confidence=0.7,
                ),
                morphology=morph,
                amplitude_mv=MeasurementValue(
                    value=round(mean_amp, 3),
                    unit="mV",
                    method="peak_amplitude_pre_QRS",
                    confidence=0.7,
                ),
            ))
        else:
            results.append(PWaveDetail(
                lead_name=lead_name,
                detected=p_detected,
            ))

    return results


def measure_pr_interval(
    lead: LeadTimeseries,
    r_peaks: np.ndarray,
) -> Optional[MeasurementValue]:
    """
    Measure PR interval from P wave onset to QRS onset.

    Uses the onset of P wave activity before R peak.
    """
    _, amplitude = _to_numpy(lead)
    fs = lead.sample_rate_hz
    pr_intervals = []

    for r_idx in r_peaks:
        # Find QRS onset: search backwards from R peak for the first
        # point where the derivative crosses zero or goes near baseline
        qrs_onset = _find_qrs_onset(amplitude, r_idx, fs)
        if qrs_onset is None:
            continue

        # Find P onset: search backwards from QRS onset
        search_start = max(0, int(qrs_onset - 0.20 * fs))
        search_end = int(qrs_onset - 0.04 * fs)

        if search_end <= search_start:
            continue

        segment = amplitude[search_start:search_end]
        if len(segment) < 3:
            continue

        # P onset: first significant deflection from baseline
        baseline = np.median(segment[:max(len(segment) // 4, 1)])
        threshold = baseline + 0.5 * np.std(segment)

        onset_candidates = np.where(np.abs(segment - baseline) > np.abs(threshold - baseline) * 0.5)[0]
        if len(onset_candidates) > 0:
            p_onset = search_start + onset_candidates[0]
            pr_ms = (qrs_onset - p_onset) / fs * 1000
            if 80 < pr_ms < 400:  # Physiologic range
                pr_intervals.append(pr_ms)

    if not pr_intervals:
        return None

    mean_pr = float(np.mean(pr_intervals))
    return MeasurementValue(
        value=round(mean_pr, 1),
        unit="ms",
        method="P_onset_to_QRS_onset_derivative",
        confidence=round(min(1.0, len(pr_intervals) / 3.0), 2),
    )


def _find_qrs_onset(
    amplitude: np.ndarray,
    r_peak: int,
    fs: float,
) -> Optional[int]:
    """Find QRS onset by searching backwards from R peak for the energy drop-off."""
    search_start = max(0, int(r_peak - 0.12 * fs))

    if search_start >= r_peak:
        return None

    segment = amplitude[search_start:r_peak]
    if len(segment) < 3:
        return None

    # Compute derivative magnitude
    deriv = np.abs(np.diff(segment))

    # QRS onset: where the derivative first exceeds 20% of its max
    threshold = 0.2 * deriv.max()
    candidates = np.where(deriv > threshold)[0]

    if len(candidates) > 0:
        return search_start + candidates[0]

    return None


def _find_qrs_offset(
    amplitude: np.ndarray,
    r_peak: int,
    fs: float,
) -> Optional[int]:
    """Find QRS offset (J point) by searching forward from R peak."""
    search_end = min(len(amplitude), int(r_peak + 0.12 * fs))

    if r_peak >= search_end:
        return None

    segment = amplitude[r_peak:search_end]
    if len(segment) < 3:
        return None

    deriv = np.abs(np.diff(segment))
    threshold = 0.15 * deriv.max()

    # QRS offset: where derivative drops below threshold after the peak
    below = np.where(deriv < threshold)[0]
    if len(below) > 0:
        return r_peak + below[0]

    return None


def measure_qrs_duration(
    lead: LeadTimeseries,
    r_peaks: np.ndarray,
) -> MeasurementValue:
    """Measure QRS duration from onset to offset."""
    _, amplitude = _to_numpy(lead)
    fs = lead.sample_rate_hz
    durations = []

    for r_idx in r_peaks:
        onset = _find_qrs_onset(amplitude, r_idx, fs)
        offset = _find_qrs_offset(amplitude, r_idx, fs)

        if onset is not None and offset is not None and offset > onset:
            dur_ms = (offset - onset) / fs * 1000
            if 40 < dur_ms < 250:  # Physiologic range
                durations.append(dur_ms)

    if not durations:
        return MeasurementValue(
            value=0, unit="ms", method="qrs_onset_offset_energy", confidence=0.0
        )

    mean_dur = float(np.mean(durations))
    return MeasurementValue(
        value=round(mean_dur, 1),
        unit="ms",
        method="QRS onset/offset via energy-based derivative threshold",
        confidence=round(min(1.0, len(durations) / 3.0), 2),
    )


def measure_qt_interval(
    lead: LeadTimeseries,
    r_peaks: np.ndarray,
    rate_bpm: float,
) -> tuple[MeasurementValue, MeasurementValue, MeasurementValue]:
    """
    Measure QT, QTc (Bazett), and QTc (Fridericia).

    QT: from QRS onset to T wave end.
    QTc Bazett: QT / sqrt(RR in seconds)
    QTc Fridericia: QT / (RR in seconds)^(1/3)
    """
    _, amplitude = _to_numpy(lead)
    fs = lead.sample_rate_hz
    qt_intervals = []
    rr_s = 60.0 / rate_bpm if rate_bpm > 0 else 1.0

    for r_idx in r_peaks:
        onset = _find_qrs_onset(amplitude, r_idx, fs)
        if onset is None:
            continue

        # T wave end: search 200-600ms after QRS onset
        t_search_start = int(onset + 0.20 * fs)
        t_search_end = min(len(amplitude), int(onset + 0.60 * fs))

        if t_search_end <= t_search_start:
            continue

        t_segment = amplitude[t_search_start:t_search_end]
        if len(t_segment) < 5:
            continue

        # T wave end: use the tangent method
        # Find where the descending limb of T wave crosses baseline
        baseline = np.median(amplitude[max(0, onset - int(0.05 * fs)):onset])

        # Find the T wave peak first
        t_peaks, _ = scipy_signal.find_peaks(np.abs(t_segment - baseline), prominence=0.02)

        if len(t_peaks) > 0:
            last_peak = t_peaks[-1]
            # T end: find where signal returns to baseline after last peak
            remaining = t_segment[last_peak:]
            near_baseline = np.where(np.abs(remaining - baseline) < 0.03)[0]

            if len(near_baseline) > 0:
                t_end_idx = t_search_start + last_peak + near_baseline[0]
                qt_ms = (t_end_idx - onset) / fs * 1000
                if 200 < qt_ms < 700:
                    qt_intervals.append(qt_ms)

    if not qt_intervals:
        zero = MeasurementValue(value=0, unit="ms", method="none", confidence=0.0)
        return zero, zero, zero

    mean_qt = float(np.mean(qt_intervals))
    confidence = round(min(1.0, len(qt_intervals) / 3.0), 2)

    qt = MeasurementValue(
        value=round(mean_qt, 1),
        unit="ms",
        method="QRS_onset_to_T_end_tangent",
        confidence=confidence,
    )

    # Bazett: QTc = QT / sqrt(RR)
    qtc_bazett_val = mean_qt / math.sqrt(rr_s) if rr_s > 0 else mean_qt
    qtc_bazett = MeasurementValue(
        value=round(qtc_bazett_val, 1),
        unit="ms",
        method="Bazett: QT / sqrt(RR_seconds)",
        confidence=confidence,
    )

    # Fridericia: QTc = QT / (RR)^(1/3)
    qtc_frid_val = mean_qt / (rr_s ** (1 / 3)) if rr_s > 0 else mean_qt
    qtc_fridericia = MeasurementValue(
        value=round(qtc_frid_val, 1),
        unit="ms",
        method="Fridericia: QT / RR_seconds^(1/3)",
        confidence=confidence,
    )

    return qt, qtc_bazett, qtc_fridericia


def measure_axis(leads: list[LeadTimeseries]) -> tuple[MeasurementValue, str, Optional[str]]:
    """
    Calculate electrical axis from leads I and aVF.

    Uses net QRS amplitude (R peak - S trough) in leads I and aVF,
    then computes the angle via arctan2.
    Confirm with precordial transition zone.
    """
    lead_I = _get_lead(leads, "I")
    lead_aVF = _get_lead(leads, "aVF")

    if lead_I is None or lead_aVF is None:
        return (
            MeasurementValue(value=0, unit="degrees", method="none", confidence=0.0),
            "Indeterminate",
            None,
        )

    # Net QRS amplitude = max - min in a window around R peak
    net_I = _net_qrs_amplitude(lead_I)
    net_aVF = _net_qrs_amplitude(lead_aVF)

    # Axis angle: arctan2(aVF_net, I_net) in the cardiac coordinate system
    axis_rad = math.atan2(net_aVF, net_I)
    axis_deg = math.degrees(axis_rad)

    # Normalize to -180 to 180
    if axis_deg > 180:
        axis_deg -= 360

    # Determine quadrant
    if -30 <= axis_deg <= 90:
        quadrant = "Normal axis"
    elif -90 <= axis_deg < -30:
        quadrant = "Left axis deviation"
    elif 90 < axis_deg <= 180:
        quadrant = "Right axis deviation"
    else:
        quadrant = "Extreme axis deviation"

    # Precordial transition zone
    transition = _find_precordial_transition(leads)

    return (
        MeasurementValue(
            value=round(axis_deg, 1),
            unit="degrees",
            method="arctan2(net_QRS_aVF, net_QRS_I)",
            confidence=0.8,
        ),
        quadrant,
        transition,
    )


def _net_qrs_amplitude(lead: LeadTimeseries) -> float:
    """Compute net QRS amplitude (R height - S depth) for a lead."""
    _, amplitude = _to_numpy(lead)
    fs = lead.sample_rate_hz

    r_peaks = _detect_r_peaks(amplitude, fs)
    if len(r_peaks) == 0:
        return 0.0

    # Use the first good R peak
    r_idx = r_peaks[0]
    window_start = max(0, int(r_idx - 0.06 * fs))
    window_end = min(len(amplitude), int(r_idx + 0.06 * fs))

    segment = amplitude[window_start:window_end]
    if len(segment) == 0:
        return 0.0

    return float(np.max(segment) - np.min(segment)) * np.sign(amplitude[r_idx])


def _find_precordial_transition(leads: list[LeadTimeseries]) -> Optional[str]:
    """Find the precordial lead where R/S ratio crosses 1."""
    for lead_name in ["V1", "V2", "V3", "V4", "V5", "V6"]:
        lead = _get_lead(leads, lead_name)
        if lead is None:
            continue

        _, amplitude = _to_numpy(lead)
        fs = lead.sample_rate_hz
        r_peaks = _detect_r_peaks(amplitude, fs)

        if len(r_peaks) == 0:
            continue

        r_idx = r_peaks[0]
        window_start = max(0, int(r_idx - 0.06 * fs))
        window_end = min(len(amplitude), int(r_idx + 0.06 * fs))
        segment = amplitude[window_start:window_end]

        if len(segment) == 0:
            continue

        r_height = float(np.max(segment))
        s_depth = abs(float(np.min(segment)))

        if s_depth > 0 and r_height / s_depth >= 1.0:
            return lead_name

    return None


def measure_voltage_criteria(
    leads: list[LeadTimeseries],
) -> tuple[bool, Optional[str], bool, Optional[str]]:
    """
    Check Sokolow-Lyon and Cornell voltage criteria for LVH and RVH.

    LVH Sokolow-Lyon: S_V1 + R_V5 or R_V6 >= 3.5 mV
    LVH Cornell: R_aVL + S_V3 >= 2.8 mV (men) or >= 2.0 mV (women)
    RVH: R_V1 >= 0.7 mV or R/S ratio V1 > 1
    """
    lvh = False
    lvh_detail = None
    rvh = False
    rvh_detail = None

    # LVH Sokolow-Lyon
    s_v1 = _get_s_wave_depth(leads, "V1")
    r_v5 = _get_r_wave_height(leads, "V5")
    r_v6 = _get_r_wave_height(leads, "V6")

    sokolow = s_v1 + max(r_v5, r_v6)
    if sokolow >= 3.5:
        lvh = True
        lvh_detail = f"Sokolow-Lyon: S_V1({s_v1:.1f}) + R_V5/V6({max(r_v5, r_v6):.1f}) = {sokolow:.1f} mV >= 3.5 mV"

    # LVH Cornell (using gender-neutral threshold of 2.4)
    r_avl = _get_r_wave_height(leads, "aVL")
    s_v3 = _get_s_wave_depth(leads, "V3")
    cornell = r_avl + s_v3
    if not lvh and cornell >= 2.4:
        lvh = True
        lvh_detail = f"Cornell: R_aVL({r_avl:.1f}) + S_V3({s_v3:.1f}) = {cornell:.1f} mV >= 2.4 mV"

    # RVH
    r_v1 = _get_r_wave_height(leads, "V1")
    if r_v1 >= 0.7:
        rvh = True
        rvh_detail = f"R_V1 = {r_v1:.1f} mV >= 0.7 mV"

    return lvh, lvh_detail, rvh, rvh_detail


def _get_r_wave_height(leads: list[LeadTimeseries], lead_name: str) -> float:
    """Get R wave height in mV for a given lead."""
    lead = _get_lead(leads, lead_name)
    if lead is None:
        return 0.0
    _, amplitude = _to_numpy(lead)
    fs = lead.sample_rate_hz
    r_peaks = _detect_r_peaks(amplitude, fs)
    if len(r_peaks) == 0:
        return 0.0
    # Average R peak height above baseline
    baseline = np.median(amplitude)
    heights = [amplitude[p] - baseline for p in r_peaks if p < len(amplitude)]
    return float(np.mean(heights)) if heights else 0.0


def _get_s_wave_depth(leads: list[LeadTimeseries], lead_name: str) -> float:
    """Get S wave depth (positive value) in mV for a given lead."""
    lead = _get_lead(leads, lead_name)
    if lead is None:
        return 0.0
    _, amplitude = _to_numpy(lead)
    fs = lead.sample_rate_hz
    r_peaks = _detect_r_peaks(amplitude, fs)
    if len(r_peaks) == 0:
        return 0.0
    # S wave: minimum after R peak within 60ms
    depths = []
    for r_idx in r_peaks:
        s_start = r_idx
        s_end = min(len(amplitude), int(r_idx + 0.06 * fs))
        if s_end > s_start:
            s_min = np.min(amplitude[s_start:s_end])
            baseline = np.median(amplitude)
            depths.append(max(0.0, baseline - s_min))
    return float(np.mean(depths)) if depths else 0.0


def measure_st_deviations(
    leads: list[LeadTimeseries],
) -> list[STDeviation]:
    """
    Measure ST deviation per lead at J+60ms.
    """
    results = []

    for lead_name in ["I", "II", "III", "aVR", "aVL", "aVF",
                       "V1", "V2", "V3", "V4", "V5", "V6"]:
        lead = _get_lead(leads, lead_name)
        if lead is None:
            continue

        _, amplitude = _to_numpy(lead)
        fs = lead.sample_rate_hz
        r_peaks = _detect_r_peaks(amplitude, fs)

        if len(r_peaks) == 0:
            continue

        st_values = []
        for r_idx in r_peaks:
            # Find J point (QRS offset)
            j_point = _find_qrs_offset(amplitude, r_idx, fs)
            if j_point is None:
                continue

            # Measure at J+60ms
            j60_idx = int(j_point + 0.06 * fs)
            if j60_idx >= len(amplitude):
                continue

            # Baseline: TP segment (before P wave)
            baseline_start = max(0, int(r_idx - 0.30 * fs))
            baseline_end = max(0, int(r_idx - 0.20 * fs))
            if baseline_end <= baseline_start:
                baseline = 0.0
            else:
                baseline = float(np.median(amplitude[baseline_start:baseline_end]))

            st_dev = float(amplitude[j60_idx]) - baseline
            st_values.append(st_dev)

        if st_values:
            mean_st = float(np.mean(st_values))
            results.append(STDeviation(
                lead_name=lead_name,
                deviation_mv=round(mean_st, 3),
                measurement_point="J+60ms",
            ))

    return results


def measure_t_waves(
    leads: list[LeadTimeseries],
) -> list[TWaveDetail]:
    """Analyze T wave polarity and morphology per lead."""
    results = []

    for lead_name in ["I", "II", "III", "aVR", "aVL", "aVF",
                       "V1", "V2", "V3", "V4", "V5", "V6"]:
        lead = _get_lead(leads, lead_name)
        if lead is None:
            continue

        _, amplitude = _to_numpy(lead)
        fs = lead.sample_rate_hz
        r_peaks = _detect_r_peaks(amplitude, fs)

        if len(r_peaks) == 0:
            continue

        t_amplitudes = []
        for r_idx in r_peaks:
            # T wave region: 150-400ms after R peak
            t_start = int(r_idx + 0.15 * fs)
            t_end = min(len(amplitude), int(r_idx + 0.40 * fs))

            if t_end <= t_start:
                continue

            t_segment = amplitude[t_start:t_end]
            baseline = np.median(amplitude[max(0, int(r_idx - 0.30 * fs)):r_idx])

            # T wave peak: maximum absolute deviation from baseline
            t_peak_val = t_segment[np.argmax(np.abs(t_segment - baseline))] - baseline
            t_amplitudes.append(float(t_peak_val))

        if t_amplitudes:
            mean_amp = float(np.mean(t_amplitudes))

            if mean_amp > 0.05:
                polarity = TWaveMorphology.UPRIGHT
            elif mean_amp < -0.05:
                polarity = TWaveMorphology.INVERTED
            elif abs(mean_amp) <= 0.05:
                polarity = TWaveMorphology.FLAT
            else:
                polarity = TWaveMorphology.BIPHASIC

            results.append(TWaveDetail(
                lead_name=lead_name,
                polarity=polarity,
                amplitude_mv=round(mean_amp, 3),
            ))

    return results


# ---------------------------------------------------------------------------
# Main measurement pipeline
# ---------------------------------------------------------------------------


def compute_all_measurements(leads: list[LeadTimeseries]) -> Measurements:
    """
    Run all measurement algorithms on the 12-lead timeseries.

    Returns a fully populated Measurements object.
    """
    # Rate and rhythm
    rate, regular, rhythm_desc = measure_rate_and_rhythm(leads)

    # Get R peaks from lead II for shared use
    lead_ii = _get_lead(leads, "II")
    if lead_ii is None:
        lead_ii = next((l for l in leads if l.failure_reason is None), None)

    r_peaks_ii = np.array([])
    if lead_ii is not None:
        _, amp = _to_numpy(lead_ii)
        r_peaks_ii = _detect_r_peaks(amp, lead_ii.sample_rate_hz)

    # P waves
    p_waves = detect_p_waves(leads, r_peaks_ii)

    # PR interval
    pr = None
    if lead_ii is not None and len(r_peaks_ii) >= 2:
        pr = measure_pr_interval(lead_ii, r_peaks_ii)

    # QRS duration
    qrs = MeasurementValue(value=0, unit="ms", method="none", confidence=0.0)
    if lead_ii is not None and len(r_peaks_ii) >= 2:
        qrs = measure_qrs_duration(lead_ii, r_peaks_ii)

    # QT / QTc
    qt = MeasurementValue(value=0, unit="ms", method="none", confidence=0.0)
    qtc_b = MeasurementValue(value=0, unit="ms", method="none", confidence=0.0)
    qtc_f = MeasurementValue(value=0, unit="ms", method="none", confidence=0.0)
    if lead_ii is not None and len(r_peaks_ii) >= 2 and rate.value > 0:
        qt, qtc_b, qtc_f = measure_qt_interval(lead_ii, r_peaks_ii, rate.value)

    # Axis
    axis, quadrant, transition = measure_axis(leads)

    # Voltage criteria
    lvh, lvh_detail, rvh, rvh_detail = measure_voltage_criteria(leads)

    # ST deviations
    st_devs = measure_st_deviations(leads)

    # T waves
    t_waves = measure_t_waves(leads)

    return Measurements(
        rate=rate,
        rhythm_regular=regular,
        rhythm_description=rhythm_desc,
        p_waves=p_waves,
        pr_interval=pr,
        qrs_duration=qrs,
        qt_interval=qt,
        qtc_bazett=qtc_b,
        qtc_fridericia=qtc_f,
        axis_degrees=axis,
        axis_quadrant=quadrant,
        precordial_transition=transition,
        lvh_voltage_criteria=lvh,
        lvh_criteria_detail=lvh_detail,
        rvh_voltage_criteria=rvh,
        rvh_criteria_detail=rvh_detail,
        st_deviations=st_devs,
        t_wave_details=t_waves,
    )
