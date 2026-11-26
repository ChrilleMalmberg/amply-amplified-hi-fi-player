"""AmPly Windows controller for Home Assistant."""
from homeassistant.const import CONF_HOST, CONF_PORT, CONF_TOKEN, Platform
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import AmplyClient
from .coordinator import AmplyCoordinator

PLATFORMS = [Platform.MEDIA_PLAYER]


async def async_setup_entry(hass, entry):
    client = AmplyClient(async_get_clientsession(hass), entry.data[CONF_HOST],
                         entry.data[CONF_PORT], entry.data[CONF_TOKEN])
    coordinator = AmplyCoordinator(hass, entry, client)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass, entry):
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)