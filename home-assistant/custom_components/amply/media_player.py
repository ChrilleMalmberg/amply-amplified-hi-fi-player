"""Expose only controls that the Windows player really supports."""
from homeassistant.components.media_player import MediaPlayerEntity, MediaPlayerEntityFeature, MediaPlayerState, RepeatMode
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .api import CannotConnect, InvalidAuth
from .const import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([AmplyMediaPlayer(entry.runtime_data, entry)])


class AmplyMediaPlayer(CoordinatorEntity, MediaPlayerEntity):
    _attr_has_entity_name = True
    _attr_name = None
    _attr_supported_features = (
        MediaPlayerEntityFeature.PLAY | MediaPlayerEntityFeature.PAUSE |
        MediaPlayerEntityFeature.STOP | MediaPlayerEntityFeature.NEXT_TRACK |
        MediaPlayerEntityFeature.PREVIOUS_TRACK | MediaPlayerEntityFeature.SEEK |
        MediaPlayerEntityFeature.VOLUME_SET | MediaPlayerEntityFeature.SHUFFLE_SET |
        MediaPlayerEntityFeature.REPEAT_SET | MediaPlayerEntityFeature.SELECT_SOURCE
    )

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._attr_unique_id = entry.unique_id
        self._attr_device_info = {"identifiers": {(DOMAIN, entry.unique_id)}, "name": "AmPly Windows",
                                  "manufacturer": "AmPly", "model": "Windows music player"}
        self._position_updated = dt_util.utcnow()

    def _handle_coordinator_update(self):
        self._position_updated = dt_util.utcnow()
        super()._handle_coordinator_update()

    @property
    def state(self):
        return {"playing": MediaPlayerState.PLAYING, "paused": MediaPlayerState.PAUSED,
                "idle": MediaPlayerState.IDLE}[self.coordinator.data["state"]]

    @property
    def volume_level(self):
        return self.coordinator.data["volume"]

    @property
    def media_title(self):
        return self.coordinator.data.get("title") or None

    @property
    def media_duration(self):
        return self.coordinator.data["duration"] or None

    @property
    def media_position(self):
        return self.coordinator.data["position"]

    @property
    def media_position_updated_at(self):
        return self._position_updated

    @property
    def shuffle(self):
        return self.coordinator.data["shuffle"]

    @property
    def repeat(self):
        return {"off": RepeatMode.OFF, "all": RepeatMode.ALL, "track": RepeatMode.ONE}[self.coordinator.data["repeat"]]

    @property
    def source_list(self):
        return [f"{t['index'] + 1}. {t['title']}" for t in self.coordinator.data["queue"]]

    @property
    def source(self):
        current = self.coordinator.data["current"]
        return self.source_list[current] if 0 <= current < len(self.source_list) else None

    async def _command(self, command, value=None):
        try:
            await self.coordinator.client.command(command, value)
            await self.coordinator.async_refresh()
        except (CannotConnect, InvalidAuth) as err:
            await self.coordinator.async_request_refresh()
            raise HomeAssistantError("AmPly did not confirm the command; check the Windows player") from err

    async def async_media_play(self):
        await self._command("play")

    async def async_media_pause(self):
        await self._command("pause")

    async def async_media_stop(self):
        await self._command("stop")

    async def async_media_next_track(self):
        await self._command("next")

    async def async_media_previous_track(self):
        await self._command("previous")

    async def async_media_seek(self, position):
        await self._command("seek", position)

    async def async_set_volume_level(self, volume):
        await self._command("volume", volume)

    async def async_set_shuffle(self, shuffle):
        await self._command("shuffle", shuffle)

    async def async_set_repeat(self, repeat):
        modes = {RepeatMode.OFF: "off", RepeatMode.ALL: "all", RepeatMode.ONE: "track"}
        if repeat not in modes:
            raise HomeAssistantError("Unsupported repeat mode")
        await self._command("repeat", modes[repeat])

    async def async_select_source(self, source):
        if source not in self.source_list:
            raise HomeAssistantError("Track is no longer in the AmPly queue")
        await self._command("track", self.source_list.index(source))