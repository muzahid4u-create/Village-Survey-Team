alter table households
  add column if not exists linked_house_ids text,
  add column if not exists ownership_pattern varchar(40);

alter table persons
  add column if not exists other_caste_category_detail text;
