import type { Stats6 } from '../types';

export type StatusName = '' | 'psn' | 'tox' | 'par' | 'brn' | 'slp' | 'frz';
export type ItemEffect =
  | { kind: 'heal'; amount: number | 'full' }
  | { kind: 'cure'; status: 'all' | StatusName }
  | { kind: 'revive'; fraction: number }
  | { kind: 'ev'; stat: keyof Stats6; amount: number }
  | { kind: 'pp'; mode: 'restore' | 'restoreAll' | 'up'; amount?: number }
  | { kind: 'ball'; ballType: 'poke' | 'great' | 'ultra' | 'master' }
  | { kind: 'evoStone'; stone: string }
  | { kind: 'tm'; move: string }
  | { kind: 'repel'; steps: number }
  | { kind: 'escapeRope' };

export interface ItemDef {
  id: string; name: string; pocket: string;
  buyPrice: number; sellPrice: number;
  useContext: 'field' | 'battle' | 'both' | 'hold';
  effect: ItemEffect;
}

export const ITEMS: Record<string, ItemDef> = {
  potion:      { id: 'potion', name: 'Potion', pocket: 'medicine', buyPrice: 200, sellPrice: 100, useContext: 'both', effect: { kind: 'heal', amount: 20 } },
  superpotion: { id: 'superpotion', name: 'Super Potion', pocket: 'medicine', buyPrice: 700, sellPrice: 350, useContext: 'both', effect: { kind: 'heal', amount: 60 } },
  hyperpotion: { id: 'hyperpotion', name: 'Hyper Potion', pocket: 'medicine', buyPrice: 1500, sellPrice: 750, useContext: 'both', effect: { kind: 'heal', amount: 120 } },
  maxpotion:   { id: 'maxpotion', name: 'Max Potion', pocket: 'medicine', buyPrice: 2500, sellPrice: 1250, useContext: 'both', effect: { kind: 'heal', amount: 'full' } },
  antidote:    { id: 'antidote', name: 'Antidote', pocket: 'medicine', buyPrice: 100, sellPrice: 50, useContext: 'both', effect: { kind: 'cure', status: 'psn' } },
  paralyzeheal:{ id: 'paralyzeheal', name: 'Paralyze Heal', pocket: 'medicine', buyPrice: 200, sellPrice: 100, useContext: 'both', effect: { kind: 'cure', status: 'par' } },
  fullheal:    { id: 'fullheal', name: 'Full Heal', pocket: 'medicine', buyPrice: 400, sellPrice: 200, useContext: 'both', effect: { kind: 'cure', status: 'all' } },
  revive:      { id: 'revive', name: 'Revive', pocket: 'medicine', buyPrice: 1500, sellPrice: 750, useContext: 'both', effect: { kind: 'revive', fraction: 0.5 } },
  maxrevive:   { id: 'maxrevive', name: 'Max Revive', pocket: 'medicine', buyPrice: 4000, sellPrice: 2000, useContext: 'both', effect: { kind: 'revive', fraction: 1 } },
  ether:       { id: 'ether', name: 'Ether', pocket: 'medicine', buyPrice: 1200, sellPrice: 600, useContext: 'both', effect: { kind: 'pp', mode: 'restore', amount: 10 } },
  maxether:    { id: 'maxether', name: 'Max Ether', pocket: 'medicine', buyPrice: 2000, sellPrice: 1000, useContext: 'both', effect: { kind: 'pp', mode: 'restoreAll' } },
  ppup:        { id: 'ppup', name: 'PP Up', pocket: 'medicine', buyPrice: 10000, sellPrice: 5000, useContext: 'field', effect: { kind: 'pp', mode: 'up' } },
  pokeball:    { id: 'pokeball', name: 'Poké Ball', pocket: 'balls', buyPrice: 200, sellPrice: 100, useContext: 'battle', effect: { kind: 'ball', ballType: 'poke' } },
  greatball:   { id: 'greatball', name: 'Great Ball', pocket: 'balls', buyPrice: 600, sellPrice: 300, useContext: 'battle', effect: { kind: 'ball', ballType: 'great' } },
  ultraball:   { id: 'ultraball', name: 'Ultra Ball', pocket: 'balls', buyPrice: 1200, sellPrice: 600, useContext: 'battle', effect: { kind: 'ball', ballType: 'ultra' } },
  masterball:  { id: 'masterball', name: 'Master Ball', pocket: 'balls', buyPrice: 0, sellPrice: 0, useContext: 'battle', effect: { kind: 'ball', ballType: 'master' } },
  protein:     { id: 'protein', name: 'Protein', pocket: 'medicine', buyPrice: 10000, sellPrice: 5000, useContext: 'field', effect: { kind: 'ev', stat: 'atk', amount: 10 } },
  iron:        { id: 'iron', name: 'Iron', pocket: 'medicine', buyPrice: 10000, sellPrice: 5000, useContext: 'field', effect: { kind: 'ev', stat: 'def', amount: 10 } },
  calcium:     { id: 'calcium', name: 'Calcium', pocket: 'medicine', buyPrice: 10000, sellPrice: 5000, useContext: 'field', effect: { kind: 'ev', stat: 'spa', amount: 10 } },
  hpup:        { id: 'hpup', name: 'HP Up', pocket: 'medicine', buyPrice: 10000, sellPrice: 5000, useContext: 'field', effect: { kind: 'ev', stat: 'hp', amount: 10 } },
  thunderstone:{ id: 'thunderstone', name: 'Thunder Stone', pocket: 'stones', buyPrice: 3000, sellPrice: 1500, useContext: 'field', effect: { kind: 'evoStone', stone: 'Thunder Stone' } },
  waterstone:  { id: 'waterstone', name: 'Water Stone', pocket: 'stones', buyPrice: 3000, sellPrice: 1500, useContext: 'field', effect: { kind: 'evoStone', stone: 'Water Stone' } },
  firestone:   { id: 'firestone', name: 'Fire Stone', pocket: 'stones', buyPrice: 3000, sellPrice: 1500, useContext: 'field', effect: { kind: 'evoStone', stone: 'Fire Stone' } },
  tm_thunderbolt: { id: 'tm_thunderbolt', name: 'TM Thunderbolt', pocket: 'tms', buyPrice: 3000, sellPrice: 1500, useContext: 'field', effect: { kind: 'tm', move: 'thunderbolt' } },
  repel:       { id: 'repel', name: 'Repel', pocket: 'field', buyPrice: 350, sellPrice: 175, useContext: 'field', effect: { kind: 'repel', steps: 100 } },
  escaperope:  { id: 'escaperope', name: 'Escape Rope', pocket: 'field', buyPrice: 550, sellPrice: 275, useContext: 'field', effect: { kind: 'escapeRope' } },
};

export function getItem(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}
