import {
  buildFamilyGroups,
  buildLandDetails,
  buildPersonRecord,
  buildValuation,
  validateFamilyAssignments,
  type HouseholdBundle,
} from "@marda/shared";
import type { CreateHouseholdBundleInput } from "./household.schemas.js";
import { householdRepository } from "./household.repository.js";

export class HouseholdService {
  async list(): Promise<HouseholdBundle[]> {
    return householdRepository.list();
  }

  async getById(id: string): Promise<HouseholdBundle | undefined> {
    return householdRepository.getById(id);
  }

  async create(input: CreateHouseholdBundleInput): Promise<HouseholdBundle> {
    return this.saveBundle(input, "create");
  }

  async update(input: CreateHouseholdBundleInput): Promise<HouseholdBundle> {
    return this.saveBundle(input, "update");
  }

  private async saveBundle(input: CreateHouseholdBundleInput, mode: "create" | "update"): Promise<HouseholdBundle> {
    const persons = input.persons.map(buildPersonRecord);
    const hasResidentFamily = input.household.hasResidentFamily !== false;

    if (hasResidentFamily && persons.length === 0) {
      throw new Error("Residential household surveys must include at least one family member.");
    }

    if (!hasResidentFamily && !input.household.landOwnerName?.trim() && !input.household.headPersonName?.trim()) {
      throw new Error("Property-only survey records require a recorded owner name.");
    }

    const familyErrors = validateFamilyAssignments(persons);

    if (familyErrors.length > 0) {
      throw new Error(familyErrors.join(" "));
    }

    const primaryOwner = persons.find((person) => person.relationToLandOwner === "PRIMARY_LAND_OWNER");
    const familyBenefits = new Map(
      (input.familyBenefits ?? []).map((familyBenefit) => [familyBenefit.familyGroupCode, familyBenefit.benefitType]),
    );
    const familyGroups = buildFamilyGroups(persons).map((familyGroup) => ({
      ...familyGroup,
      benefitType: familyBenefits.get(familyGroup.familyGroupCode as "F1" | "F2" | "F3" | "F4" | "F5"),
    }));

    const bundle: HouseholdBundle = {
      household: {
        id: input.household.id,
        villageId: input.household.villageId,
        houseId: input.household.houseId,
        surveyNumber: input.household.surveyNumber,
        propertyId: input.household.propertyId,
        linkedHouseIds: input.household.linkedHouseIds,
        ownershipPattern: input.household.ownershipPattern,
        surveyPropertyType: input.household.surveyPropertyType ?? "RESIDENTIAL",
        hasResidentFamily,
        headPersonName: primaryOwner?.fullName ?? input.household.headPersonName ?? "Unknown",
        landOwnerName: primaryOwner?.fullName ?? input.household.landOwnerName ?? "Unknown",
        addressText: input.household.addressText,
        locality: input.household.locality,
        gpsLatitude: input.household.gpsLatitude,
        gpsLongitude: input.household.gpsLongitude,
        status: input.household.status,
        isLocked: input.household.isLocked,
        remarks: input.household.remarks,
      },
      persons,
      familyGroups,
      landDetails: input.landDetails
        ? buildLandDetails(
            input.household.id,
            input.landDetails.builtUpAreaSqm,
            input.landDetails.openLandAreaSqm,
            input.landDetails.structureType,
            input.landDetails.cattleShedAvailable,
          )
        : undefined,
      valuation: input.valuation
        ? buildValuation({
            householdId: input.household.id,
            structureValue: input.valuation.structureValue,
            landValue: input.valuation.landValue,
            treeAssetValue: input.valuation.treeAssetValue ?? 0,
            shiftingAllowance: input.valuation.shiftingAllowance ?? 0,
            subsistenceAllowance: input.valuation.subsistenceAllowance ?? 0,
            otherAssistance: input.valuation.otherAssistance ?? 0,
          })
        : undefined,
    };

    return mode === "create" ? householdRepository.create(bundle) : householdRepository.update(bundle);
  }

  async remove(id: string) {
    return householdRepository.remove(id);
  }

  async getDashboardSummary() {
    return householdRepository.getDashboardSummary();
  }
}

export const householdService = new HouseholdService();
