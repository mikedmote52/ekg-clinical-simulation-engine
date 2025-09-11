/**
 * Medical-grade animation configuration for EKG-synchronized 3D heart visualization
 * Based on real cardiac physiology and electrophysiology principles
 */

export interface CardiacAnimationConfig {
  // Timing parameters based on EKG analysis
  timing: {
    heartRate: number;
    beatDuration: number;
    prInterval: number;
    qrsDuration: number;
    qtInterval: number;
    stSegment: number;
    tWaveDuration: number;
  };
  
  // Electrical conduction system timing
  conduction: {
    saNodeActivation: number;      // SA node firing time (ms)
    atrialDepolarization: number;   // P-wave duration (ms)
    avNodeDelay: number;           // PR interval - P wave duration
    hisActivation: number;         // Bundle of His conduction time
    bundleBranchConduction: number; // Left/Right bundle branch time
    purkinjeActivation: number;    // Purkinje network propagation time
  };
  
  // Chamber mechanical response
  mechanics: {
    atrialSystole: {
      onset: number;        // Time after SA node activation
      duration: number;     // Duration of atrial contraction
      strength: number;     // Contraction intensity (0-1)
    };
    ventricularSystole: {
      onset: number;        // Time after ventricular depolarization
      duration: number;     // Duration of ventricular contraction  
      strength: number;     // Contraction intensity (0-1)
    };
    diastole: {
      duration: number;     // Relaxation period
      compliance: number;   // Chamber compliance during filling
    };
  };
  
  // Rhythm-specific modifications
  rhythmModifications: {
    irregularity: number;      // R-R interval variability (0-1)
    conductionBlocks: string[]; // Types of conduction abnormalities
    arrhythmiaPattern: string; // Specific rhythm pattern
  };
  
  // Visual animation parameters
  visualization: {
    chamberColors: {
      rightAtrium: string;
      leftAtrium: string;
      rightVentricle: string;
      leftVentricle: string;
    };
    electricalColors: {
      saNode: string;
      avNode: string;
      bundleOfHis: string;
      purkinje: string;
    };
    coronaryColors: {
      arterial: string;
      venous: string;
    };
  };
}

/**
 * Generate animation configuration based on EKG analysis results
 */
export const generateAnimationConfig = (
  rythmAnalysis: any,
  timingMeasurements: any,
  animationRequirements: any
): CardiacAnimationConfig => {
  const heartRate = rythmAnalysis.heart_rate || 72;
  const beatDuration = 60000 / heartRate;
  
  // Base configuration for normal sinus rhythm
  const baseConfig: CardiacAnimationConfig = {
    timing: {
      heartRate,
      beatDuration,
      prInterval: timingMeasurements?.pr_interval || 160,
      qrsDuration: timingMeasurements?.qrs_duration || 90,
      qtInterval: timingMeasurements?.qt_interval || 380,
      stSegment: 100, // Typical ST segment duration
      tWaveDuration: 150 // Typical T wave duration
    },
    
    conduction: {
      saNodeActivation: 0,
      atrialDepolarization: 80, // P wave duration
      avNodeDelay: (timingMeasurements?.pr_interval || 160) - 80,
      hisActivation: 20,
      bundleBranchConduction: 30,
      purkinjeActivation: (timingMeasurements?.qrs_duration || 90) - 50
    },
    
    mechanics: {
      atrialSystole: {
        onset: 50, // Shortly after P wave
        duration: 100,
        strength: 0.3
      },
      ventricularSystole: {
        onset: timingMeasurements?.pr_interval || 160,
        duration: 300, // Systolic ejection period
        strength: 0.8
      },
      diastole: {
        duration: beatDuration - 400, // Remainder of cardiac cycle
        compliance: 0.7
      }
    },
    
    rhythmModifications: {
      irregularity: timingMeasurements?.rr_interval_variability || 0.05,
      conductionBlocks: animationRequirements?.abnormality_highlights || [],
      arrhythmiaPattern: rythmAnalysis.primary_rhythm || 'Normal Sinus Rhythm'
    },
    
    visualization: {
      chamberColors: {
        rightAtrium: '#8B4B8B',
        leftAtrium: '#FF6B6B', 
        rightVentricle: '#5B5BAF',
        leftVentricle: '#FF4444'
      },
      electricalColors: {
        saNode: '#FFFF00',
        avNode: '#FF8800',
        bundleOfHis: '#00FF88',
        purkinje: '#00CCFF'
      },
      coronaryColors: {
        arterial: '#FF4444',
        venous: '#4444AA'
      }
    }
  };
  
  // Apply rhythm-specific modifications
  return applyRhythmSpecificConfig(baseConfig, rythmAnalysis.primary_rhythm);
};

/**
 * Apply rhythm-specific configuration modifications
 */
const applyRhythmSpecificConfig = (
  config: CardiacAnimationConfig,
  rhythmType: string
): CardiacAnimationConfig => {
  const modifiedConfig = { ...config };
  
  switch (rhythmType) {
    case 'Atrial Fibrillation':
      modifiedConfig.rhythmModifications.irregularity = 0.4; // High variability
      modifiedConfig.mechanics.atrialSystole.strength = 0.1; // Minimal atrial contraction
      modifiedConfig.conduction.atrialDepolarization = 0; // No organized P waves
      modifiedConfig.visualization.chamberColors.rightAtrium = '#AA6B6B';
      modifiedConfig.visualization.chamberColors.leftAtrium = '#AA6B6B';
      break;
      
    case 'Ventricular Tachycardia':
      modifiedConfig.timing.heartRate = Math.max(modifiedConfig.timing.heartRate, 150);
      modifiedConfig.timing.beatDuration = 60000 / modifiedConfig.timing.heartRate;
      modifiedConfig.conduction.bundleBranchConduction *= 2; // Wider QRS
      modifiedConfig.mechanics.ventricularSystole.strength = 0.6; // Reduced effectiveness
      modifiedConfig.visualization.electricalColors.purkinje = '#FF0088';
      break;
      
    case 'First Degree AV Block':
      modifiedConfig.conduction.avNodeDelay *= 1.5; // Prolonged AV delay
      modifiedConfig.timing.prInterval = Math.max(modifiedConfig.timing.prInterval, 200);
      break;
      
    case 'Sinus Bradycardia':
      modifiedConfig.timing.heartRate = Math.min(modifiedConfig.timing.heartRate, 59);
      modifiedConfig.timing.beatDuration = 60000 / modifiedConfig.timing.heartRate;
      modifiedConfig.mechanics.diastole.duration *= 1.5; // Longer filling time
      break;
      
    case 'Sinus Tachycardia':
      modifiedConfig.timing.heartRate = Math.max(modifiedConfig.timing.heartRate, 101);
      modifiedConfig.timing.beatDuration = 60000 / modifiedConfig.timing.heartRate;
      modifiedConfig.mechanics.diastole.duration *= 0.7; // Reduced filling time
      break;
  }
  
  return modifiedConfig;
};

/**
 * Calculate real-time animation phase based on current time and EKG timing
 */
export const calculateAnimationPhase = (
  currentTime: number,
  lastBeatTime: number,
  config: CardiacAnimationConfig
): {
  cyclePhase: number;        // 0-1 position in cardiac cycle
  electricalPhase: string;   // Current electrical event
  mechanicalPhase: string;   // Current mechanical event
  chamberStates: {
    [key: string]: {
      contractionLevel: number; // 0-1 contraction intensity
      electricalActivity: number; // 0-1 electrical activity
    }
  };
} => {
  const timeSinceLastBeat = currentTime - lastBeatTime;
  const cyclePhase = (timeSinceLastBeat % config.timing.beatDuration) / config.timing.beatDuration;
  
  // Determine current electrical phase
  let electricalPhase = 'baseline';
  if (timeSinceLastBeat < config.conduction.saNodeActivation + 50) {
    electricalPhase = 'sa_node';
  } else if (timeSinceLastBeat < config.timing.prInterval - config.conduction.avNodeDelay) {
    electricalPhase = 'atrial_depolarization';
  } else if (timeSinceLastBeat < config.timing.prInterval) {
    electricalPhase = 'av_node_delay';
  } else if (timeSinceLastBeat < config.timing.prInterval + config.timing.qrsDuration) {
    electricalPhase = 'ventricular_depolarization';
  } else if (timeSinceLastBeat < config.timing.prInterval + config.timing.qtInterval) {
    electricalPhase = 'repolarization';
  }
  
  // Determine current mechanical phase
  let mechanicalPhase = 'diastole';
  if (timeSinceLastBeat > config.mechanics.atrialSystole.onset && 
      timeSinceLastBeat < config.mechanics.atrialSystole.onset + config.mechanics.atrialSystole.duration) {
    mechanicalPhase = 'atrial_systole';
  } else if (timeSinceLastBeat > config.mechanics.ventricularSystole.onset && 
             timeSinceLastBeat < config.mechanics.ventricularSystole.onset + config.mechanics.ventricularSystole.duration) {
    mechanicalPhase = 'ventricular_systole';
  }
  
  // Calculate chamber states
  const chamberStates = calculateChamberStates(timeSinceLastBeat, config, electricalPhase, mechanicalPhase);
  
  return {
    cyclePhase,
    electricalPhase,
    mechanicalPhase,
    chamberStates
  };
};

/**
 * Calculate individual chamber contraction and electrical states
 */
const calculateChamberStates = (
  timeSinceLastBeat: number,
  config: CardiacAnimationConfig,
  electricalPhase: string,
  mechanicalPhase: string
) => {
  const states = {
    rightAtrium: { contractionLevel: 0, electricalActivity: 0 },
    leftAtrium: { contractionLevel: 0, electricalActivity: 0 },
    rightVentricle: { contractionLevel: 0, electricalActivity: 0 },
    leftVentricle: { contractionLevel: 0, electricalActivity: 0 }
  };
  
  // Atrial electrical activity
  if (electricalPhase === 'atrial_depolarization') {
    const atrialProgress = (timeSinceLastBeat - config.conduction.saNodeActivation) / config.conduction.atrialDepolarization;
    states.rightAtrium.electricalActivity = Math.sin(atrialProgress * Math.PI);
    states.leftAtrium.electricalActivity = Math.sin((atrialProgress - 0.1) * Math.PI); // Slight delay
  }
  
  // Ventricular electrical activity
  if (electricalPhase === 'ventricular_depolarization') {
    const ventricularProgress = (timeSinceLastBeat - config.timing.prInterval) / config.timing.qrsDuration;
    states.rightVentricle.electricalActivity = Math.sin(ventricularProgress * Math.PI);
    states.leftVentricle.electricalActivity = Math.sin((ventricularProgress - 0.05) * Math.PI);
  }
  
  // Atrial mechanical activity
  if (mechanicalPhase === 'atrial_systole') {
    const atrialProgress = (timeSinceLastBeat - config.mechanics.atrialSystole.onset) / config.mechanics.atrialSystole.duration;
    const contractionCurve = Math.sin(atrialProgress * Math.PI) * config.mechanics.atrialSystole.strength;
    states.rightAtrium.contractionLevel = contractionCurve;
    states.leftAtrium.contractionLevel = contractionCurve;
  }
  
  // Ventricular mechanical activity
  if (mechanicalPhase === 'ventricular_systole') {
    const ventricularProgress = (timeSinceLastBeat - config.mechanics.ventricularSystole.onset) / config.mechanics.ventricularSystole.duration;
    const contractionCurve = Math.sin(ventricularProgress * Math.PI) * config.mechanics.ventricularSystole.strength;
    states.rightVentricle.contractionLevel = contractionCurve;
    states.leftVentricle.contractionLevel = contractionCurve;
  }
  
  return states;
};

/**
 * Educational content based on current animation phase
 */
export const getEducationalContent = (
  electricalPhase: string,
  mechanicalPhase: string,
  rhythmType: string
): {
  title: string;
  description: string;
  keyPoints: string[];
  clinicalSignificance: string;
} => {
  const phaseContent: { [key: string]: any } = {
    'sa_node': {
      title: 'SA Node Activation',
      description: 'The sinoatrial node initiates the heartbeat by generating electrical impulses.',
      keyPoints: [
        'Natural pacemaker of the heart',
        'Located in the upper right atrium',
        'Fires at intrinsic rate of 60-100 BPM'
      ],
      clinicalSignificance: 'SA node dysfunction can lead to bradycardia or pause-dependent arrhythmias.'
    },
    
    'atrial_depolarization': {
      title: 'Atrial Depolarization (P-wave)',
      description: 'Electrical impulse spreads across both atria, causing coordinated atrial contraction.',
      keyPoints: [
        'Represents atrial electrical activation',
        'Normal P-wave duration: 80-120ms',
        'Leads to atrial mechanical contraction'
      ],
      clinicalSignificance: 'Abnormal P-waves may indicate atrial enlargement or conduction disorders.'
    },
    
    'av_node_delay': {
      title: 'AV Node Delay',
      description: 'Electrical impulse is delayed at the AV node, allowing time for ventricular filling.',
      keyPoints: [
        'Physiological delay ensures optimal filling',
        'Normal AV delay: 60-100ms',
        'Only electrical connection between atria and ventricles'
      ],
      clinicalSignificance: 'Prolonged AV delay indicates first-degree heart block.'
    },
    
    'ventricular_depolarization': {
      title: 'Ventricular Depolarization (QRS)',
      description: 'Rapid electrical activation of ventricles through specialized conduction system.',
      keyPoints: [
        'His-Purkinje system enables rapid conduction',
        'Normal QRS duration: 60-120ms',
        'Synchronized ventricular activation'
      ],
      clinicalSignificance: 'Wide QRS complexes suggest ventricular conduction abnormalities.'
    },
    
    'repolarization': {
      title: 'Ventricular Repolarization (T-wave)',
      description: 'Ventricles return to resting electrical state, preparing for next cycle.',
      keyPoints: [
        'Recovery phase of ventricular muscle',
        'QT interval measures repolarization time',
        'Vulnerable period for arrhythmias'
      ],
      clinicalSignificance: 'QT prolongation increases risk of dangerous arrhythmias.'
    }
  };
  
  return phaseContent[electricalPhase] || {
    title: 'Cardiac Cycle',
    description: 'Complete cardiac cycle with coordinated electrical and mechanical events.',
    keyPoints: ['Integrated electrical and mechanical function'],
    clinicalSignificance: 'Understanding normal cycle essential for recognizing abnormalities.'
  };
};

const heartAnimationConfig = {
  generateAnimationConfig,
  calculateAnimationPhase,
  getEducationalContent
};

export default heartAnimationConfig;