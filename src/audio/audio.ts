export interface ToneOptions {
  frequency: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  slideTo?: number;
  attack?: number;
  release?: number;
}

/**
 * Small WebAudio wrapper. Audio contexts are created lazily on the first sound
 * so that browsers with autoplay policies stay happy.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private activeSources = new Set<AudioBufferSourceNode>();
  enabled = true;
  volume = 0.7;

  private ensure(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      try {
        this.context = new Ctor();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
      } catch (error) {
        console.warn('[unitern] could not start audio', error);
        this.enabled = false;
        return null;
      }
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.value = this.volume;
  }

  /** Play a synthesized tone; used by the built-in collect/jump feedback. */
  playTone(options: ToneOptions): void {
    const context = this.ensure();
    if (!context || !this.master) return;
    const now = context.currentTime;
    const duration = Math.max(0.01, options.duration);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(options.frequency, now);
    if (options.slideTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.slideTo), now + duration);
    }
    const peak = Math.max(0, Math.min(1, options.volume ?? 0.2));
    const attack = Math.max(0.001, options.attack ?? 0.005);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  /** Decode and cache an audio file. */
  async load(id: string, src: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(id);
    if (cached) return cached;
    const context = this.ensure();
    if (!context) return null;
    try {
      const response = await fetch(src);
      const data = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(data);
      this.buffers.set(id, buffer);
      return buffer;
    } catch (error) {
      console.warn('[unitern] could not decode audio', error);
      return null;
    }
  }

  play(id: string, options: { volume?: number; loop?: boolean; playbackRate?: number } = {}): boolean {
    const context = this.ensure();
    const buffer = this.buffers.get(id);
    if (!context || !this.master || !buffer) return false;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.playbackRate.value = options.playbackRate ?? 1;
    const gain = context.createGain();
    gain.gain.value = Math.max(0, Math.min(1, options.volume ?? 1));
    source.connect(gain);
    gain.connect(this.master);
    source.onended = () => this.activeSources.delete(source);
    this.activeSources.add(source);
    source.start();
    return true;
  }

  stopAll(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch {
        /* already stopped */
      }
    }
    this.activeSources.clear();
  }

  destroy(): void {
    this.stopAll();
    this.buffers.clear();
    if (this.context) {
      void this.context.close().catch(() => undefined);
      this.context = null;
      this.master = null;
    }
  }
}
