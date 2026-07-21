import type { AudioFrame } from "../audio/types";
import type { Star } from "./types";

export function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  _volume: number,
) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
}

export function createStars(count: number): Star[] {
  return Array.from({ length: count }, (_, index) => ({
    x: (Math.sin(index * 12.9898) * 43758.5453) % 1,
    y: (Math.sin(index * 78.233 + 4.2) * 43758.5453) % 1,
    phase: index * 1.73,
    size: 0.8 + ((index * 17) % 10) / 10,
  })).map((star) => ({
    ...star,
    x: Math.abs(star.x),
    y: Math.abs(star.y),
  }));
}

export function getTimeDomainSample(frame: AudioFrame, index: number): number {
  return (frame.timeDomain[index] - 128) / 128;
}
