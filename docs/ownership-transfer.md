# RecoverIQ — Organization Ownership Transfer

## 1. Single Active Owner Invariant

To ensure legal, financial, and administrative accountability:
- Exactly **one** active member with role `OWNER` can exist in an organization at any time.
- The owner cannot leave or be removed without first transferring ownership.
- The owner cannot demote their own role directly; they must use the dedicated ownership transfer workflow.

---

## 2. Transfer Workflow

```
[ Current Owner ]
       |
       | POST /api/organizations/:id/transfer-ownership
       | { targetUserId: "usr_...", confirmationPhrase: "TRANSFER" }
       v
[ OwnershipService.transferOwnership(...) ]
       |
       +--> Verify caller is active OWNER
       +--> Verify target is active member of SAME organization
       +--> Verify target is not already OWNER
       +--> Verify confirmation phrase === "TRANSFER"
       v
[ Atomic Transaction ]
       |
       +--> Promote target user to OWNER
       +--> Demote previous owner to ADMIN
       +--> Audit log entry generated
       v
[ Transfer Completed Successfully ]
```

---

## 3. Error Handling
- Attempting transfer with non-owner caller -> HTTP 403 `INSUFFICIENT_PERMISSIONS`.
- Target user not in same organization -> HTTP 400 `TARGET_USER_NOT_ORGANIZATION_MEMBER`.
- Incorrect confirmation phrase -> HTTP 400 `INVALID_CONFIRMATION_PHRASE`.
