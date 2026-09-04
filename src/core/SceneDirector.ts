import { EventBus } from './EventBus';
import type { GameProjectDefinition, RuntimeEventMap, SceneDefinition } from './types';

export class SceneDirector {
  private currentId: string;

  constructor(private readonly project: GameProjectDefinition, private readonly bus: EventBus<RuntimeEventMap>) {
    this.currentId = project.initialSceneId;
  }

  current(): SceneDefinition {
    const scene = this.project.scenes.find((candidate) => candidate.id === this.currentId);
    if (!scene) throw new Error(`场景不存在：${this.currentId}`);
    return scene;
  }

  go(sceneId: string): void {
    if (!this.project.scenes.some((scene) => scene.id === sceneId)) throw new Error(`场景不存在：${sceneId}`);
    const from = this.currentId;
    this.currentId = sceneId;
    this.bus.emit('scene:change', { from, to: sceneId });
  }

  next(): void {
    const next = this.current().next;
    if (next) this.go(next);
  }
}
