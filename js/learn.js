/* =========================================================
 * learn.js — how to solve each subject, with an example worked
 * step by step (a new example every time). Shown before practising,
 * and by the teacher in front of the class.
 * ========================================================= */
import { makeProblem, applyOps } from './gen.js';
import { rowHTML, ruleFigSVG, blankFigHTML } from './figures.js';
import { H, HX, esc } from './i18n.js';
import { subjNameH, opNameH, dirH } from './text.js';

const step = (n, titleHTML, body) => `<li class="lstep"><b class="lno">${n}</b><div><h3>${titleHTML}</h3>${body}</div></li>`;
const CALC_FORMS = [['□ + a = b', '□ = b − a'], ['□ − a = b', '□ = b + a'], ['a − □ = b', '□ = a − b'], ['□ × a = b', '□ = b ÷ a'], ['□ ÷ a = b', '□ = b × a'], ['a ÷ □ = b', '□ = a ÷ b']];
const calcTable = () => `<table class="ltbl"><thead><tr><th>${H('learn.form')}</th><th>${H('learn.find')}</th></tr></thead><tbody>${CALC_FORMS.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table>`;

function example(subject, seed) {
  const p = makeProblem(subject, seed), ans = p.choices[p.answer];
  if (subject === 'calc') return [
    step(1, H('learn.problem'), `<div class="eq small">${esc(p.prompt).replace('□', '<span class="box">□</span>')}</div>`),
    step(2, H('learn.calc1'), `<p>${H('learn.calc1b', { v: p.rhsValue })}</p>`),
    step(3, H('learn.calc2'), `<p>${esc(p.how)} ＝ <b>${esc(p.x)}</b></p>`),
    step(4, H('learn.answer'), `<p class="ans">${esc(ans)}</p>`)];
  if (subject === 'rule') return [
    step(1, H('learn.problem'), `<div class="seq">${p.seq.map((f, i) => (i === p.blank ? blankFigHTML(60) : ruleFigSVG(f, 60))).join('<i class="arrow">›</i>')}</div>`),
    step(2, H('learn.rule1'), `<p>${HX('learn.rule1b', { d: `<b>${dirH(p.da)}</b>` })}</p>`),
    step(3, H('learn.rule2'), `<p>${HX('learn.rule2b', { d: `<b>${dirH(p.db)}</b>` })}</p>`),
    step(4, H('learn.rule3'), `<p><b>${H(p.fillRule === 'alt' ? 'ex.midAlt' : 'ex.midSame')}</b></p>`),
    step(5, H('learn.answer'), ruleFigSVG(ans, 70))];
  if (subject === 'table') {
    let row = p.row; const mids = p.ops.map((k, i) => { row = applyOps(row, [k]); return step(i + 2, `<b class="mark sm">${p.marks[i]}</b> ${opNameH(k)}`, rowHTML(row, 28)); });
    return [step(1, H('learn.start'), `${rowHTML(p.row, 28)}<p class="muted small">${H('learn.table1', { marks: p.marks.join(' → ') })}</p>`), ...mids, step(p.ops.length + 2, H('learn.answer'), rowHTML(ans, 28))];
  }
  const mean = Object.fromEntries(p.meaning.map(x => [x.g, x.op]));
  const exSteps = p.examples.map((e, i) => {
    const unknown = e.marks[e.marks.length - 1], known = e.marks.slice(0, -1);
    return step(i + 1, H('learn.cipher1', { n: i + 1, g: unknown }), `<div class="flow">${rowHTML(e.row, 24)}${e.marks.map(m => `<i class="arrow">→</i><b class="glyph">${m}</b>`).join('')}<i class="arrow">→</i>${rowHTML(e.out, 24)}</div>
      <p>${known.length ? H('learn.cipherKnown', { g: known.join('・'), u: unknown }) + ' ' : ''}${esc(unknown)} ＝ <b>${opNameH(mean[unknown])}</b></p>`);
  });
  let row = p.row; const apply = p.marks.map(m => { row = applyOps(row, [mean[m]]); return `<div class="flow"><b class="glyph">${m}</b><i class="arrow">→</i>${rowHTML(row, 24)}</div>`; }).join('');
  return [...exSteps, step(4, H('learn.cipher2'), `${rowHTML(p.row, 24)}${apply}`), step(5, H('learn.answer'), rowHTML(ans, 28))];
}

export function learnHTML(subject, seed) {
  return `<main class="wrap narrow learn"><div class="bar-top"><a class="btn small" href="#/">${H('nav.home')}</a><b>${subjNameH(subject)}・${H('learn.title')}</b></div>
    <section class="card"><h2>${H('learn.points')}</h2><ol class="points">${[1, 2, 3].map(i => `<li>${H(`learn.${subject}.p${i}`)}</li>`).join('')}</ol>${subject === 'calc' ? calcTable() : ''}</section>
    <section class="card"><div class="lhead"><h2>${H('learn.example')}</h2><button class="btn small" data-act="newExample">${H('learn.another')}</button></div><ol class="lsteps">${example(subject, seed).join('')}</ol></section>
    <div class="btns center"><a class="btn primary" href="#/practice/${subject}">${H('home.practice', { n: 10 })}</a><a class="btn" href="#/mock/${subject}">${H('learn.toMock')}</a></div></main>`;
}
