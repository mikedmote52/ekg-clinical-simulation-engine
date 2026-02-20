"""
Electromechanical archetype library.

Each archetype defines how a cardiac condition maps to activation sequences,
conduction delays, and mechanical behavior for 3D visualization.

All archetypes are explanatory reconstructions — they illustrate the
electrophysiologic mechanism, not reproduce the exact internal state.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ActivationStep:
    """A single step in the activation sequence."""
    structure: str
    onset_ms: float
    offset_ms: float
    propagation_direction: tuple[float, float, float] = (0.0, 0.0, 1.0)
    label: str = ""


@dataclass
class Archetype:
    """Electromechanical archetype for visualization."""
    archetype_id: str
    display_name: str
    activation_sequence: list[ActivationStep]
    conduction_delays: dict[str, float]
    mechanical_label: str
    teaching_note: str
    is_explanatory_reconstruction: bool = True
    tags: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialize to dictionary for JSON output."""
        return {
            "archetype_id": self.archetype_id,
            "display_name": self.display_name,
            "activation_sequence": [
                {
                    "structure": s.structure,
                    "onset_ms": s.onset_ms,
                    "offset_ms": s.offset_ms,
                    "propagation_direction": list(s.propagation_direction),
                    "label": s.label,
                }
                for s in self.activation_sequence
            ],
            "conduction_delays": self.conduction_delays,
            "mechanical_label": self.mechanical_label,
            "teaching_note": self.teaching_note,
            "is_explanatory_reconstruction": self.is_explanatory_reconstruction,
            "tags": self.tags,
        }


# ---------------------------------------------------------------------------
# Archetype definitions
# ---------------------------------------------------------------------------

NORMAL_SINUS = Archetype(
    archetype_id="normal_sinus",
    display_name="Normal Sinus Rhythm",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Right atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Left atrial depolarization"),
        ActivationStep("av_node", 80, 200, (0, 0, -1), "AV node delay"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle conduction"),
        ActivationStep("left_bundle", 220, 235, (-1, 0, -1), "Left bundle branch"),
        ActivationStep("right_bundle", 220, 240, (1, 0, -1), "Right bundle branch"),
        ActivationStep("interventricular_septum", 240, 270, (1, 0, 0),
                        "Septal activation (left to right)"),
        ActivationStep("lv_free_wall", 270, 320, (-1, 0, 0), "LV free wall activation"),
        ActivationStep("rv_free_wall", 270, 310, (1, 0, 0), "RV free wall activation"),
        ActivationStep("lv_base", 300, 340, (0, 1, 0), "LV base — last to depolarize"),
    ],
    conduction_delays={
        "av_node": 120,
        "his_bundle": 20,
        "left_bundle": 15,
        "right_bundle": 20,
    },
    mechanical_label="Synchronized biventricular contraction with normal AV delay",
    teaching_note="Normal activation begins at the SA node and propagates through the "
                  "conduction system, producing synchronized ventricular contraction.",
    tags=["normal", "baseline"],
)

RBBB_TYPICAL = Archetype(
    archetype_id="RBBB_typical",
    display_name="Right Bundle Branch Block",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Right atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Left atrial depolarization"),
        ActivationStep("av_node", 80, 200, (0, 0, -1), "AV node delay"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle conduction"),
        ActivationStep("left_bundle", 220, 235, (-1, 0, -1), "Left bundle — intact"),
        # Right bundle is blocked — RV activated via myocardial spread
        ActivationStep("interventricular_septum", 240, 270, (1, 0, 0),
                        "Normal septal activation (left to right)"),
        ActivationStep("lv_free_wall", 270, 320, (-1, 0, 0), "Normal LV activation"),
        ActivationStep("rv_free_wall", 320, 400, (1, 0, 0),
                        "Delayed RV activation via cell-to-cell conduction"),
    ],
    conduction_delays={
        "av_node": 120,
        "his_bundle": 20,
        "left_bundle": 15,
        "right_bundle": -1,  # Blocked
        "rv_myocardial_spread": 80,
    },
    mechanical_label="LV contracts normally; RV contraction is delayed, producing "
                     "dyssynchronous activation visible as RSR' in V1",
    teaching_note="In RBBB, the right ventricle is activated late via slow myocardial "
                  "spread from the left side, producing the characteristic RSR' pattern in V1.",
    tags=["conduction", "bundle_branch_block"],
)

LBBB_TYPICAL = Archetype(
    archetype_id="LBBB_typical",
    display_name="Left Bundle Branch Block",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Atrial depolarization"),
        ActivationStep("av_node", 80, 200, (0, 0, -1), "AV node delay"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle conduction"),
        ActivationStep("right_bundle", 220, 240, (1, 0, -1), "Right bundle — intact"),
        # Left bundle is blocked — LV activated via myocardial spread
        ActivationStep("interventricular_septum", 240, 280, (-1, 0, 0),
                        "Reversed septal activation (right to left)"),
        ActivationStep("rv_free_wall", 250, 290, (1, 0, 0), "Normal RV activation"),
        ActivationStep("lv_free_wall", 300, 400, (-1, 0, 0),
                        "Delayed LV activation via cell-to-cell conduction"),
        ActivationStep("lv_base", 380, 440, (0, 1, 0), "Very late LV base activation"),
    ],
    conduction_delays={
        "av_node": 120,
        "his_bundle": 20,
        "left_bundle": -1,  # Blocked
        "right_bundle": 20,
        "lv_myocardial_spread": 100,
    },
    mechanical_label="RV contracts first; LV activation is severely delayed, producing "
                     "mechanical dyssynchrony that may benefit from CRT",
    teaching_note="In LBBB, the LV septum is activated right-to-left (reversed) and the "
                  "LV free wall is activated late via slow myocardial spread.",
    tags=["conduction", "bundle_branch_block"],
)

LAFB = Archetype(
    archetype_id="LAFB",
    display_name="Left Anterior Fascicular Block",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Atrial depolarization"),
        ActivationStep("av_node", 80, 200, (0, 0, -1), "AV node delay"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle conduction"),
        ActivationStep("right_bundle", 220, 240, (1, 0, -1), "Right bundle — intact"),
        ActivationStep("left_posterior_fascicle", 220, 250, (-1, 0, -1),
                        "Left posterior fascicle — intact, activates first"),
        # Anterior fascicle blocked: anterior LV wall activated late
        ActivationStep("lv_free_wall", 250, 290, (-1, 1, 0),
                        "Inferior-to-superior LV activation"),
        ActivationStep("lv_base", 280, 320, (0, 1, 0),
                        "Superior LV wall activated last (produces left axis)"),
    ],
    conduction_delays={
        "av_node": 120,
        "his_bundle": 20,
        "left_anterior_fascicle": -1,  # Blocked
        "left_posterior_fascicle": 15,
        "right_bundle": 20,
    },
    mechanical_label="Activation proceeds inferior-to-superior through the LV, "
                     "shifting the axis leftward",
    teaching_note="In LAFB, the anterolateral LV is activated last via the posterior "
                  "fascicle, producing marked left axis deviation.",
    tags=["conduction", "fascicular_block"],
)

INFERIOR_STEMI_EXPLANATORY = Archetype(
    archetype_id="inferior_STEMI_explanatory",
    display_name="Inferior STEMI — Explanatory Reconstruction",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Atrial depolarization"),
        ActivationStep("av_node", 80, 200, (0, 0, -1), "AV node delay"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle conduction"),
        ActivationStep("interventricular_septum", 240, 270, (1, 0, 0), "Septal activation"),
        ActivationStep("lv_free_wall", 270, 320, (-1, 0, 0), "LV activation"),
        # Injured region: inferior wall shows injury current
        ActivationStep("lv_apex", 270, 340, (0, -1, 0),
                        "Inferior wall — zone of injury with ST current"),
    ],
    conduction_delays={
        "av_node": 120,
        "his_bundle": 20,
        "left_bundle": 15,
        "right_bundle": 20,
    },
    mechanical_label="Inferior wall injury current visible as ST elevation in II, III, aVF; "
                     "mechanical hypokinesis of inferior segments",
    teaching_note="Inferior STEMI typically results from right coronary artery occlusion, "
                  "producing injury current that points toward the inferior leads.",
    tags=["ischemia", "stemi", "inferior"],
)

ANTERIOR_STEMI_EXPLANATORY = Archetype(
    archetype_id="anterior_STEMI_explanatory",
    display_name="Anterior STEMI — Explanatory Reconstruction",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Atrial depolarization"),
        ActivationStep("av_node", 80, 200, (0, 0, -1), "AV node delay"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle conduction"),
        ActivationStep("interventricular_septum", 240, 280, (1, 0, 0),
                        "Septal activation — zone of injury"),
        ActivationStep("lv_free_wall", 270, 330, (-1, 0, 0),
                        "Anterior wall — extensive injury current"),
    ],
    conduction_delays={
        "av_node": 120,
        "his_bundle": 20,
        "left_bundle": 15,
        "right_bundle": 20,
    },
    mechanical_label="Anterior and septal wall injury current with ST elevation in V1-V4; "
                     "anterior wall hypokinesis",
    teaching_note="Anterior STEMI results from LAD occlusion, affecting the septum and "
                  "anterior wall — often the largest territory at risk.",
    tags=["ischemia", "stemi", "anterior"],
)

AFIB_TYPICAL = Archetype(
    archetype_id="afib_typical",
    display_name="Atrial Fibrillation",
    activation_sequence=[
        # No organized SA node activity — chaotic atrial activation
        ActivationStep("right_atrium", 0, 600, (0, 0, 0),
                        "Chaotic multifocal atrial activation"),
        ActivationStep("left_atrium", 0, 600, (0, 0, 0),
                        "Fibrillatory atrial activity"),
        # Random AV conduction
        ActivationStep("av_node", 80, 200, (0, 0, -1),
                        "Irregular AV conduction — rate depends on AV node properties"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle"),
        ActivationStep("left_bundle", 220, 235, (-1, 0, -1), "Left bundle"),
        ActivationStep("right_bundle", 220, 240, (1, 0, -1), "Right bundle"),
        ActivationStep("interventricular_septum", 240, 270, (1, 0, 0), "Septal activation"),
        ActivationStep("lv_free_wall", 270, 320, (-1, 0, 0), "LV activation"),
        ActivationStep("rv_free_wall", 270, 310, (1, 0, 0), "RV activation"),
    ],
    conduction_delays={
        "av_node": 120,  # Variable in reality
        "his_bundle": 20,
        "left_bundle": 15,
        "right_bundle": 20,
    },
    mechanical_label="No organized atrial contraction; irregular ventricular response; "
                     "loss of atrial kick reduces cardiac output by ~15-25%",
    teaching_note="In atrial fibrillation, the atria depolarize chaotically with no "
                  "organized P waves; the AV node filters irregularly, producing an "
                  "irregularly irregular ventricular rhythm.",
    tags=["arrhythmia", "atrial"],
)

THIRD_DEGREE_BLOCK = Archetype(
    archetype_id="third_degree_block",
    display_name="Third Degree (Complete) AV Block",
    activation_sequence=[
        # Atrial rhythm (SA node drives atria)
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires normally"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Normal atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Normal atrial depolarization"),
        # Complete AV block — no conduction to ventricles
        # Escape rhythm from His bundle or below
        ActivationStep("his_bundle", 600, 620, (0, 0, -1),
                        "Escape pacemaker (junctional or ventricular)"),
        ActivationStep("left_bundle", 620, 640, (-1, 0, -1), "Escape conduction"),
        ActivationStep("right_bundle", 620, 645, (1, 0, -1), "Escape conduction"),
        ActivationStep("interventricular_septum", 640, 680, (1, 0, 0), "Escape activation"),
        ActivationStep("lv_free_wall", 680, 740, (-1, 0, 0), "Escape activation"),
        ActivationStep("rv_free_wall", 680, 730, (1, 0, 0), "Escape activation"),
    ],
    conduction_delays={
        "av_node": -1,  # Complete block
        "escape_interval": 600,
    },
    mechanical_label="Atria and ventricles beat independently; ventricular rate 30-50 bpm "
                     "from escape pacemaker; hemodynamically compromised",
    teaching_note="In complete heart block, no atrial impulses reach the ventricles; "
                  "the ventricles are driven by an escape rhythm below the block.",
    tags=["conduction", "heart_block", "emergency"],
)

WPW_TYPICAL = Archetype(
    archetype_id="WPW_typical",
    display_name="Wolff-Parkinson-White Pattern",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Atrial depolarization"),
        ActivationStep("left_atrium", 30, 100, (-1, -1, 0), "Atrial depolarization"),
        # Accessory pathway conducts FASTER than AV node (no delay)
        ActivationStep("lv_free_wall", 80, 140, (-1, 0, 0),
                        "Early ventricular activation via accessory pathway (delta wave)"),
        # Normal AV node also conducts (fusion)
        ActivationStep("av_node", 80, 200, (0, 0, -1), "Normal AV conduction (slower)"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle"),
        ActivationStep("interventricular_septum", 220, 260, (1, 0, 0),
                        "Normal pathway catches up — fusion complex"),
        ActivationStep("rv_free_wall", 260, 300, (1, 0, 0), "RV activation"),
    ],
    conduction_delays={
        "av_node": 120,
        "accessory_pathway": 0,  # No delay!
        "his_bundle": 20,
    },
    mechanical_label="Pre-excitation of ventricular myocardium via accessory pathway "
                     "produces delta wave and short PR interval",
    teaching_note="In WPW, an accessory pathway bypasses the AV node, causing early "
                  "ventricular activation (delta wave) with a short PR interval.",
    tags=["conduction", "pre_excitation", "accessory_pathway"],
)

LVH_TYPICAL = Archetype(
    archetype_id="LVH_typical",
    display_name="Left Ventricular Hypertrophy",
    activation_sequence=[
        ActivationStep("sa_node", 0, 5, (0, -1, 0), "SA node fires"),
        ActivationStep("right_atrium", 5, 80, (0, -1, 0.5), "Atrial depolarization"),
        ActivationStep("left_atrium", 30, 110, (-1, -1, 0),
                        "Left atrial depolarization — may be prolonged"),
        ActivationStep("av_node", 80, 200, (0, 0, -1), "AV node delay"),
        ActivationStep("his_bundle", 200, 220, (0, 0, -1), "His bundle"),
        ActivationStep("left_bundle", 220, 235, (-1, 0, -1), "Left bundle"),
        ActivationStep("right_bundle", 220, 240, (1, 0, -1), "Right bundle"),
        ActivationStep("interventricular_septum", 240, 270, (1, 0, 0), "Septal activation"),
        ActivationStep("rv_free_wall", 270, 310, (1, 0, 0), "RV activation"),
        ActivationStep("lv_free_wall", 270, 350, (-1, 0, 0),
                        "LV activation — prolonged due to increased muscle mass"),
        ActivationStep("lv_base", 330, 380, (0, 1, 0),
                        "Late LV base — thickened wall takes longer to activate"),
    ],
    conduction_delays={
        "av_node": 120,
        "his_bundle": 20,
        "left_bundle": 15,
        "right_bundle": 20,
        "lv_wall_prolongation": 30,
    },
    mechanical_label="Increased LV mass produces higher voltage QRS complexes and "
                     "may show strain pattern (ST depression, T inversion) in lateral leads",
    teaching_note="LVH increases the electrical vector magnitude toward the left ventricle, "
                  "producing tall R waves in lateral leads and deep S waves in right precordial leads.",
    tags=["structural", "hypertrophy"],
)


# ---------------------------------------------------------------------------
# Library access
# ---------------------------------------------------------------------------

ARCHETYPE_REGISTRY: dict[str, Archetype] = {
    "normal_sinus": NORMAL_SINUS,
    "RBBB_typical": RBBB_TYPICAL,
    "LBBB_typical": LBBB_TYPICAL,
    "LAFB": LAFB,
    "inferior_STEMI_explanatory": INFERIOR_STEMI_EXPLANATORY,
    "anterior_STEMI_explanatory": ANTERIOR_STEMI_EXPLANATORY,
    "afib_typical": AFIB_TYPICAL,
    "third_degree_block": THIRD_DEGREE_BLOCK,
    "WPW_typical": WPW_TYPICAL,
    "LVH_typical": LVH_TYPICAL,
}


def get_archetype(archetype_id: str) -> Archetype | None:
    """Look up an archetype by ID."""
    return ARCHETYPE_REGISTRY.get(archetype_id)


def list_archetypes() -> list[str]:
    """Return all available archetype IDs."""
    return list(ARCHETYPE_REGISTRY.keys())


def find_best_archetype(finding_name: str) -> str:
    """
    Map a classifier finding name to the best-fit archetype ID.

    Falls back to 'normal_sinus' if no match is found.
    """
    FINDING_TO_ARCHETYPE = {
        "normal_sinus": "normal_sinus",
        "sinus_tachycardia": "normal_sinus",
        "sinus_bradycardia": "normal_sinus",
        "atrial_fibrillation": "afib_typical",
        "atrial_flutter": "afib_typical",  # Closest available
        "svt": "normal_sinus",
        "rbbb": "RBBB_typical",
        "lbbb": "LBBB_typical",
        "lafb": "LAFB",
        "lpfb": "normal_sinus",  # No specific archetype yet
        "first_degree_av_block": "normal_sinus",
        "second_degree_mobitz_i": "normal_sinus",
        "second_degree_mobitz_ii": "third_degree_block",  # Closest
        "third_degree_av_block": "third_degree_block",
        "wpw": "WPW_typical",
        "lvh": "LVH_typical",
        "rvh": "normal_sinus",
        "inferior_stemi": "inferior_STEMI_explanatory",
        "anterior_stemi": "anterior_STEMI_explanatory",
        "lateral_stemi": "anterior_STEMI_explanatory",  # Closest
        "posterior_stemi": "inferior_STEMI_explanatory",  # Closest
        "nstemi": "normal_sinus",
        "early_repolarization": "normal_sinus",
        "pericarditis": "normal_sinus",
        "digitalis_effect": "normal_sinus",
        "hypokalemia": "normal_sinus",
        "hyperkalemia": "normal_sinus",
    }

    return FINDING_TO_ARCHETYPE.get(finding_name, "normal_sinus")
