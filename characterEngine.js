const CHAR_PATH = "./data/characters.json";
const IMAGE_BASE = "./assets/images/";

export function getCharacterImageUrl(filename) {
  if (!filename) return "";
  return `${IMAGE_BASE}${filename}`;
}

function createSeededRng(seedStr) {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function next() {
    h ^= h << 13;
    h ^= h >>> 7;
    h ^= h << 17;
    return (h >>> 0) / 0xffffffff;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

let _cache = null;

export async function loadAllCharacters() {
  if (_cache) return _cache;
  const res = await fetch(CHAR_PATH);
  if (!res.ok) throw new Error(`Failed to load ${CHAR_PATH}`);
  _cache = await res.json();
  return _cache;
}

/**
 * Deterministic pool after dice: shuffle full roster with seeded RNG, take first 4.
 */
export async function pickCharacterPool(seedStr) {
  const all = await loadAllCharacters();
  const rng = createSeededRng(seedStr);
  const ids = all.map((c) => c.id);
  shuffleInPlace(ids, rng);
  const pickedIds = ids.slice(0, Math.min(4, ids.length));
  const byId = Object.fromEntries(all.map((c) => [c.id, c]));
  return pickedIds.map((id) => ({ ...byId[id] }));
}

export function buildRuntimeForCharacter(character) {
  const base = {
    stoneCounters: 0,
    hairTokens: 0,
    anointedAvailable: false,
    jealousyUsedThisTurn: false,
    tauntUsedThisTurn: false,
    ehudBonusRoll: null,
  };

  if (!character) return base;

  switch (character.id) {
    case "david":
      return {
        ...base,
        stoneCounters: 5,
        divineStance: "ready",
        anointedAvailable: false,
      };
    case "samson":
      return { ...base, hairTokens: 3, anointedAvailable: false };
    case "king_saul":
      return {
        ...base,
        anointedAvailable: true,
        anointedUsed: false,
        jealousyUsedThisTurn: false,
      };
    default:
      return { ...base, anointedAvailable: false };
  }
}
