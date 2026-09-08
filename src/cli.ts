import { readFileSync, writeFileSync } from 'fs';
import { lintText, fixText, Finding } from './linter.js';

function formatFinding(file: string, finding: Finding, lines: string[]): string {
  const header = `${file}:${finding.line}:${finding.column}: ${finding.severity}: ${finding.message} [${finding.rule}]`;
  const sourceLine = lines[finding.line - 1] ?? '';
  const gutter = ' '.repeat(String(finding.line).length);
  const caretOffset = Math.max(0, finding.column - 1);

  return [
    header,
    `${gutter} |`,
    `${finding.line} | ${sourceLine}`,
    `${gutter} | ${' '.repeat(caretOffset)}^`,
  ].join('\n');
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  const fix = args.includes('--fix');
  const files = args.filter((arg) => arg !== '--fix');

  if (files.length === 0) {
    process.stderr.write('usage: mdtable-lint [--fix] <file.md> [file.md ...]\n');
    return 1;
  }

  let hasErrors = false;

  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch (err) {
      process.stderr.write(`${file}: could not read file (${(err as Error).message})\n`);
      hasErrors = true;
      continue;
    }

    if (fix) {
      const fixed = fixText(text);
      if (fixed.fixedCount > 0) {
        writeFileSync(file, fixed.text, 'utf8');
        process.stdout.write(`${file}: padded ${fixed.fixedCount} short row${fixed.fixedCount === 1 ? '' : 's'}\n`);
      } else {
        process.stdout.write(`${file}: no short rows found\n`);
      }
      continue;
    }

    const lines = text.split(/\r\n|\r|\n/);
    const findings = lintText(text);

    for (const finding of findings) {
      process.stdout.write(formatFinding(file, finding, lines) + '\n\n');
      if (finding.severity === 'error') {
        hasErrors = true;
      }
    }
  }

  return hasErrors ? 1 : 0;
}

process.exit(main(process.argv));
