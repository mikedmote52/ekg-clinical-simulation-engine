"""
Uncertainty engine.

Provides structured assessment of diagnostic uncertainty,
including what the ECG can and cannot determine.
"""

from __future__ import annotations

from models.schemas import (
    AlternateModel,
    ClassifierOutput,
    Measurements,
    Uncertainty,
)


# ---------------------------------------------------------------------------
# Known ECG limitations — things that surface ECG cannot determine
# ---------------------------------------------------------------------------

INHERENT_LIMITATIONS = [
    "Surface ECG provides an averaged electrical signal; it cannot resolve "
    "the activation sequence of individual myocardial cells.",
    "Coronary anatomy cannot be determined from ECG; lead-territory mapping "
    "uses statistical norms that vary between individuals.",
    "Wall motion abnormalities suggested by ECG findings require "
    "echocardiographic confirmation.",
    "ECG cannot distinguish between acute and chronic ST changes without "
    "comparison to prior tracings.",
]


# ---------------------------------------------------------------------------
# Diagnostic ambiguity patterns
# ---------------------------------------------------------------------------

AMBIGUITY_PATTERNS = {
    ("inferior_stemi", "early_repolarization"): {
        "description": "Inferior ST elevation may reflect acute injury or normal variant",
        "discriminating_tests": [
            "Serial ECGs (dynamic changes favor injury)",
            "High-sensitivity troponin trend",
            "Reciprocal changes (favor injury)",
            "Clinical presentation and risk factors",
        ],
    },
    ("anterior_stemi", "early_repolarization"): {
        "description": "Precordial ST elevation — STEMI vs benign early repolarization",
        "discriminating_tests": [
            "Smith-modified Sgarbossa criteria if LBBB present",
            "Serial troponin levels",
            "ST/T ratio analysis",
            "Clinical context and symptom onset",
        ],
    },
    ("pericarditis", "inferior_stemi"): {
        "description": "Diffuse ST elevation — pericarditis vs multi-territory ischemia",
        "discriminating_tests": [
            "PR depression in II (favors pericarditis)",
            "ST elevation in aVR (favors ischemia)",
            "Spodick sign (downsloping TP, favors pericarditis)",
            "Echocardiogram for effusion",
        ],
    },
    ("lbbb", "lvh"): {
        "description": "Wide QRS with high voltage — LBBB vs LVH vs both",
        "discriminating_tests": [
            "Echocardiogram for wall thickness and LVEF",
            "Prior ECG comparison for new vs old LBBB",
            "Peguero-Lo Presti criteria for LVH in LBBB",
        ],
    },
    ("rbbb", "rvh"): {
        "description": "Right-sided ECG changes — RBBB vs RVH vs both",
        "discriminating_tests": [
            "Echocardiogram for RV size and function",
            "Pulmonary function tests",
            "CT pulmonary angiogram if PE suspected",
        ],
    },
    ("wpw", "lbbb"): {
        "description": "Wide QRS with short PR — WPW vs LBBB with short PR",
        "discriminating_tests": [
            "Delta wave morphology analysis",
            "Electrophysiology study",
            "Prior ECGs for intermittent pre-excitation",
        ],
    },
    ("hyperkalemia", "third_degree_av_block"): {
        "description": "Wide QRS with bradycardia — hyperkalemia vs high-grade AV block",
        "discriminating_tests": [
            "Stat potassium level",
            "Calcium administration trial (if hyperK suspected)",
            "Prior ECGs for baseline QRS width",
        ],
    },
}


def assess_uncertainty(
    classifier_output: ClassifierOutput,
    measurements: Measurements,
) -> Uncertainty:
    """
    Comprehensive uncertainty assessment.

    Evaluates measurement confidence, diagnostic ambiguity,
    and inherent ECG limitations.
    """
    underdetermined: list[str] = []
    alternates: list[AlternateModel] = []

    # Measurement-level uncertainty
    underdetermined.extend(_assess_measurement_uncertainty(measurements))

    # Diagnostic ambiguity
    finding_keys = _extract_finding_keys(classifier_output)
    alternates.extend(_assess_diagnostic_ambiguity(finding_keys))

    # Inherent limitations (always present)
    underdetermined.extend(INHERENT_LIMITATIONS[:2])  # Include top 2

    return Uncertainty(
        underdetermined_parameters=underdetermined,
        alternate_models=alternates,
    )


def _assess_measurement_uncertainty(m: Measurements) -> list[str]:
    """Flag measurements with low confidence."""
    issues = []

    if m.rate.confidence < 0.5:
        issues.append(f"Heart rate: low confidence ({m.rate.confidence:.0%})")

    if m.qrs_duration.confidence < 0.5:
        issues.append(f"QRS duration: low confidence ({m.qrs_duration.confidence:.0%})")

    if m.qt_interval.confidence < 0.5:
        issues.append(f"QT interval: low confidence ({m.qt_interval.confidence:.0%})")

    if m.axis_degrees.confidence < 0.5:
        issues.append(f"Electrical axis: low confidence ({m.axis_degrees.confidence:.0%})")

    if m.pr_interval is None:
        issues.append("PR interval: could not be measured")
    elif m.pr_interval.confidence < 0.5:
        issues.append(f"PR interval: low confidence ({m.pr_interval.confidence:.0%})")

    return issues


def _extract_finding_keys(classifier_output: ClassifierOutput) -> list[str]:
    """Extract simple finding keys from classifier output."""
    keys = []
    for diff in classifier_output.differentials:
        if diff.probability >= 0.3:
            # Simple heuristic: extract the key concept
            name_lower = diff.name.lower()
            for key in AMBIGUITY_PATTERNS.keys():
                for pattern_key in key:
                    if pattern_key.replace("_", " ") in name_lower:
                        keys.append(pattern_key)
    return keys


def _assess_diagnostic_ambiguity(finding_keys: list[str]) -> list[AlternateModel]:
    """Check for known diagnostic ambiguity patterns."""
    alternates = []

    for (key1, key2), info in AMBIGUITY_PATTERNS.items():
        if key1 in finding_keys or key2 in finding_keys:
            alternates.append(AlternateModel(
                description=info["description"],
                discriminating_test="; ".join(info["discriminating_tests"][:2]),
            ))

    return alternates
