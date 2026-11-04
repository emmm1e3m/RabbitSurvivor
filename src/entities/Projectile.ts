import Phaser from 'phaser';
import { DEPTH } from '../config';
import { RunData } from '../core/RunData';
import { WEAPON } from '../data/balance';
import { Enemy } from './Enemy';

export interface ProjectileConfig {
  damage: number;
  pierce: number;
  isCrit: boolean;
  speed: number;
  life: number;
}

export class Projectile extends Phaser.GameObjects.Sprite {
  dirX = 1;
  dirY = 0;
  damage = 0;
  /** 剩余可穿透次数（0 = 命中即消失） */
  pierce = 0;
  isCrit = false;
  speed = 0;
  life = 0;
  readonly radius = WEAPON.projectileRadius;
  hitSet = new Set<Enemy>();

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'bullet');
    this.setActive(false).setVisible(false);
  }

  launch(x: number, y: number, angle: number, cfg: ProjectileConfig): this {
    this.setPosition(x, y);
    this.setDepth(DEPTH.projectile);
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.damage = cfg.damage;
    this.pierce = cfg.pierce;
    this.isCrit = cfg.isCrit;
    this.speed = cfg.speed;
    this.life = cfg.life;
    this.hitSet.clear();

    this.setScale(cfg.isCrit ? 1.35 : 1);
    if (cfg.isCrit) this.setTint(0xff9f43);
    else this.clearTint();

    this.setActive(true).setVisible(true);
    return this;
  }

  update(delta: number): void {
    if (!this.active) return;
    const dt = delta / 1000;
    this.x += this.dirX * this.speed * dt;
    this.y += this.dirY * this.speed * dt;
    this.life -= dt;

    if (
      this.life <= 0 ||
      this.x < -30 ||
      this.x > RunData.mapWidth + 30 ||
      this.y < -30 ||
      this.y > RunData.mapHeight + 30
    ) {
      this.recycle();
    }
  }

  recycle(): void {
    this.setActive(false).setVisible(false);
  }
}
