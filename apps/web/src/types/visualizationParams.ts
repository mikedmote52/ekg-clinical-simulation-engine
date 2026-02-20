/**
 * VisualizationParameterJSON - Backend API contract for ECG interpretation.
 * The frontend renders exactly what this JSON says. No physiology logic here.
 */

export interface ActivationEvent {
  structure_id: string;
  onset_ms: number;
  duration_ms: number;
}

export interface ConductionSystemStep {
  structure: 'sa_node' | 'internodal' | 'av_node' | 'his_bundle' | 'left_bundle' | 'right_bundle' | 'purkinje';
  onset_ms: number;
  duration_ms: number;
}

export interface ConductionSystemData {
  sequence: ConductionSystemStep[];
  lbbb?: boolean; // Left bundle branch block
}

export interface InjuryCurrentRegion {
  territory: string; // e.g. 'anterolateral', 'inferior', 'septal'
  label?: string;
}

export interface RepolarizationData {
  injury_current_regions: InjuryCurrentRegion[];
}

export interface DisplayContract {
  evidence_supported: string[];
  modeled_assumption: string[];
}

export interface AlternateModel {
  id: string;
  label: string;
  probability?: number;
  viz_params: Partial<VisualizationParameterJSON>;
}

export interface UncertaintyData {
  alternate_models: AlternateModel[];
}

export interface EKGInterval {
  pr_ms?: number;
  qrs_ms?: number;
  qt_ms?: number;
}

export interface Differential {
  id: string;
  label: string;
  probability_tier: 'high' | 'medium' | 'low';
  supporting_criteria?: string[];
  discriminating_tests?: string[];
}

export interface VisualizationParameterJSON {
  cardiac_cycle_duration_ms: number;
  activation_sequence: ActivationEvent[];
  conduction_system?: ConductionSystemData;
  repolarization?: RepolarizationData;
  display_contract: DisplayContract;
  uncertainty?: UncertaintyData;
  intervals?: EKGInterval;
  primary_diagnosis: string;
  differentials?: Differential[];
  /** Per-lead waveform data: lead_id -> { time_ms: number[], amplitude_mv: number[] } */
  waveforms?: Record<string, { time_ms: number[]; amplitude_mv: number[] }>;
  /** Phase boundaries for timeline (P, PR, QRS, ST, T) */
  phase_boundaries?: {
    p_wave?: { start_ms: number; end_ms: number };
    pr_segment?: { start_ms: number; end_ms: number };
    qrs?: { start_ms: number; end_ms: number };
    st_segment?: { start_ms: number; end_ms: number };
    t_wave?: { start_ms: number; end_ms: number };
  };
}

// Digitization result from GET /api/session/:id
export interface PerLeadConfidence {
  lead_id: string;
  confidence: number; // 0-1
}

export interface DigitizationResult {
  per_lead_confidence: PerLeadConfidence[];
  warnings: string[];
  overlay_image_url?: string;
  ready_for_interpretation: boolean;
}
