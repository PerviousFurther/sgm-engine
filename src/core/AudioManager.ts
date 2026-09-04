import type {
  AssetDefinition,
  AudioAssetDefinition,
  AudioBus,
  AudioCueDefinition,
  AudioMarkerAction,
  AudioSystemDefinition,
  SceneAudioDefinition,
} from './types';

export interface MusicPlaybackOptions {
  loop?: boolean;
  volume?: number;
  fadeIn?: number;
  offset?: number;
  restart?: boolean;
}

export interface SoundPlaybackOptions {
  bus?: AudioBus;
  volume?: number;
  playbackRate?: number;
  cueId?: string;
}

export interface AudioMarkerEvent {
  assetId: string;
  markerId: string;
  action: AudioMarkerAction;
}

interface LoadedAudio {
  definition: AudioAssetDefinition;
  buffer?: AudioBuffer;
  loading?: Promise<AudioBuffer>;
}

interface ActivePlayback {
  id: number;
  asset: AudioAssetDefinition;
  source: AudioBufferSourceNode;
  gain: GainNode;
  bus: AudioBus;
  cueId?: string;
  startedAt: number;
  offset: number;
  playbackRate: number;
  loop: boolean;
  lastVirtualTime: number;
  firedOnce: Set<string>;
  ending: boolean;
}

const defaultBusVolumes: Record<AudioBus, number> = { music: 0.7, sfx: 0.85, voice: 1 };

export class AudioManager {
  private readonly context: AudioContext;
  private readonly masterGain: GainNode;
  private readonly busGains: Record<AudioBus, GainNode>;
  private readonly assets = new Map<string, LoadedAudio>();
  private readonly cues = new Map<string, AudioCueDefinition>();
  private readonly active = new Set<ActivePlayback>();
  private readonly markerListeners = new Set<(event: AudioMarkerEvent) => void>();
  private readonly lastCueAt = new Map<string, number>();
  private currentMusic?: ActivePlayback;
  private pendingMusic?: { assetId: string; options: MusicPlaybackOptions; requestId: number };
  private nextPlaybackId = 1;
  private musicRequestId = 0;
  private ticker = 0;
  private disposed = false;

  constructor(definition: AudioSystemDefinition = {}) {
    this.context = new AudioContext();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.busGains = {
      music: this.createBus('music'),
      sfx: this.createBus('sfx'),
      voice: this.createBus('voice'),
    };
    this.configure(definition);
  }

  configure(definition: AudioSystemDefinition = {}): void {
    this.cues.clear();
    definition.cues?.forEach((cue) => this.cues.set(cue.id, cue));
    this.setMasterVolume(definition.masterVolume ?? 1);
    (Object.keys(this.busGains) as AudioBus[]).forEach((bus) => {
      this.setBusVolume(bus, definition.buses?.[bus] ?? defaultBusVolumes[bus]);
    });
  }

  async load(assets: AssetDefinition[]): Promise<void> {
    const audioAssets = assets.filter((asset): asset is AudioAssetDefinition => asset.type === 'audio');
    audioAssets.forEach((asset) => {
      const current = this.assets.get(asset.id);
      this.assets.set(asset.id, current && current.definition.src === asset.src ? { ...current, definition: asset } : { definition: asset });
    });
    await Promise.all(audioAssets.filter((asset) => asset.preload !== 'lazy').map((asset) => this.ensureBuffer(asset.id)));
    const pending = this.pendingMusic;
    if (pending) void this.startMusic(pending.assetId, pending.options, pending.requestId);
  }

  async unlock(): Promise<void> {
    if (this.context.state !== 'running') await this.context.resume();
  }

  async pause(): Promise<void> {
    if (this.context.state === 'running') await this.context.suspend();
  }

  async resume(): Promise<void> {
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setMasterVolume(value: number): void {
    this.masterGain.gain.setValueAtTime(this.clampVolume(value), this.context.currentTime);
  }

  setBusVolume(bus: AudioBus, value: number): void {
    this.busGains[bus].gain.setValueAtTime(this.clampVolume(value), this.context.currentTime);
  }

  onMarker(listener: (event: AudioMarkerEvent) => void): () => void {
    this.markerListeners.add(listener);
    return () => this.markerListeners.delete(listener);
  }

  playMusic(assetId: string, options: MusicPlaybackOptions = {}): void {
    if (this.currentMusic?.asset.id === assetId && !options.restart) return;
    const requestId = ++this.musicRequestId;
    this.pendingMusic = { assetId, options, requestId };
    void this.startMusic(assetId, options, requestId);
  }

  stopMusic(options: { fadeOut?: number } = {}): void {
    this.pendingMusic = undefined;
    this.musicRequestId += 1;
    if (!this.currentMusic) return;
    this.stopPlayback(this.currentMusic, options.fadeOut ?? 0);
    this.currentMusic = undefined;
  }

  playSound(assetId: string, options: SoundPlaybackOptions = {}): void {
    void this.startSound(assetId, options);
  }

  playCue(cueId: string, volumeMultiplier = 1): void {
    const cue = this.cues.get(cueId);
    if (!cue?.assetIds.length) return;
    const now = this.context.currentTime;
    if (now - (this.lastCueAt.get(cueId) ?? -Infinity) < (cue.cooldown ?? 0)) return;
    const voices = [...this.active].filter((playback) => playback.cueId === cueId && !playback.ending);
    if (voices.length >= (cue.maxVoices ?? 8)) this.stopPlayback(voices[0], 0.015);
    this.lastCueAt.set(cueId, now);
    const assetId = cue.assetIds[Math.floor(Math.random() * cue.assetIds.length)];
    const variation = cue.playbackRateVariation ?? 0;
    const playbackRate = (cue.playbackRate ?? 1) + (Math.random() * 2 - 1) * variation;
    this.playSound(assetId, {
      bus: cue.bus,
      cueId,
      playbackRate,
      volume: (cue.volume ?? 1) * volumeMultiplier,
    });
  }

  enterScene(definition?: SceneAudioDefinition): void {
    if (definition?.preserveMusic) return;
    if (!definition?.music) {
      this.stopMusic({ fadeOut: definition?.fadeOut ?? 0.35 });
      return;
    }
    this.playMusic(definition.music, {
      loop: true,
      volume: definition.volume,
      fadeIn: definition.fadeIn ?? 0.6,
    });
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    cancelAnimationFrame(this.ticker);
    this.active.forEach((playback) => {
      playback.ending = true;
      playback.source.stop();
      playback.source.disconnect();
      playback.gain.disconnect();
    });
    this.active.clear();
    this.markerListeners.clear();
    await this.context.close();
  }

  private createBus(bus: AudioBus): GainNode {
    const gain = this.context.createGain();
    gain.gain.value = defaultBusVolumes[bus];
    gain.connect(this.masterGain);
    return gain;
  }

  private async ensureBuffer(assetId: string): Promise<AudioBuffer> {
    const entry = this.assets.get(assetId);
    if (!entry) throw new Error(`Audio asset does not exist: ${assetId}`);
    if (entry.buffer) return entry.buffer;
    if (!entry.loading) {
      entry.loading = fetch(entry.definition.src)
        .then((response) => {
          if (!response.ok) throw new Error(`Unable to load audio: ${entry.definition.src}`);
          return response.arrayBuffer();
        })
        .then((data) => this.context.decodeAudioData(data))
        .then((buffer) => {
          entry.buffer = buffer;
          entry.loading = undefined;
          return buffer;
        })
        .catch((error: unknown) => {
          entry.loading = undefined;
          throw error;
        });
    }
    return entry.loading;
  }

  private async startMusic(assetId: string, options: MusicPlaybackOptions, requestId: number): Promise<void> {
    try {
      const buffer = await this.ensureBuffer(assetId);
      if (this.disposed || requestId !== this.musicRequestId) return;
      const oldMusic = this.currentMusic;
      const playback = this.createPlayback(assetId, buffer, 'music', {
        loop: options.loop ?? true,
        volume: options.volume,
        fadeIn: options.fadeIn,
        offset: options.offset,
      });
      this.currentMusic = playback;
      this.pendingMusic = undefined;
      if (oldMusic) this.stopPlayback(oldMusic, options.fadeIn ?? 0.6);
    } catch (error) {
      if (requestId === this.musicRequestId) console.error(error);
    }
  }

  private async startSound(assetId: string, options: SoundPlaybackOptions): Promise<void> {
    try {
      const buffer = await this.ensureBuffer(assetId);
      if (this.disposed) return;
      const entry = this.assets.get(assetId)!;
      this.createPlayback(assetId, buffer, options.bus ?? entry.definition.category ?? 'sfx', {
        volume: options.volume,
        playbackRate: options.playbackRate,
        cueId: options.cueId,
      });
    } catch (error) {
      console.error(error);
    }
  }

  private createPlayback(
    assetId: string,
    buffer: AudioBuffer,
    bus: AudioBus,
    options: MusicPlaybackOptions & SoundPlaybackOptions & { cueId?: string },
  ): ActivePlayback {
    const entry = this.assets.get(assetId)!;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const offset = Math.max(0, Math.min(options.offset ?? 0, buffer.duration));
    const playbackRate = Math.max(0.05, options.playbackRate ?? 1);
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.loop = options.loop ?? false;
    if (source.loop) {
      const loopStart = Math.max(0, Math.min(entry.definition.loopStart ?? 0, buffer.duration));
      const requestedEnd = Math.min(buffer.duration, entry.definition.loopEnd ?? buffer.duration);
      source.loopStart = loopStart;
      source.loopEnd = requestedEnd > loopStart ? requestedEnd : buffer.duration;
    }
    source.connect(gain);
    gain.connect(this.busGains[bus]);
    const volume = this.clampVolume((entry.definition.defaultVolume ?? 1) * (options.volume ?? 1));
    const fadeIn = Math.max(0, options.fadeIn ?? 0);
    gain.gain.setValueAtTime(fadeIn ? 0 : volume, this.context.currentTime);
    if (fadeIn) gain.gain.linearRampToValueAtTime(volume, this.context.currentTime + fadeIn);
    const playback: ActivePlayback = {
      id: this.nextPlaybackId++, asset: entry.definition, source, gain, bus, cueId: options.cueId,
      startedAt: this.context.currentTime, offset, playbackRate, loop: source.loop,
      lastVirtualTime: offset - 0.0001, firedOnce: new Set(), ending: false,
    };
    source.onended = () => this.finishPlayback(playback);
    this.active.add(playback);
    source.start(0, offset);
    this.ensureTicker();
    return playback;
  }

  private stopPlayback(playback: ActivePlayback, fadeOut: number): void {
    if (playback.ending) return;
    playback.ending = true;
    const duration = Math.max(0, fadeOut);
    const now = this.context.currentTime;
    playback.gain.gain.cancelScheduledValues(now);
    playback.gain.gain.setValueAtTime(playback.gain.gain.value, now);
    playback.gain.gain.linearRampToValueAtTime(0, now + duration);
    playback.source.stop(now + duration + 0.01);
  }

  private finishPlayback(playback: ActivePlayback): void {
    this.updateMarkers(playback, true);
    this.active.delete(playback);
    if (this.currentMusic === playback) this.currentMusic = undefined;
    playback.source.disconnect();
    playback.gain.disconnect();
  }

  private ensureTicker(): void {
    if (this.ticker || this.disposed) return;
    const tick = () => {
      this.ticker = 0;
      this.active.forEach((playback) => this.updateMarkers(playback, false));
      if (this.active.size) this.ticker = requestAnimationFrame(tick);
    };
    this.ticker = requestAnimationFrame(tick);
  }

  private updateMarkers(playback: ActivePlayback, forceEnd: boolean): void {
    const markers = playback.asset.markers;
    if (!markers?.length) return;
    const duration = playback.source.buffer?.duration ?? 0;
    const current = forceEnd && !playback.loop
      ? duration
      : playback.offset + Math.max(0, this.context.currentTime - playback.startedAt) * playback.playbackRate;
    const loopStart = Math.max(0, playback.asset.loopStart ?? 0);
    const requestedLoopEnd = Math.min(duration, playback.asset.loopEnd ?? duration);
    const loopEnd = requestedLoopEnd > loopStart ? requestedLoopEnd : duration;
    const loopDuration = Math.max(0, loopEnd - loopStart);
    markers.forEach((marker) => {
      if (marker.once && playback.firedOnce.has(marker.id)) return;
      if ((!playback.loop && marker.at < playback.offset) || marker.at > duration) return;
      let crossed = playback.lastVirtualTime < marker.at && current >= marker.at;
      if (!crossed && playback.loop && loopDuration > 0 && marker.at >= loopStart && marker.at <= loopEnd && current >= marker.at) {
        crossed = Math.floor((current - marker.at) / loopDuration) > Math.floor((playback.lastVirtualTime - marker.at) / loopDuration);
      }
      if (!crossed) return;
      if (marker.once) playback.firedOnce.add(marker.id);
      const event = { assetId: playback.asset.id, markerId: marker.id, action: marker.action };
      this.markerListeners.forEach((listener) => listener(event));
    });
    playback.lastVirtualTime = current;
  }

  private clampVolume(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
