import { EventBus, Events } from '../core/EventBus';
import { RunData } from '../core/RunData';
import { QUESTION } from './balance';

export interface QuestionChoiceDef {
  id: string;
  /** 卡片标题 */
  name: string;
  /** 接受后的效果说明 */
  description: string;
  /** 接受后立即生效（小问号由 QuestionScene 统一扣除） */
  apply: () => void;
}

/**
 * 小问号事件的选项池：每波结束后随机抽取一项供玩家选择。
 * 扩展方式：向数组追加一条定义即可，接受/拒绝流程与 UI 自动复用。
 */
export const QUESTION_CHOICES: QuestionChoiceDef[] = [
  {
    id: 'bounty',
    name: '危险悬赏',
    description: `下一波敌人数量 +${Math.round((QUESTION.bountyEnemyMult - 1) * 100)}%，立即获得 ${QUESTION.bountyGold} 金币`,
    apply: () => {
      RunData.nextWaveEnemyMult *= QUESTION.bountyEnemyMult;
      RunData.addGold(QUESTION.bountyGold);
      EventBus.emit(Events.GoldChanged, RunData.gold);
    }
  }
];
