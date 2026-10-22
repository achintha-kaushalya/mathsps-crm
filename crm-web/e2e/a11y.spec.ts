import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('M12 Accessibility Audit Suite (WCAG 2.1 AA Compliance)', () => {

  test('A11y Audit: Public /login page accessibility scan', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Run axe accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    // Filter out minor color-contrast edge cases if dynamic themes are present, assert 0 critical/serious violations
    const seriousViolations = accessibilityScanResults.violations.filter(
      v => v.impact === 'critical' || v.impact === 'serious'
    )

    if (seriousViolations.length > 0) {
      console.warn('A11y Serious Violations on /login:', JSON.stringify(seriousViolations, null, 2))
    }

    expect(seriousViolations.length).toBe(0)
  })

  test('A11y Audit: Focus management & keyboard navigation on /login', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Verify key form elements are keyboard accessible
    const emailInput = page.locator('input[type="email"]')
    const passwordInput = page.locator('input[type="password"]')
    const submitBtn = page.locator('button[type="submit"]')

    await expect(emailInput).toBeVisible()
    await expect(passwordInput).toBeVisible()
    await expect(submitBtn).toBeVisible()

    // Test tab navigation
    await emailInput.focus()
    await page.keyboard.press('Tab')
    await expect(passwordInput).toBeFocused()
  })

  test('A11y Audit: Redirect to login from protected route preserves accessibility', async ({ page }) => {
    // Unauthenticated user requesting /dashboard gets redirected to /login
    await page.goto('/dashboard')
    await page.waitForURL('**/login')

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()

    const criticalViolations = accessibilityScanResults.violations.filter(v => v.impact === 'critical')
    expect(criticalViolations.length).toBe(0)
  })
})
