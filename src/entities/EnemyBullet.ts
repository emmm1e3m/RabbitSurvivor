import Phaser from 'phaser';
import { DEPTH } from '../config';
import { RunData } from '../core/RunData';

/** 敌方弹幕子弹：直线飞行，命中玩家或出界后回收 */
export class EnemyBullet extends Phaser.GameObjects.Sprite {
  private dirX = 0;
  private dirY = 0;
  private speed = 0;
  private life = 0;
  damage = 0;
  readonly radius = 5;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'enemy-bullet');
    this.setActive(false).setVisible(false);
  }

  launch(x: number, y: number, angle: number, speed: number, damage: number): this {
    this.setPosition(x, y);
    this.setDepth(DEPTH.projectile);
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    this.speed = speed;
    this.damage = damage;
    this.life = 5;
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
