import type { GameProjectDefinition, PatternDefinition, SpriteSheetDefinition } from '../core/types';

export const playerSheet: SpriteSheetDefinition = {
  id: 'reimu-flight', src: '/char-0-ani.png', columns: 4, rows: 3, frameCount: 12, fps: 9, loop: true, scale: 0.22,
};

export const bossIdleSheet: SpriteSheetDefinition = {
  id: 'boss-idle', src: '/boss-0-idle.png', columns: 4, rows: 2, frameCount: 8, fps: 6, loop: true, scale: 0.24,
};

export const bossSkillSheet: SpriteSheetDefinition = {
  id: 'boss-skill', src: '/boss-0-skill.png', columns: 4, rows: 2, frameCount: 8, fps: 7, loop: false, scale: 0.24,
};

export const demoPatterns: PatternDefinition[] = [
  {
    id: 'azure-wheel', name: '苍蓝星轮', interval: 0.42, duration: 22, speed: 92, angleOffset: 0,
    emitter: { type: 'ring', count: 18 },
    motion: { type: 'spiral', angularVelocity: 0.42 },
    style: { color: '#77dcff', glow: '#168dff', radius: 4.5, shape: 'orb' },
  },
  {
    id: 'seeking-runes', name: '追迹符文', interval: 0.72, duration: 20, speed: 108, angleOffset: 0,
    emitter: { type: 'fan', count: 9, spread: 1.35, aimed: true },
    motion: { type: 'homing', turnRate: 0.52, duration: 1.6 },
    style: { color: '#c68bff', glow: '#8f38ff', radius: 4, shape: 'diamond' },
  },
  {
    id: 'moon-tide', name: '月潮回廊', interval: 0.34, duration: 30, speed: 78, angleOffset: -0.35,
    emitter: { type: 'ring', count: 22 },
    motion: { type: 'sine', amplitude: 0.72, frequency: 0.42 },
    style: { color: '#ff88cf', glow: '#ff2a91', radius: 3.8, shape: 'needle' },
  },
  {
    id: 'falling-stars', name: '坠落星群', interval: 0.55, duration: 28, speed: 84, angleOffset: 0,
    emitter: { type: 'fan', count: 13, spread: 2.2, aimed: true },
    motion: { type: 'accelerated', acceleration: 13 },
    style: { color: '#ffe986', glow: '#ff9d2e', radius: 4.2, shape: 'star' },
  },
];

const boss = {
  id: 'boss-astrid', name: '阿斯特莉德', position: { x: 240, y: 142 }, health: 2400, hitRadius: 27,
  portrait: '/boss-0.png', idleAnimation: bossIdleSheet,
  animationTimeline: [{ at: 0, animation: bossSkillSheet }, { at: 1.1, animation: bossIdleSheet }],
};

export const demoProject: GameProjectDefinition = {
  id: 'mistbound-fantasia',
  title: '雾隐幻想乡',
  version: 2,
  initialSceneId: 'title',
  assets: [
    { id: 'player-portrait', type: 'image', src: '/char-0.png' },
    { id: 'player-sheet', type: 'image', src: '/char-0-ani.png' },
    { id: 'boss-portrait', type: 'image', src: '/boss-0.png' },
    { id: 'boss-idle-sheet', type: 'image', src: '/boss-0-idle.png' },
    { id: 'boss-skill-sheet', type: 'image', src: '/boss-0-skill.png' },
    {
      id: 'boss-theme', type: 'audio', src: '/boss-0-theme.mp3', category: 'music', defaultVolume: 0.8,
      markers: [{ id: 'theme-intro-end', at: 4.5, once: true, action: { type: 'emit', name: 'music:intro-end' } }],
    },
  ],
  audio: {
    masterVolume: 1,
    buses: { music: 0.72, sfx: 0.85, voice: 1 },
    cues: [],
  },
  scenes: [
    { id: 'title', kind: 'title', title: '雾隐幻想乡', next: 'selection' },
    { id: 'selection', kind: 'selection', title: '选择自机', next: 'loading' },
    { id: 'loading', kind: 'loading', title: '境界展开', next: 'gameplay' },
    { id: 'gameplay', kind: 'gameplay', title: '第一幕', levelId: 'level-moonlit-library', next: 'result', audio: { music: 'boss-theme', fadeIn: 0.8, fadeOut: 0.6 } },
    { id: 'result', kind: 'result', title: '符卡结算', next: 'ending' },
    { id: 'ending', kind: 'ending', title: '雾散之后', next: 'credits' },
    { id: 'credits', kind: 'credits', title: '制作人员' },
  ],
  characters: [
    {
      id: 'reimu', name: '博丽灵梦', title: '乐园的巫女', portrait: '/char-0.png', speed: 245, focusSpeed: 110, hitRadius: 3.4, shotPower: 15,
      animations: { idle: playerSheet, moveLeft: playerSheet, moveRight: playerSheet },
    },
  ],
  levels: [
    {
      id: 'level-moonlit-library', name: '月影魔导书', subtitle: '雾海中的无名图书馆', initialStageId: 'encounter',
      playfield: { width: 480, height: 720 }, variables: { spell: 0, route: 'normal' },
      stages: [
        {
          id: 'encounter', name: '邂逅', duration: 4.8, editorPosition: { x: 80, y: 130 },
          timeline: [
            { id: 'music', type: 'playMusic', at: 0, assetId: 'boss-theme', loop: true },
            { id: 'boss-in', type: 'spawnEnemy', at: 0.2, enemy: boss },
            { id: 'boss-move', type: 'moveEnemy', at: 0.2, enemyId: 'boss-astrid', to: { x: 240, y: 142 }, duration: 1.4 },
            { id: 'hello', type: 'dialogue', at: 0.7, speaker: '阿斯特莉德', text: '越过雾之境界的巫女……让我看看，你是否读得懂星辰写下的咒文。', portrait: '/boss-0.png' },
            { id: 'reply', type: 'dialogue', at: 1.0, speaker: '博丽灵梦', text: '我只负责把异变的始作俑者带回神社喝茶。弹幕规则，你懂的吧？', portrait: '/char-0.png' },
            { id: 'spell-one', type: 'setVariable', at: 3.5, name: 'spell', value: 1 },
          ],
          transitions: [{ type: 'onComplete', targetStageId: 'star-wheel' }],
        },
        {
          id: 'star-wheel', name: '星轮展开', duration: 24, editorPosition: { x: 340, y: 70 },
          timeline: [
            { id: 'announce-one', type: 'emit', at: 0, name: 'spell-card', payload: '星符「苍蓝回转」' },
            { id: 'wheel-start', type: 'startPattern', at: 0.3, ownerId: 'boss-astrid', pattern: demoPatterns[0] },
            { id: 'seeking-start', type: 'startPattern', at: 5.5, ownerId: 'boss-astrid', pattern: demoPatterns[1] },
            { id: 'spell-two-var', type: 'setVariable', at: 22.5, name: 'spell', value: 2 },
          ],
          transitions: [
            { type: 'onEnemyDefeated', targetSceneId: 'result' },
            { type: 'onComplete', targetStageId: 'moon-corridor' },
          ],
        },
        {
          id: 'moon-corridor', name: '月潮终幕', duration: 34, editorPosition: { x: 340, y: 240 },
          timeline: [
            { id: 'announce-final', type: 'emit', at: 0, name: 'spell-card', payload: '月符「星海回廊」' },
            { id: 'clear-first', type: 'stopPattern', at: 0, ownerId: 'boss-astrid' },
            { id: 'moon-start', type: 'startPattern', at: 0.2, ownerId: 'boss-astrid', pattern: demoPatterns[2] },
            { id: 'stars-start', type: 'startPattern', at: 7, ownerId: 'boss-astrid', pattern: demoPatterns[3] },
          ],
          transitions: [
            { type: 'onEnemyDefeated', targetSceneId: 'result' },
            { type: 'onComplete', targetSceneId: 'result' },
          ],
        },
      ],
    },
  ],
};
