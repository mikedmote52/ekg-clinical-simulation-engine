'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Camera, 
  Eye, 
  EyeOff, 
  Settings, 
  Volume2, 
  VolumeX,
  Zap,
  Heart as HeartIcon,
  Activity,
  Monitor,
  BookOpen,
  Info
} from 'lucide-react';

// Import our medical accuracy components
import { AnatomicalHeartModel } from '../../../packages/heart-3d/src/AnatomicalHeartModel';
import { ConductionSystemVisualizer } from '../../../packages/heart-3d/src/ConductionSystemVisualizer';
import { ElectrophysiologyMapper } from '../../../packages/ekg-processor/src/ElectrophysiologyMapper';
import { ekgAnalyzer } from '../../../packages/ekg-processor/src/index';

// Medical data interfaces
interface MedicalAccuracyData {
  rhythm_classification: string;
  heart_rate: number;
  clinical_significance: 'normal' | 'monitor' | 'urgent' | 'critical';
  pathophysiology: string;
  timing_measurements: {
    pr_interval: number;
    qrs_duration: number;
    qt_interval: number;
    rr_interval_variability: number;
  };
  conduction_pathway: {
    sa_node: { status: 'normal' | 'abnormal'; details: string };
    av_node: { status: 'normal' | 'abnormal'; delay: number };
    his_purkinje: { status: 'normal' | 'abnormal'; details: string };
  };
  clinical_context: {
    symptoms_likely: string[];
    treatment_considerations: string[];
    monitoring_requirements: string[];
  };
  educational_focus: {
    key_teaching_points: string[];
    common_misconceptions: string[];
    clinical_correlations: string[];
  };
}

interface MedicalAccurateHeartVisualizationProps {
  medicalData: MedicalAccuracyData | null;
  ekgFile?: File;
  onVisualizationStateChange?: (state: any) => void;
  onMedicalHighlight?: (finding: string, active: boolean) => void;
  onEducationalEvent?: (event: string, data: any) => void;
}

interface VisualizationControls {
  isPlaying: boolean;
  animationSpeed: number;
  currentViewpoint: string;
  medicalAccuracyMode: boolean;
  conductionVisible: boolean;
  electricalFieldsVisible: boolean;
  anatomicalLabelsVisible: boolean;
  timingMarkersVisible: boolean;
  educationalMode: boolean;
  realTimeProcessing: boolean;
}

interface MedicalAccuracyMetrics {
  timingAccuracy: number;
  anatomicalAccuracy: number;
  conductionAccuracy: number;
  overallConfidence: number;
  validationStatus: 'validated' | 'pending' | 'error';
}

export const MedicallyAccurateHeartVisualization: React.FC<MedicalAccurateHeartVisualizationProps> = ({
  medicalData,
  ekgFile,
  onVisualizationStateChange,
  onMedicalHighlight,
  onEducationalEvent
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Three.js core objects
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  
  // Medical visualization components
  const anatomicalHeartRef = useRef<AnatomicalHeartModel>();
  const conductionVisualizerRef = useRef<ConductionSystemVisualizer>();
  const electrophysiologyMapperRef = useRef<ElectrophysiologyMapper>();
  
  // State management
  const [controls, setControls] = useState<VisualizationControls>({
    isPlaying: false,
    animationSpeed: 1.0,
    currentViewpoint: 'Anterior View',
    medicalAccuracyMode: true,
    conductionVisible: true,
    electricalFieldsVisible: true,
    anatomicalLabelsVisible: true,
    timingMarkersVisible: true,
    educationalMode: false,
    realTimeProcessing: false
  });
  
  const [medicalAccuracy, setMedicalAccuracy] = useState<MedicalAccuracyMetrics>({
    timingAccuracy: 0,
    anatomicalAccuracy: 0,
    conductionAccuracy: 0,
    overallConfidence: 0,
    validationStatus: 'pending'
  });
  
  const [currentEKGAnalysis, setCurrentEKGAnalysis] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [currentCycleTime, setCurrentCycleTime] = useState(0);
  const [educationalEvents, setEducationalEvents] = useState<any[]>([]);

  /**
   * Initialize Three.js scene and medical components
   */
  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize Three.js scene
    initializeScene();
    
    // Initialize medical visualization components
    initializeMedicalComponents();
    
    // Setup event listeners
    setupEventListeners();
    
    setIsInitialized(true);
    
    return () => {
      cleanup();
    };
  }, []);

  const initializeScene = useCallback(() => {
    if (!mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera setup - positioned for optimal heart viewing
    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 0, 120);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup with medical-grade quality
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Lighting setup for medical visualization
    setupMedicalLighting(scene);
  }, []);

  const setupMedicalLighting = useCallback((scene: THREE.Scene) => {
    // Ambient light for overall illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    // Main directional light (key light)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(50, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Fill light for anatomy visibility
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    fillLight.position.set(-30, 20, 30);
    scene.add(fillLight);

    // Rim light for definition
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, -50, -50);
    scene.add(rimLight);

    // Point lights for conduction system highlighting
    const conductionLight = new THREE.PointLight(0xffff00, 0.5, 100);
    conductionLight.position.set(25, 15, -10); // SA node position
    scene.add(conductionLight);
  }, []);

  const initializeMedicalComponents = useCallback(() => {
    if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

    // Initialize anatomically accurate heart model
    const anatomicalHeart = new AnatomicalHeartModel(sceneRef.current);
    anatomicalHeartRef.current = anatomicalHeart;

    // Initialize conduction system visualizer
    const conductionVisualizer = new ConductionSystemVisualizer(
      sceneRef.current,
      cameraRef.current,
      rendererRef.current
    );
    conductionVisualizerRef.current = conductionVisualizer;

    // Initialize electrophysiology mapper
    const electrophysiologyMapper = new ElectrophysiologyMapper();
    electrophysiologyMapperRef.current = electrophysiologyMapper;

    // Get initial medical accuracy metrics
    updateMedicalAccuracyMetrics();
  }, []);

  const setupEventListeners = useCallback(() => {
    if (!rendererRef.current) return;

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  /**
   * Process EKG file and update visualization
   */
  useEffect(() => {
    if (ekgFile && controls.realTimeProcessing) {
      processEKGFile(ekgFile);
    }
  }, [ekgFile, controls.realTimeProcessing]);

  const processEKGFile = useCallback(async (file: File) => {
    try {
      // Analyze EKG file using our enhanced analyzer
      const analysis = await ekgAnalyzer.analyzeEKGFile(file);
      setCurrentEKGAnalysis(analysis);

      // Map EKG analysis to heart model
      if (anatomicalHeartRef.current) {
        anatomicalHeartRef.current.processEKGData(analysis);
      }

      // Update medical accuracy metrics
      updateMedicalAccuracyMetrics();

      // Trigger educational events
      triggerEducationalEvents(analysis);

    } catch (error) {
      console.error('EKG processing error:', error);
      setMedicalAccuracy(prev => ({ ...prev, validationStatus: 'error' }));
    }
  }, []);

  const updateMedicalAccuracyMetrics = useCallback(() => {
    if (!anatomicalHeartRef.current || !conductionVisualizerRef.current) return;

    const heartMetrics = anatomicalHeartRef.current.getMedicalAccuracyMetrics();
    
    const newMetrics: MedicalAccuracyMetrics = {
      timingAccuracy: heartMetrics.timingAccuracy,
      anatomicalAccuracy: heartMetrics.anatomicalAccuracy,
      conductionAccuracy: heartMetrics.conductionAccuracy,
      overallConfidence: (heartMetrics.timingAccuracy + 
                         heartMetrics.anatomicalAccuracy + 
                         heartMetrics.conductionAccuracy) / 3,
      validationStatus: 'validated'
    };

    setMedicalAccuracy(newMetrics);
  }, []);

  const triggerEducationalEvents = useCallback((analysis: any) => {
    const events = [];

    // Rhythm-specific educational events
    if (analysis.rhythm_analysis.clinical_significance !== 'normal') {
      events.push({
        type: 'rhythm_abnormality',
        data: {
          rhythm: analysis.rhythm_analysis.primary_rhythm,
          significance: analysis.rhythm_analysis.clinical_significance,
          keyPoints: analysis.educational_focus.key_teaching_points
        }
      });
    }

    // Timing abnormality events
    if (analysis.timing_measurements.pr_interval > 200) {
      events.push({
        type: 'conduction_delay',
        data: {
          type: 'PR_prolongation',
          value: analysis.timing_measurements.pr_interval,
          clinical: 'First-degree AV block'
        }
      });
    }

    setEducationalEvents(events);

    // Notify parent component
    events.forEach(event => {
      onEducationalEvent?.(event.type, event.data);
    });
  }, [onEducationalEvent]);

  /**
   * Main animation loop
   */
  useEffect(() => {
    if (!isInitialized || !controls.isPlaying) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      if (!sceneRef.current || !cameraRef.current || !rendererRef.current) return;

      const deltaTime = clockRef.current.getDelta();
      const elapsedTime = clockRef.current.getElapsedTime() * 1000; // Convert to milliseconds

      // Update current cycle time
      const newCycleTime = elapsedTime % (60000 / (medicalData?.heart_rate || 72)); // Full cardiac cycle
      setCurrentCycleTime(newCycleTime);

      // Generate electrophysiology state
      if (electrophysiologyMapperRef.current && currentEKGAnalysis) {
        const electrophysiologyState = electrophysiologyMapperRef.current
          .mapEKGToElectrophysiology(currentEKGAnalysis, newCycleTime);

        // Update heart model animation
        if (anatomicalHeartRef.current) {
          anatomicalHeartRef.current.updateAnimation(deltaTime * controls.animationSpeed);
        }

        // Update conduction system visualization
        if (conductionVisualizerRef.current) {
          conductionVisualizerRef.current.updateVisualization(electrophysiologyState);
        }

        // Check for medical highlights
        checkForMedicalHighlights(electrophysiologyState);
      }

      // Render scene
      rendererRef.current.render(sceneRef.current, cameraRef.current);

      // Continue animation
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isInitialized, controls.isPlaying, controls.animationSpeed, currentEKGAnalysis, medicalData]);

  const checkForMedicalHighlights = useCallback((state: any) => {
    // Check for abnormal conduction regions
    state.activeRegions?.forEach((region: any) => {
      if (region.isBlocked) {
        onMedicalHighlight?.(`${region.anatomicalLocation}_blocked`, true);
      }
    });

    // Check for abnormal electrical waves
    state.electricalWaves?.forEach((wave: any) => {
      if (wave.isAbnormal) {
        onMedicalHighlight?.(`abnormal_${wave.waveType}`, true);
      }
    });
  }, [onMedicalHighlight]);

  /**
   * Control handlers
   */
  const togglePlayPause = useCallback(() => {
    const newPlaying = !controls.isPlaying;
    setControls(prev => ({ ...prev, isPlaying: newPlaying }));
    
    if (anatomicalHeartRef.current) {
      if (newPlaying) {
        anatomicalHeartRef.current.startAnimation();
      } else {
        anatomicalHeartRef.current.stopAnimation();
      }
    }
    
    onVisualizationStateChange?.({ isPlaying: newPlaying });
  }, [controls.isPlaying, onVisualizationStateChange]);

  const handleSpeedChange = useCallback((speed: number) => {
    const clampedSpeed = Math.max(0.1, Math.min(5.0, speed));
    setControls(prev => ({ ...prev, animationSpeed: clampedSpeed }));
  }, []);

  const handleReset = useCallback(() => {
    setControls(prev => ({
      ...prev,
      animationSpeed: 1.0,
      isPlaying: false
    }));
    
    if (anatomicalHeartRef.current) {
      anatomicalHeartRef.current.stopAnimation();
    }
    
    if (electrophysiologyMapperRef.current) {
      electrophysiologyMapperRef.current.resetCycle();
    }
    
    setCurrentCycleTime(0);
    clockRef.current.start();
  }, []);

  const toggleConductionSystem = useCallback(() => {
    const newVisible = !controls.conductionVisible;
    setControls(prev => ({ ...prev, conductionVisible: newVisible }));
    
    if (conductionVisualizerRef.current) {
      conductionVisualizerRef.current.setPathwaysVisible(newVisible);
    }
  }, [controls.conductionVisible]);

  const toggleElectricalFields = useCallback(() => {
    const newVisible = !controls.electricalFieldsVisible;
    setControls(prev => ({ ...prev, electricalFieldsVisible: newVisible }));
    
    if (conductionVisualizerRef.current) {
      conductionVisualizerRef.current.setElectricalFieldsVisible(newVisible);
    }
  }, [controls.electricalFieldsVisible]);

  const toggleLabels = useCallback(() => {
    const newVisible = !controls.anatomicalLabelsVisible;
    setControls(prev => ({ ...prev, anatomicalLabelsVisible: newVisible }));
    
    if (conductionVisualizerRef.current) {
      conductionVisualizerRef.current.setLabelsVisible(newVisible);
    }
  }, [controls.anatomicalLabelsVisible]);

  const toggleMedicalAccuracy = useCallback(() => {
    const newMode = !controls.medicalAccuracyMode;
    setControls(prev => ({ ...prev, medicalAccuracyMode: newMode }));
    
    if (conductionVisualizerRef.current) {
      conductionVisualizerRef.current.setMedicalAccuracyMode(newMode);
    }
  }, [controls.medicalAccuracyMode]);

  const changeViewpoint = useCallback((viewpoint: string) => {
    setControls(prev => ({ ...prev, currentViewpoint: viewpoint }));
    
    if (!cameraRef.current) return;

    // Define camera positions for different medical views
    const viewpoints = {
      'Anterior View': { x: 0, y: 0, z: 120 },
      'Left Lateral': { x: -120, y: 0, z: 0 },
      'Right Lateral': { x: 120, y: 0, z: 0 },
      'Superior View': { x: 0, y: 120, z: 20 },
      'Inferior View': { x: 0, y: -120, z: 20 },
      'Apical View': { x: 0, y: -50, z: -100 }
    };

    const position = viewpoints[viewpoint as keyof typeof viewpoints] || viewpoints['Anterior View'];
    
    // Smooth camera transition
    const startPosition = cameraRef.current.position.clone();
    const endPosition = new THREE.Vector3(position.x, position.y, position.z);
    
    let progress = 0;
    const animateCamera = () => {
      progress += 0.05;
      if (progress >= 1) progress = 1;
      
      cameraRef.current!.position.lerpVectors(startPosition, endPosition, progress);
      cameraRef.current!.lookAt(0, 0, 0);
      
      if (progress < 1) {
        requestAnimationFrame(animateCamera);
      }
    };
    
    animateCamera();
  }, []);

  const cleanup = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    
    if (mountRef.current && rendererRef.current) {
      mountRef.current.removeChild(rendererRef.current.domElement);
    }
  }, []);

  // Calculate cardiac cycle progress for UI
  const cycleProgress = medicalData?.heart_rate ? 
    (currentCycleTime / (60000 / medicalData.heart_rate)) * 100 : 0;

  return (
    <div className="h-full bg-gradient-to-br from-slate-900 to-blue-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* Main 3D Visualization */}
      <div className="relative h-[70%]">
        <div ref={mountRef} className="w-full h-full" />
        
        {/* Medical Accuracy Overlay */}
        <div className="absolute top-4 right-4 space-y-2">
          {/* Medical Status Indicator */}
          {medicalData && (
            <div className={`px-3 py-2 rounded-lg text-sm font-medium backdrop-blur-sm ${
              medicalData.clinical_significance === 'normal' ? 'bg-green-900/80 text-green-300 border border-green-500/30' :
              medicalData.clinical_significance === 'monitor' ? 'bg-yellow-900/80 text-yellow-300 border border-yellow-500/30' :
              medicalData.clinical_significance === 'urgent' ? 'bg-orange-900/80 text-orange-300 border border-orange-500/30' :
              'bg-red-900/80 text-red-300 border border-red-500/30'
            }`}>
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4" />
                <span>{medicalData.rhythm_classification.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div className="text-xs opacity-80">{medicalData.heart_rate} BPM</div>
            </div>
          )}
          
          {/* Medical Accuracy Metrics */}
          <div className="bg-slate-800/90 backdrop-blur-sm text-slate-300 px-3 py-2 rounded-lg text-xs">
            <div className="flex items-center space-x-2 mb-1">
              <Monitor className="w-3 h-3" />
              <span className="font-semibold">Medical Accuracy</span>
            </div>
            <div>Timing: {Math.round(medicalAccuracy.timingAccuracy * 100)}%</div>
            <div>Anatomy: {Math.round(medicalAccuracy.anatomicalAccuracy * 100)}%</div>
            <div>Conduction: {Math.round(medicalAccuracy.conductionAccuracy * 100)}%</div>
            <div className="border-t border-slate-600 mt-1 pt-1">
              <span className="font-semibold">Overall: {Math.round(medicalAccuracy.overallConfidence * 100)}%</span>
            </div>
          </div>

          {/* Cardiac Cycle Progress */}
          {controls.isPlaying && (
            <div className="bg-slate-800/90 backdrop-blur-sm text-slate-300 px-3 py-2 rounded-lg text-xs">
              <div className="flex items-center space-x-2 mb-2">
                <HeartIcon className="w-3 h-3 text-red-400" />
                <span>Cardiac Cycle</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div 
                  className="bg-red-400 h-2 rounded-full transition-all duration-100" 
                  style={{ width: `${cycleProgress}%` }}
                />
              </div>
              <div className="text-center mt-1">{Math.round(cycleProgress)}%</div>
            </div>
          )}
        </div>
        
        {/* Educational Overlay */}
        {medicalData && controls.anatomicalLabelsVisible && (
          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 max-w-md">
            <h4 className="text-sm font-semibold text-blue-400 mb-2 flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Clinical Context</span>
            </h4>
            <p className="text-xs text-slate-300 mb-3">{medicalData.pathophysiology}</p>
            
            {medicalData.clinical_context.symptoms_likely.length > 0 && (
              <div className="text-xs">
                <div className="text-yellow-400 font-medium flex items-center space-x-1">
                  <Info className="w-3 h-3" />
                  <span>Key Teaching Points:</span>
                </div>
                <ul className="text-slate-400 mt-1 space-y-1">
                  {medicalData.educational_focus.key_teaching_points.slice(0, 3).map((point, idx) => (
                    <li key={idx}>• {point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Enhanced Control Panel */}
      <div className="h-[30%] border-t border-slate-700 bg-slate-900/50 p-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
          
          {/* Playback Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-blue-400 flex items-center space-x-2">
              <Play className="w-4 h-4" />
              <span>Cardiac Animation</span>
            </h4>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={togglePlayPause}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg transition-colors text-sm"
              >
                {controls.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{controls.isPlaying ? 'Pause' : 'Play'}</span>
              </button>
              
              <button
                onClick={handleReset}
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                title="Reset Animation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Animation Speed</span>
                <span>{controls.animationSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={controls.animationSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
          
          {/* View Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-purple-400 flex items-center space-x-2">
              <Camera className="w-4 h-4" />
              <span>Medical Views</span>
            </h4>
            
            <select
              value={controls.currentViewpoint}
              onChange={(e) => changeViewpoint(e.target.value)}
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="Anterior View">Anterior View</option>
              <option value="Left Lateral">Left Lateral</option>
              <option value="Right Lateral">Right Lateral</option>
              <option value="Superior View">Superior View</option>
              <option value="Inferior View">Inferior View</option>
              <option value="Apical View">Apical View</option>
            </select>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleLabels}
                className={`flex items-center justify-center space-x-2 px-2 py-2 rounded-lg transition-colors text-xs ${
                  controls.anatomicalLabelsVisible ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {controls.anatomicalLabelsVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>Labels</span>
              </button>
              
              <button
                onClick={toggleMedicalAccuracy}
                className={`flex items-center justify-center space-x-2 px-2 py-2 rounded-lg transition-colors text-xs ${
                  controls.medicalAccuracyMode ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Monitor className="w-3 h-3" />
                <span>Accuracy</span>
              </button>
            </div>
          </div>
          
          {/* Conduction System Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-green-400 flex items-center space-x-2">
              <Zap className="w-4 h-4" />
              <span>Electrophysiology</span>
            </h4>
            
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={toggleConductionSystem}
                className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-colors text-xs ${
                  controls.conductionVisible ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Conduction System</span>
              </button>
              
              <button
                onClick={toggleElectricalFields}
                className={`flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-colors text-xs ${
                  controls.electricalFieldsVisible ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>Electrical Fields</span>
              </button>
              
              <label className="flex items-center space-x-2 text-xs">
                <input
                  type="checkbox"
                  checked={controls.realTimeProcessing}
                  onChange={(e) => setControls(prev => ({ ...prev, realTimeProcessing: e.target.checked }))}
                  className="rounded"
                />
                <span>Real-time EKG</span>
              </label>
            </div>
          </div>
          
          {/* Educational Features */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-orange-400 flex items-center space-x-2">
              <BookOpen className="w-4 h-4" />
              <span>Education</span>
            </h4>
            
            <div className="space-y-2">
              <button
                className={`w-full flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-colors text-xs ${
                  controls.educationalMode ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
                onClick={() => setControls(prev => ({ ...prev, educationalMode: !prev.educationalMode }))}
              >
                <BookOpen className="w-3 h-3" />
                <span>Educational Mode</span>
              </button>
              
              {educationalEvents.length > 0 && (
                <div className="text-xs text-slate-400">
                  <div className="font-semibold">Learning Events:</div>
                  <div>{educationalEvents.length} active</div>
                </div>
              )}
              
              {currentEKGAnalysis && (
                <div className="text-xs text-slate-400">
                  <div className="font-semibold">Analysis Confidence:</div>
                  <div>{Math.round((currentEKGAnalysis.confidence_score || 0) * 100)}%</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicallyAccurateHeartVisualization;