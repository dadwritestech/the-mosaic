import type { Location, TrainerDef, GymDef } from './types';
import type { ShopDef } from '../game/shop';
import { LOCATIONS, TRAINERS, GYMS, SHOPS } from './slice/data';

const locById = new Map(LOCATIONS.map((l) => [l.id, l]));
const trainerById = new Map(TRAINERS.map((t) => [t.id, t]));
const gymById = new Map(GYMS.map((g) => [g.id, g]));
const shopById = new Map(SHOPS.map((s) => [s.id, s]));

export function getLocation(id: string): Location { const v = locById.get(id); if (!v) throw new Error(`Unknown location: ${id}`); return v; }
export function getTrainer(id: string): TrainerDef { const v = trainerById.get(id); if (!v) throw new Error(`Unknown trainer: ${id}`); return v; }
export function getGym(id: string): GymDef { const v = gymById.get(id); if (!v) throw new Error(`Unknown gym: ${id}`); return v; }
export function getShop(id: string): ShopDef { const v = shopById.get(id); if (!v) throw new Error(`Unknown shop: ${id}`); return v; }
export function neighbors(id: string): string[] { return getLocation(id).connections.slice(); }
