"""
Visualization API routes.

Provides archetype library access and visualization parameter queries.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from mapper.archetype_library import ARCHETYPE_REGISTRY, get_archetype, list_archetypes

router = APIRouter(prefix="/api", tags=["visualize"])


@router.get("/archetypes")
async def get_archetypes():
    """List all available visualization archetypes."""
    return {
        "archetypes": [
            {
                "archetype_id": arch.archetype_id,
                "display_name": arch.display_name,
                "mechanical_label": arch.mechanical_label,
                "teaching_note": arch.teaching_note,
                "tags": arch.tags,
            }
            for arch in ARCHETYPE_REGISTRY.values()
        ]
    }


@router.get("/archetypes/{archetype_id}")
async def get_archetype_detail(archetype_id: str):
    """Get full detail for a specific archetype."""
    archetype = get_archetype(archetype_id)
    if archetype is None:
        raise HTTPException(
            status_code=404,
            detail=f"Archetype '{archetype_id}' not found. "
                   f"Available: {', '.join(list_archetypes())}",
        )
    return archetype.to_dict()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "archetypes_loaded": len(ARCHETYPE_REGISTRY),
        "service": "ecg-heart-interpreter",
    }
