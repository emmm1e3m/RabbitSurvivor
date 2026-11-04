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
  await page.mouse.click(640, 608);
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
  if (MODE !== 'restart') {
    await page.keyboard.press('ArrowLeft');
    await sleep(250);
  }
  await page.keyboard.press('Enter');
  await sleep(1200);

  if (MODE === 'shooter') {
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
  } else if (MODE === 'levelup') {
    // 调试键 6 直接加 50 经验触发升级：弹窗暂停 → 选第一项属性 → 确认 → 继续游戏
    await page.keyboard.press('6');
    await sleep(700);
    await page.screenshot({ path: `${OUT}/20-levelup.png` });

    await page.mouse.click(640, 242);
    await sleep(300);
    await page.screenshot({ path: `${OUT}/20b-levelup-selected.png` });

    await page.mouse.click(640, 608);
    await sleep(900);
    await page.screenshot({ path: `${OUT}/21-levelup-done.png` });
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
        'shoot', 'hit', 'kill', 'explosion', 'coin', 'heal', 'hurt',
        'defeat', 'victory', 'levelUp', 'waveClear', 'waveStart', 'buy', 'ui', 'select'
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
