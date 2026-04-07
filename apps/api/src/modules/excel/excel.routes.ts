import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Router, type Response } from "express";
import multer from "multer";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
import { pool } from "../../db/client.js";
import type { CreateHouseholdBundleInput } from "../households/household.schemas.js";
import { householdService } from "../households/household.service.js";

const upload = multer({ storage: multer.memoryStorage() });

export const excelRouter = Router();
const coalIndiaLogoPath = path.resolve(process.cwd(), "..", "web", "public", "coal-india-1.png");
const coalIndiaLogoBuffer = fs.existsSync(coalIndiaLogoPath) ? fs.readFileSync(coalIndiaLogoPath) : null;

function optionalUpperValue<TValue extends string>(value: string | number | undefined, allowed: readonly TValue[]): TValue | undefined {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return undefined;
  return allowed.includes(normalized as TValue) ? (normalized as TValue) : undefined;
}

function normalizeHouseId(value: string | number | undefined): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return /^\d+$/.test(raw) ? raw.padStart(3, "0") : raw;
}

function normalizeText(value: string | number | undefined): string {
  return String(value ?? "").trim();
}

function parseOptionalNumber(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = normalizeText(value);
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNumberOrZero(value: string | number | undefined): number {
  return parseOptionalNumber(value) ?? 0;
}

function normalizeLoose(value: string | number | undefined): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rootHouseId(houseId: string): string {
  return normalizeHouseId(houseId.split("/")[0] ?? houseId);
}

const relationLabelMap: Record<string, string> = {
  "primary landowner": "PRIMARY_LAND_OWNER",
  "primary landowner spouse": "PRIMARY_LAND_OWNER_SPOUSE",
  son: "SON",
  daughter: "DAUGHTER",
  "daughter in law": "DAUGHTER_IN_LAW",
  "daughter-in-law": "DAUGHTER_IN_LAW",
  grandson: "GRAND_SON",
  granddaughter: "GRAND_DAUGHTER",
  mother: "MOTHER",
  father: "FATHER",
  brother: "BROTHER",
  sister: "SISTER",
};

function mapOccupation(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (!key || key === "none" || key === "unemployed") return "UNEMPLOYED" as const;
  if (key.includes("student")) return "STUDENT" as const;
  if (key.includes("business")) return "BUSINESS" as const;
  if (key.includes("government job") || key.includes("private job") || key.includes("retired")) return "EMPLOYED" as const;
  if (key.includes("agricultural labour") || key.includes("agriculture labour") || key.includes("agriculture")) return "AGRICULTURE" as const;
  return "OTHER" as const;
}

function mapEducation(value: string | number | undefined, age?: number) {
  const key = normalizeLoose(value);
  if (age !== undefined && age < 18 && (key === "student" || !key)) return "SCHOOL_GOING_CHILD" as const;
  if (key === "student") return "SCHOOL_GOING_CHILD" as const;
  if (!key || key === "illiterate" || key === "below ssc passed") return "LESS_THAN_10TH" as const;
  if (key === "only ssc passed") return "10TH" as const;
  if (key === "below hsc") return "10TH" as const;
  if (key === "only hsc passed") return "12TH" as const;
  if (key === "iti") return "ITI" as const;
  if (key === "graduate") return "DEGREE" as const;
  if (key === "post graduate" || key === "phd") return "MASTERS" as const;
  return "OTHERS" as const;
}

function mapMaritalStatus(value: string | number | undefined, age?: number) {
  if (age !== undefined && age < 18) return "MINOR" as const;
  const key = normalizeLoose(value);
  if (!key || key === "unmarried") return "UNMARRIED" as const;
  if (key === "married" || key === "married with kids") return "MARRIED" as const;
  if (key === "expired" || key === "widow with kids") return "WIDOWED" as const;
  return "UNMARRIED" as const;
}

function mapIncomeRange(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (!key || key === "0 5 lakh") return "0-5_LAKH" as const;
  if (key === "5 10 lakh") return "5-10_LAKH" as const;
  if (key === "10 15 lakh") return "10-15_LAKH" as const;
  if (key === "15 20 lakh") return "15-20_LAKH" as const;
  if (key === "20 25 lakh") return "20-25_LAKH" as const;
  return "ABOVE_25_LAKH" as const;
}

function mapBenefitType(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (key.includes("individual")) return "INDIVIDUAL_PLOT" as const;
  if (key.includes("lumpsum")) return "LUMPSUM_AMOUNT" as const;
  return undefined;
}

function mapStructureType(value: string | number | undefined) {
  const key = normalizeLoose(value);
  if (key.includes("semi")) return "Semi-Pucca";
  if (key.includes("kuccha") || key.includes("kutcha")) return "Kutcha";
  if (key.includes("pucca")) return "Pucca";
  return normalizeText(value) || undefined;
}

function toDateString(value: string | number | undefined) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return undefined;
    return `${parsed.y.toString().padStart(4, "0")}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }

  const text = String(value).trim();
  if (!text) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function chooseImportRows(workbook: XLSX.WorkBook) {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "" });
    const hasHouseId = rows.some((row) => normalizeText(row["House ID"]));
    if (hasHouseId) return rows;
  }

  return XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
}

type HouseholdPayload = CreateHouseholdBundleInput["household"];
type PersonPayload = CreateHouseholdBundleInput["persons"][number];
type FamilyBenefitPayload = NonNullable<CreateHouseholdBundleInput["familyBenefits"]>[number];
type LandDetailsPayload = NonNullable<CreateHouseholdBundleInput["landDetails"]>;
type ValuationPayload = NonNullable<CreateHouseholdBundleInput["valuation"]>;
type FlattenedRow = ReturnType<typeof flattenHouseholdRows>[number];

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function flattenHouseholdRows(households: Awaited<ReturnType<typeof householdService.list>>) {
  return households.flatMap((household) =>
    household.persons
      .filter((person) => person.includeInSurvey !== false)
      .map((person) => ({
        householdId: household.household.houseId,
        linkedHouseIds: household.household.linkedHouseIds ?? "",
        ownershipPattern: household.household.ownershipPattern ?? "",
        name: person.fullName,
        relation: person.relationToLandOwner,
        gender: person.gender ?? "",
        age: person.age ?? "",
        maritalStatus: person.maritalStatus ?? "",
        marriageDate: person.marriageDate ?? "",
        religion: person.religion ?? "",
        category: person.casteCategory ?? "",
        categoryDetail: person.otherCasteCategoryDetail ?? "",
        occupation: person.occupation ?? "",
        education: person.education ?? "",
        incomeRange: person.incomeRange ?? "",
        aadhaarNumber: person.aadhaarNumber ?? "",
        familyId: person.familyGroupCode ?? "F1",
        dependent: person.dependentOnLandOwner ? "YES" : "NO",
        structureType: household.landDetails?.structureType ?? "",
        cattleShedAvailable: household.landDetails?.cattleShedAvailable ?? "NO",
        builtUpArea: household.landDetails?.builtUpAreaSqm ?? "",
        emptyPlotArea: household.landDetails?.openLandAreaSqm ?? "",
        totalArea: household.landDetails?.totalAreaSqm ?? "",
        constructionValue: household.valuation?.structureValue ?? "",
        landValue: household.valuation?.landValue ?? "",
      })),
  );
}

function filterRowsByFamilyCode(rows: FlattenedRow[], familyCode: "F1" | "F2" | "F3" | "F4" | "F5") {
  return rows.filter((row) => row.familyId === familyCode);
}

function filterRowsByBenefitType(
  households: Awaited<ReturnType<typeof householdService.list>>,
  benefitType: "INDIVIDUAL_PLOT" | "LUMPSUM_AMOUNT",
) {
  const eligibleKeys = new Set<string>();

  households.forEach((household) => {
    household.familyGroups
      .filter((group) => group.benefitType === benefitType)
      .forEach((group) => {
        eligibleKeys.add(`${household.household.id}:${group.familyGroupCode}`);
      });
  });

  return flattenHouseholdRows(households).filter((row) =>
    eligibleKeys.has(
      `${households.find((household) => household.household.houseId === row.householdId)?.household.id ?? ""}:${row.familyId}`,
    ),
  );
}

function buildDistributionRows(
  households: Awaited<ReturnType<typeof householdService.list>>,
  key: "incomeRange" | "casteCategory" | "occupation",
) {
  const counts = households.reduce<Record<string, number>>((accumulator, household) => {
    household.persons
      .filter((person) => person.includeInSurvey !== false && person[key])
      .forEach((person) => {
        const value = String(person[key] ?? "").trim();
        if (!value) return;
        accumulator[value] = (accumulator[value] ?? 0) + 1;
      });

    return accumulator;
  }, {});

  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return Object.entries(counts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({
      value,
      label: formatLabel(value),
      count,
      share: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
    }));
}

function writeCsv(response: Response, fileName: string, rows: ReturnType<typeof flattenHouseholdRows>) {
  const headers = [
    "House ID",
    "Linked House IDs",
    "Ownership Pattern",
    "Name",
    "Relation",
    "Gender",
    "Age",
    "Marital Status",
    "Marriage Date",
    "Religion",
    "Category",
    "Category Detail",
    "Occupation",
    "Education",
    "Income Range",
    "Aadhaar Number",
    "Family ID",
    "Dependent",
    "Structure Type",
    "Cattle Shed Available",
    "Built-up Area",
    "Empty Plot Area",
    "Total Area",
    "Construction Value",
    "Land Value",
  ];
  const csvLines = [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.householdId,
        row.linkedHouseIds,
        row.ownershipPattern,
        row.name,
        row.relation,
        row.gender,
        row.age,
        row.maritalStatus,
        row.marriageDate,
        row.religion,
        row.category,
        row.categoryDetail,
        row.occupation,
        row.education,
        row.incomeRange,
        row.aadhaarNumber,
        row.familyId,
        row.dependent,
        row.structureType,
        row.cattleShedAvailable,
        row.builtUpArea,
        row.emptyPlotArea,
        row.totalArea,
        row.constructionValue,
        row.landValue,
      ]
        .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.send(csvLines.join("\n"));
}

function writePdf(
  response: Response,
  title: string,
  fileName: string,
  rows: ReturnType<typeof flattenHouseholdRows>,
) {
  const doc = new PDFDocument({ margin: 24, size: "A4", layout: "landscape" });
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  doc.pipe(response);

  const columns = [
    { label: "House", key: "householdId", width: 55 },
    { label: "Linked IDs", key: "linkedHouseIds", width: 78 },
    { label: "Ownership", key: "ownershipPattern", width: 84 },
    { label: "Name", key: "name", width: 88 },
    { label: "Relation", key: "relation", width: 86 },
    { label: "Gender", key: "gender", width: 42 },
    { label: "Age", key: "age", width: 32 },
    { label: "Religion", key: "religion", width: 55 },
    { label: "Category", key: "category", width: 52 },
    { label: "Cat. Detail", key: "categoryDetail", width: 70 },
    { label: "Occupation", key: "occupation", width: 70 },
    { label: "Education", key: "education", width: 56 },
    { label: "Income", key: "incomeRange", width: 66 },
    { label: "Family", key: "familyId", width: 42 },
    { label: "Dep.", key: "dependent", width: 34 },
  ] as const;
  const tableLeft = 24;
  const rowHeight = 22;
  const headerHeight = 24;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  const firstPageTop = 112;
  const nextPageTop = 60;

  function drawHeader(y: number) {
    let x = tableLeft;
    doc
      .fillColor("#143e2d")
      .font("Helvetica-Bold")
      .fontSize(8);

    columns.forEach((column) => {
      doc
        .roundedRect(x, y, column.width, headerHeight, 4)
        .fillAndStroke("#e8f0e8", "#d4ddcf");
      doc
        .fillColor("#143e2d")
        .text(column.label, x + 4, y + 7, {
          width: column.width - 8,
          align: "center",
        });
      x += column.width;
    });
  }

  function drawRow(y: number, row: (typeof rows)[number], index: number) {
    let x = tableLeft;
    const fill = index % 2 === 0 ? "#fffdf8" : "#f7f3ea";

    doc.font("Helvetica").fontSize(7.2);

    columns.forEach((column) => {
      doc
        .roundedRect(x, y, column.width, rowHeight, 2)
        .fillAndStroke(fill, "#e3ddd2");
      doc
        .fillColor("#2a342d")
        .text(String(row[column.key] ?? ""), x + 4, y + 7, {
          width: column.width - 8,
          align: column.key === "age" ? "center" : "left",
          ellipsis: true,
        });
      x += column.width;
    });
  }

  function drawReportHeading() {
    if (coalIndiaLogoBuffer) {
      doc.image(coalIndiaLogoBuffer, 24, 18, {
        fit: [54, 54],
        align: "left",
        valign: "center",
      });
    }

    doc.fillColor("#143e2d").font("Helvetica-Bold").fontSize(15).text(title, 90, 24, {
      align: "center",
      width: doc.page.width - 180,
    });
    doc.fillColor("#6e7169").font("Helvetica").fontSize(10).text(
      "Marda Village Rehabilitation & Resettlement (R&R) Survey",
      90,
      44,
      { align: "center", width: doc.page.width - 180 },
    );
    doc.text("Amalgamated Yekona-I & II OC Mine, WCL", 90, 58, {
      align: "center",
      width: doc.page.width - 180,
    });
    doc.fontSize(9).text("Coal India Limited", 90, 71, {
      align: "center",
      width: doc.page.width - 180,
    });
  }

  drawReportHeading();

  let y = firstPageTop;
  drawHeader(y);
  y += headerHeight;

  rows.forEach((row, index) => {
    if (y + rowHeight > doc.page.height - 28) {
      doc.addPage({ margin: 24, size: "A4", layout: "landscape" });
      drawReportHeading();
      y = nextPageTop;
      drawHeader(y);
      y += headerHeight;
    }

    drawRow(y, row, index);
    y += rowHeight;
  });

  doc
    .lineWidth(0.8)
    .strokeColor("#d9d3c7")
    .moveTo(tableLeft, firstPageTop - 8)
    .lineTo(tableLeft + tableWidth, firstPageTop - 8)
    .stroke();

  doc.end();
}

function addWorkbookBranding(workbook: ExcelJS.Workbook, sheet: ExcelJS.Worksheet, title: string) {
  if (coalIndiaLogoBuffer) {
    const imageId = workbook.addImage({
      filename: coalIndiaLogoPath,
      extension: "png",
    });

    sheet.addImage(imageId, {
      tl: { col: 0, row: 0 },
      ext: { width: 82, height: 82 },
    });
  }

  sheet.mergeCells("C1:J1");
  sheet.mergeCells("C2:J2");
  sheet.getCell("C1").value = title;
  sheet.getCell("C2").value = "Coal India Limited";
  sheet.getCell("C1").font = { bold: true, size: 15, color: { argb: "143E2D" } };
  sheet.getCell("C2").font = { bold: true, size: 11, color: { argb: "6E7169" } };
  sheet.getCell("C1").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getCell("C2").alignment = { vertical: "middle", horizontal: "center" };
  sheet.getRow(1).height = 34;
  sheet.getRow(2).height = 24;
}

async function writeSummaryExcel(
  response: Response,
  fileName: string,
  title: string,
  rows: Array<{ label: string; count: number; share: number }>,
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Summary");

  sheet.columns = [
    { header: "Label", key: "label", width: 28 },
    { header: "Count", key: "count", width: 14 },
    { header: "Share (%)", key: "share", width: 14 },
  ];

  rows.forEach((row) => sheet.addRow(row));
  sheet.spliceRows(1, 0, [], []);
  addWorkbookBranding(workbook, sheet, title);

  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await workbook.xlsx.write(response);
  response.end();
}

async function writeDetailExcel(
  response: Response,
  fileName: string,
  title: string,
  rows: FlattenedRow[],
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  sheet.columns = [
    { header: "House ID", key: "householdId", width: 14 },
    { header: "Linked House IDs", key: "linkedHouseIds", width: 24 },
    { header: "Ownership Pattern", key: "ownershipPattern", width: 28 },
    { header: "Name", key: "name", width: 24 },
    { header: "Relation", key: "relation", width: 28 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "Age", key: "age", width: 10 },
    { header: "Marital Status", key: "maritalStatus", width: 18 },
    { header: "Marriage Date", key: "marriageDate", width: 18 },
    { header: "Religion", key: "religion", width: 14 },
    { header: "Category", key: "category", width: 12 },
    { header: "Category Detail", key: "categoryDetail", width: 22 },
    { header: "Occupation", key: "occupation", width: 18 },
    { header: "Education", key: "education", width: 16 },
    { header: "Income Range", key: "incomeRange", width: 18 },
    { header: "Aadhaar Number", key: "aadhaarNumber", width: 20 },
    { header: "Family ID", key: "familyId", width: 10 },
    { header: "Dependent", key: "dependent", width: 12 },
    { header: "Structure Type", key: "structureType", width: 16 },
    { header: "Cattle Shed Available", key: "cattleShedAvailable", width: 20 },
    { header: "Built-up Area", key: "builtUpArea", width: 14 },
    { header: "Empty Plot Area", key: "emptyPlotArea", width: 16 },
    { header: "Total Area", key: "totalArea", width: 12 },
    { header: "Construction Value", key: "constructionValue", width: 18 },
    { header: "Land Value", key: "landValue", width: 14 },
  ];

  rows.forEach((row) => sheet.addRow(row));
  sheet.spliceRows(1, 0, [], []);
  addWorkbookBranding(workbook, sheet, title);

  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  await workbook.xlsx.write(response);
  response.end();
}

function writeSummaryCsv(
  response: Response,
  fileName: string,
  rows: Array<{ label: string; count: number; share: number }>,
) {
  const csvLines = [
    "Label,Count,Share (%)",
    ...rows.map((row) => [`"${row.label.replaceAll('"', '""')}"`, row.count, row.share].join(",")),
  ];

  response.setHeader("Content-Type", "text/csv");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  response.send(csvLines.join("\n"));
}

function writeSummaryPdf(
  response: Response,
  title: string,
  fileName: string,
  rows: Array<{ label: string; count: number; share: number }>,
) {
  const doc = new PDFDocument({ margin: 28, size: "A4" });
  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  doc.pipe(response);

  if (coalIndiaLogoBuffer) {
    doc.image(coalIndiaLogoBuffer, 28, 18, {
      fit: [52, 52],
    });
  }

  doc.fillColor("#143e2d").font("Helvetica-Bold").fontSize(15).text(title, 92, 24, {
    align: "center",
    width: doc.page.width - 180,
  });
  doc.fillColor("#6e7169").font("Helvetica").fontSize(10).text(
    "Marda Village Rehabilitation & Resettlement (R&R) Survey",
    92,
    44,
    { align: "center", width: doc.page.width - 180 },
  );
  doc.text("Coal India Limited", 92, 58, {
    align: "center",
    width: doc.page.width - 180,
  });

  const columns = [
    { label: "Classification", key: "label", x: 34, width: 280 },
    { label: "Count", key: "count", x: 324, width: 90 },
    { label: "Share (%)", key: "share", x: 424, width: 90 },
  ] as const;
  const rowHeight = 26;
  const startY = 110;

  columns.forEach((column) => {
    doc.roundedRect(column.x, startY, column.width, rowHeight, 4).fillAndStroke("#e8f0e8", "#d4ddcf");
    doc.fillColor("#143e2d").font("Helvetica-Bold").fontSize(9).text(column.label, column.x, startY + 8, {
      width: column.width,
      align: "center",
    });
  });

  let y = startY + rowHeight;
  rows.forEach((row, index) => {
    const fill = index % 2 === 0 ? "#fffdf8" : "#f7f3ea";
    columns.forEach((column) => {
      doc.roundedRect(column.x, y, column.width, rowHeight, 2).fillAndStroke(fill, "#e3ddd2");
      doc.fillColor("#2a342d").font("Helvetica").fontSize(9).text(String(row[column.key]), column.x + 6, y + 8, {
        width: column.width - 12,
        align: column.key === "label" ? "left" : "center",
      });
    });
    y += rowHeight;
  });

  doc.end();
}

excelRouter.get("/import-template", async (_request, response) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Survey Template");

  sheet.columns = [
    { header: "House ID", key: "houseId", width: 14 },
    { header: "Linked House IDs", key: "linkedHouseIds", width: 24 },
    { header: "Ownership Pattern", key: "ownershipPattern", width: 28 },
    { header: "Name", key: "name", width: 24 },
    { header: "Relation", key: "relation", width: 28 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "Age", key: "age", width: 10 },
    { header: "Marital Status", key: "maritalStatus", width: 18 },
    { header: "Marriage Date", key: "marriageDate", width: 18 },
    { header: "Religion", key: "religion", width: 14 },
    { header: "Category", key: "category", width: 12 },
    { header: "Category Detail", key: "categoryDetail", width: 22 },
    { header: "Occupation", key: "occupation", width: 18 },
    { header: "Education", key: "education", width: 16 },
    { header: "Income Range", key: "incomeRange", width: 18 },
    { header: "Aadhaar Number", key: "aadhaarNumber", width: 20 },
    { header: "Family ID", key: "familyId", width: 10 },
    { header: "Dependent", key: "dependent", width: 12 },
    { header: "Benefit Type", key: "benefitType", width: 20 },
    { header: "Structure Type", key: "structureType", width: 16 },
    { header: "Cattle Shed Available", key: "cattleShedAvailable", width: 20 },
    { header: "Built-up Area", key: "builtUpArea", width: 14 },
    { header: "Empty Plot Area", key: "emptyPlotArea", width: 16 },
    { header: "Total Area", key: "totalArea", width: 12 },
    { header: "Construction Value", key: "constructionValue", width: 18 },
    { header: "Land Value", key: "landValue", width: 14 },
  ];

  sheet.addRow({
    houseId: "H001",
    linkedHouseIds: "H001A, H001B",
    ownershipPattern: "HOUSE_AND_PLOT",
    name: "Rahim Khan",
    relation: "PRIMARY_LAND_OWNER",
    gender: "MALE",
    age: 55,
    maritalStatus: "MARRIED",
    marriageDate: "",
    religion: "MUSLIM",
    category: "OBC",
    categoryDetail: "",
    occupation: "AGRICULTURE",
    education: "12TH",
    incomeRange: "5-10_LAKH",
    aadhaarNumber: "123412341234",
    familyId: "F1",
    dependent: "NO",
    benefitType: "INDIVIDUAL_PLOT",
    structureType: "PUCCA",
    cattleShedAvailable: "YES",
    builtUpArea: 1200,
    emptyPlotArea: 800,
    totalArea: 2000,
    constructionValue: 950000,
    landValue: 400000,
  });

  sheet.addRow({
    houseId: "H001",
    linkedHouseIds: "H001A, H001B",
    ownershipPattern: "HOUSE_AND_PLOT",
    name: "Fatima",
    relation: "PRIMARY_LAND_OWNER_SPOUSE",
    gender: "FEMALE",
    age: 50,
    maritalStatus: "MARRIED",
    marriageDate: "",
    religion: "MUSLIM",
    category: "OBC",
    categoryDetail: "",
    occupation: "HOUSE_WIFE",
    education: "10TH",
    incomeRange: "0-5_LAKH",
    aadhaarNumber: "567856785678",
    familyId: "F1",
    dependent: "YES",
    benefitType: "INDIVIDUAL_PLOT",
    structureType: "PUCCA",
    cattleShedAvailable: "YES",
    builtUpArea: 1200,
    emptyPlotArea: 800,
    totalArea: 2000,
    constructionValue: 950000,
    landValue: 400000,
  });

  sheet.addRow({
    houseId: "H001",
    linkedHouseIds: "H001A, H001B",
    ownershipPattern: "HOUSE_AND_PLOT",
    name: "Imran",
    relation: "SON",
    gender: "MALE",
    age: 28,
    maritalStatus: "MARRIED",
    marriageDate: "2018-01-01",
    religion: "MUSLIM",
    category: "OBC",
    categoryDetail: "",
    occupation: "EMPLOYED",
    education: "DEGREE",
    incomeRange: "10-15_LAKH",
    aadhaarNumber: "789078907890",
    familyId: "F2",
    dependent: "NO",
    benefitType: "LUMPSUM_AMOUNT",
    structureType: "PUCCA",
    cattleShedAvailable: "YES",
    builtUpArea: 1200,
    emptyPlotArea: 800,
    totalArea: 2000,
    constructionValue: 950000,
    landValue: 400000,
  });

  sheet.spliceRows(1, 0, [], []);
  addWorkbookBranding(workbook, sheet, "Marda Village R&R Survey Import Template");

  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader("Content-Disposition", 'attachment; filename="marda-import-template.xlsx"');
  await workbook.xlsx.write(response);
  response.end();
});

excelRouter.get("/export-excel", async (_request, response) => {
  const households = await householdService.list();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Survey");

  sheet.columns = [
    { header: "House ID", key: "houseId", width: 14 },
    { header: "Linked House IDs", key: "linkedHouseIds", width: 24 },
    { header: "Ownership Pattern", key: "ownershipPattern", width: 28 },
    { header: "Name", key: "name", width: 24 },
    { header: "Relation", key: "relation", width: 28 },
    { header: "Gender", key: "gender", width: 12 },
    { header: "Age", key: "age", width: 10 },
    { header: "Marital Status", key: "maritalStatus", width: 18 },
    { header: "Marriage Date", key: "marriageDate", width: 18 },
    { header: "Religion", key: "religion", width: 14 },
    { header: "Category", key: "category", width: 12 },
    { header: "Category Detail", key: "categoryDetail", width: 22 },
    { header: "Occupation", key: "occupation", width: 18 },
    { header: "Education", key: "education", width: 16 },
    { header: "Income Range", key: "incomeRange", width: 18 },
    { header: "Aadhaar Number", key: "aadhaarNumber", width: 20 },
    { header: "Family ID", key: "familyId", width: 10 },
    { header: "Dependent", key: "dependent", width: 12 },
    { header: "Benefit Type", key: "benefitType", width: 20 },
    { header: "Structure Type", key: "structureType", width: 16 },
    { header: "Cattle Shed Available", key: "cattleShedAvailable", width: 20 },
    { header: "Built-up Area", key: "builtUpArea", width: 14 },
    { header: "Empty Plot Area", key: "emptyPlotArea", width: 16 },
    { header: "Total Area", key: "totalArea", width: 12 },
    { header: "Construction Value", key: "constructionValue", width: 18 },
    { header: "Land Value", key: "landValue", width: 14 },
  ];

  households.forEach((household) => {
    household.persons
      .filter((person) => person.includeInSurvey !== false)
      .forEach((person) => {
        sheet.addRow({
          houseId: household.household.houseId,
          linkedHouseIds: household.household.linkedHouseIds ?? "",
          ownershipPattern: household.household.ownershipPattern ?? "",
          name: person.fullName,
          relation: person.relationToLandOwner,
          gender: person.gender ?? "",
          age: person.age ?? "",
          maritalStatus: person.maritalStatus ?? "",
          marriageDate: person.marriageDate ?? "",
          religion: person.religion ?? "",
          category: person.casteCategory ?? "",
          categoryDetail: person.otherCasteCategoryDetail ?? "",
          occupation: person.occupation ?? "",
          education: person.education ?? "",
          incomeRange: person.incomeRange ?? "",
          aadhaarNumber: person.aadhaarNumber ?? "",
          familyId: person.familyGroupCode ?? "F1",
          dependent: person.dependentOnLandOwner ? "YES" : "NO",
          benefitType:
            household.familyGroups.find((group) => group.familyGroupCode === (person.familyGroupCode ?? "F1"))?.benefitType ?? "",
          structureType: household.landDetails?.structureType ?? "",
          cattleShedAvailable: household.landDetails?.cattleShedAvailable ?? "NO",
          builtUpArea: household.landDetails?.builtUpAreaSqm ?? "",
          emptyPlotArea: household.landDetails?.openLandAreaSqm ?? "",
          totalArea: household.landDetails?.totalAreaSqm ?? "",
          constructionValue: household.valuation?.structureValue ?? "",
          landValue: household.valuation?.landValue ?? "",
        });
      });
  });

  sheet.spliceRows(1, 0, [], []);
  addWorkbookBranding(workbook, sheet, "Marda Village R&R Survey Export");

  response.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  response.setHeader("Content-Disposition", 'attachment; filename="survey.xlsx"');
  await workbook.xlsx.write(response);
  response.end();
});

excelRouter.get("/download-csv", async (_request, response) => {
  const households = await householdService.list();
  writeCsv(response, "marda_rr_survey.csv", flattenHouseholdRows(households));
});

excelRouter.get("/download-pdf", async (_request, response) => {
  const households = await householdService.list();
  writePdf(
    response,
    "Marda Village Household Survey Report",
    "marda_rr_survey.pdf",
    flattenHouseholdRows(households),
  );
});

excelRouter.get("/reports/family/:familyCode/download-csv", async (request, response) => {
  const familyCode = optionalUpperValue(request.params.familyCode, ["F1", "F2", "F3", "F4", "F5"] as const);
  if (!familyCode) {
    response.status(400).json({ message: "Invalid family code" });
    return;
  }

  const households = await householdService.list();
  writeCsv(response, `report_${familyCode.toLowerCase()}.csv`, filterRowsByFamilyCode(flattenHouseholdRows(households), familyCode));
});

excelRouter.get("/reports/family/:familyCode/download-pdf", async (request, response) => {
  const familyCode = optionalUpperValue(request.params.familyCode, ["F1", "F2", "F3", "F4", "F5"] as const);
  if (!familyCode) {
    response.status(400).json({ message: "Invalid family code" });
    return;
  }

  const households = await householdService.list();
  writePdf(
    response,
    `${familyCode} Family Details Report`,
    `report_${familyCode.toLowerCase()}.pdf`,
    filterRowsByFamilyCode(flattenHouseholdRows(households), familyCode),
  );
});

excelRouter.get("/reports/family/:familyCode/export-excel", async (request, response) => {
  const familyCode = optionalUpperValue(request.params.familyCode, ["F1", "F2", "F3", "F4", "F5"] as const);
  if (!familyCode) {
    response.status(400).json({ message: "Invalid family code" });
    return;
  }

  const households = await householdService.list();
  await writeDetailExcel(
    response,
    `report_${familyCode.toLowerCase()}.xlsx`,
    `${familyCode} Family Details Report`,
    filterRowsByFamilyCode(flattenHouseholdRows(households), familyCode),
  );
});

excelRouter.get("/reports/benefit/:benefitType/download-csv", async (request, response) => {
  const benefitType = optionalUpperValue(
    request.params.benefitType,
    ["INDIVIDUAL_PLOT", "LUMPSUM_AMOUNT"] as const,
  );
  if (!benefitType) {
    response.status(400).json({ message: "Invalid benefit type" });
    return;
  }

  const households = await householdService.list();
  writeCsv(
    response,
    `report_${benefitType.toLowerCase()}.csv`,
    filterRowsByBenefitType(households, benefitType),
  );
});

excelRouter.get("/reports/benefit/:benefitType/download-pdf", async (request, response) => {
  const benefitType = optionalUpperValue(
    request.params.benefitType,
    ["INDIVIDUAL_PLOT", "LUMPSUM_AMOUNT"] as const,
  );
  if (!benefitType) {
    response.status(400).json({ message: "Invalid benefit type" });
    return;
  }

  const households = await householdService.list();
  writePdf(
    response,
    `${formatLabel(benefitType)} Families Report`,
    `report_${benefitType.toLowerCase()}.pdf`,
    filterRowsByBenefitType(households, benefitType),
  );
});

excelRouter.get("/reports/benefit/:benefitType/export-excel", async (request, response) => {
  const benefitType = optionalUpperValue(
    request.params.benefitType,
    ["INDIVIDUAL_PLOT", "LUMPSUM_AMOUNT"] as const,
  );
  if (!benefitType) {
    response.status(400).json({ message: "Invalid benefit type" });
    return;
  }

  const households = await householdService.list();
  await writeDetailExcel(
    response,
    `report_${benefitType.toLowerCase()}.xlsx`,
    `${formatLabel(benefitType)} Families Report`,
    filterRowsByBenefitType(households, benefitType),
  );
});

excelRouter.get("/reports/distribution/:distributionType/download-csv", async (request, response) => {
  const distributionType = optionalUpperValue(
    request.params.distributionType,
    ["INCOME", "CATEGORY", "OCCUPATION"] as const,
  );
  if (!distributionType) {
    response.status(400).json({ message: "Invalid distribution type" });
    return;
  }

  const households = await householdService.list();
  const rows = buildDistributionRows(
    households,
    distributionType === "INCOME"
      ? "incomeRange"
      : distributionType === "CATEGORY"
        ? "casteCategory"
        : "occupation",
  );
  writeSummaryCsv(response, `report_${distributionType.toLowerCase()}_distribution.csv`, rows);
});

excelRouter.get("/reports/distribution/:distributionType/download-pdf", async (request, response) => {
  const distributionType = optionalUpperValue(
    request.params.distributionType,
    ["INCOME", "CATEGORY", "OCCUPATION"] as const,
  );
  if (!distributionType) {
    response.status(400).json({ message: "Invalid distribution type" });
    return;
  }

  const households = await householdService.list();
  const rows = buildDistributionRows(
    households,
    distributionType === "INCOME"
      ? "incomeRange"
      : distributionType === "CATEGORY"
        ? "casteCategory"
        : "occupation",
  );
  writeSummaryPdf(
    response,
    `${formatLabel(distributionType)} Distribution Report`,
    `report_${distributionType.toLowerCase()}_distribution.pdf`,
    rows,
  );
});

excelRouter.get("/reports/distribution/:distributionType/export-excel", async (request, response) => {
  const distributionType = optionalUpperValue(
    request.params.distributionType,
    ["INCOME", "CATEGORY", "OCCUPATION"] as const,
  );
  if (!distributionType) {
    response.status(400).json({ message: "Invalid distribution type" });
    return;
  }

  const households = await householdService.list();
  const rows = buildDistributionRows(
    households,
    distributionType === "INCOME"
      ? "incomeRange"
      : distributionType === "CATEGORY"
        ? "casteCategory"
        : "occupation",
  );
  await writeSummaryExcel(
    response,
    `report_${distributionType.toLowerCase()}_distribution.xlsx`,
    `${formatLabel(distributionType)} Distribution Report`,
    rows,
  );
});

excelRouter.get("/household/:householdId/download-csv", async (request, response) => {
  const household = await householdService.getById(request.params.householdId);

  if (!household) {
    response.status(404).json({ message: "Household not found" });
    return;
  }

  writeCsv(response, `household_${household.household.houseId}.csv`, flattenHouseholdRows([household]));
});

excelRouter.get("/household/:householdId/download-pdf", async (request, response) => {
  const household = await householdService.getById(request.params.householdId);

  if (!household) {
    response.status(404).json({ message: "Household not found" });
    return;
  }

  writePdf(
    response,
    `Household Report - ${household.household.houseId}`,
    `household_${household.household.houseId}.pdf`,
    flattenHouseholdRows([household]),
  );
});

excelRouter.post("/import-excel", upload.single("file"), async (request, response) => {
  if (!request.file) {
    response.status(400).json({ message: "Excel file is required" });
    return;
  }

  const workbook = XLSX.read(request.file.buffer, { type: "buffer" });
  const rows = chooseImportRows(workbook);

  const grouped = new Map<string, Record<string, string | number>[]>();
  rows.forEach((row) => {
    const houseId = normalizeHouseId(row["House ID"]);
    if (!houseId) return;
    grouped.set(houseId, [...(grouped.get(houseId) ?? []), row]);
  });

  const clusterMap = new Map<string, string[]>();
  for (const houseId of grouped.keys()) {
    const root = rootHouseId(houseId);
    clusterMap.set(root, [...(clusterMap.get(root) ?? []), houseId]);
  }

  const baseOwners = new Map<string, Record<string, string | number>>();
  for (const [houseId, groupRows] of grouped.entries()) {
    const owner = groupRows.find((row) => {
      const relation = normalizeLoose(row["Relation"]);
      return relationLabelMap[relation] === "PRIMARY_LAND_OWNER" || String(row["Relation"] ?? "").trim().toUpperCase() === "PRIMARY_LAND_OWNER";
    });
    if (owner) {
      baseOwners.set(rootHouseId(houseId), owner);
    }
  }

  const existingResult = await pool.query<{ id: string; village_id: string; house_id: string }>(
    "select id, village_id, house_id from households where house_id = any($1::text[])",
    [[...grouped.keys()]],
  );
  const existingByHouseId = new Map(
    existingResult.rows.map((row) => [row.house_id, { id: row.id, villageId: row.village_id }]),
  );

  let importedHouseholds = 0;
  const skippedHouseholds: string[] = [];

  for (const [houseId, originalRows] of grouped.entries()) {
    const root = rootHouseId(houseId);
    const existingBundle = existingByHouseId.get(houseId);
    const householdId = existingBundle?.id ?? randomUUID();
    const linkedIds = (clusterMap.get(root) ?? []).filter((id) => id !== houseId);
    const hasMultipleHouseIds = (clusterMap.get(root)?.length ?? 0) > 1;

    const groupRows = [...originalRows];
    const hasPrimaryOwner = groupRows.some((row) => {
      const relation = normalizeLoose(row["Relation"]);
      return relationLabelMap[relation] === "PRIMARY_LAND_OWNER" || String(row["Relation"] ?? "").trim().toUpperCase() === "PRIMARY_LAND_OWNER";
    });

    if (!hasPrimaryOwner) {
      const fallbackOwner = baseOwners.get(root);
      if (!fallbackOwner) {
        skippedHouseholds.push(houseId);
        continue;
      }

      groupRows.unshift({
        ...fallbackOwner,
        "House ID": houseId,
        "Family ID": "F1",
        Dependent: "Primary",
        "Benefit Type": fallbackOwner["Benefit Type"] || "Individual Plot",
      });
    }

    const seenKeys = new Set<string>();
    const persons: PersonPayload[] = groupRows.flatMap((row) => {
      const fullName = normalizeText(row["Name"]);
      if (!fullName) return [];

      const strictRelation = String(row["Relation"] ?? "").trim().toUpperCase();
      const mappedRelation = (relationLabelMap[normalizeLoose(row["Relation"])] ??
        strictRelation ??
        "OTHER") as PersonPayload["relationToLandOwner"];
      const age = parseOptionalNumber(row["Age"]);
      const familyGroupCode = normalizeText(row["Family ID"]).toUpperCase() || "F1";
      const maritalStatus = optionalUpperValue(String(row["Marital Status"] ?? ""), [
        "MINOR",
        "UNMARRIED",
        "MARRIED",
        "WIDOWED",
        "DIVORCED",
      ] as const) ?? mapMaritalStatus(row["Marital Status"], age);
      const personKey = `${fullName.toLowerCase()}|${mappedRelation}|${familyGroupCode}`;

      if (seenKeys.has(personKey)) return [];
      seenKeys.add(personKey);

      const gender: PersonPayload["gender"] = normalizeLoose(row["Gender"]).startsWith("female")
        ? "FEMALE"
        : normalizeLoose(row["Gender"]).startsWith("male")
          ? "MALE"
          : "OTHER";

      return [{
        id: randomUUID(),
        householdId,
        fullName,
        relationToLandOwner: mappedRelation,
        gender,
        age,
        maritalStatus,
        marriageDate:
          maritalStatus === "UNMARRIED" ||
          maritalStatus === "MINOR" ||
          mappedRelation === "PRIMARY_LAND_OWNER" ||
          mappedRelation === "PRIMARY_LAND_OWNER_SPOUSE"
            ? undefined
            : toDateString(row["Marriage Date"]),
        religion: optionalUpperValue(String(row["Religion"] ?? "OTHER"), [
          "HINDU",
          "MUSLIM",
          "CHRISTIAN",
          "SIKH",
          "BUDDHIST",
          "JAIN",
          "OTHER",
        ] as const) ?? "HINDU",
        casteCategory: optionalUpperValue(String(row["Category"] ?? "OTHERS"), [
          "GENERAL",
          "OBC",
          "SC",
          "ST",
          "OTHERS",
        ] as const) ?? "OBC",
        otherCasteCategoryDetail:
          normalizeText(row["Category Detail"]) ||
          normalizeText(row["Category_1"]) ||
          undefined,
        occupation: optionalUpperValue(String(row["Occupation"] ?? "OTHER"), [
          "EMPLOYED",
          "AGRICULTURE",
          "HOUSE_WIFE",
          "BUSINESS",
          "STUDENT",
          "MINOR",
          "UNEMPLOYED",
          "OTHER",
        ] as const) ?? mapOccupation(row["Occupation"]),
        education: optionalUpperValue(String(row["Education"] ?? "OTHERS"), [
          "SCHOOL_GOING_CHILD",
          "LESS_THAN_10TH",
          "10TH",
          "12TH",
          "ITI",
          "DIPLOMA",
          "DEGREE",
          "MASTERS",
          "OTHERS",
        ] as const) ?? mapEducation(row["Education"], age),
        incomeRange: optionalUpperValue(String(row["Income Range"] ?? "0-5_LAKH"), [
          "0-5_LAKH",
          "5-10_LAKH",
          "10-15_LAKH",
          "15-20_LAKH",
          "20-25_LAKH",
          "ABOVE_25_LAKH",
        ] as const) ?? mapIncomeRange(row["Income Range"]),
        aadhaarNumber: normalizeText(row["Aadhaar Number"]) || undefined,
        familyGroupCode,
        includeInSurvey: true,
        dependentOnLandOwner:
          familyGroupCode === "F1"
            ? normalizeLoose(row["Dependent"]) === "dependent" || normalizeLoose(row["Dependent"]) === "yes"
            : false,
      }];
    });

    const familyCodes = [...new Set(persons.map((person) => person.familyGroupCode).filter(Boolean))];
    const familyBenefits: FamilyBenefitPayload[] = familyCodes.map((familyGroupCode) => {
      const benefitRow = groupRows.find((row) => (normalizeText(row["Family ID"]).toUpperCase() || "F1") === familyGroupCode);
      const benefitType =
        optionalUpperValue(String(benefitRow?.["Benefit Type"] ?? ""), ["INDIVIDUAL_PLOT", "LUMPSUM_AMOUNT"] as const) ??
        mapBenefitType(benefitRow?.["Benefit Type"]) ??
        (familyGroupCode === "F1" ? "INDIVIDUAL_PLOT" : "LUMPSUM_AMOUNT");

      return {
        familyGroupCode: familyGroupCode as "F1" | "F2" | "F3" | "F4" | "F5",
        benefitType,
      };
    });

    const firstStructureRow =
      groupRows.find((row) =>
        normalizeText(row["Structure Type"]) ||
        normalizeText(row["Built-up Area"]) ||
        normalizeText(row["Empty Plot Area"]) ||
        normalizeText(row["Construction Value"]) ||
        normalizeText(row["Land Value"]),
      ) ?? groupRows[0];

    const household: HouseholdPayload = {
        id: householdId,
        villageId: existingBundle?.villageId ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        houseId,
        linkedHouseIds:
          normalizeText(groupRows[0]?.["Linked House IDs"]) ||
          (linkedIds.length ? linkedIds.join(", ") : undefined),
        ownershipPattern:
          optionalUpperValue(String(groupRows[0]?.["Ownership Pattern"] ?? ""), [
            "SINGLE_HOUSE",
            "MULTIPLE_HOUSE_IDS",
            "HOUSE_AND_PLOT",
            "MULTIPLE_HOUSE_IDS_AND_PLOT",
          ] as const) ?? (hasMultipleHouseIds ? "MULTIPLE_HOUSE_IDS" : "SINGLE_HOUSE"),
        status: "DRAFT" as const,
        isLocked: false as const,
    };
    const landDetails: LandDetailsPayload = {
      builtUpAreaSqm: parseNumberOrZero(firstStructureRow?.["Built-up Area"]),
      openLandAreaSqm: parseNumberOrZero(firstStructureRow?.["Empty Plot Area"]),
      structureType: mapStructureType(firstStructureRow?.["Structure Type"]),
      cattleShedAvailable: normalizeLoose(firstStructureRow?.["Cattle Shed Available"]) === "yes" ? "YES" : "NO",
    };
    const valuation: ValuationPayload = {
      structureValue: parseNumberOrZero(firstStructureRow?.["Construction Value"]),
      landValue: parseNumberOrZero(firstStructureRow?.["Land Value"]),
      treeAssetValue: 0,
      shiftingAllowance: 0,
      subsistenceAllowance: 0,
      otherAssistance: 0,
    };
    const payload: CreateHouseholdBundleInput = {
      household,
      persons,
      familyBenefits,
      landDetails,
      valuation,
    };

    try {
      if (existingBundle) {
        await householdService.update(payload);
      } else {
        await householdService.create(payload);
      }

      importedHouseholds += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown import error";
      skippedHouseholds.push(`${houseId}: ${message}`);
    }
  }

  response.json({
    message: "Excel Imported Successfully",
    importedHouseholds,
    importedRows: rows.length,
    skippedHouseholds,
  });
});
