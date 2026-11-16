/* =========================================================
 * learn.js — 解き方: how to solve each subject, with an example worked
 * step by step (a new example every time). Shown before practising,
 * and by the teacher in front of the class.
 * ========================================================= */
import { makeProblem, ROW_OPS, applyOps, SUBJECT_NAME } from './gen.js';
import { rowHTML, ruleFigSVG, blankFigHTML } from './figures.js';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const step = (n, title, body) => `<li class="lstep"><b class="lno">${n}</b><div><h3>${title}</h3>${body}</div></li>`;

const POINTS = {
  calc: ['右辺は先に計算して 1 つの数にする。', '□ の位置で、逆算の式が変わる（下の表）。', '迷ったら選択肢を □ に入れて確かめる。一の位や大きさで、明らかに違うものを消すと速い。'],
  rule: ['1 つずつ見る：まず ●、次に △、最後に真ん中。', '● と △ は、外側の 8 か所を時計回り（または反対回り）に進む。何こ進むかを数える。', '? の前後の図形の両方から、つじつまが合うかを確かめる。'],
  table: ['命令は書かれた順に 1 つずつ当てはめる。まとめてやらない。', '途中の並びをメモする（紙や頭の中で）。', '白黒を変える命令と、並びを変える命令を区別する。'],
  cipher: ['記号が 1 つだけの例から、その記号の意味を決める。', '意味がわかった記号を使って、残りの例からほかの記号を決める。', '最後は「命令表」と同じ。わかった意味を順に当てはめる。']
};
const CALC_TABLE = `<table class="ltbl"><thead><tr><th>式の形</th><th>□ の求め方</th></tr></thead><tbody>
  <tr><td>□ + a = b</td><td>□ = b − a</td></tr><tr><td>□ − a = b</td><td>□ = b + a</td></tr><tr><td>a − □ = b</td><td>□ = a − b</td></tr>
  <tr><td>□ × a = b</td><td>□ = b ÷ a</td></tr><tr><td>□ ÷ a = b</td><td>□ = b × a</td></tr><tr><td>a ÷ □ = b</td><td>□ = a ÷ b</td></tr></tbody></table>`;

function example(subject, seed) {
  const p = makeProblem(subject, seed), ans = p.choices[p.answer];
  if (subject === 'calc') return { p, steps: [
    step(1, '問題', `<div class="eq small">${esc(p.prompt).replace('□', '<span class="box">□</span>')}</div>`),
    step(2, '右辺を計算する', `<p>右辺 ＝ <b>${esc(p.rhsValue)}</b></p>`),
    step(3, '逆算する', `<p>${esc(p.how)} ＝ <b>${esc(p.x)}</b></p>`),
    step(4, '答え', `<p class="ans">${esc(ans)}</p>`)] };
  if (subject === 'rule') {
    const dir = d => (d === 0 ? '動かない' : `${d > 0 ? '時計回り' : '反時計回り'}に ${Math.abs(d)} つずつ`);
    return { p, steps: [
      step(1, '問題', `<div class="seq">${p.seq.map((f, i) => (i === p.blank ? blankFigHTML(60) : ruleFigSVG(f, 60))).join('<i class="arrow">›</i>')}</div>`),
      step(2, '● の動きを見る', `<p>● は <b>${dir(p.da)}</b> 進んでいる。</p>`),
      step(3, '△ の動きを見る', `<p>△ は <b>${dir(p.db)}</b>${p.db === 0 ? '' : ' 進んでいる'}。</p>`),
      step(4, '真ん中を見る', `<p>真ん中は <b>${p.fillRule === 'alt' ? '黒と白が交互' : 'ずっと同じ'}</b>。</p>`),
      step(5, '答え', ruleFigSVG(ans, 70))] };
  }
  if (subject === 'table') {
    let row = p.row; const mids = p.ops.map((k, i) => { row = applyOps(row, [k]); return step(i + 2, `命令 ${p.marks[i]}：${esc(ROW_OPS[k].name)}`, rowHTML(row, 28)); });
    return { p, steps: [step(1, 'はじめの並び', `${rowHTML(p.row, 28)}<p class="muted small">命令 ${p.marks.join(' → ')} の順に当てはめる。</p>`), ...mids, step(p.ops.length + 2, '答え', rowHTML(ans, 28))] };
  }
  // cipher: decide the meaning of each glyph from the examples, then apply
  const mean = Object.fromEntries(p.meaning.map(x => [x.g, x.op]));
  const exSteps = p.examples.map((e, i) => {
    const unknown = e.marks[e.marks.length - 1], known = e.marks.slice(0, -1);
    return step(i + 1, `例${i + 1} から ${unknown} の意味を決める`, `<div class="flow">${rowHTML(e.row, 24)}${e.marks.map(m => `<i class="arrow">→</i><b class="glyph">${m}</b>`).join('')}<i class="arrow">→</i>${rowHTML(e.out, 24)}</div>
      <p>${known.length ? `${known.join('・')} の意味はわかっているので、それを当てはめたあと、残りの変化が ${unknown} の意味。` : ''}${unknown} ＝ <b>${esc(ROW_OPS[mean[unknown]].name)}</b></p>`);
  });
  let row = p.row; const apply = p.marks.map((m, i) => { row = applyOps(row, [mean[m]]); return `<div class="flow"><b class="glyph">${m}</b><i class="arrow">→</i>${rowHTML(row, 24)}</div>`; }).join('');
  return { p, steps: [...exSteps, step(4, '問題の並びに当てはめる', `${rowHTML(p.row, 24)}${apply}`), step(5, '答え', rowHTML(ans, 28))] };
}

export function learnHTML(subject, seed) {
  const { steps } = example(subject, seed);
  return `<main class="wrap narrow learn"><div class="bar-top"><a class="btn small" href="#/">ホーム</a><b>${SUBJECT_NAME[subject]}・解き方</b></div>
    <section class="card"><h2>ポイント</h2><ol class="points">${POINTS[subject].map(x => `<li>${x}</li>`).join('')}</ol>${subject === 'calc' ? CALC_TABLE : ''}</section>
    <section class="card"><div class="lhead"><h2>例題</h2><button class="btn small" data-act="newExample">別の例題</button></div><ol class="lsteps">${steps.join('')}</ol></section>
    <div class="btns center"><a class="btn primary" href="#/practice/${subject}">練習する（10問）</a><a class="btn" href="#/mock/${subject}">模試に挑戦</a></div></main>`;
}
