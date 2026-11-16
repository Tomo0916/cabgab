/* =========================================================
 * app.js — the student's page
 *   #/                 home: the subjects, my results, the class
 *   #/practice/<subj>  10 problems with an explanation after each
 *   #/mock/<subj>      the timed test (answers and explanations at the end)
 * ========================================================= */
import { SUBJECTS, SUBJECT_NAME, MOCK, makeProblem, ROW_OPS } from './gen.js';
import { rowHTML, ruleFigSVG, blankFigHTML } from './figures.js';
import * as backend from './backend.js';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
};
const PRACTICE_N = 10;
const DESC = {
  calc: '式の □ に入る数を選びます。右辺を先に計算して、逆算します。',
  rule: '5 つの図形がある規則で並んでいます。? に入る図形を選びます。',
  table: '命令の表を見ながら、図形の並びに命令を順に当てはめます。',
  cipher: '例から記号の意味（命令）を読み取り、新しい並びに当てはめます。'
};
const ICON = { calc: '±', rule: '◳', table: '⇄', cipher: '♠' };

/* ---------- state ---------- */
const S = { session: null, timer: null };
const prog = () => store.get('apt.progress', { subj: {}, mocks: [] });
function recordLocal(subject, ok, ms) {
  const p = prog(), s = p.subj[subject] || { n: 0, ok: 0, ms: 0 };
  s.n++; if (ok) s.ok++; s.ms += ms; p.subj[subject] = s; store.set('apt.progress', p);
}
const klass = () => store.get('apt.class', null);
function logClass(subject, mode, run, ok, ms) {
  const c = klass(); if (!c || !backend.enabled) return;
  backend.logAttempt({ class_id: c.id, subject, mode, run, ok, ms: Math.min(3600000, Math.round(ms)) });
}

/* ---------- drawing a problem ---------- */
function choiceHTML(p, c) {
  if (p.subject === 'calc') return `<span class="num">${esc(c)}</span>`;
  if (p.subject === 'rule') return ruleFigSVG(c, 64);
  return rowHTML(c, 26);
}
function bodyHTML(p) {
  if (p.subject === 'calc') return `<div class="eq">${esc(p.prompt).replace('□', '<span class="box">□</span>')}</div>`;
  if (p.subject === 'rule') return `<p class="ask">${esc(p.prompt)}</p><div class="seq">${p.seq.map((f, i) => (i === p.blank ? blankFigHTML() : ruleFigSVG(f))).join('<i class="arrow">›</i>')}</div>`;
  if (p.subject === 'table') return `<p class="ask">${esc(p.prompt)}</p>
    <div class="cmd-table">${p.table.map(t => `<div><b class="mark">${t.mark}</b><span>${esc(ROW_OPS[t.op].name)}</span></div>`).join('')}</div>
    <div class="flow">${rowHTML(p.row)}${p.marks.map(m => `<i class="arrow">→</i><b class="mark">${m}</b>`).join('')}<i class="arrow">→</i><span class="q">?</span></div>`;
  return `<p class="ask">${esc(p.prompt)}</p>
    <div class="examples">${p.examples.map((e, i) => `<div class="flow ex"><small>例${i + 1}</small>${rowHTML(e.row, 26)}${e.marks.map(m => `<i class="arrow">→</i><b class="glyph">${m}</b>`).join('')}<i class="arrow">→</i>${rowHTML(e.out, 26)}</div>`).join('')}</div>
    <div class="flow">${rowHTML(p.row)}${p.marks.map(m => `<i class="arrow">→</i><b class="glyph">${m}</b>`).join('')}<i class="arrow">→</i><span class="q">?</span></div>`;
}
const LABEL = ['1', '2', '3', '4', '5'];   // numbers, so they are not mistaken for the commands A–F
function choicesHTML(p, picked, show) {
  return `<div class="choices ${p.subject}">${p.choices.map((c, i) => {
    const cls = show ? (i === p.answer ? 'right' : i === picked ? 'wrong' : 'dim') : '';
    return `<button class="choice ${cls}" data-act="pick" data-i="${i}" ${show ? 'disabled' : ''}><b class="lab">${LABEL[i]}</b>${choiceHTML(p, c)}</button>`; }).join('')}</div>`;
}

/* ---------- screens ---------- */
const mmss = sec => `${Math.floor(sec / 60)}:${String(Math.max(0, Math.floor(sec % 60))).padStart(2, '0')}`;
function homeHTML() {
  const p = prog(), c = klass();
  const best = s => { const ms = p.mocks.filter(m => m.subject === s); return ms.length ? Math.max(...ms.map(m => m.score)) : null; };
  return `<main class="wrap">
    <section class="hero"><h1>適性検査 練習</h1><p>CAB 形式の 4 科目を、毎回新しい問題で練習します。まずは「練習」で解き方に慣れ、「模試」で本番と同じ時間配分に挑戦しましょう。</p></section>
    <section class="grid">${SUBJECTS.map(s => { const x = p.subj[s], b = best(s);
      return `<article class="card subj s-${s}"><div class="subj-h"><span class="ic">${ICON[s]}</span><h2>${SUBJECT_NAME[s]}</h2></div>
        <p class="muted">${DESC[s]}</p>
        <dl class="stats"><div><dt>正答率</dt><dd>${x && x.n ? Math.round(x.ok / x.n * 100) + '%' : '—'}</dd></div><div><dt>解いた数</dt><dd>${x ? x.n : 0}</dd></div><div><dt>1問の平均</dt><dd>${x && x.n ? (x.ms / x.n / 1000).toFixed(1) + '秒' : '—'}</dd></div><div><dt>模試ベスト</dt><dd>${b === null ? '—' : `${b}/${MOCK[s].n}`}</dd></div></dl>
        <div class="btns"><a class="btn primary" href="#/practice/${s}">練習（${PRACTICE_N}問）</a><a class="btn" href="#/mock/${s}">模試 ${MOCK[s].n}問・${MOCK[s].sec / 60}分</a></div></article>`; }).join('')}</section>
    <section class="card class-card">${c ? `<h2>クラス：${esc(c.name)}</h2><p class="muted">「${esc(c.nickname)}」として参加中です。解いた結果は先生に届きます。</p><button class="btn small" data-act="leave">クラスから抜ける</button>`
      : backend.enabled ? `<h2>クラスに参加する</h2><p class="muted">先生から聞いたクラスコードと、名前（ニックネーム）を入れてください。</p>
        <form class="join" data-form="join"><input name="code" placeholder="クラスコード" autocomplete="off" maxlength="8" required><input name="nick" placeholder="名前" maxlength="30" required><button class="btn primary">参加する</button></form><p class="err" id="join-err"></p>` : '<p class="muted">クラス機能はまだ設定されていません。</p>'}</section>
    <p class="note">問題はこのアプリが自動で作るオリジナルの練習問題です。実際の試験の問題ではありません。模試の問題数と時間は、Web テストの一般的な目安です。</p>
  </main>`;
}
function newSession(mode, subject) {
  const n = mode === 'mock' ? MOCK[subject].n : PRACTICE_N, run = Math.random().toString(36).slice(2, 10);
  const items = Array.from({ length: n }, (_, i) => makeProblem(subject, `${run}|${i}`));
  return { mode, subject, run, items, i: 0, picks: [], ms: [], t: performance.now(), end: mode === 'mock' ? Date.now() + MOCK[subject].sec * 1000 : null, shown: false, done: false };
}
function sessionHTML() {
  const s = S.session, p = s.items[s.i], name = SUBJECT_NAME[s.subject];
  if (s.done) return resultHTML();
  const left = s.end ? (s.end - Date.now()) / 1000 : null, picked = s.picks[s.i];
  return `<main class="wrap narrow">
    <div class="bar-top"><a class="btn small" href="#/" data-act="quit">やめる</a><b>${name}・${s.mode === 'mock' ? '模試' : '練習'}</b>
      <span class="count">${s.i + 1} / ${s.items.length}</span>${s.end ? `<span class="clock ${left < 60 ? 'low' : ''}" id="clock">${mmss(left)}</span>` : ''}</div>
    <div class="progress"><i style="width:${s.i / s.items.length * 100}%"></i></div>
    <section class="card problem">${bodyHTML(p)}${choicesHTML(p, picked, s.shown)}
      ${s.shown ? `<div class="fb ${picked === p.answer ? 'ok' : 'ng'}"><b>${picked === p.answer ? '正解！' : `不正解。正解は ${LABEL[p.answer]}`}</b><p>${esc(p.explain)}</p>
        <button class="btn primary" data-act="next">${s.i + 1 < s.items.length ? '次の問題' : '結果を見る'}</button></div>` : ''}</section>
  </main>`;
}
function resultHTML() {
  const s = S.session, ok = s.items.filter((p, i) => s.picks[i] === p.answer).length, answered = s.picks.filter(x => x !== undefined).length;
  const avg = answered ? s.ms.reduce((a, b) => a + (b || 0), 0) / answered / 1000 : 0;
  return `<main class="wrap narrow"><section class="card result"><h1>${SUBJECT_NAME[s.subject]}・${s.mode === 'mock' ? '模試' : '練習'}の結果</h1>
      <p class="score">${ok}<small> / ${s.items.length}</small></p>
      <dl class="stats"><div><dt>答えた数</dt><dd>${answered}</dd></div><div><dt>正答率</dt><dd>${answered ? Math.round(ok / answered * 100) : 0}%</dd></div><div><dt>1問の平均</dt><dd>${avg.toFixed(1)}秒</dd></div></dl>
      <div class="btns"><a class="btn primary" href="#/${s.mode}/${s.subject}?again=${Date.now()}">もう一度</a><a class="btn" href="#/">ホームへ</a></div></section>
    ${s.mode === 'mock' ? `<h2 class="review-h">答えの確認</h2>${s.items.map((p, i) => { const pk = s.picks[i];
      return `<details class="card review ${pk === p.answer ? 'ok' : 'ng'}"><summary><b>${i + 1}</b><span>${pk === undefined ? '未回答' : pk === p.answer ? '○ 正解' : '× 不正解'}</span></summary>${bodyHTML(p)}${choicesHTML(p, pk, true)}<p class="explain">${esc(p.explain)}</p></details>`; }).join('')}` : ''}</main>`;
}

/* ---------- actions ---------- */
function answer(i) {
  const s = S.session; if (!s || s.shown || s.done || s.picks[s.i] !== undefined) return;
  const p = s.items[s.i], ms = performance.now() - s.t, ok = i === p.answer;
  s.picks[s.i] = i; s.ms[s.i] = ms;
  recordLocal(s.subject, ok, ms); logClass(s.subject, s.mode, s.run, ok, ms);
  if (s.mode === 'practice') { s.shown = true; render(); return; }
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
  render(); window.scrollTo(0, 0);
}

/* ---------- routing ---------- */
function route() {
  const [path] = location.hash.replace(/^#\/?/, '').split('?'), [view, subj] = path.split('/');
  clearInterval(S.timer);
  if ((view === 'practice' || view === 'mock') && SUBJECTS.includes(subj)) {
    S.session = newSession(view, subj);
    if (view === 'mock') S.timer = setInterval(() => {
      const left = (S.session.end - Date.now()) / 1000, el = $('#clock');
      if (left <= 0) return finish();
      if (el) { el.textContent = mmss(left); el.classList.toggle('low', left < 60); }
    }, 500);
  } else S.session = null;
  render(); window.scrollTo(0, 0);
}
function render() { $('#app').innerHTML = S.session ? sessionHTML() : homeHTML(); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act === 'pick') answer(+el.dataset.i);
  else if (act === 'next') next();
  else if (act === 'quit') { if (S.session && !S.session.done && S.session.picks.length && !confirm('途中でやめますか？')) e.preventDefault(); }
  else if (act === 'leave') { if (!confirm('クラスから抜けますか？')) return; const c = klass(); try { await backend.leaveClass(c.id); } catch (err) { /* offline */ } store.set('apt.class', null); render(); }
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
    store.set('apt.class', { id: c.id, name: c.name, code: c.code, nickname: String(f.get('nick')).trim() }); render();
  } catch (err) {
    errEl.textContent = { class_not_found: 'クラスコードが見つかりません。', class_closed: 'このクラスは今、参加を受け付けていません。', anon_disabled: 'クラスに接続できませんでした（先生に伝えてください）。' }[err.message] || 'クラスに接続できませんでした。通信を確かめて、もう一度試してください。';
    btn.disabled = false;
  }
});
window.addEventListener('hashchange', route);
route();
backend.flush();
