import { useEffect, useRef } from 'react';
import { BulletEngine } from '../../core/BulletEngine';
import type { PatternDefinition } from '../../core/types';

export function PatternPreview({ pattern }: { pattern: PatternDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = 480; canvas.height = 560;
    const engine = new BulletEngine();
    const origin = { x: 240, y: 110 };
    const target = { x: 240, y: 470 };
    engine.startPattern('preview', { ...pattern, duration: 999 }, () => origin);
    let frame = 0;
    let previous = performance.now();
    let elapsed = 0;
    const loop = (now: number) => {
      const dt = Math.min(.034, (now - previous) / 1000); previous = now; elapsed += dt;
      target.x = 240 + Math.sin(elapsed * .7) * 105;
      engine.update(dt, target, { width: 480, height: 560 });
      const gradient = context.createLinearGradient(0, 0, 0, 560);
      gradient.addColorStop(0, '#12182b'); gradient.addColorStop(1, '#080a12'); context.fillStyle = gradient; context.fillRect(0, 0, 480, 560);
      context.strokeStyle = '#ffffff08'; context.lineWidth = 1;
      for (let x = 0; x <= 480; x += 40) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 560); context.stroke(); }
      for (let y = 0; y <= 560; y += 40) { context.beginPath(); context.moveTo(0, y); context.lineTo(480, y); context.stroke(); }
      context.fillStyle = '#7acaff'; context.shadowColor = '#319eff'; context.shadowBlur = 20; context.beginPath(); context.arc(origin.x, origin.y, 13, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
      engine.draw(context);
      context.strokeStyle = '#ff547e'; context.beginPath(); context.arc(target.x, target.y, 4, 0, Math.PI * 2); context.stroke();
      context.fillStyle = '#ffffff6b'; context.font = '11px monospace'; context.fillText(`${engine.bullets.length} BULLETS`, 14, 22);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); engine.clear(); };
  }, [pattern]);

  return <canvas ref={canvasRef} className="pattern-preview" aria-label="弹幕实时预览" />;
}
