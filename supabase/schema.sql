create extension if not exists "pgcrypto";

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  price numeric(12, 2) not null check (price >= 0),
  email text not null check (char_length(email) <= 254),
  category text not null,
  photo_url text not null,
  created_at timestamptz not null default now()
);

alter table public.listings
  add column if not exists status text not null default 'active',
  add column if not exists reserved_until timestamptz,
  add column if not exists reservation_token uuid,
  add column if not exists sold_at timestamptz;
do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_status_check' and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings add constraint listings_status_check
      check (status in ('active', 'reserved', 'sold'));
  end if;
end $$;

alter table public.listings enable row level security;
grant select, insert on public.listings to anon, authenticated;
grant all on public.listings to service_role;

drop policy if exists "Anyone can read listings" on public.listings;
create policy "Anyone can read listings"
  on public.listings for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can create listings" on public.listings;
create policy "Anyone can create listings"
  on public.listings for insert
  to anon, authenticated
  with check (true);

-- Server-only mapping between listing emails and Stripe connected accounts.
create table if not exists public.seller_connections (
  email text primary key check (char_length(email) between 3 and 254),
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  details_submitted boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.seller_connections enable row level security;
revoke all on public.seller_connections from anon, authenticated;
grant all on public.seller_connections to service_role;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  checkout_request_id uuid not null unique,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_account_id text not null,
  seller_email text not null,
  buyer_email text,
  amount_total bigint not null check (amount_total >= 0),
  application_fee_amount bigint not null check (application_fee_amount >= 0),
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'failed')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists orders_listing_id_idx on public.orders(listing_id);
alter table public.orders enable row level security;
revoke all on public.orders from anon, authenticated;
grant all on public.orders to service_role;

create or replace function public.reserve_marketplace_listing(
  p_listing_id uuid,
  p_request_id uuid,
  p_stripe_account_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  listing_row public.listings%rowtype;
  seller_row public.seller_connections%rowtype;
  amount_cents bigint;
  fee_cents bigint;
begin
  select * into listing_row from public.listings where id = p_listing_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'LISTING_NOT_FOUND'; end if;
  if listing_row.status = 'sold' then raise exception using errcode = 'P0001', message = 'LISTING_SOLD'; end if;
  if listing_row.status = 'reserved' and listing_row.reserved_until > now() then
    raise exception using errcode = 'P0001', message = 'LISTING_RESERVED';
  end if;

  select * into seller_row from public.seller_connections
    where email = lower(trim(listing_row.email)) for share;
  if not found or seller_row.stripe_account_id <> p_stripe_account_id
     or not seller_row.charges_enabled or not seller_row.details_submitted then
    raise exception using errcode = 'P0001', message = 'SELLER_NOT_READY';
  end if;

  if listing_row.reservation_token is not null then
    update public.orders set status = 'expired'
      where checkout_request_id = listing_row.reservation_token and status = 'pending';
  end if;

  amount_cents := round(listing_row.price * 100)::bigint;
  if amount_cents < 50 then raise exception using errcode = 'P0001', message = 'PRICE_BELOW_MINIMUM'; end if;
  fee_cents := round(amount_cents * 0.10)::bigint;

  update public.listings set
    status = 'reserved', reservation_token = p_request_id,
    reserved_until = now() + interval '35 minutes'
  where id = p_listing_id;

  insert into public.orders (
    listing_id, checkout_request_id, stripe_account_id, seller_email,
    amount_total, application_fee_amount, currency, status
  ) values (
    p_listing_id, p_request_id, p_stripe_account_id, lower(trim(listing_row.email)),
    amount_cents, fee_cents, 'usd', 'pending'
  );

  return jsonb_build_object(
    'listing_id', listing_row.id,
    'title', listing_row.title,
    'amount_total', amount_cents,
    'application_fee_amount', fee_cents,
    'seller_email', lower(trim(listing_row.email))
  );
end;
$$;

create or replace function public.attach_marketplace_checkout_session(
  p_request_id uuid,
  p_session_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders set stripe_checkout_session_id = p_session_id
    where checkout_request_id = p_request_id and status = 'pending';
  if not found then raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING'; end if;
end;
$$;

create or replace function public.release_marketplace_listing(
  p_request_id uuid,
  p_status text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('expired', 'failed') then
    raise exception using errcode = 'P0001', message = 'INVALID_RELEASE_STATUS';
  end if;
  update public.orders set status = p_status
    where checkout_request_id = p_request_id and status = 'pending';
  update public.listings set status = 'active', reservation_token = null, reserved_until = null
    where reservation_token = p_request_id and status = 'reserved';
end;
$$;

create or replace function public.complete_marketplace_order(
  p_session_id text,
  p_stripe_account_id text,
  p_payment_intent_id text,
  p_buyer_email text,
  p_amount_total bigint,
  p_currency text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  order_row public.orders%rowtype;
  listing_row public.listings%rowtype;
begin
  select * into order_row from public.orders
    where stripe_checkout_session_id = p_session_id for update;
  if not found then raise exception using errcode = 'P0001', message = 'ORDER_NOT_FOUND'; end if;
  if order_row.stripe_account_id <> p_stripe_account_id then
    raise exception using errcode = 'P0001', message = 'CONNECTED_ACCOUNT_MISMATCH';
  end if;
  if order_row.amount_total <> p_amount_total or order_row.currency <> lower(p_currency) then
    raise exception using errcode = 'P0001', message = 'PAYMENT_AMOUNT_MISMATCH';
  end if;
  if order_row.status = 'paid' then return; end if;
  if order_row.status <> 'pending' then raise exception using errcode = 'P0001', message = 'ORDER_NOT_PENDING'; end if;

  select * into listing_row from public.listings where id = order_row.listing_id for update;
  if not found or listing_row.status <> 'reserved' or listing_row.reservation_token <> order_row.checkout_request_id then
    raise exception using errcode = 'P0001', message = 'LISTING_RESERVATION_MISMATCH';
  end if;

  update public.orders set
    status = 'paid', stripe_payment_intent_id = p_payment_intent_id,
    buyer_email = nullif(lower(trim(p_buyer_email)), ''), paid_at = now()
  where id = order_row.id;
  update public.listings set
    status = 'sold', sold_at = now(), reserved_until = null
  where id = listing_row.id;
end;
$$;

revoke all on function public.reserve_marketplace_listing(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.attach_marketplace_checkout_session(uuid, text) from public, anon, authenticated;
revoke all on function public.release_marketplace_listing(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_marketplace_order(text, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.reserve_marketplace_listing(uuid, uuid, text) to service_role;
grant execute on function public.attach_marketplace_checkout_session(uuid, text) to service_role;
grant execute on function public.release_marketplace_listing(uuid, text) to service_role;
grant execute on function public.complete_marketplace_order(text, text, text, text, bigint, text) to service_role;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete set null,
  listing_title text not null,
  seller_email text,
  buyer_email text not null check (char_length(buyer_email) <= 254),
  message text not null check (char_length(message) between 2 and 2000),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;
grant insert on public.messages to anon, authenticated;

drop policy if exists "Anyone can send seller messages" on public.messages;
create policy "Anyone can send seller messages"
  on public.messages for insert
  to anon, authenticated
  with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view listing photos" on storage.objects;
create policy "Anyone can view listing photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'listing-photos');

drop policy if exists "Anyone can upload listing photos" on storage.objects;
create policy "Anyone can upload listing photos"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'listing-photos');
