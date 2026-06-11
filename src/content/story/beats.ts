import type { StoryBeat } from '../../game/story';

/**
 * Five faction-choice story beats across the rift run.
 *
 * Each beat fires once the player has addressed (sealed or attuned) the
 * required number of rifts. Purist choices push the Stabilize meter negative
 * (toward Reset); Synthesist choices push it positive (toward Embrace);
 * neutral options let the player sit on the fence.
 */
export const STORY_BEATS: StoryBeat[] = [
  {
    id: 'beat_0_rifts',
    requiredRifts: 0,
    dialogue: [
      "Aethel's Rest trembles as the Convergence Tide surges. The World Core pulses — worlds bleed into one another along the rifts.",
      "A Purist elder grips your shoulder: 'Seal the rifts. The old worlds must be set free. This fusion is a wound that will not heal.'",
      "A Synthesist runner darts past, banner streaming: 'Attune to them — one world, one future, the way the Core intends!'",
    ],
    choices: [
      { label: '"The old worlds deserve their own sky again."', faction: 'purist', meterDelta: -18 },
      { label: '"We are meant to be one. Let the Core finish its work."', faction: 'synthesist', meterDelta: 18 },
      { label: '"I need to see more before I pick a side."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_2_rifts',
    requiredRifts: 2,
    dialogue: [
      "Past the second seam, the road forks. On one side, a Purist encampment sorts displaced Pokémon back toward their 'original' worlds.",
      "On the other, Synthesist engineers have woven a bridge of light across a rift — a permanent tether between two worlds.",
      "A displaced Eevee whimpers at the crossroads, caught between two handlers from opposing factions.",
    ],
    choices: [
      { label: '"Help the Purists return the Pokémon to their home worlds."', faction: 'purist', meterDelta: -18 },
      { label: '"Stand with the Synthesists — the bridge is the future."', faction: 'synthesist', meterDelta: 18 },
      { label: '"Take the Eevee yourself and decide later."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_4_rifts',
    requiredRifts: 4,
    dialogue: [
      "At a Warden's ruined outpost you find a terrible truth: the Core has reset this convergence before. The scars in the data match your own save.",
      "The Purists argue the cycle proves the fusion is unstable — it must be undone before the next collapse.",
      "The Synthesists counter that each reset is the Core learning, adapting — the next cycle will hold if given the chance.",
    ],
    choices: [
      { label: '"If it has failed before, we must stop it from failing again. Seal them all."', faction: 'purist', meterDelta: -20 },
      { label: '"The Core is evolving. Let it reach its next form."', faction: 'synthesist', meterDelta: 20 },
      { label: '"Neither side has the full picture. I keep moving."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_6_rifts',
    requiredRifts: 6,
    dialogue: [
      "The Frostbloom seam is half-thawed — a frozen garden bleeding into tundra, blossoms locked in ice.",
      "A herald of the Core appears in the drifting snow. 'I remember every cycle,' she whispers. 'Every Reset. Every life unmade.'",
      "'Your Pokémon — the ones born of the rifts — they cease to exist if you Seal it all away. Are you prepared for that cost?'",
    ],
    choices: [
      { label: '"Some sacrifices are necessary for the greater truth."', faction: 'purist', meterDelta: -20 },
      { label: '"No life born of this world is expendable. We embrace it."', faction: 'synthesist', meterDelta: 20 },
      { label: '"There must be a third way. I will find it."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_7_rifts',
    requiredRifts: 7,
    dialogue: [
      "Beyond the Maw, the World Core roars at the heart of the converged world. The Warden of the Core stands at its edge.",
      "'Every rift you touched bent the world your way,' the Warden says. 'Forge it anew, or shatter the mould entirely.'",
      "'Break the cycle by will, or let it run its course. The choice has always been yours, Trainer.'",
    ],
    choices: [
      { label: '"The cycle ends with me. I choose Reset — restore what was."', faction: 'purist', meterDelta: -22 },
      { label: '"The cycle evolves through me. I choose Embrace — one world, forever."', faction: 'synthesist', meterDelta: 22 },
      { label: '"I will face the Warden and decide with clear eyes."', faction: 'neutral', meterDelta: 0 },
    ],
  },
];
