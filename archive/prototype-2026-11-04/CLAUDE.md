# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

```bash
npm run dev        # 启动开发服务器（5173 端口，HMR）
npm run build      # tsc --noEmit 类型检查 + vite build 生产构建
npm run preview    # 预览生产包（4173 端口）
npx tsc --noEmit   # 只做类型检查
```

无测试框架。运行时验证使用无头浏览器冒烟脚本（需先启动 dev server）：

```bash
node scripts/verify.mjs          # 冒烟：菜单→开局→移动→击杀拾取，截图到 .verify/
node scripts/verify.mjs shop     # 波次结算→商店→购买→下一波
node scripts/verify.mjs nodup    # 批量模拟商店刷新，验证同批 4 栏位无重复商品
node scripts/verify.mjs reroll   # 购买后售罄不可重复购买 + 刷新重掷 + 刷新后可再购
node scripts/verify.mjs full     # 快速跑完 10 波验证完整循环与胜利结算
node scripts/verify.mjs effects  # 注入全部特效饰品
node scripts/verify.mjs levelup  # 调试加经验→升级弹窗→金币刷新→确认→继续
node scripts/verify.mjs question # 两个小问号→结束波次→逐个接受/拒绝→商店
node scripts/verify.mjs pause    # HUD 暂停按钮→继续→再次暂停→结束游戏
node scripts/verify.mjs restart  # 暂停→重新开始（同一角色）→暂停→退出游戏回主菜单
node scripts/verify.mjs timer    # 绕圈移动 34s，验证倒计时到点自动结算并进商店
node scripts/verify.mjs death    # 调试键秒杀玩家→结算→角色选择→重开
node scripts/verify.mjs sound    # 依次触发全部程序化音效，验证合成代码无异常
node scripts/verify.mjs damage   # 普通伤害飘字→100% 暴击飘字连拍，验证颜色/字号差异
node scripts/verify.mjs hitfx    # 等待敌人靠近后连拍，验证命中碰撞点的碎裂粒子
node scripts/verify.mjs hitflash # 高血量小怪被命中时轮询纯白闪白，暂停画面截图验证
node scripts/verify.mjs prop     # 开局苹果树→调试键击碎→验证金币/1-2 苹果掉落与经验
node scripts/verify.mjs map      # 向左跑到地图边界→验证相机跟随/边界阻挡/地图外颜色
node scripts/verify.mjs lock     # 锁定商品→刷新不变→下一波固定出现→购买后解锁并显示已购列表
node scripts/verify.mjs shooter  # 难度选择（默认0→难度3）→开局→调试生成弹幕精英→弹幕连拍
node scripts/verify.mjs feedback # 调试击杀怪物看死亡残影→调试秒杀玩家看红屏/震动→结算
node scripts/verify.mjs skill    # 调试键释放环形技能：两圈各 8 发弹幕 + 轻微震屏
node scripts/verify.mjs charger  # 生成突击怪→观察蓄力（黄）→冲刺（红）阶段与染色
node scripts/verify.mjs activeskill # 游侠空格/按钮释放主动技能→升到 5 级技能 Lv2
node scripts/verify.mjs reload   # 调试键进入装填：蓄力条由空到满，1s 后消失恢复开火
node scripts/verify.mjs barrel   # 生成炸药桶→调试键引爆，验证范围伤害同时命中敌人与玩家
node scripts/verify.mjs boss     # Boss 红点提示→出现→屏幕上方 Boss 血条→扇形弹幕
node scripts/verify.mjs elitefx  # 生成弹幕精英→调试键秒杀，连拍黑白僵直→放大淡出→消散粒子
node scripts/verify.mjs meta     # 主菜单→天赋树购买→图鉴页签→注入天赋开局（燃烧/弹丸）→结算星尘与成就
URL=http://localhost:4173/ node scripts/verify.mjs   # 对生产包做冒烟
```

脚本自动查找本机 Chrome/Edge（puppeteer-core，不下载浏览器），截图输出到 `.verify/`（已在 .gitignore 中）。

## 调试模式

游戏 URL 加 `?debug` 启用调试快捷键（由 `src/config.ts` 的 `DEBUG` 控制，生产环境自动关闭）：

- `1-5`：分别注入 穿透 / 击杀回血 / 弹丸数+1 / 击杀爆炸 / 重型射击 特效饰品
- `6`：+50 经验（立即触发升级选属性流程）
- `7`：秒杀玩家（测试死亡/结算流程）
- `8`：+100 金币
- `9`：立即结束当前波次（倒计时清零，场上剩余敌人回收）
- `0`：清空全部特效
- `B`：击碎场上全部苹果树（测试掉落）
- `C`：100% 暴击（测试暴击伤害飘字）
- `G`：立即释放当前角色技能（无视冷却；突击者为环形弹幕）
- `V`：在玩家右侧生成一只突击怪（测试蓄力冲刺）
- `H`：在玩家右侧立即生成一只弹幕精英（跳过红点提示，测试远程弹幕）
- `J`：带红点提示在玩家右上方生成 Boss（测试 Boss 血条）
- `N`：在玩家右侧生成一只炸药桶
- `U`：引爆场上全部炸药桶
- `R`：立即进入装填（测试蓄力条）
- `K`：秒杀最近的真实敌人（跳过可破坏物，用于观察死亡残影/精英黑白死亡）
- `Q`：+1 小问号（测试波后问号事件）

`verify.mjs` 的 shop/full/damage/prop/shooter/feedback/skill/charger/activeskill/reload/barrel/boss/elitefx/question/levelup 模式依赖这些按键，均访问 `?debug`。

调试模式下 `main.ts` 会把真实单例挂到 `window.__rabbit = { game, RunData, MetaProgress }`，供 verify 脚本读写状态（不能自己 `import('/src/...')`，Vite dev 的 HMR 时间戳会让脚本拿到另一份模块实例）。

## 架构

Phaser 3.90 + TypeScript + Vite，纯 Web，1280×720 视口 + 默认为视口 1.5 倍的地图（1920×1080，`DEFAULT_MAP_SCALE` 见 `src/config.ts`；实际尺寸由 `RunData.mapWidth/mapHeight` 按当前角色的 `CharacterDef.mapScale` 计算，角色可配置更小的地图）。相机不设边界、严格跟随玩家（`startFollow(..., 1, 1)`），因此玩家始终位于视口正中心，移动通过地图滚动体现；玩家移动被 clamp 在地图内，相机可越过地图边缘，露出更深的 `COLORS.mapOutside` 底色，地图边缘有 `COLORS.mapBorder` 描边。HUD 所有元素 `scrollFactor(0)` 固定于屏幕。敌人生成锚定视口边缘外（以玩家位置为基准）并校验落在地图内，玩家贴近角落时兜底取对侧地图角落。程序化图形：无外部图片素材，所有纹理在 `BootScene` 中用 `Graphics.generateTexture()` 绘制生成；唯一外部资源是 BGM（`public/audio/bgm.mp3`）。

### 音频

`BootScene.preload()` 将 `public/audio/bgm.mp3` 加载为 `bgm`，`GameScene.create()` 首次创建时循环播放（音量 `BGM_VOLUME`，见 `src/config.ts`）。Phaser 声音管理器是全局的，跨场景（含暂停/商店）持续播放，重开时不会重复启动；浏览器自动播放限制由菜单按 Enter 的用户手势解锁。

音效（`src/core/Sfx.ts`）用 Web Audio 实时合成振荡器/噪声，无外部素材：首次调用时惰性创建 AudioContext，主音量 `SFX_VOLUME`。同名音效内置节流（射击 50ms、击杀 45ms、受伤 120ms 等），避免连射和群杀时爆音。命中/死亡为分层音效（低频正弦/三角波下扫 + 噪声），每次触发对振荡频率与噪声滤波做 ±3% 音高随机化，避免重复感；命中音效比视觉粒子提前 `FEEDBACK.sfxLeadMs`（40ms）播放，死亡残影动画同样延后 40ms，做到“声音略早于视觉”。接入点：开火/换弹（Weapon）、命中/击杀/精英击杀/爆炸（GameScene）、角色技能（GameScene.castSkill）、拾币/回血/小问号（Pickup）、受伤/死亡（Player）、升级弹窗（GameScene.openLevelUp）、商店购买与按钮（ShopUI）、波次开始/结算，以及菜单、角色选择、暂停、结算页面的点击。`node scripts/verify.mjs sound` 可一次性触发全部音效，验证合成代码无异常。

### 场景与数据流

`Boot → Menu → CharacterSelect → Game`（常驻），`Shop` / `LevelUp` / `Question` / `Pause` / `GameOver` 以 `scene.launch()` 覆盖层运行，`Game` 用 `scene.pause()` 冻结后恢复；`Meta` / `Codex` 从 Menu 直接 `scene.start()` 进入。

- **主菜单**：显示星尘 / 已完成局数 / 最佳波次；Enter 进入角色选择，`T` 打开天赋树（`MetaScene`），`C` 打开图鉴/成就（`CodexScene`），或点击对应按钮。
- **角色选择**：Menu 或 GameOver 按 Enter 进入 `CharacterSelect`，← → / A D 切换角色，↑ ↓ / W S 或点击切换难度（0-3，默认 0），Enter 确认后 `RunData.startRun(角色, 难度)` 开始新一局；卡片展示角色基础属性与技能名称/释放方式；初始选中上次使用的角色与难度；ESC 返回主菜单。
- **暂停**：HUD 右上角按钮或 ESC/P 打开 `PauseScene`：继续游戏 / 重新开始（同一角色重开）/ 结束游戏（失败结算）/ 退出游戏（回主菜单）。结束游戏会停止 GameScene 并进入结算（`victory: false`）。
- **结算**：`GameOverScene` 首次创建时调用 `MetaProgress.recordRun()`（`RunData.metaRecorded` 保证每局只记一次），换算星尘奖励、评测成就并显示「获得星尘 +N · 当前 M」与「成就解锁：…」；Enter 进入角色选择，ESC 回主菜单。

- **波次**：由倒计时驱动（`WAVE.duration(n)`，当前统一 30s），时间到即回收场上剩余敌人与弹幕（不计击杀/掉落）→ 发奖励 → 横幅 → 若持有小问号则每个问号各弹一次 `QuestionScene`（逐个接受/拒绝）→ 商店或胜利结算；击杀不再结束波次。预生成队列（小怪 + 突击怪 + 精英 + 弹幕精英；最终波 `WAVE.bossCount(n)` 在队列头部固定放入 1 只 Boss）耗尽后，按 `WAVE.refillInterval`（1.5s）持续补充小怪直至倒计时结束，避免波次末尾长时间无怪又不会堆怪。敌人生成点以玩家为基准、落在视野外 40px（`WAVE.spawnMargin`），并限制在地图边界内；玩家贴近地图角落时自动换边重试。
- **精英/Boss 出生提示**：精英（brute/shooter/boss）先出现在视口内靠近边缘的位置（距玩家至少 `ELITE.minPlayerDist`），显示较大红点 + 脉冲扩散圆环，1s（Boss 1.4s）后才真正生成；波次结束或重开时未到时的提示会被清除（不计入存活数）。
- **难度**：`CharacterSelectScene` 选择 0-3 档，`RunData.difficulty/difficultyDef` 保存并在生成敌人时读取 `DIFFICULTIES`（`src/data/balance.ts`）倍率：`enemyDamage` 作用于接触伤害与弹幕伤害，`bossHp` 作用于弹幕精英血量，`enemyHp`/`enemyCount` 已在生成流程与 `WaveManager` 数量缩放入口接好，当前为 1（改配置即可生效）。
- **RunData 单例**（`src/core/RunData.ts`）是跨场景状态中枢：当前角色与难度、金币、波次、等级/经验、武器等级、饰品购买次数、特效计数器、商店锁定栏位（`shopLocks`）、待回复血量、持有小问号数量（`questionMarks`）、下一波敌人数量倍率（`nextWaveEnemyMult`）、局外天赋运行时效果（`metaEffects`）、Boss 是否被击杀（`bossKilled`）、本局是否已结算（`metaRecorded`）、击杀统计（`kills` 总数 + `normalKills`/`eliteKills` 分开计数）；`startRun(character, difficulty?)` 以指定角色重置整局进度（含商店锁定与小问号），并按 `collectMetaBonuses(character.id, MetaProgress.ranks)` 把天赋加成注入属性系统与 `metaEffects`，不传难度时沿用当前难度（暂停重开）。
- **角色**：`src/data/characters.ts` 定义 3 个角色（基础属性差异 + 纹理颜色），每个角色的技能在 `src/data/skills.ts` 的 `CHARACTER_SKILLS` 中登记；BootScene 按角色生成 `player-<id>` 纹理；GameScene 用 `RunData.character` 选择纹理与技能。
- **Player 持有 `RunData.attributes` 的同一引用**，商店购买属性修饰器即时生效，无序列化。
- **Weapon 通过 getter 直接读 `RunData.weaponLevel`**，武器升级卡买完即生效。
- 跨场景事件走全局 `EventBus`（`src/core/EventBus.ts`）：`player-died`、`shop-closed` 等；场景内的敌人事件（`enemy-died`/`enemy-hit`）用 `scene.events`。全局 EventBus 监听必须在 scene SHUTDOWN 时手动 off（见 GameScene.create 末尾）。

### 不使用 Arcade Physics

碰撞是手写圆-圆距离检测，集中在 `src/systems/CollisionSystem.ts`（玩家子弹×敌人、敌方弹幕×玩家、敌人×玩家）。敌人之间互相穿透。对象池全部用 `Phaser.Group` + `classType`（Enemy/Projectile/EnemyBullet/Pickup），由 `GameScene.update` 手动逐实体调用 update。规模上到 500+ 敌人时应将子弹×敌人检测换成空间哈希，接口不变。

### 伤害与属性

- `AttributeSystem` 模型：`(base + Σflat) × (1 + Σpercent)`，CritChance/Dodge 有上限。新增属性 = 枚举 + base 表 + getter。
- 武器射程是玩家属性 `AttrKey.Range`（基础 300，可被「瞄准镜」饰品成长）：`Weapon.findTarget` 只锁定范围内最近的敌人，范围内无敌人不开火；子弹存活距离同样按该属性计算。
- 单发伤害流水线（`Weapon.fire`）：`基础伤害 × 武器等级缩放 × Damage属性倍率 × 重型射击倍率`，暴击再 ×2。击杀爆炸伤害以 `Weapon.getBaseHitDamage()` 为基准。
- 伤害飘字：`Enemy.takeDamage(amount, isCrit)` 通过 `ENEMY_HIT_EVENT` 携带数值、暴击标记与敌人种类，`GameScene.onEnemyHit` 交给 `DamageNumbers`（`src/ui/DamageNumbers.ts`，池化 64 个文本）。普通为白色斜体 Impact 字，暴击为金色、字号更大、粗描边 + 橙色阴影，并带弹跳上升淡出动画。
- 命中碎裂：同一点迸射按敌人主体色染色的碎片粒子（`shard` 纹理，随机角度/旋转、缩小淡出）叠加少量黄色火花，直观表现子弹命中碰撞点。
- 玩家受伤：闪避判定 → 护甲减伤 `raw × 15/(15+armor)` → 0.3s 受击无敌。

### 武器、技能与换弹

- **弹匣与装填**：`Weapon` 累计发射 `WEAPON.magazineSize`（15）发后进入装填（多弹丸饰品按实际发射数计数），`WEAPON.reloadTime`（1s）内停火；装填完成清空弹药并重置冷却立即恢复开火。装填期间 HUD 在玩家头顶显示蓄力条（`weapon.reloadProgress`，0-1），并播放两段装弹音效。
- **角色技能**：`src/data/skills.ts` 的 `CHARACTER_SKILLS` 按角色 id 定义技能（名称 / 描述 / 是否主动），数值在 `balance.ts` 的 `SKILL` 块（每个技能各有基础值与 5 级强化值两组参数）。GameScene 开局读取 `skillDef`；HUD 右下角技能面板显示名称、释放方式（「空格 / 点击释放」或「自动释放」）、剩余冷却与进度条（面板按钮 `scrollFactor(0)` 需设在子对象上，否则 container 内的点击判定会随相机偏移）。主动技能由空格或点击面板触发（`tryActiveSkill`，冷却中/暂停/结算时忽略）。
  - 突击者「弹幕环」（被动）：每 `SKILL.barrage.interval`（5s）自动释放，以玩家为中心两圈各 8 发弹幕（速度 380/500），伤害取 `weapon.getBaseHitDamage() × damageMult`，存活距离按 `range`；释放时轻微震屏并播放技能音效。
  - 游侠「穿云箭」（主动）：向最近敌人射出高伤穿透箭（冷却 6s，3 倍基础伤害、穿透 99、700 射程）。
  - 重装「震地冲击」（主动）：以自身为中心 180 半径造成 2 倍基础伤害并震屏（冷却 8s）。
  - **5 级强化**：局内等级达到 `SKILL.upgradeLevel`（5）后技能自动升级（弹幕环 4s / 12 发，穿云箭 4.5s / 4 倍 / 2 发，震地冲击 6s / 240 半径 / 3 倍），面板名称显示 `Lv2`；升级时等属性选择弹窗关闭后横幅提示「技能升级！…」。调试键 `G` 立即释放（无视冷却）。

### 受击与死亡反馈

- 玩家受伤：`Player.takeDamage` 扣血后 emit `PLAYER_HURT_EVENT`，`GameScene.onPlayerHurt` 触发相机震动与屏幕边缘红色渐隐。`hurt-vignette` 纹理由 BootScene 用 Canvas 四边线性渐变生成（`textures.createCanvas`），以 `scrollFactor(0)` 固定于屏幕，tween 保持后淡出；连续受击会重置淡出动画。
- 敌人受击闪白：`Enemy.takeDamage` 对非静默伤害调用 `setTintFill(0xffffff)` 将精灵整体填充为纯白，小怪/可破坏物持续 `FEEDBACK.hitFlashDuration`（0.14s），精英与 Boss 用 `FEEDBACK.hitFlashEliteDuration`（0.08s，避免长时间盖住燃烧/蓄力染色）；闪白结束由 `refreshTint` 恢复状态染色。
- 敌人死亡：`GameScene.spawnDeathGhost` 用死亡敌人的纹理生成临时残影精灵。小怪先放大变透明、再上漂淡出（动画起始延后 `FEEDBACK.sfxLeadMs`，与音效错位）；精英（brute/shooter/boss）改用灰度纹理（`BootScene.makeGray` 按像素去饱和生成 `<key>-gray`），先黑白僵直 `FEEDBACK.eliteFreezeDuration`（240ms），再放大到 `FEEDBACK.elitePopScale` 并淡出，同时迸射灰色碎片粒子；苹果树/炸药桶不产生残影。
- 击杀统计：小怪与精英分开累计（`RunData.normalKills` / `eliteKills`，Boss 计入精英），HUD、暂停页与结算页均分开展示。
- 震动强度、红屏透明度/时长、残影缩放/上漂距离等参数集中在 `FEEDBACK`（`src/data/balance.ts`）。

### 等级与经验

- 击杀敌人直接获得经验（`ENEMY[kind].xp`：小怪 4 / 突击怪 6 / 精英 12 / 弹幕精英 18 / Boss 100；苹果树 8 / 炸药桶 4），经验满 `LEVEL.xpToNext`（固定 50，`src/data/balance.ts`）即升级，溢出经验保留；每击杀必掉金币（小怪 2 / 突击怪 3 / 精英 5 / 弹幕精英 12 / Boss 120；苹果树 5 / 炸药桶 3），回血掉落为独立概率判定。波次结束奖励仅 `WAVE.reward(n)`（`8 + n`）金币，经济主要来自击杀掉落。
- 升级时 GameScene 启动 `LevelUpScene` 覆盖层并 `scene.pause()`：从 `STAT_TRINKETS` 中随机抽 3 种不重复属性供三选一，每张卡独立掷品质（`LEVEL.rarities`：一般 50% / 优秀 30% / 传奇 20%，数值倍率 1 / 1.2 / 1.5）；玩家点选一项后「确认属性」按品质缩放后的数值应用修饰器、`pendingHeal` 结算生命类提升，然后 `level-up-closed` 事件通知 GameScene 恢复。弹窗底部「刷新属性」按钮（键盘 R 同效）可花金币重抽三张卡，费用按本次弹窗内已刷新次数递增（`LEVEL.refreshCost`：10 / 15 / 20 …，选中确认后重置）；金币不足时按钮显示所需金额且不扣费。一次连升多级在同一页面连续选择，每次都重新抽 3 项（`RunData.pendingLevelUps`）。
- HUD（`src/ui/HUD.ts`）：左上 HP 条下方显示经验条与 `Lv.x · 经验 x/50`，再下方一行显示 `小怪 x · 精英 y · 小问号 z` 统计；屏幕顶部居中的 Boss 血条（Boss 存活时）；玩家头顶的装填蓄力条；右下角角色技能面板。均为 `scrollFactor(0)` 固定元素。

### 敌人与敌方弹幕

- 普通小怪 `chaser`（第 1 波起）、突击怪 `charger`（第 2 波起，`WAVE.chargerCount(n) = max(1, round(0.7n))` 只；`WAVE.chargerHp`）、精英 `brute`（第 3 波起）、弹幕精英 `shooter`（第 4 波起，第 9 波起每波 2 只；`WAVE.shooterCount/shooterHp`）、Boss（仅最终波 1 只；`WAVE.bossCount/bossHp`）。
- 突击怪 AI（`Enemy` 内状态机，`EnemyConfig.charge`）：距玩家 300px（`chargeRange`）内且冷却就绪后原地蓄力 0.55s（染黄 `CHARGE_WINDUP_TINT`），结束时锁定玩家方向以 430px/s 冲刺 0.35s（染红 `CHARGE_DASH_TINT`），随后进入 2.8s 冷却并继续接近；冲刺位置 clamp 在地图边界内。受击闪白期间不覆盖蓄力/冲刺染色，闪白结束由 `refreshTint` 恢复。
- 弹幕精英与 Boss 的血量走难度 `bossHp` 倍率，接触伤害与弹幕伤害走 `enemyDamage` 倍率。弹幕精英在距玩家 340px（`ENEMY.shooter.shootRange`）内停下，每 2.2s 通过 `ENEMY_SHOOT_EVENT` 请求开火，`GameScene.onEnemyShoot` 生成 3 发扇形弹幕（`EnemyBullet` 对象池，独立于玩家子弹）。
- Boss 在距玩家 380px 内停下，每 1.8s 发射 5 发扇形弹幕（`ENEMY.boss`），存活时 HUD 顶部居中显示 Boss 血条；击杀计入精英统计，掉落 80 金 + 3-5 个苹果（`DROP.boss`）。
- 敌方弹幕由 `CollisionSystem.enemyBulletsVsPlayer` 检测命中玩家（命中即回收），波次结束/切场景时与敌人一起回收；`Enemy` 实体通过可选 `ranged` 配置（射程/间隔/弹速/伤害/连发数/散布）复用为任意远程怪。
- 弹幕精英掉落 8 金，30% 掉 1-2 个苹果（`DROP.shooter`）。

### 可破坏物（苹果树与炸药桶）

苹果树复用 `Enemy` 实体与敌人对象池（`EnemyKind` 增加 `'tree'`，纹理由 BootScene 在 `makeProps()` 中生成）：速度为 0、接触伤害为 0，`CollisionSystem` 跳过无伤害对象的玩家碰撞，因此苹果树不移动也不伤人。每波开始时 `GameScene.spawnProps(wave)` 围绕玩家生成（首棵固定在 200-320px 的视野内，其余散布在 1100px 内供探索；避开玩家与彼此，数量随波次增长，参数见 `PROP`），并 clamp 在地图边界内。武器优先锁定敌人，射程内没有敌人时才把苹果树作为目标；受击有伤害飘字。击碎后不计入击杀、不触发击杀回血/爆炸，立即获得 `ENEMY.tree.xp` 经验，并必掉金币与 1-2 个苹果（`DROP.tree`，多苹果围绕掉落点散开）。波次结束时未击碎的苹果树随场上敌人一起回收。回血拾取物 `heal` 纹理即苹果。

炸药桶同样复用 `Enemy`（`EnemyKind` 增加 `'barrel'`），每波按 `PROP.barrelCount` 随苹果树一起放置（首波 1 个，数量随波次增长，上限 4）。被击碎时爆炸：`BARREL.explosionRadius`（120）内的所有敌人受到 `BARREL.explosionDamage`（40，含其他炸药桶 → 连锁引爆），玩家在同样半径内受到 `BARREL.playerDamage`（20，仍走闪避/护甲）；伴随震屏、橙色扩散环与碎片粒子。炸药桶不计击杀、不触发击杀回血/爆炸，但给经验与金币掉落。波次结束时未引爆的炸药桶随场上敌人一起回收。

### 小问号事件

- **掉落**：击碎苹果树（10%）、击杀精英（brute 20% / shooter 30%）时按 `QUESTION.dropChance` 的概率掉落 `question` 拾取物；Boss 只在最终波出现、没有下一波可影响，因此不掉落。拾取后 `RunData.questionMarks++`，HUD 击杀统计行显示持有数量。
- **波后触发**：每波结算横幅结束后、进入商店前，若 `questionMarks > 0` 则启动 `QuestionScene` 覆盖层，每持有 1 个小问号各获得一次选择机会（逐个展示，标题显示「问号事件 n/total」；最终波不触发）。GameScene 记录本波 `questionOffersTotal/Done`，每次关闭后若还有问号则重新 launch 下一个，全部处理完再进商店；未进波次流程的场上小问号会保留。`QuestionScene.finish()` 先 `scene.stop()` 再发 `QuestionClosed`，避免同一帧内重新 launch 的 start 被排在 stop 之前取消。
- **接受/拒绝**：接受消耗 1 个小问号并执行选项效果；拒绝不消耗。每个问号每波只展示一次，未消耗的保留到后续波次（下一波仍会再次获得选择机会）。
- **选项池**：`src/data/questions.ts` 的 `QUESTION_CHOICES` 数组，每波随机抽取一条展示。当前仅「危险悬赏」：下一波敌人数量 ×1.3（作用于 `WaveManager` 本波预生成队列，`RunData.nextWaveEnemyMult` 在开波时消费并重置），同时立即 +20 金币。数值在 `balance.ts` 的 `QUESTION` 配置块。

### 局外成长（天赋树 / 成就 / 图鉴）

- **存档**：`src/core/MetaProgress.ts` 单例，localStorage 键 `rabbit:meta:v1`（星尘、各天赋等级、已解锁成就、图鉴发现记录、累计统计）。读取失败或字段损坏时回退默认值；`META.startingStardust`（`balance.ts`）是新存档初始星尘。
- **天赋树**：`src/data/metaTree.ts`。`SHARED_TREE` 全角色共享（生命 / 伤害 / 移速 / 护甲 / 弹丸数 / 射程 / 拾取范围），三个角色各有专属树（`ASSAULT_TREE` 攻速/穿透/暴击，`RANGER_TREE` 暴击/燃烧/移速/射程，`TANK_TREE` 生命/护甲/回复/吸血）。节点字段：`tier`/`slot` 决定布局，`maxRank`、`cost`、`requires` 前置，`effect` 分两类——`stat()` 生成 AttributeSystem 修饰器（`startRun` 时按等级批量注入），`runtime()` 生成 `MetaEffectId` 运行时效果（写入 `RunData.metaEffects`）。
- **运行时天赋效果**：`MetaEffectId`（`types.ts`）当前含 `ExtraProjectile`（与饰品弹丸数叠加）、`Pierce`（与饰品穿透叠加）、`Burn`（命中后按 `META.burnDamageRatio × 武器基础伤害 × 层数` 施加持续伤害，`META.burnDuration/burnTick` 控制时长与跳伤间隔，燃烧跳伤为静默伤害不刷飘字）、`Lifesteal`（击杀回血与饰品叠加）。消费点：`Weapon.fire`（弹丸/穿透/燃烧弹配置）、`CollisionSystem`（命中时 `enemy.applyBurn`）、`Enemy.update`（燃烧跳伤与橙色染色）。
- **MetaScene**：Menu 按 T / 点击「天赋树」进入；顶部页签切换共享与角色树（← → / A D），卡片显示等级、费用与前置（未满足显示「需先解锁：…」），点击购买；ESC 返回主菜单。
- **成就**：`src/data/achievements.ts` 定义 8 个成就（首局、累计击杀、精英击杀、波次、Boss、通关、单局金币、单局饰品数），`recordRun` 在结算时用累计统计评测并即时发放星尘奖励，已解锁成就不会重复发放。
- **图鉴**：`src/data/codex.ts` 定义敌人条目；角色/敌人/饰品/成就四个页签。敌人在生成时（含苹果树/炸药桶）标记发现，饰品在商店掷出或升级选项出现时标记发现（key 为 `stat:<id>` / `effect:<id>`），未发现显示 `???`。全部记录随存档持久化。

### 特效饰品

`RunData.effects` 是 `EffectId → 堆叠层数` 的计数器，武器/碰撞/击杀流程在运行时读取，不注册事件监听：

- 穿透/弹丸数/重型射击 → `Weapon` 开火时读取
- 击杀回血/击杀爆炸 → `GameScene.handleEnemyDeath` 读取（爆炸可连锁击杀）

重型射击上限 1 层（`EFFECTS.heavyMaxStacks`）。

### 商店

`ShopSystem.rollOffers()` 按权重（60% 数值饰品 / 25% 特效饰品 / 15% 武器升级）生成 4 张横向排列的不重复卡（含武器升级卡，同批最多一张；刷新后重新允许）；池子耗尽或已满级时降级为数值饰品。购买直接改写 RunData 并 emit 事件，`ShopUI` 只负责渲染与置灰。

- **购买确认**：点击卡片先弹出确认框（名称/描述/价格，取消 / 确认购买），确认后才扣款生效；点击空白处或「取消」关闭弹窗。
- **限购**：每张卡本次进店只能购买一次，购买后置灰显示「售罄」；刷新后重新生成的一批可再次购买（相同商品也会叠加层数），价格固定不变（武器升级 `40 × 当前等级`）。特效饰品达到 `maxStacks` 后不再进入随机池。
- **锁定**：每张卡左下角有「锁定」按钮，点击切换为「已锁定」（金色描边）。锁定状态存于 `RunData.shopLocks[index]`，本次进店的刷新以及后续每一波进店都会让该栏位固定出现此商品（未锁定栏位正常重新掷骰，且不会与锁定商品重复）；购买锁定商品或再次点击锁定按钮会解除锁定。重开一局时锁定清空。
- **刷新**：花费金币重掷未锁定的栏位，价格按本次进店已刷新次数递增（1 / 2 / 5 / 10 / 15…，`SHOP.rerollCost`，每波进店重置）；全部栏位已锁定时刷新不扣费也不生效。
- **已购饰品**：左下角面板按 `RunData.trinketCounts` 展示本局已购买的全部数值/特效饰品及堆叠层数（不含武器升级），购买后即时刷新。

生命上限饰品购买（或升级加点选生命）后写入 `RunData.pendingHeal`，由 GameScene 在 `onShopClosed` / `onLevelUpClosed` 时结算回复。

## 调参与内容扩展

- **所有数值集中在 `src/data/balance.ts`**（玩家基础属性、武器、技能、敌人、难度、波次公式、精英出生提示、可破坏物、炸药桶、掉落、小问号、商店权重、特效参数、局外成长、受击/死亡反馈）。改平衡只动这个文件。其中 `SKILL`（角色技能：升级等级 + 每个技能的冷却/间隔、弹数、伤害倍率、射程、震屏，均含 5 级强化值）、`ELITE`（红点提示时长/半径/生成位置）、`BARREL`（爆炸半径/伤害/震屏）、`QUESTION`（掉落概率/悬赏金币/下一波数量倍率）、`META`（初始星尘/结算星尘公式/燃烧参数）、`FEEDBACK`（震屏/红屏/受击闪白/残影/音画提前量）各为独立配置块。
- 难度在 `DIFFICULTIES` 数组：新增档位 = 加一条数据（`level` / `enemyDamage` / `enemyHp` / `enemyCount` / `bossHp`），CharacterSelect 自动生成选项；`enemyHp`/`enemyCount` 的消费入口已接好，调高即生效。
- 饰品池在 `src/data/trinkets.ts`；新增数值饰品 = 加一条数据（attr 指向 AttributeSystem 的 key）；新增特效饰品 = 加 EffectId + 数据条目 + 消费处读取。
- 小问号选项池在 `src/data/questions.ts`：新增一种波后选择 = 向 `QUESTION_CHOICES` 追加一条（id / 名称 / 描述 / `apply`），UI 与接受/拒绝流程自动复用；效果数值放 `balance.ts` 的 `QUESTION` 块。
- 角色技能在 `src/data/skills.ts` 的 `CHARACTER_SKILLS`：新增技能 = 扩展 `SkillId` + 为角色登记一条定义 + 在 `balance.ts` 的 `SKILL` 加配置块 + `GameScene.castSkill` 增加释放分支（HUD 面板与 5 级强化自动复用）。
- 局外天赋在 `src/data/metaTree.ts`：新增纯属性节点 = 加一条 `stat()` 数据；新增运行时效果 = 加 `MetaEffectId` + `runtime()` 数据条目 + 对应消费处读取加成。新角色自带专属树也只需在 `META_TREES` 中注册，`MetaScene` 页签自动生成。
- 成就池在 `src/data/achievements.ts`：新增成就 = 加一条数据（id / 名称 / 描述 / 星尘 / `check(stats, result)`）；图鉴敌人条目在 `src/data/codex.ts`，新增可发现敌人时补一条即可。
- 角色池在 `src/data/characters.ts`：新增角色 = 加一条数据（id / 名称 / 描述 / 颜色 / 基础属性），BootScene 会自动生成对应 `player-<id>` 纹理，CharacterSelect 自动展示。可选 `mapScale`（相对视口的倍数）覆盖默认地图尺寸，例如 `mapScale: 1.2` 得到更紧凑的地图；不填则用 `DEFAULT_MAP_SCALE`（1.5）。
- 新增敌人 = `types.ts` 的 `EnemyKind` + `balance.ts` 的 `ENEMY`/`DROP` + BootScene 纹理 + `WAVE` 数量/血量公式；需要远程攻击时在生成配置里传 `ranged`（射程/间隔/弹速/伤害/连发数/散布），会复用 `EnemyBullet` 与 `ENEMY_SHOOT_EVENT` 通道。
- 波次奖励公式 `8 + n` 仅作补充，金币主要来自击杀掉落（小怪 2 / 突击怪 3 / 精英 5 / 弹幕精英 12 / Boss 120）与苹果树/炸药桶。
- 波次时长接口 `WAVE.duration(n)`（秒）在 `balance.ts`，当前统一 30s；后续要按波次递增或做 Boss 波特殊时长，只需改这个函数。
- 未来扩展角色/多武器时：`Weapon` 是具体类而非继承树，改为按 `data/weapons.ts` 配置实例化即可。

## 其他约定

- 代码注释使用中文，标识符用英文。
- 游戏内玩家可见文案为中文。
- `src/entities`、`src/weapons`、`src/systems` 不依赖具体场景类，只接收 `Phaser.Scene`；场景负责组装。
