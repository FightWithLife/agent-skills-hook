from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from uuid import uuid4

try:
    import serial  # type: ignore
    from serial import SerialException  # type: ignore
    from serial.tools import list_ports  # type: ignore
except Exception:  # pragma: no cover
    serial = None
    SerialException = Exception
    list_ports = None


ERROR_TYPES = {
    "dependency_missing",
    "port_not_found",
    "port_busy",
    "invalid_param",
    "read_timeout",
    "write_failed",
    "log_write_failed",
    "serial_error",
    "none",
}

ResultDict = Dict[str, Any]
OPEN_RETRY_ATTEMPTS = 3
OPEN_RETRY_DELAY_SEC = 0.35


def now_ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def make_result(command: str, args: argparse.Namespace) -> ResultDict:
    return {
        "ok": False,
        "command": command,
        "port": getattr(args, "port", None),
        "baudrate": getattr(args, "baudrate", None),
        "timeout": getattr(args, "timeout", None),
        "log_path_raw": None,
        "log_path_text": None,
        "tx_bytes": 0,
        "rx_bytes": 0,
        "error_type": "none",
        "error_message": "",
        "session_id": None,
    }


def fail(result: ResultDict, error_type: str, message: str, exit_code: int = 1) -> int:
    if error_type not in ERROR_TYPES:
        error_type = "serial_error"
    result["error_type"] = error_type
    result["error_message"] = message
    emit_result(result)
    return exit_code


def emit_result(result: ResultDict) -> None:
    print(json.dumps(result, ensure_ascii=False, indent=2))


def ensure_pyserial(result: ResultDict) -> int:
    if serial is None or list_ports is None:
        return fail(
            result,
            "dependency_missing",
            "pyserial is required. Install it with: pip install pyserial",
        )
    return 0


def is_preferred_port(description: str, device: str) -> bool:
    text = f"{device} {description}".lower()
    preferred_tokens = ["usb", "ch340", "serial", "uart", "ttl"]
    return any(token in text for token in preferred_tokens)


def resolve_port(args: argparse.Namespace) -> str:
    if args.port:
        return str(args.port)
    if list_ports is None:
        raise RuntimeError(("dependency_missing", "pyserial is required. Install it with: pip install pyserial"))
    ports = list(list_ports.comports())
    if not ports:
        raise RuntimeError(("port_not_found", "no serial ports detected"))
    preferred = [p for p in ports if is_preferred_port(p.description, p.device)]
    return str(preferred[0].device if preferred else ports[0].device)


def build_serial_kwargs(args: argparse.Namespace, port: str, baudrate: int) -> Dict[str, Any]:
    return {
        "port": port,
        "baudrate": baudrate,
        "timeout": args.timeout,
        "parity": args.parity,
        "bytesize": args.bytesize,
        "stopbits": args.stopbits,
        "write_timeout": args.timeout,
        "xonxoff": args.xonxoff,
        "rtscts": args.rtscts,
        "dsrdtr": args.dsrdtr,
        "exclusive": True,
    }


def map_serial_exception(port: str, exc: BaseException) -> RuntimeError:
    msg = str(exc)
    lower_msg = msg.lower()
    if "permissionerror" in lower_msg or "busy" in lower_msg or "access is denied" in lower_msg:
        error_type = "port_busy"
    elif "filenotfounderror" in lower_msg or "could not open port" in lower_msg or "cannot find the file" in lower_msg:
        error_type = "port_not_found"
    else:
        error_type = "serial_error"
    return RuntimeError((error_type, f"{port}: {msg}"))


def open_with_retry(args: argparse.Namespace, port: str):
    if serial is None:
        raise RuntimeError(("dependency_missing", "pyserial is required. Install it with: pip install pyserial"))
    last_error: Optional[RuntimeError] = None
    for attempt in range(1, OPEN_RETRY_ATTEMPTS + 1):
        opened = None
        try:
            opened = serial.Serial(**build_serial_kwargs(args, port, int(args.baudrate)))
            ready = opened
            opened = None
            return ready
        except FileNotFoundError:
            raise RuntimeError(("port_not_found", f"serial port not found: {port}"))
        except PermissionError as exc:
            last_error = RuntimeError(("port_busy", f"{port}: open failed after attempt {attempt}/{OPEN_RETRY_ATTEMPTS}: {exc}"))
        except SerialException as exc:
            mapped = map_serial_exception(port, exc)
            error_type, message = mapped.args[0]
            if error_type == "port_not_found":
                raise mapped
            last_error = RuntimeError((error_type, f"{message} (attempt {attempt}/{OPEN_RETRY_ATTEMPTS})"))
        finally:
            if opened is not None and getattr(opened, "is_open", False):
                opened.close()
        if attempt < OPEN_RETRY_ATTEMPTS:
            time.sleep(OPEN_RETRY_DELAY_SEC)
    if last_error is not None:
        raise last_error
    raise RuntimeError(("serial_error", f"{port}: open failed for unknown reason"))


def normalize_line_ending(mode: str) -> bytes:
    return {"none": b"", "lf": b"\n", "cr": b"\r", "crlf": b"\r\n"}[mode]


def parse_hex_string(value: str) -> bytes:
    text = value.replace(" ", "").replace("\n", "").replace("\r", "")
    if not text:
        raise ValueError("hex input is empty")
    if len(text) % 2 != 0:
        raise ValueError("hex input must contain an even number of digits")
    try:
        return bytes.fromhex(text)
    except ValueError as exc:
        raise ValueError(f"invalid hex input: {exc}") from exc


def resolve_output_dir(output_dir: Optional[str]) -> Path:
    base = Path(output_dir) if output_dir else Path("serial_logs")
    base.mkdir(parents=True, exist_ok=True)
    return base


def start_logs(result: ResultDict, output_dir: Optional[str]) -> Tuple[str, Path, Path]:
    session_id = datetime.now().strftime("%Y%m%d%H%M%S") + "_" + uuid4().hex[:8]
    root = resolve_output_dir(output_dir)
    raw_path = root / f"{session_id}_raw.bin"
    text_path = root / f"{session_id}_text.log"
    raw_path.touch(exist_ok=False)
    text_path.touch(exist_ok=False)
    result["session_id"] = session_id
    result["log_path_raw"] = str(raw_path)
    result["log_path_text"] = str(text_path)
    return session_id, raw_path, text_path


def append_text_log(path: Path, direction: str, data_type: str, content: str) -> None:
    with path.open("a", encoding="utf-8") as fh:
        fh.write(f"[{now_ts()}] {direction} {data_type}: {content}\n")


def append_raw_log(path: Path, payload: bytes) -> None:
    with path.open("ab") as fh:
        fh.write(payload)


def open_serial(args: argparse.Namespace):
    port = resolve_port(args)
    args.port = port
    return open_with_retry(args, port)


def prepare_port(result: ResultDict, args: argparse.Namespace) -> int:
    try:
        args.port = resolve_port(args)
        result["port"] = args.port
        return 0
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)


def append_rx_text_lines(text_path: Path, pending_text: str, chunk: bytes) -> str:
    try:
        text = pending_text + chunk.decode("utf-8")
    except UnicodeDecodeError:
        if pending_text:
            append_text_log(text_path, "RX", "text", pending_text)
        append_text_log(text_path, "RX", "hex", chunk.hex(" "))
        return ""
    parts = text.splitlines(keepends=True)
    remainder = ""
    if parts and not parts[-1].endswith(("\r", "\n")):
        remainder = parts.pop()
    for part in parts:
        append_text_log(text_path, "RX", "text", part.rstrip("\r\n"))
    return remainder


def flush_pending_rx_text(text_path: Path, pending_text: str) -> None:
    if pending_text:
        append_text_log(text_path, "RX", "text", pending_text)


def read_for_duration(ser, seconds: float, raw_path: Path, text_path: Path) -> int:
    deadline = time.time() + seconds
    total = 0
    pending_text = ""
    while time.time() < deadline:
        chunk = ser.read(256)
        if not chunk:
            continue
        append_raw_log(raw_path, chunk)
        pending_text = append_rx_text_lines(text_path, pending_text, chunk)
        total += len(chunk)
    flush_pending_rx_text(text_path, pending_text)
    return total


def read_for_bytes(ser, limit: int, raw_path: Path, text_path: Path) -> int:
    total = 0
    pending_text = ""
    while total < limit:
        chunk = ser.read(min(256, limit - total))
        if not chunk:
            break
        append_raw_log(raw_path, chunk)
        pending_text = append_rx_text_lines(text_path, pending_text, chunk)
        total += len(chunk)
    flush_pending_rx_text(text_path, pending_text)
    return total


def session_state_paths(output_dir: Path, session_id: str) -> Tuple[Path, Path]:
    session_dir = output_dir / session_id
    return session_dir, session_dir / "session.json"


def read_cursor_path(session_dir: Path, cursor_name: str) -> Path:
    return session_dir / f"{cursor_name}.cursor"


def write_session_state(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_session_state(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def make_session_id() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S") + "_" + uuid4().hex[:8]


def pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", f"Get-Process -Id {pid} | Out-Null"],
            capture_output=True,
            text=True,
        )
        return proc.returncode == 0
    except Exception:
        return False


def build_open_result(state: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "ok": True,
        "command": "open",
        "session_id": state["session_id"],
        "port": state["port"],
        "baudrate": state["baudrate"],
        "log_path_raw": state["log_path_raw"],
        "log_path_text": state["log_path_text"],
        "session_path": state["session_path"],
        "stop_file": state["stop_file"],
        "pid": state.get("pid"),
    }


def cmd_connect_test(args: argparse.Namespace) -> int:
    result = make_result("connect-test", args)
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    try:
        ser = open_serial(args)
        ser.close()
        result["ok"] = True
        emit_result(result)
        return 0
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)


def cmd_send_text(args: argparse.Namespace) -> int:
    result = make_result("send-text", args)
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    payload = args.text.encode(args.encoding) + normalize_line_ending(args.line_ending)
    try:
        _, raw_path, text_path = start_logs(result, args.output_dir)
        append_raw_log(raw_path, payload)
        append_text_log(text_path, "TX", "text", repr(payload.decode(args.encoding, errors="replace")))
        ser = open_serial(args)
        written = ser.write(payload)
        ser.flush()
        ser.close()
        result["ok"] = True
        result["tx_bytes"] = written
        emit_result(result)
        return 0
    except LookupError as exc:
        return fail(result, "invalid_param", f"invalid encoding: {exc}")
    except OSError as exc:
        return fail(result, "log_write_failed", str(exc))
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)
    except Exception as exc:
        return fail(result, "write_failed", str(exc))


def cmd_send_hex(args: argparse.Namespace) -> int:
    result = make_result("send-hex", args)
    try:
        payload = parse_hex_string(args.hex)
    except ValueError as exc:
        return fail(result, "invalid_param", str(exc))
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    try:
        _, raw_path, text_path = start_logs(result, args.output_dir)
        append_raw_log(raw_path, payload)
        append_text_log(text_path, "TX", "hex", payload.hex(" "))
        ser = open_serial(args)
        written = ser.write(payload)
        ser.flush()
        ser.close()
        result["ok"] = True
        result["tx_bytes"] = written
        emit_result(result)
        return 0
    except OSError as exc:
        return fail(result, "log_write_failed", str(exc))
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)
    except Exception as exc:
        return fail(result, "write_failed", str(exc))


def cmd_listen(args: argparse.Namespace) -> int:
    result = make_result("listen", args)
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    try:
        _, raw_path, text_path = start_logs(result, args.output_dir)
        ser = open_serial(args)
        seconds = args.duration if args.duration is not None else 3.0
        rx_bytes = read_for_duration(ser, seconds, raw_path, text_path)
        ser.close()
        result["ok"] = True
        result["rx_bytes"] = rx_bytes
        emit_result(result)
        return 0
    except OSError as exc:
        return fail(result, "log_write_failed", str(exc))
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)


def cmd_capture(args: argparse.Namespace) -> int:
    result = make_result("capture", args)
    if args.duration is None and args.max_bytes is None:
        return fail(result, "invalid_param", "capture requires --duration or --max-bytes")
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    try:
        _, raw_path, text_path = start_logs(result, args.output_dir)
        ser = open_serial(args)
        rx_bytes = 0
        if args.duration is not None:
            rx_bytes += read_for_duration(ser, args.duration, raw_path, text_path)
        if args.max_bytes is not None and rx_bytes < args.max_bytes:
            rx_bytes += read_for_bytes(ser, args.max_bytes - rx_bytes, raw_path, text_path)
        ser.close()
        result["ok"] = True
        result["rx_bytes"] = rx_bytes
        emit_result(result)
        return 0
    except OSError as exc:
        return fail(result, "log_write_failed", str(exc))
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)


def cmd_session(args: argparse.Namespace) -> int:
    result = make_result("session", args)
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    try:
        _, raw_path, text_path = start_logs(result, args.output_dir)
        ser = open_serial(args)
        tx_payload = None
        if args.send_text is not None:
            tx_payload = args.send_text.encode(args.encoding) + normalize_line_ending(args.line_ending)
            append_raw_log(raw_path, tx_payload)
            append_text_log(text_path, "TX", "text", repr(tx_payload.decode(args.encoding, errors="replace")))
        elif args.send_hex is not None:
            tx_payload = parse_hex_string(args.send_hex)
            append_raw_log(raw_path, tx_payload)
            append_text_log(text_path, "TX", "hex", tx_payload.hex(" "))
        if tx_payload is not None:
            result["tx_bytes"] = ser.write(tx_payload)
            ser.flush()
        duration = args.duration if args.duration is not None else 3.0
        result["rx_bytes"] = read_for_duration(ser, duration, raw_path, text_path)
        ser.close()
        result["ok"] = True
        emit_result(result)
        return 0
    except ValueError as exc:
        return fail(result, "invalid_param", str(exc))
    except LookupError as exc:
        return fail(result, "invalid_param", f"invalid encoding: {exc}")
    except OSError as exc:
        return fail(result, "log_write_failed", str(exc))
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)
    except Exception as exc:
        return fail(result, "serial_error", str(exc))


def cmd_follow(args: argparse.Namespace) -> int:
    result = make_result("follow", args)
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    try:
        _, raw_path, text_path = start_logs(result, args.output_dir)
        ser = open_serial(args)
        pending_text = ""
        total = 0
        start_time = time.time()
        last_rx_time = start_time
        stop_path = Path(args.stop_file) if args.stop_file else None
        while True:
            now = time.time()
            if stop_path is not None and stop_path.exists():
                break
            if args.max_duration is not None and now - start_time >= args.max_duration:
                break
            if args.max_bytes is not None and total >= args.max_bytes:
                break
            if args.idle_timeout is not None and total > 0 and now - last_rx_time >= args.idle_timeout:
                break
            chunk = ser.read(256)
            if not chunk:
                continue
            append_raw_log(raw_path, chunk)
            pending_text = append_rx_text_lines(text_path, pending_text, chunk)
            total += len(chunk)
            last_rx_time = time.time()
            if args.stop_text and args.stop_text in ((pending_text if pending_text else "") + chunk.decode("utf-8", errors="ignore")):
                break
        flush_pending_rx_text(text_path, pending_text)
        ser.close()
        result["ok"] = True
        result["rx_bytes"] = total
        emit_result(result)
        return 0
    except OSError as exc:
        return fail(result, "log_write_failed", str(exc))
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        return fail(result, error_type, msg)
    except Exception as exc:
        return fail(result, "serial_error", str(exc))


def cmd_open(args: argparse.Namespace) -> int:
    result = make_result("open", args)
    if ensure_pyserial(result):
        return 1
    prep = prepare_port(result, args)
    if prep:
        return prep
    output_dir = resolve_output_dir(args.output_dir)
    session_id = make_session_id()
    session_dir, session_path = session_state_paths(output_dir, session_id)
    session_dir.mkdir(parents=True, exist_ok=True)
    raw_path = session_dir / "serial_raw.bin"
    text_path = session_dir / "serial_text.log"
    stop_file = session_dir / "stop.flag"
    default_cursor = read_cursor_path(session_dir, "default")
    stdout_path = session_dir / "worker_stdout.json"
    stderr_path = session_dir / "worker_stderr.log"
    raw_path.touch(exist_ok=False)
    text_path.touch(exist_ok=False)
    default_cursor.write_text("0", encoding="utf-8")
    state = {
        "session_id": session_id,
        "status": "starting",
        "port": args.port,
        "baudrate": args.baudrate,
        "timeout": args.timeout,
        "parity": args.parity,
        "bytesize": args.bytesize,
        "stopbits": args.stopbits,
        "rtscts": args.rtscts,
        "dsrdtr": args.dsrdtr,
        "xonxoff": args.xonxoff,
        "log_path_raw": str(raw_path),
        "log_path_text": str(text_path),
        "session_path": str(session_path),
        "stop_file": str(stop_file),
        "default_cursor": str(default_cursor),
        "pid": None,
        "rx_bytes": 0,
        "last_update": now_ts(),
        "last_error": "",
    }
    write_session_state(session_path, state)
    cmd = [
        sys.executable,
        str(Path(__file__).resolve()),
        "_worker",
        "--session-path",
        str(session_path),
    ]
    creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    with stdout_path.open("w", encoding="utf-8") as out_fp, stderr_path.open("w", encoding="utf-8") as err_fp:
        proc = subprocess.Popen(cmd, stdout=out_fp, stderr=err_fp, creationflags=creationflags)
    state["pid"] = proc.pid
    state["status"] = "running"
    state["last_update"] = now_ts()
    write_session_state(session_path, state)
    emit_result(build_open_result(state))
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    state = load_session_state(Path(args.session_path))
    if state.get("pid") and not pid_alive(int(state["pid"])) and state.get("status") == "running":
        state["status"] = "stopped"
        state["last_update"] = now_ts()
        write_session_state(Path(args.session_path), state)
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0


def cmd_peek(args: argparse.Namespace) -> int:
    state = load_session_state(Path(args.session_path))
    text_path = Path(state["log_path_text"])
    if not text_path.exists():
        print(json.dumps({"ok": False, "error": "log_not_found"}, ensure_ascii=False, indent=2))
        return 1
    lines = text_path.read_text(encoding="utf-8", errors="replace").splitlines()
    payload = {
        "ok": True,
        "session_id": state["session_id"],
        "status": state.get("status"),
        "line_count": len(lines),
        "tail": lines[-args.lines:],
        "log_path_text": str(text_path),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def cmd_read_new(args: argparse.Namespace) -> int:
    state = load_session_state(Path(args.session_path))
    session_dir = Path(args.session_path).parent
    text_path = Path(state["log_path_text"])
    if not text_path.exists():
        print(json.dumps({"ok": False, "error": "log_not_found"}, ensure_ascii=False, indent=2))
        return 1
    cursor_path = read_cursor_path(session_dir, args.cursor_name)
    if cursor_path.exists():
        try:
            start = int(cursor_path.read_text(encoding="utf-8").strip() or "0")
        except ValueError:
            start = 0
    else:
        start = 0
    lines = text_path.read_text(encoding="utf-8", errors="replace").splitlines()
    new_lines = lines[start:]
    next_offset = len(lines)
    if not args.no_update_cursor:
        cursor_path.write_text(str(next_offset), encoding="utf-8")
    payload = {
        "ok": True,
        "session_id": state["session_id"],
        "status": state.get("status"),
        "cursor_name": args.cursor_name,
        "start_line": start,
        "next_line": next_offset,
        "new_line_count": len(new_lines),
        "new_lines": new_lines[-args.max_lines:] if args.max_lines > 0 else new_lines,
        "log_path_text": str(text_path),
        "cursor_path": str(cursor_path),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


def cmd_stop(args: argparse.Namespace) -> int:
    state_path = Path(args.session_path)
    state = load_session_state(state_path)
    stop_file = Path(state["stop_file"])
    stop_file.write_text("stop\n", encoding="utf-8")
    deadline = time.time() + args.wait_timeout
    while time.time() < deadline:
        if state.get("pid") and not pid_alive(int(state["pid"])):
            break
        time.sleep(0.2)
    state = load_session_state(state_path)
    if state.get("pid") and not pid_alive(int(state["pid"])):
        state["status"] = "stopped"
    else:
        state["status"] = "stop_requested"
    state["last_update"] = now_ts()
    write_session_state(state_path, state)
    print(json.dumps(state, ensure_ascii=False, indent=2))
    return 0


def cmd_worker(args: argparse.Namespace) -> int:
    session_path = Path(args.session_path)
    state = load_session_state(session_path)
    result = make_result("_worker", argparse.Namespace(port=state["port"], baudrate=state["baudrate"], timeout=state["timeout"]))
    result["log_path_raw"] = state["log_path_raw"]
    result["log_path_text"] = state["log_path_text"]
    result["session_id"] = state["session_id"]
    ns = argparse.Namespace(
        port=state["port"],
        baudrate=state["baudrate"],
        timeout=state["timeout"],
        parity=state["parity"],
        bytesize=state["bytesize"],
        stopbits=state["stopbits"],
        xonxoff=state["xonxoff"],
        rtscts=state["rtscts"],
        dsrdtr=state["dsrdtr"],
    )
    try:
        ser = open_serial(ns)
        raw_path = Path(state["log_path_raw"])
        text_path = Path(state["log_path_text"])
        stop_path = Path(state["stop_file"])
        pending_text = ""
        total = 0
        state["status"] = "running"
        state["last_update"] = now_ts()
        write_session_state(session_path, state)
        while not stop_path.exists():
            chunk = ser.read(256)
            if not chunk:
                continue
            append_raw_log(raw_path, chunk)
            pending_text = append_rx_text_lines(text_path, pending_text, chunk)
            total += len(chunk)
            state["rx_bytes"] = total
            state["last_update"] = now_ts()
            write_session_state(session_path, state)
        flush_pending_rx_text(text_path, pending_text)
        ser.close()
        state["status"] = "stopped"
        state["rx_bytes"] = total
        state["last_update"] = now_ts()
        write_session_state(session_path, state)
        result["ok"] = True
        result["rx_bytes"] = total
        emit_result(result)
        return 0
    except RuntimeError as exc:
        error_type, msg = exc.args[0]
        state["status"] = "error"
        state["last_error"] = msg
        state["last_update"] = now_ts()
        write_session_state(session_path, state)
        return fail(result, error_type, msg)
    except Exception as exc:
        state["status"] = "error"
        state["last_error"] = str(exc)
        state["last_update"] = now_ts()
        write_session_state(session_path, state)
        return fail(result, "serial_error", str(exc))


def add_common_serial_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--port")
    parser.add_argument("--baudrate", type=int, default=115200)
    parser.add_argument("--timeout", type=float, default=1.0)
    parser.add_argument("--parity", default="N", choices=["N", "E", "O", "M", "S"])
    parser.add_argument("--bytesize", type=int, default=8, choices=[5, 6, 7, 8])
    parser.add_argument("--stopbits", type=float, default=1.0, choices=[1, 1.5, 2])
    parser.add_argument("--xonxoff", action="store_true")
    parser.add_argument("--rtscts", action="store_true")
    parser.add_argument("--dsrdtr", action="store_true")
    parser.add_argument("--output-dir")
    parser.add_argument("--json", action="store_true", default=True)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Windows local serial debug helper. Start serial capture before flash, USB tests, reboot, or power-cycle actions that may emit short-lived logs."
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("connect-test", help="verify the target serial port can be opened exclusively")
    add_common_serial_args(p)
    p.set_defaults(func=cmd_connect_test)

    p = sub.add_parser("send-text", help="send a text command over serial")
    add_common_serial_args(p)
    p.add_argument("--text", required=True)
    p.add_argument("--encoding", default="utf-8")
    p.add_argument("--line-ending", default="none", choices=["none", "lf", "cr", "crlf"])
    p.set_defaults(func=cmd_send_text)

    p = sub.add_parser("send-hex", help="send a hex payload over serial")
    add_common_serial_args(p)
    p.add_argument("--hex", required=True)
    p.set_defaults(func=cmd_send_hex)

    p = sub.add_parser("listen", help="listen to serial output for a bounded duration")
    add_common_serial_args(p)
    p.add_argument("--duration", type=float)
    p.set_defaults(func=cmd_listen)

    p = sub.add_parser("capture", help="capture a bounded chunk of serial logs")
    add_common_serial_args(p)
    p.add_argument("--duration", type=float)
    p.add_argument("--max-bytes", type=int)
    p.set_defaults(func=cmd_capture)

    p = sub.add_parser("session", help="run a short serial send/receive session with logs")
    add_common_serial_args(p)
    p.add_argument("--send-text")
    p.add_argument("--send-hex")
    p.add_argument("--encoding", default="utf-8")
    p.add_argument("--line-ending", default="none", choices=["none", "lf", "cr", "crlf"])
    p.add_argument("--duration", type=float)
    p.set_defaults(func=cmd_session)

    p = sub.add_parser("follow", help="follow serial logs until stop conditions are met")
    add_common_serial_args(p)
    p.add_argument("--stop-file")
    p.add_argument("--max-bytes", type=int)
    p.add_argument("--max-duration", type=float)
    p.add_argument("--idle-timeout", type=float)
    p.add_argument("--stop-text")
    p.set_defaults(func=cmd_follow)

    p = sub.add_parser("open", help="start continuous serial capture before flash, USB, reboot, or power-cycle actions")
    add_common_serial_args(p)
    p.set_defaults(func=cmd_open)

    p = sub.add_parser("status", help="show the current state of a background serial capture session")
    p.add_argument("--session-path", required=True)
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("peek", help="read the recent tail of a serial capture session")
    p.add_argument("--session-path", required=True)
    p.add_argument("--lines", type=int, default=40)
    p.set_defaults(func=cmd_peek)

    p = sub.add_parser("read-new", help="read only newly appended serial log lines from a capture session")
    p.add_argument("--session-path", required=True)
    p.add_argument("--cursor-name", default="default")
    p.add_argument("--max-lines", type=int, default=200)
    p.add_argument("--no-update-cursor", action="store_true")
    p.set_defaults(func=cmd_read_new)

    p = sub.add_parser("stop", help="stop a background serial capture session")
    p.add_argument("--session-path", required=True)
    p.add_argument("--wait-timeout", type=float, default=5.0)
    p.set_defaults(func=cmd_stop)

    p = sub.add_parser("_worker")
    p.add_argument("--session-path", required=True)
    p.set_defaults(func=cmd_worker)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
