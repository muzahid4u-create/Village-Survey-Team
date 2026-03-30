import { useMemo, useState } from "react";
import type { HouseholdBundle } from "@marda/shared";
import { API_BASE_URL } from "../api/client";

interface HouseholdReviewPageProps {
  household: HouseholdBundle;
  households: HouseholdBundle[];
  onSelectHousehold(id: string): void;
  onEditHousehold(bundle: HouseholdBundle): void;
  onDeleteHousehold(bundle: HouseholdBundle): Promise<void>;
  canDelete: boolean;
  canDownload: boolean;
}

export function HouseholdReviewPage({
  household,
  households,
  onSelectHousehold,
  onEditHousehold,
  onDeleteHousehold,
  canDelete,
  canDownload,
}: HouseholdReviewPageProps) {
  function formatValue(value?: string | number | boolean | null) {
    if (value === undefined || value === null || value === "") {
      return "Not entered";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    return String(value).replaceAll("_", " ");
  }

  const primaryOwner =
    household.persons.find((person) => person.relationToLandOwner === "PRIMARY_LAND_OWNER")?.fullName ??
    "Primary owner not entered";
  const excludedMembers = household.persons.filter((person) => person.finalFamilyStatus === "EXCLUDED");
  const [selectedFamilyId, setSelectedFamilyId] = useState(household.familyGroups[0]?.id ?? "");

  const selectedFamily = useMemo(
    () => household.familyGroups.find((group) => group.id === selectedFamilyId) ?? household.familyGroups[0],
    [household.familyGroups, selectedFamilyId],
  );

  const selectedFamilyMembers = useMemo(() => {
    if (!selectedFamily) return [];
    return household.persons.filter((person) => selectedFamily.memberIds.includes(person.id));
  }, [household.persons, selectedFamily]);

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Review Household</p>
          <h2>{household.household.houseId}</h2>
        </div>
        <div className="household-picker">
          <span className="muted">{primaryOwner}</span>
          <select value={household.household.id} onChange={(event) => onSelectHousehold(event.target.value)}>
            {households.map((item) => (
              <option key={item.household.id} value={item.household.id}>
                {item.household.houseId} · {item.persons.find((person) => person.relationToLandOwner === "PRIMARY_LAND_OWNER")?.fullName ?? "Owner missing"}
              </option>
            ))}
          </select>
          {canDownload ? (
            <a className="ghost-btn" href={`${API_BASE_URL}/household/${household.household.id}/download-csv`}>
              Download CSV
            </a>
          ) : (
            <button type="button" className="ghost-btn is-disabled" disabled>
              Download CSV
            </button>
          )}
          {canDownload ? (
            <a className="ghost-btn" href={`${API_BASE_URL}/household/${household.household.id}/download-pdf`}>
              Download PDF
            </a>
          ) : (
            <button type="button" className="ghost-btn is-disabled" disabled>
              Download PDF
            </button>
          )}
          <button type="button" className="ghost-btn" onClick={() => onEditHousehold(household)}>
            Edit
          </button>
          {canDelete ? (
            <button type="button" className="ghost-btn" onClick={() => void onDeleteHousehold(household)}>
              Remove
            </button>
          ) : (
            <button type="button" className="ghost-btn is-disabled" disabled>
              Remove (Super Admin Only)
            </button>
          )}
        </div>
      </div>
      {!canDelete ? <p className="muted permission-note">Remove is available only for Super Admin login.</p> : null}

      <div className="review-grid">
        <div className="review-card">
          <h3>Family Groups</h3>
          <div className="family-selector">
            {household.familyGroups.map((group) => (
              <button
                key={group.id}
                type="button"
                className={`family-chip${selectedFamily?.id === group.id ? " is-active" : ""}`}
                onClick={() => setSelectedFamilyId(group.id)}
              >
                <strong>{group.familyGroupCode}</strong> {group.familyType} · {group.memberIds.length} members
                {group.benefitType ? ` · ${group.benefitType}` : ""}
              </button>
            ))}
          </div>
          <p className="muted">Select a family group above to see full member details in the Family Details section.</p>
        </div>

        <div className="review-card">
          <h3>Members</h3>
          <ul className="plain-list">
            {household.persons.map((person) => (
              <li key={person.id}>
                <strong>{person.fullName}</strong> · {person.finalFamilyStatus}
                {person.familyGroupCode ? ` · ${person.familyGroupCode}` : " · No family group"}
              </li>
            ))}
          </ul>
        </div>

        <div className="review-card">
          <h3>Valuation</h3>
          <p>Property Type: {formatValue(household.household.surveyPropertyType ?? "RESIDENTIAL")}</p>
          <p>Ownership Pattern: {formatValue(household.household.ownershipPattern ?? "SINGLE_HOUSE")}</p>
          <p>Linked House IDs: {formatValue(household.household.linkedHouseIds)}</p>
          <p>Resident Family: {household.household.hasResidentFamily === false ? "No" : "Yes"}</p>
          <p>Built-up Area: {household.landDetails?.builtUpAreaSqm ?? 0} sqm</p>
          <p>Open Land Area: {household.landDetails?.openLandAreaSqm ?? 0} sqm</p>
          <p>Total Compensation: Rs {household.valuation?.totalCompensation.toLocaleString("en-IN") ?? 0}</p>
          <p>Excluded Members: {excludedMembers.length}</p>
        </div>
      </div>

      {selectedFamily ? (
        <div className="review-card">
          <h3>Family Details</h3>
          <div className="family-detail-head">
            <p>
              <strong>{selectedFamily.familyGroupCode}</strong> · {selectedFamily.familyType}
            </p>
            <p className="muted">
              Head:{" "}
              {household.persons.find((person) => person.id === selectedFamily.headPersonId)?.fullName ?? "Not set"}
            </p>
          </div>
          <p className="muted">Benefit Type: {selectedFamily.benefitType ?? "Not assigned"}</p>
          <div className="table-scroll">
            <table className="detail-table">
              <thead>
                <tr>
                  <th>Sr. No.</th>
                  <th>Name</th>
                  <th>Relation</th>
                  <th>Gender</th>
                  <th>Age</th>
                  <th>Marital Status</th>
                  <th>Marriage Date</th>
                  <th>Religion</th>
                  <th>Category</th>
                  <th>Category Detail</th>
                  <th>Occupation</th>
                  <th>Education</th>
                  <th>Income Range</th>
                  <th>Family</th>
                  <th>Status</th>
                  <th>Dependent</th>
                  <th>Village</th>
                  <th>Aadhaar</th>
                  <th>Voter ID</th>
                  <th>Mobile</th>
                </tr>
              </thead>
              <tbody>
                {selectedFamilyMembers.map((person, index) => (
                  <tr key={person.id}>
                    <td>{index + 1}</td>
                    <td>{person.fullName}</td>
                    <td>{formatValue(person.relationToLandOwner)}</td>
                    <td>{formatValue(person.gender)}</td>
                    <td>{formatValue(person.age)}</td>
                    <td>{formatValue(person.maritalStatus)}</td>
                    <td>{formatValue(person.marriageDate)}</td>
                    <td>{formatValue(person.religion)}</td>
                    <td>{formatValue(person.casteCategory)}</td>
                    <td>{formatValue(person.otherCasteCategoryDetail)}</td>
                    <td>{formatValue(person.occupation)}</td>
                    <td>{formatValue(person.education)}</td>
                    <td>{formatValue(person.incomeRange)}</td>
                    <td>{formatValue(person.familyGroupCode)}</td>
                    <td>{formatValue(person.finalFamilyStatus)}</td>
                    <td>{formatValue(person.dependentOnLandOwner)}</td>
                    <td>Marda</td>
                    <td>{formatValue(person.aadhaarNumber)}</td>
                    <td>{formatValue(person.voterIdNumber)}</td>
                    <td>{formatValue(person.mobileNumber)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {excludedMembers.length > 0 ? (
        <div className="review-card">
          <h3>Excluded From Compensation</h3>
          <ul className="plain-list">
            {excludedMembers.map((person) => (
              <li key={person.id}>
                <strong>{person.fullName}</strong> · Married daughter after cutoff
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
