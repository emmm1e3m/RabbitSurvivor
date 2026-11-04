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
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { Player, PLAYER_HURT_EVENT } from '../entities/Player';
import {
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
import { ENEMY, WAVE, EFFECTS, LEVEL, PROP, FEEDBACK } from '../data/balance';
import { EffectId, EnemyKind, InputState } from '../types';

/** 命中碎裂粒子的染色：按敌人种类取其主体色 */
const HIT_SHARD_TINTS: Record<EnemyKind, number> = {
  chaser: COLORS.chaser,
  brute: COLORS.brute,
  shooter: COLORS.shooter,
  tree: 0x2f7d46
};

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
    this.damageNumbers = new DamageNumbers(this);
    this.events.off(ENEMY_HIT_EVENT, this.onEnemyHit, this);
    this.events.on(ENEMY_HIT_EVENT, this.onEnemyHit, this);

    EventBus.off(Events.PlayerDied, this.onPlayerDied, this);
    EventBus.on(Events.PlayerDied, this.onPlayerDied, this);
    EventBus.off(Events.ShopClosed, this.onShopClosed, this);
    EventBus.on(Events.ShopClosed, this.onShopClosed, this);
    EventBus.off(Events.LevelUpClosed, this.onLevelUpClosed, this);
    EventBus.on(Events.LevelUpClosed, this.onLevelUpClosed, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      EventBus.off(Events.PlayerDied, this.onPlayerDied, this);
      EventBus.off(Events.ShopClosed, this.onShopClosed, this);
      EventBus.off(Events.LevelUpClosed, this.onLevelUpClosed, this);
    });

    this.hud = new HUD(this, () => this.pauseGame());
    this.input.keyboard!.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard!.on('keydown-P', () => this.pauseGame());
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
    this.collisionSystem.update(delta, this.player, enemies, projectiles, enemyBullets);
    this.waveManager.update(delta);

    this.hud.update(this.player, this.waveManager.wave, WAVE.maxWave, this.waveManager.timeLeft);
  }

  private spawnEnemy(kind: EnemyKind, at?: { x: number; y: number }): boolean {
    const enemy = this.enemyGroup.get() as Enemy | null;
    if (!enemy) return false;

    const wave = this.waveManager.wave;
    const mod = RunData.difficultyDef;
    const base = ENEMY[kind];
    const hp =
      kind === 'chaser'
        ? WAVE.chaserHp(wave) * mod.enemyHp
        : kind === 'brute'
          ? WAVE.bruteHp(wave) * mod.enemyHp
          : WAVE.shooterHp(wave) * mod.bossHp;
    const pos = at ?? this.randomSpawnPosition();

    const ranged: RangedConfig | undefined =
      kind === 'shooter'
        ? {
            range: ENEMY.shooter.shootRange,
            interval: ENEMY.shooter.shootInterval,
            bulletSpeed: ENEMY.shooter.bulletSpeed,
            bulletDamage: ENEMY.shooter.bulletDamage * mod.enemyDamage,
            burst: ENEMY.shooter.burst,
            spread: ENEMY.shooter.spread
          }
        : undefined;

    enemy.spawn(pos.x, pos.y, {
      kind,
      hp,
      speed: base.speed,
      // 难度提升敌人接触伤害与弹幕伤害
      damage: base.damage * mod.enemyDamage,
      radius: base.radius,
      ranged
    });
    return true;
  }

  /** 在地图内围绕玩家放置苹果树：首棵保证在视野内，其余散布在附近供探索 */
  private spawnProps(wave: number): void {
    const count = PROP.count(wave);
    const placed: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist =
          i === 0
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
        this.spawnProp(x, y);
        break;
      }
    }
  }

  private spawnProp(x: number, y: number): void {
    const prop = this.enemyGroup.get() as Enemy | null;
    if (!prop) return;

    const base = ENEMY.tree;
    prop.spawn(x, y, {
      kind: 'tree',
      hp: base.hp,
      speed: base.speed,
      damage: base.damage,
      radius: base.radius
    });
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
    this.hitShardEmitter.setParticleTint(HIT_SHARD_TINTS[kind] ?? 0xffffff);
    this.hitShardEmitter.emitParticleAt(x, y, 7);
    this.hitEmitter.emitParticleAt(x, y, 4);
    this.damageNumbers.show(x, y, amount, isCrit);
    Sfx.hit();
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
    this.deathEmitter.emitParticleAt(enemy.x, enemy.y, 10);
    Sfx.kill();

    // 苹果树：不计击杀、不触发击杀特效，只给经验与保底掉落
    if (enemy.kind === 'tree') {
      this.dropSystem.spawnFor(enemy);
      this.gainXp(ENEMY.tree.xp);
      return;
    }

    this.spawnDeathGhost(enemy);
    RunData.kills++;

    // 击杀回血
    const lifesteal = RunData.getEffect(EffectId.Lifesteal);
    if (lifesteal > 0) {
      this.player.heal(lifesteal * EFFECTS.lifestealPerStack);
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

  /** 敌人死亡残影：先放大变透明，再上漂淡出后销毁（不影响对象池） */
  private spawnDeathGhost(enemy: Enemy): void {
    const ghost = this.add.sprite(enemy.x, enemy.y, enemy.texture.key).setDepth(DEPTH.enemy);
    ghost.clearTint();

    this.tweens.chain({
      targets: ghost,
      tweens: [
        {
          scale: FEEDBACK.deathPopScale,
          alpha: FEEDBACK.deathPopAlpha,
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

  private gainXp(amount: number): void {
    const levels = RunData.addXp(amount);
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
    // 在视野内右侧生成一只弹幕精英，用于测试远程弹幕
    keyboard.on('keydown-H', () => {
      this.spawnEnemy('shooter', {
        x: Phaser.Math.Clamp(this.player.x + 280, 60, RunData.mapWidth - 60),
        y: Phaser.Math.Clamp(this.player.y, 60, RunData.mapHeight - 60)
      });
    });
    // 秒杀距玩家最近的怪物（不含苹果树），用于测试死亡表现
    keyboard.on('keydown-K', () => {
      let target: Enemy | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const enemy of this.enemyGroup.getChildren() as Enemy[]) {
        if (!enemy.active || enemy.kind === 'tree') continue;
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
        kills: RunData.kills,
        victory: false
      });
      this.scene.pause();
    });
  }

  private onWaveCleared(wave: number): void {
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
          kills: RunData.kills,
          victory: true
        });
        this.scene.pause();
        return;
      }
      this.scene.launch(SCENE_KEYS.Shop);
      this.scene.pause();
    });
  }

  private onShopClosed(): void {
    if (RunData.pendingHeal > 0) {
      this.player.heal(RunData.pendingHeal);
      RunData.pendingHeal = 0;
    }
    const nextWave = RunData.wave + 1;
    this.waveManager.startWave(nextWave);
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
