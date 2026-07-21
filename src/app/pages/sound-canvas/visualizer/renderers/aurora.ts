import type { AudioFrame } from "../../audio/types";
import { getTimeDomainSample } from "../background";

export function drawAurora(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  width: number,
  height: number,
  time: number,
) {
  const centerY = height * 0.52;
  const amplitude = height * (0.08 + frame.volume * 0.3 + frame.pulse * 0.42);

  context.save();
  context.globalCompositeOperation = "screen";
  context.shadowBlur = 34;

  for (let ribbon = 0; ribbon < 5; ribbon += 1) {
    const offset = ribbon * 0.7;
    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, `hsla(${245 + ribbon * 12}, 100%, 76%, 0.3)`);
    gradient.addColorStop(0.5, `hsla(${175 + ribbon * 9}, 100%, 76%, 0.96)`);
    gradient.addColorStop(1, `hsla(${315 - ribbon * 8}, 100%, 80%, 0.36)`);

    context.beginPath();

    for (let x = 0; x <= width; x += 8) {
      const index = Math.floor((x / width) * (frame.timeDomain.length - 1));
      const sample = getTimeDomainSample(frame, index);
      const wave = Math.sin(
        x * (0.008 + frame.mid * 0.004) +
          time * (0.9 + frame.treble * 2.2 + offset * 0.1) +
          offset,
      );
      const y = centerY + wave * amplitude * 0.62 + sample * amplitude * 0.65;

      if (x === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.strokeStyle = gradient;
    context.lineWidth = 2 + frame.bass * 4 + frame.pulse * 3;
    context.shadowColor = `hsla(${210 + ribbon * 16}, 100%, 70%, 0.8)`;
    context.stroke();
  }

  context.restore();
}
