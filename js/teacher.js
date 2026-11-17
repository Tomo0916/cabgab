/* =========================================================
 * teacher.js — the teacher's page: classes, and how each student is doing
 *   #/              my classes
 *   #/c/<id>        one class: the class test, subjects, students, mock tests
 *   #/c/<id>/s/<u>  one student: day by day, mock tests, class tests
 * ========================================================= */
import { SUBJECTS, MOCK } from './gen.js';
import * as backend from './backend.js';
import { T, H, esc, setLang, detectLang, langSelectHTML } from './i18n.js';
import { subjName, subjNameH } from './text.js';

const $ = s => document.querySelector(s);
const S = { session: null, ok: false, classes: [], klass: null, student: null, members: [], att: [], period: 'all', loading: false, msg: '', draft: { subject: 'calc', n: 10, min: 3 }, openTest: null };
const fmtTime = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const dayKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const since = () => { const d = new Date(); if (S.period === 'today') { d.setHours(0, 0, 0, 0); return d.getTime(); } if (S.period === 'week') return Date.now() - 7 * 86400000; return 0; };
const nickOf = uid => (S.members.find(m => m.user_id === uid) || {}).nickname;

/* ---------- numbers ---------- */
function statsOf(rows) {
  const n = rows.length, ok = rows.filter(r => r.ok).length, ms = rows.reduce((a, r) => a + (r.ms || 0), 0);
  return { n, ok, rate: n ? ok / n : null, sec: n ? ms / n / 1000 : null };
}
/** mock tests: one per run → { user_id, subject, score, answered, at } */
function mocksOf(rows) {
  const by = new Map();
  rows.filter(r => r.mode === 'mock').forEach(r => { const k = `${r.user_id}|${r.run}`, m = by.get(k) || { user_id: r.user_id, subject: r.subject, score: 0, answered: 0, at: r.created_at }; m.answered++; if (r.ok) m.score++; if (r.created_at > m.at) m.at = r.created_at; by.set(k, m); });
  return [...by.values()];
}
const pctHTML = (st, subj) => (st.n ? `<span class="pct ${st.n >= 5 && st.rate < 0.5 ? 'low' : ''}" style="--sc:var(--c-${subj})"><i><b style="width:${Math.round(st.rate * 100)}%"></b></i>${Math.round(st.rate * 100)}%<small class="muted">（${st.n}）</small></span>` : '<span class="muted">—</span>');
const secH = v => H('sec', { n: v.toFixed(1) });

/* ---------- the class test: everyone at once ---------- */
const TEST_N = [5, 10, 20, 30], TEST_MIN = [2, 3, 5, 10, 15];
const mmss = ms => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
/** each student's result in a test → [{ m, answered, ok }] */
function testRows(t) {
  const rows = S.att.filter(r => r.mode === 'test' && r.run === t.id);
  return S.members.map(m => { const mine = rows.filter(r => r.user_id === m.user_id); return { m, answered: mine.length, ok: mine.filter(r => r.ok).length }; });
}
function testPanelHTML(c) {
  const t = c.test, live = t && Date.now() < new Date(t.end).getTime();
  if (live) {
    const rs = testRows(t), started = rs.filter(r => r.answered).length, finished = rs.filter(r => r.answered >= t.n).length, N = S.members.length || 1;
    return `<section class="card test-live"><div class="t-head"><h2>📝 ${H('tt.live', { s: subjName(t.subject), n: t.n })}</h2><span class="clock" id="tclock" data-end="${t.end}">${mmss(new Date(t.end) - Date.now())}</span><button class="btn small" data-act="testStop">${H('tt.stop')}</button></div>
      <div class="classbar"><i class="done" style="width:${finished / N * 100}%"></i><i class="going" style="width:${(started - finished) / N * 100}%"></i></div>
      <p class="muted small">${H('tt.counts', { a: finished, b: started - finished, c: S.members.length - started })}</p>
      <ul class="roster">${rs.map(r => `<li class="${r.answered >= t.n ? 'done' : r.answered ? 'going' : 'none'}" title="${esc(r.m.nickname)}"><b>${esc(r.m.nickname)}</b><span>${r.answered}/${t.n}<small>${H('tt.right', { n: r.ok })}</small></span><i style="width:${r.answered / t.n * 100}%"></i></li>`).join('')}</ul></section>`;
  }
  const d = S.draft, seg = (k, vals, label) => `<span class="seg">${vals.map(v => `<button class="${d[k] === v ? 'on' : ''}" data-act="draft" data-k="${k}" data-v="${v}">${label(v)}</button>`).join('')}</span>`;
  return `<section class="card test-setup"><h2>📝 ${H('tt.title')}</h2><p class="muted small">${H('tt.sub')}</p>
    <div class="t-row"><span class="lbl">${H('tt.subject')}</span>${seg('subject', SUBJECTS, v => subjNameH(v))}</div>
    <div class="t-row"><span class="lbl">${H('tt.count')}</span>${seg('n', TEST_N, v => H('nq', { n: v }))}</div>
    <div class="t-row"><span class="lbl">${H('tt.time')}</span>${seg('min', TEST_MIN, v => H('min', { n: v }))}<span class="muted small">${H('tt.guide', { n: Math.max(1, Math.round(MOCK[d.subject].sec / MOCK[d.subject].n * d.n / 60)) })}</span></div>
    <button class="btn primary" data-act="testStart">${H('tt.start')}</button></section>`;
}
function testLogHTML(c) {
  const log = (c.test_log || []).filter(t => !(c.test && c.test.id === t.id && Date.now() < new Date(t.end).getTime()));
  if (!log.length) return '';
  return `<section class="card" style="margin-top:14px"><h2 class="h2s">${H('tt.log')}</h2>${log.map(t => { const rs = testRows(t).filter(r => r.answered), avg = rs.length ? rs.reduce((a, r) => a + r.ok, 0) / rs.length : 0;
    return `<details class="tlog" ${S.openTest === t.id ? 'open' : ''}><summary><b>${fmtTime(t.at)}</b><span>${subjNameH(t.subject)}・${H('nq', { n: t.n })}</span><span class="muted">${H('tt.logLine', { n: rs.length, a: avg.toFixed(1) })}</span></summary>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${H('t.name')}</th><th>${H('t.right')}</th><th>${H('res.answered')}</th></tr></thead><tbody>${testRows(t).sort((a, b) => b.ok - a.ok).map(r => `<tr><td>${esc(r.m.nickname)}</td><td><b>${r.ok}</b> / ${t.n}</td><td>${r.answered || `<span class="muted">${H('tt.absent')}</span>`}</td></tr>`).join('')}</tbody></table></div></details>`; }).join('')}</section>`;
}

/* ---------- screens ---------- */
function loginHTML() {
  return `<main class="wrap narrow"><section class="card"><h1>${H('t.title')}</h1><p class="muted">${H('t.loginSub')}</p>
    <form data-form="login"><label class="field"><span>${H('t.email')}</span><input name="email" type="email" autocomplete="username" required></label>
    <label class="field"><span>${H('t.password')}</span><input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn primary">${H('t.login')}</button><p class="err">${esc(S.msg)}</p></form></section></main>`;
}
function classesHTML() {
  return `<main class="wrap narrow"><div class="t-head"><h1>${H('t.classes')}</h1><button class="btn small" data-act="logout">${H('t.logout')}</button></div>
    <form class="card join" data-form="create"><input name="name" placeholder="${esc(T('t.newPh'))}" maxlength="80" required><button class="btn primary">${H('t.create')}</button></form>
    <div class="list" style="margin-top:12px">${S.classes.map(c => `<a class="card" href="#/c/${c.id}"><b>${esc(c.name)}</b><span class="muted">${H('t.codeIs')} <b>${esc(c.code)}</b>${c.open ? '' : `・${H('t.closed')}`}</span></a>`).join('') || `<p class="muted">${H('t.noClass')}</p>`}</div>
    <p class="err">${esc(S.msg)}</p></main>`;
}
function classHTML() {
  const c = S.klass, from = since(), rows = S.att.filter(r => new Date(r.created_at).getTime() >= from), mocks = mocksOf(rows);
  const seg = `<span class="seg">${['today', 'week', 'all'].map(k => `<button class="${S.period === k ? 'on' : ''}" data-act="period" data-v="${k}">${H(`t.p.${k}`)}</button>`).join('')}</span>`;
  const tiles = SUBJECTS.map(s => { const st = statsOf(rows.filter(r => r.subject === s)), who = new Set(rows.filter(r => r.subject === s).map(r => r.user_id)).size;
    return `<div class="card tile" style="--sc:var(--c-${s})"><span class="muted">${subjNameH(s)}</span><b>${st.n ? Math.round(st.rate * 100) + '%' : '—'}</b><small class="muted">${H('t.tile', { n: st.n, p: who })}${st.n ? ` ・ ${H('t.avg', { s: st.sec.toFixed(1) })}` : ''}</small></div>`; }).join('');
  const body = S.members.map(m => { const mine = rows.filter(r => r.user_id === m.user_id), last = mine.length ? mine[mine.length - 1].created_at : null;
    return `<tr><th><a href="#/c/${c.id}/s/${m.user_id}" title="${esc(T('t.detail'))}">${esc(m.nickname)}</a></th>${SUBJECTS.map(s => { const st = statsOf(mine.filter(r => r.subject === s)), best = mocks.filter(x => x.user_id === m.user_id && x.subject === s);
      return `<td>${pctHTML(st, s)}</td><td class="c">${st.n ? secH(st.sec) : ''}</td><td class="c">${best.length ? `${Math.max(...best.map(x => x.score))}/${MOCK[s].n}` : ''}</td>`; }).join('')}
      <td class="muted">${last ? fmtTime(last) : '—'}</td><td><button class="btn small" data-act="remove" data-u="${m.user_id}">${H('t.remove')}</button></td></tr>`; }).join('');
  return `<main class="wrap"><div class="t-head"><a class="btn small" href="#/">← ${H('t.classes')}</a><h1>${esc(c.name)}</h1><span>${H('t.codeIs')} <span class="code">${esc(c.code)}</span></span></div>
    <div class="t-head"><span class="muted">${H('t.joining')}</span><button class="btn small" data-act="open">${H(c.open ? 't.openOn' : 't.openOff')}</button>${seg}<button class="btn small" data-act="reload">${H(S.loading ? 't.loading' : 't.reload')}</button><button class="btn small" data-act="csv">${H('t.csv')}</button></div>
    ${testPanelHTML(c)}
    <section class="tiles">${tiles}</section>
    <section class="card"><h2 class="h2s">${H('t.students', { n: S.members.length })}</h2>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th rowspan="2">${H('t.name')}</th>${SUBJECTS.map(s => `<th colspan="3" style="color:var(--c-${s})">${subjNameH(s)}</th>`).join('')}<th rowspan="2">${H('t.last')}</th><th rowspan="2"></th></tr>
        <tr>${SUBJECTS.map(() => `<th>${H('t.rateN')}</th><th>${H('st.avg')}</th><th>${H('st.best')}</th>`).join('')}</tr></thead>
        <tbody>${body || `<tr><td colspan="15" class="muted">${H('t.noStudents', { code: c.code })}</td></tr>`}</tbody></table></div>
      <p class="muted small">${H('t.lowNote')}</p></section>
    <section class="card" style="margin-top:14px"><h2 class="h2s">${H('t.mocks')}</h2>
      ${mocks.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${H('t.when')}</th><th>${H('t.name')}</th><th>${H('tt.subject')}</th><th>${H('t.right')}</th><th>${H('res.answered')}</th></tr></thead><tbody>${mocks.sort((a, b) => (a.at < b.at ? 1 : -1)).map(x => `<tr><td>${fmtTime(x.at)}</td><td>${esc(nickOf(x.user_id) || T('t.leftStudent'))}</td><td>${subjNameH(x.subject)}</td><td><b>${x.score}</b> / ${MOCK[x.subject].n}</td><td>${x.answered}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${H('t.noMocks')}</p>`}</section>
    ${testLogHTML(c)}
    <div class="t-head" style="margin-top:20px"><a class="btn small" href="../#/print/calc" target="_blank" rel="noopener">${H('t.printLink')}</a><button class="btn small" data-act="clear">${H('t.clear')}</button><button class="btn small" data-act="delete">${H('t.delete')}</button></div>
    <p class="err">${esc(S.msg)}</p></main>`;
}
/* one student: each subject day by day, the mock tests, the class tests */
function studentHTML() {
  const c = S.klass, m = S.members.find(x => x.user_id === S.student);
  if (!m) return `<main class="wrap narrow"><a class="btn small" href="#/c/${c.id}">← ${esc(c.name)}</a><p class="muted">${H(S.loading ? 't.loading' : 't.noStudent')}</p></main>`;
  const mine = S.att.filter(r => r.user_id === m.user_id), days = [...new Set(mine.map(r => dayKey(r.created_at)))].sort().slice(-14);
  const cards = SUBJECTS.map(s => { const rs = mine.filter(r => r.subject === s), st = statsOf(rs), classSt = statsOf(S.att.filter(r => r.subject === s));
    const bars = days.map(d => { const x = statsOf(rs.filter(r => dayKey(r.created_at) === d)); return `<span class="dbar" title="${d.slice(5)}: ${x.n ? Math.round(x.rate * 100) + '% (' + x.n + ')' : '—'}"><i style="height:${x.n ? Math.max(4, x.rate * 100) : 0}%"></i><small>${d.slice(8)}</small></span>`; }).join('');
    return `<div class="card sdet" style="--sc:var(--c-${s})"><div class="sdet-h"><b>${subjNameH(s)}</b>${pctHTML(st, s)}</div>
      <p class="muted small">${st.n ? `${H('t.avg', { s: st.sec.toFixed(1) })}・${H('t.classAvg', { p: classSt.n ? Math.round(classSt.rate * 100) : '—' })}` : H('t.notYet')}</p>
      ${days.length ? `<div class="dbars">${bars}</div>` : ''}</div>`; }).join('');
  const mk = mocksOf(mine).sort((a, b) => (a.at < b.at ? 1 : -1));
  const tests = (c.test_log || []).map(t => ({ t, r: mine.filter(x => x.mode === 'test' && x.run === t.id) })).filter(x => x.r.length);
  return `<main class="wrap"><div class="t-head"><a class="btn small" href="#/c/${c.id}">← ${esc(c.name)}</a><h1>${esc(m.nickname)}</h1><span class="muted">${H('t.joined', { d: fmtTime(m.joined_at) })}</span></div>
    <p class="muted small">${H('t.days')}</p>
    <section class="sdet-grid">${cards}</section>
    <section class="card" style="margin-top:14px"><h2 class="h2s">${H('t.mocks')}</h2>${mk.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${H('t.when')}</th><th>${H('tt.subject')}</th><th>${H('t.right')}</th><th>${H('res.answered')}</th></tr></thead><tbody>${mk.map(x => `<tr><td>${fmtTime(x.at)}</td><td>${subjNameH(x.subject)}</td><td><b>${x.score}</b> / ${MOCK[x.subject].n}</td><td>${x.answered}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${H('t.noMocks')}</p>`}</section>
    <section class="card" style="margin-top:14px"><h2 class="h2s">${H('tt.log')}</h2>${tests.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${H('t.when')}</th><th>${H('tt.subject')}</th><th>${H('t.right')}</th></tr></thead><tbody>${tests.map(x => `<tr><td>${fmtTime(x.t.at)}</td><td>${subjNameH(x.t.subject)}</td><td><b>${x.r.filter(r => r.ok).length}</b> / ${x.t.n}</td></tr>`).join('')}</tbody></table></div>` : `<p class="muted">${H('tt.none')}</p>`}</section></main>`;
}
function render() {
  $('#app').innerHTML = !backend.enabled ? `<main class="wrap narrow"><p>${H('t.noConfig')}</p></main>`
    : !S.session ? loginHTML() : !S.ok ? `<main class="wrap narrow"><section class="card"><h1>${H('t.notTeacher')}</h1><p class="muted">${H('t.notTeacherSub')}</p><button class="btn" data-act="logout">${H('t.logout')}</button></section></main>`
    : S.klass ? (S.student ? studentHTML() : classHTML()) : classesHTML();
}

/* ---------- loading ---------- */
async function loadClass(id) {
  S.loading = true;
  try { const [ms, at] = await Promise.all([backend.members(id), backend.attempts(id)]); S.members = ms; S.att = at; S.msg = ''; }
  catch (e) { S.msg = T('t.loadErr'); }
  S.loading = false; render();
}
async function route() {
  const [, view, id, sub, uid] = location.hash.replace(/^#/, '').split('/');
  if (!S.session || !S.ok) return render();
  if (view === 'c' && id) {
    if (!S.classes.length) S.classes = await backend.myClasses();
    const same = S.klass && S.klass.id === id;
    S.klass = S.classes.find(c => c.id === id) || null; S.student = sub === 's' ? uid : null;
    if (S.klass) { if (same) return render(); S.members = []; S.att = []; render(); return loadClass(id); }
  }
  S.klass = null; S.student = null; S.classes = await backend.myClasses().catch(() => []); render();
}
let tick = 0;
setInterval(() => {   // the numbers keep up during a lesson: every 5 seconds while a test runs, otherwise every 30
  const c = S.klass; if (!c || document.hidden || S.loading) return;
  const live = c.test && Date.now() < new Date(c.test.end).getTime(), el = $('#tclock');
  if (el) el.textContent = mmss(new Date(el.dataset.end) - Date.now());
  if (c.test && !live && el) render();   // the time is over
  tick++; if (live ? tick % 5 === 0 : tick % 30 === 0) loadClass(c.id);
}, 1000);

/* ---------- actions ---------- */
function csv() {
  const rows = S.att.filter(r => new Date(r.created_at).getTime() >= since()), mocks = mocksOf(rows);
  const head = [T('t.name'), ...SUBJECTS.flatMap(s => [`${subjName(s)} ${T('st.n')}`, `${subjName(s)} ${T('st.rate')}`, `${subjName(s)} ${T('t.csvSec')}`, `${subjName(s)} ${T('st.best')}`])];
  const cell = v => { let t = String(v == null ? '' : v); if (/^[=+\-@]/.test(t)) t = `'${t}`; return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const lines = [head, ...S.members.map(m => [m.nickname, ...SUBJECTS.flatMap(s => { const st = statsOf(rows.filter(r => r.user_id === m.user_id && r.subject === s)), b = mocks.filter(x => x.user_id === m.user_id && x.subject === s);
    return [st.n, st.n ? Math.round(st.rate * 100) : '', st.n ? st.sec.toFixed(1) : '', b.length ? Math.max(...b.map(x => x.score)) : '']; })])];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + lines.map(l => l.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `${S.klass.code}-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, c = S.klass;
  try {
    if (act === 'logout') { await backend.signOut(); S.session = null; S.ok = false; location.hash = '#/'; render(); }
    else if (act === 'period') { S.period = el.dataset.v; render(); }
    else if (act === 'reload') loadClass(c.id);
    else if (act === 'csv') csv();
    else if (act === 'draft') { const k = el.dataset.k; S.draft[k] = k === 'subject' ? el.dataset.v : +el.dataset.v; render(); }
    else if (act === 'testStart') {
      const now = await backend.serverNow(), d = S.draft, at = now + 3000;
      const t = { id: Math.random().toString(36).slice(2, 10), subject: d.subject, seed: Math.random().toString(36).slice(2, 8), n: d.n, at: new Date(at).toISOString(), end: new Date(at + d.min * 60000).toISOString() };
      S.klass = await backend.updateClass(c.id, { test: t, test_log: [t, ...(c.test_log || [])].slice(0, 30) }); S.classes = S.classes.map(x => (x.id === c.id ? S.klass : x)); render();
    }
    else if (act === 'testStop') {
      if (!confirm(T('tt.stopAsk'))) return;
      const t = c.test, done = Object.assign({}, t, { end: new Date().toISOString() });
      S.klass = await backend.updateClass(c.id, { test: done, test_log: (c.test_log || []).map(x => (x.id === t.id ? done : x)) }); S.openTest = t.id; S.classes = S.classes.map(x => (x.id === c.id ? S.klass : x)); loadClass(c.id);
    }
    else if (act === 'open') { S.klass = await backend.updateClass(c.id, { open: !c.open }); S.classes = S.classes.map(x => (x.id === c.id ? S.klass : x)); render(); }
    else if (act === 'remove') { const m = S.members.find(x => x.user_id === el.dataset.u); if (m && confirm(T('t.removeAsk', { name: m.nickname }))) { await backend.removeMember(c.id, m.user_id); loadClass(c.id); } }
    else if (act === 'clear') { if (confirm(T('t.clearAsk'))) { await backend.clearAttempts(c.id); loadClass(c.id); } }
    else if (act === 'delete') { if (prompt(T('t.deleteAsk', { code: c.code })) === c.code) { await backend.deleteClass(c.id); S.classes = []; location.hash = '#/'; } }
  } catch (err) { S.msg = T('t.actErr'); render(); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), form = e.target.dataset.form;
  try {
    if (form === 'login') { await backend.signIn(String(f.get('email')).trim(), String(f.get('password'))); await start(); }
    else if (form === 'create') { const c = await backend.createClass(String(f.get('name')).trim()); S.classes = []; location.hash = `#/c/${c.id}`; }
  } catch (err) { S.msg = T(form === 'login' ? 't.loginErr' : err.message === 'not_teacher' ? 't.notTeacher' : 't.createErr'); render(); }
});
function mountLang() {
  const slot = $('#lang-slot'); if (slot) slot.innerHTML = langSelectHTML();
  document.querySelectorAll('[data-t]').forEach(el => { el.innerHTML = H(el.dataset.t); });
  document.title = `${T('app.title')} · ${T('t.title')}`;
}
document.addEventListener('change', async e => { if (e.target.matches('[data-lang]')) { await setLang(e.target.value); mountLang(); render(); } });
async function start() {
  if (!backend.enabled) return render();
  S.session = await backend.teacherSession().catch(() => null);
  S.ok = S.session ? await backend.amITeacher().catch(() => false) : false;
  S.msg = ''; route();
}
window.addEventListener('hashchange', route);
(async () => { await setLang(detectLang()); mountLang(); start(); })();
