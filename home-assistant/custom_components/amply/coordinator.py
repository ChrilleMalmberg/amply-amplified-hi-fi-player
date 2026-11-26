"""Share one polling request across AmPly controls."""
import logging
from datetime import timedelta

from homeassistant.exceptions import ConfigEntryAuthFailed
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import AmplyClient, CannotConnect, InvalidAuth
from .const import DOMAIN


class AmplyCoordinator(DataUpdateCoordinator):
    def __init__(self, hass, entry, client: AmplyClient):
        super().__init__(hass, logging.getLogger(__name__), name=DOMAIN,
                         config_entry=entry, update_interval=timedelta(seconds=2))
        self.client = client

    async def _async_update_data(self):
        try:
            return await self.client.state()
        except InvalidAuth as err:
            raise ConfigEntryAuthFailed("Replace the pairing key in AmPly settings") from err
        except CannotConnect as err:
            raise UpdateFailed("Open AmPly on the paired Windows PC") from err