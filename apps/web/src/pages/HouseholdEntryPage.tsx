import { useEffect, useState, type FormEvent } from "react";
import {
  buildLandDetails,
  buildValuation,
  type BenefitType,
  type CasteCategory,
  type Education,
  getFinalFamilyStatus,
  getSuggestedFamilyStatus,
  type HouseholdBundle,
  type IncomeRange,
  type MaritalStatus,
  type Occupation,
  type PersonInput,
  type RelationToLandOwner,
  type Religion,
  type SurveyPropertyType,
} from "@marda/shared";
import { createHousehold, updateHousehold } from "../api/client";

interface HouseholdEntryPageProps {
  onCreated(bundle: HouseholdBundle): void;
  editingHousehold?: HouseholdBundle | null;
  onCancelEdit(): void;
}

interface MemberDraft {
  id: string;
  fullName: string;
  relationToLandOwner: RelationToLandOwner;
  maritalStatus: MaritalStatus;
  marriageDate: string;
  isDivorced: boolean;
  includeInSurvey: boolean;
  dependentOnLandOwner: boolean;
  familyGroupCode: "F1" | "F2" | "F3" | "F4" | "F5";
  age: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  religion: Religion;
  casteCategory: CasteCategory;
  occupation: Occupation;
  education: Education;
  incomeRange: IncomeRange;
  aadhaarNumber: string;
  voterIdNumber: string;
  mobileNumber: string;
}

type FamilyCode = "F1" | "F2" | "F3" | "F4" | "F5";

const familyCodes: FamilyCode[] = ["F1", "F2", "F3", "F4", "F5"];

function createMemberDraft(): MemberDraft {
  return {
    id: crypto.randomUUID(),
    fullName: "",
    relationToLandOwner: "SON",
    maritalStatus: "UNMARRIED",
    marriageDate: "",
    isDivorced: false,
    includeInSurvey: true,
    dependentOnLandOwner: true,
    familyGroupCode: "F1",
    age: "",
    gender: "MALE",
    religion: "HINDU",
    casteCategory: "GENERAL",
    occupation: "UNEMPLOYED",
    education: "LESS_THAN_10TH",
    incomeRange: "0-5_LAKH",
    aadhaarNumber: "",
    voterIdNumber: "",
    mobileNumber: "",
  };
}

function createDefaultFamilyBenefits(): Record<FamilyCode, BenefitType> {
  return {
    F1: "INDIVIDUAL_PLOT",
    F2: "LUMPSUM_AMOUNT",
    F3: "LUMPSUM_AMOUNT",
    F4: "LUMPSUM_AMOUNT",
    F5: "LUMPSUM_AMOUNT",
  };
}

export function HouseholdEntryPage({ onCreated, editingHousehold, onCancelEdit }: HouseholdEntryPageProps) {
  const [houseId, setHouseId] = useState("");
  const [surveyNumber, setSurveyNumber] = useState("");
  const [locality, setLocality] = useState("");
  const [surveyPropertyType, setSurveyPropertyType] = useState<SurveyPropertyType>("RESIDENTIAL");
  const [hasResidentFamily, setHasResidentFamily] = useState(true);
  const [recordedOwnerName, setRecordedOwnerName] = useState("");
  const [builtUpAreaSqm, setBuiltUpAreaSqm] = useState("0");
  const [openLandAreaSqm, setOpenLandAreaSqm] = useState("0");
  const [structureType, setStructureType] = useState("Pucca");
  const [cattleShedAvailable, setCattleShedAvailable] = useState<"YES" | "NO">("NO");
  const [structureValue, setStructureValue] = useState("0");
  const [landValue, setLandValue] = useState("0");
  const [familyBenefits, setFamilyBenefits] = useState<Record<FamilyCode, BenefitType>>(createDefaultFamilyBenefits());
  const [members, setMembers] = useState<MemberDraft[]>([createMemberDraft()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editingHousehold) return;

    setHouseId(editingHousehold.household.houseId);
    setSurveyNumber(editingHousehold.household.surveyNumber ?? "");
    setLocality(editingHousehold.household.locality ?? "");
    setSurveyPropertyType(editingHousehold.household.surveyPropertyType ?? "RESIDENTIAL");
    setHasResidentFamily(editingHousehold.household.hasResidentFamily ?? true);
    setRecordedOwnerName(editingHousehold.household.landOwnerName ?? "");
    setBuiltUpAreaSqm(String(editingHousehold.landDetails?.builtUpAreaSqm ?? 0));
    setOpenLandAreaSqm(String(editingHousehold.landDetails?.openLandAreaSqm ?? 0));
    setStructureType(editingHousehold.landDetails?.structureType ?? "Pucca");
    setCattleShedAvailable(editingHousehold.landDetails?.cattleShedAvailable ?? "NO");
    setStructureValue(String(editingHousehold.valuation?.structureValue ?? 0));
    setLandValue(String(editingHousehold.valuation?.landValue ?? 0));
    setFamilyBenefits({
      ...createDefaultFamilyBenefits(),
      ...Object.fromEntries(
        editingHousehold.familyGroups
          .filter((group) => group.benefitType)
          .map((group) => [group.familyGroupCode, group.benefitType]),
      ),
    } as Record<FamilyCode, BenefitType>);
    setMembers(
      editingHousehold.persons.map((person) => ({
        id: person.id,
        fullName: person.fullName,
        relationToLandOwner: person.relationToLandOwner,
        maritalStatus: person.maritalStatus ?? "UNMARRIED",
        marriageDate: person.marriageDate ?? "",
        isDivorced: person.isDivorced ?? false,
        includeInSurvey: person.includeInSurvey ?? true,
        dependentOnLandOwner: person.dependentOnLandOwner ?? false,
        familyGroupCode: (person.familyGroupCode as FamilyCode) ?? "F1",
        age: person.age ? String(person.age) : "",
        gender: person.gender ?? "MALE",
        religion: person.religion ?? "HINDU",
        casteCategory: person.casteCategory ?? "GENERAL",
        occupation: person.occupation ?? "UNEMPLOYED",
        education: person.education ?? "LESS_THAN_10TH",
        incomeRange: person.incomeRange ?? "0-5_LAKH",
        aadhaarNumber: person.aadhaarNumber ?? "",
        voterIdNumber: person.voterIdNumber ?? "",
        mobileNumber: person.mobileNumber ?? "",
      })),
    );
  }, [editingHousehold]);

  function resetForm() {
    setHouseId("");
    setSurveyNumber("");
    setLocality("");
    setSurveyPropertyType("RESIDENTIAL");
    setHasResidentFamily(true);
    setRecordedOwnerName("");
    setBuiltUpAreaSqm("0");
    setOpenLandAreaSqm("0");
    setStructureType("Pucca");
    setCattleShedAvailable("NO");
    setStructureValue("0");
    setLandValue("0");
    setFamilyBenefits(createDefaultFamilyBenefits());
    setMembers([createMemberDraft()]);
  }

  function updateMember(id: string, patch: Partial<MemberDraft>) {
    setMembers((current) =>
      current.map((member) => {
        if (member.id !== id) return member;

        const next = { ...member, ...patch };
        const isOwnerOrSpouse =
          next.relationToLandOwner === "PRIMARY_LAND_OWNER" ||
          next.relationToLandOwner === "PRIMARY_LAND_OWNER_SPOUSE";
        const ageNumber = Number(next.age);
        const isMinor = Boolean(next.age) && !Number.isNaN(ageNumber) && ageNumber < 18;

        if (isMinor) {
          next.maritalStatus = "MINOR";
          next.isDivorced = false;
        }

        if (isOwnerOrSpouse || next.maritalStatus === "UNMARRIED" || next.maritalStatus === "MINOR" || isMinor) {
          next.marriageDate = "";
        }

        if (isOwnerOrSpouse) {
          next.isDivorced = false;
        }

        if (!next.includeInSurvey) {
          next.familyGroupCode = "F1";
          next.dependentOnLandOwner = false;
        }

        if (next.familyGroupCode !== "F1") {
          next.dependentOnLandOwner = false;
        }

        if (next.relationToLandOwner === "PRIMARY_LAND_OWNER") {
          next.familyGroupCode = "F1";
          next.dependentOnLandOwner = false;
        }

        return next;
      }),
    );
  }

  function addMember() {
    setMembers((current) => [...current, createMemberDraft()]);
  }

  function removeMember(id: string) {
    setMembers((current) => (current.length === 1 ? current : current.filter((member) => member.id !== id)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const householdId = editingHousehold?.household.id ?? crypto.randomUUID();
      const trimmedMembers = hasResidentFamily ? members.filter((member) => member.fullName.trim()) : [];

      const persons: PersonInput[] = trimmedMembers.map((member) => {
        const ageNumber = member.age ? Number(member.age) : undefined;
        const isMinor = ageNumber !== undefined && ageNumber < 18;

        return {
          id: member.id,
          householdId,
          fullName: member.fullName.trim(),
          relationToLandOwner: member.relationToLandOwner,
          maritalStatus: isMinor ? "MINOR" : member.maritalStatus,
          marriageDate:
            member.maritalStatus === "UNMARRIED" ||
            member.maritalStatus === "MINOR" ||
            isMinor ||
            member.relationToLandOwner === "PRIMARY_LAND_OWNER" ||
            member.relationToLandOwner === "PRIMARY_LAND_OWNER_SPOUSE"
              ? undefined
              : member.marriageDate || undefined,
          isDivorced: member.isDivorced,
          includeInSurvey: member.includeInSurvey,
          dependentOnLandOwner: member.includeInSurvey ? member.dependentOnLandOwner : false,
          familyGroupCode: member.includeInSurvey ? member.familyGroupCode : "",
          age: ageNumber,
          gender: member.gender,
          religion: member.religion,
          casteCategory: member.casteCategory,
          occupation: member.occupation,
          education: member.education,
          incomeRange: member.incomeRange,
          aadhaarNumber: member.aadhaarNumber || undefined,
          voterIdNumber: member.voterIdNumber || undefined,
          mobileNumber: member.mobileNumber || undefined,
        };
      });

      const activeFamilyCodes = new Set(
        persons
          .filter((person) => person.includeInSurvey !== false && person.familyGroupCode)
          .map((person) => person.familyGroupCode as FamilyCode),
      );

      const payload = {
        household: {
          id: householdId,
          villageId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          houseId,
          surveyNumber: surveyNumber || undefined,
          surveyPropertyType,
          hasResidentFamily,
          headPersonName: !hasResidentFamily ? recordedOwnerName || "Unknown" : undefined,
          landOwnerName: !hasResidentFamily ? recordedOwnerName || "Unknown" : undefined,
          locality: locality || undefined,
          status: "DRAFT" as const,
          isLocked: false as const,
        },
        persons,
        familyBenefits: familyCodes
          .filter((familyCode) => activeFamilyCodes.has(familyCode))
          .map((familyCode) => ({
            familyGroupCode: familyCode,
            benefitType: familyBenefits[familyCode],
          })),
        landDetails: {
          builtUpAreaSqm: Number(builtUpAreaSqm) || 0,
          openLandAreaSqm: Number(openLandAreaSqm) || 0,
          structureType,
          cattleShedAvailable,
        },
        valuation: {
          structureValue: Number(structureValue) || 0,
          landValue: Number(landValue) || 0,
          treeAssetValue: 0,
          shiftingAllowance: 0,
          subsistenceAllowance: 0,
          otherAssistance: 0,
        },
      };

      const bundle = editingHousehold
        ? await updateHousehold(householdId, payload)
        : await createHousehold(payload);

      onCreated(bundle);
      setMessage(`${editingHousehold ? "Updated" : "Saved"} household ${bundle.household.houseId}`);
      resetForm();
      onCancelEdit();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save household");
    } finally {
      setSaving(false);
    }
  }

  const totalArea = buildLandDetails(
    "preview",
    Number(builtUpAreaSqm) || 0,
    Number(openLandAreaSqm) || 0,
    structureType,
    cattleShedAvailable,
  ).totalAreaSqm;
  const totalCompensation = buildValuation({
    householdId: "preview",
    structureValue: Number(structureValue) || 0,
    landValue: Number(landValue) || 0,
    treeAssetValue: 0,
    shiftingAllowance: 0,
    subsistenceAllowance: 0,
    otherAssistance: 0,
  }).totalCompensation;

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Data Entry</p>
          <h2>{editingHousehold ? "Edit Household and Family Members" : "Household and Family Members"}</h2>
        </div>
        <p className="muted">Enter the household once, then capture every person and family group linked to it.</p>
      </div>

      <form className="entry-form" onSubmit={handleSubmit}>
        <div className="entry-grid">
          <label>
            Village
            <input value="Marda" readOnly />
          </label>
          <label>
            House ID
            <input value={houseId} onChange={(event) => setHouseId(event.target.value)} placeholder="MAR-0002" required />
          </label>
          <label>
            Survey Number
            <input value={surveyNumber} onChange={(event) => setSurveyNumber(event.target.value)} placeholder="Survey no." />
          </label>
          <label>
            Locality
            <input value={locality} onChange={(event) => setLocality(event.target.value)} placeholder="Ward / locality" />
          </label>
          <label>
            Property Type
            <select value={surveyPropertyType} onChange={(event) => setSurveyPropertyType(event.target.value as SurveyPropertyType)}>
              <option value="RESIDENTIAL">Residential Household</option>
              <option value="EMPTY_PLOT">Empty Plot</option>
              <option value="TEMPORARY_STRUCTURE">Temporary Structure</option>
              <option value="SHOP">Shop</option>
              <option value="OTHER_NON_RESIDENTIAL">Other Non-Residential</option>
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={!hasResidentFamily}
              onChange={(event) => setHasResidentFamily(!event.target.checked)}
            />
            No resident family on this property
          </label>
          {!hasResidentFamily ? (
            <label>
              Recorded Owner Name
              <input
                value={recordedOwnerName}
                onChange={(event) => setRecordedOwnerName(event.target.value)}
                placeholder="Owner / claimant name"
                required={!hasResidentFamily}
              />
            </label>
          ) : null}
        </div>

        <div className="entry-grid">
          <label>
            Structure Type
            <select value={structureType} onChange={(event) => setStructureType(event.target.value)}>
              <option>Pucca</option>
              <option>Semi-Pucca</option>
              <option>Kutcha</option>
            </select>
          </label>
          <label>
            Cattle Shed Available
            <select value={cattleShedAvailable} onChange={(event) => setCattleShedAvailable(event.target.value as "YES" | "NO")}>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </label>
          <label>
            Built-up Area
            <input type="number" min="0" value={builtUpAreaSqm} onChange={(event) => setBuiltUpAreaSqm(event.target.value)} />
          </label>
          <label>
            Empty Plot Area
            <input type="number" min="0" value={openLandAreaSqm} onChange={(event) => setOpenLandAreaSqm(event.target.value)} />
          </label>
          <label>
            Structure Value
            <input type="number" min="0" value={structureValue} onChange={(event) => setStructureValue(event.target.value)} />
          </label>
          <label>
            Land Value
            <input type="number" min="0" value={landValue} onChange={(event) => setLandValue(event.target.value)} />
          </label>
          <div className="calc-card">
            <span>Total Area</span>
            <strong>{totalArea} sqm</strong>
            <span>Total Compensation</span>
            <strong>Rs {totalCompensation.toLocaleString("en-IN")}</strong>
          </div>
        </div>

        <div className="member-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Family Benefits</p>
              <h3>Benefit Selection for F1 to F5</h3>
            </div>
            <p className="muted">Set the applicable rehabilitation benefit for each family group.</p>
          </div>
          <div className="entry-grid">
            {familyCodes.map((familyCode) => (
              <label key={familyCode}>
                {familyCode} Benefit Type
                <select
                  value={familyBenefits[familyCode]}
                  onChange={(event) =>
                    setFamilyBenefits((current) => ({
                      ...current,
                      [familyCode]: event.target.value as BenefitType,
                    }))
                  }
                  disabled={!hasResidentFamily}
                >
                  <option value="INDIVIDUAL_PLOT">Individual Plot</option>
                  <option value="LUMPSUM_AMOUNT">Lumpsum Amount</option>
                </select>
              </label>
            ))}
          </div>
          {!hasResidentFamily ? (
            <p className="muted">Family benefits are not required for property-only survey records with no resident family.</p>
          ) : null}
        </div>

        <div className="member-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">Members</p>
              <h3>{hasResidentFamily ? "Family Members Only" : "Property-only survey record"}</h3>
            </div>
            <p className="muted">
              {hasResidentFamily
                ? "Add the primary land owner, spouse, and all remaining members here."
                : "Use this for empty plots, shops, and temporary structures where ownership exists but nobody stays there."}
            </p>
          </div>

          {!hasResidentFamily ? (
            <div className="field-note">
              <strong>No family members will be saved for this record.</strong>
              <span>This property will still be counted in the survey and shown separately on the dashboard.</span>
            </div>
          ) : null}

          {hasResidentFamily ? members.map((member, index) => {
            const previewStatus = getSuggestedFamilyStatus({
              id: member.id,
              householdId: "preview",
              fullName: member.fullName,
              relationToLandOwner: member.relationToLandOwner,
              maritalStatus: member.maritalStatus,
              marriageDate: member.marriageDate || undefined,
              isDivorced: member.isDivorced,
              religion: member.religion,
              casteCategory: member.casteCategory,
              occupation: member.occupation,
              education: member.education,
              incomeRange: member.incomeRange,
            });
            const finalPreviewStatus = getFinalFamilyStatus({
              id: member.id,
              householdId: "preview",
              fullName: member.fullName,
              relationToLandOwner: member.relationToLandOwner,
              maritalStatus: member.maritalStatus,
              marriageDate: member.marriageDate || undefined,
              isDivorced: member.isDivorced,
              includeInSurvey: member.includeInSurvey,
              dependentOnLandOwner: member.dependentOnLandOwner,
              familyGroupCode: member.includeInSurvey ? member.familyGroupCode : "",
              religion: member.religion,
              casteCategory: member.casteCategory,
              occupation: member.occupation,
              education: member.education,
              incomeRange: member.incomeRange,
            });
            const isOwnerOrSpouse =
              member.relationToLandOwner === "PRIMARY_LAND_OWNER" ||
              member.relationToLandOwner === "PRIMARY_LAND_OWNER_SPOUSE";
            const ageNumber = Number(member.age);
            const isMinor = Boolean(member.age) && !Number.isNaN(ageNumber) && ageNumber < 18;
            const showMarriageDate =
              !isOwnerOrSpouse &&
              member.maritalStatus !== "UNMARRIED" &&
              member.maritalStatus !== "MINOR" &&
              !isMinor;

            return (
              <div key={member.id} className="member-editor">
                <div className="section-head">
                  <h4>Member {index + 1}</h4>
                  <button type="button" className="ghost-btn" onClick={() => removeMember(member.id)}>
                    Remove
                  </button>
                </div>

                <div className="entry-grid">
                  <label>
                    Full Name
                    <input
                      value={member.fullName}
                      onChange={(event) => updateMember(member.id, { fullName: event.target.value })}
                      placeholder="Family member name"
                    />
                  </label>
                  <label>
                    Relation
                    <select
                      value={member.relationToLandOwner}
                      onChange={(event) =>
                        updateMember(member.id, { relationToLandOwner: event.target.value as RelationToLandOwner })
                      }
                    >
                      <option value="PRIMARY_LAND_OWNER">Primary Land Owner</option>
                      <option value="PRIMARY_LAND_OWNER_SPOUSE">Primary Land Owner Spouse</option>
                      <option value="SON">Son</option>
                      <option value="DAUGHTER">Daughter</option>
                      <option value="DAUGHTER_IN_LAW">Daughter-in-law</option>
                      <option value="GRAND_SON">Grand Son</option>
                      <option value="GRAND_DAUGHTER">Grand Daughter</option>
                      <option value="FATHER">Father</option>
                      <option value="MOTHER">Mother</option>
                      <option value="BROTHER">Brother</option>
                      <option value="SISTER">Sister</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label>
                    Marital Status
                    <select
                      value={member.maritalStatus}
                      onChange={(event) => updateMember(member.id, { maritalStatus: event.target.value as MaritalStatus })}
                      disabled={isMinor}
                    >
                      <option value="MINOR">Minor</option>
                      <option value="UNMARRIED">Unmarried</option>
                      <option value="MARRIED">Married</option>
                      <option value="DIVORCED">Divorced</option>
                      <option value="WIDOWED">Widowed</option>
                    </select>
                  </label>
                  {showMarriageDate ? (
                    <label>
                      Marriage Date
                      <input
                        type="date"
                        value={member.marriageDate}
                        onChange={(event) => updateMember(member.id, { marriageDate: event.target.value })}
                      />
                    </label>
                  ) : (
                    <div className="field-note">
                      <span>Marriage Date</span>
                      <small>
                        {isMinor
                          ? "Disabled because age is below 18 years and status is set to Minor"
                          : member.maritalStatus === "UNMARRIED"
                            ? "Hidden for unmarried members"
                            : "Not required for owner or spouse"}
                      </small>
                    </div>
                  )}
                  <label>
                    Age
                    <input
                      type="number"
                      min="0"
                      value={member.age}
                      onChange={(event) => updateMember(member.id, { age: event.target.value })}
                    />
                  </label>
                  <label>
                    Gender
                    <select value={member.gender} onChange={(event) => updateMember(member.id, { gender: event.target.value as MemberDraft["gender"] })}>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label>
                    Religion
                    <select value={member.religion} onChange={(event) => updateMember(member.id, { religion: event.target.value as Religion })}>
                      <option value="HINDU">Hindu</option>
                      <option value="MUSLIM">Muslim</option>
                      <option value="CHRISTIAN">Christian</option>
                      <option value="SIKH">Sikh</option>
                      <option value="BUDDHIST">Buddhist</option>
                      <option value="JAIN">Jain</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label>
                    Category
                    <select
                      value={member.casteCategory}
                      onChange={(event) => updateMember(member.id, { casteCategory: event.target.value as CasteCategory })}
                    >
                      <option value="GENERAL">General</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="OTHERS">Others</option>
                    </select>
                  </label>
                  <label>
                    Occupation
                    <select
                      value={member.occupation}
                      onChange={(event) => updateMember(member.id, { occupation: event.target.value as Occupation })}
                    >
                      <option value="EMPLOYED">Employed</option>
                      <option value="AGRICULTURE">Agriculture</option>
                      <option value="HOUSE_WIFE">House Wife</option>
                      <option value="BUSINESS">Business</option>
                      <option value="STUDENT">Student</option>
                      <option value="MINOR">Minor</option>
                      <option value="UNEMPLOYED">Unemployed</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </label>
                  <label>
                    Education
                    <select
                      value={member.education}
                      onChange={(event) => updateMember(member.id, { education: event.target.value as Education })}
                    >
                      <option value="LESS_THAN_10TH">Less Than 10th Class</option>
                      <option value="10TH">10th</option>
                      <option value="12TH">12th</option>
                      <option value="ITI">ITI</option>
                      <option value="DIPLOMA">Diploma</option>
                      <option value="DEGREE">Degree</option>
                      <option value="MASTERS">Masters</option>
                      <option value="OTHERS">Others</option>
                    </select>
                  </label>
                  <label>
                    Annual Income Range
                    <select
                      value={member.incomeRange}
                      onChange={(event) => updateMember(member.id, { incomeRange: event.target.value as IncomeRange })}
                    >
                      <option value="0-5_LAKH">0-5 Lakh</option>
                      <option value="5-10_LAKH">5-10 Lakh</option>
                      <option value="10-15_LAKH">10-15 Lakh</option>
                      <option value="15-20_LAKH">15-20 Lakh</option>
                      <option value="20-25_LAKH">20-25 Lakh</option>
                      <option value="ABOVE_25_LAKH">Above 25 Lakh</option>
                    </select>
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={member.includeInSurvey}
                      onChange={(event) => updateMember(member.id, { includeInSurvey: event.target.checked })}
                    />
                    Include in Survey
                  </label>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={member.dependentOnLandOwner}
                      onChange={(event) => updateMember(member.id, { dependentOnLandOwner: event.target.checked })}
                      disabled={!member.includeInSurvey || member.familyGroupCode !== "F1"}
                    />
                    Dependent on Land Owner
                  </label>
                  <label>
                    Family
                    <select
                      value={member.familyGroupCode}
                      onChange={(event) =>
                        updateMember(member.id, {
                          familyGroupCode: event.target.value as FamilyCode,
                        })
                      }
                      disabled={!member.includeInSurvey}
                    >
                      <option value="F1">F1 Primary</option>
                      <option value="F2">F2 Family 2</option>
                      <option value="F3">F3 Family 3</option>
                      <option value="F4">F4 Family 4</option>
                      <option value="F5">F5 Family 5</option>
                    </select>
                  </label>
                  <label>
                    Aadhaar Number
                    <input
                      value={member.aadhaarNumber}
                      onChange={(event) => updateMember(member.id, { aadhaarNumber: event.target.value })}
                    />
                  </label>
                  <label>
                    Voter ID Number
                    <input
                      value={member.voterIdNumber}
                      onChange={(event) => updateMember(member.id, { voterIdNumber: event.target.value })}
                    />
                  </label>
                  <label>
                    Mobile Number
                    <input
                      value={member.mobileNumber}
                      onChange={(event) => updateMember(member.id, { mobileNumber: event.target.value })}
                    />
                  </label>
                </div>

                <div className="status-row">
                  <span className={`status-tag status-${finalPreviewStatus.toLowerCase()}`}>Final Status: {finalPreviewStatus}</span>
                  <span className="muted">Suggested: {previewStatus}</span>
                </div>
              </div>
            );
          }) : null}

          {hasResidentFamily ? (
            <div className="member-actions">
              <button type="button" className="secondary-btn" onClick={addMember}>
                Add Member
              </button>
            </div>
          ) : null}
        </div>

        {(message || error) && (
          <div>
            {message ? <p className="success-text">{message}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="primary-btn" disabled={saving}>
            {saving ? "Saving..." : editingHousehold ? "Update Household" : "Save Household"}
          </button>
          {editingHousehold ? (
            <button type="button" className="ghost-btn" onClick={onCancelEdit}>
              Cancel Edit
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
