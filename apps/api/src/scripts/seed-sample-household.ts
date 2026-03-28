import { sampleHouseholdBundle } from "@marda/shared";
import { pool } from "../db/client.js";
import { householdRepository } from "../modules/households/household.repository.js";

async function run() {
  const existing = await householdRepository.getById(sampleHouseholdBundle.household.id);

  if (existing) {
    console.log("Sample household already exists");
    return;
  }

  await householdRepository.create(sampleHouseholdBundle);
  console.log("Seeded sample household");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
