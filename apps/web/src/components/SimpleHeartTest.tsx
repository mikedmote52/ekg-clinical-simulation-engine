'use client';

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

/**
 * Simple 3D Heart Test Component to verify Three.js is working
 */
export const SimpleHeartTest: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const heartRef = useRef<THREE.Mesh>();
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    if (!mountRef.current) return;

    console.log('🧪 Testing simple 3D heart rendering...');

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2e);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    rendererRef.current = renderer;
    mountRef.current.appendChild(renderer.domElement);

    // Simple lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Create simple heart geometry
    const heartGeometry = new THREE.SphereGeometry(1, 16, 12);
    heartGeometry.scale(1.2, 1.5, 1.0); // Heart-like shape

    const heartMaterial = new THREE.MeshPhongMaterial({
      color: 0xff4444,
      shininess: 100
    });

    const heart = new THREE.Mesh(heartGeometry, heartMaterial);
    scene.add(heart);
    heartRef.current = heart;

    console.log('✅ Simple heart created and added to scene');

    // Animation loop
    const animate = () => {
      if (heartRef.current) {
        // Rotate the heart
        heartRef.current.rotation.x += 0.01;
        heartRef.current.rotation.y += 0.01;
        
        // Beating animation
        const scale = 1 + Math.sin(Date.now() * 0.005) * 0.1;
        heartRef.current.scale.setScalar(scale);
      }

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
    console.log('✅ Animation loop started');

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  return (
    <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
      <h3 className="text-sm font-semibold text-blue-400 mb-3">3D Rendering Test</h3>
      <div
        ref={mountRef}
        className="w-full h-48 rounded-lg border border-slate-600"
      />
      <p className="text-xs text-slate-400 mt-2">
        Simple beating heart test - should show red rotating heart with beating animation
      </p>
    </div>
  );
};

export default SimpleHeartTest;