import argparse
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("serial_tool.py")
SPEC = importlib.util.spec_from_file_location("serial_tool", MODULE_PATH)
serial_tool = importlib.util.module_from_spec(SPEC)
assert SPEC is not None and SPEC.loader is not None
SPEC.loader.exec_module(serial_tool)


class FakeSerial:
    def __init__(self, chunks):
        self._chunks = list(chunks)
        self.is_open = True

    def read(self, _size):
        if self._chunks:
            return self._chunks.pop(0)
        return b""

    def close(self):
        self.is_open = False


class WorkerIdleTimeoutTests(unittest.TestCase):
    def test_worker_stops_when_idle_timeout_exceeded(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            session_dir = root / "session"
            session_dir.mkdir()
            raw_path = session_dir / "serial_raw.bin"
            text_path = session_dir / "serial_text.log"
            stop_file = session_dir / "stop.flag"
            session_path = session_dir / "session.json"
            raw_path.write_bytes(b"")
            text_path.write_text("", encoding="utf-8")
            state = {
                "session_id": "test_session",
                "status": "running",
                "port": "COM9",
                "baudrate": 115200,
                "timeout": 0.01,
                "parity": "N",
                "bytesize": 8,
                "stopbits": 1.0,
                "rtscts": False,
                "dsrdtr": False,
                "xonxoff": False,
                "log_path_raw": str(raw_path),
                "log_path_text": str(text_path),
                "session_path": str(session_path),
                "stop_file": str(stop_file),
                "pid": 1234,
                "rx_bytes": 0,
                "last_update": "init",
                "last_error": "",
                "idle_timeout": 0.05,
            }
            session_path.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
            args = argparse.Namespace(session_path=str(session_path))

            fake_time = {"now": 0.0}

            def time_side_effect():
                fake_time["now"] += 0.02
                return fake_time["now"]

            with patch.object(serial_tool, "open_serial", return_value=FakeSerial([])), patch.object(
                serial_tool.time, "time", side_effect=time_side_effect
            ):
                exit_code = serial_tool.cmd_worker(args)

            self.assertEqual(exit_code, 0)
            final_state = json.loads(session_path.read_text(encoding="utf-8"))
            self.assertEqual(final_state["status"], "idle_stopped")
            self.assertEqual(final_state["close_reason"], "idle_timeout")
            self.assertIn("idle", final_state["close_message"])
            text_log = text_path.read_text(encoding="utf-8")
            self.assertIn("idle timeout", text_log)


if __name__ == "__main__":
    unittest.main()
