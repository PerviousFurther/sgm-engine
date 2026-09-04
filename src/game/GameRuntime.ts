import { AssetStore } from '../core/AssetStore';
import { AudioManager } from '../core/AudioManager';
import { BulletEngine } from '../core/BulletEngine';
import { EventBus } from '../core/EventBus';
import { LevelInterpreter } from '../core/LevelInterpreter';
import { ObjectPool } from '../core/ObjectPool';
import { drawSpriteFrame } from '../core/SpriteAnimator';
import type { CharacterDefinition, EnemyDefinition, LevelDefinition, RuntimeEventMap, TimelineEvent, Vector2 } from '../core/types';

interface EnemyState {
  definition: EnemyDefinition;
  position: Vector2;
  health: number;
  spawnedAt: number;
  move?: { from: Vector2; to: Vector2; elapsed: number; duration: number };
}

interface PlayerShot extends Vector2 { speed: number }

export interface GameSnapshot {
  score: number;
  lives: number;
  graze: number;
  bossHealth: number;
  bossMaxHealth: number;
  stageName: string;
  stageTime: number;
  bulletCount: number;
  spellName?: string;
  dialogue?: Extract<TimelineEvent, { type: 'dialogue' }>;
  skipProgress: number;
  focus: boolean;
}

export interface GameRuntimeOptions {
  canvas: HTMLCanvasElement;
  level: LevelDefinition;
  character: CharacterDefinition;
  assets: AssetStore;
  audio: AudioManager;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onComplete: (targetSceneId?: string) => void;
}

export class GameRuntime {
  private readonly context: CanvasRenderingContext2D;
  private readonly bus = new EventBus<RuntimeEventMap>();
  private readonly bulletEngine = new BulletEngine();
  private readonly interpreter: LevelInterpreter;
  private readonly enemies = new Map<string, EnemyState>();
  private readonly playerShots: PlayerShot[] = [];
  private readonly playerShotPool = new ObjectPool<PlayerShot>({
    create: () => ({ x: 0, y: 0, speed: 0 }),
    maxRetained: 64,
  });
  private readonly keys = new Set<string>();
  private player: Vector2;
  private animationFrame = 0;
  private lastTime = 0;
  private elapsed = 0;
  private shotClock = 0;
  private invulnerable = 0;
  private score = 0;
  private lives = 3;
  private graze = 0;
  private dialogue?: Extract<TimelineEvent, { type: 'dialogue' }>;
  private skipProgress = 0;
  private spellName?: string;
  private lastSnapshotAt = 0;
  private completeSent = false;
  private unbind: Array<() => void> = [];

  constructor(private readonly options: GameRuntimeOptions) {
    const context = options.canvas.getContext('2d');
    if (!context) throw new Error('当前浏览器不支持 Canvas 2D');
    this.context = context;
    options.canvas.width = options.level.playfield.width;
    options.canvas.height = options.level.playfield.height;
    this.player = { x: options.level.playfield.width / 2, y: options.level.playfield.height - 92 };

    this.interpreter = new LevelInterpreter(options.level, this.bus, options.audio, {
      onTimelineEvent: (event) => this.handleTimelineEvent(event),
      onSceneRequested: (sceneId) => this.complete(sceneId),
    });
    this.bindEvents();
    this.unbind.push(options.audio.onMarker((event) => {
      this.bus.emit('audio:marker', event);
      this.interpreter.handleAudioMarker(event.action);
    }));
  }

  start(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.lastTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.loop);
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.unbind.forEach((off) => off());
    this.bus.clear();
    this.bulletEngine.clear();
    this.clearPlayerShots();
  }

  private bindEvents(): void {
    this.unbind.push(
      this.bus.on('pattern:start', ({ ownerId, pattern }) => {
        this.bulletEngine.startPattern(ownerId, pattern, () => this.enemies.get(ownerId)?.position);
      }),
      this.bus.on('pattern:stop', ({ ownerId, patternId }) => this.bulletEngine.stopPattern(ownerId, patternId)),
      this.bus.on('dialogue:open', (event) => { this.dialogue = event; this.skipProgress = 0; this.publishSnapshot(true); }),
      this.bus.on('dialogue:close', () => { this.dialogue = undefined; this.skipProgress = 0; this.publishSnapshot(true); }),
      this.bus.on('stage:enter', () => { this.spellName = undefined; this.publishSnapshot(true); }),
      this.bus.on('script:emit', ({ name, payload }) => this.handleScriptEvent(name, payload)),
    );
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => { this.keys.delete(event.code); };

  private readonly loop = (now: number): void => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.034);
    this.lastTime = now;
    this.elapsed += dt;
    this.update(dt);
    this.draw();
    this.publishSnapshot(false);
    if (!this.completeSent) this.animationFrame = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (this.dialogue) {
      if (this.keys.has('KeyZ')) {
        this.skipProgress = Math.min(1, this.skipProgress + dt / 0.55);
        if (this.skipProgress >= 1) this.interpreter.closeDialogue();
      } else {
        this.skipProgress = Math.max(0, this.skipProgress - dt * 2.5);
      }
      return;
    }

    this.interpreter.update(dt);
    if (this.dialogue) return;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.bulletEngine.update(dt, this.player, this.options.level.playfield);
    this.updateShots(dt);
    this.checkBulletCollisions(dt);
  }

  private updatePlayer(dt: number): void {
    const horizontal = Number(this.keys.has('ArrowRight') || this.keys.has('KeyD')) - Number(this.keys.has('ArrowLeft') || this.keys.has('KeyA'));
    const vertical = Number(this.keys.has('ArrowDown') || this.keys.has('KeyS')) - Number(this.keys.has('ArrowUp') || this.keys.has('KeyW'));
    const length = Math.hypot(horizontal, vertical) || 1;
    const focus = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = focus ? this.options.character.focusSpeed : this.options.character.speed;
    this.player.x = Math.max(22, Math.min(this.options.level.playfield.width - 22, this.player.x + horizontal / length * speed * dt));
    this.player.y = Math.max(32, Math.min(this.options.level.playfield.height - 24, this.player.y + vertical / length * speed * dt));
    this.shotClock -= dt;
    if ((this.keys.has('KeyZ') || this.keys.has('Space')) && this.shotClock <= 0) {
      this.shotClock = 0.085;
      this.spawnPlayerShot(this.player.x - 9, this.player.y - 23);
      this.spawnPlayerShot(this.player.x + 9, this.player.y - 23);
      this.options.audio.playCue('playerShot');
    }
  }

  private updateEnemies(dt: number): void {
    this.enemies.forEach((enemy) => {
      if (!enemy.move) return;
      enemy.move.elapsed += dt;
      const t = Math.min(1, enemy.move.elapsed / enemy.move.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      enemy.position.x = enemy.move.from.x + (enemy.move.to.x - enemy.move.from.x) * eased;
      enemy.position.y = enemy.move.from.y + (enemy.move.to.y - enemy.move.from.y) * eased;
      if (t >= 1) enemy.move = undefined;
    });
  }

  private updateShots(dt: number): void {
    for (let i = this.playerShots.length - 1; i >= 0; i -= 1) {
      const shot = this.playerShots[i];
      shot.y -= shot.speed * dt;
      let hit = false;
      for (const [id, enemy] of this.enemies) {
        if (Math.hypot(shot.x - enemy.position.x, shot.y - enemy.position.y) <= enemy.definition.hitRadius + 4) {
          enemy.health -= this.options.character.shotPower;
          this.score += 120;
          this.options.audio.playCue('enemyHit');
          hit = true;
          if (enemy.health <= 0) this.defeatEnemy(id);
          break;
        }
      }
      if (hit || shot.y < -20) this.removePlayerShotAt(i);
    }
  }

  private checkBulletCollisions(dt: number): void {
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    for (let i = this.bulletEngine.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bulletEngine.bullets[i];
      const dx = bullet.position.x - this.player.x;
      const dy = bullet.position.y - this.player.y;
      const distanceSquared = dx * dx + dy * dy;
      const hitDistance = this.options.character.hitRadius + bullet.style.radius;
      const grazeDistance = 25 + bullet.style.radius;
      if (distanceSquared < hitDistance * hitDistance && this.invulnerable <= 0) {
        this.bulletEngine.removeBulletAt(i);
        this.lives -= 1;
        this.options.audio.playCue('playerHit');
        this.invulnerable = 2.2;
        this.bus.emit('player:hit', { lives: this.lives });
        if (this.lives < 0) this.complete();
      } else if (distanceSquared < grazeDistance * grazeDistance && !bullet.grazed) {
        bullet.grazed = true;
        this.graze += 1;
        this.score += 20;
        this.options.audio.playCue('graze');
      }
    }
  }

  private handleTimelineEvent(event: TimelineEvent): void {
    if (event.type === 'spawnEnemy') {
      this.enemies.set(event.enemy.id, { definition: event.enemy, position: { ...event.enemy.position, y: -90 }, health: event.enemy.health, spawnedAt: this.elapsed });
    } else if (event.type === 'moveEnemy') {
      const enemy = this.enemies.get(event.enemyId);
      if (enemy) enemy.move = { from: { ...enemy.position }, to: { ...event.to }, elapsed: 0, duration: event.duration };
    }
  }

  private handleScriptEvent(name: string, payload?: unknown): void {
    if (name === 'spell-card') {
      this.spellName = String(payload ?? '');
      this.options.audio.playCue('spellStart');
    }
  }

  private defeatEnemy(id: string): void {
    this.enemies.delete(id);
    this.bulletEngine.removeOwner(id);
    this.bulletEngine.clearBullets();
    this.score += 100000;
    this.options.audio.playCue('enemyDefeat');
    this.interpreter.notifyEnemyDefeated(id);
  }

  private complete(targetSceneId?: string): void {
    if (this.completeSent) return;
    this.completeSent = true;
    this.options.onSnapshot(this.snapshot());
    window.setTimeout(() => this.options.onComplete(targetSceneId), 600);
  }

  private spawnPlayerShot(x: number, y: number): void {
    const shot = this.playerShotPool.acquire();
    shot.x = x;
    shot.y = y;
    shot.speed = 560;
    this.playerShots.push(shot);
  }

  private removePlayerShotAt(index: number): void {
    const shot = this.playerShots[index];
    const last = this.playerShots.pop();
    if (last && index < this.playerShots.length) this.playerShots[index] = last;
    this.playerShotPool.release(shot);
  }

  private clearPlayerShots(): void {
    for (const shot of this.playerShots) this.playerShotPool.release(shot);
    this.playerShots.length = 0;
  }

  private publishSnapshot(force: boolean): void {
    if (!force && this.elapsed - this.lastSnapshotAt < 0.1) return;
    this.lastSnapshotAt = this.elapsed;
    this.options.onSnapshot(this.snapshot());
  }

  private snapshot(): GameSnapshot {
    const boss = [...this.enemies.values()][0];
    return {
      score: this.score, lives: Math.max(0, this.lives), graze: this.graze,
      bossHealth: Math.max(0, boss?.health ?? 0), bossMaxHealth: boss?.definition.health ?? 1,
      stageName: this.interpreter.currentStage.name, stageTime: this.interpreter.elapsed,
      bulletCount: this.bulletEngine.bullets.length, spellName: this.spellName,
      dialogue: this.dialogue, skipProgress: this.skipProgress,
      focus: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  private draw(): void {
    const { width, height } = this.options.level.playfield;
    const context = this.context;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0d122d'); gradient.addColorStop(0.5, '#171331'); gradient.addColorStop(1, '#090816');
    context.fillStyle = gradient; context.fillRect(0, 0, width, height);
    this.drawBackground(context, width, height);
    this.drawEnemies(context);
    this.drawPlayer(context);
    this.playerShots.forEach((shot) => {
      context.save(); context.shadowColor = '#ff8ed7'; context.shadowBlur = 12; context.fillStyle = '#fff4fb';
      context.fillRect(shot.x - 2, shot.y - 12, 4, 18); context.restore();
    });
    this.bulletEngine.draw(context);
    context.strokeStyle = 'rgba(255,255,255,.12)'; context.lineWidth = 2; context.strokeRect(1, 1, width - 2, height - 2);
  }

  private drawBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
    context.save();
    for (let i = 0; i < 52; i += 1) {
      const x = (i * 83.37) % width;
      const y = (i * 157.71 + this.elapsed * (18 + i % 4 * 8)) % height;
      const radius = 0.6 + (i % 3) * 0.45;
      context.fillStyle = `rgba(${160 + i % 80}, ${180 + i % 60}, 255, ${0.2 + (i % 5) * 0.1})`;
      context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    }
    context.strokeStyle = 'rgba(97, 125, 211, .08)'; context.lineWidth = 1;
    const offset = (this.elapsed * 25) % 48;
    for (let y = -48 + offset; y < height; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y + 90); context.stroke(); }
    context.restore();
  }

  private drawEnemies(context: CanvasRenderingContext2D): void {
    this.enemies.forEach((enemy) => {
      this.drawBossAura(context, enemy);
      let animation = enemy.definition.idleAnimation;
      for (const event of enemy.definition.animationTimeline ?? []) {
        if (this.elapsed - enemy.spawnedAt >= event.at) animation = event.animation;
      }
      const image = this.options.assets.image(animation.src);
      if (image) drawSpriteFrame(context, image, animation, this.elapsed - enemy.spawnedAt, enemy.position.x, enemy.position.y, 132, 132);
      else { context.fillStyle = '#8a6cff'; context.beginPath(); context.arc(enemy.position.x, enemy.position.y, 28, 0, Math.PI * 2); context.fill(); }
    });
  }

  private drawBossAura(context: CanvasRenderingContext2D, enemy: EnemyState): void {
    const { x, y } = enemy.position;
    const pulse = 1 + Math.sin(this.elapsed * 2.4) * 0.06;
    const radius = Math.max(58, enemy.definition.hitRadius * 2.7) * pulse;
    const glow = context.createRadialGradient(x, y, enemy.definition.hitRadius * 0.45, x, y, radius);
    glow.addColorStop(0, 'rgba(255, 238, 250, .3)');
    glow.addColorStop(.38, 'rgba(227, 78, 151, .16)');
    glow.addColorStop(1, 'rgba(120, 78, 220, 0)');
    context.save();
    context.fillStyle = glow;
    context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
    context.translate(x, y);
    context.rotate(this.elapsed * 0.22);
    context.strokeStyle = 'rgba(255, 190, 226, .38)';
    context.lineWidth = 1.2;
    context.setLineDash([7, 10]);
    context.beginPath(); context.arc(0, 0, radius * .72, 0, Math.PI * 2); context.stroke();
    context.restore();
  }

  private drawPlayer(context: CanvasRenderingContext2D): void {
    if (this.invulnerable > 0 && Math.floor(this.elapsed * 12) % 2) return;
    const sheet = this.options.character.animations.idle;
    const image = this.options.assets.image(sheet.src);
    if (image) drawSpriteFrame(context, image, sheet, this.elapsed, this.player.x, this.player.y, 82, 82);
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      context.save(); context.strokeStyle = '#ff496f'; context.shadowColor = '#ff496f'; context.shadowBlur = 10; context.lineWidth = 1.5;
      context.beginPath(); context.arc(this.player.x, this.player.y, 4, 0, Math.PI * 2); context.stroke(); context.restore();
    }
  }
}
