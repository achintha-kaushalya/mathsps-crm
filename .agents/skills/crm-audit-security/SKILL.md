---
name: crm-audit-security
description: Financial audit logging, payment slip verification, role-based access control (RBAC), and LMS CSV export privacy standards for MathsPS CRM.
---

# MathsPS CRM — Financial Audit & Security Skill

## 1. Role-Based Access Control (RBAC)
- **Roles in System:**
  - `owner` / `admin`: Full configuration access (Courses Manager, Member management, Settings, sensitive audit logs).
  - `member` (Cashier / Auditor): Day-to-day operations (Student registration, Payment marking, Delivery tracking).
- **Enforcement:**
  - Client UI displays restricted action buttons only if user role matches `admin` or `owner`.
  - Backend API route (`/api/members/manage`) validates the calling user session before mutating database state or settings.

---

## 2. Payment Audit Logging & Integrity
- **Slip Verification:**
  - Payments marked by cashiers or auditors must record `marked_by` / auditor user info and timestamp.
  - Audited records should never be silently deleted; use soft-deletes or maintain audit entries.
- **Tutor Separation:**
  - Keep Prabuddha (PS) and Sanduni (SM) tutor filters clean and separated via `ps_code` matching (`SM*` vs `PS*`).
  - Combined mode (`all`) must accurately aggregate without double-counting cross-enrolled students.

---

## 3. LMS Bulk Exporter Standards
- LMS bulk exports must strictly match required format:
  ```csv
  name,mobile
  Kasun Perera,0771234567
  ```
- Use `extractLmsNumber` helper:
  - Clean leading country codes (`+94` → `0`, `94` → `0`).
  - Strip spaces, dashes, and invalid characters.
  - Fall back to `household.parent_phone` if student mobile is missing.
- Ensure exported CSV filenames are URL and filesystem safe (`LMS_Billing_<CourseName>_<Month>_<Year>.csv`).
