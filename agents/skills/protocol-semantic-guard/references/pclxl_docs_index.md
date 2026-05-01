# PCL XL / PJL Docs Index (repo-local)

This skill assumes the PCL6 repo is at:
- /home/yang/code/pcl6/PCL6
Adjust paths if your checkout is elsewhere.

## PCL XL 2.0 operator reference (core)
- docs/tech/pclxl2/10_session_operators.md
- docs/tech/pclxl2/20_font_control_operators.md
- docs/tech/pclxl2/30_graphics_state_operators.md
- docs/tech/pclxl2/40_painting_operators.md
- docs/tech/pclxl2/50_user_defined_streams.md

## PCL XL 2.0 tables / tags
- docs/tech/pclxl2/90_attribute_id_table.md
- docs/tech/pclxl2/91_attribute_data_types.md
- docs/tech/pclxl2/92_attribute_enumerations.md
- docs/tech/pclxl2/93_operator_tag_values.md
- docs/tech/pclxl2/94_data_type_tag_values.md
- docs/tech/pclxl2/95_binary_stream_tag_values.md

## Supplements (Protocol Class 2.1 / 3.0)
- docs/tech/pclxl_supplements/pclxl_2_1_operators.md
- docs/tech/pclxl_supplements/pclxl_2_1_attribute_enumerations.md
- docs/tech/pclxl_supplements/pclxl_3_0_operators.md
- docs/tech/pclxl_supplements/pclxl_3_0_attribute_enumerations.md
Note: these supplement markdown files are sparse; cross-check PDFs:
- docs/PCL6_XL_Feature Ref Protocol Class 2x1 supplement.pdf
- docs/PCL6_XL_Feature Ref Protocol Class 3x0 supplement.pdf

## Paper handling / media (BeginPage attributes)
- docs/tech/pclxl_paper_handling.md
- docs/PCL6_XL_Page-Handling-ERS.pdf

## Fonts / soft font download
- docs/tech/pclxl_fonts/soft_font_download.md
- docs/tech/pclxl_fonts/xlttlib.md
- docs/PCL6_XL_fonts_dl.pdf
- docs/PCL6_XL_True_Type_Lib.pdf

## PJL (job wrapper / status)
- docs/tech/pjl_overview.md
- docs/tech/pjl_command_summary.md
- docs/tech/pjl_status_codes.md
- docs/PJLReference(2003)_0.pdf

## Other primary PDFs (baseline references)
- docs/PCL6_XL_Datastream-Function-Reference.pdf
- docs/PCL6_XL_Feature Ref Protocol Class 2x0.pdf
- docs/PCL6-A-white-paper.pdf

## Chinese mirror docs
- docs/tech_zh/ (structure mirrors docs/tech)

## Search tips
- Operators: rg -n "BeginPage|EndPage|ReadImage|SetColorSpace|SetBrushSource" docs/tech/pclxl2
- Attributes: rg -n "MediaSize|MediaSource|ColorDepth|TxMode" docs/tech/pclxl2
- Tags: rg -n "0x7a|SetPenWidth" docs/tech/pclxl2/93_operator_tag_values.md
