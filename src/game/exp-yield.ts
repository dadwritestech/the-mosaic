// Base experience yield (Showdown has no baseExp). Seeded core; full table is later bulk.
const EXP_YIELD: Record<string, number> = {
  pikachu: 112, raichu: 218, caterpie: 39, magikarp: 40, gyarados: 189,
  charmander: 62, charmeleon: 142, charizard: 267, snorlax: 189,
  bulbasaur: 64, squirtle: 63, eevee: 65, vaporeon: 184,
  pidgey: 50, rattata: 51, hoothoot: 52,
};

export function baseExpYield(species: string): number {
  return EXP_YIELD[species.toLowerCase()] ?? 100;
}
