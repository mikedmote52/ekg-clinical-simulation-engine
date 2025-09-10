import { MedicalAnalysis, HeartVisualization, AnimationTiming } from '@ekg-sim/medical-types';

export interface HeartGeometry {
  chambers: {
    left_atrium: any;
    right_atrium: any;
    left_ventricle: any;
    right_ventricle: any;
  };
  conduction_system: {
    sa_node: any;
    av_node: any;
    bundle_of_his: any;
    purkinje_fibers: any;
  };
}

export interface RenderingState {
  currentPhase: string;
  animationProgress: number;
  electricalActivation: Map<string, boolean>;
  mechanicalContraction: Map<string, number>;
}

export async function createHeartVisualization(
  analysis: MedicalAnalysis
): Promise<HeartVisualization> {
  console.log(`Creating 3D heart visualization for ${analysis.rhythm_classification}`);
  
  // Simulate visualization generation
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const animationTiming: AnimationTiming = {
    cycle_duration_ms: 60000 / analysis.heart_rate, // Convert BPM to cycle duration
    electrical_sequence: {
      sa_activation: 0,
      atrial_depolarization: analysis.conduction_timing.sa_to_av_delay,
      av_conduction: analysis.conduction_timing.av_to_his_delay,
      ventricular_depolarization: analysis.conduction_timing.his_to_purkinje_delay,
      repolarization: analysis.conduction_timing.qt_interval
    },
    mechanical_sequence: {
      atrial_systole: analysis.conduction_timing.sa_to_av_delay + 50,
      isovolumic_contraction: analysis.conduction_timing.qrs_duration + 100,
      ventricular_ejection: analysis.conduction_timing.qrs_duration + 200,
      isovolumic_relaxation: analysis.conduction_timing.qt_interval - 100,
      ventricular_filling: analysis.conduction_timing.qt_interval
    },
    speed_multiplier: 1.0
  };
  
  return {
    animation_timing: animationTiming,
    conduction_path: {
      coordinates: [
        { x: 0, y: 0, z: 0 },    // SA Node
        { x: 1, y: 0, z: 0 },    // Atrial Tissue
        { x: 0, y: -1, z: 0 },   // AV Node
        { x: 0, y: -2, z: 0 },   // Bundle of His
        { x: -1, y: -3, z: 0 }   // Purkinje Fibers
      ],
      activation_sequence: [
        0,
        animationTiming.electrical_sequence.atrial_depolarization,
        animationTiming.electrical_sequence.av_conduction,
        animationTiming.electrical_sequence.ventricular_depolarization,
        animationTiming.electrical_sequence.ventricular_depolarization + 20
      ],
      color_progression: ['#ff0000', '#ff4444', '#ff8888', '#ffcccc', '#ffffff']
    },
    chamber_contraction: {
      atrial_contraction_intensity: analysis.chamber_coordination.atrial_contraction ? 1.0 : 0.3,
      ventricular_contraction_intensity: analysis.chamber_coordination.ventricular_contraction ? 1.0 : 0.5,
      wall_motion_pattern: analysis.chamber_coordination.sequential_activation ? 'normal' : 'hypokinetic'
    },
    viewing_config: {
      default_camera_position: { x: 0, y: 0, z: 5 },
      educational_viewpoints: [
        {
          name: 'Anterior View',
          position: { x: 0, y: 0, z: 5 },
          target: { x: 0, y: 0, z: 0 },
          description: 'Front view of the heart showing anterior wall'
        },
        {
          name: 'Lateral View',
          position: { x: 5, y: 0, z: 0 },
          target: { x: 0, y: 0, z: 0 },
          description: 'Side view showing lateral wall and conduction system'
        },
        {
          name: 'Posterior View',
          position: { x: 0, y: 0, z: -5 },
          target: { x: 0, y: 0, z: 0 },
          description: 'Back view of the heart showing posterior wall'
        }
      ]
    },
    rendering: {
      quality_level: 'medium',
      target_fps: 60,
      anti_aliasing: true,
      shadows: false
    }
  };
}

export function updateVisualizationTiming(
  visualization: HeartVisualization,
  newHeartRate: number
): HeartVisualization {
  const newCycleDuration = 60000 / newHeartRate;
  
  return {
    ...visualization,
    animation_timing: {
      ...visualization.animation_timing,
      cycle_duration_ms: newCycleDuration
    }
  };
}

// Re-export medical types for convenience
export type {
  MedicalAnalysis,
  HeartVisualization,
  ConductionTiming,
  AnimationTiming
} from '@ekg-sim/medical-types';

export default {
  createHeartVisualization,
  updateVisualizationTiming
};