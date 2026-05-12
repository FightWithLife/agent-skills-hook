#!/usr/bin/env python3
"""Small KingstVIS SocketAPI client for capture/export automation."""

from __future__ import annotations

import argparse
import csv
import json
import socket
import sys
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 23367
DEFAULT_OUTPUT_DIR = "kingstvis_captures"
DEFAULT_TIMEOUT = 30.0
BUFFER_SIZE = 8192
TRIGGER_OPTIONS = ("low_level", "high_level", "pos_edge", "neg_edge")


@dataclass
class CommandResult:
    command: str
    response: str
    ok: bool
    output_path: str | None = None
    output_exists: bool | None = None


class KingstVisSocketError(RuntimeError):
    pass


def wait_for_output_path(
    output_path: Path | None,
    timeout: float,
    poll_interval: float = 0.2,
) -> bool | None:
    if output_path is None:
        return None
    if output_path.exists():
        return True
    if timeout <= 0:
        return False

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        time.sleep(poll_interval)
        if output_path.exists():
            return True
    return output_path.exists()


def build_result(
    command: str,
    response: str,
    output_path: Path | None = None,
    *,
    wait_for_output_timeout: float = 0.0,
) -> CommandResult:
    exists = wait_for_output_path(output_path, wait_for_output_timeout)
    ok = bool(response) and not response.startswith("NAK")
    if not ok and output_path is not None and exists:
        ok = True
    return CommandResult(
        command=command,
        response=response,
        ok=ok,
        output_path=str(output_path) if output_path is not None else None,
        output_exists=exists,
    )


class KingstVisClient:
    def __init__(self, host: str, port: int, timeout: float) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self._socket: socket.socket | None = None

    def __enter__(self) -> "KingstVisClient":
        self.connect()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def connect(self) -> None:
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.settimeout(self.timeout)
        try:
            client.connect((self.host, self.port))
        except OSError as exc:
            client.close()
            raise KingstVisSocketError(
                f"Failed to connect to KingstVIS SocketAPI at {self.host}:{self.port}: {exc}"
            ) from exc
        self._socket = client

    def close(self) -> None:
        if self._socket is not None:
            self._socket.close()
            self._socket = None

    def send(
        self,
        command: str,
        output_path: Path | None = None,
        *,
        wait_for_output_timeout: float = 0.0,
    ) -> CommandResult:
        if self._socket is None:
            raise KingstVisSocketError("Socket is not connected")

        self._socket.sendall(command.encode("utf-8"))
        try:
            response = self._socket.recv(BUFFER_SIZE).decode("utf-8", errors="replace")
        except (TimeoutError, ConnectionResetError, ConnectionAbortedError):
            response = ""
        return build_result(
            command,
            response,
            output_path,
            wait_for_output_timeout=wait_for_output_timeout,
        )


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S")


def print_result(result: CommandResult) -> None:
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))


def quote_path_for_command(path: Path) -> str:
    return f'"{path}"'


def normalize_channels(values: list[str] | None) -> list[str]:
    if not values:
        return []
    channels: list[str] = []
    for value in values:
        for item in value.replace(",", " ").split():
            if item:
                channels.append(item)
    return channels


def normalize_float_values(values: list[str] | None) -> list[str]:
    if not values:
        return []
    normalized: list[str] = []
    for value in values:
        for item in value.replace(",", " ").split():
            if item:
                normalized.append(item)
    return normalized


def build_trigger_command(args: argparse.Namespace) -> str:
    parts = ["set-trigger"]
    if getattr(args, "reset", False):
        parts.append("--reset")
    for attr in TRIGGER_OPTIONS:
        channels = normalize_channels(getattr(args, attr, None))
        if channels:
            parts.append("--" + attr.replace("_", "-"))
            parts.extend(channels)
    return " ".join(parts)


def build_export_command(output: Path, channels: list[str], time_span: list[str]) -> str:
    parts = ["export-data", quote_path_for_command(output)]
    if channels:
        parts.append("--chn-select")
        parts.extend(channels)
    if time_span:
        parts.append("--time-span")
        parts.extend(time_span)
    return " ".join(parts)


def append_manifest(manifest_path: Path, result: CommandResult) -> None:
    try:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        new_file = not manifest_path.exists()
        with manifest_path.open("a", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["time", "command", "ok", "response", "output_path", "output_exists"],
            )
            if new_file:
                writer.writeheader()
            writer.writerow(
                {
                    "time": datetime.now().isoformat(timespec="seconds"),
                    "command": result.command,
                    "ok": result.ok,
                    "response": result.response,
                    "output_path": result.output_path or "",
                    "output_exists": "" if result.output_exists is None else result.output_exists,
                }
            )
    except OSError as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "warning": f"failed to write manifest {manifest_path}: {exc}",
                },
                ensure_ascii=False,
            ),
            file=sys.stderr,
        )


def resolve_output(path_text: str | None, output_dir: str, basename: str, fmt: str, index: int) -> Path:
    if path_text:
        return Path(path_text).resolve()
    name = f"{basename}_{timestamp()}_{index:03d}.{fmt.lstrip('.')}"
    return (Path(output_dir) / name).resolve()


def run_send(args: argparse.Namespace) -> int:
    with KingstVisClient(args.host, args.port, args.timeout) as client:
        result = client.send(args.command)
    print_result(result)
    return 0 if result.ok else 2


def run_connect(args: argparse.Namespace) -> int:
    with KingstVisClient(args.host, args.port, args.timeout):
        pass
    print(
        json.dumps(
            {"ok": True, "host": args.host, "port": args.port, "message": "connected"},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


def run_start(args: argparse.Namespace) -> int:
    command = "start --simulate" if args.simulate else "start"
    with KingstVisClient(args.host, args.port, args.timeout) as client:
        result = client.send(command)
    print_result(result)
    return 0 if result.ok else 2


def run_stop(args: argparse.Namespace) -> int:
    with KingstVisClient(args.host, args.port, args.timeout) as client:
        result = client.send("stop")
    print_result(result)
    return 0 if result.ok else 2


def run_get_last_error(args: argparse.Namespace) -> int:
    with KingstVisClient(args.host, args.port, args.timeout) as client:
        result = client.send("get-last-error")
    print_result(result)
    return 0 if result.ok else 2


def run_simple_command(args: argparse.Namespace) -> int:
    command = args.socket_command
    if getattr(args, "value", None) is not None:
        command = f"{command} {args.value}"
    with KingstVisClient(args.host, args.port, args.timeout) as client:
        result = client.send(command)
    print_result(result)
    return 0 if result.ok else 2


def run_set_trigger(args: argparse.Namespace) -> int:
    command = build_trigger_command(args)
    with KingstVisClient(args.host, args.port, args.timeout) as client:
        result = client.send(command)
    print_result(result)
    return 0 if result.ok else 2


def run_export(args: argparse.Namespace) -> int:
    output = Path(args.path).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    channels = normalize_channels(args.channels)
    time_span = normalize_float_values(args.time_span)
    command = build_export_command(output, channels, time_span)
    with KingstVisClient(args.host, args.port, args.timeout) as client:
        result = client.send(command, output, wait_for_output_timeout=args.timeout)
    print_result(result)
    return 0 if result.ok else 2


def export_with_optional_fallback(
    client: KingstVisClient,
    output: Path,
    fallback_kvdat: bool,
    channels: list[str],
    time_span: list[str],
) -> CommandResult:
    output.parent.mkdir(parents=True, exist_ok=True)
    result = client.send(
        build_export_command(output, channels, time_span),
        output,
        wait_for_output_timeout=5.0,
    )
    if result.ok or not fallback_kvdat or output.suffix.lower() == ".kvdat":
        return result

    fallback = output.with_suffix(".kvdat")
    fallback.parent.mkdir(parents=True, exist_ok=True)
    return client.send(
        build_export_command(fallback, channels, time_span),
        fallback,
        wait_for_output_timeout=5.0,
    )


def send_config_commands(client: KingstVisClient, args: argparse.Namespace, manifest: Path) -> bool:
    commands: list[str] = []
    for command in args.pre_command or []:
        if command.strip():
            commands.append(command.strip())
    if args.sample_rate is not None:
        commands.append(f"set-sample-rate {args.sample_rate}")
    if args.sample_depth is not None:
        commands.append(f"set-sample-depth {args.sample_depth}")
    if args.sample_time is not None:
        commands.append(f"set-sample-time {args.sample_time}")
    if args.threshold_voltage is not None:
        commands.append(f"set-threshold-voltage {args.threshold_voltage}")
    if args.reset_trigger or any(normalize_channels(getattr(args, attr, None)) for attr in TRIGGER_OPTIONS):
        trigger_args = argparse.Namespace(
            reset=args.reset_trigger,
            low_level=args.low_level,
            high_level=args.high_level,
            pos_edge=args.pos_edge,
            neg_edge=args.neg_edge,
        )
        commands.append(build_trigger_command(trigger_args))

    failed = False
    for command in commands:
        result = client.send(command)
        print_result(result)
        append_manifest(manifest, result)
        if not result.ok:
            failed = True
            if args.stop_on_error:
                break
    return failed


def run_capture(args: argparse.Namespace) -> int:
    command = "start --simulate" if args.simulate else "start"
    manifest = Path(args.output_dir).resolve() / "manifest.csv"
    channels = normalize_channels(args.channels)
    time_span = normalize_float_values(args.time_span)
    failed = False

    with KingstVisClient(args.host, args.port, args.timeout) as client:
        failed = send_config_commands(client, args, manifest)
    if failed and args.stop_on_error:
        return 2

    for index in range(1, args.count + 1):
        with KingstVisClient(args.host, args.port, args.timeout) as client:
            start_result = client.send(command)
        print_result(start_result)
        append_manifest(manifest, start_result)
        if not start_result.ok:
            failed = True
            if args.stop_on_error:
                break
            continue

        time.sleep(args.wait_after_start)

        with KingstVisClient(args.host, args.port, args.timeout) as client:
            stop_result = client.send("stop")
        print_result(stop_result)
        append_manifest(manifest, stop_result)
        if not stop_result.ok:
            failed = True
            if args.stop_on_error:
                break
            continue

        time.sleep(args.wait_after_stop)

        output = resolve_output(args.path, args.output_dir, args.basename, args.format, index)
        with KingstVisClient(args.host, args.port, args.timeout) as client:
            export_result = export_with_optional_fallback(
                client,
                output,
                args.fallback_kvdat,
                channels,
                time_span,
            )
        print_result(export_result)
        append_manifest(manifest, export_result)
        if not export_result.ok:
            failed = True
            if args.stop_on_error:
                break

        if index != args.count:
            time.sleep(args.interval)

    return 2 if failed else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="KingstVIS SocketAPI client")
    parser.add_argument("--host", default=DEFAULT_HOST, help="KingstVIS SocketAPI host")
    parser.add_argument("--port", default=DEFAULT_PORT, type=int, help="KingstVIS SocketAPI port")
    parser.add_argument("--timeout", default=DEFAULT_TIMEOUT, type=float, help="Socket timeout seconds")

    subparsers = parser.add_subparsers(dest="command_name", required=True)

    connect_parser = subparsers.add_parser("connect", help="Test SocketAPI connectivity")
    connect_parser.set_defaults(func=run_connect)

    send_parser = subparsers.add_parser("send", help="Send a raw SocketAPI command")
    send_parser.add_argument("command", help="Raw KingstVIS command")
    send_parser.set_defaults(func=run_send)

    start_parser = subparsers.add_parser("start", help="Start a capture")
    start_parser.add_argument("--simulate", action="store_true", help="Use 'start --simulate'")
    start_parser.set_defaults(func=run_start)

    stop_parser = subparsers.add_parser("stop", help="Stop current capture")
    stop_parser.set_defaults(func=run_stop)

    last_error_parser = subparsers.add_parser("get-last-error", help="Read the last KingstVIS error")
    last_error_parser.set_defaults(func=run_get_last_error)

    set_rate_parser = subparsers.add_parser("set-sample-rate", help="Set sample rate")
    set_rate_parser.add_argument("value", help="Sample rate, for example 10000000")
    set_rate_parser.set_defaults(func=run_simple_command, socket_command="set-sample-rate")

    get_rate_parser = subparsers.add_parser("get-sample-rate", help="Get current sample rate")
    get_rate_parser.set_defaults(func=run_simple_command, socket_command="get-sample-rate")

    get_supported_rate_parser = subparsers.add_parser(
        "get-supported-sample-rate",
        help="Get supported sample rates for the current device",
    )
    get_supported_rate_parser.set_defaults(
        func=run_simple_command,
        socket_command="get-supported-sample-rate",
    )

    set_depth_parser = subparsers.add_parser("set-sample-depth", help="Set sample depth")
    set_depth_parser.add_argument("value", help="Sample depth, for example 20000000")
    set_depth_parser.set_defaults(func=run_simple_command, socket_command="set-sample-depth")

    actual_depth_parser = subparsers.add_parser(
        "get-actual-sample-depth",
        help="Get actual sample depth after capture",
    )
    actual_depth_parser.set_defaults(func=run_simple_command, socket_command="get-actual-sample-depth")

    set_time_parser = subparsers.add_parser("set-sample-time", help="Set sample depth by time in seconds")
    set_time_parser.add_argument("value", help="Sample time seconds, for example 0.5")
    set_time_parser.set_defaults(func=run_simple_command, socket_command="set-sample-time")

    actual_time_parser = subparsers.add_parser(
        "get-actual-sample-time",
        help="Get actual sample time range after capture",
    )
    actual_time_parser.set_defaults(func=run_simple_command, socket_command="get-actual-sample-time")

    threshold_parser = subparsers.add_parser("set-threshold-voltage", help="Set IO threshold voltage")
    threshold_parser.add_argument("value", help="Threshold voltage, for example 1.65")
    threshold_parser.set_defaults(func=run_simple_command, socket_command="set-threshold-voltage")

    trigger_parser = subparsers.add_parser("set-trigger", help="Set trigger conditions")
    trigger_parser.add_argument("--reset", action="store_true", help="Clear all existing trigger conditions")
    trigger_parser.add_argument("--low-level", nargs="+", help="Low-level trigger channels")
    trigger_parser.add_argument("--high-level", nargs="+", help="High-level trigger channels")
    trigger_parser.add_argument("--pos-edge", nargs="+", help="Positive-edge trigger channel")
    trigger_parser.add_argument("--neg-edge", nargs="+", help="Negative-edge trigger channel")
    trigger_parser.set_defaults(func=run_set_trigger)

    export_parser = subparsers.add_parser("export", help="Export data to a path")
    export_parser.add_argument("path", help="Output path, for example kingstvis_captures\\capture.csv")
    export_parser.add_argument("--channels", nargs="+", help="Export selected channels, for example 0 1")
    export_parser.add_argument(
        "--time-span",
        nargs="+",
        help="Export time range, for example 0.01 0.5 or only 0.01",
    )
    export_parser.set_defaults(func=run_export)

    capture_parser = subparsers.add_parser("capture", help="Start capture and export data")
    capture_parser.add_argument("--simulate", action="store_true", help="Use 'start --simulate'")
    capture_parser.add_argument("--pre-command", action="append", help="Raw command to send before start")
    capture_parser.add_argument("--sample-rate", help="Set sample rate before capture")
    capture_parser.add_argument("--sample-depth", help="Set sample depth before capture")
    capture_parser.add_argument("--sample-time", help="Set sample time before capture")
    capture_parser.add_argument("--threshold-voltage", help="Set threshold voltage before capture")
    capture_parser.add_argument("--reset-trigger", action="store_true", help="Reset trigger before capture")
    capture_parser.add_argument("--low-level", nargs="+", help="Low-level trigger channels")
    capture_parser.add_argument("--high-level", nargs="+", help="High-level trigger channels")
    capture_parser.add_argument("--pos-edge", nargs="+", help="Positive-edge trigger channel")
    capture_parser.add_argument("--neg-edge", nargs="+", help="Negative-edge trigger channel")
    capture_parser.add_argument("--channels", nargs="+", help="Export selected channels, for example 0 1")
    capture_parser.add_argument(
        "--time-span",
        nargs="+",
        help="Export time range, for example 0.01 0.5 or only 0.01",
    )
    capture_parser.add_argument("--count", type=int, default=1, help="Number of capture/export cycles")
    capture_parser.add_argument("--interval", type=float, default=0.5, help="Delay between cycles")
    capture_parser.add_argument("--wait-after-start", type=float, default=0.2, help="Capture dwell time between start and stop")
    capture_parser.add_argument("--wait-after-stop", type=float, default=0.0, help="Delay after stop before export")
    capture_parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Local output directory")
    capture_parser.add_argument("--basename", default="capture", help="Output file prefix")
    capture_parser.add_argument("--format", default="csv", choices=["csv", "kvdat", "txt"], help="Export extension")
    capture_parser.add_argument("--path", help="Exact output path; mainly for single capture")
    capture_parser.add_argument("--fallback-kvdat", action="store_true", help="Retry as .kvdat if export fails")
    capture_parser.add_argument("--stop-on-error", action="store_true", help="Stop loop after first failure")
    capture_parser.set_defaults(func=run_capture)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if getattr(args, "count", 1) < 1:
        parser.error("--count must be >= 1")
    try:
        return args.func(args)
    except KingstVisSocketError as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
