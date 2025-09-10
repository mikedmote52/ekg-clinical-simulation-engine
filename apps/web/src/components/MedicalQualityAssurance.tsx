'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Target, 
  TrendingUp,
  Clock,
  Eye,
  Users,
  Award,
  AlertCircle,
  Info,
  Zap
} from 'lucide-react';

import type { MedicalAnalysis } from '@ekg-sim/medical-types';

export interface ValidationResult {
  category: string;
  check: string;
  status: 'pass' | 'warning' | 'fail';
  score: number;
  details: string;
  clinicalRelevance: 'low' | 'medium' | 'high' | 'critical';
  recommendation?: string;
}

export interface QualityMetrics {
  overallAccuracy: number;
  clinicalSafety: number;
  educationalValue: number;
  technicalReliability: number;
  medicalConsistency: number;
  userExperienceScore: number;
}

interface MedicalQualityAssuranceProps {
  medicalAnalysis: MedicalAnalysis;
  userProficiencyLevel: 'beginner' | 'intermediate' | 'advanced';
  onValidationComplete: (results: ValidationResult[], metrics: QualityMetrics) => void;
  enableRealTimeValidation?: boolean;
  showDetailedMetrics?: boolean;
}

export const MedicalQualityAssurance: React.FC<MedicalQualityAssuranceProps> = ({
  medicalAnalysis,
  userProficiencyLevel,
  onValidationComplete,
  enableRealTimeValidation = true,
  showDetailedMetrics = true
}) => {
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics>({
    overallAccuracy: 0,
    clinicalSafety: 0,
    educationalValue: 0,
    technicalReliability: 0,
    medicalConsistency: 0,
    userExperienceScore: 0
  });
  const [isValidating, setIsValidating] = useState(false);
  const [validationHistory, setValidationHistory] = useState<any[]>([]);

  /**
   * Run comprehensive medical validation
   */
  useEffect(() => {
    if (medicalAnalysis && enableRealTimeValidation) {
      runMedicalValidation();
    }
  }, [medicalAnalysis, enableRealTimeValidation]);

  /**
   * Execute comprehensive medical validation suite
   */
  const runMedicalValidation = useCallback(async () => {
    setIsValidating(true);
    
    try {
      const results: ValidationResult[] = [];
      
      // Category 1: Clinical Accuracy Validation
      results.push(...validateClinicalAccuracy(medicalAnalysis));
      
      // Category 2: Rhythm Classification Validation
      results.push(...validateRhythmClassification(medicalAnalysis));
      
      // Category 3: Timing Measurement Validation
      results.push(...validateTimingMeasurements(medicalAnalysis));
      
      // Category 4: Clinical Significance Validation
      results.push(...validateClinicalSignificance(medicalAnalysis));
      
      // Category 5: Educational Content Validation
      results.push(...validateEducationalContent(medicalAnalysis, userProficiencyLevel));
      
      // Category 6: Safety Checks
      results.push(...validateSafetyChecks(medicalAnalysis));
      
      // Calculate quality metrics
      const metrics = calculateQualityMetrics(results, medicalAnalysis);
      
      setValidationResults(results);
      setQualityMetrics(metrics);
      
      // Add to validation history
      setValidationHistory(prev => [...prev, {
        timestamp: Date.now(),
        rhythm: medicalAnalysis.rhythm_classification,
        results: results.length,
        overallScore: metrics.overallAccuracy,
        criticalIssues: results.filter(r => r.clinicalRelevance === 'critical').length
      }]);
      
      onValidationComplete(results, metrics);
      
    } catch (error) {
      console.error('Medical validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  }, [medicalAnalysis, userProficiencyLevel, onValidationComplete]);

  /**
   * Validate clinical accuracy
   */
  const validateClinicalAccuracy = (analysis: MedicalAnalysis): ValidationResult[] => {
    const results: ValidationResult[] = [];
    
    // Heart rate validation
    const heartRateValid = analysis.heart_rate >= 20 && analysis.heart_rate <= 300;
    results.push({
      category: 'Clinical Accuracy',
      check: 'Heart Rate Range',
      status: heartRateValid ? 'pass' : 'fail',
      score: heartRateValid ? 1.0 : 0.0,
      details: `Heart rate: ${analysis.heart_rate} BPM (valid range: 20-300)`,
      clinicalRelevance: heartRateValid ? 'low' : 'critical',
      recommendation: heartRateValid ? undefined : 'Review heart rate calculation algorithm'
    });
    
    // PR interval validation
    const prIntervalValid = analysis.intervals.pr_interval >= 80 && analysis.intervals.pr_interval <= 400;
    results.push({
      category: 'Clinical Accuracy',
      check: 'PR Interval Range',
      status: prIntervalValid ? 'pass' : 'warning',
      score: prIntervalValid ? 1.0 : 0.6,
      details: `PR interval: ${analysis.intervals.pr_interval}ms (typical range: 120-200ms)`,
      clinicalRelevance: prIntervalValid ? 'low' : 'medium',
      recommendation: prIntervalValid ? undefined : 'Consider AV conduction abnormality'
    });
    
    // QRS width validation
    const qrsWidthValid = analysis.intervals.qrs_width >= 40 && analysis.intervals.qrs_width <= 200;
    results.push({
      category: 'Clinical Accuracy',
      check: 'QRS Width Range',
      status: qrsWidthValid ? 'pass' : 'fail',
      score: qrsWidthValid ? 1.0 : 0.0,
      details: `QRS width: ${analysis.intervals.qrs_width}ms (normal: <120ms)`,
      clinicalRelevance: qrsWidthValid ? 'low' : 'high',
      recommendation: qrsWidthValid ? undefined : 'Verify QRS measurement accuracy'
    });
    
    return results;
  };

  /**
   * Validate rhythm classification
   */
  const validateRhythmClassification = (analysis: MedicalAnalysis): ValidationResult[] => {
    const results: ValidationResult[] = [];
    
    // Rhythm-heart rate consistency
    const rhythmConsistency = validateRhythmHeartRateConsistency(analysis);
    results.push({
      category: 'Rhythm Classification',
      check: 'Rhythm-Rate Consistency',
      status: rhythmConsistency.valid ? 'pass' : 'warning',
      score: rhythmConsistency.score,
      details: rhythmConsistency.details,
      clinicalRelevance: rhythmConsistency.valid ? 'low' : 'medium',
      recommendation: rhythmConsistency.valid ? undefined : rhythmConsistency.recommendation
    });
    
    // Clinical significance alignment
    const significanceAlignment = validateClinicalSignificanceAlignment(analysis);
    results.push({
      category: 'Rhythm Classification',
      check: 'Clinical Significance Alignment',
      status: significanceAlignment.valid ? 'pass' : 'fail',
      score: significanceAlignment.score,
      details: significanceAlignment.details,
      clinicalRelevance: 'critical',
      recommendation: significanceAlignment.recommendation
    });
    
    return results;
  };

  /**
   * Validate rhythm and heart rate consistency
   */
  const validateRhythmHeartRateConsistency = (analysis: MedicalAnalysis) => {
    const { rhythm_classification, heart_rate } = analysis;
    
    switch (rhythm_classification) {
      case 'sinus_bradycardia':
        const bradyValid = heart_rate < 60;
        return {
          valid: bradyValid,
          score: bradyValid ? 1.0 : 0.3,
          details: `Sinus bradycardia with HR ${heart_rate} BPM (expected: <60)`,
          recommendation: bradyValid ? undefined : 'Heart rate inconsistent with bradycardia classification'
        };
        
      case 'sinus_tachycardia':
        const tachyValid = heart_rate > 100;
        return {
          valid: tachyValid,
          score: tachyValid ? 1.0 : 0.3,
          details: `Sinus tachycardia with HR ${heart_rate} BPM (expected: >100)`,
          recommendation: tachyValid ? undefined : 'Heart rate inconsistent with tachycardia classification'
        };
        
      case 'normal_sinus':
        const normalValid = heart_rate >= 60 && heart_rate <= 100;
        return {
          valid: normalValid,
          score: normalValid ? 1.0 : 0.5,
          details: `Normal sinus rhythm with HR ${heart_rate} BPM (expected: 60-100)`,
          recommendation: normalValid ? undefined : 'Heart rate outside normal sinus range'
        };
        
      case 'ventricular_tachycardia':
        const vtachValid = heart_rate > 150;
        return {
          valid: vtachValid,
          score: vtachValid ? 1.0 : 0.2,
          details: `Ventricular tachycardia with HR ${heart_rate} BPM (expected: >150)`,
          recommendation: vtachValid ? undefined : 'Ventricular tachycardia typically has HR >150 BPM'
        };
        
      case 'atrial_fibrillation':
        const afibValid = heart_rate >= 90 && heart_rate <= 180; // Typical AFib range
        return {
          valid: afibValid,
          score: afibValid ? 1.0 : 0.7,
          details: `Atrial fibrillation with HR ${heart_rate} BPM (typical: 90-180)`,
          recommendation: afibValid ? undefined : 'Consider rate control status in AFib'
        };
        
      default:
        return {
          valid: true,
          score: 0.8,
          details: `Rhythm ${rhythm_classification} with HR ${heart_rate} BPM`,
          recommendation: undefined
        };
    }
  };

  /**
   * Validate clinical significance alignment
   */
  const validateClinicalSignificanceAlignment = (analysis: MedicalAnalysis) => {
    const { rhythm_classification, clinical_significance } = analysis;
    
    // Critical rhythms should have critical or urgent significance
    const criticalRhythms = ['ventricular_tachycardia', 'ventricular_fibrillation', 'complete_heart_block'];
    if (criticalRhythms.includes(rhythm_classification)) {
      const appropriateSignificance = clinical_significance === 'critical' || clinical_significance === 'urgent';
      return {
        valid: appropriateSignificance,
        score: appropriateSignificance ? 1.0 : 0.0,
        details: `${rhythm_classification} classified as ${clinical_significance}`,
        recommendation: appropriateSignificance ? undefined : 'Life-threatening rhythms require critical or urgent significance'
      };
    }
    
    // Normal rhythms should have normal significance
    if (rhythm_classification === 'normal_sinus') {
      const appropriateSignificance = clinical_significance === 'normal';
      return {
        valid: appropriateSignificance,
        score: appropriateSignificance ? 1.0 : 0.5,
        details: `Normal sinus rhythm classified as ${clinical_significance}`,
        recommendation: appropriateSignificance ? undefined : 'Normal sinus rhythm should have normal significance'
      };
    }
    
    return {
      valid: true,
      score: 0.9,
      details: `${rhythm_classification} with ${clinical_significance} significance appears appropriate`,
      recommendation: undefined
    };
  };

  /**
   * Validate timing measurements
   */
  const validateTimingMeasurements = (analysis: MedicalAnalysis): ValidationResult[] => {
    const results: ValidationResult[] = [];
    
    // PR-QRS relationship
    const prQrsValid = analysis.intervals.pr_interval > analysis.intervals.qrs_width;
    results.push({
      category: 'Timing Measurements',
      check: 'PR-QRS Relationship',
      status: prQrsValid ? 'pass' : 'fail',
      score: prQrsValid ? 1.0 : 0.0,
      details: `PR interval (${analysis.intervals.pr_interval}ms) should be > QRS width (${analysis.intervals.qrs_width}ms)`,
      clinicalRelevance: 'high',
      recommendation: prQrsValid ? undefined : 'Review interval measurement accuracy'
    });
    
    // QTc validation
    const qtcValid = analysis.intervals.qt_corrected >= 300 && analysis.intervals.qt_corrected <= 600;
    results.push({
      category: 'Timing Measurements',
      check: 'QTc Range',
      status: qtcValid ? 'pass' : qtcValid ? 'warning' : 'fail',
      score: qtcValid ? 1.0 : 0.4,
      details: `QTc: ${analysis.intervals.qt_corrected}ms (normal: 350-450ms)`,
      clinicalRelevance: qtcValid ? 'low' : 'high',
      recommendation: qtcValid ? undefined : 'Monitor for QT prolongation or measurement error'
    });
    
    return results;
  };

  /**
   * Validate clinical significance
   */
  const validateClinicalSignificance = (analysis: MedicalAnalysis): ValidationResult[] => {
    const results: ValidationResult[] = [];
    
    // Treatment recommendations consistency
    const treatmentConsistency = validateTreatmentConsistency(analysis);
    results.push({
      category: 'Clinical Significance',
      check: 'Treatment Consistency',
      status: treatmentConsistency.valid ? 'pass' : 'warning',
      score: treatmentConsistency.score,
      details: treatmentConsistency.details,
      clinicalRelevance: 'medium',
      recommendation: treatmentConsistency.recommendation
    });
    
    // Monitoring requirements appropriateness
    const monitoringValid = analysis.clinical_context.monitoring_requirements.length > 0;
    results.push({
      category: 'Clinical Significance',
      check: 'Monitoring Requirements',
      status: monitoringValid ? 'pass' : 'warning',
      score: monitoringValid ? 1.0 : 0.6,
      details: `${analysis.clinical_context.monitoring_requirements.length} monitoring requirements specified`,
      clinicalRelevance: 'medium',
      recommendation: monitoringValid ? undefined : 'All clinical findings should have monitoring guidance'
    });
    
    return results;
  };

  /**
   * Validate treatment consistency
   */
  const validateTreatmentConsistency = (analysis: MedicalAnalysis) => {
    const { clinical_significance, clinical_context } = analysis;
    const treatments = clinical_context.treatment_considerations;
    
    if (clinical_significance === 'critical' || clinical_significance === 'urgent') {
      const hasActiveTherapy = treatments.some(t => 
        t.toLowerCase().includes('immediate') || 
        t.toLowerCase().includes('urgent') || 
        t.toLowerCase().includes('emergent')
      );
      
      return {
        valid: hasActiveTherapy,
        score: hasActiveTherapy ? 1.0 : 0.3,
        details: `${clinical_significance} condition with treatment recommendations: ${treatments.join(', ')}`,
        recommendation: hasActiveTherapy ? undefined : 'Critical/urgent conditions require active treatment recommendations'
      };
    }
    
    if (clinical_significance === 'normal') {
      const hasUnnecessaryTreatment = treatments.some(t => 
        t.toLowerCase().includes('medication') || 
        t.toLowerCase().includes('intervention')
      );
      
      return {
        valid: !hasUnnecessaryTreatment,
        score: hasUnnecessaryTreatment ? 0.7 : 1.0,
        details: `Normal condition with treatments: ${treatments.join(', ')}`,
        recommendation: hasUnnecessaryTreatment ? 'Normal conditions should not require active treatments' : undefined
      };
    }
    
    return {
      valid: true,
      score: 0.9,
      details: 'Treatment recommendations appear appropriate',
      recommendation: undefined
    };
  };

  /**
   * Validate educational content
   */
  const validateEducationalContent = (analysis: MedicalAnalysis, level: 'beginner' | 'intermediate' | 'advanced'): ValidationResult[] => {
    const results: ValidationResult[] = [];
    
    // Pathophysiology completeness
    const pathophysiologyValid = analysis.pathophysiology && analysis.pathophysiology.length > 50;
    results.push({
      category: 'Educational Content',
      check: 'Pathophysiology Detail',
      status: pathophysiologyValid ? 'pass' : 'warning',
      score: pathophysiologyValid ? 1.0 : 0.5,
      details: `Pathophysiology explanation: ${analysis.pathophysiology?.length || 0} characters`,
      clinicalRelevance: 'medium',
      recommendation: pathophysiologyValid ? undefined : 'Enhance pathophysiology explanation for educational value'
    });
    
    // Level-appropriate complexity
    const complexityAppropriate = validateEducationalComplexity(analysis, level);
    results.push({
      category: 'Educational Content',
      check: 'Complexity Level',
      status: complexityAppropriate.valid ? 'pass' : 'warning',
      score: complexityAppropriate.score,
      details: complexityAppropriate.details,
      clinicalRelevance: 'medium',
      recommendation: complexityAppropriate.recommendation
    });
    
    return results;
  };

  /**
   * Validate educational complexity appropriateness
   */
  const validateEducationalComplexity = (analysis: MedicalAnalysis, level: 'beginner' | 'intermediate' | 'advanced') => {
    const pathophysiology = analysis.pathophysiology || '';
    const medicalTerms = (pathophysiology.match(/\b(depolarization|repolarization|conduction|automaticity|reentrant|ischemia)\b/gi) || []).length;
    
    switch (level) {
      case 'beginner':
        const tooComplex = medicalTerms > 3;
        return {
          valid: !tooComplex,
          score: tooComplex ? 0.6 : 1.0,
          details: `${medicalTerms} advanced medical terms for beginner level`,
          recommendation: tooComplex ? 'Simplify terminology for beginner learners' : undefined
        };
        
      case 'advanced':
        const tooSimple = medicalTerms < 2;
        return {
          valid: !tooSimple,
          score: tooSimple ? 0.7 : 1.0,
          details: `${medicalTerms} advanced medical terms for advanced level`,
          recommendation: tooSimple ? 'Include more detailed pathophysiology for advanced learners' : undefined
        };
        
      default: // intermediate
        return {
          valid: true,
          score: 0.9,
          details: `${medicalTerms} medical terms appropriate for intermediate level`,
          recommendation: undefined
        };
    }
  };

  /**
   * Validate safety checks
   */
  const validateSafetyChecks = (analysis: MedicalAnalysis): ValidationResult[] => {
    const results: ValidationResult[] = [];
    
    // Critical value flagging
    const criticalFlags = identifyCriticalValues(analysis);
    results.push({
      category: 'Safety Checks',
      check: 'Critical Value Detection',
      status: criticalFlags.detected ? 'pass' : 'warning',
      score: criticalFlags.score,
      details: criticalFlags.details,
      clinicalRelevance: 'critical',
      recommendation: criticalFlags.recommendation
    });
    
    // Contraindication warnings
    const contraindications = checkContraindications(analysis);
    results.push({
      category: 'Safety Checks',
      check: 'Contraindication Warnings',
      status: contraindications.appropriate ? 'pass' : 'warning',
      score: contraindications.score,
      details: contraindications.details,
      clinicalRelevance: 'high',
      recommendation: contraindications.recommendation
    });
    
    return results;
  };

  /**
   * Identify critical values
   */
  const identifyCriticalValues = (analysis: MedicalAnalysis) => {
    const criticalFindings = [];
    
    // Critical heart rates
    if (analysis.heart_rate < 40 || analysis.heart_rate > 200) {
      criticalFindings.push(`Heart rate: ${analysis.heart_rate} BPM`);
    }
    
    // Critical QTc
    if (analysis.intervals.qt_corrected > 500) {
      criticalFindings.push(`Prolonged QTc: ${analysis.intervals.qt_corrected}ms`);
    }
    
    // Critical rhythms
    const criticalRhythms = ['ventricular_tachycardia', 'ventricular_fibrillation', 'complete_heart_block'];
    if (criticalRhythms.includes(analysis.rhythm_classification)) {
      criticalFindings.push(`Critical rhythm: ${analysis.rhythm_classification}`);
    }
    
    return {
      detected: criticalFindings.length > 0,
      score: criticalFindings.length > 0 ? 1.0 : 0.8,
      details: criticalFindings.length > 0 ? 
        `Critical findings detected: ${criticalFindings.join(', ')}` : 
        'No critical values detected',
      recommendation: criticalFindings.length > 0 ? 
        'Ensure appropriate clinical response to critical findings' : undefined
    };
  };

  /**
   * Check contraindications
   */
  const checkContraindications = (analysis: MedicalAnalysis) => {
    const treatments = analysis.clinical_context.treatment_considerations;
    const hasContraindications = treatments.some(t => 
      t.toLowerCase().includes('contraindicated') || 
      t.toLowerCase().includes('avoid')
    );
    
    return {
      appropriate: true, // Assume appropriate unless specific issues found
      score: 0.9,
      details: hasContraindications ? 
        'Contraindications appropriately noted' : 
        'No specific contraindications noted',
      recommendation: undefined
    };
  };

  /**
   * Calculate overall quality metrics
   */
  const calculateQualityMetrics = (results: ValidationResult[], analysis: MedicalAnalysis): QualityMetrics => {
    const categories = {
      'Clinical Accuracy': results.filter(r => r.category === 'Clinical Accuracy'),
      'Rhythm Classification': results.filter(r => r.category === 'Rhythm Classification'),
      'Timing Measurements': results.filter(r => r.category === 'Timing Measurements'),
      'Clinical Significance': results.filter(r => r.category === 'Clinical Significance'),
      'Educational Content': results.filter(r => r.category === 'Educational Content'),
      'Safety Checks': results.filter(r => r.category === 'Safety Checks')
    };
    
    const averageScore = (categoryResults: ValidationResult[]) => 
      categoryResults.length > 0 ? 
      categoryResults.reduce((sum, r) => sum + r.score, 0) / categoryResults.length : 1.0;
    
    const criticalIssues = results.filter(r => r.clinicalRelevance === 'critical' && r.status === 'fail').length;
    const safetyMultiplier = criticalIssues > 0 ? 0.5 : 1.0; // Heavy penalty for critical safety issues
    
    return {
      overallAccuracy: averageScore(results) * safetyMultiplier,
      clinicalSafety: averageScore(categories['Safety Checks']) * (criticalIssues > 0 ? 0.3 : 1.0),
      educationalValue: averageScore(categories['Educational Content']),
      technicalReliability: (averageScore(categories['Clinical Accuracy']) + averageScore(categories['Timing Measurements'])) / 2,
      medicalConsistency: (averageScore(categories['Rhythm Classification']) + averageScore(categories['Clinical Significance'])) / 2,
      userExperienceScore: 0.85 // Placeholder - would be calculated from user interaction data
    };
  };

  /**
   * Get status color for metric
   */
  const getStatusColor = (score: number) => {
    if (score >= 0.9) return 'text-green-400 bg-green-900/20 border-green-500/30';
    if (score >= 0.7) return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
    if (score >= 0.5) return 'text-orange-400 bg-orange-900/20 border-orange-500/30';
    return 'text-red-400 bg-red-900/20 border-red-500/30';
  };

  /**
   * Get status icon
   */
  const getStatusIcon = (status: ValidationResult['status']) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Quality Overview */}
      <div className="bg-slate-800/30 rounded-lg border border-slate-600/30 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-green-400" />
            <div>
              <h2 className="text-lg font-bold text-green-400">Medical Quality Assurance</h2>
              <p className="text-sm text-green-300">Comprehensive validation and safety checks</p>
            </div>
          </div>
          
          {isValidating && (
            <div className="flex items-center space-x-2 text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
              <span className="text-sm">Validating...</span>
            </div>
          )}
        </div>
        
        {/* Quality Metrics Grid */}
        {showDetailedMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            {Object.entries(qualityMetrics).map(([key, value]) => (
              <div
                key={key}
                className={`p-3 rounded-lg border transition-all ${getStatusColor(value)}`}
              >
                <div className="text-xs font-medium opacity-80 mb-1">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-xl font-bold">
                  {Math.round(value * 100)}%
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1 mt-2">
                  <div 
                    className={`h-1 rounded-full transition-all ${
                      value >= 0.9 ? 'bg-green-400' :
                      value >= 0.7 ? 'bg-yellow-400' :
                      value >= 0.5 ? 'bg-orange-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${value * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Validation Results by Category */}
      <div className="space-y-4">
        {['Clinical Accuracy', 'Rhythm Classification', 'Timing Measurements', 'Clinical Significance', 'Educational Content', 'Safety Checks'].map(category => {
          const categoryResults = validationResults.filter(r => r.category === category);
          if (categoryResults.length === 0) return null;
          
          const categoryScore = categoryResults.reduce((sum, r) => sum + r.score, 0) / categoryResults.length;
          const criticalIssues = categoryResults.filter(r => r.clinicalRelevance === 'critical' && r.status === 'fail').length;
          
          return (
            <div key={category} className="bg-slate-800/30 rounded-lg border border-slate-600/30 p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getStatusColor(categoryScore)}`}>
                    {category === 'Safety Checks' && <Shield className="w-4 h-4" />}
                    {category === 'Clinical Accuracy' && <Target className="w-4 h-4" />}
                    {category === 'Rhythm Classification' && <Activity className="w-4 h-4" />}
                    {category === 'Timing Measurements' && <Clock className="w-4 h-4" />}
                    {category === 'Clinical Significance' && <AlertCircle className="w-4 h-4" />}
                    {category === 'Educational Content' && <Eye className="w-4 h-4" />}
                  </div>
                  
                  <div>
                    <h3 className="font-semibold text-slate-200">{category}</h3>
                    <div className="flex items-center space-x-2 text-sm text-slate-400">
                      <span>{categoryResults.length} checks</span>
                      <span>•</span>
                      <span>{Math.round(categoryScore * 100)}% score</span>
                      {criticalIssues > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-red-400">{criticalIssues} critical issues</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                {categoryResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border transition-all ${
                      result.clinicalRelevance === 'critical' ? 
                        'border-red-500/50 bg-red-900/10' :
                      result.status === 'fail' ? 
                        'border-red-500/30 bg-red-900/5' :
                      result.status === 'warning' ?
                        'border-yellow-500/30 bg-yellow-900/5' :
                        'border-green-500/30 bg-green-900/5'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getStatusIcon(result.status)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium text-slate-200">{result.check}</div>
                            <div className="text-sm text-slate-300 mt-1">{result.details}</div>
                            {result.recommendation && (
                              <div className="text-sm text-blue-400 mt-2">
                                <strong>Recommendation:</strong> {result.recommendation}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end space-y-1">
                            <div className={`px-2 py-1 rounded text-xs font-medium ${
                              result.clinicalRelevance === 'critical' ? 'bg-red-600 text-white' :
                              result.clinicalRelevance === 'high' ? 'bg-orange-600 text-white' :
                              result.clinicalRelevance === 'medium' ? 'bg-yellow-600 text-black' :
                              'bg-green-600 text-white'
                            }`}>
                              {result.clinicalRelevance}
                            </div>
                            <div className="text-sm text-slate-400">
                              {Math.round(result.score * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Validation Summary */}
      <div className="bg-slate-800/30 rounded-lg border border-slate-600/30 p-4">
        <h3 className="font-semibold text-slate-200 mb-3 flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <span>Validation Summary</span>
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <div className="text-lg font-bold text-green-400">
              {validationResults.filter(r => r.status === 'pass').length}
            </div>
            <div className="text-slate-400">Passed</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-400">
              {validationResults.filter(r => r.status === 'warning').length}
            </div>
            <div className="text-slate-400">Warnings</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-red-400">
              {validationResults.filter(r => r.status === 'fail').length}
            </div>
            <div className="text-slate-400">Failed</div>
          </div>
          
          <div className="text-center">
            <div className="text-lg font-bold text-purple-400">
              {validationResults.filter(r => r.clinicalRelevance === 'critical').length}
            </div>
            <div className="text-slate-400">Critical</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicalQualityAssurance;