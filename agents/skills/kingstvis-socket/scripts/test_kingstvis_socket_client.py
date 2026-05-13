import importlib.util
import sys
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
        output = Path(r"D:\virtual\capture.csv")
        with patch.object(MODULE, "wait_for_output_path", return_value=True):
            result = MODULE.build_result("export-data", "", output)
        self.assertTrue(result.ok)
        self.assertTrue(result.output_exists)

    def test_wait_for_async_output_marks_success(self):
        output = Path(r"D:\virtual\capture.csv")
        with patch.object(MODULE, "wait_for_output_path", return_value=True):
            result = MODULE.build_result(
                "export-data",
                "",
                output,
                wait_for_output_timeout=0.5,
            )
        self.assertTrue(result.ok)
        self.assertTrue(result.output_exists)


class StartCommandTests(unittest.TestCase):
    def test_start_does_not_follow_with_last_error_on_same_connection(self):
        class FakeClient:
            def __init__(self):
                self.calls = []

            def send(self, command, output_path=None, **kwargs):
                self.calls.append(command)
                if command == "start":
                    return MODULE.build_result("start", "")
                raise AssertionError(command)

        client = FakeClient()
        result = client.send("start")
        self.assertFalse(result.ok)
        self.assertEqual(client.calls, ["start"])


class CaptureWorkflowTests(unittest.TestCase):
    def test_capture_uses_new_connection_for_start_stop_export(self):
        calls = []
        lifecycle = []
        next_connection_id = 0

        class FakeClient:
            def __init__(self, host, port, timeout):
                nonlocal next_connection_id
                self.host = host
                self.port = port
                self.timeout = timeout
                self.connection_id = next_connection_id
                next_connection_id += 1

            def __enter__(self):
                lifecycle.append(("enter", self.connection_id))
                return self

            def __exit__(self, exc_type, exc, tb):
                lifecycle.append(("exit", self.connection_id))
                return None

            def send(self, command, output_path=None, **kwargs):
                calls.append((self.connection_id, command))
                if command == "start":
                    return MODULE.build_result("start", "ACK")
                if command == "stop":
                    return MODULE.build_result("stop", "ACK")
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
            output_dir=r"D:\Data\Code\agent-skills-hook",
            basename="capture",
            format="csv",
            path=None,
            fallback_kvdat=False,
            stop_on_error=True,
        )

        def fake_export_with_optional_fallback(client, output, fallback_kvdat, channels, time_span):
            calls.append((client.connection_id, f'export-data "{output}"'))
            return MODULE.CommandResult(
                command="export-data",
                response="ACK",
                ok=True,
                output_path=str(output),
                output_exists=True,
            )

        with (
            patch.object(MODULE, "KingstVisClient", FakeClient),
            patch.object(MODULE, "append_manifest", lambda *args, **kwargs: None),
            patch.object(MODULE, "export_with_optional_fallback", fake_export_with_optional_fallback),
        ):
            rc = MODULE.run_capture(args)

        self.assertEqual(rc, 0)
        self.assertEqual(calls[0], (1, "start"))
        self.assertEqual(calls[1], (2, "stop"))
        self.assertTrue(calls[2][1].startswith("export-data "))
        self.assertEqual(calls[2][0], 3)
        self.assertEqual(
            lifecycle,
            [
                ("enter", 0),
                ("exit", 0),
                ("enter", 1),
                ("exit", 1),
                ("enter", 2),
                ("exit", 2),
                ("enter", 3),
                ("exit", 3),
            ],
        )


class BackgroundCaptureTests(unittest.TestCase):
    def test_build_parser_accepts_background_commands(self):
        parser = MODULE.build_parser()
        args = parser.parse_args(["capture-status", "--status-file", "capture_status.json"])
        self.assertEqual(args.command_name, "capture-status")
        args = parser.parse_args(["capture-wait", "--status-file", "capture_status.json"])
        self.assertEqual(args.command_name, "capture-wait")
        args = parser.parse_args(["capture-runner", "--status-file", "capture_status.json"])
        self.assertEqual(args.command_name, "capture-runner")

    def test_capture_bg_writes_pending_status_file(self):
        temp_dir = Path(self.id().replace(".", "_"))
        status_path = temp_dir / "capture_status.json"
        args = Namespace(
            host="127.0.0.1",
            port=23367,
            timeout=1.0,
            status_file=str(status_path),
            python_executable=sys.executable,
        )

        launched = {}

        class FakePopen:
            def __init__(self, command, **kwargs):
                launched["command"] = command
                launched["kwargs"] = kwargs
                self.pid = 4321

        with (
            patch.object(MODULE.subprocess, "Popen", FakePopen),
            patch.object(MODULE, "timestamp", return_value="20260513_120000"),
        ):
            rc = MODULE.run_capture_bg(args)

        self.assertEqual(rc, 0)
        self.assertTrue(status_path.exists())
        payload = MODULE.json.loads(status_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["status"], "running")
        self.assertEqual(payload["pid"], 4321)
        self.assertEqual(payload["started_at"], "20260513_120000")
        self.assertIn("capture-runner", launched["command"])

    def test_capture_status_reports_missing_file(self):
        args = Namespace(status_file=str(Path("missing_status.json")))
        with patch("builtins.print") as mocked_print:
            rc = MODULE.run_capture_status(args)
        self.assertEqual(rc, 2)
        printed = mocked_print.call_args[0][0]
        payload = MODULE.json.loads(printed)
        self.assertEqual(payload["status"], "missing")

    def test_capture_wait_returns_success_for_completed_status(self):
        status_path = Path("capture_wait_status.json")
        status_path.write_text(
            MODULE.json.dumps(
                {
                    "status": "completed",
                    "exit_code": 0,
                    "output_exists": True,
                }
            ),
            encoding="utf-8",
        )
        args = Namespace(status_file=str(status_path), poll_interval=0.01, wait_timeout=0.1)
        with patch("builtins.print"):
            rc = MODULE.run_capture_wait(args)
        self.assertEqual(rc, 0)


if __name__ == "__main__":
    unittest.main()
