---
name: protocol-semantic-guard
description: Semantic guard for protocol and instruction-set related code changes. Use when modifying wire protocols, command encodings, parser tables, tags, attributes, enumerations, media handling, imaging, or font download logic, especially when a repository has domain-specific semantic-maintenance skills.
---

# Protocol Semantic Guard

## Overview
Ensure code changes that affect protocol or instruction-set behavior stay aligned with the semantic docs in this repo or in any repository-local domain guard skill.

## Quick start
1) Inspect the diff to see whether the change touches a protocol, instruction set, or wire-format parser/encoder.
2) If the repository has a matching semantic-maintenance skill for that protocol or instruction set, load it and follow it.
3) Map the change to operators/commands/attributes/data types/tags/IDs.
4) Confirm rules, enumerations, and sequencing in the authoritative docs for that domain.
5) If markdown tables are incomplete, open the relevant PDFs or source specifications.

## Workflow: semantic confirmation

### 1) Identify scope
- Determine which files changed and which semantic layer they belong to.
- Determine whether the change affects parsing, encoding, validation, sequencing, or reporting.
- Determine whether the change crosses subsystem boundaries such as session/page, graphics state, imaging, fonts, streams, or wrapper protocols.

### 2) Map to operator(s)/attributes
- Extract operator, command, and attribute names from the diff.
- Find the relevant domain docs or tables for the affected instruction set.
- Record required/optional fields, data types, constraints, and side effects.

### 3) Validate enumerations and IDs
- Check IDs, tags, enums, and data types against the authoritative tables for the domain.
- Verify any aliasing or shared tags/IDs before changing parser or encoder logic.

### 4) Validate sequencing and embedded data
- Validate begin/read/end or open/close sequences where the protocol uses them.
- Enforce embedded data length rules, chunking rules, and framing constraints.
- Confirm required fields are present in the parser or encoder logic.

### 5) Conditional checks
- Media or page handling: consult the domain docs that govern layout, sheets, or job control.
- Fonts: consult the domain docs that govern glyphs, downloads, or font tables.
- Wrapper protocols: consult the wrapper or transport docs if the command stream is nested.
- Status or error codes: consult the domain's status-code reference.

### 6) Supplements (2.1 / 3.0)
- Check any supplement or revision docs for the same instruction set, but expect missing fields.
- Cross-check against supplement PDFs or source specs for authoritative details.

### 7) Record compliance
Provide a short Protocol Compliance Note in your response:
- Touched operators/commands/attributes
- Docs consulted (file paths)
- Constraints validated
- Open questions or spec gaps

## Resources
- references to the current protocol docs or spec index
- any repository-local diff or semantic scan helper
