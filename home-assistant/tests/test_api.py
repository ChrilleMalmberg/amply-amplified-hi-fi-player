"""Run with: python3 -m unittest discover -s home-assistant/tests."""
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("amply_api", pathlib.Path(__file__).parents[1] / "custom_components/amply/api.py")
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


class LocalApiRules(unittest.TestCase):
    def test_private_pc_only(self):
        self.assertEqual(api.validate_address("192.168.1.12", 47824, "a" * 64), "http://192.168.1.12:47824")
        for address in ("8.8.8.8", "https://amply.win", "192.168.1.1/secret", "localhost"):
            with self.assertRaises(ValueError):
                api.validate_address(address, 47824, "a" * 64)

    def test_bad_key_rejected(self):
        with self.assertRaises(ValueError):
            api.validate_address("192.168.1.12", 47824, "wrong")

    def test_verified_paused_state(self):
        state = dict(api_version=1, device_id="pc", state="paused", volume=0.35, position=4,
                     duration=30, shuffle=False, repeat="track", current=0,
                     queue=[{"index": 0, "title": "Song"}])
        self.assertEqual(api.validate_state(state)["state"], "paused")
        state["volume"] = 2
        with self.assertRaises(api.CannotConnect):
            api.validate_state(state)


if __name__ == "__main__":
    unittest.main()