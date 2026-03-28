alter table persons
  add column if not exists occupation varchar(30),
  add column if not exists education varchar(20),
  add column if not exists income_range varchar(20);

alter table family_groups
  add column if not exists benefit_type varchar(30);

alter table family_groups
  drop constraint if exists family_groups_benefit_type_check;

alter table family_groups
  add constraint family_groups_benefit_type_check
  check (benefit_type in ('INDIVIDUAL_PLOT', 'LUMPSUM_AMOUNT') or benefit_type is null);
