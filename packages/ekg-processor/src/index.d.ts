/**
 * EKG Processor Package
 * Enhanced clinical-grade EKG analysis system with real file processing
 */
export interface MedicalAnalysis {
    rhythm_classification: 'normal_sinus' | 'atrial_fibrillation' | 'ventricular_tachycardia' | 'heart_block' | 'sinus_bradycardia' | 'sinus_tachycardia' | 'premature_ventricular_contractions';
    heart_rate: number;
    conduction_timing: {
        sa_to_av_delay: number;
        av_to_his_delay: number;
        his_to_purkinje_delay: number;
        cardiac_cycle_ms: number;
        qrs_duration: number;
        qt_interval: number;
    };
    clinical_significance: 'normal' | 'monitor' | 'urgent' | 'critical';
    chamber_coordination: {
        atrial_contraction: boolean;
        ventricular_contraction: boolean;
        av_synchrony: boolean;
        sequential_activation: boolean;
    };
    intervals: {
        pr_interval: number;
        qrs_width: number;
        qt_corrected: number;
        rr_interval: number;
    };
    pathophysiology: string;
    clinical_context: {
        symptoms_likely: string[];
        treatment_considerations: string[];
        monitoring_requirements: string[];
    };
}
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
declare const _default: {
    processEKGFile: typeof processEKGFile;
};
export default _default;
//# sourceMappingURL=index.d.ts.map