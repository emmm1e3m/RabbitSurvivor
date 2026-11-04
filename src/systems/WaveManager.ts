import { EventBus, Events } from '../core/EventBus';
import { WAVE } from '../data/balance';
import { EnemyKind } from '../types';

export type WaveState = 'idle' | 'running' | 'cleared';

/** 波次状态机：倒计时驱动，维护生成队列与存活计数 */
export class WaveManager {
  wave = 0;
  state: WaveState = 'idle';
  private queue: EnemyKind[] = [];
  private spawnTimer = 0;
  private aliveCount = 0;
  private remaining = 0;

  constructor(
    private spawnEnemy: (kind: EnemyKind) => boolean,
    private onWaveCleared: (wave: number) => void,
    /** 难度带来的敌人数量倍率 */
    private countMult = 1
  ) {}

  /** 当前波次剩余秒数 */
  get timeLeft(): number {
    return this.remaining;
  }

  /** extraCountMult 为小问号等来源的临时数量倍率，仅作用于本波预生成队列 */
  startWave(n: number, extraCountMult = 1): void {
    this.wave = n;
    this.state = 'running';
    this.spawnTimer = 0.6;
    this.aliveCount = 0;
    this.remaining = WAVE.duration(n);

    const queue: EnemyKind[] = [];
    const countMult = this.countMult * extraCountMult;
    const scaled = (count: number) => Math.max(0, Math.round(count * countMult));
    for (let i = 0; i < scaled(WAVE.chaserCount(n)); i++) queue.push('chaser');
    for (let i = 0; i < scaled(WAVE.chargerCount(n)); i++) queue.push('charger');
    for (let i = 0; i < scaled(WAVE.bruteCount(n)); i++) queue.push('brute');
    for (let i = 0; i < scaled(WAVE.shooterCount(n)); i++) queue.push('shooter');

    // 洗牌，让 brute 随机穿插在生成序列里
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    // Boss 固定在队列头部，开场即带红点提示登场
    if (WAVE.bossCount(n) > 0) queue.unshift('boss');
    this.queue = queue;

    EventBus.emit(Events.WaveStarted, n);
  }

  update(delta: number): void {
    if (this.state !== 'running') return;
    const dt = delta / 1000;

    this.remaining -= dt;
    if (this.remaining <= 0) {
      this.finishWave();
      return;
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;

    // 同屏上限保护
    if (this.aliveCount >= WAVE.maxAlive) {
      this.spawnTimer = 0.2;
      return;
    }

    // 初始队列耗尽后按较慢的补充间隔持续刷小怪，保证波次末尾也不会长时间无怪可打
    const queued = this.queue.length > 0;
    const kind: EnemyKind = queued ? this.queue.shift()! : 'chaser';
    if (this.spawnEnemy(kind)) {
      this.aliveCount++;
      this.spawnTimer = queued ? WAVE.spawnInterval(this.wave) : WAVE.refillInterval;
    } else {
      if (queued) this.queue.unshift(kind);
      this.spawnTimer = 0.2;
    }
  }

  onEnemyDeath(): void {
    this.aliveCount = Math.max(0, this.aliveCount - 1);
  }

  /** 调试用：立即结束当前波次 */
  debugSkip(): void {
    this.finishWave();
  }

  private finishWave(): void {
    if (this.state !== 'running') return;
    this.state = 'cleared';
    this.queue = [];
    this.aliveCount = 0;
    this.onWaveCleared(this.wave);
  }
}
