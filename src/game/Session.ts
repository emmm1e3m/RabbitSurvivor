import { abilities, characters, enemies as enemyDefs, items, stages, validateContent } from './content';
import type { AttackMods, CharacterId, EnemyState, EquipmentEffect, FollowerState, GameEffect, HazardState, InputState, ItemAction, ItemId, OrbitAppleState, Phase, PickupState, PlayerState, Point, Profile, ProjectileState, PropState, RunResult, SessionOptions, ShopOffer, StageDef, StatKey, DifficultySnapshot } from './types';

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1280;
import { applyStats, collectTalentBonuses, createProfile } from './MetaProgress';
export { createProfile } from './MetaProgress';
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
interface MeleeSwing {
  delay: number; mods: AttackMods; damageScale: number;
  aim: Point; form: string; radius: number; maxTargets: number; comboIndex: number;
}
interface SkillCast { delay: number; kind: string; mods: AttackMods; aim: Point; upgraded: boolean; scale: number }

/** 一局的唯一玩法状态。UI 只能通过动作入口消费资源；表现事件不参与伤害结算。 */
export class Session {
  phase: Phase = 'running';
  paused = false;
  wave = 1;
  waveTime = stages[0].duration;
  elapsed = 0;
  readonly characterId: CharacterId;
  form: string;
  readonly player: PlayerState;
  readonly enemies: EnemyState[] = [];
  readonly projectiles: ProjectileState[] = [];
  readonly props: PropState[] = [];
  readonly pickups: PickupState[] = [];
  readonly followers: FollowerState[] = [];
  readonly hazards: HazardState[] = [];
  readonly orbitApples: OrbitAppleState[] = [];
  readonly inventory: (ItemId | null)[];
  readonly equipment: Record<string, number> = {};
  shop: ShopOffer[] = [];
  result: RunResult | null = null;
  weaponLevel = 1;
  switchCooldown = 0;
  bossesDefeated = 0;
  progressRevision = 0;
  kills = 0;
  coinsEarned = 0;
  readonly acquired: Record<string, number> = {};
  readonly worldWidth = WORLD_WIDTH;
  readonly worldHeight = WORLD_HEIGHT;
  private readonly profile: Profile;
  private readonly talentStats: Record<StatKey, number> = { damage: 0, attackSpeed: 0, maxHp: 0, armor: 0, regen: 0, crit: 0, moveSpeed: 0 };
  private talentEffects: Record<EquipmentEffect, number> = { multishot: 0, pierce: 0, explosion: 0, lifesteal: 0, pickupRange: 0 };
  difficulty: DifficultySnapshot = { hp: 1, damage: 1, growthHp: 1, growthDamage: 1, mechanicTier: 0 };
  private equipmentEffects: Record<EquipmentEffect, number> = { multishot: 0, pierce: 0, explosion: 0, lifesteal: 0, pickupRange: 0 };
  private effects: GameEffect[] = [];
  private seed: number;
  private nextId = 1;
  private spawnTimer = 0.8;
  private attackTimer = 0;
  private reloadTimer = 0;
  ammo = 0;
  private hurtCooldown = 0;
  private rerolls = 0;
  private trainedWaves = 0;
  private incomeRemainder = 0;
  private viewWidth = 900;
  private viewHeight = 650;
  private bossWarning = 0;
  private meleeQueue: MeleeSwing[] = [];
  private skillQueue: SkillCast[] = [];
  private dashHits = new Map<number, number>();
  private dashCooldowns = new Map<number, number>();
  private dashMods: AttackMods | null = null;
  private dashHitBudget = 0;
  private waveSettled = false;

  constructor(characterId: CharacterId, profile: Profile = createProfile(), options: SessionOptions = {}) {
    validateContent();
    if (!characters[characterId]) throw new Error(`角色未注册：${characterId}`);
    this.characterId = characterId;
    this.form = characters[characterId].initialForm;
    this.profile = { ...profile, talents: { ...profile.talents } };
    const permanent = collectTalentBonuses(this.profile);
    Object.assign(this.talentStats, permanent.stats); this.talentEffects = permanent.effects;
    this.seed = (options.seed ?? Date.now()) >>> 0;
    const base = characters[characterId].base;
    this.player = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, hp: base.hp, maxHp: base.hp, shield: 0, maxShield: 0, damage: base.damage, attackSpeed: base.attackSpeed, crit: 0.05, armor: base.armor, regen: base.regen, moveSpeed: base.moveSpeed, range: 330, coins: 0, invulnerable: 0, skillCooldown: 0, skillMaxCooldown: abilities[characters[characterId].abilityId].cooldown, facingX: 1, facingY: 0, speedBoostRemaining: 0, dashRemaining: 0 };
    this.inventory = new Array(1 + Math.min(2, Math.max(0, Math.floor(profile.bossWins)))).fill(null);
    this.recomputeStats();
    this.player.hp = this.player.maxHp;
    this.startWave();
  }

  get biome() { return stages[this.wave - 1].biome; }
  get stage(): StageDef { const template = stages[this.wave - 1]; return { ...template, hpScale: template.hpScale * this.difficulty.hp }; }
  get profileSnapshot(): Profile {
    const value = this.result?.profile ?? { ...this.profile, bestWave: Math.max(this.profile.bestWave, this.wave), totalKills: this.profile.totalKills + this.kills };
    return { ...value, talents: { ...value.talents } };
  }
  get attackMods(): AttackMods { return { damage: this.player.damage, critChance: this.player.crit, shotCount: this.shotCount, pierce: this.pierceCount, explosionChance: Math.min(0.3, this.equipmentEffects.explosion), lifesteal: Math.min(1.5, this.equipmentEffects.lifesteal) }; }
  get rerollCost(): number { return 4 + this.rerolls * 3; }
  get reloadProgress(): number | null { return this.reloadTimer > 0 ? 1 - this.reloadTimer : null; }
  get attackInterval(): number { return (this.melee ? 0.55 : 0.48) / this.player.attackSpeed; }
  get attackCooldownRemaining(): number { return Math.max(0, this.attackTimer); }
  get ability() { const def = characters[this.characterId]; return abilities[def.formAbilities?.[this.form] ?? def.abilityId]; }
  get melee(): boolean { return characters[this.characterId].melee || this.form === 'signal'; }
  get pickupRange(): number { return 90 + this.equipmentEffects.pickupRange; }
  get shotCount(): number { return Math.min(3, 1 + this.equipmentEffects.multishot); }
  get pierceCount(): number { return Math.min(2, this.equipmentEffects.pierce); }
  get lampAcquired(): boolean { return (this.acquired.lamp ?? 0) > 0; }

  setView(widthWorld: number, heightWorld: number): void {
    this.viewWidth = clamp(widthWorld, 280, WORLD_WIDTH - 100);
    this.viewHeight = clamp(heightWorld, 240, WORLD_HEIGHT - 100);
  }
  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  abandon(): void { if (!this.result) this.finish('abandon'); }
  drainEffects(): GameEffect[] { const events = this.effects; this.effects = []; return events; }

  step(delta: number, input: InputState): void {
    if (this.paused || this.phase !== 'running') return;
    const dt = clamp(delta, 0, 0.05);
    if (dt === 0) return;
    this.elapsed += dt;
    this.waveTime = Math.max(0, this.waveTime - dt);
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.player.skillCooldown = Math.max(0, this.player.skillCooldown - dt);
    this.switchCooldown = Math.max(0, this.switchCooldown - dt);
    this.player.speedBoostRemaining = Math.max(0, this.player.speedBoostRemaining - dt);
    this.player.dashRemaining = Math.max(0, this.player.dashRemaining - dt);
    const aimLength = Math.hypot(input.aimX ?? 0, input.aimY ?? 0);
    if (aimLength > 0.001) {
      this.player.facingX = (input.aimX ?? 0) / aimLength;
      this.player.facingY = (input.aimY ?? 0) / aimLength;
    }
    const length = Math.hypot(input.x, input.y);
    if (length > 0) {
      const magnitude = Math.min(1, length);
      const dx = input.x / length; const dy = input.y / length;
      const speed = this.player.moveSpeed * (this.player.speedBoostRemaining > 0 ? 1.55 : 1);
      this.player.x = clamp(this.player.x + dx * speed * magnitude * dt, 25, WORLD_WIDTH - 25);
      this.player.y = clamp(this.player.y + dy * speed * magnitude * dt, 25, WORLD_HEIGHT - 25);
    }
    this.heal(this.player.regen * dt, false);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.waveTime > 0) {
      this.spawnTimer = this.stage.spawnInterval;
      if (this.enemies.filter(e => e.active).length < 55) this.spawnEnemy(this.rollEnemy());
    }
    if (this.bossWarning > 0) {
      this.bossWarning -= dt;
      if (this.bossWarning <= 0) this.spawnEnemy('boss');
    }
    this.updateMeleeQueue(dt);
    this.updateSkillQueue(dt);
    this.updateDash(dt);
    this.updateOrbitApples(dt);
    if (this.phase !== 'running') return;
    this.updateAttack(dt, input.fire === true, input.autoAim === true);
    if (this.phase !== 'running') return;
    this.updateFollowers(dt);
    this.updateEnemies(dt);
    this.updateHazards(dt);
    if (this.phase !== 'running') { this.compact(); return; }
    this.updateProjectiles(dt);
    if (this.phase !== 'running') { this.compact(); return; }
    this.updatePickups(dt);
    for (const prop of this.props) prop.flash = Math.max(0, prop.flash - dt);
    this.compact();
    if (this.phase === 'running' && this.waveTime <= 0 && !this.stage.boss) this.finishWave();
  }

  activateSkill(): boolean {
    if (!this.canAct() || this.player.skillCooldown > 0) return false;
    this.player.skillCooldown = this.player.skillMaxCooldown;
    const upgraded = this.wave >= 5;
    const mods = this.attackMods;
    const cast: SkillCast = { delay: 0, kind: this.ability.kind, mods, aim: { x: this.player.facingX, y: this.player.facingY }, upgraded, scale: 1 };
    if (cast.kind !== 'heart') for (let index = 1; index < mods.shotCount; index++) this.skillQueue.push({ ...cast, delay: index * 0.15, scale: 0.45 });
    this.castSkill(cast);
    this.emit('skill', this.player, undefined, this.ability.kind, this.ability.name);
    return true;
  }

  switchForm(): boolean {
    const forms = characters[this.characterId].forms;
    if (!this.canAct() || forms.length < 2 || this.switchCooldown > 0) return false;
    this.form = forms[(forms.indexOf(this.form) + 1) % forms.length];
    this.meleeQueue = [];
    this.switchCooldown = 4;
    this.player.speedBoostRemaining = Math.max(this.player.speedBoostRemaining, 0.9);
    this.player.invulnerable = Math.max(this.player.invulnerable, 0.45);
    this.emit('switch', this.player, undefined, this.form);
    return true;
  }

  useItem(slot: number): boolean {
    if (!this.canAct() || !Number.isInteger(slot)) return false;
    const id = this.inventory[slot];
    if (!id) return false;
    const action = items[id]?.action;
    if (!action) return false;
    // 先消费实例，后执行效果；持续状态不依赖已移除的道具。
    this.inventory[slot] = null;
    const actions: Record<ItemAction['kind'], () => void> = {
      heal: () => this.heal(action.amount),
      burst: () => this.explode(this.player.x, this.player.y, action.radius ?? 180, action.amount + this.player.damage * (action.damageScale ?? 0), false),
      invulnerable: () => { this.player.invulnerable = Math.max(this.player.invulnerable, action.amount); }
    };
    actions[action.kind]();
    this.emit('skill', this.player, undefined, id, items[id].name);
    return true;
  }

  buy(id: string): boolean {
    if (this.phase !== 'shop' || this.paused) return false;
    const offer = this.shop.find(candidate => candidate.id === id);
    if (!offer || offer.sold || this.player.coins < offer.price) return false;
    if (offer.kind === 'weapon') {
      if (this.weaponLevel >= 5) return false;
      this.weaponLevel++;
    } else {
      if (!offer.itemId || !this.acquireItem(offer.itemId)) return false;
    }
    this.player.coins -= offer.price;
    offer.sold = true;
    this.recomputeStats();
    this.emit('buy', this.player, offer.price, offer.itemId ?? 'weapon');
    return true;
  }

  reroll(): boolean {
    if (this.phase !== 'shop' || this.paused || this.player.coins < this.rerollCost) return false;
    this.player.coins -= this.rerollCost;
    this.rerolls++;
    this.rollShop();
    this.recomputeStats();
    this.emit('buy', this.player, undefined, 'reroll');
    return true;
  }

  nextWave(): boolean {
    if (this.phase !== 'shop' || this.paused || this.wave >= stages.length) return false;
    this.wave++;
    this.phase = 'running';
    this.startWave();
    return true;
  }

  private canAct(): boolean { return this.phase === 'running' && !this.paused && this.player.hp > 0; }
  private random(): number { this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0; return this.seed / 4294967296; }
  private emit(type: GameEffect['type'], point: Point, value?: number, kind?: string, text?: string, radius?: number, aim?: Point, comboIndex?: number): void {
    if (this.effects.length < 220) this.effects.push({ type, x: point.x, y: point.y, value, kind, text, radius, aimX: aim?.x, aimY: aim?.y, angle: aim ? Math.atan2(aim.y, aim.x) : undefined, comboIndex });
  }

  private recomputeStats(): void {
    const p = this.player; const base = characters[this.characterId].base;
    const combined = { ...this.talentStats };
    this.equipmentEffects = { ...this.talentEffects };
    for (const [id, count] of Object.entries(this.equipment)) {
      const def = items[id];
      if (!def) continue;
      applyStats(combined, def.statBonuses ?? {}, count);
      for (const [key, amount] of Object.entries(def.effectBonuses ?? {})) this.equipmentEffects[key as EquipmentEffect] += amount * count;
    }
    const training = this.characterId === 'classrep' ? this.trainedWaves * 0.03 : 0;
    const savings = this.characterId === 'goodrabbit' ? Math.min(0.3, p.coins * 0.002) : 0;
    p.maxHp = Math.min(500, base.hp + combined.maxHp + (this.characterId === 'classrep' ? this.trainedWaves : 0));
    p.damage = base.damage * (1 + 0.2 * (this.weaponLevel - 1)) * (1 + Math.min(4, combined.damage) + training + savings);
    p.attackSpeed = Math.min(2.2, base.attackSpeed * (1 + combined.attackSpeed));
    p.armor = Math.min(24, base.armor + combined.armor);
    p.regen = Math.min(2, base.regen + combined.regen);
    p.crit = Math.min(0.45, 0.05 + combined.crit);
    p.moveSpeed = Math.min(345, base.moveSpeed * (1 + combined.moveSpeed));
    p.hp = Math.min(p.hp, p.maxHp);
    p.maxShield = this.characterId === 'bingo' ? p.maxHp * 0.22 : 0;
    p.shield = Math.min(p.shield, p.maxShield);
    p.skillMaxCooldown = this.ability.cooldown * (this.wave >= 5 ? 0.82 : 1);
  }

  private startWave(): void {
    this.waveTime = this.stage.duration;
    this.enemies.length = 0; this.projectiles.length = 0; this.props.length = 0; this.pickups.length = 0;
    this.spawnTimer = 0.8; this.attackTimer = 0; this.reloadTimer = 0; this.ammo = 0;
    this.meleeQueue = [];
    this.skillQueue = []; this.hazards.length = 0; this.orbitApples.length = 0; this.waveSettled = false; this.bossWarning = 0;
    this.player.dashRemaining = 0; this.dashMods = null; this.dashHits.clear(); this.dashCooldowns.clear();
    this.recomputeStats();
    // 波初快照只补偿部分成长；同一波内购物、拾币和受伤都不追涨敌人。
    const base = characters[this.characterId].base;
    const offense = Math.max(0, this.player.damage / base.damage - 1)
      + Math.max(0, this.player.attackSpeed / base.attackSpeed - 1) * 0.35
      + (this.shotCount - 1) * 0.3 + this.pierceCount * 0.12;
    const defense = Math.max(0, this.player.maxHp / base.hp - 1) * 0.4 + Math.max(0, this.player.armor - base.armor) * 0.04;
    const growthHp = 1 + Math.min(0.2, offense * 0.06 + defense * 0.02);
    const growthDamage = 1 + Math.min(0.08, defense * 0.04);
    this.difficulty = { hp: growthHp * (1 + this.profile.threatLevel * 0.25), damage: growthDamage * (1 + this.profile.threatLevel * 0.08), growthHp, growthDamage, mechanicTier: Math.min(2, this.profile.threatLevel + Math.floor(offense / 1.2)) };
    this.player.shield = this.player.maxShield;
    for (const [index, follower] of this.followers.entries()) { follower.x = clamp(this.player.x - 40 + index * 12, 25, WORLD_WIDTH - 25); follower.y = clamp(this.player.y + 55, 25, WORLD_HEIGHT - 25); }
    for (let i = 0; i < 3 + Math.floor(this.wave / 3); i++) {
      const angle = this.random() * Math.PI * 2; const radius = 170 + this.random() * 470;
      const x = clamp(this.player.x + Math.cos(angle) * radius, 70, WORLD_WIDTH - 70);
      const y = clamp(this.player.y + Math.sin(angle) * radius, 70, WORLD_HEIGHT - 70);
      this.props.push({ id: this.nextId++, kind: i === 0 ? 'barrel' : 'tree', x, y, hp: i === 0 ? 24 : 30, maxHp: i === 0 ? 24 : 30, radius: i === 0 ? 19 : 24, flash: 0 });
    }
    // 地面花朵是真实拾取物，每朵一币；波末与掉落饼干一起结算。
    for (let i = 0; i < 5; i++) {
      const angle = this.random() * Math.PI * 2; const radius = 80 + this.random() * 280;
      this.drop('flower', { x: clamp(this.player.x + Math.cos(angle) * radius, 35, WORLD_WIDTH - 35), y: clamp(this.player.y + Math.sin(angle) * radius, 35, WORLD_HEIGHT - 35) }, 1);
    }
    if (this.wave === 3 || this.wave === 6) {
      this.pickups.push({ id: this.nextId++, kind: 'item', itemId: this.wave === 3 ? 'apple' : 'bomb', value: 1, age: 0, x: this.player.x + 95, y: this.player.y + 65 });
    }
    if (this.stage.boss) {
      this.bossWarning = 1.8;
      this.emit('warning', { x: this.player.x, y: clamp(this.player.y - this.viewHeight * 0.35, 70, WORLD_HEIGHT - 70) }, undefined, 'boss', '坏老板将在此出现');
    }
    this.emit('wave', this.player, this.wave, undefined, this.stage.name);
  }

  private rollEnemy(): string {
    const entries = Object.entries(this.stage.weights);
    let roll = this.random() * entries.reduce((sum, [, weight]) => sum + (weight ?? 0), 0);
    for (const [kind, weight] of entries) { roll -= weight ?? 0; if (roll <= 0) return kind; }
    return entries[0][0];
  }
  private spawnEnemy(kind: string): void {
    const def = enemyDefs[kind];
    if (!def) return;
    const cx = clamp(this.player.x, this.viewWidth / 2, WORLD_WIDTH - this.viewWidth / 2);
    const cy = clamp(this.player.y, this.viewHeight / 2, WORLD_HEIGHT - this.viewHeight / 2);
    const side = Math.floor(this.random() * 4);
    let x = cx + (this.random() - 0.5) * this.viewWidth;
    let y = cy + (this.random() - 0.5) * this.viewHeight;
    if (side < 2) x = cx + (side === 0 ? -1 : 1) * (this.viewWidth / 2 + 45);
    else y = cy + (side === 2 ? -1 : 1) * (this.viewHeight / 2 + 45);
    x = clamp(x, 30, WORLD_WIDTH - 30); y = clamp(y, 30, WORLD_HEIGHT - 30);
    if (kind === 'boss') { x = this.player.x; y = clamp(this.player.y - this.viewHeight * 0.35, 70, WORLD_HEIGHT - 70); }
    const hp = def.hp * (kind === 'boss' ? this.difficulty.hp : this.stage.hpScale);
    this.enemies.push({ id: this.nextId++, kind, x, y, hp, maxHp: hp, radius: def.radius, speed: def.speed, damage: def.damage * this.difficulty.damage, age: 0, cooldown: kind === 'boss' ? 1.5 : 1 + this.random(), windup: 0, dashTime: 0, vx: 0, vy: 0, active: true, flash: 0, attackIndex: 0 });
    if (kind === 'boss') this.emit('boss', { x, y }, undefined, kind, '坏老板');
    else if (def.behavior !== 'chase') this.emit('warning', { x, y }, undefined, kind);
  }

  private nearestEnemy(range: number): EnemyState | undefined {
    let target: EnemyState | undefined; let best = range;
    for (const enemy of this.enemies) if (enemy.active) { const d = distance(enemy, this.player); if (d < best) { best = d; target = enemy; } }
    return target;
  }
  private updateAttack(dt: number, fire: boolean, autoAim: boolean): void {
    this.attackTimer -= dt;
    const meleeRange = 100 + this.pierceCount * 8;
    if (autoAim) {
      const range = this.melee ? meleeRange : this.player.range;
      let target: Point | undefined = this.nearestEnemy(range);
      if (this.melee) {
        const bullet = this.projectiles.filter(shot => shot.enemy && shot.life > 0 && distance(shot, this.player) < range).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
        if (bullet && (!target || distance(bullet, this.player) < distance(target, this.player))) target = bullet;
      }
      if (!target) target = this.props.filter(prop => distance(prop, this.player) < range).sort((a, b) => distance(a, this.player) - distance(b, this.player))[0];
      fire = target !== undefined;
      if (target) {
        const dx = target.x - this.player.x; const dy = target.y - this.player.y;
        const length = Math.hypot(dx, dy);
        if (length > 0.001) { this.player.facingX = dx / length; this.player.facingY = dy / length; }
      }
    }
    if (this.reloadTimer > 0) { this.reloadTimer = Math.max(0, this.reloadTimer - dt); if (this.reloadTimer === 0) { this.ammo = 0; this.attackTimer = 0; } return; }
    if (!fire || this.attackTimer > 0) return;
    const angle = Math.atan2(this.player.facingY, this.player.facingX);
    this.attackTimer = this.attackInterval;
    if (this.melee) {
      const first: MeleeSwing = { delay: 0, mods: this.attackMods, damageScale: 1.4, aim: { x: this.player.facingX, y: this.player.facingY }, form: this.form, radius: meleeRange, maxTargets: 1 + this.pierceCount, comboIndex: 0 };
      for (let index = 1; index < this.shotCount; index++) this.meleeQueue.push({ ...first, delay: index * 0.09, damageScale: first.damageScale * 0.65, comboIndex: index });
      this.performMeleeSwing(first);
    } else {
      const mods = this.attackMods; const damage = this.rollDamage(mods);
      for (let i = 0; i < mods.shotCount; i++) this.fire(angle + (i - (mods.shotCount - 1) / 2) * 0.1, damage, 530, mods.pierce, this.form === 'heart' ? 'heart' : 'apple', false, this.player, mods);
      this.ammo += this.shotCount;
      if (this.ammo >= 15) { this.reloadTimer = 1; this.emit('reload', this.player); }
    }
  }

  private updateMeleeQueue(dt: number): void {
    for (const swing of this.meleeQueue) swing.delay -= dt;
    const ready = this.meleeQueue.filter(swing => swing.delay <= 0);
    this.meleeQueue = this.meleeQueue.filter(swing => swing.delay > 0);
    for (const swing of ready) {
      if (this.phase !== 'running') break;
      this.performMeleeSwing(swing);
    }
  }

  private performMeleeSwing(swing: MeleeSwing): void {
    const damage = this.rollDamage(swing.mods, swing.damageScale);
    const targets = [...this.enemies.filter(enemy => enemy.active), ...this.props, ...this.projectiles.filter(shot => shot.enemy && shot.life > 0)]
      .filter(target => this.inMeleeCone(target, swing.radius + target.radius, swing.aim))
      .sort((a, b) => distance(a, this.player) - distance(b, this.player))
      .slice(0, swing.maxTargets);
    // 挥击与命中分离，空挥也有独立动画事件；后续段不重置本轮普攻冷却。
    this.emit('melee', this.player, swing.radius, swing.form, undefined, swing.radius, swing.aim, swing.comboIndex);
    for (const target of targets) {
      if (this.result) break;
      if ('active' in target) this.damageEnemy(target, damage, true, swing.mods);
      else if ('enemy' in target) { target.life = 0; this.emit('shield', target, undefined, 'block'); }
      else this.damageProp(target, damage);
    }
  }

  private inMeleeCone(point: Point, range: number, aim: Point): boolean {
    const dx = point.x - this.player.x; const dy = point.y - this.player.y;
    const dist = Math.hypot(dx, dy);
    // 120°前向扇区；完全重叠的目标仍可以被近战命中。
    return dist < range && (dist < 0.001 || (dx * aim.x + dy * aim.y) / dist >= 0.5);
  }

  private updateFollowers(dt: number): void {
    for (const [index, follower] of this.followers.entries()) {
      if (follower.hp <= 0) continue;
      follower.shootCooldown = Math.max(0, follower.shootCooldown - dt); follower.hurtCooldown = Math.max(0, follower.hurtCooldown - dt);
      const angle = index * Math.PI * 2 / Math.max(1, this.followers.length);
      const anchor = { x: this.player.x + Math.cos(angle) * 65, y: this.player.y + Math.sin(angle) * 65 };
      const d = distance(follower, anchor);
      if (d > 5) { const shift = Math.min(d, this.player.moveSpeed * 1.1 * dt); follower.x += (anchor.x - follower.x) / d * shift; follower.y += (anchor.y - follower.y) / d * shift; }
      follower.x = clamp(follower.x, 20, WORLD_WIDTH - 20); follower.y = clamp(follower.y, 20, WORLD_HEIGHT - 20);
      let target: EnemyState | undefined; let best = 420;
      for (const enemy of this.enemies) if (enemy.active && distance(follower, enemy) < best) { best = distance(follower, enemy); target = enemy; }
      if (!target || follower.shootCooldown > 0) continue;
      follower.shootCooldown = 1.5 + (index % 3) * 0.08;
      const aim = Math.atan2(target.y - follower.y, target.x - follower.x);
      follower.facingX = Math.cos(aim); follower.facingY = Math.sin(aim);
      const mods = { ...this.attackMods, damage: this.player.damage * 0.2 };
      this.fire(aim, this.rollDamage(mods), 460, mods.pierce, 'apple', false, follower, mods);
    }
  }

  private fire(angle: number, damage: number, speed: number, pierce: number, kind: ProjectileState['kind'], enemy = false, origin: Point = this.player, mods?: AttackMods): void {
    if (this.projectiles.length >= 320) return;
    this.projectiles.push({ id: this.nextId++, x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, radius: enemy ? 7 : 6, life: enemy ? 4 : 1.3, enemy, pierce, hitIds: new Set(), kind, mods: enemy ? undefined : mods ?? this.attackMods });
    this.emit('shoot', origin, undefined, enemy ? 'enemy' : kind, undefined, undefined, { x: Math.cos(angle), y: Math.sin(angle) });
  }
  private radial(count: number, scale: number, speed: number, kind: ProjectileState['kind'], mods: AttackMods): void {
    for (let i = 0; i < count; i++) this.fire(i * Math.PI * 2 / count, this.rollDamage(mods, scale), speed, mods.pierce, kind, false, this.player, mods);
  }

  private rollDamage(mods: AttackMods, scale = 1): number { return mods.damage * scale * (this.random() < mods.critChance ? 2 : 1); }
  private updateSkillQueue(dt: number): void {
    for (const cast of this.skillQueue) cast.delay -= dt;
    const ready = this.skillQueue.filter(cast => cast.delay <= 0);
    this.skillQueue = this.skillQueue.filter(cast => cast.delay > 0);
    for (const cast of ready) { if (this.phase !== 'running') break; this.castSkill(cast); }
  }
  private castSkill(cast: SkillCast): void {
    const { mods, scale, upgraded } = cast;
    const actions: Record<string, () => void> = {
      ring: () => { for (const speed of [300, 430]) this.radial(32, (upgraded ? 1.05 : 0.85) * scale, speed, 'apple', mods); },
      rain: () => { const angle = Math.atan2(cast.aim.y, cast.aim.x); for (let i = -2; i <= 2; i++) this.fire(angle + i * 0.09, this.rollDamage(mods, (upgraded ? 2.1 : 1.7) * scale), 650, mods.pierce, 'cookie', false, this.player, mods); },
      slam: () => {
        const radius = (upgraded ? 185 : 155) + mods.pierce * 8;
        for (const enemy of [...this.enemies]) if (enemy.active && distance(enemy, this.player) < radius + enemy.radius) this.damageEnemy(enemy, this.rollDamage(mods, (upgraded ? 3.5 : 2.8) * scale), true, mods);
        this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.maxHp * 0.12 * scale);
        this.emit('explosion', this.player, undefined, 'skill', undefined, radius);
      },
      heart: () => {
        this.player.dashRemaining = 2.2;
        this.player.speedBoostRemaining = Math.max(this.player.speedBoostRemaining, 2.2);
        this.player.invulnerable = Math.max(this.player.invulnerable, 2.2);
        this.dashMods = mods; this.dashHits.clear(); this.dashCooldowns.clear();
        this.dashHitBudget = (1 + mods.pierce) * mods.shotCount;
      },
      signal: () => {
        for (let i = 0; i < 6 && this.orbitApples.length < 18; i++) {
          const angle = i * Math.PI * 2 / 6 + (scale < 1 ? 0.28 : 0);
          this.orbitApples.push({ id: this.nextId++, x: this.player.x, y: this.player.y, angle, orbitRadius: upgraded ? 90 : 78, radius: 9, life: 5.5, remainingHits: 1 + mods.pierce, hitIds: new Set(), mods: { ...mods, damage: mods.damage * 1.25 * scale } });
        }
      }
    };
    actions[cast.kind]();
  }
  private updateDash(dt: number): void {
    for (const [id, timer] of this.dashCooldowns) this.dashCooldowns.set(id, Math.max(0, timer - dt));
    if (this.player.dashRemaining <= 0 || !this.dashMods || this.dashHitBudget <= 0) return;
    const mods = this.dashMods;
    for (const enemy of this.enemies) {
      const count = this.dashHits.get(enemy.id) ?? 0;
      if (!enemy.active || distance(enemy, this.player) > enemy.radius + 24 || count >= mods.shotCount || (this.dashCooldowns.get(enemy.id) ?? 0) > 0 || this.dashHitBudget <= 0) continue;
      this.dashHits.set(enemy.id, count + 1); this.dashCooldowns.set(enemy.id, 0.28); this.dashHitBudget--;
      this.damageEnemy(enemy, this.rollDamage(mods, count === 0 ? 2.2 : 1.2), true, mods);
    }
  }
  private updateOrbitApples(dt: number): void {
    for (const apple of this.orbitApples) {
      apple.life -= dt; apple.angle += dt * 3.8;
      if (apple.life <= 0 || apple.remainingHits <= 0) continue;
      apple.x = this.player.x + Math.cos(apple.angle) * apple.orbitRadius;
      apple.y = this.player.y + Math.sin(apple.angle) * apple.orbitRadius;
      for (const enemy of this.enemies) {
        if (!enemy.active || apple.remainingHits <= 0 || apple.hitIds.has(enemy.id) || distance(apple, enemy) > enemy.radius + apple.radius) continue;
        apple.hitIds.add(enemy.id); apple.remainingHits--;
        this.damageEnemy(enemy, this.rollDamage(apple.mods), true, apple.mods);
      }
    }
  }

  private nearestAlly(point: Point): PlayerState | FollowerState {
    let target: PlayerState | FollowerState = this.player; let best = distance(point, this.player);
    for (const follower of this.followers) if (follower.hp > 0 && distance(point, follower) < best) { best = distance(point, follower); target = follower; }
    return target;
  }
  private hurtFollower(follower: FollowerState, damage: number): void {
    if (this.result || follower.hp <= 0 || follower.hurtCooldown > 0) return;
    follower.hp = Math.max(0, follower.hp - damage); follower.hurtCooldown = 0.5;
    this.emit('hurt', follower, damage, 'follower');
    if (follower.hp <= 0) this.emit('kill', follower, undefined, 'follower');
  }
  private addHazard(enemy: EnemyState, kind: HazardState['kind'], target: Point, offset = 0): void {
    if (this.hazards.length >= 18) return;
    const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x) + offset;
    const point = kind === 'laser' ? enemy : target;
    // 射线终点可在地图外，由视口裁剪；分别钳制两轴会改变瞄准方向。
    this.hazards.push({ id: this.nextId++, kind, x: point.x, y: point.y, endX: enemy.x + Math.cos(angle) * 1050, endY: enemy.y + Math.sin(angle) * 1050, radius: 68 + this.difficulty.mechanicTier * 6, width: 18, warningRemaining: kind === 'laser' ? 0.9 : 1.05, activeRemaining: kind === 'laser' ? 0.24 : 0.7, damage: enemy.damage * (kind === 'laser' ? 0.8 : 0.7), ownerId: enemy.id, hitIds: new Set() });
    this.emit('warning', point, undefined, kind);
  }
  private updateHazards(dt: number): void {
    for (const hazard of this.hazards) {
      if (hazard.warningRemaining > 0) { hazard.warningRemaining = Math.max(0, hazard.warningRemaining - dt); if (hazard.warningRemaining > 0) continue; }
      else hazard.activeRemaining -= dt;
      if (hazard.activeRemaining <= 0) continue;
      const hits = (point: Point): boolean => {
        if (hazard.kind === 'area') return distance(point, hazard) < hazard.radius + 15;
        const dx = hazard.endX - hazard.x; const dy = hazard.endY - hazard.y;
        const t = clamp(((point.x - hazard.x) * dx + (point.y - hazard.y) * dy) / Math.max(1, dx * dx + dy * dy), 0, 1);
        return distance(point, { x: hazard.x + t * dx, y: hazard.y + t * dy }) < hazard.width / 2 + 15;
      };
      if (!hazard.hitIds.has(0) && hits(this.player)) { hazard.hitIds.add(0); this.hurt(hazard.damage); }
      for (const follower of this.followers) if (follower.hp > 0 && !hazard.hitIds.has(follower.id) && hits(follower)) { hazard.hitIds.add(follower.id); this.hurtFollower(follower, hazard.damage); }
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const def = enemyDefs[enemy.kind];
      enemy.age += dt; enemy.cooldown -= dt; enemy.flash = Math.max(0, enemy.flash - dt);
      const target = this.nearestAlly(enemy);
      const dx = target.x - enemy.x; const dy = target.y - enemy.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      let moving = true;
      if (def.behavior === 'ranged' || def.behavior === 'boss') {
        if (dist < (def.behavior === 'boss' ? 270 : 285)) moving = false;
        if (enemy.cooldown <= 0 && dist < 720) {
          const angle = Math.atan2(dy, dx);
          const tier = this.difficulty.mechanicTier;
          const count = def.behavior === 'boss' ? 5 + tier : 1;
          for (let i = 0; i < count; i++) this.fire(angle + (i - (count - 1) / 2) * 0.22, def.behavior === 'boss' ? enemy.damage * 0.6 : enemy.damage * 0.8, 210 + tier * 12, 0, 'note', true, enemy);
          if (def.behavior === 'boss') {
            enemy.attackIndex++;
            if (enemy.attackIndex % 2 === 0) {
              this.addHazard(enemy, 'laser', target);
              if (tier >= 2) this.addHazard(enemy, 'laser', target, 0.32);
            }
            if (enemy.attackIndex % (tier > 0 ? 2 : 4) === 0) {
              this.addHazard(enemy, 'area', target);
              if (tier >= 3) this.addHazard(enemy, 'area', { x: clamp(target.x + 110, 30, WORLD_WIDTH - 30), y: target.y });
            }
          }
          enemy.cooldown = def.behavior === 'boss' ? 2.4 : 2.7;
        }
      }
      if (def.behavior === 'laser' || def.behavior === 'area') {
        if (dist < 320) moving = false;
        if (enemy.cooldown <= 0 && dist < 650) { this.addHazard(enemy, def.behavior, target); enemy.cooldown = def.behavior === 'laser' ? 3.7 : 4.2; }
      }
      if (def.behavior === 'charge') {
        if (enemy.dashTime > 0) { enemy.dashTime -= dt; enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt; moving = false; }
        else if (enemy.windup > 0) { enemy.windup -= dt; moving = false; if (enemy.windup <= 0) { enemy.dashTime = 0.38; enemy.vx = dx / dist * 400; enemy.vy = dy / dist * 400; enemy.cooldown = 3; } }
        else if (dist < 300 && enemy.cooldown <= 0) { enemy.windup = 0.6; moving = false; this.emit('warning', enemy, undefined, 'charge'); }
      }
      if (def.behavior === 'explode') {
        if (enemy.windup > 0) { enemy.windup -= dt; moving = false; if (enemy.windup <= 0) { if (distance(enemy, this.player) < 100) this.hurt(enemy.damage); for (const follower of this.followers) if (distance(enemy, follower) < 100) this.hurtFollower(follower, enemy.damage); enemy.active = false; this.emit('explosion', enemy, undefined, 'enemy', undefined, 95); } }
        else if (dist < 95) { enemy.windup = 0.8; moving = false; this.emit('warning', enemy, undefined, 'explode'); }
      }
      if (moving) { enemy.x += dx / dist * enemy.speed * dt; enemy.y += dy / dist * enemy.speed * dt; }
      enemy.x = clamp(enemy.x, 18, WORLD_WIDTH - 18); enemy.y = clamp(enemy.y, 18, WORLD_HEIGHT - 18);
      if (enemy.active && distance(enemy, this.player) < enemy.radius + 17) this.hurt(enemy.damage);
      if (enemy.active) for (const follower of this.followers) if (follower.hp > 0 && distance(enemy, follower) < enemy.radius + 14) this.hurtFollower(follower, enemy.damage);
    }
  }

  private updateProjectiles(dt: number): void {
    for (const shot of this.projectiles) {
      if (shot.life <= 0) continue;
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (shot.enemy) {
        const targets = [this.player, ...this.followers.filter(follower => follower.hp > 0)].filter(target => distance(shot, target) < shot.radius + 17).sort((a, b) => distance(shot, a) - distance(shot, b));
        const target = targets[0];
        if (target) { if ('id' in target) this.hurtFollower(target, shot.damage); else this.hurt(shot.damage); shot.life = 0; }
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.active || shot.hitIds.has(enemy.id) || distance(shot, enemy) > shot.radius + enemy.radius) continue;
        shot.hitIds.add(enemy.id); this.damageEnemy(enemy, shot.damage, true, shot.mods);
        if (shot.pierce-- <= 0) { shot.life = 0; break; }
      }
      if (shot.life <= 0) continue;
      for (const prop of [...this.props]) {
        if (shot.hitIds.has(prop.id) || distance(shot, prop) > shot.radius + prop.radius) continue;
        shot.hitIds.add(prop.id); this.damageProp(prop, shot.damage);
        if (shot.pierce-- <= 0) { shot.life = 0; break; }
      }
    }
  }

  private damageEnemy(enemy: EnemyState, amount: number, allowProcs = true, mods: AttackMods = this.attackMods): void {
    if (!enemy.active || this.result || this.waveSettled) return;
    enemy.hp -= amount; enemy.flash = 0.09;
    this.emit('hit', enemy, amount, enemy.kind);
    if (enemy.hp > 0) return;
    enemy.active = false; this.kills++;
    this.emit('kill', enemy, undefined, enemy.kind);
    const def = enemyDefs[enemy.kind];
    this.heal(mods.lifesteal, false);
    // Boss 奖励直接入账，不再同时生成可重复拾取的同额货币。
    if (def.behavior === 'boss') {
      this.grantCoins(def.coins); this.bossesDefeated++; this.profile.bossWins++;
      const slots = 1 + Math.min(2, this.profile.bossWins);
      while (this.inventory.length < slots) this.inventory.push(null);
      this.emit('boss', enemy, this.bossesDefeated, 'defeated', '坏老板已击败，果园守住了');
      this.finish('victory'); return;
    }
    this.drop('coin', enemy, def.coins);
    if (this.random() < 0.07) this.drop('apple', enemy, 8);
    if (allowProcs && this.random() < mods.explosionChance) this.explode(enemy.x, enemy.y, 90, mods.damage * 1.5, false, mods);
  }

  private damageProp(prop: PropState, amount: number): void {
    if (prop.hp <= 0 || this.result || this.waveSettled) return;
    prop.hp -= amount; prop.flash = 0.1; this.emit('hit', prop, amount, prop.kind);
    if (prop.hp > 0) return;
    this.props.splice(this.props.indexOf(prop), 1);
    if (prop.kind === 'barrel') {
      this.explode(prop.x, prop.y, 125, 42, false);
      if (distance(prop, this.player) < 140) this.hurt(17);
    } else {
      this.drop('coin', prop, 5); this.drop('apple', { x: prop.x - 12, y: prop.y }, 10);
      if (this.random() < 0.5) this.drop('apple', { x: prop.x + 15, y: prop.y + 10 }, 10);
      this.emit('kill', prop, undefined, 'tree');
    }
  }
  private explode(x: number, y: number, radius: number, damage: number, allowProcs: boolean, mods: AttackMods = this.attackMods): void {
    this.emit('explosion', { x, y }, damage, 'player', undefined, radius);
    for (const enemy of [...this.enemies]) if (enemy.active && distance(enemy, { x, y }) < radius + enemy.radius) this.damageEnemy(enemy, damage, allowProcs, mods);
    for (const prop of [...this.props]) if (prop.hp > 0 && distance(prop, { x, y }) < radius + prop.radius) this.damageProp(prop, damage);
  }
  private hurt(raw: number): void {
    if (this.hurtCooldown > 0 || this.player.invulnerable > 0 || this.player.hp <= 0 || this.result) return;
    const amount = raw * 15 / (15 + this.player.armor);
    const absorbed = Math.min(this.player.shield, amount);
    this.player.shield -= absorbed; this.player.hp = Math.max(0, this.player.hp - (amount - absorbed));
    this.hurtCooldown = 0.5; this.emit(absorbed === amount ? 'shield' : 'hurt', this.player, amount - absorbed);
    if (this.player.hp <= 0) this.finish('defeat');
  }
  private heal(amount: number, feedback = true): void {
    if (amount <= 0 || this.player.hp <= 0) return;
    const actual = Math.min(amount, this.player.maxHp - this.player.hp);
    this.player.hp += actual;
    if (this.characterId === 'bingo' && actual > 0) this.player.shield = Math.min(this.player.maxShield, this.player.shield + actual * 0.3);
    if (feedback && actual > 0) this.emit('heal', this.player, actual);
  }
  private drop(kind: PickupState['kind'], point: Point, value: number): void {
    if (this.pickups.length >= 120) return;
    // 仅替换部分货币掉落的外观，保留其原有面值和总收益。
    if (kind === 'coin' && this.random() < 0.22) kind = 'flower';
    this.pickups.push({ id: this.nextId++, kind, x: point.x, y: point.y, value, age: 0 });
  }
  private updatePickups(dt: number): void {
    for (const pickup of this.pickups) {
      pickup.age += dt;
      const d = distance(pickup, this.player);
      if (d < this.pickupRange && pickup.kind !== 'item' && d > 0.01) { const shift = Math.min(d, (160 + d * 2) * dt); pickup.x += (this.player.x - pickup.x) / d * shift; pickup.y += (this.player.y - pickup.y) / d * shift; }
      if (distance(pickup, this.player) > 23) continue;
      if (pickup.kind === 'item') { if (!pickup.itemId || !this.acquireItem(pickup.itemId)) continue; }
      else if (pickup.kind === 'coin' || pickup.kind === 'flower') this.grantCoins(pickup.value, true);
      else this.heal(pickup.value);
      pickup.age = 999; this.emit('pickup', pickup, pickup.value, pickup.kind);
    }
  }
  private grantCoins(amount: number, dropped = false): void {
    const scaled = amount * (dropped && this.characterId === 'goodrabbit' ? 1.5 : 1) + this.incomeRemainder;
    const gain = Math.floor(scaled); this.incomeRemainder = scaled - gain;
    this.player.coins += gain; this.coinsEarned += gain; this.recomputeStats();
  }
  private statRoom(stat: StatKey): number {
    const base = characters[this.characterId].base;
    const combined = { ...this.talentStats };
    for (const [id, count] of Object.entries(this.equipment)) applyStats(combined, items[id]?.statBonuses ?? {}, count);
    const limits: Record<StatKey, number> = {
      damage: 4,
      attackSpeed: 2.2 / base.attackSpeed - 1,
      maxHp: 500 - base.hp - (this.characterId === 'classrep' ? this.trainedWaves : 0),
      armor: 24 - base.armor,
      regen: 2 - base.regen,
      crit: 0.4,
      moveSpeed: 345 / base.moveSpeed - 1
    };
    return Math.max(0, limits[stat] - combined[stat]);
  }
  canAcquireItem(id: ItemId): boolean {
    const def = items[id];
    if (!def || (def.maxPerRun !== undefined && (this.acquired[id] ?? 0) >= def.maxPerRun)) return false;
    if (def.kind === 'consumable') return this.inventory.includes(null);
    if ((this.equipment[id] ?? 0) >= def.maxStacks) return false;
    const caps: Record<EquipmentEffect, number> = { multishot: 2, pierce: 2, explosion: 0.3, lifesteal: 1.5, pickupRange: Infinity };
    return Object.entries(def.statBonuses ?? {}).some(([key, amount]) => amount > 0 && this.statRoom(key as StatKey) > 1e-8)
      || Object.entries(def.effectBonuses ?? {}).some(([key, amount]) => amount > 0 && this.equipmentEffects[key as EquipmentEffect] < caps[key as EquipmentEffect] - 1e-8);
  }
  private acquireItem(id: ItemId): boolean {
    const def = items[id]; if (!def || !this.canAcquireItem(id)) return false;
    if (def.kind === 'consumable') {
      const slot = this.inventory.indexOf(null);
      if (slot < 0 || (def.maxPerRun !== undefined && (this.acquired[id] ?? 0) >= def.maxPerRun)) return false;
      this.inventory[slot] = id;
    } else {
      if ((this.equipment[id] ?? 0) >= def.maxStacks) return false;
      const oldMaxHp = this.player.maxHp;
      this.equipment[id] = (this.equipment[id] ?? 0) + 1;
      this.recomputeStats();
      if (this.player.maxHp > oldMaxHp) this.heal(this.player.maxHp - oldMaxHp);
    }
    this.acquired[id] = (this.acquired[id] ?? 0) + 1;
    return true;
  }
  private rollShop(): void {
    const pool: ShopOffer[] = Object.values(items)
      .filter(def => (def.maxPerRun === undefined || (this.acquired[def.id] ?? 0) < def.maxPerRun) && (def.action?.kind !== 'invulnerable' || this.wave >= 4))
      .filter(def => def.kind === 'consumable' || (this.equipment[def.id] ?? 0) < def.maxStacks)
      .filter(def => def.kind === 'consumable' || this.canAcquireItem(def.id))
      .map(def => ({ id: `offer:${this.nextId++}`, itemId: def.id, kind: def.kind, name: def.name, description: def.description, price: def.price, sold: false }));
    if (this.weaponLevel < 5) pool.push({ id: `offer:${this.nextId++}`, kind: 'weapon', name: `苹果武器 Lv.${this.weaponLevel + 1}`, description: '基础苹果伤害 +20%（同级加算）', price: 32 + this.weaponLevel * 12, sold: false });
    this.shop = [];
    while (this.shop.length < 4 && pool.length > 0) this.shop.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
  }
  private finishWave(): void {
    if (this.waveSettled || this.result) return;
    if (this.phase !== 'running') return;
    if (this.stage.boss) return;
    this.waveSettled = true;
    this.meleeQueue = [];
    this.skillQueue = []; this.hazards.length = 0; this.orbitApples.length = 0; this.player.dashRemaining = 0; this.dashMods = null;
    for (const pickup of this.pickups) if ((pickup.kind === 'coin' || pickup.kind === 'flower') && pickup.age < 999) this.grantCoins(pickup.value, true);
    this.pickups.length = 0; this.enemies.length = 0; this.projectiles.length = 0;
    this.grantCoins(this.stage.reward);
    this.trainedWaves++;
    if (this.characterId === 'classrep' && this.trainedWaves % 3 === 0 && this.followers.length < 8) {
      const hp = 45;
      this.followers.push({ id: this.nextId++, x: this.player.x - 45, y: this.player.y + 40, hp, maxHp: hp, shootCooldown: 0.2, hurtCooldown: 0, facingX: 1, facingY: 0 });
    }
    this.recomputeStats();
    this.phase = 'shop'; this.rerolls = 0; this.rollShop();
    this.emit('wave', this.player, this.wave, 'complete', `第 ${this.wave} 波完成`);
  }
  private finish(reason: RunResult['reason']): void {
    if (this.result) return;
    this.phase = reason === 'victory' ? 'victory' : 'defeat';
    this.meleeQueue = [];
    this.skillQueue = []; this.hazards.length = 0; this.orbitApples.length = 0; this.player.dashRemaining = 0;
    const talentPointsEarned = reason === 'abandon' ? 0 : this.wave * 5 + (reason === 'victory' ? 10 : 0);
    if (reason === 'victory') {
      for (const pickup of this.pickups) if ((pickup.kind === 'coin' || pickup.kind === 'flower') && pickup.age < 999) this.grantCoins(pickup.value, true);
      this.grantCoins(this.stage.reward); this.pickups.length = 0;
    }
    const profile: Profile = { ...this.profileSnapshot, totalRuns: this.profile.totalRuns + 1, talentPoints: this.profile.talentPoints + talentPointsEarned, threatLevel: Math.min(4, this.profile.threatLevel + (reason === 'victory' ? 1 : 0)) };
    this.result = { reason, wave: this.wave, kills: this.kills, coinsEarned: this.coinsEarned, elapsed: this.elapsed, profile, bossesDefeated: this.bossesDefeated, talentPointsEarned };
    this.progressRevision++;
    this.emit(reason === 'victory' ? 'victory' : 'defeat', this.player);
  }
  private compact(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) if (!this.enemies[i].active) this.enemies.splice(i, 1);
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].life <= 0 || this.projectiles[i].x < 0 || this.projectiles[i].x > WORLD_WIDTH || this.projectiles[i].y < 0 || this.projectiles[i].y > WORLD_HEIGHT) this.projectiles.splice(i, 1);
    for (let i = this.pickups.length - 1; i >= 0; i--) if (this.pickups[i].age > 45) this.pickups.splice(i, 1);
    for (let i = this.followers.length - 1; i >= 0; i--) if (this.followers[i].hp <= 0) this.followers.splice(i, 1);
    for (let i = this.hazards.length - 1; i >= 0; i--) if (this.hazards[i].warningRemaining <= 0 && this.hazards[i].activeRemaining <= 0) this.hazards.splice(i, 1);
    for (let i = this.orbitApples.length - 1; i >= 0; i--) if (this.orbitApples[i].life <= 0 || this.orbitApples[i].remainingHits <= 0) this.orbitApples.splice(i, 1);
  }
}
