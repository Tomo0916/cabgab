/* =========================================================
 * backend.js — Supabase (the same project as SQL Practice; tables apt_*)
 * Without config.js the practice still works on this device; only the class is off.
 * ========================================================= */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';

export const enabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
let clientPromise = null;
export function client() {
  if (!enabled) return Promise.reject(new Error('backend_disabled'));
  if (!clientPromise) clientPromise = import('../vendor/supabase.js').then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'apt.auth' } }));
  return clientPromise;
}
function check({ data, error }) { if (error) { const e = new Error(error.message || 'error'); e.code = error.code; throw e; } return data; }
const KNOWN = ['class_not_found', 'class_closed', 'not_teacher'];
const known = e => { const k = KNOWN.find(x => (e.message || '').includes(x)); if (k) e.message = k; return e; };

/* ---------- students ---------- */
async function ensureSession(sb) {
  const { data } = await sb.auth.getSession();
  if (data.session) return data.session;
  return check(await sb.auth.signInAnonymously()).session;
}
export async function joinClass(code, nickname) {
  const sb = await client();
  try { await ensureSession(sb); } catch (e) { throw new Error('anon_disabled'); }
  try { return check(await sb.rpc('apt_join_class', { p_code: code, p_nickname: nickname })); } catch (e) { throw known(e); }
}
export async function leaveClass(classId) {
  const sb = await client(); const { data } = await sb.auth.getSession();
  if (data.session) await sb.from('apt_members').delete().eq('class_id', classId).eq('user_id', data.session.user.id);
}
/** the parts of the class a student's page follows (the class test) */
export async function classRow(classId) { const sb = await client(); return check(await sb.from('apt_classes').select('id, name, open, test').eq('id', classId).maybeSingle()); }
/** the server's time, so the teacher's start time is the same for everyone */
export async function serverNow() { const sb = await client(); try { return new Date(check(await sb.rpc('server_now'))).getTime(); } catch (e) { return Date.now(); } }
/* answers wait in a queue (kept in this browser) until they are sent */
const QKEY = 'apt.queue';
const loadQ = () => { try { return JSON.parse(localStorage.getItem(QKEY) || '[]'); } catch (e) { return []; } };
const saveQ = q => { try { localStorage.setItem(QKEY, JSON.stringify(q.slice(-500))); } catch (e) { /* full */ } };
let flushing = false;
export function logAttempt(row) { const q = loadQ(); q.push(row); saveQ(q); flush(); }
export async function flush() {
  if (!enabled || flushing || !navigator.onLine) return;
  const q = loadQ(); if (!q.length) return;
  flushing = true;
  try { const sb = await client(); await ensureSession(sb); check(await sb.from('apt_attempts').insert(q)); saveQ(loadQ().slice(q.length)); }
  catch (e) { if (/violates|foreign key|row-level/i.test(e.message || '')) saveQ(loadQ().slice(q.length)); }   // a class that is gone: drop them
  finally { flushing = false; }
}
window.addEventListener('online', flush);

/* ---------- teachers ---------- */
export async function teacherSession() { const sb = await client(); const { data } = await sb.auth.getSession(); return data.session && !data.session.user.is_anonymous ? data.session : null; }
export async function signIn(email, password) { const sb = await client(); return check(await sb.auth.signInWithPassword({ email, password })); }
export async function signOut() { const sb = await client(); await sb.auth.signOut(); }
export async function amITeacher() { const sb = await client(); return !!check(await sb.rpc('am_i_teacher')); }
export async function myClasses() { const sb = await client(); const s = await teacherSession(); return check(await sb.from('apt_classes').select('*').eq('teacher_id', s.user.id).order('created_at', { ascending: false })); }
export async function createClass(name) { const sb = await client(); try { return check(await sb.rpc('apt_create_class', { p_name: name })); } catch (e) { throw known(e); } }
export async function updateClass(id, patch) { const sb = await client(); return check(await sb.from('apt_classes').update(patch).eq('id', id).select().single()); }
export async function deleteClass(id) { const sb = await client(); check(await sb.from('apt_classes').delete().eq('id', id)); }
export async function members(classId) { const sb = await client(); return check(await sb.from('apt_members').select('user_id, nickname, joined_at').eq('class_id', classId).order('joined_at')); }
export async function removeMember(classId, userId) { const sb = await client(); check(await sb.from('apt_members').delete().eq('class_id', classId).eq('user_id', userId)); }
/** every answer of the class (in pages of 1000) */
export async function attempts(classId) {
  const sb = await client(), out = [];
  for (let from = 0; ; from += 1000) {
    const rows = check(await sb.from('apt_attempts').select('id, user_id, subject, mode, run, ok, ms, created_at').eq('class_id', classId).order('id').range(from, from + 999));
    out.push(...rows); if (rows.length < 1000) return out;
  }
}
export async function clearAttempts(classId) { const sb = await client(); check(await sb.from('apt_attempts').delete().eq('class_id', classId)); }
