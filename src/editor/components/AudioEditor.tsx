import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Plus, Trash2, Volume2 } from 'lucide-react';
import type { AudioAssetDefinition, AudioBus, AudioMarkerAction, AudioMarkerDefinition, GameProjectDefinition } from '../../core/types';
import { Field, NumberField } from './Fields';

interface AudioEditorProps {
  project: GameProjectDefinition;
  onChange: (project: GameProjectDefinition) => void;
}

export function AudioEditor({ project, onChange }: AudioEditorProps) {
  const assets = project.assets.filter((asset): asset is AudioAssetDefinition => asset.type === 'audio');
  const [selectedId, setSelectedId] = useState(() => assets[0]?.id ?? '');
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const selected = assets.find((asset) => asset.id === selectedId) ?? assets[0];
  const selectedMarker = selected?.markers?.find((marker) => marker.id === selectedMarkerId);

  useEffect(() => {
    setCurrentTime(0); setDuration(0); setPlaying(false); setSelectedMarkerId(undefined);
  }, [selected?.id]);

  const changeAsset = (patch: Partial<AudioAssetDefinition>) => {
    if (!selected) return;
    onChange({ ...project, assets: project.assets.map((asset) => asset.id === selected.id ? { ...selected, ...patch } : asset) });
  };
  const addAsset = () => {
    const id = `audio-${crypto.randomUUID().slice(0, 6)}`;
    onChange({ ...project, assets: [...project.assets, { id, type: 'audio', src: '/audio.mp3', category: 'sfx', defaultVolume: 1, preload: 'eager', markers: [] }] });
    setSelectedId(id);
  };
  const addMarker = () => {
    if (!selected) return;
    const id = `marker-${crypto.randomUUID().slice(0, 6)}`;
    const marker: AudioMarkerDefinition = { id, at: Number(currentTime.toFixed(3)), action: { type: 'emit', name: 'audio:event' } };
    changeAsset({ markers: [...(selected.markers ?? []), marker].sort((a, b) => a.at - b.at) });
    setSelectedMarkerId(id);
  };
  const changeMarker = (patch: { at?: number; once?: boolean; action?: AudioMarkerAction }) => {
    if (!selected || !selectedMarker) return;
    changeAsset({ markers: selected.markers?.map((marker) => marker.id === selectedMarker.id ? { ...marker, ...patch } : marker) });
  };
  const removeMarker = () => {
    if (!selectedMarker) return;
    changeAsset({ markers: selected?.markers?.filter((marker) => marker.id !== selectedMarker.id) });
    setSelectedMarkerId(undefined);
  };
  const togglePreview = () => {
    const element = audioRef.current;
    if (!element) return;
    if (element.paused) void element.play(); else element.pause();
  };
  const seek = (value: number) => {
    if (audioRef.current) audioRef.current.currentTime = value;
    setCurrentTime(value);
  };
  const setBusVolume = (bus: AudioBus, value: number) => onChange({
    ...project,
    audio: { ...project.audio, buses: { ...project.audio?.buses, [bus]: value } },
  });

  return <div className="audio-workspace">
    <aside className="library-panel">
      <div className="panel-heading compact"><div><small>AUDIO LIBRARY</small><h2>音频资源</h2></div><button className="mini-add" onClick={addAsset}><Plus size={14} /></button></div>
      {assets.map((asset) => <button key={asset.id} className={`library-item ${selected?.id === asset.id ? 'selected' : ''}`} onClick={() => setSelectedId(asset.id)}><Volume2 size={18} /><span><strong>{asset.id}</strong><small>{asset.category ?? 'music'} · {asset.src}</small></span></button>)}
      {!assets.length && <p className="empty-library">还没有音频资源</p>}
    </aside>
    <main className="audio-center">
      <div className="audio-mixer">
        <div><small>AUDIO MIXER</small><h2>总线混音</h2></div>
        <label><span>MASTER</span><b>{Math.round((project.audio?.masterVolume ?? 1) * 100)}%</b><input type="range" min={0} max={1} step={.01} value={project.audio?.masterVolume ?? 1} onChange={(event) => onChange({ ...project, audio: { ...project.audio, masterVolume: Number(event.target.value) } })} /></label>
        {(['music', 'sfx', 'voice'] as AudioBus[]).map((bus) => <label key={bus}><span>{bus.toUpperCase()}</span><input type="range" min={0} max={1} step={.01} value={project.audio?.buses?.[bus] ?? 1} onChange={(event) => setBusVolume(bus, Number(event.target.value))} /><b>{Math.round((project.audio?.buses?.[bus] ?? 1) * 100)}%</b></label>)}
      </div>
      {selected && <section className="audio-preview-card">
        <audio ref={audioRef} src={selected.src} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
        <div className="audio-transport"><button onClick={togglePreview}>{playing ? <Pause size={17} /> : <Play size={17} />}</button><strong>{formatTime(currentTime)}</strong><input type="range" min={0} max={duration || 1} step={.01} value={currentTime} onChange={(event) => seek(Number(event.target.value))} /><span>{formatTime(duration)}</span></div>
        <div className="marker-track">
          <span className="playhead" style={{ left: `${duration ? currentTime / duration * 100 : 0}%` }} />
          {selected.markers?.map((marker) => <button key={marker.id} title={`${marker.id} · ${marker.at}s`} className={selectedMarkerId === marker.id ? 'selected' : ''} style={{ left: `${duration ? marker.at / duration * 100 : 0}%` }} onClick={() => { setSelectedMarkerId(marker.id); seek(marker.at); }} />)}
        </div>
        <div className="audio-preview-actions"><span>{selected.markers?.length ?? 0} 个时间标记</span><button className="outline-button" onClick={addMarker}><Plus size={14} />在 {currentTime.toFixed(2)}s 添加标记</button></div>
      </section>}
      <SceneAudioEditor project={project} onChange={onChange} />
      <CueEditor project={project} selectedAssetId={selected?.id} onChange={onChange} />
    </main>
    <aside className="inspector-panel">
      {selected ? <>
        <div className="inspector-title"><small>AUDIO ASSET</small><h3>{selected.id}</h3></div>
        <Field label="资源路径"><input value={selected.src} onChange={(event) => changeAsset({ src: event.target.value })} /></Field>
        <Field label="分类"><select value={selected.category ?? 'music'} onChange={(event) => changeAsset({ category: event.target.value as AudioBus })}><option value="music">音乐 Music</option><option value="sfx">音效 SFX</option><option value="voice">语音 Voice</option></select></Field>
        <Field label="默认音量"><NumberField value={selected.defaultVolume ?? 1} min={0} max={1} step={.05} onChange={(defaultVolume) => changeAsset({ defaultVolume })} /></Field>
        <Field label="预加载"><select value={selected.preload ?? 'eager'} onChange={(event) => changeAsset({ preload: event.target.value as 'eager' | 'lazy' })}><option value="eager">立即解码</option><option value="lazy">首次播放时解码</option></select></Field>
        <div className="field-row"><Field label="循环起点"><NumberField value={selected.loopStart ?? 0} min={0} step={.01} onChange={(loopStart) => changeAsset({ loopStart })} /></Field><Field label="循环终点"><NumberField value={selected.loopEnd ?? 0} min={0} step={.01} onChange={(loopEnd) => changeAsset({ loopEnd: loopEnd || undefined })} /></Field></div>
        {selectedMarker && <>
          <div className="inspector-divider"><span>时间标记</span></div>
          <Field label="标记 ID"><input value={selectedMarker.id} disabled /></Field>
          <Field label="触发时间" hint="秒"><NumberField value={selectedMarker.at} min={0} step={.01} onChange={(at) => changeMarker({ at })} /></Field>
          <Field label="动作类型"><select value={selectedMarker.action.type} onChange={(event) => changeMarker({ action: createAction(event.target.value as AudioMarkerAction['type']) })}><option value="emit">广播脚本事件</option><option value="setVariable">设置关卡变量</option><option value="requestScene">切换场景</option></select></Field>
          <MarkerActionFields action={selectedMarker.action} onChange={(action) => changeMarker({ action })} />
          <Field label="每次播放仅触发一次"><input className="checkbox" type="checkbox" checked={selectedMarker.once ?? false} onChange={(event) => changeMarker({ once: event.target.checked })} /></Field>
          <button className="danger-button" onClick={removeMarker}><Trash2 size={15} />删除时间标记</button>
        </>}
      </> : <p className="inspector-note">添加一个音频资源后即可配置。</p>}
    </aside>
  </div>;
}

function SceneAudioEditor({ project, onChange }: AudioEditorProps) {
  const music = project.assets.filter((asset) => asset.type === 'audio' && (asset.category ?? 'music') === 'music');
  const update = (sceneId: string, patch: Record<string, unknown>) => onChange({
    ...project,
    scenes: project.scenes.map((scene) => scene.id === sceneId ? { ...scene, audio: { ...scene.audio, ...patch } } : scene),
  });
  return <section className="cue-section scene-audio-section">
    <div className="cue-heading"><div><small>SCENE MUSIC</small><h3>场景音乐生命周期</h3></div></div>
    {project.scenes.map((scene) => <div className="scene-audio-row" key={scene.id}>
      <span><strong>{scene.title}</strong><small>{scene.kind}</small></span>
      <select value={scene.audio?.music ?? ''} disabled={scene.audio?.preserveMusic} onChange={(event) => update(scene.id, { music: event.target.value || undefined })}><option value="">无音乐</option>{music.map((asset) => <option key={asset.id} value={asset.id}>{asset.id}</option>)}</select>
      <label><input type="checkbox" checked={scene.audio?.preserveMusic ?? false} onChange={(event) => update(scene.id, { preserveMusic: event.target.checked })} />保持上一场景</label>
      <NumberField value={scene.audio?.fadeIn ?? 0.6} min={0} step={.1} onChange={(fadeIn) => update(scene.id, { fadeIn })} />
      <NumberField value={scene.audio?.fadeOut ?? 0.35} min={0} step={.1} onChange={(fadeOut) => update(scene.id, { fadeOut })} />
    </div>)}
    <div className="scene-audio-legend"><span>场景</span><span>音乐</span><span>连续播放</span><span>淡入</span><span>淡出</span></div>
  </section>;
}

function MarkerActionFields({ action, onChange }: { action: AudioMarkerAction; onChange: (action: AudioMarkerAction) => void }) {
  if (action.type === 'emit') return <><Field label="事件名称"><input value={action.name} onChange={(event) => onChange({ ...action, name: event.target.value })} /></Field><Field label="Payload (JSON)"><input value={action.payload === undefined ? '' : JSON.stringify(action.payload)} onChange={(event) => { try { onChange({ ...action, payload: event.target.value ? JSON.parse(event.target.value) : undefined }); } catch { /* Keep the last valid payload while editing. */ } }} /></Field></>;
  if (action.type === 'setVariable') return <><Field label="变量名"><input value={action.name} onChange={(event) => onChange({ ...action, name: event.target.value })} /></Field><Field label="变量值"><input value={String(action.value)} onChange={(event) => onChange({ ...action, value: event.target.value })} /></Field></>;
  return <Field label="目标场景 ID"><input value={action.sceneId} onChange={(event) => onChange({ ...action, sceneId: event.target.value })} /></Field>;
}

function CueEditor({ project, selectedAssetId, onChange }: AudioEditorProps & { selectedAssetId?: string }) {
  const cues = project.audio?.cues ?? [];
  const update = (id: string, patch: Record<string, unknown>) => onChange({ ...project, audio: { ...project.audio, cues: cues.map((cue) => cue.id === id ? { ...cue, ...patch } : cue) } });
  const add = () => {
    const id = `cue-${crypto.randomUUID().slice(0, 6)}`;
    onChange({ ...project, audio: { ...project.audio, cues: [...cues, { id, assetIds: selectedAssetId ? [selectedAssetId] : [], bus: 'sfx', volume: 1, maxVoices: 8 }] } });
  };
  return <section className="cue-section"><div className="cue-heading"><div><small>SEMANTIC CUES</small><h3>玩法音效 Cue</h3></div><button className="outline-button" onClick={add}><Plus size={14} />添加 Cue</button></div><div className="cue-table"><div className="cue-legend"><span>ID</span><span>音频变体</span><span>总线</span><span>音量</span><span>音高浮动</span><span>冷却</span><span>声部</span><span /></div>{cues.map((cue) => <div className="cue-row" key={cue.id}><input value={cue.id} onChange={(event) => update(cue.id, { id: event.target.value })} /><input value={cue.assetIds.join(', ')} placeholder="asset-id, variant-id" onChange={(event) => update(cue.id, { assetIds: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /><select value={cue.bus ?? 'sfx'} onChange={(event) => update(cue.id, { bus: event.target.value })}><option value="sfx">SFX</option><option value="voice">VOICE</option><option value="music">MUSIC</option></select><NumberField value={cue.volume ?? 1} min={0} max={1} step={.05} onChange={(volume) => update(cue.id, { volume })} /><NumberField value={cue.playbackRateVariation ?? 0} min={0} max={1} step={.01} onChange={(playbackRateVariation) => update(cue.id, { playbackRateVariation })} /><NumberField value={cue.cooldown ?? 0} min={0} step={.01} onChange={(cooldown) => update(cue.id, { cooldown })} /><NumberField value={cue.maxVoices ?? 8} min={1} step={1} onChange={(maxVoices) => update(cue.id, { maxVoices })} /><button onClick={() => onChange({ ...project, audio: { ...project.audio, cues: cues.filter((item) => item.id !== cue.id) } })}><Trash2 size={14} /></button></div>)}</div></section>;
}

function createAction(type: AudioMarkerAction['type']): AudioMarkerAction {
  if (type === 'setVariable') return { type, name: 'variable', value: true };
  if (type === 'requestScene') return { type, sceneId: 'result' };
  return { type, name: 'audio:event' };
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00.000';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(3).padStart(6, '0')}`;
}
