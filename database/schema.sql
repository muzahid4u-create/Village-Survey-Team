create table villages (
  id uuid primary key,
  code varchar(30) unique not null,
  name varchar(120) not null,
  acquisition_act varchar(120) not null default 'CBA Act 1957',
  cutoff_date date not null
);

create table households (
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

create table persons (
  id uuid primary key,
  household_id uuid not null references households(id),
  full_name varchar(150) not null,
  gender varchar(20),
  age integer,
  relation_to_land_owner varchar(40) not null,
  marital_status varchar(20),
  marriage_date date,
  is_divorced boolean not null default false,
  include_in_survey boolean not null default true,
  dependent_on_land_owner boolean not null default false,
  religion varchar(20),
  caste_category varchar(20),
  annual_income numeric(14, 2),
  occupation varchar(30),
  education varchar(20),
  income_range varchar(20),
  aadhaar_number varchar(20),
  voter_id_number varchar(40),
  mobile_number varchar(20),
  system_suggested_status varchar(20) not null check (system_suggested_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  manual_family_status varchar(20) check (manual_family_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  final_family_status varchar(20) not null check (final_family_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  family_group_code varchar(30)
);

create table family_groups (
  id uuid primary key,
  household_id uuid not null references households(id),
  family_group_code varchar(30) not null,
  family_type varchar(20) not null check (family_type in ('PRIMARY', 'SEPARATE')),
  head_person_id uuid references persons(id),
  benefit_type varchar(30) check (benefit_type in ('INDIVIDUAL_PLOT', 'LUMPSUM_AMOUNT')),
  unique (household_id, family_group_code)
);

create table family_group_members (
  id uuid primary key,
  family_group_id uuid not null references family_groups(id),
  person_id uuid not null references persons(id),
  role_in_family varchar(40),
  unique (family_group_id, person_id)
);

create table land_details (
  id uuid primary key,
  household_id uuid not null unique references households(id),
  built_up_area_sqm numeric(12, 2) not null default 0,
  open_land_area_sqm numeric(12, 2) not null default 0,
  total_area_sqm numeric(12, 2) not null default 0,
  structure_type varchar(60),
  cattle_shed_available varchar(10) default 'NO' check (cattle_shed_available in ('YES', 'NO'))
);

create table valuations (
  id uuid primary key,
  household_id uuid not null unique references households(id),
  structure_value numeric(14, 2) not null default 0,
  land_value numeric(14, 2) not null default 0,
  tree_asset_value numeric(14, 2) not null default 0,
  shifting_allowance numeric(14, 2) not null default 0,
  subsistence_allowance numeric(14, 2) not null default 0,
  other_assistance numeric(14, 2) not null default 0,
  total_compensation numeric(14, 2) not null default 0
);

create table schema_migrations (
  version varchar(50) primary key,
  applied_at timestamptz not null default now()
);
