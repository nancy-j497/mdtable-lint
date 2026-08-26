# mdtable-lint

A linter for markdown tables. It parses pipe tables out of a `.md` file and
checks that the structure actually holds together: the separator row is
valid, every row has the same number of columns as the header, and headers
aren't blank.

## Why

Markdown tables have no real grammar enforcement. If a row has one fewer
`|` than the header, most renderers just quietly misalign the columns
instead of complaining, and you don't notice until someone reads the
rendered page. Editors don't catch it either, because a table is just text
to them. This tool actually parses the table and tells you which row is
short, and exactly where.

## Usage

```
npm run build
node dist/cli.js docs/README.md notes.md
```

It exits with status 1 if any file has an error-level finding, so it's
usable as a pre-commit or CI check. Given this file:

```markdown
| Name | Age | City |
| --- | --- |
| Alice | 30 | Paris |
```

the header defines three columns but the separator row only defines two.
Running the linter on it produces:

```
example.md:2:14: error: separator row has 2 columns but header has 3 [table-column-count-mismatch]
  |
2 | | --- | --- |
  |              ^
```

The column always points at the exact spot the problem lives, whether
that's a missing column at the end of a short row or the first cell of a
row that has too many.

## Rules

- `table-column-count-mismatch` (error) — a separator or body row doesn't
  have the same number of cells as the header.
- `table-invalid-separator` (error) — a separator cell contains something
  other than `-` and an optional leading/trailing `:`.
- `table-empty-header-cell` (warning) — a header cell is blank.

A block of lines only counts as a table if a candidate header row (two or
more `|`-separated cells) is immediately followed by a line made up only of
`-`, `:`, `|`, and whitespace. Anything inside a fenced code block
(` ``` ` or `~~~`) is ignored, so example tables in documentation about
markdown don't get linted as if they were real.

## Design notes

There are no runtime dependencies. The row splitter in `src/linter.ts`
walks each line by hand, tracking the character offset of every cell so
that findings can report a precise column instead of just a line number.
Escaped pipes (`\|`) are treated as literal characters, not delimiters.

## Known limitations

Single-column tables (`| A |` / `| - |` / `| B |`) aren't detected yet,
since the header-detection heuristic requires at least two cells to avoid
false positives on stray pipes in prose. Table alignment (`:---`, `---:`,
`:---:`) is accepted but not currently checked against how cells are
actually used.
