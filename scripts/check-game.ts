import assert from 'node:assert/strict';
import { Session, createProfile } from '../src/game/Session';
import { buyTalent, getTalentState, normalizeProfile } from '../src/game/MetaProgress';
import { characters, enemies, items, stages, talents, validateContent } from '../src/game/content';
import type { EnemyState, ItemDef, ItemId, Profile } from '../src/game/types';

/** 纯玩法检查只在边界测试中直接进入内部结算入口，不据此推断实战胜率。 */
type TestAccess = {
  startWave(): void; finishWave(): void; spawnEnemy(kind: string): void;
  damageEnemy(enemy: EnemyState, value: number): void; hurt(value: number): void;
  acquireItem(id: ItemId): boolean; recomputeStats(): void;
  addHazard(enemy: EnemyState, kind: 'laser' | 'area', target: { x: number; y: number }): void;
};
const core = (run: Session): TestAccess => run as unknown as TestAccess;
const step = (run: Session, seconds: number): void => { for (let i = 0; i < Math.ceil(seconds / 0.02); i++) run.step(0.02, { x: 0, y: 0 }); };
const results: string[] = [];
const near = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
validateContent();

{
  const run = new Session('classrep');
  assert.equal('xp' in run.player, false); assert.equal('level' in run.player, false);
  assert.equal('upgradeChoices' in run, false); assert.equal('chooseUpgrade' in run, false);
  assert.equal(new Session('classrep').inventory.length, 1);
  assert.equal(new Session('classrep', { ...createProfile(), bossWins: 1 }).inventory.length, 2);
  assert.equal(new Session('classrep', { ...createProfile(), bossWins: 99 }).inventory.length, 3);
  for (let wave = 1; wave <= 8; wave++) { run.wave = wave; assert.equal(run.biome, ['grass', 'grass', 'forest', 'forest', 'sand', 'sand', 'water', 'water'][wave - 1]); }
  run.phase = 'shop'; assert.equal(run.nextWave(), false);
  results.push('固定8波/场景阶段/槽位1~3，无局内XP和升级接口');
}

{
  const original = { ...createProfile(), talentPoints: 500 };
  assert.equal(buyTalent(original, 'attack-haste'), null);
  assert.equal(buyTalent(original, 'missing'), null);
  const first = buyTalent(original, 'attack-power')!;
  assert.equal(first.talentPoints, 480); assert.equal(original.talentPoints, 500);
  assert.equal(first.talents['attack-power'], 1); assert.equal(getTalentState(first, 'attack-haste')?.locked, false);
  const second = buyTalent(first, 'attack-power')!; const third = buyTalent(second, 'attack-power')!;
  assert.equal(getTalentState(third, 'attack-power')?.maxed, true); assert.equal(buyTalent(third, 'attack-power'), null);
  assert.equal(buyTalent(createProfile(), 'survival-vigor'), null);
  const full: Profile = { ...createProfile(), talents: Object.fromEntries(Object.values(talents).map(node => [node.id, node.maxRank])) };
  const run = new Session('classrep', full);
  near(run.player.damage, 11.8); near(run.player.maxHp, 124); near(run.player.hp, 124);
  near(run.player.attackSpeed, 1.08); near(run.player.crit, 0.11); near(run.player.armor, 3);
  near(run.player.regen, 0.65); near(run.player.moveSpeed, 225 * 1.09);
  assert.equal(run.pierceCount, 1); assert.equal(run.pickupRange, 130);
  results.push('局外9节点前置/扣点/等级上限/不可变购买，与装备同源应用实际增益');
}

{
  const legacy = { stardust: 7, ranks: { 'shared-power': 2, 'tank-regen': 2, fake: 999 }, stats: { runs: 4, totalBossKills: 2, bestWave: 10, totalNormalKills: 30, totalEliteKills: 5 } };
  const migrated = normalizeProfile(null, legacy);
  assert.equal(migrated.version, 2); assert.equal(migrated.talentPoints, 47);
  assert.equal(migrated.bossWins, 2); assert.equal(migrated.bestWave, 8); assert.equal(migrated.totalKills, 35);
  assert.equal(migrated.threatLevel, 0);
  assert.deepEqual(migrated.talents, {});
  const again = normalizeProfile(migrated, legacy); assert.equal(again.talentPoints, 47);
  assert.equal(normalizeProfile({ version: 1, bossWins: 3 }, legacy).bossWins, 3);
  const corrupt = normalizeProfile({ version: 2, talentPoints: -5, talents: { 'attack-power': 100, 'agility-pierce': 1 } });
  assert.equal(corrupt.talentPoints, 0); assert.equal(corrupt.talents['attack-power'], 3); assert.equal(corrupt.talents['agility-pierce'], 0);
  assert.equal(normalizeProfile({ version: 2, bossWins: 999 }).threatLevel, 0);
  assert.equal(normalizeProfile({ version: 2, threatLevel: 99 }).threatLevel, 4);
  results.push('旧星尘+实际购买成本一次性迁移，V2不重复兑换且存档边界规范化');
}

{
  const run = new Session('classrep', createProfile(), { seed: 21 });
  assert.ok(core(run).acquireItem('lamp')); assert.ok(run.useItem(0));
  assert.equal(run.inventory[0], null); assert.equal(run.player.invulnerable, 11.2);
  assert.equal(run.useItem(0), false); assert.equal(core(run).acquireItem('lamp'), false);
  run.pause(); step(run, 0.5); assert.equal(run.player.invulnerable, 11.2);
  run.resume(); step(run, 0.5); near(run.player.invulnerable, 10.7);
  results.push('灯一次性消费/持续11.2秒/暂停冻结/本局获取上限');
}

{
  const run = new Session('duo'); run.player.hp = 57;
  assert.ok(run.activateSkill()); const cd = run.player.skillCooldown;
  assert.ok(run.switchForm()); assert.equal(run.player.hp, 57); assert.equal(run.player.skillCooldown, cd);
  assert.equal(run.ability.id, 'signal-orbit'); assert.ok(run.player.speedBoostRemaining > 0 && run.player.invulnerable > 0);
  assert.equal(run.switchForm(), false);
  results.push('兔狗形态技能/共用生命和冷却/切换短保护加速');
}

{
  const run = new Session('goodrabbit', createProfile(), { seed: 8 });
  core(run).finishWave(); assert.equal(run.phase, 'shop'); assert.equal(run.shop.length, 4);
  run.player.coins = 1000; const offer = run.shop.find(item => item.kind === 'equipment')!;
  const coins = run.player.coins; assert.ok(run.buy(offer.id)); assert.equal(run.player.coins, coins - offer.price);
  assert.equal(run.buy(offer.id), false); assert.equal(run.player.coins, coins - offer.price);
  assert.ok(run.reroll()); assert.ok(run.nextWave()); assert.equal(run.wave, 2);
  results.push('每普通波结束商店、单次购买/扣款/刷新/下一波');
}

{
  const run = new Session('bingo');
  for (const id of ['multishot', 'pierce', 'explosion', 'regen', 'lifesteal']) {
    for (let i = 0; i < items[id].maxStacks; i++) assert.ok(core(run).acquireItem(id));
    assert.equal(core(run).acquireItem(id), false);
  }
  assert.equal(run.shotCount, 3); assert.equal(run.pierceCount, 2); assert.equal(run.equipment.explosion, 2);
  const registry = items as Record<string, ItemDef>;
  registry['test-charm'] = { id: 'test-charm', name: '扩展演练', icon: 'heart-icon', description: '', price: 20, kind: 'equipment', maxStacks: 1, statBonuses: { maxHp: 10, damage: 0.2 } };
  const another = new Session('classrep'); assert.ok(core(another).acquireItem('test-charm'));
  assert.equal(another.player.maxHp, 110); assert.equal(another.player.hp, 110); assert.equal(another.player.damage, 12);
  delete registry['test-charm'];
  results.push('装备封顶和只登记新属性饰品即可生效的扩展演练');
}

{
  const run = new Session('classrep'); core(run).spawnEnemy('cookie');
  run.step(0.02, { x: 0, y: 0, aimX: 0, aimY: -1 }); assert.equal(run.projectiles.length, 0);
  run.step(0.02, { x: 1, y: 0, fire: false }); assert.equal(run.player.facingY, -1);
  run.step(0.02, { x: 0, y: 0, fire: true });
  assert.ok(Math.abs(run.projectiles[0].vx) < 1e-7 && run.projectiles[0].vy < 0);
  const cd = run.attackCooldownRemaining; assert.equal(cd, run.attackInterval);
  run.step(0.02, { x: 0, y: 0 }); near(run.attackCooldownRemaining, cd - 0.02);
  run.pause(); step(run, 0.3); near(run.attackCooldownRemaining, cd - 0.02);
  const auto = new Session('classrep'); auto.props.length = 0;
  auto.step(0.02, { x: 0, y: 0, autoAim: true }); assert.equal(auto.projectiles.length, 0);
  core(auto).spawnEnemy('cookie'); auto.enemies[0].x = auto.player.x + 150; auto.enemies[0].y = auto.player.y;
  auto.step(0.02, { x: 0, y: 0, autoAim: true }); assert.ok(auto.projectiles[0].vx > 0);
  results.push('手动瞄准开火/自动索敌/真实普攻CD和暂停冻结');
}

{
  const run = new Session('bingo'); run.props.length = 0;
  core(run).acquireItem('multishot'); core(run).acquireItem('multishot'); run.player.crit = 0;
  for (const dx of [40, 65, -60]) { core(run).spawnEnemy('cookie'); const e = run.enemies.at(-1)!; e.x = run.player.x + dx; e.y = run.player.y; e.hp = e.maxHp = 1000; e.speed = 0; }
  run.drainEffects(); run.step(0.01, { x: 0, y: 0, aimX: 1, aimY: 0, fire: true });
  assert.deepEqual(run.enemies.map(e => e.hp), [979, 1000, 1000]);
  const cd = run.attackCooldownRemaining; run.pause(); step(run, 0.4); assert.equal(run.enemies[0].hp, 979);
  run.resume(); step(run, 0.2); near(run.enemies[0].hp, 951.7); near(run.attackCooldownRemaining, cd - 0.2);
  assert.deepEqual(run.drainEffects().filter(e => e.type === 'melee').map(e => e.comboIndex), [0, 1, 2]);
  const pierce = new Session('bingo'); pierce.props.length = 0; core(pierce).acquireItem('pierce'); core(pierce).acquireItem('pierce'); pierce.player.crit = 0;
  for (const dx of [40, 60, 80, 100, -60]) { core(pierce).spawnEnemy('cookie'); const e = pierce.enemies.at(-1)!; e.x = pierce.player.x + dx; e.y = pierce.player.y; e.hp = e.maxHp = 1000; e.speed = 0; }
  pierce.step(0.01, { x: 0, y: 0, aimX: 1, aimY: 0, fire: true });
  assert.deepEqual(pierce.enemies.map(e => e.hp), [979, 979, 979, 1000, 1000]);
  results.push('近战120°/多段65%/单轮CD/逐段事件/穿透最近3目标');
}

{
  const run = new Session('goodrabbit'); run.pickups.length = 0;
  run.pickups.push({ id: 90001, kind: 'flower', value: 1, age: 0, x: run.player.x, y: run.player.y }, { id: 90002, kind: 'coin', value: 1, age: 0, x: run.player.x, y: run.player.y });
  run.step(0.02, { x: 0, y: 0 }); assert.equal(run.player.coins, 3); step(run, 0.02); assert.equal(run.player.coins, 3);
  const end = new Session('classrep'); assert.equal(end.pickups.filter(p => p.kind === 'flower').length, 5); end.pickups.length = 0;
  end.pickups.push({ id: 90003, kind: 'flower', value: 2, age: 0, x: 40, y: 40 }, { id: 90004, kind: 'coin', value: 3, age: 0, x: 45, y: 40 }, { id: 90005, kind: 'apple', value: 100, age: 0, x: 50, y: 40 });
  end.waveTime = 0; end.step(0.02, { x: 0, y: 0 }); assert.equal(end.phase, 'shop'); assert.equal(end.player.coins, 5 + stages[0].reward);
  core(end).finishWave(); assert.equal(end.player.coins, 5 + stages[0].reward);
  results.push('花/饼干统一倍率、波末仅货币一次结算，回血不换币');
}

{
  for (const wave of [1, 5]) {
    const run = new Session('classrep'); run.wave = wave; core(run).startWave(); run.player.crit = 0;
    assert.ok(run.activateSkill()); assert.equal(run.projectiles.length, 64);
    for (const speed of [300, 430]) {
      const ring = run.projectiles.filter(p => Math.abs(Math.hypot(p.vx, p.vy) - speed) < 1e-7); assert.equal(ring.length, 32);
      ring.forEach((p, i) => { near(p.vx, Math.cos(i * Math.PI * 2 / 32) * speed); near(p.damage, run.player.damage * (wave >= 5 ? 1.05 : 0.85)); });
    }
  }
  const run = new Session('classrep'); run.props.length = 0;
  for (const id of ['multishot', 'multishot', 'pierce', 'pierce', 'lifesteal', 'explosion']) assert.ok(core(run).acquireItem(id));
  run.activateSkill(); run.pause(); step(run, 0.5); assert.equal(run.projectiles.length, 64);
  run.resume(); step(run, 0.36); assert.equal(run.projectiles.length, 192);
  assert.ok(run.projectiles.every(p => p.mods?.lifesteal === 0.75 && p.mods?.explosionChance === 0.15 && p.pierce === 2));
  core(run).finishWave(); assert.equal(run.projectiles.length, 0);
  const rabbit = new Session('goodrabbit'); rabbit.activateSkill(); assert.equal(rabbit.projectiles.length, 5); assert.ok(rabbit.projectiles.every(p => p.kind === 'cookie'));
  results.push('双环32方向共64弹、第5波强化、统一AttackMods/192弹/暂停清场、三好兔饼干弹');
}

{
  const run = new Session('duo'); run.switchForm(); run.player.crit = 0; assert.ok(run.activateSkill()); assert.equal(run.orbitApples.length, 6);
  core(run).spawnEnemy('cookie'); const target = run.enemies[0]; target.hp = 1000; target.speed = 0; target.x = run.player.x + 78; target.y = run.player.y;
  run.step(0.02, { x: 0, y: 0 }); assert.equal(run.orbitApples.length, 5); assert.ok(target.hp < 1000);
  const heart = new Session('duo'); heart.player.crit = 0; heart.activateSkill(); core(heart).spawnEnemy('cookie');
  const hit = heart.enemies[0]; hit.x = heart.player.x + 30; hit.y = heart.player.y; hit.hp = 1000; hit.speed = 0;
  heart.step(0.02, { x: 1, y: 0 }); assert.ok(hit.hp < 1000); assert.ok(heart.player.dashRemaining > 0 && heart.player.invulnerable > 0);
  results.push('兔冲锋穿敌/短保护与狗有限环绕苹果命中消耗');
}

{
  const run = new Session('classrep');
  for (let wave = 1; wave <= 6; wave++) { run.wave = wave; run.phase = 'running'; core(run).startWave(); core(run).finishWave(); }
  assert.equal(run.followers.length, 2); assert.ok(run.followers.every(f => f.maxHp === 45));
  run.nextWave(); const doomed = run.followers[0]; doomed.hp = 1; doomed.x = run.player.x + 120; doomed.y = run.player.y;
  run.followers[1].x = run.player.x - 300; core(run).spawnEnemy('cookie'); const e = run.enemies[0]; e.x = doomed.x + 1; e.y = doomed.y; e.speed = 0;
  run.step(0.01, { x: 0, y: 0 }); assert.ok(!run.followers.some(f => f.id === doomed.id));
  const count = run.followers.length; step(run, 0.3); assert.equal(run.followers.length, count);
  results.push('每3普通波独立45HP跟班、敌人可击杀、不自动复活');
}

{
  const run = new Session('bingo'); run.props.length = 0; core(run).spawnEnemy('laser'); const caster = run.enemies[0]; caster.x = run.player.x - 250; caster.y = run.player.y; caster.cooldown = 0;
  const hp = run.player.hp; run.step(0.02, { x: 0, y: 0 }); const hazard = run.hazards[0]; assert.ok(hazard.warningRemaining > 0); assert.equal(run.player.hp, hp);
  run.projectiles.push({ id: 99991, x: run.player.x + 50, y: run.player.y, vx: 0, vy: 0, damage: 9, radius: 7, life: 2, enemy: true, pierce: 0, hitIds: new Set(), kind: 'note' });
  run.step(0.01, { x: 0, y: 0, aimX: 1, aimY: 0, fire: true }); assert.ok(!run.projectiles.some(p => p.id === 99991)); assert.ok(run.hazards.includes(hazard));
  const warning = hazard.warningRemaining; run.pause(); step(run, 0.5); assert.equal(hazard.warningRemaining, warning);
  run.resume(); step(run, 0.95); assert.ok(run.player.shield < run.player.maxShield || run.player.hp < hp);
  const edge = new Session('classrep'); core(edge).spawnEnemy('laser'); edge.enemies[0].x = 1850; edge.enemies[0].y = 500;
  core(edge).addHazard(edge.enemies[0], 'laser', { x: 1900, y: 550 }); const line = edge.hazards[0];
  near(Math.abs(50 * (line.endY - line.y) - 50 * (line.endX - line.x)) / Math.hypot(line.endX - line.x, line.endY - line.y), 0);
  results.push('激光预警由核心判伤/暂停冻结/不可格挡，普通弹可格挡，边缘射线不偏转');
}

{
  const run = new Session('classrep'); const first = { ...run.difficulty };
  run.weaponLevel = 5; for (const id of ['bow', 'bow', 'bow', 'multishot', 'multishot', 'shell', 'shell']) core(run).acquireItem(id); core(run).recomputeStats();
  assert.deepEqual(run.difficulty, first); core(run).spawnEnemy('cookie'); near(run.enemies[0].maxHp, enemies.cookie.hp);
  run.wave = 2; core(run).startWave(); assert.ok(run.difficulty.hp > 1 && run.difficulty.hp <= 1.2); assert.ok(run.difficulty.damage >= 1 && run.difficulty.damage <= 1.08);
  const snapshot = { ...run.difficulty }; run.player.hp = 1; run.player.coins += 500; core(run).recomputeStats(); assert.deepEqual(run.difficulty, snapshot);
  const veteran = new Session('classrep', { ...createProfile(), bossWins: 999 }); near(veteran.difficulty.hp, 1);
  assert.ok(run.player.damage / characters.classrep.base.damage > run.difficulty.hp);
  results.push('动态难度仅波初快照、HP最多20%伤害最多8%补偿、不即时追涨且保留成长收益');
}

{
  const run = new Session('classrep', { ...createProfile(), talentPoints: 7 }, { seed: 4 });
  run.wave = 8; core(run).startWave(); run.pickups.length = 0; run.props.length = 0; run.player.invulnerable = 100;
  core(run).spawnEnemy('boss'); const boss = run.enemies[0]; boss.x = run.player.x + 10; boss.y = run.player.y; boss.hp = 1;
  run.projectiles.push({ id: 99999, x: boss.x, y: boss.y, vx: 0, vy: 0, damage: 2, radius: 6, life: 1, enemy: false, pierce: 0, hitIds: new Set(), kind: 'apple' });
  run.step(0.01, { x: 0, y: 0 }); assert.equal(run.phase, 'victory'); assert.equal(run.result?.reason, 'victory');
  assert.equal(run.result?.talentPointsEarned, 50); assert.equal(run.profileSnapshot.talentPoints, 57); assert.equal(run.profileSnapshot.bossWins, 1);
  const expected = enemies.boss.coins + stages[7].reward; assert.equal(run.player.coins, expected); assert.equal(run.result?.coinsEarned, expected);
  const result = run.result; core(run).damageEnemy(boss, 1e9); run.abandon(); step(run, 1); assert.equal(run.result, result); assert.equal(run.profileSnapshot.talentPoints, 57); assert.equal(run.nextWave(), false);
  const dead = new Session('classrep'); core(dead).hurt(1e6); assert.equal(dead.result?.reason, 'defeat'); assert.equal(dead.result?.talentPointsEarned, 5); dead.abandon(); assert.equal(dead.profileSnapshot.talentPoints, 5);
  const abandon = new Session('classrep'); abandon.abandon(); abandon.abandon(); assert.equal(abandon.result?.talentPointsEarned, 0); assert.equal(abandon.profileSnapshot.totalRuns, 1);
  const timeout = new Session('classrep'); timeout.wave = 8; core(timeout).startWave(); timeout.player.invulnerable = 100; step(timeout, 2); timeout.waveTime = 0; step(timeout, 0.5); assert.equal(timeout.phase, 'running'); assert.equal(timeout.result, null);
  results.push('Boss必须击杀且第8波胜利终结，通关50/首波失败5/放弃0且收支幂等');
}

{
  for (const wave of [1, 4, 7, 8]) {
    const run = new Session('classrep', { ...createProfile(), talentPoints: 7, threatLevel: 2 });
    run.wave = wave; core(run).startWave(); core(run).hurt(1e6);
    assert.equal(run.result?.talentPointsEarned, wave * 5); assert.equal(run.profileSnapshot.talentPoints, 7 + wave * 5);
    assert.equal(run.profileSnapshot.threatLevel, 2); const result = run.result;
    run.abandon(); core(run).hurt(1e6); assert.equal(run.result, result); assert.equal(run.profileSnapshot.threatLevel, 2);
    const quit = new Session('classrep', { ...createProfile(), threatLevel: 2 }); quit.wave = wave; quit.abandon();
    assert.equal(quit.result?.talentPointsEarned, 0); assert.equal(quit.profileSnapshot.threatLevel, 2);
  }
  for (const threatLevel of [0, 3, 4]) {
    const run = new Session('classrep', { ...createProfile(), threatLevel }); run.wave = 8; core(run).startWave();
    core(run).spawnEnemy('boss'); core(run).damageEnemy(run.enemies[0], 1e9);
    assert.equal(run.profileSnapshot.threatLevel, Math.min(4, threatLevel + 1)); assert.equal(run.result?.talentPointsEarned, 50);
    run.abandon(); assert.equal(run.profileSnapshot.threatLevel, Math.min(4, threatLevel + 1));
    const next = new Session('classrep', run.profileSnapshot);
    near(next.difficulty.hp, 1 + 0.25 * run.profileSnapshot.threatLevel);
    near(next.difficulty.damage, 1 + 0.08 * run.profileSnapshot.threatLevel);
    assert.ok(next.difficulty.mechanicTier <= 2);
  }
  const full = new Session('bingo', { ...createProfile(), threatLevel: 4, talents: Object.fromEntries(Object.values(talents).map(node => [node.id, node.maxRank])) });
  for (const [id, def] of Object.entries(items)) if (def.kind === 'equipment') for (let rank = 0; rank < def.maxStacks; rank++) core(full).acquireItem(id);
  full.weaponLevel = 5; full.wave = 8; core(full).startWave();
  assert.ok(full.difficulty.growthHp <= 1.2 && full.difficulty.growthDamage <= 1.08);
  assert.ok(full.difficulty.hp <= 2.4 && full.difficulty.damage <= 1.4256 + 1e-8);
  results.push('波次奖励1/4/7/8、胜利威胁+1封4、失败放弃不涨、下局应用及总系数封顶');
}

{
  for (const character of Object.keys(characters)) {
    const run = new Session(character, createProfile(), { seed: 23 }); run.player.invulnerable = 1000;
    for (let frame = 0; frame < 9000 && !run.result; frame++) {
      if (run.phase === 'shop') { for (const offer of [...run.shop].sort((a, b) => Number(b.kind === 'weapon') - Number(a.kind === 'weapon'))) run.buy(offer.id); run.nextWave(); continue; }
      const target = run.enemies.find(e => e.kind === 'boss') ?? run.enemies.find(e => e.active);
      let x = 0; let y = 0; let aimX = run.player.facingX; let aimY = run.player.facingY;
      if (target) { const dx = target.x - run.player.x; const dy = target.y - run.player.y; const dist = Math.hypot(dx, dy); if (dist > 0) { aimX = dx / dist; aimY = dy / dist; } if (dist > (run.melee ? 60 : 200)) { x = dx / dist; y = dy / dist; } }
      run.step(0.05, { x, y, aimX, aimY, fire: !!target }); run.activateSkill(); run.drainEffects();
    }
    assert.equal(run.phase, 'victory', character); assert.equal(run.result?.profile.totalRuns, 1); assert.equal(run.result?.talentPointsEarned, 50); assert.ok(run.wave <= 8);
  }
  results.push('四角色固定8波战斗→商店→Boss胜利完整状态链（无敌仅用于流程，不代表胜率）');
}

for (const label of results) console.log(`✓ ${label}`);
console.log(`完成 ${results.length} 组纯玩法检查。`);
