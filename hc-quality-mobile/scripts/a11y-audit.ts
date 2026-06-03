#!/usr/bin/env ts-node
/**
 * HC Quality Mobile — A11y Audit Script
 *
 * Static analysis of React Native source files for common accessibility issues.
 * Outputs a Markdown report to scripts/a11y-audit-report.md
 *
 * Checks performed:
 * 1. TouchableOpacity without accessibilityLabel (icon-only button risk)
 * 2. Interactive elements without accessibilityRole="button"
 * 3. TextInput without accessibilityLabel
 * 4. Image without accessibilityLabel or accessibilityHidden
 * 5. Contrast check: extracts color+backgroundColor from StyleSheet.create blocks,
 *    flags text color pairs below 4.5:1 ratio on their background
 *
 * Severity levels:
 * - HIGH: Missing label on interactive element, screen reader can't describe it
 * - MEDIUM: Missing role (misleads screen reader navigation)
 * - LOW: Informational / best practice
 *
 * Exit codes:
 * - 0: No HIGH severity issues
 * - 1: At least one HIGH severity issue found
 *
 * Usage:
 *   ts-node scripts/a11y-audit.ts
 *   npx ts-node scripts/a11y-audit.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface A11yIssue {
  file: string;
  line: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  checkId: string;
  description: string;
  fix: string;
}

// ── WCAG contrast utilities ───────────────────────────────────────────────────

/**
 * Parse hex color to [r, g, b] (0-255).
 * Returns null for non-hex or rgba strings (contrast not computed).
 */
function parseHex(color: string): [number, number, number] | null {
  const hex = color.replace('#', '').trim();
  if (hex.length === 3) {
    return [
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
    ];
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  return null;
}

/** sRGB linearize */
function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance */
function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.1 contrast ratio (1–21) */
function contrastRatio(fg: string, bg: string): number | null {
  const fgRgb = parseHex(fg);
  const bgRgb = parseHex(bg);
  if (!fgRgb || !bgRgb) return null;

  const l1 = luminance(fgRgb);
  const l2 = luminance(bgRgb);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── File traversal ────────────────────────────────────────────────────────────

function getTsxFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (
        entry.isDirectory() &&
        !['node_modules', '.git', 'build', 'android', 'ios'].includes(entry.name)
      ) {
        walk(full);
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

// ── Checks ────────────────────────────────────────────────────────────────────

const TOUCHABLE_PATTERN = /TouchableOpacity|TouchableHighlight|Pressable/;
const ACCESSIBILITY_LABEL_INLINE = /accessibilityLabel\s*=/;
const ACCESSIBILITY_ROLE_BUTTON = /accessibilityRole\s*=\s*['""]button['"]/;
const TEXT_INPUT_PATTERN = /<TextInput/;
const IMAGE_PATTERN = /<Image\b/;
const ACCESSIBILITY_HIDDEN = /accessibilityElementsHidden|importantForAccessibility\s*=\s*['"]no/;

/** Check 1 & 2: Touchable elements missing accessibilityLabel or accessibilityRole */
function checkTouchables(lines: string[], filePath: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  let inTouchable = false;
  let touchableStart = 0;
  let touchableBlock = '';
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inTouchable && TOUCHABLE_PATTERN.test(line)) {
      inTouchable = true;
      touchableStart = i + 1;
      touchableBlock = line;
      depth = (line.match(/</g) || []).length - (line.match(/>/g) || []).length;
      // Single-line JSX element
      if (line.includes('/>') || depth === 0) {
        analyzeBlock(touchableBlock, touchableStart, filePath, issues);
        inTouchable = false;
        touchableBlock = '';
      }
      continue;
    }

    if (inTouchable) {
      touchableBlock += '\n' + line;
      // Track JSX nesting to find end of the opening tag
      if (line.includes('>') && !line.includes('/>')) {
        analyzeBlock(touchableBlock, touchableStart, filePath, issues);
        inTouchable = false;
        touchableBlock = '';
      } else if (line.includes('/>')) {
        analyzeBlock(touchableBlock, touchableStart, filePath, issues);
        inTouchable = false;
        touchableBlock = '';
      }
    }
  }

  return issues;
}

function analyzeBlock(block: string, lineNum: number, filePath: string, issues: A11yIssue[]) {
  const hasLabel = ACCESSIBILITY_LABEL_INLINE.test(block);
  const hasRole = ACCESSIBILITY_ROLE_BUTTON.test(block);

  if (!hasLabel) {
    issues.push({
      file: filePath,
      line: lineNum,
      severity: 'HIGH',
      checkId: 'TOUCH-LABEL',
      description:
        'TouchableOpacity/Pressable missing accessibilityLabel — screen readers cannot describe this element',
      fix: 'Add accessibilityLabel="Descriptive action text" prop',
    });
  }

  if (!hasRole) {
    issues.push({
      file: filePath,
      line: lineNum,
      severity: 'MEDIUM',
      checkId: 'TOUCH-ROLE',
      description: 'Interactive element missing accessibilityRole="button"',
      fix: 'Add accessibilityRole="button" prop',
    });
  }
}

/** Check 3: TextInput missing accessibilityLabel */
function checkTextInputs(lines: string[], filePath: string): A11yIssue[] {
  const issues: A11yIssue[] = [];
  let inTextInput = false;
  let inputStart = 0;
  let inputBlock = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inTextInput && TEXT_INPUT_PATTERN.test(line)) {
      inTextInput = true;
      inputStart = i + 1;
      inputBlock = line;
      if (line.includes('/>')) {
        if (!ACCESSIBILITY_LABEL_INLINE.test(inputBlock)) {
          issues.push({
            file: filePath,
            line: inputStart,
            severity: 'HIGH',
            checkId: 'INPUT-LABEL',
            description:
              'TextInput missing accessibilityLabel — screen readers announce "text field" with no context',
            fix: 'Add accessibilityLabel="Field description" to the TextInput',
          });
        }
        inTextInput = false;
        inputBlock = '';
      }
      continue;
    }

    if (inTextInput) {
      inputBlock += '\n' + line;
      if (line.includes('/>')) {
        if (!ACCESSIBILITY_LABEL_INLINE.test(inputBlock)) {
          issues.push({
            file: filePath,
            line: inputStart,
            severity: 'HIGH',
            checkId: 'INPUT-LABEL',
            description: 'TextInput missing accessibilityLabel',
            fix: 'Add accessibilityLabel="Field description" to the TextInput',
          });
        }
        inTextInput = false;
        inputBlock = '';
      }
    }
  }

  return issues;
}

/** Check 4: Image missing accessibilityLabel or accessibilityHidden */
function checkImages(lines: string[], filePath: string): A11yIssue[] {
  const issues: A11yIssue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!IMAGE_PATTERN.test(line)) continue;

    // Collect multi-line Image block
    let block = line;
    let j = i + 1;
    while (j < lines.length && !lines[j - 1].includes('/>')) {
      block += '\n' + lines[j];
      j++;
    }

    if (!ACCESSIBILITY_LABEL_INLINE.test(block) && !ACCESSIBILITY_HIDDEN.test(block)) {
      issues.push({
        file: filePath,
        line: i + 1,
        severity: 'MEDIUM',
        checkId: 'IMG-LABEL',
        description: 'Image missing accessibilityLabel or accessibilityElementsHidden',
        fix: 'Add accessibilityLabel="Image description" or accessibilityElementsHidden={true} for decorative images',
      });
    }
  }

  return issues;
}

/**
 * Check 5: Contrast — extract StyleSheet.create color pairs and flag below 4.5:1.
 * Looks for color/backgroundColor combos in the same style rule.
 */
function checkContrast(content: string, filePath: string): A11yIssue[] {
  const issues: A11yIssue[] = [];

  // Extract StyleSheet.create blocks
  const styleBlocks = content.matchAll(/StyleSheet\.create\(\{([\s\S]*?)\}\)/g);

  for (const match of styleBlocks) {
    const block = match[1];
    // Split into individual style rules (rough heuristic)
    const ruleBlocks = block.split(/(?=\s+\w+:\s*\{)/);

    for (const rule of ruleBlocks) {
      const colorMatch = rule.match(/\bcolor\s*:\s*['"]([^'"]+)['"]/);
      const bgMatch = rule.match(/backgroundColor\s*:\s*['"]([^'"]+)['"]/);
      const fontSizeMatch = rule.match(/fontSize\s*:\s*(\d+)/);

      if (!colorMatch || !bgMatch) continue;

      const fg = colorMatch[1];
      const bg = bgMatch[1];
      const fontSize = fontSizeMatch ? parseInt(fontSizeMatch[1]) : 14;

      const ratio = contrastRatio(fg, bg);
      if (ratio === null) continue;

      // WCAG AA: 4.5:1 for normal text (<18px regular or <14px bold), 3:1 for large text
      const threshold = fontSize >= 18 ? 3.0 : 4.5;

      if (ratio < threshold) {
        // Find approximate line number
        const ruleNameMatch = rule.match(/^\s*(\w+)\s*:/);
        const ruleName = ruleNameMatch ? ruleNameMatch[1] : 'unknown';
        const lineNum = content.slice(0, content.indexOf(fg)).split('\n').length;

        issues.push({
          file: filePath,
          line: lineNum,
          severity: ratio < 2.5 ? 'HIGH' : 'MEDIUM',
          checkId: 'CONTRAST',
          description: `Color pair fails WCAG AA: "${fg}" on "${bg}" = ${ratio.toFixed(2)}:1 (required ${threshold}:1) in style "${ruleName}"`,
          fix: `Increase contrast. Suggested: use #b3b3b3 (4.5:1 on #141417) instead of grays like #888, #aaa, #666`,
        });
      }
    }
  }

  return issues;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const srcDir = path.resolve(__dirname, '..', 'src');
  const reportPath = path.resolve(__dirname, 'a11y-audit-report.md');

  if (!fs.existsSync(srcDir)) {
    console.error(`[a11y-audit] src directory not found: ${srcDir}`);
    process.exit(2);
  }

  const files = getTsxFiles(srcDir);
  const allIssues: A11yIssue[] = [];

  console.log(`[a11y-audit] Scanning ${files.length} files in ${srcDir}...`);

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const rel = path.relative(srcDir, file);

    const fileIssues = [
      ...checkTouchables(lines, rel),
      ...checkTextInputs(lines, rel),
      ...checkImages(lines, rel),
      ...checkContrast(content, rel),
    ];

    allIssues.push(...fileIssues);
  }

  const highCount = allIssues.filter((i) => i.severity === 'HIGH').length;
  const mediumCount = allIssues.filter((i) => i.severity === 'MEDIUM').length;
  const lowCount = allIssues.filter((i) => i.severity === 'LOW').length;

  // ── Generate report ─────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const lines: string[] = [
    '# HC Quality Mobile — A11y Audit Report',
    '',
    `**Generated:** ${now}`,
    `**Files scanned:** ${files.length}`,
    `**Total issues:** ${allIssues.length} (HIGH: ${highCount}, MEDIUM: ${mediumCount}, LOW: ${lowCount})`,
    '',
    '## Summary',
    '',
    `| Severity | Count |`,
    `|----------|-------|`,
    `| HIGH     | ${highCount}     |`,
    `| MEDIUM   | ${mediumCount}   |`,
    `| LOW      | ${lowCount}      |`,
    '',
  ];

  if (highCount === 0) {
    lines.push('**No HIGH severity issues found.**', '');
  }

  if (allIssues.length > 0) {
    lines.push('## Issues', '');

    for (const issue of allIssues) {
      lines.push(
        `### [${issue.severity}] ${issue.checkId} — ${issue.file}:${issue.line}`,
        '',
        `**Description:** ${issue.description}`,
        '',
        `**Fix:** ${issue.fix}`,
        '',
        '---',
        '',
      );
    }
  } else {
    lines.push('## No issues found', '', 'All checked files pass a11y audit.');
  }

  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');

  // ── Console output ───────────────────────────────────────────────────────────
  console.log(`\n[a11y-audit] Results:`);
  console.log(`  HIGH:   ${highCount}`);
  console.log(`  MEDIUM: ${mediumCount}`);
  console.log(`  LOW:    ${lowCount}`);
  console.log(`\n[a11y-audit] Report written to: ${reportPath}`);

  if (highCount === 0) {
    console.log('\n✓ A11y audit passed — No HIGH severity issues');
    process.exit(0);
  } else {
    console.error(`\n✗ A11y audit FAILED — ${highCount} HIGH severity issue(s) found`);
    process.exit(1);
  }
}

main();
