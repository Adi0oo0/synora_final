/**
 * Red-flag detection on free text. A mirror of backend/app/safety/redflags.py,
 * so the notes box is screened even when the backend is unreachable. Someone can
 * describe an emergency in words while ticking mild boxes above it, and that
 * must never come back as "low".
 */
const PATTERNS = [
  ['cardiac', /\b(chest (pain|pressure|tightness|tight)|crushing chest|pain (radiat|spread)\w* to (my )?(arm|jaw|back)|elephant on my chest)\b/i, 'Chest pain or pressure, including pain spreading to the arm, jaw or back.'],
  ['stroke', /\b(face (is )?droop\w*|drooping face|slurr\w* speech|one side of my (face|body)|can'?t (move|feel) my (arm|leg|side)|sudden weakness)\b/i, 'Possible stroke signs: facial droop, slurred speech, one-sided weakness.'],
  ['breathing', /\b(can'?t breathe|cannot breathe|struggling to breathe|gasping|can'?t finish a sentence|blue lips)\b/i, 'Severe breathing difficulty.'],
  ['bleeding', /\b(coughing up blood|vomit\w* blood|blood in (my )?(stool|vomit|urine)|black tarry|bleeding (won'?t|will not) stop)\b/i, 'Bleeding that needs urgent assessment.'],
  ['neuro', /\b(worst headache (of my life|ever)|thunderclap|sudden(ly)? (confus|blind)\w*|seizure|passed out|fainted)\b/i, 'Sudden severe headache, collapse, seizure or new confusion.'],
  ['abdominal', /\b(rigid (abdomen|belly|stomach)|abdomen is hard|severe abdominal pain)\b/i, 'Severe or rigid abdomen.'],
  ['obstetric', /\b(no fetal movement|baby (isn'?t|is not) moving|heavy bleeding (and|while) pregnan)\w*\b/i, 'Pregnancy-related emergency signs.'],
];

export function screenText(text = '') {
  const categories = [];
  const reasons = [];
  for (const [name, pattern, reason] of PATTERNS) {
    if (pattern.test(text || '')) {
      categories.push(name);
      reasons.push(reason);
    }
  }
  return { triggered: categories.length > 0, categories, reasons };
}
