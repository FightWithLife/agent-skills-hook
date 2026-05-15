import importlib.util
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("scan_encoding.py")
SPEC = importlib.util.spec_from_file_location("scan_encoding", MODULE_PATH)
scan_encoding = importlib.util.module_from_spec(SPEC)
assert SPEC is not None and SPEC.loader is not None
SPEC.loader.exec_module(scan_encoding)


class AnalyzeTextTests(unittest.TestCase):
    def test_comment_only_file_is_classified(self):
        text = "/* 中文注释 */\nint a = 1;\n"
        result = scan_encoding.analyze_text(text)
        self.assertTrue(result["has_chinese"])
        self.assertEqual(result["summary"]["comment"], 4)
        self.assertEqual(result["summary"]["string"], 0)
        self.assertEqual(result["file_class"], "comment_only")

    def test_string_file_is_classified(self):
        text = 'printf("中文");\n'
        result = scan_encoding.analyze_text(text)
        self.assertEqual(result["summary"]["string"], 2)
        self.assertEqual(result["summary"]["comment"], 0)
        self.assertEqual(result["file_class"], "string_or_runtime")

    def test_block_comment_across_lines_stays_comment(self):
        text = "/* 第一行中文\n第二行中文 */\nint a = 0;\n"
        result = scan_encoding.analyze_text(text)
        self.assertEqual(result["summary"]["comment"], 10)
        self.assertEqual(result["summary"]["code"], 0)
        self.assertEqual(result["file_class"], "comment_only")

    def test_mixed_file_is_classified(self):
        text = '// 注释\nprintf("中文");\n'
        result = scan_encoding.analyze_text(text)
        self.assertGreater(result["summary"]["comment"], 0)
        self.assertGreater(result["summary"]["string"], 0)
        self.assertEqual(result["file_class"], "mixed_comment_and_runtime")

    def test_markdown_report_contains_classification(self):
        rows = [
            {
                "path": "src/demo.c",
                "encoding": "gbk",
                "lines": [(1, '/* 中文 */', [(3, "中", "comment"), (4, "文", "comment")])],
                "summary": {"comment": 2, "string": 0, "code": 0},
                "file_class": "comment_only",
            }
        ]
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "encoding_audit.md"
            scan_encoding.write_markdown_report(rows, out_path)
            report = out_path.read_text(encoding="utf-8")
        self.assertIn("文件分类", report)
        self.assertIn("comment_only", report)


if __name__ == "__main__":
    unittest.main()
