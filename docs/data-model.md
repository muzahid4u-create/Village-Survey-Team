# Data Model

## 1. Core Entities

- villages
- users
- households
- persons
- family_groups
- family_group_members
- land_details
- valuations
- documents
- audit_logs

## 2. Relationship Summary

- one village has many households
- one household has many persons
- one household has many family groups
- one family group has many members
- one household has one land detail record
- one household has one valuation record
- one household has many documents

## 3. Key Design Decisions

- keep person records separate from family groups because grouping can change after review
- store both suggested and final family member status, including excluded persons
- use soft delete where field mistakes are common
- keep approval and lock state on household
- keep dependent members inside the primary family group rather than creating a separate dependent family group

## 4. Suggested PostgreSQL Schema

```sql
create table villages (
  id uuid primary key,
  code varchar(30) unique not null,
  name varchar(120) not null,
  acquisition_act varchar(120) not null default 'CBA Act 1957',
  cutoff_date date not null,
  district varchar(120),
  block_name varchar(120),
  expected_households integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  village_id uuid references villages(id),
  full_name varchar(150) not null,
  username varchar(80) unique not null,
  password_hash text not null,
  role varchar(20) not null check (role in ('SURVEYOR', 'SUPERVISOR', 'ADMIN')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  status varchar(20) not null check (status in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'RETURNED', 'LOCKED'
  )),
  is_locked boolean not null default false,
  remarks text,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table persons (
  id uuid primary key,
  household_id uuid not null references households(id),
  full_name varchar(150) not null,
  gender varchar(20),
  age integer,
  date_of_birth date,
  relation_to_land_owner varchar(40) not null,
  marital_status varchar(20),
  marriage_date date,
  caste_category varchar(60),
  education_level varchar(60),
  occupation varchar(80),
  employment_status varchar(60),
  annual_income numeric(14, 2),
  aadhaar_number varchar(20),
  mobile_number varchar(20),
  disability_flag boolean not null default false,
  deceased_flag boolean not null default false,
  is_divorced boolean not null default false,
  system_suggested_status varchar(20) not null check (system_suggested_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  manual_family_status varchar(20) check (manual_family_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  final_family_status varchar(20) not null check (final_family_status in ('PRIMARY', 'SEPARATE', 'DEPENDENT', 'EXCLUDED')),
  family_group_code varchar(30),
  override_reason text,
  override_by uuid references users(id),
  override_timestamp timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table family_groups (
  id uuid primary key,
  household_id uuid not null references households(id),
  family_group_code varchar(30) not null,
  family_type varchar(20) not null check (family_type in ('PRIMARY', 'SEPARATE')),
  head_person_id uuid references persons(id),
  eligibility_status varchar(30),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, family_group_code)
);

create table family_group_members (
  id uuid primary key,
  family_group_id uuid not null references family_groups(id),
  person_id uuid not null references persons(id),
  role_in_family varchar(40),
  created_at timestamptz not null default now(),
  unique (family_group_id, person_id)
);

create table land_details (
  id uuid primary key,
  household_id uuid not null unique references households(id),
  built_up_area_sqm numeric(12, 2) not null default 0,
  open_land_area_sqm numeric(12, 2) not null default 0,
  total_area_sqm numeric(12, 2) not null default 0,
  structure_type varchar(60),
  roof_type varchar(60),
  wall_type varchar(60),
  usage_type varchar(40),
  floor_count integer,
  occupancy_status varchar(40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  total_compensation numeric(14, 2) not null default 0,
  valuation_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table documents (
  id uuid primary key,
  household_id uuid not null references households(id),
  person_id uuid references persons(id),
  category varchar(40) not null,
  file_name varchar(255) not null,
  mime_type varchar(100) not null,
  storage_key text not null,
  captured_at timestamptz,
  gps_latitude numeric(10, 7),
  gps_longitude numeric(10, 7),
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key,
  entity_type varchar(50) not null,
  entity_id uuid not null,
  action varchar(40) not null,
  old_value jsonb,
  new_value jsonb,
  actor_id uuid references users(id),
  created_at timestamptz not null default now()
);
```

## 5. Derived Field Rules

Derived fields should be computed in backend service logic:

- `households.total_members` from active persons count
- `land_details.total_area_sqm = built_up_area_sqm + open_land_area_sqm`
- `valuations.total_compensation = structure_value + land_value + tree_asset_value + shifting_allowance + subsistence_allowance + other_assistance`
- `persons.final_family_status = manual_family_status ?? system_suggested_status`
- `EXCLUDED` persons must not contribute to family-group generation, beneficiary counts, or compensation calculations

## 6. Suggested Indexes

```sql
create index idx_households_village_status on households(village_id, status);
create index idx_households_house_id on households(house_id);
create index idx_households_land_owner on households(land_owner_name);
create index idx_persons_household on persons(household_id);
create index idx_persons_name on persons(full_name);
create index idx_persons_family_code on persons(household_id, family_group_code);
create index idx_documents_household on documents(household_id);
create index idx_audit_entity on audit_logs(entity_type, entity_id);
```

## 7. Validation Notes

- only one `PRIMARY` family group should exist per household
- at least one person should belong to the primary family
- locked households must reject mutable updates
- override reason should be mandatory when manual status differs from system suggestion
- family group codes should be human-readable, for example `F1`, `F2`, `F3`
- any person with final status `DEPENDENT` must have `family_group_code = 'F1'`
- any person with final status `EXCLUDED` must have `family_group_code` empty

## 8. Sample Household Grouping

Example household:

- land owner -> `PRIMARY` -> `F1`
- spouse -> `PRIMARY` -> `F1`
- elder son married before cut-off -> `SEPARATE` -> `F2`
- daughter in law -> `SEPARATE` -> `F2`
- younger son -> `DEPENDENT` -> `F1`
- married daughter, not divorced -> `EXCLUDED` -> no family group
- divorced daughter -> `PRIMARY` -> `F1`

Implementation note:

`DEPENDENT` is a member status only. It must never create a separate `family_groups` row. Dependent members stay within the primary family group `F1`, while still being reportable through person-level status fields.

`EXCLUDED` is also a member status only. It must not create a `family_groups` row, must not be assigned to `F1` or any separate family, and must be omitted from entitlement and compensation reports.
