# RecoverIQ — Organization Management

## 1. Lifecycle Operations

Organizations support the following administrative lifecycle operations:

1. **Creation**:
   - Initialized via `OrganizationService.createOrganization({ name, slug, ownerUserId, billingEmail })`.
   - Automatically provisions the creator as the first `OWNER` in `OrganizationMember`.
   - Validates unique slug against reserved words and active organizations.

2. **Updates**:
   - Authorized users (`OWNER` or `ADMIN`) can update organization name, billing email, or metadata.
   - Slugs can only be updated by the `OWNER`.

3. **Status Transitions**:
   - `ACTIVE` -> `SUSPENDED`: Temporarily suspends access for all non-owners.
   - `ACTIVE` -> `DEACTIVATED`: Soft-deletes the organization.

---

## 2. API Endpoints

- `GET /api/organizations`: List all organizations the current authenticated user belongs to.
- `POST /api/organizations`: Create a new organization.
- `GET /api/organizations/:id`: Retrieve details, member count, and settings for an organization.
- `PATCH /api/organizations/:id`: Update organization details (requires `ORG_MANAGE_SETTINGS`).
- `DELETE /api/organizations/:id`: Deactivate organization (requires `ORG_DELETE`, OWNER only).
- `POST /api/organizations/:id/select`: Switch active organization context and rotate session token.
