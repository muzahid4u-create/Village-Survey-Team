import type { CSSProperties } from "react";
import type { HouseholdBundle } from "@marda/shared";

interface DashboardPageProps {
  households: HouseholdBundle[];
}

function buildCounts(households: HouseholdBundle[], key: "casteCategory" | "occupation" | "incomeRange") {
  return households.reduce<Record<string, number>>((counts, household) => {
    household.persons
      .filter((person) => person.includeInSurvey !== false && person[key])
      .forEach((person) => {
        const value = person[key] as string;
        counts[value] = (counts[value] ?? 0) + 1;
      });

    return counts;
  }, {});
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function DashboardPage({ households }: DashboardPageProps) {
  const includedPersons = households.flatMap((household) =>
    household.persons.filter((person) => person.includeInSurvey !== false),
  );
  const noFamilyProperties = households.filter((household) => household.household.hasResidentFamily === false);
  const totalFamilies = households.reduce((sum, household) => sum + household.familyGroups.length, 0);
  const totalPersons = includedPersons.length;
  const male = includedPersons.filter((person) => person.gender === "MALE").length;
  const female = includedPersons.filter((person) => person.gender === "FEMALE").length;
  const other = includedPersons.filter((person) => person.gender === "OTHER" || !person.gender).length;
  const totalPlotFamilies = households.reduce(
    (sum, household) =>
      sum + household.familyGroups.filter((familyGroup) => familyGroup.benefitType === "INDIVIDUAL_PLOT").length,
    0,
  );
  const totalLumpsumFamilies = households.reduce(
    (sum, household) =>
      sum + household.familyGroups.filter((familyGroup) => familyGroup.benefitType === "LUMPSUM_AMOUNT").length,
    0,
  );
  const totalLandCompensation = households.reduce(
    (sum, household) => sum + (household.valuation?.landValue ?? 0),
    0,
  );
  const totalCattleSheds = households.filter(
    (household) => household.landDetails?.cattleShedAvailable === "YES",
  ).length;
  const emptyPlotCount = households.filter((household) => household.household.surveyPropertyType === "EMPTY_PLOT").length;
  const temporaryStructureCount = households.filter(
    (household) => household.household.surveyPropertyType === "TEMPORARY_STRUCTURE",
  ).length;
  const shopCount = households.filter((household) => household.household.surveyPropertyType === "SHOP").length;
  const totalStructureCompensation = households.reduce(
    (sum, household) => sum + (household.valuation?.structureValue ?? 0),
    0,
  );
  const plotShare = totalFamilies > 0 ? Math.round((totalPlotFamilies / totalFamilies) * 100) : 0;
  const maxCompensation = Math.max(totalLandCompensation, totalStructureCompensation, 1);
  const genderTotal = Math.max(male + female + other, 1);
  const maleShare = Math.round((male / genderTotal) * 100);
  const topHouseholds = [...households]
    .map((household) => ({
      houseId: household.household.houseId,
      families: household.familyGroups.length,
      persons: household.persons.filter((person) => person.includeInSurvey !== false).length,
    }))
    .sort((left, right) => right.families - left.families || right.persons - left.persons)
    .slice(0, 5);
  const maxHouseholdFamilies = Math.max(...topHouseholds.map((item) => item.families), 1);

  const categoryCounts = Object.entries(buildCounts(households, "casteCategory")).sort((left, right) => right[1] - left[1]);
  const occupationCounts = Object.entries(buildCounts(households, "occupation")).sort((left, right) => right[1] - left[1]);
  const incomeCounts = Object.entries(buildCounts(households, "incomeRange")).sort((left, right) => right[1] - left[1]);
  const maxCategory = Math.max(...categoryCounts.map(([, count]) => count), 1);
  const maxOccupation = Math.max(...occupationCounts.map(([, count]) => count), 1);
  const maxIncome = Math.max(...incomeCounts.map(([, count]) => count), 1);

  return (
    <section className="panel dashboard-panel">
      <div className="section-head dashboard-head">
        <div>
          <p className="eyebrow">Village Dashboard</p>
          <h2>Survey Operations Overview</h2>
          <p className="dashboard-subtitle">Plan, verify, classify, and export Marda village rehabilitation data from one screen.</p>
        </div>
        <div className="dashboard-actions">
          <a className="primary-btn" href="http://localhost:4000/api/download-csv">Download CSV</a>
          <a className="secondary-btn" href="http://localhost:4000/api/import-template">Import Template</a>
        </div>
      </div>

      <div className="stats-grid stats-grid-5">
        <article className="stat-card stat-card-featured">
          <span>Total Households Surveyed</span>
          <strong>{households.length}</strong>
          <small>Village: Marda</small>
        </article>
        <article className="stat-card">
          <span>Total Families (F1-F5)</span>
          <strong>{totalFamilies}</strong>
        </article>
        <article className="stat-card">
          <span>Population</span>
          <div className="population-breakdown">
            <span className="population-pill">
              <span className="population-icon">👨</span>
              <span>Male: {male}</span>
            </span>
            <span className="population-pill">
              <span className="population-icon">👩</span>
              <span>Female: {female}</span>
            </span>
          </div>
        </article>
        <article className="stat-card">
          <span>Total Persons</span>
          <strong>{totalPersons}</strong>
        </article>
        <article className="stat-card">
          <span>Cattle Sheds</span>
          <strong>{totalCattleSheds}</strong>
          <small>Households marked Yes</small>
        </article>
      </div>

      <div className="analytics-grid analytics-grid-wide">
        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Property-only Survey Records</p>
              <h3>Properties With No Resident Family</h3>
            </div>
            <p className="muted">Counted in household survey, but no families are attached</p>
          </div>
          <div className="chart-legend">
            <p><span className="legend-swatch legend-total" /> Total No-family Properties: {noFamilyProperties.length}</p>
            <p><span className="legend-swatch legend-plot" /> Empty Plots: {emptyPlotCount}</p>
            <p><span className="legend-swatch legend-lumpsum" /> Temporary Structures: {temporaryStructureCount}</p>
            <p><span className="legend-swatch legend-other" /> Shops: {shopCount}</p>
          </div>
        </article>

        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Property Type Graph</p>
              <h3>Empty Plot / Shop / Temporary Structure</h3>
            </div>
            <p className="muted">Non-residential and no-family property records</p>
          </div>
          <div className="bar-chart">
            {[
              { label: "Empty Plot", count: emptyPlotCount },
              { label: "Temporary Structure", count: temporaryStructureCount },
              { label: "Shop", count: shopCount },
            ].map((item) => {
              const maxPropertyCount = Math.max(emptyPlotCount, temporaryStructureCount, shopCount, 1);

              return (
                <div key={item.label} className="bar-row">
                  <div className="bar-meta">
                    <strong>{item.label}</strong>
                    <span>{item.count}</span>
                  </div>
                  <div className="bar-track household-track">
                    <div className="bar-fill household-fill" style={{ width: `${(item.count / maxPropertyCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="analytics-grid analytics-grid-wide">
        <article className="review-card analytics-card analytics-card-emphasis">
          <div className="section-head">
            <div>
              <p className="eyebrow">Benefit Mix</p>
              <h3>Plots vs Lumpsum</h3>
            </div>
            <p className="muted">Village: Marda</p>
          </div>
          <div className="benefit-visual">
            <div className="pie-chart" style={{ "--plot-share": `${plotShare}%` } as CSSProperties}>
              <span>{plotShare}% Plot</span>
            </div>
            <div className="chart-legend">
              <p><span className="legend-swatch legend-plot" /> Plot Families: {totalPlotFamilies}</p>
              <p><span className="legend-swatch legend-lumpsum" /> Lumpsum Families: {totalLumpsumFamilies}</p>
              <p><span className="legend-swatch legend-total" /> Total Families: {totalFamilies}</p>
            </div>
          </div>
        </article>

        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Compensation</p>
              <h3>Plot vs Structure Value</h3>
            </div>
            <p className="muted">Amounts in INR</p>
          </div>
          <div className="bar-chart">
            <div className="bar-row">
              <div className="bar-meta">
                <strong>Plot / Land</strong>
                <span>Rs {totalLandCompensation.toLocaleString("en-IN")}</span>
              </div>
              <div className="bar-track compensation-track">
                <div className="bar-fill compensation-land" style={{ width: `${(totalLandCompensation / maxCompensation) * 100}%` }} />
              </div>
            </div>
            <div className="bar-row">
              <div className="bar-meta">
                <strong>Structure</strong>
                <span>Rs {totalStructureCompensation.toLocaleString("en-IN")}</span>
              </div>
              <div className="bar-track compensation-track">
                <div className="bar-fill compensation-structure" style={{ width: `${(totalStructureCompensation / maxCompensation) * 100}%` }} />
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className="analytics-grid analytics-grid-wide">
        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Population Mix</p>
              <h3>Male vs Female Pie</h3>
            </div>
            <p className="muted">Total population: {totalPersons}</p>
          </div>
          <div className="benefit-visual">
            <div className="pie-chart pie-chart-gender" style={{ "--plot-share": `${maleShare}%` } as CSSProperties}>
              <span>{maleShare}% Male</span>
            </div>
            <div className="chart-legend">
              <p><span className="legend-swatch legend-male" /> Male: {male}</p>
              <p><span className="legend-swatch legend-female" /> Female: {female}</p>
              <p><span className="legend-swatch legend-other" /> Other: {other}</p>
            </div>
          </div>
        </article>

        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Household Graph</p>
              <h3>Families per Household</h3>
            </div>
            <p className="muted">Top surveyed households</p>
          </div>
          <div className="bar-chart">
            {topHouseholds.map((item) => (
              <div key={item.houseId} className="bar-row">
                <div className="bar-meta">
                  <strong>{item.houseId}</strong>
                  <span>{item.families} families · {item.persons} persons</span>
                </div>
                <div className="bar-track household-track">
                  <div className="bar-fill household-fill" style={{ width: `${(item.families / maxHouseholdFamilies) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      <div className="analytics-grid">
        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Category</p>
              <h3>Caste Distribution</h3>
            </div>
            <p className="muted">Surveyed members only</p>
          </div>
          <div className="mini-bars">
            {categoryCounts.map(([label, count]) => (
              <div key={label} className="mini-bar-row">
                <span>{formatLabel(label)}</span>
                <div className="mini-bar-track">
                  <div className="mini-bar-fill category-fill" style={{ width: `${(count / maxCategory) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Occupation</p>
              <h3>Occupation Distribution</h3>
            </div>
            <p className="muted">Surveyed members only</p>
          </div>
          <div className="mini-bars">
            {occupationCounts.map(([label, count]) => (
              <div key={label} className="mini-bar-row">
                <span>{formatLabel(label)}</span>
                <div className="mini-bar-track">
                  <div className="mini-bar-fill occupation-fill" style={{ width: `${(count / maxOccupation) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="review-card analytics-card">
          <div className="section-head">
            <div>
              <p className="eyebrow">Income</p>
              <h3>Income Range Distribution</h3>
            </div>
            <p className="muted">Surveyed members only</p>
          </div>
          <div className="mini-bars">
            {incomeCounts.map(([label, count]) => (
              <div key={label} className="mini-bar-row">
                <span>{formatLabel(label)}</span>
                <div className="mini-bar-track">
                  <div className="mini-bar-fill income-fill" style={{ width: `${(count / maxIncome) * 100}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
