import { useEffect, useRef, useState } from 'react';
import { Grid3X3, Pause, Play } from 'lucide-react';
import { drawSpriteFrame } from '../../core/SpriteAnimator';
import type { SpriteSheetDefinition } from '../../core/types';

export function AnimationPreview({ definition }: { definition: SpriteSheetDefinition }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [grid, setGrid] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    canvas.width = 700; canvas.height = 520;
    const image = new Image(); image.src = definition.src;
    let frame = 0; const started = performance.now();
    const loop = (now: number) => {
      context.clearRect(0, 0, 700, 520); context.fillStyle = '#11131b'; context.fillRect(0, 0, 700, 520);
      context.fillStyle = '#171a25'; context.fillRect(24, 24, 652, 318);
      if (image.complete && image.naturalWidth) {
        const elapsed = playing ? (now - started) / 1000 : 0;
        const cellRatio = (image.naturalWidth / definition.columns) / (image.naturalHeight / definition.rows);
        const height = 270; const width = height * cellRatio;
        drawSpriteFrame(context, image, definition, elapsed, 350, 182, width, height);
        context.globalAlpha = .5;
        const sheetWidth = 430; const sheetHeight = sheetWidth * image.naturalHeight / image.naturalWidth;
        context.drawImage(image, 135, 370, sheetWidth, sheetHeight);
        context.globalAlpha = 1;
        if (grid) {
          context.strokeStyle = '#e75b893e'; context.lineWidth = 1;
          for (let column = 0; column <= definition.columns; column += 1) { const x = 135 + column * sheetWidth / definition.columns; context.beginPath(); context.moveTo(x, 370); context.lineTo(x, 370 + sheetHeight); context.stroke(); }
          for (let row = 0; row <= definition.rows; row += 1) { const y = 370 + row * sheetHeight / definition.rows; context.beginPath(); context.moveTo(135, y); context.lineTo(565, y); context.stroke(); }
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [definition, grid, playing]);

  return <div className="animation-preview-wrap"><canvas ref={canvasRef} className="animation-preview" /><div className="preview-tools"><button onClick={() => setPlaying(!playing)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? '暂停' : '播放'}</button><button className={grid ? 'active' : ''} onClick={() => setGrid(!grid)}><Grid3X3 size={15} />网格</button></div></div>;
}
