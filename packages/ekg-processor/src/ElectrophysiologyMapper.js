"use strict";
/**
 * Electrophysiology Mapper
 *
 * Maps EKG signals to specific cardiac electrophysiological states
 * with millisecond precision for accurate heart model animation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElectrophysiologyMapper = void 0;
/**
 * Medical constants for electrophysiology mapping
 */
const ELECTROPHYSIOLOGY_MAPPING = {
    // Standard conduction times (ms)
    CONDUCTION_TIMES: {
        SA_TO_ATRIA: 0,
        ATRIAL_DEPOLARIZATION: 80,
        AV_NODE_DELAY: 100,
        HIS_BUNDLE_CONDUCTION: 20,
        BUNDLE_BRANCH_CONDUCTION: 25,
        PURKINJE_CONDUCTION: 20,
        VENTRICULAR_DEPOLARIZATION: 75,
        VENTRICULAR_REPOLARIZATION: 200
    },
    // Conduction velocities (m/s)
    CONDUCTION_VELOCITIES: {
        ATRIAL_MUSCLE: 0.3,
        AV_NODE: 0.02,
        HIS_PURKINJE: 2.5,
        VENTRICULAR_MUSCLE: 0.4
    },
    // EKG wave to anatomy mapping
    EKG_TO_ANATOMY: {
        P_WAVE: {
            regions: ['SA_NODE', 'RA', 'LA', 'ATRIAL_PATHWAYS'],
            startTime: 0,
            duration: 80
        },
        PR_SEGMENT: {
            regions: ['AV_NODE'],
            startTime: 80,
            duration: 100
        },
        QRS_COMPLEX: {
            regions: ['HIS_BUNDLE', 'BUNDLE_BRANCHES', 'PURKINJE_NETWORK', 'VENTRICULAR_MUSCLE'],
            startTime: 180,
            duration: 75
        },
        ST_SEGMENT: {
            regions: ['VENTRICULAR_MUSCLE'],
            startTime: 255,
            duration: 100
        },
        T_WAVE: {
            regions: ['VENTRICULAR_MUSCLE'],
            startTime: 355,
            duration: 200
        }
    },
    // Abnormal rhythm patterns
    RHYTHM_PATTERNS: {
        ATRIAL_FIBRILLATION: {
            characteristics: {
                sa_node_suppressed: true,
                chaotic_atrial_activation: true,
                irregular_av_conduction: true,
                normal_ventricular_conduction: true
            }
        },
        VENTRICULAR_TACHYCARDIA: {
            characteristics: {
                ventricular_origin: true,
                retrograde_conduction: true,
                wide_qrs: true,
                av_dissociation: true
            }
        },
        HEART_BLOCK: {
            first_degree: { pr_prolongation: true, av_delay_increased: true },
            second_degree: { intermittent_av_block: true },
            third_degree: { complete_av_block: true, av_dissociation: true }
        }
    }
};
class ElectrophysiologyMapper {
    constructor() {
        this.currentCycleTime = 0;
        this.ekgSamplingRate = 500; // Hz
        this.animationFrameRate = 60; // FPS
        this.precisionThreshold = 1; // ms
        this.timingCalibration = {
            samplingRate: 500,
            timeScale: 40, // ms per mm at 25mm/sec
            cycleLength: 800, // 75 BPM default
            heartRate: 75,
            precision: 1
        };
    }
    /**
     * Map EKG analysis to electrophysiology states with precise timing
     */
    mapEKGToElectrophysiology(ekgAnalysis, currentTime) {
        // Update timing calibration based on EKG analysis
        this.updateTimingCalibration(ekgAnalysis);
        // Calculate current position in cardiac cycle
        const cyclePosition = currentTime % this.timingCalibration.cycleLength;
        // Determine active conduction regions
        const activeRegions = this.getActiveRegions(cyclePosition, ekgAnalysis);
        // Generate electrical waves
        const electricalWaves = this.generateElectricalWaves(cyclePosition, ekgAnalysis);
        // Calculate chamber electrical states
        const chamberStates = this.calculateChamberStates(cyclePosition, ekgAnalysis);
        // Create wave fronts
        const depolarizationFront = this.createDepolarizationFront(cyclePosition);
        const repolarizationFront = this.createRepolarizationFront(cyclePosition);
        return {
            timestamp: cyclePosition,
            activeRegions,
            electricalWaves,
            chamberStates,
            conductionVelocity: this.getCurrentConductionVelocity(cyclePosition),
            depolarizationFront,
            repolarizationFront
        };
    }
    updateTimingCalibration(ekgAnalysis) {
        const heartRate = ekgAnalysis.analysis.heart_rate;
        this.timingCalibration.heartRate = heartRate;
        this.timingCalibration.cycleLength = (60 / heartRate) * 1000; // Convert BPM to ms
        // Adjust timing based on measured intervals
        if (ekgAnalysis.analysis.conduction_timing) {
            const measurements = ekgAnalysis.analysis.conduction_timing;
            // Update conduction times based on measured intervals
            ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_TIMES.AV_NODE_DELAY =
                Math.max(50, ekgAnalysis.analysis.intervals.pr_interval - 80); // PR interval - P wave duration
            ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_TIMES.VENTRICULAR_DEPOLARIZATION =
                Math.max(60, measurements.qrs_duration);
        }
    }
    getActiveRegions(cyclePosition, ekgAnalysis) {
        const activeRegions = [];
        const rhythmType = ekgAnalysis.analysis.rhythm_classification;
        // Map rhythm to conduction pattern
        switch (rhythmType) {
            case 'Normal Sinus Rhythm':
                activeRegions.push(...this.getNormalConductionRegions(cyclePosition));
                break;
            case 'Atrial Fibrillation':
                activeRegions.push(...this.getAtrialFibrillationRegions(cyclePosition));
                break;
            case 'Ventricular Tachycardia':
                activeRegions.push(...this.getVentricularTachycardiaRegions(cyclePosition));
                break;
            case 'First Degree AV Block':
                activeRegions.push(...this.getFirstDegreeBlockRegions(cyclePosition, ekgAnalysis));
                break;
            default:
                activeRegions.push(...this.getNormalConductionRegions(cyclePosition));
        }
        return activeRegions;
    }
    getNormalConductionRegions(cyclePosition) {
        const regions = [];
        const times = ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_TIMES;
        // SA Node activation
        if (cyclePosition >= 0 && cyclePosition <= 20) {
            regions.push({
                regionId: 'SA_NODE',
                anatomicalLocation: 'SA_NODE',
                activationTime: 0,
                depolarizationDuration: 20,
                repolarizationTime: 150,
                conductionVelocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.ATRIAL_MUSCLE,
                isBlocked: false
            });
        }
        // Atrial depolarization
        if (cyclePosition >= 0 && cyclePosition <= times.ATRIAL_DEPOLARIZATION) {
            regions.push({
                regionId: 'ATRIAL_DEPOLARIZATION',
                anatomicalLocation: 'ATRIAL_MUSCLE',
                activationTime: 0,
                depolarizationDuration: times.ATRIAL_DEPOLARIZATION,
                repolarizationTime: times.ATRIAL_DEPOLARIZATION + 200,
                conductionVelocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.ATRIAL_MUSCLE,
                isBlocked: false
            });
        }
        // AV Node conduction
        if (cyclePosition >= times.ATRIAL_DEPOLARIZATION &&
            cyclePosition <= times.ATRIAL_DEPOLARIZATION + times.AV_NODE_DELAY) {
            regions.push({
                regionId: 'AV_NODE',
                anatomicalLocation: 'AV_NODE',
                activationTime: times.ATRIAL_DEPOLARIZATION,
                depolarizationDuration: times.AV_NODE_DELAY,
                repolarizationTime: times.ATRIAL_DEPOLARIZATION + times.AV_NODE_DELAY + 300,
                conductionVelocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.AV_NODE,
                isBlocked: false
            });
        }
        // Ventricular conduction system
        const ventricularStart = times.ATRIAL_DEPOLARIZATION + times.AV_NODE_DELAY;
        if (cyclePosition >= ventricularStart &&
            cyclePosition <= ventricularStart + times.VENTRICULAR_DEPOLARIZATION) {
            regions.push({
                regionId: 'VENTRICULAR_CONDUCTION',
                anatomicalLocation: 'HIS_PURKINJE',
                activationTime: ventricularStart,
                depolarizationDuration: times.VENTRICULAR_DEPOLARIZATION,
                repolarizationTime: ventricularStart + times.VENTRICULAR_DEPOLARIZATION + times.VENTRICULAR_REPOLARIZATION,
                conductionVelocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.HIS_PURKINJE,
                isBlocked: false
            });
        }
        return regions;
    }
    getAtrialFibrillationRegions(cyclePosition) {
        const regions = [];
        // SA Node suppressed
        regions.push({
            regionId: 'SA_NODE',
            anatomicalLocation: 'SA_NODE',
            activationTime: 0,
            depolarizationDuration: 0,
            repolarizationTime: 0,
            conductionVelocity: 0,
            isBlocked: true,
            blockType: 'complete'
        });
        // Multiple chaotic atrial foci
        const chaoticFoci = this.generateChaoticAtrialFoci(cyclePosition);
        regions.push(...chaoticFoci);
        // AV node with irregular conduction
        const avRegion = this.getIrregularAVConduction(cyclePosition);
        if (avRegion)
            regions.push(avRegion);
        return regions;
    }
    getVentricularTachycardiaRegions(cyclePosition) {
        const regions = [];
        // Ventricular ectopic focus
        regions.push({
            regionId: 'VENTRICULAR_FOCUS',
            anatomicalLocation: 'VENTRICULAR_MUSCLE',
            activationTime: 0,
            depolarizationDuration: 150, // Wide QRS
            repolarizationTime: 200,
            conductionVelocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.VENTRICULAR_MUSCLE,
            isBlocked: false
        });
        // AV dissociation
        regions.push({
            regionId: 'AV_NODE',
            anatomicalLocation: 'AV_NODE',
            activationTime: 0,
            depolarizationDuration: 0,
            repolarizationTime: 0,
            conductionVelocity: 0,
            isBlocked: true,
            blockType: 'complete'
        });
        return regions;
    }
    getFirstDegreeBlockRegions(cyclePosition, ekgAnalysis) {
        const regions = this.getNormalConductionRegions(cyclePosition);
        // Modify AV node region to show prolonged conduction
        const avRegion = regions.find(r => r.regionId === 'AV_NODE');
        if (avRegion && ekgAnalysis.analysis.intervals) {
            const prolongedDelay = ekgAnalysis.analysis.intervals.pr_interval - 80; // Subtract P wave
            avRegion.depolarizationDuration = prolongedDelay;
            avRegion.conductionVelocity *= 0.5; // Slower conduction
        }
        return regions;
    }
    generateElectricalWaves(cyclePosition, ekgAnalysis) {
        const waves = [];
        const rhythmType = ekgAnalysis.analysis.rhythm_classification;
        switch (rhythmType) {
            case 'Normal Sinus Rhythm':
                waves.push(...this.createNormalWaves(cyclePosition));
                break;
            case 'Atrial Fibrillation':
                waves.push(...this.createFibrillationWaves(cyclePosition));
                break;
            case 'Ventricular Tachycardia':
                waves.push(...this.createVentricularTachycardiaWaves(cyclePosition));
                break;
        }
        return waves;
    }
    createNormalWaves(cyclePosition) {
        const waves = [];
        // P wave (atrial depolarization)
        if (cyclePosition >= 0 && cyclePosition <= 80) {
            waves.push({
                waveId: 'P_WAVE',
                waveType: 'depolarization',
                currentPosition: { x: 25, y: 15, z: -10 }, // SA node position
                waveFront: this.calculateAtrialWaveFront(cyclePosition),
                velocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.ATRIAL_MUSCLE,
                amplitude: 0.2, // mV
                sourceRegion: 'SA_NODE',
                targetRegions: ['RA', 'LA'],
                propagationPath: ['SA_NODE', 'ATRIAL_PATHWAYS', 'AV_NODE'],
                isAbnormal: false
            });
        }
        // QRS wave (ventricular depolarization)
        const qrsStart = 180;
        const qrsEnd = qrsStart + 75;
        if (cyclePosition >= qrsStart && cyclePosition <= qrsEnd) {
            waves.push({
                waveId: 'QRS_WAVE',
                waveType: 'depolarization',
                currentPosition: { x: 0, y: -15, z: 0 }, // His bundle position
                waveFront: this.calculateVentricularWaveFront(cyclePosition - qrsStart),
                velocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.HIS_PURKINJE,
                amplitude: 1.5, // mV
                sourceRegion: 'HIS_BUNDLE',
                targetRegions: ['LV', 'RV'],
                propagationPath: ['HIS_BUNDLE', 'BUNDLE_BRANCHES', 'PURKINJE_NETWORK', 'VENTRICULAR_MUSCLE'],
                isAbnormal: false
            });
        }
        // T wave (ventricular repolarization)
        const tStart = 355;
        const tEnd = tStart + 200;
        if (cyclePosition >= tStart && cyclePosition <= tEnd) {
            waves.push({
                waveId: 'T_WAVE',
                waveType: 'repolarization',
                currentPosition: { x: 0, y: -20, z: 0 }, // Ventricular center
                waveFront: this.calculateRepolarizationWaveFront(cyclePosition - tStart),
                velocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.VENTRICULAR_MUSCLE,
                amplitude: 0.3, // mV
                sourceRegion: 'VENTRICULAR_MUSCLE',
                targetRegions: ['LV', 'RV'],
                propagationPath: ['VENTRICULAR_MUSCLE'],
                isAbnormal: false
            });
        }
        return waves;
    }
    createFibrillationWaves(cyclePosition) {
        const waves = [];
        // Multiple random atrial wavelets
        const numWavelets = 5 + Math.floor(Math.random() * 3); // 5-8 wavelets
        for (let i = 0; i < numWavelets; i++) {
            const randomPosition = {
                x: (Math.random() - 0.5) * 40, // Random atrial position
                y: 10 + Math.random() * 10,
                z: (Math.random() - 0.5) * 20
            };
            waves.push({
                waveId: `FIBRILLATION_WAVELET_${i}`,
                waveType: 'depolarization',
                currentPosition: randomPosition,
                waveFront: this.calculateChaoticWaveFront(randomPosition),
                velocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.ATRIAL_MUSCLE * (0.5 + Math.random() * 0.5),
                amplitude: 0.1 + Math.random() * 0.1, // Variable amplitude
                sourceRegion: 'ATRIAL_MUSCLE',
                targetRegions: ['RA', 'LA'],
                propagationPath: ['ATRIAL_MUSCLE'],
                isAbnormal: true
            });
        }
        // Irregular QRS waves
        if (Math.random() > 0.6) { // 40% chance of QRS in any given cycle position
            waves.push(...this.createNormalWaves(cyclePosition).filter(w => w.waveId === 'QRS_WAVE'));
        }
        return waves;
    }
    createVentricularTachycardiaWaves(cyclePosition) {
        const waves = [];
        // Wide QRS from ventricular focus
        const qrsDuration = 150; // Wide QRS characteristic of VT
        if (cyclePosition <= qrsDuration) {
            waves.push({
                waveId: 'VT_QRS',
                waveType: 'depolarization',
                currentPosition: { x: -10, y: -25, z: 5 }, // Left ventricular focus
                waveFront: this.calculateVTWaveFront(cyclePosition),
                velocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.VENTRICULAR_MUSCLE,
                amplitude: 2.0, // High amplitude
                sourceRegion: 'VENTRICULAR_FOCUS',
                targetRegions: ['LV', 'RV'],
                propagationPath: ['VENTRICULAR_MUSCLE'],
                isAbnormal: true
            });
        }
        return waves;
    }
    calculateChamberStates(cyclePosition, ekgAnalysis) {
        const chamberStates = new Map();
        // Define chamber activation times based on normal conduction
        const activationTimes = {
            'RA': 0,
            'LA': 10,
            'RV': 185,
            'LV': 190
        };
        // Calculate states for each chamber
        ['RA', 'LA', 'RV', 'LV'].forEach(chamber => {
            const activationTime = activationTimes[chamber];
            const isAtrial = chamber.includes('A');
            const apDuration = isAtrial ? 200 : 350; // Action potential duration
            let currentState = 'resting';
            let depolarizationProgress = 0;
            let repolarizationProgress = 0;
            let membraneVoltage = -90; // Resting potential
            let actionPotentialPhase = 4;
            const timeSinceActivation = cyclePosition - activationTime;
            if (timeSinceActivation >= 0 && timeSinceActivation < apDuration) {
                if (timeSinceActivation < 20) {
                    currentState = 'depolarizing';
                    depolarizationProgress = timeSinceActivation / 20;
                    membraneVoltage = -90 + (130 * depolarizationProgress); // -90mV to +40mV
                    actionPotentialPhase = 0;
                }
                else if (timeSinceActivation < apDuration - 50) {
                    currentState = 'depolarized';
                    depolarizationProgress = 1;
                    membraneVoltage = isAtrial ? -70 : 20; // Plateau phase
                    actionPotentialPhase = isAtrial ? 1 : 2;
                }
                else {
                    currentState = 'repolarizing';
                    repolarizationProgress = (timeSinceActivation - (apDuration - 50)) / 50;
                    membraneVoltage = (isAtrial ? -70 : 20) - (130 * repolarizationProgress);
                    actionPotentialPhase = 3;
                }
            }
            chamberStates.set(chamber, {
                chamberName: chamber,
                currentState,
                activationTime,
                depolarizationProgress,
                repolarizationProgress,
                membraneVoltage,
                actionPotentialPhase
            });
        });
        return chamberStates;
    }
    createDepolarizationFront(cyclePosition) {
        // Calculate depolarization wave front based on cycle position
        return {
            frontPoints: this.calculateWaveFrontPoints('depolarization', cyclePosition),
            velocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.HIS_PURKINJE,
            direction: { x: 0, y: -1, z: 0 }, // Apex-ward direction
            intensity: Math.max(0, 1 - (cyclePosition / 300))
        };
    }
    createRepolarizationFront(cyclePosition) {
        const repolarizationStart = 355; // T wave start
        const relativeTime = Math.max(0, cyclePosition - repolarizationStart);
        return {
            frontPoints: this.calculateWaveFrontPoints('repolarization', relativeTime),
            velocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.VENTRICULAR_MUSCLE,
            direction: { x: 0, y: 1, z: 0 }, // Base-ward direction
            intensity: Math.max(0, 1 - (relativeTime / 200))
        };
    }
    getCurrentConductionVelocity(cyclePosition) {
        if (cyclePosition < 80) {
            return ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.ATRIAL_MUSCLE;
        }
        else if (cyclePosition < 180) {
            return ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.AV_NODE;
        }
        else if (cyclePosition < 255) {
            return ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.HIS_PURKINJE;
        }
        else {
            return ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.VENTRICULAR_MUSCLE;
        }
    }
    // Helper methods for wave front calculations
    calculateAtrialWaveFront(cyclePosition) {
        const progress = Math.min(1, cyclePosition / 80);
        const radius = progress * 30; // Expand from SA node
        const points = [];
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            points.push({
                x: 25 + Math.cos(angle) * radius,
                y: 15 + Math.sin(angle) * radius * 0.5,
                z: -10 + Math.sin(angle * 2) * radius * 0.3
            });
        }
        return points;
    }
    calculateVentricularWaveFront(relativeTime) {
        const progress = Math.min(1, relativeTime / 75);
        // Simulate wave spreading from septum to lateral walls
        const points = [];
        const baseRadius = progress * 25;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            points.push({
                x: Math.cos(angle) * baseRadius,
                y: -15 - (progress * 15), // Move towards apex
                z: Math.sin(angle) * baseRadius
            });
        }
        return points;
    }
    calculateRepolarizationWaveFront(relativeTime) {
        const progress = Math.min(1, relativeTime / 200);
        // Repolarization typically spreads from epicardium to endocardium
        const points = [];
        const radius = 20 - (progress * 5); // Shrinking wave front
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            points.push({
                x: Math.cos(angle) * radius,
                y: -25 + (progress * 10), // Move towards base
                z: Math.sin(angle) * radius
            });
        }
        return points;
    }
    calculateChaoticWaveFront(position) {
        const points = [];
        const numPoints = 4 + Math.floor(Math.random() * 4); // 4-8 points
        for (let i = 0; i < numPoints; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 2 + Math.random() * 8;
            points.push({
                x: position.x + Math.cos(angle) * radius,
                y: position.y + Math.sin(angle) * radius,
                z: position.z + (Math.random() - 0.5) * radius
            });
        }
        return points;
    }
    calculateVTWaveFront(relativeTime) {
        const progress = Math.min(1, relativeTime / 150);
        // VT spreads more slowly and irregularly
        const points = [];
        const baseRadius = progress * 30;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const irregularRadius = baseRadius * (0.7 + Math.random() * 0.6);
            points.push({
                x: -10 + Math.cos(angle) * irregularRadius,
                y: -25 + Math.sin(angle) * irregularRadius * 0.8,
                z: 5 + Math.sin(angle * 1.5) * irregularRadius * 0.4
            });
        }
        return points;
    }
    calculateWaveFrontPoints(waveType, cyclePosition) {
        if (waveType === 'depolarization') {
            if (cyclePosition < 80) {
                return this.calculateAtrialWaveFront(cyclePosition);
            }
            else if (cyclePosition >= 180 && cyclePosition < 255) {
                return this.calculateVentricularWaveFront(cyclePosition - 180);
            }
        }
        else if (waveType === 'repolarization' && cyclePosition >= 355) {
            return this.calculateRepolarizationWaveFront(cyclePosition - 355);
        }
        return [];
    }
    // Utility methods for abnormal rhythms
    generateChaoticAtrialFoci(cyclePosition) {
        const foci = [];
        const numFoci = 3 + Math.floor(Math.random() * 3); // 3-6 foci
        for (let i = 0; i < numFoci; i++) {
            foci.push({
                regionId: `CHAOTIC_FOCUS_${i}`,
                anatomicalLocation: 'ATRIAL_MUSCLE',
                activationTime: Math.random() * 100,
                depolarizationDuration: 20 + Math.random() * 40,
                repolarizationTime: 100 + Math.random() * 100,
                conductionVelocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.ATRIAL_MUSCLE * (0.3 + Math.random() * 0.7),
                isBlocked: false
            });
        }
        return foci;
    }
    getIrregularAVConduction(cyclePosition) {
        // Irregular AV conduction in AF
        const conductionProbability = 0.6; // 60% chance of conduction
        if (Math.random() < conductionProbability) {
            return {
                regionId: 'AV_NODE',
                anatomicalLocation: 'AV_NODE',
                activationTime: 50 + Math.random() * 100, // Variable timing
                depolarizationDuration: 80 + Math.random() * 60, // Variable delay
                repolarizationTime: 200 + Math.random() * 100,
                conductionVelocity: ELECTROPHYSIOLOGY_MAPPING.CONDUCTION_VELOCITIES.AV_NODE * (0.5 + Math.random() * 0.5),
                isBlocked: false
            };
        }
        return null;
    }
    // Public interface methods
    setTimingCalibration(calibration) {
        this.timingCalibration = { ...this.timingCalibration, ...calibration };
    }
    getCurrentCycleTime() {
        return this.currentCycleTime;
    }
    getTimingCalibration() {
        return this.timingCalibration;
    }
    resetCycle() {
        this.currentCycleTime = 0;
    }
}
exports.ElectrophysiologyMapper = ElectrophysiologyMapper;
