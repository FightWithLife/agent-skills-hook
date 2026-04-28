---
name: pclxl-protocol-guard
description: Protocol compliance assistant for PCL XL (PCL6) / PJL development. Use when modifying PCL XL/PCL6/PJL parsing, operators, attributes, tags, enumerations, media handling, imaging, or font download logic, especially under PCL_XL/, pl/, PJL/, or related modules.
---

# PCL XL Protocol Guard

## Overview
Ensure code changes that affect PCL XL/PJL behavior stay aligned with the protocol docs in this repo.

## Quick start
1) Run scripts/pclxl_diff_scan.sh from repo root (or inspect git diff) to see if changes touch PCL XL/PJL.
2) Map the change to operators/attributes/data types/tags.
3) Confirm rules and enumerations in docs/tech (and docs/tech_zh if you want Chinese).
4) If markdown tables are incomplete, open the relevant PDFs.

## Workflow: protocol confirmation

### 1) Identify scope
- Determine which files changed (paths under PCL_XL/, pl/, PJL/, or protocol tag tables).
- Determine protocol class (2.0 core vs 2.1/3.0 supplements).
- Determine area (session/page, graphics state, painting, imaging, fonts, streams, PJL).

### 2) Map to operator(s)/attributes
- Extract operator and attribute names from the diff.
- Find the operator module in docs/tech/pclxl2/*_operators.md.
- Record required/optional attributes, data types, and constraints.

### 3) Validate enumerations and IDs
- Check attribute IDs: docs/tech/pclxl2/90_attribute_id_table.md
- Check attribute data types: docs/tech/pclxl2/91_attribute_data_types.md
- Check enumerations: docs/tech/pclxl2/92_attribute_enumerations.md
- Check operator tags: docs/tech/pclxl2/93_operator_tag_values.md
- Check data type tags: docs/tech/pclxl2/94_data_type_tag_values.md
- Check binary stream tags: docs/tech/pclxl2/95_binary_stream_tag_values.md
Note: SetPaintTxMode and SetPatternTxMode share a tag in PCL XL 2.0.

### 4) Validate sequencing and embedded data
- Validate Begin*/Read*/End* sequences (Image, RastPattern, FontHeader/Char, Stream).
- Enforce embedded data length rules (BlockByteLength vs embedded length, <=64KB chunks).
- Confirm required attributes are present in the parser/encoder logic.

### 5) Conditional checks
- Media/page handling: docs/tech/pclxl_paper_handling.md (and ERS PDF).
- Fonts: docs/tech/pclxl_fonts/* (and TrueType/font download PDFs).
- PJL wrapper: docs/tech/pjl_overview.md and docs/tech/pjl_command_summary.md.
- PJL status codes: docs/tech/pjl_status_codes.md.

### 6) Supplements (2.1 / 3.0)
- Check docs/tech/pclxl_supplements/*.md, but expect missing fields.
- Cross-check against supplement PDFs for authoritative details.

### 7) Record compliance
Provide a short Protocol Compliance Note in your response:
- Touched operators/attributes
- Docs consulted (file paths)
- Constraints validated
- Open questions or spec gaps

## Resources
- references/pclxl_docs_index.md
- scripts/pclxl_diff_scan.sh
