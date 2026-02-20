"""
Tests for the archetype library.
"""

import pytest

from mapper.archetype_library import (
    ARCHETYPE_REGISTRY,
    find_best_archetype,
    get_archetype,
    list_archetypes,
)


class TestArchetypeRegistry:
    def test_all_required_archetypes_present(self):
        required = [
            "normal_sinus",
            "RBBB_typical",
            "LBBB_typical",
            "LAFB",
            "inferior_STEMI_explanatory",
            "anterior_STEMI_explanatory",
            "afib_typical",
            "third_degree_block",
            "WPW_typical",
            "LVH_typical",
        ]
        for arch_id in required:
            assert arch_id in ARCHETYPE_REGISTRY, f"Missing archetype: {arch_id}"

    def test_all_archetypes_are_explanatory(self):
        for arch_id, arch in ARCHETYPE_REGISTRY.items():
            assert arch.is_explanatory_reconstruction is True, (
                f"Archetype '{arch_id}' not marked as explanatory"
            )

    def test_all_archetypes_have_teaching_notes(self):
        for arch_id, arch in ARCHETYPE_REGISTRY.items():
            assert arch.teaching_note, f"Archetype '{arch_id}' missing teaching_note"
            assert len(arch.teaching_note) > 10

    def test_all_archetypes_have_activation_sequence(self):
        for arch_id, arch in ARCHETYPE_REGISTRY.items():
            assert len(arch.activation_sequence) > 0, (
                f"Archetype '{arch_id}' has empty activation_sequence"
            )

    def test_all_archetypes_serializable(self):
        for arch_id, arch in ARCHETYPE_REGISTRY.items():
            d = arch.to_dict()
            assert d["archetype_id"] == arch_id
            assert "activation_sequence" in d
            assert "conduction_delays" in d
            assert "mechanical_label" in d
            assert "teaching_note" in d


class TestArchetypeLookup:
    def test_get_existing(self):
        arch = get_archetype("normal_sinus")
        assert arch is not None
        assert arch.archetype_id == "normal_sinus"

    def test_get_nonexistent(self):
        arch = get_archetype("nonexistent_archetype")
        assert arch is None

    def test_list_archetypes(self):
        ids = list_archetypes()
        assert len(ids) >= 10
        assert "normal_sinus" in ids


class TestFindBestArchetype:
    def test_known_mappings(self):
        assert find_best_archetype("normal_sinus") == "normal_sinus"
        assert find_best_archetype("rbbb") == "RBBB_typical"
        assert find_best_archetype("lbbb") == "LBBB_typical"
        assert find_best_archetype("lafb") == "LAFB"
        assert find_best_archetype("atrial_fibrillation") == "afib_typical"
        assert find_best_archetype("third_degree_av_block") == "third_degree_block"
        assert find_best_archetype("wpw") == "WPW_typical"
        assert find_best_archetype("lvh") == "LVH_typical"
        assert find_best_archetype("inferior_stemi") == "inferior_STEMI_explanatory"
        assert find_best_archetype("anterior_stemi") == "anterior_STEMI_explanatory"

    def test_unknown_defaults_to_normal(self):
        assert find_best_archetype("unknown_condition") == "normal_sinus"
