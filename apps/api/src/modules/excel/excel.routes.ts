import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { Router, type Response } from "express";
import multer from "multer";
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";
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
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet);

  const grouped = new Map<string, Record<string, string | number>[]>();
  rows.forEach((row) => {
    const houseId = String(row["House ID"] ?? "").trim();
    if (!houseId) return;
    grouped.set(houseId, [...(grouped.get(houseId) ?? []), row]);
  });

  let importedHouseholds = 0;

  for (const [houseId, groupRows] of grouped.entries()) {
    const householdId = randomUUID();
    const familyBenefits = new Map<string, "INDIVIDUAL_PLOT" | "LUMPSUM_AMOUNT">();

    groupRows.forEach((row) => {
      const familyGroupCode = String(row["Family ID"] ?? "F1").toUpperCase();
      const benefitType = String(row["Benefit Type"] ?? "").toUpperCase();

      if ((benefitType === "INDIVIDUAL_PLOT" || benefitType === "LUMPSUM_AMOUNT") && !familyBenefits.has(familyGroupCode)) {
        familyBenefits.set(familyGroupCode, benefitType);
      }
    });

    await householdService.create({
      household: {
        id: householdId,
        villageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        houseId,
        linkedHouseIds: String(groupRows[0]?.["Linked House IDs"] ?? "").trim() || undefined,
        ownershipPattern: optionalUpperValue(String(groupRows[0]?.["Ownership Pattern"] ?? "SINGLE_HOUSE"), [
          "SINGLE_HOUSE",
          "MULTIPLE_HOUSE_IDS",
          "HOUSE_AND_PLOT",
          "MULTIPLE_HOUSE_IDS_AND_PLOT",
        ] as const),
        status: "DRAFT",
        isLocked: false,
      },
      persons: groupRows.map((row) => ({
        id: randomUUID(),
        householdId,
        fullName: String(row["Name"] ?? ""),
        relationToLandOwner: String(row["Relation"] ?? "OTHER") as never,
        gender: (String(row["Gender"] ?? "OTHER").toUpperCase() as "MALE" | "FEMALE" | "OTHER"),
        age: row["Age"] ? Number(row["Age"]) : undefined,
        maritalStatus: optionalUpperValue(String(row["Marital Status"] ?? ""), [
          "MINOR",
          "UNMARRIED",
          "MARRIED",
          "WIDOWED",
          "DIVORCED",
        ] as const),
        marriageDate:
          ["UNMARRIED", "MINOR"].includes(String(row["Marital Status"] ?? "").toUpperCase())
            ? undefined
            : (String(row["Marriage Date"] ?? "") || undefined),
        religion: optionalUpperValue(String(row["Religion"] ?? "OTHER"), [
          "HINDU",
          "MUSLIM",
          "CHRISTIAN",
          "SIKH",
          "BUDDHIST",
          "JAIN",
          "OTHER",
        ] as const),
        casteCategory: optionalUpperValue(String(row["Category"] ?? "OTHERS"), [
          "GENERAL",
          "OBC",
          "SC",
          "ST",
          "OTHERS",
        ] as const),
        otherCasteCategoryDetail: String(row["Category Detail"] ?? "").trim() || undefined,
        occupation: optionalUpperValue(String(row["Occupation"] ?? "OTHER"), [
          "EMPLOYED",
          "AGRICULTURE",
          "HOUSE_WIFE",
          "BUSINESS",
          "STUDENT",
          "MINOR",
          "UNEMPLOYED",
          "OTHER",
        ] as const),
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
        ] as const),
        incomeRange: optionalUpperValue(String(row["Income Range"] ?? "0-5_LAKH"), [
          "0-5_LAKH",
          "5-10_LAKH",
          "10-15_LAKH",
          "15-20_LAKH",
          "20-25_LAKH",
          "ABOVE_25_LAKH",
        ] as const),
        aadhaarNumber: String(row["Aadhaar Number"] ?? "").trim() || undefined,
        familyGroupCode: String(row["Family ID"] ?? "F1").toUpperCase(),
        includeInSurvey: true,
        dependentOnLandOwner: String(row["Dependent"] ?? "NO").toUpperCase() === "YES",
      })),
      familyBenefits: [...familyBenefits.entries()].map(([familyGroupCode, benefitType]) => ({
        familyGroupCode: familyGroupCode as "F1" | "F2" | "F3" | "F4" | "F5",
        benefitType,
      })),
      landDetails: {
        builtUpAreaSqm: Number(groupRows[0]?.["Built-up Area"] ?? 0),
        openLandAreaSqm: Number(groupRows[0]?.["Empty Plot Area"] ?? 0),
        structureType: String(groupRows[0]?.["Structure Type"] ?? "") || undefined,
        cattleShedAvailable:
          String(groupRows[0]?.["Cattle Shed Available"] ?? "NO").toUpperCase() === "YES" ? "YES" : "NO",
      },
      valuation: {
        structureValue: Number(groupRows[0]?.["Construction Value"] ?? 0),
        landValue: Number(groupRows[0]?.["Land Value"] ?? 0),
        treeAssetValue: 0,
        shiftingAllowance: 0,
        subsistenceAllowance: 0,
        otherAssistance: 0,
      },
    });
    importedHouseholds += 1;
  }

  response.json({
    message: "Excel Imported Successfully",
    importedHouseholds,
    importedRows: rows.length,
  });
});
