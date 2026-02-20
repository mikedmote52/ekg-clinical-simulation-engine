/**
 * Global state for ECG interpretation and 3D heart visualization.
 */

import { create } from 'zustand';
import type {
  DigitizationResult,
  VisualizationParameterJSON,
  AlternateModel,
} from '../types/visualizationParams';

export type UploadStatus = 'idle' | 'uploading' | 'digitizing' | 'ready' | 'error';

export type PlaybackSpeed = 0.25 | 0.5 | 1.0 | 2.0;

export type DisplayMode = 'evidence' | 'reconstruction' | 'both';

interface EkgState {
  sessionId: string | null;
  uploadStatus: UploadStatus;
  uploadError: string | null;
  /** Object URL for original uploaded image (for digitizer preview) */
  originalImagePreviewUrl: string | null;
  digitizationResult: DigitizationResult | null;
  vizParams: VisualizationParameterJSON | null;
  /** Original vizParams before alternate model override */
  baseVizParams: VisualizationParameterJSON | null;
  playbackTime: number;
  playbackPlaying: boolean;
  playbackSpeed: PlaybackSpeed;
  playbackLooping: boolean;
  activeLeads: string[];
  displayMode: DisplayMode;
  activeAlternateModel: string | null;
}

interface EkgActions {
  setSessionId: (id: string | null) => void;
  setUploadStatus: (status: UploadStatus, error?: string) => void;
  setOriginalImagePreviewUrl: (url: string | null) => void;
  setDigitizationResult: (r: DigitizationResult | null) => void;
  setVizParams: (p: VisualizationParameterJSON | null, isBase?: boolean) => void;
  setPlaybackTime: (t: number) => void;
  setPlaybackPlaying: (p: boolean) => void;
  setPlaybackSpeed: (s: PlaybackSpeed) => void;
  setPlaybackLooping: (l: boolean) => void;
  setActiveLeads: (leads: string[]) => void;
  toggleLead: (lead: string) => void;
  setDisplayMode: (m: DisplayMode) => void;
  setActiveAlternateModel: (id: string | null) => void;
  applyAlternateModel: (alt: AlternateModel | null) => void;
  reset: () => void;
}

const initialState: EkgState = {
  sessionId: null,
  uploadStatus: 'idle',
  uploadError: null,
  originalImagePreviewUrl: null,
  digitizationResult: null,
  vizParams: null,
  baseVizParams: null,
  playbackTime: 0,
  playbackPlaying: false,
  playbackSpeed: 1.0,
  playbackLooping: true,
  activeLeads: [],
  displayMode: 'both',
  activeAlternateModel: null,
};

export const useEkgStore = create<EkgState & EkgActions>((set, get) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setUploadStatus: (status, error) =>
    set({ uploadStatus: status, uploadError: error ?? null }),
  setOriginalImagePreviewUrl: (url) => set({ originalImagePreviewUrl: url }),
  setDigitizationResult: (r) => set({ digitizationResult: r }),
  setVizParams: (p, isBase = true) =>
    set((s) => ({
      vizParams: p,
      baseVizParams: isBase ? p : s.baseVizParams,
    })),
  setPlaybackTime: (t) => set({ playbackTime: Math.max(0, t) }),
  setPlaybackPlaying: (p) => set({ playbackPlaying: p }),
  setPlaybackSpeed: (s) => set({ playbackSpeed: s }),
  setPlaybackLooping: (l) => set({ playbackLooping: l }),
  setActiveLeads: (leads) => set({ activeLeads: leads }),
  toggleLead: (lead) => {
    const { activeLeads } = get();
    const next = activeLeads.includes(lead)
      ? activeLeads.filter((l) => l !== lead)
      : [...activeLeads, lead];
    set({ activeLeads: next });
  },
  setDisplayMode: (m) => set({ displayMode: m }),
  setActiveAlternateModel: (id) => set({ activeAlternateModel: id }),
  applyAlternateModel: (alt) => {
    if (!alt) {
      const base = get().baseVizParams;
      set({ activeAlternateModel: null, vizParams: base });
      return;
    }
    const base = get().baseVizParams ?? get().vizParams;
    const merged = base
      ? { ...base, ...alt.viz_params }
      : (alt.viz_params as VisualizationParameterJSON);
    set({
      activeAlternateModel: alt.id,
      vizParams: merged,
    });
  },
  reset: () => set(initialState),
}));
