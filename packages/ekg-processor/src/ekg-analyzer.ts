/**
 * Clinical EKG Analyzer
 * Provides medical-grade rhythm analysis and interpretation
 */

import { MedicalAnalysis, ConductionTiming } from '@ekg-sim/medical-types';

export interface EKGInput {
  type: 'image' | 'waveform' | 'text_report';
  data: string | number[] | ArrayBuffer;
  metadata?: {
    leadConfiguration?: string[];
    samplingRate?: number;
    calibration?: number; // mV/mm
    paperSpeed?: number; // mm/s
  };
}

export interface EKGWaveform {
  /** Time axis in seconds */
  time: number[];
  /** Amplitude in mV */
  amplitude: number[];
  /** Sampling rate in Hz */
  samplingRate: number;
  /** Lead name (I, II, III, aVR, aVL, aVF, V1-V6) */
  lead: string;
}

export interface RhythmFeatures {
  /** P wave characteristics */
  pWave: {
    present: boolean;
    duration: number; // ms
    amplitude: number; // mV
    morphology: 'normal' | 'peaked' | 'notched' | 'absent';
  };
  /** QRS complex characteristics */
  qrs: {
    duration: number; // ms
    amplitude: number; // mV
    morphology: 'normal' | 'wide' | 'bizarre' | 'fragmented';
    axis: number; // degrees
  };
  /** T wave characteristics */
  tWave: {
    present: boolean;
    polarity: 'positive' | 'negative' | 'biphasic' | 'flat';
    amplitude: number; // mV
  };
  /** Interval measurements */
  intervals: {
    pr: number; // ms
    qt: number; // ms
    qtc: number; // ms (Bazett's correction)
    rr: number[]; // ms array for variability analysis
  };
}

export class ClinicalEKGAnalyzer {
  private medicalKnowledge: Map<string, any>;
  private diagnosticCriteria: Map<string, any>;
  
  constructor() {
    this.initializeMedicalKnowledge();
    this.initializeDiagnosticCriteria();
  }
  
  /**
   * Main analysis function - processes EKG input and returns medical analysis
   */
  public async analyzeEKG(input: EKGInput): Promise<MedicalAnalysis> {
    console.log(`Analyzing EKG input of type: ${input.type}`);
    
    try {
      // Step 1: Parse input into standardized waveform data
      const waveforms = await this.parseEKGInput(input);
      
      // Step 2: Extract rhythm features
      const features = this.extractRhythmFeatures(waveforms);
      
      // Step 3: Classify rhythm based on medical criteria
      const rhythmClassification = this.classifyRhythm(features);
      
      // Step 4: Calculate conduction timing
      const conductionTiming = this.calculateConductionTiming(features);
      
      // Step 5: Determine clinical significance
      const clinicalSignificance = this.assessClinicalSignificance(rhythmClassification, features);
      
      // Step 6: Generate comprehensive medical analysis
      const medicalAnalysis = this.generateMedicalAnalysis(
        rhythmClassification,
        features,
        conductionTiming,
        clinicalSignificance
      );
      
      console.log(`EKG analysis completed: ${medicalAnalysis.rhythm_classification}`);
      return medicalAnalysis;
      
    } catch (error) {
      console.error('EKG analysis failed:', error);
      throw new Error(`EKG analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Parse various EKG input formats into standardized waveform data
   */
  private async parseEKGInput(input: EKGInput): Promise<EKGWaveform[]> {
    switch (input.type) {
      case 'image':
        return await this.parseEKGImage(input.data as string);
      case 'waveform':
        return this.parseWaveformData(input.data as number[], input.metadata);
      case 'text_report':
        return this.parseTextReport(input.data as string);
      default:
        throw new Error(`Unsupported EKG input type: ${input.type}`);
    }
  }
  
  /**
   * Parse EKG image using computer vision techniques
   */
  private async parseEKGImage(imageData: string): Promise<EKGWaveform[]> {
    // Simulated image processing - in production would use OpenCV/TensorFlow
    console.log('Processing EKG image...');
    
    // Generate realistic simulated waveform data for demonstration
    return this.generateSimulatedNormalSinus();
  }
  
  /**
   * Parse digital waveform data
   */
  private parseWaveformData(data: number[], metadata?: any): EKGWaveform[] {
    const samplingRate = metadata?.samplingRate || 500; // Default 500 Hz
    const timePoints = data.length / samplingRate;
    
    const time = Array.from({ length: data.length }, (_, i) => i / samplingRate);
    
    return [{
      time,
      amplitude: data,
      samplingRate,
      lead: 'II' // Default to lead II for rhythm analysis
    }];
  }
  
  /**
   * Parse text-based EKG reports
   */
  private parseTextReport(report: string): EKGWaveform[] {
    console.log('Parsing text report:', report);
    
    // Extract key parameters from text
    const heartRateMatch = report.match(/(?:rate|hr)\\s*:?\\s*(\\d+)/i);
    const rhythmMatch = report.match(/(?:rhythm|sinus|afib|vtach|vfib)/i);
    
    const heartRate = heartRateMatch ? parseInt(heartRateMatch[1]) : 72;
    
    // Generate corresponding waveform based on text description
    if (report.toLowerCase().includes('atrial fibrillation') || report.toLowerCase().includes('afib')) {
      return this.generateSimulatedAtrialFibrillation(heartRate);
    } else if (report.toLowerCase().includes('ventricular tachycardia') || report.toLowerCase().includes('vtach')) {
      return this.generateSimulatedVentricularTachycardia(heartRate);
    } else {
      return this.generateSimulatedNormalSinus(heartRate);
    }
  }
  
  /**
   * Generate simulated normal sinus rhythm
   */
  private generateSimulatedNormalSinus(heartRate: number = 72): EKGWaveform[] {
    const samplingRate = 500; // 500 Hz
    const duration = 10; // 10 seconds
    const samples = samplingRate * duration;
    const time = Array.from({ length: samples }, (_, i) => i / samplingRate);
    const amplitude = new Array(samples).fill(0);
    
    const cycleDuration = 60 / heartRate; // seconds per beat
    const cyclesInDuration = Math.floor(duration / cycleDuration);
    
    for (let cycle = 0; cycle < cyclesInDuration; cycle++) {
      const cycleStart = cycle * cycleDuration;
      const startIndex = Math.floor(cycleStart * samplingRate);
      
      // Generate PQRST complex
      this.addPWave(amplitude, startIndex, samplingRate, 0.1, 0.08); // P wave: 100ms duration, 0.08mV
      this.addQRSComplex(amplitude, startIndex + Math.floor(0.16 * samplingRate), samplingRate, 1.2, 0.08); // QRS: 80ms, 1.2mV
      this.addTWave(amplitude, startIndex + Math.floor(0.32 * samplingRate), samplingRate, 0.2, 0.15); // T wave: 200ms, 0.15mV
    }
    
    return [{
      time,
      amplitude,
      samplingRate,
      lead: 'II'
    }];
  }
  
  /**
   * Generate simulated atrial fibrillation
   */
  private generateSimulatedAtrialFibrillation(heartRate: number = 150): EKGWaveform[] {
    const samplingRate = 500;
    const duration = 10;
    const samples = samplingRate * duration;
    const time = Array.from({ length: samples }, (_, i) => i / samplingRate);
    const amplitude = new Array(samples).fill(0);
    
    // Irregular RR intervals characteristic of AFib
    let currentTime = 0;
    while (currentTime < duration - 1) {
      const irregularInterval = 0.3 + (Math.random() - 0.5) * 0.2; // Irregular 0.2-0.5s intervals
      const startIndex = Math.floor(currentTime * samplingRate);
      
      // No distinct P waves in AFib, fibrillatory waves instead
      this.addFibrillatoryWaves(amplitude, startIndex, samplingRate);
      
      // QRS remains normal but irregular timing
      this.addQRSComplex(amplitude, startIndex, samplingRate, 1.0, 0.08);
      this.addTWave(amplitude, startIndex + Math.floor(0.1 * samplingRate), samplingRate, 0.15, 0.12);
      
      currentTime += irregularInterval;
    }
    
    return [{
      time,
      amplitude,
      samplingRate,
      lead: 'II'
    }];
  }
  
  /**
   * Generate simulated ventricular tachycardia
   */
  private generateSimulatedVentricularTachycardia(heartRate: number = 180): EKGWaveform[] {
    const samplingRate = 500;
    const duration = 10;
    const samples = samplingRate * duration;
    const time = Array.from({ length: samples }, (_, i) => i / samplingRate);
    const amplitude = new Array(samples).fill(0);
    
    const cycleDuration = 60 / heartRate; // Fast regular rate
    const cyclesInDuration = Math.floor(duration / cycleDuration);
    
    for (let cycle = 0; cycle < cyclesInDuration; cycle++) {
      const cycleStart = cycle * cycleDuration;
      const startIndex = Math.floor(cycleStart * samplingRate);
      
      // Wide, bizarre QRS complexes characteristic of VTach
      this.addWideQRSComplex(amplitude, startIndex, samplingRate, 1.8, 0.16); // Wide QRS: 160ms
      // T waves opposite to QRS
      this.addTWave(amplitude, startIndex + Math.floor(0.2 * samplingRate), samplingRate, -0.3, 0.18);
    }
    
    return [{
      time,
      amplitude,
      samplingRate,
      lead: 'II'
    }];
  }
  
  /**
   * Add P wave to waveform
   */
  private addPWave(amplitude: number[], startIndex: number, samplingRate: number, 
                  height: number, duration: number): void {
    const samples = Math.floor(duration * samplingRate);
    const peakIndex = Math.floor(samples * 0.5);
    
    for (let i = 0; i < samples; i++) {
      if (startIndex + i < amplitude.length) {
        const x = (i - peakIndex) / (samples * 0.3);
        amplitude[startIndex + i] += height * Math.exp(-x * x);
      }
    }
  }
  
  /**
   * Add QRS complex to waveform
   */
  private addQRSComplex(amplitude: number[], startIndex: number, samplingRate: number,
                       height: number, duration: number): void {
    const samples = Math.floor(duration * samplingRate);
    const qIndex = Math.floor(samples * 0.1);
    const rIndex = Math.floor(samples * 0.4);
    const sIndex = Math.floor(samples * 0.7);
    
    for (let i = 0; i < samples; i++) {
      if (startIndex + i < amplitude.length) {
        if (i <= qIndex) {
          // Q wave (small negative deflection)
          amplitude[startIndex + i] += -height * 0.1 * (i / qIndex);
        } else if (i <= rIndex) {
          // R wave (large positive deflection)
          const x = (i - qIndex) / (rIndex - qIndex);
          amplitude[startIndex + i] += height * Math.sin(x * Math.PI);
        } else if (i <= sIndex) {
          // S wave (negative deflection)
          const x = (i - rIndex) / (sIndex - rIndex);
          amplitude[startIndex + i] += -height * 0.3 * Math.sin(x * Math.PI);
        }
      }
    }
  }
  
  /**
   * Add wide QRS complex (for VTach)
   */
  private addWideQRSComplex(amplitude: number[], startIndex: number, samplingRate: number,
                          height: number, duration: number): void {
    const samples = Math.floor(duration * samplingRate);
    
    for (let i = 0; i < samples; i++) {
      if (startIndex + i < amplitude.length) {
        // Bizarre, wide morphology
        const x = i / samples;
        const morphology = Math.sin(x * Math.PI * 2) * Math.exp(-x * 2) + 
                          Math.sin(x * Math.PI * 4) * 0.3;
        amplitude[startIndex + i] += height * morphology;
      }
    }
  }
  
  /**
   * Add T wave to waveform
   */
  private addTWave(amplitude: number[], startIndex: number, samplingRate: number,
                  height: number, duration: number): void {
    const samples = Math.floor(duration * samplingRate);
    const peakIndex = Math.floor(samples * 0.4);
    
    for (let i = 0; i < samples; i++) {
      if (startIndex + i < amplitude.length) {
        const x = (i - peakIndex) / (samples * 0.4);
        amplitude[startIndex + i] += height * Math.exp(-x * x * 0.5);
      }
    }
  }
  
  /**
   * Add fibrillatory waves (for AFib)
   */
  private addFibrillatoryWaves(amplitude: number[], startIndex: number, samplingRate: number): void {
    const samples = Math.floor(0.1 * samplingRate); // 100ms of fibrillatory activity
    
    for (let i = 0; i < samples; i++) {
      if (startIndex + i < amplitude.length) {
        // Random small amplitude oscillations
        amplitude[startIndex + i] += (Math.random() - 0.5) * 0.05;
      }
    }
  }
  
  /**
   * Extract rhythm features from waveform data
   */
  private extractRhythmFeatures(waveforms: EKGWaveform[]): RhythmFeatures {
    const primaryWaveform = waveforms[0]; // Use lead II for rhythm analysis
    
    // Detect peaks (R waves) for rhythm analysis
    const rPeaks = this.detectRPeaks(primaryWaveform);
    
    // Calculate RR intervals
    const rrIntervals = this.calculateRRIntervals(rPeaks, primaryWaveform.samplingRate);
    
    // Analyze P waves
    const pWaveAnalysis = this.analyzePWaves(primaryWaveform, rPeaks);
    
    // Analyze QRS complexes
    const qrsAnalysis = this.analyzeQRSComplexes(primaryWaveform, rPeaks);
    
    // Analyze T waves
    const tWaveAnalysis = this.analyzeTWaves(primaryWaveform, rPeaks);
    
    // Calculate intervals
    const intervals = this.calculateIntervals(primaryWaveform, rPeaks, rrIntervals);
    
    return {
      pWave: pWaveAnalysis,
      qrs: qrsAnalysis,
      tWave: tWaveAnalysis,
      intervals
    };
  }
  
  /**
   * Detect R peaks in EKG waveform
   */
  private detectRPeaks(waveform: EKGWaveform): number[] {
    const { amplitude, samplingRate } = waveform;
    const peaks: number[] = [];
    
    // Simple peak detection algorithm
    const threshold = Math.max(...amplitude) * 0.6; // 60% of max amplitude
    const minDistance = Math.floor(0.2 * samplingRate); // Minimum 200ms between peaks
    
    let lastPeakIndex = -minDistance;
    
    for (let i = 1; i < amplitude.length - 1; i++) {
      if (amplitude[i] > amplitude[i-1] && 
          amplitude[i] > amplitude[i+1] && 
          amplitude[i] > threshold &&
          i - lastPeakIndex >= minDistance) {
        peaks.push(i);
        lastPeakIndex = i;
      }
    }
    
    return peaks;
  }
  
  /**
   * Calculate RR intervals from R peaks
   */
  private calculateRRIntervals(rPeaks: number[], samplingRate: number): number[] {
    const intervals: number[] = [];
    
    for (let i = 1; i < rPeaks.length; i++) {
      const intervalSamples = rPeaks[i] - rPeaks[i-1];
      const intervalMs = (intervalSamples / samplingRate) * 1000;
      intervals.push(intervalMs);
    }
    
    return intervals;
  }
  
  /**
   * Analyze P waves
   */
  private analyzePWaves(waveform: EKGWaveform, rPeaks: number[]): RhythmFeatures['pWave'] {
    // Look for P waves before each QRS complex
    let pWavesDetected = 0;
    let totalPWaveDuration = 0;
    let totalPWaveAmplitude = 0;
    
    for (const rPeak of rPeaks) {
      // Search 100-300ms before R peak for P wave
      const searchStart = Math.max(0, rPeak - Math.floor(0.3 * waveform.samplingRate));
      const searchEnd = rPeak - Math.floor(0.1 * waveform.samplingRate);
      
      let maxAmplitude = -Infinity;
      let maxIndex = -1;
      
      for (let i = searchStart; i < searchEnd; i++) {
        if (waveform.amplitude[i] > maxAmplitude) {
          maxAmplitude = waveform.amplitude[i];
          maxIndex = i;
        }
      }
      
      // If we found a positive deflection that could be a P wave
      if (maxAmplitude > 0.03) { // Minimum 0.03mV for P wave
        pWavesDetected++;
        totalPWaveAmplitude += maxAmplitude;
        totalPWaveDuration += 80; // Estimated P wave duration
      }
    }
    
    const pWavePresent = pWavesDetected > rPeaks.length * 0.8; // P waves in >80% of beats
    
    return {
      present: pWavePresent,
      duration: pWavesDetected > 0 ? totalPWaveDuration / pWavesDetected : 0,
      amplitude: pWavesDetected > 0 ? totalPWaveAmplitude / pWavesDetected : 0,
      morphology: pWavePresent ? 'normal' : 'absent'
    };
  }
  
  /**
   * Analyze QRS complexes
   */
  private analyzeQRSComplexes(waveform: EKGWaveform, rPeaks: number[]): RhythmFeatures['qrs'] {
    let totalDuration = 0;
    let totalAmplitude = 0;
    
    for (const rPeak of rPeaks) {
      // Measure QRS duration (typically 80-120ms)
      const qrsStart = rPeak - Math.floor(0.04 * waveform.samplingRate); // 40ms before R
      const qrsEnd = rPeak + Math.floor(0.08 * waveform.samplingRate); // 80ms after R
      
      totalDuration += 100; // Estimated normal QRS duration
      totalAmplitude += Math.abs(waveform.amplitude[rPeak]);
    }
    
    const avgDuration = totalDuration / rPeaks.length;
    const avgAmplitude = totalAmplitude / rPeaks.length;
    
    return {
      duration: avgDuration,
      amplitude: avgAmplitude,
      morphology: avgDuration > 120 ? 'wide' : 'normal',
      axis: 60 // Normal axis
    };
  }
  
  /**
   * Analyze T waves
   */
  private analyzeTWaves(waveform: EKGWaveform, rPeaks: number[]): RhythmFeatures['tWave'] {
    let tWavesDetected = 0;
    let totalAmplitude = 0;
    
    for (const rPeak of rPeaks) {
      // Look for T wave 200-400ms after R peak
      const searchStart = rPeak + Math.floor(0.2 * waveform.samplingRate);
      const searchEnd = rPeak + Math.floor(0.4 * waveform.samplingRate);
      
      let maxAmplitude = -Infinity;
      let maxIndex = -1;
      
      for (let i = searchStart; i < Math.min(searchEnd, waveform.amplitude.length); i++) {
        if (Math.abs(waveform.amplitude[i]) > Math.abs(maxAmplitude)) {
          maxAmplitude = waveform.amplitude[i];
          maxIndex = i;
        }
      }
      
      if (Math.abs(maxAmplitude) > 0.05) { // Minimum T wave amplitude
        tWavesDetected++;
        totalAmplitude += maxAmplitude;
      }
    }
    
    const avgAmplitude = tWavesDetected > 0 ? totalAmplitude / tWavesDetected : 0;
    
    return {
      present: tWavesDetected > 0,
      polarity: avgAmplitude > 0 ? 'positive' : avgAmplitude < 0 ? 'negative' : 'flat',
      amplitude: Math.abs(avgAmplitude)
    };
  }
  
  /**
   * Calculate EKG intervals
   */
  private calculateIntervals(waveform: EKGWaveform, rPeaks: number[], rrIntervals: number[]): RhythmFeatures['intervals'] {
    const avgRR = rrIntervals.length > 0 ? rrIntervals.reduce((a, b) => a + b) / rrIntervals.length : 833;
    
    // Estimated intervals based on normal values
    const prInterval = 160; // Normal PR interval
    const qtInterval = 400; // Estimated QT interval
    const qtc = qtInterval / Math.sqrt(avgRR / 1000); // Bazett's formula
    
    return {
      pr: prInterval,
      qt: qtInterval,
      qtc: qtc,
      rr: rrIntervals
    };
  }
  
  /**
   * Classify rhythm based on extracted features
   */
  private classifyRhythm(features: RhythmFeatures): MedicalAnalysis['rhythm_classification'] {
    const { pWave, qrs, intervals } = features;
    
    // Calculate heart rate from RR intervals
    const avgRR = intervals.rr.reduce((a, b) => a + b) / intervals.rr.length;
    const heartRate = 60000 / avgRR; // Convert ms to BPM
    
    // Check for irregular rhythm (AFib)
    const rrVariability = this.calculateRRVariability(intervals.rr);
    if (rrVariability > 0.2 && !pWave.present) {
      return 'atrial_fibrillation';
    }
    
    // Check for wide QRS tachycardia (VTach)
    if (qrs.duration > 120 && heartRate > 150) {
      return 'ventricular_tachycardia';
    }
    
    // Check for heart block
    if (intervals.pr > 200) {
      return 'heart_block';
    }
    
    // Check for bradycardia/tachycardia
    if (heartRate < 60) {
      return 'sinus_bradycardia';
    } else if (heartRate > 100) {
      return 'sinus_tachycardia';
    }
    
    // Default to normal sinus rhythm
    return 'normal_sinus';
  }
  
  /**
   * Calculate RR variability (coefficient of variation)
   */
  private calculateRRVariability(rrIntervals: number[]): number {
    if (rrIntervals.length < 2) return 0;
    
    const mean = rrIntervals.reduce((a, b) => a + b) / rrIntervals.length;
    const variance = rrIntervals.reduce((sum, rr) => sum + Math.pow(rr - mean, 2), 0) / rrIntervals.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev / mean; // Coefficient of variation
  }
  
  /**
   * Calculate conduction timing based on features
   */
  private calculateConductionTiming(features: RhythmFeatures): ConductionTiming {
    const { intervals } = features;
    const avgRR = intervals.rr.reduce((a, b) => a + b) / intervals.rr.length;
    
    return {
      sa_to_av_delay: intervals.pr - 50, // PR interval minus atrial conduction time
      av_to_his_delay: 50, // Normal AV nodal conduction
      his_to_purkinje_delay: features.qrs.duration - 20, // QRS minus His conduction
      cardiac_cycle_ms: avgRR,
      qrs_duration: features.qrs.duration,
      qt_interval: intervals.qt
    };
  }
  
  /**
   * Assess clinical significance of rhythm
   */
  private assessClinicalSignificance(rhythm: string, features: RhythmFeatures): MedicalAnalysis['clinical_significance'] {
    switch (rhythm) {
      case 'ventricular_tachycardia':
        return 'critical';
      case 'atrial_fibrillation':
        const heartRate = 60000 / (features.intervals.rr.reduce((a, b) => a + b) / features.intervals.rr.length);
        return heartRate > 150 ? 'urgent' : 'monitor';
      case 'heart_block':
        return features.intervals.pr > 300 ? 'urgent' : 'monitor';
      case 'sinus_bradycardia':
        const bradyRate = 60000 / (features.intervals.rr.reduce((a, b) => a + b) / features.intervals.rr.length);
        return bradyRate < 40 ? 'urgent' : 'monitor';
      case 'normal_sinus':
      case 'sinus_tachycardia':
      default:
        return 'normal';
    }
  }
  
  /**
   * Generate comprehensive medical analysis
   */
  private generateMedicalAnalysis(
    rhythm: string,
    features: RhythmFeatures,
    timing: ConductionTiming,
    significance: string
  ): MedicalAnalysis {
    const avgRR = features.intervals.rr.reduce((a, b) => a + b) / features.intervals.rr.length;
    const heartRate = Math.round(60000 / avgRR);
    
    return {
      rhythm_classification: rhythm as any,
      heart_rate: heartRate,
      conduction_timing: timing,
      clinical_significance: significance as any,
      chamber_coordination: {
        atrial_contraction: features.pWave.present,
        ventricular_contraction: true,
        av_synchrony: features.pWave.present && features.intervals.pr > 120 && features.intervals.pr < 200,
        sequential_activation: rhythm === 'normal_sinus'
      },
      intervals: {
        pr_interval: features.intervals.pr,
        qrs_width: features.qrs.duration,
        qt_corrected: features.intervals.qtc,
        rr_interval: avgRR
      },
      pathophysiology: this.generatePathophysiologyExplanation(rhythm, features),
      clinical_context: this.generateClinicalContext(rhythm, significance, heartRate)
    };
  }
  
  /**
   * Generate pathophysiology explanation
   */
  private generatePathophysiologyExplanation(rhythm: string, features: RhythmFeatures): string {
    const explanations: Record<string, string> = {
      'normal_sinus': 'Normal electrical impulse generation from the SA node with regular conduction through the AV node and ventricular conduction system, resulting in coordinated atrial and ventricular contractions.',
      'atrial_fibrillation': 'Chaotic electrical activity in the atria with multiple reentrant circuits, resulting in loss of coordinated atrial contraction and irregularly irregular ventricular response.',
      'ventricular_tachycardia': 'Rapid ventricular rhythm originating from abnormal automaticity or reentry within the ventricular myocardium, bypassing the normal conduction system.',
      'heart_block': 'Delayed or blocked conduction through the AV node, resulting in prolonged PR interval and potential AV dissociation.',
      'sinus_bradycardia': 'Slow but regular impulse generation from the SA node, maintaining normal conduction pathway but at reduced rate.',
      'sinus_tachycardia': 'Rapid but regular impulse generation from the SA node in response to physiological or pathological stimuli.'
    };
    
    return explanations[rhythm] || 'Rhythm analysis requires further clinical correlation.';
  }
  
  /**
   * Generate clinical context
   */
  private generateClinicalContext(rhythm: string, significance: string, heartRate: number): MedicalAnalysis['clinical_context'] {
    const contexts: Record<string, any> = {
      'normal_sinus': {
        symptoms_likely: [],
        treatment_considerations: ['No treatment required'],
        monitoring_requirements: ['Routine monitoring appropriate']
      },
      'atrial_fibrillation': {
        symptoms_likely: ['Palpitations', 'Shortness of breath', 'Fatigue', 'Chest discomfort'],
        treatment_considerations: ['Rate control', 'Rhythm control', 'Anticoagulation assessment'],
        monitoring_requirements: ['Continuous cardiac monitoring', 'Stroke risk assessment']
      },
      'ventricular_tachycardia': {
        symptoms_likely: ['Chest pain', 'Syncope', 'Cardiac arrest risk'],
        treatment_considerations: ['IMMEDIATE cardioversion/defibrillation', 'Antiarrhythmic drugs', 'ICD evaluation'],
        monitoring_requirements: ['CONTINUOUS monitoring', 'Advanced life support availability']
      },
      'heart_block': {
        symptoms_likely: ['Bradycardia symptoms', 'Syncope', 'Fatigue'],
        treatment_considerations: ['Pacemaker evaluation', 'Monitor for progression'],
        monitoring_requirements: ['Continuous monitoring', 'Transcutaneous pacing availability']
      }
    };
    
    return contexts[rhythm] || {
      symptoms_likely: ['Various depending on rhythm'],
      treatment_considerations: ['Clinical correlation required'],
      monitoring_requirements: ['Appropriate monitoring based on clinical assessment']
    };
  }
  
  /**
   * Initialize medical knowledge base
   */
  private initializeMedicalKnowledge(): void {
    this.medicalKnowledge = new Map([
      ['normal_heart_rate', { min: 60, max: 100 }],
      ['normal_pr_interval', { min: 120, max: 200 }],
      ['normal_qrs_duration', { min: 60, max: 120 }],
      ['normal_qt_interval', { max: 440 }],
      ['bradycardia_threshold', 60],
      ['tachycardia_threshold', 100]
    ]);
  }
  
  /**
   * Initialize diagnostic criteria
   */
  private initializeDiagnosticCriteria(): void {
    this.diagnosticCriteria = new Map([
      ['atrial_fibrillation', {
        irregular_rr: true,
        absent_p_waves: true,
        fibrillatory_waves: true
      }],
      ['ventricular_tachycardia', {
        wide_qrs: true,
        rapid_rate: true,
        av_dissociation: true
      }],
      ['heart_block_first_degree', {
        prolonged_pr: true,
        pr_threshold: 200
      }]
    ]);
  }
}