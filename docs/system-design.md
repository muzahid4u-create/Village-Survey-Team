# System Design

## 1. Architecture

Recommended architecture:

- Android mobile app for field surveyors
- web app for supervisors and admins
- REST API backend
- PostgreSQL for server database
- SQLite on mobile for offline storage
- object storage for images and documents

## 2. Why This Stack

React Native is a practical choice because the field requirement is Android-first and the same business logic can be shared with web and backend in TypeScript if needed.

Preferred stack:

- Mobile: React Native
- Web Admin: React with Vite
- Backend: Node.js with NestJS
- Database: PostgreSQL
- Mobile local DB: SQLite
- Auth: JWT with refresh token rotation

## 3. High-Level Components

### Mobile App

Responsibilities:

- authenticate user
- cache reference data
- create and edit household surveys offline
- capture photos and GPS coordinates
- run local validation and family suggestion logic
- queue sync operations

### Backend API

Responsibilities:

- user and role management
- server-side validation
- final source of truth for households and families
- conflict resolution during sync
- reporting and export generation
- audit logging

### Web App

Responsibilities:

- dashboard and analytics
- supervisor review workflow
- manual overrides and approvals
- export and administration

## 4. Offline-First Design

This is mandatory because the survey will happen in the field.

### Local Data Strategy

Store on device:

- master data
- user session
- unsynced household forms
- unsynced images metadata
- sync queue

Recommended local tables:

- households_local
- persons_local
- families_local
- land_details_local
- valuations_local
- documents_local
- sync_queue

### Sync Model

Use an append-only sync queue with operation types:

- `CREATE`
- `UPDATE`
- `DELETE_SOFT`
- `UPLOAD_FILE`

Each local change should create a queue row containing:

- entity type
- local record id
- operation
- payload snapshot
- created at
- retry count

### Conflict Handling

Rules:

- surveyor edits are allowed only until supervisor lock
- if server record is locked, device receives read-only conflict
- if record changed on server after local edit, mark as conflict and require supervisor review
- never silently overwrite manual override decisions

## 5. Security and Audit

### Authentication

- username or mobile plus password
- access token and refresh token
- optional device binding for surveyors

### Authorization

- surveyors can edit only assigned villages or households
- supervisors can review assigned area
- admins have full access

### Audit Log

Log all changes to:

- family classification
- valuation fields
- approvals and rejections
- lock and unlock actions

Audit fields:

- entity
- entity id
- action
- old value snapshot
- new value snapshot
- actor id
- timestamp

## 6. Locking Model

Once a survey is approved:

- household becomes read-only for surveyors
- any change requires explicit unlock by admin
- lock state must propagate to mobile devices during sync

## 7. Reporting Design

Backend should expose report endpoints and export jobs for:

- household summary
- classification summary
- compensation summary
- beneficiary register

Export formats:

- xlsx
- pdf
- csv

## 8. Suggested API Surface

### Auth

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Village Master

- `GET /villages`
- `GET /villages/:id`

### Households

- `GET /households`
- `POST /households`
- `GET /households/:id`
- `PATCH /households/:id`
- `POST /households/:id/submit`
- `POST /households/:id/lock`

### Persons

- `POST /households/:id/persons`
- `PATCH /persons/:id`
- `DELETE /persons/:id`

### Families

- `GET /households/:id/families`
- `POST /households/:id/families/recalculate`
- `PATCH /families/:id`

### Land and Valuation

- `PUT /households/:id/land-details`
- `PUT /households/:id/valuation`

### Documents

- `POST /households/:id/documents`
- `GET /households/:id/documents`

### Reports

- `GET /reports/household-summary`
- `GET /reports/family-classification`
- `GET /reports/compensation`
- `GET /reports/eligibility`

### Sync

- `POST /sync/push`
- `GET /sync/pull`

## 9. Suggested UI Structure

### Mobile App

Screens:

- login
- assigned village list
- household list
- household details
- family members
- family grouping
- land and structure
- valuation
- documents
- review and submit
- sync center

### Web App

Screens:

- login
- dashboard
- household search
- household review
- conflict resolution
- reports
- user management
- master settings

## 10. Core Logic Pseudocode

```ts
const CUTOFF_DATE = "2020-08-29";

function getSuggestedFamilyStatus(
  person: PersonInput,
): "PRIMARY" | "SEPARATE" | "DEPENDENT" | "EXCLUDED" {
  if (person.relationToLandOwner === "LAND_OWNER" || person.relationToLandOwner === "SPOUSE") {
    return "PRIMARY";
  }

  if (
    person.relationToLandOwner === "DAUGHTER" &&
    person.maritalStatus === "MARRIED" &&
    person.isDivorced !== true
  ) {
    return "EXCLUDED";
  }

  if (person.relationToLandOwner === "DAUGHTER" && person.isDivorced === true) {
    return "PRIMARY";
  }

  const relationEligible =
    person.relationToLandOwner === "SON" || person.relationToLandOwner === "DAUGHTER";

  const marriedBeforeCutoff =
    person.maritalStatus === "MARRIED" &&
    !!person.marriageDate &&
    person.marriageDate < CUTOFF_DATE;

  if (relationEligible && marriedBeforeCutoff) {
    return "SEPARATE";
  }

  return "DEPENDENT";
}
```

Final stored family status:

```ts
function getFinalFamilyStatus(person: PersonRecord): FamilyStatus {
  if (person.manualFamilyStatus) return person.manualFamilyStatus;
  return person.systemSuggestedStatus;
}
```

## 11. Scale Assumptions

For one village and about 600 households, performance requirements are modest. The design should still support later expansion to multiple villages by ensuring:

- village_id exists on all core entities
- reports can filter by village
- household ids are unique across villages
