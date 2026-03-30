import XLSX from "xlsx";
import { randomUUID } from "node:crypto";
import { householdService } from "../modules/households/household.service.js";
import { pool } from "../db/client.js";

const filePath = process.argv[2];

if (!filePath) {
  throw new Error("Usage: tsx src/scripts/import-survey-sheet1.ts <xlsx-file>");
}

type SheetRow = Record<string, string | number>;

function normalizeHouseId(value: string | number | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return /^\d+$/.test(raw) ? raw.padStart(3, "0") : raw;
}

function normalizeText(value: string | number | undefined): string {
  return String(value ?? "").trim();
}

function normalizeLoose(value: string | number | undefined): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rootHouseId(houseId: string): string {
  return normalizeHouseId(houseId.split("/")[0] ?? houseId);
}

const relationMap: Record<string, string> = {
  "primary landowner": "PRIMARY_LAND_OWNER",
  "primary landowner spouse": "PRIMARY_LAND_OWNER_SPOUSE",
  son: "SON",
  daughter: "DAUGHTER",
  "daughter in law": "DAUGHTER_IN_LAW",
  "daughter-in-law": "DAUGHTER_IN_LAW",
  grandson: "GRAND_SON",
  granddaughter: "GRAND_DAUGHTER",
  mother: "MOTHER",
  father: "FATHER",
  brother: "BROTHER",
  sister: "SISTER",
};

function mapOccupation(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (!key || key === "none" || key === "unemployed") return "UNEMPLOYED" as const;
  if (key.includes("student")) return "STUDENT" as const;
  if (key.includes("business")) return "BUSINESS" as const;
  if (key.includes("government job") || key.includes("private job") || key.includes("retired")) return "EMPLOYED" as const;
  if (key.includes("agricultural labour") || key.includes("agriculture labour") || key.includes("agriculture")) return "AGRICULTURE" as const;
  return "OTHER" as const;
}

function mapEducation(value: string | number | undefined, age?: number) {
  const key = normalizeLoose(value);
  if (age !== undefined && age < 18 && (key === "student" || !key)) return "SCHOOL_GOING_CHILD" as const;
  if (key === "student") return "SCHOOL_GOING_CHILD" as const;
  if (!key || key === "illiterate" || key === "below ssc passed") return "LESS_THAN_10TH" as const;
  if (key === "only ssc passed") return "10TH" as const;
  if (key === "below hsc") return "10TH" as const;
  if (key === "only hsc passed") return "12TH" as const;
  if (key === "iti") return "ITI" as const;
  if (key === "graduate") return "DEGREE" as const;
  if (key === "post graduate" || key === "phd") return "MASTERS" as const;
  return "OTHERS" as const;
}

function mapMaritalStatus(value: string | number | undefined, age?: number) {
  if (age !== undefined && age < 18) return "MINOR" as const;
  const key = normalizeLoose(value);
  if (!key || key === "unmarried") return "UNMARRIED" as const;
  if (key === "married" || key === "married with kids") return "MARRIED" as const;
  if (key === "expired" || key === "widow with kids") return "WIDOWED" as const;
  return "UNMARRIED" as const;
}

function mapIncome(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (!key || key === "0 5 lakh") return "0-5_LAKH" as const;
  if (key === "5 10 lakh") return "5-10_LAKH" as const;
  if (key === "10 15 lakh") return "10-15_LAKH" as const;
  if (key === "15 20 lakh") return "15-20_LAKH" as const;
  if (key === "20 25 lakh") return "20-25_LAKH" as const;
  return "ABOVE_25_LAKH" as const;
}

function mapBenefit(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (key.includes("individual")) return "INDIVIDUAL_PLOT" as const;
  if (key.includes("lumpsum")) return "LUMPSUM_AMOUNT" as const;
  return undefined;
}

function toDateString(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return `${parsed.y.toString().padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function mapStructureType(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (key.includes("semi")) return "Semi-Pucca";
  if (key.includes("kuccha") || key.includes("kutcha")) return "Kutcha";
  if (key.includes("pucca")) return "Pucca";
  return normalizeText(value) || undefined;
}

async function main() {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets["Sheet1"] ?? wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: "" });

  const grouped = new Map<string, SheetRow[]>();

  for (const row of rows) {
    const houseId = normalizeHouseId(row["House ID"]);
    if (!houseId) continue;
    grouped.set(houseId, [...(grouped.get(houseId) ?? []), row]);
  }

  const clusterMap = new Map<string, string[]>();
  for (const houseId of grouped.keys()) {
    const root = rootHouseId(houseId);
    clusterMap.set(root, [...(clusterMap.get(root) ?? []), houseId]);
  }

  const baseOwners = new Map<string, SheetRow>();
  for (const [houseId, groupRows] of grouped.entries()) {
    const owner = groupRows.find((row) => relationMap[normalizeLoose(row["Relation"])] === "PRIMARY_LAND_OWNER");
    if (owner) baseOwners.set(rootHouseId(houseId), owner);
  }

  const existing = await householdService.list();
  const existingByHouseId = new Map(existing.map((bundle) => [bundle.household.houseId, bundle]));

  let created = 0;
  let updated = 0;
  const skipped: string[] = [];

  for (const [houseId, groupRows] of grouped.entries()) {
    const root = rootHouseId(houseId);
    const existingBundle = existingByHouseId.get(houseId);
    const householdId = existingBundle?.household.id ?? randomUUID();
    const linkedIds = (clusterMap.get(root) ?? []).filter((id) => id !== houseId);
    const hasMultipleHouseIds = (clusterMap.get(root)?.length ?? 0) > 1;

    const normalizedRows = [...groupRows];
    const hasPrimaryOwner = normalizedRows.some(
      (row) => relationMap[normalizeLoose(row["Relation"])] === "PRIMARY_LAND_OWNER",
    );

    if (!hasPrimaryOwner) {
      const fallbackOwner = baseOwners.get(root);
      if (!fallbackOwner) {
        skipped.push(`${houseId}: missing primary owner and no base owner available`);
        continue;
      }

      normalizedRows.unshift({
        ...fallbackOwner,
        "House ID": houseId,
        "Family ID": "F1",
        Dependent: "Primary",
        "Benefit Type": fallbackOwner["Benefit Type"] || "Individual Plot",
      });
    }

    const seenKeys = new Set<string>();
    const persons = normalizedRows.flatMap((row) => {
      const fullName = normalizeText(row["Name"]);
      if (!fullName) return [];

      const relation = relationMap[normalizeLoose(row["Relation"])] ?? "OTHER";
      const ageText = normalizeText(row["Age"]);
      const age = ageText ? Number(ageText) : undefined;
      const familyGroupCode = normalizeText(row["Family ID"]).toUpperCase() || "F1";
      const maritalStatus = mapMaritalStatus(row["Marital Status"], age);
      const personKey = `${fullName.toLowerCase()}|${relation}|${familyGroupCode}`;

      if (seenKeys.has(personKey)) return [];
      seenKeys.add(personKey);

      return [
        {
          id: randomUUID(),
          householdId,
          fullName,
          relationToLandOwner: relation,
          gender: normalizeLoose(row["Gender"]).startsWith("female")
            ? "FEMALE"
            : normalizeLoose(row["Gender"]).startsWith("male")
              ? "MALE"
              : "OTHER",
          age,
          maritalStatus,
          marriageDate:
            maritalStatus === "UNMARRIED" ||
            maritalStatus === "MINOR" ||
            relation === "PRIMARY_LAND_OWNER" ||
            relation === "PRIMARY_LAND_OWNER_SPOUSE"
              ? undefined
              : toDateString(row["Marriage Date"]),
          includeInSurvey: true,
          dependentOnLandOwner: familyGroupCode === "F1" ? normalizeLoose(row["Dependent"]) === "dependent" : false,
          familyGroupCode,
          religion: "HINDU",
          casteCategory: "OBC",
          occupation: mapOccupation(row["Occupation"]),
          education: mapEducation(row["Education"], age),
          incomeRange: mapIncome(row["Income Range"]),
          aadhaarNumber: normalizeText(row["Aadhaar Number"]) || undefined,
        },
      ];
    });

    const familyCodes = [...new Set(persons.map((person) => person.familyGroupCode).filter(Boolean))];
    const familyBenefits = familyCodes.map((familyGroupCode) => {
      const matchingRow = normalizedRows.find(
        (row) =>
          (normalizeText(row["Family ID"]).toUpperCase() || "F1") === familyGroupCode &&
          mapBenefit(row["Benefit Type"]),
      );

      return {
        familyGroupCode,
        benefitType: matchingRow
          ? mapBenefit(matchingRow["Benefit Type"])
          : familyGroupCode === "F1"
            ? "INDIVIDUAL_PLOT"
            : "LUMPSUM_AMOUNT",
      };
    });

    const firstStructureRow =
      normalizedRows.find(
        (row) =>
          normalizeText(row["Structure Type"]) ||
          normalizeText(row["Built-up Area"]) ||
          normalizeText(row["Empty Plot Area"]) ||
          normalizeText(row["Construction Value"]) ||
          normalizeText(row["Land Value"]),
      ) ?? normalizedRows[0];

    const payload = {
      household: {
        id: householdId,
        villageId: existingBundle?.household.villageId ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        houseId,
        linkedHouseIds: linkedIds.length ? linkedIds.join(", ") : undefined,
        ownershipPattern: hasMultipleHouseIds ? "MULTIPLE_HOUSE_IDS" : "SINGLE_HOUSE",
        surveyPropertyType: "RESIDENTIAL" as const,
        hasResidentFamily: true,
        locality: existingBundle?.household.locality,
        status: "DRAFT" as const,
        isLocked: false,
      },
      persons,
      familyBenefits,
      landDetails: {
        builtUpAreaSqm: Number(firstStructureRow["Built-up Area"] || 0),
        openLandAreaSqm: Number(firstStructureRow["Empty Plot Area"] || 0),
        structureType: mapStructureType(firstStructureRow["Structure Type"]),
        cattleShedAvailable: normalizeLoose(firstStructureRow["Cattle Shed Available"]) === "yes" ? "YES" : "NO",
      },
      valuation: {
        structureValue: Number(firstStructureRow["Construction Value"] || 0),
        landValue: Number(firstStructureRow["Land Value"] || 0),
        treeAssetValue: 0,
        shiftingAllowance: 0,
        subsistenceAllowance: 0,
        otherAssistance: 0,
      },
    };

    if (existingBundle) {
      await householdService.update(payload);
      updated += 1;
    } else {
      await householdService.create(payload);
      created += 1;
    }
  }

  const finalList = await householdService.list();
  console.log(
    JSON.stringify(
      {
        created,
        updated,
        skipped,
        totalHouseholds: finalList.length,
        importedHouseIds: [...grouped.keys()],
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} finally {
  await pool.end();
}
