import Phaser from 'phaser';
import { SCENE_KEYS } from '../config';
import { EventBus, Events } from '../core/EventBus';
import { Sfx } from '../core/Sfx';
import { ShopSystem } from '../systems/ShopSystem';
import { ShopUI } from '../ui/ShopUI';

export class ShopScene extends Phaser.Scene {
  private closed = false;

  constructor() {
    super(SCENE_KEYS.Shop);
  }

  create(): void {
    this.closed = false;
    const shopSystem = new ShopSystem();
    const offers = shopSystem.rollOffers();

    new ShopUI(this, shopSystem, offers, () => this.closeShop());
    this.input.keyboard!.once('keydown-ENTER', () => {
      Sfx.ui();
      this.closeShop();
    });
  }

  private closeShop(): void {
    if (this.closed) return;
    this.closed = true;

    EventBus.emit(Events.ShopClosed);
    this.scene.resume(SCENE_KEYS.Game);
    this.scene.stop();
  }
}
