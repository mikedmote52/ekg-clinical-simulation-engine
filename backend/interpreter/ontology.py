"""
Cardiac anatomy ontology for mapping ECG findings to cardiac structures.

Maps electrical findings to anatomic structures for visualization.
"""

from __future__ import annotations

from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Cardiac structures
# ---------------------------------------------------------------------------

CARDIAC_STRUCTURES = {
    "sa_node": {
        "full_name": "Sinoatrial Node",
        "location": "right_atrium_superior",
        "function": "Primary pacemaker",
    },
    "right_atrium": {
        "full_name": "Right Atrium",
        "location": "right_atrium",
        "function": "Receives venous return",
    },
    "left_atrium": {
        "full_name": "Left Atrium",
        "location": "left_atrium",
        "function": "Receives pulmonary venous return",
    },
    "av_node": {
        "full_name": "Atrioventricular Node",
        "location": "interatrial_septum_inferior",
        "function": "Delays conduction to allow atrial emptying",
    },
    "his_bundle": {
        "full_name": "Bundle of His",
        "location": "interventricular_septum_superior",
        "function": "Rapid conduction to ventricles",
    },
    "left_bundle": {
        "full_name": "Left Bundle Branch",
        "location": "interventricular_septum_left",
        "function": "Conducts to left ventricle",
    },
    "left_anterior_fascicle": {
        "full_name": "Left Anterior Fascicle",
        "location": "lv_anterior_wall",
        "function": "Conducts to anterolateral LV",
    },
    "left_posterior_fascicle": {
        "full_name": "Left Posterior Fascicle",
        "location": "lv_posterior_wall",
        "function": "Conducts to posteroinferior LV",
    },
    "right_bundle": {
        "full_name": "Right Bundle Branch",
        "location": "interventricular_septum_right",
        "function": "Conducts to right ventricle",
    },
    "purkinje_lv": {
        "full_name": "Left Ventricular Purkinje Network",
        "location": "lv_endocardium",
        "function": "Rapid endocardial-to-epicardial activation of LV",
    },
    "purkinje_rv": {
        "full_name": "Right Ventricular Purkinje Network",
        "location": "rv_endocardium",
        "function": "Rapid endocardial-to-epicardial activation of RV",
    },
    "interventricular_septum": {
        "full_name": "Interventricular Septum",
        "location": "septum",
        "function": "First ventricular structure activated (left-to-right)",
    },
    "lv_free_wall": {
        "full_name": "Left Ventricular Free Wall",
        "location": "lv_lateral",
        "function": "Major contractile force",
    },
    "rv_free_wall": {
        "full_name": "Right Ventricular Free Wall",
        "location": "rv_lateral",
        "function": "Right ventricular contraction",
    },
    "lv_apex": {
        "full_name": "Left Ventricular Apex",
        "location": "lv_inferior_apex",
        "function": "Apical contraction",
    },
    "lv_base": {
        "full_name": "Left Ventricular Base",
        "location": "lv_superior",
        "function": "Last region to depolarize in normal conduction",
    },
}


# ---------------------------------------------------------------------------
# Lead-to-territory mapping
# ---------------------------------------------------------------------------

LEAD_TERRITORY_MAP = {
    # Inferior leads
    "II": ["inferior_wall", "right_coronary_territory"],
    "III": ["inferior_wall", "right_coronary_territory"],
    "aVF": ["inferior_wall", "right_coronary_territory"],
    # Lateral leads
    "I": ["lateral_wall", "left_circumflex_territory"],
    "aVL": ["lateral_wall", "left_circumflex_territory"],
    "V5": ["lateral_wall", "left_circumflex_territory"],
    "V6": ["lateral_wall", "left_circumflex_territory"],
    # Anteroseptal leads
    "V1": ["septal_wall", "left_anterior_descending_territory"],
    "V2": ["septal_wall", "left_anterior_descending_territory"],
    # Anterior leads
    "V3": ["anterior_wall", "left_anterior_descending_territory"],
    "V4": ["anterior_wall", "left_anterior_descending_territory"],
    # Right-sided
    "aVR": ["global_cavity", "non_localizing"],
}


# ---------------------------------------------------------------------------
# Normal conduction timing (ms from SA node depolarization)
# ---------------------------------------------------------------------------

NORMAL_CONDUCTION_TIMING = {
    "sa_node": (0, 5),
    "right_atrium": (5, 80),
    "left_atrium": (30, 100),
    "av_node": (80, 200),       # includes physiologic delay
    "his_bundle": (200, 220),
    "left_bundle": (220, 235),
    "right_bundle": (220, 240),
    "left_anterior_fascicle": (235, 250),
    "left_posterior_fascicle": (235, 255),
    "interventricular_septum": (240, 270),
    "purkinje_lv": (250, 280),
    "purkinje_rv": (245, 280),
    "lv_apex": (270, 300),
    "rv_free_wall": (270, 310),
    "lv_free_wall": (280, 320),
    "lv_base": (300, 340),
}


def get_affected_structures(lead_name: str) -> list[str]:
    """Get cardiac structures corresponding to a lead territory."""
    territories = LEAD_TERRITORY_MAP.get(lead_name, [])
    structures = []

    territory_to_structure = {
        "inferior_wall": ["lv_apex", "lv_free_wall"],
        "lateral_wall": ["lv_free_wall", "lv_base"],
        "anterior_wall": ["interventricular_septum", "lv_free_wall"],
        "septal_wall": ["interventricular_septum", "rv_free_wall"],
        "right_coronary_territory": ["right_atrium", "av_node", "rv_free_wall"],
        "left_circumflex_territory": ["left_atrium", "lv_free_wall"],
        "left_anterior_descending_territory": ["interventricular_septum", "lv_apex", "lv_free_wall"],
    }

    for territory in territories:
        structures.extend(territory_to_structure.get(territory, []))

    return list(set(structures))
