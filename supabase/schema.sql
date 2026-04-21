-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Households ────────────────────────────────────────────────────────────────
create table households (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  invite_code text unique not null default upper(substring(md5(random()::text), 1, 8)),
  created_by  uuid references auth.users(id) not null,
  created_at  timestamptz default now()
);

-- ─── Household members ─────────────────────────────────────────────────────────
create table household_members (
  id           uuid primary key default uuid_generate_v4(),
  household_id uuid references households(id) on delete cascade not null,
  user_id      uuid references auth.users(id) on delete cascade not null,
  display_name text,
  role         text default 'member' check (role in ('admin', 'member')),
  joined_at    timestamptz default now(),
  unique(household_id, user_id)
);

-- ─── Recipes ───────────────────────────────────────────────────────────────────
create table recipes (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  source_url   text,
  thumbnail_url text,
  summary      text,
  cuisine_tags text[] default '{}',
  meal_type    text default 'dinner',
  equipment    text[] default '{}',
  ingredients  jsonb default '[]',   -- [{name, amount, unit, optional}]
  servings     int,
  cook_time    text,
  created_by   uuid references auth.users(id) not null,
  household_id uuid references households(id),   -- null = personal only
  is_shared    boolean default false,
  created_at   timestamptz default now()
);

-- ─── Cooking logs (journal) ────────────────────────────────────────────────────
create table cooking_logs (
  id          uuid primary key default uuid_generate_v4(),
  recipe_id   uuid references recipes(id) on delete cascade not null,
  user_id     uuid references auth.users(id) not null,
  cooked_at   date not null default current_date,
  notes       text,
  photo_url   text,
  cooked_with text[] default '{}',  -- names of people
  rating      int check (rating between 1 and 5),
  created_at  timestamptz default now()
);

-- ─── Meal plans ────────────────────────────────────────────────────────────────
create table meal_plans (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references auth.users(id) not null,
  household_id uuid references households(id),
  week_start   date not null,  -- always a Monday
  created_at   timestamptz default now(),
  unique(user_id, week_start)
);

-- ─── Meal plan slots ───────────────────────────────────────────────────────────
create table meal_plan_slots (
  id           uuid primary key default uuid_generate_v4(),
  meal_plan_id uuid references meal_plans(id) on delete cascade not null,
  day_of_week  int not null check (day_of_week between 0 and 6),  -- 0=Mon, 6=Sun
  meal_type    text not null check (meal_type in ('breakfast','lunch','dinner','snack')),
  recipe_id    uuid references recipes(id) on delete cascade not null
);

-- ─── Row Level Security ────────────────────────────────────────────────────────
alter table households       enable row level security;
alter table household_members enable row level security;
alter table recipes          enable row level security;
alter table cooking_logs     enable row level security;
alter table meal_plans       enable row level security;
alter table meal_plan_slots  enable row level security;

-- Households
create policy "household members can view"
  on households for select using (
    auth.uid() = created_by or
    exists(select 1 from household_members where household_id = households.id and user_id = auth.uid())
  );
create policy "users can create households"
  on households for insert with check (auth.uid() = created_by);
create policy "admin can update household"
  on households for update using (auth.uid() = created_by);

-- Household members
create policy "members can view their household"
  on household_members for select using (
    user_id = auth.uid() or
    exists(select 1 from household_members hm where hm.household_id = household_members.household_id and hm.user_id = auth.uid())
  );
create policy "users can join households"
  on household_members for insert with check (auth.uid() = user_id);
create policy "users can leave households"
  on household_members for delete using (auth.uid() = user_id);

-- Recipes: own recipes + household shared recipes
create policy "users can view own or household recipes"
  on recipes for select using (
    created_by = auth.uid() or
    (household_id is not null and exists(
      select 1 from household_members where household_id = recipes.household_id and user_id = auth.uid()
    ))
  );
create policy "users can create recipes"
  on recipes for insert with check (auth.uid() = created_by);
create policy "users can update own recipes"
  on recipes for update using (auth.uid() = created_by);
create policy "users can delete own recipes"
  on recipes for delete using (auth.uid() = created_by);

-- Cooking logs
create policy "users can view own logs"
  on cooking_logs for select using (user_id = auth.uid());
create policy "users can create logs"
  on cooking_logs for insert with check (auth.uid() = user_id);
create policy "users can update own logs"
  on cooking_logs for update using (auth.uid() = user_id);
create policy "users can delete own logs"
  on cooking_logs for delete using (auth.uid() = user_id);

-- Meal plans
create policy "users can view own or household meal plans"
  on meal_plans for select using (
    user_id = auth.uid() or
    (household_id is not null and exists(
      select 1 from household_members where household_id = meal_plans.household_id and user_id = auth.uid()
    ))
  );
create policy "users can create meal plans"
  on meal_plans for insert with check (auth.uid() = user_id);
create policy "users can update own meal plans"
  on meal_plans for update using (auth.uid() = user_id);
create policy "users can delete own meal plans"
  on meal_plans for delete using (auth.uid() = user_id);

-- Meal plan slots (inherit access from meal_plans)
create policy "users can view meal plan slots"
  on meal_plan_slots for select using (
    exists(
      select 1 from meal_plans mp
      where mp.id = meal_plan_slots.meal_plan_id
        and (
          mp.user_id = auth.uid() or
          (mp.household_id is not null and exists(
            select 1 from household_members where household_id = mp.household_id and user_id = auth.uid()
          ))
        )
    )
  );
create policy "users can manage own meal plan slots"
  on meal_plan_slots for all using (
    exists(select 1 from meal_plans where id = meal_plan_slots.meal_plan_id and user_id = auth.uid())
  );

-- ─── Storage ──────────────────────────────────────────────────────────────────
-- Create the "cooking-photos" bucket manually in the Supabase dashboard first:
--   Storage → New bucket → Name: cooking-photos → Public: ON → Save
--
-- Then run this second block (storage_policies.sql) AFTER creating the bucket.
