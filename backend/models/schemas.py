"""
Canonical data models for the ECG Heart Interpreter system.

All schemas use Pydantic v2 for validation and serialization.
Every measurement carries a confidence score and method provenance.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class AcquisitionType(str, Enum):
    SIMULTANEOUS = "simultaneous"
    STITCHED = "stitched"


class ProbabilityTier(str, Enum):
    HIGH = "high"
    MODERATE = "moderate"
    POSSIBLE = "possible"


class TWaveMorphology(str, Enum):
    UPRIGHT = "upright"
    INVERTED = "inverted"
    BIPHASIC = "biphasic"
    FLAT = "flat"


class PWaveMorphology(str, Enum):
    NORMAL = "normal"
    PEAKED = "peaked"
    BIFID = "bifid"
    ABSENT = "absent"
    RETROGRADE = "retrograde"


# ---------------------------------------------------------------------------
# ECG Metadata
# ---------------------------------------------------------------------------

class LeadDigitizationConfidence(BaseModel):
    lead_name: str = Field(..., description="Standard lead label (I, II, III, aVR, aVL, aVF, V1-V6)")
    confidence: float = Field(..., ge=0.0, le=1.0)
    failure_reason: Optional[str] = None


class ECGMetadata(BaseModel):
    paper_speed: float = Field(..., description="mm/s — typically 25 or 50")
    amplitude_scale: float = Field(..., description="mm/mV — typically 10")
    lead_count: int = Field(12, ge=1, le=15)
    acquisition_type: AcquisitionType = AcquisitionType.SIMULTANEOUS
    digitization_confidence: list[LeadDigitizationConfidence] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Measurements
# ---------------------------------------------------------------------------

class MeasurementValue(BaseModel):
    """A single measurement with provenance."""
    value: float
    unit: str
    method: str = Field(..., description="Algorithm or derivation method used")
    confidence: float = Field(..., ge=0.0, le=1.0)


class PWaveDetail(BaseModel):
    lead_name: str
    detected: bool
    duration_ms: Optional[MeasurementValue] = None
    morphology: PWaveMorphology = PWaveMorphology.NORMAL
    amplitude_mv: Optional[MeasurementValue] = None


class STDeviation(BaseModel):
    lead_name: str
    deviation_mv: float = Field(..., description="Positive = elevation, negative = depression")
    measurement_point: str = Field("J+60ms", description="Where ST was measured")


class TWaveDetail(BaseModel):
    lead_name: str
    polarity: TWaveMorphology
    amplitude_mv: Optional[float] = None


class Measurements(BaseModel):
    rate: MeasurementValue
    rhythm_regular: bool
    rhythm_description: str = ""

    p_waves: list[PWaveDetail] = Field(default_factory=list)
    pr_interval: Optional[MeasurementValue] = None
    qrs_duration: MeasurementValue
    qt_interval: MeasurementValue
    qtc_bazett: MeasurementValue
    qtc_fridericia: MeasurementValue

    axis_degrees: MeasurementValue
    axis_quadrant: str = ""
    precordial_transition: Optional[str] = Field(
        None, description="Lead where R/S ratio crosses 1"
    )

    lvh_voltage_criteria: bool = False
    lvh_criteria_detail: Optional[str] = None
    rvh_voltage_criteria: bool = False
    rvh_criteria_detail: Optional[str] = None

    st_deviations: list[STDeviation] = Field(default_factory=list)
    t_wave_details: list[TWaveDetail] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Interpretation / Classifier output
# ---------------------------------------------------------------------------

class SupportingEvidence(BaseModel):
    criterion: str
    met: bool
    detail: Optional[str] = None


class DifferentialDiagnosis(BaseModel):
    name: str = Field(..., description="Never use 'diagnose'; use 'pattern consistent with'")
    icd10_code: Optional[str] = None
    probability: float = Field(..., ge=0.0, le=1.0)
    probability_tier: ProbabilityTier
    supporting_criteria: list[SupportingEvidence] = Field(default_factory=list)
    absent_criteria: list[str] = Field(default_factory=list)
    recommended_discriminating_tests: list[str] = Field(default_factory=list)


class Interpretation(BaseModel):
    primary_diagnosis: str = Field(
        ...,
        description="Top finding — phrased as 'pattern consistent with …'"
    )
    differentials: list[DifferentialDiagnosis] = Field(default_factory=list)
    rhythm: str = ""
    conduction_abnormalities: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Activation Sequence
# ---------------------------------------------------------------------------

class PropagationVector(BaseModel):
    x: float
    y: float
    z: float


class ActivationEvent(BaseModel):
    structure_name: str
    onset_ms: float
    offset_ms: float
    propagation_direction_vector: PropagationVector
    confidence: float = Field(..., ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Conduction System
# ---------------------------------------------------------------------------

class ConductionSystem(BaseModel):
    sa_node_rate: Optional[float] = Field(None, description="Intrinsic SA node rate bpm")
    internodal_tracts_intact: bool = True
    av_node_delay_ms: float = Field(120.0, description="AV nodal delay in ms")
    his_bundle_intact: bool = True
    lbbb: bool = False
    rbbb: bool = False
    wpw: bool = False
    accessory_pathway_vector: Optional[PropagationVector] = None


# ---------------------------------------------------------------------------
# Repolarization
# ---------------------------------------------------------------------------

class InjuryCurrentRegion(BaseModel):
    location: str = Field(..., description="Anatomic region, e.g. 'inferior', 'anteroseptal'")
    magnitude_mv: float


class Repolarization(BaseModel):
    st_deviation_by_lead: dict[str, float] = Field(
        default_factory=dict,
        description="Lead name -> deviation in mV"
    )
    t_wave_axis: Optional[float] = None
    repolarization_gradient_map: dict[str, float] = Field(
        default_factory=dict,
        description="Region -> gradient magnitude"
    )
    injury_current_regions: list[InjuryCurrentRegion] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Uncertainty
# ---------------------------------------------------------------------------

class AlternateModel(BaseModel):
    description: str
    discriminating_test: str


class Uncertainty(BaseModel):
    underdetermined_parameters: list[str] = Field(default_factory=list)
    alternate_models: list[AlternateModel] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Display Contract
# ---------------------------------------------------------------------------

class DisplayContract(BaseModel):
    evidence_supported: list[str] = Field(
        default_factory=list,
        description="Findings directly supported by ECG evidence"
    )
    modeled_assumption: list[str] = Field(
        default_factory=list,
        description="Findings that are inferred/modeled, not directly measured"
    )


# ---------------------------------------------------------------------------
# Top-Level Schema
# ---------------------------------------------------------------------------

class VisualizationParameterJSON(BaseModel):
    """
    The canonical output of the ECG interpretation pipeline.

    This schema is the single contract between the backend interpretation
    engine and the frontend 3D heart visualization layer.
    """
    session_id: Optional[str] = None

    ecg_metadata: ECGMetadata
    measurements: Measurements
    interpretation: Interpretation

    activation_sequence: list[ActivationEvent] = Field(default_factory=list)
    conduction_system: ConductionSystem = Field(default_factory=ConductionSystem)
    repolarization: Repolarization = Field(default_factory=Repolarization)

    mechanical_archetype: str = Field(
        "normal_sinus",
        description="Key into archetype library, e.g. 'LBBB_typical', 'inferior_STEMI_explanatory'"
    )

    uncertainty: Uncertainty = Field(default_factory=Uncertainty)
    display_contract: DisplayContract = Field(default_factory=DisplayContract)

    pipeline_warnings: list[str] = Field(default_factory=list)
    pipeline_degraded: bool = Field(
        False,
        description="True if any agent in the pipeline failed and results are partial"
    )


# ---------------------------------------------------------------------------
# Intermediate pipeline models
# ---------------------------------------------------------------------------

class LeadTimeseries(BaseModel):
    """Per-lead digitized waveform."""
    lead_name: str
    time_ms: list[float]
    amplitude_mv: list[float]
    sample_rate_hz: float = 500.0
    confidence: float = Field(..., ge=0.0, le=1.0)
    failure_reason: Optional[str] = None


class DigitizedECG(BaseModel):
    """Complete output of the digitizer stage."""
    session_id: str
    metadata: ECGMetadata
    leads: list[LeadTimeseries]
    is_stitched: bool = False
    warnings: list[str] = Field(default_factory=list)
    ready_for_interpretation: bool = True


class GridCharacterization(BaseModel):
    """Output of grid detection."""
    small_square_px: float
    large_square_px: float
    paper_speed_mm_per_s: float = 25.0
    amplitude_scale_mm_per_mv: float = 10.0
    calibration_pulse_detected: bool = False
    calibration_pulse_mv: Optional[float] = None
    image_width_px: int = 0
    image_height_px: int = 0


class PreprocessedImage(BaseModel):
    """Output of the preprocessor — metadata only; images stored in session."""

    class Config:
        arbitrary_types_allowed = True

    session_id: str
    grid: GridCharacterization
    warnings: list[str] = Field(default_factory=list)


class ClassifierOutput(BaseModel):
    """Output of the rules-based classifier."""
    primary_finding: str
    differentials: list[DifferentialDiagnosis]
    rhythm: str
    conduction_abnormalities: list[str] = Field(default_factory=list)
