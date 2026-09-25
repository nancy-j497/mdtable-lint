import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintText, fixText, Finding } from './linter.js';

function rules(findings: Finding[]): string[] {
  return findings.map((f) => f.rule);
}

test('a well-formed table produces no findings', () => {
  const text = ['| Name | Age |', '| --- | --- |', '| Alice | 30 |'].join('\n');
  assert.deepEqual(lintText(text), []);
});

test('a short body row is flagged with the column just past the end of the line', () => {
  const text = ['| Name | Age | City |', '| --- | --- | --- |', '| Alice | 30 |'].join('\n');
  const findings = lintText(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-column-count-mismatch');
  assert.equal(findings[0].severity, 'error');
  assert.equal(findings[0].line, 3);
  assert.equal(findings[0].column, '| Alice | 30 |'.length + 1);
});

test('a long body row is flagged at the first extra cell', () => {
  const text = ['| Name | Age |', '| --- | --- |', '| Alice | 30 | Paris |'].join('\n');
  const findings = lintText(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-column-count-mismatch');
  // "| Alice | 30 | " is 15 characters, so the extra cell "Paris " starts at column 16.
  assert.equal(findings[0].column, 16);
});

test('a short separator row is flagged against the header count', () => {
  const text = ['| Name | Age | City |', '| --- | --- |', '| Alice | 30 | Paris |'].join('\n');
  const findings = lintText(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-column-count-mismatch');
  assert.equal(findings[0].message, 'separator row has 2 columns but header has 3');
  assert.equal(findings[0].line, 2);
});

test('an invalid separator cell is flagged', () => {
  const text = ['| Name | Age |', '| --- | xxx |', '| Alice | 30 |'].join('\n');
  const findings = lintText(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-invalid-separator');
  assert.equal(findings[0].line, 2);
});

test('an empty header cell is flagged', () => {
  const text = ['| Name | |', '| --- | --- |', '| Alice | 30 |'].join('\n');
  const findings = lintText(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-empty-header-cell');
  assert.equal(findings[0].line, 1);
});

test('two tables with the same header text but different alignment are flagged', () => {
  const text = [
    '| Name | Age |',
    '| --- | --- |',
    '| Alice | 30 |',
    '',
    '| Name | Age |',
    '| --- | ---: |',
    '| Bob | 40 |',
  ].join('\n');
  const findings = lintText(text);

  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, 'table-alignment-inconsistent');
  assert.equal(findings[0].line, 5);
  assert.match(findings[0].message, /right-aligned here but left-aligned by default in the matching table at line 1/);
});

test('a leading colon alone does not count as an alignment change', () => {
  const text = ['| Name |', '| --- |', '| Alice |', '', '| Name |', '| :-- |', '| Bob |'].join('\n');
  assert.deepEqual(lintText(text), []);
});

test('a single-column table framed by pipes is recognized', () => {
  const text = ['| Name |', '| --- |', '| Alice |', '| Bob |'].join('\n');
  assert.deepEqual(lintText(text), []);
});

test('a thematic break under plain text is not mistaken for a single-column table', () => {
  const text = ['Some heading', '---', 'Some paragraph.'].join('\n');
  assert.deepEqual(lintText(text), []);
});

test('tables inside a fenced code block are ignored', () => {
  const text = ['```markdown', '| Name | Age |', '| --- |', '| Alice | 30 |', '```'].join('\n');
  assert.deepEqual(lintText(text), []);
});

test('an escaped pipe does not split a cell', () => {
  const text = ['| Name | Note |', '| --- | --- |', String.raw`| Alice | a \| b |`].join('\n');
  assert.deepEqual(lintText(text), []);
});

test('fixText pads a short separator row and a short body row', () => {
  const text = ['| Name | Age | City |', '| --- | --- |', '| Alice | 30 |'].join('\n');
  const { text: fixed, fixedCount } = fixText(text);

  assert.equal(fixedCount, 2);
  assert.deepEqual(lintText(fixed), []);
  assert.equal(fixed.split('\n')[1], '| --- | --- | --- |');
  assert.equal(fixed.split('\n')[2], '| Alice | 30 |  |');
});

test('fixText leaves long rows untouched', () => {
  const text = ['| Name | Age |', '| --- | --- |', '| Alice | 30 | Paris |'].join('\n');
  const { text: fixed, fixedCount } = fixText(text);

  assert.equal(fixedCount, 0);
  assert.equal(fixed, text);
  assert.equal(rules(lintText(fixed)).length, 1);
});

test('fixText preserves CRLF line endings', () => {
  const text = ['| Name | Age |', '| --- |', '| Alice | 30 |'].join('\r\n');
  const { text: fixed } = fixText(text);

  assert.ok(fixed.includes('\r\n'));
  assert.equal(fixed.split('\r\n')[1], '| --- | --- |');
});
