-- ハツミル MVP用 Supabaseスキーマ
-- Supabaseダッシュボード → SQL Editor に貼り付けて実行してください

create extension if not exists "pgcrypto";

-- 活動者
create table if not exists creators (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  genre text not null,
  phase text not null default '準備中',
  bio text,
  sns_url text,
  radar jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- はじめて記録
create table if not exists milestones (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references creators(id) on delete cascade,
  title text not null,
  description text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

-- おめでとうリアクション（CPの元データ）
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references milestones(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);

-- RLS有効化
alter table creators enable row level security;
alter table milestones enable row level security;
alter table reactions enable row level security;

-- MVP段階: 誰でも読み書きできる状態にしておく
-- (本人確認・認証を実装する段階で insert/update ポリシーを絞る)
create policy "public read creators" on creators for select using (true);
create policy "public insert creators" on creators for insert with check (true);

create policy "public read milestones" on milestones for select using (true);
create policy "public insert milestones" on milestones for insert with check (true);

create policy "public read reactions" on reactions for select using (true);
create policy "public insert reactions" on reactions for insert with check (true);

-- 検索を軽くするための索引
create index if not exists idx_milestones_creator on milestones(creator_id);
create index if not exists idx_reactions_milestone on reactions(milestone_id);
