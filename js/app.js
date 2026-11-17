/* =========================================================
 * app.js — the student's page
 *   #/                 home: the subjects, what to do next, my results, the class
 *   #/learn/<subj>     how to solve it, with a worked example
 *   #/practice/<subj>  10 problems with an explanation after each
 *   #/mock/<subj>      the timed test (answers and explanations at the end)
 *   #/review           the problems I got wrong, again
 *   #/print/<subj>     a paper test (problems and an answer page)
 *   #/ctest            the test the teacher started for the class
 * ========================================================= */
import { SUBJECTS, MOCK, makeProblem, problemById } from './gen.js';
import { rowHTML, ruleFigSVG, blankFigHTML } from './figures.js';
import { learnHTML } from './learn.js';
import { T, H, HX, esc, setLang, detectLang, lang, langSelectHTML } from './i18n.js';
import { subjName, subjNameH, opNameH, askHTML, explainHTML } from './text.js';
import * as backend from './backend.js';

const $ = s => document.querySelector(s);
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const PRACTICE_N = 10;
const ICON = { calc: '±', rule: '◳', table: '⇄', cipher: '♠' };
const modeH = m => H(`mode.${m}`);

/* ---------- state ---------- */
const S = { session: null, timer: null, route: '', learnSeed: 1, klassRow: null };
const prog = () => store.get('apt.progress', { subj: {}, mocks: [] });
function recordLocal(subject, ok, ms) {
  const p = prog(), s = p.subj[subject] || { n: 0, ok: 0, ms: 0 };
  s.n++; if (ok) s.ok++; s.ms += ms; p.subj[subject] = s; store.set('apt.progress', p);
}
/* the problems I got wrong (by id, so they can be made again): solved right in the review → off the list */
const wrongs = () => store.get('apt.wrong', []);
function markWrong(p, ok) {
  const w = wrongs().filter(x => x.id !== p.id);
  if (!ok) w.unshift({ id: p.id, subject: p.subject, at: Date.now() });
  store.set('apt.wrong', w.slice(0, 200));
}
const klass = () => store.get('apt.class', null);
function logClass(subject, mode, run, ok, ms) {
  const c = klass(); if (!c || !backend.enabled) return;
  backend.logAttempt({ class_id: c.id, subject, mode: mode === 'review' ? 'practice' : mode, run, ok, ms: Math.min(3600000, Math.round(ms)) });
}

/* ---------- drawing a problem ---------- */
function choiceHTML(p, c) {
  if (p.subject === 'calc') return `<span class="num">${esc(c)}</span>`;
  if (p.subject === 'rule') return ruleFigSVG(c, 64);
  return rowHTML(c, 26);
}
function bodyHTML(p) {
  if (p.subject === 'calc') return `<div class="eq">${esc(p.prompt).replace('□', '<span class="box">□</span>')}</div>`;
  if (p.subject === 'rule') return `<p class="ask">${askHTML(p)}</p><div class="seq">${p.seq.map((f, i) => (i === p.blank ? blankFigHTML() : ruleFigSVG(f))).join('<i class="arrow">›</i>')}</div>`;
  if (p.subject === 'table') return `<p class="ask">${askHTML(p)}</p>
    <div class="cmd-table">${p.table.map(t => `<div><b class="mark">${t.mark}</b><span>${opNameH(t.op)}</span></div>`).join('')}</div>
    <div class="flow">${rowHTML(p.row)}${p.marks.map(m => `<i class="arrow">→</i><b class="mark">${m}</b>`).join('')}<i class="arrow">→</i><span class="q">?</span></div>`;
  return `<p class="ask">${askHTML(p)}</p>
    <div class="examples">${p.examples.map((e, i) => `<div class="flow ex"><small>${H('q.ex', { n: i + 1 })}</small>${rowHTML(e.row, 26)}${e.marks.map(m => `<i class="arrow">→</i><b class="glyph">${m}</b>`).join('')}<i class="arrow">→</i>${rowHTML(e.out, 26)}</div>`).join('')}</div>
    <div class="flow">${rowHTML(p.row)}${p.marks.map(m => `<i class="arrow">→</i><b class="glyph">${m}</b>`).join('')}<i class="arrow">→</i><span class="q">?</span></div>`;
}
const LABEL = ['1', '2', '3', '4', '5'];   // numbers, so they are not mistaken for the commands A–F
function choicesHTML(p, picked, show) {
  return `<div class="choices ${p.subject}">${p.choices.map((c, i) => {
    const cls = show ? (i === p.answer ? 'right' : i === picked ? 'wrong' : 'dim') : '';
    return `<button class="choice ${cls}" data-act="pick" data-i="${i}" ${show ? 'disabled' : ''}><b class="lab">${LABEL[i]}</b>${choiceHTML(p, c)}</button>`; }).join('')}</div>`;
}

/* ---------- home ---------- */
const mmss = sec => `${Math.floor(Math.max(0, sec) / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`;
/** what to do next: a subject never tried, then the one with the lowest rate (5 answers or more) */
function recommend(p) {
  const fresh = SUBJECTS.find(s => !(p.subj[s] && p.subj[s].n));
  if (fresh) return { s: fresh, why: H('rec.fresh'), href: `#/learn/${fresh}`, btn: H('rec.learn') };
  const tried = SUBJECTS.filter(s => p.subj[s].n >= 5).sort((a, b) => p.subj[a].ok / p.subj[a].n - p.subj[b].ok / p.subj[b].n);
  if (!tried.length) return null;
  const s = tried[0], rate = Math.round(p.subj[s].ok / p.subj[s].n * 100);
  return rate >= 85 ? { s, why: H('rec.high', { s: subjName(s), n: rate }), href: `#/mock/${s}`, btn: H('learn.toMock') }
    : { s, why: H('rec.low', { n: rate }), href: `#/practice/${s}`, btn: H('rec.practice') };
}
function homeHTML() {
  const p = prog(), c = klass(), w = wrongs(), rec = recommend(p), t = activeTest();
  const best = s => { const ms = p.mocks.filter(m => m.subject === s); return ms.length ? Math.max(...ms.map(m => m.score)) : null; };
  return `<main class="wrap">
    ${t ? testBannerHTML(t) : ''}
    <section class="hero"><h1>${H('app.title')}</h1><p>${H('home.lead')}</p></section>
    <section class="next-row">
      ${rec ? `<div class="card next s-${rec.s}"><span class="ic">${ICON[rec.s]}</span><div><small class="muted">${H('home.next')}</small><b>${subjNameH(rec.s)}</b><p class="muted small">${rec.why}</p></div><a class="btn primary" href="${rec.href}">${rec.btn}</a></div>` : ''}
      <div class="card next"><span class="ic rv">↺</span><div><small class="muted">${modeH('review')}</small><b>${H('home.nq', { n: w.length })}</b><p class="muted small">${H(w.length ? 'home.reviewSub' : 'home.reviewNone')}</p></div>${w.length ? `<a class="btn primary" href="#/review">${H('home.reviewGo')}</a>` : ''}</div>
    </section>
    <section class="grid">${SUBJECTS.map(s => { const x = p.subj[s], b = best(s);
      return `<article class="card subj s-${s}"><div class="subj-h"><span class="ic">${ICON[s]}</span><h2>${subjNameH(s)}</h2><a class="btn small ghost" href="#/learn/${s}">${H('learn.title')}</a></div>
        <p class="muted">${H(`desc.${s}`)}</p>
        <dl class="stats"><div><dt>${H('st.rate')}</dt><dd>${x && x.n ? Math.round(x.ok / x.n * 100) + '%' : '—'}</dd></div><div><dt>${H('st.n')}</dt><dd>${x ? x.n : 0}</dd></div><div><dt>${H('st.avg')}</dt><dd>${x && x.n ? H('sec', { n: (x.ms / x.n / 1000).toFixed(1) }) : '—'}</dd></div><div><dt>${H('st.best')}</dt><dd>${b === null ? '—' : `${b}/${MOCK[s].n}`}</dd></div></dl>
        <div class="btns"><a class="btn primary" href="#/practice/${s}">${H('home.practice', { n: PRACTICE_N })}</a><a class="btn" href="#/mock/${s}">${H('home.mock', { n: MOCK[s].n, m: MOCK[s].sec / 60 })}</a><a class="btn ghost" href="#/print/${s}" title="${esc(T('home.printTip'))}">${H('home.print')}</a></div></article>`; }).join('')}</section>
    <section class="card class-card">${c ? `<h2>${H('cls.in', { name: c.name })}</h2><p class="muted">${H('cls.as', { nick: c.nickname })}</p><button class="btn small" data-act="leave">${H('cls.leave')}</button>`
      : backend.enabled ? `<h2>${H('cls.join')}</h2><p class="muted">${H('cls.joinSub')}</p>
        <form class="join" data-form="join"><input name="code" placeholder="${esc(T('cls.code'))}" autocomplete="off" maxlength="8" required><input name="nick" placeholder="${esc(T('cls.nick'))}" maxlength="30" required><button class="btn primary">${H('cls.joinBtn')}</button></form><p class="err" id="join-err"></p>` : `<p class="muted">${H('cls.off')}</p>`}</section>
    <p class="note">${H('home.note')}</p>
  </main>`;
}

/* ---------- a session (practice, mock, review, class test) ---------- */
function newSession(mode, subject, opt = {}) {
  const run = opt.run || Math.random().toString(36).slice(2, 10);
  let items;
  if (mode === 'review') items = wrongs().slice(0, PRACTICE_N).map(x => { try { return problemById(x.id); } catch (e) { return null; } }).filter(Boolean);
  else if (mode === 'test') items = Array.from({ length: opt.n }, (_, i) => makeProblem(subject, `${opt.seed}|${i}`));
  else items = Array.from({ length: mode === 'mock' ? MOCK[subject].n : PRACTICE_N }, (_, i) => makeProblem(subject, `${run}|${i}`));
  const end = mode === 'mock' ? Date.now() + MOCK[subject].sec * 1000 : mode === 'test' ? opt.end : null;
  return { mode, subject: subject || (items[0] && items[0].subject), run, items, i: 0, picks: [], ms: [], t: performance.now(), end, shown: false, done: false, testId: opt.testId || null };
}
const timed = s => s.mode === 'mock' || s.mode === 'test';
function sessionHTML() {
  const s = S.session;
  if (!s.items.length) return `<main class="wrap narrow"><section class="card result"><h1>${modeH('review')}</h1><p class="muted">${H('rv.none')}</p><a class="btn primary" href="#/">${H('nav.home')}</a></section></main>`;
  if (s.done) return resultHTML();
  const p = s.items[s.i], left = s.end ? (s.end - Date.now()) / 1000 : null, picked = s.picks[s.i];
  return `<main class="wrap narrow">
    <div class="bar-top">${s.mode === 'test' ? '' : `<a class="btn small" href="#/" data-act="quit">${H('ses.quit')}</a>`}<b>${s.mode === 'review' ? `${modeH('review')}・${subjNameH(p.subject)}` : `${subjNameH(s.subject)}・${modeH(s.mode)}`}</b>
      <span class="count">${s.i + 1} / ${s.items.length}</span>${s.end ? `<span class="clock ${left < 60 ? 'low' : ''}" id="clock">${mmss(left)}</span>` : ''}</div>
    <div class="progress"><i style="width:${s.i / s.items.length * 100}%"></i></div>
    <section class="card problem">${bodyHTML(p)}${choicesHTML(p, picked, s.shown)}
      ${s.shown ? `<div class="fb ${picked === p.answer ? 'ok' : 'ng'}"><b>${picked === p.answer ? H('ses.right') : H('ses.wrong', { n: LABEL[p.answer] })}</b><p>${explainHTML(p)}</p>
        <div class="btns"><button class="btn primary" data-act="next">${H(s.i + 1 < s.items.length ? 'ses.next' : 'ses.result')}</button>${picked === p.answer ? '' : `<a class="btn" href="#/learn/${p.subject}">${H('ses.learn')}</a>`}</div></div>` : ''}
      ${timed(s) ? `<p class="muted small skip">${H('ses.skipNote')} <button class="btn small" data-act="skip">${H('ses.skip')}</button></p>` : ''}</section>
  </main>`;
}
function resultHTML() {
  const s = S.session, ok = s.items.filter((p, i) => s.picks[i] === p.answer).length, answered = s.picks.filter(x => x !== undefined && x !== null).length;
  const avg = answered ? s.ms.reduce((a, b) => a + (b || 0), 0) / answered / 1000 : 0;
  const again = s.mode === 'test' ? '' : `<a class="btn primary" href="#/${s.mode === 'review' ? 'review' : `${s.mode}/${s.subject}`}?again=${Date.now()}">${H(s.mode === 'review' ? 'res.moreReview' : 'res.again')}</a>`;
  return `<main class="wrap narrow"><section class="card result"><h1>${H('res.title', { what: s.mode === 'review' ? T('mode.review') : `${subjName(s.subject)}・${T(`mode.${s.mode}`)}` })}</h1>
      <p class="score">${ok}<small> / ${s.items.length}</small></p>
      <dl class="stats"><div><dt>${H('res.answered')}</dt><dd>${answered}</dd></div><div><dt>${H('st.rate')}</dt><dd>${answered ? Math.round(ok / answered * 100) : 0}%</dd></div><div><dt>${H('st.avg')}</dt><dd>${H('sec', { n: avg.toFixed(1) })}</dd></div></dl>
      <div class="btns">${again}<a class="btn" href="#/">${H('nav.home')}</a></div></section>
    ${timed(s) ? `<h2 class="review-h">${H('res.check')}</h2>${s.items.map((p, i) => { const pk = s.picks[i], has = pk !== undefined && pk !== null;
      return `<details class="card review ${pk === p.answer ? 'ok' : 'ng'}"><summary><b>${i + 1}</b><span>${H(!has ? 'res.none' : pk === p.answer ? 'res.ok' : 'res.ng')}</span></summary>${bodyHTML(p)}${choicesHTML(p, pk, true)}<p class="explain">${explainHTML(p)}</p></details>`; }).join('')}` : ''}</main>`;
}

/* ---------- a paper test ---------- */
function printHTML(subject, n) {
  const seed = Math.random().toString(36).slice(2, 8), items = Array.from({ length: n }, (_, i) => makeProblem(subject, `print|${seed}|${i}`));
  return `<main class="wrap print-page">
    <div class="no-print bar-top"><a class="btn small" href="#/">${H('nav.home')}</a><b>${subjNameH(subject)}・${H('pr.title')}</b>
      <span class="seg">${[10, 20, 30].map(k => `<a class="${k === n ? 'on' : ''}" href="#/print/${subject}?n=${k}">${H('nq', { n: k })}</a>`).join('')}</span><button class="btn small" data-act="newPrint">${H('pr.new')}</button><button class="btn primary small" data-act="print">${H('pr.print')}</button></div>
    <section class="sheet"><header class="sheet-h"><h1>${H('pr.head', { s: subjName(subject), n })}</h1><div class="sheet-name">${H('pr.name', { n })}</div></header>
      <p class="sheet-rule">${H('pr.rule', { m: Math.max(1, Math.round(MOCK[subject].sec / MOCK[subject].n * n / 60)) })}</p>
      <ol class="sheet-qs">${items.map(p => `<li class="sheet-q">${bodyHTML(p)}<div class="choices ${p.subject} paper">${p.choices.map((c, i) => `<div class="choice"><b class="lab">${LABEL[i]}</b>${choiceHTML(p, c)}</div>`).join('')}</div><div class="ansbox">${H('pr.ans')}</div></li>`).join('')}</ol></section>
    <section class="sheet answers"><h2>${H('pr.key', { s: subjName(subject), id: seed })}</h2><ol>${items.map(p => `<li><b>${LABEL[p.answer]}</b>　${explainHTML(p)}</li>`).join('')}</ol></section></main>`;
}

/* ---------- the class test (started by the teacher) ---------- */
const doneTests = () => store.get('apt.testsDone', []);
function activeTest() {
  const c = klass(), r = S.klassRow, t = r && r.test;
  if (!c || !t || !t.id || doneTests().includes(t.id)) return null;
  return Date.now() < new Date(t.end).getTime() ? t : null;
}
const testBannerHTML = t => `<div class="test-banner"><b>📝 ${H('ct.started')}</b><span>${H('ct.what', { s: subjName(t.subject), n: t.n, m: Math.round((new Date(t.end) - new Date(t.at)) / 60000) })}</span><a class="btn primary" href="#/ctest">${H('ct.go')}</a></div>`;
let polling = false;
async function pollClass() {
  const c = klass(); if (!c || !backend.enabled || polling || document.hidden) return;
  polling = true;
  try {
    const before = S.klassRow && S.klassRow.test ? S.klassRow.test.id : null;
    S.klassRow = (await backend.classRow(c.id)) || null;
    const cur = S.klassRow && S.klassRow.test, ses = S.session;
    if (ses && ses.mode === 'test' && !ses.done && cur && cur.id === ses.testId) ses.end = new Date(cur.end).getTime();   // the teacher may end it early
    const t = activeTest(), busy = S.session && !S.session.done && S.session.picks.length;
    if (t && t.id !== before && !(S.session && S.session.mode === 'test')) { if (busy) render(); else location.hash = '#/ctest'; }   // the test opens by itself (not in the middle of a mock)
    else if (!S.session && !S.route) render();
  } catch (e) { /* offline */ }
  polling = false;
}

/* ---------- actions ---------- */
function answer(i) {
  const s = S.session; if (!s || s.shown || s.done || s.picks[s.i] !== undefined) return;
  const p = s.items[s.i], ms = performance.now() - s.t, ok = i === p.answer;
  s.picks[s.i] = i; s.ms[s.i] = ms;
  recordLocal(p.subject, ok, ms); markWrong(p, ok); logClass(p.subject, s.mode, s.mode === 'test' ? s.testId : s.run, ok, ms);
  if (!timed(s)) { s.shown = true; render(); return; }
  next();
}
function next() {
  const s = S.session; s.shown = false;
  if (s.i + 1 >= s.items.length) return finish();
  s.i++; s.t = performance.now(); render(); window.scrollTo(0, 0);
}
function finish() {
  const s = S.session; if (s.done) return;
  s.done = true; clearInterval(S.timer);
  if (s.mode === 'mock') { const p = prog(); p.mocks.push({ subject: s.subject, score: s.items.filter((q, i) => s.picks[i] === q.answer).length, n: s.items.length, at: Date.now() }); p.mocks = p.mocks.slice(-100); store.set('apt.progress', p); }
  if (s.mode === 'test') store.set('apt.testsDone', [s.testId, ...doneTests()].slice(0, 50));
  render(); window.scrollTo(0, 0);
}
function startClock() {
  S.timer = setInterval(() => {
    const s = S.session; if (!s || s.done) return;
    const left = (s.end - Date.now()) / 1000, el = $('#clock');
    if (left <= 0) return finish();
    if (el) { el.textContent = mmss(left); el.classList.toggle('low', left < 60); }
  }, 500);
}

/* ---------- routing ---------- */
function route() {
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?'), [view, subj] = path.split('/'), q = new URLSearchParams(query || '');
  clearInterval(S.timer); S.route = view || '';
  S.session = null;
  if ((view === 'practice' || view === 'mock') && SUBJECTS.includes(subj)) { S.session = newSession(view, subj); if (view === 'mock') startClock(); }
  else if (view === 'review') S.session = newSession('review');
  else if (view === 'ctest') {
    const t = activeTest();
    if (!t) { location.hash = '#/'; return; }
    S.session = newSession('test', t.subject, { n: t.n, seed: t.seed, end: new Date(t.end).getTime(), testId: t.id }); startClock();
  }
  if (S.session) render();
  else if (view === 'learn' && SUBJECTS.includes(subj)) $('#app').innerHTML = learnHTML(subj, `${S.learnSeed}`);
  else if (view === 'print' && SUBJECTS.includes(subj)) $('#app').innerHTML = printHTML(subj, [10, 20, 30].includes(+q.get('n')) ? +q.get('n') : 20);
  else { S.route = ''; render(); }
  window.scrollTo(0, 0);
}
function render() { $('#app').innerHTML = S.session ? sessionHTML() : homeHTML(); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'pick') answer(+el.dataset.i);
  else if (act === 'next') next();
  else if (act === 'skip') { const s = S.session; if (s && !s.done && s.picks[s.i] === undefined) { s.picks[s.i] = null; next(); } }
  else if (act === 'quit') { if (S.session && !S.session.done && S.session.picks.length && !confirm(T('ses.quitAsk'))) e.preventDefault(); }
  else if (act === 'newExample') { S.learnSeed++; route(); }
  else if (act === 'newPrint') route();
  else if (act === 'print') window.print();
  else if (act === 'leave') { if (!confirm(T('cls.leaveAsk'))) return; const c = klass(); try { await backend.leaveClass(c.id); } catch (err) { /* offline */ } store.set('apt.class', null); S.klassRow = null; render(); }
});
document.addEventListener('keydown', e => {   // 1–5 to answer, Enter for the next problem
  if (!S.session || S.session.done || /input|textarea/i.test(e.target.tagName)) return;
  const i = LABEL.indexOf(e.key);
  if (i >= 0 && !S.session.shown) answer(i);
  else if (e.key === 'Enter' && S.session.shown) next();
});
document.addEventListener('submit', async e => {
  if (e.target.dataset.form !== 'join') return;
  e.preventDefault();
  const f = new FormData(e.target), errEl = $('#join-err'), btn = e.target.querySelector('button');
  btn.disabled = true; errEl.textContent = '';
  try {
    const c = await backend.joinClass(String(f.get('code')).trim().toUpperCase(), String(f.get('nick')).trim());
    store.set('apt.class', { id: c.id, name: c.name, code: c.code, nickname: String(f.get('nick')).trim() }); render(); pollClass();
  } catch (err) {
    errEl.textContent = T(['class_not_found', 'class_closed', 'anon_disabled', 'nickname_taken'].includes(err.message) ? `err.${err.message}` : 'err.net');
    btn.disabled = false;
  }
});
window.addEventListener('hashchange', route);
document.addEventListener('visibilitychange', () => { if (!document.hidden) pollClass(); });
/* the language: a menu in the header; the screen is drawn again (a running test keeps going) */
function mountLang() {
  const slot = $('#lang-slot'); if (slot) slot.innerHTML = langSelectHTML();
  document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = H(el.dataset.t); });
  document.title = T('app.title');
}
document.addEventListener('change', async e => {
  if (!e.target.matches('[data-lang]')) return;
  await setLang(e.target.value); mountLang();
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?'), [view, subj] = path.split('/');
  if (S.session) render();
  else if (view === 'learn' && SUBJECTS.includes(subj)) $('#app').innerHTML = learnHTML(subj, `${S.learnSeed}`);
  else if (view === 'print') route();
  else render();
});
(async () => {
  await setLang(detectLang()); mountLang();
  setInterval(pollClass, 5000);   // the class test reaches the students within 5 seconds
  route();
  backend.flush(); pollClass();
})();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
