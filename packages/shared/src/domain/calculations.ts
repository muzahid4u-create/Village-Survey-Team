import type { LandDetails, Valuation } from "./types";

export function calculateTotalArea(builtUpAreaSqm: number, openLandAreaSqm: number): number {
  return builtUpAreaSqm + openLandAreaSqm;
}

export function buildLandDetails(
  householdId: string,
  builtUpAreaSqm: number,
  openLandAreaSqm: number,
  structureType?: string,
  cattleShedAvailable?: "YES" | "NO",
): LandDetails {
  return {
    householdId,
    builtUpAreaSqm,
    openLandAreaSqm,
    totalAreaSqm: calculateTotalArea(builtUpAreaSqm, openLandAreaSqm),
    structureType,
    cattleShedAvailable,
  };
}

export function calculateTotalCompensation(input: Omit<Valuation, "totalCompensation">): number {
  return (
    input.structureValue +
    input.landValue +
    input.treeAssetValue +
    input.shiftingAllowance +
    input.subsistenceAllowance +
    input.otherAssistance
  );
}

export function buildValuation(input: Omit<Valuation, "totalCompensation">): Valuation {
  return {
    ...input,
    totalCompensation: calculateTotalCompensation(input),
  };
}
