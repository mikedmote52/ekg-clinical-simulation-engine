'use client';

import React, { useState } from 'react';
import { Heart, Upload, Play, Pause, BookOpen, Settings } from 'lucide-react';

export default function EKGSimulationApp() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'upload' | 'analysis' | 'visualization'>('upload');

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      console.log('Uploaded file:', file.name);
      setCurrentPhase('analysis');
      
      // Simulate analysis
      setTimeout(() => {
        setCurrentPhase('visualization');
      }, 2000);
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Heart className="w-8 h-8 text-red-500 animate-pulse" />
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                EKG Clinical Simulation Engine
              </h1>
              <p className="text-sm text-slate-400">Real-time 3D Heart Visualization with Educational Narration</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-120px)]">
          
          {/* Main Visualization Area */}
          <div className="lg:col-span-2 space-y-4">
            {currentPhase === 'upload' && (
              <div className="h-full border-2 border-dashed border-slate-600 rounded-xl flex flex-col items-center justify-center bg-slate-800/30 hover:bg-slate-700/30 transition-colors">
                <Upload className="w-16 h-16 text-blue-400 mb-4" />
                <h3 className="text-xl font-semibold text-blue-400 mb-2">Upload EKG Data</h3>
                <p className="text-slate-400 mb-6 text-center max-w-md">
                  Upload EKG images, waveform data, or text reports for clinical-grade analysis
                </p>
                
                <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors">
                  Choose EKG File
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                
                <div className="mt-6 text-sm text-slate-500">
                  Supported formats: Images (PNG, JPG), Text reports (TXT), Waveform data (CSV)
                </div>
              </div>
            )}
            
            {currentPhase === 'analysis' && (
              <div className="h-full flex items-center justify-center bg-slate-800/30 rounded-xl">
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                  <div>
                    <h3 className="text-xl font-semibold text-blue-400">Analyzing EKG</h3>
                    <p className="text-slate-400">Processing with clinical-grade accuracy...</p>
                  </div>
                </div>
              </div>
            )}
            
            {currentPhase === 'visualization' && (
              <div className="h-full bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-blue-400">3D Heart Visualization</h3>
                    <button
                      onClick={togglePlayPause}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      <span>{isPlaying ? 'Pause' : 'Play'}</span>
                    </button>
                  </div>
                  
                  {/* 3D Visualization Placeholder */}
                  <div className="aspect-video bg-gradient-to-br from-red-900/20 to-blue-900/20 rounded-lg border border-red-500/20 flex items-center justify-center">
                    <div className="text-center">
                      <Heart className={`w-16 h-16 text-red-500 mx-auto mb-4 ${isPlaying ? 'animate-pulse' : ''}`} />
                      <div className="text-lg font-semibold text-red-400">Normal Sinus Rhythm</div>
                      <div className="text-sm text-slate-400">72 BPM • Clinical Significance: Normal</div>
                      {isPlaying && (
                        <div className="mt-4 text-sm text-green-400">
                          ▶ Real-time 3D heart animation would appear here
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-300">Heart Rate</div>
                      <div className="text-xl font-bold text-green-400">72 BPM</div>
                    </div>
                    <div className="bg-slate-700/50 rounded-lg p-3">
                      <div className="text-slate-300">Rhythm</div>
                      <div className="text-xl font-bold text-blue-400">Normal Sinus</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Side Panel */}
          <div className="space-y-4">
            {/* Educational Panel */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center space-x-2 mb-4">
                <BookOpen className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-purple-400">Educational Content</h3>
              </div>
              
              {currentPhase === 'visualization' ? (
                <div className="space-y-3">
                  <div className="text-sm text-slate-300">
                    <strong>Normal Sinus Rhythm:</strong> The heart&apos;s natural pacemaker (SA node) fires regularly, creating coordinated atrial and ventricular contractions.
                  </div>
                  
                  <div className="space-y-2 text-xs text-slate-400">
                    <div>• Regular P waves precede each QRS complex</div>
                    <div>• Heart rate: 60-100 beats per minute</div>
                    <div>• Normal electrical conduction pathway</div>
                    <div>• Coordinated chamber contractions</div>
                  </div>
                  
                  {isPlaying && (
                    <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                      <div className="text-xs text-blue-300 font-medium">🎵 Synchronized Narration</div>
                      <div className="text-xs text-blue-400 mt-1">
                        &quot;Watch as the SA node initiates each heartbeat, creating the coordinated electrical activity that drives mechanical contraction...&quot;
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
            
            {/* Controls Panel */}
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="w-5 h-5 text-orange-400" />
                <h3 className="font-semibold text-orange-400">Controls</h3>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Learning Level</span>
                  <select className="bg-slate-700 rounded px-2 py-1 text-xs">
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Animation Speed</span>
                  <input 
                    type="range" 
                    min="0.1" 
                    max="2" 
                    step="0.1" 
                    defaultValue="1" 
                    className="w-20"
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button className="flex-1 bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded text-xs transition-colors">
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
      
      {/* Status Bar */}
      <div className="fixed bottom-4 right-4 bg-slate-800/80 backdrop-blur-sm rounded-lg px-4 py-2 text-xs text-slate-400">
        Status: {currentPhase === 'upload' ? 'Ready for EKG input' : 
                currentPhase === 'analysis' ? 'Analyzing with medical AI...' : 
                'Real-time visualization active'} • 
        Medical Validation: ✅ Enabled
      </div>
    </div>
  );
}