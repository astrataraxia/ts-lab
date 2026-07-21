import type { AudioFrame } from "../../audio/types";
import { getTimeDomainSample } from "../background";

export function drawWaveform(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  width: number,
  height: number,
) {
  const centerY = height / 2;
  const gradient = context.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, "#8b5cf6");
  gradient.addColorStop(0.5, "#22d3ee");
  gradient.addColorStop(1, "#f472b6");

  context.save();
  context.beginPath();

  for (let index = 0; index < frame.timeDomain.length; index += 1) {
    const x = (index / (frame.timeDomain.length - 1)) * width;
    const sample = getTimeDomainSample(frame, index);
    const y =
      centerY +
      sample * height * (0.28 + frame.volume * 0.22 + frame.pulse * 0.3);

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.strokeStyle = gradient;
  context.shadowColor = "rgba(103, 232, 249, 0.95)";
  context.shadowBlur = 28 + frame.pulse * 16;
  context.globalAlpha = 0.98;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.stroke();

  context.globalAlpha = 0.42 + frame.treble * 0.45;
  context.lineWidth = 1;
  context.beginPath();

  for (let index = 0; index < frame.timeDomain.length; index += 2) {
    const x = (index / (frame.timeDomain.length - 1)) * width;
    const sample = getTimeDomainSample(frame, index);
    const y = centerY - sample * height * (0.16 + frame.treble * 0.28);

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }

  context.stroke();
  context.restore();
}
