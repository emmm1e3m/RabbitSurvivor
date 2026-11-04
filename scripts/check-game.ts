import assert from 'node:assert/strict';
import { Session, createProfile } from '../src/game/Session';
import { characters, enemies, items, stages, validateContent } from '../src/game/content';
import type { EnemyState, ItemDef, ItemId } from '../src/game/types';

/** 纯逻辑检查允许进入内部结算入口，避免等待几分钟才能覆盖终局边界。 */
type TestAccess = {
  startWave(): void;
  finishWave(): void;
  spawnEnemy(kind: string): void;
  damageEnemy(enemy: EnemyState, value: number): void;
  acquireItem(id: ItemId): boolean;
  gainXp(amount: number): void;
  recomputeStats(): void;
};
const internals = (run: Session): TestAccess => run as unknown as TestAccess;
const step = (run: Session, seconds: number): void => { for (let i = 0; i < Math.ceil(seconds / 0.02); i++) run.step(0.02, { x: 0, y: 0 }); };
const results: string[] = [];
validateContent();

for (const def of Object.values(characters)) assert.ok(def.abilityId && def.forms.includes(def.initialForm));
for (const stage of stages) for (const kind of Object.keys(stage.weights)) assert.ok(enemies[kind]);
assert.equal(new Session('classrep').inventory.length, 1);
assert.equal(new Session('classrep', { ...createProfile(), bossWins: 1 }).inventory.length, 2);
assert.equal(new Session('classrep', { ...createProfile(), bossWins: 99 }).inventory.length, 3);
assert.equal(new Session('classrep', { ...createProfile(), bossWins: 1 }, { challenge: 3 }).challenge, 1);
assert.equal(new Session('classrep', { ...createProfile(), bossWins: 2 }, { challenge: 3 }).challenge, 2);
results.push('内容引用与消耗品槽位 1→3 上限');

{
  const run = new Session('classrep', createProfile(), { seed: 21 });
  assert.ok(internals(run).acquireItem('lamp'));
  assert.ok(run.useItem(0));
  assert.equal(run.inventory[0], null);
  assert.equal(run.player.invulnerable, 11.2);
  assert.equal(run.useItem(0), false);
  assert.equal(internals(run).acquireItem('lamp'), false);
  run.pause(); step(run, 0.5); assert.equal(run.player.invulnerable, 11.2);
  run.resume(); step(run, 0.5); assert.ok(run.player.invulnerable > 10.6 && run.player.invulnerable < 10.8);
  assert.equal(run.lampAcquired, true);
  results.push('灯消费一次、11.2 秒持续状态、暂停冻结、禁止再次取得');
}

{
  const run = new Session('duo', createProfile(), { seed: 5 });
  run.player.hp = 57;
  assert.ok(run.activateSkill());
  const cooldown = run.player.skillCooldown;
  assert.ok(run.switchForm());
  assert.equal(run.form, 'signal'); assert.equal(run.player.hp, 57);
  assert.equal(run.player.skillCooldown, cooldown);
  assert.equal(run.switchForm(), false);
  results.push('心好兔/信号狗共享血量与技能冷却，切换不重置');
}

{
  const run = new Session('goodrabbit', createProfile(), { seed: 8 });
  internals(run).gainXp(51);
  assert.equal(run.phase, 'upgrade'); assert.equal(run.player.level, 2);
  assert.equal(run.player.xp, 1); assert.equal(run.player.xpToNext, 60);
  assert.equal(run.upgradeChoices.length, 3);
  const id = run.upgradeChoices[0].id;
  assert.ok(run.chooseUpgrade(id)); assert.equal(run.chooseUpgrade(id), false);
  assert.equal(run.phase, 'running');
  internals(run).finishWave();
  run.player.coins = 1000;
  const offer = run.shop.find(item => item.kind === 'equipment')!;
  assert.ok(offer); const before = run.player.coins;
  assert.ok(run.buy(offer.id)); assert.equal(run.player.coins, before - offer.price);
  assert.equal(run.buy(offer.id), false); assert.equal(run.player.coins, before - offer.price);
  assert.ok(run.reroll()); assert.ok(run.nextWave()); assert.equal(run.wave, 2);
  results.push('递增 XP、三选一单次消费、商店扣款与售罄、刷新和下一波');
}

{
  const run = new Session('bingo');
  for (const id of ['multishot', 'pierce', 'explosion', 'regen', 'lifesteal']) {
    for (let i = 0; i < items[id].maxStacks; i++) assert.ok(internals(run).acquireItem(id));
    assert.equal(internals(run).acquireItem(id), false);
  }
  assert.equal(run.shotCount, 3); assert.equal(run.pierceCount, 2);
  assert.equal(run.equipment.explosion, 2); assert.ok(run.player.regen <= 2);
  results.push('弹丸、穿透、爆炸、回复类道具层数封顶');
}

{
  const registry = items as Record<string, ItemDef>;
  registry['test-new-charm'] = { id: 'test-new-charm', name: '扩展演练饰品', icon: 'heart', description: '仅测试登记', price: 20, kind: 'equipment', maxStacks: 1, statBonuses: { maxHp: 10, damage: 0.2 } };
  const run = new Session('classrep');
  assert.ok(internals(run).acquireItem('test-new-charm'));
  assert.equal(run.player.maxHp, 110); assert.equal(run.player.hp, 110); assert.equal(run.player.damage, 12);
  assert.equal(internals(run).acquireItem('test-new-charm'), false);
  delete registry['test-new-charm'];
  results.push('扩展演练：只新增定义的属性饰品自动生效，无需修改核心');
}

{
  const run = new Session('classrep', createProfile(), { seed: 90 });
  run.wave = 8; internals(run).startWave(); run.player.invulnerable = 100;
  step(run, 2);
  const boss = run.enemies.find(enemy => enemy.kind === 'boss')!;
  assert.ok(boss); run.waveTime = 0; step(run, 0.5);
  assert.equal(run.phase, 'running'); assert.equal(run.result, null); assert.ok(boss.active);
  internals(run).damageEnemy(boss, 100000);
  assert.equal(run.phase, 'victory'); assert.equal(run.result?.profile.bossWins, 1);
  const result = run.result;
  internals(run).damageEnemy(boss, 100000); run.abandon();
  assert.equal(run.result, result); assert.equal(run.result?.profile.totalRuns, 1);
  results.push('最终波超时不胜利、必须击杀坏老板、结算与奖励只记一次');
}

{
  for (const id of Object.keys(characters)) {
    const run = new Session(id, createProfile(), { seed: 42 });
    step(run, 8);
    assert.ok(run.enemies.length > 0); assert.ok(Number.isFinite(run.player.hp));
    assert.ok(run.projectiles.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
  }
  results.push('四角色实际步进、敌人生成和弹丸状态无 NaN');
}

{
  const run = new Session('classrep', createProfile(), { seed: 32 });
  internals(run).spawnEnemy('cookie');
  run.step(0.02, { x: 0, y: 0, aimX: 0, aimY: -1 });
  assert.equal(run.projectiles.length, 0);
  run.step(0.02, { x: 1, y: 0, fire: false });
  assert.equal(run.projectiles.length, 0);
  assert.equal(run.player.facingX, 0); assert.equal(run.player.facingY, -1);
  run.step(0.02, { x: 0, y: 0, fire: true });
  const shot = run.projectiles.find(p => !p.enemy)!;
  assert.ok(shot); assert.ok(Math.abs(shot.vx) < 0.001 && shot.vy < 0);
  const effect = run.drainEffects().find(e => e.type === 'shoot');
  assert.ok(effect); assert.ok(Math.abs(effect.aimX ?? 99) < 0.001 && (effect.aimY ?? 0) < 0);
  assert.equal(run.attackCooldownRemaining, run.attackInterval);
  const cooldown = run.attackCooldownRemaining;
  run.step(0.02, { x: 0, y: 0, fire: false });
  assert.ok(Math.abs(run.attackCooldownRemaining - (cooldown - 0.02)) < 1e-9);
  run.pause(); step(run, 0.2);
  assert.ok(Math.abs(run.attackCooldownRemaining - (cooldown - 0.02)) < 1e-9);
  run.resume();
  results.push('主武器默认不攻击、移动不覆盖瞄准、显式开火沿固定瞄准方向');
  results.push('普攻冷却来自真实武器状态、开火设置、逐步减少且暂停冻结');
}

{
  const run = new Session('classrep', createProfile(), { seed: 32 });
  run.props.length = 0;
  run.step(0.02, { x: 0, y: 0, autoAim: true });
  assert.equal(run.projectiles.length, 0);
  internals(run).spawnEnemy('cookie');
  run.enemies[0].x = run.player.x + 150; run.enemies[0].y = run.player.y;
  run.step(0.02, { x: 0, y: 0, aimX: -1, aimY: 0, autoAim: true, fire: false });
  assert.ok(run.projectiles.length > 0); assert.ok(run.projectiles[0].vx > 0);
  assert.equal(run.player.facingX, 1);
  const propRun = new Session('classrep', createProfile(), { seed: 32 });
  propRun.props[0].x = propRun.player.x; propRun.props[0].y = propRun.player.y - 100;
  propRun.step(0.02, { x: 0, y: 0, autoAim: true });
  assert.ok(propRun.projectiles.length > 0); assert.ok(propRun.projectiles[0].vy < 0);
  results.push('自动模式无目标不攻击，有敌人或可破坏物时自动瞄准开火');
}

{
  const run = new Session('bingo', createProfile(), { seed: 32 });
  internals(run).spawnEnemy('boss'); internals(run).spawnEnemy('boss');
  const [front, back] = run.enemies;
  front.x = run.player.x + 60; front.y = run.player.y;
  back.x = run.player.x - 60; back.y = run.player.y;
  const beforeFront = front.hp; const beforeBack = back.hp;
  run.step(0.02, { x: 0, y: 0, aimX: 1, aimY: 0, fire: false });
  assert.equal(front.hp, beforeFront); assert.equal(back.hp, beforeBack);
  run.step(0.02, { x: 0, y: 0, aimX: 1, aimY: 0, fire: true });
  assert.ok(front.hp < beforeFront); assert.equal(back.hp, beforeBack);
  const swing = run.drainEffects().find(e => e.type === 'melee');
  assert.ok(swing); assert.equal(swing.kind, 'bingo'); assert.equal(swing.aimX, 1); assert.equal(swing.aimY, 0); assert.ok((swing.radius ?? 0) >= 100);
  const empty = new Session('bingo'); empty.enemies.length = 0; empty.props.length = 0; empty.drainEffects();
  empty.step(0.02, { x: 0, y: 0, fire: true, aimX: 0, aimY: -1 });
  assert.ok(empty.drainEffects().some(e => e.type === 'melee' && e.aimY === -1));
  results.push('近战必须开火且只命中前向锥形范围');
}

{
  const run = new Session('bingo', createProfile(), { seed: 32 });
  run.props.length = 0;
  assert.ok(internals(run).acquireItem('multishot')); assert.ok(internals(run).acquireItem('multishot'));
  run.player.crit = 0;
  for (const x of [40, 65]) {
    internals(run).spawnEnemy('cookie');
    const enemy = run.enemies[run.enemies.length - 1];
    enemy.x = run.player.x + x; enemy.y = run.player.y; enemy.hp = enemy.maxHp = 1000; enemy.speed = 0;
  }
  run.drainEffects();
  run.step(0.01, { x: 0, y: 0, aimX: 1, aimY: 0, fire: true });
  assert.equal(run.enemies[0].hp, 979); assert.equal(run.enemies[1].hp, 1000);
  assert.deepEqual(run.drainEffects().filter(e => e.type === 'melee').map(e => e.comboIndex), [0]);
  const remaining = run.attackCooldownRemaining;
  run.pause(); step(run, 0.4); assert.equal(run.enemies[0].hp, 979);
  assert.equal(run.drainEffects().some(e => e.type === 'melee'), false);
  run.resume(); step(run, 0.1);
  assert.deepEqual(run.drainEffects().filter(e => e.type === 'melee').map(e => e.comboIndex), [1]);
  assert.ok(Math.abs(run.enemies[0].hp - 965.35) < 1e-7);
  assert.ok(Math.abs(run.attackCooldownRemaining - (remaining - 0.1)) < 1e-7);
  step(run, 0.1);
  assert.deepEqual(run.drainEffects().filter(e => e.type === 'melee').map(e => e.comboIndex), [2]);
  assert.ok(Math.abs(run.enemies[0].hp - 951.7) < 1e-7);
  assert.equal(run.enemies[1].hp, 1000);
  results.push('双发近战实际追加两段65%伤害、逐段事件、单轮CD与暂停冻结');
}

{
  const run = new Session('bingo', createProfile(), { seed: 32 });
  run.props.length = 0;
  assert.ok(internals(run).acquireItem('pierce')); assert.ok(internals(run).acquireItem('pierce'));
  run.player.crit = 0;
  for (const x of [40, 60, 80, 100, -60]) {
    internals(run).spawnEnemy('cookie');
    const enemy = run.enemies[run.enemies.length - 1];
    enemy.x = run.player.x + x; enemy.y = run.player.y; enemy.hp = enemy.maxHp = 1000; enemy.speed = 0;
  }
  run.step(0.01, { x: 0, y: 0, aimX: 1, aimY: 0, fire: true });
  assert.deepEqual(run.enemies.map(enemy => enemy.hp), [979, 979, 979, 1000, 1000]);
  const duo = new Session('duo');
  assert.ok(duo.switchForm()); assert.ok(internals(duo).acquireItem('multishot'));
  duo.drainEffects(); duo.step(0.01, { x: 0, y: 0, fire: true });
  duo.switchCooldown = 0; assert.ok(duo.switchForm());
  const cooldown = duo.attackCooldownRemaining; duo.drainEffects(); step(duo, 0.15);
  assert.equal(duo.drainEffects().some(e => e.type === 'melee'), false);
  assert.ok(Math.abs(duo.attackCooldownRemaining - (cooldown - 0.16)) < 1e-7);
  results.push('近战穿透每段只命中最近3目标，背后不命中，切形态取消连段且不重置CD');
}

{
  const run = new Session('goodrabbit', createProfile(), { seed: 16 });
  assert.equal(run.pickups.filter(pickup => pickup.kind === 'flower').length, 5);
  assert.ok(run.pickups.filter(pickup => pickup.kind === 'flower').every(pickup => pickup.value === 1));
  run.pickups.length = 0;
  run.pickups.push({ id: 90001, kind: 'flower', value: 1, age: 0, x: run.player.x, y: run.player.y });
  run.pickups.push({ id: 90002, kind: 'coin', value: 1, age: 0, x: run.player.x, y: run.player.y });
  run.step(0.02, { x: 0, y: 0 });
  assert.equal(run.player.coins, 3); assert.equal(run.coinsEarned, 3);
  run.step(0.02, { x: 0, y: 0 }); assert.equal(run.player.coins, 3);
  const end = new Session('classrep'); end.pickups.length = 0;
  end.pickups.push({ id: 90003, kind: 'flower', value: 2, age: 0, x: 40, y: 40 });
  end.pickups.push({ id: 90004, kind: 'coin', value: 3, age: 0, x: 45, y: 40 });
  end.pickups.push({ id: 90005, kind: 'apple', value: 100, age: 0, x: 50, y: 40 });
  end.pickups.push({ id: 90006, kind: 'item', itemId: 'lamp', value: 100, age: 0, x: 55, y: 40 });
  end.waveTime = 0; end.step(0.02, { x: 0, y: 0 });
  assert.equal(end.phase, 'shop'); assert.equal(end.player.coins, 5 + stages[0].reward);
  internals(end).finishWave(); end.step(0.02, { x: 0, y: 0 });
  assert.equal(end.player.coins, 5 + stages[0].reward); assert.equal(end.lampAcquired, false);
  results.push('花与饼干共用货币倍率、波初5朵真拾取、波末仅结算货币且只结算一次');
}

{
  const run = new Session('classrep');
  run.waveTime = 0; internals(run).gainXp(120);
  assert.equal(run.phase, 'upgrade');
  assert.ok(run.chooseUpgrade(run.upgradeChoices[0].id));
  assert.equal(run.phase, 'upgrade'); run.step(0.02, { x: 0, y: 0 }); assert.equal(run.phase, 'upgrade');
  assert.ok(run.chooseUpgrade(run.upgradeChoices[0].id));
  run.step(0.02, { x: 0, y: 0 });
  assert.equal(run.phase, 'shop'); assert.equal(run.shop.length, 4);
  results.push('波末等待所有排队升级处理完，再且只进入一次商店');
}

{
  const run = new Session('classrep', createProfile(), { seed: 4 });
  run.wave = 8; internals(run).startWave(); run.pickups.length = 0; run.props.length = 0;
  internals(run).spawnEnemy('boss');
  const boss = run.enemies[0]; boss.x = run.player.x + 10; boss.y = run.player.y; boss.hp = 1;
  run.player.invulnerable = 100;
  run.projectiles.push({ id: 90000, x: boss.x, y: boss.y, vx: 0, vy: 0, damage: 2, radius: 6, life: 1, enemy: false, pierce: 0, hitIds: new Set(), kind: 'apple' });
  run.step(0.01, { x: 0, y: 0 });
  assert.equal(run.phase, 'victory');
  assert.equal(run.player.coins, enemies.boss.coins); assert.equal(run.coinsEarned, enemies.boss.coins);
  assert.equal(run.result?.coinsEarned, enemies.boss.coins);
  assert.equal(run.pickups.some(pickup => pickup.kind === 'coin' || pickup.kind === 'flower'), false);
  run.step(0.02, { x: 0, y: 0 });
  assert.equal(run.player.coins, run.result?.coinsEarned);
  results.push('贴脸弹丸击杀Boss仅直接奖励一次，结算后停止拾取且结果收支一致');
}

{
  for (const level of [1, 5]) {
    const run = new Session('classrep', createProfile(), { seed: 9 });
    run.player.level = level; internals(run).recomputeStats();
    assert.ok(run.activateSkill()); assert.equal(run.projectiles.length, 64);
    for (const speed of [300, 430]) {
      const ring = run.projectiles.filter(shot => Math.abs(Math.hypot(shot.vx, shot.vy) - speed) < 1e-7);
      assert.equal(ring.length, 32);
      for (let index = 0; index < 32; index++) {
        const angle = index * Math.PI * 2 / 32;
        assert.ok(Math.abs(ring[index].vx - Math.cos(angle) * speed) < 1e-7);
        assert.ok(Math.abs(ring[index].vy - Math.sin(angle) * speed) < 1e-7);
        assert.ok(Math.abs(ring[index].damage - run.player.damage * (level >= 5 ? 1.05 : 0.85)) < 1e-7);
      }
    }
  }
  results.push('苹果双环每圈32方向共64弹，基础85%/5级105%单弹伤害');
}

{
  const run = new Session('classrep', createProfile(), { seed: 23 });
  // 无敌只用于跑完状态链；本检查不评价实战通关难度。
  run.player.invulnerable = 1000;
  for (let frame = 0; frame < 10000 && !run.result; frame++) {
    if (run.phase === 'upgrade') { run.chooseUpgrade(run.upgradeChoices.find(c => c.stat === 'damage')?.id ?? run.upgradeChoices[0].id); continue; }
    if (run.phase === 'shop') { for (const offer of [...run.shop].sort((a, b) => Number(b.kind === 'weapon') - Number(a.kind === 'weapon'))) run.buy(offer.id); run.nextWave(); continue; }
    const target = run.enemies.find(e => e.kind === 'boss') ?? run.enemies.find(e => e.active);
    let x = 0; let y = 0; let aimX = run.player.facingX; let aimY = run.player.facingY;
    if (target) { const dx = target.x - run.player.x; const dy = target.y - run.player.y; const dist = Math.hypot(dx, dy); if (dist > 0) { aimX = dx / dist; aimY = dy / dist; } if (dist > 200) { x = dx / dist; y = dy / dist; } }
    run.step(0.05, { x, y, aimX, aimY, fire: target !== undefined });
    run.activateSkill(); run.drainEffects();
  }
  assert.equal(run.phase, 'victory'); assert.equal(run.result?.profile.totalRuns, 1);
  assert.ok(run.player.level >= 8 && run.player.level <= 25);
  assert.equal(run.followers, 2);
  results.push('完整 8 波战斗→升级→商店→坏老板→一次性结算的状态链');
}

for (const label of results) console.log(`✓ ${label}`);
console.log(`完成 ${results.length} 组纯玩法检查。`);
