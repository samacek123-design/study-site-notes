---
name: process-notes
description: Ingest new files dropped in inbox/ (lecture slides, tutorial notes, past exam papers, clinical notes) and turn them into cross-linked revision notes in the Quartz/Obsidian vault at content/. Run this after adding files to inbox/.
allowed-tools: Read Write Edit Bash Grep Glob
---

# process-notes

Turns whatever landed in `inbox/` into polished notes in `content/` (the
Obsidian vault Quartz publishes from). Run from the `~/study-site` repo
root: `/process-notes`.

## Step 1 — find new/changed files

```bash
cd ~/study-site
python3 - <<'PY'
import hashlib, json, os

manifest_path = "inbox/.processed.json"
manifest = json.load(open(manifest_path))

new_or_changed = []
for root, dirs, files in os.walk("inbox"):
    dirs[:] = [d for d in dirs if not d.startswith((".", "_"))]
    for f in files:
        if f.startswith("."):
            continue
        rel = os.path.relpath(os.path.join(root, f), "inbox")
        digest = hashlib.sha256(open(os.path.join(root, f), "rb").read()).hexdigest()
        if manifest.get(rel) != digest:
            new_or_changed.append(rel)

print("\n".join(new_or_changed) if new_or_changed else "NONE")
PY
```

If output is `NONE`, tell the user nothing new was found and stop here.

## Step 2 — convert to markdown

For each new/changed file that isn't already `.md`/`.txt`, convert it with
the `markitdown` skill's CLI (already installed):

```bash
mkdir -p inbox/_converted
markitdown "inbox/<file>" -o "inbox/_converted/<file-without-ext>.md"
```

Files already in `.md`/`.txt` can be read directly with the Read tool — no
conversion needed.

## Step 3 — classify each file

For each converted/raw file, read its content and decide:
- **Subject** (e.g. `Cardiology`, `Respiratory`) — infer from filename/folder
  or the document's own heading. If genuinely ambiguous, ask the user.
- **Topic** — the specific lecture/concept it covers.
- **Kind** — one of: `lecture`, `tutorial`, `past-exam`, `clinical-note`,
  `guide`.

Before writing anything, `Grep` `content/**/*.md` for existing notes whose
title/H1 matches or is closely related to this topic — this tells you
whether to create a new note or update an existing one, and which existing
note titles to `[[wikilink]]` to.

## Step 4 — write/update the note

Path: `content/<Subject>/<Topic>.md`. Use this structure (fill in from the
source material — don't leave placeholder text):

```markdown
---
title: <Topic>
tags: [<Subject>]
---

# <Topic>

<One or two sentence summary.>

## Key Concepts

<Concise, well-organized revision notes. Use headings per subtopic. Link
related concepts inline as [[Other Note Title]] wherever content/ already
has a note on that concept — do not invent links to notes that don't exist.>

## Tutorial Notes

<Only include this section if a tutorial file for this exact topic was in
the batch — merge it in here rather than creating a second page. Omit the
whole section if there's no tutorial content.>

## Mind Map

```mermaid
mindmap
  root((<Topic>))
    <Subtopic 1>
      <Sub-point>
    <Subtopic 2>
      <Sub-point>
```

## Practice Questions

> [!question]- Q1: <question>
> <answer>

> [!question]- Q2: <question>
> <answer>

<5-8 questions total, generated from the note's own content.>

## Past Exam Questions

> [!exam] <Source/Year>
> <verbatim question text from the past paper>

<Only include this section, and only add entries, when an actual past-exam
file in this batch covers this topic. Never fabricate exam questions.>
```

If updating an existing note instead of creating one: merge new material
into the right section rather than duplicating — e.g. append new past-exam
questions to the existing callout list, fold overlapping revision content
together instead of repeating it.

## Step 5 — update the subject index

`content/<Subject>/index.md` should list/link every note in that subject
(create it if this is the first note in a new subject). Simple bullet list
of `[[Topic]]` links is enough.

## Step 6 — record progress and commit

```bash
python3 - <<'PY'
import hashlib, json, os

manifest_path = "inbox/.processed.json"
manifest = json.load(open(manifest_path))

for rel in [<list of files you just processed, relative to inbox/>]:
    digest = hashlib.sha256(open(os.path.join("inbox", rel), "rb").read()).hexdigest()
    manifest[rel] = digest

json.dump(manifest, open(manifest_path, "w"), indent=2)
PY

git add -A
git commit -m "process-notes: processed <N> file(s)"
```

## Step 7 — tell the user what happened

Summarize: which notes were created vs. updated, which subject indexes
changed, and remind them they can preview with `npx quartz build --serve`.
