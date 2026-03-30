import { sampleHouseholdBundle, type HouseholdBundle, type PersonInput } from "@marda/shared";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  (typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:4000/api"
    : "/api");

export interface CreateHouseholdPayload {
  household: {
    id: string;
    villageId: string;
    houseId: string;
    surveyNumber?: string;
    linkedHouseIds?: string;
    ownershipPattern?: "SINGLE_HOUSE" | "MULTIPLE_HOUSE_IDS" | "HOUSE_AND_PLOT" | "MULTIPLE_HOUSE_IDS_AND_PLOT";
    surveyPropertyType?: "RESIDENTIAL" | "EMPTY_PLOT" | "TEMPORARY_STRUCTURE" | "SHOP" | "OTHER_NON_RESIDENTIAL";
    hasResidentFamily?: boolean;
    propertyId?: string;
    headPersonName?: string;
    landOwnerName?: string;
    addressText?: string;
    locality?: string;
    status: "DRAFT";
    isLocked: false;
    remarks?: string;
  };
  persons: PersonInput[];
  familyBenefits?: Array<{
    familyGroupCode: "F1" | "F2" | "F3" | "F4" | "F5";
    benefitType: "INDIVIDUAL_PLOT" | "LUMPSUM_AMOUNT";
  }>;
  landDetails?: {
    builtUpAreaSqm: number;
    openLandAreaSqm: number;
    structureType?: string;
    cattleShedAvailable?: "YES" | "NO";
  };
  valuation?: {
    structureValue: number;
    landValue: number;
    treeAssetValue: number;
    shiftingAllowance: number;
    subsistenceAllowance: number;
    otherAssistance: number;
  };
}

export async function fetchDashboardSummary() {
  const response = await fetch(`${API_BASE_URL}/dashboard/summary`);
  if (!response.ok) {
    throw new Error("Failed to load dashboard summary");
  }
  return response.json();
}

export async function fetchHouseholds(): Promise<HouseholdBundle[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/households`);
    if (!response.ok) {
      throw new Error("Failed to load households");
    }

    const data = await response.json();
    return data.items;
  } catch {
    return [sampleHouseholdBundle];
  }
}

export async function createHousehold(payload: CreateHouseholdPayload): Promise<HouseholdBundle> {
  const response = await fetch(`${API_BASE_URL}/households`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Failed to create household");
  }

  return response.json();
}

export async function updateHousehold(id: string, payload: CreateHouseholdPayload): Promise<HouseholdBundle> {
  const response = await fetch(`${API_BASE_URL}/households/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Failed to update household");
  }

  return response.json();
}

export async function deleteHousehold(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/households/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Failed to delete household");
  }
}

export async function importExcel(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/import-excel`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.message ?? "Failed to import Excel");
  }

  return response.json();
}
