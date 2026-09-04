export type Vector2 = { x: number; y: number };

export type SceneKind =
  | 'title'
  | 'selection'
  | 'loading'
  | 'gameplay'
  | 'result'
  | 'ending'
  | 'credits';

export interface SceneDefinition {
  id: string;
  kind: SceneKind;
  title: string;
  next?: string;
  levelId?: string;
  audio?: SceneAudioDefinition;
}

export interface GameProjectDefinition {
  id: string;
  title: string;
  version: number;
  initialSceneId: string;
  scenes: SceneDefinition[];
  characters: CharacterDefinition[];
  levels: LevelDefinition[];
  assets: AssetDefinition[];
  audio?: AudioSystemDefinition;
}

export interface ImageAssetDefinition {
  id: string;
  type: 'image';
  src: string;
}

export type AudioBus = 'music' | 'sfx' | 'voice';

export type AudioMarkerAction =
  | { type: 'emit'; name: string; payload?: unknown }
  | { type: 'setVariable'; name: string; value: string | number | boolean }
  | { type: 'requestScene'; sceneId: string };

export interface AudioMarkerDefinition {
  id: string;
  at: number;
  action: AudioMarkerAction;
  once?: boolean;
}

export interface AudioAssetDefinition {
  id: string;
  type: 'audio';
  src: string;
  category?: AudioBus;
  defaultVolume?: number;
  preload?: 'eager' | 'lazy';
  loopStart?: number;
  loopEnd?: number;
  markers?: AudioMarkerDefinition[];
}

export type AssetDefinition = ImageAssetDefinition | AudioAssetDefinition;

export interface AudioCueDefinition {
  id: string;
  assetIds: string[];
  bus?: AudioBus;
  volume?: number;
  playbackRate?: number;
  playbackRateVariation?: number;
  cooldown?: number;
  maxVoices?: number;
}

export interface AudioSystemDefinition {
  masterVolume?: number;
  buses?: Partial<Record<AudioBus, number>>;
  cues?: AudioCueDefinition[];
}

export interface SceneAudioDefinition {
  music?: string;
  volume?: number;
  fadeIn?: number;
  fadeOut?: number;
  preserveMusic?: boolean;
}

export interface SpriteSheetDefinition {
  id: string;
  src: string;
  columns: number;
  rows: number;
  frameCount: number;
  fps: number;
  loop: boolean;
  scale?: number;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  title: string;
  portrait: string;
  speed: number;
  focusSpeed: number;
  hitRadius: number;
  shotPower: number;
  animations: Record<'idle' | 'moveLeft' | 'moveRight', SpriteSheetDefinition>;
}

export type BulletMotionDefinition =
  | { type: 'linear' }
  | { type: 'accelerated'; acceleration: number }
  | { type: 'spiral'; angularVelocity: number }
  | { type: 'sine'; amplitude: number; frequency: number }
  | { type: 'homing'; turnRate: number; duration: number }
  | { type: 'orbit'; angularVelocity: number; radialSpeed: number };

export type EmitterShapeDefinition =
  | { type: 'ring'; count: number }
  | { type: 'fan'; count: number; spread: number; aimed: boolean }
  | { type: 'stream'; count: number; angle: number; angleStep: number };

export interface BulletStyleDefinition {
  color: string;
  glow: string;
  radius: number;
  shape: 'orb' | 'needle' | 'diamond' | 'star';
}

export interface PatternDefinition {
  id: string;
  name: string;
  interval: number;
  duration: number;
  speed: number;
  angleOffset: number;
  emitter: EmitterShapeDefinition;
  motion: BulletMotionDefinition;
  style: BulletStyleDefinition;
}

export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte';

export interface StageCondition {
  variable: string;
  operator: ComparisonOperator;
  value: string | number | boolean;
}

export interface StageTransition {
  type: 'onComplete' | 'onEnemyDefeated' | 'onVariable';
  targetStageId?: string;
  targetSceneId?: string;
  condition?: StageCondition;
}

export type TimelineEvent =
  | { id: string; type: 'playMusic'; at: number; assetId: string; loop: boolean; volume?: number; fadeIn?: number; restart?: boolean }
  | { id: string; type: 'stopMusic'; at: number; fadeOut?: number }
  | { id: string; type: 'playSound'; at: number; cueId: string; volume?: number }
  | { id: string; type: 'dialogue'; at: number; speaker: string; text: string; portrait?: string }
  | { id: string; type: 'spawnEnemy'; at: number; enemy: EnemyDefinition }
  | { id: string; type: 'moveEnemy'; at: number; enemyId: string; to: Vector2; duration: number }
  | { id: string; type: 'startPattern'; at: number; ownerId: string; pattern: PatternDefinition }
  | { id: string; type: 'stopPattern'; at: number; ownerId: string; patternId?: string }
  | { id: string; type: 'setVariable'; at: number; name: string; value: string | number | boolean }
  | { id: string; type: 'wait'; at: number; duration: number }
  | { id: string; type: 'emit'; at: number; name: string; payload?: unknown };

export interface EnemyAnimationEvent {
  at: number;
  animation: SpriteSheetDefinition;
}

export interface EnemyDefinition {
  id: string;
  name: string;
  position: Vector2;
  health: number;
  hitRadius: number;
  portrait?: string;
  idleAnimation: SpriteSheetDefinition;
  animationTimeline?: EnemyAnimationEvent[];
}

export interface LevelStage {
  id: string;
  name: string;
  duration: number;
  timeline: TimelineEvent[];
  transitions: StageTransition[];
  editorPosition?: Vector2;
}

export interface LevelDefinition {
  id: string;
  name: string;
  subtitle: string;
  initialStageId: string;
  playfield: { width: number; height: number };
  variables: Record<string, string | number | boolean>;
  stages: LevelStage[];
}

export type RuntimeEventMap = {
  'scene:change': { from: string; to: string };
  'stage:enter': { stageId: string };
  'stage:complete': { stageId: string };
  'enemy:spawned': { enemyId: string };
  'enemy:defeated': { enemyId: string };
  'pattern:start': { ownerId: string; pattern: PatternDefinition };
  'pattern:stop': { ownerId: string; patternId?: string };
  'dialogue:open': Extract<TimelineEvent, { type: 'dialogue' }>;
  'dialogue:close': { eventId: string };
  'variable:set': { name: string; value: string | number | boolean };
  'level:complete': { levelId: string };
  'player:hit': { lives: number };
  'score:change': { score: number };
  'audio:marker': { assetId: string; markerId: string; action: AudioMarkerAction };
  'script:emit': { name: string; payload?: unknown };
};
