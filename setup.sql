-- Starry Nights Translation: database setup
-- 1. Change YOUR-EMAIL@EXAMPLE.COM at the very bottom to your own email.
-- 2. Paste this whole file into Supabase > SQL Editor > New query, then click Run.

create extension if not exists pgcrypto;

-- Books everyone can see
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text default '',
  genres text[] default '{}',
  synopsis text default '',
  status text default 'ongoing' check (status in ('ongoing','completed','hiatus')),
  access text default 'free' check (access in ('free','members')),
  chapters integer default 0 check (chapters >= 0),
  cover text default 'rose',
  featured boolean default false,
  read_url text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Reading links for members-only books (only you can see these)
create table if not exists public.private_links (
  book_id uuid primary key references public.books(id) on delete cascade,
  url text not null
);

-- Your paid members (only you can see these)
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact text default '',
  tier text default '',
  status text default 'active' check (status in ('active','paused','cancelled')),
  since date,
  renew_on date,
  notes text default '',
  updated_at timestamptz default now()
);

-- Site name, tagline, membership link, tiers
create table if not exists public.site_config (
  id integer primary key default 1 check (id = 1),
  site_name text default 'Starry Nights Translation',
  tagline text default 'Romance, fantasy and everything in between.',
  join_url text default '',
  tiers text[] default array['Bronze','Silver','Gold']
);
insert into public.site_config (id) values (1) on conflict (id) do nothing;

-- Who counts as the owner
create table if not exists public.owners (email text primary key);
alter table public.owners enable row level security; -- no policies: never readable from the website

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.owners
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_owner() to anon, authenticated;

-- Security rules
alter table public.books enable row level security;
alter table public.site_config enable row level security;
alter table public.members enable row level security;
alter table public.private_links enable row level security;

drop policy if exists "Public reads books" on public.books;
drop policy if exists "Owner writes books" on public.books;
create policy "Public reads books" on public.books for select to anon, authenticated using (true);
create policy "Owner writes books" on public.books for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "Public reads settings" on public.site_config;
drop policy if exists "Owner writes settings" on public.site_config;
create policy "Public reads settings" on public.site_config for select to anon, authenticated using (true);
create policy "Owner writes settings" on public.site_config for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "Owner only members" on public.members;
create policy "Owner only members" on public.members for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists "Owner only links" on public.private_links;
create policy "Owner only links" on public.private_links for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- >>> CHANGE THIS to the email you'll log in with <<<
insert into public.owners (email) values ('YOUR-EMAIL@EXAMPLE.COM') on conflict do nothing;
