/* =========================================================
 * gen.js — problems made by the program (no DOM: tools/check.mjs tests it).
 * Original problems in the style of the computer-aptitude tests
 * (四則逆算・法則性・命令表・暗号). Nothing is copied from a real test.
 *
 * Every problem: { id, subject, prompt, choices: [5], answer (index), explain, ...data for drawing }
 * The same seed always gives the same problem.
 * ========================================================= */

/* ---------- random numbers that can be repeated ---------- */
export function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rng(seed) {
  let a = hashStr(String(seed)) || 1;
  const next = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  const pick = arr => arr[Math.floor(next() * arr.length)];
  const shuffle = arr => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
  return { next, int, pick, shuffle };
}
/** the correct answer and the wrong ones in a random order → { choices, answer } */
function mix(R, right, wrong, key = x => JSON.stringify(x)) {
  const seen = new Set([key(right)]), w = [];
  for (const x of wrong) { const k = key(x); if (!seen.has(k)) { seen.add(k); w.push(x); } if (w.length === 4) break; }
  if (w.length < 4) return null;
  const choices = R.shuffle([right, ...w]);
  return { choices, answer: choices.findIndex(c => key(c) === key(right)) };
}

export const SUBJECTS = ['calc', 'rule', 'table', 'cipher'];
export const SUBJECT_NAME = { calc: '四則逆算', rule: '法則性', table: '命令表', cipher: '暗号' };
/* mock test: the number of problems and the time (a guide close to the web test) */
export const MOCK = { calc: { n: 50, sec: 9 * 60 }, rule: { n: 30, sec: 12 * 60 }, table: { n: 36, sec: 15 * 60 }, cipher: { n: 30, sec: 16 * 60 } };

/* =========================================================
 * 1. 四則逆算: find □.   a ○ □ = b ○ c  and similar
 * ========================================================= */
const OPS = { '+': (a, b) => a + b, '-': (a, b) => a - b, '×': (a, b) => a * b, '÷': (a, b) => a / b };
const isNice = v => Number.isFinite(v) && Math.abs(v - Math.round(v * 100) / 100) < 1e-9 && v > 0 && v < 10000;
const fmt = v => String(Math.round(v * 100) / 100);
export function calcProblem(seed) {
  const R = rng(`calc|${seed}`);
  for (let t = 0; t < 200; t++) {
    const x = R.pick([R.int(2, 19), R.int(2, 99), R.int(10, 200), R.int(1, 9) * 0.5 + R.int(1, 9)]);
    const op = R.pick(['+', '-', '×', '÷']), a = op === '×' || op === '÷' ? R.pick([R.int(2, 12), 0.5, 0.25, 1.5, 2.5]) : R.int(2, 300);
    const side = R.next() < 0.5 ? 'left' : 'right';   // □ ○ a  or  a ○ □
    const lhs = side === 'left' ? OPS[op](x, a) : OPS[op](a, x);
    if (!isNice(lhs)) continue;
    // the right side: lhs written as  b ○ c  (or just a number)
    let rhs = fmt(lhs), rv = lhs;
    if (R.next() < 0.7) {
      const op2 = R.pick(['+', '-', '×', '÷']);
      let b, c;
      if (op2 === '+') { c = R.int(1, Math.max(1, Math.floor(lhs) - 1)); b = lhs - c; }
      else if (op2 === '-') { c = R.int(1, 99); b = lhs + c; }
      else if (op2 === '×') { const ds = [2, 3, 4, 5, 6, 8, 0.5].filter(d => isNice(lhs / d)); if (!ds.length) continue; c = R.pick(ds); b = lhs / c; }
      else { c = R.pick([2, 3, 4, 5, 8]); b = lhs * c; }
      if (!isNice(b) || !isNice(c)) continue;
      rhs = `${fmt(b)} ${op2} ${fmt(c)}`; rv = OPS[op2](b, c);
      if (Math.abs(rv - lhs) > 1e-9) continue;
    }
    const left = side === 'left' ? `□ ${op} ${fmt(a)}` : `${fmt(a)} ${op} □`;
    const near = [x + 1, x - 1, x + 2, x * 2, x / 2, x + 10, x - 10, x * 10, x / 10].filter(isNice).filter(v => Math.abs(v - x) > 1e-9);
    const m = mix(R, fmt(x), R.shuffle(near).map(fmt), k => k);
    if (!m) continue;
    const inv = { '+': '−', '-': side === 'left' ? '＋' : '（a − 右辺）', '×': '÷', '÷': side === 'left' ? '×' : '（a ÷ 右辺）' }[op];
    const how = op === '+' ? `□ = ${fmt(lhs)} − ${fmt(a)}`
      : op === '-' ? (side === 'left' ? `□ = ${fmt(lhs)} + ${fmt(a)}` : `□ = ${fmt(a)} − ${fmt(lhs)}`)
      : op === '×' ? `□ = ${fmt(lhs)} ÷ ${fmt(a)}`
      : (side === 'left' ? `□ = ${fmt(lhs)} × ${fmt(a)}` : `□ = ${fmt(a)} ÷ ${fmt(lhs)}`);
    return { id: `calc:${seed}`, subject: 'calc', prompt: `${left} = ${rhs}`, choices: m.choices, answer: m.answer,
      explain: `右辺を先に計算すると ${fmt(lhs)}。${how} = ${fmt(x)}。` + (inv ? '' : '') };
  }
  throw new Error('calc: no problem');
}

/* =========================================================
 * 2. 法則性: five figures follow a rule; one is missing.
 * A figure: a square with 8 places around the edge (0 = top-left, clockwise),
 * a black circle at `a`, a white triangle at `b`, and the middle filled or not.
 * ========================================================= */
export function ruleProblem(seed) {
  const R = rng(`rule|${seed}`);
  for (let t = 0; t < 100; t++) {
    const da = R.pick([1, 2, 3, -1, -2]), db = R.pick([0, 1, -1, 2, -3]), a0 = R.int(0, 7), b0 = R.int(0, 7);
    const fillRule = R.pick(['alt', 'same', 'two']);   // alternate / always the same / two then change
    const fill0 = R.next() < 0.5;
    const fillAt = i => (fillRule === 'alt' ? (i % 2 === 0) === fill0 : fillRule === 'same' ? fill0 : (Math.floor(i / 2) % 2 === 0) === fill0);
    const fig = i => ({ a: ((a0 + da * i) % 8 + 8) % 8, b: ((b0 + db * i) % 8 + 8) % 8, fill: fillAt(i) });
    const seq = [0, 1, 2, 3, 4].map(fig);
    if (seq.some(f => f.a === f.b)) continue;   // the two marks never share a place
    if (fillRule === 'two') continue;            // (kept simple: alternate or the same)
    const blank = R.int(1, 4), right = seq[blank];
    const variants = [{ ...right, a: (right.a + 1) % 8 }, { ...right, a: (right.a + 7) % 8 }, { ...right, b: (right.b + 1) % 8 }, { ...right, b: (right.b + 7) % 8 },
      { ...right, fill: !right.fill }, { ...right, a: right.b, b: right.a }].filter(f => f.a !== f.b);
    const m = mix(R, right, R.shuffle(variants));
    if (!m) continue;
    const dir = d => (d === 0 ? '動かない' : `${d > 0 ? '時計回り' : '反時計回り'}に ${Math.abs(d)} つずつ進む`);
    return { id: `rule:${seed}`, subject: 'rule', prompt: '?に入る図形はどれ？', seq, blank, choices: m.choices, answer: m.answer,
      explain: `●は${dir(da)}。△は${dir(db)}。真ん中は${fillRule === 'alt' ? '塗りと白が交互' : 'ずっと同じ'}。` };
  }
  throw new Error('rule: no problem');
}

/* =========================================================
 * 3 & 4. 命令表 / 暗号: a row of four shapes changed by commands.
 * ========================================================= */
export const SHAPES = ['circle', 'triangle', 'square', 'diamond', 'hexagon'];
export const ROW_OPS = {
  rev: { name: '左右を逆にする', f: r => r.slice().reverse() },
  sw12: { name: '1番目と2番目を入れかえる', f: r => [r[1], r[0], r[2], r[3]] },
  sw34: { name: '3番目と4番目を入れかえる', f: r => [r[0], r[1], r[3], r[2]] },
  ends: { name: '両はしを入れかえる', f: r => [r[3], r[1], r[2], r[0]] },
  rotL: { name: '左へ1つずらす（先頭は最後へ）', f: r => [r[1], r[2], r[3], r[0]] },
  rotR: { name: '右へ1つずらす（最後は先頭へ）', f: r => [r[3], r[0], r[1], r[2]] },
  inv: { name: 'すべての白黒を反対にする', f: r => r.map(x => ({ ...x, f: !x.f })) },
  inv1: { name: '先頭の白黒を反対にする', f: r => r.map((x, i) => (i === 0 ? { ...x, f: !x.f } : x)) }
};
export const OP_KEYS = Object.keys(ROW_OPS);
export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
export const GLYPHS = ['♠', '♣', '♥', '♦', '✿', '✚'];
const rowKey = r => r.map(x => `${x.s}${x.f ? 1 : 0}`).join(' ');
const apply = (row, ops) => ops.reduce((r, k) => ROW_OPS[k].f(r), row);
/** four different shapes, some black, some white (not all the same colour) */
function randomRow(R) {
  const ss = R.shuffle(SHAPES).slice(0, 4);
  for (;;) { const r = ss.map(s => ({ s, f: R.next() < 0.5 })); if (r.some(x => x.f) && r.some(x => !x.f)) return r; }
}
/** wrong answers: one command left out, one swapped, the order changed, or the input */
function rowWrongs(R, row, ops, pool) {
  const out = [row];
  ops.forEach((_, i) => out.push(apply(row, ops.filter((__, j) => j !== i))));
  ops.forEach((_, i) => pool.forEach(k => { if (k !== ops[i]) { const o = ops.slice(); o[i] = k; out.push(apply(row, o)); } }));
  if (ops.length > 1) out.push(apply(row, ops.slice().reverse()));
  return R.shuffle(out);
}

export function tableProblem(seed) {
  const R = rng(`table|${seed}`);
  for (let t = 0; t < 100; t++) {
    const keys = R.shuffle(OP_KEYS).slice(0, 6), table = keys.map((k, i) => ({ mark: LETTERS[i], op: k }));
    const len = R.pick([2, 2, 3]), ops = Array.from({ length: len }, () => R.pick(keys));
    const row = randomRow(R), out = apply(row, ops);
    if (rowKey(out) === rowKey(row)) continue;
    const m = mix(R, out, rowWrongs(R, row, ops, keys), rowKey);
    if (!m) continue;
    const marks = ops.map(k => table.find(x => x.op === k).mark);
    return { id: `table:${seed}`, subject: 'table', prompt: `命令 ${marks.join(' → ')} の順に実行した結果はどれ？`, table, row, marks, choices: m.choices, answer: m.answer,
      explain: marks.map((mk, i) => `${mk}：${ROW_OPS[ops[i]].name}`).join(' → ') };
  }
  throw new Error('table: no problem');
}

/** the commands that turn `from` into `to` (with the known commands before and after) */
const fits = (from, before, after, to) => OP_KEYS.filter(k => rowKey(apply(from, [...before, k, ...after])) === rowKey(to));
export function cipherProblem(seed) {
  const R = rng(`cipher|${seed}`);
  for (let t = 0; t < 300; t++) {
    const glyphs = R.shuffle(GLYPHS).slice(0, 3), ops = R.shuffle(OP_KEYS).slice(0, 3);   // glyph i means ops[i]
    // examples: g0 alone, then g0 g1, then g2 alone — each must show only one possible meaning
    const ex = [{ g: [0] }, { g: [0, 1] }, { g: [2] }].map(e => { const row = randomRow(R); return { ...e, row, out: apply(row, e.g.map(i => ops[i])) }; });
    if (fits(ex[0].row, [], [], ex[0].out).length !== 1) continue;
    if (fits(ex[1].row, [ops[0]], [], ex[1].out).length !== 1) continue;
    if (fits(ex[2].row, [], [], ex[2].out).length !== 1) continue;
    const order = R.shuffle([0, 1, 2]).slice(0, R.pick([2, 3]));
    const row = randomRow(R), out = apply(row, order.map(i => ops[i]));
    if (rowKey(out) === rowKey(row)) continue;
    const m = mix(R, out, rowWrongs(R, row, order.map(i => ops[i]), OP_KEYS), rowKey);
    if (!m) continue;
    return { id: `cipher:${seed}`, subject: 'cipher', prompt: `例を見て記号の意味を考え、${order.map(i => glyphs[i]).join(' → ')} の結果を選んでください。`,
      examples: ex.map(e => ({ row: e.row, marks: e.g.map(i => glyphs[i]), out: e.out })), row, marks: order.map(i => glyphs[i]), choices: m.choices, answer: m.answer,
      explain: [0, 1, 2].map(i => `${glyphs[i]}：${ROW_OPS[ops[i]].name}`).join('、') + '。' };
  }
  throw new Error('cipher: no problem');
}

export const MAKE = { calc: calcProblem, rule: ruleProblem, table: tableProblem, cipher: cipherProblem };
export const makeProblem = (subject, seed) => MAKE[subject](seed);
