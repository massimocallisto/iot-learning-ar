"""Mock di un device ThingsBoard che riceve RPC e aggiorna la telemetria."""

from __future__ import annotations

import json
import os
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from thingsboard_service import ThingsBoardService, load_local_env

load_local_env()

BASE_URL = os.getenv("THINGSBOARD_BASE_URL", "https://eu.thingsboard.cloud").rstrip("/")
TOKEN = os.getenv("THINGSBOARD_DEVICE_TOKEN", "")
METHODS = {
    "setLed": "statoLED",
    "setTemperature": "temperature",
    "setTemperatura": "temperature",
    "setSetPoint": "temperature",
    "setText": "text",
    **json.loads(os.getenv("MOCK_RPC_METHODS_JSON", "{}")),
}
STATE = {"led_on": False, "statoLED": False, "lux": 20}


def request_json(path: str, method: str = "GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    request = Request(
        f"{BASE_URL}{path}",
        data=data,
        method=method,
        headers={"Accept": "application/json", "Content-Type": "application/json"},
    )
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except HTTPError as error:
        if error.code in {408, 504}:
            return None
        raise


def telemetry_key(method: str) -> str:
    if method in METHODS:
        return METHODS[method]
    name = method[3:] if method.lower().startswith("set") and len(method) > 3 else method
    return name[:1].lower() + name[1:]


def react(method: str, value, control_telemetry: str = "") -> dict:
    if method == "setLed" and not control_telemetry:
        STATE.update(led_on=value, statoLED=value, lux=150 if value else 20)
        return {"statoLED": STATE["statoLED"], "lux": STATE["lux"]}
    key = control_telemetry or telemetry_key(method)
    STATE[key] = value
    return {key: STATE[key]}


def run(device_id: str | None = None) -> None:
    device_token = TOKEN
    if not device_token and device_id:
        device_token = ThingsBoardService().get_device_access_token(device_id)
    if not device_token:
        raise SystemExit("Passa il device ID oppure imposta THINGSBOARD_DEVICE_TOKEN.")
    token = quote(device_token, safe="")
    print(f"[mock-device] connesso a {BASE_URL}; attendo RPC...")
    while True:
        try:
            command = request_json(f"/api/v1/{token}/rpc?timeout=20000")
            if not isinstance(command, dict):
                continue
            request_id = command.get("id")
            method = str(command.get("method") or "")
            params = command.get("params") if isinstance(command.get("params"), dict) else {}
            value = params.get("value")
            telemetry = react(method, value, str(params.get("controlTelemetry") or ""))
            response = {"success": True, "method": method}
            if request_id is not None:
                try:
                    request_json(f"/api/v1/{token}/rpc/{quote(str(request_id), safe='')}", "POST", response)
                except HTTPError:
                    pass  # Le RPC one-way non attendono una risposta.
            if telemetry is not None:
                request_json(f"/api/v1/{token}/telemetry", "POST", telemetry)
            print(f"[mock-device] {method} {params} -> {response}")
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
            print(f"[mock-device] {error}; nuovo tentativo...", file=sys.stderr)
            time.sleep(1)


if __name__ == "__main__":
    if "--self-test" in sys.argv:
        assert react("setLed", True) == {"statoLED": True, "lux": 150}
        assert STATE["led_on"] is True
        assert react("setTemperatura", 24.5) == {"temperature": 24.5}
        assert react("setHumidity", 50) == {"humidity": 50}
        assert react("changeMode", "eco") == {"changeMode": "eco"}
        assert react("setTemperaturaz", 24.5, "temperature") == {"temperature": 24.5}
        print("OK")
    else:
        run(sys.argv[1] if len(sys.argv) > 1 else None)
