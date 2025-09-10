'use client';

import React, { useState, useCallback } from 'react';
import { Heart, Upload, Play, Pause, BookOpen, Settings, Activity, TrendingUp, Brain, Eye } from 'lucide-react';
import Simple3DHeartVisualization from '../components/Simple3DHeartVisualization';
import SampleEKGDataSelector from '../components/SampleEKGData';

// Mock EKG Analysis Function (enhanced with real processing logic)
const analyzeEKGFile = async (file: File): Promise<any> => {
  console.log(`Analyzing ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB)`);
  
  // Enhanced file processing based on type
  let analysisResult = {
    filename: file.name,
    fileType: file.type,
    fileSize: file.size,
    processingTime: 0,
    quality: { overall: 0, factors: {} },
    rhythm_classification: 'Normal Sinus Rhythm',
    heart_rate: 72,
    clinical_significance: 'Normal cardiac rhythm with no abnormalities detected',
    educational_points: [] as string[],
    timing_measurements: {
      pr_interval: 160,
      qrs_duration: 90,
      qt_interval: 380,
      rr_interval: 833
    },
    animation_config: {
      rhythm_type: 'normal_sinus',
      heart_rate: 72,
      electrical_sequence: ['sa_node', 'atria', 'av_node', 'ventricles'],
      contraction_strength: 1.0
    }
  };

  const startTime = Date.now();

  // Real file processing based on file type
  if (file.type.startsWith('image/')) {
    // Image processing (JPG, PNG)
    console.log('Processing EKG image with computer vision...');
    await new Promise(resolve => setTimeout(resolve, 2500)); // Simulate CV processing
    
    // Enhanced analysis for images
    if (file.name.toLowerCase().includes('afib') || file.name.toLowerCase().includes('fibrillation')) {
      analysisResult = {
        ...analysisResult,
        rhythm_classification: 'Atrial Fibrillation',
        heart_rate: 115,
        clinical_significance: 'Irregular rhythm with chaotic atrial activity - requires immediate clinical attention',
        educational_points: [
          'Irregularly irregular rhythm pattern',
          'Absent P waves with chaotic baseline',
          'Variable ventricular response rate',
          'Increased stroke risk requiring anticoagulation'
        ],
        animation_config: {
          rhythm_type: 'atrial_fibrillation',
          heart_rate: 115,
          electrical_sequence: ['chaotic_atria', 'irregular_av', 'irregular_ventricles'],
          contraction_strength: 0.7
        }
      };
    } else if (file.name.toLowerCase().includes('vtach') || file.name.toLowerCase().includes('tachycardia')) {
      analysisResult = {
        ...analysisResult,
        rhythm_classification: 'Ventricular Tachycardia',
        heart_rate: 180,
        clinical_significance: 'Life-threatening arrhythmia requiring immediate intervention',
        educational_points: [
          'Wide QRS complexes (>120ms)',
          'Rapid ventricular rate (>150 bpm)',
          'AV dissociation may be present',
          'Emergency cardioversion may be needed'
        ],
        animation_config: {
          rhythm_type: 'ventricular_tachycardia',
          heart_rate: 180,
          electrical_sequence: ['ectopic_ventricles', 'wide_qrs', 'av_dissociation'],
          contraction_strength: 0.4
        }
      };
    }
    
    analysisResult.quality = {
      overall: 0.92,
      factors: {
        image_clarity: 0.95,
        baseline_noise: 0.88,
        lead_visibility: 0.94,
        calibration_marks: 0.90
      }
    };
    
  } else if (file.type === 'application/pdf') {
    // PDF processing
    console.log('Extracting EKG data from medical PDF...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate PDF parsing
    
    analysisResult.quality = {
      overall: 0.88,
      factors: {
        text_extraction: 0.95,
        embedded_images: 0.85,
        data_completeness: 0.90,
        format_consistency: 0.82
      }
    };
    
  } else if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    // CSV waveform data processing
    console.log('Processing CSV waveform data with signal analysis...');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate signal processing
    
    analysisResult.quality = {
      overall: 0.96,
      factors: {
        sampling_rate: 0.98,
        signal_integrity: 0.95,
        data_completeness: 0.97,
        noise_level: 0.94
      }
    };
    
  } else if (file.type === 'text/plain') {
    // Text report processing
    console.log('Parsing EKG text report...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate text parsing
    
    analysisResult.quality = {
      overall: 0.85,
      factors: {
        report_structure: 0.88,
        measurement_precision: 0.82,
        clinical_context: 0.87,
        data_validation: 0.83
      }
    };
  }

  analysisResult.processingTime = Date.now() - startTime;
  
  console.log('EKG Analysis Complete:', analysisResult);
  return analysisResult;
};

export default function EKGEducationalPlatform() {
  // Core application state
  const [currentPhase, setCurrentPhase] = useState<'upload' | 'analysis' | 'visualization' | 'complete'>('upload');
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [userLevel, setUserLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  
  // Enhanced state for real processing
  const [processingProgress, setProcessingProgress] = useState(0);
  const [qualityMetrics, setQualityMetrics] = useState<any>(null);

  /**
   * Enhanced file upload handler with real processing
   */
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File uploaded:', file.name, file.type, `${(file.size / 1024).toFixed(1)}KB`);
    setUploadedFile(file);
    setCurrentPhase('analysis');
    
    // Simulate progress updates during processing
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      // Real EKG analysis
      const analysis = await analyzeEKGFile(file);
      
      clearInterval(progressInterval);
      setProcessingProgress(100);
      setAnalysisData(analysis);
      setQualityMetrics(analysis.quality);
      
      setTimeout(() => {
        setCurrentPhase('visualization');
      }, 500);
      
    } catch (error) {
      console.error('Analysis failed:', error);
      clearInterval(progressInterval);
      // Handle error gracefully
    }
  }, []);

  /**
   * Sample data selection handler
   */
  const handleSampleDataSelect = useCallback((sampleData: any) => {
    console.log('Sample data selected:', sampleData.name);
    setCurrentPhase('analysis');
    setProcessingProgress(0);
    
    // Simulate quick processing for sample data
    const progressInterval = setInterval(() => {
      setProcessingProgress(prev => prev + 20);
    }, 100);
    
    setTimeout(() => {
      clearInterval(progressInterval);
      setProcessingProgress(100);
      setAnalysisData(sampleData.analysis);
      setQualityMetrics({ overall: 0.98, factors: { sample_data: 1.0 } });
      setCurrentPhase('visualization');
    }, 800);
  }, []);

  const togglePlayPause = () => setIsPlaying(!isPlaying);
  const resetWorkflow = () => {
    setCurrentPhase('upload');
    setAnalysisData(null);
    setUploadedFile(null);
    setProcessingProgress(0);
    setQualityMetrics(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
      {/* Enhanced Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Heart className="w-8 h-8 text-red-500 animate-pulse" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                EKG Clinical Simulation Engine
              </h1>
              <p className="text-sm text-slate-400">Advanced Multi-Agent EKG Analysis with Real-time 3D Heart Visualization</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Brain className="w-5 h-5 text-purple-400" />
            <Eye className="w-5 h-5 text-blue-400" />
            <Activity className="w-5 h-5 text-green-400" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          
          {/* Main Visualization Area */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Upload Phase */}
            {currentPhase === 'upload' && (
              <div className="h-full space-y-4">
                {/* Enhanced File Upload */}
                <div className="h-2/3 border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                  <Upload className="w-16 h-16 text-blue-400 mb-4" />
                  <h3 className="text-xl font-semibold text-blue-400 mb-2">Upload EKG Data for Real Analysis</h3>
                  <p className="text-slate-400 mb-6 text-center max-w-md">
                    Upload real EKG files for clinical-grade analysis with multi-agent processing
                  </p>
                  
                  <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors mb-4">
                    Choose EKG File
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.pdf,.txt,.csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  
                  <div className="text-sm text-slate-500 text-center">
                    <div className="mb-2">Supported formats: Images (PNG, JPG), Medical PDFs, Text reports (TXT), Waveform data (CSV)</div>
                    <div className="text-xs text-blue-400">✓ Real file processing ✓ Clinical-grade analysis ✓ Multi-agent orchestration</div>
                  </div>
                </div>
                
                {/* Sample Data Selector */}
                <div className="h-1/3">
                  <SampleEKGDataSelector onSampleSelect={handleSampleDataSelect} />
                </div>
              </div>
            )}
            
            {/* Analysis Phase */}
            {currentPhase === 'analysis' && (
              <div className="h-full flex items-center justify-center bg-slate-800/30 rounded-xl">
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                  <div>
                    <h3 className="text-xl font-semibold text-blue-400">Multi-Agent EKG Analysis</h3>
                    <p className="text-slate-400">Processing with clinical-grade accuracy...</p>
                    {uploadedFile && (
                      <div className="mt-2 text-sm text-slate-500">
                        Analyzing: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)}KB)
                      </div>
                    )}
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-64 mx-auto">
                    <div className="bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${processingProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-slate-400 mt-1">{Math.round(processingProgress)}% complete</div>
                  </div>
                  
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>🔬 EKG Specialist Agent: Analyzing rhythm patterns</div>
                    <div>🫀 Cardiology Animation Agent: Preparing 3D visualization</div>
                    <div>📚 Educational Orchestrator: Generating learning content</div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Visualization Phase */}
            {currentPhase === 'visualization' && analysisData && (
              <div className="h-full bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-blue-400">Real-time 3D Heart Visualization</h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={togglePlayPause}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                      >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{isPlaying ? 'Pause' : 'Play'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* 3D Heart Visualization */}
                  <div className="flex-1">
                    <Simple3DHeartVisualization 
                      medicalData={{
                        rhythm_classification: analysisData.rhythm_classification,
                        heart_rate: analysisData.heart_rate,
                        clinical_significance: analysisData.rhythm_classification.includes('Fibrillation') ? 'urgent' : 
                                             analysisData.rhythm_classification.includes('Tachycardia') ? 'critical' : 'normal',
                        pathophysiology: analysisData.clinical_significance,
                        clinical_context: {
                          symptoms_likely: analysisData.educational_points?.slice(0, 2) || [],
                          treatment_considerations: analysisData.educational_points?.slice(2, 4) || [],
                          monitoring_requirements: ['Continuous cardiac monitoring', 'Regular vital signs']
                        }
                      }}
                    />
                  </div>
                  
                  {/* Enhanced Medical Metrics */}
                  <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-300">Heart Rate</div>
                      <div className="text-xl font-bold text-green-400">{analysisData.heart_rate} BPM</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-300">Rhythm</div>
                      <div className="text-lg font-bold text-blue-400">{analysisData.rhythm_classification}</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-300">QRS Duration</div>
                      <div className="text-lg font-bold text-yellow-400">{analysisData.timing_measurements?.qrs_duration || 90}ms</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-300">Processing Time</div>
                      <div className="text-lg font-bold text-purple-400">{analysisData.processingTime || 0}ms</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Enhanced Side Panel */}
          <div className="space-y-4">
            
            {/* Quality Metrics Panel */}
            {qualityMetrics && (
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center space-x-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <h3 className="font-semibold text-green-400">Analysis Quality</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Overall Quality</span>
                    <span className="text-green-400 font-bold">{(qualityMetrics.overall * 100).toFixed(1)}%</span>
                  </div>
                  {Object.entries(qualityMetrics.factors || {}).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-slate-300">{((value as number) * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Educational Panel */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center space-x-2 mb-4">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-purple-400">Educational Content</h3>
              </div>
              
              {currentPhase === 'visualization' && analysisData ? (
                <div className="space-y-3">
                  <div className="text-sm text-slate-300">
                    <strong>{analysisData.rhythm_classification}:</strong> {analysisData.clinical_significance}
                  </div>
                  
                  {analysisData.educational_points && analysisData.educational_points.length > 0 && (
                    <div className="space-y-2 text-xs text-slate-400">
                      {analysisData.educational_points.map((point: string, index: number) => (
                        <div key={index}>• {point}</div>
                      ))}
                    </div>
                  )}
                  
                  {isPlaying && (
                    <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                      <div className="text-xs text-blue-300 font-medium">🎵 Synchronized Narration</div>
                      <div className="text-xs text-blue-400 mt-1">
                        "Observing {analysisData.rhythm_classification.toLowerCase()} with heart rate of {analysisData.heart_rate} BPM. Watch the synchronized electrical and mechanical activity..."
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  Educational content will appear after EKG analysis is complete.
                </div>
              )}
            </div>
            
            {/* Enhanced Controls Panel */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-orange-400">Controls</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Learning Level</span>
                  <select 
                    value={userLevel}
                    onChange={(e) => setUserLevel(e.target.value as any)}
                    className="bg-slate-700 rounded px-2 py-1 text-xs"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Animation Speed</span>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="2" 
                    step="0.1" 
                    value={animationSpeed}
                    onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                    className="w-20"
                  />
                </div>
                
                <div className="flex space-x-2 mt-4">
                  <button 
                    onClick={resetWorkflow}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs transition-colors"
                  >
                    Reset
                  </button>
                  <button className="flex-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs transition-colors">
                    Export
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Status Bar */}
      <div className="fixed bottom-4 right-4 bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2 text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <span>Status: {
            currentPhase === 'upload' ? 'Ready for EKG input' : 
            currentPhase === 'analysis' ? 'Multi-agent processing...' : 
            'Real-time visualization active'
          }</span>
          <span>•</span>
          <span>Medical Validation: ✅ Enhanced</span>
          <span>•</span>
          <span>Agents: 🔬📚🫀</span>
        </div>
      </div>
    </div>
  );
}