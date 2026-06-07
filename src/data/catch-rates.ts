// Base catch rates (Gen-style 0..255). Sourced from public PokeAPI/Bulbapedia data.
// NOTE: Showdown's Dex does NOT provide catchRate, so we own this table.
export const CATCH_RATES: Record<string, number> = {
  pikachu: 190,
  caterpie: 255,
  gyarados: 45,
  mewtwo: 3,
};

export function baseCatchRate(speciesId: string): number {
  return CATCH_RATES[speciesId.toLowerCase()] ?? 45; // sensible default
}
