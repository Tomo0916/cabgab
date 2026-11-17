/* =========================================================
 * i18n.js — languages (the same 11 as SQL Practice)
 * Each language lives in i18n/<code>.js. "easy" = やさしい日本語, with
 * furigana written as {漢字|かんじ}. A missing text falls back to English.
 * ========================================================= */
export const LANGS = [
  { code: 'ja', name: '日本語' }, { code: 'easy', name: 'やさしい にほんご' }, { code: 'en', name: 'English' },
  { code: 'ne', name: 'नेपाली' }, { code: 'fr', name: 'Français' }, { code: 'my', name: 'မြန်မာ' }, { code: 'bn', name: 'বাংলা' },
  { code: 'si', name: 'සිංහල' }, { code: 'id', name: 'Bahasa Indonesia' }, { code: 'vi', name: 'Tiếng Việt' }, { code: 'zh', name: '中文' }
];
export const LANG_CODES = LANGS.map(l => l.code);
const HTML_LANG = { easy: 'ja' };
const dicts = {};
let cur = 'ja';
export const lang = () => cur;
export function detectLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && LANG_CODES.includes(q)) return q;
  try { const s = localStorage.getItem('apt.lang'); if (s && LANG_CODES.includes(s)) return s; } catch (e) { /* private mode */ }
  const nav = (navigator.languages || [navigator.language || 'ja']).map(s => String(s).slice(0, 2).toLowerCase());
  return nav.find(c => LANG_CODES.includes(c)) || 'ja';
}
export async function setLang(code) {
  if (!LANG_CODES.includes(code)) code = 'ja';
  await Promise.all([...new Set(['en', code])].map(async c => { if (!dicts[c]) dicts[c] = (await import(`../i18n/${c}.js`)).default; }));
  cur = code;
  try { localStorage.setItem('apt.lang', code); } catch (e) { /* private mode */ }
  document.documentElement.lang = HTML_LANG[code] || code;
}
/** for tests in Node: put a dictionary in directly */
export function useDict(code, d, en) { dicts[code] = d; if (en) dicts.en = en; cur = code; }
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const has = key => !!((dicts[cur] && dicts[cur][key] !== undefined) || (dicts.en && dicts.en[key] !== undefined));
function raw(key) { const d = dicts[cur], s = d && d[key] !== undefined ? d[key] : dicts.en && dicts.en[key]; return s === undefined ? key : s; }
const fill = (s, vars, f) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? f(vars[k]) : m)) : s);
const stripRuby = s => String(s).replace(/\{([^{}|]+)\|([^{}]+)\}/g, '$1');
/** plain text (no furigana): titles, attributes, confirm() */
export const T = (key, vars) => fill(stripRuby(raw(key)), vars, String);
/** HTML with furigana; the variables are escaped */
export const H = (key, vars) => HX(key, vars ? Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, esc(v)])) : vars);
/** HTML with furigana; the variables are HTML already (made by the caller) */
export function HX(key, varsHTML) {
  const s = raw(key);
  let out = '', last = 0;
  s.replace(/\{(\w+)\}/g, (m, k, at) => { out += ruby(s.slice(last, at)) + (varsHTML && varsHTML[k] !== undefined ? varsHTML[k] : esc(m)); last = at + m.length; return m; });
  return out + ruby(s.slice(last));
}
const ruby = str => esc(str).replace(/\{([^{}|]+)\|([^{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');
export function langSelectHTML() {
  return `<select class="lang-sel" data-lang aria-label="Language / 言語">${LANGS.map(l => `<option value="${l.code}" ${l.code === cur ? 'selected' : ''}>${l.name}</option>`).join('')}</select>`;
}
