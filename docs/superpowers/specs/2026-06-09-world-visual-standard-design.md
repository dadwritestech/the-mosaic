# World Visual Standard — Design

**Date:** 2026-06-09
**Status:** Approved (standard); implementation to follow via writing-plans.
**Parent:** `2026-06-07-presentation-5-design.md`
**Context:** The 3D overworld worked but looked "bad" — crude primitives next to the
real 3D Pokémon models, claustrophobic walled boxes, flat lighting. This spec
locks the *target look* (a standard) so all further world work builds toward one
agreed direction, verified against an acceptance test.

## Reference & vibe

Pokémon **Let's Go** (Pikachu/Eevee): bright, soft, semi-realistic **stylized 3D**.
Warm daytime sun, gentle bloom, light atmospheric haze. The world must read as
*crafted* and cohesive with the real 3D Pokémon models already in-game.

## The standard (the pillars)

1. **Structure — open, naturally-bounded fields.** No 9×6 boxes ringed by a solid
   tree wall. Larger ground areas; borders are tree lines, cliffs, water, fences —
   soft and organic. Areas flow together. *(Architectural reach: this changes the
   server's map data, not just the renderer.)*
2. **Fidelity — hybrid.** A handcrafted stylized low-poly **prop library**
   (`web/overworld/props.ts`: trees, pines, rocks, bushes, flowers, grass tufts,
   fences, signposts — already built) is the cohesive base. Real **CC0/ripped GLB
   hero models** (buildings, landmarks) drop into `web/public/props/` when sourced.
   Auto-fetching CC0 packs is unreliable, so hero assets land opportunistically;
   the handcrafted base always carries the look.
3. **Terrain.** Textured grass with subtle color variation + **gentle undulation**
   (not a flat plane); worn dirt paths; soft contact shadows.
4. **Camera.** 3/4 tilted follow-cam, pulled back a touch for openness, smooth
   easing (Let's Go framing).
5. **Lighting/palette.** Warm directional sun + sky/ground hemisphere fill + **soft
   ambient occlusion** for depth; bright, slightly-desaturated palette; gentle
   bloom; light distance fog.
6. **Character.** Player upgraded from primitive blocks to a proper stylized 3D
   character (built after the world).
7. **Buildings.** Pokémon Center / Shop / Gym / houses as real low-poly building
   models (handcrafted or CC0), not box+cone — with doors that read as enterable.

## Acceptance test ("does it meet standard?")

- No claustrophobic walls; the field reads as open.
- Props read as **crafted**, not primitive.
- Cohesive with the real Pokémon models.
- Warm, soft daylight with depth (AO/shadows).
- Smooth, open follow-camera.

## Confirmed by prototype

`props.ts` was built (pi) and wired into the field: 'wall'→layered low-poly trees,
'grass'→grass tufts + occasional flower/bush. On-screen this already replaces the
sphere-blob trees with crafted ones — confirming the handcrafted-base direction.
Committed as the first concrete step.

## Implementation decomposition (for the plan)

The look pillars are presentation-only and low-risk; the open-field structure
touches map data. Sequence them so visuals never block on content:

- **W1 — Scene treatment (renderer only):** terrain material + gentle undulation,
  warm lighting + ambient occlusion (GTAO), camera pull-back/easing, fog/palette
  tuning, scatter decorative props (rocks/flowers/grass) on open ground. No map
  changes; immediate visual lift.
- **W2 — Building models:** replace box+cone Center/Shop/Gym/house with real
  low-poly building models (handcrafted; swap to CC0 GLB hero models where found).
- **W3 — Open-field map data:** redesign the slice locations as larger,
  organically-bounded maps (new bigger tilemaps; tree-line/water/cliff borders
  instead of wall rings). Renderer already data-driven, so this is content + light
  renderer support (border tiles, larger ground).
- **W4 — Player character model:** stylized 3D character with walk animation,
  replacing the primitive.
- **W5 — Lived-in polish (later, 5c):** NPC characters, ambient particles, grass
  sway, day/night tint.

Each is independently shippable and screenshot-verifiable. W1 first (biggest
look-per-effort, zero content risk).

## Out of scope

Full 18-location world rebuild (that's the region-expansion work, separate);
battle-scene art (already on real 3D models); audio.
