"""Optional real-runtime test against a running Electron test profile.

Set AMPLY_TEST_PROFILE to an isolated test profile directory, never a live account.
"""
import os
import pathlib
import unittest


@unittest.skipUnless(os.environ.get("AMPLY_TEST_PROFILE"), "Requires the running desktop test player")
class HomeAssistantPlayback(unittest.IsolatedAsyncioTestCase):
    async def test_pair_and_control_windows_player(self):
        import json
        import shutil
        import tempfile

        from homeassistant import bootstrap, loader
        from homeassistant.core import HomeAssistant

        profile = pathlib.Path(os.environ["AMPLY_TEST_PROFILE"])
        settings = json.loads((profile / "home-assistant.json").read_text())
        with tempfile.TemporaryDirectory(prefix="amply-ha-runtime-") as directory:
            integration = pathlib.Path(__file__).parents[1] / "custom_components/amply"
            shutil.copytree(integration, pathlib.Path(directory) / "custom_components/amply", ignore=shutil.ignore_patterns("__pycache__"))
            hass = HomeAssistant(directory)
            loader.async_setup(hass)
            try:
                await bootstrap.async_from_config_dict({"homeassistant": {}}, hass=hass)
                # Pair through the real config flow, not a mocked integration client.
                result = await hass.config_entries.flow.async_init("amply", context={"source": "user"}, data={
                    "host": "127.0.0.1", "port": 47824, "token": settings["token"],
                })
                self.assertEqual(result["type"], "create_entry")
                await hass.async_block_till_done()
                players = hass.states.async_all("media_player")
                self.assertEqual(len(players), 1)
                entity_id = players[0].entity_id

                async def action(name, **data):
                    await hass.services.async_call("media_player", name, {"entity_id": entity_id, **data}, blocking=True)
                    await hass.async_block_till_done()
                    return hass.states.get(entity_id)

                self.assertEqual((await action("media_play")).state, "playing")
                self.assertAlmostEqual((await action("volume_set", volume_level=0.28)).attributes["volume_level"], 0.28)
                self.assertEqual((await action("media_pause")).state, "paused")
                self.assertEqual((await action("media_pause")).state, "paused")
                self.assertEqual((await action("media_play")).state, "playing")
                self.assertEqual((await action("media_next_track")).attributes["media_title"], "First")
                self.assertEqual((await action("media_previous_track")).attributes["media_title"], "Second")
                await action("media_seek", seek_position=7)
                self.assertGreaterEqual(hass.states.get(entity_id).attributes["media_position"], 6.5)
                self.assertTrue((await action("shuffle_set", shuffle=True)).attributes["shuffle"])
                self.assertEqual((await action("repeat_set", repeat="one")).attributes["repeat"], "one")
                self.assertEqual((await action("select_source", source="1. First")).attributes["media_title"], "First")
                self.assertEqual((await action("media_stop")).state, "idle")
                duplicate = await hass.config_entries.flow.async_init("amply", context={"source": "user"}, data={
                    "host": "127.0.0.1", "port": 47824, "token": settings["token"],
                })
                self.assertEqual(duplicate["reason"], "already_configured")
            finally:
                await hass.async_stop()