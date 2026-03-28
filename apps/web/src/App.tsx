import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { sampleHouseholdBundle, type HouseholdBundle } from "@marda/shared";
import { deleteHousehold, fetchHouseholds, importExcel } from "./api/client";
import { DashboardPage } from "./pages/DashboardPage";
import { HouseholdEntryPage } from "./pages/HouseholdEntryPage";
import { HouseholdReviewPage } from "./pages/HouseholdReviewPage";

export default function App() {
  const [activeSection, setActiveSection] = useState<"dashboard" | "households" | "add_survey" | "bulk_upload" | "reports">("dashboard");
  const [households, setHouseholds] = useState<HouseholdBundle[]>([sampleHouseholdBundle]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(sampleHouseholdBundle.household.id);
  const [editingHousehold, setEditingHousehold] = useState<HouseholdBundle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkUploadMessage, setBulkUploadMessage] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);

  useEffect(() => {
    fetchHouseholds().then(setHouseholds).catch(() => {
      setHouseholds([sampleHouseholdBundle]);
    });
  }, []);

  const filteredHouseholds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return households;

    return households.filter((household) => {
      const householdMatches =
        household.household.houseId.toLowerCase().includes(query) ||
        (household.household.surveyNumber ?? "").toLowerCase().includes(query) ||
        (household.household.locality ?? "").toLowerCase().includes(query);

      const familyMatches = household.familyGroups.some(
        (group) =>
          group.familyGroupCode.toLowerCase().includes(query) ||
          (group.benefitType ?? "").toLowerCase().includes(query),
      );

      const personMatches = household.persons.some((person) =>
        [
          person.fullName,
          person.relationToLandOwner,
          person.gender,
          person.religion,
          person.casteCategory,
          person.occupation,
          person.education,
          person.familyGroupCode,
          person.mobileNumber,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query)),
      );

      return householdMatches || familyMatches || personMatches;
    });
  }, [households, searchQuery]);

  const activeHousehold =
    filteredHouseholds.find((household) => household.household.id === selectedHouseholdId) ?? filteredHouseholds[0];

  useEffect(() => {
    if (activeHousehold && activeHousehold.household.id !== selectedHouseholdId) {
      setSelectedHouseholdId(activeHousehold.household.id);
    }
  }, [activeHousehold, selectedHouseholdId]);

  async function refreshHouseholds() {
    const next = await fetchHouseholds();
    setHouseholds(next);
    if (next[0] && !next.some((item) => item.household.id === selectedHouseholdId)) {
      setSelectedHouseholdId(next[0].household.id);
    }
  }

  async function handleImportChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkUploading(true);
    setBulkUploadError("");
    setBulkUploadMessage("");

    try {
      const result = await importExcel(file);
      await refreshHouseholds();
      setActiveSection("bulk_upload");
      setBulkUploadMessage(
        `Bulk upload complete. Imported ${result.importedHouseholds ?? 0} household(s) and ${result.importedRows ?? 0} row(s).`,
      );
    } catch (error) {
      setBulkUploadError(error instanceof Error ? error.message : "Bulk upload failed");
    } finally {
      setBulkUploading(false);
    }

    event.target.value = "";
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/coal-india-1.png" alt="Coal India Limited" className="sidebar-logo" />
        </div>
        <p className="eyebrow sidebar-brand-title">WCL R&amp;R Survey</p>
        <p className="muted sidebar-brand-subtitle">Coal India Limited</p>
        <nav className="sidebar-menu">
          <span className="sidebar-label">Menu</span>
          <button type="button" className={`sidebar-link${activeSection === "dashboard" ? " is-active" : ""}`} onClick={() => setActiveSection("dashboard")}>
            Dashboard
          </button>
          <button type="button" className={`sidebar-link${activeSection === "households" ? " is-active" : ""}`} onClick={() => setActiveSection("households")}>
            Households
          </button>
          <button
            type="button"
            className={`sidebar-link${activeSection === "add_survey" ? " is-active" : ""}`}
            onClick={() => {
              setEditingHousehold(null);
              setActiveSection("add_survey");
            }}
          >
            Add Survey
          </button>
          <button type="button" className={`sidebar-link${activeSection === "bulk_upload" ? " is-active" : ""}`} onClick={() => setActiveSection("bulk_upload")}>
            Bulk Upload
          </button>
          <button type="button" className={`sidebar-link${activeSection === "reports" ? " is-active" : ""}`} onClick={() => setActiveSection("reports")}>
            Reports
          </button>
          <span className="sidebar-label">Downloads</span>
          <label className="sidebar-link sidebar-file">
            Import Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleImportChange} />
          </label>
          <a className="sidebar-link" href="http://localhost:4000/api/import-template">
            Download Import Template
          </a>
          <a className="sidebar-link" href="http://localhost:4000/api/download-csv">
            Download CSV
          </a>
          <a className="sidebar-link" href="http://localhost:4000/api/download-pdf">
            Download PDF
          </a>
          <a className="sidebar-link" href="http://localhost:4000/api/export-excel">
            Export Excel
          </a>
        </nav>
        <div className="legal-note">
          <p>
            Marda village is located in Warora Tahsil, Chandrapur District, Maharashtra.
          </p>
          <p>
            Marda village land was acquired under the Coal Bearing Areas (Acquisition and Development) Act, 1957
            vide SO No. 719 dated 27/08/2020.
          </p>
          <p>
            The notification was published in the Official Gazette of India on 29/08/2020 for the
            Amalgamated Yekona-I &amp; II OC Mine.
          </p>
        </div>
        <h1>Marda Village Rehabilitation &amp; Resettlement (R&amp;R) Survey</h1>
        <p className="muted">Amalgamated Yekona-I &amp; II OC Mine, WCL</p>
        <div className="sidebar-block">
          <span className="badge">F1 to F5 grouping</span>
          <span className="badge">Excel template included</span>
          <span className="badge">CSV and PDF downloads ready</span>
          <span className="badge">Excel export ready</span>
        </div>
        <div className="sidebar-promo">
          <p className="eyebrow">Field Ready</p>
          <strong>Village Survey Console</strong>
          <p>Capture households, classify families, and export reports directly from Marda field data.</p>
        </div>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-search">
            <span className="topbar-search-icon">⌕</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search households, family groups, or members"
            />
          </div>
          <div className="topbar-search-status">
            {searchQuery.trim() ? `${filteredHouseholds.length} result(s)` : `${households.length} households loaded`}
          </div>
          <div className="topbar-actions">
            <a className="topbar-btn topbar-btn-primary" href="http://localhost:4000/api/download-csv">
              Download CSV
            </a>
            <a className="topbar-btn" href="http://localhost:4000/api/download-pdf">
              Download PDF
            </a>
            <a className="topbar-btn" href="http://localhost:4000/api/export-excel">
              Export Excel
            </a>
            <div className="topbar-user">
              <div className="topbar-avatar">RR</div>
              <div>
                <strong>Village Survey Team</strong>
                <span>Marda, WCL</span>
              </div>
            </div>
          </div>
        </header>

        <div className="content">
        {activeSection === "bulk_upload" ? (
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Bulk Upload</p>
                <h2>Upload Household Data in Excel</h2>
                <p className="muted">Use the import template, prepare all households in one sheet, and upload them in a single step.</p>
              </div>
              <div className="dashboard-actions">
                <a className="secondary-btn" href="http://localhost:4000/api/import-template">
                  Download Template
                </a>
              </div>
            </div>

            <div className="bulk-upload-panel">
              <div className="bulk-upload-card">
                <strong>Excel Bulk Upload</strong>
                <p>Upload `.xlsx` or `.xls` files containing multiple households, members, structure details, and family benefits.</p>
                <label className="primary-btn bulk-upload-button">
                  {bulkUploading ? "Uploading..." : "Choose Excel File"}
                  <input type="file" accept=".xlsx,.xls" onChange={handleImportChange} disabled={bulkUploading} />
                </label>
              </div>
              <div className="bulk-upload-card">
                <strong>Required Format</strong>
                <p>Use the template exactly, including house ID, member details, family ID, structure type, cattle shed, and valuation columns.</p>
                <a className="topbar-btn" href="http://localhost:4000/api/export-excel">
                  View Sample Export
                </a>
              </div>
            </div>

            {bulkUploadMessage ? <p className="success-text">{bulkUploadMessage}</p> : null}
            {bulkUploadError ? <p className="error-text">{bulkUploadError}</p> : null}
          </section>
        ) : null}
        {activeSection === "add_survey" ? (
          <HouseholdEntryPage
            editingHousehold={editingHousehold}
            onCancelEdit={() => setEditingHousehold(null)}
            onCreated={(bundle) => {
              setHouseholds((current) => [bundle, ...current.filter((item) => item.household.id !== bundle.household.id)]);
              setSelectedHouseholdId(bundle.household.id);
              setEditingHousehold(null);
              setActiveSection("households");
            }}
          />
        ) : null}
        {activeSection === "dashboard" || activeSection === "reports" ? <DashboardPage households={filteredHouseholds} /> : null}
        {(activeSection === "households" || activeSection === "dashboard" || activeSection === "reports") && activeHousehold ? (
          <HouseholdReviewPage
            household={activeHousehold}
            onSelectHousehold={setSelectedHouseholdId}
            households={filteredHouseholds}
            onEditHousehold={(bundle) => {
              setEditingHousehold(bundle);
              setActiveSection("add_survey");
            }}
            onDeleteHousehold={async (bundle) => {
              await deleteHousehold(bundle.household.id);
              setHouseholds((current) => {
                const next = current.filter((item) => item.household.id !== bundle.household.id);
                setSelectedHouseholdId((currentSelected) =>
                  currentSelected === bundle.household.id ? next[0]?.household.id ?? "" : currentSelected,
                );
                return next;
              });
              setEditingHousehold(null);
            }}
          />
        ) : (
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Search Results</p>
                <h2>No Matching Households</h2>
              </div>
              <p className="muted">Try searching by house ID, member name, family group, relation, or locality.</p>
            </div>
          </section>
        )}
        </div>
      </div>
    </main>
  );
}
