import type { BulletMotionDefinition, BulletStyleDefinition, PatternDefinition, Vector2 } from './types';
import { ObjectPool } from './ObjectPool';

export interface Bullet {
  id: number;
  ownerId: string;
  patternId: string;
  position: Vector2;
  origin: Vector2;
  velocity: Vector2;
  speed: number;
  angle: number;
  age: number;
  motion: BulletMotionDefinition;
  style: BulletStyleDefinition;
  grazed?: boolean;
}

interface ActivePattern {
  ownerId: string;
  definition: PatternDefinition;
  elapsed: number;
  shotClock: number;
  volley: number;
  origin: () => Vector2 | undefined;
}

const TAU = Math.PI * 2;
const EMPTY_MOTION: BulletMotionDefinition = { type: 'linear' };
const EMPTY_STYLE: BulletStyleDefinition = { color: '', glow: '', radius: 0, shape: 'orb' };

export class BulletEngine {
  readonly bullets: Bullet[] = [];
  private patterns: ActivePattern[] = [];
  private nextBulletId = 1;
  private readonly bulletPool = new ObjectPool<Bullet>({
    create: () => ({
      id: 0,
      ownerId: '',
      patternId: '',
      position: { x: 0, y: 0 },
      origin: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      speed: 0,
      angle: 0,
      age: 0,
      motion: EMPTY_MOTION,
      style: EMPTY_STYLE,
    }),
    reset: (bullet) => { bullet.grazed = undefined; },
    maxRetained: 4096,
  });

  startPattern(ownerId: string, definition: PatternDefinition, origin: () => Vector2 | undefined): void {
    this.stopPattern(ownerId, definition.id);
    this.patterns.push({ ownerId, definition, elapsed: 0, shotClock: definition.interval, volley: 0, origin });
  }

  stopPattern(ownerId: string, patternId?: string): void {
    this.patterns = this.patterns.filter((active) => active.ownerId !== ownerId || (patternId && active.definition.id !== patternId));
  }

  removeOwner(ownerId: string): void {
    this.stopPattern(ownerId);
  }

  clear(): void {
    this.patterns = [];
    this.clearBullets();
  }

  clearBullets(): void {
    for (const bullet of this.bullets) this.bulletPool.release(bullet);
    this.bullets.length = 0;
  }

  removeBulletAt(index: number): void {
    if (index < 0 || index >= this.bullets.length) return;
    const bullet = this.bullets[index];
    const last = this.bullets.pop();
    if (last && index < this.bullets.length) this.bullets[index] = last;
    this.bulletPool.release(bullet);
  }

  update(dt: number, player: Vector2, bounds: { width: number; height: number }): void {
    for (const active of [...this.patterns]) {
      active.elapsed += dt;
      active.shotClock += dt;
      const origin = active.origin();
      if (!origin || active.elapsed > active.definition.duration) {
        this.stopPattern(active.ownerId, active.definition.id);
        continue;
      }
      while (active.shotClock >= active.definition.interval) {
        active.shotClock -= active.definition.interval;
        this.emitVolley(active, origin, player);
        active.volley += 1;
      }
    }

    let writeIndex = 0;
    for (const bullet of this.bullets) {
      bullet.age += dt;
      this.applyMotion(bullet, dt, player);
      bullet.position.x += bullet.velocity.x * dt;
      bullet.position.y += bullet.velocity.y * dt;
      const margin = 80;
      if (bullet.position.x < -margin || bullet.position.x > bounds.width + margin || bullet.position.y < -margin || bullet.position.y > bounds.height + margin || bullet.age > 18) {
        this.bulletPool.release(bullet);
        continue;
      }
      this.bullets[writeIndex] = bullet;
      writeIndex += 1;
    }
    this.bullets.length = writeIndex;
  }

  draw(context: CanvasRenderingContext2D): void {
    const groups = new Map<BulletStyleDefinition, Bullet[]>();
    for (const bullet of this.bullets) {
      const group = groups.get(bullet.style);
      if (group) group.push(bullet);
      else groups.set(bullet.style, [bullet]);
    }

    const simplifyEffects = this.bullets.length > 300;
    context.save();
    context.globalCompositeOperation = simplifyEffects ? 'source-over' : 'lighter';
    for (const [style, bullets] of groups) {
      const radius = style.radius;
      context.shadowColor = style.glow;
      context.shadowBlur = simplifyEffects ? 0 : radius * 2.4;
      context.fillStyle = style.color;
      context.strokeStyle = 'rgba(255,255,255,.88)';
      context.lineWidth = 1;
      context.beginPath();
      for (const bullet of bullets) {
        const { x, y } = bullet.position;
        if (style.shape === 'orb') {
          context.moveTo(x + radius, y);
          context.arc(x, y, radius, 0, TAU);
          continue;
        }

        const rotation = Math.atan2(bullet.velocity.y, bullet.velocity.x) + Math.PI / 2;
        if (style.shape === 'needle') {
          context.moveTo(x + Math.cos(rotation) * radius * 0.58, y + Math.sin(rotation) * radius * 0.58);
          context.ellipse(x, y, radius * 0.58, radius * 2.2, rotation, 0, TAU);
        } else if (style.shape === 'diamond') {
          for (let point = 0; point < 4; point += 1) {
            const angle = rotation - Math.PI / 2 + point * Math.PI / 2;
            const length = point % 2 ? radius : radius * 1.5;
            const px = x + Math.cos(angle) * length;
            const py = y + Math.sin(angle) * length;
            point ? context.lineTo(px, py) : context.moveTo(px, py);
          }
          context.closePath();
        } else {
          for (let point = 0; point < 10; point += 1) {
            const angle = rotation - Math.PI / 2 + point * Math.PI / 5;
            const length = point % 2 ? radius * 0.45 : radius * 1.35;
            const px = x + Math.cos(angle) * length;
            const py = y + Math.sin(angle) * length;
            point ? context.lineTo(px, py) : context.moveTo(px, py);
          }
          context.closePath();
        }
      }
      context.fill();
      context.stroke();
    }
    context.restore();
  }

  private emitVolley(active: ActivePattern, origin: Vector2, player: Vector2): void {
    const pattern = active.definition;
    const aimed = Math.atan2(player.y - origin.y, player.x - origin.x);
    let angles: number[] = [];
    const emitter = pattern.emitter;
    if (emitter.type === 'ring') {
      angles = Array.from({ length: emitter.count }, (_, index) => index * TAU / emitter.count);
    } else if (emitter.type === 'fan') {
      const center = emitter.aimed ? aimed : Math.PI / 2;
      const start = center - emitter.spread / 2;
      angles = Array.from({ length: emitter.count }, (_, index) => emitter.count === 1 ? center : start + emitter.spread * index / (emitter.count - 1));
    } else {
      angles = Array.from({ length: emitter.count }, (_, index) => emitter.angle + index * emitter.angleStep);
    }
    const rotatingOffset = pattern.angleOffset + active.volley * (pattern.motion.type === 'spiral' ? pattern.motion.angularVelocity * pattern.interval : 0.075);
    angles.forEach((value) => {
      const angle = value + rotatingOffset;
      const bullet = this.bulletPool.acquire();
      bullet.id = this.nextBulletId++;
      bullet.ownerId = active.ownerId;
      bullet.patternId = pattern.id;
      bullet.position.x = origin.x;
      bullet.position.y = origin.y;
      bullet.origin.x = origin.x;
      bullet.origin.y = origin.y;
      bullet.velocity.x = Math.cos(angle) * pattern.speed;
      bullet.velocity.y = Math.sin(angle) * pattern.speed;
      bullet.speed = pattern.speed;
      bullet.angle = angle;
      bullet.age = 0;
      bullet.motion = pattern.motion;
      bullet.style = pattern.style;
      bullet.grazed = undefined;
      this.bullets.push(bullet);
    });
  }

  private applyMotion(bullet: Bullet, dt: number, player: Vector2): void {
    const motion = bullet.motion;
    if (motion.type === 'linear') return;
    let angle = Math.atan2(bullet.velocity.y, bullet.velocity.x);
    let speed = Math.hypot(bullet.velocity.x, bullet.velocity.y);
    if (motion.type === 'accelerated') {
      speed = Math.max(12, speed + motion.acceleration * dt);
    } else if (motion.type === 'spiral') {
      angle += motion.angularVelocity * dt;
    } else if (motion.type === 'sine') {
      const wave = Math.sin(bullet.age * motion.frequency * TAU) * motion.amplitude;
      angle = bullet.angle + wave;
    } else if (motion.type === 'homing' && bullet.age <= motion.duration) {
      const desired = Math.atan2(player.y - bullet.position.y, player.x - bullet.position.x);
      const delta = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
      angle += Math.sign(delta) * Math.min(Math.abs(delta), motion.turnRate * dt);
    } else if (motion.type === 'orbit') {
      angle += motion.angularVelocity * dt;
      speed = Math.max(10, speed + motion.radialSpeed * dt);
    }
    bullet.velocity.x = Math.cos(angle) * speed;
    bullet.velocity.y = Math.sin(angle) * speed;
  }
}
