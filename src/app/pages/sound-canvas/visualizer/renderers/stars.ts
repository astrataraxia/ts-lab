import type { AudioFrame } from "../../audio/types";
import type { Star } from "../types";

export function drawStars(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  width: number,
  height: number,
  time: number,
  stars: Star[],
) {
  const points = stars.map((star) => ({
    x: star.x * width + Math.sin(time * 0.22 + star.phase) * frame.mid * 14,
    y: star.y * height + Math.cos(time * 0.18 + star.phase) * frame.treble * 10,
    size: star.size * (1 + frame.treble * 1.5 + frame.pulse * 1.8),
  }));

  context.save();
  context.globalCompositeOperation = "screen";

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const distance = Math.hypot(
        points[first].x - points[second].x,
        points[first].y - points[second].y,
      );

      if (distance < Math.min(width, height) * (0.18 + frame.pulse * 0.12)) {
        context.globalAlpha =
          (1 - distance / (Math.min(width, height) * 0.3)) *
          (0.45 + frame.volume * 0.45 + frame.pulse * 0.4);
        context.strokeStyle = "#bfdbfe";
        context.lineWidth = 1 + frame.volume * 1.4 + frame.pulse * 1.8;
        context.beginPath();
        context.moveTo(points[first].x, points[first].y);
        context.lineTo(points[second].x, points[second].y);
        context.stroke();
      }
    }
  }

  context.globalAlpha = 0.92 + frame.pulse * 0.08;
  context.shadowColor = "#67e8f9";
  context.shadowBlur = 18 + frame.treble * 24 + frame.pulse * 30;
  context.fillStyle = "#f8fbff";

  for (const point of points) {
    context.beginPath();
    context.arc(point.x, point.y, point.size, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}
