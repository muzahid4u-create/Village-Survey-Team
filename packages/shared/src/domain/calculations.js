export function calculateTotalArea(builtUpAreaSqm, openLandAreaSqm) {
    return builtUpAreaSqm + openLandAreaSqm;
}
export function buildLandDetails(householdId, builtUpAreaSqm, openLandAreaSqm, structureType, cattleShedAvailable) {
    return {
        householdId,
        builtUpAreaSqm,
        openLandAreaSqm,
        totalAreaSqm: calculateTotalArea(builtUpAreaSqm, openLandAreaSqm),
        structureType,
        cattleShedAvailable,
    };
}
export function calculateTotalCompensation(input) {
    return (input.structureValue +
        input.landValue +
        input.treeAssetValue +
        input.shiftingAllowance +
        input.subsistenceAllowance +
        input.otherAssistance);
}
export function buildValuation(input) {
    return {
        ...input,
        totalCompensation: calculateTotalCompensation(input),
    };
}
