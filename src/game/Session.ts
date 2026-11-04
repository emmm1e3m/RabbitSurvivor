import { abilities, characters, enemies as enemyDefs, items, stages, upgrades, validateContent } from './content';
import type { CharacterId, EnemyState, EquipmentEffect, GameEffect, InputState, ItemAction, ItemId, Phase, PickupState, PlayerState, Point, Profile, ProjectileState, PropState, RunResult, SessionOptions, ShopOffer, StatKey, UpgradeOffer } from './types';

export const WORLD_WIDTH = 1920;
export const WORLD_HEIGHT = 1280;
export const createProfile = (): Profile => ({ version: 1, bossWins: 0, bestWave: 0, totalRuns: 0, totalKills: 0 });
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
interface MeleeSwing {
  delay: number; damage: number; critChance: number;
  aim: Point; form: string; radius: number; maxTargets: number; comboIndex: number;
}

/** 一局的唯一玩法状态。UI 只能通过动作入口消费资源；表现事件不参与伤害结算。 */
export class Session {
  phase: Phase = 'running';
  paused = false;
  wave = 1;
  waveTime = stages[0].duration;
  elapsed = 0;
  readonly characterId: CharacterId;
  form: string;
  readonly challenge: number;
  readonly player: PlayerState;
  readonly enemies: EnemyState[] = [];
  readonly projectiles: ProjectileState[] = [];
  readonly props: PropState[] = [];
  readonly pickups: PickupState[] = [];
  readonly inventory: (ItemId | null)[];
  readonly equipment: Record<string, number> = {};
  shop: ShopOffer[] = [];
  upgradeChoices: UpgradeOffer[] = [];
  result: RunResult | null = null;
  weaponLevel = 1;
  switchCooldown = 0;
  followers = 0;
  kills = 0;
  coinsEarned = 0;
  readonly acquired: Record<string, number> = {};
  readonly worldWidth = WORLD_WIDTH;
  readonly worldHeight = WORLD_HEIGHT;
  private readonly profile: Profile;
  private readonly bonus: Record<StatKey, number> = { damage: 0, attackSpeed: 0, maxHp: 0, armor: 0, regen: 0, crit: 0, moveSpeed: 0 };
  private equipmentEffects: Record<EquipmentEffect, number> = { multishot: 0, pierce: 0, explosion: 0, lifesteal: 0, pickupRange: 0 };
  private effects: GameEffect[] = [];
  private seed: number;
  private nextId = 1;
  private spawnTimer = 0.8;
  private attackTimer = 0;
  private followerTimer = 0;
  private reloadTimer = 0;
  ammo = 0;
  private hurtCooldown = 0;
  private pendingUpgrades = 0;
  private rerolls = 0;
  private trainedWaves = 0;
  private incomeRemainder = 0;
  private viewWidth = 900;
  private viewHeight = 650;
  private bossWarning = 0;
  private meleeQueue: MeleeSwing[] = [];

  constructor(characterId: CharacterId, profile: Profile = createProfile(), options: SessionOptions = {}) {
    validateContent();
    if (!characters[characterId]) throw new Error(`角色未注册：${characterId}`);
    this.characterId = characterId;
    this.form = characters[characterId].initialForm;
    this.profile = { ...profile };
    this.challenge = clamp(Math.floor(options.challenge ?? 0), 0, Math.min(3, profile.bossWins));
    this.seed = (options.seed ?? Date.now()) >>> 0;
    const base = characters[characterId].base;
    this.player = { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, hp: base.hp, maxHp: base.hp, shield: 0, maxShield: 0, damage: base.damage, attackSpeed: base.attackSpeed, crit: 0.05, armor: base.armor, regen: base.regen, moveSpeed: base.moveSpeed, range: 330, level: 1, xp: 0, xpToNext: 50, coins: 0, invulnerable: 0, skillCooldown: 0, skillMaxCooldown: abilities[characters[characterId].abilityId].cooldown, facingX: 1, facingY: 0 };
    this.inventory = new Array(1 + Math.min(2, Math.max(0, Math.floor(profile.bossWins)))).fill(null);
    this.recomputeStats();
    this.startWave();
  }

  get stage() { return stages[this.wave - 1]; }
  get rerollCost(): number { return 4 + this.rerolls * 3; }
  get reloadProgress(): number | null { return this.reloadTimer > 0 ? 1 - this.reloadTimer : null; }
  get attackInterval(): number { return (this.melee ? 0.55 : 0.48) / this.player.attackSpeed; }
  get attackCooldownRemaining(): number { return Math.max(0, this.attackTimer); }
  get ability() { return abilities[characters[this.characterId].abilityId]; }
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
  abandon(): void { if (!this.result) this.finish(false); }
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
    const aimLength = Math.hypot(input.aimX ?? 0, input.aimY ?? 0);
    if (aimLength > 0.001) {
      this.player.facingX = (input.aimX ?? 0) / aimLength;
      this.player.facingY = (input.aimY ?? 0) / aimLength;
    }
    const length = Math.hypot(input.x, input.y);
    if (length > 0) {
      const magnitude = Math.min(1, length);
      const dx = input.x / length; const dy = input.y / length;
      this.player.x = clamp(this.player.x + dx * this.player.moveSpeed * magnitude * dt, 25, WORLD_WIDTH - 25);
      this.player.y = clamp(this.player.y + dy * this.player.moveSpeed * magnitude * dt, 25, WORLD_HEIGHT - 25);
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
    if (this.phase !== 'running') return;
    this.updateAttack(dt, input.fire === true, input.autoAim === true);
    if (this.phase !== 'running') return;
    this.updateFollowers(dt);
    this.updateEnemies(dt);
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
    const upgraded = this.player.level >= 5;
    const damage = this.player.damage;
    const actions: Record<string, () => void> = {
      ring: () => { for (const speed of [300, 430]) this.radial(32, damage * (upgraded ? 1.05 : 0.85), speed, 'apple'); },
      rain: () => {
        const angle = Math.atan2(this.player.facingY, this.player.facingX);
        for (let i = -2; i <= 2; i++) this.fire(angle + i * 0.09, damage * (upgraded ? 2.1 : 1.7), 650, 2, 'apple');
      },
      slam: () => { this.explode(this.player.x, this.player.y, upgraded ? 185 : 155, damage * (upgraded ? 3.5 : 2.8), false); this.player.shield = Math.min(this.player.maxShield, this.player.shield + this.player.maxHp * 0.12); },
      duet: () => { this.radial(12, damage * (upgraded ? 1.7 : 1.35), 390, 'heart'); this.explode(this.player.x, this.player.y, 120, damage * 1.5, false); }
    };
    actions[this.ability.kind]();
    this.emit('skill', this.player, undefined, this.ability.kind, this.ability.name);
    return true;
  }

  switchForm(): boolean {
    const forms = characters[this.characterId].forms;
    if (!this.canAct() || forms.length < 2 || this.switchCooldown > 0) return false;
    this.form = forms[(forms.indexOf(this.form) + 1) % forms.length];
    this.meleeQueue = [];
    this.switchCooldown = 4;
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

  chooseUpgrade(id: string): boolean {
    if (this.phase !== 'upgrade' || this.paused) return false;
    const offer = this.upgradeChoices.find(choice => choice.id === id);
    if (!offer || this.pendingUpgrades <= 0) return false;
    this.bonus[offer.stat] += offer.amount;
    this.pendingUpgrades--;
    this.recomputeStats();
    if (offer.stat === 'maxHp') this.heal(offer.amount);
    if (this.pendingUpgrades > 0) this.rollUpgrades();
    else { this.upgradeChoices = []; this.phase = 'running'; }
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
    const combined = { ...this.bonus };
    this.equipmentEffects = { multishot: 0, pierce: 0, explosion: 0, lifesteal: 0, pickupRange: 0 };
    for (const [id, count] of Object.entries(this.equipment)) {
      const def = items[id];
      if (!def) continue;
      for (const [key, amount] of Object.entries(def.statBonuses ?? {})) combined[key as StatKey] += amount * count;
      for (const [key, amount] of Object.entries(def.effectBonuses ?? {})) this.equipmentEffects[key as EquipmentEffect] += amount * count;
    }
    const training = this.characterId === 'classrep' ? this.trainedWaves * 0.03 : 0;
    const savings = this.characterId === 'goodrabbit' ? Math.min(0.3, p.coins * 0.002) : 0;
    p.maxHp = base.hp + combined.maxHp + (this.characterId === 'classrep' ? this.trainedWaves : 0);
    p.damage = base.damage * (1 + 0.2 * (this.weaponLevel - 1)) * (1 + combined.damage + training + savings);
    p.attackSpeed = Math.min(2.2, base.attackSpeed * (1 + combined.attackSpeed));
    p.armor = Math.min(24, base.armor + combined.armor);
    p.regen = Math.min(2, base.regen + combined.regen);
    p.crit = Math.min(0.45, 0.05 + combined.crit);
    p.moveSpeed = Math.min(345, base.moveSpeed * (1 + combined.moveSpeed));
    p.hp = Math.min(p.hp, p.maxHp);
    p.maxShield = this.characterId === 'bingo' ? p.maxHp * 0.22 : 0;
    p.shield = Math.min(p.shield, p.maxShield);
    p.skillMaxCooldown = this.ability.cooldown * (p.level >= 5 ? 0.82 : 1);
  }

  private startWave(): void {
    this.waveTime = this.stage.duration;
    this.enemies.length = 0; this.projectiles.length = 0; this.props.length = 0; this.pickups.length = 0;
    this.spawnTimer = 0.8; this.attackTimer = 0; this.reloadTimer = 0; this.ammo = 0;
    this.meleeQueue = [];
    this.recomputeStats();
    this.player.shield = this.player.maxShield;
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
    const hp = def.hp * (kind === 'boss' ? 1 + this.challenge * 0.2 : this.stage.hpScale);
    this.enemies.push({ id: this.nextId++, kind, x, y, hp, maxHp: hp, radius: def.radius, speed: def.speed, damage: def.damage * (1 + this.challenge * 0.1), age: 0, cooldown: kind === 'boss' ? 1.5 : 1 + this.random(), windup: 0, dashTime: 0, vx: 0, vy: 0, active: true, flash: 0 });
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
      const first: MeleeSwing = { delay: 0, damage: this.player.damage * 1.4, critChance: this.player.crit, aim: { x: this.player.facingX, y: this.player.facingY }, form: this.form, radius: meleeRange, maxTargets: 1 + this.pierceCount, comboIndex: 0 };
      for (let index = 1; index < this.shotCount; index++) this.meleeQueue.push({ ...first, delay: index * 0.09, damage: first.damage * 0.65, comboIndex: index });
      this.performMeleeSwing(first);
    } else {
      const crit = this.random() < this.player.crit;
      const damage = this.player.damage * (crit ? 2 : 1);
      for (let i = 0; i < this.shotCount; i++) this.fire(angle + (i - (this.shotCount - 1) / 2) * 0.1, damage, 530, this.pierceCount, this.form === 'heart' ? 'heart' : 'apple');
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
    const damage = swing.damage * (this.random() < swing.critChance ? 2 : 1);
    const targets = [...this.enemies.filter(enemy => enemy.active), ...this.props]
      .filter(target => this.inMeleeCone(target, swing.radius + target.radius, swing.aim))
      .sort((a, b) => distance(a, this.player) - distance(b, this.player))
      .slice(0, swing.maxTargets);
    // 挥击与命中分离，空挥也有独立动画事件；后续段不重置本轮普攻冷却。
    this.emit('melee', this.player, swing.radius, swing.form, undefined, swing.radius, swing.aim, swing.comboIndex);
    for (const target of targets) {
      if (this.result) break;
      if ('active' in target) this.damageEnemy(target, damage);
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
    this.followerTimer -= dt;
    if (this.followers <= 0 || this.followerTimer > 0) return;
    const target = this.nearestEnemy(440);
    if (!target) return;
    this.followerTimer = 1.5;
    const angle = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    for (let i = 0; i < this.followers; i++) this.fire(angle + (i - 0.5) * 0.06, this.player.damage * 0.35, 460, 0, 'apple');
  }

  private fire(angle: number, damage: number, speed: number, pierce: number, kind: ProjectileState['kind'], enemy = false, origin: Point = this.player): void {
    if (this.projectiles.length >= 160) return;
    this.projectiles.push({ id: this.nextId++, x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, damage, radius: enemy ? 7 : 6, life: enemy ? 4 : 1.3, enemy, pierce, hitIds: new Set(), kind });
    this.emit('shoot', origin, undefined, enemy ? 'enemy' : kind, undefined, undefined, { x: Math.cos(angle), y: Math.sin(angle) });
  }
  private radial(count: number, damage: number, speed: number, kind: ProjectileState['kind']): void {
    for (let i = 0; i < count; i++) this.fire(i * Math.PI * 2 / count, damage, speed, 1, kind);
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      const def = enemyDefs[enemy.kind];
      enemy.age += dt; enemy.cooldown -= dt; enemy.flash = Math.max(0, enemy.flash - dt);
      const dx = this.player.x - enemy.x; const dy = this.player.y - enemy.y;
      const dist = Math.max(0.001, Math.hypot(dx, dy));
      let moving = true;
      if (def.behavior === 'ranged' || def.behavior === 'boss') {
        if (dist < (def.behavior === 'boss' ? 270 : 285)) moving = false;
        if (enemy.cooldown <= 0 && dist < 720) {
          const angle = Math.atan2(dy, dx);
          const count = def.behavior === 'boss' ? 5 + (this.challenge > 1 ? 2 : 0) : 1;
          for (let i = 0; i < count; i++) this.fire(angle + (i - (count - 1) / 2) * 0.22, def.behavior === 'boss' ? 12 * (1 + this.challenge * 0.1) : 8, 210 + this.challenge * 12, 0, 'note', true, enemy);
          enemy.cooldown = def.behavior === 'boss' ? 2.4 : 2.7;
        }
      }
      if (def.behavior === 'charge') {
        if (enemy.dashTime > 0) { enemy.dashTime -= dt; enemy.x += enemy.vx * dt; enemy.y += enemy.vy * dt; moving = false; }
        else if (enemy.windup > 0) { enemy.windup -= dt; moving = false; if (enemy.windup <= 0) { enemy.dashTime = 0.38; enemy.vx = dx / dist * 400; enemy.vy = dy / dist * 400; enemy.cooldown = 3; } }
        else if (dist < 300 && enemy.cooldown <= 0) { enemy.windup = 0.6; moving = false; this.emit('warning', enemy, undefined, 'charge'); }
      }
      if (def.behavior === 'explode') {
        if (enemy.windup > 0) { enemy.windup -= dt; moving = false; if (enemy.windup <= 0) { if (dist < 100) this.hurt(enemy.damage); enemy.active = false; this.emit('explosion', enemy, undefined, 'enemy', undefined, 95); } }
        else if (dist < 95) { enemy.windup = 0.8; moving = false; this.emit('warning', enemy, undefined, 'explode'); }
      }
      if (moving) { enemy.x += dx / dist * enemy.speed * dt; enemy.y += dy / dist * enemy.speed * dt; }
      enemy.x = clamp(enemy.x, 18, WORLD_WIDTH - 18); enemy.y = clamp(enemy.y, 18, WORLD_HEIGHT - 18);
      if (enemy.active && distance(enemy, this.player) < enemy.radius + 17) this.hurt(enemy.damage);
    }
  }

  private updateProjectiles(dt: number): void {
    for (const shot of this.projectiles) {
      if (shot.life <= 0) continue;
      shot.x += shot.vx * dt; shot.y += shot.vy * dt; shot.life -= dt;
      if (shot.enemy) {
        if (distance(shot, this.player) < shot.radius + 17) { this.hurt(shot.damage); shot.life = 0; }
        continue;
      }
      for (const enemy of this.enemies) {
        if (!enemy.active || shot.hitIds.has(enemy.id) || distance(shot, enemy) > shot.radius + enemy.radius) continue;
        shot.hitIds.add(enemy.id); this.damageEnemy(enemy, shot.damage);
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

  private damageEnemy(enemy: EnemyState, amount: number, allowProcs = true): void {
    if (!enemy.active || this.result) return;
    enemy.hp -= amount; enemy.flash = 0.09;
    this.emit('hit', enemy, amount, enemy.kind);
    if (enemy.hp > 0) return;
    enemy.active = false; this.kills++;
    this.emit('kill', enemy, undefined, enemy.kind);
    const def = enemyDefs[enemy.kind];
    this.heal(Math.min(1.5, this.equipmentEffects.lifesteal), false);
    // Boss 奖励直接入账，不再同时生成可重复拾取的同额货币。
    if (def.behavior === 'boss') { this.grantCoins(def.coins); this.finish(true); return; }
    this.drop('coin', enemy, def.coins);
    if (this.random() < 0.07) this.drop('apple', enemy, 8);
    this.gainXp(def.xp);
    if (allowProcs && this.random() < Math.min(0.3, this.equipmentEffects.explosion)) this.explode(enemy.x, enemy.y, 90, this.player.damage * 1.5, false);
  }

  private damageProp(prop: PropState, amount: number): void {
    if (prop.hp <= 0 || this.result) return;
    prop.hp -= amount; prop.flash = 0.1; this.emit('hit', prop, amount, prop.kind);
    if (prop.hp > 0) return;
    this.props.splice(this.props.indexOf(prop), 1);
    if (prop.kind === 'barrel') {
      this.explode(prop.x, prop.y, 125, 42, false);
      if (distance(prop, this.player) < 140) this.hurt(17);
      this.gainXp(4);
    } else {
      this.drop('coin', prop, 5); this.drop('apple', { x: prop.x - 12, y: prop.y }, 10);
      if (this.random() < 0.5) this.drop('apple', { x: prop.x + 15, y: prop.y + 10 }, 10);
      this.gainXp(8); this.emit('kill', prop, undefined, 'tree');
    }
  }
  private explode(x: number, y: number, radius: number, damage: number, allowProcs: boolean): void {
    this.emit('explosion', { x, y }, damage, 'player', undefined, radius);
    for (const enemy of [...this.enemies]) if (enemy.active && distance(enemy, { x, y }) < radius + enemy.radius) this.damageEnemy(enemy, damage, allowProcs);
    for (const prop of [...this.props]) if (prop.hp > 0 && distance(prop, { x, y }) < radius + prop.radius) this.damageProp(prop, damage);
  }
  private hurt(raw: number): void {
    if (this.hurtCooldown > 0 || this.player.invulnerable > 0 || this.player.hp <= 0 || this.result) return;
    const amount = raw * 15 / (15 + this.player.armor);
    const absorbed = Math.min(this.player.shield, amount);
    this.player.shield -= absorbed; this.player.hp = Math.max(0, this.player.hp - (amount - absorbed));
    this.hurtCooldown = 0.5; this.emit(absorbed === amount ? 'shield' : 'hurt', this.player, amount - absorbed);
    if (this.player.hp <= 0) this.finish(false);
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
  private gainXp(amount: number): void {
    this.player.xp += amount;
    while (this.player.xp >= this.player.xpToNext) {
      this.player.xp -= this.player.xpToNext; this.player.level++;
      this.player.xpToNext = 50 + (this.player.level - 1) * 10;
      this.pendingUpgrades++; this.emit('levelup', this.player, this.player.level);
    }
    if (this.pendingUpgrades > 0 && this.phase === 'running') { this.phase = 'upgrade'; this.rollUpgrades(); }
  }
  private rollUpgrades(): void {
    const pool = Object.values(upgrades).filter(def => def.cap === undefined || this.bonus[def.stat] < def.cap);
    this.upgradeChoices = [];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const def = pool.splice(Math.floor(this.random() * pool.length), 1)[0];
      const quality: 1 | 1.2 | 1.5 = this.random() < 0.15 ? 1.5 : this.random() < 0.3 ? 1.2 : 1;
      const amount = def.cap === undefined ? def.amount * quality : Math.min(def.amount * quality, def.cap - this.bonus[def.stat]);
      this.upgradeChoices.push({ id: `${def.id}:${this.player.level}:${this.nextId++}`, name: def.name, icon: def.icon, description: def.description, stat: def.stat, amount, quality });
    }
  }
  private acquireItem(id: ItemId): boolean {
    const def = items[id]; if (!def) return false;
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
      .map(def => ({ id: `offer:${this.nextId++}`, itemId: def.id, kind: def.kind, name: def.name, description: def.description, price: def.price, sold: false }));
    if (this.weaponLevel < 5) pool.push({ id: `offer:${this.nextId++}`, kind: 'weapon', name: `苹果武器 Lv.${this.weaponLevel + 1}`, description: '基础苹果伤害 +20%（同级加算）', price: 32 + this.weaponLevel * 12, sold: false });
    this.shop = [];
    while (this.shop.length < 4 && pool.length > 0) this.shop.push(pool.splice(Math.floor(this.random() * pool.length), 1)[0]);
  }
  private finishWave(): void {
    if (this.phase !== 'running' || this.result || this.stage.boss) return;
    if (this.pendingUpgrades > 0) { this.phase = 'upgrade'; this.rollUpgrades(); return; }
    this.meleeQueue = [];
    for (const pickup of this.pickups) if ((pickup.kind === 'coin' || pickup.kind === 'flower') && pickup.age < 999) this.grantCoins(pickup.value, true);
    this.pickups.length = 0; this.enemies.length = 0; this.projectiles.length = 0;
    this.grantCoins(this.stage.reward);
    this.trainedWaves++;
    if (this.characterId === 'classrep') this.followers = Math.min(2, Math.floor(this.trainedWaves / 3));
    this.recomputeStats();
    this.phase = 'shop'; this.rerolls = 0; this.rollShop();
    this.emit('wave', this.player, this.wave, 'complete', `第 ${this.wave} 波完成`);
  }
  private finish(victory: boolean): void {
    if (this.result) return;
    this.phase = victory ? 'victory' : 'defeat';
    this.meleeQueue = [];
    this.upgradeChoices = []; this.pendingUpgrades = 0;
    const profile: Profile = { version: 1, bossWins: this.profile.bossWins + (victory ? 1 : 0), bestWave: Math.max(this.profile.bestWave, this.wave), totalRuns: this.profile.totalRuns + 1, totalKills: this.profile.totalKills + this.kills };
    this.result = { victory, wave: this.wave, kills: this.kills, coinsEarned: this.coinsEarned, elapsed: this.elapsed, profile, challenge: this.challenge };
    this.emit(victory ? 'victory' : 'defeat', this.player);
  }
  private compact(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) if (!this.enemies[i].active) this.enemies.splice(i, 1);
    for (let i = this.projectiles.length - 1; i >= 0; i--) if (this.projectiles[i].life <= 0 || this.projectiles[i].x < 0 || this.projectiles[i].x > WORLD_WIDTH || this.projectiles[i].y < 0 || this.projectiles[i].y > WORLD_HEIGHT) this.projectiles.splice(i, 1);
    for (let i = this.pickups.length - 1; i >= 0; i--) if (this.pickups[i].age > 45) this.pickups.splice(i, 1);
  }
}
