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
function shuffleArray(array, rng) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function shuffleChoices(question, rng = Math.random) {
  const choices = shuffleArray(question.choices, rng);
  const correctAnswer = question.choices[question.correctIndex];
  const correctIndex = choices.findIndex((choice) => choice === correctAnswer);
  return {
    ...question,
    choices,
    correctIndex,
  };
}

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
    return { question: shuffleChoices(any[Math.floor(rng() * any.length)], rng) };
  }
  return { question: shuffleChoices(pool[Math.floor(rng() * pool.length)], rng) };
}
