import type { AudioFrame } from "../audio/types";
import { createStars, drawBackground } from "./background";
import { drawAurora } from "./renderers/aurora";
import { drawMandala } from "./renderers/mandala";
import { drawOrb } from "./renderers/orb";
import { drawRadial } from "./renderers/radial";
import { drawStars } from "./renderers/stars";
import { drawWaveform } from "./renderers/waveform";
import type { VisualizerMode, WaveCanvas } from "./types";

export type { VisualizerMode, WaveCanvas } from "./types";
export { VISUALIZER_MODES } from "./types";

export function createWaveCanvas(canvas: HTMLCanvasElement): WaveCanvas {
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is not available.");
  }

  const drawingContext: CanvasRenderingContext2D = context;
  const stars = createStars(58);
  let mode: VisualizerMode = "aurora";

  function resize() {
    const pixelRatio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function draw(audioData: AudioFrame) {
    const { width, height } = canvas.getBoundingClientRect();
    const time = performance.now() / 1000;

    drawBackground(drawingContext, width, height, audioData.volume);

    switch (mode) {
      case "aurora":
        drawAurora(drawingContext, audioData, width, height, time);
        break;
      case "waveform":
        drawWaveform(drawingContext, audioData, width, height);
        break;
      case "orb":
        drawOrb(drawingContext, audioData, width, height, time);
        break;
      case "stars":
        drawStars(drawingContext, audioData, width, height, time, stars);
        break;
      case "radial":
        drawRadial(drawingContext, audioData, width, height, time);
        break;
      case "mandala":
        drawMandala(drawingContext, audioData, width, height, time);
        break;
    }
  }

  function setMode(nextMode: VisualizerMode) {
    mode = nextMode;
  }

  return { resize, draw, setMode };
}
