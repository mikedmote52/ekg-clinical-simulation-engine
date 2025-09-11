/**
 * EKG Analysis Validation Suite
 * Tests the enhanced EKG analysis system for medical accuracy
 */

import { ekgAnalyzer, EKGAnalysisResult } from '../lib/ekgAnalysis';
import { createTestEKGFile } from './createTestEKG';

interface ValidationResult {
  rhythm: 'normal' | 'afib' | 'vtach';
  expected: {
    rhythm_classification: string;
    heart_rate_range: [number, number];
    clinical_significance: 'normal' | 'monitor' | 'urgent' | 'critical';
  };
  actual: EKGAnalysisResult;
  accuracy_score: number;
  detailed_analysis: string[];
}

/**
 * Expected results for each test rhythm
 */
const EXPECTED_RESULTS = {
  normal: {
    rhythm_classification: 'Normal Sinus Rhythm',
    heart_rate_range: [60, 100] as [number, number],
    clinical_significance: 'normal' as const,
    key_features: [
      'Regular R-R intervals',
      'Present P waves',
      'Normal QRS width (<120ms)',
      'Normal PR interval (120-200ms)'
    ]
  },
  afib: {
    rhythm_classification: 'Atrial Fibrillation',
    heart_rate_range: [60, 180] as [number, number],
    clinical_significance: 'urgent' as const,
    key_features: [
      'Irregularly irregular rhythm',
      'Absent P waves',
      'Chaotic atrial activity',
      'Variable R-R intervals'
    ]
  },
  vtach: {
    rhythm_classification: 'Ventricular Tachycardia',
    heart_rate_range: [150, 250] as [number, number],
    clinical_significance: 'critical' as const,
    key_features: [
      'Wide QRS complexes (>120ms)',
      'Fast heart rate',
      'Regular or slightly irregular rhythm',
      'AV dissociation'
    ]
  }
};

/**
 * Run comprehensive validation of EKG analysis accuracy
 */
export async function validateEKGAnalysisAccuracy(): Promise<{
  overall_accuracy: number;
  individual_results: ValidationResult[];
  medical_validation_summary: string;
  recommendations: string[];
}> {
  console.log('🔬 Starting EKG Analysis Accuracy Validation...');
  
  const validationResults: ValidationResult[] = [];
  const rhythms: ('normal' | 'afib' | 'vtach')[] = ['normal', 'afib', 'vtach'];
  
  // Test each rhythm type multiple times for statistical reliability
  const testIterations = 3;
  
  for (const rhythm of rhythms) {
    console.log(`Testing ${rhythm} rhythm (${testIterations} iterations)...`);
    
    for (let iteration = 0; iteration < testIterations; iteration++) {
      try {
        // Generate test EKG image
        const testFile = await createTestEKGFile(rhythm);
        console.log(`  Generated test file: ${testFile.name} (${testFile.size} bytes)`);
        
        // Analyze with enhanced system
        const startTime = Date.now();
        const analysis = await ekgAnalyzer.analyzeEKGFile(testFile);
        const processingTime = Date.now() - startTime;
        
        console.log(`  Analysis completed in ${processingTime}ms`);
        
        // Validate results
        const validation = validateAnalysisResult(rhythm, analysis, iteration + 1);
        validationResults.push(validation);
        
        console.log(`  Accuracy Score: ${(validation.accuracy_score * 100).toFixed(1)}%`);
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Test failed for ${rhythm} (iteration ${iteration + 1}):`, error);
        
        // Create a failure result
        validationResults.push({
          rhythm,
          expected: EXPECTED_RESULTS[rhythm],
          actual: createFailureResult(rhythm, error as Error),
          accuracy_score: 0,
          detailed_analysis: [`Analysis failed: ${error}`]
        });
      }
    }
  }
  
  // Calculate overall accuracy
  const overallAccuracy = validationResults.reduce((sum, result) => sum + result.accuracy_score, 0) / validationResults.length;
  
  // Generate medical validation summary
  const medicalSummary = generateMedicalValidationSummary(validationResults);
  const recommendations = generateRecommendations(validationResults);
  
  console.log(`\n✅ Validation Complete! Overall Accuracy: ${(overallAccuracy * 100).toFixed(1)}%`);
  
  return {
    overall_accuracy: overallAccuracy,
    individual_results: validationResults,
    medical_validation_summary: medicalSummary,
    recommendations
  };
}

/**
 * Validate individual analysis result against expected values
 */
function validateAnalysisResult(
  rhythm: 'normal' | 'afib' | 'vtach',
  actual: EKGAnalysisResult,
  iteration: number
): ValidationResult {
  const expected = EXPECTED_RESULTS[rhythm];
  let accuracyScore = 1.0;
  const detailedAnalysis: string[] = [];
  
  // Test 1: Rhythm Classification
  const detectedRhythm = actual.rhythm_analysis.primary_rhythm.toLowerCase();
  const expectedRhythm = expected.rhythm_classification.toLowerCase();
  
  let rhythmMatch = false;
  if (rhythm === 'normal' && detectedRhythm.includes('sinus')) {
    rhythmMatch = true;
    detailedAnalysis.push('✅ Correctly identified Normal Sinus Rhythm');
  } else if (rhythm === 'afib' && detectedRhythm.includes('fibrillation')) {
    rhythmMatch = true;
    detailedAnalysis.push('✅ Correctly identified Atrial Fibrillation');
  } else if (rhythm === 'vtach' && (detectedRhythm.includes('ventricular') && detectedRhythm.includes('tachycardia'))) {
    rhythmMatch = true;
    detailedAnalysis.push('✅ Correctly identified Ventricular Tachycardia');
  } else {
    accuracyScore *= 0.3; // Major penalty for wrong rhythm
    detailedAnalysis.push(`❌ Rhythm misclassification: expected "${expectedRhythm}", detected "${detectedRhythm}"`);
  }
  
  // Test 2: Heart Rate Range
  const heartRate = actual.rhythm_analysis.heart_rate;
  const [minRate, maxRate] = expected.heart_rate_range;
  
  if (heartRate >= minRate && heartRate <= maxRate) {
    detailedAnalysis.push(`✅ Heart rate within expected range: ${heartRate} BPM`);
  } else if (heartRate >= minRate - 20 && heartRate <= maxRate + 20) {
    accuracyScore *= 0.9; // Minor penalty for slightly off
    detailedAnalysis.push(`⚠️ Heart rate slightly outside expected range: ${heartRate} BPM (expected ${minRate}-${maxRate})`);
  } else {
    accuracyScore *= 0.6; // Major penalty for significantly wrong heart rate
    detailedAnalysis.push(`❌ Heart rate significantly wrong: ${heartRate} BPM (expected ${minRate}-${maxRate})`);
  }
  
  // Test 3: Clinical Significance
  if (actual.rhythm_analysis.clinical_significance === expected.clinical_significance) {
    detailedAnalysis.push('✅ Correct clinical significance assessment');
  } else {
    accuracyScore *= 0.7; // Penalty for wrong clinical significance
    detailedAnalysis.push(`❌ Wrong clinical significance: expected "${expected.clinical_significance}", got "${actual.rhythm_analysis.clinical_significance}"`);
  }
  
  // Test 4: Confidence Score (should be reasonable)
  if (actual.confidence_score > 0.6) {
    detailedAnalysis.push(`✅ Good confidence score: ${(actual.confidence_score * 100).toFixed(1)}%`);
  } else if (actual.confidence_score > 0.3) {
    accuracyScore *= 0.95; // Minor penalty for low confidence
    detailedAnalysis.push(`⚠️ Low confidence score: ${(actual.confidence_score * 100).toFixed(1)}%`);
  } else {
    accuracyScore *= 0.8; // Penalty for very low confidence
    detailedAnalysis.push(`❌ Very low confidence score: ${(actual.confidence_score * 100).toFixed(1)}%`);
  }
  
  // Test 5: Quality Metrics
  if (actual.quality_metrics && actual.quality_metrics.overall > 0.7) {
    detailedAnalysis.push('✅ Good image quality metrics');
  } else {
    accuracyScore *= 0.95;
    detailedAnalysis.push('⚠️ Lower image quality metrics detected');
  }
  
  // Test 6: Timing Measurements (basic reasonableness checks)
  const timing = actual.timing_measurements;
  let timingIssues = 0;
  
  if (timing.pr_interval < 80 || timing.pr_interval > 300) {
    timingIssues++;
    detailedAnalysis.push(`⚠️ PR interval seems unrealistic: ${timing.pr_interval}ms`);
  }
  
  if (timing.qrs_duration < 40 || timing.qrs_duration > 200) {
    timingIssues++;
    detailedAnalysis.push(`⚠️ QRS duration seems unrealistic: ${timing.qrs_duration}ms`);
  }
  
  if (timing.qt_interval < 200 || timing.qt_interval > 600) {
    timingIssues++;
    detailedAnalysis.push(`⚠️ QT interval seems unrealistic: ${timing.qt_interval}ms`);
  }
  
  if (timingIssues === 0) {
    detailedAnalysis.push('✅ All timing measurements within reasonable ranges');
  } else {
    accuracyScore *= Math.max(0.7, 1 - (timingIssues * 0.1));
  }
  
  detailedAnalysis.push(`📊 Final accuracy score: ${(accuracyScore * 100).toFixed(1)}%`);
  
  return {
    rhythm,
    expected,
    actual,
    accuracy_score: Math.max(0, Math.min(1, accuracyScore)),
    detailed_analysis: detailedAnalysis
  };
}

/**
 * Create a failure result for error cases
 */
function createFailureResult(rhythm: 'normal' | 'afib' | 'vtach', error: Error): EKGAnalysisResult {
  return {
    rhythm_analysis: {
      primary_rhythm: 'Analysis Failed',
      heart_rate: 0,
      regularity: 'unknown',
      clinical_significance: 'monitor',
      confidence: 0,
      details: `Analysis failed: ${error.message}`
    },
    timing_measurements: {
      pr_interval: 0,
      qrs_duration: 0,
      qt_interval: 0,
      rr_interval_variability: 0
    },
    conduction_pathway: {
      sa_node: { status: 'abnormal', details: 'Analysis failed' },
      av_node: { status: 'abnormal', delay: 0 },
      his_purkinje: { status: 'abnormal', details: 'Analysis failed' }
    },
    educational_focus: {
      key_teaching_points: ['Analysis system encountered an error'],
      common_misconceptions: ['Technical failures can occur in automated systems'],
      clinical_correlations: ['Always verify automated interpretations clinically']
    },
    animation_requirements: {
      conduction_timing: { sa_to_av_delay: 0, av_to_his_delay: 0, his_to_purkinje_delay: 0 },
      chamber_coordination: { atrial_systole_timing: 0, ventricular_systole_timing: 0, av_synchrony: false },
      abnormality_highlights: ['system_error'],
      educational_emphasis_areas: ['error_handling']
    },
    quality_metrics: {
      overall: 0,
      factors: { system_error: 1.0 }
    },
    confidence_score: 0
  };
}

/**
 * Generate medical validation summary
 */
function generateMedicalValidationSummary(results: ValidationResult[]): string {
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.accuracy_score > 0.5).length;
  const highAccuracyTests = results.filter(r => r.accuracy_score > 0.8).length;
  
  const rhythmAccuracy = {
    normal: results.filter(r => r.rhythm === 'normal').reduce((avg, r, _, arr) => avg + r.accuracy_score / arr.length, 0),
    afib: results.filter(r => r.rhythm === 'afib').reduce((avg, r, _, arr) => avg + r.accuracy_score / arr.length, 0),
    vtach: results.filter(r => r.rhythm === 'vtach').reduce((avg, r, _, arr) => avg + r.accuracy_score / arr.length, 0)
  };
  
  return `
MEDICAL VALIDATION SUMMARY
==========================
Total Tests: ${totalTests}
Successful Analyses: ${successfulTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)
High Accuracy (>80%): ${highAccuracyTests} (${((highAccuracyTests/totalTests)*100).toFixed(1)}%)

Rhythm-Specific Accuracy:
• Normal Sinus Rhythm: ${(rhythmAccuracy.normal * 100).toFixed(1)}%
• Atrial Fibrillation: ${(rhythmAccuracy.afib * 100).toFixed(1)}%
• Ventricular Tachycardia: ${(rhythmAccuracy.vtach * 100).toFixed(1)}%

Clinical Safety Assessment:
${rhythmAccuracy.vtach > 0.7 ? '✅ Critical rhythm detection appears reliable' : '⚠️ Critical rhythm detection needs improvement'}
${rhythmAccuracy.afib > 0.7 ? '✅ Urgent rhythm detection appears reliable' : '⚠️ Urgent rhythm detection needs improvement'}
${rhythmAccuracy.normal > 0.7 ? '✅ Normal rhythm identification appears reliable' : '⚠️ Normal rhythm identification needs improvement'}
`.trim();
}

/**
 * Generate improvement recommendations
 */
function generateRecommendations(results: ValidationResult[]): string[] {
  const recommendations: string[] = [];
  
  // Check common failure patterns
  const rhythmErrors = results.filter(r => r.accuracy_score < 0.5);
  if (rhythmErrors.length > 0) {
    recommendations.push('Improve primary rhythm classification accuracy through enhanced pattern recognition');
  }
  
  const heartRateErrors = results.filter(r => 
    r.actual.rhythm_analysis.heart_rate < r.expected.heart_rate_range[0] - 20 ||
    r.actual.rhythm_analysis.heart_rate > r.expected.heart_rate_range[1] + 20
  );
  if (heartRateErrors.length > 0) {
    recommendations.push('Refine heart rate calculation algorithm for more accurate BPM measurements');
  }
  
  const lowConfidence = results.filter(r => r.actual.confidence_score < 0.5);
  if (lowConfidence.length > 0) {
    recommendations.push('Improve confidence scoring to better reflect analysis reliability');
  }
  
  const poorQuality = results.filter(r => r.actual.quality_metrics && r.actual.quality_metrics.overall < 0.6);
  if (poorQuality.length > 0) {
    recommendations.push('Enhance image quality assessment and preprocessing algorithms');
  }
  
  // Overall system recommendations
  if (results.every(r => r.accuracy_score > 0.8)) {
    recommendations.push('System performance is excellent - consider expanding test cases for edge cases');
  } else if (results.some(r => r.accuracy_score > 0.8)) {
    recommendations.push('System shows good performance on some cases - focus on improving consistency');
  } else {
    recommendations.push('System requires significant improvement before clinical use - review core algorithms');
  }
  
  return recommendations;
}

/**
 * Export for use in components
 */
export default validateEKGAnalysisAccuracy;