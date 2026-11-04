import Phaser from 'phaser';
import { DEPTH } from '../config';
import { RunData } from '../core/RunData';
import { EventBus, Events } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { DROP } from '../data/balance';
import { Player } from './Player';
import { PickupKind } from '../types';

export class Pickup extends Phaser.GameObjects.Sprite {
  kind: PickupKind = 'material';
  value = 0;
  private age = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 'material');
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, kind: PickupKind, value: number): this {
    const ox = Phaser.Math.Between(-10, 10);
    const oy = Phaser.Math.Between(-10, 10);
    this.kind = kind;
    this.value = value;
    this.age = 0;
    this.setTexture(kind);
    this.setPosition(x + ox, y + oy);
    this.setDepth(DEPTH.pickup);
    this.setActive(true).setVisible(true);
    return this;
  }

  update(delta: number, player: Player): void {
    if (!this.active) return;
    const dt = delta / 1000;
    this.age += dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.001) return;

    // 落地延迟后进入磁吸范围，向玩家加速飞行
    if (this.age >= DROP.magnetDelay && dist < player.attributes.pickupRange) {
      const speed = Math.min(
        DROP.maxMagnetSpeed,
        DROP.baseMagnetSpeed + dist * DROP.magnetSpeedPerDist
      );
      this.x += (dx / dist) * speed * dt;
      this.y += (dy / dist) * speed * dt;
    }

    if (dist < DROP.pickupRadius) {
      this.collect(player);
    }
  }

  private collect(player: Player): void {
    if (this.kind === 'material') {
      RunData.addGold(this.value);
      EventBus.emit(Events.GoldChanged, RunData.gold);
      Sfx.coin();
    } else {
      player.heal(this.value);
      Sfx.heal();
    }
    this.setActive(false).setVisible(false);
  }
}
