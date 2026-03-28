# Product Specification

## 1. Objective

Build a mobile and web application for village resettlement survey under the CBA Act, 1957 for Marda village. The system must support around 600 households and produce defensible household, family, land, valuation, and eligibility records.

The design priority is operational accuracy in the field, not cosmetic complexity. Every important classification must remain auditable and manually reviewable.

## 2. Core Business Rules

### 2.1 Cut-Off Date

- fixed cut-off date: `2020-08-29`

### 2.2 Final Family Classification Logic

Primary family `F1` includes:

- land owner
- spouse
- unmarried children and other dependents
- divorced daughter

Separate family is created only when all of the following are true:

- relation is `SON` or `DAUGHTER`
- marital status is `MARRIED`
- marriage date exists
- marriage date is before `2020-08-29`
- person is not a divorced daughter case handled under primary family

Excluded members:

- married daughter who is not divorced

Rules:

- dependent members are part of the primary family group `F1`
- excluded members are not part of any family group
- excluded members are not counted in compensation or beneficiary calculations

### 2.3 Manual Override

Field teams and supervisors must be able to override automatic classification because legal entitlement often depends on case records and local verification.

Required override controls:

- `manual_family_status`
- `family_group_code`
- `override_reason`
- `override_by`
- `override_timestamp`

System behavior:

- show both `system_suggested_status` and `final_status`
- preserve full audit trail
- reports must use `final_status`, not raw system suggestion

## 3. User Roles

### Surveyor

- create and edit survey drafts
- capture household, member, land, valuation, and documents
- work offline
- sync when network is available
- cannot lock records finally

### Supervisor

- review submitted surveys
- approve or return for correction
- apply family override
- lock reviewed records

### Admin

- manage users and role assignments
- configure village master and cut-off date
- view full dashboard and exports
- unlock records in exceptional cases

## 4. Functional Modules

### 4.1 Village Master

Fields:

- village code
- village name
- acquisition act
- cut-off date
- district
- taluka or block
- total expected households
- project notes

### 4.2 Household Entry

One household record corresponds to one surveyed house or property unit.

Fields:

- household id
- house id
- survey number
- property id
- head of household
- land owner name
- address text
- hamlet or locality
- gps latitude
- gps longitude
- survey status
- remarks

Rules:

- `house_id` should be system-generated, for example `MAR-0001`
- total members should be derived from active member records

### 4.3 Person Entry

Each household can contain multiple persons.

Fields:

- person id
- household id
- full name
- gender
- date of birth or age
- relation to land owner
- marital status
- marriage date
- divorced flag
- caste category
- education level
- occupation
- employment status
- annual income
- aadhaar number optional
- mobile number optional
- disability flag optional
- deceased flag optional

Validation:

- age cannot be negative
- marriage date cannot be in the future
- if marital status is not married, marriage date should be empty

### 4.4 Family Grouping

A household may contain one primary family and zero or more separate families.

Dependent members must be attached to the primary family group `F1`.
Excluded members must not be attached to any family group.

Family types:

- `PRIMARY`
- `SEPARATE`

Each final beneficiary grouping must have:

- family id
- household id
- family group code
- family type
- family head person id
- eligibility status
- notes

### 4.5 Land and Structure

Fields:

- built-up area sqm
- open land area sqm
- total area sqm
- structure type
- roof type
- wall type
- usage type residential or mixed or other
- number of floors
- occupancy status

Calculation:

- `total_area_sqm = built_up_area_sqm + open_land_area_sqm`

### 4.6 Valuation

Fields:

- structure value
- land value
- tree or asset value optional
- shifting allowance optional
- subsistence allowance optional
- other assistance optional
- total compensation
- valuation remarks

Calculation:

- `total_compensation = structure_value + land_value + tree_or_asset_value + shifting_allowance + subsistence_allowance + other_assistance`

### 4.7 Documents and Media

Supported uploads:

- house photograph
- family group document
- ID proof
- land ownership papers
- marriage proof where relevant

Each file record should store:

- file id
- household id
- person id optional
- file category
- file name
- mime type
- captured at
- gps optional

### 4.8 Reports

Required reports:

- household survey progress
- pending vs completed surveys
- household roster report
- family classification report
- dependent members report
- excluded members report
- separate family eligibility report
- compensation summary
- total project liability
- export to Excel and PDF

## 5. Survey Workflow

### Draft Flow

1. Surveyor creates household
2. Surveyor adds members
3. System suggests family classification
4. Surveyor adjusts family grouping if required
5. Surveyor enters land and valuation details
6. Surveyor uploads documents and photos
7. Surveyor submits for review

### Review Flow

1. Supervisor reviews all sections
2. Supervisor confirms or overrides classification
3. Supervisor approves or sends back
4. Approved record is locked

## 6. Status Model

Household status values:

- `DRAFT`
- `SUBMITTED`
- `UNDER_REVIEW`
- `APPROVED`
- `RETURNED`
- `LOCKED`

Sync status values on device:

- `LOCAL_ONLY`
- `SYNC_PENDING`
- `SYNCED`
- `SYNC_ERROR`

## 7. Non-Functional Requirements

- Android-first, low-connectivity operation
- full offline capture of forms and photos
- conflict-safe sync with clear error messages
- audit log for every major change
- fast search by house id, land owner, survey number, or person name
- exportable and legally reviewable reports
- scalable to multiple villages later
