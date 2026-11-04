import Phaser from 'phaser';
import { DEPTH } from '../config';
import { Player } from './Player';
import { EnemyKind } from '../types';

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

export interface EnemyConfig {
  kind: EnemyKind;
  hp: number;
  speed: number;
  damage: number;
  radius: number;
  /** 远程攻击配置（弹幕精英等） */
  ranged?: RangedConfig;
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
  private shootTimer = 0;
  private hitFlashTimer = 0;

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
    // 初始开火时间随机错开，避免多只弹幕精英同时齐射
    this.shootTimer = this.ranged
      ? Phaser.Math.FloatBetween(0.4, this.ranged.interval)
      : 0;

    this.setTexture(cfg.kind);
    this.setPosition(x, y);
    this.setDepth(DEPTH.enemy);
    this.clearTint();
    this.hitFlashTimer = 0;
    this.contactCooldown = 0;
    this.setActive(true).setVisible(true);
    return this;
  }

  update(delta: number, player: Player): void {
    if (!this.active) return;
    const dt = delta / 1000;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

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

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
      if (this.hitFlashTimer <= 0) this.clearTint();
    }
    if (this.contactCooldown > 0) {
      this.contactCooldown -= dt;
    }
  }

  /** 返回是否被击杀 */
  takeDamage(amount: number, isCrit = false): boolean {
    if (!this.active) return false;
    this.hp -= amount;
    this.setTintFill(0xffffff);
    this.hitFlashTimer = 0.08;
    this.scene.events.emit(ENEMY_HIT_EVENT, this.x, this.y, amount, isCrit, this.kind);
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
