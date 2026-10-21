---
name: crm-ui-glassmorphism
description: UI/UX design standards for MathsPS CRM. Combines Liquid Glassmorphism, Bento Grid layouts, high-contrast typography, and shadcn-inspired form & component composition.
---

# MathsPS CRM — Glassmorphism & Bento Design System Skill

## 1. Visual Aesthetics & Theme Foundation
MathsPS CRM uses a signature **Dark Glassmorphic** theme designed for high-density educational & financial data.

### Core Style Tokens:
- **Background Base:** `var(--bg-base)` / `#0b0f19`
- **Surface / Glass Cards:**
  ```css
  background: rgba(18, 24, 38, 0.7);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  ```
- **Accent Palette:**
  - Blue (`#38bdf8` / `#3b82f6`): Primary navigation, student links, general actions.
  - Green (`#10b981` / `#4ade80`): Audited payments, revenue total, verified statuses.
  - Purple (`#8b5cf6` / `#a855f7`): External / Specialist courses (`test`, `GEOMETRY`, `BODMAS`).
  - Amber / Yellow (`#f59e0b` / `#fcd34d`): Pending audits, banks, warnings.
  - Rose / Red (`#ef4444` / `#f43f5e`): Outstanding debts, dropouts, unverified records.
  - Pink (`#ec4899`): Tutor Sanduni (SM) filters and tags.

---

## 2. Bento Grid Layout Guidelines
When building dashboards, overview tabs, or metric summaries:
1. **Stat Cards:**
   - Use colored left-borders: `borderLeft: '4px solid <color>'`.
   - Subtle glowing drop-shadows: `boxShadow: '0 4px 20px -4px rgba(<color_rgb>, 0.25)'`.
   - Clear value hierarchy: Large numbers (22–26px bold), small labels (11–12px uppercase muted).
2. **Data Tables:**
   - Sticky header rows where feasible.
   - Alternate row tinting: `rgba(255, 255, 255, 0.02)` for odd rows.
   - Distinct highlight for weekend / active days.
   - Right-align financial numbers, center-align codes and status badges.

---

## 3. Form & Component Composition Rules
- **Pills & Filter Groups:**
  Use grouped container with `background: var(--bg-base)`, `padding: 3px`, `borderRadius: 8px`, `border: 1px solid var(--border)` with active button states.
- **Badges:**
  Use low-opacity tinted backgrounds with vibrant text (`background: rgba(r,g,b, 0.15)`, `color: #rgb`).
- **Icons:**
  Use `lucide-react` with standard sizes (`14px` for inline text, `16-18px` for buttons, `20px` for headers).
