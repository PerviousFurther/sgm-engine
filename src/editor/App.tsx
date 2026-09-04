import { useMemo, useRef, useState } from 'react';
import { Braces, Check, Clapperboard, Download, Gamepad2, Image, Layers3, Music2, Play, Save, Sparkles, Upload } from 'lucide-react';
import type { GameProjectDefinition, PatternDefinition, SpriteSheetDefinition, TimelineEvent } from '../core/types';
import { demoPatterns } from '../data/demoProject';
import { collectAnimations, collectPatterns, loadProject, projectStorageKey } from '../data/projectStorage';
import { AnimationEditor } from './components/AnimationEditor';
import { AudioEditor } from './components/AudioEditor';
import { LevelEditor } from './components/LevelEditor';
import { PatternEditor } from './components/PatternEditor';

type EditorTab = 'level' | 'animation' | 'pattern' | 'audio' | 'project';
export function App() {
  const [project, setProjectState] = useState<GameProjectDefinition>(loadProject);
  const [tab, setTab] = useState<EditorTab>('level');
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('就绪');
  const [selectedPatternId, setSelectedPatternId] = useState(demoPatterns[0].id);
  const [patterns, setPatterns] = useState<PatternDefinition[]>(() => collectPatterns(project).length ? collectPatterns(project) : structuredClone(demoPatterns));
  const [animations, setAnimations] = useState<SpriteSheetDefinition[]>(() => collectAnimations(project));
  const [selectedAnimationId, setSelectedAnimationId] = useState(() => collectAnimations(project)[0]?.id ?? 'reimu-flight');
  const fileInput = useRef<HTMLInputElement>(null);
  const level = project.levels[0];

  const setProject = (next: GameProjectDefinition) => { setProjectState(next); setDirty(true); setNotice('有未保存的更改'); };
  const save = () => { localStorage.setItem(projectStorageKey, JSON.stringify(project)); setDirty(false); setNotice('已保存到浏览器'); };
  const download = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${project.id}.json`; anchor.click(); URL.revokeObjectURL(url); setNotice('项目脚本已导出');
  };
  const importProject = (file?: File) => {
    if (!file) return;
    file.text().then((text) => {
      const imported = JSON.parse(text) as GameProjectDefinition;
      if (!imported.levels || !imported.scenes) throw new Error('不是有效项目脚本');
      const importedPatterns = collectPatterns(imported);
      const importedAnimations = collectAnimations(imported);
      setProject(imported);
      if (importedPatterns.length) { setPatterns(importedPatterns); setSelectedPatternId(importedPatterns[0].id); }
      if (importedAnimations.length) { setAnimations(importedAnimations); setSelectedAnimationId(importedAnimations[0].id); }
      setNotice(`已导入 ${file.name}`);
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : '导入失败'));
  };
  const changePattern = (next: PatternDefinition) => {
    setPatterns((items) => items.map((item) => item.id === next.id ? next : item));
    const levels = project.levels.map((item) => ({ ...item, stages: item.stages.map((stage) => ({ ...stage, timeline: stage.timeline.map((event) => event.type === 'startPattern' && event.pattern.id === next.id ? { ...event, pattern: structuredClone(next) } : event) })) }));
    setProject({ ...project, levels });
  };
  const changeAnimation = (next: SpriteSheetDefinition) => {
    setAnimations((items) => items.map((item) => item.id === next.id ? next : item));
    const characters = project.characters.map((character) => ({ ...character, animations: Object.fromEntries(Object.entries(character.animations).map(([key, value]) => [key, value.id === next.id ? next : value])) as typeof character.animations }));
    const levels = project.levels.map((item) => ({ ...item, stages: item.stages.map((stage) => ({ ...stage, timeline: stage.timeline.map((event): TimelineEvent => {
      if (event.type !== 'spawnEnemy') return event;
      const idleAnimation = event.enemy.idleAnimation.id === next.id ? next : event.enemy.idleAnimation;
      const animationTimeline = event.enemy.animationTimeline?.map((entry) => entry.animation.id === next.id ? { ...entry, animation: next } : entry);
      return { ...event, enemy: { ...event.enemy, idleAnimation, animationTimeline } };
    }) })) }));
    setProject({ ...project, characters, levels });
  };

  const content = useMemo(() => {
    if (tab === 'level') return <LevelEditor level={level} assets={project.assets} audio={project.audio} onChange={(next) => setProject({ ...project, levels: project.levels.map((item) => item.id === next.id ? next : item) })} />;
    if (tab === 'animation') return <AnimationEditor animations={animations} selectedId={selectedAnimationId} onSelect={setSelectedAnimationId} onChange={changeAnimation} />;
    if (tab === 'pattern') return <PatternEditor patterns={patterns} selectedId={selectedPatternId} onSelect={setSelectedPatternId} onChange={changePattern} />;
    if (tab === 'audio') return <AudioEditor project={project} onChange={setProject} />;
    return <ProjectEditor project={project} onApply={setProject} />;
  }, [animations, level, patterns, project, selectedAnimationId, selectedPatternId, tab]);

  return <div className="editor-app"><header className="editor-topbar"><a className="editor-brand" href="/editor.html"><span><Sparkles size={17} /></span><div><strong>弹幕工房</strong><small>DANMAKU WORKSHOP</small></div></a><div className="project-crumb"><span>PROJECT</span><b>{project.title}</b><i>/</i><b>{tab === 'level' ? level.name : tab === 'animation' ? '角色动画' : tab === 'pattern' ? '弹幕模板' : tab === 'audio' ? '音频系统' : '项目脚本'}</b></div><div className="top-actions"><span className={`save-state ${dirty ? 'dirty' : ''}`}><i />{notice}</span><input ref={fileInput} hidden type="file" accept="application/json" onChange={(e) => importProject(e.target.files?.[0])} /><button title="导入 JSON" onClick={() => fileInput.current?.click()}><Upload size={16} /></button><button title="导出 JSON" onClick={download}><Download size={16} /></button><button className="save-button" onClick={save}><Save size={15} />保存</button><a className="run-button" href="/game.html" target="_blank" onClick={save}><Play size={15} fill="currentColor" />运行游戏</a></div></header><div className="editor-body"><nav className="tool-rail"><button className={tab === 'level' ? 'active' : ''} onClick={() => setTab('level')}><Layers3 /><span>关卡</span></button><button className={tab === 'animation' ? 'active' : ''} onClick={() => setTab('animation')}><Image /><span>动画</span></button><button className={tab === 'pattern' ? 'active' : ''} onClick={() => setTab('pattern')}><Sparkles /><span>弹幕</span></button><button className={tab === 'audio' ? 'active' : ''} onClick={() => setTab('audio')}><Music2 /><span>音频</span></button><button className={tab === 'project' ? 'active' : ''} onClick={() => setTab('project')}><Braces /><span>脚本</span></button><a href="/game.html"><Gamepad2 /><span>游戏</span></a></nav><main className="editor-main">{content}</main></div></div>;
}

function ProjectEditor({ project, onApply }: { project: GameProjectDefinition; onApply: (project: GameProjectDefinition) => void }) {
  const [source, setSource] = useState(() => JSON.stringify(project, null, 2));
  const [message, setMessage] = useState('JSON 与类型化定义互相映射');
  const apply = () => { try { const parsed = JSON.parse(source) as GameProjectDefinition; if (!parsed.scenes || !parsed.levels) throw new Error('缺少 scenes 或 levels'); onApply(parsed); setMessage('脚本已应用'); } catch (error) { setMessage(error instanceof Error ? error.message : 'JSON 无效'); } };
  return <div className="project-workspace"><section className="flow-panel"><div className="panel-heading"><div><small>SCENE FLOW</small><h2>游戏场景流</h2><p>完整场景是项目级定义，不属于关卡阶段。</p></div></div><div className="scene-flow">{project.scenes.map((scene, index) => <div key={scene.id} className={`scene-card kind-${scene.kind}`}><span>{String(index + 1).padStart(2, '0')}</span><Clapperboard size={17} /><div><strong>{scene.title}</strong><small>{scene.kind} · {scene.id}</small></div>{index < project.scenes.length - 1 && <i>→</i>}</div>)}</div><div className="project-stats"><div><Layers3 /><span><b>{project.levels.length}</b>完整关卡</span></div><div><Sparkles /><span><b>{project.levels.reduce((sum, item) => sum + item.stages.length, 0)}</b>阶段节点</span></div><div><Music2 /><span><b>{project.assets.length}</b>资源定义</span></div></div></section><section className="json-panel"><div className="json-heading"><div><span>project.json</span><small>{message}</small></div><button onClick={apply}><Check size={14} />应用 JSON</button></div><textarea spellCheck={false} value={source} onChange={(e) => setSource(e.target.value)} /></section></div>;
}
