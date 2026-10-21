# MathsPS CRM — Agent Rules & Engineering Standards

## 1. Code Integrity & Next.js 16 Best Practices
- **No Duplicate Scope Variables:** Always ensure React state hooks and functions are declared uniquely in component scope.
- **Client vs Server Directives:**
  - Mark interactive components with `'use client'` at line 1.
  - Route handlers under `src/app/api/` run in server environment.
- **TypeScript Strictness:** Never use unvalidated `any` where concrete interfaces (`Student`, `Payment`, `CourseConfig`) exist in `@/lib/types` and `@/lib/courses`.

## 2. Design Consistency (Glassmorphism & Bento)
- Respect the Dark Glassmorphic look and feel:
  - Do not introduce raw non-theme background colors (e.g. plain white tables in dark mode).
  - Use `glass-card`, `data-table`, `badge`, and `stat-card` utility classes.
  - Preserve vibrant color semantics: Green for financial gain, Rose for debt/dropouts, Blue for operations, Purple for specialist/external courses.

## 3. Production Deployment Gate
- Prior to every git commit and push to `origin/main`, execute `npm run build` within `crm-web`.
- Verify there are zero build or typecheck errors so Vercel automated deployments succeed flawlessly.
