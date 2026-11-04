export enum AttrKey {
  MaxHP = 'maxHp',
  HPRegen = 'hpRegen',
  Damage = 'damage',
  AttackSpeed = 'attackSpeed',
  CritChance = 'critChance',
  Armor = 'armor',
  Dodge = 'dodge',
  MoveSpeed = 'moveSpeed',
  PickupRange = 'pickupRange',
  Range = 'range'
}

export interface AttrModifier {
  /** 唯一 id，如 'trinket:maxhp:3'，用于去重/移除 */
  id: string;
  key: AttrKey;
  type: 'flat' | 'percent';
  value: number;
}

const CAPS: Partial<Record<AttrKey, number>> = {
  [AttrKey.CritChance]: 1,
  [AttrKey.Dodge]: 0.6
};

/**
 * 数值计算模型：(base + Σflat) × (1 + Σpercent)，部分属性有上限
 */
export class AttributeSystem {
  private base = new Map<AttrKey, number>();
  private modifiers = new Map<string, AttrModifier>();

  constructor(baseValues: Record<AttrKey, number>) {
    for (const key of Object.keys(baseValues) as AttrKey[]) {
      this.base.set(key, baseValues[key]);
    }
  }

  get(key: AttrKey): number {
    let flat = 0;
    let percent = 0;
    for (const mod of this.modifiers.values()) {
      if (mod.key !== key) continue;
      if (mod.type === 'flat') flat += mod.value;
      else percent += mod.value;
    }
    let value = ((this.base.get(key) ?? 0) + flat) * (1 + percent);
    const cap = CAPS[key];
    if (cap !== undefined) value = Math.min(value, cap);
    return value;
  }

  setBase(key: AttrKey, value: number): void {
    this.base.set(key, value);
  }

  addModifier(mod: AttrModifier): void {
    this.modifiers.set(mod.id, mod);
  }

  removeModifier(id: string): void {
    this.modifiers.delete(id);
  }

  get maxHp(): number { return this.get(AttrKey.MaxHP); }
  get hpRegen(): number { return this.get(AttrKey.HPRegen); }
  get damage(): number { return this.get(AttrKey.Damage); }
  get attackSpeed(): number { return this.get(AttrKey.AttackSpeed); }
  get critChance(): number { return this.get(AttrKey.CritChance); }
  get armor(): number { return this.get(AttrKey.Armor); }
  get dodge(): number { return this.get(AttrKey.Dodge); }
  get moveSpeed(): number { return this.get(AttrKey.MoveSpeed); }
  get pickupRange(): number { return this.get(AttrKey.PickupRange); }
  get range(): number { return this.get(AttrKey.Range); }
}
