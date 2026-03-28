import type { HouseholdBundle, SyncQueueItem } from "@marda/shared";

export interface LocalDatabaseAdapter {
  saveHousehold(bundle: HouseholdBundle): Promise<void>;
  getHouseholds(): Promise<HouseholdBundle[]>;
  enqueueSync(item: SyncQueueItem): Promise<void>;
  getPendingSyncItems(): Promise<SyncQueueItem[]>;
}

export class InMemoryLocalDatabase implements LocalDatabaseAdapter {
  private households: HouseholdBundle[] = [];
  private queue: SyncQueueItem[] = [];

  async saveHousehold(bundle: HouseholdBundle) {
    this.households = [...this.households.filter((item) => item.household.id !== bundle.household.id), bundle];
  }

  async getHouseholds() {
    return this.households;
  }

  async enqueueSync(item: SyncQueueItem) {
    this.queue = [...this.queue, item];
  }

  async getPendingSyncItems() {
    return this.queue.filter((item) => item.syncStatus !== "SYNCED");
  }
}

export const localDb = new InMemoryLocalDatabase();

