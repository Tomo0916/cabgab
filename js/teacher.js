/* =========================================================
 * teacher.js — the teacher's page: classes, and how each student is doing
 *   #/          my classes
 *   #/c/<id>    one class: subjects, students, mock tests
 * ========================================================= */
import { SUBJECTS, SUBJECT_NAME, MOCK } from './gen.js';
import * as backend from './backend.js';

const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { session: null, ok: false, classes: [], klass: null, members: [], att: [], period: 'all', loading: false, msg: '' };
const fmtTime = iso => { const d = new Date(iso); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const since = () => { const d = new Date(); if (S.period === 'today') { d.setHours(0, 0, 0, 0); return d.getTime(); } if (S.period === 'week') return Date.now() - 7 * 86400000; return 0; };

/* ---------- numbers ---------- */
function statsOf(rows) {
  const n = rows.length, ok = rows.filter(r => r.ok).length, ms = rows.reduce((a, r) => a + (r.ms || 0), 0);
  return { n, ok, rate: n ? ok / n : null, sec: n ? ms / n / 1000 : null };
}
/** mock tests: one per run → { subject, score, answered, at } */
function mocksOf(rows) {
  const by = new Map();
  rows.filter(r => r.mode === 'mock').forEach(r => { const k = `${r.user_id}|${r.run}`, m = by.get(k) || { user_id: r.user_id, subject: r.subject, score: 0, answered: 0, at: r.created_at }; m.answered++; if (r.ok) m.score++; if (r.created_at > m.at) m.at = r.created_at; by.set(k, m); });
  return [...by.values()];
}
const pctHTML = (st, subj) => (st.n ? `<span class="pct" style="--sc:var(--c-${subj})"><i><b style="width:${Math.round(st.rate * 100)}%"></b></i>${Math.round(st.rate * 100)}%<small class="muted">（${st.n}）</small></span>` : '<span class="muted">—</span>');

/* ---------- screens ---------- */
function loginHTML() {
  return `<main class="wrap narrow"><section class="card"><h1>先生用ページ</h1><p class="muted">SQL Practice と同じ先生用アカウント（メールアドレスとパスワード）でログインしてください。</p>
    <form data-form="login"><label class="field"><span>メールアドレス</span><input name="email" type="email" autocomplete="username" required></label>
    <label class="field"><span>パスワード</span><input name="password" type="password" autocomplete="current-password" required></label>
    <button class="btn primary">ログイン</button><p class="err">${esc(S.msg)}</p></form></section></main>`;
}
function classesHTML() {
  return `<main class="wrap narrow"><div class="t-head"><h1>クラス</h1><button class="btn small" data-act="logout">ログアウト</button></div>
    <form class="card join" data-form="create"><input name="name" placeholder="新しいクラスの名前（例：3年1組 CAB対策）" maxlength="80" required><button class="btn primary">クラスを作る</button></form>
    <div class="list" style="margin-top:12px">${S.classes.map(c => `<a class="card" href="#/c/${c.id}"><b>${esc(c.name)}</b><span class="muted">コード <b>${esc(c.code)}</b>${c.open ? '' : '・参加停止中'}</span></a>`).join('') || '<p class="muted">まだクラスがありません。</p>'}</div>
    <p class="err">${esc(S.msg)}</p></main>`;
}
function classHTML() {
  const c = S.klass, from = since(), rows = S.att.filter(r => new Date(r.created_at).getTime() >= from), mocks = mocksOf(rows);
  const seg = `<span class="seg">${[['today', '今日'], ['week', '7日間'], ['all', 'すべて']].map(([k, t]) => `<button class="${S.period === k ? 'on' : ''}" data-act="period" data-v="${k}">${t}</button>`).join('')}</span>`;
  const tiles = SUBJECTS.map(s => { const st = statsOf(rows.filter(r => r.subject === s)), who = new Set(rows.filter(r => r.subject === s).map(r => r.user_id)).size;
    return `<div class="card tile" style="--sc:var(--c-${s})"><span class="muted">${SUBJECT_NAME[s]}</span><b>${st.n ? Math.round(st.rate * 100) + '%' : '—'}</b><small class="muted">${st.n} 問・${who} 人${st.n ? `・平均 ${st.sec.toFixed(1)} 秒` : ''}</small></div>`; }).join('');
  const body = S.members.map(m => { const mine = rows.filter(r => r.user_id === m.user_id), last = mine.length ? mine[mine.length - 1].created_at : null;
    return `<tr><th>${esc(m.nickname)}</th>${SUBJECTS.map(s => { const st = statsOf(mine.filter(r => r.subject === s)), best = mocks.filter(x => x.user_id === m.user_id && x.subject === s);
      return `<td>${pctHTML(st, s)}</td><td class="c">${st.n ? st.sec.toFixed(1) + '秒' : ''}</td><td class="c">${best.length ? `${Math.max(...best.map(x => x.score))}/${MOCK[s].n}` : ''}</td>`; }).join('')}
      <td class="muted">${last ? fmtTime(last) : '—'}</td><td><button class="btn small" data-act="remove" data-u="${m.user_id}">外す</button></td></tr>`; }).join('');
  return `<main class="wrap"><div class="t-head"><a class="btn small" href="#/">← クラス一覧</a><h1>${esc(c.name)}</h1><span>クラスコード <span class="code">${esc(c.code)}</span></span></div>
    <div class="t-head"><span class="muted">参加</span><button class="btn small" data-act="open">${c.open ? '受付中（止める）' : '停止中（再開する）'}</button>${seg}<button class="btn small" data-act="reload">${S.loading ? '更新中…' : '更新'}</button><button class="btn small" data-act="csv">CSV で保存</button></div>
    <section class="tiles">${tiles}</section>
    <section class="card"><h2 style="margin:0 0 8px;font-size:1.05rem">生徒ごとの結果（${S.members.length} 人）</h2>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th rowspan="2">名前</th>${SUBJECTS.map(s => `<th colspan="3" style="color:var(--c-${s})">${SUBJECT_NAME[s]}</th>`).join('')}<th rowspan="2">最後に解いた日時</th><th rowspan="2"></th></tr>
        <tr>${SUBJECTS.map(() => '<th>正答率（問題数）</th><th>平均</th><th>模試ベスト</th>').join('')}</tr></thead>
        <tbody>${body || `<tr><td colspan="15" class="muted">まだ生徒がいません。生徒にクラスコード <b>${esc(c.code)}</b> を伝えてください。</td></tr>`}</tbody></table></div></section>
    <section class="card" style="margin-top:14px"><h2 style="margin:0 0 8px;font-size:1.05rem">模試の記録</h2>
      ${mocks.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>日時</th><th>名前</th><th>科目</th><th>正解</th><th>答えた数</th></tr></thead><tbody>${mocks.sort((a, b) => (a.at < b.at ? 1 : -1)).map(x => `<tr><td>${fmtTime(x.at)}</td><td>${esc((S.members.find(m => m.user_id === x.user_id) || {}).nickname || '（抜けた生徒）')}</td><td>${SUBJECT_NAME[x.subject]}</td><td><b>${x.score}</b> / ${MOCK[x.subject].n}</td><td>${x.answered}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">この期間の模試はありません。</p>'}</section>
    <div class="t-head" style="margin-top:20px"><button class="btn small" data-act="clear">解答の記録をすべて消す</button><button class="btn small" data-act="delete">クラスを削除</button></div>
    <p class="err">${esc(S.msg)}</p></main>`;
}
function render() {
  $('#app').innerHTML = !backend.enabled ? '<main class="wrap narrow"><p>config.js にデータベースの接続先が設定されていません。</p></main>'
    : !S.session ? loginHTML() : !S.ok ? `<main class="wrap narrow"><section class="card"><h1>先生として登録されていません</h1><p class="muted">このメールアドレスは先生の一覧（teachers）にありません。</p><button class="btn" data-act="logout">ログアウト</button></section></main>`
    : S.klass ? classHTML() : classesHTML();
}

/* ---------- loading ---------- */
async function loadClass(id) {
  S.loading = true;
  try { const [ms, at] = await Promise.all([backend.members(id), backend.attempts(id)]); S.members = ms; S.att = at; S.msg = ''; }
  catch (e) { S.msg = '読み込めませんでした。'; }
  S.loading = false; render();
}
async function route() {
  const [, view, id] = location.hash.replace(/^#/, '').split('/');
  if (!S.session || !S.ok) return render();
  if (view === 'c' && id) {
    if (!S.classes.length) S.classes = await backend.myClasses();
    S.klass = S.classes.find(c => c.id === id) || null;
    if (S.klass) { S.members = []; S.att = []; render(); return loadClass(id); }
  }
  S.klass = null; S.classes = await backend.myClasses().catch(() => []); render();
}
setInterval(() => { if (S.klass && !document.hidden && !S.loading) loadClass(S.klass.id); }, 30000);   // the numbers keep up during a lesson

/* ---------- actions ---------- */
function csv() {
  const rows = S.att.filter(r => new Date(r.created_at).getTime() >= since()), mocks = mocksOf(rows);
  const head = ['名前', ...SUBJECTS.flatMap(s => [`${SUBJECT_NAME[s]} 問題数`, `${SUBJECT_NAME[s]} 正答率`, `${SUBJECT_NAME[s]} 平均秒`, `${SUBJECT_NAME[s]} 模試ベスト`])];
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
    else if (act === 'open') { S.klass = await backend.updateClass(c.id, { open: !c.open }); S.classes = S.classes.map(x => (x.id === c.id ? S.klass : x)); render(); }
    else if (act === 'remove') { const m = S.members.find(x => x.user_id === el.dataset.u); if (m && confirm(`${m.nickname} をクラスから外しますか？（記録は残ります）`)) { await backend.removeMember(c.id, m.user_id); loadClass(c.id); } }
    else if (act === 'clear') { if (confirm('このクラスの解答の記録をすべて消しますか？元に戻せません。')) { await backend.clearAttempts(c.id); loadClass(c.id); } }
    else if (act === 'delete') { if (prompt(`クラスを削除すると、生徒と記録もすべて消えます。削除するにはクラスコード ${c.code} を入力してください。`) === c.code) { await backend.deleteClass(c.id); S.classes = []; location.hash = '#/'; } }
  } catch (err) { S.msg = '操作できませんでした。もう一度試してください。'; render(); }
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  const f = new FormData(e.target), form = e.target.dataset.form;
  try {
    if (form === 'login') { await backend.signIn(String(f.get('email')).trim(), String(f.get('password'))); await start(); }
    else if (form === 'create') { const c = await backend.createClass(String(f.get('name')).trim()); S.classes = []; location.hash = `#/c/${c.id}`; }
  } catch (err) { S.msg = form === 'login' ? 'ログインできませんでした。メールアドレスとパスワードを確かめてください。' : err.message === 'not_teacher' ? '先生として登録されていません。' : 'クラスを作れませんでした。'; render(); }
});
async function start() {
  if (!backend.enabled) return render();
  S.session = await backend.teacherSession().catch(() => null);
  S.ok = S.session ? await backend.amITeacher().catch(() => false) : false;
  S.msg = ''; route();
}
window.addEventListener('hashchange', route);
start();
