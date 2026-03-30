import { randomUUID } from "node:crypto";
import {
  type FamilyGroup,
  type Household,
  type HouseholdBundle,
  type LandDetails,
  type PersonRecord,
  type Valuation,
} from "@marda/shared";
import type { PoolClient } from "pg";
import { pool, withTransaction } from "../../db/client.js";

type HouseholdRow = {
  id: string;
  village_id: string;
  house_id: string;
  survey_number: string | null;
  property_id: string | null;
  linked_house_ids: string | null;
  ownership_pattern: Household["ownershipPattern"] | null;
  head_person_name: string;
  land_owner_name: string;
  survey_property_type: Household["surveyPropertyType"] | null;
  has_resident_family: boolean | null;
  address_text: string | null;
  locality: string | null;
  gps_latitude: string | null;
  gps_longitude: string | null;
  status: Household["status"];
  is_locked: boolean;
  remarks: string | null;
};

type PersonRow = {
  id: string;
  household_id: string;
  full_name: string;
  gender: string | null;
  age: number | null;
  relation_to_land_owner: PersonRecord["relationToLandOwner"];
  marital_status: PersonRecord["maritalStatus"] | null;
  marriage_date: string | null;
  is_divorced: boolean;
  include_in_survey: boolean;
  dependent_on_land_owner: boolean;
  religion: PersonRecord["religion"] | null;
  caste_category: string | null;
  other_caste_category_detail: string | null;
  annual_income: string | null;
  occupation: PersonRecord["occupation"] | null;
  education: PersonRecord["education"] | null;
  income_range: PersonRecord["incomeRange"] | null;
  aadhaar_number: string | null;
  voter_id_number: string | null;
  mobile_number: string | null;
  system_suggested_status: PersonRecord["systemSuggestedStatus"];
  manual_family_status: PersonRecord["manualFamilyStatus"] | null;
  final_family_status: PersonRecord["finalFamilyStatus"];
  family_group_code: string | null;
};

type FamilyGroupRow = {
  id: string;
  household_id: string;
  family_group_code: string;
  family_type: FamilyGroup["familyType"];
  head_person_id: string;
  benefit_type: FamilyGroup["benefitType"] | null;
};

type LandDetailsRow = {
  household_id: string;
  built_up_area_sqm: string;
  open_land_area_sqm: string;
  total_area_sqm: string;
  structure_type: string | null;
  cattle_shed_available: "YES" | "NO" | null;
};

type ValuationRow = {
  household_id: string;
  structure_value: string;
  land_value: string;
  tree_asset_value: string;
  shifting_allowance: string;
  subsistence_allowance: string;
  other_assistance: string;
  total_compensation: string;
};

function mapHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    villageId: row.village_id,
    houseId: row.house_id,
    surveyNumber: row.survey_number ?? undefined,
    propertyId: row.property_id ?? undefined,
    linkedHouseIds: row.linked_house_ids ?? undefined,
    ownershipPattern: row.ownership_pattern ?? undefined,
    headPersonName: row.head_person_name,
    landOwnerName: row.land_owner_name,
    surveyPropertyType: row.survey_property_type ?? "RESIDENTIAL",
    hasResidentFamily: row.has_resident_family ?? true,
    addressText: row.address_text ?? undefined,
    locality: row.locality ?? undefined,
    gpsLatitude: row.gps_latitude ? Number(row.gps_latitude) : undefined,
    gpsLongitude: row.gps_longitude ? Number(row.gps_longitude) : undefined,
    status: row.status,
    isLocked: row.is_locked,
    remarks: row.remarks ?? undefined,
  };
}

function mapPerson(row: PersonRow): PersonRecord {
  return {
    id: row.id,
    householdId: row.household_id,
    fullName: row.full_name,
    gender: (row.gender as PersonRecord["gender"]) ?? undefined,
    age: row.age ?? undefined,
    relationToLandOwner: row.relation_to_land_owner,
    maritalStatus: row.marital_status ?? undefined,
    marriageDate: row.marriage_date ?? undefined,
    isDivorced: row.is_divorced,
    includeInSurvey: row.include_in_survey,
    dependentOnLandOwner: row.dependent_on_land_owner,
    religion: row.religion ?? undefined,
    casteCategory: (row.caste_category as PersonRecord["casteCategory"]) ?? undefined,
    otherCasteCategoryDetail: row.other_caste_category_detail ?? undefined,
    annualIncome: row.annual_income ? Number(row.annual_income) : undefined,
    occupation: row.occupation ?? undefined,
    education: row.education ?? undefined,
    incomeRange: row.income_range ?? undefined,
    aadhaarNumber: row.aadhaar_number ?? undefined,
    voterIdNumber: row.voter_id_number ?? undefined,
    mobileNumber: row.mobile_number ?? undefined,
    systemSuggestedStatus: row.system_suggested_status,
    manualFamilyStatus: row.manual_family_status ?? undefined,
    finalFamilyStatus: row.final_family_status,
    familyGroupCode: row.family_group_code ?? undefined,
  };
}

function mapLandDetails(row: LandDetailsRow): LandDetails {
  return {
    householdId: row.household_id,
    builtUpAreaSqm: Number(row.built_up_area_sqm),
    openLandAreaSqm: Number(row.open_land_area_sqm),
    totalAreaSqm: Number(row.total_area_sqm),
    structureType: row.structure_type ?? undefined,
    cattleShedAvailable: row.cattle_shed_available ?? undefined,
  };
}

function mapValuation(row: ValuationRow): Valuation {
  return {
    householdId: row.household_id,
    structureValue: Number(row.structure_value),
    landValue: Number(row.land_value),
    treeAssetValue: Number(row.tree_asset_value),
    shiftingAllowance: Number(row.shifting_allowance),
    subsistenceAllowance: Number(row.subsistence_allowance),
    otherAssistance: Number(row.other_assistance),
    totalCompensation: Number(row.total_compensation),
  };
}

async function ensureVillage(client: PoolClient, villageId: string) {
  await client.query(
    `
      insert into villages (id, code, name, acquisition_act, cutoff_date)
      values ($1, $2, $3, 'CBA Act 1957', '2020-08-29')
      on conflict (id) do nothing
    `,
    [villageId, "MARDA", "Marda"],
  );
}

export class HouseholdRepository {
  private async writeBundle(client: PoolClient, bundle: HouseholdBundle, mode: "create" | "update") {
    await ensureVillage(client, bundle.household.villageId);

    if (mode === "update") {
      await client.query("delete from family_group_members where family_group_id in (select id from family_groups where household_id = $1)", [bundle.household.id]);
      await client.query("delete from family_groups where household_id = $1", [bundle.household.id]);
      await client.query("delete from persons where household_id = $1", [bundle.household.id]);
      await client.query("delete from land_details where household_id = $1", [bundle.household.id]);
      await client.query("delete from valuations where household_id = $1", [bundle.household.id]);

      await client.query(
        `
          update households
          set village_id = $2, house_id = $3, survey_number = $4, property_id = $5, linked_house_ids = $6, ownership_pattern = $7,
              head_person_name = $8, land_owner_name = $9, survey_property_type = $10, has_resident_family = $11,
              address_text = $12, locality = $13, gps_latitude = $14, gps_longitude = $15, status = $16, is_locked = $17, remarks = $18,
              updated_at = now()
          where id = $1
        `,
        [
          bundle.household.id,
          bundle.household.villageId,
          bundle.household.houseId,
          bundle.household.surveyNumber ?? null,
          bundle.household.propertyId ?? null,
          bundle.household.linkedHouseIds ?? null,
          bundle.household.ownershipPattern ?? null,
          bundle.household.headPersonName,
          bundle.household.landOwnerName,
          bundle.household.surveyPropertyType ?? "RESIDENTIAL",
          bundle.household.hasResidentFamily ?? true,
          bundle.household.addressText ?? null,
          bundle.household.locality ?? null,
          bundle.household.gpsLatitude ?? null,
          bundle.household.gpsLongitude ?? null,
          bundle.household.status,
          bundle.household.isLocked,
          bundle.household.remarks ?? null,
        ],
      );
    } else {
      await client.query(
        `
          insert into households (
            id, village_id, house_id, survey_number, property_id, head_person_name,
            linked_house_ids, ownership_pattern, land_owner_name, survey_property_type, has_resident_family, address_text, locality, gps_latitude, gps_longitude,
            status, is_locked, remarks
          ) values (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18
          )
        `,
        [
          bundle.household.id,
          bundle.household.villageId,
          bundle.household.houseId,
          bundle.household.surveyNumber ?? null,
          bundle.household.propertyId ?? null,
          bundle.household.headPersonName,
          bundle.household.linkedHouseIds ?? null,
          bundle.household.ownershipPattern ?? null,
          bundle.household.landOwnerName,
          bundle.household.surveyPropertyType ?? "RESIDENTIAL",
          bundle.household.hasResidentFamily ?? true,
          bundle.household.addressText ?? null,
          bundle.household.locality ?? null,
          bundle.household.gpsLatitude ?? null,
          bundle.household.gpsLongitude ?? null,
          bundle.household.status,
          bundle.household.isLocked,
          bundle.household.remarks ?? null,
        ],
      );
    }

    for (const person of bundle.persons) {
      await client.query(
        `
            insert into persons (
              id, household_id, full_name, gender, age, relation_to_land_owner,
              marital_status, marriage_date, is_divorced, include_in_survey, dependent_on_land_owner,
              religion, caste_category, other_caste_category_detail, annual_income, occupation, education, income_range,
              aadhaar_number, voter_id_number, mobile_number,
              system_suggested_status, manual_family_status, final_family_status, family_group_code
            ) values (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16, $17, $18,
              $19, $20, $21,
              $22, $23, $24, $25
            )
          `,
          [
          person.id,
          person.householdId,
          person.fullName,
          person.gender ?? null,
          person.age ?? null,
            person.relationToLandOwner,
            person.maritalStatus ?? null,
            person.marriageDate ?? null,
            person.isDivorced ?? false,
            person.includeInSurvey ?? true,
            person.dependentOnLandOwner ?? false,
            person.religion ?? null,
            person.casteCategory ?? null,
            person.otherCasteCategoryDetail ?? null,
            person.annualIncome ?? null,
            person.occupation ?? null,
            person.education ?? null,
            person.incomeRange ?? null,
            person.aadhaarNumber ?? null,
            person.voterIdNumber ?? null,
            person.mobileNumber ?? null,
            person.systemSuggestedStatus,
            person.manualFamilyStatus ?? null,
            person.finalFamilyStatus,
            person.familyGroupCode ?? null,
          ],
        );
      }

    for (const group of bundle.familyGroups) {
      await client.query(
        `
          insert into family_groups (
            id, household_id, family_group_code, family_type, head_person_id, benefit_type
          ) values ($1, $2, $3, $4, $5, $6)
        `,
        [group.id, group.householdId, group.familyGroupCode, group.familyType, group.headPersonId, group.benefitType ?? null],
      );

      for (const memberId of group.memberIds) {
        await client.query(
          `
            insert into family_group_members (
              id, family_group_id, person_id, role_in_family
            ) values ($1, $2, $3, $4)
          `,
          [randomUUID(), group.id, memberId, null],
        );
      }
    }

    if (bundle.landDetails) {
      await client.query(
        `
          insert into land_details (
            id, household_id, built_up_area_sqm, open_land_area_sqm, total_area_sqm, structure_type, cattle_shed_available
          ) values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          randomUUID(),
          bundle.landDetails.householdId,
          bundle.landDetails.builtUpAreaSqm,
          bundle.landDetails.openLandAreaSqm,
          bundle.landDetails.totalAreaSqm,
          bundle.landDetails.structureType ?? null,
          bundle.landDetails.cattleShedAvailable ?? "NO",
        ],
      );
    }

    if (bundle.valuation) {
      await client.query(
        `
          insert into valuations (
            id, household_id, structure_value, land_value, tree_asset_value,
            shifting_allowance, subsistence_allowance, other_assistance, total_compensation
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          randomUUID(),
          bundle.valuation.householdId,
          bundle.valuation.structureValue,
          bundle.valuation.landValue,
          bundle.valuation.treeAssetValue,
          bundle.valuation.shiftingAllowance,
          bundle.valuation.subsistenceAllowance,
          bundle.valuation.otherAssistance,
          bundle.valuation.totalCompensation,
        ],
      );
    }
  }

  async list(): Promise<HouseholdBundle[]> {
    const householdRows = await pool.query<HouseholdRow>(
      "select * from households order by house_id asc",
    );

    const bundles = await Promise.all(
      householdRows.rows.map((row) => this.getById(row.id)),
    );

    return bundles.filter((item): item is HouseholdBundle => Boolean(item));
  }

  async getById(id: string): Promise<HouseholdBundle | undefined> {
    const householdResult = await pool.query<HouseholdRow>(
      "select * from households where id = $1",
      [id],
    );

    if (!householdResult.rowCount) {
      return undefined;
    }

    const household = mapHousehold(householdResult.rows[0]);

    const [personResult, familyGroupResult, familyGroupMemberResult, landDetailsResult, valuationResult] =
      await Promise.all([
        pool.query<PersonRow>("select * from persons where household_id = $1 order by full_name asc", [id]),
        pool.query<FamilyGroupRow>(
          "select * from family_groups where household_id = $1 order by family_group_code asc",
          [id],
        ),
        pool.query<{ family_group_id: string; person_id: string }>(
          `
            select fgm.family_group_id, fgm.person_id
            from family_group_members fgm
            join family_groups fg on fg.id = fgm.family_group_id
            where fg.household_id = $1
          `,
          [id],
        ),
        pool.query<LandDetailsRow>("select * from land_details where household_id = $1", [id]),
        pool.query<ValuationRow>("select * from valuations where household_id = $1", [id]),
      ]);

    const persons = personResult.rows.map(mapPerson);
    const memberIdsByGroup = new Map<string, string[]>();

    for (const row of familyGroupMemberResult.rows) {
      memberIdsByGroup.set(row.family_group_id, [
        ...(memberIdsByGroup.get(row.family_group_id) ?? []),
        row.person_id,
      ]);
    }

    return {
      household,
      persons,
      familyGroups: familyGroupResult.rows.map((row) => ({
        id: row.id,
        householdId: row.household_id,
        familyGroupCode: row.family_group_code,
        familyType: row.family_type,
        headPersonId: row.head_person_id,
        memberIds: memberIdsByGroup.get(row.id) ?? [],
        benefitType: row.benefit_type ?? undefined,
      })),
      landDetails: landDetailsResult.rowCount ? mapLandDetails(landDetailsResult.rows[0]) : undefined,
      valuation: valuationResult.rowCount ? mapValuation(valuationResult.rows[0]) : undefined,
    };
  }

  async create(bundle: HouseholdBundle): Promise<HouseholdBundle> {
    await withTransaction(async (client) => {
      await this.writeBundle(client, bundle, "create");
    });

    const created = await this.getById(bundle.household.id);

    if (!created) {
      throw new Error("Household was created but could not be reloaded from the database");
    }

    return created;
  }

  async update(bundle: HouseholdBundle): Promise<HouseholdBundle> {
    await withTransaction(async (client) => {
      await this.writeBundle(client, bundle, "update");
    });

    const updated = await this.getById(bundle.household.id);
    if (!updated) throw new Error("Updated household could not be reloaded");
    return updated;
  }

  async remove(id: string): Promise<void> {
    await withTransaction(async (client) => {
      await client.query(
        "delete from family_group_members where family_group_id in (select id from family_groups where household_id = $1)",
        [id],
      );
      await client.query("delete from family_groups where household_id = $1", [id]);
      await client.query("delete from persons where household_id = $1", [id]);
      await client.query("delete from land_details where household_id = $1", [id]);
      await client.query("delete from valuations where household_id = $1", [id]);
      await client.query("delete from households where id = $1", [id]);
    });
  }

  async getDashboardSummary() {
    const result = await pool.query<{
      surveyed_households: string;
      total_families: string;
      total_persons: string;
      male: string;
      female: string;
      other: string;
      no_family_properties: string;
      empty_plots: string;
      temporary_structures: string;
      shops: string;
    }>(`
      select
        (select count(*) from households) as surveyed_households,
        (select count(*) from family_groups) as total_families,
        (select count(*) from persons where include_in_survey = true) as total_persons,
        (select count(*) from persons where include_in_survey = true and gender = 'MALE') as male,
        (select count(*) from persons where include_in_survey = true and gender = 'FEMALE') as female,
        (select count(*) from persons where include_in_survey = true and (gender = 'OTHER' or gender is null)) as other,
        (select count(*) from households where has_resident_family = false) as no_family_properties,
        (select count(*) from households where survey_property_type = 'EMPTY_PLOT') as empty_plots,
        (select count(*) from households where survey_property_type = 'TEMPORARY_STRUCTURE') as temporary_structures,
        (select count(*) from households where survey_property_type = 'SHOP') as shops
    `);

    const row = result.rows[0];

    return {
      totalHouseholds: Number(row.surveyed_households),
      surveyedHouseholds: Number(row.surveyed_households),
      totalFamilies: Number(row.total_families),
      totalPersons: Number(row.total_persons),
      male: Number(row.male),
      female: Number(row.female),
      other: Number(row.other),
      noFamilyProperties: Number(row.no_family_properties),
      emptyPlots: Number(row.empty_plots),
      temporaryStructures: Number(row.temporary_structures),
      shops: Number(row.shops),
    };
  }
}

export const householdRepository = new HouseholdRepository();
