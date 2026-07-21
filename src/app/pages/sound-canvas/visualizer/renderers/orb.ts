import type { AudioFrame } from "../../audio/types";

export function drawOrb(
  context: CanvasRenderingContext2D,
  frame: AudioFrame,
  width: number,
  height: number,
  time: number,
) {
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * 0.14;
  const radius =
    baseRadius *
    (1 + frame.bass * 0.9 + frame.volume * 0.35 + frame.pulse * 1.25);

  context.save();
  context.globalCompositeOperation = "screen";

  const halo = context.createRadialGradient(
    centerX,
    centerY,
    radius * 0.2,
    centerX,
    centerY,
    radius * 3.2,
  );
  halo.addColorStop(
    0,
    `rgba(103, 232, 249, ${0.45 + frame.volume * 0.3 + frame.pulse * 0.2})`,
  );
  halo.addColorStop(0.42, "rgba(139, 92, 246, 0.3)");
  halo.addColorStop(1, "rgba(139, 92, 246, 0)");

  context.fillStyle = halo;
  context.fillRect(0, 0, width, height);

  const orb = context.createRadialGradient(
    centerX - radius * 0.35,
    centerY - radius * 0.4,
    radius * 0.1,
    centerX,
    centerY,
    radius,
  );
  orb.addColorStop(0, "#f5f3ff");
  orb.addColorStop(0.22, "#67e8f9");
  orb.addColorStop(0.64, "#6366f1");
  orb.addColorStop(1, "#312e81");

  context.shadowColor = "rgba(103, 232, 249, 0.85)";
  context.shadowBlur = 38 + frame.treble * 30 + frame.pulse * 40;
  context.fillStyle = orb;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.56 + frame.treble * 0.36 + frame.pulse * 0.2;
  context.strokeStyle = "#fbcfe8";
  context.lineWidth = 2;

  for (let ring = 0; ring < 3; ring += 1) {
    context.beginPath();
    context.ellipse(
      centerX,
      centerY,
      radius * (1.3 + ring * 0.22),
      radius * (0.38 + ring * 0.1),
      time * 0.18 + ring,
      0,
      Math.PI * 2,
    );
    context.stroke();
  }

  context.restore();
}
