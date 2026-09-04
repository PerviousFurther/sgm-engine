import { AudioManager } from './AudioManager';
import { EventBus } from './EventBus';
import type { AudioMarkerAction, LevelDefinition, LevelStage, RuntimeEventMap, StageCondition, TimelineEvent } from './types';

export interface LevelInterpreterHooks {
  onTimelineEvent?: (event: TimelineEvent) => void;
  onSceneRequested?: (sceneId: string) => void;
}

export class LevelInterpreter {
  readonly variables: Record<string, string | number | boolean>;
  private stage!: LevelStage;
  private stageTime = 0;
  private fired = new Set<string>();
  private waitRemaining = 0;
  private dialogueEventId?: string;
  private completed = false;

  constructor(
    readonly level: LevelDefinition,
    private readonly bus: EventBus<RuntimeEventMap>,
    private readonly audio: AudioManager,
    private readonly hooks: LevelInterpreterHooks = {},
  ) {
    this.variables = structuredClone(level.variables);
    this.enterStage(level.initialStageId);
  }

  get currentStage(): LevelStage { return this.stage; }
  get elapsed(): number { return this.stageTime; }
  get isDialogueOpen(): boolean { return Boolean(this.dialogueEventId); }

  update(dt: number): void {
    if (this.completed || this.dialogueEventId) return;
    if (this.waitRemaining > 0) {
      this.waitRemaining -= dt;
      return;
    }
    this.stageTime += dt;
    for (const event of this.stage.timeline) {
      if (event.at <= this.stageTime && !this.fired.has(event.id)) {
        const activeStageId = this.stage.id;
        this.fired.add(event.id);
        this.execute(event);
        if (this.stage.id !== activeStageId || this.dialogueEventId || this.waitRemaining > 0) break;
      }
    }
    if (this.stageTime >= this.stage.duration) this.tryTransition('onComplete');
  }

  closeDialogue(): void {
    if (!this.dialogueEventId) return;
    const eventId = this.dialogueEventId;
    this.dialogueEventId = undefined;
    this.bus.emit('dialogue:close', { eventId });
  }

  notifyEnemyDefeated(enemyId: string): void {
    this.bus.emit('enemy:defeated', { enemyId });
    this.tryTransition('onEnemyDefeated');
  }

  setVariable(name: string, value: string | number | boolean): void {
    this.variables[name] = value;
    this.bus.emit('variable:set', { name, value });
    this.tryTransition('onVariable');
  }

  handleAudioMarker(action: AudioMarkerAction): void {
    switch (action.type) {
      case 'emit': this.bus.emit('script:emit', { name: action.name, payload: action.payload }); break;
      case 'setVariable': this.setVariable(action.name, action.value); break;
      case 'requestScene': this.hooks.onSceneRequested?.(action.sceneId); break;
    }
  }

  private enterStage(stageId: string): void {
    const next = this.level.stages.find((candidate) => candidate.id === stageId);
    if (!next) throw new Error(`关卡 ${this.level.id} 不存在阶段 ${stageId}`);
    this.stage = next;
    this.stageTime = 0;
    this.waitRemaining = 0;
    this.fired.clear();
    this.bus.emit('stage:enter', { stageId });
  }

  private execute(event: TimelineEvent): void {
    this.hooks.onTimelineEvent?.(event);
    switch (event.type) {
      case 'playMusic': this.audio.playMusic(event.assetId, event); break;
      case 'stopMusic': this.audio.stopMusic({ fadeOut: event.fadeOut }); break;
      case 'playSound': this.audio.playCue(event.cueId, event.volume); break;
      case 'dialogue':
        this.dialogueEventId = event.id;
        this.bus.emit('dialogue:open', event);
        break;
      case 'spawnEnemy': this.bus.emit('enemy:spawned', { enemyId: event.enemy.id }); break;
      case 'startPattern': this.bus.emit('pattern:start', { ownerId: event.ownerId, pattern: event.pattern }); break;
      case 'stopPattern': this.bus.emit('pattern:stop', { ownerId: event.ownerId, patternId: event.patternId }); break;
      case 'setVariable': this.setVariable(event.name, event.value); break;
      case 'wait': this.waitRemaining = event.duration; break;
      case 'emit': this.bus.emit('script:emit', { name: event.name, payload: event.payload }); break;
      case 'moveEnemy': break;
    }
  }

  private tryTransition(type: 'onComplete' | 'onEnemyDefeated' | 'onVariable'): void {
    const transition = this.stage.transitions.find((candidate) => candidate.type === type && this.matches(candidate.condition));
    if (!transition) return;
    this.bus.emit('stage:complete', { stageId: this.stage.id });
    if (transition.targetStageId) {
      this.enterStage(transition.targetStageId);
    } else {
      this.completed = true;
      this.bus.emit('level:complete', { levelId: this.level.id });
      if (transition.targetSceneId) this.hooks.onSceneRequested?.(transition.targetSceneId);
    }
  }

  private matches(condition?: StageCondition): boolean {
    if (!condition) return true;
    const current = this.variables[condition.variable];
    switch (condition.operator) {
      case 'eq': return current === condition.value;
      case 'neq': return current !== condition.value;
      case 'gt': return Number(current) > Number(condition.value);
      case 'gte': return Number(current) >= Number(condition.value);
      case 'lt': return Number(current) < Number(condition.value);
      case 'lte': return Number(current) <= Number(condition.value);
    }
  }
}
