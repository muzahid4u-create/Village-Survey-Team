export const CUTOFF_DATE = "2020-08-29";

export type UserRole = "SURVEYOR" | "SUPERVISOR" | "ADMIN";

export type HouseholdStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "RETURNED"
  | "LOCKED";

export type SurveyPropertyType =
  | "RESIDENTIAL"
  | "EMPTY_PLOT"
  | "TEMPORARY_STRUCTURE"
  | "SHOP"
  | "OTHER_NON_RESIDENTIAL";

export type Gender = "MALE" | "FEMALE" | "OTHER";

export type RelationToLandOwner =
  | "PRIMARY_LAND_OWNER"
  | "PRIMARY_LAND_OWNER_SPOUSE"
  | "SON"
  | "DAUGHTER"
  | "DAUGHTER_IN_LAW"
  | "GRAND_SON"
  | "GRAND_DAUGHTER"
  | "FATHER"
  | "MOTHER"
  | "BROTHER"
  | "SISTER"
  | "OTHER";

export type MaritalStatus = "MINOR" | "UNMARRIED" | "MARRIED" | "WIDOWED" | "DIVORCED";

export type Religion = "HINDU" | "MUSLIM" | "CHRISTIAN" | "SIKH" | "BUDDHIST" | "JAIN" | "OTHER";

export type CasteCategory = "GENERAL" | "OBC" | "SC" | "ST" | "OTHERS";

export type Occupation =
  | "EMPLOYED"
  | "AGRICULTURE"
  | "HOUSE_WIFE"
  | "BUSINESS"
  | "STUDENT"
  | "MINOR"
  | "UNEMPLOYED"
  | "OTHER";

export type Education = "LESS_THAN_10TH" | "10TH" | "12TH" | "ITI" | "DIPLOMA" | "DEGREE" | "MASTERS" | "OTHERS";

export type IncomeRange =
  | "0-5_LAKH"
  | "5-10_LAKH"
  | "10-15_LAKH"
  | "15-20_LAKH"
  | "20-25_LAKH"
  | "ABOVE_25_LAKH";

export type MemberFamilyStatus = "PRIMARY" | "SEPARATE" | "DEPENDENT" | "EXCLUDED";

export type FamilyGroupType = "PRIMARY" | "SEPARATE";

export type BenefitType = "INDIVIDUAL_PLOT" | "LUMPSUM_AMOUNT";

export type SyncStatus = "LOCAL_ONLY" | "SYNC_PENDING" | "SYNCED" | "SYNC_ERROR";

export type SyncOperation = "CREATE" | "UPDATE" | "DELETE_SOFT" | "UPLOAD_FILE";
