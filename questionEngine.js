const Q_PATH = "./data/questions.json";

let _cache = null;

export async function loadAllQuestions() {
  if (_cache) return _cache;
  const res = await fetch(Q_PATH);
  if (!res.ok) throw new Error(`Failed to load ${Q_PATH}`);
  _cache = await res.json();
  return _cache;
}

/**
 * @param {string} attackType 'light' | 'heavy'
 * @param {string[]} usedIds
 * @param {() => number} [rng] 0..1
 */
export async function nextQuestion(attackType, usedIds, rng = Math.random) {
  const all = await loadAllQuestions();
  const pool = all.filter(
    (q) => q.type === attackType && !usedIds.includes(q.id)
  );
  if (pool.length === 0) {
    const any = all.filter((q) => !usedIds.includes(q.id));
    if (any.length === 0) {
      return { error: "no_questions" };
    }
    return { question: any[Math.floor(rng() * any.length)] };
  }
  return { question: pool[Math.floor(rng() * pool.length)] };
}
