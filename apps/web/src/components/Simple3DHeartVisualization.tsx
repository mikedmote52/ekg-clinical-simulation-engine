'use client';

import React, { useRef, useEffect, useState } from 'react';
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
  Heart as HeartIcon
} from 'lucide-react';

// Simplified types for the demo
interface SimpleMedicalData {
  rhythm_classification: string;
  heart_rate: number;
  clinical_significance: 'normal' | 'monitor' | 'urgent' | 'critical';
  pathophysiology: string;
  clinical_context: {
    symptoms_likely: string[];
    treatment_considerations: string[];
    monitoring_requirements: string[];
  };
}

interface Simple3DHeartVisualizationProps {
  medicalData: SimpleMedicalData | null;
  onVisualizationStateChange?: (state: any) => void;
  onMedicalHighlight?: (finding: string, active: boolean) => void;
}

export const Simple3DHeartVisualization: React.FC<Simple3DHeartVisualizationProps> = ({
  medicalData,
  onVisualizationStateChange,
  onMedicalHighlight
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Visualization state
  const [controls, setControls] = useState({
    isPlaying: false,
    animationSpeed: 1.0,
    currentViewpoint: 'Anterior View',
    labelsVisible: true,
    conductionVisible: true,
    ekgOverlayVisible: false,
    audioEnabled: true,
    quality: 'high' as const
  });
  
  // Performance monitoring
  const [performance] = useState({
    fps: 60,
    drawCalls: 12,
    triangles: 1840
  });
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);

  /**
   * Initialize the 3D canvas with a simplified heart animation
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  /**
   * Animation loop
   */
  useEffect(() => {
    if (!canvasRef.current || !isInitialized) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      if (!controls.isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Clear canvas
      ctx.clearRect(0, 0, rect.width, rect.height);

      // Create gradient background
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(rect.width, rect.height) / 2);
      gradient.addColorStop(0, 'rgba(30, 30, 60, 0.8)');
      gradient.addColorStop(1, 'rgba(10, 10, 30, 1.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Update animation phase
      setAnimationPhase(prev => (prev + controls.animationSpeed * 0.05) % (Math.PI * 2));

      // Draw animated heart
      drawAnimatedHeart(ctx, centerX, centerY, medicalData, animationPhase);

      // Draw electrical activity
      if (controls.conductionVisible) {
        drawElectricalActivity(ctx, centerX, centerY, medicalData, animationPhase);
      }

      // Draw coronary arteries
      drawCoronaryArteries(ctx, centerX, centerY, animationPhase);

      // Draw labels
      if (controls.labelsVisible) {
        drawAnatomicalLabels(ctx, centerX, centerY);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [controls, medicalData, isInitialized, animationPhase]);

  /**
   * Draw the animated 3D-looking heart
   */
  const drawAnimatedHeart = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, medicalData: SimpleMedicalData | null, phase: number) => {
    const scale = 80;
    const heartbeat = Math.sin(phase * 4) * 0.1 + 1; // Heartbeat scaling

    // Get rhythm-specific animation
    const rhythmAnimation = getRhythmSpecificAnimation(medicalData?.rhythm_classification || 'normal_sinus', phase);

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(heartbeat * rhythmAnimation.scale, heartbeat * rhythmAnimation.scale);

    // Draw heart chambers with medical colors
    drawChambersWithElectrical(ctx, scale, rhythmAnimation, medicalData);

    ctx.restore();
  };

  /**
   * Get animation parameters based on rhythm type
   */
  const getRhythmSpecificAnimation = (rhythm: string, phase: number) => {
    switch (rhythm) {
      case 'atrial_fibrillation':
        return {
          scale: 0.95 + Math.random() * 0.1, // Irregular, chaotic
          atrialActivity: Math.random() * 0.8,
          ventricularActivity: Math.sin(phase * 3 + Math.random()) * 0.6 + 0.4,
          color: [255, 150, 150]
        };
      case 'ventricular_tachycardia':
        return {
          scale: 0.9 + Math.sin(phase * 8) * 0.2, // Rapid, abnormal
          atrialActivity: 0.2,
          ventricularActivity: Math.abs(Math.sin(phase * 8)) * 0.9,
          color: [255, 100, 100]
        };
      case 'heart_block':
        return {
          scale: 0.95 + Math.sin(phase * 2) * 0.05, // Slower, dissociated
          atrialActivity: Math.sin(phase * 4) * 0.6 + 0.4,
          ventricularActivity: Math.sin(phase * 1.5) * 0.4 + 0.3,
          color: [255, 200, 100]
        };
      default: // normal_sinus
        return {
          scale: 1.0,
          atrialActivity: Math.sin(phase * 4) * 0.3 + 0.5,
          ventricularActivity: Math.sin(phase * 4 + Math.PI * 0.3) * 0.7 + 0.7,
          color: [255, 100, 100]
        };
    }
  };

  /**
   * Draw heart chambers with electrical activity
   */
  const drawChambersWithElectrical = (ctx: CanvasRenderingContext2D, scale: number, animation: any, medicalData: SimpleMedicalData | null) => {
    // Right Atrium (upper right)
    ctx.fillStyle = `rgba(139, 75, 139, ${0.6 + animation.atrialActivity * 0.4})`;
    drawChamber(ctx, scale * 0.5, -scale * 0.3, scale * 0.6, scale * 0.4);

    // Left Atrium (upper left)  
    ctx.fillStyle = `rgba(255, 107, 107, ${0.6 + animation.atrialActivity * 0.4})`;
    drawChamber(ctx, -scale * 0.5, -scale * 0.3, scale * 0.6, scale * 0.4);

    // Right Ventricle (lower right)
    ctx.fillStyle = `rgba(91, 91, 175, ${0.7 + animation.ventricularActivity * 0.3})`;
    drawChamber(ctx, scale * 0.4, scale * 0.3, scale * 0.8, scale * 0.9);

    // Left Ventricle (lower left) - main pumping chamber
    ctx.fillStyle = `rgba(${animation.color[0]}, ${animation.color[1]}, ${animation.color[2]}, ${0.8 + animation.ventricularActivity * 0.2})`;
    drawChamber(ctx, -scale * 0.4, scale * 0.3, scale * 0.9, scale * 1.0);

    // Add 3D depth effects
    add3DDepthEffects(ctx, scale, animation);
  };

  /**
   * Draw individual heart chamber
   */
  const drawChamber = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) => {
    ctx.beginPath();
    ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Add subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  /**
   * Add 3D depth and lighting effects
   */
  const add3DDepthEffects = (ctx: CanvasRenderingContext2D, scale: number, animation: any) => {
    // Add highlight for 3D effect
    const gradient = ctx.createRadialGradient(-scale * 0.2, -scale * 0.2, 0, 0, 0, scale);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-scale, -scale, scale * 2, scale * 2);
  };

  /**
   * Draw electrical conduction activity
   */
  const drawElectricalActivity = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, medicalData: SimpleMedicalData | null, phase: number) => {
    ctx.save();
    ctx.translate(centerX, centerY);

    const scale = 80;
    const electricalPhase = (phase * 4) % (Math.PI * 2);

    // SA Node (pacemaker)
    if (electricalPhase < Math.PI * 0.2) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(scale * 0.6, -scale * 0.4, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // AV Node
    if (electricalPhase > Math.PI * 0.2 && electricalPhase < Math.PI * 0.4) {
      ctx.fillStyle = 'rgba(255, 136, 0, 0.9)';
      ctx.beginPath();
      ctx.arc(0, scale * 0.1, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ventricular conduction
    if (electricalPhase > Math.PI * 0.4 && electricalPhase < Math.PI * 0.8) {
      drawVentricularConduction(ctx, scale, electricalPhase);
    }

    ctx.restore();
  };

  /**
   * Draw ventricular electrical conduction
   */
  const drawVentricularConduction = (ctx: CanvasRenderingContext2D, scale: number, phase: number) => {
    const intensity = (phase - Math.PI * 0.4) / (Math.PI * 0.4);
    
    ctx.strokeStyle = `rgba(0, 255, 136, ${0.7 * intensity})`;
    ctx.lineWidth = 3;
    
    // Left bundle branch
    ctx.beginPath();
    ctx.moveTo(0, scale * 0.1);
    ctx.lineTo(-scale * 0.6, scale * 0.5);
    ctx.stroke();
    
    // Right bundle branch
    ctx.beginPath();
    ctx.moveTo(0, scale * 0.1);
    ctx.lineTo(scale * 0.5, scale * 0.5);
    ctx.stroke();
    
    // Purkinje fibers
    drawPurkinjeNetwork(ctx, scale, intensity);
  };

  /**
   * Draw Purkinje fiber network
   */
  const drawPurkinjeNetwork = (ctx: CanvasRenderingContext2D, scale: number, intensity: number) => {
    ctx.strokeStyle = `rgba(0, 255, 200, ${0.5 * intensity})`;
    ctx.lineWidth = 1;
    
    const branches = 6;
    for (let i = 0; i < branches; i++) {
      const angle = (i / branches) * Math.PI * 2;
      const startX = -scale * 0.6 + Math.cos(angle) * scale * 0.2;
      const startY = scale * 0.5 + Math.sin(angle) * scale * 0.2;
      const endX = startX + Math.cos(angle) * scale * 0.3;
      const endY = startY + Math.sin(angle) * scale * 0.3;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  };

  /**
   * Draw coronary arteries
   */
  const drawCoronaryArteries = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, phase: number) => {
    ctx.save();
    ctx.translate(centerX, centerY);
    
    const scale = 80;
    const pulse = Math.sin(phase * 4) * 0.1 + 0.9;
    
    ctx.strokeStyle = `rgba(255, 68, 68, ${0.6 * pulse})`;
    ctx.lineWidth = 3;
    
    // Left main coronary artery
    ctx.beginPath();
    ctx.moveTo(-scale * 0.8, scale * 0.2);
    ctx.quadraticCurveTo(-scale * 0.6, scale * 0.0, -scale * 0.4, scale * 0.3);
    ctx.stroke();
    
    // Right coronary artery
    ctx.beginPath();
    ctx.moveTo(scale * 0.8, scale * 0.2);
    ctx.quadraticCurveTo(scale * 0.6, scale * 0.4, scale * 0.2, scale * 0.7);
    ctx.stroke();
    
    // LAD (Left Anterior Descending)
    ctx.strokeStyle = `rgba(255, 102, 102, ${0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-scale * 0.4, scale * 0.3);
    ctx.lineTo(-scale * 0.2, scale * 0.8);
    ctx.stroke();
    
    ctx.restore();
  };

  /**
   * Draw anatomical labels
   */
  const drawAnatomicalLabels = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number) => {
    const scale = 80;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    
    const labels = [
      { text: 'RA', x: centerX + scale * 0.5, y: centerY - scale * 0.3 },
      { text: 'LA', x: centerX - scale * 0.5, y: centerY - scale * 0.3 },
      { text: 'RV', x: centerX + scale * 0.4, y: centerY + scale * 0.3 },
      { text: 'LV', x: centerX - scale * 0.4, y: centerY + scale * 0.3 },
      { text: 'SA', x: centerX + scale * 0.6, y: centerY - scale * 0.5 },
      { text: 'AV', x: centerX, y: centerY }
    ];
    
    labels.forEach(label => {
      // Label background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      const textWidth = ctx.measureText(label.text).width;
      ctx.fillRect(label.x - textWidth / 2 - 4, label.y - 8, textWidth + 8, 16);
      
      // Label text
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(label.text, label.x, label.y + 4);
    });
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

  const toggleLabels = () => {
    setControls(prev => ({ ...prev, labelsVisible: !prev.labelsVisible }));
  };

  const toggleConduction = () => {
    setControls(prev => ({ ...prev, conductionVisible: !prev.conductionVisible }));
  };

  const handleReset = () => {
    setControls(prev => ({
      ...prev,
      animationSpeed: 1.0,
      isPlaying: false
    }));
    setAnimationPhase(0);
  };

  return (
    <div className="h-full bg-gradient-to-br from-slate-900/50 to-blue-900/30 rounded-lg border border-slate-700/50 overflow-hidden">
      {/* 3D Canvas */}
      <div className="relative h-[70%]">
        <canvas
          ref={canvasRef}
          className="w-full h-full cursor-pointer"
          style={{ display: 'block' }}
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
            </div>
          )}
          
          {/* Performance Monitor */}
          <div className="bg-slate-800/80 backdrop-blur-sm text-slate-300 px-3 py-2 rounded-lg text-xs">
            <div>{performance.fps} FPS</div>
            <div>{performance.drawCalls} calls</div>
          </div>
        </div>
        
        {/* Educational Annotations */}
        {medicalData && controls.labelsVisible && (
          <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-lg p-4 max-w-sm">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">Clinical Context</h4>
            <p className="text-xs text-slate-300 mb-3">{medicalData.pathophysiology}</p>
            
            {medicalData.clinical_context.symptoms_likely.length > 0 && (
              <div className="text-xs">
                <div className="text-yellow-400 font-medium">Likely Symptoms:</div>
                <ul className="text-slate-400 mt-1 space-y-1">
                  {medicalData.clinical_context.symptoms_likely.slice(0, 3).map((symptom, idx) => (
                    <li key={idx}>• {symptom}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Control Panel */}
      <div className="h-[30%] border-t border-slate-700/50 bg-slate-900/50 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
          
          {/* Playback Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-blue-400 flex items-center space-x-2">
              <Play className="w-4 h-4" />
              <span>Playback</span>
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
              <span>View</span>
            </h4>
            
            <select
              value={controls.currentViewpoint}
              onChange={(e) => setControls(prev => ({ ...prev, currentViewpoint: e.target.value }))}
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
                onClick={toggleLabels}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-xs ${
                  controls.labelsVisible ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {controls.labelsVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>Labels</span>
              </button>
              
              <button
                onClick={toggleConduction}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-xs ${
                  controls.conductionVisible ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Conduction</span>
              </button>
            </div>
          </div>
          
          {/* Educational Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-green-400 flex items-center space-x-2">
              <Settings className="w-4 h-4" />
              <span>Education</span>
            </h4>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setControls(prev => ({ ...prev, audioEnabled: !prev.audioEnabled }))}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-xs ${
                  controls.audioEnabled ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {controls.audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                <span>Audio</span>
              </button>
              
              <button
                className="flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-xs bg-slate-700 text-slate-300"
                title="Advanced features"
              >
                <HeartIcon className="w-3 h-3" />
                <span>Advanced</span>
              </button>
            </div>
            
            <select
              value={controls.quality}
              onChange={(e) => setControls(prev => ({ ...prev, quality: e.target.value as any }))}
              className="w-full bg-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="low">Low Quality</option>
              <option value="medium">Medium Quality</option>
              <option value="high">High Quality</option>
              <option value="ultra">Ultra Quality</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Simple3DHeartVisualization;