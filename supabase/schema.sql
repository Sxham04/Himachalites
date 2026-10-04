-- Himachalites: database for the district blog spot and admin editing.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Then run seed.sql to copy in today's district text.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per signed-in user. role is null until the admin grants access,
-- so an account that slips in (e.g. sign-ups left enabled) can do nothing.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    email text not null default '',
    display_name text not null default '',
    role text check (role in ('admin', 'author'))
);

create table public.districts (
    slug text primary key,
    name text not null,
    headline text not null default '',
    description text not null default '',
    updated_at timestamptz not null default now()
);

create table public.recommended_spots (
    id bigint generated always as identity primary key,
    district_slug text not null references public.districts (slug) on delete cascade,
    name text not null,
    body text not null default '',
    position int not null default 0
);
create index on public.recommended_spots (district_slug, position);

create table public.posts (
    id uuid primary key default gen_random_uuid(),
    district_slug text not null references public.districts (slug) on delete cascade,
    slug text not null,
    title text not null,
    tag text not null default '',
    excerpt text not null default '',
    body_md text not null default '',
    cover_url text,
    author_id uuid not null references public.profiles (id) default auth.uid(),
    author_name text not null default '',
    status text not null default 'draft' check (status in ('draft', 'published')),
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (district_slug, slug)
);
create index on public.posts (district_slug, status, published_at desc);

-- ---------------------------------------------------------------------------
-- Profiles are created automatically for every new auth user
-- ---------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, email, display_name)
    values (new.id, coalesce(new.email, ''), split_part(coalesce(new.email, ''), '@', 1));
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- The signed-in user's role ('admin', 'author' or null). security definer so
-- policies can read profiles without recursing into the profiles policies.
create function public.my_role() returns text
language sql stable security definer set search_path = public as $$
    select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Row level security: visitors read published content only; authors manage
-- (and publish) their own posts; the admin can change everything.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.districts enable row level security;
alter table public.recommended_spots enable row level security;
alter table public.posts enable row level security;

create policy "own profile or admin reads" on public.profiles
    for select to authenticated using (id = auth.uid() or public.my_role() = 'admin');
-- Only the admin updates profiles, so nobody can raise their own role.
create policy "admin updates profiles" on public.profiles
    for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "anyone reads districts" on public.districts
    for select using (true);
create policy "admin updates districts" on public.districts
    for update to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "anyone reads spots" on public.recommended_spots
    for select using (true);
create policy "admin writes spots" on public.recommended_spots
    for all to authenticated using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

create policy "read published, own or all if admin" on public.posts
    for select using (
        status = 'published'
        or author_id = auth.uid()
        or public.my_role() = 'admin'
    );
create policy "staff create own posts" on public.posts
    for insert to authenticated with check (
        public.my_role() in ('admin', 'author') and author_id = auth.uid()
    );
create policy "author edits own, admin edits any" on public.posts
    for update to authenticated
    using ((public.my_role() = 'author' and author_id = auth.uid()) or public.my_role() = 'admin')
    with check ((public.my_role() = 'author' and author_id = auth.uid()) or public.my_role() = 'admin');
create policy "author deletes own, admin deletes any" on public.posts
    for delete to authenticated
    using ((public.my_role() = 'author' and author_id = auth.uid()) or public.my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Image storage for post covers: public to read, staff to upload
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('blog-images', 'blog-images', true, 2097152, array['image/webp', 'image/jpeg', 'image/png']);

create policy "staff upload blog images" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'blog-images' and public.my_role() in ('admin', 'author'));
create policy "owner or admin deletes blog images" on storage.objects
    for delete to authenticated
    using (bucket_id = 'blog-images' and (owner = auth.uid() or public.my_role() = 'admin'));
