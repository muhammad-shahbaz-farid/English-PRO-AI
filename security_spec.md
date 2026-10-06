# Security Specification for EnglishPro AI Firestore Rules

## 1. Data Invariants
- Each user profile document lives at `/users/{userId}` where `{userId}` strictly matches `request.auth.uid`.
- No user may read, list, create, update, or delete another user's profile document or personal learning stats.
- Document paths must be validated with `isValidId(userId)`.
- Critical immutable fields (`uid`, `email`) cannot be changed after creation.
- Field types and size constraints must strictly adhere to the `firebase-blueprint.json` schema.

## 2. The "Dirty Dozen" Threat Vectors Audited
1. **Identity Spoofing**: Attempt to create `/users/{targetUid}` with `request.auth.uid != targetUid` -> REJECTED.
2. **PII Blanket Scraping**: Attempt to `list` `/users` or `get` another user's profile -> REJECTED.
3. **Unauthenticated Read/Write**: Attempt unauthenticated read or write -> REJECTED.
4. **UID Mutation**: Attempt to update `uid` to hijack identity -> REJECTED.
5. **Email Tampering**: Attempt to update another user's `email` -> REJECTED.
6. **Oversized Field Denial-of-Wallet**: Sending 1MB strings in `name` or `email` -> REJECTED (bounds <= 100 / <= 150).
7. **Invalid Path Injections**: Injecting path traversal or non-alphanumeric IDs -> REJECTED by `isValidId`.
8. **Negative Stats / Type Poisoning**: Sending boolean or array for numeric counters -> REJECTED by `is number` check.
9. **Arbitrary Collection Creation**: Attempt to write to arbitrary paths like `/admins` or `/system` -> REJECTED by default deny.
10. **Shadow Updates**: Injecting unauthorized ghost fields -> REJECTED by schema validator.
11. **Cross-Tenant Deletion**: Attempt to delete another user's document -> REJECTED by `isOwner(userId)`.
12. **Null Pointer Reads**: Accessing `request.resource` in `get` or `delete` -> AVOIDED, rules do not reference `incoming()` in read/delete.
