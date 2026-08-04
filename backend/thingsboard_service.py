from __future__ import annotations

import json
import os
from typing import Any
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


def load_local_env() -> None:
    """Load backend/.env without overriding environment variables set by the host."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return

    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_local_env()


class ThingsBoardError(RuntimeError):
    """Raised when ThingsBoard cannot be reached or returns an invalid response."""


class ThingsBoardService:
    def __init__(self) -> None:
        self.base_url = os.getenv("THINGSBOARD_BASE_URL", "https://eu.thingsboard.cloud").rstrip("/")
        self.api_key = os.getenv("THINGSBOARD_API_KEY", "")
        self.timeout = float(os.getenv("THINGSBOARD_TIMEOUT_SECONDS", "10"))

    def list_devices(self) -> list[dict[str, str]]:
        devices: list[dict[str, str]] = []
        page = 0

        while True:
            query = urlencode({"pageSize": 100, "page": page})
            payload = self._request_json(f"/api/tenant/devices?{query}")
            data = payload.get("data")
            if not isinstance(data, list):
                raise ThingsBoardError("Risposta non valida ricevuta da ThingsBoard")

            for device in data:
                device_id = device.get("id", {}).get("id") if isinstance(device, dict) else None
                name = device.get("name") if isinstance(device, dict) else None
                device_type = device.get("type") if isinstance(device, dict) else None
                if isinstance(device_id, str) and isinstance(name, str) and isinstance(device_type, str):
                    devices.append({"id": device_id, "name": name, "type": device_type})

            if not payload.get("hasNext"):
                return devices
            page += 1

    def _request_json(self, path: str) -> dict[str, Any]:
        if not self.api_key:
            raise ThingsBoardError("THINGSBOARD_API_KEY non configurata")

        request = Request(
            f"{self.base_url}{path}",
            headers={
                "Accept": "application/json",
                "X-Authorization": f"ApiKey {self.api_key}",
            },
            method="GET",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                result = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise ThingsBoardError(f"ThingsBoard ha risposto con errore {error.code}") from error
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            raise ThingsBoardError("Impossibile comunicare con ThingsBoard") from error

        if not isinstance(result, dict):
            raise ThingsBoardError("Risposta non valida ricevuta da ThingsBoard")
        return result
