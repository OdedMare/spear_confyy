import tempfile
import unittest
from pathlib import Path

from app.config import Settings
from app.runtime_settings import RuntimeSettingsStore


class RuntimeSettingsTests(unittest.TestCase):
    def test_normalizes_and_persists_locato_style_updates(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "runtime-settings.json")
            env = Settings(_env_file=None, runtime_settings_file=path)
            store = RuntimeSettingsStore(env)
            store.update({
                "llm_base_url": "https://llm.test/openai/v1/chat/completions",
                "openai_api_key": "secret-key",
                "database_url": "jdbc:postgresql://db.test:5432/spear",
            })
            store.update({"openai_api_key": ""})
            reloaded = RuntimeSettingsStore(env).get()
            self.assertEqual(reloaded.llm_base_url, "https://llm.test/openai/v1")
            self.assertEqual(reloaded.database_url, "postgresql://db.test:5432/spear")
            self.assertEqual(reloaded.openai_api_key, "secret-key")


if __name__ == "__main__":
    unittest.main()
