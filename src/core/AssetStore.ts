import type { AssetDefinition } from './types';

export class AssetStore {
  private images = new Map<string, HTMLImageElement>();

  async load(assets: AssetDefinition[]): Promise<void> {
    await Promise.all(assets.filter((asset) => asset.type === 'image').map((asset) => this.loadImage(asset)));
  }

  image(idOrSrc: string): HTMLImageElement | undefined {
    return this.images.get(idOrSrc) ?? [...this.images.values()].find((image) => image.src.endsWith(idOrSrc));
  }

  private loadImage(asset: AssetDefinition): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { this.images.set(asset.id, image); this.images.set(asset.src, image); resolve(); };
      image.onerror = () => reject(new Error(`无法加载图片：${asset.src}`));
      image.src = asset.src;
    });
  }

}
