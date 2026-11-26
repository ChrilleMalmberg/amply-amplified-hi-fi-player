"""Authenticated local API; never uploads music or contacts a cloud service."""
import asyncio
import ipaddress
import math
import re

import aiohttp


class CannotConnect(Exception):
    """The Windows player is unavailable."""


class InvalidAuth(Exception):
    """The pairing key was rejected."""


def validate_address(host: str, port: int, token: str) -> str:
    """Accept only a literal private IPv4 address, not an arbitrary URL."""
    try:
        address = ipaddress.IPv4Address(host.strip())
    except (ValueError, AttributeError) as err:
        raise ValueError("Enter the PC's private IPv4 address") from err
    networks = ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8")
    if not any(address in ipaddress.ip_network(n) for n in networks):
        raise ValueError("Private network address required")
    if isinstance(port, bool) or not isinstance(port, int) or not 1 <= port <= 65535:
        raise ValueError("Invalid port")
    if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
        raise ValueError("Invalid pairing key")
    return f"http://{address}:{port}"


def validate_state(data: object) -> dict:
    """Check the protocol before exposing a media player."""
    if not isinstance(data, dict) or data.get("api_version") != 1:
        raise CannotConnect("Unsupported controller version")
    if not isinstance(data.get("device_id"), str) or not data["device_id"]:
        raise CannotConnect("Missing player identity")
    if data.get("state") not in ("playing", "paused", "idle"):
        raise CannotConnect("Invalid playback state")
    for name in ("volume", "position", "duration"):
        number = data.get(name)
        if isinstance(number, bool) or not isinstance(number, (int, float)) or not math.isfinite(number) or number < 0:
            raise CannotConnect("Invalid player state")
    if data["volume"] > 1 or not isinstance(data.get("shuffle"), bool) or data.get("repeat") not in ("off", "all", "track"):
        raise CannotConnect("Invalid player settings")
    queue = data.get("queue")
    if not isinstance(queue, list) or len(queue) > 2000:
        raise CannotConnect("Invalid queue")
    if any(not isinstance(t, dict) or t.get("index") != i or not isinstance(t.get("title"), str) for i, t in enumerate(queue)):
        raise CannotConnect("Invalid queue entries")
    current = data.get("current")
    if isinstance(current, bool) or not isinstance(current, int) or current < -1 or current >= len(queue):
        raise CannotConnect("Invalid current track")
    return data


class AmplyClient:
    """Control one paired PC."""

    def __init__(self, session: aiohttp.ClientSession, host: str, port: int, token: str):
        self.session = session
        self.base = validate_address(host, port, token)
        self._token = token

    async def request(self, method: str, path: str, payload: dict | None = None) -> dict:
        try:
            async with self.session.request(
                method, f"{self.base}{path}", json=payload,
                headers={"Authorization": f"Bearer {self._token}"},
                timeout=aiohttp.ClientTimeout(total=8), allow_redirects=False,
            ) as response:
                if response.status == 401:
                    raise InvalidAuth
                if response.status != 200:
                    raise CannotConnect("Player did not accept the request")
                if response.content_length and response.content_length > 1048576:
                    raise CannotConnect("Response too large")
                data = await response.json()
                if not isinstance(data, dict):
                    raise CannotConnect("Invalid response")
                return data
        except (aiohttp.ClientError, asyncio.TimeoutError, ValueError) as err:
            raise CannotConnect("Cannot reach the Windows player") from err

    async def state(self) -> dict:
        return validate_state(await self.request("GET", "/v1/state"))

    async def command(self, command: str, value: object = None) -> None:
        payload = {"command": command}
        if value is not None:
            payload["value"] = value
        data = await self.request("POST", "/v1/command", payload)
        if data.get("ok") is not True:
            raise CannotConnect("Command not confirmed")