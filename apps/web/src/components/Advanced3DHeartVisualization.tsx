'use client';

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
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
  Maximize,
  Layers,
  Target,
  Timer
} from 'lucide-react';
import { EKGAnalysisResult } from '../lib/ekgAnalysis';

interface MedicalData {
  rhythm_classification: string;
  heart_rate: number;
  clinical_significance: 'normal' | 'monitor' | 'urgent' | 'critical';
  pathophysiology: string;
  timing_measurements?: {
    pr_interval: number;
    qrs_duration: number;
    qt_interval: number;
    rr_interval_variability: number;
  };
  animation_requirements?: {
    conduction_timing: {
      sa_to_av_delay: number;
      av_to_his_delay: number;
      his_to_purkinje_delay: number;
    };
    chamber_coordination: {
      atrial_systole_timing: number;
      ventricular_systole_timing: number;
      av_synchrony: boolean;
    };
    abnormality_highlights: string[];
    educational_emphasis_areas: string[];
  };
  clinical_context: {
    symptoms_likely: string[];
    treatment_considerations: string[];
    monitoring_requirements: string[];
  };
}

interface Advanced3DHeartVisualizationProps {
  medicalData: MedicalData | null;
  onVisualizationStateChange?: (state: any) => void;
  onMedicalHighlight?: (finding: string, active: boolean) => void;
}

interface HeartGeometry {
  rightAtrium: THREE.Mesh;
  leftAtrium: THREE.Mesh;
  rightVentricle: THREE.Mesh;
  leftVentricle: THREE.Mesh;
  interventricularSeptum: THREE.Mesh;
  aorta: THREE.Mesh;
  pulmonaryArtery: THREE.Mesh;
  superiorVenaCava: THREE.Mesh;
  inferiorVenaCava: THREE.Mesh;
  pulmonaryVeins: THREE.Mesh[];
}

interface ConductionSystem {
  saNode: THREE.Mesh;
  avNode: THREE.Mesh;
  bundleOfHis: THREE.Mesh;
  leftBundle: THREE.Mesh;
  rightBundle: THREE.Mesh;
  purkinjeNetwork: THREE.LineSegments;
}

interface CoronaryArteries {
  leftMain: THREE.TubeGeometry;
  lad: THREE.TubeGeometry;
  lcx: THREE.TubeGeometry;
  rca: THREE.TubeGeometry;
  meshes: THREE.Mesh[];
}

/**
 * Advanced 3D Heart Visualization with real EKG synchronization
 * Features anatomically accurate heart model with electrical conduction system
 */
export const Advanced3DHeartVisualization: React.FC<Advanced3DHeartVisualizationProps> = ({
  medicalData,
  onVisualizationStateChange,
  onMedicalHighlight
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const heartGroupRef = useRef<THREE.Group>();
  const animationFrameRef = useRef<number>();
  
  // Heart anatomy references
  const heartGeometryRef = useRef<HeartGeometry>();
  const conductionSystemRef = useRef<ConductionSystem>();
  const coronaryArteriesRef = useRef<CoronaryArteries>();
  
  // Animation state - START PLAYING BY DEFAULT
  const [controls, setControls] = useState({
    isPlaying: true, // Start animation by default to show heart beating
    animationSpeed: 1.0,
    currentViewpoint: 'Anterior View',
    labelsVisible: true,
    conductionVisible: true,
    coronaryVisible: true,
    cutawayMode: false,
    chamberHighlight: 'none',
    audioEnabled: true,
    quality: 'high' as const,
    autoRotate: false
  });
  
  const [animationState, setAnimationState] = useState({
    currentPhase: 0,
    heartbeat: 0,
    electricalActivity: new Map<string, number>(),
    chamberContractions: new Map<string, number>(),
    lastBeatTime: 0
  });
  
  const [performance, setPerformance] = useState({
    fps: 60,
    drawCalls: 0,
    triangles: 0,
    renderTime: 0
  });

  /**
   * Get real-time cardiac cycle parameters from EKG analysis
   */
  const cardiacParameters = useMemo(() => {
    if (!medicalData?.timing_measurements || !medicalData?.animation_requirements) {
      return {
        heartRate: medicalData?.heart_rate || 72,
        beatDuration: 60000 / (medicalData?.heart_rate || 72),
        prInterval: 160,
        qrsDuration: 90,
        qtInterval: 380,
        conductionTiming: {
          saToAv: 100,
          avToHis: 50,
          hisToPurkinje: 40
        },
        chamberTiming: {
          atrialSystole: 100,
          ventricularSystole: 90,
          avSynchrony: true
        },
        abnormalities: []
      };
    }

    const { timing_measurements, animation_requirements } = medicalData;
    return {
      heartRate: medicalData.heart_rate,
      beatDuration: 60000 / medicalData.heart_rate,
      prInterval: timing_measurements.pr_interval,
      qrsDuration: timing_measurements.qrs_duration,
      qtInterval: timing_measurements.qt_interval,
      conductionTiming: {
        saToAv: animation_requirements.conduction_timing.sa_to_av_delay,
        avToHis: animation_requirements.conduction_timing.av_to_his_delay,
        hisToPurkinje: animation_requirements.conduction_timing.his_to_purkinje_delay
      },
      chamberTiming: {
        atrialSystole: animation_requirements.chamber_coordination.atrial_systole_timing,
        ventricularSystole: animation_requirements.chamber_coordination.ventricular_systole_timing,
        avSynchrony: animation_requirements.chamber_coordination.av_synchrony
      },
      abnormalities: animation_requirements.abnormality_highlights
    };
  }, [medicalData]);

  /**
   * Check WebGL support and initialize Three.js scene with anatomically accurate heart model
   */
  const initializeScene = useCallback(() => {
    if (!mountRef.current) {
      console.error('❌ Mount reference not available');
      return;
    }

    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      console.error('❌ WebGL not supported');
      // Create fallback div with message
      const fallbackDiv = document.createElement('div');
      fallbackDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #1a1a2e; color: white; flex-direction: column;">
          <h3>WebGL Not Supported</h3>
          <p>Please update your browser or enable hardware acceleration</p>
        </div>
      `;
      mountRef.current.appendChild(fallbackDiv);
      return;
    }

    console.log('✅ WebGL supported, initializing 3D scene');

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      60, 
      mountRef.current.clientWidth / mountRef.current.clientHeight, 
      0.1, 
      1000
    );
    camera.position.set(0, 0, 15);
    cameraRef.current = camera;

    // Renderer setup with error handling
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      rendererRef.current = renderer;
      
      console.log('✅ WebGL renderer created successfully');
    } catch (error) {
      console.error('❌ Error creating WebGL renderer:', error);
      // Fallback to basic renderer
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      rendererRef.current = renderer;
      console.log('⚠️ Using fallback renderer');
    }
    
    mountRef.current.appendChild(renderer.domElement);

    // Lighting setup for anatomical visualization
    setupLighting(scene);

    // Create heart anatomy with error handling
    try {
      const heartGroup = createHeartAnatomy();
      scene.add(heartGroup);
      heartGroupRef.current = heartGroup;
      console.log('✅ Heart group added to scene');

      // Create conduction system
      try {
        const conductionSystem = createConductionSystem();
        heartGroup.add(conductionSystem);
        console.log('✅ Conduction system added');
      } catch (error) {
        console.warn('⚠️ Conduction system creation failed:', error);
      }

      // Create coronary arteries
      try {
        const coronaryArteries = createCoronaryArteries();
        heartGroup.add(coronaryArteries);
        console.log('✅ Coronary arteries added');
      } catch (error) {
        console.warn('⚠️ Coronary arteries creation failed:', error);
      }
    } catch (error) {
      console.error('❌ Critical error creating heart anatomy:', error);
      // Create minimal visible heart as last resort
      const emergencyHeart = new THREE.Mesh(
        new THREE.SphereGeometry(3, 12, 8),
        new THREE.MeshBasicMaterial({ color: 0xFF0000, wireframe: true })
      );
      scene.add(emergencyHeart);
      console.log('🚨 Emergency heart created');
    }

    // Start animation loop
    startAnimationLoop();

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  /**
   * Setup anatomically accurate lighting for medical visualization
   */
  const setupLighting = (scene: THREE.Scene) => {
    console.log('💡 Setting up scene lighting...');
    
    try {
      // Ambient light for overall visibility - BRIGHTER
      const ambientLight = new THREE.AmbientLight(0x404060, 0.6); // Increased intensity
      scene.add(ambientLight);
      console.log('✅ Ambient light added');

      // Main directional light (simulating operating room lighting) - BRIGHTER
      const mainLight = new THREE.DirectionalLight(0xffffff, 1.5); // Increased intensity
      mainLight.position.set(10, 10, 5);
      mainLight.castShadow = true;
      mainLight.shadow.mapSize.width = 2048;
      mainLight.shadow.mapSize.height = 2048;
      scene.add(mainLight);
      console.log('✅ Main directional light added');

      // Fill light from opposite side
      const fillLight = new THREE.DirectionalLight(0x8bb5ff, 0.5); // Increased intensity
      fillLight.position.set(-8, 5, -3);
      scene.add(fillLight);
      console.log('✅ Fill light added');

      // Rim light for depth
      const rimLight = new THREE.DirectionalLight(0xff9580, 0.3); // Increased intensity
      rimLight.position.set(0, -10, -5);
      scene.add(rimLight);
      console.log('✅ Rim light added');

      // Point light for electrical activity highlighting
      const electricalLight = new THREE.PointLight(0x00ffff, 0.8, 15); // Increased intensity and range
      electricalLight.position.set(0, 2, 0);
      scene.add(electricalLight);
      console.log('✅ Electrical point light added');

      // Additional front light for better visibility
      const frontLight = new THREE.DirectionalLight(0xffffff, 0.8);
      frontLight.position.set(0, 0, 10);
      scene.add(frontLight);
      console.log('✅ Front light added');
      
      console.log('✅ All lighting setup complete - 6 lights total');
    } catch (error) {
      console.error('❌ Error setting up lighting:', error);
    }
  };

  /**
   * Create anatomically accurate 3D heart geometry with error handling
   */
  const createHeartAnatomy = (): THREE.Group => {
    const heartGroup = new THREE.Group();

    try {
      // Heart chambers with anatomically correct proportions
      const chambers = createHeartChambers();
      const vessels = createMajorVessels();
      const septum = createInterventricularSeptum();

      Object.values(chambers).forEach(chamber => {
        if (chamber && chamber.geometry && chamber.material) {
          heartGroup.add(chamber);
        }
      });
      
      Object.values(vessels).forEach(vessel => {
        if (Array.isArray(vessel)) {
          vessel.forEach(v => {
            if (v && v.geometry && v.material) {
              heartGroup.add(v);
            }
          });
        } else {
          if (vessel && vessel.geometry && vessel.material) {
            heartGroup.add(vessel);
          }
        }
      });
      
      if (septum && septum.geometry && septum.material) {
        heartGroup.add(septum);
      }

      heartGeometryRef.current = {
        ...chambers,
        interventricularSeptum: septum,
        ...vessels
      };
      
      console.log('✅ Heart anatomy created successfully with', heartGroup.children.length, 'components');
    } catch (error) {
      console.error('❌ Error creating heart anatomy:', error);
      // Create simple fallback heart
      const fallbackHeart = createFallbackHeart();
      heartGroup.add(fallbackHeart);
    }

    return heartGroup;
  };

  /**
   * Create simple fallback heart if complex geometry fails
   */
  const createFallbackHeart = (): THREE.Mesh => {
    const geometry = new THREE.SphereGeometry(2, 16, 12);
    geometry.scale(1.2, 1.5, 1.0); // Heart-like shape
    
    const material = new THREE.MeshPhongMaterial({
      color: 0xFF4444,
      transparent: true,
      opacity: 0.9,
      shininess: 50
    });
    
    const fallbackHeart = new THREE.Mesh(geometry, material);
    console.log('💙 Created fallback heart geometry');
    return fallbackHeart;
  };

  /**
   * Create anatomically correct heart chambers with robust error handling
   */
  const createHeartChambers = () => {
    console.log('🫀 Creating heart chambers...');
    
    try {
      // Right Atrium - thin-walled, receives venous blood
      const rightAtriumGeometry = new THREE.SphereGeometry(1.2, 16, 12);
      rightAtriumGeometry.scale(1.1, 0.8, 0.9); // Flatten slightly
      const rightAtriumMaterial = new THREE.MeshPhongMaterial({
        color: 0x8B4B8B,
        transparent: true,
        opacity: 0.85,
        shininess: 30,
        side: THREE.DoubleSide  // Ensure visibility from all angles
      });
      const rightAtrium = new THREE.Mesh(rightAtriumGeometry, rightAtriumMaterial);
      rightAtrium.position.set(1.5, 1.8, 0);
      rightAtrium.castShadow = true;
      rightAtrium.receiveShadow = true;
      console.log('✅ Right atrium created');

      // Left Atrium - slightly larger, receives oxygenated blood
      const leftAtriumGeometry = new THREE.SphereGeometry(1.3, 16, 12);
      leftAtriumGeometry.scale(1.0, 0.8, 0.9);
      const leftAtriumMaterial = new THREE.MeshPhongMaterial({
        color: 0xFF6B6B,
        transparent: true,
        opacity: 0.85,
        shininess: 30,
        side: THREE.DoubleSide
      });
      const leftAtrium = new THREE.Mesh(leftAtriumGeometry, leftAtriumMaterial);
      leftAtrium.position.set(-1.5, 1.8, 0);
      leftAtrium.castShadow = true;
      leftAtrium.receiveShadow = true;
      console.log('✅ Left atrium created');

      // Right Ventricle - crescent-shaped, thinner walls
      const rightVentricleGeometry = new THREE.SphereGeometry(1.6, 20, 16);
      rightVentricleGeometry.scale(0.8, 1.2, 1.1);
      const rightVentricleMaterial = new THREE.MeshPhongMaterial({
        color: 0x5B5BAF,
        transparent: true,
        opacity: 0.9,
        shininess: 40,
        side: THREE.DoubleSide
      });
      const rightVentricle = new THREE.Mesh(rightVentricleGeometry, rightVentricleMaterial);
      rightVentricle.position.set(1.2, -0.8, 0.3);
      rightVentricle.castShadow = true;
      rightVentricle.receiveShadow = true;
      console.log('✅ Right ventricle created');

      // Left Ventricle - muscular, main pumping chamber
      const leftVentricleGeometry = new THREE.SphereGeometry(1.8, 24, 18);
      leftVentricleGeometry.scale(1.0, 1.4, 1.0);
      const leftVentricleMaterial = new THREE.MeshPhongMaterial({
        color: 0xFF4444,
        transparent: true,
        opacity: 0.9,
        shininess: 50,
        side: THREE.DoubleSide
      });
      const leftVentricle = new THREE.Mesh(leftVentricleGeometry, leftVentricleMaterial);
      leftVentricle.position.set(-1.0, -0.8, 0);
      leftVentricle.castShadow = true;
      leftVentricle.receiveShadow = true;
      console.log('✅ Left ventricle created');

      const chambers = {
        rightAtrium,
        leftAtrium,
        rightVentricle,
        leftVentricle
      };
      
      console.log('✅ All heart chambers created successfully');
      return chambers;
      
    } catch (error) {
      console.error('❌ Error creating heart chambers:', error);
      
      // Create simple fallback chambers
      const fallbackMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFF4444,
        transparent: true,
        opacity: 0.8,
        wireframe: true
      });
      
      const chamber1 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), fallbackMaterial);
      chamber1.position.set(-1, 1, 0);
      
      const chamber2 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), fallbackMaterial);
      chamber2.position.set(1, 1, 0);
      
      const chamber3 = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), fallbackMaterial);
      chamber3.position.set(-1, -1, 0);
      
      const chamber4 = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), fallbackMaterial);
      chamber4.position.set(1, -1, 0);
      
      console.log('⚠️ Created fallback heart chambers');
      
      return {
        rightAtrium: chamber2,
        leftAtrium: chamber1,
        rightVentricle: chamber4,
        leftVentricle: chamber3
      };
    }
  };

  /**
   * Create major blood vessels
   */
  const createMajorVessels = () => {
    // Aorta - largest artery
    const aortaGeometry = new THREE.CylinderGeometry(0.4, 0.35, 3.5, 12);
    const aortaMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF8080,
      shininess: 60
    });
    const aorta = new THREE.Mesh(aortaGeometry, aortaMaterial);
    aorta.position.set(-0.5, 1.0, -0.5);
    aorta.rotation.z = Math.PI * 0.1;

    // Pulmonary Artery
    const pulmonaryArteryGeometry = new THREE.CylinderGeometry(0.35, 0.3, 2.5, 10);
    const pulmonaryArteryMaterial = new THREE.MeshPhongMaterial({
      color: 0x6B6BFF,
      shininess: 60
    });
    const pulmonaryArtery = new THREE.Mesh(pulmonaryArteryGeometry, pulmonaryArteryMaterial);
    pulmonaryArtery.position.set(0.8, 1.2, -0.3);
    pulmonaryArtery.rotation.z = -Math.PI * 0.05;

    // Superior Vena Cava
    const svcGeometry = new THREE.CylinderGeometry(0.3, 0.25, 2.0, 8);
    const svcMaterial = new THREE.MeshPhongMaterial({
      color: 0x4444AA,
      shininess: 40
    });
    const superiorVenaCava = new THREE.Mesh(svcGeometry, svcMaterial);
    superiorVenaCava.position.set(1.8, 2.5, 0.2);

    // Inferior Vena Cava
    const ivcGeometry = new THREE.CylinderGeometry(0.35, 0.3, 1.5, 8);
    const ivcMaterial = new THREE.MeshPhongMaterial({
      color: 0x3333AA,
      shininess: 40
    });
    const inferiorVenaCava = new THREE.Mesh(ivcGeometry, ivcMaterial);
    inferiorVenaCava.position.set(1.5, -1.8, 0.2);

    // Pulmonary Veins (4 veins returning to left atrium)
    const pulmonaryVeins = [];
    const pvGeometry = new THREE.CylinderGeometry(0.2, 0.15, 1.0, 6);
    const pvMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF6666,
      shininess: 40
    });

    for (let i = 0; i < 4; i++) {
      const vein = new THREE.Mesh(pvGeometry, pvMaterial);
      const angle = (i * Math.PI) / 2;
      vein.position.set(
        -2.5 + Math.cos(angle) * 0.8,
        2.2 + Math.sin(angle) * 0.6,
        -0.8 + (i % 2) * 1.6
      );
      vein.rotation.z = angle;
      pulmonaryVeins.push(vein);
    }

    return {
      aorta,
      pulmonaryArtery,
      superiorVenaCava,
      inferiorVenaCava,
      pulmonaryVeins
    };
  };

  /**
   * Create interventricular septum
   */
  const createInterventricularSeptum = (): THREE.Mesh => {
    const septumGeometry = new THREE.BoxGeometry(0.3, 2.5, 1.8);
    const septumMaterial = new THREE.MeshPhongMaterial({
      color: 0xAA4444,
      transparent: true,
      opacity: 0.7,
      shininess: 30
    });
    const septum = new THREE.Mesh(septumGeometry, septumMaterial);
    septum.position.set(0, -0.5, 0);
    
    return septum;
  };

  /**
   * Create electrical conduction system
   */
  const createConductionSystem = (): THREE.Group => {
    const conductionGroup = new THREE.Group();

    // SA Node (sinoatrial node) - natural pacemaker
    const saNodeGeometry = new THREE.SphereGeometry(0.15, 8, 6);
    const saNodeMaterial = new THREE.MeshPhongMaterial({
      color: 0xFFFF00,
      emissive: 0x222200,
      shininess: 100
    });
    const saNode = new THREE.Mesh(saNodeGeometry, saNodeMaterial);
    saNode.position.set(1.8, 2.2, 0.1); // Upper right atrium

    // AV Node (atrioventricular node)
    const avNodeGeometry = new THREE.SphereGeometry(0.12, 8, 6);
    const avNodeMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF8800,
      emissive: 0x221100,
      shininess: 100
    });
    const avNode = new THREE.Mesh(avNodeGeometry, avNodeMaterial);
    avNode.position.set(0.2, 0.5, 0.1); // Between atria and ventricles

    // Bundle of His
    const bundleOfHisGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6);
    const bundleOfHisMaterial = new THREE.MeshPhongMaterial({
      color: 0x00FF88,
      emissive: 0x002211,
      shininess: 100
    });
    const bundleOfHis = new THREE.Mesh(bundleOfHisGeometry, bundleOfHisMaterial);
    bundleOfHis.position.set(0, -0.2, 0.1);

    // Left Bundle Branch
    const leftBundleGeometry = new THREE.CylinderGeometry(0.04, 0.03, 1.2, 6);
    const leftBundleMaterial = new THREE.MeshPhongMaterial({
      color: 0x00CCFF,
      emissive: 0x001122,
      shininess: 100
    });
    const leftBundle = new THREE.Mesh(leftBundleGeometry, leftBundleMaterial);
    leftBundle.position.set(-0.6, -0.8, 0.1);
    leftBundle.rotation.z = Math.PI * 0.15;

    // Right Bundle Branch
    const rightBundleGeometry = new THREE.CylinderGeometry(0.04, 0.03, 1.0, 6);
    const rightBundleMaterial = new THREE.MeshPhongMaterial({
      color: 0x0088FF,
      emissive: 0x001122,
      shininess: 100
    });
    const rightBundle = new THREE.Mesh(rightBundleGeometry, rightBundleMaterial);
    rightBundle.position.set(0.6, -0.8, 0.1);
    rightBundle.rotation.z = -Math.PI * 0.15;

    // Purkinje Network
    const purkinjeNetwork = createPurkinjeNetwork();

    conductionGroup.add(saNode, avNode, bundleOfHis, leftBundle, rightBundle, purkinjeNetwork);

    conductionSystemRef.current = {
      saNode,
      avNode,
      bundleOfHis,
      leftBundle,
      rightBundle,
      purkinjeNetwork
    };

    return conductionGroup;
  };

  /**
   * Create Purkinje fiber network
   */
  const createPurkinjeNetwork = (): THREE.LineSegments => {
    const points: number[] = [];
    const colors: number[] = [];

    // Create branching network in ventricles
    const createBranchingNetwork = (startPoint: THREE.Vector3, generations: number, spread: number) => {
      if (generations <= 0) return;

      const branchCount = 3 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < branchCount; i++) {
        const angle = (i / branchCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const length = 0.3 + Math.random() * 0.4;
        
        const endPoint = new THREE.Vector3(
          startPoint.x + Math.cos(angle) * length * spread,
          startPoint.y - length,
          startPoint.z + Math.sin(angle) * length * spread * 0.5
        );

        points.push(startPoint.x, startPoint.y, startPoint.z);
        points.push(endPoint.x, endPoint.y, endPoint.z);

        // Color gradient from blue to cyan
        const intensity = (4 - generations) / 4;
        colors.push(0, intensity * 0.5, intensity);
        colors.push(0, intensity * 0.8, intensity);

        // Recurse for smaller branches
        createBranchingNetwork(endPoint, generations - 1, spread * 0.8);
      }
    };

    // Left ventricle network
    createBranchingNetwork(new THREE.Vector3(-0.6, -0.8, 0.1), 4, 1.0);
    
    // Right ventricle network
    createBranchingNetwork(new THREE.Vector3(0.6, -0.8, 0.1), 4, 0.8);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });

    return new THREE.LineSegments(geometry, material);
  };

  /**
   * Create coronary arteries
   */
  const createCoronaryArteries = (): THREE.Group => {
    const coronaryGroup = new THREE.Group();

    // Left Main Coronary Artery
    const leftMainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.8, 1.5, 0.5),
      new THREE.Vector3(-1.2, 1.0, 0.3),
      new THREE.Vector3(-1.0, 0.5, 0.2)
    ]);
    const leftMainGeometry = new THREE.TubeGeometry(leftMainCurve, 20, 0.08, 6, false);
    
    // LAD (Left Anterior Descending)
    const ladCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.0, 0.5, 0.2),
      new THREE.Vector3(-0.8, -0.2, 0.4),
      new THREE.Vector3(-0.6, -1.0, 0.6),
      new THREE.Vector3(-0.4, -1.8, 0.8)
    ]);
    const ladGeometry = new THREE.TubeGeometry(ladCurve, 25, 0.06, 6, false);

    // LCX (Left Circumflex)
    const lcxCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.0, 0.5, 0.2),
      new THREE.Vector3(-1.5, 0.2, -0.2),
      new THREE.Vector3(-1.8, -0.2, -0.5),
      new THREE.Vector3(-1.6, -0.8, -0.8)
    ]);
    const lcxGeometry = new THREE.TubeGeometry(lcxCurve, 25, 0.05, 6, false);

    // RCA (Right Coronary Artery)
    const rcaCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(1.5, 1.2, 0.4),
      new THREE.Vector3(2.0, 0.8, 0.2),
      new THREE.Vector3(1.8, 0.2, -0.2),
      new THREE.Vector3(1.4, -0.5, -0.4),
      new THREE.Vector3(0.8, -1.2, -0.6)
    ]);
    const rcaGeometry = new THREE.TubeGeometry(rcaCurve, 30, 0.06, 6, false);

    // Coronary artery material
    const coronaryMaterial = new THREE.MeshPhongMaterial({
      color: 0xFF4444,
      shininess: 80,
      transparent: true,
      opacity: 0.9
    });

    const leftMainMesh = new THREE.Mesh(leftMainGeometry, coronaryMaterial);
    const ladMesh = new THREE.Mesh(ladGeometry, coronaryMaterial);
    const lcxMesh = new THREE.Mesh(lcxGeometry, coronaryMaterial);
    const rcaMesh = new THREE.Mesh(rcaGeometry, coronaryMaterial);

    coronaryGroup.add(leftMainMesh, ladMesh, lcxMesh, rcaMesh);

    coronaryArteriesRef.current = {
      leftMain: leftMainGeometry,
      lad: ladGeometry,
      lcx: lcxGeometry,
      rca: rcaGeometry,
      meshes: [leftMainMesh, ladMesh, lcxMesh, rcaMesh]
    };

    return coronaryGroup;
  };

  /**
   * Start the main animation loop with EKG synchronization - ALWAYS RENDER
   */
  const startAnimationLoop = () => {
    const animate = () => {
      // ALWAYS RENDER - don't skip frames when paused to ensure visibility
      const currentTime = Date.now();
      const deltaTime = currentTime - (animationState.lastBeatTime || currentTime);

      // Only update animations when playing, but always render
      if (controls.isPlaying) {

        // Update cardiac cycle based on EKG analysis
        updateCardiacCycle(currentTime, deltaTime);

        // Update electrical conduction animation
        updateElectricalConduction(currentTime);

        // Update chamber contractions
        updateChamberContractions(currentTime);

        // Update coronary blood flow
        updateCoronaryFlow(currentTime);

        // Camera controls and rotation
        if (controls.autoRotate) {
          updateCameraRotation(currentTime);
        }
      }

      // Render the scene
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // Update performance metrics
      updatePerformanceMetrics();

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
  };

  /**
   * Update cardiac cycle timing based on real EKG analysis
   */
  const updateCardiacCycle = (currentTime: number, deltaTime: number) => {
    const { beatDuration } = cardiacParameters;
    
    // Calculate current position in cardiac cycle (0-1)
    const cyclePosition = (currentTime % beatDuration) / beatDuration;
    
    setAnimationState(prev => ({
      ...prev,
      currentPhase: cyclePosition,
      heartbeat: Math.sin(cyclePosition * Math.PI * 2),
      lastBeatTime: currentTime
    }));
  };

  /**
   * Update electrical conduction animation with real EKG timing
   */
  const updateElectricalConduction = (currentTime: number) => {
    if (!conductionSystemRef.current) return;

    const { 
      conductionTiming,
      abnormalities 
    } = cardiacParameters;
    
    const cyclePosition = animationState.currentPhase;
    const { saNode, avNode, bundleOfHis, leftBundle, rightBundle, purkinjeNetwork } = conductionSystemRef.current;

    // SA Node activation (starts the cycle)
    if (cyclePosition < 0.1) {
      const intensity = Math.sin(cyclePosition * 10 * Math.PI) * 0.5 + 0.5;
      (saNode.material as THREE.MeshPhongMaterial).emissive.setRGB(
        intensity * 0.8, intensity * 0.8, 0
      );
    } else {
      (saNode.material as THREE.MeshPhongMaterial).emissive.setRGB(0.1, 0.1, 0);
    }

    // AV Node activation (with PR interval delay)
    const avActivationTime = conductionTiming.saToAv / cardiacParameters.beatDuration;
    if (cyclePosition > avActivationTime && cyclePosition < avActivationTime + 0.1) {
      const intensity = Math.sin((cyclePosition - avActivationTime) * 10 * Math.PI) * 0.5 + 0.5;
      (avNode.material as THREE.MeshPhongMaterial).emissive.setRGB(
        intensity * 0.8, intensity * 0.4, 0
      );
    } else {
      (avNode.material as THREE.MeshPhongMaterial).emissive.setRGB(0.1, 0.05, 0);
    }

    // Bundle of His activation
    const hisActivationTime = avActivationTime + (conductionTiming.avToHis / cardiacParameters.beatDuration);
    if (cyclePosition > hisActivationTime && cyclePosition < hisActivationTime + 0.08) {
      const intensity = Math.sin((cyclePosition - hisActivationTime) * 12.5 * Math.PI) * 0.5 + 0.5;
      (bundleOfHis.material as THREE.MeshPhongMaterial).emissive.setRGB(
        0, intensity * 0.8, intensity * 0.4
      );
    } else {
      (bundleOfHis.material as THREE.MeshPhongMaterial).emissive.setRGB(0, 0.1, 0.05);
    }

    // Bundle branches and Purkinje network (ventricular activation)
    const ventricularActivationTime = hisActivationTime + (conductionTiming.hisToPurkinje / cardiacParameters.beatDuration);
    if (cyclePosition > ventricularActivationTime && cyclePosition < ventricularActivationTime + 0.15) {
      const intensity = Math.sin((cyclePosition - ventricularActivationTime) * 6.67 * Math.PI) * 0.5 + 0.5;
      
      (leftBundle.material as THREE.MeshPhongMaterial).emissive.setRGB(
        0, intensity * 0.6, intensity * 0.8
      );
      (rightBundle.material as THREE.MeshPhongMaterial).emissive.setRGB(
        0, intensity * 0.5, intensity * 0.8
      );
      
      // Animate Purkinje network
      (purkinjeNetwork.material as THREE.LineBasicMaterial).opacity = intensity * 0.9;
    } else {
      (leftBundle.material as THREE.MeshPhongMaterial).emissive.setRGB(0, 0.05, 0.1);
      (rightBundle.material as THREE.MeshPhongMaterial).emissive.setRGB(0, 0.05, 0.1);
      (purkinjeNetwork.material as THREE.LineBasicMaterial).opacity = 0.3;
    }
  };

  /**
   * Update chamber contractions based on electrical timing - ENHANCED FOR VISIBILITY
   */
  const updateChamberContractions = (currentTime: number) => {
    if (!heartGeometryRef.current) return;

    const { chamberTiming, abnormalities } = cardiacParameters;
    const cyclePosition = animationState.currentPhase;
    const { rightAtrium, leftAtrium, rightVentricle, leftVentricle } = heartGeometryRef.current;

    // Enhanced base heartbeat animation - always visible
    const baseHeartbeat = Math.sin(cyclePosition * Math.PI * 2) * 0.1 + 1;
    
    // Atrial systole (P-wave related) - MORE PRONOUNCED
    const atrialContractionStart = 0.05;
    const atrialContractionDuration = 0.15; // Fixed duration for visibility
    
    if (cyclePosition > atrialContractionStart && cyclePosition < atrialContractionStart + atrialContractionDuration) {
      const contractionPhase = (cyclePosition - atrialContractionStart) / atrialContractionDuration;
      const contractionAmount = Math.sin(contractionPhase * Math.PI) * 0.25 + baseHeartbeat; // More pronounced
      
      if (rightAtrium && rightAtrium.scale) {
        rightAtrium.scale.setScalar(contractionAmount);
      }
      if (leftAtrium && leftAtrium.scale) {
        leftAtrium.scale.setScalar(contractionAmount);
      }
    } else {
      if (rightAtrium && rightAtrium.scale) {
        rightAtrium.scale.setScalar(baseHeartbeat);
      }
      if (leftAtrium && leftAtrium.scale) {
        leftAtrium.scale.setScalar(baseHeartbeat);
      }
    }

    // Ventricular systole (QRS-wave related) - MORE PRONOUNCED
    const ventricularContractionStart = atrialContractionStart + atrialContractionDuration + 0.08;
    const ventricularContractionDuration = 0.25; // Fixed duration for visibility
    
    if (cyclePosition > ventricularContractionStart && cyclePosition < ventricularContractionStart + ventricularContractionDuration) {
      const contractionPhase = (cyclePosition - ventricularContractionStart) / ventricularContractionDuration;
      const contractionAmount = baseHeartbeat - Math.sin(contractionPhase * Math.PI) * 0.3; // More pronounced contraction
      
      if (rightVentricle && rightVentricle.scale) {
        rightVentricle.scale.setScalar(Math.max(0.6, contractionAmount)); // Minimum scale for visibility
      }
      if (leftVentricle && leftVentricle.scale) {
        leftVentricle.scale.setScalar(Math.max(0.6, contractionAmount)); // Minimum scale for visibility
      }
    } else {
      if (rightVentricle && rightVentricle.scale) {
        rightVentricle.scale.setScalar(baseHeartbeat);
      }
      if (leftVentricle && leftVentricle.scale) {
        leftVentricle.scale.setScalar(baseHeartbeat);
      }
    }

    // Apply rhythm-specific abnormalities
    applyRhythmAbnormalities(abnormalities, cyclePosition);
  };

  /**
   * Apply rhythm-specific animation abnormalities
   */
  const applyRhythmAbnormalities = (abnormalities: string[], cyclePosition: number) => {
    if (!heartGeometryRef.current) return;

    const { rightAtrium, leftAtrium, rightVentricle, leftVentricle } = heartGeometryRef.current;

    abnormalities.forEach(abnormality => {
      switch (abnormality) {
        case 'chaotic_atrial_activity':
          // Irregular, chaotic atrial movement for AFib
          const randomScale = 0.95 + Math.random() * 0.1;
          rightAtrium.scale.setScalar(randomScale);
          leftAtrium.scale.setScalar(0.95 + Math.random() * 0.1);
          break;
          
        case 'irregular_ventricular_response':
          // Irregular ventricular contractions
          if (Math.random() < 0.3) { // Skip some beats
            rightVentricle.scale.setScalar(1);
            leftVentricle.scale.setScalar(1);
          }
          break;
          
        case 'rapid_ventricular_rate':
          // Faster, less effective contractions
          const rapidRate = Math.sin(cyclePosition * Math.PI * 3) * 0.1 + 0.9;
          rightVentricle.scale.setScalar(rapidRate);
          leftVentricle.scale.setScalar(rapidRate);
          break;
          
        case 'av_conduction_delay':
          // Delayed ventricular response
          // This would be handled in the electrical conduction timing
          break;
      }
    });
  };

  /**
   * Update coronary blood flow visualization
   */
  const updateCoronaryFlow = (currentTime: number) => {
    if (!coronaryArteriesRef.current) return;

    const cyclePosition = animationState.currentPhase;
    const { meshes } = coronaryArteriesRef.current;

    // Blood flow pulsates with heartbeat
    const flowIntensity = Math.sin(cyclePosition * Math.PI * 2) * 0.3 + 0.7;
    
    meshes.forEach(mesh => {
      (mesh.material as THREE.MeshPhongMaterial).opacity = flowIntensity;
      (mesh.material as THREE.MeshPhongMaterial).emissive.setRGB(
        flowIntensity * 0.2, 0, 0
      );
    });
  };

  /**
   * Update camera rotation for auto-rotate mode
   */
  const updateCameraRotation = (currentTime: number) => {
    if (!cameraRef.current || !heartGroupRef.current) return;

    const rotationSpeed = 0.0005;
    heartGroupRef.current.rotation.y = currentTime * rotationSpeed;
  };

  /**
   * Update performance metrics
   */
  const updatePerformanceMetrics = () => {
    // This would be implemented with proper WebGL performance monitoring
    setPerformance(prev => ({
      ...prev,
      fps: Math.round(1000 / 16.67), // Approximate FPS
      drawCalls: rendererRef.current?.info.render.calls || 0,
      triangles: rendererRef.current?.info.render.triangles || 0
    }));
  };

  /**
   * Control handlers
   */
  const togglePlayPause = () => {
    const newPlaying = !controls.isPlaying;
    setControls(prev => ({ ...prev, isPlaying: newPlaying }));
    
    if (onVisualizationStateChange) {
      onVisualizationStateChange({ isPlaying: newPlaying });
    }
  };

  const handleSpeedChange = (speed: number) => {
    const clampedSpeed = Math.max(0.1, Math.min(5.0, speed));
    setControls(prev => ({ ...prev, animationSpeed: clampedSpeed }));
  };

  const handleViewpointChange = (viewpoint: string) => {
    if (!cameraRef.current) return;
    
    setControls(prev => ({ ...prev, currentViewpoint: viewpoint }));
    
    // Set camera position based on viewpoint
    switch (viewpoint) {
      case 'Anterior View':
        cameraRef.current.position.set(0, 0, 15);
        cameraRef.current.lookAt(0, 0, 0);
        break;
      case 'Left Lateral':
        cameraRef.current.position.set(-15, 0, 0);
        cameraRef.current.lookAt(0, 0, 0);
        break;
      case 'Right Lateral':
        cameraRef.current.position.set(15, 0, 0);
        cameraRef.current.lookAt(0, 0, 0);
        break;
      case 'Superior View':
        cameraRef.current.position.set(0, 15, 0);
        cameraRef.current.lookAt(0, 0, 0);
        break;
      case 'Electrical System':
        cameraRef.current.position.set(5, 5, 10);
        cameraRef.current.lookAt(0, 0, 0);
        break;
    }
  };

  const toggleLabels = () => {
    setControls(prev => ({ ...prev, labelsVisible: !prev.labelsVisible }));
  };

  const toggleConduction = () => {
    setControls(prev => ({ ...prev, conductionVisible: !prev.conductionVisible }));
    
    // Show/hide conduction system
    if (conductionSystemRef.current) {
      Object.values(conductionSystemRef.current).forEach(element => {
        element.visible = !controls.conductionVisible;
      });
    }
  };

  const toggleCoronaryArteries = () => {
    setControls(prev => ({ ...prev, coronaryVisible: !prev.coronaryVisible }));
    
    // Show/hide coronary arteries
    if (coronaryArteriesRef.current) {
      coronaryArteriesRef.current.meshes.forEach(mesh => {
        mesh.visible = !controls.coronaryVisible;
      });
    }
  };

  const toggleCutawayMode = () => {
    setControls(prev => ({ ...prev, cutawayMode: !prev.cutawayMode }));
    
    // Implement cutaway view
    if (heartGeometryRef.current) {
      const opacity = controls.cutawayMode ? 1.0 : 0.6;
      Object.values(heartGeometryRef.current).forEach(chamber => {
        if (chamber instanceof THREE.Mesh) {
          (chamber.material as THREE.MeshPhongMaterial).transparent = !controls.cutawayMode;
          (chamber.material as THREE.MeshPhongMaterial).opacity = opacity;
        }
      });
    }
  };

  const handleReset = () => {
    setControls(prev => ({
      ...prev,
      animationSpeed: 1.0,
      isPlaying: false,
      currentViewpoint: 'Anterior View'
    }));
    
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 15);
      cameraRef.current.lookAt(0, 0, 0);
    }
    
    setAnimationState(prev => ({
      ...prev,
      currentPhase: 0,
      heartbeat: 0,
      lastBeatTime: 0
    }));
  };

  // Initialize scene on mount
  useEffect(() => {
    const cleanup = initializeScene();
    return cleanup;
  }, []);

  // Update animation speed
  useEffect(() => {
    // Animation speed is handled in the animation loop
  }, [controls.animationSpeed]);

  return (
    <div className="h-full bg-gradient-to-br from-slate-900/50 to-blue-900/30 rounded-lg border border-slate-700/50 overflow-hidden">
      {/* 3D Canvas Container */}
      <div className="relative h-[70%]">
        <div
          ref={mountRef}
          className="w-full h-full cursor-pointer"
        />
        
        {/* Overlay Controls */}
        <div className="absolute top-4 right-4 flex flex-col space-y-2">
          {/* Medical Status Indicator */}
          {medicalData && (
            <div className={`px-3 py-2 rounded-lg text-sm font-medium ${
              medicalData.clinical_significance === 'normal' ? 'bg-green-900/80 text-green-300 border border-green-500/30' :
              medicalData.clinical_significance === 'monitor' ? 'bg-yellow-900/80 text-yellow-300 border border-yellow-500/30' :
              medicalData.clinical_significance === 'urgent' ? 'bg-orange-900/80 text-orange-300 border border-orange-500/30' :
              'bg-red-900/80 text-red-300 border border-red-500/30'
            }`}>
              <div className="flex items-center space-x-2">
                <Zap className="w-4 h-4" />
                <span>{medicalData.rhythm_classification.replace('_', ' ').toUpperCase()}</span>
              </div>
              <div className="text-xs opacity-80">{medicalData.heart_rate} BPM</div>
              {medicalData.timing_measurements && (
                <div className="text-xs space-y-1 mt-2">
                  <div>PR: {medicalData.timing_measurements.pr_interval}ms</div>
                  <div>QRS: {medicalData.timing_measurements.qrs_duration}ms</div>
                </div>
              )}
            </div>
          )}
          
          {/* Performance Monitor */}
          <div className="bg-slate-800/80 backdrop-blur-sm text-slate-300 px-3 py-2 rounded-lg text-xs">
            <div>{performance.fps} FPS</div>
            <div>{performance.drawCalls} calls</div>
            <div>{performance.triangles} triangles</div>
          </div>
        </div>
        
        {/* Educational Annotations */}
        {medicalData && controls.labelsVisible && (
          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 max-w-sm">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Real-time Cardiac Analysis</h4>
            <p className="text-xs text-slate-300 mb-3">{medicalData.pathophysiology}</p>
            
            {medicalData.clinical_context.symptoms_likely.length > 0 && (
              <div className="text-xs">
                <div className="text-yellow-400 font-medium">Clinical Signs:</div>
                <ul className="text-slate-400 mt-1 space-y-1">
                  {medicalData.clinical_context.symptoms_likely.slice(0, 3).map((symptom, idx) => (
                    <li key={idx}>• {symptom}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Animation timing info */}
            <div className="mt-3 pt-2 border-t border-slate-700/50 text-xs">
              <div className="text-purple-400 font-medium">Cycle Timing:</div>
              <div className="text-slate-400">
                Phase: {Math.round(animationState.currentPhase * 100)}%
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Advanced Control Panel */}
      <div className="h-[30%] border-t border-slate-700/50 bg-slate-900/50 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-full">
          
          {/* Playback Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-blue-400 flex items-center space-x-2">
              <Play className="w-4 h-4" />
              <span>Playback</span>
            </h4>
            
            <div className="flex items-center space-x-2">
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
                title="Reset"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Speed</span>
                <span>{controls.animationSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3.0"
                step="0.1"
                value={controls.animationSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          </div>
          
          {/* View Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-purple-400 flex items-center space-x-2">
              <Camera className="w-4 h-4" />
              <span>Views</span>
            </h4>
            
            <select
              value={controls.currentViewpoint}
              onChange={(e) => handleViewpointChange(e.target.value)}
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="Anterior View">Anterior View</option>
              <option value="Left Lateral">Left Lateral</option>
              <option value="Right Lateral">Right Lateral</option>
              <option value="Superior View">Superior View</option>
              <option value="Electrical System">Electrical System</option>
            </select>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setControls(prev => ({ ...prev, autoRotate: !prev.autoRotate }))}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  controls.autoRotate ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <RotateCcw className="w-3 h-3" />
                <span>Auto</span>
              </button>
              
              <button
                onClick={toggleCutawayMode}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  controls.cutawayMode ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Cut</span>
              </button>
            </div>
          </div>
          
          {/* Anatomical Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-green-400 flex items-center space-x-2">
              <Target className="w-4 h-4" />
              <span>Anatomy</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleLabels}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  controls.labelsVisible ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {controls.labelsVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>Labels</span>
              </button>
              
              <button
                onClick={toggleConduction}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  controls.conductionVisible ? 'bg-yellow-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Conduction</span>
              </button>
              
              <button
                onClick={toggleCoronaryArteries}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  controls.coronaryVisible ? 'bg-red-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <HeartIcon className="w-3 h-3" />
                <span>Coronary</span>
              </button>
              
              <button
                className="flex items-center space-x-1 px-2 py-1 rounded text-xs bg-slate-700 text-slate-300"
                title="Coming soon"
              >
                <Timer className="w-3 h-3" />
                <span>Sync</span>
              </button>
            </div>
          </div>
          
          {/* Advanced Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-orange-400 flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Advanced</span>
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setControls(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }))}
                className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
                  controls.audioEnabled ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {controls.audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                <span>Audio</span>
              </button>
              
              <button
                className="flex items-center space-x-1 px-2 py-1 rounded text-xs bg-slate-700 text-slate-300"
                title="Export view"
              >
                <Maximize className="w-3 h-3" />
                <span>Export</span>
              </button>
            </div>
            
            <select
              value={controls.quality}
              onChange={(e) => setControls(prev => ({ ...prev, quality: e.target.value as any }))}
              className="w-full bg-slate-700 rounded-lg px-2 py-1 text-xs text-white"
            >
              <option value="low">Low Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="high">High Quality</option>
              <option value="ultra">Ultra Quality</option>
            </select>
            
            {/* Real-time metrics */}
            <div className="text-xs text-slate-500">
              <div>Cardiac Phase: {Math.round(animationState.currentPhase * 100)}%</div>
              <div>Beat Rate: {cardiacParameters.heartRate} BPM</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Advanced3DHeartVisualization;