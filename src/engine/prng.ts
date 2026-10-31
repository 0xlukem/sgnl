/**
 * Deterministic Mulberry32 PRNG.
 * Given the same seed, produces the exact same sequence of floats in [0, 1).
 */
export function createPRNG(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomRange(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randomInt(rng: () => number, min: number, max: number): number {
  return Math.floor(randomRange(rng, min, max + 1));
}
