-- Mon Choix Pneu — profils clients (migration idempotente, sans suppression de données)
-- À exécuter dans Supabase > SQL Editor.
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nom text not null,
  prenom text not null,
  telephone text,
  adresse text,
  complement_adresse text,
  code_postal text,
  ville text,
  created_at timestamptz not null default now()
);

-- Migration additive pour les tables clients déjà présentes : aucun DROP/DELETE de données.
alter table public.clients add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.clients add column if not exists nom text;
alter table public.clients add column if not exists prenom text;
alter table public.clients add column if not exists telephone text;
alter table public.clients add column if not exists adresse text;
alter table public.clients add column if not exists complement_adresse text;
alter table public.clients add column if not exists code_postal text;
alter table public.clients add column if not exists ville text;
alter table public.clients add column if not exists created_at timestamptz not null default now();

create unique index if not exists clients_user_id_unique_idx on public.clients (user_id);
alter table public.clients enable row level security;
grant select, insert, update on public.clients to authenticated;

drop policy if exists clients_select_own on public.clients;
drop policy if exists clients_insert_own on public.clients;
drop policy if exists clients_update_own on public.clients;
create policy clients_select_own on public.clients
  for select to authenticated using (auth.uid() = user_id);
create policy clients_insert_own on public.clients
  for insert to authenticated with check (auth.uid() = user_id);
create policy clients_update_own on public.clients
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_id est NOT NULL sur une nouvelle table. En migration, les anciennes lignes
-- peuvent conserver leur user_id NULL ; RLS interdit alors leur lecture/modification.
