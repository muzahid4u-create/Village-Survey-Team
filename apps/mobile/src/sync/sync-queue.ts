import type { HouseholdBundle, SyncQueueItem } from "@marda/shared";

export function createHouseholdSyncItem(bundle: HouseholdBundle): SyncQueueItem<HouseholdBundle> {
  return {
    id: `sync-${bundle.household.id}`,
    entityType: "household_bundle",
    recordId: bundle.household.id,
    operation: "CREATE",
    syncStatus: "SYNC_PENDING",
    payload: bundle,
    retryCount: 0,
    createdAt: new Date().toISOString(),
  };
}

