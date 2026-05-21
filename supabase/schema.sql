create type public.user_role as enum ('admin', 'user');
create type public.workflow_type as enum ('localize_existing', 'create_new');
create type public.generation_mode as enum ('manual', 'api');
create type public.generation_provider as enum ('manual_chatgpt_web', 'openai_api');
create type public.task_status as enum ('draft', 'prompt_ready', 'result_uploaded', 'selected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value, description)
values (
  'generation_provider',
  '{"provider":"manual_chatgpt_web"}',
  'Default provider for poster prompt and image generation workflow.'
)
on conflict (key) do nothing;

create table public.scene_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_prompts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  prompt text not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.preset_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  asset_type text not null,
  storage_path text not null,
  metadata jsonb not null default '{}',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.localization_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workflow_type public.workflow_type not null,
  generation_mode public.generation_mode not null default 'manual',
  generation_provider public.generation_provider not null default 'manual_chatgpt_web',
  status public.task_status not null default 'draft',
  uploaded_original_poster jsonb,
  uploaded_face_reference_images jsonb not null default '[]',
  uploaded_additional_reference_images jsonb not null default '[]',
  form_settings jsonb not null,
  final_prompt text not null,
  manually_uploaded_generated_images jsonb not null default '[]',
  selected_image jsonb,
  model_name text,
  quality_level text,
  estimated_cost numeric(10, 4),
  api_response jsonb,
  generated_images jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint v1_manual_provider check (
    generation_mode = 'manual'
    and generation_provider = 'manual_chatgpt_web'
    and model_name is null
    and quality_level is null
    and estimated_cost is null
    and api_response is null
  )
);

insert into public.scene_templates (name, is_default)
values
  ('Family Trip', true),
  ('Business Executive', true),
  ('Urban Commute', true),
  ('Showroom Promotion', true),
  ('PHEV Charging', true),
  ('Outdoor Power / Picnic', true),
  ('Construction Site / Durability', true),
  ('Premium Vehicle Hero Poster', true),
  ('Banquet / Event Arrival', true)
on conflict (name) do nothing;

alter table public.profiles enable row level security;
alter table public.localization_tasks enable row level security;
alter table public.scene_templates enable row level security;
alter table public.system_prompts enable row level security;
alter table public.preset_assets enable row level security;
alter table public.system_settings enable row level security;

create policy "Users can read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Admins can manage profiles"
on public.profiles for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Users can manage own tasks"
on public.localization_tasks for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Admins can manage all tasks"
on public.localization_tasks for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Authenticated users can read templates and prompts"
on public.scene_templates for select
using (auth.role() = 'authenticated');

create policy "Admins can manage templates"
on public.scene_templates for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Authenticated users can read preset assets"
on public.preset_assets for select
using (auth.role() = 'authenticated');

create policy "Admins can manage preset assets"
on public.preset_assets for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can manage system prompts"
on public.system_prompts for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Admins can manage system settings"
on public.system_settings for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "Authenticated users can read active system prompts"
on public.system_prompts for select
using (auth.role() = 'authenticated' and is_active = true);

create policy "Authenticated users can read generation setting"
on public.system_settings for select
using (auth.role() = 'authenticated' and key = 'generation_provider');
