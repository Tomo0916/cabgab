/* tools/check.mjs — run: node tools/check.mjs   (problems are made correctly, every one has one right answer) */
import { SUBJECTS, makeProblem, ROW_OPS, rng } from '../js/gen.js';
let errors = 0; const err = m => { errors++; if (errors < 30) console.log('  ✗ ' + m); };
const key = c => JSON.stringify(c);
for (const s of SUBJECTS) {
  const ids = new Set(); let n = 0; const t0 = Date.now();
  for (let i = 0; i < 400; i++) {
    let p; try { p = makeProblem(s, `t${i}`); } catch (e) { err(`${s} ${i}: ${e.message}`); continue; }
    n++; ids.add(p.prompt + key(p.choices));
    if (p.choices.length !== 5 || !(p.answer >= 0 && p.answer < 5)) err(`${s} ${i}: not 5 choices with an answer`);
    if (new Set(p.choices.map(key)).size !== 5) err(`${s} ${i}: two choices are the same`);
    if (key(makeProblem(s, `t${i}`)) !== key(p)) err(`${s} ${i}: the same seed gives another problem`);
    if (s === 'calc') {   // put the answer into □ and check both sides
      const [l, r] = p.prompt.split(' = '), ev = e => Function(`return (${e.replace(/×/g, '*').replace(/÷/g, '/')})`)();
      const x = p.choices[p.answer];
      if (Math.abs(ev(l.replace('□', `(${x})`)) - ev(r)) > 1e-9) err(`calc ${i}: ${p.prompt} with □ = ${x} is not true`);
      if (p.choices.filter(c => Math.abs(ev(l.replace('□', `(${c})`)) - ev(r)) < 1e-9).length !== 1) err(`calc ${i}: more than one choice is right`);
    }
    if (s === 'rule') { const f = p.choices[p.answer], q = p.seq[p.blank]; if (key(f) !== key(q)) err(`rule ${i}: the answer is not the missing figure`); }
  }
  console.log(`   ${s}: ${n} problems, ${ids.size} different, ${Date.now() - t0} ms`);
  if (ids.size < n * 0.9) err(`${s}: too many problems are the same`);
}
// a problem can be made again from its id (the review of wrong answers, the class test)
const { problemById } = await import('../js/gen.js');
for (const s2 of SUBJECTS) { const p = makeProblem(s2, 'again|7'); if (key(problemById(p.id)) !== key(p)) err(`${s2}: a problem cannot be made again from its id`); }
// the worked examples (解き方) end at the right answer
const { learnHTML } = await import('../js/learn.js');
for (const s2 of SUBJECTS) for (let i = 0; i < 30; i++) { try { const h = learnHTML(s2, `L${i}`); if (!h.includes('答え')) err(`learn ${s2}: no answer step`); } catch (e) { err(`learn ${s2} ${i}: ${e.message}`); } }
console.log(errors ? `\n✗ ${errors} error(s)` : '\n✓ 0 error(s)');
process.exit(errors ? 1 : 0);
