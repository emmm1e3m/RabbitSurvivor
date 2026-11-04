# myrabbitgame

给小铲的幸存者游戏 —— Phaser 3.90 + TypeScript + Vite 制作的波次生存射击游戏。

## 运行方式

需要 Node.js 20.19+ 或 22.12+（Vite 8 要求）。

```bash
npm install       # 安装依赖
npm run dev       # 启动开发服务器（默认 5173 端口，HMR）
npm run build     # 类型检查（tsc --noEmit）+ 生产构建到 dist/
npm run preview   # 预览生产包（默认 4173 端口）
npx tsc --noEmit  # 仅做类型检查
```

打开终端提示的地址即可游玩。主菜单按 Enter 进入角色选择，← → 切换角色，↑ ↓ 切换难度，Enter 确认开局。

### 调试模式

在 URL 后加 `?debug` 启用调试快捷键（生产构建自动关闭），例如 `http://localhost:5173/?debug`。按键包括：

- `1-5` 注入特效饰品、`6` +50 经验、`7` 秒杀玩家、`8` +100 金币、`9` 立即结束本波
- `B` 击碎全部苹果树、`C` 100% 暴击、`G` 释放角色技能、`V` 生成突击怪、`H` 生成弹幕精英、`J` 生成 Boss、`N` 生成炸药桶、`U` 引爆全部炸药桶、`R` 进入装填、`K` 秒杀最近敌人、`Q` +1 小问号

调试模式下真实单例挂载在 `window.__rabbit = { game, RunData, MetaProgress }`，供无头脚本读写状态。

### 无头冒烟测试

项目无测试框架，运行时验证使用 puppeteer-core 驱动本机 Chrome/Edge（不下载浏览器），截图输出到 `.verify/`。需先启动开发服务器：

```bash
node scripts/verify.mjs              # 冒烟：菜单→开局→移动→击杀拾取
node scripts/verify.mjs full         # 快速跑完 10 波验证完整循环与胜利结算
node scripts/verify.mjs shop         # 波次结算→商店→购买→下一波
node scripts/verify.mjs levelup      # 升级弹窗→金币刷新→确认→继续
node scripts/verify.mjs question     # 小问号逐个接受/拒绝→商店
node scripts/verify.mjs charger      # 突击怪蓄力（黄）/冲刺（红）阶段
node scripts/verify.mjs activeskill  # 主动技能释放与 5 级强化
```

更多模式（`meta` / `boss` / `death` / `pause` / `restart` / `timer` / `boss` / `sound` / `map` / `lock` 等）见 `CLAUDE.md`。也可对生产包运行：

```bash
URL=http://localhost:4173/ node scripts/verify.mjs
```

## 架构说明

### 技术栈与渲染

- Phaser 3.90 + TypeScript + Vite，纯 Web，无后端。
- 视口 1280×720，地图默认为视口的 1.5 倍（1920×1080，角色可通过 `CharacterDef.mapScale` 覆盖）。相机不设边界、严格跟随玩家，玩家始终位于屏幕中心；移动通过地图滚动体现，玩家位置被 clamp 在地图内，边缘外露出深色底图。
- 全部美术为程序化图形：`BootScene` 用 `Graphics.generateTexture()` 生成纹理，无外部图片素材；唯一外部资源是 `public/audio/bgm.mp3`。音效用 Web Audio 实时合成（`src/core/Sfx.ts`），并带节流与音高随机化。

### 场景与数据流

```
Boot → Menu → CharacterSelect → Game（常驻）
                                   ├─ Shop / LevelUp / Question / Pause / GameOver（launch 覆盖层，Game 暂停）
                                   └─ Meta / Codex（从 Menu scene.start 进入）
```

- 覆盖层用 `scene.launch()` 启动，`Game` 用 `scene.pause()` 冻结后恢复；关闭时用 `scene.stop()` 并配合全局 `EventBus` 通知 GameScene 继续。
- `RunData`（`src/core/RunData.ts`）是跨场景状态中枢：角色/难度、金币、波次、等级/经验、武器等级、饰品购买次数、商店锁定、小问号、局外天赋运行时效果、击杀统计等。`startRun()` 重置整局进度并注入局外天赋加成。
- 跨场景事件走 `EventBus`（`src/core/EventBus.ts`），场景内敌人事件（`enemy-died` / `enemy-hit`）走 `scene.events`；全局监听在 scene SHUTDOWN 时手动解除。
- 局外存档 `MetaProgress`（`src/core/MetaProgress.ts`）单例持久化到 localStorage（`rabbit:meta:v1`），保存星尘、天赋等级、成就与图鉴发现记录。

### 战斗与实体

- **不使用 Arcade Physics**。碰撞全部是手写圆-圆距离检测，集中在 `src/systems/CollisionSystem.ts`（玩家子弹×敌人、敌方弹幕×玩家、敌人×玩家），敌人之间互相穿透。
- 对象池统一用 `Phaser.Group` + `classType`（`Enemy` / `Projectile` / `EnemyBullet` / `Pickup`），由 `GameScene.update` 手动逐实体调用 update。规模上升到数百敌人时可将子弹×敌人检测换成空间哈希，接口不变。
- `AttributeSystem`（`src/core/AttributeSystem.ts`）模型为 `(base + Σflat) × (1 + Σpercent)`；`Player` 持有 `RunData.attributes` 的同一引用，商店购买即时生效。
- `Weapon` 通过 getter 直接读取 `RunData.weaponLevel`；开火前在 `AttrKey.Range` 范围内锁定最近敌人，没有敌人则锁定苹果树；单发伤害流水线为 `基础伤害 × 武器等级缩放 × Damage 倍率 × 重型射击倍率`，暴击再 ×2。
- 每波由倒计时驱动：预生成队列（小怪 / 突击怪 / 精英 / 弹幕精英 / 最终波 Boss）耗尽后按固定间隔补怪，时间到回收场上剩余敌人与弹幕，发放奖励后处理小问号、进入商店或胜利结算。
- 敌人种类、数值与波次公式集中在 `src/data/balance.ts`；`Enemy` 通过可选的 `ranged` / `charge` 配置复用为远程怪或蓄力冲刺怪。

### 源码结构

```
src/
├─ main.ts                # Phaser.Game 配置与场景注册
├─ config.ts              # 视口、深度、颜色、常量
├─ types.ts               # 共享类型（EnemyKind、EffectId、MetaEffectId 等）
├─ core/                  # RunData、EventBus、AttributeSystem、Sfx、MetaProgress
├─ data/                  # 全部可调数据：balance、characters、skills、trinkets、
│                         # questions、metaTree、achievements、codex
├─ entities/              # Player、Enemy、Projectile、EnemyBullet、Pickup
├─ weapons/               # Weapon
├─ systems/               # CollisionSystem、WaveManager、DropSystem、ShopSystem
├─ scenes/                # Boot、Menu、CharacterSelect、Game、Shop、LevelUp、
│                         # Question、Pause、GameOver、Meta、Codex
└─ ui/                    # HUD、DamageNumbers、ShopUI
scripts/verify.mjs        # 无头冒烟脚本
```

### 数据驱动与扩展

所有数值集中在 `src/data/balance.ts`，改平衡只动这一个文件。常见扩展点：

- 新增敌人 = `types.ts` 的 `EnemyKind` + `balance.ts` 的 `ENEMY`/`DROP` + BootScene 纹理 + `WAVE` 公式；需要远程攻击时传入 `ranged` 配置。
- 新增角色 = `src/data/characters.ts` 加一条数据，BootScene 自动生成纹理、角色选择自动展示；技能在 `src/data/skills.ts` 登记，数值在 `balance.ts` 的 `SKILL` 块。
- 新增饰品 = `src/data/trinkets.ts`；特效饰品再加 `EffectId` 并在消费处读取。
- 新增问号选项 = 向 `src/data/questions.ts` 的 `QUESTION_CHOICES` 追加一条。
- 新增天赋 = `src/data/metaTree.ts`（纯属性用 `stat()`，运行时效果加 `MetaEffectId` + `runtime()` + 消费处）。
- 新增成就 / 图鉴条目 = `src/data/achievements.ts` / `src/data/codex.ts`。

扩展时的依赖约定：`src/entities`、`src/weapons`、`src/systems` 不依赖具体场景类，只接收 `Phaser.Scene`，由场景负责组装。

## 其他约定

- 代码注释与提交信息使用中文，标识符用英文；游戏内玩家可见文案为中文。
- 开发与验证命令的详细说明、调试键列表及架构细节见 `CLAUDE.md`。
