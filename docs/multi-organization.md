# RecoverIQ — Multi-Organization Architecture

## 1. Multi-Organization Membership

Users can belong to multiple organizations simultaneously (e.g., an agency managing multiple merchant clients, or an executive overseeing multiple regional subsidiaries).

### Active Context Resolution
1. Sessions hold an `activeOrganizationId`.
2. When performing API requests, the user's active context is resolved via:
   - Header: `X-Organization-Id`
   - Session payload: `session.organizationId`
3. The platform validates that the authenticated `userId` is an active member of the resolved `organizationId`.

---

## 2. Organization Switching Flow

1. Frontend displays the list of user organizations retrieved from `GET /api/organizations`.
2. User selects an organization.
3. Client issues:
   ```http
   POST /api/organizations/:id/select
   ```
4. Server validates active membership, re-issues the signed JWT session cookie with the new `organizationId`, and returns the active organization metadata.
5. All subsequent requests execute within the switched organization's boundary.
