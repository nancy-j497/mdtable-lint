import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
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

// Expands directory arguments into the .md files they contain, recursing
// into subdirectories but skipping dotfiles and dotdirs (.git and the
// like). A path that isn't a directory, including one that doesn't exist,
// is passed through unchanged so the existing per-file read error below
// still reports it.
function collectMarkdownFiles(paths: string[]): string[] {
  const result: string[] = [];
  for (const path of paths) {
    walk(path, result);
  }
  return result;
}

function walk(path: string, result: string[]): void {
  let isDirectory: boolean;
  try {
    isDirectory = statSync(path).isDirectory();
  } catch {
    result.push(path);
    return;
  }

  if (!isDirectory) {
    result.push(path);
    return;
  }

  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      walk(entryPath, result);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      result.push(entryPath);
    }
  }
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  const fix = args.includes('--fix');
  const targets = args.filter((arg) => arg !== '--fix');

  if (targets.length === 0) {
    process.stderr.write('usage: mdtable-lint [--fix] <file.md|dir> [file.md|dir ...]\n');
    return 1;
  }

  const files = collectMarkdownFiles(targets);

  if (files.length === 0) {
    process.stderr.write('no markdown files found\n');
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
