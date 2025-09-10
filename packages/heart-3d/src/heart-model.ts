/**
 * Anatomically Accurate 3D Heart Model
 * Creates a medically precise heart geometry for EKG visualization
 */

import * as THREE from 'three';
import { HeartVisualization, ConductionTiming } from '@ekg-sim/medical-types';

export interface HeartGeometryConfig {
  /** Scale factor for the heart model */
  scale: number;
  /** Level of anatomical detail */
  detail: 'low' | 'medium' | 'high' | 'ultra';
  /** Enable electrical conduction system visibility */
  showConductionSystem: boolean;
  /** Enable chamber wall motion */
  enableWallMotion: boolean;
}

export class AnatomicalHeartModel {
  private scene: THREE.Scene;
  private heartGroup: THREE.Group;
  private chambers: {
    rightAtrium: THREE.Mesh;
    leftAtrium: THREE.Mesh;
    rightVentricle: THREE.Mesh;
    leftVentricle: THREE.Mesh;
  };
  private conductionSystem: {
    saNode: THREE.Mesh;
    avNode: THREE.Mesh;
    hisBundle: THREE.Mesh;
    leftBundle: THREE.Mesh;
    rightBundle: THREE.Mesh;
    purkinjeNetwork: THREE.LineSegments;
  };
  private electricalAnimation: THREE.AnimationMixer;
  private mechanicalAnimation: THREE.AnimationMixer;
  
  constructor(scene: THREE.Scene, config: HeartGeometryConfig) {
    this.scene = scene;
    this.heartGroup = new THREE.Group();
    this.scene.add(this.heartGroup);
    
    this.createHeartGeometry(config);
    this.createConductionSystem(config);
    this.setupMaterials();
    this.setupAnimations();
  }
  
  /**
   * Create anatomically accurate heart chamber geometry
   */
  private createHeartGeometry(config: HeartGeometryConfig): void {
    // Right Atrium - receiving chamber for deoxygenated blood
    const raGeometry = this.createAtriumGeometry('right');
    const raMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x8B4B8B, // Darker purple for venous blood
      transparent: true,
      opacity: 0.8 
    });
    this.chambers.rightAtrium = new THREE.Mesh(raGeometry, raMaterial);
    this.chambers.rightAtrium.position.set(2, 3, 0);
    this.chambers.rightAtrium.name = 'right_atrium';
    
    // Left Atrium - receiving chamber for oxygenated blood
    const laGeometry = this.createAtriumGeometry('left');
    const laMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xFF6B6B, // Brighter red for arterial blood
      transparent: true,
      opacity: 0.8 
    });
    this.chambers.leftAtrium = new THREE.Mesh(laGeometry, laMaterial);
    this.chambers.leftAtrium.position.set(-2, 3, 0);
    this.chambers.leftAtrium.name = 'left_atrium';
    
    // Right Ventricle - pumps to pulmonary circulation
    const rvGeometry = this.createVentricleGeometry('right');
    const rvMaterial = new THREE.MeshLambertMaterial({ 
      color: 0x5B5BAF, // Blue-purple for pulmonary circulation
      transparent: true,
      opacity: 0.9 
    });
    this.chambers.rightVentricle = new THREE.Mesh(rvGeometry, rvMaterial);
    this.chambers.rightVentricle.position.set(2, -2, 0.5);
    this.chambers.rightVentricle.name = 'right_ventricle';
    
    // Left Ventricle - main pumping chamber (systemic circulation)
    const lvGeometry = this.createVentricleGeometry('left');
    const lvMaterial = new THREE.MeshLambertMaterial({ 
      color: 0xFF4444, // Bright red for systemic circulation
      transparent: true,
      opacity: 0.9 
    });
    this.chambers.leftVentricle = new THREE.Mesh(lvGeometry, lvMaterial);
    this.chambers.leftVentricle.position.set(-2, -2, 0);
    this.chambers.leftVentricle.name = 'left_ventricle';
    
    // Add all chambers to heart group
    this.heartGroup.add(
      this.chambers.rightAtrium,
      this.chambers.leftAtrium,
      this.chambers.rightVentricle,
      this.chambers.leftVentricle
    );
    
    // Scale entire heart model
    this.heartGroup.scale.multiplyScalar(config.scale);
  }
  
  /**
   * Create atrium geometry (upper chambers)
   */
  private createAtriumGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
    // Simplified atrium as modified sphere
    const geometry = new THREE.SphereGeometry(1.2, 16, 12, 0, Math.PI);
    
    // Modify vertices for atrial shape
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      
      // Create atrial appendage shape
      if (side === 'right') {
        positions[i] *= 1.1; // Slightly wider
        positions[i + 1] *= 0.8; // Flattened
      } else {
        positions[i] *= 0.9; // More compact left atrium
        positions[i + 1] *= 0.9;
      }
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    return geometry;
  }
  
  /**
   * Create ventricle geometry (lower chambers)
   */
  private createVentricleGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
    // Start with ellipsoid for ventricular shape
    const geometry = new THREE.SphereGeometry(1.5, 20, 16, 0, Math.PI * 2, 0, Math.PI);
    
    const positions = geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1]; 
      const z = positions[i + 2];
      
      // Create ventricular shape
      if (side === 'left') {
        // Left ventricle - thicker walls, more muscular
        positions[i] *= 1.2;
        positions[i + 1] *= 1.8; // Elongated
        positions[i + 2] *= 1.0;
      } else {
        // Right ventricle - thinner walls, crescent shape
        positions[i] *= 1.4;
        positions[i + 1] *= 1.5;
        positions[i + 2] *= 0.7; // Flattened anterior-posterior
      }
    }
    
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    
    return geometry;
  }
  
  /**
   * Create electrical conduction system components
   */
  private createConductionSystem(config: HeartGeometryConfig): void {
    if (!config.showConductionSystem) return;
    
    // SA Node - primary pacemaker
    const saGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const saMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 }); // Bright yellow
    this.conductionSystem.saNode = new THREE.Mesh(saGeometry, saMaterial);
    this.conductionSystem.saNode.position.set(2.5, 4, 0.2);
    this.conductionSystem.saNode.name = 'sa_node';
    
    // AV Node - secondary pacemaker and gatekeeper
    const avGeometry = new THREE.SphereGeometry(0.08, 8, 8);
    const avMaterial = new THREE.MeshBasicMaterial({ color: 0xFF8800 }); // Orange
    this.conductionSystem.avNode = new THREE.Mesh(avGeometry, avMaterial);
    this.conductionSystem.avNode.position.set(0.2, 1, -0.3);
    this.conductionSystem.avNode.name = 'av_node';
    
    // His Bundle - main conduction trunk
    const hisGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8);
    const hisMaterial = new THREE.MeshBasicMaterial({ color: 0x00FF88 }); // Green
    this.conductionSystem.hisBundle = new THREE.Mesh(hisGeometry, hisMaterial);
    this.conductionSystem.hisBundle.position.set(0, 0, 0);
    this.conductionSystem.hisBundle.name = 'his_bundle';
    
    // Left Bundle Branch
    const leftBundleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6);
    const leftBundleMaterial = new THREE.MeshBasicMaterial({ color: 0x0088FF }); // Blue
    this.conductionSystem.leftBundle = new THREE.Mesh(leftBundleGeometry, leftBundleMaterial);
    this.conductionSystem.leftBundle.position.set(-1.5, -1, 0);
    this.conductionSystem.leftBundle.rotation.z = Math.PI / 6;
    this.conductionSystem.leftBundle.name = 'left_bundle';
    
    // Right Bundle Branch
    const rightBundleGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6);
    const rightBundleMaterial = new THREE.MeshBasicMaterial({ color: 0x8800FF }); // Purple
    this.conductionSystem.rightBundle = new THREE.Mesh(rightBundleGeometry, rightBundleMaterial);
    this.conductionSystem.rightBundle.position.set(1.5, -1, 0.2);
    this.conductionSystem.rightBundle.rotation.z = -Math.PI / 6;
    this.conductionSystem.rightBundle.name = 'right_bundle';
    
    // Purkinje Network - terminal conduction fibers
    this.createPurkinjeNetwork();
    
    // Add all conduction system components
    this.heartGroup.add(
      this.conductionSystem.saNode,
      this.conductionSystem.avNode,
      this.conductionSystem.hisBundle,
      this.conductionSystem.leftBundle,
      this.conductionSystem.rightBundle,
      this.conductionSystem.purkinjeNetwork
    );
  }
  
  /**
   * Create Purkinje fiber network
   */
  private createPurkinjeNetwork(): void {
    const points = [];
    const colors = [];
    
    // Create branching network in left ventricle
    const leftPurkinje = this.generatePurkinjePoints(-1.5, -2, 0, 'left');
    points.push(...leftPurkinje.points);
    colors.push(...leftPurkinje.colors);
    
    // Create branching network in right ventricle  
    const rightPurkinje = this.generatePurkinjePoints(1.5, -2, 0.2, 'right');
    points.push(...rightPurkinje.points);
    colors.push(...rightPurkinje.colors);
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.LineBasicMaterial({ 
      vertexColors: true,
      transparent: true,
      opacity: 0.8
    });
    
    this.conductionSystem.purkinjeNetwork = new THREE.LineSegments(geometry, material);
    this.conductionSystem.purkinjeNetwork.name = 'purkinje_network';
  }
  
  /**
   * Generate Purkinje fiber branching points
   */
  private generatePurkinjePoints(centerX: number, centerY: number, centerZ: number, 
                                side: 'left' | 'right'): {points: THREE.Vector3[], colors: number[]} {
    const points = [];
    const colors = [];
    const baseColor = side === 'left' ? [0, 1, 0.8] : [0.8, 0, 1]; // Cyan for left, magenta for right
    
    // Create branching pattern
    const mainBranches = 6;
    for (let i = 0; i < mainBranches; i++) {
      const angle = (i / mainBranches) * Math.PI * 2;
      const radius = 0.8;
      
      const branchStart = new THREE.Vector3(centerX, centerY, centerZ);
      const branchEnd = new THREE.Vector3(
        centerX + Math.cos(angle) * radius,
        centerY + Math.sin(angle) * radius * 0.5,
        centerZ + (Math.random() - 0.5) * 0.3
      );
      
      points.push(branchStart, branchEnd);
      colors.push(...baseColor, ...baseColor);
      
      // Add sub-branches
      const subBranches = 3;
      for (let j = 0; j < subBranches; j++) {
        const subAngle = angle + (j - 1) * 0.3;
        const subRadius = 0.4;
        
        const subEnd = new THREE.Vector3(
          branchEnd.x + Math.cos(subAngle) * subRadius,
          branchEnd.y + Math.sin(subAngle) * subRadius * 0.3,
          branchEnd.z + (Math.random() - 0.5) * 0.2
        );
        
        points.push(branchEnd.clone(), subEnd);
        colors.push(...baseColor, ...baseColor);
      }
    }
    
    return { points, colors };
  }
  
  /**
   * Setup materials with medical accuracy considerations
   */
  private setupMaterials(): void {
    // Add realistic lighting for medical visualization
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
    
    // Add rim lighting for better depth perception
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3);
    rimLight.position.set(-10, -10, -5);
    this.scene.add(rimLight);
  }
  
  /**
   * Setup animations for electrical and mechanical activity
   */
  private setupAnimations(): void {
    this.electricalAnimation = new THREE.AnimationMixer(this.heartGroup);
    this.mechanicalAnimation = new THREE.AnimationMixer(this.heartGroup);
    
    // These will be configured based on medical data
  }
  
  /**
   * Synchronize heart animation to EKG timing
   */
  public synchronizeToEKG(medicalData: ConductionTiming): void {
    const cycleDuration = medicalData.cardiac_cycle_ms / 1000; // Convert to seconds
    
    this.createElectricalActivationSequence(medicalData, cycleDuration);
    this.createMechanicalContractionSequence(medicalData, cycleDuration);
  }
  
  /**
   * Create electrical activation animation sequence
   */
  private createElectricalActivationSequence(timing: ConductionTiming, cycleDuration: number): void {
    const tracks = [];
    
    // SA Node activation
    const saActivationTrack = new THREE.ColorKeyframeTrack(
      'sa_node.material.color',
      [0, timing.sa_to_av_delay / 1000, cycleDuration],
      [1, 1, 0, 2, 2, 0, 1, 1, 0] // Bright yellow flash
    );
    tracks.push(saActivationTrack);
    
    // AV Node activation  
    const avDelay = timing.sa_to_av_delay / 1000;
    const avActivationTrack = new THREE.ColorKeyframeTrack(
      'av_node.material.color',
      [avDelay, avDelay + timing.av_to_his_delay / 1000, cycleDuration],
      [1, 0.5, 0, 2, 1, 0, 1, 0.5, 0] // Orange flash
    );
    tracks.push(avActivationTrack);
    
    // Ventricular activation
    const ventricularDelay = avDelay + timing.av_to_his_delay / 1000;
    const lvActivationTrack = new THREE.ColorKeyframeTrack(
      'left_ventricle.material.emissive',
      [ventricularDelay, ventricularDelay + timing.his_to_purkinje_delay / 1000, cycleDuration],
      [0, 0, 0, 0.3, 0, 0, 0, 0, 0] // Red glow during depolarization
    );
    tracks.push(lvActivationTrack);
    
    const rvActivationTrack = new THREE.ColorKeyframeTrack(
      'right_ventricle.material.emissive',
      [ventricularDelay, ventricularDelay + timing.his_to_purkinje_delay / 1000, cycleDuration],
      [0, 0, 0, 0, 0, 0.3, 0, 0, 0] // Blue glow during depolarization
    );
    tracks.push(rvActivationTrack);
    
    const electricalClip = new THREE.AnimationClip('electrical_activation', cycleDuration, tracks);
    const electricalAction = this.electricalAnimation.clipAction(electricalClip);
    electricalAction.setLoop(THREE.LoopRepeat, Infinity);
    electricalAction.play();
  }
  
  /**
   * Create mechanical contraction animation sequence
   */
  private createMechanicalContractionSequence(timing: ConductionTiming, cycleDuration: number): void {
    const tracks = [];
    
    // Atrial contraction (follows P wave)
    const atrialContractionStart = 0.05; // Slight delay after electrical activation
    const atrialContractionDuration = 0.1; // ~100ms contraction
    
    // Left atrium contraction
    const laScaleTrack = new THREE.VectorKeyframeTrack(
      'left_atrium.scale',
      [atrialContractionStart, atrialContractionStart + atrialContractionDuration, cycleDuration],
      [1, 1, 1, 0.8, 0.8, 0.8, 1, 1, 1] // Contract then relax
    );
    tracks.push(laScaleTrack);
    
    // Right atrium contraction
    const raScaleTrack = new THREE.VectorKeyframeTrack(
      'right_atrium.scale',
      [atrialContractionStart, atrialContractionStart + atrialContractionDuration, cycleDuration],
      [1, 1, 1, 0.8, 0.8, 0.8, 1, 1, 1]
    );
    tracks.push(raScaleTrack);
    
    // Ventricular contraction (follows QRS complex)
    const ventricularContractionStart = (timing.sa_to_av_delay + timing.av_to_his_delay) / 1000;
    const ventricularContractionDuration = 0.3; // ~300ms systole
    
    // Left ventricle contraction (more powerful)
    const lvScaleTrack = new THREE.VectorKeyframeTrack(
      'left_ventricle.scale',
      [ventricularContractionStart, ventricularContractionStart + ventricularContractionDuration, cycleDuration],
      [1, 1, 1, 0.6, 0.6, 0.7, 1, 1, 1] // Strong contraction
    );
    tracks.push(lvScaleTrack);
    
    // Right ventricle contraction  
    const rvScaleTrack = new THREE.VectorKeyframeTrack(
      'right_ventricle.scale',
      [ventricularContractionStart, ventricularContractionStart + ventricularContractionDuration, cycleDuration],
      [1, 1, 1, 0.7, 0.7, 0.8, 1, 1, 1] // Moderate contraction
    );
    tracks.push(rvScaleTrack);
    
    const mechanicalClip = new THREE.AnimationClip('mechanical_contraction', cycleDuration, tracks);
    const mechanicalAction = this.mechanicalAnimation.clipAction(mechanicalClip);
    mechanicalAction.setLoop(THREE.LoopRepeat, Infinity);
    mechanicalAction.play();
  }
  
  /**
   * Update animations based on current time
   */
  public updateAnimations(deltaTime: number): void {
    this.electricalAnimation.update(deltaTime);
    this.mechanicalAnimation.update(deltaTime);
  }
  
  /**
   * Set animation speed multiplier
   */
  public setAnimationSpeed(speedMultiplier: number): void {
    this.electricalAnimation.timeScale = speedMultiplier;
    this.mechanicalAnimation.timeScale = speedMultiplier;
  }
  
  /**
   * Highlight specific anatomical regions
   */
  public highlightRegion(regionName: string, highlight: boolean): void {
    const region = this.heartGroup.getObjectByName(regionName);
    if (region && region instanceof THREE.Mesh) {
      if (highlight) {
        region.material.emissive.setHex(0x444444);
        region.material.emissiveIntensity = 0.3;
      } else {
        region.material.emissive.setHex(0x000000);
        region.material.emissiveIntensity = 0;
      }
    }
  }
  
  /**
   * Get heart model for external manipulation
   */
  public getHeartGroup(): THREE.Group {
    return this.heartGroup;
  }
  
  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.electricalAnimation.stopAllAction();
    this.mechanicalAnimation.stopAllAction();
    
    // Dispose geometries and materials
    this.heartGroup.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    
    this.scene.remove(this.heartGroup);
  }
}