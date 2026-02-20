"""
Adapter: converts the internal VisualizationParameterJSON
to the frontend's TypeScript VisualizationParameterJSON shape.

See: apps/web/src/types/visualizationParams.ts

Frontend shape:
{
  cardiac_cycle_duration_ms: number,
  activation_sequence: [{ structure_id, onset_ms, duration_ms }],
  conduction_system?: { sequence: [{ structure, onset_ms, duration_ms }], lbbb? },
  repolarization?: { injury_current_regions: [{ territory, label? }] },
  display_contract: { evidence_supported: [], modeled_assumption: [] },
  uncertainty?: { alternate_models: [{ id, label, probability?, viz_params? }] },
  intervals?: { pr_ms?, qrs_ms?, qt_ms? },
  primary_diagnosis: string,
  differentials?: [{ id, label, probability_tier, supporting_criteria?, discriminating_tests? }],
  waveforms?: Record<string, { time_ms: number[], amplitude_mv: number[] }>,
  phase_boundaries?: { p_wave?, pr_segment?, qrs?, st_segment?, t_wave? }
}
"""

from __future__ import annotations

import logging
from typing import Any

from agents.orchestrator import PipelineResult

logger = logging.getLogger(__name__)


def adapt_to_frontend_viz_params(result: PipelineResult) -> dict[str, Any]:
    """
    Convert internal PipelineResult to the frontend's VisualizationParameterJSON.
    """
    viz = result.visualization
    m = viz.measurements

    # --- cardiac_cycle_duration_ms ---
    # Derived from heart rate: 60000 / bpm
    rate = m.rate.value if m.rate.value > 0 else 72
    cardiac_cycle_ms = round(60000.0 / rate)

    # --- activation_sequence ---
    activation_sequence = []
    for event in viz.activation_sequence:
        activation_sequence.append({
            "structure_id": event.structure_name,
            "onset_ms": event.onset_ms,
            "duration_ms": round(event.offset_ms - event.onset_ms, 1),
        })

    # --- conduction_system ---
    cs = viz.conduction_system
    conduction_steps = []
    # Map internal structures to the frontend's union type
    structure_map = {
        "sa_node": "sa_node",
        "right_atrium": "internodal",
        "left_atrium": "internodal",
        "av_node": "av_node",
        "his_bundle": "his_bundle",
        "left_bundle": "left_bundle",
        "right_bundle": "right_bundle",
        "purkinje_lv": "purkinje",
        "purkinje_rv": "purkinje",
        "interventricular_septum": "purkinje",
        "lv_free_wall": "purkinje",
        "rv_free_wall": "purkinje",
    }
    for event in viz.activation_sequence:
        fe_structure = structure_map.get(event.structure_name)
        if fe_structure:
            conduction_steps.append({
                "structure": fe_structure,
                "onset_ms": event.onset_ms,
                "duration_ms": round(event.offset_ms - event.onset_ms, 1),
            })

    conduction_system = {
        "sequence": conduction_steps,
        "lbbb": cs.lbbb,
    }

    # --- repolarization ---
    repolarization = {
        "injury_current_regions": [
            {
                "territory": region.location,
                "label": f"{region.location} injury current ({region.magnitude_mv:+.2f} mV)",
            }
            for region in viz.repolarization.injury_current_regions
        ],
    }

    # --- display_contract ---
    display_contract = {
        "evidence_supported": viz.display_contract.evidence_supported,
        "modeled_assumption": viz.display_contract.modeled_assumption,
    }

    # --- uncertainty ---
    alternate_models = []
    for i, alt in enumerate(viz.uncertainty.alternate_models):
        alternate_models.append({
            "id": str(i + 1),
            "label": alt.description,
            "probability": None,
            "viz_params": {},
        })
    uncertainty = {"alternate_models": alternate_models}

    # --- intervals ---
    intervals = {
        "pr_ms": round(m.pr_interval.value) if m.pr_interval and m.pr_interval.value > 0 else None,
        "qrs_ms": round(m.qrs_duration.value) if m.qrs_duration.value > 0 else None,
        "qt_ms": round(m.qt_interval.value) if m.qt_interval.value > 0 else None,
    }

    # --- primary_diagnosis ---
    primary_diagnosis = viz.interpretation.primary_diagnosis

    # --- differentials ---
    # Frontend uses probability_tier: 'high' | 'medium' | 'low'
    tier_map = {"high": "high", "moderate": "medium", "possible": "low"}
    differentials = []
    for i, diff in enumerate(viz.interpretation.differentials):
        differentials.append({
            "id": str(i + 1),
            "label": diff.name,
            "probability_tier": tier_map.get(diff.probability_tier.value, "low"),
            "supporting_criteria": [
                c.criterion for c in diff.supporting_criteria if c.met
            ],
            "discriminating_tests": diff.recommended_discriminating_tests,
        })

    # --- waveforms ---
    # Include real digitized waveforms from the pipeline result
    waveforms: dict[str, dict] = {}
    if result.digitized_ecg:
        for lead in result.digitized_ecg.leads:
            if lead.failure_reason is None and len(lead.time_ms) > 1:
                waveforms[lead.lead_name] = {
                    "time_ms": lead.time_ms,
                    "amplitude_mv": lead.amplitude_mv,
                }

    # --- phase_boundaries ---
    # Compute from measurements — locate first beat's phases
    phase_boundaries = _compute_phase_boundaries(m, rate)

    # --- Assemble ---
    output: dict[str, Any] = {
        "cardiac_cycle_duration_ms": cardiac_cycle_ms,
        "activation_sequence": activation_sequence,
        "conduction_system": conduction_system,
        "repolarization": repolarization,
        "display_contract": display_contract,
        "uncertainty": uncertainty,
        "intervals": intervals,
        "primary_diagnosis": primary_diagnosis,
        "differentials": differentials,
    }

    if waveforms:
        output["waveforms"] = waveforms

    if phase_boundaries:
        output["phase_boundaries"] = phase_boundaries

    return output


def _compute_phase_boundaries(m, rate_bpm: float) -> dict | None:
    """
    Compute phase boundaries for a single cardiac cycle.

    Uses measured intervals to place P, PR, QRS, ST, T phases.
    """
    pr_ms = m.pr_interval.value if m.pr_interval and m.pr_interval.value > 0 else 160
    qrs_ms = m.qrs_duration.value if m.qrs_duration.value > 0 else 90
    qt_ms = m.qt_interval.value if m.qt_interval.value > 0 else 380

    # P wave: typically 80-120ms, starts at 0
    p_duration = min(pr_ms * 0.5, 120)
    p_start = 0
    p_end = p_duration

    # PR segment: from P end to QRS start
    pr_seg_start = p_end
    pr_seg_end = pr_ms

    # QRS: starts at PR end
    qrs_start = pr_ms
    qrs_end = pr_ms + qrs_ms

    # ST segment: from QRS end to T wave start
    # T wave typically starts ~60ms after QRS end
    st_start = qrs_end
    st_end = qrs_end + 60

    # T wave: from ST end to QT end (QT measured from QRS onset)
    t_start = st_end
    t_end = qt_ms  # QT is from QRS onset to T end, so T end = QRS onset + QT = pr_ms + qt_ms...
    # Actually QT is measured from QRS onset, so T end relative to cycle start:
    t_end = pr_ms + qt_ms

    return {
        "p_wave": {"start_ms": round(p_start), "end_ms": round(p_end)},
        "pr_segment": {"start_ms": round(pr_seg_start), "end_ms": round(pr_seg_end)},
        "qrs": {"start_ms": round(qrs_start), "end_ms": round(qrs_end)},
        "st_segment": {"start_ms": round(st_start), "end_ms": round(st_end)},
        "t_wave": {"start_ms": round(t_start), "end_ms": round(t_end)},
    }
