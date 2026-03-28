import cors from "cors";
import express from "express";
import { excelRouter } from "./modules/excel/excel.routes.js";
import { householdRouter } from "./modules/households/household.routes.js";
import { householdService } from "./modules/households/household.service.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  const healthHandler = (_request: express.Request, response: express.Response) => {
    response.json({
      ok: true,
      village: "Marda",
      storage: "postgresql",
    });
  };

  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);

  app.get("/api/dashboard/summary", async (_request, response, next) => {
    try {
      response.json(await householdService.getDashboardSummary());
    } catch (error) {
      next(error);
    }
  });

  app.use("/api/households", householdRouter);
  app.use("/api", excelRouter);

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    console.error(error);
    response.status(500).json({
      message: error instanceof Error ? error.message : "Internal server error",
    });
  });

  return app;
}
