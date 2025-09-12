/**
 * Electrophysiology Mapper
 *
 * Maps EKG signals to specific cardiac electrophysiological states
 * with millisecond precision for accurate heart model animation
 */
import { EKGAnalysisResult } from '../../ekg-processor/src/index';
export interface ElectrophysiologyState {
    timestamp: number;
    activeRegions: ConductionRegion[];
    electricalWaves: ElectricalWave[];
    chamberStates: Map<string, ChamberElectricalState>;
    conductionVelocity: number;
    depolarizationFront: WaveFront;
    repolarizationFront: WaveFront;
}
export interface ConductionRegion {
    regionId: string;
    anatomicalLocation: string;
    activationTime: number;
    depolarizationDuration: number;
    repolarizationTime: number;
    conductionVelocity: number;
    isBlocked: boolean;
    blockType?: 'partial' | 'complete' | 'intermittent';
}
export interface ElectricalWave {
    waveId: string;
    waveType: 'depolarization' | 'repolarization';
    currentPosition: {
        x: number;
        y: number;
        z: number;
    };
    waveFront: {
        x: number;
        y: number;
        z: number;
    }[];
    velocity: number;
    amplitude: number;
    sourceRegion: string;
    targetRegions: string[];
    propagationPath: string[];
    isAbnormal: boolean;
}
export interface ChamberElectricalState {
    chamberName: string;
    currentState: 'resting' | 'depolarizing' | 'depolarized' | 'repolarizing';
    activationTime: number;
    depolarizationProgress: number;
    repolarizationProgress: number;
    membraneVoltage: number;
    actionPotentialPhase: 0 | 1 | 2 | 3 | 4;
}
export interface WaveFront {
    frontPoints: {
        x: number;
        y: number;
        z: number;
    }[];
    velocity: number;
    direction: {
        x: number;
        y: number;
        z: number;
    };
    intensity: number;
}
export interface TimingCalibration {
    samplingRate: number;
    timeScale: number;
    cycleLength: number;
    heartRate: number;
    precision: number;
}
export declare class ElectrophysiologyMapper {
    private timingCalibration;
    private currentCycleTime;
    private ekgSamplingRate;
    private animationFrameRate;
    private precisionThreshold;
    constructor();
    /**
     * Map EKG analysis to electrophysiology states with precise timing
     */
    mapEKGToElectrophysiology(ekgAnalysis: EKGAnalysisResult, currentTime: number): ElectrophysiologyState;
    private updateTimingCalibration;
    private getActiveRegions;
    private getNormalConductionRegions;
    private getAtrialFibrillationRegions;
    private getVentricularTachycardiaRegions;
    private getFirstDegreeBlockRegions;
    private generateElectricalWaves;
    private createNormalWaves;
    private createFibrillationWaves;
    private createVentricularTachycardiaWaves;
    private calculateChamberStates;
    private createDepolarizationFront;
    private createRepolarizationFront;
    private getCurrentConductionVelocity;
    private calculateAtrialWaveFront;
    private calculateVentricularWaveFront;
    private calculateRepolarizationWaveFront;
    private calculateChaoticWaveFront;
    private calculateVTWaveFront;
    private calculateWaveFrontPoints;
    private generateChaoticAtrialFoci;
    private getIrregularAVConduction;
    setTimingCalibration(calibration: Partial<TimingCalibration>): void;
    getCurrentCycleTime(): number;
    getTimingCalibration(): TimingCalibration;
    resetCycle(): void;
}
//# sourceMappingURL=ElectrophysiologyMapper.d.ts.map