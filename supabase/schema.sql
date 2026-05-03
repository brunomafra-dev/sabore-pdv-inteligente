create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner', 'manager', 'cashier', 'kitchen', 'stock');
create type public.sales_channel as enum ('counter', 'table', 'delivery');
create type public.order_status as enum ('new', 'preparing', 'ready', 'delivered', 'paid', 'cancelled');
create type public.payment_method as enum ('cash', 'pix', 'credit', 'debit', 'voucher', 'online');
create type public.fiscal_status as enum ('disabled', 'pending', 'authorized', 'rejected');
create type public.inventory_movement_type as enum ('receipt', 'sale', 'production', 'count_adjustment', 'waste', 'manual_exit');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan_price numeric(10,2) not null default 69.90,
  created_at timestamptz not null default now()
);

create table public.restaurant_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  city text not null,
  neighborhood text not null,
  cnpj text,
  fiscal_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid,
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  name text not null,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  label text not null,
  seats integer not null default 4,
  status text not null default 'free'
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  name text not null,
  phone text not null,
  neighborhood text,
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  name text not null,
  measure text not null,
  average_cost numeric(10,4) not null default 0,
  minimum_stock numeric(12,3) not null default 0,
  active boolean not null default true
);

create table public.inventory_lots (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  supplier text not null,
  batch_code text not null,
  quantity numeric(12,3) not null,
  expires_at date not null,
  received_at date not null default current_date
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  name text not null,
  category text not null,
  price numeric(10,2) not null,
  active boolean not null default true,
  preparation_area text not null default 'kitchen'
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,4) not null check (quantity > 0)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  code text not null,
  channel public.sales_channel not null,
  status public.order_status not null default 'new',
  table_id uuid references public.dining_tables(id),
  customer_id uuid references public.customers(id),
  delivery_fee numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  fiscal_status public.fiscal_status not null default 'disabled',
  whatsapp_status text not null default 'not_sent',
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(10,2) not null check (quantity > 0),
  notes text
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method public.payment_method not null,
  amount numeric(10,2) not null check (amount > 0),
  external_id text,
  received_at timestamptz not null default now()
);

create table public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  opened_by uuid references public.user_profiles(id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(10,2) not null default 0,
  expected_amount numeric(10,2) not null default 0,
  status text not null default 'open'
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  type public.inventory_movement_type not null,
  quantity numeric(12,4) not null,
  cost_impact numeric(10,2) not null default 0,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.fiscal_documents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null default 'focus-nfe',
  status public.fiscal_status not null,
  reference text not null,
  access_key text,
  pdf_url text,
  xml_url text,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.restaurant_units(id) on delete cascade,
  name text not null,
  category text not null,
  status text not null default 'draft',
  monthly_price numeric(10,2)
);

alter table public.organizations enable row level security;
alter table public.restaurant_units enable row level security;
alter table public.user_profiles enable row level security;
alter table public.dining_tables enable row level security;
alter table public.customers enable row level security;
alter table public.ingredients enable row level security;
alter table public.inventory_lots enable row level security;
alter table public.products enable row level security;
alter table public.recipe_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.fiscal_documents enable row level security;
alter table public.whatsapp_templates enable row level security;

create index idx_orders_unit_status on public.orders(unit_id, status);
create index idx_inventory_lots_expiry on public.inventory_lots(ingredient_id, expires_at);
create index idx_movements_unit_created on public.inventory_movements(unit_id, created_at desc);
