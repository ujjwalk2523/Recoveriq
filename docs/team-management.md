# RecoverIQ — Team Management

## 1. Team Model & Concept

Within an `Organization`, members can be grouped into functional `Teams` (e.g. "Risk Ops", "EU Collections", "Platform Engineers").

### Key Invariants
1. **Tenant Containment**: A team strictly belongs to its parent `Organization`.
2. **Cross-Tenant Prevention**: Members cannot be added to a team unless their `OrganizationMember` belongs to the exact same `organizationId`. Attempting to add a member from another organization returns HTTP 400 `MEMBER_CROSS_TENANT_REJECTED`.
3. **No Privilege Escalation**: Team membership does not grant elevated organization permissions. Team assignments serve functional grouping, notification routing, and policy scopes.

---

## 2. Team API Endpoints

- `GET /api/organizations/:id/teams`: List all teams in the organization.
- `POST /api/organizations/:id/teams`: Create a team (validates team plan limits via `EntitlementService`).
- `GET /api/organizations/:id/teams/:teamId`: Get team details and member roster.
- `PATCH /api/organizations/:id/teams/:teamId`: Update team name or description.
- `DELETE /api/organizations/:id/teams/:teamId`: Archive/delete team.
- `POST /api/organizations/:id/teams/:teamId/members`: Add member to team.
- `DELETE /api/organizations/:id/teams/:teamId/members/:memberId`: Remove member from team.
