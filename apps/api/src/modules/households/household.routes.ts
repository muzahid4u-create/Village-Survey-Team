import { Router } from "express";
import { householdBundleSchema } from "./household.schemas";
import { householdService } from "./household.service";

export const householdRouter = Router();

householdRouter.get("/", async (_request, response) => {
  try {
    const items = await householdService.list();
    response.json({ items });
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "Unable to fetch households",
    });
  }
});

householdRouter.get("/:id", async (request, response) => {
  try {
    const household = await householdService.getById(request.params.id);

    if (!household) {
      response.status(404).json({ message: "Household not found" });
      return;
    }

    response.json(household);
  } catch (error) {
    response.status(500).json({
      message: error instanceof Error ? error.message : "Unable to fetch household",
    });
  }
});

householdRouter.post("/", async (request, response) => {
  const parsed = householdBundleSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid household payload",
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const created = await householdService.create(parsed.data);
    response.status(201).json(created);
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Unable to create household",
    });
  }
});

householdRouter.patch("/:id", async (request, response) => {
  const parsed = householdBundleSchema.safeParse({
    ...request.body,
    household: {
      ...request.body?.household,
      id: request.params.id,
    },
  });

  if (!parsed.success) {
    response.status(400).json({
      message: "Invalid household payload",
      issues: parsed.error.issues,
    });
    return;
  }

  try {
    const updated = await householdService.update(parsed.data);
    response.json(updated);
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Unable to update household",
    });
  }
});

householdRouter.delete("/:id", async (request, response) => {
  try {
    await householdService.remove(request.params.id);
    response.status(204).send();
  } catch (error) {
    response.status(400).json({
      message: error instanceof Error ? error.message : "Unable to delete household",
    });
  }
});
