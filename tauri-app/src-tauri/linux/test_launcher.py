"""Launcher contract tests; no real game, GPU, or MangoHud installation needed."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="cleanmeter launcher ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.launcher = Path(__file__).with_name("cleanmeter-run")
        fake = self.root / "mangohud"
        fake.write_text("""#!/usr/bin/env python3
import json, os, pathlib, sys
if sys.argv[1:] == ['--version']:
    print(os.environ.get('TEST_VERSION', 'v0.7.2'))
    sys.exit(0)
config = pathlib.Path(os.environ['MANGOHUD_CONFIGFILE'])
pathlib.Path(os.environ['TEST_RESULT']).write_text(json.dumps({
    'args': sys.argv[1:], 'config': config.read_text(),
    'mode': config.parent.stat().st_mode & 0o777,
    'overrides': os.environ['MANGOHUD_CONFIG'],
}))
sys.exit(17)
""")
        fake.chmod(0o755)
        self.env = dict(os.environ, PATH=f"{self.root}:{os.environ['PATH']}",
                        XDG_CACHE_HOME=str(self.root / "cache with spaces"),
                        TEST_RESULT=str(self.root / "result.json"))

    def run_launcher(self, *args):
        return subprocess.run(["sh", str(self.launcher), *args], env=self.env,
                              capture_output=True, text=True, timeout=10)

    def test_literal_arguments_private_config_exit_code_and_cleanup(self):
        args = ["/games/My Game", "a b", "$(touch bad)", 'a"b', "100%"]
        result = self.run_launcher(*args)
        self.assertEqual(result.returncode, 17, result.stderr)
        captured = json.loads((self.root / "result.json").read_text())
        self.assertEqual(captured["args"], args)
        self.assertEqual(captured["mode"], 0o700)
        self.assertIn("log_interval=100\n", captured["config"])
        self.assertIn("permit_upload=0", captured["overrides"])
        self.assertIn("alpha=0", captured["overrides"])
        self.assertNotIn("no_display", captured["overrides"])
        self.assertEqual(list((Path(self.env["XDG_CACHE_HOME"]) / "cleanmeter/fps").iterdir()), [])

    def test_rejects_old_or_unknown_mangohud_without_starting_game(self):
        for version in ["0.6.5", "v0.6.9", "unknown", ""]:
            self.env["TEST_VERSION"] = version
            result = self.run_launcher("game")
            self.assertEqual(result.returncode, 1)
            self.assertIn("0.7.0 or newer", result.stderr)
        self.assertFalse((self.root / "result.json").exists())

    def test_accepts_upstream_and_distro_version_formats(self):
        for version in ["v0.7.2", "0.7.0", "v1.0.0"]:
            self.env["TEST_VERSION"] = version
            self.assertEqual(self.run_launcher("game").returncode, 17)

    def test_usage_without_game(self):
        self.assertEqual(self.run_launcher().returncode, 2)

    def test_rejects_config_separator_in_cache_path(self):
        self.env["XDG_CACHE_HOME"] = str(self.root / "comma,path")
        result = self.run_launcher("game")
        self.assertEqual(result.returncode, 1)
        self.assertIn("without commas", result.stderr)


if __name__ == "__main__":
    unittest.main()
