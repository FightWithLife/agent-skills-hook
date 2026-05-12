import importlib.util
import sys
import tempfile
import threading
import time
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("kingstvis_socket_client.py")
SPEC = importlib.util.spec_from_file_location("kingstvis_socket_client", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)
TMP_ROOT = Path(__file__).resolve().parent / ".tmp_test"
TMP_ROOT.mkdir(parents=True, exist_ok=True)


class BuildExportCommandTests(unittest.TestCase):
    def test_build_export_command_with_channels_and_time_span(self):
        output = Path(r"D:\save\data1.csv")
        command = MODULE.build_export_command(output, ["0", "1"], ["0.01", "0.5"])
        self.assertEqual(
            command,
            'export-data "D:\\save\\data1.csv" --chn-select 0 1 --time-span 0.01 0.5',
        )


class BuildResultTests(unittest.TestCase):
    def test_empty_response_without_output_is_not_success(self):
        result = MODULE.build_result("start", "")
        self.assertFalse(result.ok)
        self.assertEqual(result.response, "")
        self.assertIsNone(result.output_exists)

    def test_empty_response_with_existing_output_is_success(self):
        with tempfile.TemporaryDirectory(dir=TMP_ROOT) as tmp:
            output = Path(tmp) / "capture.csv"
            output.write_text("ok", encoding="utf-8")
            result = MODULE.build_result("export-data", "", output)
            self.assertTrue(result.ok)
            self.assertTrue(result.output_exists)

    def test_wait_for_async_output_marks_success(self):
        with tempfile.TemporaryDirectory(dir=TMP_ROOT) as tmp:
            output = Path(tmp) / "capture.csv"

            def create_file() -> None:
                time.sleep(0.1)
                output.write_text("ok", encoding="utf-8")

            worker = threading.Thread(target=create_file)
            worker.start()
            result = MODULE.build_result(
                "export-data",
                "",
                output,
                wait_for_output_timeout=0.5,
            )
            worker.join()
            self.assertTrue(result.ok)
            self.assertTrue(result.output_exists)


class StartCommandTests(unittest.TestCase):
    def test_start_empty_response_can_be_confirmed_by_last_error(self):
        class FakeClient:
            def __init__(self):
                self.calls = []

            def send(self, command, output_path=None, **kwargs):
                self.calls.append(command)
                if command == "start":
                    return MODULE.build_result("start", "")
                if command == "get-last-error":
                    return MODULE.build_result("get-last-error", "sampling in progress")
                raise AssertionError(command)

        client = FakeClient()
        result = MODULE.send_start_and_confirm(client, "start")
        self.assertTrue(result.ok)
        self.assertEqual(client.calls, ["start", "get-last-error"])
        self.assertIn("sampling in progress", result.response)


class CaptureWorkflowTests(unittest.TestCase):
    def test_capture_stops_before_export(self):
        calls = []

        class FakeClient:
            def __init__(self, host, port, timeout):
                self.host = host
                self.port = port
                self.timeout = timeout

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return None

            def send(self, command, output_path=None, **kwargs):
                calls.append(command)
                if command == "start":
                    return MODULE.build_result("start", "ACK")
                if command == "stop":
                    return MODULE.build_result("stop", "ACK")
                if command.startswith("export-data "):
                    if output_path is not None:
                        output_path.parent.mkdir(parents=True, exist_ok=True)
                        output_path.write_text("ok", encoding="utf-8")
                    return MODULE.build_result("export-data", "ACK", output_path)
                raise AssertionError(command)

        args = Namespace(
            host="127.0.0.1",
            port=23367,
            timeout=1.0,
            simulate=False,
            pre_command=None,
            sample_rate=None,
            sample_depth=None,
            sample_time=None,
            threshold_voltage=None,
            reset_trigger=False,
            low_level=None,
            high_level=None,
            pos_edge=None,
            neg_edge=None,
            channels=None,
            time_span=None,
            count=1,
            interval=0.0,
            wait_after_start=0.0,
            wait_after_stop=0.0,
            output_dir=tempfile.mkdtemp(dir=TMP_ROOT),
            basename="capture",
            format="csv",
            path=None,
            fallback_kvdat=False,
            stop_on_error=True,
        )

        with patch.object(MODULE, "KingstVisClient", FakeClient):
            rc = MODULE.run_capture(args)

        self.assertEqual(rc, 0)
        self.assertEqual(calls[0], "start")
        self.assertEqual(calls[1], "stop")
        self.assertTrue(calls[2].startswith("export-data "))


if __name__ == "__main__":
    unittest.main()
