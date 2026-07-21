import type { AudioFrame } from "../../audio/types";

export function drawRadial(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  width: number,
  height: number,
  time: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.17;
  const points = 160;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(time * (0.08 + frame.mid * 0.24 + frame.pulse * 0.18));
  context.globalCompositeOperation = "screen";

  for (let ring = 0; ring < 3; ring += 1) {
    context.beginPath();

    for (let index = 0; index <= points; index += 1) {
      const angle = (index / points) * Math.PI * 2;
      const frequencyIndex = Math.floor(
        (index / points) * (frame.frequency.length - 1),
      );
      const energy = frame.frequency[frequencyIndex] / 255;
      const currentRadius =
        radius + ring * 24 + energy * (45 + frame.bass * 72 + frame.pulse * 80);
      const x = Math.cos(angle) * currentRadius;
      const y = Math.sin(angle) * currentRadius;

      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }

    context.closePath();
    context.strokeStyle = `hsla(${185 + ring * 42}, 100%, 78%, ${0.68 - ring * 0.08})`;
    context.lineWidth = 2 + frame.volume * 2.5 + frame.pulse * 3;
    context.shadowColor = "#67e8f9";
    context.shadowBlur = 24 + frame.pulse * 18;
    context.stroke();
  }

  context.restore();
}
