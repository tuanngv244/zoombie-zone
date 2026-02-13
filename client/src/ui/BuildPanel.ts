import { BUILDING_DEFS, BuildingDef, ARMY_UNIT_DEFS, ArmyUnitDef } from '../config/clientConfig';
import { BuildingRenderer } from '../entities/BuildingRenderer';
import { ArmyUnitRenderer } from '../entities/ArmyUnitRenderer';

export type BuildSelectCallback = (type: string | null) => void;
export type ArmySelectCallback = (type: string | null) => void;

/**
 * Bottom toolbar with building selection — horizontal layout, keyboard shortcuts.
 * Supports toggle-deselect (clicking the same item again cancels placement)
 * and 3D model thumbnail previews.
 */
export class BuildPanel {
  private container: HTMLDivElement;
  private cards: Map<string, HTMLDivElement> = new Map();
  private armyCards: Map<string, HTMLDivElement> = new Map();
  private selected: string | null = null;
  private selectedArmy: string | null = null;
  private currentGold = 0;
  private selectCallback: BuildSelectCallback | null = null;
  private armySelectCallback: ArmySelectCallback | null = null;

  constructor(overlay: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
      display: flex; flex-direction: row; gap: 4px;
      background: rgba(15, 8, 4, 0.92);
      border: 1px solid #6b4226;
      border-radius: 10px;
      padding: 8px 12px;
      pointer-events: auto;
      max-width: 95vw;
      overflow-x: auto;
      scrollbar-width: none;
    `;
    overlay.appendChild(this.container);

    // Category: Walls
    this.addCategory('Walls');
    for (let i = 0; i < BUILDING_DEFS.length; i++) {
      const def = BUILDING_DEFS[i];
      if (!def.isWall) continue;
      const card = this.createCard(def, i + 1);
      this.container.appendChild(card);
      this.cards.set(def.type, card);
    }

    // Separator
    this.addSeparator();

    // Category: Towers
    this.addCategory('Attack');
    for (let i = 0; i < BUILDING_DEFS.length; i++) {
      const def = BUILDING_DEFS[i];
      if (def.isWall) continue;
      const card = this.createCard(def, i + 1);
      this.container.appendChild(card);
      this.cards.set(def.type, card);
    }

    // Separator
    this.addSeparator();

    // Category: Army
    this.addCategory('Army (PvP)');
    for (let i = 0; i < ARMY_UNIT_DEFS.length; i++) {
      const def = ARMY_UNIT_DEFS[i];
      const card = this.createArmyCard(def);
      this.container.appendChild(card);
      this.armyCards.set(def.type, card);
    }

    // Keyboard shortcuts (1-9) with toggle support
    window.addEventListener('keydown', (e) => {
      const num = parseInt(e.key);
      if (num >= 1 && num <= BUILDING_DEFS.length) {
        const def = BUILDING_DEFS[num - 1];
        // Toggle: if already selected, deselect
        if (this.selected === def.type) {
          this.setSelected(null);
          this.selectCallback?.(null);
          return;
        }
        if (this.currentGold >= def.cost) {
          this.setSelected(def.type);
          this.selectCallback?.(def.type);
        }
      }
    });
  }

  private addCategory(label: string): void {
    const el = document.createElement('div');
    el.style.cssText = `
      font-family: 'Cinzel', serif; font-size: 9px; color: #6b4226;
      writing-mode: vertical-rl; text-orientation: mixed;
      display: flex; align-items: center; justify-content: center;
      padding: 0 2px; letter-spacing: 1px; text-transform: uppercase;
    `;
    el.textContent = label;
    this.container.appendChild(el);
  }

  private addSeparator(): void {
    const el = document.createElement('div');
    el.style.cssText = `
      width: 1px; align-self: stretch;
      background: linear-gradient(180deg, transparent, #6b4226, transparent);
      margin: 0 4px;
    `;
    this.container.appendChild(el);
  }

  private createCard(def: BuildingDef, shortcut: number): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      background: rgba(40, 25, 15, 0.7);
      border: 2px solid #4a3020;
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, transform 0.1s;
      user-select: none;
      min-width: 68px;
      position: relative;
    `;

    // Shortcut key badge
    const badge = document.createElement('div');
    badge.style.cssText = `
      position: absolute; top: -6px; right: -4px;
      background: #6b4226; color: #d4a857;
      font-family: 'Cinzel', serif; font-size: 10px; font-weight: 700;
      width: 16px; height: 16px; border-radius: 3px;
      display: flex; align-items: center; justify-content: center;
      line-height: 1;
    `;
    badge.textContent = String(shortcut);
    card.appendChild(badge);

    // Model thumbnail (or fallback color swatch)
    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 48px; height: 48px; border-radius: 4px;
      margin-bottom: 3px;
      border: 1px solid rgba(255,255,255,0.2);
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    `;

    // Generate 3D thumbnail
    const thumbnailUrl = BuildingRenderer.generateThumbnail(def);
    if (thumbnailUrl) {
      icon.style.backgroundImage = `url(${thumbnailUrl})`;
      icon.style.backgroundColor = 'rgba(30, 18, 10, 0.6)';
    } else {
      // Fallback: plain color swatch
      const colorHex = '#' + def.color.toString(16).padStart(6, '0');
      icon.style.backgroundColor = colorHex;
    }
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.style.cssText = `
      font-family: 'MedievalSharp', serif; font-size: 10px;
      color: #d4a857; text-align: center; line-height: 1.2;
      max-width: 60px; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis;
    `;
    name.textContent = def.name;
    card.appendChild(name);

    // Cost
    const cost = document.createElement('div');
    cost.style.cssText = `
      font-family: 'Cinzel', serif; font-size: 11px; color: #ffd700;
      display: flex; align-items: center; gap: 2px; margin-top: 2px;
    `;
    cost.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" style="flex-shrink:0;"><circle cx="7" cy="7" r="6" fill="#ffd700" stroke="#b8860b" stroke-width="1"/><text x="7" y="10.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#8b6914" font-family="Cinzel,serif">$</text></svg>${def.cost}`;
    card.appendChild(cost);

    // Size
    const size = document.createElement('div');
    size.style.cssText = `font-size: 9px; color: #a88c5e;`;
    size.textContent = `${def.gridWidth}x${def.gridHeight}`;
    card.appendChild(size);

    // Tooltip
    card.title = `[${shortcut}] ${def.name} — ${def.description}`;

    // Events
    card.addEventListener('mouseenter', () => {
      if (this.currentGold >= def.cost && this.selected !== def.type) {
        card.style.borderColor = '#d4a857';
        card.style.background = 'rgba(60, 35, 20, 0.8)';
        card.style.transform = 'translateY(-2px)';
      }
    });
    card.addEventListener('mouseleave', () => {
      if (this.selected !== def.type) {
        card.style.borderColor = '#4a3020';
        card.style.background = 'rgba(40, 25, 15, 0.7)';
        card.style.transform = 'none';
      }
    });
    card.addEventListener('click', () => {
      // Toggle: if already selected, deselect
      if (this.selected === def.type) {
        this.setSelected(null);
        this.selectCallback?.(null);
        return;
      }
      if (this.currentGold < def.cost) return;
      this.setSelected(def.type);
      this.selectCallback?.(def.type);
    });

    return card;
  }

  private createArmyCard(def: ArmyUnitDef): HTMLDivElement {
    const card = document.createElement('div');
    card.style.cssText = `
      display: flex; flex-direction: column; align-items: center;
      background: rgba(40, 25, 15, 0.7);
      border: 2px solid #4a3020;
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s, transform 0.1s;
      user-select: none;
      min-width: 68px;
      position: relative;
    `;

    // Model thumbnail (or fallback color swatch)
    const icon = document.createElement('div');
    const colorHex = '#' + def.color.toString(16).padStart(6, '0');
    icon.style.cssText = `
      width: 48px; height: 48px; border-radius: 4px;
      margin-bottom: 3px;
      border: 1px solid rgba(255,255,255,0.2);
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
    `;

    // Generate 3D thumbnail
    const thumbnailUrl = ArmyUnitRenderer.generateThumbnail(def);
    if (thumbnailUrl) {
      icon.style.backgroundImage = `url(${thumbnailUrl})`;
      icon.style.backgroundColor = 'rgba(30, 18, 10, 0.6)';
    } else {
      icon.style.backgroundColor = colorHex;
    }
    card.appendChild(icon);

    // Name
    const name = document.createElement('div');
    name.style.cssText = `
      font-family: 'MedievalSharp', serif; font-size: 10px;
      color: #d4a857; text-align: center; line-height: 1.2;
      max-width: 60px; white-space: nowrap; overflow: hidden;
      text-overflow: ellipsis;
    `;
    name.textContent = def.name;
    card.appendChild(name);

    // Cost
    const cost = document.createElement('div');
    cost.style.cssText = `
      font-family: 'Cinzel', serif; font-size: 11px; color: #ffd700;
      display: flex; align-items: center; gap: 2px; margin-top: 2px;
    `;
    cost.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" style="flex-shrink:0;"><circle cx="7" cy="7" r="6" fill="#ffd700" stroke="#b8860b" stroke-width="1"/><text x="7" y="10.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#8b6914" font-family="Cinzel,serif">$</text></svg>${def.cost}`;
    card.appendChild(cost);

    // Tooltip
    card.title = `${def.name} — ${def.description} [PvP: Attacks enemy castles in multiplayer]`;

    // Events
    card.addEventListener('mouseenter', () => {
      if (this.currentGold >= def.cost && this.selectedArmy !== def.type) {
        card.style.borderColor = '#d4a857';
        card.style.background = 'rgba(60, 35, 20, 0.8)';
        card.style.transform = 'translateY(-2px)';
      }
    });
    card.addEventListener('mouseleave', () => {
      if (this.selectedArmy !== def.type) {
        card.style.borderColor = '#4a3020';
        card.style.background = 'rgba(40, 25, 15, 0.7)';
        card.style.transform = 'none';
      }
    });
    card.addEventListener('click', () => {
      // Toggle: if already selected, deselect
      if (this.selectedArmy === def.type) {
        this.setSelectedArmy(null);
        this.armySelectCallback?.(null);
        return;
      }
      if (this.currentGold < def.cost) return;
      // Deselect any building selection
      this.setSelected(null);
      this.selectCallback?.(null);
      this.setSelectedArmy(def.type);
      this.armySelectCallback?.(def.type);
    });

    return card;
  }

  updateGold(gold: number): void {
    this.currentGold = gold;
    for (const def of BUILDING_DEFS) {
      const card = this.cards.get(def.type);
      if (!card) continue;
      const affordable = gold >= def.cost;
      const isSelected = this.selected === def.type;
      card.style.opacity = affordable || isSelected ? '1' : '0.35';
      card.style.pointerEvents = affordable || isSelected ? 'auto' : 'none';
    }
    for (const def of ARMY_UNIT_DEFS) {
      const card = this.armyCards.get(def.type);
      if (!card) continue;
      const affordable = gold >= def.cost;
      const isSelected = this.selectedArmy === def.type;
      card.style.opacity = affordable || isSelected ? '1' : '0.35';
      card.style.pointerEvents = affordable || isSelected ? 'auto' : 'none';
    }
  }

  onSelect(callback: BuildSelectCallback): void {
    this.selectCallback = callback;
  }

  onArmySelect(callback: ArmySelectCallback): void {
    this.armySelectCallback = callback;
  }

  setSelected(type: string | null): void {
    // Deselect old
    if (this.selected) {
      const old = this.cards.get(this.selected);
      if (old) {
        old.style.borderColor = '#4a3020';
        old.style.background = 'rgba(40, 25, 15, 0.7)';
        old.style.transform = 'none';
      }
    }
    this.selected = type;
    // Also deselect any army selection when a building is selected
    if (type) {
      this.setSelectedArmy(null);
    }
    // Highlight new
    if (type) {
      const card = this.cards.get(type);
      if (card) {
        card.style.borderColor = '#ffd700';
        card.style.background = 'rgba(80, 50, 25, 0.9)';
        card.style.transform = 'translateY(-3px)';
      }
    }
  }

  setSelectedArmy(type: string | null): void {
    // Deselect old army card
    if (this.selectedArmy) {
      const old = this.armyCards.get(this.selectedArmy);
      if (old) {
        old.style.borderColor = '#4a3020';
        old.style.background = 'rgba(40, 25, 15, 0.7)';
        old.style.transform = 'none';
      }
    }
    this.selectedArmy = type;
    // Highlight new army card
    if (type) {
      const card = this.armyCards.get(type);
      if (card) {
        card.style.borderColor = '#ffd700';
        card.style.background = 'rgba(80, 50, 25, 0.9)';
        card.style.transform = 'translateY(-3px)';
      }
    }
  }

  show(): void {
    this.container.style.display = 'flex';
  }

  hide(): void {
    this.container.style.display = 'none';
  }
}
