import Phaser from 'phaser';

/** 场景间通信的全局事件总线 */
export const EventBus = new Phaser.Events.EventEmitter();

export const Events = {
  WaveStarted: 'wave-started',
  WaveCleared: 'wave-cleared',
  PlayerDied: 'player-died',
  GameVictory: 'game-victory',
  GoldChanged: 'gold-changed',
  ShopPurchased: 'shop-purchased',
  ShopClosed: 'shop-closed',
  LevelUpClosed: 'level-up-closed'
} as const;
