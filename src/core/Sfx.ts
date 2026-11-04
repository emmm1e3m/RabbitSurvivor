import { SFX_VOLUME } from '../config';

interface ToneOptions {
  freq: number;
  to?: number;
  type?: OscillatorType;
  duration: number;
  volume?: number;
  delay?: number;
}

/** 程序化音效引擎：Web Audio 实时合成，无外部音频素材 */
class SfxEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  /** 同名音效上次播放时间，用于节流 */
  private lastPlayed = new Map<string, number>();

  private ensure(): boolean {
    if (!this.ctx) {
      if (typeof window === 'undefined') return false;
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return false;
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = SFX_VOLUME;
      this.master.connect(this.ctx.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return true;
  }

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** 返回 true 表示仍在节流窗口内，应跳过本次播放 */
  private throttled(name: string, gap: number): boolean {
    const now = this.ctx!.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -Infinity) < gap) return true;
    this.lastPlayed.set(name, now);
    return false;
  }

  /** 同一音效每次播放的轻微音高抖动（±3%），避免机械重复感 */
  private pitch(): number {
    return 1 + (Math.random() - 0.5) * 0.06;
  }

  private tone(options: ToneOptions): void {
    if (!this.ctx || !this.master) return;
    const { freq, to = freq, type = 'sine', duration, volume = 0.1, delay = 0 } = options;
    const start = this.ctx.currentTime + delay;
    const pitch = this.pitch();

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * pitch, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to * pitch), start + duration);

    const attack = Math.min(0.015, duration * 0.3);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(duration: number, volume: number, fromFreq: number, toFreq?: number): void {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const start = this.ctx.currentTime;
    const pitch = this.pitch();

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(fromFreq * pitch, start);
    if (toFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, toFreq * pitch), start + duration);
    }
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  /** 开火：短促下降音 */
  shoot(): void {
    if (!this.ensure() || this.throttled('shoot', 0.05)) return;
    this.tone({ freq: 760, to: 260, type: 'square', duration: 0.07, volume: 0.1 });
  }

  /** 子弹命中敌人：低频撞击 + 高频碎裂噪声分层 */
  hit(): void {
    if (!this.ensure() || this.throttled('hit', 0.035)) return;
    this.tone({ freq: 150, to: 85, type: 'sine', duration: 0.06, volume: 0.09 });
    this.noise(0.045, 0.07, 4200);
  }

  /** 敌人被击杀：低频闷响 + 下行消失音 + 噪声分层 */
  kill(): void {
    if (!this.ensure() || this.throttled('kill', 0.045)) return;
    this.tone({ freq: 210, to: 70, type: 'triangle', duration: 0.12, volume: 0.12 });
    this.tone({ freq: 640, to: 120, type: 'sine', duration: 0.2, volume: 0.055, delay: 0.015 });
    this.noise(0.08, 0.05, 1400, 300);
  }

  /** 精英怪死亡：更低沉、更长的消失音 */
  eliteKill(): void {
    if (!this.ensure() || this.throttled('eliteKill', 0.1)) return;
    this.tone({ freq: 150, to: 45, type: 'triangle', duration: 0.35, volume: 0.16 });
    this.tone({ freq: 520, to: 90, type: 'sine', duration: 0.4, volume: 0.08, delay: 0.02 });
    this.noise(0.25, 0.08, 1000, 120);
  }

  /** 装填：枪机咔哒 + 上膛滑音，reloadTime 秒后补一声就绪轻响 */
  reload(reloadTime = 1): void {
    if (!this.ensure()) return;
    this.noise(0.035, 0.05, 2600);
    this.tone({ freq: 190, to: 120, type: 'square', duration: 0.05, volume: 0.06, delay: 0.03 });
    this.tone({ freq: 300, to: 620, type: 'sine', duration: 0.45, volume: 0.045, delay: 0.08 });
    this.tone({ freq: 860, to: 720, type: 'square', duration: 0.04, volume: 0.06, delay: reloadTime });
  }

  /** 环形技能释放 */
  skill(): void {
    if (!this.ensure() || this.throttled('skill', 0.2)) return;
    this.noise(0.22, 0.09, 800, 2600);
    this.tone({ freq: 220, to: 440, type: 'sawtooth', duration: 0.16, volume: 0.08 });
    this.tone({ freq: 90, to: 50, type: 'sine', duration: 0.22, volume: 0.12, delay: 0.02 });
  }

  /** 击杀爆炸饰品触发 */
  explosion(): void {
    if (!this.ensure() || this.throttled('explosion', 0.08)) return;
    this.noise(0.28, 0.18, 1200, 120);
    this.tone({ freq: 120, to: 40, type: 'sine', duration: 0.25, volume: 0.16 });
  }

  /** 拾取金币 */
  coin(): void {
    if (!this.ensure() || this.throttled('coin', 0.04)) return;
    const base = 900 + Math.random() * 260;
    this.tone({ freq: base, to: base * 1.6, type: 'sine', duration: 0.07, volume: 0.06 });
  }

  /** 拾取回血 */
  heal(): void {
    if (!this.ensure()) return;
    this.tone({ freq: 660, type: 'sine', duration: 0.09, volume: 0.07 });
    this.tone({ freq: 990, type: 'sine', duration: 0.12, volume: 0.06, delay: 0.08 });
  }

  /** 拾取小问号：神秘上行的双音 */
  question(): void {
    if (!this.ensure() || this.throttled('question', 0.08)) return;
    this.tone({ freq: 620, to: 880, type: 'triangle', duration: 0.09, volume: 0.08 });
    this.tone({ freq: 880, to: 1240, type: 'sine', duration: 0.12, volume: 0.06, delay: 0.08 });
  }

  /** 玩家受伤 */
  hurt(): void {
    if (!this.ensure() || this.throttled('hurt', 0.12)) return;
    this.tone({ freq: 170, to: 70, type: 'sawtooth', duration: 0.16, volume: 0.14 });
    this.noise(0.09, 0.07, 900);
  }

  /** 玩家死亡 */
  defeat(): void {
    if (!this.ensure()) return;
    this.tone({ freq: 440, to: 110, type: 'triangle', duration: 0.7, volume: 0.18 });
  }

  /** 通关胜利 */
  victory(): void {
    if (!this.ensure()) return;
    [523, 659, 784, 1046].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', duration: 0.22, volume: 0.14, delay: i * 0.13 });
    });
  }

  /** 升级弹窗打开 */
  levelUp(): void {
    if (!this.ensure()) return;
    [600, 800, 1000, 1300].forEach((freq, i) => {
      this.tone({ freq, type: 'sine', duration: 0.12, volume: 0.1, delay: i * 0.07 });
    });
  }

  /** 波次结算 */
  waveClear(): void {
    if (!this.ensure()) return;
    [523, 659, 784].forEach((freq, i) => {
      this.tone({ freq, type: 'triangle', duration: 0.16, volume: 0.12, delay: i * 0.09 });
    });
  }

  /** 新一波开始 */
  waveStart(): void {
    if (!this.ensure()) return;
    this.tone({ freq: 300, to: 150, type: 'triangle', duration: 0.22, volume: 0.1 });
    this.tone({ freq: 200, to: 100, type: 'sine', duration: 0.26, volume: 0.08, delay: 0.05 });
  }

  /** 商店购买成功 */
  buy(): void {
    if (!this.ensure()) return;
    this.tone({ freq: 988, type: 'triangle', duration: 0.09, volume: 0.1 });
    this.tone({ freq: 1319, type: 'triangle', duration: 0.14, volume: 0.1, delay: 0.08 });
  }

  /** 通用 UI 点击 */
  ui(): void {
    if (!this.ensure() || this.throttled('ui', 0.03)) return;
    this.tone({ freq: 720, to: 900, type: 'sine', duration: 0.05, volume: 0.055 });
  }

  /** 选项切换 */
  select(): void {
    if (!this.ensure() || this.throttled('select', 0.04)) return;
    this.tone({ freq: 880, type: 'sine', duration: 0.04, volume: 0.06 });
  }
}

export const Sfx = new SfxEngine();
