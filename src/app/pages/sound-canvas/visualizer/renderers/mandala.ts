import type { AudioFrame } from "../../audio/types";

export function drawMandala(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  width: number,
  height: number,
  time: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const petalCount = 36;
  const baseRadius = Math.min(width, height) * 0.1;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(time * (0.05 + frame.mid * 0.18 + frame.pulse * 0.16));
  context.globalCompositeOperation = "screen";

  for (let layer = 0; layer < 4; layer += 1) {
    context.beginPath();

    for (let petal = 0; petal <= petalCount; petal += 1) {
      const angle = (petal / petalCount) * Math.PI * 2;
      const frequencyIndex = Math.floor(
        ((petal + layer * 7) / petalCount) * (frame.frequency.length - 1),
      );
      const energy = frame.frequency[frequencyIndex] / 255;
      const radius =
        baseRadius +
        layer * 28 +
        Math.sin(angle * 6 + time * (0.4 + frame.treble) + layer) *
          energy *
          (32 + frame.pulse * 42) +
        frame.mid * 24 +
        frame.pulse * 28;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      if (petal === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.closePath();
    context.strokeStyle = `hsla(${280 + layer * 25}, 100%, 80%, ${0.7 - layer * 0.08})`;
    context.lineWidth = 2 + frame.treble * 1.8 + frame.pulse * 2.5;
    context.shadowColor = "#ddd6fe";
    context.shadowBlur = 24 + frame.pulse * 18;
    context.stroke();
  }

  context.restore();
}
