import type { StoryBeat } from '../../game/story';

/**
 * Five faction-choice story beats across the Mosaic region.
 *
 * Each beat fires when the player reaches the required badge count.
 * Purist choices push the Stabilize meter negative (toward Reset).
 * Synthesist choices push it positive (toward Embrace).
 * Neutral options let the player sit on the fence.
 */
export const STORY_BEATS: StoryBeat[] = [
  {
    id: 'beat_0_badges',
    requiredBadges: 0,
    dialogue: [
      "Aethel's Rest trembles as the Convergence Tide surges. The World Core pulses — regions bleed into one another at the horizon.",
      "A Purist elder grips your shoulder: 'The old worlds must be set free. This fusion is a wound that will not heal.'",
      "A Synthesist runner darts past, banner streaming: 'One world, one future — the Core was meant to unite us!'",
    ],
    choices: [
      { label: '"The old worlds deserve their own sky again."', faction: 'purist', meterDelta: -18 },
      { label: '"We are meant to be one. Let the Core finish its work."', faction: 'synthesist', meterDelta: 18 },
      { label: '"I need to see more before I pick a side."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_2_badges',
    requiredBadges: 2,
    dialogue: [
      "After Bramble's gym, the road through Kanto-Plains forks. On one side, a Purist encampment sorts displaced Pokémon back toward their 'original' regions.",
      "On the other, Synthesist engineers have built a bridge of woven light — a permanent tether between Kanto and Johto.",
      "A displaced Eevee whimpers at the crossroads, caught between two handlers from opposing factions.",
    ],
    choices: [
      { label: '"Help the Purists return the Pokémon to their home regions."', faction: 'purist', meterDelta: -18 },
      { label: '"Stand with the Synthesists — the bridge is the future."', faction: 'synthesist', meterDelta: 18 },
      { label: '"Take the Eevee yourself and decide later."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_4_badges',
    requiredBadges: 4,
    dialogue: [
      "At Voltspire's summit, Zap's lab reveals a terrifying truth: the Core has reset this convergence before. Scars in the data match your own save files.",
      "The Purists argue the cycle proves the fusion is unstable — it must be undone before the next collapse.",
      "The Synthesists counter that each reset is the Core learning, adapting — the next cycle will hold if given the chance.",
    ],
    choices: [
      { label: '"If it has failed before, we must stop it from failing again. Reset now."', faction: 'purist', meterDelta: -20 },
      { label: '"The Core is evolving. Let it reach its next form."', faction: 'synthesist', meterDelta: 20 },
      { label: '"Neither side has the full picture. I keep moving."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_6_badges',
    requiredBadges: 6,
    dialogue: [
      "Glacia's Frostfell is half-melted. The Ice biome bleeds into Hoenn's beaches — penguins waddle through palm fronds.",
      "Wraith, the Ghost Elite, appears at the shore. 'I remember every cycle,' she whispers. 'Every Reset. Every life unmade.'",
      "'Your Pokémon — the ones born of convergence — they cease to exist if you choose Reset. Are you prepared for that cost?'",
    ],
    choices: [
      { label: '"Some sacrifices are necessary for the greater truth."', faction: 'purist', meterDelta: -20 },
      { label: '"No life born of this world is expendable. We embrace it."', faction: 'synthesist', meterDelta: 20 },
      { label: '"There must be a third way. I will find it."', faction: 'neutral', meterDelta: 0 },
    ],
  },
  {
    id: 'beat_8_badges',
    requiredBadges: 8,
    dialogue: [
      "The Elite Four's chamber. Ferrum, Lumina, Wraith, and Kairos stand at the Core's edge — the Warden awaits beyond.",
      "Ferrum: 'Forge the world anew, or shatter the mold entirely.'",
      "Lumina: 'Beauty in unity, or beauty in separation — the Core cannot hold both forever.'",
      "Kairos cracks his knuckles. 'Break the cycle by will, or let it run its course. The choice is yours, Trainer.'",
    ],
    choices: [
      { label: '"The cycle ends with me. I choose Reset — restore what was."', faction: 'purist', meterDelta: -22 },
      { label: '"The cycle evolves through me. I choose Embrace — one world, forever."', faction: 'synthesist', meterDelta: 22 },
      { label: '"I will face the Warden and decide with clear eyes."', faction: 'neutral', meterDelta: 0 },
    ],
  },
];
