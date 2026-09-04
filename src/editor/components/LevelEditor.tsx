import { useMemo, useState } from 'react';
import { ArrowRight, Clock3, GitBranch, MessageSquareText, Music2, Plus, Sparkles, Trash2, UserRoundPlus } from 'lucide-react';
import type { AssetDefinition, AudioSystemDefinition, LevelDefinition, LevelStage, TimelineEvent } from '../../core/types';
import { demoPatterns, bossIdleSheet } from '../../data/demoProject';
import { Field, NumberField } from './Fields';

interface LevelEditorProps { level: LevelDefinition; assets: AssetDefinition[]; audio?: AudioSystemDefinition; onChange: (level: LevelDefinition) => void }

const eventLabels: Record<TimelineEvent['type'], string> = {
  playMusic: '播放音乐', stopMusic: '停止音乐', playSound: '播放音效', dialogue: '对话', spawnEnemy: '生成敌人', moveEnemy: '移动敌人',
  startPattern: '启动弹幕', stopPattern: '停止弹幕', setVariable: '设置变量', wait: '等待', emit: '自定义事件',
};

const eventIcons: Record<TimelineEvent['type'], typeof Clock3> = {
  playMusic: Music2, stopMusic: Music2, playSound: Music2, dialogue: MessageSquareText, spawnEnemy: UserRoundPlus, moveEnemy: ArrowRight,
  startPattern: Sparkles, stopPattern: Sparkles, setVariable: GitBranch, wait: Clock3, emit: Sparkles,
};

export function LevelEditor({ level, assets, audio, onChange }: LevelEditorProps) {
  const [selectedStageId, setSelectedStageId] = useState(level.initialStageId);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const selectedStage = level.stages.find((stage) => stage.id === selectedStageId) ?? level.stages[0];
  const selectedEvent = selectedStage?.timeline.find((event) => event.id === selectedEventId);

  const changeStage = (patch: Partial<LevelStage>) => {
    onChange({ ...level, stages: level.stages.map((stage) => stage.id === selectedStage.id ? { ...stage, ...patch } : stage) });
  };
  const updateEvent = (id: string, patch: Record<string, unknown>) => {
    changeStage({ timeline: selectedStage.timeline.map((event) => event.id === id ? { ...event, ...patch } as TimelineEvent : event) });
  };
  const deleteEvent = (id: string) => { changeStage({ timeline: selectedStage.timeline.filter((event) => event.id !== id) }); setSelectedEventId(undefined); };
  const addEvent = (type: TimelineEvent['type']) => {
    const id = `${type}-${crypto.randomUUID().slice(0, 6)}`;
    const base = { id, at: Math.round(Math.min(selectedStage.duration, (selectedStage.timeline.at(-1)?.at ?? 0) + 1) * 10) / 10 };
    const factories: Record<TimelineEvent['type'], () => TimelineEvent> = {
      playMusic: () => ({ ...base, type: 'playMusic', assetId: 'boss-theme', loop: true }),
      stopMusic: () => ({ ...base, type: 'stopMusic', fadeOut: 0.5 }),
      playSound: () => ({ ...base, type: 'playSound', cueId: audio?.cues?.[0]?.id ?? 'playerShot', volume: 1 }),
      dialogue: () => ({ ...base, type: 'dialogue', speaker: '阿斯特莉德', text: '在这里输入对话内容。', portrait: '/boss-0.png' }),
      spawnEnemy: () => ({ ...base, type: 'spawnEnemy', enemy: { id: `enemy-${Date.now()}`, name: '新敌人', position: { x: 240, y: 140 }, health: 1000, hitRadius: 24, idleAnimation: bossIdleSheet } }),
      moveEnemy: () => ({ ...base, type: 'moveEnemy', enemyId: 'boss-astrid', to: { x: 240, y: 140 }, duration: 1 }),
      startPattern: () => ({ ...base, type: 'startPattern', ownerId: 'boss-astrid', pattern: structuredClone(demoPatterns[0]) }),
      stopPattern: () => ({ ...base, type: 'stopPattern', ownerId: 'boss-astrid' }),
      setVariable: () => ({ ...base, type: 'setVariable', name: 'spell', value: 1 }),
      wait: () => ({ ...base, type: 'wait', duration: 1 }),
      emit: () => ({ ...base, type: 'emit', name: 'custom-event' }),
    };
    const event = factories[type]();
    changeStage({ timeline: [...selectedStage.timeline, event].sort((a, b) => a.at - b.at) }); setSelectedEventId(id);
  };
  const addStage = () => {
    const index = level.stages.length + 1; const id = `stage-${index}`;
    onChange({ ...level, stages: [...level.stages, { id, name: `新阶段 ${index}`, duration: 20, timeline: [], transitions: [{ type: 'onComplete', targetSceneId: 'result' }], editorPosition: { x: 80 + index * 80, y: 110 + index * 55 } }] });
    setSelectedStageId(id);
  };

  return (
    <div className="editor-workspace level-workspace">
      <section className="editor-canvas-panel">
        <div className="panel-heading"><div><small>LEVEL GRAPH</small><h2>{level.name}</h2><p>{level.subtitle}</p></div><button className="outline-button" onClick={addStage}><Plus size={15} /> 添加阶段</button></div>
        <StageGraph level={level} selected={selectedStage.id} onSelect={(id) => { setSelectedStageId(id); setSelectedEventId(undefined); }} />
        <div className="timeline-panel">
          <div className="timeline-heading"><span>事件时间轴</span><small>{selectedStage.timeline.length} EVENTS · {selectedStage.duration}s</small></div>
          <div className="timeline-ruler"><i style={{ left: '0%' }}>0s</i><i style={{ left: '25%' }}>{selectedStage.duration * .25}s</i><i style={{ left: '50%' }}>{selectedStage.duration * .5}s</i><i style={{ left: '75%' }}>{selectedStage.duration * .75}s</i><i style={{ left: '100%' }}>{selectedStage.duration}s</i></div>
          <div className="event-list">
            {selectedStage.timeline.map((event) => { const Icon = eventIcons[event.type]; return <button key={event.id} className={`event-chip ${selectedEventId === event.id ? 'selected' : ''}`} style={{ marginLeft: `${Math.min(78, event.at / selectedStage.duration * 65)}%` }} onClick={() => setSelectedEventId(event.id)}><Icon size={14} /><span>{eventLabels[event.type]}</span><b>{event.at.toFixed(1)}s</b></button>; })}
            {!selectedStage.timeline.length && <div className="empty-events">此阶段尚无事件</div>}
          </div>
          <EventMenu onAdd={addEvent} />
        </div>
      </section>
      <aside className="inspector-panel">
        {selectedEvent ? <EventInspector event={selectedEvent} assets={assets} audio={audio} onChange={(patch) => updateEvent(selectedEvent.id, patch)} onDelete={() => deleteEvent(selectedEvent.id)} /> : <StageInspector level={level} stage={selectedStage} onChange={changeStage} />}
      </aside>
    </div>
  );
}

function StageGraph({ level, selected, onSelect }: { level: LevelDefinition; selected: string; onSelect: (id: string) => void }) {
  const points = useMemo(() => new Map(level.stages.map((stage, index) => [stage.id, stage.editorPosition ?? { x: 70 + index * 190, y: 120 }])), [level.stages]);
  return <div className="stage-graph"><svg>{level.stages.flatMap((stage) => stage.transitions.filter((item) => item.targetStageId).map((transition) => { const from = points.get(stage.id)!; const to = points.get(transition.targetStageId!)!; return <path key={`${stage.id}-${transition.targetStageId}`} d={`M ${from.x + 150} ${from.y + 35} C ${from.x + 190} ${from.y + 35}, ${to.x - 40} ${to.y + 35}, ${to.x} ${to.y + 35}`} />; }))}</svg>{level.stages.map((stage, index) => { const point = points.get(stage.id)!; return <button key={stage.id} onClick={() => onSelect(stage.id)} className={`stage-node ${selected === stage.id ? 'selected' : ''}`} style={{ left: point.x, top: point.y }}><small>{String(index + 1).padStart(2, '0')} · {stage.id === level.initialStageId ? 'ENTRY' : 'STAGE'}</small><strong>{stage.name}</strong><span>{stage.timeline.length} 事件 · {stage.duration}s</span></button>; })}</div>;
}

function EventMenu({ onAdd }: { onAdd: (type: TimelineEvent['type']) => void }) {
  const [open, setOpen] = useState(false);
  return <div className="event-menu"><button className="outline-button" onClick={() => setOpen(!open)}><Plus size={14} />添加事件</button>{open && <div className="event-menu-popover">{(Object.keys(eventLabels) as TimelineEvent['type'][]).map((type) => <button key={type} onClick={() => { onAdd(type); setOpen(false); }}>{eventLabels[type]}</button>)}</div>}</div>;
}

function StageInspector({ level, stage, onChange }: { level: LevelDefinition; stage: LevelStage; onChange: (patch: Partial<LevelStage>) => void }) {
  const transition = stage.transitions[0];
  return <><div className="inspector-title"><small>STAGE NODE</small><h3>阶段属性</h3></div><Field label="显示名称"><input value={stage.name} onChange={(event) => onChange({ name: event.target.value })} /></Field><Field label="阶段 ID" hint="脚本内唯一"><input value={stage.id} disabled /></Field><Field label="持续时间" hint="秒"><NumberField value={stage.duration} min={1} step={.5} onChange={(duration) => onChange({ duration })} /></Field><div className="inspector-divider"><span>完成后转换</span></div><Field label="触发类型"><select value={transition?.type ?? 'onComplete'} onChange={(event) => onChange({ transitions: [{ ...transition, type: event.target.value as 'onComplete' }] })}><option value="onComplete">阶段时间结束</option><option value="onEnemyDefeated">敌人被击破</option><option value="onVariable">变量满足条件</option></select></Field><Field label="目标阶段"><select value={transition?.targetStageId ?? ''} onChange={(event) => onChange({ transitions: [{ ...transition, type: transition?.type ?? 'onComplete', targetStageId: event.target.value || undefined, targetSceneId: event.target.value ? undefined : 'result' }] })}><option value="">结束关卡 → 结算场景</option>{level.stages.filter((item) => item.id !== stage.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><p className="inspector-note">阶段节点通过类型化条件构成分支图；场景切换由项目的 Scene Flow 管理。</p></>;
}

function EventInspector({ event, assets, audio, onChange, onDelete }: { event: TimelineEvent; assets: AssetDefinition[]; audio?: AudioSystemDefinition; onChange: (patch: Record<string, unknown>) => void; onDelete: () => void }) {
  const musicAssets = assets.filter((asset) => asset.type === 'audio' && (asset.category ?? 'music') === 'music');
  return <>
    <div className="inspector-title"><small>TIMELINE EVENT</small><h3>{eventLabels[event.type]}</h3></div>
    <Field label="触发时间" hint="秒"><NumberField value={event.at} min={0} step={.1} onChange={(at) => onChange({ at })} /></Field>
    <Field label="事件 ID"><input value={event.id} disabled /></Field>
    {event.type === 'dialogue' && <>
      <Field label="说话人"><input value={event.speaker} onChange={(e) => onChange({ speaker: e.target.value })} /></Field>
      <Field label="台词"><textarea rows={5} value={event.text} onChange={(e) => onChange({ text: e.target.value })} /></Field>
      <Field label="立绘路径"><input value={event.portrait ?? ''} onChange={(e) => onChange({ portrait: e.target.value })} /></Field>
    </>}
    {event.type === 'playMusic' && <>
      <Field label="音乐资源"><select value={event.assetId} onChange={(e) => onChange({ assetId: e.target.value })}>{musicAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.id}</option>)}</select></Field>
      <Field label="淡入时间" hint="秒"><NumberField value={event.fadeIn ?? 0.6} min={0} step={.1} onChange={(fadeIn) => onChange({ fadeIn })} /></Field>
      <Field label="循环播放"><input className="checkbox" type="checkbox" checked={event.loop} onChange={(e) => onChange({ loop: e.target.checked })} /></Field>
    </>}
    {event.type === 'stopMusic' && <Field label="淡出时间" hint="秒"><NumberField value={event.fadeOut ?? 0.5} min={0} step={.1} onChange={(fadeOut) => onChange({ fadeOut })} /></Field>}
    {event.type === 'playSound' && <>
      <Field label="音效 Cue"><select value={event.cueId} onChange={(e) => onChange({ cueId: e.target.value })}>{audio?.cues?.map((cue) => <option key={cue.id} value={cue.id}>{cue.id}</option>)}</select></Field>
      <Field label="音量倍率"><NumberField value={event.volume ?? 1} min={0} max={1} step={.05} onChange={(volume) => onChange({ volume })} /></Field>
    </>}
    {event.type === 'moveEnemy' && <>
      <Field label="敌人 ID"><input value={event.enemyId} onChange={(e) => onChange({ enemyId: e.target.value })} /></Field>
      <Field label="目标 X"><NumberField value={event.to.x} onChange={(x) => onChange({ to: { ...event.to, x } })} /></Field>
      <Field label="目标 Y"><NumberField value={event.to.y} onChange={(y) => onChange({ to: { ...event.to, y } })} /></Field>
      <Field label="缓动时长"><NumberField value={event.duration} step={.1} onChange={(duration) => onChange({ duration })} /></Field>
    </>}
    {(event.type === 'startPattern' || event.type === 'stopPattern') && <Field label="弹幕所有者"><input value={event.ownerId} onChange={(e) => onChange({ ownerId: e.target.value })} /></Field>}
    {event.type === 'startPattern' && <>
      <Field label="弹幕名称"><input value={event.pattern.name} onChange={(e) => onChange({ pattern: { ...event.pattern, name: e.target.value } })} /></Field>
      <Field label="发射间隔"><NumberField value={event.pattern.interval} step={.05} onChange={(interval) => onChange({ pattern: { ...event.pattern, interval } })} /></Field>
    </>}
    {event.type === 'setVariable' && <><Field label="变量名"><input value={event.name} onChange={(e) => onChange({ name: e.target.value })} /></Field><Field label="值"><input value={String(event.value)} onChange={(e) => onChange({ value: e.target.value })} /></Field></>}
    {event.type === 'wait' && <Field label="等待时长"><NumberField value={event.duration} step={.1} onChange={(duration) => onChange({ duration })} /></Field>}
    {event.type === 'emit' && <Field label="事件名称"><input value={event.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>}
    {event.type === 'spawnEnemy' && <>
      <Field label="敌人名称"><input value={event.enemy.name} onChange={(e) => onChange({ enemy: { ...event.enemy, name: e.target.value } })} /></Field>
      <Field label="生命值"><NumberField value={event.enemy.health} onChange={(health) => onChange({ enemy: { ...event.enemy, health } })} /></Field>
    </>}
    <button className="danger-button" onClick={onDelete}><Trash2 size={15} />删除此事件</button>
  </>;
}
