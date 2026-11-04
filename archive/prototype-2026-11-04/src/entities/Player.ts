import Phaser from 'phaser';
import { AttributeSystem } from '../core/AttributeSystem';
import { EventBus, Events } from '../core/EventBus';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { PLAYER } from '../data/balance';
import { DEPTH } from '../config';
import { InputState } from '../types';

export const PLAYER_HURT_EVENT = 'player-hurt';

export class Player extends Phaser.GameObjects.Sprite {
  readonly attributes: AttributeSystem;
  hp: number;
  /** 最近移动方向（保留给未来瞄准表现） */
  facing = new Phaser.Math.Vector2(1, 0);
  private invulnTimer = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    attrs: AttributeSystem,
    texture: string
  ) {
    super(scene, x, y, texture);
    this.attributes = attrs;
    this.hp = attrs.maxHp;
    scene.add.existing(this);
    this.setDepth(DEPTH.player);
  }

  get radius(): number {
    return PLAYER.radius;
  }

  update(delta: number, input: InputState): void {
    const dt = delta / 1000;

    const len = Math.hypot(input.x, input.y);
    if (len > 0) {
      const nx = input.x / len;
      const ny = input.y / len;
      this.x += nx * this.attributes.moveSpeed * dt;
      this.y += ny * this.attributes.moveSpeed * dt;
      this.facing.set(nx, ny);
    }

    const r = this.radius;
    this.x = Phaser.Math.Clamp(this.x, r, RunData.mapWidth - r);
    this.y = Phaser.Math.Clamp(this.y, r, RunData.mapHeight - r);

    if (this.attributes.hpRegen > 0 && this.hp > 0) {
      this.hp = Math.min(this.attributes.maxHp, this.hp + this.attributes.hpRegen * dt);
    }

    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      this.setAlpha(0.55);
    } else {
      this.setAlpha(1);
    }
  }

  takeDamage(raw: number): number {
    if (this.invulnTimer > 0 || this.hp <= 0) return 0;
    if (Math.random() < this.attributes.dodge) return 0;

    const armor = this.attributes.armor;
    const reduced = raw * (PLAYER.armorFactor / (PLAYER.armorFactor + armor));
    this.hp -= reduced;
    this.invulnTimer = PLAYER.invulnTime;
    Sfx.hurt();
    this.scene.events.emit(PLAYER_HURT_EVENT, reduced);

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
    return reduced;
  }

  heal(amount: number): void {
    if (this.hp <= 0) return;
    this.hp = Math.min(this.attributes.maxHp, this.hp + amount);
  }

  private die(): void {
    this.setAlpha(0.2);
    Sfx.defeat();
    EventBus.emit(Events.PlayerDied);
  }
}
