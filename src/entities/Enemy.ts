import Phaser from 'phaser';
import { DEPTH } from '../config';
import { RunData } from '../core/RunData';
import { FEEDBACK, META } from '../data/balance';
import { Player } from './Player';
import { EnemyKind, isElite } from '../types';

/** 燃烧中的敌人染色 */
const BURN_TINT = 0xffa94d;
/** 突击怪蓄力 / 冲刺染色 */
const CHARGE_WINDUP_TINT = 0xffd23f;
const CHARGE_DASH_TINT = 0xff6b6b;

export interface RangedConfig {
  /** 进入该距离后停止追击并开火 */
  range: number;
  /** 开火间隔（秒） */
  interval: number;
  bulletSpeed: number;
  bulletDamage: number;
  /** 每次开火的弹丸数与相邻弹丸夹角（弧度） */
  burst: number;
  spread: number;
}

/** 突击怪的蓄力冲刺配置 */
export interface ChargeConfig {
  /** 进入该距离后蓄力 */
  range: number;
  /** 蓄力时长（秒） */
  windup: number;
  /** 冲刺速度 */
  speed: number;
  /** 冲刺持续时长（秒） */
  duration: number;
  /** 冲刺后的冷却（秒） */
  cooldown: number;
}

export interface EnemyConfig {
  kind: EnemyKind;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  /** 远程攻击配置（弹幕精英等） */
  ranged?: RangedConfig;
  /** 蓄力冲刺配置（突击怪） */
  charge?: ChargeConfig;
}

export const ENEMY_DIED_EVENT = 'enemy-died';
export const ENEMY_HIT_EVENT = 'enemy-hit';
export const ENEMY_SHOOT_EVENT = 'enemy-shoot';

export class Enemy extends Phaser.GameObjects.Sprite {
  kind: EnemyKind = 'chaser';
  hp = 1;
  maxHp = 1;
  speed = 0;
  contactDamage = 0;
  radius = 14;
  contactCooldown = 0;
  ranged: RangedConfig | null = null;
  charge: ChargeConfig | null = null;
  private shootTimer = 0;
  private hitFlashTimer = 0;
  /** 突击怪：冲刺冷却、蓄力倒计时、冲刺倒计时与方向 */
  private chargeTimer = 0;
  private windupTimer = 0;
  private dashTimer = 0;
  private dashDirX = 0;
  private dashDirY = 0;
  /** 燃烧剩余时间与每秒伤害（取最高层，命中刷新持续时间） */
  private burnTime = 0;
  private burnDps = 0;
  private burnTickTimer = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'chaser');
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, cfg: EnemyConfig): this {
    this.kind = cfg.kind;
    this.hp = cfg.hp;
    this.maxHp = cfg.hp;
    this.speed = cfg.speed;
    this.contactDamage = cfg.damage;
    this.radius = cfg.radius;
    this.ranged = cfg.ranged ?? null;
    this.charge = cfg.charge ?? null;
    // 初始开火时间随机错开，避免多只弹幕精英同时齐射
    this.shootTimer = this.ranged
      ? Phaser.Math.FloatBetween(0.4, this.ranged.interval)
      : 0;
    // 突击怪的首次冲刺也错开，避免同时冲锋
    this.chargeTimer = this.charge ? Phaser.Math.FloatBetween(0.3, 1) : 0;
    this.windupTimer = 0;
    this.dashTimer = 0;

    this.setTexture(cfg.kind);
    this.setPosition(x, y);
    this.setDepth(DEPTH.enemy);
    this.clearTint();
    this.hitFlashTimer = 0;
    this.contactCooldown = 0;
    this.burnTime = 0;
    this.burnDps = 0;
    this.burnTickTimer = 0;
    this.setActive(true).setVisible(true);
    return this;
  }

  update(delta: number, player: Player): void {
    if (!this.active) return;
    const dt = delta / 1000;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.dashTimer > 0) {
      // 冲刺：锁定蓄力结束时的方向高速移动
      this.dashTimer -= dt;
      this.x += this.dashDirX * this.charge!.speed * dt;
      this.y += this.dashDirY * this.charge!.speed * dt;
      this.x = Phaser.Math.Clamp(this.x, this.radius, RunData.mapWidth - this.radius);
      this.y = Phaser.Math.Clamp(this.y, this.radius, RunData.mapHeight - this.radius);
      if (this.dashTimer <= 0 && this.hitFlashTimer <= 0) this.refreshTint();
    } else if (this.windupTimer > 0) {
      // 蓄力：原地停顿，结束时朝玩家当前位置冲刺
      this.windupTimer -= dt;
      if (this.windupTimer <= 0 && this.charge) {
        const len = dist > 1 ? dist : 1;
        this.dashDirX = dx / len;
        this.dashDirY = dy / len;
        this.dashTimer = this.charge.duration;
        this.chargeTimer = this.charge.cooldown;
        if (this.hitFlashTimer <= 0) this.setTint(CHARGE_DASH_TINT);
      }
    } else {
      // 远程单位在射程内停下开火，否则继续靠近
      const inRange = this.ranged !== null && dist <= this.ranged.range;
      if (dist > 1 && !inRange) {
        this.x += (dx / dist) * this.speed * dt;
        this.y += (dy / dist) * this.speed * dt;
      }

      if (this.ranged) {
        this.shootTimer -= dt;
        if (inRange && this.shootTimer <= 0) {
          this.shootTimer = this.ranged.interval;
          this.scene.events.emit(
            ENEMY_SHOOT_EVENT,
            this.x,
            this.y,
            Math.atan2(dy, dx),
            this.ranged
          );
        }
      }

      if (this.charge) {
        if (this.chargeTimer > 0) {
          this.chargeTimer -= dt;
        } else if (dist <= this.charge.range) {
          this.windupTimer = this.charge.windup;
          if (this.hitFlashTimer <= 0) this.setTint(CHARGE_WINDUP_TINT);
        }
      }
    }

    if (this.burnTime > 0) {
      this.burnTime -= dt;
      this.burnTickTimer -= dt;
      while (this.burnTickTimer <= 0 && this.active && this.burnTime > 0) {
        this.burnTickTimer += META.burnTick;
        // 燃烧跳伤不重复触发命中粒子/飘字，避免持续刷屏
        if (this.takeDamage(this.burnDps * META.burnTick, false, true)) return;
      }
      if (this.burnTime <= 0) {
        this.burnDps = 0;
        this.burnTickTimer = 0;
        if (this.hitFlashTimer <= 0) this.refreshTint();
      }
    }

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) this.refreshTint();
    }
    if (this.contactCooldown > 0) {
      this.contactCooldown -= dt;
    }
  }

  /** 附加燃烧：取最高每秒伤害，重复命中只刷新持续时间 */
  applyBurn(dps: number): void {
    if (dps <= 0 || !this.active) return;
    this.burnDps = Math.max(this.burnDps, dps);
    this.burnTime = META.burnDuration;
    if (this.burnTickTimer <= 0) this.burnTickTimer = META.burnTick;
    if (this.hitFlashTimer <= 0) this.setTint(BURN_TINT);
  }

  private refreshTint(): void {
    if (this.windupTimer > 0) this.setTint(CHARGE_WINDUP_TINT);
    else if (this.dashTimer > 0) this.setTint(CHARGE_DASH_TINT);
    else if (this.burnTime > 0) this.setTint(BURN_TINT);
    else this.clearTint();
  }

  /** 返回是否被击杀；silent 用于燃烧跳伤（不触发受击闪白与命中事件） */
  takeDamage(amount: number, isCrit = false, silent = false): boolean {
    if (!this.active) return false;
    this.hp -= amount;
    if (!silent) {
      // 纯白填充的受击闪白，小怪停留更久以便在连射中看清命中
      this.setTintFill(0xffffff);
      this.hitFlashTimer = isElite(this.kind)
        ? FEEDBACK.hitFlashEliteDuration
        : FEEDBACK.hitFlashDuration;
      this.scene.events.emit(ENEMY_HIT_EVENT, this.x, this.y, amount, isCrit, this.kind);
    }
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  private die(): void {
    this.setActive(false).setVisible(false);
    this.scene.events.emit(ENEMY_DIED_EVENT, this);
  }

  /** 对象池回收（不死，非击杀场景用） */
  recycle(): void {
    this.setActive(false).setVisible(false);
  }
}
