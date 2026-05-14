from __future__ import annotations

import argparse
import configparser
import csv
import json
from pathlib import Path


LOGIC_TIMING_HEADERS = [
    "test_method",
    "test_file",
    "test_case",
    "trigger_mode",
    "io_mapping",
    "expected_window_sec",
    "actual_window_sec",
    "captured_complete",
    "too_short",
    "too_long",
    "recommended_next_window_sec",
    "notes",
]


def parse_json_object(raw: str | None, field_name: str) -> dict[str, str]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"{field_name} 不是合法 JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit(f"{field_name} 必须是 JSON 对象")
    return {str(key): str(val) for key, val in value.items()}


def ensure_cache_dir(project_root: Path) -> Path:
    cache_dir = project_root / ".agents" / "cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


def keep_existing(config: configparser.ConfigParser, section: str, option: str, new_value: str) -> str:
    if new_value != "":
        return new_value
    if config.has_option(section, option):
        return config.get(section, option)
    return ""


def write_download_cfg(
    cfg_path: Path,
    target: str,
    transport: str,
    vid: str,
    pid: str,
    artifact_path: str,
    artifact_type: str,
    allow_raw: str,
    chunk_size: str,
    command_prefix_hex: str,
    pack_length_command: str,
    ota_command: str,
    ack_prefix_hex: str,
    ack_length: str,
    ack_offset_pos: str,
    ack_status_pos: str,
    query_pack_length: str,
    query_response_length: str,
    crc_type: str,
) -> None:
    config = configparser.ConfigParser()
    if cfg_path.exists():
        config.read(cfg_path, encoding="utf-8")

    config["device"] = {
        "target_name": target,
        "vid": keep_existing(config, "device", "vid", vid),
        "pid": keep_existing(config, "device", "pid", pid),
        "transport": keep_existing(config, "device", "transport", transport),
    }
    config["firmware"] = {
        "artifact_path": keep_existing(config, "firmware", "artifact_path", artifact_path),
        "artifact_type": keep_existing(config, "firmware", "artifact_type", artifact_type),
        "allow_raw": keep_existing(config, "firmware", "allow_raw", allow_raw),
    }
    config["protocol"] = {
        "chunk_size": keep_existing(config, "protocol", "chunk_size", chunk_size),
        "command_prefix_hex": keep_existing(config, "protocol", "command_prefix_hex", command_prefix_hex),
        "pack_length_command": keep_existing(config, "protocol", "pack_length_command", pack_length_command),
        "ota_command": keep_existing(config, "protocol", "ota_command", ota_command),
        "ack_prefix_hex": keep_existing(config, "protocol", "ack_prefix_hex", ack_prefix_hex),
        "ack_length": keep_existing(config, "protocol", "ack_length", ack_length),
        "ack_offset_pos": keep_existing(config, "protocol", "ack_offset_pos", ack_offset_pos),
        "ack_status_pos": keep_existing(config, "protocol", "ack_status_pos", ack_status_pos),
        "query_pack_length": keep_existing(config, "protocol", "query_pack_length", query_pack_length),
        "query_response_length": keep_existing(config, "protocol", "query_response_length", query_response_length),
        "crc_type": keep_existing(config, "protocol", "crc_type", crc_type),
    }

    with cfg_path.open("w", encoding="utf-8", newline="") as handle:
        config.write(handle)


def ensure_logic_timing_csv(csv_path: Path) -> None:
    if csv_path.exists():
        return
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=LOGIC_TIMING_HEADERS)
        writer.writeheader()


def append_logic_timing_row(
    csv_path: Path,
    test_method: str,
    test_file: str,
    test_case: str,
    trigger_mode: str,
    io_mapping: dict[str, str],
    expected_window_sec: str,
    recommended_next_window_sec: str,
    notes: str,
) -> bool:
    if not any([test_method, test_file, test_case, trigger_mode, io_mapping, expected_window_sec, recommended_next_window_sec, notes]):
        return False

    ensure_logic_timing_csv(csv_path)
    normalized_mapping = json.dumps(io_mapping, ensure_ascii=True, sort_keys=True) if io_mapping else ""
    if csv_path.exists():
        with csv_path.open("r", encoding="utf-8", newline="") as handle:
            reader = csv.DictReader(handle)
            for existing_row in reader:
                if (
                    existing_row.get("test_method", "") == test_method
                    and existing_row.get("test_file", "") == test_file
                    and existing_row.get("test_case", "") == test_case
                    and existing_row.get("trigger_mode", "") == trigger_mode
                    and existing_row.get("io_mapping", "") == normalized_mapping
                ):
                    return False

    row = {
        "test_method": test_method,
        "test_file": test_file,
        "test_case": test_case,
        "trigger_mode": trigger_mode,
        "io_mapping": normalized_mapping,
        "expected_window_sec": expected_window_sec,
        "actual_window_sec": "",
        "captured_complete": "",
        "too_short": "",
        "too_long": "",
        "recommended_next_window_sec": recommended_next_window_sec or expected_window_sec,
        "notes": notes,
    }
    with csv_path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=LOGIC_TIMING_HEADERS)
        writer.writerow(row)
    return True


def merge_kingstvis_map(
    json_path: Path,
    target: str,
    channel_map: dict[str, str],
    pin_map: dict[str, str],
    test_method: str,
    notes: str,
) -> bool:
    if not channel_map and not pin_map and not test_method:
        return False

    payload: dict[str, object]
    if json_path.exists():
        payload = json.loads(json_path.read_text(encoding="utf-8"))
    else:
        payload = {"targets": {}}

    targets = payload.setdefault("targets", {})
    if not isinstance(targets, dict):
        raise SystemExit("kingstvis_channel_maps.json 中的 targets 字段无效")

    target_entry = targets.setdefault(target, {})
    if not isinstance(target_entry, dict):
        raise SystemExit(f"kingstvis_channel_maps.json 中 target {target} 的结构无效")

    if channel_map:
        current = target_entry.get("channels", {})
        if not isinstance(current, dict):
            current = {}
        current.update(channel_map)
        target_entry["channels"] = current

    if pin_map:
        current = target_entry.get("pins", {})
        if not isinstance(current, dict):
            current = {}
        current.update(pin_map)
        target_entry["pins"] = current

    if test_method:
        methods = target_entry.get("test_methods", [])
        if not isinstance(methods, list):
            methods = []
        if test_method not in methods:
            methods.append(test_method)
        target_entry["test_methods"] = methods

    if notes:
        target_entry["notes"] = notes

    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="初始化项目内 embedded workflow cache 文件")
    parser.add_argument("--project-root", default=".", help="项目根目录，默认当前目录")
    parser.add_argument("--target", required=True, help="目标名称，用于生成 <target>_download.cfg")
    parser.add_argument("--transport", default="", help="传输类型，如 usb/hid/serial")
    parser.add_argument("--vid", default="", help="USB VID，例如 0x1234")
    parser.add_argument("--pid", default="", help="USB PID，例如 0x5678")
    parser.add_argument("--artifact-path", default="", help="固件产物路径")
    parser.add_argument("--artifact-type", default="", help="固件类型，如 bin/hex/uf2")
    parser.add_argument("--allow-raw", default="", help="是否允许原始固件，建议 true/false")
    parser.add_argument("--chunk-size", default="", help="分包大小")
    parser.add_argument("--command-prefix-hex", default="", help="协议前缀十六进制字符串")
    parser.add_argument("--pack-length-command", default="", help="读包长命令")
    parser.add_argument("--ota-command", default="", help="升级命令")
    parser.add_argument("--ack-prefix-hex", default="", help="ACK 前缀十六进制字符串")
    parser.add_argument("--ack-length", default="", help="ACK 长度")
    parser.add_argument("--ack-offset-pos", default="", help="ACK 偏移字段位置")
    parser.add_argument("--ack-status-pos", default="", help="ACK 状态字段位置")
    parser.add_argument("--query-pack-length", default="", help="查询包长命令")
    parser.add_argument("--query-response-length", default="", help="查询包长响应长度")
    parser.add_argument("--crc-type", default="", help="CRC 类型")
    parser.add_argument("--test-method", default="", help="测试方法，如 usb_cmd/power_on")
    parser.add_argument("--test-file", default="", help="测试文件或模块名")
    parser.add_argument("--test-case", default="", help="测试用例名")
    parser.add_argument("--trigger-mode", default="", help="触发方式")
    parser.add_argument("--expected-window-sec", default="", help="预估抓取窗口")
    parser.add_argument("--recommended-next-window-sec", default="", help="建议下次窗口")
    parser.add_argument("--channel-map", default="", help="逻辑分析仪通道映射 JSON")
    parser.add_argument("--pin-map", default="", help="MCU 引脚映射 JSON")
    parser.add_argument("--notes", default="", help="补充说明")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    project_root = Path(args.project_root).resolve()
    cache_dir = ensure_cache_dir(project_root)

    channel_map = parse_json_object(args.channel_map, "--channel-map")
    pin_map = parse_json_object(args.pin_map, "--pin-map")

    download_cfg_path = cache_dir / f"{args.target}_download.cfg"
    write_download_cfg(
        cfg_path=download_cfg_path,
        target=args.target,
        transport=args.transport,
        vid=args.vid,
        pid=args.pid,
        artifact_path=args.artifact_path,
        artifact_type=args.artifact_type,
        allow_raw=args.allow_raw,
        chunk_size=args.chunk_size,
        command_prefix_hex=args.command_prefix_hex,
        pack_length_command=args.pack_length_command,
        ota_command=args.ota_command,
        ack_prefix_hex=args.ack_prefix_hex,
        ack_length=args.ack_length,
        ack_offset_pos=args.ack_offset_pos,
        ack_status_pos=args.ack_status_pos,
        query_pack_length=args.query_pack_length,
        query_response_length=args.query_response_length,
        crc_type=args.crc_type,
    )

    logic_timing_path = cache_dir / "logic_timing_windows.csv"
    logic_row_added = append_logic_timing_row(
        csv_path=logic_timing_path,
        test_method=args.test_method,
        test_file=args.test_file,
        test_case=args.test_case,
        trigger_mode=args.trigger_mode,
        io_mapping=channel_map if channel_map else pin_map,
        expected_window_sec=args.expected_window_sec,
        recommended_next_window_sec=args.recommended_next_window_sec,
        notes=args.notes,
    )

    kingstvis_map_path = cache_dir / "kingstvis_channel_maps.json"
    kingstvis_updated = merge_kingstvis_map(
        json_path=kingstvis_map_path,
        target=args.target,
        channel_map=channel_map,
        pin_map=pin_map,
        test_method=args.test_method,
        notes=args.notes,
    )

    print(f"created: {download_cfg_path}")
    print(f"logic_timing_csv: {logic_timing_path} ({'updated' if logic_row_added else 'not-requested'})")
    print(f"kingstvis_map: {kingstvis_map_path} ({'updated' if kingstvis_updated else 'not-requested'})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
