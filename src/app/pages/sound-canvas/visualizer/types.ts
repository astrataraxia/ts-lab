import type { AudioFrame } from "../audio/types";

export const VISUALIZER_MODES = [
  "aurora",
  "waveform",
  "orb",
  "stars",
  "radial",
  "mandala",
] as const;

export type VisualizerMode = (typeof VISUALIZER_MODES)[number];

export type WaveCanvas = {
  resize: () => void;
  draw: (audioData: AudioFrame) => void;
  setMode: (mode: VisualizerMode) => void;
};

export type Star = {
  x: number;
  y: number;
  phase: number;
  size: number;
};
