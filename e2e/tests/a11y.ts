import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

/**
 * axe on a page: WCAG 2.2 A and AA. Serious and critical problems fail the test, except the
 * brand colour pairs below.
 */

type AxeResults = Awaited<ReturnType<AxeBuilder['analyze']>>;
type Violation = AxeResults['violations'][number];

/**
 * Colour pairs that fail AA contrast but stay until the owner decides on the brand colours (white
 * on coral is pending). Listed in docs/launch/runbook.md. Anything else that fails contrast fails
 * the test. Pairs are `foreground on background`, as axe reports them.
 */
export const PENDING_CONTRAST: readonly string[] = [
  '#ffffff on #ff5a3c', // white on coral: every coral button (3.09:1)
  '#ffffff on #de3b22', // white on coral-d: expired alert card, expired car panel header (4.41:1)
  '#ffffff on #e56653', // "Needs action" chip on the expired alert card (3.3:1)
  '#ffffff on #ff7157', // sign-up steps on the coral panel (2.7:1)
  '#fff3f1 on #ff7157', // their second lines (2.49:1)
  '#de3b22 on #ffffff', // coral-d links and the active tab on white (4.41:1)
  '#de3b22 on #f4f3f9', // coral-d links on the page background (4:1)
  '#de3b22 on #ffe2dc', // active sidebar item (3.6:1)
  '#de3b22 on #ffe6e0', // soft coral buttons and the site's section tags (3.71:1)
  '#fff5f3 on #ff5a3c', // site: the closing "Get started" section's text (2.89:1)
  '#ffffff on #ff674c', // site: "I have an account" outline button on coral (2.87:1)
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export interface ContrastFinding {
  page: string;
  pair: string;
  ratio: number;
  expected: string;
  target: string;
  text: string;
}

function contrastFindings(page: string, violation: Violation): ContrastFinding[] {
  return violation.nodes.map((node) => {
    const data = (node.any[0]?.data ?? {}) as {
      fgColor?: string;
      bgColor?: string;
      contrastRatio?: number;
      expectedContrastRatio?: string;
    };
    return {
      page,
      pair: `${data.fgColor} on ${data.bgColor}`,
      ratio: data.contrastRatio ?? 0,
      expected: data.expectedContrastRatio ?? '',
      target: node.target.join(' '),
      text: node.html.replace(/\s+/g, ' ').slice(0, 120),
    };
  });
}

/** Runs axe and fails on anything serious or critical that isn't a pending brand colour pair. */
export async function expectAccessible(page: Page, testInfo: TestInfo, name: string) {
  // No hover colours, and let transitions (sheet, modal, toasts) finish, so axe sees the
  // colours at rest.
  await page.mouse.move(0, 0);
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .withTags(TAGS)
    // Illustration, hidden from screen readers: the phone mock-ups (sign-in pages, the site's
    // hero), the floating card beside the app's, and the big faded plates behind cards. WCAG
    // 1.4.3 exempts decoration and text that's part of a picture.
    .exclude('.phone[aria-hidden="true"]')
    .exclude('.art-stage')
    .exclude('.ghost-plate')
    .analyze();

  const blocking: string[] = [];
  const pending: ContrastFinding[] = [];
  for (const violation of results.violations) {
    if (violation.impact !== 'serious' && violation.impact !== 'critical') continue;
    if (violation.id === 'color-contrast') {
      for (const finding of contrastFindings(name, violation)) {
        if (PENDING_CONTRAST.includes(finding.pair)) pending.push(finding);
        else
          blocking.push(
            `color-contrast: ${finding.pair} is ${finding.ratio}:1 (needs ${finding.expected}) at ${finding.target}: ${finding.text}`,
          );
      }
      continue;
    }
    for (const node of violation.nodes) {
      blocking.push(
        `${violation.id} (${violation.impact}): ${violation.help} at ${node.target.join(' ')}`,
      );
    }
  }

  const report = JSON.stringify(
    { page: name, project: testInfo.project.name, url: page.url(), violations: results.violations },
    null,
    2,
  );
  await testInfo.attach(`axe-${name}`, { body: report, contentType: 'application/json' });
  // Every page's findings in one folder, for `pnpm --filter e2e a11y:summary`.
  const dir = join(testInfo.config.rootDir, '..', 'test-results', 'axe');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${testInfo.project.name}--${name}.json`), report);
  expect(blocking, `axe found problems on ${name}`).toEqual([]);
}
