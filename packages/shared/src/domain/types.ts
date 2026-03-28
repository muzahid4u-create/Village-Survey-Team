import type {
  BenefitType,
  CasteCategory,
  Education,
  FamilyGroupType,
  Gender,
  HouseholdStatus,
  IncomeRange,
  MaritalStatus,
  MemberFamilyStatus,
  Occupation,
  RelationToLandOwner,
  Religion,
  SurveyPropertyType,
  SyncOperation,
  SyncStatus,
} from "./enums.js";

export interface Village {
  id: string;
  code: string;
  name: string;
  acquisitionAct: string;
  cutoffDate: string;
  expectedHouseholds: number;
}

export interface Household {
  id: string;
  villageId: string;
  houseId: string;
  surveyNumber?: string;
  propertyId?: string;
  headPersonName: string;
  landOwnerName: string;
  surveyPropertyType?: SurveyPropertyType;
  hasResidentFamily?: boolean;
  addressText?: string;
  locality?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  status: HouseholdStatus;
  isLocked: boolean;
  remarks?: string;
}

export interface PersonInput {
  id: string;
  householdId: string;
  fullName: string;
  gender?: Gender;
  age?: number;
  relationToLandOwner: RelationToLandOwner;
  maritalStatus?: MaritalStatus;
  marriageDate?: string;
  isDivorced?: boolean;
  includeInSurvey?: boolean;
  dependentOnLandOwner?: boolean;
  religion?: Religion;
  casteCategory?: CasteCategory;
  annualIncome?: number;
  occupation?: Occupation;
  education?: Education;
  incomeRange?: IncomeRange;
  aadhaarNumber?: string;
  voterIdNumber?: string;
  mobileNumber?: string;
  familyGroupCode?: string;
  manualFamilyStatus?: MemberFamilyStatus;
}

export interface PersonRecord extends PersonInput {
  systemSuggestedStatus: MemberFamilyStatus;
  finalFamilyStatus: MemberFamilyStatus;
}

export interface FamilyGroup {
  id: string;
  householdId: string;
  familyGroupCode: string;
  familyType: FamilyGroupType;
  headPersonId: string;
  memberIds: string[];
  benefitType?: BenefitType;
}

export interface LandDetails {
  householdId: string;
  builtUpAreaSqm: number;
  openLandAreaSqm: number;
  totalAreaSqm: number;
  structureType?: string;
  cattleShedAvailable?: "YES" | "NO";
}

export interface Valuation {
  householdId: string;
  structureValue: number;
  landValue: number;
  treeAssetValue: number;
  shiftingAllowance: number;
  subsistenceAllowance: number;
  otherAssistance: number;
  totalCompensation: number;
}

export interface SyncQueueItem<TPayload = unknown> {
  id: string;
  entityType: string;
  recordId: string;
  operation: SyncOperation;
  syncStatus: SyncStatus;
  payload: TPayload;
  retryCount: number;
  createdAt: string;
}

export interface HouseholdBundle {
  household: Household;
  persons: PersonRecord[];
  familyGroups: FamilyGroup[];
  landDetails?: LandDetails;
  valuation?: Valuation;
}
