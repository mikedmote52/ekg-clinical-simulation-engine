/**
 * Interactive Cardiac Conduction System Visualizer
 * 
 * Creates medically accurate, interactive visualization of the cardiac
 * electrical conduction system with real-time EKG correlation
 */

import * as THREE from 'three';
import { ElectrophysiologyState, ElectricalWave, ConductionRegion } from '../../ekg-processor/src/ElectrophysiologyMapper';

export interface ConductionPathway {
  pathwayId: string;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  intermediatePoints: THREE.Vector3[];
  pathwayType: 'atrial' | 'av_nodal' | 'his_purkinje' | 'ventricular';
  conductionVelocity: number;
  isActive: boolean;
  activationProgress: number; // 0-1
  visualElements: THREE.Group;
}

export interface ConductionNode {
  nodeId: string;
  position: THREE.Vector3;
  nodeType: 'SA' | 'AV' | 'HIS' | 'BUNDLE' | 'PURKINJE';
  isActive: boolean;
  activationIntensity: number; // 0-1
  visualMesh: THREE.Mesh;
  electricalField: THREE.Group;
  connections: string[];
}

export interface ElectricalFieldVisualization {
  fieldId: string;
  centerPoint: THREE.Vector3;
  fieldRadius: number;
  intensity: number;
  fieldType: 'depolarization' | 'repolarization';
  particleSystem: THREE.Points;
  fieldLines: THREE.Group;
}

export interface InteractiveElement {
  elementId: string;
  mesh: THREE.Mesh;
  tooltip: HTMLElement;
  medicalInfo: {
    name: string;
    function: string;
    normalTiming: string;
    clinicalSignificance: string;
  };
  isSelected: boolean;
  highlightMaterial: THREE.Material;
}

export class ConductionSystemVisualizer {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private conductionGroup: THREE.Group;
  
  // Conduction system components
  private conductionNodes: Map<string, ConductionNode>;
  private conductionPathways: Map<string, ConductionPathway>;
  private electricalFields: Map<string, ElectricalFieldVisualization>;
  private interactiveElements: Map<string, InteractiveElement>;
  
  // Animation and timing
  private animationClock: THREE.Clock;
  private currentElectrophysiologyState: ElectrophysiologyState | null = null;
  
  // Educational features
  private labelsVisible: boolean = true;
  private pathwaysVisible: boolean = true;
  private electricalFieldsVisible: boolean = true;
  private timingMarkersVisible: boolean = true;
  
  // Medical accuracy settings
  private medicalAccuracyMode: boolean = true;
  private educationalSimplification: boolean = false;
  
  // Interaction handling
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private selectedElement: string | null = null;

  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    this.conductionGroup = new THREE.Group();
    this.conductionNodes = new Map();
    this.conductionPathways = new Map();
    this.electricalFields = new Map();
    this.interactiveElements = new Map();
    
    this.animationClock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.initializeConductionSystem();
    this.setupInteractivity();
    
    scene.add(this.conductionGroup);
  }

  /**
   * Initialize the complete cardiac conduction system
   */
  private initializeConductionSystem(): void {
    this.createSinusNode();
    this.createAtrialPathways();
    this.createAVNode();
    this.createBundleOfHis();
    this.createBundleBranches();
    this.createPurkinjeNetwork();
    this.createElectricalFieldVisualizations();
    this.createEducationalLabels();
  }

  private createSinusNode(): void {
    const position = new THREE.Vector3(25, 15, -10);
    
    // Create SA node geometry with medical accuracy
    const geometry = new THREE.SphereGeometry(3, 16, 12);
    const material = new THREE.MeshPhongMaterial({
      color: 0xffdd00,
      emissive: 0x333300,
      transparent: true,
      opacity: 0.9
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    
    // Add pulsing animation for pacemaker activity
    const pulseGeometry = new THREE.SphereGeometry(4, 16, 12);
    const pulseMaterial = new THREE.MeshPhongMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.3
    });
    const pulseMesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulseMesh.position.copy(position);
    
    const nodeGroup = new THREE.Group();
    nodeGroup.add(mesh);
    nodeGroup.add(pulseMesh);
    
    // Create electrical field visualization
    const electricalField = this.createElectricalField(position, 8, 'depolarization');
    
    const conductionNode: ConductionNode = {
      nodeId: 'SA_NODE',
      position,
      nodeType: 'SA',
      isActive: false,
      activationIntensity: 0,
      visualMesh: mesh,
      electricalField,
      connections: ['ATRIAL_PATHWAYS']
    };
    
    this.conductionNodes.set('SA_NODE', conductionNode);
    
    // Add to interactive elements
    this.createInteractiveElement('SA_NODE', mesh, {
      name: 'Sinoatrial (SA) Node',
      function: 'Primary pacemaker of the heart, initiates each heartbeat',
      normalTiming: 'Fires 60-100 times per minute at rest',
      clinicalSignificance: 'SA node dysfunction can cause bradycardia or sinus arrest'
    });
    
    this.conductionGroup.add(nodeGroup);
  }

  private createAtrialPathways(): void {
    const saPosition = new THREE.Vector3(25, 15, -10);
    const avPosition = new THREE.Vector3(0, -5, -8);
    
    // Create three internodal pathways
    const pathways = [
      {
        name: 'ANTERIOR_INTERNODAL',
        points: [
          saPosition,
          new THREE.Vector3(15, 10, -5),
          new THREE.Vector3(5, 2, -6),
          avPosition
        ],
        color: 0x00ff88
      },
      {
        name: 'MIDDLE_INTERNODAL',
        points: [
          saPosition,
          new THREE.Vector3(20, 5, -8),
          new THREE.Vector3(10, -2, -8),
          avPosition
        ],
        color: 0x00dd88
      },
      {
        name: 'POSTERIOR_INTERNODAL',
        points: [
          saPosition,
          new THREE.Vector3(18, 8, -12),
          new THREE.Vector3(8, 0, -10),
          avPosition
        ],
        color: 0x00bb88
      }
    ];
    
    pathways.forEach(pathway => {
      const conductionPathway = this.createConductionPathway(
        pathway.name,
        pathway.points,
        'atrial',
        0.3, // Atrial conduction velocity
        pathway.color
      );
      
      this.conductionPathways.set(pathway.name, conductionPathway);
      this.conductionGroup.add(conductionPathway.visualElements);
    });
  }

  private createAVNode(): void {
    const position = new THREE.Vector3(0, -5, -8);
    
    const geometry = new THREE.SphereGeometry(2.5, 12, 8);
    const material = new THREE.MeshPhongMaterial({
      color: 0xff8800,
      emissive: 0x442200
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    
    // Create delay visualization (hourglass effect)
    const delayVisualization = this.createDelayVisualization(position);
    
    const nodeGroup = new THREE.Group();
    nodeGroup.add(mesh);
    nodeGroup.add(delayVisualization);
    
    const electricalField = this.createElectricalField(position, 6, 'depolarization');
    
    const conductionNode: ConductionNode = {
      nodeId: 'AV_NODE',
      position,
      nodeType: 'AV',
      isActive: false,
      activationIntensity: 0,
      visualMesh: mesh,
      electricalField,
      connections: ['HIS_BUNDLE']
    };
    
    this.conductionNodes.set('AV_NODE', conductionNode);
    
    this.createInteractiveElement('AV_NODE', mesh, {
      name: 'Atrioventricular (AV) Node',
      function: 'Delays electrical impulse to allow atrial emptying before ventricular contraction',
      normalTiming: 'Normal delay: 100-200ms (PR interval)',
      clinicalSignificance: 'AV blocks occur when conduction through this node is impaired'
    });
    
    this.conductionGroup.add(nodeGroup);
  }

  private createBundleOfHis(): void {
    const startPosition = new THREE.Vector3(0, -5, -8);
    const endPosition = new THREE.Vector3(0, -15, 0);
    
    // Create cylinder geometry for His bundle
    const geometry = new THREE.CylinderGeometry(0.8, 0.8, 10);
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff88,
      emissive: 0x002244
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, -10, -4);
    mesh.lookAt(endPosition);
    
    const electricalField = this.createElectricalField(mesh.position, 4, 'depolarization');
    
    const conductionNode: ConductionNode = {
      nodeId: 'HIS_BUNDLE',
      position: mesh.position.clone(),
      nodeType: 'HIS',
      isActive: false,
      activationIntensity: 0,
      visualMesh: mesh,
      electricalField,
      connections: ['LEFT_BUNDLE', 'RIGHT_BUNDLE']
    };
    
    this.conductionNodes.set('HIS_BUNDLE', conductionNode);
    
    this.createInteractiveElement('HIS_BUNDLE', mesh, {
      name: 'Bundle of His',
      function: 'Rapidly conducts impulses from AV node to bundle branches',
      normalTiming: 'Conducts at 2-4 m/s, fastest in the heart',
      clinicalSignificance: 'His bundle blocks are rare but can cause complete heart block'
    });
    
    this.conductionGroup.add(mesh);
  }

  private createBundleBranches(): void {
    // Left Bundle Branch
    const leftBundlePoints = [
      new THREE.Vector3(0, -15, 0),
      new THREE.Vector3(-8, -20, 2),
      new THREE.Vector3(-15, -25, 5),
      new THREE.Vector3(-20, -30, 8)
    ];
    
    const leftBundlePathway = this.createConductionPathway(
      'LEFT_BUNDLE',
      leftBundlePoints,
      'his_purkinje',
      2.5,
      0x00ff88
    );
    
    this.conductionPathways.set('LEFT_BUNDLE', leftBundlePathway);
    this.conductionGroup.add(leftBundlePathway.visualElements);
    
    // Create fascicles of left bundle
    this.createLeftBundleFascicles();
    
    // Right Bundle Branch
    const rightBundlePoints = [
      new THREE.Vector3(0, -15, 0),
      new THREE.Vector3(8, -20, -2),
      new THREE.Vector3(15, -25, -5),
      new THREE.Vector3(20, -30, -8)
    ];
    
    const rightBundlePathway = this.createConductionPathway(
      'RIGHT_BUNDLE',
      rightBundlePoints,
      'his_purkinje',
      2.5,
      0x00ff88
    );
    
    this.conductionPathways.set('RIGHT_BUNDLE', rightBundlePathway);
    this.conductionGroup.add(rightBundlePathway.visualElements);
  }

  private createLeftBundleFascicles(): void {
    // Anterior fascicle
    const anteriorFasciclePoints = [
      new THREE.Vector3(-8, -20, 2),
      new THREE.Vector3(-12, -25, 8),
      new THREE.Vector3(-18, -30, 12)
    ];
    
    const anteriorFascicle = this.createConductionPathway(
      'ANTERIOR_FASCICLE',
      anteriorFasciclePoints,
      'his_purkinje',
      2.5,
      0x00dd88
    );
    
    this.conductionPathways.set('ANTERIOR_FASCICLE', anteriorFascicle);
    this.conductionGroup.add(anteriorFascicle.visualElements);
    
    // Posterior fascicle
    const posteriorFasciclePoints = [
      new THREE.Vector3(-8, -20, 2),
      new THREE.Vector3(-12, -28, -2),
      new THREE.Vector3(-18, -35, -8)
    ];
    
    const posteriorFascicle = this.createConductionPathway(
      'POSTERIOR_FASCICLE',
      posteriorFasciclePoints,
      'his_purkinje',
      2.5,
      0x00bb88
    );
    
    this.conductionPathways.set('POSTERIOR_FASCICLE', posteriorFascicle);
    this.conductionGroup.add(posteriorFascicle.visualElements);
  }

  private createPurkinjeNetwork(): void {
    // Create extensive Purkinje fiber network
    this.createVentricularPurkinjeNetwork('LEFT');
    this.createVentricularPurkinjeNetwork('RIGHT');
  }

  private createVentricularPurkinjeNetwork(ventricle: 'LEFT' | 'RIGHT'): void {
    const isLeft = ventricle === 'LEFT';
    const baseX = isLeft ? -20 : 20;
    const baseY = -30;
    const baseZ = isLeft ? 8 : -8;
    
    // Create main Purkinje trunk
    const trunkStart = new THREE.Vector3(baseX * 0.7, baseY + 5, baseZ * 0.7);
    const trunkEnd = new THREE.Vector3(baseX, baseY - 10, baseZ);
    
    const mainTrunk = this.createConductionPathway(
      `${ventricle}_PURKINJE_TRUNK`,
      [trunkStart, trunkEnd],
      'his_purkinje',
      2.5,
      0x00ffaa
    );
    
    this.conductionPathways.set(`${ventricle}_PURKINJE_TRUNK`, mainTrunk);
    this.conductionGroup.add(mainTrunk.visualElements);
    
    // Create branching network
    const numBranches = 8;
    for (let i = 0; i < numBranches; i++) {
      const angle = (i / numBranches) * Math.PI * 2;
      const branchLength = 8 + Math.random() * 6;
      
      const branchEnd = new THREE.Vector3(
        trunkEnd.x + Math.cos(angle) * branchLength,
        trunkEnd.y + Math.sin(angle) * branchLength * 0.5,
        trunkEnd.z + Math.sin(angle * 1.5) * branchLength * 0.3
      );
      
      const branch = this.createConductionPathway(
        `${ventricle}_PURKINJE_BRANCH_${i}`,
        [trunkEnd, branchEnd],
        'his_purkinje',
        2.0,
        0x00ffaa
      );
      
      this.conductionPathways.set(`${ventricle}_PURKINJE_BRANCH_${i}`, branch);
      this.conductionGroup.add(branch.visualElements);
      
      // Create sub-branches
      this.createPurkinjeSubBranches(branchEnd, `${ventricle}_${i}`, 3);
    }
  }

  private createPurkinjeSubBranches(startPoint: THREE.Vector3, branchId: string, numSubBranches: number): void {
    for (let i = 0; i < numSubBranches; i++) {
      const angle = Math.random() * Math.PI * 2;
      const length = 3 + Math.random() * 4;
      
      const endPoint = new THREE.Vector3(
        startPoint.x + Math.cos(angle) * length,
        startPoint.y + Math.sin(angle) * length,
        startPoint.z + (Math.random() - 0.5) * length
      );
      
      const subBranch = this.createConductionPathway(
        `PURKINJE_SUB_${branchId}_${i}`,
        [startPoint, endPoint],
        'his_purkinje',
        1.5,
        0x88ffaa
      );
      
      this.conductionPathways.set(`PURKINJE_SUB_${branchId}_${i}`, subBranch);
      this.conductionGroup.add(subBranch.visualElements);
    }
  }

  /**
   * Create a conduction pathway with proper visualization
   */
  private createConductionPathway(
    pathwayId: string,
    points: THREE.Vector3[],
    pathwayType: ConductionPathway['pathwayType'],
    conductionVelocity: number,
    color: number
  ): ConductionPathway {
    const visualElements = new THREE.Group();
    
    // Create pathway geometry
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeometry = new THREE.TubeGeometry(curve, 32, 0.5, 8, false);
    
    const material = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.8
    });
    
    const mesh = new THREE.Mesh(tubeGeometry, material);
    visualElements.add(mesh);
    
    // Add flow animation elements
    const flowVisualization = this.createFlowVisualization(curve, color);
    visualElements.add(flowVisualization);
    
    return {
      pathwayId,
      startPoint: points[0],
      endPoint: points[points.length - 1],
      intermediatePoints: points.slice(1, -1),
      pathwayType,
      conductionVelocity,
      isActive: false,
      activationProgress: 0,
      visualElements
    };
  }

  private createFlowVisualization(curve: THREE.CatmullRomCurve3, color: number): THREE.Group {
    const flowGroup = new THREE.Group();
    
    // Create moving particles along the pathway
    const numParticles = 10;
    const particleGeometry = new THREE.SphereGeometry(0.2, 8, 6);
    const particleMaterial = new THREE.MeshPhongMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3
    });
    
    for (let i = 0; i < numParticles; i++) {
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      const t = i / numParticles;
      const position = curve.getPoint(t);
      particle.position.copy(position);
      particle.userData = { t, curve };
      
      flowGroup.add(particle);
    }
    
    return flowGroup;
  }

  private createElectricalField(
    center: THREE.Vector3,
    radius: number,
    fieldType: 'depolarization' | 'repolarization'
  ): THREE.Group {
    const fieldGroup = new THREE.Group();
    
    // Create field lines
    const numLines = 12;
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2;
      const lineGeometry = new THREE.BufferGeometry();
      
      const points = [];
      for (let r = 2; r <= radius; r += 1) {
        points.push(new THREE.Vector3(
          center.x + Math.cos(angle) * r,
          center.y + Math.sin(angle) * r,
          center.z
        ));
      }
      
      lineGeometry.setFromPoints(points);
      
      const lineMaterial = new THREE.LineBasicMaterial({
        color: fieldType === 'depolarization' ? 0xffff00 : 0x0088ff,
        transparent: true,
        opacity: 0.3
      });
      
      const line = new THREE.Line(lineGeometry, lineMaterial);
      fieldGroup.add(line);
    }
    
    // Create particle system for field visualization
    const particleSystem = this.createElectricalParticleSystem(center, radius, fieldType);
    fieldGroup.add(particleSystem);
    
    return fieldGroup;
  }

  private createElectricalParticleSystem(
    center: THREE.Vector3,
    radius: number,
    fieldType: 'depolarization' | 'repolarization'
  ): THREE.Points {
    const numParticles = 50;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(numParticles * 3);
    
    for (let i = 0; i < numParticles; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      
      positions[i * 3] = center.x + Math.cos(angle) * r;
      positions[i * 3 + 1] = center.y + Math.sin(angle) * r;
      positions[i * 3 + 2] = center.z + (Math.random() - 0.5) * radius * 0.3;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: fieldType === 'depolarization' ? 0xffff00 : 0x0088ff,
      size: 0.5,
      transparent: true,
      opacity: 0.6
    });
    
    return new THREE.Points(geometry, material);
  }

  private createDelayVisualization(position: THREE.Vector3): THREE.Group {
    const delayGroup = new THREE.Group();
    
    // Create hourglass-like visualization for AV node delay
    const hourglassGeometry = new THREE.ConeGeometry(2, 4, 8);
    const hourglassMaterial = new THREE.MeshPhongMaterial({
      color: 0xff8800,
      transparent: true,
      opacity: 0.3,
      wireframe: true
    });
    
    const topCone = new THREE.Mesh(hourglassGeometry, hourglassMaterial);
    topCone.position.copy(position);
    topCone.position.y += 2;
    
    const bottomCone = new THREE.Mesh(hourglassGeometry, hourglassMaterial);
    bottomCone.position.copy(position);
    bottomCone.position.y -= 2;
    bottomCone.rotation.z = Math.PI;
    
    delayGroup.add(topCone);
    delayGroup.add(bottomCone);
    
    return delayGroup;
  }

  private createElectricalFieldVisualizations(): void {
    // Create field visualizations for major conduction regions
    const fieldRegions = [
      { center: new THREE.Vector3(25, 15, -10), radius: 12, type: 'depolarization' },
      { center: new THREE.Vector3(0, -5, -8), radius: 8, type: 'depolarization' },
      { center: new THREE.Vector3(0, -25, 0), radius: 20, type: 'depolarization' }
    ];
    
    fieldRegions.forEach((region, index) => {
      const field = this.createElectricalField(
        region.center,
        region.radius,
        region.type as 'depolarization' | 'repolarization'
      );
      
      const fieldViz: ElectricalFieldVisualization = {
        fieldId: `FIELD_${index}`,
        centerPoint: region.center,
        fieldRadius: region.radius,
        intensity: 0,
        fieldType: region.type as 'depolarization' | 'repolarization',
        particleSystem: field.children.find(child => child instanceof THREE.Points) as THREE.Points,
        fieldLines: field
      };
      
      this.electricalFields.set(fieldViz.fieldId, fieldViz);
      this.conductionGroup.add(field);
    });
  }

  private createEducationalLabels(): void {
    // Create 3D text labels for educational purposes
    // Implementation would create text geometries with medical information
  }

  private createInteractiveElement(
    elementId: string,
    mesh: THREE.Mesh,
    medicalInfo: InteractiveElement['medicalInfo']
  ): void {
    // Create highlight material
    const highlightMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      emissive: 0x004400,
      transparent: true,
      opacity: 0.9
    });
    
    // Create tooltip (would be implemented with HTML overlay)
    const tooltip = document.createElement('div');
    tooltip.className = 'conduction-tooltip';
    tooltip.style.display = 'none';
    
    const interactiveElement: InteractiveElement = {
      elementId,
      mesh,
      tooltip,
      medicalInfo,
      isSelected: false,
      highlightMaterial
    };
    
    this.interactiveElements.set(elementId, interactiveElement);
  }

  /**
   * Update visualization based on electrophysiology state
   */
  public updateVisualization(electrophysiologyState: ElectrophysiologyState): void {
    this.currentElectrophysiologyState = electrophysiologyState;
    
    // Update conduction nodes
    this.updateConductionNodes(electrophysiologyState);
    
    // Update pathway activations
    this.updatePathwayActivations(electrophysiologyState);
    
    // Update electrical fields
    this.updateElectricalFields(electrophysiologyState);
    
    // Update wave visualizations
    this.updateElectricalWaves(electrophysiologyState.electricalWaves);
  }

  private updateConductionNodes(state: ElectrophysiologyState): void {
    // Reset all nodes
    this.conductionNodes.forEach(node => {
      node.isActive = false;
      node.activationIntensity = 0;
    });
    
    // Activate nodes based on current state
    state.activeRegions.forEach(region => {
      const node = this.conductionNodes.get(region.regionId);
      if (node) {
        node.isActive = !region.isBlocked;
        node.activationIntensity = region.isBlocked ? 0 : 1;
        
        // Update visual appearance
        this.updateNodeVisuals(node, region);
      }
    });
  }

  private updateNodeVisuals(node: ConductionNode, region: ConductionRegion): void {
    const material = node.visualMesh.material as THREE.MeshPhongMaterial;
    
    if (node.isActive) {
      material.emissiveIntensity = 0.3 + (node.activationIntensity * 0.4);
      material.opacity = 0.9;
    } else {
      material.emissiveIntensity = 0.1;
      material.opacity = 0.5;
    }
    
    // Show block visualization if blocked
    if (region.isBlocked) {
      material.color.setHex(0xff0000); // Red for blocked
      material.emissive.setHex(0x440000);
    } else {
      // Restore original color based on node type
      const originalColors = {
        'SA': 0xffdd00,
        'AV': 0xff8800,
        'HIS': 0x00ff88,
        'BUNDLE': 0x00ff88,
        'PURKINJE': 0x00ffaa
      };
      
      material.color.setHex(originalColors[node.nodeType]);
    }
  }

  private updatePathwayActivations(state: ElectrophysiologyState): void {
    this.conductionPathways.forEach(pathway => {
      pathway.isActive = false;
      pathway.activationProgress = 0;
    });
    
    // Calculate pathway activations based on electrical waves
    state.electricalWaves.forEach(wave => {
      wave.propagationPath.forEach(pathwayId => {
        const pathway = this.conductionPathways.get(pathwayId);
        if (pathway) {
          pathway.isActive = true;
          pathway.activationProgress = this.calculatePathwayProgress(pathway, wave);
          this.animatePathwayFlow(pathway);
        }
      });
    });
  }

  private calculatePathwayProgress(pathway: ConductionPathway, wave: ElectricalWave): number {
    // Calculate progress based on wave position along pathway
    // Simplified calculation - would use proper curve mathematics in production
    return Math.min(1, wave.amplitude);
  }

  private animatePathwayFlow(pathway: ConductionPathway): void {
    // Animate particle flow along pathway
    const flowGroup = pathway.visualElements.children.find(child => 
      child instanceof THREE.Group
    ) as THREE.Group;
    
    if (flowGroup && pathway.isActive) {
      flowGroup.children.forEach((particle, index) => {
        if (particle instanceof THREE.Mesh) {
          const userData = particle.userData;
          if (userData.curve && userData.t !== undefined) {
            // Move particle along curve
            userData.t = (userData.t + 0.01 * pathway.conductionVelocity) % 1;
            const newPosition = userData.curve.getPoint(userData.t);
            particle.position.copy(newPosition);
            
            // Update particle visibility based on pathway activation
            (particle.material as THREE.MeshPhongMaterial).opacity = 
              pathway.activationProgress * 0.8;
          }
        }
      });
    }
  }

  private updateElectricalFields(state: ElectrophysiologyState): void {
    this.electricalFields.forEach((field, fieldId) => {
      field.intensity = 0;
      
      // Check if any waves are near this field
      state.electricalWaves.forEach(wave => {
        const distance = field.centerPoint.distanceTo(
          new THREE.Vector3(wave.currentPosition.x, wave.currentPosition.y, wave.currentPosition.z)
        );
        
        if (distance < field.fieldRadius) {
          field.intensity = Math.max(field.intensity, wave.amplitude * (1 - distance / field.fieldRadius));
        }
      });
      
      // Update field visualization
      this.updateFieldVisualization(field);
    });
  }

  private updateFieldVisualization(field: ElectricalFieldVisualization): void {
    if (field.particleSystem) {
      const material = field.particleSystem.material as THREE.PointsMaterial;
      material.opacity = field.intensity * 0.8;
      material.size = 0.5 + (field.intensity * 0.5);
    }
    
    // Update field lines
    field.fieldLines.children.forEach(child => {
      if (child instanceof THREE.Line) {
        const material = child.material as THREE.LineBasicMaterial;
        material.opacity = field.intensity * 0.5;
      }
    });
  }

  private updateElectricalWaves(waves: ElectricalWave[]): void {
    // Create visual representations of electrical waves
    waves.forEach(wave => {
      this.visualizeElectricalWave(wave);
    });
  }

  private visualizeElectricalWave(wave: ElectricalWave): void {
    // Create dynamic wave visualization
    const waveGeometry = new THREE.SphereGeometry(wave.amplitude * 5, 16, 12);
    const waveMaterial = new THREE.MeshPhongMaterial({
      color: wave.waveType === 'depolarization' ? 0xffff00 : 0x0088ff,
      transparent: true,
      opacity: wave.amplitude * 0.6,
      emissive: wave.waveType === 'depolarization' ? 0x444400 : 0x002244,
      emissiveIntensity: wave.amplitude * 0.3
    });
    
    const waveMesh = new THREE.Mesh(waveGeometry, waveMaterial);
    waveMesh.position.set(wave.currentPosition.x, wave.currentPosition.y, wave.currentPosition.z);
    
    // Add to scene temporarily
    this.conductionGroup.add(waveMesh);
    
    // Remove after short time (would be managed by animation loop)
    setTimeout(() => {
      this.conductionGroup.remove(waveMesh);
    }, 100);
  }

  /**
   * Setup mouse interaction for educational elements
   */
  private setupInteractivity(): void {
    // Add event listeners for mouse interaction
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.renderer.domElement.addEventListener('click', this.onClick.bind(this));
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Check intersections with interactive elements
    const intersects = this.raycaster.intersectObjects(
      Array.from(this.interactiveElements.values()).map(element => element.mesh)
    );
    
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object as THREE.Mesh;
      const element = Array.from(this.interactiveElements.values())
        .find(el => el.mesh === intersectedObject);
      
      if (element) {
        this.showTooltip(element, event);
        this.highlightElement(element);
      }
    } else {
      this.hideTooltips();
      this.clearHighlights();
    }
  }

  private onClick(event: MouseEvent): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const intersects = this.raycaster.intersectObjects(
      Array.from(this.interactiveElements.values()).map(element => element.mesh)
    );
    
    if (intersects.length > 0) {
      const intersectedObject = intersects[0].object as THREE.Mesh;
      const element = Array.from(this.interactiveElements.values())
        .find(el => el.mesh === intersectedObject);
      
      if (element) {
        this.selectElement(element);
      }
    }
  }

  private showTooltip(element: InteractiveElement, event: MouseEvent): void {
    element.tooltip.innerHTML = `
      <h4>${element.medicalInfo.name}</h4>
      <p><strong>Function:</strong> ${element.medicalInfo.function}</p>
      <p><strong>Timing:</strong> ${element.medicalInfo.normalTiming}</p>
      <p><strong>Clinical:</strong> ${element.medicalInfo.clinicalSignificance}</p>
    `;
    
    element.tooltip.style.display = 'block';
    element.tooltip.style.left = event.clientX + 'px';
    element.tooltip.style.top = event.clientY + 'px';
  }

  private hideTooltips(): void {
    this.interactiveElements.forEach(element => {
      element.tooltip.style.display = 'none';
    });
  }

  private highlightElement(element: InteractiveElement): void {
    if (!element.isSelected) {
      element.mesh.material = element.highlightMaterial;
    }
  }

  private clearHighlights(): void {
    this.interactiveElements.forEach(element => {
      if (!element.isSelected) {
        // Restore original material (would need to store original)
        // element.mesh.material = element.originalMaterial;
      }
    });
  }

  private selectElement(element: InteractiveElement): void {
    // Clear previous selection
    if (this.selectedElement) {
      const prevElement = this.interactiveElements.get(this.selectedElement);
      if (prevElement) {
        prevElement.isSelected = false;
      }
    }
    
    // Set new selection
    element.isSelected = true;
    this.selectedElement = element.elementId;
    
    // Emit selection event (would integrate with UI components)
    console.log('Selected conduction element:', element.medicalInfo.name);
  }

  // Public interface methods
  public setLabelsVisible(visible: boolean): void {
    this.labelsVisible = visible;
    // Implementation would show/hide labels
  }

  public setPathwaysVisible(visible: boolean): void {
    this.pathwaysVisible = visible;
    this.conductionPathways.forEach(pathway => {
      pathway.visualElements.visible = visible;
    });
  }

  public setElectricalFieldsVisible(visible: boolean): void {
    this.electricalFieldsVisible = visible;
    this.electricalFields.forEach(field => {
      field.fieldLines.visible = visible;
    });
  }

  public setMedicalAccuracyMode(enabled: boolean): void {
    this.medicalAccuracyMode = enabled;
    // Would adjust visualization complexity and accuracy
  }

  public getConductionGroup(): THREE.Group {
    return this.conductionGroup;
  }

  public getInteractiveElements(): Map<string, InteractiveElement> {
    return this.interactiveElements;
  }
}