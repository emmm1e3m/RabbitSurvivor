import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { AttrKey } from '../core/AttributeSystem';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';
import { CHARACTERS, CharacterDef } from '../data/characters';
import { DIFFICULTIES, DifficultyDef } from '../data/balance';

interface CardView {
  bg: Phaser.GameObjects.Rectangle;
  container: Phaser.GameObjects.Container;
}

interface DifficultyChip {
  bg: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

const SELECTED_STROKE = 0xffd23f;
const CHIP_W = 120;
const CHIP_GAP = 12;

export class CharacterSelectScene extends Phaser.Scene {
  private index = 0;
  private difficulty = 0;
  private cards: CardView[] = [];
  private difficultyChips: DifficultyChip[] = [];
  private difficultyDesc!: Phaser.GameObjects.Text;
  private confirmed = false;

  constructor() {
    super(SCENE_KEYS.CharacterSelect);
  }

  create(): void {
    this.confirmed = false;
    this.cards = [];
    this.difficultyChips = [];
    this.difficulty = Math.min(RunData.difficulty, DIFFICULTIES.length - 1);

    this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'bg-grid')
      .setDepth(0);

    this.add
      .text(GAME_WIDTH / 2, 110, '选择角色', {
        fontSize: '44px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    this.add
      .text(GAME_WIDTH / 2, 156, '← → / A D 切换角色 · ↑ ↓ / W S 调整难度 · Enter 开始', {
        fontSize: '16px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    this.index = Math.max(
      0,
      CHARACTERS.findIndex((c) => c.id === RunData.character.id)
    );

    CHARACTERS.forEach((character, i) => {
      const x = GAME_WIDTH / 2 + (i - (CHARACTERS.length - 1) / 2) * 330;
      this.createCard(character, x, 390);
    });
    this.refreshSelection();
    this.createDifficultyRow();

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-LEFT', () => this.select(-1));
    keyboard.on('keydown-RIGHT', () => this.select(1));
    keyboard.on('keydown-A', () => this.select(-1));
    keyboard.on('keydown-D', () => this.select(1));
    keyboard.on('keydown-UP', () => this.selectDifficulty(-1));
    keyboard.on('keydown-DOWN', () => this.selectDifficulty(1));
    keyboard.on('keydown-W', () => this.selectDifficulty(-1));
    keyboard.on('keydown-S', () => this.selectDifficulty(1));
    keyboard.once('keydown-ENTER', () => this.confirm());
  }

  private createDifficultyRow(): void {
    const cx = GAME_WIDTH / 2;

    this.add
      .text(cx, 584, '选择难度', { fontSize: '18px', color: COLORS.textDim })
      .setOrigin(0.5);

    DIFFICULTIES.forEach((def, i) => {
      const x = cx + (i - (DIFFICULTIES.length - 1) / 2) * (CHIP_W + CHIP_GAP);
      const bg = this.add
        .rectangle(x, 622, CHIP_W, 44, 0x232638)
        .setStrokeStyle(2, 0x3a3f5c)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, 622, `难度 ${def.level}`, { fontSize: '18px', color: COLORS.textLight })
        .setOrigin(0.5);

      bg.on('pointerover', () => bg.setFillStyle(0x2e3350));
      bg.on('pointerout', () => this.refreshDifficulty());
      bg.on('pointerdown', () => {
        if (this.confirmed) return;
        this.difficulty = i;
        Sfx.select();
        this.refreshDifficulty();
      });

      this.difficultyChips.push({ bg, text });
    });

    this.difficultyDesc = this.add
      .text(cx, 670, '', { fontSize: '15px', color: COLORS.textDim })
      .setOrigin(0.5);

    this.refreshDifficulty();
  }

  private selectDifficulty(dir: number): void {
    if (this.confirmed) return;
    this.difficulty = (this.difficulty + dir + DIFFICULTIES.length) % DIFFICULTIES.length;
    Sfx.select();
    this.refreshDifficulty();
  }

  private refreshDifficulty(): void {
    this.difficultyChips.forEach((chip, i) => {
      const active = i === this.difficulty;
      chip.bg.setFillStyle(active ? 0x2e3350 : 0x232638);
      chip.bg.setStrokeStyle(active ? 3 : 2, active ? SELECTED_STROKE : 0x3a3f5c);
      chip.text.setColor(active ? COLORS.textLight : COLORS.textDim);
    });
    this.difficultyDesc.setText(this.difficultyText(DIFFICULTIES[this.difficulty]));
  }

  private difficultyText(def: DifficultyDef): string {
    if (
      def.enemyDamage === 1 &&
      def.enemyHp === 1 &&
      def.enemyCount === 1 &&
      def.bossHp === 1
    ) {
      return '标准难度';
    }
    const parts = [`敌人伤害 ×${def.enemyDamage}`];
    if (def.enemyHp !== 1) parts.push(`敌人血量 ×${def.enemyHp}`);
    if (def.enemyCount !== 1) parts.push(`敌人数量 ×${def.enemyCount}`);
    if (def.bossHp !== 1) parts.push(`精英血量 ×${def.bossHp}`);
    return parts.join(' · ');
  }

  private createCard(character: CharacterDef, x: number, y: number): void {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 280, 340, 0x232638).setStrokeStyle(2, 0x3a3f5c);
    const portrait = this.add.image(0, -100, `player-${character.id}`).setScale(3);

    const name = this.add
      .text(0, -30, character.name, {
        fontSize: '26px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    const desc = this.add
      .text(0, 8, character.description, {
        fontSize: '15px',
        color: COLORS.textDim,
        wordWrap: { width: 240 },
        align: 'center'
      })
      .setOrigin(0.5);

    const stats = this.add
      .text(0, 52, this.statsText(character), {
        fontSize: '14px',
        color: COLORS.textDim,
        align: 'center',
        lineSpacing: 4
      })
      .setOrigin(0.5, 0);

    container.add([bg, portrait, name, desc, stats]);
    this.cards.push({ bg, container });
  }

  private statsText(character: CharacterDef): string {
    const pct = (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
    const base = character.base;
    return [
      `生命 ${Math.round(base[AttrKey.MaxHP])}`,
      `移速 ${Math.round(base[AttrKey.MoveSpeed])}`,
      `攻速 ${pct(base[AttrKey.AttackSpeed] - 1)}`,
      `暴击 ${Math.round(base[AttrKey.CritChance] * 100)}%`,
      `护甲 ${base[AttrKey.Armor]}`,
      `伤害 ${pct(base[AttrKey.Damage] - 1)}`
    ].join('\n');
  }

  private select(dir: number): void {
    if (this.confirmed) return;
    this.index = (this.index + dir + CHARACTERS.length) % CHARACTERS.length;
    Sfx.select();
    this.refreshSelection();
  }

  private refreshSelection(): void {
    this.cards.forEach((card, i) => {
      const active = i === this.index;
      card.bg.setStrokeStyle(active ? 3 : 2, active ? SELECTED_STROKE : 0x3a3f5c);
      card.container.setAlpha(active ? 1 : 0.5).setScale(active ? 1.04 : 1);
    });
  }

  private confirm(): void {
    if (this.confirmed) return;
    this.confirmed = true;

    Sfx.ui();
    RunData.startRun(CHARACTERS[this.index], this.difficulty);
    this.scene.start(SCENE_KEYS.Game);
  }
}
