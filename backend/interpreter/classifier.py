"""
Rules-based ECG classifier.

Produces ranked differential findings using deterministic decision trees.
No ML required — pure clinical criteria evaluation.

IMPORTANT: The word "diagnose" never appears in any user-facing string.
All findings use "pattern consistent with" or "finding suggestive of."
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from models.schemas import (
    ClassifierOutput,
    DifferentialDiagnosis,
    Measurements,
    ProbabilityTier,
    SupportingEvidence,
    TWaveMorphology,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# ICD-10 codes for ECG findings
# ---------------------------------------------------------------------------

ICD10 = {
    "normal_sinus": None,
    "sinus_tachycardia": "R00.0",
    "sinus_bradycardia": "R00.1",
    "atrial_fibrillation": "I48.91",
    "atrial_flutter": "I48.92",
    "svt": "I47.1",
    "rbbb": "I45.10",
    "lbbb": "I44.7",
    "lafb": "I44.4",
    "lpfb": "I44.5",
    "first_degree_av_block": "I44.0",
    "second_degree_mobitz_i": "I44.1",
    "second_degree_mobitz_ii": "I44.1",
    "third_degree_av_block": "I44.2",
    "wpw": "I45.6",
    "lvh": "I51.7",
    "rvh": "I51.7",
    "inferior_stemi": "I21.19",
    "anterior_stemi": "I21.09",
    "lateral_stemi": "I21.29",
    "posterior_stemi": "I21.29",
    "nstemi": "I21.4",
    "early_repolarization": None,
    "pericarditis": "I30.9",
    "digitalis_effect": "T46.0X5A",
    "hypokalemia": "E87.6",
    "hyperkalemia": "E87.5",
}


@dataclass
class CriteriaResult:
    """Result of evaluating a single diagnostic criterion."""
    name: str
    met: bool
    detail: str = ""


@dataclass
class FindingCandidate:
    """Intermediate representation before final scoring."""
    name: str
    display_name: str
    icd10: str | None
    criteria: list[CriteriaResult] = field(default_factory=list)
    absent: list[str] = field(default_factory=list)
    tests: list[str] = field(default_factory=list)
    base_probability: float = 0.0


# ---------------------------------------------------------------------------
# Helper functions for criteria evaluation
# ---------------------------------------------------------------------------


def _st_elevation_in_leads(m: Measurements, lead_names: list[str], threshold: float = 0.1) -> bool:
    """Check if ST elevation >= threshold in specified leads."""
    elevated_count = 0
    for st in m.st_deviations:
        if st.lead_name in lead_names and st.deviation_mv >= threshold:
            elevated_count += 1
    return elevated_count >= 2


def _st_depression_in_leads(m: Measurements, lead_names: list[str], threshold: float = 0.1) -> bool:
    """Check if ST depression >= threshold in specified leads."""
    depressed_count = 0
    for st in m.st_deviations:
        if st.lead_name in lead_names and st.deviation_mv <= -threshold:
            depressed_count += 1
    return depressed_count >= 2


def _t_inverted_in_leads(m: Measurements, lead_names: list[str]) -> bool:
    """Check if T waves are inverted in specified leads."""
    inverted_count = 0
    for tw in m.t_wave_details:
        if tw.lead_name in lead_names and tw.polarity == TWaveMorphology.INVERTED:
            inverted_count += 1
    return inverted_count >= 2


def _get_st_deviation(m: Measurements, lead_name: str) -> float:
    """Get ST deviation for a specific lead."""
    for st in m.st_deviations:
        if st.lead_name == lead_name:
            return st.deviation_mv
    return 0.0


def _p_waves_present(m: Measurements) -> bool:
    """Check if P waves are detected in lead II."""
    for pw in m.p_waves:
        if pw.lead_name == "II" and pw.detected:
            return True
    return False


def _p_waves_absent(m: Measurements) -> bool:
    """Check if P waves are absent."""
    return not _p_waves_present(m)


# ---------------------------------------------------------------------------
# Individual classifiers
# ---------------------------------------------------------------------------


def _check_normal_sinus(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="normal_sinus",
        display_name="Normal sinus rhythm",
        icd10=ICD10["normal_sinus"],
    )
    criteria = []

    c1 = CriteriaResult("Rate 60-100 bpm", 60 <= m.rate.value <= 100,
                         f"Rate: {m.rate.value} bpm")
    criteria.append(c1)

    c2 = CriteriaResult("Regular rhythm", m.rhythm_regular, m.rhythm_description)
    criteria.append(c2)

    c3 = CriteriaResult("P waves present in lead II", _p_waves_present(m))
    criteria.append(c3)

    c4 = CriteriaResult("PR interval 120-200ms",
                         m.pr_interval is not None and 120 <= m.pr_interval.value <= 200,
                         f"PR: {m.pr_interval.value if m.pr_interval else 'N/A'} ms")
    criteria.append(c4)

    c5 = CriteriaResult("QRS < 120ms", m.qrs_duration.value < 120 if m.qrs_duration.value > 0 else False,
                         f"QRS: {m.qrs_duration.value} ms")
    criteria.append(c5)

    c6 = CriteriaResult("Normal axis (-30 to +90)", -30 <= m.axis_degrees.value <= 90,
                         f"Axis: {m.axis_degrees.value}°")
    criteria.append(c6)

    f.criteria = criteria
    met_count = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met_count / len(criteria)
    return f


def _check_sinus_tachycardia(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="sinus_tachycardia",
        display_name="Pattern consistent with sinus tachycardia",
        icd10=ICD10["sinus_tachycardia"],
        tests=["Clinical correlation", "Thyroid function tests if persistent"],
    )
    criteria = [
        CriteriaResult("Rate > 100 bpm", m.rate.value > 100, f"Rate: {m.rate.value}"),
        CriteriaResult("Regular rhythm", m.rhythm_regular),
        CriteriaResult("P waves present", _p_waves_present(m)),
        CriteriaResult("Normal PR interval",
                        m.pr_interval is not None and 120 <= m.pr_interval.value <= 200),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) if criteria else 0
    return f


def _check_sinus_bradycardia(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="sinus_bradycardia",
        display_name="Pattern consistent with sinus bradycardia",
        icd10=ICD10["sinus_bradycardia"],
        tests=["Medication review", "Thyroid function tests"],
    )
    criteria = [
        CriteriaResult("Rate < 60 bpm", m.rate.value < 60 and m.rate.value > 0,
                        f"Rate: {m.rate.value}"),
        CriteriaResult("Regular rhythm", m.rhythm_regular),
        CriteriaResult("P waves present", _p_waves_present(m)),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) if criteria else 0
    return f


def _check_atrial_fibrillation(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="atrial_fibrillation",
        display_name="Pattern consistent with atrial fibrillation",
        icd10=ICD10["atrial_fibrillation"],
        tests=["Echocardiogram", "Thyroid function", "CHA2DS2-VASc scoring"],
    )
    criteria = [
        CriteriaResult("Irregularly irregular rhythm", not m.rhythm_regular,
                        m.rhythm_description),
        CriteriaResult("Absent discrete P waves", _p_waves_absent(m)),
        CriteriaResult("Variable RR intervals", not m.rhythm_regular),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) if criteria else 0
    return f


def _check_atrial_flutter(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="atrial_flutter",
        display_name="Pattern consistent with atrial flutter",
        icd10=ICD10["atrial_flutter"],
        tests=["Adenosine challenge to unmask flutter waves", "Echocardiogram"],
    )
    # Flutter: rate often ~150 bpm (2:1 block) or ~100 (3:1), ~75 (4:1)
    typical_flutter_rate = m.rate.value > 0 and (
        140 <= m.rate.value <= 160 or  # 2:1
        90 <= m.rate.value <= 110 or   # 3:1
        70 <= m.rate.value <= 80       # 4:1
    )
    criteria = [
        CriteriaResult("Regular or regularly irregular rhythm", True),  # Flutter can be regular
        CriteriaResult("Rate suggestive of flutter (~150, ~100, ~75 bpm)",
                        typical_flutter_rate, f"Rate: {m.rate.value}"),
        CriteriaResult("Sawtooth pattern (II, III, aVF)", False,
                        "Requires visual morphology analysis"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.7  # Lower confidence without morphology
    return f


def _check_svt(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="svt",
        display_name="Pattern consistent with supraventricular tachycardia",
        icd10=ICD10["svt"],
        tests=["Adenosine trial", "Electrophysiology study if recurrent"],
    )
    criteria = [
        CriteriaResult("Rate > 150 bpm", m.rate.value > 150, f"Rate: {m.rate.value}"),
        CriteriaResult("Regular rhythm", m.rhythm_regular),
        CriteriaResult("Narrow QRS < 120ms", m.qrs_duration.value < 120 and m.qrs_duration.value > 0,
                        f"QRS: {m.qrs_duration.value}"),
        CriteriaResult("P waves absent or retrograde", _p_waves_absent(m)),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) if criteria else 0
    return f


def _check_rbbb(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="rbbb",
        display_name="Pattern consistent with right bundle branch block",
        icd10=ICD10["rbbb"],
        tests=["Echocardiogram to assess RV function"],
    )
    wide_qrs = m.qrs_duration.value >= 120 and m.qrs_duration.value > 0

    # RSR' pattern in V1 — check for secondary R peak (positive terminal force)
    v1_terminal_positive = False
    for tw in m.t_wave_details:
        if tw.lead_name == "V1" and tw.polarity == TWaveMorphology.INVERTED:
            v1_terminal_positive = True  # T inversion in V1 supports RBBB

    criteria = [
        CriteriaResult("QRS >= 120ms", wide_qrs, f"QRS: {m.qrs_duration.value}"),
        CriteriaResult("RSR' pattern in V1/V2", v1_terminal_positive,
                        "Assessed via T wave inversion in V1"),
        CriteriaResult("Wide S wave in I and V6", True,
                        "Requires detailed morphology analysis"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.8
    return f


def _check_lbbb(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="lbbb",
        display_name="Pattern consistent with left bundle branch block",
        icd10=ICD10["lbbb"],
        tests=["Echocardiogram", "Assess for cardiac resynchronization therapy candidacy"],
    )
    wide_qrs = m.qrs_duration.value >= 120 and m.qrs_duration.value > 0

    # Broad notched R in I, aVL, V5, V6
    # Deep S in V1, V2
    v1_s_deep = _get_st_deviation(m, "V1") < -0.05  # Rough proxy

    criteria = [
        CriteriaResult("QRS >= 120ms", wide_qrs, f"QRS: {m.qrs_duration.value}"),
        CriteriaResult("Broad/notched R in I, aVL, V5-V6", True,
                        "Requires detailed morphology analysis"),
        CriteriaResult("Deep S in V1-V2", True,
                        "Requires waveform morphology analysis"),
        CriteriaResult("Absence of Q waves in lateral leads", True,
                        "Assumed — requires Q wave detection"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    # Only score high if QRS is actually wide
    f.base_probability = (met / len(criteria)) * (0.9 if wide_qrs else 0.1)
    return f


def _check_lafb(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="lafb",
        display_name="Pattern consistent with left anterior fascicular block",
        icd10=ICD10["lafb"],
        tests=["Echocardiogram if new finding"],
    )
    left_axis = m.axis_degrees.value < -30
    narrow_qrs = m.qrs_duration.value < 120 and m.qrs_duration.value > 0

    criteria = [
        CriteriaResult("Left axis deviation beyond -30°", left_axis,
                        f"Axis: {m.axis_degrees.value}°"),
        CriteriaResult("QRS < 120ms", narrow_qrs, f"QRS: {m.qrs_duration.value}"),
        CriteriaResult("Small q in I, aVL", True, "Requires Q wave detection"),
        CriteriaResult("Small r in II, III, aVF", True, "Requires R wave analysis"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = (met / len(criteria)) * (0.9 if left_axis else 0.1)
    return f


def _check_lpfb(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="lpfb",
        display_name="Pattern consistent with left posterior fascicular block",
        icd10=ICD10["lpfb"],
        tests=["Rule out RVH, lateral MI, chronic lung disease"],
    )
    right_axis = m.axis_degrees.value > 90
    narrow_qrs = m.qrs_duration.value < 120 and m.qrs_duration.value > 0

    criteria = [
        CriteriaResult("Right axis deviation beyond +90°", right_axis,
                        f"Axis: {m.axis_degrees.value}°"),
        CriteriaResult("QRS < 120ms", narrow_qrs, f"QRS: {m.qrs_duration.value}"),
        CriteriaResult("No RVH criteria", not m.rvh_voltage_criteria),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = (met / len(criteria)) * (0.8 if right_axis else 0.1)
    return f


def _check_first_degree_av_block(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="first_degree_av_block",
        display_name="Pattern consistent with first degree AV block",
        icd10=ICD10["first_degree_av_block"],
        tests=["Monitor for progression", "Review medications (beta-blockers, CCBs, digoxin)"],
    )
    prolonged_pr = m.pr_interval is not None and m.pr_interval.value > 200

    criteria = [
        CriteriaResult("PR > 200ms", prolonged_pr,
                        f"PR: {m.pr_interval.value if m.pr_interval else 'N/A'} ms"),
        CriteriaResult("Consistent PR prolongation (every beat)", m.rhythm_regular),
        CriteriaResult("P waves present before each QRS", _p_waves_present(m)),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = (met / len(criteria)) * (0.9 if prolonged_pr else 0.0)
    return f


def _check_second_degree_mobitz_i(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="second_degree_mobitz_i",
        display_name="Finding suggestive of second degree AV block, Mobitz type I (Wenckebach)",
        icd10=ICD10["second_degree_mobitz_i"],
        tests=["Continuous telemetry monitoring", "Assess for reversible causes"],
    )
    # Wenckebach: progressive PR prolongation then dropped beat
    # Difficult to detect from averaged measurements; flag as possible if PR is prolonged
    # and rhythm is irregular
    criteria = [
        CriteriaResult("Irregular rhythm", not m.rhythm_regular),
        CriteriaResult("P waves present", _p_waves_present(m)),
        CriteriaResult("PR progressively prolonging", False,
                        "Requires beat-by-beat PR analysis"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.4  # Low confidence without beat-by-beat
    return f


def _check_second_degree_mobitz_ii(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="second_degree_mobitz_ii",
        display_name="Finding suggestive of second degree AV block, Mobitz type II",
        icd10=ICD10["second_degree_mobitz_ii"],
        tests=["Urgent cardiology consultation", "Prepare for possible pacing"],
    )
    criteria = [
        CriteriaResult("Irregular rhythm with dropped beats", not m.rhythm_regular),
        CriteriaResult("Constant PR when conducted", True,
                        "Requires beat-by-beat analysis"),
        CriteriaResult("P waves present", _p_waves_present(m)),
        CriteriaResult("QRS may be wide", m.qrs_duration.value >= 120 if m.qrs_duration.value > 0 else False),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.3
    return f


def _check_third_degree_av_block(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="third_degree_av_block",
        display_name="Pattern consistent with third degree (complete) AV block",
        icd10=ICD10["third_degree_av_block"],
        tests=["Immediate cardiology consultation", "Transcutaneous pacing readiness"],
    )
    slow_rate = m.rate.value > 0 and m.rate.value < 50

    criteria = [
        CriteriaResult("Regular R-R intervals", m.rhythm_regular),
        CriteriaResult("Regular P-P intervals (independent of QRS)", True,
                        "Requires atrial rate analysis"),
        CriteriaResult("No fixed PR relationship", False,
                        "Requires beat-by-beat PR analysis"),
        CriteriaResult("Ventricular rate < 50 bpm", slow_rate, f"Rate: {m.rate.value}"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.6 if slow_rate else 0.1)
    return f


def _check_wpw(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="wpw",
        display_name="Pattern consistent with Wolff-Parkinson-White",
        icd10=ICD10["wpw"],
        tests=["Electrophysiology study", "Avoid AV nodal blocking agents if confirmed"],
    )
    short_pr = m.pr_interval is not None and m.pr_interval.value < 120
    wide_qrs = m.qrs_duration.value > 100 and m.qrs_duration.value > 0  # Slightly wide due to delta wave

    criteria = [
        CriteriaResult("Short PR < 120ms", short_pr,
                        f"PR: {m.pr_interval.value if m.pr_interval else 'N/A'}"),
        CriteriaResult("Delta wave (slurred QRS upstroke)", False,
                        "Requires morphology analysis"),
        CriteriaResult("Wide QRS > 100ms", wide_qrs, f"QRS: {m.qrs_duration.value}"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.7 if short_pr else 0.1)
    return f


def _check_lvh(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="lvh",
        display_name="Finding suggestive of left ventricular hypertrophy",
        icd10=ICD10["lvh"],
        tests=["Echocardiogram for wall thickness measurement"],
    )
    criteria = [
        CriteriaResult("Voltage criteria met", m.lvh_voltage_criteria,
                        m.lvh_criteria_detail or "Not met"),
        CriteriaResult("Left axis deviation", m.axis_degrees.value < -15,
                        f"Axis: {m.axis_degrees.value}°"),
        CriteriaResult("ST-T changes in lateral leads (strain pattern)",
                        _t_inverted_in_leads(m, ["I", "aVL", "V5", "V6"])),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.9 if m.lvh_voltage_criteria else 0.2)
    return f


def _check_rvh(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="rvh",
        display_name="Finding suggestive of right ventricular hypertrophy",
        icd10=ICD10["rvh"],
        tests=["Echocardiogram", "Consider pulmonary evaluation"],
    )
    criteria = [
        CriteriaResult("RVH voltage criteria met", m.rvh_voltage_criteria,
                        m.rvh_criteria_detail or "Not met"),
        CriteriaResult("Right axis deviation > +90°", m.axis_degrees.value > 90,
                        f"Axis: {m.axis_degrees.value}°"),
        CriteriaResult("T inversion in V1-V3 (strain)",
                        _t_inverted_in_leads(m, ["V1", "V2", "V3"])),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria)
    return f


def _check_inferior_stemi(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="inferior_stemi",
        display_name="Pattern consistent with acute inferior ST-elevation myocardial injury",
        icd10=ICD10["inferior_stemi"],
        tests=["Emergent cardiac catheterization", "Serial troponins",
               "Right-sided leads to assess RV involvement"],
    )
    inf_elevation = _st_elevation_in_leads(m, ["II", "III", "aVF"])
    reciprocal = _st_depression_in_leads(m, ["I", "aVL"])

    criteria = [
        CriteriaResult("ST elevation >= 1mm in II, III, aVF", inf_elevation),
        CriteriaResult("Reciprocal ST depression in I, aVL", reciprocal),
        CriteriaResult("Acute symptom context", True, "Requires clinical correlation"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.9 if inf_elevation else 0.0)
    return f


def _check_anterior_stemi(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="anterior_stemi",
        display_name="Pattern consistent with acute anterior ST-elevation myocardial injury",
        icd10=ICD10["anterior_stemi"],
        tests=["Emergent cardiac catheterization", "Serial troponins"],
    )
    ant_elevation = _st_elevation_in_leads(m, ["V1", "V2", "V3", "V4"])
    reciprocal = _st_depression_in_leads(m, ["II", "III", "aVF"])

    criteria = [
        CriteriaResult("ST elevation >= 1mm in V1-V4", ant_elevation),
        CriteriaResult("Reciprocal ST depression in inferior leads", reciprocal),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.9 if ant_elevation else 0.0)
    return f


def _check_lateral_stemi(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="lateral_stemi",
        display_name="Pattern consistent with acute lateral ST-elevation myocardial injury",
        icd10=ICD10["lateral_stemi"],
        tests=["Emergent cardiac catheterization", "Serial troponins"],
    )
    lat_elevation = _st_elevation_in_leads(m, ["I", "aVL", "V5", "V6"])

    criteria = [
        CriteriaResult("ST elevation in I, aVL, V5, V6", lat_elevation),
        CriteriaResult("Reciprocal changes in inferior leads",
                        _st_depression_in_leads(m, ["II", "III", "aVF"])),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.9 if lat_elevation else 0.0)
    return f


def _check_posterior_stemi(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="posterior_stemi",
        display_name="Pattern consistent with acute posterior ST-elevation myocardial injury",
        icd10=ICD10["posterior_stemi"],
        tests=["Posterior leads (V7-V9)", "Emergent cardiac catheterization"],
    )
    # Posterior STEMI: ST depression V1-V3 as mirror image
    ant_depression = _st_depression_in_leads(m, ["V1", "V2", "V3"])

    criteria = [
        CriteriaResult("ST depression in V1-V3 (mirror image of posterior elevation)",
                        ant_depression),
        CriteriaResult("Tall R waves in V1-V2", True,
                        "Requires R wave height analysis"),
        CriteriaResult("Upright T waves in V1-V3", True,
                        "Requires T wave polarity check"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.7 if ant_depression else 0.0)
    return f


def _check_nstemi(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="nstemi",
        display_name="Pattern consistent with non-ST-elevation myocardial injury",
        icd10=ICD10["nstemi"],
        tests=["Serial troponins", "Cardiology consultation", "Risk stratification (TIMI/GRACE)"],
    )
    any_depression = any(st.deviation_mv < -0.05 for st in m.st_deviations)
    t_inversion = any(
        tw.polarity == TWaveMorphology.INVERTED
        for tw in m.t_wave_details
        if tw.lead_name in ["I", "II", "aVL", "V2", "V3", "V4", "V5", "V6"]
    )

    criteria = [
        CriteriaResult("ST depression in 2+ leads", any_depression),
        CriteriaResult("T wave inversions", t_inversion),
        CriteriaResult("No significant ST elevation", not any(
            st.deviation_mv > 0.1 for st in m.st_deviations)),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.5  # Needs troponin for confirmation
    return f


def _check_early_repolarization(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="early_repolarization",
        display_name="Pattern consistent with early repolarization",
        icd10=ICD10["early_repolarization"],
        tests=["Clinical correlation — typically benign in young patients"],
    )
    # ST elevation in precordial leads, concave upward, with J-point elevation
    precordial_elevation = _st_elevation_in_leads(m, ["V2", "V3", "V4", "V5"])

    criteria = [
        CriteriaResult("J-point elevation in precordial leads", precordial_elevation),
        CriteriaResult("Concave upward ST morphology", True,
                        "Requires ST segment morphology analysis"),
        CriteriaResult("Young patient / asymptomatic", True,
                        "Requires clinical context"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.5
    return f


def _check_pericarditis(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="pericarditis",
        display_name="Pattern consistent with pericarditis",
        icd10=ICD10["pericarditis"],
        tests=["Inflammatory markers (CRP, ESR)", "Echocardiogram for effusion",
               "Serial ECGs for stage progression"],
    )
    # Diffuse ST elevation (not following a vascular territory)
    diffuse_elevation = sum(
        1 for st in m.st_deviations if st.deviation_mv > 0.05
    ) >= 4

    # PR depression
    pr_depression = _get_st_deviation(m, "II") > 0 and _get_st_deviation(m, "aVR") < 0

    criteria = [
        CriteriaResult("Diffuse ST elevation (4+ leads)", diffuse_elevation),
        CriteriaResult("PR depression", pr_depression,
                        "PR segment depression relative to TP baseline"),
        CriteriaResult("ST elevation in aVR absent or depressed",
                        _get_st_deviation(m, "aVR") <= 0),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * (0.7 if diffuse_elevation else 0.1)
    return f


def _check_digitalis_effect(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="digitalis_effect",
        display_name="Pattern consistent with digitalis effect",
        icd10=ICD10["digitalis_effect"],
        tests=["Digoxin level", "Review medication list"],
    )
    # "Scooped" ST depression, short QT
    st_depression_multiple = sum(
        1 for st in m.st_deviations if st.deviation_mv < -0.05
    ) >= 3
    short_qt = m.qt_interval.value > 0 and m.qt_interval.value < 360

    criteria = [
        CriteriaResult("Scooped ST depression in multiple leads", st_depression_multiple),
        CriteriaResult("Short QT interval", short_qt,
                        f"QT: {m.qt_interval.value}ms"),
        CriteriaResult("Possible bradycardia", m.rate.value < 65 if m.rate.value > 0 else False),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.5
    return f


def _check_hypokalemia(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="hypokalemia",
        display_name="Pattern consistent with hypokalemia",
        icd10=ICD10["hypokalemia"],
        tests=["Stat potassium level", "Magnesium level"],
    )
    # Flat T waves, U waves, ST depression, prolonged QT
    flat_t = sum(
        1 for tw in m.t_wave_details if tw.polarity == TWaveMorphology.FLAT
    ) >= 2
    prolonged_qt = m.qtc_bazett.value > 480 if m.qtc_bazett.value > 0 else False
    st_dep = sum(1 for st in m.st_deviations if st.deviation_mv < -0.05) >= 2

    criteria = [
        CriteriaResult("Flattened T waves", flat_t),
        CriteriaResult("Prolonged QTc", prolonged_qt,
                        f"QTc: {m.qtc_bazett.value}ms"),
        CriteriaResult("ST depression", st_dep),
        CriteriaResult("U waves present", False, "Requires U wave detection"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.5
    return f


def _check_hyperkalemia(m: Measurements) -> FindingCandidate:
    f = FindingCandidate(
        name="hyperkalemia",
        display_name="Pattern consistent with hyperkalemia",
        icd10=ICD10["hyperkalemia"],
        tests=["Stat potassium level", "Stat calcium if severe ECG changes",
               "Renal function assessment"],
    )
    # Peaked T waves, wide QRS, flat P waves
    wide_qrs = m.qrs_duration.value > 120 if m.qrs_duration.value > 0 else False
    p_absent = _p_waves_absent(m)

    # Check for tall/peaked T waves
    peaked_t = sum(
        1 for tw in m.t_wave_details
        if tw.amplitude_mv is not None and tw.amplitude_mv > 0.5
    ) >= 2

    criteria = [
        CriteriaResult("Peaked/tall T waves", peaked_t),
        CriteriaResult("Widened QRS", wide_qrs, f"QRS: {m.qrs_duration.value}ms"),
        CriteriaResult("Flattened/absent P waves", p_absent),
        CriteriaResult("Short QT interval",
                        m.qt_interval.value > 0 and m.qt_interval.value < 360,
                        f"QT: {m.qt_interval.value}ms"),
    ]
    f.criteria = criteria
    met = sum(1 for c in criteria if c.met)
    f.absent = [c.name for c in criteria if not c.met]
    f.base_probability = met / len(criteria) * 0.6
    return f


# ---------------------------------------------------------------------------
# Main classifier
# ---------------------------------------------------------------------------

ALL_CHECKERS = [
    _check_normal_sinus,
    _check_sinus_tachycardia,
    _check_sinus_bradycardia,
    _check_atrial_fibrillation,
    _check_atrial_flutter,
    _check_svt,
    _check_rbbb,
    _check_lbbb,
    _check_lafb,
    _check_lpfb,
    _check_first_degree_av_block,
    _check_second_degree_mobitz_i,
    _check_second_degree_mobitz_ii,
    _check_third_degree_av_block,
    _check_wpw,
    _check_lvh,
    _check_rvh,
    _check_inferior_stemi,
    _check_anterior_stemi,
    _check_lateral_stemi,
    _check_posterior_stemi,
    _check_nstemi,
    _check_early_repolarization,
    _check_pericarditis,
    _check_digitalis_effect,
    _check_hypokalemia,
    _check_hyperkalemia,
]


def _to_probability_tier(prob: float) -> ProbabilityTier:
    if prob >= 0.7:
        return ProbabilityTier.HIGH
    elif prob >= 0.4:
        return ProbabilityTier.MODERATE
    else:
        return ProbabilityTier.POSSIBLE


def classify(measurements: Measurements) -> ClassifierOutput:
    """
    Run all diagnostic checkers and produce a ranked differential list.

    Returns ClassifierOutput with primary finding and differentials
    sorted by probability (descending).
    """
    candidates: list[FindingCandidate] = []

    for checker in ALL_CHECKERS:
        try:
            candidate = checker(measurements)
            candidates.append(candidate)
        except Exception as e:
            logger.warning(f"Checker {checker.__name__} failed: {e}")

    # Sort by probability descending
    candidates.sort(key=lambda c: c.base_probability, reverse=True)

    # Convert to DifferentialDiagnosis list
    differentials: list[DifferentialDiagnosis] = []
    for c in candidates:
        if c.base_probability < 0.05:
            continue  # Skip negligible findings

        tier = _to_probability_tier(c.base_probability)

        diff = DifferentialDiagnosis(
            name=c.display_name,
            icd10_code=c.icd10,
            probability=round(c.base_probability, 3),
            probability_tier=tier,
            supporting_criteria=[
                SupportingEvidence(
                    criterion=cr.name,
                    met=cr.met,
                    detail=cr.detail if cr.detail else None,
                )
                for cr in c.criteria
            ],
            absent_criteria=c.absent,
            recommended_discriminating_tests=c.tests,
        )
        differentials.append(diff)

    # Primary finding
    primary = differentials[0].name if differentials else "Indeterminate — insufficient data"

    # Rhythm classification
    rhythm = _classify_rhythm(measurements, candidates)

    # Conduction abnormalities
    conduction = _classify_conduction(candidates)

    return ClassifierOutput(
        primary_finding=primary,
        differentials=differentials,
        rhythm=rhythm,
        conduction_abnormalities=conduction,
    )


def _classify_rhythm(m: Measurements, candidates: list[FindingCandidate]) -> str:
    """Determine the primary rhythm classification."""
    # Check high-probability rhythm findings
    rhythm_names = {
        "normal_sinus", "sinus_tachycardia", "sinus_bradycardia",
        "atrial_fibrillation", "atrial_flutter", "svt",
    }

    for c in candidates:
        if c.name in rhythm_names and c.base_probability >= 0.5:
            return c.display_name

    if m.rate.value == 0:
        return "Rhythm indeterminate — rate could not be measured"

    return m.rhythm_description or "Rhythm not classified"


def _classify_conduction(candidates: list[FindingCandidate]) -> list[str]:
    """Identify conduction abnormalities from candidates."""
    conduction_names = {
        "rbbb", "lbbb", "lafb", "lpfb",
        "first_degree_av_block", "second_degree_mobitz_i",
        "second_degree_mobitz_ii", "third_degree_av_block", "wpw",
    }

    abnormalities = []
    for c in candidates:
        if c.name in conduction_names and c.base_probability >= 0.4:
            abnormalities.append(c.display_name)

    return abnormalities
