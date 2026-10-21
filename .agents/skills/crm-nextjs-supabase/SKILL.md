---
name: crm-nextjs-supabase
description: Technical architecture, database guidelines, SSR auth, and Vercel deployment standards for MathsPS CRM. Covers Next.js App Router, Supabase Postgres, Realtime channels, Storage buckets, and Turbopack build optimization.
---

# MathsPS CRM — Next.js 16 + Supabase Architecture & Deployment Skill

## 1. Stack Foundation
- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Database & Auth:** Supabase (PostgreSQL, Supabase Auth SSR, Supabase Realtime)
- **File Storage:** Supabase Storage (`payment-slips`, `delivery-notes`)
- **Hosting & CI/CD:** Vercel (`mathsps-lead-crm.vercel.app`)
- **Core Package Manager:** npm

---

## 2. Supabase Client Architecture Rules

### Server vs Client Separation
1. **Client Components (`'use client'`):**
   - Use `createClient()` from `@/lib/supabase/client`.
   - Never import or expose `SUPABASE_SERVICE_ROLE_KEY` inside client code.
   - Use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **Server Route Handlers & Server Actions (`app/api/*`):**
   - For public / customer requests: enforce cookie-based SSR client.
   - For privileged administrative batch actions (e.g., custom course updates, bulk audits): use `SUPABASE_SERVICE_ROLE_KEY` on the server ONLY.
   - Always validate session role (`admin`, `owner`) before executing elevated actions.

3. **Supabase Realtime:**
   - Listen to channels (e.g. `reports-courses-sync`, `mathsps-global-courses-sync`).
   - Clean up listeners in React hooks:
     ```ts
     return () => {
       supabase.removeChannel(channel)
     }
     ```

---

## 3. Large Data Queries & Pagination
- Supabase REST has a default limit of 1,000 rows.
- When querying students (10,000+ records) or monthly payments, **always use chunked pagination** (`fetchAllPaginated` helper with `.range(from, to)`).
- Never do unbounded `.select('*')` without range filtering or grade/date constraints.

---

## 4. Vercel Deployment & Build Guardrails
Before pushing to `origin/main`:
1. Always run `npm run build` locally in `crm-web` to detect:
   - Turbopack variable naming collisions (duplicate `const` in scope).
   - TypeScript type mismatches.
   - SSR vs Client Component boundary violations.
2. Ensure environment variables are configured on Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY` (if email automation is enabled)
