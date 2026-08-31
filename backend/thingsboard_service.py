from __future__ import annotations

import json
import logging
import os
import random
import time
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

with (Path(__file__).resolve().parent / "telemetry_catalog.json").open(encoding="utf-8") as catalog_file:
    TELEMETRY_CATALOG = json.load(catalog_file)


class ThingsBoardError(RuntimeError):
    """Raised when ThingsBoard cannot be reached or returns an invalid response."""


class ThingsBoardService:
    def __init__(self) -> None:
        self.base_url = os.getenv("THINGSBOARD_BASE_URL", "https://eu.thingsboard.cloud").rstrip("/")
        self.api_key = os.getenv("THINGSBOARD_API_KEY", "")
        self.timeout = float(os.getenv("THINGSBOARD_TIMEOUT_SECONDS", "10"))
        self.realtime_poll_seconds = max(float(os.getenv("THINGSBOARD_REALTIME_POLL_SECONDS", "1")), 0.25)

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
                    additional_info = device.get("additionalInfo")
                    description = additional_info.get("description") if isinstance(additional_info, dict) else ""
                    devices.append({
                        "id": device_id,
                        "name": name,
                        "type": device_type,
                        "description": description if isinstance(description, str) else "",
                    })

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
                **TELEMETRY_CATALOG.get(key.casefold(), {}),
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

    def stream_telemetry(self, device_id: str):
        # ponytail: polling per viewer; condividere un poller per device solo se il traffico cresce.
        while True:
            time.sleep(self.realtime_poll_seconds)
            yield self.get_latest_telemetry(device_id)

    def publish_device_telemetry(self, device_id: str, values: dict[str, Any]) -> None:
        credentials = self._request_json(f"/api/device/{quote(device_id, safe='')}/credentials")
        if not isinstance(credentials, dict) or credentials.get("credentialsType") != "ACCESS_TOKEN":
            raise ThingsBoardError("Il simulatore richiede credenziali ACCESS_TOKEN sul device")
        token = credentials.get("credentialsId")
        if not isinstance(token, str) or not token:
            raise ThingsBoardError("Token del device ThingsBoard non disponibile")
        self._request_json(
            f"/api/v1/{quote(token, safe='')}/telemetry",
            method="POST",
            body=values,
            authenticated=False,
        )

    def simulated_values(self, device_id: str) -> dict[str, Any]:
        current = self.get_latest_telemetry(device_id)
        values = {
            key: _simulated_value(point.get("value"), TELEMETRY_CATALOG.get(key.casefold(), {}))
            for key, point in current.items()
            if point.get("value") is not None
        }
        return values or {"temperature": 20.0}

    def _request_json(
        self,
        path: str,
        method: str = "GET",
        body: dict[str, Any] | None = None,
        authenticated: bool = True,
    ) -> Any:
        if authenticated and not self.api_key:
            raise ThingsBoardError("THINGSBOARD_API_KEY non configurata")

        headers = {"Accept": "application/json"}
        if authenticated:
            headers["X-Authorization"] = f"ApiKey {self.api_key}"
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        request = Request(
            f"{self.base_url}{path}",
            headers=headers,
            data=data,
            method=method,
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read()
                result = json.loads(raw.decode("utf-8")) if raw else None
        except HTTPError as error:
            raise ThingsBoardError(f"ThingsBoard ha risposto con errore {error.code}") from error
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            raise ThingsBoardError("Impossibile comunicare con ThingsBoard") from error

        return result
def _is_number(value: Any) -> bool:
    try:
        float(value)
        return not isinstance(value, bool)
    except (TypeError, ValueError):
        return False


def _simulated_value(value: Any, metadata: dict[str, Any] | None = None) -> Any:
    if isinstance(value, bool):
        return not value
    if _is_number(value):
        number = float(value)
        delta = max(abs(number) * 0.02, 0.2)
        simulated = number + random.uniform(-delta, delta)
        if metadata and _is_number(metadata.get("min")) and _is_number(metadata.get("max")):
            simulated = min(max(simulated, float(metadata["min"])), float(metadata["max"]))
        return round(simulated, 2)

    text = str(value)
    normalized = text.lower()
    if normalized in {"true", "false"}:
        return normalized != "true"
    if normalized in {"active", "inactive"}:
        return "inactive" if normalized == "active" else "active"
    suffix = " (simulato)"
    return text.removesuffix(suffix) if text.endswith(suffix) else f"{text}{suffix}"
