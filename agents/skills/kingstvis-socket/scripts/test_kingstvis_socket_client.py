import importlib.util
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path


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
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "capture.csv"
            output.write_text("ok", encoding="utf-8")
            result = MODULE.build_result("export-data", "", output)
            self.assertTrue(result.ok)
            self.assertTrue(result.output_exists)

    def test_wait_for_async_output_marks_success(self):
        with tempfile.TemporaryDirectory() as tmp:
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


if __name__ == "__main__":
    unittest.main()
