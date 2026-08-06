from __future__ import annotations

import json
import logging
import os
from typing import Any
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
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
            if not isinstance(payload, dict):
                raise ThingsBoardError("Risposta non valida ricevuta da ThingsBoard")
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

    def get_latest_telemetry_timestamp(self, device_id: str) -> int | None:
        telemetry = self._request_json(
            f"/api/plugins/telemetry/DEVICE/{quote(device_id, safe='')}/values/timeseries"
        )
        if not isinstance(telemetry, dict):
            raise ThingsBoardError("Risposta telemetria non valida ricevuta da ThingsBoard")

        timestamps = [
            point.get("ts")
            for values in telemetry.values()
            if isinstance(values, list)
            for point in values
            if isinstance(point, dict) and isinstance(point.get("ts"), int)
        ]
        if timestamps:
            return max(timestamps)

        logging.getLogger(__name__).warning(
            "[thingsboard] Nessun timestamp telemetria per il device %s. Risposta API: %s",
            device_id,
            json.dumps(telemetry, ensure_ascii=False),
        )
        return None

    def get_telemetry_catalog(self, device_id: str) -> list[str]:
        keys = self._request_json(
            f"/api/plugins/telemetry/DEVICE/{quote(device_id, safe='')}/keys/timeseries"
        )
        if not isinstance(keys, list):
            raise ThingsBoardError("Catalogo telemetrie non valido ricevuto da ThingsBoard")

        return sorted({key for key in keys if isinstance(key, str) and key.strip()}, key=str.casefold)

    def get_latest_telemetry(self, device_id: str) -> dict[str, dict[str, Any]]:
        telemetry = self._request_json(
            f"/api/plugins/telemetry/DEVICE/{quote(device_id, safe='')}/values/timeseries"
        )
        if not isinstance(telemetry, dict):
            raise ThingsBoardError("Risposta telemetria non valida ricevuta da ThingsBoard")

        result: dict[str, dict[str, Any]] = {}
        for key, points in telemetry.items():
            if not isinstance(key, str) or not isinstance(points, list) or not points:
                continue
            point = points[0]
            if not isinstance(point, dict) or "value" not in point:
                continue
            result[key] = {
                "value": point["value"],
                "ts": point.get("ts") if isinstance(point.get("ts"), int) else None,
            }

        return result

    def get_device_active_status(self, device_id: str) -> bool:
        attributes = self._request_json(
            f"/api/plugins/telemetry/DEVICE/{quote(device_id, safe='')}/values/attributes/SERVER_SCOPE?keys=active"
        )
        if not isinstance(attributes, list):
            raise ThingsBoardError("Stato device non valido ricevuto da ThingsBoard")

        for attribute in attributes:
            if not isinstance(attribute, dict) or attribute.get("key") != "active":
                continue
            value = attribute.get("value")
            if isinstance(value, bool):
                return value
            if isinstance(value, str) and value.lower() in {"true", "false"}:
                return value.lower() == "true"

        return False

    def _request_json(self, path: str) -> Any:
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

        return result
