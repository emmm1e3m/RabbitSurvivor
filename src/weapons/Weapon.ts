import Phaser from 'phaser';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { EffectId, MetaEffectId, isProp } from '../types';
import { META, PLAYER, WEAPON, EFFECTS } from '../data/balance';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';

/** 单一武器（自动索敌开火），数值成长来自武器等级 + 属性 + 特效饰品 */
export class Weapon {
  private cooldownTimer = 0;
  /** 本弹匣已发射的数量 */
  private ammo = 0;
  private reloadTimer = 0;
  private reloading = false;

  constructor(
    private scene: Phaser.Scene,
    private owner: Player,
    private projectiles: Phaser.GameObjects.Group,
    private getEnemies: () => Enemy[]
  ) {}

  /** 直接读取 RunData，商店升级即时生效 */
  get level(): number {
    return RunData.weaponLevel;
  }

  /** 装填进度（0-1）；未装填时为 null，用于显示蓄力条 */
  get reloadProgress(): number | null {
    if (!this.reloading) return null;
    return 1 - Math.max(0, this.reloadTimer) / WEAPON.reloadTime;
  }

  update(delta: number): void {
    const dt = delta / 1000;

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammo = 0;
        // 装填完成立即恢复开火，不额外等待旧冷却
        this.cooldownTimer = 0;
      }
      return;
    }

    this.cooldownTimer -= dt;
    if (this.cooldownTimer > 0) return;

    const target = this.findTarget();
    if (!target) return;

    this.fire(target);
    this.cooldownTimer = this.currentCooldown();
  }

  /** 调试：立即打空弹匣进入装填 */
  debugReload(): void {
    this.startReload();
  }

  private startReload(): void {
    this.reloading = true;
    this.reloadTimer = WEAPON.reloadTime;
    Sfx.reload(WEAPON.reloadTime);
  }

  private currentCooldown(): number {
    const heavy = RunData.getEffect(EffectId.HeavyShot) > 0 ? EFFECTS.heavyCooldownMult : 1;
    return (WEAPON.cooldown / RunData.attributes.attackSpeed) * heavy;
  }

  private findTarget(): Enemy | null {
    const range = this.owner.attributes.range;
    let enemy: Enemy | null = null;
    let enemyDistSq = range * range;
    let prop: Enemy | null = null;
    let propDistSq = range * range;

    for (const target of this.getEnemies()) {
      if (!target.active) continue;
      const dx = target.x - this.owner.x;
      const dy = target.y - this.owner.y;
      const distSq = dx * dx + dy * dy;

      // 优先攻击敌人，射程内没有敌人时才把可破坏物（苹果树/炸药桶）当作目标
      if (isProp(target.kind)) {
        if (distSq < propDistSq) {
          propDistSq = distSq;
          prop = target;
        }
      } else if (distSq < enemyDistSq) {
        enemyDistSq = distSq;
        enemy = target;
      }
    }
    return enemy ?? prop;
  }

  /** 未计入暴击的单发基础伤害（击杀爆炸等特效以此为基准） */
  getBaseHitDamage(): number {
    const levelScale = 1 + WEAPON.damagePerLevel * (this.level - 1);
    const heavy = RunData.getEffect(EffectId.HeavyShot) > 0 ? EFFECTS.heavyDamageMult : 1;
    return WEAPON.damage * levelScale * RunData.attributes.damage * heavy;
  }

  private fire(target: Enemy): void {
    let damage = this.getBaseHitDamage();
    const isCrit = Math.random() < RunData.attributes.critChance;
    if (isCrit) damage *= PLAYER.critMultiplier;

    const pierce = RunData.getEffect(EffectId.Pierce) + RunData.getMetaEffect(MetaEffectId.Pierce);
    const shotCount =
      1 + RunData.getEffect(EffectId.MultiShot) + RunData.getMetaEffect(MetaEffectId.ExtraProjectile);
    // 局外天赋燃烧：每级独立计算每秒伤害，命中后刷新持续时间
    const burnStacks = RunData.getMetaEffect(MetaEffectId.Burn);
    const burnDps =
      burnStacks > 0 ? this.getBaseHitDamage() * META.burnDamageRatio * burnStacks : 0;
    const baseAngle = Math.atan2(target.y - this.owner.y, target.x - this.owner.x);
    const life =
      this.owner.attributes.range / WEAPON.projectileSpeed + WEAPON.projectileLifeMargin;
    const spreadStep = (4 * Math.PI) / 180;

    let launched = 0;
    for (let i = 0; i < shotCount; i++) {
      const projectile = this.projectiles.get() as Projectile | null;
      if (!projectile) break;
      const offset = (i - (shotCount - 1) / 2) * spreadStep;
      projectile.launch(this.owner.x, this.owner.y, baseAngle + offset, {
        damage,
        pierce,
        isCrit,
        speed: WEAPON.projectileSpeed,
        life,
        burnDps
      });
      launched++;
    }
    if (launched > 0) {
      Sfx.shoot();
      this.ammo += launched;
      if (this.ammo >= WEAPON.magazineSize) this.startReload();
    }
  }
}
