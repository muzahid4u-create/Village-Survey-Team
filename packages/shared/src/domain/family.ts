import { CUTOFF_DATE, type MemberFamilyStatus } from "./enums.js";
import type { FamilyGroup, PersonInput, PersonRecord } from "./types.js";

export function getSuggestedFamilyStatus(person: PersonInput): MemberFamilyStatus {
  if (
    person.relationToLandOwner === "PRIMARY_LAND_OWNER" ||
    person.relationToLandOwner === "PRIMARY_LAND_OWNER_SPOUSE"
  ) {
    return "PRIMARY";
  }

  if (
    person.relationToLandOwner === "DAUGHTER" &&
    person.maritalStatus === "MARRIED" &&
    person.isDivorced !== true
  ) {
    return "EXCLUDED";
  }

  if (person.relationToLandOwner === "DAUGHTER" && person.isDivorced === true) {
    return "PRIMARY";
  }

  const relationEligible =
    person.relationToLandOwner === "SON" || person.relationToLandOwner === "DAUGHTER";

  const marriedBeforeCutoff =
    person.maritalStatus === "MARRIED" &&
    Boolean(person.marriageDate) &&
    person.marriageDate! < CUTOFF_DATE;

  if (relationEligible && marriedBeforeCutoff) {
    return "SEPARATE";
  }

  return "DEPENDENT";
}

export function getFinalFamilyStatus(person: PersonInput): MemberFamilyStatus {
  if (person.includeInSurvey === false) {
    return "EXCLUDED";
  }

  if (person.familyGroupCode && person.familyGroupCode !== "F1") {
    return "SEPARATE";
  }

  if (person.relationToLandOwner === "PRIMARY_LAND_OWNER") {
    return "PRIMARY";
  }

  if (person.dependentOnLandOwner === true) {
    return "DEPENDENT";
  }

  if (person.familyGroupCode === "F1") {
    return "PRIMARY";
  }

  return person.manualFamilyStatus ?? getSuggestedFamilyStatus(person);
}

export function getDefaultFamilyGroupCode(status: MemberFamilyStatus): string {
  if (status === "PRIMARY" || status === "DEPENDENT") {
    return "F1";
  }

  return "";
}

export function isCompensationEligible(status: MemberFamilyStatus): boolean {
  return status !== "EXCLUDED";
}

export function buildPersonRecord(person: PersonInput): PersonRecord {
  const systemSuggestedStatus = getSuggestedFamilyStatus(person);
  const finalFamilyStatus = getFinalFamilyStatus(person);
  const familyGroupCode =
    finalFamilyStatus === "EXCLUDED"
      ? ""
      : person.familyGroupCode ?? getDefaultFamilyGroupCode(finalFamilyStatus);

  return {
    ...person,
    familyGroupCode,
    systemSuggestedStatus,
    finalFamilyStatus,
  };
}

export function validateFamilyAssignments(persons: PersonRecord[]): string[] {
  const errors: string[] = [];

  if (persons.length === 0) {
    return errors;
  }

  for (const person of persons) {
    if (person.finalFamilyStatus === "EXCLUDED" && person.familyGroupCode) {
      errors.push(`${person.fullName} is EXCLUDED and must not belong to any family group.`);
    }

    if (person.finalFamilyStatus === "DEPENDENT" && person.familyGroupCode !== "F1") {
      errors.push(`${person.fullName} is DEPENDENT and must remain in family group F1.`);
    }

    if (person.finalFamilyStatus === "PRIMARY" && person.familyGroupCode !== "F1") {
      errors.push(`${person.fullName} is PRIMARY and must remain in family group F1.`);
    }

    if (person.finalFamilyStatus === "SEPARATE" && !person.familyGroupCode) {
      errors.push(`${person.fullName} is SEPARATE and requires a family group code.`);
    }
  }

  const primaryOwners = persons.filter((person) => person.relationToLandOwner === "PRIMARY_LAND_OWNER");
  const spouses = persons.filter((person) => person.relationToLandOwner === "PRIMARY_LAND_OWNER_SPOUSE");

  if (primaryOwners.length !== 1) {
    errors.push("Each household must have exactly one PRIMARY_LAND_OWNER.");
  }

  if (spouses.length > 1) {
    errors.push("Each household can have only one PRIMARY_LAND_OWNER_SPOUSE.");
  }

  for (const person of persons) {
    if (!person.fullName.trim()) {
      errors.push("Every person must have a name.");
    }

    if (!person.religion) {
      errors.push(`${person.fullName} is missing religion.`);
    }

    if (!person.casteCategory) {
      errors.push(`${person.fullName} is missing category.`);
    }
  }

  return errors;
}

export function buildFamilyGroups(persons: PersonRecord[]): FamilyGroup[] {
  if (persons.length === 0) {
    return [];
  }

  const grouped = new Map<string, PersonRecord[]>();

  for (const person of persons) {
    if (person.finalFamilyStatus === "EXCLUDED") {
      continue;
    }

    const code =
      person.finalFamilyStatus === "PRIMARY" || person.finalFamilyStatus === "DEPENDENT"
        ? "F1"
        : person.familyGroupCode || "F2";

    const current = grouped.get(code) ?? [];
    current.push({ ...person, familyGroupCode: code });
    grouped.set(code, current);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([familyGroupCode, members]) => {
      const familyType = familyGroupCode === "F1" ? "PRIMARY" : "SEPARATE";
      const head =
        members.find((member) => member.finalFamilyStatus === "PRIMARY") ??
        members.find((member) => member.finalFamilyStatus === "SEPARATE") ??
        members[0];

      return {
        id: crypto.randomUUID(),
        householdId: members[0].householdId,
        familyGroupCode,
        familyType,
        headPersonId: head.id,
        memberIds: members.map((member) => member.id),
      };
    });
}
