import unittest

from app.gitlab import _eligible


class GitLabFilterTests(unittest.TestCase):
    def test_keeps_source_and_excludes_secrets_and_vendor(self):
        self.assertTrue(_eligible("services/api/main.py", ["services/api"]))
        self.assertFalse(_eligible("services/api/.env", ["services/api"]))
        self.assertFalse(_eligible("services/api/node_modules/lib.js", ["services/api"]))
        self.assertFalse(_eligible("services/web/main.ts", ["services/api"]))


if __name__ == "__main__":
    unittest.main()
