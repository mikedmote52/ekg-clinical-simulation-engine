/**
 * EKG Processor Package
 * Enhanced clinical-grade EKG analysis system with real file processing
 */
import { MedicalAnalysis } from '@ekg-sim/medical-types';
export interface EKGAnalysisResult {
    analysis: MedicalAnalysis;
    quality_score: number;
    processing_time_ms: number;
    file_metadata: {
        filename: string;
        file_size: number;
        format: string;
    };
}
export declare function processEKGFile(file: File): Promise<EKGAnalysisResult>;
export type { MedicalAnalysis, ConductionTiming, AnimationTiming, HeartVisualization, EducationalContent, AppContext } from '@ekg-sim/medical-types';
declare const _default: {
    processEKGFile: typeof processEKGFile;
};
export default _default;
//# sourceMappingURL=index.d.ts.map