/**
 * 3D Heart Visualization Engine
 * Main engine that coordinates 3D rendering, animation, and medical synchronization
 */

import * as THREE from 'three';
import { AnatomicalHeartModel, HeartGeometryConfig } from './heart-model';
import { HeartVisualization, MedicalAnalysis, AppContext } from '@ekg-sim/medical-types';

export interface VisualizationConfig {
  /** Canvas element for rendering */
  canvas: HTMLCanvasElement;
  /** Rendering quality settings */
  quality: 'low' | 'medium' | 'high' | 'ultra';
  /** Target frame rate */
  targetFPS: number;
  /** Enable VR/AR support */
  vrSupport?: boolean;
  /** Enable performance monitoring */
  performanceMonitoring?: boolean;
}

export interface CameraViewpoint {
  name: string;
  position: THREE.Vector3;
  target: THREE.Vector3;
  description: string;
}

export class HeartVisualizationEngine {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: any; // OrbitControls
  private heartModel: AnatomicalHeartModel;
  private clock: THREE.Clock;
  
  private animationFrame: number = 0;
  private isPlaying: boolean = false;
  private animationSpeed: number = 1.0;
  
  // Performance monitoring
  private stats: any; // Stats.js
  private frameCount: number = 0;
  private lastFPSCheck: number = 0;
  private currentFPS: number = 60;
  
  // Educational features
  private annotations: THREE.Group;
  private educationalOverlays: Map<string, THREE.Object3D>;
  private viewpoints: CameraViewpoint[];
  private currentViewpoint: number = 0;
  
  // Medical synchronization
  private medicalContext: MedicalAnalysis | null = null;
  private visualConfig: HeartVisualization | null = null;
  
  constructor(config: VisualizationConfig) {
    this.initializeRenderer(config);
    this.initializeScene();
    this.initializeCamera(config.canvas);
    this.initializeControls();
    this.initializeHeartModel();
    this.initializeEducationalFeatures();
    
    if (config.performanceMonitoring) {
      this.initializePerformanceMonitoring();
    }
    
    this.setupEventListeners();
    this.clock = new THREE.Clock();
  }
  
  /**
   * Initialize WebGL renderer with medical visualization settings
   */
  private initializeRenderer(config: VisualizationConfig): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: config.quality === 'high' || config.quality === 'ultra',
      alpha: true,
      precision: 'highp',
      powerPreference: 'high-performance'
    });
    
    this.renderer.setSize(config.canvas.clientWidth, config.canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Enable shadows for better depth perception
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Set output color space for medical accuracy
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    
    // Tone mapping for realistic lighting
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Enable depth testing and proper transparency
    this.renderer.sortObjects = true;
  }
  
  /**
   * Initialize 3D scene with medical lighting
   */
  private initializeScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111111); // Dark medical background
    
    // Add fog for depth perception
    this.scene.fog = new THREE.Fog(0x111111, 15, 50);
    
    // Medical examination lighting setup
    this.setupMedicalLighting();
  }
  
  /**
   * Setup lighting optimized for medical visualization
   */
  private setupMedicalLighting(): void {
    // Key light - primary illumination
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.0);
    keyLight.position.set(10, 10, 10);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    this.scene.add(keyLight);
    
    // Fill light - soften shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-5, 5, 5);
    this.scene.add(fillLight);
    
    // Rim light - enhance edges and depth
    const rimLight = new THREE.DirectionalLight(0x4488ff, 0.3);
    rimLight.position.set(0, -10, -10);
    this.scene.add(rimLight);
    
    // Ambient light - general illumination
    const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
    this.scene.add(ambientLight);
    
    // Medical examination spotlight
    const examLight = new THREE.SpotLight(0xffffff, 0.8);
    examLight.position.set(0, 15, 0);
    examLight.angle = Math.PI / 4;
    examLight.penumbra = 0.1;
    examLight.decay = 2;
    examLight.distance = 30;
    examLight.castShadow = true;
    this.scene.add(examLight);
  }
  
  /**
   * Initialize camera with medical examination perspective
   */
  private initializeCamera(canvas: HTMLCanvasElement): void {
    const aspect = canvas.clientWidth / canvas.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    
    // Position camera for optimal medical viewing
    this.camera.position.set(0, 5, 15);
    this.camera.lookAt(0, 0, 0);
    
    // Setup predefined medical viewpoints
    this.viewpoints = [
      {
        name: 'Anterior View',
        position: new THREE.Vector3(0, 2, 12),
        target: new THREE.Vector3(0, 0, 0),
        description: 'Standard frontal view showing both ventricles'
      },
      {
        name: 'Left Lateral',
        position: new THREE.Vector3(-12, 2, 3),
        target: new THREE.Vector3(0, 0, 0),
        description: 'Left side view emphasizing left heart structures'
      },
      {
        name: 'Right Lateral',
        position: new THREE.Vector3(12, 2, 3),
        target: new THREE.Vector3(0, 0, 0),
        description: 'Right side view emphasizing right heart structures'
      },
      {
        name: 'Superior View',
        position: new THREE.Vector3(0, 15, 0),
        target: new THREE.Vector3(0, 0, 0),
        description: 'Top-down view showing atrial activity'
      },
      {
        name: 'Electrical System',
        position: new THREE.Vector3(8, 8, 8),
        target: new THREE.Vector3(0, 0, 0),
        description: 'Optimal angle for conduction system visualization'
      }
    ];
  }
  
  /**
   * Initialize camera controls
   */
  private initializeControls(): void {
    // Note: In production, import OrbitControls
    // import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
    // this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    
    // Simulated controls configuration
    // this.controls.enableDamping = true;
    // this.controls.dampingFactor = 0.05;
    // this.controls.enableZoom = true;
    // this.controls.enablePan = true;
    // this.controls.enableRotate = true;
    // this.controls.maxPolarAngle = Math.PI;
    // this.controls.minDistance = 5;
    // this.controls.maxDistance = 50;
  }
  
  /**
   * Initialize anatomical heart model
   */
  private initializeHeartModel(): void {
    const heartConfig: HeartGeometryConfig = {
      scale: 1.0,
      detail: 'high',
      showConductionSystem: true,
      enableWallMotion: true
    };
    
    this.heartModel = new AnatomicalHeartModel(this.scene, heartConfig);
  }
  
  /**
   * Initialize educational features
   */
  private initializeEducationalFeatures(): void {
    this.annotations = new THREE.Group();
    this.annotations.name = 'annotations';
    this.scene.add(this.annotations);
    
    this.educationalOverlays = new Map();
    
    this.createAnatomicalLabels();
    this.createTimingIndicators();
  }
  
  /**
   * Create anatomical labels for educational purposes
   */
  private createAnatomicalLabels(): void {
    const labelData = [
      { name: 'SA Node', position: new THREE.Vector3(2.5, 4.2, 0.2), color: 0xFFFF00 },
      { name: 'AV Node', position: new THREE.Vector3(0.2, 1.2, -0.3), color: 0xFF8800 },
      { name: 'Left Ventricle', position: new THREE.Vector3(-2.5, -2, 0), color: 0xFF4444 },
      { name: 'Right Ventricle', position: new THREE.Vector3(2.5, -2, 0.5), color: 0x5B5BAF },
      { name: 'Left Atrium', position: new THREE.Vector3(-2.5, 3, 0), color: 0xFF6B6B },
      { name: 'Right Atrium', position: new THREE.Vector3(2.5, 3, 0), color: 0x8B4B8B }
    ];
    
    labelData.forEach(label => {
      const labelGroup = this.createTextLabel(label.name, label.position, label.color);
      labelGroup.name = `label_${label.name.toLowerCase().replace(' ', '_')}`;
      labelGroup.visible = false; // Hidden by default
      this.educationalOverlays.set(label.name, labelGroup);
      this.annotations.add(labelGroup);
    });
  }
  
  /**
   * Create 3D text labels
   */
  private createTextLabel(text: string, position: THREE.Vector3, color: number): THREE.Group {
    const labelGroup = new THREE.Group();
    
    // Create label background
    const backgroundGeometry = new THREE.PlaneGeometry(2, 0.5);
    const backgroundMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.7
    });
    const background = new THREE.Mesh(backgroundGeometry, backgroundMaterial);
    
    // Create connection line
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1, 0)
    ]);
    const lineMaterial = new THREE.LineBasicMaterial({ color: color });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    
    labelGroup.add(background, line);
    labelGroup.position.copy(position);
    
    // Make label always face camera
    labelGroup.lookAt(this.camera.position);
    
    return labelGroup;
  }
  
  /**
   * Create timing indicators for educational synchronization
   */
  private createTimingIndicators(): void {
    // EKG wave overlay (will be synchronized with heart animation)
    const waveGeometry = new THREE.PlaneGeometry(10, 2);
    const waveMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const waveOverlay = new THREE.Mesh(waveGeometry, waveMaterial);
    waveOverlay.position.set(0, -8, 0);
    waveOverlay.name = 'ekg_overlay';
    waveOverlay.visible = false;
    
    this.educationalOverlays.set('EKG_Overlay', waveOverlay);
    this.scene.add(waveOverlay);
  }
  
  /**
   * Initialize performance monitoring
   */
  private initializePerformanceMonitoring(): void {
    // Note: In production, import Stats.js
    // import Stats from 'stats.js';
    // this.stats = new Stats();
    // document.body.appendChild(this.stats.dom);
  }
  
  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize.bind(this));
    
    // Keyboard controls for medical examination
    document.addEventListener('keydown', (event) => {
      switch (event.code) {
        case 'Space':
          event.preventDefault();
          this.togglePlayPause();
          break;
        case 'ArrowLeft':
          this.changeAnimationSpeed(-0.1);
          break;
        case 'ArrowRight':
          this.changeAnimationSpeed(0.1);
          break;
        case 'KeyV':
          this.cycleViewpoint();
          break;
        case 'KeyL':
          this.toggleLabels();
          break;
        case 'KeyE':
          this.toggleEKGOverlay();
          break;
      }
    });
  }
  
  /**
   * Handle window resize
   */
  private onWindowResize(): void {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    this.renderer.setSize(width, height);
  }
  
  /**
   * Synchronize visualization with medical analysis data
   */
  public synchronizeWithMedicalData(medicalData: MedicalAnalysis, visualConfig: HeartVisualization): void {
    this.medicalContext = medicalData;
    this.visualConfig = visualConfig;
    
    // Update heart model with medical timing
    this.heartModel.synchronizeToEKG(medicalData.conduction_timing);
    
    // Update animation speed
    this.setAnimationSpeed(visualConfig.animation_timing.speed_multiplier);
    
    // Configure camera viewpoints based on medical findings
    this.configureMedicalViewpoints(medicalData);
    
    // Update educational annotations
    this.updateEducationalContent(medicalData);
    
    console.log(`Heart visualization synchronized to ${medicalData.rhythm_classification} rhythm`);
  }
  
  /**
   * Configure camera viewpoints based on medical findings
   */
  private configureMedicalViewpoints(medicalData: MedicalAnalysis): void {
    // Adjust viewpoints based on rhythm type
    switch (medicalData.rhythm_classification) {
      case 'atrial_fibrillation':
        // Focus on atrial activity
        this.setViewpoint('Superior View');
        break;
      case 'ventricular_tachycardia':
        // Focus on ventricular activity  
        this.setViewpoint('Anterior View');
        break;
      case 'heart_block':
        // Focus on conduction system
        this.setViewpoint('Electrical System');
        break;
      default:
        this.setViewpoint('Anterior View');
    }
  }
  
  /**
   * Update educational content based on medical analysis
   */
  private updateEducationalContent(medicalData: MedicalAnalysis): void {
    // Highlight relevant anatomical structures
    this.clearHighlights();
    
    switch (medicalData.rhythm_classification) {
      case 'normal_sinus':
        this.heartModel.highlightRegion('sa_node', true);
        break;
      case 'atrial_fibrillation':
        this.heartModel.highlightRegion('left_atrium', true);
        this.heartModel.highlightRegion('right_atrium', true);
        break;
      case 'ventricular_tachycardia':
        this.heartModel.highlightRegion('left_ventricle', true);
        this.heartModel.highlightRegion('right_ventricle', true);
        break;
      case 'heart_block':
        this.heartModel.highlightRegion('av_node', true);
        break;
    }
  }
  
  /**
   * Main render loop
   */
  public render(): void {
    if (!this.isPlaying) return;
    
    const deltaTime = this.clock.getDelta();
    
    // Update performance monitoring
    if (this.stats) {
      this.stats.begin();
    }
    
    // Update camera controls
    if (this.controls) {
      this.controls.update();
    }
    
    // Update heart animations
    this.heartModel.updateAnimations(deltaTime * this.animationSpeed);
    
    // Update educational overlays
    this.updateEducationalOverlays(deltaTime);
    
    // Render scene
    this.renderer.render(this.scene, this.camera);
    
    // Performance monitoring
    if (this.stats) {
      this.stats.end();
    }
    
    this.updateFPS();
    
    this.animationFrame = requestAnimationFrame(() => this.render());
  }
  
  /**
   * Update educational overlays
   */
  private updateEducationalOverlays(deltaTime: number): void {
    // Make labels always face camera
    this.educationalOverlays.forEach((overlay) => {
      if (overlay.name.startsWith('label_')) {
        overlay.lookAt(this.camera.position);
      }
    });
  }
  
  /**
   * Update FPS counter
   */
  private updateFPS(): void {
    this.frameCount++;
    const now = performance.now();
    
    if (now - this.lastFPSCheck >= 1000) {
      this.currentFPS = this.frameCount;
      this.frameCount = 0;
      this.lastFPSCheck = now;
    }
  }
  
  /**
   * Toggle play/pause
   */
  public togglePlayPause(): void {
    this.isPlaying = !this.isPlaying;
    
    if (this.isPlaying) {
      this.render();
    } else {
      cancelAnimationFrame(this.animationFrame);
    }
  }
  
  /**
   * Start visualization
   */
  public play(): void {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.render();
    }
  }
  
  /**
   * Pause visualization
   */
  public pause(): void {
    this.isPlaying = false;
    cancelAnimationFrame(this.animationFrame);
  }
  
  /**
   * Set animation speed
   */
  public setAnimationSpeed(speed: number): void {
    this.animationSpeed = Math.max(0.1, Math.min(5.0, speed));
    this.heartModel.setAnimationSpeed(this.animationSpeed);
  }
  
  /**
   * Change animation speed incrementally
   */
  private changeAnimationSpeed(delta: number): void {
    this.setAnimationSpeed(this.animationSpeed + delta);
  }
  
  /**
   * Cycle through predefined viewpoints
   */
  public cycleViewpoint(): void {
    this.currentViewpoint = (this.currentViewpoint + 1) % this.viewpoints.length;
    const viewpoint = this.viewpoints[this.currentViewpoint];
    this.setViewpoint(viewpoint.name);
  }
  
  /**
   * Set camera to specific viewpoint
   */
  public setViewpoint(viewpointName: string): void {
    const viewpoint = this.viewpoints.find(v => v.name === viewpointName);
    if (!viewpoint) return;
    
    // Smooth camera transition (in production, use tweening library)
    this.camera.position.copy(viewpoint.position);
    this.camera.lookAt(viewpoint.target);
    
    if (this.controls) {
      this.controls.target.copy(viewpoint.target);
      this.controls.update();
    }
    
    console.log(`Switched to ${viewpoint.name}: ${viewpoint.description}`);
  }
  
  /**
   * Toggle anatomical labels visibility
   */
  public toggleLabels(): void {
    const labelsVisible = this.annotations.visible;
    this.annotations.visible = !labelsVisible;
    
    this.educationalOverlays.forEach((overlay, name) => {
      if (name.startsWith('label_')) {
        overlay.visible = !labelsVisible;
      }
    });
  }
  
  /**
   * Toggle EKG overlay visibility
   */
  public toggleEKGOverlay(): void {
    const ekgOverlay = this.educationalOverlays.get('EKG_Overlay');
    if (ekgOverlay) {
      ekgOverlay.visible = !ekgOverlay.visible;
    }
  }
  
  /**
   * Clear all highlights
   */
  private clearHighlights(): void {
    // Clear anatomical highlights
    const regions = ['sa_node', 'av_node', 'left_atrium', 'right_atrium', 
                    'left_ventricle', 'right_ventricle'];
    
    regions.forEach(region => {
      this.heartModel.highlightRegion(region, false);
    });
  }
  
  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): {fps: number, drawCalls: number, triangles: number} {
    return {
      fps: this.currentFPS,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles
    };
  }
  
  /**
   * Get available viewpoints
   */
  public getViewpoints(): CameraViewpoint[] {
    return [...this.viewpoints];
  }
  
  /**
   * Get current visualization state
   */
  public getVisualizationState(): {
    isPlaying: boolean;
    animationSpeed: number;
    currentViewpoint: string;
    labelsVisible: boolean;
  } {
    return {
      isPlaying: this.isPlaying,
      animationSpeed: this.animationSpeed,
      currentViewpoint: this.viewpoints[this.currentViewpoint]?.name || 'Unknown',
      labelsVisible: this.annotations.visible
    };
  }
  
  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.pause();
    
    // Dispose heart model
    this.heartModel.dispose();
    
    // Dispose educational overlays
    this.educationalOverlays.forEach(overlay => {
      overlay.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    });
    
    // Dispose renderer
    this.renderer.dispose();
    
    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
    
    // Remove stats
    if (this.stats && this.stats.dom) {
      document.body.removeChild(this.stats.dom);
    }
  }
}