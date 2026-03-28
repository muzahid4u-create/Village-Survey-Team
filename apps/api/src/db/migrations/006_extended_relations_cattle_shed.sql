alter table land_details
  add column if not exists cattle_shed_available varchar(10) default 'NO';

alter table land_details
  drop constraint if exists land_details_cattle_shed_available_check;

alter table land_details
  add constraint land_details_cattle_shed_available_check
  check (cattle_shed_available in ('YES', 'NO'));
