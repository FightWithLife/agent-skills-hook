import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("normalize_encoding.py")
SPEC = importlib.util.spec_from_file_location("normalize_encoding", MODULE_PATH)
normalize_encoding = importlib.util.module_from_spec(SPEC)
assert SPEC is not None and SPEC.loader is not None
SPEC.loader.exec_module(normalize_encoding)


class NormalizePlanTests(unittest.TestCase):
    def test_build_plan_separates_convert_and_migration_candidates(self):
        audit = {
            "results": [
                {
                    "path": "src/comment_only.c",
                    "encoding": "gbk",
                    "file_class": "comment_only",
                    "summary": {"comment": 4, "string": 0, "code": 0},
                    "lines": [],
                },
                {
                    "path": "src/runtime.c",
                    "encoding": "shift_jis",
                    "file_class": "string_or_runtime",
                    "summary": {"comment": 0, "string": 2, "code": 0},
                    "lines": [
                        [10, 'printf("中文");', [[8, "中", "string"], [9, "文", "string"]]],
                    ],
                },
            ]
        }
        plan = normalize_encoding.build_plan(audit, compiler="armcc", no_bom_files=set())
        self.assertEqual(len(plan["convert_files"]), 1)
        self.assertEqual(plan["convert_files"][0]["path"], "src/comment_only.c")
        self.assertEqual(len(plan["migration_candidates"]), 1)
        self.assertEqual(plan["migration_candidates"][0]["path"], "src/runtime.c")
        self.assertEqual(plan["migration_candidates"][0]["encoding"], "shift_jis")
        self.assertTrue(plan["migration_candidates"][0]["old_string_literals"])

    def test_build_plan_marks_mk_files_no_bom(self):
        audit = {
            "results": [
                {
                    "path": "src/inc_config.mk",
                    "encoding": "gbk",
                    "file_class": "comment_only",
                    "summary": {"comment": 2, "string": 0, "code": 0},
                    "lines": [],
                }
            ]
        }
        plan = normalize_encoding.build_plan(audit, compiler="armcc", no_bom_files=set())
        self.assertFalse(plan["convert_files"][0]["use_bom"])

    def test_plain_text_files_convert_directly(self):
        audit = {
            "results": [
                {
                    "path": "docs/readme.md",
                    "encoding": "gbk",
                    "file_class": "string_or_runtime",
                    "summary": {"comment": 0, "string": 4, "code": 0},
                    "lines": [[1, "这是说明文档", [[0, "这", "string"]]]],
                },
                {
                    "path": "notes/todo.txt",
                    "encoding": "big5",
                    "file_class": "mixed_comment_and_runtime",
                    "summary": {"comment": 1, "string": 3, "code": 0},
                    "lines": [[1, "待办事项", [[0, "待", "string"]]]],
                },
            ]
        }
        plan = normalize_encoding.build_plan(audit, compiler="armcc", no_bom_files=set())
        convert_paths = {item["path"] for item in plan["convert_files"]}
        self.assertIn("docs/readme.md", convert_paths)
        self.assertIn("notes/todo.txt", convert_paths)
        self.assertFalse(plan["migration_candidates"])

    def test_write_plan_report_outputs_json(self):
        plan = {
            "convert_files": [{"path": "src/a.c", "encoding": "gbk", "target_encoding": "utf-8-sig", "use_bom": True}],
            "migration_candidates": [{"path": "src/b.c", "encoding": "gbk", "reason": "contains runtime Chinese strings", "string_lines": [3]}],
            "skipped_files": [],
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "plan.json"
            normalize_encoding.write_plan_report(plan, out_path)
            payload = json.loads(out_path.read_text(encoding="utf-8"))
        self.assertEqual(payload["convert_files"][0]["path"], "src/a.c")
        self.assertEqual(payload["migration_candidates"][0]["path"], "src/b.c")

    def test_replace_string_in_source_uses_explicit_source_encoding(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            source_path = Path(tmpdir) / "runtime.c"
            text = '#include "includes.h"\nvoid f(void){printf("中文");}\n'
            source_path.write_bytes(text.encode("shift_jis", errors="replace"))
            normalize_encoding.replace_string_in_source(
                str(source_path),
                '#include "includes.h"',
                "texts.h",
                '"中文"',
                "TXT_HELLO",
                source_encoding="shift_jis",
            )
            rewritten = source_path.read_text(encoding="utf-8-sig")
        self.assertIn('#include "texts.h"', rewritten)
        self.assertIn("TXT_HELLO", rewritten)


if __name__ == "__main__":
    unittest.main()
