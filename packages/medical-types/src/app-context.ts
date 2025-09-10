/**
 * Shared Application Context - Data Contract for All Agents
 * This ensures all agents work with compatible data structures
 */

export interface ConductionTiming {
  /** SA node to AV node delay in milliseconds */
  sa_to_av_delay: number;
  /** AV node to His bundle delay in milliseconds */
  av_to_his_delay: number;
  /** His bundle to Purkinje system delay in milliseconds */
  his_to_purkinje_delay: number;
  /** Complete cardiac cycle duration in milliseconds */
  cardiac_cycle_ms: number;
  /** QRS complex duration in milliseconds */
  qrs_duration: number;
  /** QT interval in milliseconds */
  qt_interval: number;
}

export interface MedicalAnalysis {
  /** Primary rhythm classification */
  rhythm_classification: 'normal_sinus' | 'atrial_fibrillation' | 'ventricular_tachycardia' | 
                        'heart_block' | 'sinus_bradycardia' | 'sinus_tachycardia' | 'premature_ventricular_contractions';
  /** Heart rate in beats per minute */
  heart_rate: number;
  /** Electrical conduction timing data */
  conduction_timing: ConductionTiming;
  /** Clinical significance level */
  clinical_significance: 'normal' | 'monitor' | 'urgent' | 'critical';
  /** Chamber coordination pattern */
  chamber_coordination: {
    atrial_contraction: boolean;
    ventricular_contraction: boolean;
    av_synchrony: boolean;
    sequential_activation: boolean;
  };
  /** EKG interval measurements */
  intervals: {
    pr_interval: number;
    qrs_width: number;
    qt_corrected: number;
    rr_interval: number;
  };
  /** Pathophysiology explanation */
  pathophysiology: string;
  /** Clinical context */
  clinical_context: {
    symptoms_likely: string[];
    treatment_considerations: string[];
    monitoring_requirements: string[];
  };
}

export interface AnimationTiming {
  /** Complete animation cycle duration in milliseconds */
  cycle_duration_ms: number;
  /** Electrical activation sequence timing */
  electrical_sequence: {
    sa_activation: number;
    atrial_depolarization: number;
    av_conduction: number;
    ventricular_depolarization: number;
    repolarization: number;
  };
  /** Mechanical contraction timing */
  mechanical_sequence: {
    atrial_systole: number;
    isovolumic_contraction: number;
    ventricular_ejection: number;
    isovolumic_relaxation: number;
    ventricular_filling: number;
  };
  /** Animation speed multiplier (1.0 = real-time) */
  speed_multiplier: number;
}

export interface HeartVisualization {
  /** 3D animation timing configuration */
  animation_timing: AnimationTiming;
  /** Electrical conduction pathway visualization */
  conduction_path: {
    coordinates: Array<{x: number, y: number, z: number}>;
    activation_sequence: number[];
    color_progression: string[];
  };
  /** Chamber contraction visualization */
  chamber_contraction: {
    atrial_contraction_intensity: number;
    ventricular_contraction_intensity: number;
    wall_motion_pattern: 'normal' | 'hypokinetic' | 'akinetic' | 'dyskinetic';
  };
  /** Camera and viewing configuration */
  viewing_config: {
    default_camera_position: {x: number, y: number, z: number};
    educational_viewpoints: Array<{
      name: string;
      position: {x: number, y: number, z: number};
      target: {x: number, y: number, z: number};
      description: string;
    }>;
  };
  /** Rendering quality settings */
  rendering: {
    quality_level: 'low' | 'medium' | 'high' | 'ultra';
    target_fps: number;
    anti_aliasing: boolean;
    shadows: boolean;
  };
}

export interface EducationalContent {
  /** Learning complexity level */
  complexity_level: 'beginner' | 'intermediate' | 'advanced';
  /** Key teaching points for this rhythm */
  key_teaching_points: string[];
  /** Detailed rhythm explanation */
  rhythm_explanation: string;
  /** Clinical significance explanation */
  clinical_significance_explanation: string;
  /** Narration timing cues */
  narration_timing: Array<{
    timestamp_ms: number;
    content: string;
    emphasis_level: 'normal' | 'important' | 'critical';
    visual_highlight?: string;
  }>;
  /** Interactive learning elements */
  interactive_elements: Array<{
    type: 'quiz' | 'highlight' | 'annotation' | 'comparison';
    trigger_time: number;
    content: any;
  }>;
  /** Accessibility features */
  accessibility: {
    audio_description: string;
    captions: boolean;
    high_contrast: boolean;
    screen_reader_compatible: boolean;
  };
  /** Progressive learning hints */
  learning_progression: {
    prerequisite_concepts: string[];
    next_level_concepts: string[];
    mastery_indicators: string[];
  };
}

export interface UserInterface {
  /** EKG input handling */
  input_configuration: {
    supported_formats: ('image' | 'waveform' | 'text_report')[];
    upload_validation: boolean;
    real_time_processing: boolean;
  };
  /** Control interface */
  controls: {
    play_pause: boolean;
    speed_control: {min: 0.1, max: 5.0, step: 0.1};
    educational_mode_toggle: boolean;
    view_angle_control: boolean;
    annotation_toggle: boolean;
  };
  /** Display configuration */
  display: {
    ekg_trace_overlay: boolean;
    timing_indicators: boolean;
    educational_annotations: boolean;
    progress_tracker: boolean;
  };
  /** Responsive design settings */
  responsive: {
    mobile_optimized: boolean;
    tablet_layout: boolean;
    desktop_enhanced: boolean;
  };
}

/**
 * Complete Application Context
 * This is the master data structure shared between all agents
 */
export interface AppContext {
  /** Medical analysis from cardiology agent */
  medical: MedicalAnalysis;
  
  /** 3D visualization configuration from visualization agent */
  visualization: HeartVisualization;
  
  /** Educational content from education agent */
  education: EducationalContent;
  
  /** User interface configuration from frontend agent */
  interface: UserInterface;
  
  /** System metadata */
  metadata: {
    session_id: string;
    timestamp: string;
    agent_versions: {
      medical: string;
      visualization: string;
      education: string;
      frontend: string;
    };
    validation_status: {
      medical_accuracy: boolean;
      visual_sync: boolean;
      educational_accuracy: boolean;
      integration_complete: boolean;
    };
  };
}

/**
 * Agent Communication Interface
 * Standardizes how agents pass data between each other
 */
export interface AgentHandoff {
  from_agent: string;
  to_agent: string;
  data: Partial<AppContext>;
  validation_required: boolean;
  blocking: boolean;
  timestamp: string;
}

/**
 * Validation Result Interface
 */
export interface ValidationResult {
  status: 'VALIDATION_PASSED' | 'VALIDATION_FAILED' | 'VALIDATION_WARNING';
  agent: string;
  timestamp: string;
  details?: string;
  required_action?: string;
  blocking?: boolean;
  medical_accuracy_score?: number;
}

// Type guards for runtime validation
export function isMedicalAnalysis(obj: any): obj is MedicalAnalysis {
  return (
    obj &&
    typeof obj.rhythm_classification === 'string' &&
    typeof obj.heart_rate === 'number' &&
    obj.conduction_timing &&
    typeof obj.clinical_significance === 'string'
  );
}

export function isHeartVisualization(obj: any): obj is HeartVisualization {
  return (
    obj &&
    obj.animation_timing &&
    obj.conduction_path &&
    obj.chamber_contraction &&
    obj.viewing_config
  );
}

export function isEducationalContent(obj: any): obj is EducationalContent {
  return (
    obj &&
    typeof obj.complexity_level === 'string' &&
    Array.isArray(obj.key_teaching_points) &&
    typeof obj.rhythm_explanation === 'string'
  );
}