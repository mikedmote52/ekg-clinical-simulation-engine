/**
 * Medical Accuracy Validation Test Suite
 * 
 * Comprehensive testing of the EKG-heart visualization system
 * with various cardiac rhythms and pathologies
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/testing-library/jest-dom';
import * as THREE from 'three';

// Import our medical components
import { AnatomicalHeartModel } from '../packages/heart-3d/src/AnatomicalHeartModel';
import { ConductionSystemVisualizer } from '../packages/heart-3d/src/ConductionSystemVisualizer';
import { ElectrophysiologyMapper } from '../packages/ekg-processor/src/ElectrophysiologyMapper';
import { EKGMedicalAnalyzer } from '../packages/ekg-processor/src/index';

// Medical test data
interface MedicalTestCase {
  name: string;
  rhythmType: string;
  heartRate: number;
  ekgCharacteristics: {
    pWave: boolean;
    prInterval: number;
    qrsDuration: number;
    qtInterval: number;
    regularity: 'regular' | 'irregular';
  };
  expectedConductionPattern: {
    saNodeActive: boolean;
    avNodeDelay: number;
    ventricularActivation: 'normal' | 'wide' | 'aberrant';
    conductionBlocks: string[];
  };
  expectedTimingSequence: {
    atrialDepolarization: number; // ms
    avNodeConduction: number; // ms
    ventricularDepolarization: number; // ms
    totalCycleTime: number; // ms
  };
  clinicalSignificance: 'normal' | 'monitor' | 'urgent' | 'critical';
}

const MEDICAL_TEST_CASES: MedicalTestCase[] = [
  {
    name: 'Normal Sinus Rhythm',
    rhythmType: 'Normal Sinus Rhythm',
    heartRate: 72,
    ekgCharacteristics: {
      pWave: true,
      prInterval: 160,
      qrsDuration: 90,
      qtInterval: 380,
      regularity: 'regular'
    },
    expectedConductionPattern: {
      saNodeActive: true,
      avNodeDelay: 100,
      ventricularActivation: 'normal',
      conductionBlocks: []
    },
    expectedTimingSequence: {
      atrialDepolarization: 80,
      avNodeConduction: 100,
      ventricularDepolarization: 75,
      totalCycleTime: 833 // 60000/72
    },
    clinicalSignificance: 'normal'
  },
  
  {
    name: 'Atrial Fibrillation',
    rhythmType: 'Atrial Fibrillation',
    heartRate: 95,
    ekgCharacteristics: {
      pWave: false,
      prInterval: 0, // No P waves
      qrsDuration: 85,
      qtInterval: 340,
      regularity: 'irregular'
    },
    expectedConductionPattern: {
      saNodeActive: false,
      avNodeDelay: 120, // Variable
      ventricularActivation: 'normal',
      conductionBlocks: ['SA_NODE_SUPPRESSION']
    },
    expectedTimingSequence: {
      atrialDepolarization: 0, // Chaotic
      avNodeConduction: 120,
      ventricularDepolarization: 75,
      totalCycleTime: 632 // Variable due to irregularity
    },
    clinicalSignificance: 'urgent'
  },

  {
    name: 'Ventricular Tachycardia',
    rhythmType: 'Ventricular Tachycardia',
    heartRate: 180,
    ekgCharacteristics: {
      pWave: false, // AV dissociation
      prInterval: 0,
      qrsDuration: 140, // Wide QRS
      qtInterval: 280,
      regularity: 'regular'
    },
    expectedConductionPattern: {
      saNodeActive: false, // Overridden
      avNodeDelay: 0, // Bypassed
      ventricularActivation: 'wide',
      conductionBlocks: ['AV_DISSOCIATION']
    },
    expectedTimingSequence: {
      atrialDepolarization: 0,
      avNodeConduction: 0,
      ventricularDepolarization: 140,
      totalCycleTime: 333 // 60000/180
    },
    clinicalSignificance: 'critical'
  },

  {
    name: 'First Degree AV Block',
    rhythmType: 'First Degree AV Block',
    heartRate: 65,
    ekgCharacteristics: {
      pWave: true,
      prInterval: 240, // Prolonged
      qrsDuration: 95,
      qtInterval: 400,
      regularity: 'regular'
    },
    expectedConductionPattern: {
      saNodeActive: true,
      avNodeDelay: 180, // Prolonged
      ventricularActivation: 'normal',
      conductionBlocks: ['AV_CONDUCTION_DELAY']
    },
    expectedTimingSequence: {
      atrialDepolarization: 80,
      avNodeConduction: 180,
      ventricularDepolarization: 75,
      totalCycleTime: 923 // 60000/65
    },
    clinicalSignificance: 'monitor'
  },

  {
    name: 'Complete Heart Block',
    rhythmType: 'Third Degree AV Block',
    heartRate: 35, // Ventricular escape rhythm
    ekgCharacteristics: {
      pWave: true, // P waves present but dissociated
      prInterval: 0, // Variable/no relationship
      qrsDuration: 120, // Wide escape rhythm
      qtInterval: 480,
      regularity: 'regular' // Ventricular escape is regular
    },
    expectedConductionPattern: {
      saNodeActive: true, // SA node still firing
      avNodeDelay: 0, // Complete block
      ventricularActivation: 'wide', // Escape rhythm
      conductionBlocks: ['COMPLETE_AV_BLOCK']
    },
    expectedTimingSequence: {
      atrialDepolarization: 80, // Independent
      avNodeConduction: 0, // Blocked
      ventricularDepolarization: 120,
      totalCycleTime: 1714 // 60000/35
    },
    clinicalSignificance: 'critical'
  },

  {
    name: 'Left Bundle Branch Block',
    rhythmType: 'Sinus Rhythm with LBBB',
    heartRate: 68,
    ekgCharacteristics: {
      pWave: true,
      prInterval: 170,
      qrsDuration: 130, // Wide due to bundle block
      qtInterval: 420,
      regularity: 'regular'
    },
    expectedConductionPattern: {
      saNodeActive: true,
      avNodeDelay: 110,
      ventricularActivation: 'aberrant', // Abnormal sequence
      conductionBlocks: ['LEFT_BUNDLE_BLOCK']
    },
    expectedTimingSequence: {
      atrialDepolarization: 80,
      avNodeConduction: 110,
      ventricularDepolarization: 130, // Delayed due to block
      totalCycleTime: 882 // 60000/68
    },
    clinicalSignificance: 'monitor'
  }
];

// Medical accuracy thresholds
const ACCURACY_THRESHOLDS = {
  TIMING_TOLERANCE: 10, // ±10ms tolerance
  HEART_RATE_TOLERANCE: 5, // ±5 BPM tolerance
  MINIMUM_ACCURACY: 0.90, // 90% minimum accuracy
  EXCELLENT_ACCURACY: 0.95, // 95% excellent accuracy
  CONDUCTION_VELOCITY_TOLERANCE: 0.1 // ±0.1 m/s tolerance
};

describe('Medical Accuracy Validation', () => {
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let anatomicalHeart: AnatomicalHeartModel;
  let conductionVisualizer: ConductionSystemVisualizer;
  let electrophysiologyMapper: ElectrophysiologyMapper;
  let medicalAnalyzer: EKGMedicalAnalyzer;

  beforeEach(() => {
    // Setup Three.js environment
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    renderer = new THREE.WebGLRenderer();
    
    // Initialize medical components
    anatomicalHeart = new AnatomicalHeartModel(scene);
    conductionVisualizer = new ConductionSystemVisualizer(scene, camera, renderer);
    electrophysiologyMapper = new ElectrophysiologyMapper();
    medicalAnalyzer = new EKGMedicalAnalyzer();
  });

  afterEach(() => {
    // Cleanup
    renderer.dispose();
    scene.clear();
  });

  describe('Anatomical Accuracy Tests', () => {
    test('Heart chamber dimensions should match medical standards', () => {
      const chambers = anatomicalHeart.getChambers();
      
      // Test left ventricle dimensions
      const leftVentricle = chambers.get('LV');
      expect(leftVentricle).toBeDefined();
      expect(leftVentricle!.volume).toBeGreaterThanOrEqual(120); // Normal LV EDV: 120-160ml
      expect(leftVentricle!.volume).toBeLessThanOrEqual(160);
      expect(leftVentricle!.wallThickness).toBeGreaterThanOrEqual(8); // Normal LV wall: 8-12mm
      expect(leftVentricle!.wallThickness).toBeLessThanOrEqual(15);

      // Test right ventricle dimensions
      const rightVentricle = chambers.get('RV');
      expect(rightVentricle).toBeDefined();
      expect(rightVentricle!.wallThickness).toBeGreaterThanOrEqual(2); // Normal RV wall: 2-5mm
      expect(rightVentricle!.wallThickness).toBeLessThanOrEqual(6);
    });

    test('Conduction system positioning should be anatomically correct', () => {
      const conductionNodes = anatomicalHeart.getConductionNodes();
      
      // SA node position (upper right atrium)
      const saNode = conductionNodes.get('SA_NODE');
      expect(saNode).toBeDefined();
      expect(saNode!.position.x).toBeGreaterThan(20); // Right side
      expect(saNode!.position.y).toBeGreaterThan(10); // Upper position
      
      // AV node position (interventricular septum)
      const avNode = conductionNodes.get('AV_NODE');
      expect(avNode).toBeDefined();
      expect(Math.abs(avNode!.position.x)).toBeLessThan(5); // Central position
      expect(avNode!.position.y).toBeLessThan(0); // Lower than SA node
    });

    test('Medical accuracy metrics should meet professional standards', () => {
      const metrics = anatomicalHeart.getMedicalAccuracyMetrics();
      
      expect(metrics.anatomicalAccuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLDS.MINIMUM_ACCURACY);
      expect(metrics.timingAccuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLDS.MINIMUM_ACCURACY);
      expect(metrics.conductionAccuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLDS.MINIMUM_ACCURACY);
    });
  });

  describe('Electrophysiology Mapping Tests', () => {
    MEDICAL_TEST_CASES.forEach((testCase) => {
      describe(`${testCase.name} Tests`, () => {
        test('Should correctly map EKG characteristics to electrophysiology', async () => {
          // Create mock EKG analysis based on test case
          const mockEKGAnalysis = createMockEKGAnalysis(testCase);
          
          // Map to electrophysiology state
          const electrophysiologyState = electrophysiologyMapper.mapEKGToElectrophysiology(
            mockEKGAnalysis,
            0 // Start of cycle
          );

          // Validate timing sequence
          validateTimingSequence(electrophysiologyState, testCase);
          
          // Validate conduction patterns
          validateConductionPattern(electrophysiologyState, testCase);
          
          // Validate clinical accuracy
          validateClinicalAccuracy(electrophysiologyState, testCase);
        });

        test('Should maintain timing accuracy throughout cardiac cycle', () => {
          const mockEKGAnalysis = createMockEKGAnalysis(testCase);
          
          // Test multiple points in cardiac cycle
          const testPoints = [0, 50, 100, 200, 400, 600];
          
          testPoints.forEach(timePoint => {
            const state = electrophysiologyMapper.mapEKGToElectrophysiology(
              mockEKGAnalysis,
              timePoint
            );
            
            validateTimingAccuracy(state, testCase, timePoint);
          });
        });

        test('Should correctly visualize conduction abnormalities', () => {
          const mockEKGAnalysis = createMockEKGAnalysis(testCase);
          
          // Update heart model with test case
          anatomicalHeart.processEKGData(mockEKGAnalysis);
          
          // Validate conduction blocks are properly represented
          validateConductionBlocks(testCase);
        });
      });
    });
  });

  describe('Real-time Processing Tests', () => {
    test('Should process EKG data within medical timing requirements', async () => {
      const startTime = performance.now();
      
      const mockEKGFile = createMockEKGFile('normal_sinus');
      const analysis = await medicalAnalyzer.analyzeEKGFile(mockEKGFile);
      
      const processingTime = performance.now() - startTime;
      
      // Processing should be under 100ms for real-time use
      expect(processingTime).toBeLessThan(100);
      expect(analysis).toBeDefined();
      expect(analysis.confidence_score).toBeGreaterThan(0.8);
    });

    test('Should maintain frame rate requirements during animation', () => {
      const frameCount = 60; // Test 1 second at 60fps
      const frameStartTime = performance.now();
      
      // Simulate 60 frames of animation
      for (let frame = 0; frame < frameCount; frame++) {
        const deltaTime = 1000 / 60; // 60fps
        anatomicalHeart.updateAnimation(deltaTime);
      }
      
      const totalTime = performance.now() - frameStartTime;
      const averageFrameTime = totalTime / frameCount;
      
      // Each frame should complete in under 16.67ms for 60fps
      expect(averageFrameTime).toBeLessThan(16.67);
    });
  });

  // Helper functions for test validation
  function createMockEKGAnalysis(testCase: MedicalTestCase): any {
    return {
      rhythm_analysis: {
        primary_rhythm: testCase.rhythmType,
        heart_rate: testCase.heartRate,
        regularity: testCase.ekgCharacteristics.regularity,
        clinical_significance: testCase.clinicalSignificance,
        confidence: 0.95,
        details: `Test case for ${testCase.name}`
      },
      timing_measurements: {
        pr_interval: testCase.ekgCharacteristics.prInterval,
        qrs_duration: testCase.ekgCharacteristics.qrsDuration,
        qt_interval: testCase.ekgCharacteristics.qtInterval,
        rr_interval_variability: testCase.ekgCharacteristics.regularity === 'regular' ? 0.05 : 0.3
      },
      conduction_pathway: {
        sa_node: {
          status: testCase.expectedConductionPattern.saNodeActive ? 'normal' : 'abnormal',
          details: testCase.expectedConductionPattern.saNodeActive ? 'Normal SA node function' : 'SA node suppressed or overridden'
        },
        av_node: {
          status: testCase.expectedConductionPattern.avNodeDelay > 120 ? 'abnormal' : 'normal',
          delay: testCase.expectedConductionPattern.avNodeDelay
        },
        his_purkinje: {
          status: testCase.expectedConductionPattern.ventricularActivation === 'normal' ? 'normal' : 'abnormal',
          details: `Ventricular activation: ${testCase.expectedConductionPattern.ventricularActivation}`
        }
      },
      educational_focus: {
        key_teaching_points: [
          `Key characteristic: ${testCase.name}`,
          `Heart rate: ${testCase.heartRate} BPM`,
          `Clinical significance: ${testCase.clinicalSignificance}`
        ],
        common_misconceptions: ['Test misconception'],
        clinical_correlations: ['Test correlation']
      },
      confidence_score: 0.95
    };
  }

  function createMockEKGFile(rhythmType: string): File {
    const mockContent = new Uint8Array(1024).fill(128);
    return new File([mockContent], `mock_${rhythmType}.png`, { type: 'image/png' });
  }

  function validateTimingSequence(state: any, testCase: MedicalTestCase): void {
    // Validate that timing matches expected medical values
    const activeRegions = state.activeRegions || [];
    
    if (testCase.expectedConductionPattern.saNodeActive) {
      const saRegion = activeRegions.find((r: any) => r.anatomicalLocation.includes('SA'));
      if (saRegion) {
        expect(saRegion.activationTime).toBeLessThanOrEqual(ACCURACY_THRESHOLDS.TIMING_TOLERANCE);
      }
    }
  }

  function validateConductionPattern(state: any, testCase: MedicalTestCase): void {
    const activeRegions = state.activeRegions || [];
    const blockedRegions = activeRegions.filter((r: any) => r.isBlocked);
    
    // Validate expected blocks are present
    testCase.expectedConductionPattern.conductionBlocks.forEach(expectedBlock => {
      const hasExpectedBlock = blockedRegions.some((region: any) => 
        region.anatomicalLocation.includes(expectedBlock.replace('_', ''))
      );
      
      if (expectedBlock !== 'NONE') {
        expect(hasExpectedBlock).toBe(true);
      }
    });
  }

  function validateClinicalAccuracy(state: any, testCase: MedicalTestCase): void {
    const electricalWaves = state.electricalWaves || [];
    
    // For VT, should have abnormal waves
    if (testCase.rhythmType.includes('Ventricular Tachycardia')) {
      const abnormalWaves = electricalWaves.filter((wave: any) => wave.isAbnormal);
      expect(abnormalWaves.length).toBeGreaterThan(0);
    }
  }

  function validateTimingAccuracy(state: any, testCase: MedicalTestCase, timePoint: number): void {
    const expectedCycleLength = testCase.expectedTimingSequence.totalCycleTime;
    const cyclePosition = timePoint % expectedCycleLength;
    const activeRegions = state.activeRegions || [];
    
    // During atrial depolarization phase
    if (cyclePosition >= 0 && cyclePosition <= testCase.expectedTimingSequence.atrialDepolarization) {
      if (testCase.expectedConductionPattern.saNodeActive) {
        const atrialRegions = activeRegions.filter((r: any) => 
          r.anatomicalLocation.includes('ATRIAL') || r.anatomicalLocation.includes('SA')
        );
        expect(atrialRegions.length).toBeGreaterThan(0);
      }
    }
  }

  function validateConductionBlocks(testCase: MedicalTestCase): void {
    const conductionNodes = anatomicalHeart.getConductionNodes();
    
    testCase.expectedConductionPattern.conductionBlocks.forEach(blockType => {
      switch (blockType) {
        case 'SA_NODE_SUPPRESSION':
          const saNode = conductionNodes.get('SA_NODE');
          expect(saNode).toBeDefined();
          break;
          
        case 'COMPLETE_AV_BLOCK':
          const avNode = conductionNodes.get('AV_NODE');
          expect(avNode).toBeDefined();
          break;
          
        case 'LEFT_BUNDLE_BLOCK':
          const leftBundle = conductionNodes.get('LEFT_BUNDLE');
          expect(leftBundle).toBeDefined();
          break;
      }
    });
  }
});

// Export for other test files
export {
  MEDICAL_TEST_CASES,
  ACCURACY_THRESHOLDS,
  createMockEKGAnalysis,
  createMockEKGFile
};