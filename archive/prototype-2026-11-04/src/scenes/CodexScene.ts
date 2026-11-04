import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { AttrKey } from '../core/AttributeSystem';
import { MetaProgress } from '../core/MetaProgress';
import { Sfx } from '../core/Sfx';
import { CHARACTERS, CharacterDef } from '../data/characters';
import { CODEX_ENEMIES } from '../data/codex';
import { ACHIEVEMENTS } from '../data/achievements';
import { EFFECT_TRINKETS, STAT_TRINKETS } from '../data/trinkets';

const TABS = ['角色', '敌人', '饰品', '成就'] as const;
const PANEL_FILL = 0x232638;
const STROKE = 0x3a3f5c;
const GOLD = 0xffd23f;
const ACCENT = 0x4dd0e1;

/** 图鉴与成就：角色 / 敌人 / 饰品按发现记录解锁，成就按累计统计展示 */
export class CodexScene extends Phaser.Scene {
  private tabIndex = 0;
  private tabs: Array<{ bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = [];
  private contentLayer!: Phaser.GameObjects.Container;
  private subtitle!: Phaser.GameObjects.Text;
  private stardustText!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.Codex);
  }

  create(): void {
    this.tabIndex = 0;
    this.tabs = [];

    this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'bg-grid')
      .setDepth(0);

    this.add
      .text(GAME_WIDTH / 2, 44, '图鉴 / 成就', {
        fontSize: '40px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    this.stardustText = this.add
      .text(GAME_WIDTH - 60, 44, '', { fontSize: '24px', color: COLORS.gold })
      .setOrigin(1, 0.5);

    this.createTabs();
    this.subtitle = this.add
      .text(GAME_WIDTH / 2, 142, '', { fontSize: '16px', color: COLORS.textDim })
      .setOrigin(0.5);
    this.contentLayer = this.add.container(0, 0);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 30,
        '← → / A D 切换页签 · ESC 返回主菜单',
        { fontSize: '16px', color: COLORS.textDim }
      )
      .setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-LEFT', () => this.switchTab(-1));
    keyboard.on('keydown-RIGHT', () => this.switchTab(1));
    keyboard.on('keydown-A', () => this.switchTab(-1));
    keyboard.on('keydown-D', () => this.switchTab(1));
    keyboard.on('keydown-ESC', () => {
      Sfx.ui();
      this.scene.start(SCENE_KEYS.Menu);
    });

    this.refresh();
  }

  private createTabs(): void {
    const cx = GAME_WIDTH / 2;
    TABS.forEach((label, i) => {
      const x = cx + (i - (TABS.length - 1) / 2) * 150;
      const bg = this.add
        .rectangle(x, 96, 138, 40, 0x1a1c26)
        .setStrokeStyle(2, STROKE)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, 96, label, { fontSize: '18px', color: COLORS.textDim })
        .setOrigin(0.5);

      bg.on('pointerover', () => {
        if (this.tabIndex !== i) bg.setFillStyle(0x2e3350);
      });
      bg.on('pointerout', () => this.refreshTabs());
      bg.on('pointerdown', () => {
        if (this.tabIndex === i) return;
        this.tabIndex = i;
        Sfx.select();
        this.refresh();
      });

      this.tabs.push({ bg, text });
    });
  }

  private switchTab(dir: number): void {
    this.tabIndex = (this.tabIndex + dir + TABS.length) % TABS.length;
    Sfx.select();
    this.refresh();
  }

  private refresh(): void {
    this.refreshTabs();
    this.stardustText.setText(`星尘 ${MetaProgress.stardust}`);
    this.contentLayer.removeAll(true);

    if (this.tabIndex === 0) this.renderCharacters();
    else if (this.tabIndex === 1) this.renderEnemies();
    else if (this.tabIndex === 2) this.renderTrinkets();
    else this.renderAchievements();
  }

  private refreshTabs(): void {
    this.tabs.forEach((tab, i) => {
      const active = i === this.tabIndex;
      tab.bg.setFillStyle(active ? 0x2e3350 : 0x1a1c26);
      tab.bg.setStrokeStyle(active ? 3 : 2, active ? GOLD : STROKE);
      tab.text.setColor(active ? COLORS.textLight : COLORS.textDim);
    });
  }

  private renderCharacters(): void {
    this.subtitle.setText('每个角色拥有独立的基础属性与专属天赋树');
    const cx = GAME_WIDTH / 2;

    CHARACTERS.forEach((character, i) => {
      const x = cx + (i - 1) * 360;
      const y = 400;
      const bg = this.add.rectangle(x, y, 300, 390, PANEL_FILL).setStrokeStyle(2, STROKE);
      const portrait = this.add.image(x, y - 110, `player-${character.id}`).setScale(2.5);
      const name = this.add
        .text(x, y - 30, character.name, {
          fontSize: '26px',
          fontStyle: 'bold',
          color: COLORS.textLight
        })
        .setOrigin(0.5);
      const desc = this.add
        .text(x, y + 8, character.description, {
          fontSize: '15px',
          color: COLORS.textDim,
          wordWrap: { width: 250 },
          align: 'center'
        })
        .setOrigin(0.5, 0);
      const stats = this.add
        .text(x, y + 68, this.characterStats(character), {
          fontSize: '14px',
          color: COLORS.textDim,
          align: 'center',
          lineSpacing: 4
        })
        .setOrigin(0.5, 0);

      this.contentLayer.add([bg, portrait, name, desc, stats]);
    });
  }

  private characterStats(character: CharacterDef): string {
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    return [
      `生命 ${Math.round(character.base[AttrKey.MaxHP])}`,
      `移速 ${Math.round(character.base[AttrKey.MoveSpeed])}`,
      `攻速 ${pct(character.base[AttrKey.AttackSpeed] - 1)}`,
      `暴击 ${Math.round(character.base[AttrKey.CritChance] * 100)}%`,
      `护甲 ${character.base[AttrKey.Armor]}`,
      `伤害 ${pct(character.base[AttrKey.Damage] - 1)}`
    ].join('\n');
  }

  private renderEnemies(): void {
    const discovered = CODEX_ENEMIES.filter((entry) =>
      MetaProgress.isEnemyDiscovered(entry.kind)
    ).length;
    this.subtitle.setText(`已发现 ${discovered} / ${CODEX_ENEMIES.length} · 敌人或可破坏物在战斗中出现后解锁`);
    const cx = GAME_WIDTH / 2;

    CODEX_ENEMIES.forEach((entry, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = cx + (col - 1) * 390;
      const y = 235 + row * 155;
      const found = MetaProgress.isEnemyDiscovered(entry.kind);

      const bg = this.add
        .rectangle(x, y, 340, 140, PANEL_FILL)
        .setStrokeStyle(2, found ? ACCENT : STROKE);
      const icon = this.add
        .image(x - 110, y, entry.kind)
        .setScale(1.5)
        .setAlpha(found ? 1 : 0.22);
      if (!found) icon.setTintFill(0x3a3f5c);

      const name = this.add
        .text(x - 60, y - 50, found ? entry.name : '???', {
          fontSize: '22px',
          fontStyle: 'bold',
          color: found ? COLORS.textLight : COLORS.textDim
        })
        .setOrigin(0, 0);
      const desc = this.add
        .text(x - 60, y - 16, found ? entry.description : '尚未发现', {
          fontSize: '14px',
          color: COLORS.textDim,
          wordWrap: { width: 216 },
          lineSpacing: 3
        })
        .setOrigin(0, 0);

      this.contentLayer.add([bg, icon, name, desc]);
    });
  }

  private renderTrinkets(): void {
    const entries = [
      ...STAT_TRINKETS.map((def) => ({
        key: `stat:${def.id}`,
        name: def.name,
        description: def.description,
        tag: '数值',
        color: '#4dd0e1'
      })),
      ...EFFECT_TRINKETS.map((def) => ({
        key: `effect:${def.id}`,
        name: def.name,
        description: def.description,
        tag: '特效',
        color: '#ff9f43'
      }))
    ];
    const discovered = entries.filter((entry) => MetaProgress.isTrinketDiscovered(entry.key)).length;
    this.subtitle.setText(`已发现 ${discovered} / ${entries.length} · 商品在商店或升级选项中出现后解锁`);

    entries.forEach((entry, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 184 + col * 228;
      const y = 240 + row * 165;
      const found = MetaProgress.isTrinketDiscovered(entry.key);

      const bg = this.add
        .rectangle(x, y, 208, 142, PANEL_FILL)
        .setStrokeStyle(2, found ? 0x3a3f5c : 0x2a2d3a);
      const tag = this.add
        .text(x + 90, y - 58, entry.tag, {
          fontSize: '13px',
          color: found ? entry.color : COLORS.textDim
        })
        .setOrigin(1, 0);
      const name = this.add
        .text(x - 90, y - 58, found ? entry.name : '???', {
          fontSize: '19px',
          fontStyle: 'bold',
          color: found ? COLORS.textLight : COLORS.textDim
        })
        .setOrigin(0, 0);
      const desc = this.add
        .text(x - 90, y - 26, found ? entry.description : '尚未发现', {
          fontSize: '13px',
          color: COLORS.textDim,
          wordWrap: { width: 180 },
          lineSpacing: 3
        })
        .setOrigin(0, 0);

      this.contentLayer.add([bg, tag, name, desc]);
    });
  }

  private renderAchievements(): void {
    const unlocked = ACHIEVEMENTS.filter((achievement) =>
      MetaProgress.isAchievementUnlocked(achievement.id)
    ).length;
    const stats = MetaProgress.stats;
    this.subtitle.setText(
      `已达成 ${unlocked} / ${ACHIEVEMENTS.length} · 完成 ${stats.runs} 局 · 最佳第 ${stats.bestWave} 波`
    );
    const cx = GAME_WIDTH / 2;

    ACHIEVEMENTS.forEach((achievement, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = cx + (col === 0 ? -280 : 280);
      const y = 235 + row * 108;
      const done = MetaProgress.isAchievementUnlocked(achievement.id);

      const bg = this.add
        .rectangle(x, y, 520, 92, PANEL_FILL)
        .setStrokeStyle(2, done ? GOLD : STROKE);
      const name = this.add
        .text(x - 240, y - 34, achievement.name, {
          fontSize: '21px',
          fontStyle: 'bold',
          color: done ? COLORS.textLight : COLORS.textDim
        })
        .setOrigin(0, 0);
      const desc = this.add
        .text(x - 240, y - 4, achievement.description, {
          fontSize: '14px',
          color: COLORS.textDim,
          wordWrap: { width: 340 }
        })
        .setOrigin(0, 0);
      const status = this.add
        .text(x + 240, y - 34, done ? '已达成' : '未达成', {
          fontSize: '16px',
          color: done ? COLORS.gold : COLORS.textDim
        })
        .setOrigin(1, 0);
      const reward = this.add
        .text(x + 240, y + 8, `+${achievement.stardust} 星尘`, {
          fontSize: '16px',
          color: done ? COLORS.gold : '#8b93a7'
        })
        .setOrigin(1, 0);

      this.contentLayer.add([bg, name, desc, status, reward]);
    });
  }
}
