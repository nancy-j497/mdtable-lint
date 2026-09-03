export type Severity = 'error' | 'warning';

export interface Finding {
  rule: string;
  severity: Severity;
  message: string;
  line: number;
  column: number;
}

interface Cell {
  text: string;
  column: number;
}

const SEPARATOR_CELL = /^:?-+:?$/;
const SEPARATOR_LINE_CHARS = /^[\s|:-]+$/;
const FENCE = /^\s*(```|~~~)/;

export function lintText(text: string): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split(/\r\n|\r|\n/);
  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (FENCE.test(line)) {
      inFence = !inFence;
      i++;
      continue;
    }
    if (inFence) {
      i++;
      continue;
    }

    const headerCells = splitTableRow(line);
    const nextLine = lines[i + 1];

    // A table needs either two or more header cells, or exactly one
    // cell framed by a leading and trailing pipe (a single-column
    // table), plus a delimiter row directly underneath, e.g.
    // "| --- | --- |" or "| - |". A bare word followed by a "---"
    // thematic break or setext heading underline must not match, so
    // the single-column case additionally requires the delimiter row
    // itself to be pipe-framed rather than just dash characters.
    const isCandidateHeader = headerCells.length >= 2 || isFramedSingleColumn(line, headerCells);

    if (isCandidateHeader && nextLine !== undefined && looksLikeSeparatorLine(nextLine)) {
      const separatorShapeMatches =
        headerCells.length >= 2 || isFramedSingleColumn(nextLine, splitTableRow(nextLine));

      if (separatorShapeMatches) {
        i = lintTable(lines, i, headerCells, findings);
        continue;
      }
    }

    i++;
  }

  return findings;
}

function lintTable(lines: string[], start: number, headerCells: Cell[], findings: Finding[]): number {
  const headerLineNo = start + 1;
  const separatorLineNo = start + 2;
  const separatorLine = lines[start + 1];
  const separatorCells = splitTableRow(separatorLine);
  const expected = headerCells.length;

  for (const cell of headerCells) {
    if (cell.text === '') {
      findings.push({
        rule: 'table-empty-header-cell',
        severity: 'warning',
        message: 'header has an empty column name',
        line: headerLineNo,
        column: cell.column,
      });
    }
  }

  for (const cell of separatorCells) {
    if (!SEPARATOR_CELL.test(cell.text)) {
      findings.push({
        rule: 'table-invalid-separator',
        severity: 'error',
        message: `separator cell "${cell.text}" must contain only "-" and an optional leading/trailing ":"`,
        line: separatorLineNo,
        column: cell.column,
      });
    }
  }

  checkColumnCount(separatorCells, expected, separatorLine, separatorLineNo, 'separator row', findings);

  let row = start + 2;
  while (row < lines.length) {
    const rowLine = lines[row];
    if (FENCE.test(rowLine) || rowLine.trim() === '' || !rowLine.includes('|')) {
      break;
    }
    const rowCells = splitTableRow(rowLine);
    checkColumnCount(rowCells, expected, rowLine, row + 1, 'row', findings);
    row++;
  }

  return row;
}

function checkColumnCount(
  cells: Cell[],
  expected: number,
  line: string,
  lineNo: number,
  label: string,
  findings: Finding[]
): void {
  if (cells.length === expected) {
    return;
  }
  if (cells.length < expected) {
    // Point just past the end of the line: that is where the missing
    // column would need to start.
    findings.push({
      rule: 'table-column-count-mismatch',
      severity: 'error',
      message: `${label} has ${cells.length} column${cells.length === 1 ? '' : 's'} but header has ${expected}`,
      line: lineNo,
      column: line.length + 1,
    });
    return;
  }
  const extraCell = cells[expected];
  findings.push({
    rule: 'table-column-count-mismatch',
    severity: 'error',
    message: `${label} has ${cells.length} columns but header has ${expected}`,
    line: lineNo,
    column: extraCell.column,
  });
}

function looksLikeSeparatorLine(line: string): boolean {
  return SEPARATOR_LINE_CHARS.test(line) && line.includes('-');
}

// A single-column row only reads as a table row, rather than plain
// text, when it is actually framed by a pipe on each side (e.g.
// "| A |"). Without that framing there is nothing distinguishing it
// from a normal line, so a lone unpiped word must never qualify.
function isFramedSingleColumn(line: string, cells: Cell[]): boolean {
  return cells.length === 1 && countUnescapedPipes(line) === 2;
}

function countUnescapedPipes(line: string): number {
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') {
      i++; // skip the escaped character, including an escaped pipe
      continue;
    }
    if (line[i] === '|') {
      count++;
    }
  }
  return count;
}

// Splits a pipe-delimited row into cells and records the exact column
// of each one, so a rule can point at the cell that is actually wrong
// instead of just the start of the line. A pipe that only wraps the
// row (a leading or trailing "|") does not create an extra empty
// cell; a pipe pair with nothing but whitespace between them does,
// since that is a genuinely empty cell.
function splitTableRow(line: string): Cell[] {
  const segments: { start: number; end: number }[] = [];
  let segStart = 0;

  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\') {
      i++; // skip the escaped character, including an escaped pipe
      continue;
    }
    if (line[i] === '|') {
      segments.push({ start: segStart, end: i });
      segStart = i + 1;
    }
  }
  segments.push({ start: segStart, end: line.length });

  if (segments.length > 1 && isBlankSegment(line, segments[0])) {
    segments.shift();
  }
  if (segments.length > 1 && isBlankSegment(line, segments[segments.length - 1])) {
    segments.pop();
  }

  return segments.map((seg) => {
    const raw = line.slice(seg.start, seg.end);
    const leadingWs = raw.length - raw.trimStart().length;
    return {
      text: raw.trim(),
      column: seg.start + leadingWs + 1,
    };
  });
}

function isBlankSegment(line: string, seg: { start: number; end: number }): boolean {
  return line.slice(seg.start, seg.end).trim() === '';
}
