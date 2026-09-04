import { useEffect, useRef, useState } from 'react';
import type { AssetStore } from '../core/AssetStore';
import type { AudioManager } from '../core/AudioManager';
import type { CharacterDefinition, LevelDefinition } from '../core/types';
import { GameRuntime, type GameSnapshot } from './GameRuntime';

const emptySnapshot: GameSnapshot = {
  score: 0, lives: 3, graze: 0, bossHealth: 1, bossMaxHealth: 1,
  stageName: '准备中', stageTime: 0, bulletCount: 0, skipProgress: 0, focus: false,
};

interface GameCanvasProps {
  level: LevelDefinition;
  character: CharacterDefinition;
  assets: AssetStore;
  audio: AudioManager;
  onComplete: (snapshot: GameSnapshot, targetSceneId?: string) => void;
}

export function GameCanvas({ level, character, assets, audio, onComplete }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestSnapshot = useRef<GameSnapshot>(emptySnapshot);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(emptySnapshot);

  useEffect(() => {
    if (!canvasRef.current) return;
    const runtime = new GameRuntime({
      canvas: canvasRef.current, level, character, assets, audio,
      onSnapshot: (next) => { latestSnapshot.current = next; setSnapshot(next); },
      onComplete: (targetSceneId) => onComplete(latestSnapshot.current, targetSceneId),
    });
    runtime.start();
    return () => runtime.dispose();
  }, [assets, audio, character, level, onComplete]);

  const healthRatio = snapshot.bossMaxHealth > 1 ? snapshot.bossHealth / snapshot.bossMaxHealth : 0;
  return (
    <div className="gameplay-layout">
      <div className="playfield-wrap">
        <canvas className="playfield" ref={canvasRef} aria-label="弹幕游戏区域" />
        <div className="boss-bar"><span style={{ width: `${healthRatio * 100}%` }} /></div>
        {snapshot.spellName && <div className="spell-banner"><small>SPELL CARD</small>{snapshot.spellName}</div>}
        {snapshot.dialogue && (
          <div className="dialogue-layer">
            {snapshot.dialogue.portrait && <img src={snapshot.dialogue.portrait} alt="角色立绘" />}
            <div className="dialogue-box">
              <strong>{snapshot.dialogue.speaker}</strong>
              <p>{snapshot.dialogue.text}</p>
              <div className="skip-hint">按住 Z 跳过 <span><i style={{ width: `${snapshot.skipProgress * 100}%` }} /></span></div>
            </div>
          </div>
        )}
      </div>
      <aside className="game-hud">
        <div className="hud-brand"><span>STAGE</span><strong>01</strong></div>
        <div className="hud-rule" />
        <div className="hud-stat"><span>SCORE</span><b>{snapshot.score.toString().padStart(9, '0')}</b></div>
        <div className="hud-stat"><span>PLAYER</span><b className="life-icons">{'◆'.repeat(snapshot.lives)}</b></div>
        <div className="hud-stat"><span>GRAZE</span><b>{snapshot.graze.toString().padStart(5, '0')}</b></div>
        <div className="hud-stage"><small>CURRENT PHASE</small><strong>{snapshot.stageName}</strong><span>{snapshot.stageTime.toFixed(1)}s · {snapshot.bulletCount} bullets</span></div>
        <div className="controls-card">
          <span>移动</span><b>方向键 / WASD</b>
          <span>射击 / 对话</span><b>Z / SPACE</b>
          <span>低速移动</span><b>SHIFT</b>
        </div>
        <div className={`focus-status ${snapshot.focus ? 'active' : ''}`}><i />{snapshot.focus ? '低速模式' : '通常模式'}</div>
      </aside>
    </div>
  );
}
