'use client';

import React, { useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import { useEkgStore } from '../store/ekgStore';
import type { ActivationEvent } from '../types/visualizationParams';

type CameraPreset = 'anterior' | 'posterior' | 'inferior' | 'right_lateral' | 'left_lateral' | 'conduction';

const CAMERA_PRESETS: Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }> = {
  anterior: { position: [0, 0, 8], target: [0, 0, 0] },
  posterior: { position: [0, 0, -8], target: [0, 0, 0] },
  inferior: { position: [0, -8, 0], target: [0, 0, 0] },
  right_lateral: { position: [8, 0, 0], target: [0, 0, 0] },
  left_lateral: { position: [-8, 0, 0], target: [0, 0, 0] },
  conduction: { position: [0, 2, 6], target: [0, -1, 0] },
};

const PHASE_COLORS = {
  p_wave: '#6366f1',
  pr_segment: '#94a3b8',
  qrs: '#ef4444',
  st_segment: '#22c55e',
  t_wave: '#eab308',
};

function activationFactor(
  playbackTime: number,
  event: ActivationEvent,
  cycleMs: number
): number {
  const t = playbackTime % cycleMs;
  const onset = event.onset_ms;
  const dur = event.duration_ms;
  const fadeMs = 20;

  if (t < onset) return 0;
  if (t < onset + fadeMs) return (t - onset) / fadeMs;
  if (t < onset + dur) {
    const prog = (t - onset - fadeMs) / (dur - fadeMs);
    return 1 - prog * 0.7;
  }
  return 0.3;
}

function HeartMesh({
  vizParams,
  playbackTime,
  activeAlternateModel,
}: {
  vizParams: import('../types/visualizationParams').VisualizationParameterJSON;
  playbackTime: number;
  activeAlternateModel: string | null;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const cycleMs = vizParams.cardiac_cycle_duration_ms;
  const conductionSystem = vizParams.conduction_system;
  const repolarization = vizParams.repolarization;
  const lbbb = conductionSystem?.lbbb ?? false;

  const activationMap = useMemo(() => {
    const sequence = vizParams.activation_sequence ?? [];
    const m = new Map<string, number>();
    for (const e of sequence) {
      const f = activationFactor(playbackTime, e, cycleMs);
      m.set(e.structure_id, f);
    }
    return m;
  }, [vizParams.activation_sequence, playbackTime, cycleMs]);

  // Resting: dark blue-purple, Activated: bright yellow-white, Repolarizing: red->purple
  const getColor = (factor: number): THREE.Color => {
    if (factor < 0.1) return new THREE.Color(0.15, 0.1, 0.25);
    if (factor > 0.9) return new THREE.Color(1, 1, 0.9);
    return new THREE.Color(
      0.15 + factor * 0.85,
      0.1 + factor * 0.3,
      0.25 + (1 - factor) * 0.5
    );
  };

  // Fallback: simple procedural heart-ish shape (icosahedron) when no GLTF
  const structures = useMemo(() => {
    const list: { id: string; position: [number, number, number]; scale: number }[] = [
      { id: 'sa_node', position: [0.8, 1.2, 0.3], scale: 0.15 },
      { id: 'av_node', position: [0, 0, 0], scale: 0.12 },
      { id: 'his_bundle', position: [0, -0.5, 0], scale: 0.08 },
      { id: 'left_bundle', position: [-0.4, -0.8, 0.2], scale: 0.06 },
      { id: 'right_bundle', position: [0.4, -0.8, -0.2], scale: 0.06 },
      { id: 'purkinje', position: [0, -1.2, 0], scale: 0.1 },
      { id: 'atria', position: [0, 0.6, 0], scale: 0.6 },
      { id: 'ventricles', position: [0, -0.5, 0], scale: 1 },
    ];
    return list;
  }, []);

  const injuryRegions = repolarization?.injury_current_regions ?? [];

  return (
    <group ref={groupRef}>
      {structures.map((s) => {
        const factor = activationMap.get(s.id) ?? 0;
        const blocked = lbbb && s.id === 'left_bundle';
        const color = blocked ? new THREE.Color(0.3, 0.2, 0.2) : getColor(factor);

        return (
          <mesh key={s.id} position={s.position}>
            <icosahedronGeometry args={[s.scale, 1]} />
            <meshStandardMaterial
              color={color}
              metalness={0.1}
              roughness={0.7}
              emissive={blocked ? new THREE.Color(0.1, 0, 0) : color.clone().multiplyScalar(factor * 0.3)}
            />
          </mesh>
        );
      })}
      {injuryRegions.length > 0 && (
        <mesh position={[0, -0.5, 0]}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshBasicMaterial
            color="#ff0000"
            transparent
            opacity={0.2}
          />
        </mesh>
      )}
    </group>
  );
}

function CameraController({ preset }: { preset: CameraPreset }) {
  const { camera } = useThree();
  const { position, target } = CAMERA_PRESETS[preset];
  const targetPos = useRef(new THREE.Vector3(...position));
  const targetLook = useRef(new THREE.Vector3(...target));

  useEffect(() => {
    targetPos.current.set(...position);
    targetLook.current.set(...target);
  }, [preset, position, target]);

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.05);
    camera.lookAt(targetLook.current);
    camera.updateProjectionMatrix();
  });

  return null;
}

function PlaybackUpdater() {
  const playbackPlaying = useEkgStore((s) => s.playbackPlaying);
  const playbackSpeed = useEkgStore((s) => s.playbackSpeed);
  const playbackLooping = useEkgStore((s) => s.playbackLooping);
  const vizParams = useEkgStore((s) => s.vizParams);
  const setPlaybackTime = useEkgStore((s) => s.setPlaybackTime);

  useFrame((_, delta) => {
    if (!playbackPlaying || !vizParams) return;
    const cycleMs = vizParams.cardiac_cycle_duration_ms;
    const store = useEkgStore.getState();
    const dt = delta * 1000 * playbackSpeed;
    const t = store.playbackTime;
    const next = t + dt;
    const newTime =
      playbackLooping && next >= cycleMs ? next % cycleMs : Math.min(next, cycleMs);
    setPlaybackTime(newTime);
  });

  return null;
}

export function HeartModelPane() {
  const {
    vizParams,
    playbackTime,
    setPlaybackTime,
    playbackPlaying,
    setPlaybackPlaying,
    playbackSpeed,
    activeAlternateModel,
  } = useEkgStore();
  const [cameraPreset, setCameraPreset] = React.useState<CameraPreset>('anterior');
  const looping = useEkgStore((s) => s.playbackLooping);
  const setPlaybackLooping = useEkgStore((s) => s.setPlaybackLooping);
  const cycleMs = vizParams?.cardiac_cycle_duration_ms ?? 1000;

  const phases = useMemo(() => {
    const p: { label: string; color: string; start: number; end: number }[] = [];
    const pb = vizParams?.phase_boundaries ?? {};
    if (pb.p_wave) p.push({ label: 'P', color: PHASE_COLORS.p_wave, start: pb.p_wave.start_ms, end: pb.p_wave.end_ms });
    if (pb.pr_segment) p.push({ label: 'PR', color: PHASE_COLORS.pr_segment, start: pb.pr_segment.start_ms, end: pb.pr_segment.end_ms });
    if (pb.qrs) p.push({ label: 'QRS', color: PHASE_COLORS.qrs, start: pb.qrs.start_ms, end: pb.qrs.end_ms });
    if (pb.st_segment) p.push({ label: 'ST', color: PHASE_COLORS.st_segment, start: pb.st_segment.start_ms, end: pb.st_segment.end_ms });
    if (pb.t_wave) p.push({ label: 'T', color: PHASE_COLORS.t_wave, start: pb.t_wave.start_ms, end: pb.t_wave.end_ms });
    return p;
  }, [vizParams?.phase_boundaries]);

  if (!vizParams) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 min-h-[400px] flex items-center justify-center bg-slate-100 dark:bg-slate-900 animate-pulse">
        <div className="text-slate-500">No visualization parameters — run interpretation</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="h-[400px] min-h-[400px] bg-slate-900">
        <Canvas
          camera={{ position: [0, 0, 8], fov: 45 }}
          gl={{ antialias: true }}
          dpr={[1, 2]}
        >
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
          <directionalLight position={[-5, 5, -5]} intensity={0.5} />
          <pointLight position={[0, 5, 0]} intensity={0.5} />
          <Suspense fallback={null}>
            <HeartMesh
              vizParams={vizParams}
              playbackTime={playbackTime}
              activeAlternateModel={activeAlternateModel}
            />
            <PlaybackUpdater />
            <CameraController preset={cameraPreset} />
          </Suspense>
        </Canvas>
      </div>

      {/* Camera presets */}
      <div className="p-2 flex flex-wrap gap-1 border-t border-slate-700">
        {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setCameraPreset(p)}
            className={`px-2 py-1 rounded text-xs ${
              cameraPreset === p ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {p.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="p-4 border-t border-slate-700 space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlaybackPlaying(!playbackPlaying)}
            className="p-2 rounded bg-slate-700 hover:bg-slate-600 text-white"
          >
            {playbackPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <select
            value={playbackSpeed}
            onChange={(e) => useEkgStore.getState().setPlaybackSpeed(Number(e.target.value) as 0.25 | 0.5 | 1 | 2)}
            className="bg-slate-700 text-white rounded px-2 py-1 text-sm"
          >
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
          <label className="flex items-center gap-1 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={looping}
              onChange={(e) => setPlaybackLooping(e.target.checked)}
            />
            Loop
          </label>
        </div>
        <div className="relative h-8">
          {phases.length > 0 && (
            <div className="absolute inset-0 flex">
              {phases.map((ph) => (
                <div
                  key={ph.label}
                  className="h-full"
                  style={{
                    width: `${((ph.end - ph.start) / cycleMs) * 100}%`,
                    backgroundColor: ph.color,
                    opacity: 0.5,
                  }}
                  title={ph.label}
                />
              ))}
            </div>
          )}
          <input
            type="range"
            min={0}
            max={cycleMs}
            value={playbackTime}
            onChange={(e) => setPlaybackTime(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white"
            style={{ left: `${(playbackTime / cycleMs) * 100}%` }}
          />
        </div>
      </div>

      {phases.length > 0 && (
        <div className="px-4 pb-2 flex gap-4 text-xs text-slate-400">
          {phases.map((ph) => (
            <span key={ph.label} style={{ color: ph.color }}>
              {ph.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
