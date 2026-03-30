import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { sampleHouseholdBundle, type HouseholdBundle } from "@marda/shared";
import { API_BASE_URL, deleteHousehold, fetchHouseholds, importExcel } from "./api/client";
import { DashboardPage } from "./pages/DashboardPage";
import { HouseholdEntryPage } from "./pages/HouseholdEntryPage";
import { HouseholdReviewPage } from "./pages/HouseholdReviewPage";

type UserRole = "SUPER_ADMIN" | "ADMIN";
type ActiveSection = "dashboard" | "households" | "add_survey" | "bulk_upload" | "reports";

interface SessionUser {
  loginId: string;
  role: UserRole;
  displayName: string;
}

const AUTH_STORAGE_KEY = "marda-rr-auth";
const LOGIN_CREDENTIALS: Record<string, { password: string; role: UserRole; displayName: string }> = {
  superadmin: {
    password: "SuperAdmin@123",
    role: "SUPER_ADMIN",
    displayName: "Super Admin",
  },
  admin: {
    password: "Admin@123",
    role: "ADMIN",
    displayName: "Admin",
  },
};

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>("dashboard");
  const [households, setHouseholds] = useState<HouseholdBundle[]>([sampleHouseholdBundle]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState(sampleHouseholdBundle.household.id);
  const [editingHousehold, setEditingHousehold] = useState<HouseholdBundle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bulkUploadMessage, setBulkUploadMessage] = useState("");
  const [bulkUploadError, setBulkUploadError] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(() => {
    const saved = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return saved ? (JSON.parse(saved) as SessionUser) : null;
  });
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    fetchHouseholds().then(setHouseholds).catch(() => {
      setHouseholds([sampleHouseholdBundle]);
    });
  }, []);

  const canDownload = sessionUser?.role === "SUPER_ADMIN";
  const canDelete = sessionUser?.role === "SUPER_ADMIN";

  function persistSession(nextUser: SessionUser | null) {
    setSessionUser(nextUser);
    if (nextUser) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextUser));
    } else {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  }

  function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedLogin = loginId.trim().toLowerCase();
    const credential = LOGIN_CREDENTIALS[normalizedLogin];

    if (!credential || credential.password !== password) {
      setLoginError("Invalid login ID or password.");
      return;
    }

    persistSession({
      loginId: normalizedLogin,
      role: credential.role,
      displayName: credential.displayName,
    });
    setLoginError("");
    setPassword("");
  }

  function handleLogout() {
    persistSession(null);
    setLoginId("");
    setPassword("");
    setLoginError("");
  }

  const filteredHouseholds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return households;

    return households.filter((household) => {
      const householdMatches =
        household.household.houseId.toLowerCase().includes(query) ||
        (household.household.surveyNumber ?? "").toLowerCase().includes(query) ||
        (household.household.locality ?? "").toLowerCase().includes(query) ||
        (household.household.linkedHouseIds ?? "").toLowerCase().includes(query) ||
        (household.household.ownershipPattern ?? "").toLowerCase().includes(query);

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
          person.otherCasteCategoryDetail,
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
  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    if (activeHousehold && activeHousehold.household.id !== selectedHouseholdId) {
      setSelectedHouseholdId(activeHousehold.household.id);
    }
  }, [activeHousehold, selectedHouseholdId]);

  useEffect(() => {
    if (isSearching && activeSection !== "add_survey" && activeSection !== "bulk_upload") {
      setActiveSection("households");
    }
  }, [activeSection, isSearching]);

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

  if (!sessionUser) {
    return (
      <main className="login-shell">
        <section className="login-card">
          <div className="login-brand">
            <img src="/coal-india-1.png" alt="Coal India Limited" className="login-logo" />
            <div>
              <p className="eyebrow">WCL R&amp;R Survey</p>
              <h1>Marda Village Rehabilitation &amp; Resettlement Survey</h1>
              <p className="muted">Coal India Limited · Amalgamated Yekona-I &amp; II OC Mine</p>
            </div>
          </div>

          <form className="login-form" onSubmit={handleLoginSubmit}>
            <div className="login-field">
              <label htmlFor="login-id">Login ID</label>
              <input id="login-id" value={loginId} onChange={(event) => setLoginId(event.target.value)} placeholder="Enter login ID" />
            </div>
            <div className="login-field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
              />
            </div>
            {loginError ? <p className="error-text">{loginError}</p> : null}
            <button type="submit" className="primary-btn login-submit">
              Sign In
            </button>
          </form>
        </section>
      </main>
    );
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
          {canDownload ? (
            <a className="sidebar-link" href={`${API_BASE_URL}/import-template`}>
              Download Import Template
            </a>
          ) : (
            <button type="button" className="sidebar-link is-disabled" disabled>
              Download Import Template
            </button>
          )}
          {canDownload ? (
            <a className="sidebar-link" href={`${API_BASE_URL}/download-csv`}>
              Download CSV
            </a>
          ) : (
            <button type="button" className="sidebar-link is-disabled" disabled>
              Download CSV
            </button>
          )}
          {canDownload ? (
            <a className="sidebar-link" href={`${API_BASE_URL}/download-pdf`}>
              Download PDF
            </a>
          ) : (
            <button type="button" className="sidebar-link is-disabled" disabled>
              Download PDF
            </button>
          )}
          {canDownload ? (
            <a className="sidebar-link" href={`${API_BASE_URL}/export-excel`}>
              Export Excel
            </a>
          ) : (
            <button type="button" className="sidebar-link is-disabled" disabled>
              Export Excel
            </button>
          )}
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
        {sessionUser.role === "ADMIN" ? (
          <div className="legal-note">
            <p>Admin access supports viewing and survey entry.</p>
            <p>Downloads and Remove actions are available only for Super Admin.</p>
          </div>
        ) : null}
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
            {canDownload ? (
              <a className="topbar-btn topbar-btn-primary" href={`${API_BASE_URL}/download-csv`}>
                Download CSV
              </a>
            ) : (
              <button type="button" className="topbar-btn topbar-btn-primary is-disabled" disabled>
                Download CSV
              </button>
            )}
            {canDownload ? (
              <a className="topbar-btn" href={`${API_BASE_URL}/download-pdf`}>
                Download PDF
              </a>
            ) : (
              <button type="button" className="topbar-btn is-disabled" disabled>
                Download PDF
              </button>
            )}
            {canDownload ? (
              <a className="topbar-btn" href={`${API_BASE_URL}/export-excel`}>
                Export Excel
              </a>
            ) : (
              <button type="button" className="topbar-btn is-disabled" disabled>
                Export Excel
              </button>
            )}
            <div className="topbar-user">
              <div className="topbar-avatar">RR</div>
              <div>
                <strong>{sessionUser.displayName}</strong>
                <span>{sessionUser.role === "SUPER_ADMIN" ? "Super Admin Access" : "Admin Access"}</span>
              </div>
            </div>
            <button type="button" className="ghost-btn" onClick={handleLogout}>
              Logout
            </button>
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
                {canDownload ? (
                  <a className="secondary-btn" href={`${API_BASE_URL}/import-template`}>
                    Download Template
                  </a>
                ) : (
                  <button type="button" className="secondary-btn is-disabled" disabled>
                    Download Template
                  </button>
                )}
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
                {canDownload ? (
                  <a className="topbar-btn" href={`${API_BASE_URL}/export-excel`}>
                    View Sample Export
                  </a>
                ) : (
                  <button type="button" className="topbar-btn is-disabled" disabled>
                    View Sample Export
                  </button>
                )}
              </div>
            </div>

            {bulkUploadMessage ? <p className="success-text">{bulkUploadMessage}</p> : null}
            {bulkUploadError ? <p className="error-text">{bulkUploadError}</p> : null}
          </section>
        ) : null}
        {activeSection === "add_survey" ? (
          <HouseholdEntryPage
            canDelete={canDelete}
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
        {activeSection === "dashboard" || activeSection === "reports" ? <DashboardPage households={filteredHouseholds} canDownload={canDownload} /> : null}
        {isSearching && filteredHouseholds.length > 0 ? (
          <section className="panel">
            <div className="section-head">
              <div>
                <p className="eyebrow">Search Results</p>
                <h2>Matching Households</h2>
              </div>
              <p className="muted">Select a result below to open that household directly.</p>
            </div>
            <div className="search-result-grid">
              {filteredHouseholds.map((item) => {
                const ownerName =
                  item.persons.find((person) => person.relationToLandOwner === "PRIMARY_LAND_OWNER")?.fullName ??
                  "Owner missing";

                return (
                  <button
                    key={item.household.id}
                    type="button"
                    className={`search-result-card${activeHousehold?.household.id === item.household.id ? " is-active" : ""}`}
                    onClick={() => {
                      setSelectedHouseholdId(item.household.id);
                      setActiveSection("households");
                    }}
                  >
                    <strong>{item.household.houseId}</strong>
                    <span>{ownerName}</span>
                    <small>
                      {item.household.locality ?? "Locality not entered"} · {item.persons.filter((person) => person.includeInSurvey !== false).length} members
                    </small>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
        {(activeSection === "households" || activeSection === "dashboard" || activeSection === "reports") && activeHousehold ? (
          <HouseholdReviewPage
            household={activeHousehold}
            onSelectHousehold={setSelectedHouseholdId}
            households={filteredHouseholds}
            canDelete={canDelete}
            canDownload={canDownload}
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
