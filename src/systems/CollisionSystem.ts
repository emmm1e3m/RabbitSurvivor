import { PLAYER } from '../data/balance';
import { Enemy } from '../entities/Enemy';
import { EnemyBullet } from '../entities/EnemyBullet';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';

/**
 * 手写圆-圆距离检测（不启用 Arcade Physics）。
 * 敌人之间互相穿透。检测顺序：
 * 1. 子弹×敌人（穿透与命中去重）
 * 2. 敌方弹幕×玩家
 * 3. 敌人×玩家（接触伤害，0.5s/敌节流 + 玩家受击无敌）
 */
export class CollisionSystem {
  update(
    _delta: number,
    player: Player,
    enemies: Enemy[],
    projectiles: Projectile[],
    enemyBullets: EnemyBullet[]
  ): void {
    this.projectilesVsEnemies(enemies, projectiles);
    this.enemyBulletsVsPlayer(player, enemyBullets);
    this.enemiesVsPlayer(player, enemies);
  }

  private enemyBulletsVsPlayer(player: Player, bullets: EnemyBullet[]): void {
    if (player.hp <= 0) return;

    for (const bullet of bullets) {
      if (!bullet.active) continue;

      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      const reach = bullet.radius + player.radius;
      if (dx * dx + dy * dy > reach * reach) continue;

      player.takeDamage(bullet.damage);
      bullet.recycle();
    }
  }

  private projectilesVsEnemies(enemies: Enemy[], projectiles: Projectile[]): void {
    for (const projectile of projectiles) {
      if (!projectile.active) continue;

      for (const enemy of enemies) {
        if (!enemy.active || projectile.hitSet.has(enemy)) continue;

        const dx = enemy.x - projectile.x;
        const dy = enemy.y - projectile.y;
        const reach = enemy.radius + projectile.radius;
        if (dx * dx + dy * dy > reach * reach) continue;

        projectile.hitSet.add(enemy);
        enemy.takeDamage(projectile.damage, projectile.isCrit);

        if (projectile.pierce > 0) {
          projectile.pierce--;
        } else {
          projectile.recycle();
          break;
        }
      }
    }
  }

  private enemiesVsPlayer(player: Player, enemies: Enemy[]): void {
    if (player.hp <= 0) return;

    for (const enemy of enemies) {
      // 无接触伤害的对象（如苹果树）不参与玩家碰撞
      if (!enemy.active || enemy.contactCooldown > 0 || enemy.contactDamage <= 0) continue;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      const reach = enemy.radius + player.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        player.takeDamage(enemy.contactDamage);
        enemy.contactCooldown = PLAYER.contactThrottle;
      }
    }
  }
}
