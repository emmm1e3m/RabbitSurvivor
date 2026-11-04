import Phaser from 'phaser';
import { SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, COLORS } from '../config';
import { MetaProgress } from '../core/MetaProgress';
import { Sfx } from '../core/Sfx';
import { META_TREES, findMetaNode } from '../data/metaTree';

const NODE_W = 232;
const NODE_H = 124;
const COL_STEP = 264;
const ROW_STEP = 150;
const PANEL_FILL = 0x232638;
const PANEL_FILL_HOVER = 0x2e3350;
const STROKE = 0x3a3f5c;
const ACCENT = 0x4dd0e1;
const GOLD = 0xffd23f;

/** 局外天赋树：通用树 + 每个角色的专属树，点击节点消耗星尘升级 */
export class MetaScene extends Phaser.Scene {
  private treeIndex = 0;
  private tabs: Array<{ bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }> = [];
  private nodeLayer!: Phaser.GameObjects.Container;
  private stardustText!: Phaser.GameObjects.Text;
  private treeDesc!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE_KEYS.Meta);
  }

  create(): void {
    this.treeIndex = 0;
    this.tabs = [];

    this.add
      .tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'bg-grid')
      .setDepth(0);

    this.add
      .text(GAME_WIDTH / 2, 44, '天赋树', {
        fontSize: '40px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0.5);

    this.stardustText = this.add
      .text(GAME_WIDTH - 60, 44, '', { fontSize: '24px', color: COLORS.gold })
      .setOrigin(1, 0.5);

    this.createTabs();
    this.treeDesc = this.add
      .text(GAME_WIDTH / 2, 140, '', { fontSize: '16px', color: COLORS.textDim })
      .setOrigin(0.5);

    this.nodeLayer = this.add.container(0, 0);

    this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT - 30,
        '点击节点消耗星尘升级 · ← → 切换天赋树 · ESC 返回主菜单',
        { fontSize: '16px', color: COLORS.textDim }
      )
      .setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    keyboard.on('keydown-LEFT', () => this.switchTree(-1));
    keyboard.on('keydown-RIGHT', () => this.switchTree(1));
    keyboard.on('keydown-A', () => this.switchTree(-1));
    keyboard.on('keydown-D', () => this.switchTree(1));
    keyboard.on('keydown-ESC', () => {
      Sfx.ui();
      this.scene.start(SCENE_KEYS.Menu);
    });

    this.refresh();
  }

  private createTabs(): void {
    const cx = GAME_WIDTH / 2;
    META_TREES.forEach((tree, i) => {
      const x = cx + (i - (META_TREES.length - 1) / 2) * 160;
      const bg = this.add
        .rectangle(x, 96, 148, 40, 0x1a1c26)
        .setStrokeStyle(2, STROKE)
        .setInteractive({ useHandCursor: true });
      const text = this.add
        .text(x, 96, tree.name, { fontSize: '18px', color: COLORS.textDim })
        .setOrigin(0.5);

      bg.on('pointerover', () => {
        if (this.treeIndex !== i) bg.setFillStyle(PANEL_FILL_HOVER);
      });
      bg.on('pointerout', () => this.refreshTabs());
      bg.on('pointerdown', () => {
        if (this.treeIndex === i) return;
        this.treeIndex = i;
        Sfx.select();
        this.refresh();
      });

      this.tabs.push({ bg, text });
    });
  }

  private switchTree(dir: number): void {
    this.treeIndex = (this.treeIndex + dir + META_TREES.length) % META_TREES.length;
    Sfx.select();
    this.refresh();
  }

  private refresh(): void {
    this.refreshTabs();
    this.stardustText.setText(`星尘 ${MetaProgress.stardust}`);
    this.treeDesc.setText(META_TREES[this.treeIndex].description);
    this.renderTree();
  }

  private refreshTabs(): void {
    this.tabs.forEach((tab, i) => {
      const active = i === this.treeIndex;
      tab.bg.setFillStyle(active ? 0x2e3350 : 0x1a1c26);
      tab.bg.setStrokeStyle(active ? 3 : 2, active ? GOLD : STROKE);
      tab.text.setColor(active ? COLORS.textLight : COLORS.textDim);
    });
  }

  private renderTree(): void {
    this.nodeLayer.removeAll(true);
    const tree = META_TREES[this.treeIndex];
    const maxSlot = Math.max(...tree.nodes.map((node) => node.slot));
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of tree.nodes) {
      positions.set(node.id, {
        x: GAME_WIDTH / 2 + (node.slot - maxSlot / 2) * COL_STEP,
        y: 255 + node.tier * ROW_STEP
      });
    }

    // 前置连线先画，卡片覆盖在线的上方
    const graphics = this.add.graphics();
    for (const node of tree.nodes) {
      if (!node.requires) continue;
      const from = positions.get(node.requires);
      const to = positions.get(node.id);
      if (!from || !to) continue;
      const unlocked = MetaProgress.getRank(node.requires) > 0;
      graphics.lineStyle(3, unlocked ? ACCENT : STROKE, unlocked ? 0.8 : 0.6);
      graphics.lineBetween(from.x, from.y + NODE_H / 2, to.x, to.y - NODE_H / 2);
    }
    this.nodeLayer.add(graphics);

    for (const node of tree.nodes) {
      const pos = positions.get(node.id)!;
      this.createNodeCard(node.id, pos.x, pos.y);
    }
  }

  private createNodeCard(nodeId: string, x: number, y: number): void {
    const node = findMetaNode(nodeId)!;
    const state = MetaProgress.getNodeState(nodeId)!;
    const stroke = state.maxed ? GOLD : state.locked ? STROKE : state.affordable ? ACCENT : STROKE;

    const bg = this.add
      .rectangle(x, y, NODE_W, NODE_H, PANEL_FILL)
      .setStrokeStyle(2, stroke)
      .setAlpha(state.locked ? 0.55 : 1)
      .setInteractive({ useHandCursor: !state.locked && !state.maxed });

    const name = this.add
      .text(x - NODE_W / 2 + 14, y - NODE_H / 2 + 10, node.name, {
        fontSize: '19px',
        fontStyle: 'bold',
        color: COLORS.textLight
      })
      .setOrigin(0, 0);

    const rank = this.add
      .text(x + NODE_W / 2 - 14, y - NODE_H / 2 + 12, `Lv ${state.rank}/${node.maxRank}`, {
        fontSize: '15px',
        color: state.maxed ? COLORS.gold : COLORS.textDim
      })
      .setOrigin(1, 0);

    const desc = this.add
      .text(x - NODE_W / 2 + 14, y - NODE_H / 2 + 38, node.description, {
        fontSize: '13px',
        color: COLORS.textDim,
        lineSpacing: 3,
        wordWrap: { width: NODE_W - 28 }
      })
      .setOrigin(0, 0);

    const reqName = node.requires ? findMetaNode(node.requires)?.name : undefined;
    const status = state.maxed
      ? { text: '已满级', color: COLORS.gold }
      : state.locked
        ? { text: `需先解锁：${reqName ?? '前置节点'}`, color: COLORS.textDim }
        : { text: `升级  ${state.cost} 星尘`, color: state.affordable ? COLORS.gold : '#ff6b6b' };
    const statusText = this.add
      .text(x - NODE_W / 2 + 14, y + NODE_H / 2 - 10, status.text, {
        fontSize: '15px',
        color: status.color
      })
      .setOrigin(0, 1);

    bg.on('pointerover', () => {
      if (!state.locked && !state.maxed) bg.setFillStyle(PANEL_FILL_HOVER);
    });
    bg.on('pointerout', () => bg.setFillStyle(PANEL_FILL));
    bg.on('pointerdown', () => {
      if (!MetaProgress.buyNode(nodeId)) return;
      Sfx.buy();
      // 延迟重建，避免在卡片自身的点击回调里销毁它
      this.time.delayedCall(0, () => this.refresh());
    });

    this.nodeLayer.add([bg, name, rank, desc, statusText]);
  }
}
