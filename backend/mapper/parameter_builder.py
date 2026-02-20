"""
Parameter builder: maps classifier output + archetype to VisualizationParameterJSON.

Selects the best-fit archetype, populates the full output schema,
and honestly separates evidence-supported from modeled findings.
"""

from __future__ import annotations

import logging

from mapper.archetype_library import (
    ARCHETYPE_REGISTRY,
    find_best_archetype,
    get_archetype,
)
from models.schemas import (
    ActivationEvent,
    AlternateModel,
    ClassifierOutput,
    ConductionSystem,
    DisplayContract,
    ECGMetadata,
    InjuryCurrentRegion,
    Interpretation,
    Measurements,
    PropagationVector,
    Repolarization,
    Uncertainty,
    VisualizationParameterJSON,
)

logger = logging.getLogger(__name__)


def build_visualization_parameters(
    classifier_output: ClassifierOutput,
    measurements: Measurements,
    metadata: ECGMetadata,
    session_id: str | None = None,
) -> VisualizationParameterJSON:
    """
    Build the complete VisualizationParameterJSON from classifier and measurement data.

    This is the main entry point for the parameter builder.
    """
    # Step 1: Select best-fit archetype
    primary_finding_key = _extract_finding_key(classifier_output)
    archetype_id = find_best_archetype(primary_finding_key)
    archetype = get_archetype(archetype_id)

    if archetype is None:
        archetype_id = "normal_sinus"
        archetype = ARCHETYPE_REGISTRY["normal_sinus"]
        logger.warning(f"No archetype found for '{primary_finding_key}'; using normal_sinus")

    # Step 2: Build activation sequence from archetype
    activation_sequence = _build_activation_sequence(archetype)

    # Step 3: Build conduction system state
    conduction = _build_conduction_system(archetype, classifier_output, measurements)

    # Step 4: Build repolarization data from measurements
    repolarization = _build_repolarization(measurements)

    # Step 5: Build interpretation
    interpretation = Interpretation(
        primary_diagnosis=classifier_output.primary_finding,
        differentials=classifier_output.differentials,
        rhythm=classifier_output.rhythm,
        conduction_abnormalities=classifier_output.conduction_abnormalities,
    )

    # Step 6: Build uncertainty model
    uncertainty = _build_uncertainty(classifier_output, measurements, archetype_id)

    # Step 7: Build display contract
    display_contract = _build_display_contract(
        measurements, classifier_output, archetype_id
    )

    return VisualizationParameterJSON(
        session_id=session_id,
        ecg_metadata=metadata,
        measurements=measurements,
        interpretation=interpretation,
        activation_sequence=activation_sequence,
        conduction_system=conduction,
        repolarization=repolarization,
        mechanical_archetype=archetype_id,
        uncertainty=uncertainty,
        display_contract=display_contract,
    )


def _extract_finding_key(classifier_output: ClassifierOutput) -> str:
    """
    Extract a normalized finding key from the classifier output.

    Maps the verbose display name back to a simple key for archetype lookup.
    """
    # Build a reverse mapping from display names to keys
    display_to_key = {
        "Normal sinus rhythm": "normal_sinus",
        "Pattern consistent with sinus tachycardia": "sinus_tachycardia",
        "Pattern consistent with sinus bradycardia": "sinus_bradycardia",
        "Pattern consistent with atrial fibrillation": "atrial_fibrillation",
        "Pattern consistent with atrial flutter": "atrial_flutter",
        "Pattern consistent with supraventricular tachycardia": "svt",
        "Pattern consistent with right bundle branch block": "rbbb",
        "Pattern consistent with left bundle branch block": "lbbb",
        "Pattern consistent with left anterior fascicular block": "lafb",
        "Pattern consistent with left posterior fascicular block": "lpfb",
        "Pattern consistent with first degree AV block": "first_degree_av_block",
        "Finding suggestive of second degree AV block, Mobitz type I (Wenckebach)": "second_degree_mobitz_i",
        "Finding suggestive of second degree AV block, Mobitz type II": "second_degree_mobitz_ii",
        "Pattern consistent with third degree (complete) AV block": "third_degree_av_block",
        "Pattern consistent with Wolff-Parkinson-White": "wpw",
        "Finding suggestive of left ventricular hypertrophy": "lvh",
        "Finding suggestive of right ventricular hypertrophy": "rvh",
        "Pattern consistent with acute inferior ST-elevation myocardial injury": "inferior_stemi",
        "Pattern consistent with acute anterior ST-elevation myocardial injury": "anterior_stemi",
        "Pattern consistent with acute lateral ST-elevation myocardial injury": "lateral_stemi",
        "Pattern consistent with acute posterior ST-elevation myocardial injury": "posterior_stemi",
        "Pattern consistent with non-ST-elevation myocardial injury": "nstemi",
        "Pattern consistent with early repolarization": "early_repolarization",
        "Pattern consistent with pericarditis": "pericarditis",
        "Pattern consistent with digitalis effect": "digitalis_effect",
        "Pattern consistent with hypokalemia": "hypokalemia",
        "Pattern consistent with hyperkalemia": "hyperkalemia",
    }

    return display_to_key.get(classifier_output.primary_finding, "normal_sinus")


def _build_activation_sequence(archetype) -> list[ActivationEvent]:
    """Convert archetype activation steps to ActivationEvent objects."""
    events = []
    for step in archetype.activation_sequence:
        dx, dy, dz = step.propagation_direction
        events.append(ActivationEvent(
            structure_name=step.structure,
            onset_ms=step.onset_ms,
            offset_ms=step.offset_ms,
            propagation_direction_vector=PropagationVector(x=dx, y=dy, z=dz),
            confidence=0.7,  # Archetype-based = modeled, not directly measured
        ))
    return events


def _build_conduction_system(
    archetype,
    classifier_output: ClassifierOutput,
    measurements: Measurements,
) -> ConductionSystem:
    """Build conduction system state from archetype and measurements."""
    delays = archetype.conduction_delays
    conduction_findings = set(classifier_output.conduction_abnormalities)

    # SA node rate
    sa_rate = measurements.rate.value if measurements.rate.value > 0 else None

    # AV node delay
    av_delay = delays.get("av_node", 120)
    if measurements.pr_interval is not None and measurements.pr_interval.value > 0:
        av_delay = measurements.pr_interval.value  # Use measured value

    # Bundle branch status
    lbbb = any("left bundle branch" in f.lower() for f in conduction_findings)
    rbbb = any("right bundle branch" in f.lower() for f in conduction_findings)
    wpw = any("wolff-parkinson-white" in f.lower() for f in conduction_findings)

    accessory_vector = None
    if wpw:
        # Default accessory pathway vector (left lateral)
        accessory_vector = PropagationVector(x=-1.0, y=0.0, z=0.0)

    return ConductionSystem(
        sa_node_rate=sa_rate,
        internodal_tracts_intact=True,
        av_node_delay_ms=av_delay,
        his_bundle_intact=not (lbbb and rbbb),  # Intact unless bifascicular
        lbbb=lbbb,
        rbbb=rbbb,
        wpw=wpw,
        accessory_pathway_vector=accessory_vector,
    )


def _build_repolarization(measurements: Measurements) -> Repolarization:
    """Build repolarization data from ST and T wave measurements."""
    st_by_lead = {}
    for st in measurements.st_deviations:
        st_by_lead[st.lead_name] = st.deviation_mv

    # T wave axis (approximate from T wave polarities)
    t_axis = _estimate_t_wave_axis(measurements)

    # Repolarization gradient (simplified)
    gradient_map = {}
    for tw in measurements.t_wave_details:
        if tw.amplitude_mv is not None:
            gradient_map[tw.lead_name] = abs(tw.amplitude_mv)

    # Injury current regions
    injury_regions = _detect_injury_regions(measurements)

    return Repolarization(
        st_deviation_by_lead=st_by_lead,
        t_wave_axis=t_axis,
        repolarization_gradient_map=gradient_map,
        injury_current_regions=injury_regions,
    )


def _estimate_t_wave_axis(measurements: Measurements) -> float | None:
    """Estimate T wave axis from T wave polarities in limb leads."""
    # Simplified: if T upright in I and aVF, axis is ~45 degrees
    t_i = None
    t_avf = None

    for tw in measurements.t_wave_details:
        if tw.lead_name == "I":
            t_i = tw.amplitude_mv
        elif tw.lead_name == "aVF":
            t_avf = tw.amplitude_mv

    if t_i is not None and t_avf is not None:
        import math
        return round(math.degrees(math.atan2(t_avf, t_i)), 1)

    return None


def _detect_injury_regions(measurements: Measurements) -> list[InjuryCurrentRegion]:
    """Detect injury current regions from significant ST elevation."""
    regions = []

    # Check inferior
    inferior_leads = ["II", "III", "aVF"]
    inf_elevations = [
        st.deviation_mv for st in measurements.st_deviations
        if st.lead_name in inferior_leads and st.deviation_mv > 0.1
    ]
    if len(inf_elevations) >= 2:
        regions.append(InjuryCurrentRegion(
            location="inferior",
            magnitude_mv=round(max(inf_elevations), 3),
        ))

    # Check anterior
    anterior_leads = ["V1", "V2", "V3", "V4"]
    ant_elevations = [
        st.deviation_mv for st in measurements.st_deviations
        if st.lead_name in anterior_leads and st.deviation_mv > 0.1
    ]
    if len(ant_elevations) >= 2:
        regions.append(InjuryCurrentRegion(
            location="anterior",
            magnitude_mv=round(max(ant_elevations), 3),
        ))

    # Check lateral
    lateral_leads = ["I", "aVL", "V5", "V6"]
    lat_elevations = [
        st.deviation_mv for st in measurements.st_deviations
        if st.lead_name in lateral_leads and st.deviation_mv > 0.1
    ]
    if len(lat_elevations) >= 2:
        regions.append(InjuryCurrentRegion(
            location="lateral",
            magnitude_mv=round(max(lat_elevations), 3),
        ))

    return regions


def _build_uncertainty(
    classifier_output: ClassifierOutput,
    measurements: Measurements,
    archetype_id: str,
) -> Uncertainty:
    """
    Build uncertainty model.

    Identifies underdetermined parameters and alternate models
    where the ECG data is insufficient to resolve ambiguity.
    """
    underdetermined = []
    alternates = []

    # Underdetermined parameters
    if measurements.rate.confidence < 0.5:
        underdetermined.append("Heart rate — low confidence in R peak detection")

    if measurements.pr_interval is None:
        underdetermined.append("PR interval — could not be measured")

    if measurements.qrs_duration.confidence < 0.5:
        underdetermined.append("QRS duration — low confidence in onset/offset detection")

    if measurements.qt_interval.confidence < 0.5:
        underdetermined.append("QT interval — T wave end detection uncertain")

    if measurements.axis_degrees.confidence < 0.5:
        underdetermined.append("Electrical axis — low confidence measurement")

    # Always flag the internal activation sequence as modeled
    underdetermined.append(
        "Internal activation sequence — reconstructed from surface ECG; "
        "intracardiac mapping would provide direct measurement"
    )

    # Alternate models based on differential diagnoses
    if len(classifier_output.differentials) >= 2:
        top = classifier_output.differentials[0]
        second = classifier_output.differentials[1]

        if second.probability >= 0.3:
            alternates.append(AlternateModel(
                description=f"Alternate interpretation: {second.name} "
                           f"(probability {second.probability:.0%})",
                discriminating_test=second.recommended_discriminating_tests[0]
                    if second.recommended_discriminating_tests
                    else "Clinical correlation required",
            ))

    # Common diagnostic dilemmas
    # STEMI vs early repolarization
    stemi_found = any("STEMI" in d.name or "ST-elevation" in d.name
                      for d in classifier_output.differentials if d.probability > 0.3)
    early_repol = any("early repolarization" in d.name
                      for d in classifier_output.differentials if d.probability > 0.2)
    if stemi_found and early_repol:
        alternates.append(AlternateModel(
            description="ST elevation may represent either acute injury or benign "
                       "early repolarization — these cannot be reliably distinguished "
                       "by ECG alone in all cases",
            discriminating_test="Serial ECGs, troponin levels, and clinical presentation",
        ))

    # Pericarditis vs STEMI
    pericarditis = any("pericarditis" in d.name
                       for d in classifier_output.differentials if d.probability > 0.2)
    if stemi_found and pericarditis:
        alternates.append(AlternateModel(
            description="Diffuse ST elevation pattern may represent either "
                       "pericarditis or multi-territory ischemia",
            discriminating_test="PR depression pattern, spodick sign, troponin trend, echo",
        ))

    return Uncertainty(
        underdetermined_parameters=underdetermined,
        alternate_models=alternates,
    )


def _build_display_contract(
    measurements: Measurements,
    classifier_output: ClassifierOutput,
    archetype_id: str,
) -> DisplayContract:
    """
    Honest separation of what is evidence-supported vs modeled.

    Evidence-supported: directly derived from ECG signal.
    Modeled assumption: inferred from archetype or assumed.
    """
    evidence_supported = []
    modeled_assumption = []

    # Rate and rhythm — directly measured
    if measurements.rate.confidence > 0.3:
        evidence_supported.append(
            f"Heart rate: {measurements.rate.value} bpm "
            f"(confidence {measurements.rate.confidence:.0%})"
        )

    if measurements.rhythm_description:
        evidence_supported.append(f"Rhythm: {measurements.rhythm_description}")

    # PR interval
    if measurements.pr_interval and measurements.pr_interval.confidence > 0.3:
        evidence_supported.append(
            f"PR interval: {measurements.pr_interval.value} ms"
        )

    # QRS duration
    if measurements.qrs_duration.confidence > 0.3:
        evidence_supported.append(
            f"QRS duration: {measurements.qrs_duration.value} ms"
        )

    # QT/QTc
    if measurements.qt_interval.confidence > 0.3:
        evidence_supported.append(
            f"QT: {measurements.qt_interval.value} ms, "
            f"QTc (Bazett): {measurements.qtc_bazett.value} ms"
        )

    # Axis
    if measurements.axis_degrees.confidence > 0.3:
        evidence_supported.append(
            f"Axis: {measurements.axis_degrees.value}° ({measurements.axis_quadrant})"
        )

    # ST deviations — directly measured
    significant_st = [st for st in measurements.st_deviations if abs(st.deviation_mv) > 0.05]
    if significant_st:
        st_summary = ", ".join(
            f"{st.lead_name}: {st.deviation_mv:+.2f}mV" for st in significant_st[:6]
        )
        evidence_supported.append(f"ST deviations: {st_summary}")

    # Voltage criteria
    if measurements.lvh_voltage_criteria:
        evidence_supported.append(f"LVH voltage criteria: {measurements.lvh_criteria_detail}")
    if measurements.rvh_voltage_criteria:
        evidence_supported.append(f"RVH voltage criteria: {measurements.rvh_criteria_detail}")

    # Primary finding — from classifier
    evidence_supported.append(f"Primary finding: {classifier_output.primary_finding}")

    # Modeled assumptions
    modeled_assumption.append(
        f"Activation sequence: modeled from '{archetype_id}' archetype — "
        "represents a teaching reconstruction, not direct measurement"
    )
    modeled_assumption.append(
        "Conduction system state: inferred from surface ECG patterns; "
        "intracardiac recordings would provide direct confirmation"
    )
    modeled_assumption.append(
        "Propagation direction vectors: approximate based on standard "
        "cardiac anatomy; actual propagation varies with individual anatomy"
    )

    if any(st for st in measurements.st_deviations if abs(st.deviation_mv) > 0.1):
        modeled_assumption.append(
            "Injury current localization: based on standard lead-territory mapping; "
            "actual coronary anatomy varies between individuals"
        )

    return DisplayContract(
        evidence_supported=evidence_supported,
        modeled_assumption=modeled_assumption,
    )
