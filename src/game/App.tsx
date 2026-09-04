import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, Code2, Sparkles, WandSparkles } from 'lucide-react';
import { AssetStore } from '../core/AssetStore';
import { AudioManager } from '../core/AudioManager';
import { EventBus } from '../core/EventBus';
import { SceneDirector } from '../core/SceneDirector';
import type { GameProjectDefinition, RuntimeEventMap, SceneDefinition } from '../core/types';
import { loadProject } from '../data/projectStorage';
import { GameCanvas } from './GameCanvas';
import type { GameSnapshot } from './GameRuntime';

export function App() {
  const project = useMemo(loadProject, []);
  const assets = useMemo(() => new AssetStore(), []);
  const audio = useMemo(() => new AudioManager(project.audio), [project.audio]);
  const bus = useMemo(() => new EventBus<RuntimeEventMap>(), []);
  const director = useMemo(() => new SceneDirector(project, bus), [bus, project]);
  const [scene, setScene] = useState<SceneDefinition>(() => director.current());
  const [selectedCharacter, setSelectedCharacter] = useState(project.characters[0]);
  const [result, setResult] = useState<GameSnapshot>();

  useEffect(() => bus.on('scene:change', ({ to }) => setScene(project.scenes.find((item) => item.id === to)!)), [bus, project.scenes]);
  useEffect(() => {
    audio.enterScene(scene.audio);
    return audio.onMarker(({ action }) => {
      if (scene.kind !== 'gameplay' && action.type === 'requestScene') director.go(action.sceneId);
    });
  }, [audio, director, scene]);
  useEffect(() => {
    const onVisibilityChange = () => { void (document.hidden ? audio.pause() : audio.resume()); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [audio]);
  useEffect(() => () => { void audio.dispose(); }, [audio]);

  const sceneContent = (() => {
    switch (scene.kind) {
      case 'title': return <TitleScene onStart={() => { void audio.unlock(); director.next(); }} />;
      case 'selection': return <SelectionScene onSelect={() => { setSelectedCharacter(project.characters[0]); director.next(); }} />;
      case 'loading': return <LoadingScene assets={assets} audio={audio} project={project} onReady={() => director.next()} />;
      case 'gameplay': {
        const level = project.levels.find((item) => item.id === scene.levelId)!;
        return <GameCanvas level={level} character={selectedCharacter} assets={assets} audio={audio} onComplete={(snapshot, targetSceneId) => { setResult(snapshot); targetSceneId ? director.go(targetSceneId) : director.next(); }} />;
      }
      case 'result': return <ResultScene result={result} onNext={() => director.next()} onRetry={() => director.go('gameplay')} />;
      case 'ending': return <EndingScene onNext={() => director.next()} />;
      case 'credits': return <CreditsScene onRestart={() => director.go('title')} />;
    }
  })();

  return <main className={`game-app scene-${scene.kind}`}>{sceneContent}</main>;
}

function TitleScene({ onStart }: { onStart: () => void }) {
  return (
    <section className="title-scene scene-panel">
      <div className="title-mist mist-one" /><div className="title-mist mist-two" />
      <div className="title-copy">
        <p className="eyebrow">东方风弹幕射击 · SCRIPTED DANMAKU</p>
        <h1><span>雾隐</span><br />幻想乡</h1>
        <p className="title-reading">MISTBOUND FANTASIA</p>
        <button className="primary-action" onClick={onStart}>开始游戏 <ArrowRight size={18} /></button>
        <a className="editor-link" href="/editor.html"><WandSparkles size={16} /> 打开弹幕工房</a>
      </div>
      <img className="title-character" src="/char-0.png" alt="博丽灵梦" />
      <div className="title-seal">博<br />丽</div>
      <div className="title-footer"><span>键盘操作推荐</span><ChevronDown size={17} /></div>
    </section>
  );
}

function SelectionScene({ onSelect }: { onSelect: () => void }) {
  return (
    <section className="selection-scene scene-panel">
      <header className="scene-heading"><span>PLAYER SELECT</span><h2>选择自机</h2><p>选择即将跨越境界的少女</p></header>
      <button className="character-card selected" onClick={onSelect}>
        <div className="card-index">01</div>
        <img src="/char-0.png" alt="博丽灵梦" />
        <div className="character-meta"><small>乐园的巫女</small><strong>博丽 灵梦</strong><p>均衡的移动速度与狭小判定，适合初次挑战。</p><span>确认出击 <ArrowRight size={16} /></span></div>
      </button>
      <div className="locked-card"><Sparkles /><span>更多角色可由项目脚本扩展</span></div>
    </section>
  );
}

function LoadingScene({ assets, audio, project, onReady }: { assets: AssetStore; audio: AudioManager; project: GameProjectDefinition; onReady: () => void }) {
  const [progress, setProgress] = useState(8);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    const interval = window.setInterval(() => setProgress((value) => Math.min(value + 7, 92)), 90);
    Promise.all([assets.load(project.assets), audio.load(project.assets)]).then(() => {
      if (!active) return;
      window.clearInterval(interval); setProgress(100); window.setTimeout(onReady, 450);
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '资源载入失败'));
    return () => { active = false; window.clearInterval(interval); };
  }, [assets, audio, onReady, project.assets]);
  return (
    <section className="loading-scene scene-panel">
      <div className="loading-sigil"><i /><span>境</span></div>
      <p>正在展开境界</p><h2>{error ?? '月影魔导书'}</h2>
      <div className="loading-track"><span style={{ width: `${progress}%` }} /></div><small>{progress}% · 载入脚本与幻想资源</small>
    </section>
  );
}

function ResultScene({ result, onNext, onRetry }: { result?: GameSnapshot; onNext: () => void; onRetry: () => void }) {
  return (
    <section className="result-scene scene-panel">
      <div className="result-card">
        <span className="result-kicker">STAGE CLEAR</span><h2>符卡突破</h2><p>星辰的咒文在针尖般的灵力中碎成了光。</p>
        <div className="result-grid"><div><span>最终得分</span><strong>{(result?.score ?? 0).toLocaleString()}</strong></div><div><span>擦弹</span><strong>{result?.graze ?? 0}</strong></div><div><span>残机</span><strong>{result?.lives ?? 0}</strong></div></div>
        <div className="result-actions"><button className="primary-action" onClick={onNext}>继续故事 <ArrowRight size={18} /></button><button className="ghost-action" onClick={onRetry}>再次挑战</button></div>
      </div>
    </section>
  );
}

function EndingScene({ onNext }: { onNext: () => void }) {
  return (
    <section className="ending-scene scene-panel">
      <img src="/boss-0.png" alt="阿斯特莉德" />
      <div className="ending-copy"><small>ENDING · 01</small><h2>雾散之后，<br />还有一本未还的书</h2><p>图书馆的门重新隐入雾中。灵梦看了看手中的魔导书，决定把“归还期限”留给下一次异变。</p><button className="primary-action" onClick={onNext}>查看制作人员 <ArrowRight size={18} /></button></div>
    </section>
  );
}

function CreditsScene({ onRestart }: { onRestart: () => void }) {
  return (
    <section className="credits-scene scene-panel">
      <div className="credits-mark"><BookOpen /></div><small>MISTBOUND FANTASIA</small><h2>感谢游玩</h2>
      <div className="credits-list"><p><span>ENGINE & EDITOR</span>Component Canvas Runtime</p><p><span>LEVEL SCRIPT</span>Moonlit Library</p><p><span>ASSETS</span>Workspace test resources</p></div>
      <button className="primary-action" onClick={onRestart}>返回标题</button><a href="/editor.html"><Code2 size={15} /> 在编辑器中打开项目</a>
    </section>
  );
}
