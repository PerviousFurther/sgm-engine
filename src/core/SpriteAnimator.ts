import type { SpriteSheetDefinition } from './types';

export function drawSpriteFrame(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  definition: SpriteSheetDefinition,
  elapsed: number,
  x: number,
  y: number,
  width: number,
  height: number,
  alpha = 1,
): void {
  const rawFrame = Math.floor(elapsed * definition.fps);
  const frame = definition.loop ? rawFrame % definition.frameCount : Math.min(rawFrame, definition.frameCount - 1);
  const sourceWidth = image.naturalWidth / definition.columns;
  const sourceHeight = image.naturalHeight / definition.rows;
  const sourceX = (frame % definition.columns) * sourceWidth;
  const sourceY = Math.floor(frame / definition.columns) * sourceHeight;
  context.save();
  context.globalAlpha = alpha;
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x - width / 2, y - height / 2, width, height);
  context.restore();
}
