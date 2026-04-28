#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: run_collect_logs.sh

Environment variables:
  RUN_CMD   (required)  Command to run the app/test that reproduces the error.
  BUILD_CMD (optional)  Build command to execute before running.
  TEST_CMD  (optional)  Additional test command before RUN_CMD.
  LOG_DIR   (optional)  Output log directory. Default: ./logs

Example:
  BUILD_CMD="cmake --build build" \
  RUN_CMD="./build/bin/pcl --input job.pclxl" \
  LOG_DIR="./logs" \
  ./run_collect_logs.sh
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${RUN_CMD:-}" ]]; then
  echo "RUN_CMD is required." >&2
  usage >&2
  exit 2
fi

LOG_DIR="${LOG_DIR:-./logs}"
mkdir -p "$LOG_DIR"

stamp="$(date +%Y%m%d_%H%M%S)"
log_file="$LOG_DIR/run_${stamp}.log"

{
  echo "[run_collect_logs] start: $stamp"
  if [[ -n "${BUILD_CMD:-}" ]]; then
    echo "[run_collect_logs] BUILD_CMD: $BUILD_CMD"
    eval "$BUILD_CMD"
  fi
  if [[ -n "${TEST_CMD:-}" ]]; then
    echo "[run_collect_logs] TEST_CMD: $TEST_CMD"
    eval "$TEST_CMD"
  fi
  echo "[run_collect_logs] RUN_CMD: $RUN_CMD"
  eval "$RUN_CMD"
  echo "[run_collect_logs] done"
} >"$log_file" 2>&1

echo "Saved log: $log_file"
