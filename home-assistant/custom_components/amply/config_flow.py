"""Pair a Windows player without editing configuration files."""
import probatio

from homeassistant.config_entries import ConfigFlow
from homeassistant.const import CONF_HOST, CONF_PORT, CONF_TOKEN
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import AmplyClient, CannotConnect, InvalidAuth
from .const import DEFAULT_PORT, DOMAIN


def schema():
    return probatio.Schema({
        probatio.Required(CONF_HOST): str,
        probatio.Required(CONF_PORT, default=DEFAULT_PORT): int,
        probatio.Required(probatio.Secret(CONF_TOKEN)): str,
    })


class AmplyConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def validate_player(self, data):
        return await AmplyClient(async_get_clientsession(self.hass),
                                 data[CONF_HOST], data[CONF_PORT], data[CONF_TOKEN].strip()).state()

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            try:
                state = await self.validate_player(user_input)
            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except ValueError:
                errors["base"] = "invalid_input"
            except CannotConnect:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(state["device_id"])
                self._abort_if_unique_id_configured()
                data = {**user_input, CONF_HOST: user_input[CONF_HOST].strip(), CONF_TOKEN: user_input[CONF_TOKEN].strip()}
                return self.async_create_entry(title=f"AmPly ({data[CONF_HOST]})", data=data)
        return self.async_show_form(step_id="user", data_schema=schema(), errors=errors)

    async def async_step_reauth(self, entry_data):
        return await self.async_step_reauth_confirm()

    async def async_step_reauth_confirm(self, user_input=None):
        errors = {}
        if user_input is not None:
            entry = self._get_reauth_entry()
            data = {**entry.data, CONF_TOKEN: user_input[CONF_TOKEN].strip()}
            try:
                state = await self.validate_player(data)
            except InvalidAuth:
                errors["base"] = "invalid_auth"
            except ValueError:
                errors["base"] = "invalid_input"
            except CannotConnect:
                errors["base"] = "cannot_connect"
            else:
                if state["device_id"] != entry.unique_id:
                    return self.async_abort(reason="wrong_device")
                return self.async_update_reload_and_abort(entry, data_updates=data)
        return self.async_show_form(step_id="reauth_confirm",
                                   data_schema=probatio.Schema({probatio.Required(probatio.Secret(CONF_TOKEN)): str}), errors=errors)