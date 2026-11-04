// 无头浏览器冒烟测试：加载游戏、进入战斗、模拟操作，截图并收集报错
// 用法: node scripts/verify.mjs [death]
import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync } from 'node:fs';

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find(existsSync);

if (!CHROME) {
  console.error('未找到 Chrome/Edge');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MODE = process.argv[2] ?? 'smoke';
const OUT = '.verify';
mkdirSync(OUT, { recursive: true });

// 若升级选属性弹窗打开则选第一项并确认；未打开时点击空地无副作用
const dismissLevelUp = async (page) => {
  await page.mouse.click(640, 242);
  await sleep(120);
  await page.mouse.click(820, 608);
  await sleep(220);
};

const errors = [];
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu']
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon')) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('favicon')) {
      errors.push(`http ${res.status()}: ${res.url()}`);
    }
  });

  const URL = process.env.URL ?? 'http://localhost:5173/?debug';
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await sleep(800);
  await page.screenshot({ path: `${OUT}/1-menu.png` });

  if (MODE === 'meta') {
    // 主菜单 → 天赋树：购买通用树「强健体魄」→ 查看游侠树 → ESC 返回 → 图鉴四个页签
    await page.keyboard.press('KeyT');
    await sleep(600);
    await page.screenshot({ path: `${OUT}/60-meta-tree.png` });

    const before = await page.evaluate(() => window.__rabbit.MetaProgress.stardust);
    // 通用树 tier0 slot0（强健体魄）位于 (376, 255)
    await page.mouse.click(376, 255);
    await sleep(500);
    await page.screenshot({ path: `${OUT}/61-meta-bought.png` });
    const bought = await page.evaluate(() => {
      const { MetaProgress } = window.__rabbit;
      return { stardust: MetaProgress.stardust, rank: MetaProgress.getRank('shared-vigor') };
    });
    console.log(`meta: 购买后星尘 ${before} -> ${bought.stardust}，等级 ${bought.rank}`);
    if (bought.rank !== 1 || bought.stardust !== before - 8) {
      errors.push('meta: 天赋购买后星尘或等级不符合预期');
    }

    await page.keyboard.press('ArrowRight');
    await sleep(250);
    await page.keyboard.press('ArrowRight');
    await sleep(350);
    await page.screenshot({ path: `${OUT}/62-meta-ranger.png` });

    await page.keyboard.press('Escape');
    await sleep(500);
    await page.keyboard.press('KeyC');
    await sleep(500);
    await page.screenshot({ path: `${OUT}/63-codex-characters.png` });
    await page.keyboard.press('ArrowRight');
    await sleep(350);
    await page.screenshot({ path: `${OUT}/63b-codex-enemies.png` });
    await page.keyboard.press('ArrowRight');
    await sleep(350);
    await page.screenshot({ path: `${OUT}/63c-codex-trinkets.png` });
    await page.keyboard.press('ArrowRight');
    await sleep(350);
    await page.screenshot({ path: `${OUT}/63d-codex-achievements.png` });
    await page.keyboard.press('Escape');
    await sleep(500);

    // 注入已购天赋（直接改真实内存单例）：下一局应带上属性与特效加成
    await page.evaluate(() => {
      const { MetaProgress } = window.__rabbit;
      MetaProgress.data.stardust = 100;
      MetaProgress.data.ranks = {
        'shared-vigor': 3,
        'shared-power': 3,
        'shared-multishot': 2,
        'ranger-burn': 2
      };
    });
    const seeded = await page.evaluate(() => {
      const { MetaProgress } = window.__rabbit;
      return { stardust: MetaProgress.stardust, ranks: { ...MetaProgress.ranks } };
    });
    console.log(`meta: 注入存档 ${JSON.stringify(seeded)}`);
  }

  await page.keyboard.press('Enter');
  await sleep(900);
  await page.screenshot({ path: `${OUT}/1b-character.png` });
  if (MODE === 'shooter') {
    // 默认难度 0 → 按 ↑ 循环到难度 3，验证难度选择 UI
    await page.screenshot({ path: `${OUT}/30-difficulty-default.png` });
    await page.keyboard.press('ArrowUp');
    await sleep(300);
    await page.screenshot({ path: `${OUT}/30b-difficulty-3.png` });
  }
  await page.keyboard.press('ArrowRight');
  await sleep(300);
  await page.screenshot({ path: `${OUT}/1c-character-next.png` });
  if (MODE !== 'restart' && MODE !== 'meta' && MODE !== 'activeskill') {
    await page.keyboard.press('ArrowLeft');
    await sleep(250);
  }
  await page.keyboard.press('Enter');
  await sleep(1200);

  if (MODE === 'meta') {
    // 游侠局：属性与特效应带局外天赋；截图观察多重弹丸与燃烧染色
    await sleep(1000);
    const meta = await page.evaluate(() => {
      const { RunData } = window.__rabbit;
      return {
        character: RunData.character.id,
        maxHp: RunData.attributes.maxHp,
        effects: Object.fromEntries(RunData.metaEffects)
      };
    });
    console.log(
      `meta: 角色=${meta.character} maxHp=${meta.maxHp} effects=${JSON.stringify(meta.effects)}`
    );
    if (
      meta.character !== 'ranger' ||
      Math.abs(meta.maxHp - 110) > 0.01 ||
      meta.effects.extraProjectile !== 2 ||
      meta.effects.burn !== 2
    ) {
      errors.push('meta: 局外天赋未正确应用到本局');
    }

    // 在射程内生成一只蛮兽，等武器命中后检查燃烧状态
    await page.evaluate(() => {
      const gameScene = window.__rabbit.game.scene.getScene('Game');
      gameScene.spawnEnemyNow('brute', { x: gameScene.player.x + 150, y: gameScene.player.y });
    });
    await sleep(900);
    await page.screenshot({ path: `${OUT}/65-meta-burn.png` });
    const burnFx = await page.evaluate(() => {
      const gameScene = window.__rabbit.game.scene.getScene('Game');
      const enemies = gameScene.enemyGroup.getChildren().filter((e) => e.active);
      const projectiles = gameScene.projectileGroup.getChildren().filter((p) => p.active);
      return {
        burning: enemies.filter((e) => e.burnTime > 0).length,
        burnProjectiles: projectiles.filter((p) => p.burnDps > 0).length,
        enemies: enemies.length
      };
    });
    console.log(
      `meta: 燃烧中敌人=${burnFx.burning} 燃烧子弹=${burnFx.burnProjectiles} 场上敌人=${burnFx.enemies}`
    );
    if (burnFx.burning < 1) errors.push('meta: 子弹命中后敌人未进入燃烧状态');

    // 死亡结算：应累加统计、解锁「初次出征」并发放星尘
    await page.keyboard.press('7');
    await sleep(500);
    await page.keyboard.press('7');
    await sleep(1600);
    await page.screenshot({ path: `${OUT}/66-meta-gameover.png` });
    const settlement = await page.evaluate(() => {
      const { MetaProgress } = window.__rabbit;
      return {
        stardust: MetaProgress.stardust,
        runs: MetaProgress.stats.runs,
        firstRun: MetaProgress.isAchievementUnlocked('first-run'),
        chaserKnown: MetaProgress.isEnemyDiscovered('chaser')
      };
    });
    console.log(
      `meta: 结算后星尘=${settlement.stardust} runs=${settlement.runs} 初次出征=${settlement.firstRun} 图鉴追猎者=${settlement.chaserKnown}`
    );
    if (settlement.runs !== 1 || !settlement.firstRun || settlement.stardust <= 100) {
      errors.push('meta: 结算未正确累加统计/解锁成就/发放星尘');
    }
    if (!settlement.chaserKnown) errors.push('meta: 敌人出现后未记入图鉴');
  } else if (MODE === 'shooter') {
    // 难度 3 开局：调试键 H 在右侧生成弹幕精英，等待首轮弹幕并连拍
    await page.keyboard.press('KeyH');
    await sleep(2400);
    await page.screenshot({ path: `${OUT}/31-shooter.png` });
    await sleep(700);
    await page.screenshot({ path: `${OUT}/32-shooter-bullets.png` });
    await sleep(700);
    await page.screenshot({ path: `${OUT}/33-shooter-bullets-2.png` });
  } else if (MODE === 'feedback') {
    // 等待敌人靠近 → K 秒杀最近怪物（死亡残影）→ 7 秒杀玩家（红屏/震动）
    await sleep(6000);
    await page.keyboard.press('KeyK');
    await sleep(120);
    await page.screenshot({ path: `${OUT}/34-death-ghost.png` });
    await sleep(220);
    await page.screenshot({ path: `${OUT}/34b-death-ghost-float.png` });

    await page.keyboard.press('7');
    await sleep(100);
    await page.screenshot({ path: `${OUT}/35-hurt-vignette.png` });
    await sleep(800);
    await page.screenshot({ path: `${OUT}/36-hurt-gameover.png` });
  } else if (MODE === 'hitfx') {
    // 等待敌人靠近后连拍，验证自动攻击命中碰撞点的碎裂粒子
    await sleep(5500);
    for (let i = 0; i < 6; i++) {
      await page.screenshot({ path: `${OUT}/37-hit-shards-${i + 1}.png` });
      await sleep(90);
    }
  } else if (MODE === 'hitflash') {
    // 生成高血量小怪并停在射程内，轮询受击瞬间的纯白闪白，暂停画面后截图
    await page.evaluate(() => {
      const gameScene = window.__rabbit.game.scene.getScene('Game');
      gameScene.spawnEnemyNow('chaser', {
        x: gameScene.player.x + 150,
        y: gameScene.player.y
      });
      for (const enemy of gameScene.enemyGroup.getChildren()) {
        if (enemy.active && enemy.kind === 'chaser') {
          enemy.hp = 9999;
          enemy.maxHp = 9999;
          enemy.speed = 0;
        }
      }
    });
    let flash = null;
    for (let i = 0; i < 200 && !flash; i++) {
      flash = await page.evaluate(() => {
        const gameScene = window.__rabbit.game.scene.getScene('Game');
        const enemy = gameScene.enemyGroup
          .getChildren()
          .find((e) => e.active && e.kind === 'chaser' && e.hitFlashTimer > 0);
        if (!enemy) return null;
        return {
          remaining: enemy.hitFlashTimer,
          tintFill: enemy.tintFill,
          tint: enemy.tintTopLeft
        };
      });
      await sleep(20);
    }
    if (flash) {
      // 暂停场景保留纯白帧再截图
      await page.evaluate(() => {
        window.__rabbit.game.scene.getScene('Game').scene.pause();
      });
      await page.screenshot({ path: `${OUT}/64-hit-flash.png` });
      await page.evaluate(() => {
        window.__rabbit.game.scene.getScene('Game').scene.resume();
      });
    } else {
      await page.screenshot({ path: `${OUT}/64-hit-flash-missed.png` });
    }
    console.log(`hitflash: ${JSON.stringify(flash)}`);
    if (!flash || !flash.tintFill || flash.tint !== 0xffffff) {
      errors.push('hitflash: 小怪受击未出现纯白闪白');
    }
  } else if (MODE === 'skill') {
    // 调试键 G 立即释放环形技能：两圈各 8 发，伴随轻微震屏
    await page.keyboard.press('KeyG');
    await sleep(120);
    await page.screenshot({ path: `${OUT}/40-skill-1.png` });
    await sleep(180);
    await page.screenshot({ path: `${OUT}/40b-skill-2.png` });
    await sleep(220);
    await page.screenshot({ path: `${OUT}/40c-skill-3.png` });
  } else if (MODE === 'charger') {
    // 调试键 V 生成突击怪（调高血量避免被秒）：观察蓄力（黄）→ 冲刺（红）阶段
    await page.keyboard.press('KeyV');
    await sleep(120);
    await page.evaluate(() => {
      const gameScene = window.__rabbit.game.scene.getScene('Game');
      const charger = gameScene.enemyGroup
        .getChildren()
        .find((e) => e.active && e.kind === 'charger');
      if (charger) {
        charger.hp = 9999;
        charger.maxHp = 9999;
      }
    });
    let sawWindup = false;
    let sawDash = false;
    let sawWindupTint = false;
    let sawDashTint = false;
    for (let i = 0; i < 70 && !(sawWindupTint && sawDashTint); i++) {
      const state = await page.evaluate(() => {
        const gameScene = window.__rabbit.game.scene.getScene('Game');
        const charger = gameScene.enemyGroup
          .getChildren()
          .find((e) => e.active && e.kind === 'charger');
        if (!charger) return null;
        return {
          windup: charger.windupTimer,
          dash: charger.dashTimer,
          flash: charger.hitFlashTimer,
          tint: charger.tintTopLeft
        };
      });
      if (state && state.flash <= 0) {
        if (state.windup > 0) {
          if (state.tint === 0xffd23f) sawWindupTint = true;
          // 受击闪白会盖住蓄力/冲刺染色，等闪白结束再截图
          if (!sawWindup) {
            sawWindup = true;
            await page.screenshot({ path: `${OUT}/49-charger-windup.png` });
          }
        } else if (state.dash > 0) {
          if (state.tint === 0xff6b6b) sawDashTint = true;
          if (!sawDash) {
            sawDash = true;
            await page.screenshot({ path: `${OUT}/49b-charger-dash.png` });
          }
        }
      }
      await sleep(120);
    }
    console.log(
      `charger: 蓄力=${sawWindup}(黄=${sawWindupTint}) 冲刺=${sawDash}(红=${sawDashTint})`
    );
    if (!sawWindup || !sawDash) errors.push('charger: 未观察到蓄力或冲刺阶段');
    if (!sawWindupTint || !sawDashTint) errors.push('charger: 蓄力/冲刺染色未正确应用');
  } else if (MODE === 'activeskill') {
    // 游侠主动技能：空格释放 → 冷却；升到 5 级技能 Lv2；冷却结束后点 HUD 按钮再释放
    const before = await page.evaluate(() => {
      const gameScene = window.__rabbit.game.scene.getScene('Game');
      return {
        character: window.__rabbit.RunData.character.id,
        cooldown: gameScene.skillCooldown,
        upgraded: gameScene.isSkillUpgraded()
      };
    });
    console.log(`activeskill: 开局 ${JSON.stringify(before)}`);
    await page.screenshot({ path: `${OUT}/56-skill-ready.png` });
    if (before.character !== 'ranger') errors.push('activeskill: 未选中游侠角色');

    await page.keyboard.press('Space');
    await sleep(200);
    await page.screenshot({ path: `${OUT}/57-skill-cast.png` });
    const afterCast = await page.evaluate(() => {
      const gameScene = window.__rabbit.game.scene.getScene('Game');
      return { cooldown: gameScene.skillCooldown };
    });
    if (!(afterCast.cooldown > 0)) errors.push('activeskill: 空格释放后技能未进入冷却');

    // 连续加经验升到 5 级：每次升级弹窗选第一项确认
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('6');
      await sleep(800);
      await dismissLevelUp(page);
      await sleep(400);
    }
    const upgraded = await page.evaluate(() => {
      const gameScene = window.__rabbit.game.scene.getScene('Game');
      return {
        level: window.__rabbit.RunData.level,
        upgraded: gameScene.isSkillUpgraded(),
        cooldownTotal: gameScene.skillRecoverTotal(true)
      };
    });
    await sleep(600);
    await page.screenshot({ path: `${OUT}/58-skill-upgraded.png` });
    console.log(`activeskill: 5 级 ${JSON.stringify(upgraded)}`);
    if (!upgraded.upgraded) errors.push('activeskill: 达到 5 级后技能未升级');

    // 冷却清零后点击右下角技能按钮，验证按钮释放路径
    await page.evaluate(() => {
      window.__rabbit.game.scene.getScene('Game').skillCooldown = 0;
    });
    await page.mouse.click(1184, 654);
    await sleep(200);
    await page.screenshot({ path: `${OUT}/59-skill-upgraded-cast.png` });
    const recast = await page.evaluate(() =>
      window.__rabbit.game.scene.getScene('Game').skillCooldown
    );
    if (!(recast > 0)) errors.push('activeskill: 升级后点击技能按钮无法释放');
  } else if (MODE === 'reload') {
    // 调试键 R 立即进入装填：蓄力条从 0 涨满，1s 后消失恢复开火
    await page.keyboard.press('KeyR');
    await sleep(220);
    await page.screenshot({ path: `${OUT}/41-reload-start.png` });
    await sleep(450);
    await page.screenshot({ path: `${OUT}/41b-reload-mid.png` });
    await sleep(500);
    await page.screenshot({ path: `${OUT}/41c-reload-done.png` });
  } else if (MODE === 'barrel') {
    // 调试键 N 在玩家右侧生成炸药桶 → U 引爆，验证范围伤害同时命中敌人与玩家
    await sleep(1800);
    await page.keyboard.press('KeyN');
    await sleep(400);
    await page.screenshot({ path: `${OUT}/42-barrel.png` });
    await page.keyboard.press('KeyU');
    await sleep(120);
    await page.screenshot({ path: `${OUT}/43-barrel-explode.png` });
    await sleep(500);
    await page.screenshot({ path: `${OUT}/44-barrel-after.png` });
  } else if (MODE === 'boss') {
    // 调试键 J：红点提示 → Boss 出现 → 屏幕上方血条
    await page.keyboard.press('KeyJ');
    await sleep(700);
    await page.screenshot({ path: `${OUT}/45-boss-telegraph.png` });
    await sleep(1600);
    await page.screenshot({ path: `${OUT}/46-boss.png` });
    await sleep(2600);
    await page.screenshot({ path: `${OUT}/47-boss-bar.png` });
  } else if (MODE === 'elitefx') {
    // H 立即生成弹幕精英 → K 秒杀，连拍黑白僵直 → 放大淡出 → 消散粒子
    await page.keyboard.press('KeyH');
    await sleep(600);
    await page.keyboard.press('KeyK');
    await sleep(80);
    await page.screenshot({ path: `${OUT}/48-elite-freeze.png` });
    await sleep(220);
    await page.screenshot({ path: `${OUT}/48b-elite-pop.png` });
    await sleep(300);
    await page.screenshot({ path: `${OUT}/48c-elite-fade.png` });
    await sleep(400);
    await page.screenshot({ path: `${OUT}/48d-elite-gone.png` });
  } else if (MODE === 'pause') {
    // 点击 HUD 暂停按钮 → 继续 → 再次暂停 → 结束游戏
    await page.mouse.click(1242, 40);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/11-pause.png` });

    await page.mouse.click(510, 328);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/12-resumed.png` });

    await page.mouse.click(1242, 40);
    await sleep(600);
    await page.mouse.click(510, 404);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/13-ended.png` });
  } else if (MODE === 'restart') {
    // 暂停 → 重新开始（同一角色）→ 再次暂停 → 退出游戏回主菜单
    await page.mouse.click(1242, 40);
    await sleep(600);
    await page.mouse.click(770, 328);
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/18-restarted.png` });

    await page.mouse.click(1242, 40);
    await sleep(600);
    await page.mouse.click(770, 404);
    await sleep(800);
    await page.screenshot({ path: `${OUT}/19-menu.png` });
  } else if (MODE === 'timer') {
    // 绕圈移动躲避 34s，验证倒计时到点自动结算并进入商店（不按调试跳过）
    const dirs = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
    const start = Date.now();
    let i = 0;
    let midShot = false;
    while (Date.now() < start + 34000) {
      const key = dirs[i % dirs.length];
      await page.keyboard.down(key);
      await sleep(1500);
      await page.keyboard.up(key);
      i++;
      // 升级弹窗出现会暂停倒计时，先处理再继续；同时抓一张波次后段画面
      await dismissLevelUp(page);
      if (!midShot && Date.now() - start >= 24000) {
        await page.screenshot({ path: `${OUT}/14-midwave.png` });
        midShot = true;
      }
    }
    await page.screenshot({ path: `${OUT}/14-after-timer.png` });
  } else if (MODE === 'full') {
    // 快速跑完 10 波：每波跳过→商店买卡→下一波，验证完整循环与胜利结算
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('8');
      await sleep(200);
      await page.keyboard.press('9');
      await sleep(2400);
      await page.mouse.click(190, 340);
      await sleep(300);
      await page.mouse.click(750, 442);
      await sleep(300);
      await page.keyboard.press('Enter');
      await sleep(700);
    }
    await page.keyboard.press('9');
    await sleep(2600);
    await page.screenshot({ path: `${OUT}/10-victory.png` });
  } else if (MODE === 'shop') {
    // 8 调试加 100 金，9 跳过当前波次 → 波次结算 → 进入商店
    await page.keyboard.press('8');
    await sleep(200);
    await page.keyboard.press('9');
    await sleep(3500);
    await page.screenshot({ path: `${OUT}/7-shop.png` });

    // 购买第一张卡（最左栏）：点击卡片 → 确认弹窗 → 确认购买
    await page.mouse.click(190, 340);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/7b-confirm.png` });

    await page.mouse.click(750, 442);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/8-shop-bought.png` });

    // Enter 开始下一波
    await page.keyboard.press('Enter');
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/9-next-wave.png` });
  } else if (MODE === 'nodup') {
    // 批量模拟商店刷新，验证同一批 4 个栏位不出现重复商品
    const res = await page.evaluate(async () => {
      const { ShopSystem } = await import('/src/systems/ShopSystem.ts');
      const shop = new ShopSystem();
      let dup = 0;
      let wrongSlots = 0;
      for (let i = 0; i < 1000; i++) {
        const offers = shop.rollOffers();
        const ids = offers.map((o) => o.id);
        if (new Set(ids).size !== ids.length) dup++;
        if (offers.length !== 4) wrongSlots++;
      }
      return { dup, wrongSlots };
    });
    console.log(`nodup: 1000 次刷新中重复 ${res.dup} 次，栏位数异常 ${res.wrongSlots} 次`);
    if (res.dup > 0 || res.wrongSlots > 0) errors.push('nodup: 商店出现重复商品或栏位数异常');
  } else if (MODE === 'reroll') {
    // 8 加金 ×3 → 9 结束波次 → 商店：每张卡买一次后应显示售罄且不可再购，刷新两次后恢复购买
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('8');
      await sleep(200);
    }
    await page.keyboard.press('9');
    await sleep(3500);

    for (const [x, y] of [
      [190, 340],
      [490, 340],
      [790, 340],
      [1090, 340]
    ]) {
      await page.mouse.click(x, y);
      await sleep(250);
      await page.mouse.click(750, 442);
      await sleep(250);
    }
    await page.screenshot({ path: `${OUT}/15-all-sold.png` });

    // 已售罄的卡片再次点击不应弹出确认框/扣款
    await page.mouse.click(190, 340);
    await sleep(250);
    await page.mouse.click(750, 442);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/15b-resold-blocked.png` });

    await page.mouse.click(840, 664);
    await sleep(400);
    await page.mouse.click(840, 664);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/16-rerolled.png` });

    await page.mouse.click(190, 340);
    await sleep(300);
    await page.mouse.click(750, 442);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/17-buy-after-reroll.png` });
  } else if (MODE === 'question') {
    // 两个小问号 → 9 结束波次：每持有一个问号各获得一次选择机会
    await page.keyboard.press('KeyQ');
    await sleep(150);
    await page.keyboard.press('KeyQ');
    await sleep(180);
    const goldBefore = await page.evaluate(() => window.__rabbit.RunData.gold);
    await page.keyboard.press('9');
    await sleep(2600);
    await page.screenshot({ path: `${OUT}/50-question-1of2.png` });

    // 第一个问号：接受（+20 金 / 下波 +30%）→ 立即弹出第二个问号
    await page.mouse.click(750, 498);
    await sleep(700);
    await page.screenshot({ path: `${OUT}/50b-question-2of2.png` });
    const afterAccept = await page.evaluate(() => {
      const { RunData } = window.__rabbit;
      return {
        gold: RunData.gold,
        marks: RunData.questionMarks,
        mult: RunData.nextWaveEnemyMult
      };
    });
    console.log(
      `question: 接受后 gold=${afterAccept.gold} marks=${afterAccept.marks} mult=${afterAccept.mult}`
    );
    if (
      afterAccept.marks !== 1 ||
      Math.abs(afterAccept.mult - 1.3) > 0.001 ||
      afterAccept.gold < goldBefore + 29
    ) {
      errors.push('question: 第一次接受后金币/问号/下一波倍率不符合预期');
    }

    // 第二个问号：拒绝 → 问号保留，进入商店
    await page.mouse.click(530, 498);
    await sleep(700);
    await page.screenshot({ path: `${OUT}/51-question-accepted-shop.png` });
    const accepted = await page.evaluate(() => {
      const { RunData } = window.__rabbit;
      return { marks: RunData.questionMarks, mult: RunData.nextWaveEnemyMult };
    });
    console.log(`question: 第二次拒绝后 marks=${accepted.marks} mult=${accepted.mult}`);
    if (accepted.marks !== 1 || Math.abs(accepted.mult - 1.3) > 0.001) {
      errors.push('question: 拒绝后问号应保留且倍率应保持 1.3');
    }

    // 开始下一波：倍率应被消费并重置
    await page.keyboard.press('Enter');
    await sleep(1500);
    const resetMult = await page.evaluate(() => window.__rabbit.RunData.nextWaveEnemyMult);
    if (Math.abs(resetMult - 1) > 0.001) {
      errors.push(`question: 下一波倍率未重置（${resetMult}）`);
    }

    // 再获得 1 个问号（保留 1 + 新 1 = 2）：结束波次后连续两次拒绝，问号全部保留
    await page.keyboard.press('KeyQ');
    await sleep(180);
    await page.keyboard.press('9');
    await sleep(2600);
    await page.mouse.click(530, 498);
    await sleep(700);
    await page.screenshot({ path: `${OUT}/50c-question-second-wave-1.png` });
    await page.mouse.click(530, 498);
    await sleep(700);
    const declined = await page.evaluate(() => {
      const { RunData } = window.__rabbit;
      return { marks: RunData.questionMarks, mult: RunData.nextWaveEnemyMult };
    });
    await page.screenshot({ path: `${OUT}/52-question-declined-shop.png` });
    console.log(`question: 两次拒绝后 marks=${declined.marks} mult=${declined.mult}`);
    if (declined.marks !== 2 || Math.abs(declined.mult - 1) > 0.001) {
      errors.push('question: 拒绝后所有小问号应保留且不应有下一波倍率');
    }
  } else if (MODE === 'levelup') {
    // 调试键 6 触发升级：+100 金 → 花 10 金刷新三选一 → 选第一项确认 → 继续游戏
    await page.keyboard.press('8');
    await sleep(200);
    await page.keyboard.press('6');
    await sleep(700);
    await page.screenshot({ path: `${OUT}/20-levelup.png` });

    const goldBefore = await page.evaluate(() => window.__rabbit.RunData.gold);
    await page.mouse.click(460, 608);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/20b-levelup-refreshed.png` });
    const goldAfter = await page.evaluate(() => window.__rabbit.RunData.gold);
    console.log(`levelup: 刷新金币 ${goldBefore} -> ${goldAfter}`);
    if (goldAfter !== goldBefore - 10) errors.push('levelup: 刷新未按 10 金扣费');

    await page.mouse.click(640, 242);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/20c-levelup-selected.png` });

    await page.mouse.click(820, 608);
    await sleep(900);
    await page.screenshot({ path: `${OUT}/21-levelup-done.png` });
    const level = await page.evaluate(() => window.__rabbit.RunData.level);
    if (level < 2) errors.push('levelup: 确认属性后等级未提升');
  } else if (MODE === 'damage') {
    // 普通伤害飘字 → 注入 100% 暴击后再截图，验证颜色与字号差异
    await sleep(5500);
    await page.screenshot({ path: `${OUT}/23-damage-normal.png` });

    // 调试键 C 开启 100% 暴击；暴击飘字存活约 0.8s，连拍几张确保命中
    await page.keyboard.press('C');
    for (let i = 0; i < 3; i++) {
      await sleep(i === 0 ? 1600 : 900);
      await page.screenshot({ path: `${OUT}/24-damage-crit-${i + 1}.png` });
    }
  } else if (MODE === 'prop') {
    // 开局苹果树 → 调试键 B 击碎全部 → 必掉金币与 1-2 个苹果
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/25-props.png` });

    await page.keyboard.press('B');
    await sleep(900);
    await page.screenshot({ path: `${OUT}/26-props-loot.png` });
  } else if (MODE === 'sound') {
    // 依次触发全部程序化音效，验证合成代码无异常
    const count = await page.evaluate(async () => {
      const { Sfx } = await import('/src/core/Sfx.ts');
      const methods = [
        'shoot', 'hit', 'kill', 'eliteKill', 'reload', 'skill', 'explosion',
        'coin', 'heal', 'question', 'hurt', 'defeat', 'victory', 'levelUp',
        'waveClear', 'waveStart', 'buy', 'ui', 'select'
      ];
      for (const m of methods) Sfx[m]();
      return methods.length;
    });
    console.log(`sound: 已触发 ${count} 种音效`);
    await sleep(800);
    await page.screenshot({ path: `${OUT}/22-sound.png` });
  } else if (MODE === 'effects') {
    // 注入全部特效饰品：1 穿透 / 2 击杀回血 / 3 弹丸+1 / 4 击杀爆炸 / 5 重型射击
    for (const key of ['1', '2', '3', '4', '5']) {
      await page.keyboard.press(key);
    }
    await sleep(9000);
    await page.screenshot({ path: `${OUT}/6-effects.png` });
  } else if (MODE === 'lock') {
    // 商店锁定：锁定第 1 栏 → 刷新保持不变 → 下一波再进店该商品仍固定在原栏位
    await page.keyboard.press('8');
    await sleep(200);
    await page.keyboard.press('8');
    await sleep(200);
    await page.keyboard.press('9');
    await sleep(3500);
    await page.screenshot({ path: `${OUT}/29-lock-shop.png` });

    // 第 1 栏左下角的锁定按钮
    await page.mouse.click(118, 433);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/29b-locked.png` });

    // 刷新：锁定栏保持不变，其余三栏重掷
    await page.mouse.click(840, 664);
    await sleep(500);
    await page.screenshot({ path: `${OUT}/29c-locked-reroll.png` });

    // 进入下一波并立即结算，再次进入商店
    await page.keyboard.press('Enter');
    await sleep(1200);
    await page.keyboard.press('9');
    await sleep(2600);
    await page.screenshot({ path: `${OUT}/29d-locked-next-shop.png` });

    // 购买锁定商品：应解除锁定、卡片售罄，左下角出现已购饰品
    await page.mouse.click(190, 340);
    await sleep(300);
    await page.mouse.click(750, 442);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/29e-locked-bought.png` });

    // 再进一次商店：原栏位应重新随机（不再锁定）
    await page.keyboard.press('Enter');
    await sleep(1200);
    await page.keyboard.press('9');
    await sleep(2600);
    await page.screenshot({ path: `${OUT}/29f-after-buy-shop.png` });
  } else if (MODE === 'map') {
    // 大地图验证：向左跑到地图边界（相机跟随、边界阻挡、地图外深色），再回到地图内部
    await sleep(600);
    await page.keyboard.down('KeyA');
    await sleep(9000);
    await page.keyboard.up('KeyA');
    await sleep(400);
    await page.screenshot({ path: `${OUT}/27-map-edge.png` });

    await page.keyboard.down('KeyD');
    await sleep(4500);
    await page.keyboard.up('KeyD');
    await sleep(400);
    await page.screenshot({ path: `${OUT}/28-map-inner.png` });
  } else if (MODE === 'death') {
    // 调试键 7 秒杀玩家（按两次绕过受击无敌）→ 结算 → 角色选择 → 重开
    await page.keyboard.press('7');
    await sleep(400);
    await page.keyboard.press('7');
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/4-gameover.png` });
    await page.keyboard.press('Enter');
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/5-character-after-death.png` });
    await page.keyboard.press('Enter');
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/5-restarted.png` });
  } else {
    await page.screenshot({ path: `${OUT}/2-game.png` });
    await page.keyboard.down('KeyD');
    await page.keyboard.down('KeyS');
    await sleep(1000);
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyS');
    await page.screenshot({ path: `${OUT}/3-moved.png` });

    // 等待几秒，让自动攻击击杀敌人、产生掉落
    await sleep(6000);
    await page.screenshot({ path: `${OUT}/4-hud.png` });

    // 向右移动靠近掉落物，验证磁吸拾取与金币增加
    await page.keyboard.down('KeyD');
    await sleep(1800);
    await page.keyboard.up('KeyD');
    await page.screenshot({ path: `${OUT}/5-collect.png` });
  }

  if (errors.length) {
    console.log('发现错误:');
    for (const e of errors) console.log(' -', e);
  } else {
    console.log('无运行时错误');
  }
} finally {
  await browser.close();
}
