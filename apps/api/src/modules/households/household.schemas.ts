import { z } from "zod";

export const personInputSchema = z.object({
  id: z.string(),
  householdId: z.string(),
  fullName: z.string().min(1),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  age: z.number().nonnegative().optional(),
  relationToLandOwner: z.enum([
    "PRIMARY_LAND_OWNER",
    "PRIMARY_LAND_OWNER_SPOUSE",
    "SON",
    "DAUGHTER",
    "DAUGHTER_IN_LAW",
    "GRAND_SON",
    "GRAND_DAUGHTER",
    "FATHER",
    "MOTHER",
    "BROTHER",
    "SISTER",
    "OTHER",
  ]),
  maritalStatus: z.enum(["MINOR", "UNMARRIED", "MARRIED", "WIDOWED", "DIVORCED"]).optional(),
  marriageDate: z.string().optional(),
  isDivorced: z.boolean().optional(),
  includeInSurvey: z.boolean().optional(),
  dependentOnLandOwner: z.boolean().optional(),
  religion: z.enum(["HINDU", "MUSLIM", "CHRISTIAN", "SIKH", "BUDDHIST", "JAIN", "OTHER"]).optional(),
  casteCategory: z.enum(["GENERAL", "OBC", "SC", "ST", "OTHERS"]).optional(),
  annualIncome: z.number().optional(),
  occupation: z.enum(["EMPLOYED", "AGRICULTURE", "HOUSE_WIFE", "BUSINESS", "STUDENT", "MINOR", "UNEMPLOYED", "OTHER"]).optional(),
  education: z.enum(["LESS_THAN_10TH", "10TH", "12TH", "ITI", "DIPLOMA", "DEGREE", "MASTERS", "OTHERS"]).optional(),
  incomeRange: z.enum(["0-5_LAKH", "5-10_LAKH", "10-15_LAKH", "15-20_LAKH", "20-25_LAKH", "ABOVE_25_LAKH"]).optional(),
  aadhaarNumber: z.string().optional(),
  voterIdNumber: z.string().optional(),
  mobileNumber: z.string().optional(),
  familyGroupCode: z.string().optional(),
  manualFamilyStatus: z.enum(["PRIMARY", "SEPARATE", "DEPENDENT", "EXCLUDED"]).optional(),
});

export const householdBundleSchema = z.object({
  household: z.object({
    id: z.string(),
    villageId: z.string(),
    houseId: z.string(),
    surveyNumber: z.string().optional(),
    surveyPropertyType: z.enum(["RESIDENTIAL", "EMPTY_PLOT", "TEMPORARY_STRUCTURE", "SHOP", "OTHER_NON_RESIDENTIAL"]).optional(),
    hasResidentFamily: z.boolean().optional(),
    propertyId: z.string().optional(),
    headPersonName: z.string().optional(),
    landOwnerName: z.string().optional(),
    addressText: z.string().optional(),
    locality: z.string().optional(),
    gpsLatitude: z.number().optional(),
    gpsLongitude: z.number().optional(),
    status: z.enum(["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "RETURNED", "LOCKED"]),
    isLocked: z.boolean(),
    remarks: z.string().optional(),
  }),
  persons: z.array(personInputSchema),
  familyBenefits: z
    .array(
      z.object({
        familyGroupCode: z.enum(["F1", "F2", "F3", "F4", "F5"]),
        benefitType: z.enum(["INDIVIDUAL_PLOT", "LUMPSUM_AMOUNT"]),
      }),
    )
    .optional(),
  landDetails: z
    .object({
      builtUpAreaSqm: z.number().nonnegative(),
      openLandAreaSqm: z.number().nonnegative(),
      structureType: z.string().optional(),
      cattleShedAvailable: z.enum(["YES", "NO"]).optional(),
    })
    .optional(),
  valuation: z
    .object({
      structureValue: z.number().nonnegative(),
      landValue: z.number().nonnegative(),
      treeAssetValue: z.number().nonnegative().default(0),
      shiftingAllowance: z.number().nonnegative().default(0),
      subsistenceAllowance: z.number().nonnegative().default(0),
      otherAssistance: z.number().nonnegative().default(0),
    })
    .optional(),
});

export type CreateHouseholdBundleInput = z.infer<typeof householdBundleSchema>;
