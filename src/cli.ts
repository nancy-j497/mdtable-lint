import { readFileSync } from 'fs';
import { lintText, Finding } from './linter.js';

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
  const files = argv.slice(2);

  if (files.length === 0) {
    process.stderr.write('usage: mdtable-lint <file.md> [file.md ...]\n');
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
