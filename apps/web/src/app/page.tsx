'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Play, Pause, RotateCcw, Settings, BookOpen, Heart } from 'lucide-react';

import { EKGUploadZone } from '../components/EKGUploadZone';
import { HeartVisualization3D } from '../components/HeartVisualization3D';
import { EducationalPanel } from '../components/EducationalPanel';
import { ControlPanel } from '../components/ControlPanel';
import { MedicalAnalysisPanel } from '../components/MedicalAnalysisPanel';
import { PerformanceMonitor } from '../components/PerformanceMonitor';

import { MedicalAnalysis, AppContext } from '@ekg-sim/medical-types';
import { ClinicalEKGAnalyzer, EKGInput } from '@ekg-sim/ekg-processor';
import { useVisualizationSync } from '../hooks/useVisualizationSync';
import { useMedicalValidation } from '../hooks/useMedicalValidation';
import { useEducationalMode } from '../hooks/useEducationalMode';

interface SimulationState {
  isLoading: boolean;
  isPlaying: boolean;
  currentPhase: 'upload' | 'analysis' | 'visualization' | 'education';
  medicalAnalysis: MedicalAnalysis | null;
  visualizationConfig: any;
  educationalContent: any;
  error: string | null;
}

export default function EKGSimulationApp() {
  // Core simulation state
  const [simulationState, setSimulationState] = useState<SimulationState>({
    isLoading: false,
    isPlaying: false,
    currentPhase: 'upload',
    medicalAnalysis: null,
    visualizationConfig: null,
    educationalContent: null,
    error: null
  });
  
  // UI state
  const [showEducationalPanel, setShowEducationalPanel] = useState(true);
  const [showMedicalPanel, setShowMedicalPanel] = useState(true);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  
  // Medical analysis
  const ekgAnalyzer = useRef(new ClinicalEKGAnalyzer());
  const { validateMedicalAccuracy } = useMedicalValidation();
  const { syncVisualizationToMedical } = useVisualizationSync();
  const { generateEducationalContent, currentLearningLevel, setLearningLevel } = useEducationalMode();
  
  /**
   * Handle EKG file upload and initiate analysis
   */
  const handleEKGUpload = useCallback(async (file: File) => {
    setSimulationState(prev => ({
      ...prev,
      isLoading: true,
      currentPhase: 'analysis',
      error: null
    }));
    
    try {
      console.log('Processing EKG upload:', file.name);
      
      // Convert file to appropriate input format
      const ekgInput: EKGInput = await convertFileToEKGInput(file);
      
      // Perform medical analysis
      const medicalAnalysis = await ekgAnalyzer.current.analyzeEKG(ekgInput);
      
      // Validate medical accuracy
      const validationResult = await validateMedicalAccuracy(medicalAnalysis);
      if (!validationResult.isValid) {
        throw new Error(`Medical validation failed: ${validationResult.errors.join(', ')}`);
      }
      
      // Generate visualization configuration
      const visualizationConfig = await syncVisualizationToMedical(medicalAnalysis);
      
      // Generate educational content
      const educationalContent = await generateEducationalContent(
        medicalAnalysis, 
        currentLearningLevel
      );
      
      setSimulationState(prev => ({
        ...prev,
        isLoading: false,
        currentPhase: 'visualization',
        medicalAnalysis,
        visualizationConfig,
        educationalContent
      }));
      
      console.log('EKG analysis completed:', medicalAnalysis.rhythm_classification);
      
    } catch (error) {
      console.error('EKG analysis failed:', error);
      setSimulationState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      }));
    }
  }, [validateMedicalAccuracy, syncVisualizationToMedical, generateEducationalContent, currentLearningLevel]);
  
  /**
   * Convert uploaded file to EKG input format
   */
  const convertFileToEKGInput = async (file: File): Promise<EKGInput> => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'bmp'].includes(fileExtension || '')) {
      // Image-based EKG
      const base64 = await fileToBase64(file);
      return {
        type: 'image',
        data: base64,
        metadata: {
          paperSpeed: 25, // Standard 25mm/s
          calibration: 0.1 // Standard 0.1mV/mm
        }
      };
    } else if (['txt', 'csv'].includes(fileExtension || '') || file.type === 'text/plain') {
      // Text report or data
      const text = await fileToText(file);
      return {
        type: 'text_report',
        data: text
      };
    } else {
      // Assume waveform data (JSON, CSV with numeric values)
      const text = await fileToText(file);
      try {
        const waveformData = JSON.parse(text);
        return {
          type: 'waveform',
          data: Array.isArray(waveformData) ? waveformData : waveformData.amplitude || [],
          metadata: {
            samplingRate: waveformData.samplingRate || 500,
            leadConfiguration: waveformData.leads || ['II']
          }
        };
      } catch {
        // If JSON parsing fails, try to parse as CSV
        const lines = text.split('\\n');
        const numbers = lines
          .map(line => parseFloat(line.split(',')[0]))
          .filter(num => !isNaN(num));
        
        return {
          type: 'waveform',
          data: numbers,
          metadata: {
            samplingRate: 500,
            leadConfiguration: ['II']
          }
        };
      }
    }
  };
  
  /**
   * Convert file to base64 string
   */
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };
  
  /**
   * Convert file to text string
   */
  const fileToText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };
  
  /**
   * Toggle simulation play/pause
   */
  const togglePlayPause = useCallback(() => {
    setSimulationState(prev => ({
      ...prev,
      isPlaying: !prev.isPlaying
    }));
  }, []);
  
  /**
   * Reset simulation to upload state
   */
  const resetSimulation = useCallback(() => {
    setSimulationState({
      isLoading: false,
      isPlaying: false,
      currentPhase: 'upload',
      medicalAnalysis: null,
      visualizationConfig: null,
      educationalContent: null,
      error: null
    });
  }, []);
  
  /**
   * Handle animation speed changes
   */
  const handleSpeedChange = useCallback((newSpeed: number) => {
    setAnimationSpeed(Math.max(0.1, Math.min(5.0, newSpeed)));
  }, []);
  
  return (
    <div className=\"min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white\">
      {/* Header */}
      <header className=\"bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50\">
        <div className=\"container mx-auto px-4 py-4 flex items-center justify-between\">
          <div className=\"flex items-center space-x-3\">
            <motion.div
              animate={{ rotate: simulationState.isPlaying ? 360 : 0 }}
              transition={{ duration: 2, repeat: simulationState.isPlaying ? Infinity : 0, ease: 'linear' }}
            >
              <Heart className=\"w-8 h-8 text-red-500\" />
            </motion.div>
            <div>
              <h1 className=\"text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent\">
                EKG Clinical Simulation Engine
              </h1>
              <p className=\"text-sm text-slate-400\">Real-time 3D Heart Visualization with Educational Narration</p>
            </div>
          </div>
          
          <div className=\"flex items-center space-x-2\">
            <button
              onClick={() => setShowPerformanceMonitor(!showPerformanceMonitor)}
              className=\"p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 transition-colors\"
              title=\"Performance Monitor\"
            >
              <Settings className=\"w-5 h-5\" />
            </button>
            
            <button
              onClick={() => setShowEducationalPanel(!showEducationalPanel)}
              className={`p-2 rounded-lg transition-colors ${\n                showEducationalPanel \n                  ? 'bg-blue-600/50 text-blue-300' \n                  : 'bg-slate-700/50 hover:bg-slate-600/50'\n              }`}
              title=\"Educational Panel\"
            >
              <BookOpen className=\"w-5 h-5\" />
            </button>
            
            {simulationState.medicalAnalysis && (\n              <motion.div\n                initial={{ scale: 0 }}\n                animate={{ scale: 1 }}\n                className=\"px-3 py-1 rounded-full bg-green-600/20 text-green-400 text-sm font-medium border border-green-600/30\"\n              >\n                {simulationState.medicalAnalysis.rhythm_classification.replace('_', ' ')}\n              </motion.div>\n            )}\n          </div>\n        </div>\n      </header>\n\n      <div className=\"container mx-auto px-4 py-6\">\n        <div className=\"grid grid-cols-12 gap-6 h-[calc(100vh-120px)]\">\n          {/* Main Visualization Area */}\n          <div className=\"col-span-8 space-y-4\">\n            <AnimatePresence mode=\"wait\">\n              {simulationState.currentPhase === 'upload' && (\n                <motion.div\n                  key=\"upload\"\n                  initial={{ opacity: 0, y: 20 }}\n                  animate={{ opacity: 1, y: 0 }}\n                  exit={{ opacity: 0, y: -20 }}\n                  className=\"h-full\"\n                >\n                  <EKGUploadZone \n                    onFileUpload={handleEKGUpload}\n                    isLoading={simulationState.isLoading}\n                    error={simulationState.error}\n                  />\n                </motion.div>\n              )}\n              \n              {(simulationState.currentPhase === 'visualization' || simulationState.currentPhase === 'education') && (\n                <motion.div\n                  key=\"visualization\"\n                  initial={{ opacity: 0, scale: 0.95 }}\n                  animate={{ opacity: 1, scale: 1 }}\n                  className=\"h-full bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden\"\n                >\n                  <HeartVisualization3D\n                    medicalAnalysis={simulationState.medicalAnalysis!}\n                    visualizationConfig={simulationState.visualizationConfig}\n                    isPlaying={simulationState.isPlaying}\n                    animationSpeed={animationSpeed}\n                    educationalHighlights={simulationState.educationalContent?.highlights}\n                  />\n                </motion.div>\n              )}\n              \n              {simulationState.currentPhase === 'analysis' && (\n                <motion.div\n                  key=\"analysis\"\n                  initial={{ opacity: 0 }}\n                  animate={{ opacity: 1 }}\n                  className=\"h-full flex items-center justify-center\"\n                >\n                  <div className=\"text-center space-y-4\">\n                    <motion.div\n                      animate={{ rotate: 360 }}\n                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}\n                      className=\"w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full mx-auto\"\n                    />\n                    <div>\n                      <h3 className=\"text-xl font-semibold text-blue-400\">Analyzing EKG</h3>\n                      <p className=\"text-slate-400\">Processing with clinical-grade accuracy...</p>\n                    </div>\n                  </div>\n                </motion.div>\n              )}\n            </AnimatePresence>\n            \n            {/* Control Panel */}\n            {simulationState.medicalAnalysis && (\n              <motion.div\n                initial={{ opacity: 0, y: 20 }}\n                animate={{ opacity: 1, y: 0 }}\n                delay={0.3}\n              >\n                <ControlPanel\n                  isPlaying={simulationState.isPlaying}\n                  animationSpeed={animationSpeed}\n                  onPlayPause={togglePlayPause}\n                  onSpeedChange={handleSpeedChange}\n                  onReset={resetSimulation}\n                  learningLevel={currentLearningLevel}\n                  onLearningLevelChange={setLearningLevel}\n                />\n              </motion.div>\n            )}\n          </div>\n          \n          {/* Side Panels */}\n          <div className=\"col-span-4 space-y-4\">\n            {/* Medical Analysis Panel */}\n            <AnimatePresence>\n              {simulationState.medicalAnalysis && showMedicalPanel && (\n                <motion.div\n                  initial={{ opacity: 0, x: 20 }}\n                  animate={{ opacity: 1, x: 0 }}\n                  exit={{ opacity: 0, x: 20 }}\n                  className=\"h-1/2\"\n                >\n                  <MedicalAnalysisPanel\n                    medicalAnalysis={simulationState.medicalAnalysis}\n                    onClose={() => setShowMedicalPanel(false)}\n                  />\n                </motion.div>\n              )}\n            </AnimatePresence>\n            \n            {/* Educational Panel */}\n            <AnimatePresence>\n              {simulationState.educationalContent && showEducationalPanel && (\n                <motion.div\n                  initial={{ opacity: 0, x: 20 }}\n                  animate={{ opacity: 1, x: 0 }}\n                  exit={{ opacity: 0, x: 20 }}\n                  className={simulationState.medicalAnalysis && showMedicalPanel ? \"h-1/2\" : \"h-full\"}\n                >\n                  <EducationalPanel\n                    educationalContent={simulationState.educationalContent}\n                    currentTime={simulationState.isPlaying ? Date.now() : 0}\n                    learningLevel={currentLearningLevel}\n                    onClose={() => setShowEducationalPanel(false)}\n                  />\n                </motion.div>\n              )}\n            </AnimatePresence>\n            \n            {/* Performance Monitor */}\n            <AnimatePresence>\n              {showPerformanceMonitor && (\n                <motion.div\n                  initial={{ opacity: 0, scale: 0.95 }}\n                  animate={{ opacity: 1, scale: 1 }}\n                  exit={{ opacity: 0, scale: 0.95 }}\n                  className=\"absolute top-20 right-4 w-80 z-40\"\n                >\n                  <PerformanceMonitor onClose={() => setShowPerformanceMonitor(false)} />\n                </motion.div>\n              )}\n            </AnimatePresence>\n          </div>\n        </div>\n      </div>\n      \n      {/* Error Toast */}\n      <AnimatePresence>\n        {simulationState.error && (\n          <motion.div\n            initial={{ opacity: 0, y: 50 }}\n            animate={{ opacity: 1, y: 0 }}\n            exit={{ opacity: 0, y: 50 }}\n            className=\"fixed bottom-4 right-4 bg-red-600/90 text-white px-6 py-4 rounded-lg shadow-lg backdrop-blur-sm max-w-md z-50\"\n          >\n            <div className=\"flex items-start space-x-3\">\n              <div className=\"w-5 h-5 rounded-full bg-red-500 flex-shrink-0 mt-0.5\" />\n              <div>\n                <h4 className=\"font-semibold\">Analysis Error</h4>\n                <p className=\"text-sm text-red-200 mt-1\">{simulationState.error}</p>\n                <button\n                  onClick={() => setSimulationState(prev => ({ ...prev, error: null }))}\n                  className=\"text-sm text-red-200 hover:text-white mt-2 underline\"\n                >\n                  Dismiss\n                </button>\n              </div>\n            </div>\n          </motion.div>\n        )}\n      </AnimatePresence>\n    </div>\n  );\n}\n\n// Error boundary for medical simulation\nexport function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {\n  useEffect(() => {\n    console.error('Medical simulation error:', error);\n  }, [error]);\n  \n  return (\n    <div className=\"min-h-screen bg-gradient-to-br from-slate-900 to-red-900 flex items-center justify-center p-4\">\n      <div className=\"bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700/50 p-8 max-w-md text-center\">\n        <div className=\"w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4\">\n          <Heart className=\"w-8 h-8 text-red-400\" />\n        </div>\n        <h2 className=\"text-xl font-bold text-white mb-2\">Medical Simulation Error</h2>\n        <p className=\"text-slate-300 mb-6\">\n          A critical error occurred in the medical simulation engine. This has been logged for clinical review.\n        </p>\n        <div className=\"space-y-3\">\n          <button\n            onClick={reset}\n            className=\"w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors\"\n          >\n            Restart Simulation\n          </button>\n          <p className=\"text-xs text-slate-400\">\n            Error: {error.message}\n          </p>\n        </div>\n      </div>\n    </div>\n  );\n}