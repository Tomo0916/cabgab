-- =========================================================
-- 適性検査 練習 — Supabase schema
-- SQL Practice と同じ Supabase プロジェクトに追加するテーブルです（名前は apt_ で始まります）。
-- 先に SQL Practice の schema.sql が実行されている必要があります（teachers 表と is_teacher() を使います）。
-- Supabase の「SQL Editor」に全部貼り付けて「Run」を押してください（何度実行しても安全です）。
--
--   apt_classes  : クラス（先生が作る）
--   apt_members  : クラスに参加した生徒（名前＝ニックネームのみ）
--   apt_attempts : 生徒が答えた記録（科目・練習/模試・正解かどうか・かかった時間）
--
-- 生徒は匿名ログイン、先生は SQL Practice と同じメール＋パスワードでログインします。
-- 行レベルセキュリティ（RLS）で、生徒は自分の記録だけ、先生は自分のクラスの記録だけを見られます。
-- =========================================================

create table if not exists public.apt_classes (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique check (code ~ '^[A-Z0-9]{4,8}$'),
  name       text not null check (char_length(name) between 1 and 80),
  teacher_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  open       boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.apt_members (
  class_id  uuid not null references public.apt_classes(id) on delete cascade,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nickname  text not null check (char_length(btrim(nickname)) between 1 and 30),
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);
create table if not exists public.apt_attempts (
  id         bigint generated always as identity primary key,
  class_id   uuid not null references public.apt_classes(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject    text not null check (subject in ('calc', 'rule', 'table', 'cipher')),
  mode       text not null check (mode in ('practice', 'mock')),
  run        text not null check (char_length(run) between 1 and 16),
  ok         boolean not null,
  ms         integer check (ms between 0 and 3600000),
  created_at timestamptz not null default now()
);
create index if not exists apt_attempts_class on public.apt_attempts (class_id, id);
create index if not exists apt_classes_teacher on public.apt_classes (teacher_id);

create or replace function public.apt_is_teacher_of(cid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select public.is_teacher() and exists (select 1 from public.apt_classes c where c.id = cid and c.teacher_id = auth.uid()) $$;
create or replace function public.apt_is_member_of(cid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.apt_members m where m.class_id = cid and m.user_id = auth.uid()) $$;

alter table public.apt_classes  enable row level security;
alter table public.apt_members  enable row level security;
alter table public.apt_attempts enable row level security;

drop policy if exists apt_classes_select on public.apt_classes;
drop policy if exists apt_classes_update on public.apt_classes;
drop policy if exists apt_classes_delete on public.apt_classes;
create policy apt_classes_select on public.apt_classes for select to authenticated
  using ((teacher_id = auth.uid() and public.is_teacher()) or public.apt_is_member_of(id));
create policy apt_classes_update on public.apt_classes for update to authenticated
  using (teacher_id = auth.uid() and public.is_teacher()) with check (teacher_id = auth.uid());
create policy apt_classes_delete on public.apt_classes for delete to authenticated
  using (teacher_id = auth.uid() and public.is_teacher());

drop policy if exists apt_members_select on public.apt_members;
drop policy if exists apt_members_delete on public.apt_members;
create policy apt_members_select on public.apt_members for select to authenticated
  using (user_id = auth.uid() or public.apt_is_teacher_of(class_id));
create policy apt_members_delete on public.apt_members for delete to authenticated
  using (user_id = auth.uid() or public.apt_is_teacher_of(class_id));

drop policy if exists apt_attempts_select on public.apt_attempts;
drop policy if exists apt_attempts_insert on public.apt_attempts;
drop policy if exists apt_attempts_delete on public.apt_attempts;
create policy apt_attempts_select on public.apt_attempts for select to authenticated
  using (user_id = auth.uid() or public.apt_is_teacher_of(class_id));
create policy apt_attempts_insert on public.apt_attempts for insert to authenticated
  with check (user_id = auth.uid() and public.apt_is_member_of(class_id));
create policy apt_attempts_delete on public.apt_attempts for delete to authenticated
  using (public.apt_is_teacher_of(class_id));

revoke all on public.apt_classes, public.apt_members, public.apt_attempts from anon;
grant select, update, delete on public.apt_classes to authenticated;
grant select, delete on public.apt_members to authenticated;
grant select, insert, delete on public.apt_attempts to authenticated;

-- 生徒がコードでクラスに参加する
create or replace function public.apt_join_class(p_code text, p_nickname text)
  returns public.apt_classes language plpgsql security definer set search_path = public as
$$
declare c public.apt_classes;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if char_length(btrim(coalesce(p_nickname, ''))) = 0 then raise exception 'nickname_empty'; end if;
  select * into c from public.apt_classes where code = upper(btrim(p_code));
  if not found then raise exception 'class_not_found' using errcode = 'P0002'; end if;
  if not c.open then raise exception 'class_closed' using errcode = 'P0001'; end if;
  insert into public.apt_members (class_id, user_id, nickname) values (c.id, auth.uid(), left(btrim(p_nickname), 30))
    on conflict (class_id, user_id) do update set nickname = excluded.nickname;
  return c;
end
$$;

-- 先生がクラスを作る（読みやすいコードを自動で決める）
create or replace function public.apt_create_class(p_name text)
  returns public.apt_classes language plpgsql security definer set search_path = public as
$$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text; c public.apt_classes;
begin
  if not public.is_teacher() then raise exception 'not_teacher' using errcode = '42501'; end if;
  loop
    new_code := '';
    for i in 1..6 loop new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from public.apt_classes where code = new_code);
  end loop;
  insert into public.apt_classes (code, name, teacher_id) values (new_code, left(btrim(p_name), 80), auth.uid()) returning * into c;
  return c;
end
$$;

revoke all on function public.apt_join_class(text, text) from public, anon;
revoke all on function public.apt_create_class(text) from public, anon;
grant execute on function public.apt_join_class(text, text) to authenticated;
grant execute on function public.apt_create_class(text) to authenticated;

-- ---------- クラスのテスト（先生が全員に同時に出すテスト）2026-11-16 ----------
-- test     = 実施中のテスト { id, subject, seed, n, at, end }（null = なし）
-- test_log = これまでのテスト（新しい順、最大 30）
alter table public.apt_classes add column if not exists test jsonb;
alter table public.apt_classes add column if not exists test_log jsonb check (test_log is null or jsonb_typeof(test_log) = 'array');
alter table public.apt_attempts drop constraint if exists apt_attempts_mode_check;
alter table public.apt_attempts add constraint apt_attempts_mode_check check (mode in ('practice', 'mock', 'test'));
