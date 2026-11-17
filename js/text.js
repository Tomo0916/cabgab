/* text.js — the words of a problem, in the chosen language (gen.js makes only the data) */
import { T, H, HX, esc } from './i18n.js';

export const subjName = s => T(`s.${s}`);
export const subjNameH = s => H(`s.${s}`);
export const opName = k => T(`op.${k}`);
export const opNameH = k => H(`op.${k}`);
const dirH = d => (d === 0 ? H('dir.none') : H(d > 0 ? 'dir.cw' : 'dir.ccw', { n: Math.abs(d) }));

/** the question line above the figures */
export function askHTML(p) {
  if (p.subject === 'rule') return H('ask.rule');
  if (p.subject === 'table') return H('ask.table', { marks: p.marks.join(' → ') });
  if (p.subject === 'cipher') return H('ask.cipher', { marks: p.marks.join(' → ') });
  return '';
}
/** why the answer is right */
export function explainHTML(p) {
  if (p.subject === 'calc') return H('ex.calc', { rhs: p.rhsValue, how: p.how, x: p.x });
  if (p.subject === 'rule') return HX('ex.rule', { a: dirH(p.da), b: dirH(p.db), mid: H(p.fillRule === 'alt' ? 'ex.midAlt' : 'ex.midSame') });
  if (p.subject === 'table') return p.marks.map((mk, i) => `${esc(mk)}: ${opNameH(p.ops[i])}`).join(' → ');
  return p.meaning.map(x => `${esc(x.g)}: ${opNameH(x.op)}`).join(' ／ ');
}
export { dirH };
