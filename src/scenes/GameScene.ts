import Phaser from 'phaser';
import {
  SCENE_KEYS,
  GAME_WIDTH,
  GAME_HEIGHT,
  DEPTH,
  DEBUG,
  BGM_VOLUME,
  COLORS
} from '../config';
import { AttrKey } from '../core/AttributeSystem';
import { EventBus, Events } from '../core/EventBus';
import { MetaProgress } from '../core/MetaProgress';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { Player, PLAYER_HURT_EVENT } from '../entities/Player';
import {
  ChargeConfig,
  Enemy,
  ENEMY_DIED_EVENT,
  ENEMY_HIT_EVENT,
  ENEMY_SHOOT_EVENT,
  RangedConfig
} from '../entities/Enemy';
import { EnemyBullet } from '../entities/EnemyBullet';
import { Projectile } from '../entities/Projectile';
import { Pickup } from '../entities/Pickup';
import { WaveManager } from '../systems/WaveManager';
import { CollisionSystem } from '../systems/CollisionSystem';
import { DropSystem } from '../systems/DropSystem';
import { Weapon } from '../weapons/Weapon';
import { HUD } from '../ui/HUD';
import { DamageNumbers } from '../ui/DamageNumbers';
import {
  ENEMY,
  WAVE,
  EFFECTS,
  LEVEL,
  PROP,
  FEEDBACK,
  WEAPON,
  SKILL,
  PLAYER,
  ELITE,
  BARREL
} from '../data/balance';
import { CHARACTER_SKILLS, SkillDef } from '../data/skills';
import { EffectId, EnemyKind, InputState, MetaEffectId, isElite, isProp } from '../types';

/** 命中碎裂粒子的染色：按敌人种类取其主体色 */
const HIT_SHARD_TINTS: Record<EnemyKind, number> = {
  chaser: COLORS.chaser,
  charger: COLORS.charger,
  brute: COLORS.brute,
  shooter: COLORS.shooter,
  tree: 0x2f7d46,
  barrel: 0xb03a2e,
  boss: 0x7d1f3f
};

interface EliteTelegraph {
  timer: Phaser.Time.TimerEvent;
  markers: Phaser.GameObjects.GameObject[];
}

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemyGroup!: Phaser.GameObjects.Group;
  private projectileGroup!: Phaser.GameObjects.Group;
  private enemyBulletGroup!: Phaser.GameObjects.Group;
  private pickupGroup!: Phaser.GameObjects.Group;
  private waveManager!: WaveManager;
  private collisionSystem!: CollisionSystem;
  private dropSystem!: DropSystem;
  private weapon!: Weapon;
  private hud!: HUD;
  private hitEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private hitShardEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private deathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private eliteDeathEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private eliteTelegraphs: EliteTelegraph[] = [];
  private skillDef!: SkillDef;
  private skillCooldown = 0;
  /** 升到 SKILL.upgradeLevel 后，等升级弹窗关闭再提示技能强化 */
  private pendingSkillUpgradeNotice = false;
  private questionOffersTotal = 0;
  private questionOffersDone = 0;
  private damageNumbers!: DamageNumbers;
  private hurtVignette!: Phaser.GameObjects.Image;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private isGameOver = false;
  private levelUpOpen = false;

  constructor() {
    super(SCENE_KEYS.Game);
  }

  create(): void {
    this.isGameOver = false;
    this.levelUpOpen = false;
    this.eliteTelegraphs = [];
    this.questionOffersTotal = 0;
    this.questionOffersDone = 0;
    this.skillDef = CHARACTER_SKILLS[RunData.character.id];
    this.skillCooldown = this.skillDef.active ? 0 : this.skillRecoverTotal(false);
    this.pendingSkillUpgradeNotice = false;

    // BGM 全局循环播放，跨场景/重开不重复启动
    if (!this.sound.get('bgm')) {
      this.sound.play('bgm', { loop: true, volume: BGM_VOLUME });
    }

    // 地图外区域显示为更深的底色，地图内保留网格；尺寸随角色配置
    const mapWidth = RunData.mapWidth;
    const mapHeight = RunData.mapHeight;
    this.cameras.main.setBackgroundColor(COLORS.mapOutside);
    this.add
      .tileSprite(mapWidth / 2, mapHeight / 2, mapWidth, mapHeight, 'bg-grid')
      .setDepth(DEPTH.bg);
    this.add
      .rectangle(mapWidth / 2, mapHeight / 2, mapWidth, mapHeight, 0x000000, 0)
      .setStrokeStyle(6, COLORS.mapBorder)
      .setDepth(DEPTH.bg + 1);

    this.player = new Player(
      this,
      mapWidth / 2,
      mapHeight / 2,
      RunData.attributes,
      `player-${RunData.character.id}`
    );

    // 无相机边界限制：玩家始终停留在视口正中心，靠地图滚动体现移动
    this.cameras.main.startFollow(this.player, true, 1, 1);

    // 受伤红屏：固定在屏幕上、位于 HUD 之下的边缘渐变层
    this.hurtVignette = this.add
      .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'hurt-vignette')
      .setScrollFactor(0)
      .setDepth(DEPTH.hud - 1)
      .setAlpha(0);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >;

    this.enemyGroup = this.add.group({ classType: Enemy, maxSize: WAVE.maxAlive + 20 });
    this.projectileGroup = this.add.group({ classType: Projectile, maxSize: 64 });
    this.enemyBulletGroup = this.add.group({ classType: EnemyBullet, maxSize: 96 });
    this.pickupGroup = this.add.group({ classType: Pickup, maxSize: 128 });
    this.dropSystem = new DropSystem(this.pickupGroup);

    this.weapon = new Weapon(
      this,
      this.player,
      this.projectileGroup,
      () => this.enemyGroup.getChildren() as Enemy[]
    );

    this.waveManager = new WaveManager(
      (kind) => this.spawnEnemy(kind),
      (wave) => this.onWaveCleared(wave),
      RunData.difficultyDef.enemyCount
    );
    this.collisionSystem = new CollisionSystem();

    this.events.off(ENEMY_DIED_EVENT, this.handleEnemyDeath, this);
    this.events.on(ENEMY_DIED_EVENT, this.handleEnemyDeath, this);
    this.events.off(ENEMY_SHOOT_EVENT, this.onEnemyShoot, this);
    this.events.on(ENEMY_SHOOT_EVENT, this.onEnemyShoot, this);
    this.events.off(PLAYER_HURT_EVENT, this.onPlayerHurt, this);
    this.events.on(PLAYER_HURT_EVENT, this.onPlayerHurt, this);

    this.hitEmitter = this.add
      .particles(0, 0, 'particle', {
        lifespan: 220,
        speed: { min: 50, max: 150 },
        scale: { start: 0.7, end: 0 },
        emitting: false,
        tint: 0xffe066,
        blendMode: Phaser.BlendModes.ADD
      })
      .setDepth(DEPTH.fx);
    // 命中碎裂：按敌人颜色染色的碎片向四周迸射并淡出
    this.hitShardEmitter = this.add
      .particles(0, 0, 'shard', {
        lifespan: { min: 220, max: 380 },
        speed: { min: 90, max: 260 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0.2 },
        alpha: { start: 1, end: 0 },
        emitting: false,
        tint: 0xffffff
      })
      .setDepth(DEPTH.fx);
    this.deathEmitter = this.add
      .particles(0, 0, 'particle', {
        lifespan: 380,
        speed: { min: 80, max: 220 },
        scale: { start: 1, end: 0 },
        emitting: false,
        tint: [0xff6b6b, 0xff9f43],
        blendMode: Phaser.BlendModes.ADD
      })
      .setDepth(DEPTH.fx);
    // 精英死亡黑白碎裂粒子
    this.eliteDeathEmitter = this.add
      .particles(0, 0, 'shard', {
        lifespan: { min: 280, max: 480 },
        speed: { min: 60, max: 190 },
        angle: { min: 0, max: 360 },
        rotate: { min: 0, max: 360 },
        scale: { start: 1, end: 0.15 },
        alpha: { start: 1, end: 0 },
        emitting: false,
        tint: [0xe6e8ec, 0x9aa0b5]
      })
      .setDepth(DEPTH.fx);
    this.damageNumbers = new DamageNumbers(this);
    this.events.off(ENEMY_HIT_EVENT, this.onEnemyHit, this);
    this.events.on(ENEMY_HIT_EVENT, this.onEnemyHit, this);

    EventBus.off(Events.PlayerDied, this.onPlayerDied, this);
    EventBus.on(Events.PlayerDied, this.onPlayerDied, this);
    EventBus.off(Events.ShopClosed, this.onShopClosed, this);
    EventBus.on(Events.ShopClosed, this.onShopClosed, this);
    EventBus.off(Events.LevelUpClosed, this.onLevelUpClosed, this);
    EventBus.on(Events.LevelUpClosed, this.onLevelUpClosed, this);
    EventBus.off(Events.QuestionClosed, this.onQuestionClosed, this);
    EventBus.on(Events.QuestionClosed, this.onQuestionClosed, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.PlayerDied, this.onPlayerDied, this);
      EventBus.off(Events.ShopClosed, this.onShopClosed, this);
      EventBus.off(Events.LevelUpClosed, this.onLevelUpClosed, this);
      EventBus.off(Events.QuestionClosed, this.onQuestionClosed, this);
    });

    this.hud = new HUD(this, () => this.pauseGame(), () => this.tryActiveSkill());
    this.input.keyboard!.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard!.on('keydown-P', () => this.pauseGame());
    // 主动技能：空格释放（addKey 同时阻止页面滚动）
    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.input.keyboard!.on('keydown-SPACE', () => this.tryActiveSkill());
    if (DEBUG) this.setupDebugKeys();

    this.waveManager.startWave(1);
    this.spawnProps(1);
    Sfx.waveStart();
  }

  /** 当前进行中的波次（PauseScene 结算展示用） */
  get currentWave(): number {
    return this.waveManager.wave;
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    this.player.update(delta, this.readInput());

    const enemies = this.enemyGroup.getChildren() as Enemy[];
    for (const enemy of enemies) {
      enemy.update(delta, this.player);
    }

    const projectiles = this.projectileGroup.getChildren() as Projectile[];
    for (const projectile of projectiles) {
      projectile.update(delta);
    }

    const enemyBullets = this.enemyBulletGroup.getChildren() as EnemyBullet[];
    for (const bullet of enemyBullets) {
      bullet.update(delta);
    }

    const pickups = this.pickupGroup.getChildren() as Pickup[];
    for (const pickup of pickups) {
      pickup.update(delta, this.player);
    }

    this.weapon.update(delta);
    this.updateSkill(delta);
    this.collisionSystem.update(delta, this.player, enemies, projectiles, enemyBullets);
    this.waveManager.update(delta);

    this.hud.setReload(this.weapon.reloadProgress);
    this.updateBossBar(enemies);
    this.hud.update(this.player, this.waveManager.wave, WAVE.maxWave, this.waveManager.timeLeft);
  }

  /** 被动技能自动释放；主动技能只推进冷却，由空格 / HUD 按钮触发 */
  private updateSkill(delta: number): void {
    const dt = delta / 1000;
    if (this.skillCooldown > 0) this.skillCooldown = Math.max(0, this.skillCooldown - dt);

    const upgraded = this.isSkillUpgraded();
    const total = this.skillRecoverTotal(upgraded);
    if (!this.skillDef.active && this.skillCooldown <= 0) {
      this.castSkill();
      this.skillCooldown = total;
    }
    this.hud.updateSkill(
      this.skillDef.name,
      this.skillDef.active,
      upgraded,
      this.skillCooldown,
      total
    );
  }

  private isSkillUpgraded(): boolean {
    return RunData.level >= SKILL.upgradeLevel;
  }

  private skillRecoverTotal(upgraded: boolean): number {
    switch (this.skillDef.id) {
      case 'barrageRing':
        return upgraded ? SKILL.barrage.upgradedInterval : SKILL.barrage.interval;
      case 'piercingShot':
        return upgraded ? SKILL.piercing.upgradedCooldown : SKILL.piercing.cooldown;
      case 'groundSlam':
        return upgraded ? SKILL.slam.upgradedCooldown : SKILL.slam.cooldown;
    }
  }

  /** 主动技能入口：空格与 HUD 技能按钮共用，冷却中或暂停时忽略 */
  private tryActiveSkill(): void {
    if (!this.scene.isActive() || this.isGameOver || !this.skillDef.active) return;
    if (this.skillCooldown > 0) return;
    this.castSkill();
    this.skillCooldown = this.skillRecoverTotal(this.isSkillUpgraded());
  }

  private castSkill(): void {
    const upgraded = this.isSkillUpgraded();
    switch (this.skillDef.id) {
      case 'barrageRing':
        this.castBarrage(upgraded);
        break;
      case 'piercingShot':
        this.castPiercing(upgraded);
        break;
      case 'groundSlam':
        this.castGroundSlam(upgraded);
        break;
    }
  }

  /** 突击者：向四周释放两圈弹幕，5 级后间隔缩短、弹数与伤害提升 */
  private castBarrage(upgraded: boolean): void {
    const cfg = SKILL.barrage;
    const damage =
      this.weapon.getBaseHitDamage() * (upgraded ? cfg.upgradedDamageMult : cfg.damageMult);
    const bullets = upgraded ? cfg.upgradedBulletsPerRing : cfg.bulletsPerRing;
    const speeds = upgraded ? cfg.upgradedSpeeds : cfg.speeds;
    const range = upgraded ? cfg.upgradedRange : cfg.range;

    for (const speed of speeds) {
      const life = range / speed + WEAPON.projectileLifeMargin;
      for (let i = 0; i < bullets; i++) {
        const projectile = this.projectileGroup.get() as Projectile | null;
        if (!projectile) continue;
        const angle = (Math.PI * 2 * i) / bullets;
        projectile.launch(this.player.x, this.player.y, angle, {
          damage,
          pierce: 0,
          isCrit: false,
          speed,
          life
        });
      }
    }
    this.cameras.main.shake(cfg.shakeDuration, cfg.shakeIntensity);
    Sfx.skill();
  }

  /** 游侠：向最近敌人射出高伤穿透箭，5 级后双箭齐发 */
  private castPiercing(upgraded: boolean): void {
    const cfg = SKILL.piercing;
    const target = this.findNearestEnemy();
    const aimX = target ? target.x - this.player.x : this.player.facing.x;
    const aimY = target ? target.y - this.player.y : this.player.facing.y;
    const baseAngle = Math.atan2(aimY, aimX);
    const isCrit = Math.random() < RunData.attributes.critChance;
    const base =
      this.weapon.getBaseHitDamage() * (upgraded ? cfg.upgradedDamageMult : cfg.damageMult);
    const damage = isCrit ? base * PLAYER.critMultiplier : base;
    const shots = upgraded ? cfg.upgradedShots : cfg.shots;
    const life = cfg.range / cfg.speed + WEAPON.projectileLifeMargin;

    for (let i = 0; i < shots; i++) {
      const projectile = this.projectileGroup.get() as Projectile | null;
      if (!projectile) break;
      const offset = shots > 1 ? (i - (shots - 1) / 2) * cfg.spread : 0;
      projectile.launch(this.player.x, this.player.y, baseAngle + offset, {
        damage,
        pierce: cfg.pierce,
        isCrit,
        speed: cfg.speed,
        life
      });
      projectile.setScale(isCrit ? 2.2 : 1.8);
      if (!isCrit) projectile.setTint(0x8affc1);
    }
    Sfx.skill();
  }

  /** 重装：震击自身周围的敌人，5 级后范围与伤害提升 */
  private castGroundSlam(upgraded: boolean): void {
    const cfg = SKILL.slam;
    const radius = upgraded ? cfg.upgradedRadius : cfg.radius;
    const damage =
      this.weapon.getBaseHitDamage() * (upgraded ? cfg.upgradedDamageMult : cfg.damageMult);

    const ring = this.add
      .circle(this.player.x, this.player.y, radius, 0x4dd0e1, 0.28)
      .setDepth(DEPTH.fx)
      .setScale(0.2);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });

    for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
      if (!enemy.active) continue;
      const dx = enemy.x - this.player.x;
      const dy = enemy.y - this.player.y;
      const reach = radius + enemy.radius;
      if (dx * dx + dy * dy <= reach * reach) enemy.takeDamage(damage);
    }

    this.cameras.main.shake(cfg.shakeDuration, cfg.shakeIntensity);
    Sfx.skill();
  }

  private findNearestEnemy(): Enemy | null {
    let nearest: Enemy | null = null;
    let best = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
      if (!enemy.active || isProp(enemy.kind)) continue;
      const distSq = Phaser.Math.Distance.Squared(
        enemy.x,
        enemy.y,
        this.player.x,
        this.player.y
      );
      if (distSq < best) {
        best = distSq;
        nearest = enemy;
      }
    }
    return nearest;
  }

  private updateBossBar(enemies: Enemy[]): void {
    let boss: Enemy | null = null;
    for (const enemy of enemies) {
      if (enemy.active && enemy.kind === 'boss') {
        boss = enemy;
        break;
      }
    }
    this.hud.setBossBar(boss ? boss.hp / boss.maxHp : null);
  }

  private spawnEnemy(
    kind: EnemyKind,
    at?: { x: number; y: number },
    immediate = false
  ): boolean {
    const pos = at ?? (isElite(kind) ? this.randomEliteSpawnPosition() : this.randomSpawnPosition());
    // 精英与 Boss 先显示红点，延迟生成
    if (isElite(kind) && !immediate) {
      this.showEliteTelegraph(kind, pos);
      return true;
    }
    return this.spawnEnemyNow(kind, pos);
  }

  private spawnEnemyNow(kind: EnemyKind, pos: { x: number; y: number }): boolean {
    const enemy = this.enemyGroup.get() as Enemy | null;
    if (!enemy) return false;

    const wave = this.waveManager.wave;
    const mod = RunData.difficultyDef;
    const base = ENEMY[kind];
    const hp =
      kind === 'chaser'
        ? WAVE.chaserHp(wave) * mod.enemyHp
        : kind === 'charger'
          ? WAVE.chargerHp(wave) * mod.enemyHp
          : kind === 'brute'
            ? WAVE.bruteHp(wave) * mod.enemyHp
            : kind === 'shooter'
              ? WAVE.shooterHp(wave) * mod.bossHp
              : kind === 'boss'
                ? WAVE.bossHp(wave) * mod.bossHp
                : base.hp;

    let ranged: RangedConfig | undefined;
    if (kind === 'shooter') {
      ranged = {
        range: ENEMY.shooter.shootRange,
        interval: ENEMY.shooter.shootInterval,
        bulletSpeed: ENEMY.shooter.bulletSpeed,
        bulletDamage: ENEMY.shooter.bulletDamage * mod.enemyDamage,
        burst: ENEMY.shooter.burst,
        spread: ENEMY.shooter.spread
      };
    } else if (kind === 'boss') {
      ranged = {
        range: ENEMY.boss.shootRange,
        interval: ENEMY.boss.shootInterval,
        bulletSpeed: ENEMY.boss.bulletSpeed,
        bulletDamage: ENEMY.boss.bulletDamage * mod.enemyDamage,
        burst: ENEMY.boss.burst,
        spread: ENEMY.boss.spread
      };
    }

    let charge: ChargeConfig | undefined;
    if (kind === 'charger') {
      charge = {
        range: ENEMY.charger.chargeRange,
        windup: ENEMY.charger.chargeWindup,
        speed: ENEMY.charger.chargeSpeed,
        duration: ENEMY.charger.chargeDuration,
        cooldown: ENEMY.charger.chargeCooldown
      };
    }

    enemy.spawn(pos.x, pos.y, {
      kind,
      hp,
      speed: base.speed,
      // 难度提升敌人接触伤害与弹幕伤害
      damage: base.damage * mod.enemyDamage,
      radius: base.radius,
      ranged,
      charge
    });
    MetaProgress.discoverEnemy(kind);
    return true;
  }

  /** 精英出生提示：较大红点脉冲 + 扩散圆环，到时生成 */
  private showEliteTelegraph(kind: EnemyKind, pos: { x: number; y: number }): void {
    const boss = kind === 'boss';
    const radius = boss ? ELITE.bossMarkRadius : ELITE.markRadius;
    const color = 0xff2d2d;
    const dot = this.add.circle(pos.x, pos.y, radius, color, 0.9).setDepth(DEPTH.fx);
    const ring = this.add
      .circle(pos.x, pos.y, radius * 1.4, color, 0)
      .setStrokeStyle(3, color, 0.85)
      .setDepth(DEPTH.fx);

    this.tweens.add({
      targets: dot,
      alpha: 0.35,
      scale: 1.2,
      duration: 260,
      yoyo: true,
      repeat: -1
    });
    this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 520, repeat: -1 });

    const timer = this.time.delayedCall(
      (boss ? ELITE.bossTelegraphTime : ELITE.telegraphTime) * 1000,
      () => {
        this.eliteTelegraphs = this.eliteTelegraphs.filter((t) => t.timer !== timer);
        this.tweens.killTweensOf(dot);
        this.tweens.killTweensOf(ring);
        dot.destroy();
        ring.destroy();
        if (this.isGameOver || this.waveManager.state !== 'running') return;
        this.spawnEnemyNow(kind, pos);
      }
    );
    this.eliteTelegraphs.push({ timer, markers: [dot, ring] });
  }

  private clearEliteTelegraphs(): void {
    for (const { timer, markers } of this.eliteTelegraphs) {
      timer.remove(false);
      for (const marker of markers) {
        this.tweens.killTweensOf(marker);
        marker.destroy();
      }
    }
    this.eliteTelegraphs = [];
  }

  /** 精英在视口内靠近边缘处生成，保证红点提示可见 */
  private randomEliteSpawnPosition(): { x: number; y: number } {
    const halfW = GAME_WIDTH / 2 - ELITE.viewportInset;
    const halfH = GAME_HEIGHT / 2 - ELITE.viewportInset;
    const m = WAVE.spawnMargin;

    for (let attempt = 0; attempt < 16; attempt++) {
      const side = Phaser.Math.Between(0, 3);
      let x: number;
      let y: number;
      if (side < 2) {
        x = this.player.x + Phaser.Math.Between(-halfW, halfW);
        y = this.player.y + (side === 0 ? -halfH : halfH);
      } else {
        x = this.player.x + (side === 2 ? -halfW : halfW);
        y = this.player.y + Phaser.Math.Between(-halfH, halfH);
      }
      const dist = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y);
      if (dist < ELITE.minPlayerDist) continue;
      if (x >= m && x <= RunData.mapWidth - m && y >= m && y <= RunData.mapHeight - m) {
        return { x, y };
      }
    }

    return {
      x: Phaser.Math.Clamp(this.player.x + halfW, m, RunData.mapWidth - m),
      y: Phaser.Math.Clamp(this.player.y, m, RunData.mapHeight - m)
    };
  }

  /** 在地图内围绕玩家放置苹果树与炸药桶：首棵苹果树保证在视野内，其余散布在附近 */
  private spawnProps(wave: number): void {
    const placed: Array<{ x: number; y: number }> = [];
    this.placeProps('tree', PROP.count(wave), placed, true);
    this.placeProps('barrel', PROP.barrelCount(wave), placed, false);
  }

  private placeProps(
    kind: 'tree' | 'barrel',
    count: number,
    placed: Array<{ x: number; y: number }>,
    firstNearPlayer: boolean
  ): void {
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist =
          firstNearPlayer && i === 0
            ? Phaser.Math.Between(PROP.nearPlayerMin, PROP.nearPlayerMax)
            : Phaser.Math.Between(PROP.minPlayerDist, PROP.scatterRadius);
        const x = Phaser.Math.Clamp(
          this.player.x + Math.cos(angle) * dist,
          PROP.margin,
          RunData.mapWidth - PROP.margin
        );
        const y = Phaser.Math.Clamp(
          this.player.y + Math.sin(angle) * dist,
          PROP.margin,
          RunData.mapHeight - PROP.margin
        );
        if (
          Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < PROP.minPlayerDist
        ) {
          continue;
        }
        if (placed.some((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) < PROP.minGap)) {
          continue;
        }

        placed.push({ x, y });
        this.spawnProp(x, y, kind);
        break;
      }
    }
  }

  private spawnProp(x: number, y: number, kind: 'tree' | 'barrel'): void {
    const prop = this.enemyGroup.get() as Enemy | null;
    if (!prop) return;

    const base = ENEMY[kind];
    prop.spawn(x, y, {
      kind,
      hp: base.hp,
      speed: base.speed,
      damage: base.damage,
      radius: base.radius
    });
    MetaProgress.discoverEnemy(kind);
  }

  /** 在视野外、地图边界内取生成点（相机跟随玩家，因此以玩家位置为基准） */
  private randomSpawnPosition(): { x: number; y: number } {
    const halfW = GAME_WIDTH / 2;
    const halfH = GAME_HEIGHT / 2;
    const m = WAVE.spawnMargin;

    for (let attempt = 0; attempt < 16; attempt++) {
      const side = Phaser.Math.Between(0, 3);
      let x: number;
      let y: number;
      if (side < 2) {
        x = this.player.x + Phaser.Math.Between(-halfW, halfW);
        y = this.player.y + (side === 0 ? -halfH - m : halfH + m);
      } else {
        x = this.player.x + (side === 2 ? -halfW - m : halfW + m);
        y = this.player.y + Phaser.Math.Between(-halfH, halfH);
      }
      if (x >= m && x <= RunData.mapWidth - m && y >= m && y <= RunData.mapHeight - m) {
        return { x, y };
      }
    }

    // 玩家贴近地图角落时，对侧边可能不可用，兜底取离玩家最远的地图角落
    return {
      x: this.player.x < RunData.mapWidth / 2 ? RunData.mapWidth - m : m,
      y: this.player.y < RunData.mapHeight / 2 ? RunData.mapHeight - m : m
    };
  }

  private onEnemyHit(
    x: number,
    y: number,
    amount: number,
    isCrit: boolean,
    kind: EnemyKind
  ): void {
    // 声音先到，视觉略延迟
    Sfx.hit();
    this.time.delayedCall(FEEDBACK.sfxLeadMs, () => {
      this.hitShardEmitter.setParticleTint(HIT_SHARD_TINTS[kind] ?? 0xffffff);
      this.hitShardEmitter.emitParticleAt(x, y, 7);
      this.hitEmitter.emitParticleAt(x, y, 4);
      this.damageNumbers.show(x, y, amount, isCrit);
    });
  }

  private onEnemyShoot(x: number, y: number, angle: number, ranged: RangedConfig): void {
    const count = Math.max(1, ranged.burst);
    const start = angle - (ranged.spread * (count - 1)) / 2;
    for (let i = 0; i < count; i++) {
      const bullet = this.enemyBulletGroup.get() as EnemyBullet | null;
      if (!bullet) return;
      bullet.launch(x, y, start + ranged.spread * i, ranged.bulletSpeed, ranged.bulletDamage);
    }
  }

  private handleEnemyDeath(enemy: Enemy): void {
    // 炸药桶：爆炸伤害同时作用于敌人与玩家，不计击杀
    if (enemy.kind === 'barrel') {
      this.explodeBarrel(enemy);
      this.dropSystem.spawnFor(enemy);
      this.gainXp(ENEMY.barrel.xp);
      return;
    }

    this.deathEmitter.emitParticleAt(enemy.x, enemy.y, enemy.kind === 'tree' ? 6 : 10);

    // 苹果树：不计击杀、不触发击杀特效，只给经验与保底掉落
    if (enemy.kind === 'tree') {
      Sfx.kill();
      this.dropSystem.spawnFor(enemy);
      this.gainXp(ENEMY.tree.xp);
      return;
    }

    if (isElite(enemy.kind)) Sfx.eliteKill();
    else Sfx.kill();

    this.spawnDeathGhost(enemy);
    RunData.kills++;
    if (isElite(enemy.kind)) RunData.eliteKills++;
    else RunData.normalKills++;
    if (enemy.kind === 'boss') RunData.bossKilled = true;

    // 击杀回血：特效饰品按层数 × 每层回复，局外天赋每级固定 +1
    const lifesteal =
      RunData.getEffect(EffectId.Lifesteal) * EFFECTS.lifestealPerStack +
      RunData.getMetaEffect(MetaEffectId.Lifesteal);
    if (lifesteal > 0) {
      this.player.heal(lifesteal);
    }

    // 击杀爆炸（概率随层数递增，可连锁）
    const explosionStacks = RunData.getEffect(EffectId.Explosion);
    if (
      explosionStacks > 0 &&
      Math.random() < Math.min(1, EFFECTS.explosionChancePerStack * explosionStacks)
    ) {
      this.explodeAt(enemy.x, enemy.y);
    }

    this.dropSystem.spawnFor(enemy);
    this.waveManager.onEnemyDeath();
    this.gainXp(ENEMY[enemy.kind].xp);
  }

  /** 死亡残影：小怪放大+上漂淡出；精英先黑白僵直，再放大变透明消失 */
  private spawnDeathGhost(enemy: Enemy): void {
    const elite = isElite(enemy.kind);
    const grayKey = `${enemy.texture.key}-gray`;
    const textureKey = elite && this.textures.exists(grayKey) ? grayKey : enemy.texture.key;
    const ghost = this.add.sprite(enemy.x, enemy.y, textureKey).setDepth(DEPTH.enemy);
    ghost.clearTint();

    if (elite) {
      this.eliteDeathEmitter.emitParticleAt(enemy.x, enemy.y, enemy.kind === 'boss' ? 24 : 12);
      this.tweens.add({
        targets: ghost,
        scale: FEEDBACK.elitePopScale,
        alpha: 0,
        delay: FEEDBACK.eliteFreezeDuration,
        duration: FEEDBACK.eliteFadeDuration,
        ease: 'Quad.easeOut',
        onComplete: () => ghost.destroy()
      });
      return;
    }

    this.tweens.chain({
      targets: ghost,
      tweens: [
        {
          scale: FEEDBACK.deathPopScale,
          alpha: FEEDBACK.deathPopAlpha,
          delay: FEEDBACK.sfxLeadMs,
          duration: FEEDBACK.deathPopDuration,
          ease: 'Quad.easeOut'
        },
        {
          y: `-=${FEEDBACK.deathFloatDistance}`,
          alpha: 0,
          duration: FEEDBACK.deathFloatDuration,
          ease: 'Quad.easeIn'
        }
      ],
      onComplete: () => ghost.destroy()
    });
  }

  /** 炸药桶爆炸：范围伤害同时作用于敌人与玩家，可连锁引爆其他桶 */
  private explodeBarrel(enemy: Enemy): void {
    Sfx.explosion();
    this.cameras.main.shake(BARREL.shakeDuration, BARREL.shakeIntensity);
    this.deathEmitter.emitParticleAt(enemy.x, enemy.y, 18);
    this.hitShardEmitter.setParticleTint(0xff9f43);
    this.hitShardEmitter.emitParticleAt(enemy.x, enemy.y, 14);

    const ring = this.add
      .circle(enemy.x, enemy.y, BARREL.explosionRadius, 0xff7b2d, 0.3)
      .setDepth(DEPTH.fx)
      .setScale(0.15);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 300,
      onComplete: () => ring.destroy()
    });

    for (const target of this.enemyGroup.getChildren() as Enemy[]) {
      if (!target.active) continue;
      const dx = target.x - enemy.x;
      const dy = target.y - enemy.y;
      const reach = BARREL.explosionRadius + target.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        target.takeDamage(BARREL.explosionDamage);
      }
    }

    const pdx = this.player.x - enemy.x;
    const pdy = this.player.y - enemy.y;
    const preach = BARREL.explosionRadius + this.player.radius;
    if (pdx * pdx + pdy * pdy <= preach * preach) {
      this.player.takeDamage(BARREL.playerDamage);
    }
  }

  private gainXp(amount: number): void {
    const beforeLevel = RunData.level;
    const levels = RunData.addXp(amount);
    if (beforeLevel < SKILL.upgradeLevel && RunData.level >= SKILL.upgradeLevel) {
      this.pendingSkillUpgradeNotice = true;
    }
    if (levels <= 0) return;
    RunData.pendingLevelUps += levels;
    this.openLevelUp();
  }

  private openLevelUp(): void {
    if (this.isGameOver || this.levelUpOpen) return;
    this.levelUpOpen = true;
    Sfx.levelUp();
    this.scene.launch(SCENE_KEYS.LevelUp);
    this.scene.pause();
  }

  private onLevelUpClosed(): void {
    this.levelUpOpen = false;
    if (RunData.pendingHeal > 0) {
      this.player.heal(RunData.pendingHeal);
      RunData.pendingHeal = 0;
    }
    // 5 级技能强化在升级弹窗关闭后提示，避免被覆盖层遮住
    if (this.pendingSkillUpgradeNotice) {
      this.pendingSkillUpgradeNotice = false;
      this.hud.showSkillUpgrade(this.skillDef.name);
    }
  }

  private explodeAt(x: number, y: number): void {
    const radius = EFFECTS.explosionRadius;
    const damage = this.weapon.getBaseHitDamage() * EFFECTS.explosionDamageMult;
    Sfx.explosion();

    const ring = this.add
      .circle(x, y, radius, 0xff9f43, 0.28)
      .setDepth(DEPTH.fx)
      .setScale(0.15);
    this.tweens.add({
      targets: ring,
      scale: 1,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy()
    });

    for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
      if (!enemy.active) continue;
      const dx = enemy.x - x;
      const dy = enemy.y - y;
      const reach = radius + enemy.radius;
      if (dx * dx + dy * dy <= reach * reach) {
        enemy.takeDamage(damage);
      }
    }
  }

  /** 调试快捷键：1-5 注入对应特效饰品，0 清空特效 */
  private setupDebugKeys(): void {
    const keyboard = this.input.keyboard!;
    const bindings: Array<[string, EffectId]> = [
      ['keydown-ONE', EffectId.Pierce],
      ['keydown-TWO', EffectId.Lifesteal],
      ['keydown-THREE', EffectId.MultiShot],
      ['keydown-FOUR', EffectId.Explosion],
      ['keydown-FIVE', EffectId.HeavyShot]
    ];
    for (const [event, effect] of bindings) {
      keyboard.on(event, () => {
        if (effect === EffectId.HeavyShot && RunData.getEffect(effect) >= EFFECTS.heavyMaxStacks) {
          return;
        }
        RunData.addEffect(effect);
      });
    }
    keyboard.on('keydown-ZERO', () => RunData.effects.clear());
    // 击碎场上全部苹果树，用于测试掉落
    keyboard.on('keydown-B', () => {
      for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
        if (enemy.active && enemy.kind === 'tree') enemy.takeDamage(999999);
      }
    });
    // 100% 暴击，用于测试暴击伤害飘字
    keyboard.on('keydown-C', () => {
      RunData.attributes.addModifier({
        id: 'debug:crit',
        key: AttrKey.CritChance,
        type: 'flat',
        value: 1
      });
    });
    // 在视野内右侧立即生成一只弹幕精英，用于测试远程弹幕
    keyboard.on('keydown-H', () => {
      this.spawnEnemy(
        'shooter',
        {
          x: Phaser.Math.Clamp(this.player.x + 280, 60, RunData.mapWidth - 60),
          y: Phaser.Math.Clamp(this.player.y, 60, RunData.mapHeight - 60)
        },
        true
      );
    });
    // 立即释放当前角色技能（无视冷却），用于测试技能表现
    keyboard.on('keydown-G', () => this.castSkill());
    // 在玩家右侧生成一只突击怪，用于测试蓄力冲刺
    keyboard.on('keydown-V', () => {
      this.spawnEnemyNow('charger', {
        x: Phaser.Math.Clamp(this.player.x + 260, 60, RunData.mapWidth - 60),
        y: Phaser.Math.Clamp(this.player.y, 60, RunData.mapHeight - 60)
      });
    });
    // 带红点提示生成 Boss（屏幕上方右侧），用于测试 Boss 血条
    keyboard.on('keydown-J', () => {
      this.spawnEnemy('boss', {
        x: Phaser.Math.Clamp(this.player.x + 300, 80, RunData.mapWidth - 80),
        y: Phaser.Math.Clamp(this.player.y - 120, 80, RunData.mapHeight - 80)
      });
    });
    // 在玩家右侧生成一只炸药桶，用于测试爆炸
    keyboard.on('keydown-N', () => {
      this.spawnProp(
        Phaser.Math.Clamp(this.player.x + 120, 40, RunData.mapWidth - 40),
        Phaser.Math.Clamp(this.player.y, 40, RunData.mapHeight - 40),
        'barrel'
      );
    });
    // 引爆场上全部炸药桶
    keyboard.on('keydown-U', () => {
      for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
        if (enemy.active && enemy.kind === 'barrel') enemy.takeDamage(999999);
      }
    });
    // 立即进入装填，用于测试蓄力条
    keyboard.on('keydown-R', () => this.weapon.debugReload());
    // 秒杀距玩家最近的怪物（不含可破坏物），用于测试死亡表现
    keyboard.on('keydown-K', () => {
      let target: Enemy | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
        if (!enemy.active || isProp(enemy.kind)) continue;
        const d = Phaser.Math.Distance.Squared(enemy.x, enemy.y, this.player.x, this.player.y);
        if (d < best) {
          best = d;
          target = enemy;
        }
      }
      target?.takeDamage(999999);
    });
    // 直接加一级所需经验，用于测试升级选属性流程
    keyboard.on('keydown-SIX', () => this.gainXp(LEVEL.xpToNext));
    keyboard.on('keydown-EIGHT', () => {
      RunData.addGold(100);
      EventBus.emit(Events.GoldChanged, RunData.gold);
    });
    // 秒杀玩家，用于测试死亡/结算流程
    keyboard.on('keydown-SEVEN', () => this.player.takeDamage(999999));
    keyboard.on('keydown-NINE', () => {
      this.waveManager.debugSkip();
    });
    // 直接获得 1 个小问号，用于测试波后问号事件
    keyboard.on('keydown-Q', () => {
      RunData.questionMarks++;
    });
  }

  private pauseGame(): void {
    if (this.isGameOver) return;
    Sfx.ui();
    this.scene.launch(SCENE_KEYS.Pause);
    this.scene.pause();
  }

  private onPlayerHurt(): void {
    this.cameras.main.shake(FEEDBACK.hurtShakeDuration, FEEDBACK.hurtShakeIntensity);

    this.tweens.killTweensOf(this.hurtVignette);
    this.hurtVignette.setAlpha(FEEDBACK.hurtVignetteAlpha);
    this.tweens.add({
      targets: this.hurtVignette,
      alpha: 0,
      delay: FEEDBACK.hurtVignetteHold,
      duration: FEEDBACK.hurtVignetteFade,
      ease: 'Quad.easeOut'
    });
  }

  private onPlayerDied(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

    this.time.delayedCall(600, () => {
      this.scene.launch(SCENE_KEYS.GameOver, {
        wave: this.waveManager.wave,
        normalKills: RunData.normalKills,
        eliteKills: RunData.eliteKills,
        victory: false
      });
      this.scene.pause();
    });
  }

  private onWaveCleared(wave: number): void {
    this.clearEliteTelegraphs();

    // 倒计时结束：场上剩余敌人与弹幕直接回收，不计击杀、不掉落
    for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
      if (enemy.active) enemy.recycle();
    }
    for (const bullet of this.enemyBulletGroup.getChildren() as EnemyBullet[]) {
      if (bullet.active) bullet.recycle();
    }

    RunData.wave = wave;
    const bonus = WAVE.reward(wave);
    RunData.addGold(bonus);
    EventBus.emit(Events.GoldChanged, RunData.gold);
    this.hud.showWaveCleared(wave, bonus);
    Sfx.waveClear();

    this.time.delayedCall(1600, () => {
      if (wave >= WAVE.maxWave) {
        this.isGameOver = true;
        this.scene.launch(SCENE_KEYS.GameOver, {
          wave,
          normalKills: RunData.normalKills,
          eliteKills: RunData.eliteKills,
          victory: true
        });
        this.scene.pause();
        return;
      }
      // 持有的每个小问号都会各获得一次选择机会，全部处理完再进商店
      if (RunData.questionMarks > 0) {
        this.questionOffersTotal = RunData.questionMarks;
        this.questionOffersDone = 0;
        this.openQuestion();
        return;
      }
      this.openShop();
    });
  }

  private openShop(): void {
    this.scene.launch(SCENE_KEYS.Shop);
    this.scene.pause();
  }

  private openQuestion(): void {
    this.scene.launch(SCENE_KEYS.Question, {
      index: this.questionOffersDone,
      total: this.questionOffersTotal
    });
    this.scene.pause();
  }

  private onQuestionClosed(): void {
    this.questionOffersDone++;
    // 拒绝不会消耗问号，但每个问号每波只展示一次；未消耗的保留到下一波
    if (this.questionOffersDone < this.questionOffersTotal && RunData.questionMarks > 0) {
      this.openQuestion();
      return;
    }
    this.openShop();
  }

  private onShopClosed(): void {
    if (RunData.pendingHeal > 0) {
      this.player.heal(RunData.pendingHeal);
      RunData.pendingHeal = 0;
    }
    const nextWave = RunData.wave + 1;
    const extraCountMult = RunData.nextWaveEnemyMult;
    RunData.nextWaveEnemyMult = 1;
    this.waveManager.startWave(nextWave, extraCountMult);
    this.spawnProps(nextWave);
    Sfx.waveStart();
  }

  private readInput(): InputState {
    const left = this.cursors.left.isDown || this.wasd.A.isDown;
    const right = this.cursors.right.isDown || this.wasd.D.isDown;
    const up = this.cursors.up.isDown || this.wasd.W.isDown;
    const down = this.cursors.down.isDown || this.wasd.S.isDown;
    return {
      x: (right ? 1 : 0) - (left ? 1 : 0),
      y: (down ? 1 : 0) - (up ? 1 : 0)
    };
  }
}
