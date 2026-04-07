import { API_BASE_URL } from "../api/client";

interface ReportsPageProps {
  canDownload: boolean;
}

const familyReports = [
  { code: "F1", title: "F1 Family Details", description: "Primary family member details and linked household records." },
  { code: "F2", title: "F2 Family Details", description: "Family 2 details across all surveyed households." },
  { code: "F3", title: "F3 Family Details", description: "Family 3 details across all surveyed households." },
  { code: "F4", title: "F4 Family Details", description: "Family 4 details across all surveyed households." },
  { code: "F5", title: "F5 Family Details", description: "Family 5 details across all surveyed households." },
];

const analyticsReports = [
  { type: "INCOME", title: "Income Classification", description: "Income range summary based on surveyed members." },
  { type: "CATEGORY", title: "Caste Distribution", description: "Category-wise family member distribution report." },
  { type: "OCCUPATION", title: "Occupation Distribution", description: "Occupation-wise family member distribution report." },
];

function DownloadButtons({ basePath, canDownload }: { basePath: string; canDownload: boolean }) {
  if (!canDownload) {
    return (
      <div className="report-actions">
        <button type="button" className="secondary-btn is-disabled" disabled>CSV</button>
        <button type="button" className="secondary-btn is-disabled" disabled>PDF</button>
        <button type="button" className="secondary-btn is-disabled" disabled>Excel</button>
      </div>
    );
  }

  return (
    <div className="report-actions">
      <a className="secondary-btn" href={`${basePath}/download-csv`}>CSV</a>
      <a className="secondary-btn" href={`${basePath}/download-pdf`}>PDF</a>
      <a className="secondary-btn" href={`${basePath}/export-excel`}>Excel</a>
    </div>
  );
}

export function ReportsPage({ canDownload }: ReportsPageProps) {
  return (
    <section className="panel reports-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Reports Menu</p>
          <h2>Download Family and Analytics Reports</h2>
          <p className="muted">Export family-group details, lumpsum-family details, and analytics summaries from one place.</p>
        </div>
      </div>

      <div className="reports-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Family Reports</p>
            <h3>F1 to F5 Family Details</h3>
          </div>
        </div>
        <div className="reports-grid">
          {familyReports.map((report) => (
            <article key={report.code} className="review-card report-card">
              <div>
                <h4>{report.title}</h4>
                <p className="muted">{report.description}</p>
              </div>
              <DownloadButtons basePath={`${API_BASE_URL}/reports/family/${report.code}`} canDownload={canDownload} />
            </article>
          ))}
        </div>
      </div>

      <div className="reports-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Benefit Reports</p>
            <h3>Families Opted for Lumpsum Amount</h3>
          </div>
        </div>
        <div className="reports-grid">
          <article className="review-card report-card">
            <div>
              <h4>Lumpsum Amount Families</h4>
              <p className="muted">Detailed report for all families opted for lumpsum amount.</p>
            </div>
            <DownloadButtons basePath={`${API_BASE_URL}/reports/benefit/LUMPSUM_AMOUNT`} canDownload={canDownload} />
          </article>
          <article className="review-card report-card">
            <div>
              <h4>Individual Plot Families</h4>
              <p className="muted">Detailed report for all families opted for individual plots.</p>
            </div>
            <DownloadButtons basePath={`${API_BASE_URL}/reports/benefit/INDIVIDUAL_PLOT`} canDownload={canDownload} />
          </article>
        </div>
      </div>

      <div className="reports-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Analytics Reports</p>
            <h3>Income, Category, and Occupation Downloads</h3>
          </div>
        </div>
        <div className="reports-grid">
          {analyticsReports.map((report) => (
            <article key={report.type} className="review-card report-card">
              <div>
                <h4>{report.title}</h4>
                <p className="muted">{report.description}</p>
              </div>
              <DownloadButtons basePath={`${API_BASE_URL}/reports/distribution/${report.type}`} canDownload={canDownload} />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
