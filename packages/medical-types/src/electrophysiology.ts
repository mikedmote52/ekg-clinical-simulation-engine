/**
 * Shared Electrophysiology Types
 * 
 * Common types and interfaces for electrophysiological data
 * used across the EKG simulation system
 */

export interface ElectrophysiologyState {
  timestamp: number; // ms from cycle start
  activeRegions: ConductionRegion[];
  electricalWaves: ElectricalWave[];
  chamberStates: Map<string, ChamberElectricalState>;
  conductionVelocity: number; // m/s
  depolarizationFront: WaveFront;
  repolarizationFront: WaveFront;
}

export interface ConductionRegion {
  regionId: string;
  anatomicalLocation: string; // 'SA_NODE', 'AV_NODE', 'HIS_BUNDLE', etc.
  activationTime: number; // ms
  depolarizationDuration: number; // ms
  repolarizationTime: number; // ms
  conductionVelocity: number; // m/s
  isBlocked: boolean;
  blockType?: 'partial' | 'complete' | 'intermittent';
}

export interface ElectricalWave {
  waveId: string;
  waveType: 'depolarization' | 'repolarization';
  currentPosition: { x: number, y: number, z: number };
  waveFront: { x: number, y: number, z: number }[];
  velocity: number; // m/s
  amplitude: number; // mV
  sourceRegion: string;
  targetRegions: string[];
  propagationPath: string[];
  isAbnormal: boolean;
}

export interface ChamberElectricalState {
  chamberName: string;
  currentState: 'resting' | 'depolarizing' | 'depolarized' | 'repolarizing';
  activationTime: number; // ms
  depolarizationProgress: number; // 0-1
  repolarizationProgress: number; // 0-1
  membraneVoltage: number; // mV
  actionPotentialPhase: 0 | 1 | 2 | 3 | 4; // AP phases
  refractoryState: 'none' | 'absolute' | 'relative';
}

export interface WaveFront {
  points: { x: number, y: number, z: number }[];
  propagationDirection: { x: number, y: number, z: number };
  velocity: number; // m/s
  amplitude: number; // mV
  isAbnormal: boolean;
}

export interface ConductionPathway {
  pathwayId: string;
  startPoint: { x: number, y: number, z: number };
  endPoint: { x: number, y: number, z: number };
  intermediatePoints: { x: number, y: number, z: number }[];
  pathwayType: 'atrial' | 'av_nodal' | 'his_purkinje' | 'ventricular';
  conductionVelocity: number;
  isActive: boolean;
  activationProgress: number; // 0-1
}

export interface RhythmAnalysis {
  rhythm_type: string;
  heart_rate: number;
  rhythm_regularity: 'regular' | 'irregular' | 'regularly_irregular';
  p_wave_analysis: {
    present: boolean;
    morphology: 'normal' | 'abnormal' | 'absent';
    pr_interval: number; // ms
  };
  qrs_analysis: {
    duration: number; // ms
    morphology: 'normal' | 'wide' | 'bizarre';
    axis: number; // degrees
  };
  conduction_abnormalities: {
    av_block_degree: 0 | 1 | 2 | 3;
    bundle_branch_block: 'none' | 'rbbb' | 'lbbb' | 'bifascicular';
    accessory_pathway: boolean;
  };
}

export interface EKGTimingMeasurements {
  pr_interval: number; // ms
  qrs_duration: number; // ms
  qt_interval: number; // ms
  qtc_interval: number; // ms (corrected)
  rr_intervals: number[]; // ms
  heart_rate_variability: number; // RMSSD
}