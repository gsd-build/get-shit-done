# Org-Mode Style Guide — Agent Quick Reference

Follow these rules when generating `.org` documents. For the full reference, see `@~/.claude/get-my-shit-done/references/org-styleguide-full.org`.

## File Header

Every `.org` file must begin with these lowercase keywords:

```org
#+title: Document Title
#+author: GMSD
#+date: [YYYY-MM-DD]
#+startup: indent
#+options: toc:2 num:nil ^:{}
```

- `#+title:` is required on every file.
- `#+startup: indent` and `#+options: ^:{}` are always included.
- `toc:` depth matches document complexity (2 for most, 3 for long documents).

## Headings

- **Depth**: Maximum 4 levels (`*` through `****`). Deeper nesting means the document needs restructuring.
- **Casing**: Title case for `*` headings, sentence case for `**` and below.
- **Length**: Keep headlines under 60 characters. No trailing punctuation.
- **Spacing**: One blank line before each headline. No blank line between a headline and its first content (property drawers excepted).

```org
* First Section

Paragraph content here.

* Second Section

** Subsection detail
```

## Property Drawers (GMSD Frontmatter)

Property drawers go immediately after the headline — no blank line between.

```org
* Document Title
:PROPERTIES:
:phase: 3
:plan: 01
:must_haves.artifacts: [api-client.ts, types.ts]
:END:
```

**GMSD exception — file-level frontmatter:** SUMMARY, PLAN, and VERIFICATION files place the property drawer at the very top of the file (before the first headline), after the `#+title:`/`#+startup:`/`#+options:` header lines. This is a GMSD convention parsed by `frontmatter.cjs`. The drawer still uses the same key format.

```org
#+title: Phase 3: Auth Summary
#+startup: indent
#+options: toc:2 num:nil ^:{}

:PROPERTIES:
:phase: 03-auth
:plan: 01
:subsystem: authentication
:END:

* Phase 3: Auth Summary
```

- Keys are **lowercase** with underscores (`:phase:`, `:files_modified:`).
- Use **dot-notation** for nested values (`:must_haves.artifacts:`).
- Arrays use bracket syntax: `[item1, item2]`.
- Commas inside quoted values are preserved: `["hello, world", other]`.
- GMSD schemas — required fields:
  - **plan**: phase, plan, type, wave, depends_on, files_modified, autonomous, must_haves
  - **summary**: phase, plan, subsystem, tags, duration, completed
  - **verification**: phase, verified, status, score

## Text Markup

| Markup      | Use for                                    |
|-------------+--------------------------------------------|
| `~code~`    | Code fragments, function names, variables  |
| `=verbatim=`| Paths, filenames, commands, keystrokes     |
| `*bold*`    | Key terms, strong emphasis                 |
| `/italic/`  | Titles, soft emphasis                      |

- Never nest emphasis markers (`*bold /italic/*` is unreliable).
- Emphasis must be surrounded by whitespace or punctuation.
- Do not use backticks — they have no special meaning in org.

## Lists

- Use `-` (hyphen) as the only bullet character. Do not mix `-`, `+`, `*`.
- Indent continuation lines 2 spaces (aligned to item text start).
- Description lists: `- Term :: Definition text`.
- Checkboxes: `- [ ]`, `- [X]`, `- [-]`.

## Tables

- Horizontal rule after the header row: `|---+---|`.
- Keep cell content concise; long text belongs in surrounding prose.
- Use `#+CAPTION:` and `#+NAME:` for referenceable tables.

```org
#+CAPTION: Phase requirements mapping
#+NAME: tab:requirements
| Requirement | Phase | Status   |
|-------------+-------+----------|
| Auth flow   |     2 | Complete |
```

## Source Code Blocks

- Always specify the language: `#+begin_src python`.
- Keep blocks under 30 lines. Extract longer code to files.
- Name important blocks with `#+name:` and `#+description:`.
- Use `#+begin_src mermaid :file name.png :exports results` for diagrams (ob-mermaid).
- Lowercase for `#+begin_src` / `#+end_src` keywords.

```org
#+name: auth-flow
#+description: Authentication sequence
#+begin_src mermaid :file auth-flow.png :exports results
sequenceDiagram
    User->>API: POST /login
    API-->>User: JWT token
#+end_src
```

## Links

- Always provide a description: `[[https://example.com][Example Site]]`.
- Use relative paths for project files: `[[file:./images/diagram.png]]`.
- For internal cross-references, use `CUSTOM_ID`:

```org
* Target Section
:PROPERTIES:
:CUSTOM_ID: target-section
:END:

See [[#target-section][the target section]].
```

## Whitespace and Formatting

- Use spaces, not tabs, for indentation.
- Wrap prose at 78 characters (do not wrap inside tables, links, or source blocks).
- One blank line between sections. Never two consecutive blank lines.
- No trailing blank lines at end of sections.
- End files with a single newline.
- Remove trailing whitespace.

## Quotes and Examples

- Quote blocks: `#+BEGIN_QUOTE` / `#+END_QUOTE` (uppercase for these block types).
- Example blocks: `#+BEGIN_EXAMPLE` / `#+END_EXAMPLE` for preformatted non-code text.

## Common Mistakes to Avoid

- Missing blank line before a headline (required for unambiguous parsing).
- Forgetting language on `#+begin_src` blocks (no syntax highlighting without it).
- Using backticks instead of `~code~` or `=verbatim=`.
- Nesting emphasis markers.
- Using `a_b` without `^:{}` option (interpreted as subscript).
