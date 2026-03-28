alter table households
  add column if not exists survey_property_type varchar(40) not null default 'RESIDENTIAL';

alter table households
  add column if not exists has_resident_family boolean not null default true;
