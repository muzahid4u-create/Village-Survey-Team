create table if not exists villages (
  id uuid primary key,
  code varchar(30) unique not null,
  name varchar(120) not null,
  acquisition_act varchar(120) not null default 'CBA Act 1957',
  cutoff_date date not null
);

create table if not exists households (
  id uuid primary key,
  village_id uuid not null references villages(id),
  house_id varchar(30) unique not null,
  survey_number varchar(80),
  property_id varchar(80),
  head_person_name varchar(150) not null,
  land_owner_name varchar(150) not null,
  address_text text,
  locality varchar(120),
  gps_latitude numeric(10, 7),
  gps_longitude numeric(10, 7),
  status varchar(20) not null,
  is_locked boolean not null default false,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists persons (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  full_name varchar(150) not null,
  gender varchar(20),
  age integer,
  relation_to_land_owner varchar(40) not null,
  marital_status varchar(20),
  marriage_date date,
  is_divorced boolean not null default false,
  caste_category varchar(60),
  annual_income numeric(14, 2),
  system_suggested_status varchar(20) not null check (system_suggested_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  manual_family_status varchar(20) check (manual_family_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  final_family_status varchar(20) not null check (final_family_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  family_group_code varchar(30)
);

create table if not exists family_groups (
  id uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  family_group_code varchar(30) not null,
  family_type varchar(20) not null check (family_type in ('PRIMARY', 'SEPARATE')),
  head_person_id uuid references persons(id),
  unique (household_id, family_group_code)
);

create table if not exists family_group_members (
  id uuid primary key,
  family_group_id uuid not null references family_groups(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  role_in_family varchar(40),
  unique (family_group_id, person_id)
);

create table if not exists land_details (
  id uuid primary key,
  household_id uuid not null unique references households(id) on delete cascade,
  built_up_area_sqm numeric(12, 2) not null default 0,
  open_land_area_sqm numeric(12, 2) not null default 0,
  total_area_sqm numeric(12, 2) not null default 0,
  structure_type varchar(60)
);

create table if not exists valuations (
  id uuid primary key,
  household_id uuid not null unique references households(id) on delete cascade,
  structure_value numeric(14, 2) not null default 0,
  land_value numeric(14, 2) not null default 0,
  tree_asset_value numeric(14, 2) not null default 0,
  shifting_allowance numeric(14, 2) not null default 0,
  subsistence_allowance numeric(14, 2) not null default 0,
  other_assistance numeric(14, 2) not null default 0,
  total_compensation numeric(14, 2) not null default 0
);

create table if not exists schema_migrations (
  version varchar(50) primary key,
  applied_at timestamptz not null default now()
);

