alter table persons add column if not exists include_in_survey boolean not null default true;
alter table persons add column if not exists dependent_on_land_owner boolean not null default false;
