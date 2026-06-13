import type { SeqOpponent } from '../../game/battle-sequence';
import type { EndingId } from '../../game/ending';

const IVS = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

// ── Helper: build a PokemonSet ──────────────────────────────────────────
function mon(
  name: string, species: string, ability: string, item: string,
  moves: string[], nature: string,
  evs: { hp: number; atk: number; def: number; spa: number; spd: number; spe: number },
  level: number,
) {
  return { name, species, ability, item, moves, nature, evs, ivs: IVS, level };
}

// ── EV spread templates ────────────────────────────────────────────────
const attk  = { hp: 0,   atk: 252, def: 0,   spa: 0,   spd: 0,   spe: 252 };
const sAtk  = { hp: 0,   atk: 0,   def: 0,   spa: 252, spd: 0,   spe: 252 };
const bulk  = { hp: 252, atk: 0,   def: 0,   spa: 0,   spd: 252, spe: 0   };
const tank  = { hp: 252, atk: 0,   def: 252, spa: 0,   spd: 0,   spe: 0   };
const speed = { hp: 0,   atk: 0,   def: 0,   spa: 0,   spd: 0,   spe: 252 };
const mixed = { hp: 84,  atk: 172, def: 0,   spa: 0,   spd: 0,   spe: 252 };

// ── ELITE FOUR ─────────────────────────────────────────────────────────

/**
 * Ferrum — Steel specialist. Unyielding industrialist.
 * "Forge the world anew."
 */
const FERRUM: SeqOpponent = {
  id: 'ferrum',
  name: 'Ferrum',
  team: [
    mon('Corviknight', 'Corviknight', 'Pressure', 'Assault Vest',
      ['brave-bird', 'steel-wing', 'iron-head', 'u-turn'], 'Jolly', attk, 58),
    mon('Bronzong', 'Bronzong', 'Levitate', 'Leftovers',
      ['heavy-slam', 'earthquake', 'hypnosis', 'stealth-rock'], 'Sassy', bulk, 59),
    mon('Heatran', 'Heatran', 'Flash Fire', 'Leftovers',
      ['flamethrower', 'earthquake', 'stealth-rock', 'protect'], 'Calm', bulk, 60),
    mon('Aggron', 'Aggron', 'Sturdy', 'Rocky Helmet',
      ['heavy-slam', 'earthquake', 'stone-edge', 'stealth-rock'], 'Impish', tank, 60),
    mon('Metagross', 'Metagross', 'Light Metal', 'Choice Band',
      ['meteor-mash', 'earthquake', 'stone-edge', 'ice-punch'], 'Adamant', attk, 61),
  ],
};

/**
 * Lumina — Fairy specialist. Sweet-voiced enchantress with a ruthless agenda.
 * "Beauty in unity, or beauty in separation."
 */
const LUMINA: SeqOpponent = {
  id: 'lumina',
  name: 'Lumina',
  team: [
    mon('Sylveon', 'Sylveon', 'Pixilate', 'Life Orb',
      ['moonblast', 'psyshock', 'hyper-voice', 'encore'], 'Timid', sAtk, 58),
    mon('Gardevoir', 'Gardevoir', 'Trace', 'Focus Sash',
      ['moonblast', 'psychic', 'shadow-ball', 'calm-mind'], 'Timid', sAtk, 59),
    mon('Clefable', 'Clefable', 'Magic Guard', 'Leftovers',
      ['moonblast', 'soft-boiled', 'light-screen', 'reflect'], 'Calm', bulk, 59),
    mon('Togekiss', 'Togekiss', 'Serene Grace', 'Leftovers',
      ['dazzling-gleam', 'aura-sphere', 'roost', 'wish'], 'Calm', bulk, 60),
    mon('Florges', 'Florges', 'Flower Veil', 'Life Orb',
      ['drain-punch', 'play-rough', 'giga-drain', 'aromatherapy'], 'Jolly', attk, 60),
  ],
};

/**
 * Wraith — Ghost specialist. Remembers every past cycle.
 * The most adaptive opponent.
 */
const WRAITH: SeqOpponent = {
  id: 'wraith',
  name: 'Wraith',
  team: [
    mon('Gengar', 'Gengar', 'Cursed Body', 'Life Orb',
      ['shadow-ball', 'sludge-wave', 'focus-blast', 'nasty-plot'], 'Timid', sAtk, 59),
    mon('Chandelure', 'Chandelure', 'Infiltrator', 'Life Orb',
      ['shadow-ball', 'fire-blast', 'nasty-plot', 'will-o-wisp'], 'Timid', sAtk, 60),
    mon('Aegislash', 'Aegislash', 'Stance Change', 'Leftovers',
      ['shadow-sneak', 'swords-dance', 'king-shield', 'shadow-claw'], 'Jolly', attk, 58),
    mon('Mismagius', 'Mismagius', 'Levitate', 'Life Orb',
      ['shadow-ball', 'nasty-plot', 'will-o-wisp', 'hex'], 'Timid', sAtk, 60),
    mon('Banette', 'Banette', 'Insomnia', 'Focus Sash',
      ['shadow-claw', 'sucker-punch', 'knock-off', 'phantom-force'], 'Jolly', attk, 59),
  ],
};

/**
 * Kairos — Fighting specialist. Disciplined monk seeking to break the cycle.
 * "Break the cycle by will."
 */
const KAIROS: SeqOpponent = {
  id: 'kairos',
  name: 'Kairos',
  team: [
    mon('Lucario', 'Lucario', 'Inner Focus', 'Life Orb',
      ['close-combat', 'aura-sphere', 'extreme-speed', 'bulk-up'], 'Jolly', attk, 59),
    mon('Conkeldurr', 'Conkeldurr', 'Iron Fist', 'Life Orb',
      ['drain-punch', 'hammer-arm', 'superpower', 'ice-punch'], 'Jolly', attk, 60),
    mon('Hariyama', 'Hariyama', 'Guts', 'Life Orb',
      ['close-combat', 'hammer-arm', 'superpower', 'bulk-up'], 'Jolly', attk, 58),
    mon('Breloom', 'Breloom', 'Technician', 'Life Orb',
      ['mach-punch', 'bullet-seed', 'stone-edge', 'spore'], 'Jolly', attk, 60),
    mon('Incineroar', 'Incineroar', 'Intimidate', 'Assault Vest',
      ['flamethrower', 'darkest-lariat', 'superpower', 'knock-off'], 'Impish', bulk, 61),
  ],
};

export const ELITE_FOUR: SeqOpponent[] = [FERRUM, LUMINA, WRAITH, KAIROS];

// ── CHAMPION ───────────────────────────────────────────────────────────

/**
 * The Warden — neutral arbiter. One legendary per era.
 * Tests whether the player is worthy to choose the world's fate.
 */
export const CHAMPION: SeqOpponent = {
  id: 'champion_warden',
  name: 'The Warden',
  team: [
    // Gen 1 — Mewtwo
    mon('Mewtwo', 'Mewtwo', 'Pressure', 'Leftovers',
      ['psystrike', 'shadow-ball', 'ice-beam', 'recover'], 'Calm', bulk, 65),
    // Gen 2 — Lugia
    mon('Lugia', 'Lugia', 'Multiscale', 'Leftovers',
      ['aeroblast', 'hydro-pump', 'whirlwind', 'roost'], 'Calm', bulk, 65),
    // Gen 3 — Rayquaza
    mon('Rayquaza', 'Rayquaza', 'Air Lock', 'Life Orb',
      ['dragon-ascent', 'earthquake', 'outrage', 'dragon-dance'], 'Jolly', attk, 65),
    // Gen 4 — Dialga
    mon('Dialga', 'Dialga', 'Pressure', 'Leftovers',
      ['draco-meteor', 'iron-head', 'stealth-rock', 'roost'], 'Bold', bulk, 65),
    // Gen 5 — Reshiram
    mon('Reshiram', 'Reshiram', 'Turboblaze', 'Life Orb',
      ['fusion-flare', 'dragon-claw', 'stone-edge', 'overheat'], 'Jolly', attk, 65),
    // Gen 8 — Zacian
    mon('Zacian', 'Zacian', 'Intrepid Sword', 'Rusted Sword',
      ['behemoth-bash', 'play-rough', 'smart-strike', 'substitute'], 'Jolly', attk, 65),
  ],
};

// ── VRISKA GAUNTLET ────────────────────────────────────────────────────
/**
 * Three rooms of Gym 7 (Dragon). Each room is Dragon-led with a shifting
 * secondary theme. Levels 46-50.
 */

/** Room 1 — Dragon + Steel: the forge of Drakemaw. */
const VRISKA_ROOM_1: SeqOpponent = {
  id: 'vriska_room_1',
  name: 'Vriska — The Forge',
  team: [
    mon('Duraludon', 'Duraludon', 'Light Metal', 'Life Orb',
      ['flash-cannon', 'dragon-claw', 'iron-head', 'stealth-rock'], 'Jolly', attk, 46),
    mon('Dragapult', 'Dragapult', 'Infiltrator', 'Choice Scarf',
      ['dragon-darts', 'shadow-ball', 'hex', 'u-turn'], 'Jolly', attk, 47),
    mon('Garchomp', 'Garchomp', 'Rough Skin', 'Life Orb',
      ['earthquake', 'dragon-claw', 'stone-edge', 'dragon-dance'], 'Jolly', attk, 48),
  ],
};

/** Room 2 — Dragon + Water: the tidal depths. */
const VRISKA_ROOM_2: SeqOpponent = {
  id: 'vriska_room_2',
  name: 'Vriska — The Tides',
  team: [
    mon('Kingdra', 'Kingdra', 'Swift Swim', 'Life Orb',
      ['dragon-pulse', 'hydro-pump', 'ice-beam', 'dragon-dance'], 'Jolly', attk, 47),
    mon('Goodra', 'Goodra', 'Sap Sipper', 'Leftovers',
      ['dragon-pulse', 'sludge-wave', 'fire-blast', 'dragon-dance'], 'Quiet', sAtk, 48),
    mon('Dragonite', 'Dragonite', 'Multiscale', 'Life Orb',
      ['outrage', 'waterfall', 'fire-punch', 'dragon-dance'], 'Jolly', attk, 49),
  ],
};

/** Room 3 — Dragon + Dark: the shadowed peak. Vriska herself. */
const VRISKA_ROOM_3: SeqOpponent = {
  id: 'vriska_room_3',
  name: 'Vriska — The Shadow',
  team: [
    mon('Hydreigon', 'Hydreigon', 'Levitate', 'Life Orb',
      ['dragon-pulse', 'dark-pulse', 'focus-blast', 'roost'], 'Jolly', sAtk, 48),
    mon('Haxorus', 'Haxorus', 'Rivalry', 'Life Orb',
      ['dragon-claw', 'outrage', 'earthquake', 'swords-dance'], 'Jolly', attk, 49),
    mon('Baxcalibur', 'Baxcalibur', 'Thick Fat', 'Life Orb',
      ['ice-fang', 'dragon-claw', 'dragon-dance', 'close-combat'], 'Jolly', attk, 50),
  ],
};

export const VRISKA_GAUNTLET: SeqOpponent[] = [
  VRISKA_ROOM_1,
  VRISKA_ROOM_2,
  VRISKA_ROOM_3,
];

// ── ENDING NARRATION ───────────────────────────────────────────────────

export const ENDING_NARRATION: Record<EndingId, string> = {
  reset: `
    You place your hand on the World Core and speak the word: Reset.
    The convergence unravels. Regions peel apart like pages of a book closing.
    Your convergence-born Pokémon — the ones you caught, the ones born of this fused world —
    dissolve into light. They were never meant to last, and yet they were real.
    The old skies return. Kanto, Johto, Hoenn — whole again, but diminished.
    Aethel watches from the edge of the Core, tears catching the dawn.
    "Perhaps next cycle," she whispers, "we will choose differently."
    The world resets. But you remember.
  `,
  embrace: `
    You place your hand on the World Core and speak the word: Embrace.
    The Core flares — a supernova of memory and becoming. Regions fuse, irrevocably.
    Kanto's cities rise beside Johto's forests; Hoenn's beaches lap at Sinnoh's tundra.
    New species stir in the wilds, born of the merger. Your convergence-born Pokémon
    glow brighter than ever — they are the children of this new world, and it will hold.
    The Elite Four lower their weapons. Even Ferrum nods.
    The cycle does not end — it evolves. And this time, it holds.
  `,
  balance: `
    You place your hand on the World Core and speak neither Reset nor Embrace.
    You speak the third word — the one the Core has been waiting for: Balance.
    The convergence does not unravel, nor does it fuse. It breathes.
    Regions remain distinct but connected by bridges of light — the Core's new rhythm.
    Your convergence-born Pokémon stand firm, neither erased nor bound to one form.
    The Elite Four exchange glances. Wraith smiles — she has waited cycles for this.
    The cycle does not end. It does not evolve. It finds equilibrium.
    And in that balance, the world remembers everything — and forgives itself.
  `,
};
