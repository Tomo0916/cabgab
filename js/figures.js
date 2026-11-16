/* figures.js — the pictures of the problems, as inline SVG */
const INK = 'var(--fig-ink)', PAPER = 'var(--fig-paper)';

/** one shape: circle, triangle, square, diamond, hexagon; f = filled (black) */
export function shapeSVG(s, f, size = 34) {
  const fill = f ? INK : PAPER, st = `fill="${fill}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
  const body = {
    circle: `<circle cx="20" cy="20" r="14" ${st}/>`,
    triangle: `<polygon points="20,5 35,33 5,33" ${st}/>`,
    square: `<rect x="7" y="7" width="26" height="26" ${st}/>`,
    diamond: `<polygon points="20,4 36,20 20,36 4,20" ${st}/>`,
    hexagon: `<polygon points="12,6 28,6 36,20 28,34 12,34 4,20" ${st}/>`
  }[s];
  return `<svg class="shape" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">${body}</svg>`;
}
const SHAPE_JA = { circle: '丸', triangle: '三角', square: '四角', diamond: 'ひし形', hexagon: '六角形' };
const rowLabel = row => row.map(x => `${x.f ? '黒' : '白'}の${SHAPE_JA[x.s]}`).join('、');
/** a row of four shapes */
export function rowHTML(row, size) {
  return `<span class="row" role="img" aria-label="${rowLabel(row)}">${row.map(x => shapeSVG(x.s, x.f, size)).join('')}</span>`;
}

/* 法則性: a square with 8 places around the edge (0 = top-left, clockwise) */
const PLACE = [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2], [0, 1]];
export function ruleFigSVG(fig, size = 76) {
  const at = i => PLACE[i].map(v => 12 + v * 28);
  const [ax, ay] = at(fig.a), [bx, by] = at(fig.b);
  return `<svg class="rfig" viewBox="0 0 80 80" width="${size}" height="${size}" role="img" aria-label="●は${fig.a + 1}番目、△は${fig.b + 1}番目、真ん中は${fig.fill ? '黒' : '白'}">
    <rect x="2" y="2" width="76" height="76" rx="6" fill="${PAPER}" stroke="var(--fig-line)" stroke-width="2"/>
    ${PLACE.map(([x, y]) => `<circle cx="${12 + x * 28}" cy="${12 + y * 28}" r="2" fill="var(--fig-line)"/>`).join('')}
    <rect x="30" y="30" width="20" height="20" rx="3" fill="${fig.fill ? INK : PAPER}" stroke="${INK}" stroke-width="2"/>
    <circle cx="${ax}" cy="${ay}" r="8" fill="${INK}"/>
    <polygon points="${bx},${by - 9} ${bx + 9},${by + 7} ${bx - 9},${by + 7}" fill="${PAPER}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`;
}
export const blankFigHTML = (size = 76) => `<span class="rfig blank" style="width:${size}px;height:${size}px">?</span>`;
