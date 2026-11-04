import { DROP } from '../data/balance';
import { Enemy } from '../entities/Enemy';
import { Pickup } from '../entities/Pickup';

export class DropSystem {
  constructor(private pickups: Phaser.GameObjects.Group) {}

  spawnFor(enemy: Enemy): void {
    const cfg = DROP[enemy.kind];

    if (Math.random() < cfg.materialChance) {
      this.spawn(enemy.x, enemy.y, 'material', cfg.materialValue);
    }
    if (Math.random() < cfg.healChance) {
      const count =
        cfg.healCountMin +
        Math.floor(Math.random() * (cfg.healCountMax - cfg.healCountMin + 1));
      // 多个苹果围绕掉落点散开，避免叠在一起
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count;
        const dist = count > 1 ? 16 : 0;
        this.spawn(
          enemy.x + Math.cos(angle) * dist,
          enemy.y + Math.sin(angle) * dist,
          'heal',
          cfg.healValue
        );
      }
    }
  }

  private spawn(x: number, y: number, kind: 'material' | 'heal', value: number): void {
    const pickup = this.pickups.get() as Pickup | null;
    if (!pickup) return;
    pickup.spawn(x, y, kind, value);
  }
}
