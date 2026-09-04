import type { AudioAssetDefinition, GameProjectDefinition, PatternDefinition, SpriteSheetDefinition } from '../core/types';
import { demoProject } from './demoProject';

export const projectStorageKey = 'mistbound-fantasia-project';

export function loadProject(): GameProjectDefinition {
  try {
    const saved = localStorage.getItem(projectStorageKey);
    if (!saved) return structuredClone(demoProject);
    const project = JSON.parse(saved) as GameProjectDefinition;
    if (!project.scenes?.length || !project.levels?.length || !project.characters?.length) throw new Error('项目结构不完整');
    return migrateProject(project);
  } catch {
    return structuredClone(demoProject);
  }
}

function migrateProject(project: GameProjectDefinition): GameProjectDefinition {
  const assets = project.assets.map((asset) => asset.type === 'audio'
    ? { category: 'music', defaultVolume: 1, preload: 'eager', ...asset } as AudioAssetDefinition
    : asset);
  return {
    ...project,
    version: Math.max(2, project.version ?? 1),
    assets,
    audio: project.audio ?? { masterVolume: 1, buses: { music: 0.7, sfx: 0.85, voice: 1 }, cues: [] },
  };
}

export function collectPatterns(project: GameProjectDefinition): PatternDefinition[] {
  const patterns = new Map<string, PatternDefinition>();
  project.levels.forEach((level) => level.stages.forEach((stage) => stage.timeline.forEach((event) => {
    if (event.type === 'startPattern') patterns.set(event.pattern.id, structuredClone(event.pattern));
  })));
  return [...patterns.values()];
}

export function collectAnimations(project: GameProjectDefinition): SpriteSheetDefinition[] {
  const animations = new Map<string, SpriteSheetDefinition>();
  project.characters.forEach((character) => Object.values(character.animations).forEach((animation) => animations.set(animation.id, structuredClone(animation))));
  project.levels.forEach((level) => level.stages.forEach((stage) => stage.timeline.forEach((event) => {
    if (event.type !== 'spawnEnemy') return;
    animations.set(event.enemy.idleAnimation.id, structuredClone(event.enemy.idleAnimation));
    event.enemy.animationTimeline?.forEach((entry) => animations.set(entry.animation.id, structuredClone(entry.animation)));
  })));
  return [...animations.values()];
}
