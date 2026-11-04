import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { MetaProgress, RunReward } from '../core/MetaProgress';
import { RunData } from '../core/RunData';
import { Sfx } from '../core/Sfx';

interface GameOverData {
  wave: number;
  normalKills: number;
  eliteKills: number;
  victory: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private result!: GameOverData;

  constructor() {
    super(SCENE_KEYS.GameOver);
  }

  init(data: GameOverData): void {
    this.result = data;
  }

  create(): void {
    if (this.result.victory) Sfx.victory();
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.82);

    const reward = this.recordRun();
    const title = this.result.victory ? '通关！' : '游戏结束';
    const titleColor = this.result.victory ? '#51cf66' : '#ff6b6b';

    this.add
      .text(cx, cy - 165, title, {
        fontSize: '64px',
        fontStyle: 'bold',
        color: titleColor
      })
      .setOrigin(0.5);

    this.add
      .text(
        cx,
        cy - 95,
        `到达第 ${this.result.wave} 波 · 击杀小怪 ${this.result.normalKills} · 精英 ${this.result.eliteKills}`,
        { fontSize: '26px', color: COLORS.textLight }
      )
      .setOrigin(0.5);

    this.add
      .text(cx, cy - 40, `获得星尘 +${reward.stardust} · 当前 ${MetaProgress.stardust}`, {
        fontSize: '24px',
        color: COLORS.gold
      })
      .setOrigin(0.5);

    if (reward.achievements.length > 0) {
      this.add
        .text(
          cx,
          cy + 10,
          `成就解锁：${reward.achievements.map((achievement) => achievement.name).join(' · ')}`,
          {
            fontSize: '20px',
            color: '#4dd0e1',
            wordWrap: { width: 900 },
            align: 'center'
          }
        )
        .setOrigin(0.5);
    }

    this.add
      .text(cx, cy + 150, '按 Enter 选择角色 · ESC 返回主菜单', {
        fontSize: '22px',
        color: COLORS.textDim
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    keyboard.once('keydown-ENTER', () => {
      Sfx.ui();
      this.scene.stop(SCENE_KEYS.Game);
      this.scene.start(SCENE_KEYS.CharacterSelect);
    });
    keyboard.on('keydown-ESC', () => {
      Sfx.ui();
      this.scene.stop(SCENE_KEYS.Game);
      this.scene.start(SCENE_KEYS.Menu);
    });
  }

  /** 结算星尘与成就（每局只记录一次） */
  private recordRun(): RunReward {
    if (RunData.metaRecorded) return { stardust: 0, achievements: [] };
    RunData.metaRecorded = true;

    let trinketCount = 0;
    for (const count of RunData.trinketCounts.values()) trinketCount += count;

    return MetaProgress.recordRun({
      characterId: RunData.character.id,
      wave: this.result.wave,
      normalKills: this.result.normalKills,
      eliteKills: this.result.eliteKills,
      bossKilled: RunData.bossKilled,
      victory: this.result.victory,
      gold: RunData.gold,
      trinketCount
    });
  }
}
