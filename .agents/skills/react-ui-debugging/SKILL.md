---
name: react-ui-debugging
description: Strict debugging workflow and guidelines for React & Next.js UI rendering issues. Eliminates repetitive cache-blaming loops, enforces the 2-attempt rule, handles Portal/wrapper abstraction conflicts, and mandates instant component isolation.
---

# React & Next.js UI Troubleshooting & Anti-Looping Skill

This skill enforces strict procedural debugging whenever a UI change (styling, layout, modal, button, or typography) does not visibly reflect in the browser as expected.

---

## 1. The Cardinal "Two-Attempt Rule"
> [!IMPORTANT]
> **If a CSS/UI modification fails to appear in the browser after TWO attempts, you are STRICTLY PROHIBITED from blaming browser cache, hard reloads, or repeating CSS tweaks.**
>
> You MUST assume a code architecture conflict (e.g., Parent wrapper override, Portal detachment, duplicate component collision, or nested styling precedence) and immediately proceed to **Component Isolation**.

---

## 2. Mandatory 4-Step Diagnostic Protocol

Whenever a UI edit does not reflect:

### Step 1: Trace the Render Pipeline
- Do NOT edit CSS blindly. Check where the component actually renders.
- Is it rendered through a `createPortal(..., document.body)`?
- Is there a parent wrapper (e.g., `<AlertDialog>`, `<DialogContent>`, `<Card>`) injecting hardcoded inline styles or default utility classes that override child props?

### Step 2: Component Isolation (Flatten the Abstraction)
- If a subcomponent from `@/components/ui/*` fails to style cleanly:
  1. **Bypass the component wrapper.**
  2. Implement the element directly and self-contained inside the consuming page (e.g., direct `<div style={{...}}>` or direct Tailwind classes).
  3. Ensure it has no external portal or foreign layout dependencies blocking layout calculation.

### Step 3: Verify the Real DOM Node
- Confirm the exact DOM node output:
  - Is the class or inline style reaching the DOM?
  - If NOT reaching the DOM: The component being edited is either not mounted, an entirely different component is rendered, or conditional rendering (`open && ...`) is preventing evaluation.
  - If IN the DOM but visually inactive: A higher CSS specificity rule (e.g., `!important`, CSS reset, or parent `z-index`) is suppressing it.

### Step 4: Validate Next.js Turbopack / SSR State
- If running Next.js App Router:
  - Check whether the component is a Client Component (`'use client'`).
  - If a production build is needed to bypass Turbopack dev memory chunks, run:
    ```bash
    rm -rf .next && npm run build && npm run start
    ```
  - Verify that no hydration errors are resetting the DOM tree back to server defaults.

---

## 3. Best Practices for Modals & Overlays

1. **Self-Contained Modals First:**
   - When building page-specific alerts or confirmations (like lead deletion, student status change), avoid generic global modal abstractions unless already battle-tested.
   - Use direct fixed overlays with `zIndex: 99999` and scoped glassmorphic styles.

2. **Prop Transparency:**
   - Every UI wrapper component in `@/components/ui/` MUST merge `style` and `className` properly:
     ```tsx
     // Correct
     <div className={cn("default-classes", className)} style={{ ...defaultStyles, ...style }}>
     ```
   - Never hardcode background colors or border radii without allowing override via props.

3. **Page Colocation Pattern:**
   - If a modal is only used by `/leads`, keep its logic colocated in the page or inside a local folder `(app)/leads/_components/`, preventing global styling leakage.
