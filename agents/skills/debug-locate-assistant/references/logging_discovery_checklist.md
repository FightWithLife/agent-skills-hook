# Logging Discovery Checklist (C/C++)

Use this checklist to find or select the logging system before inserting debug logs.

## 1) Search for existing logging system

Run (repo root):
- rg -n "log_|logger|logging|LOG_|syslog|trace" src include
- rg -n "#include \".*log.*\.h\"" src include
- rg -n "PRT_LOG|prt_log|DBG|INFO|WARN|ERROR" src include

If the project is PCL6:
- Log macros live in `src/comm/prt_log.h`:
  - `prt_dbg/prt_info/prt_warning/prt_error/prt_fatal`
  - Controlled by `PRT_LOG_USE_LEVEL`

## 2) If no logging system exists

Fallback to standard output:
- Prefer `fprintf(stderr, "[DBG] ...\n", ...)` for errors
- Use a consistent prefix: `[MODULE][FUNC][LINE] message`

## 3) Insert log points (order)

1. Entry/exit of suspected functions
2. Key branches and guard conditions
3. External I/O boundaries (file/net/device)
4. Error returns and error-code mapping

## 4) Log message format

Recommended fields:
- module + function + line
- key inputs/params (sanitized)
- error code or enum name

Example:
`[PCL_XL][prt_pcl6_decode][L123] status=ERR_ILLEGAL_SEQUENCE op=BeginPage`.
