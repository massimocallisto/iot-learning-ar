from __future__ import annotations

import base64
import json
import os
import random
import re
import shutil
import threading
import time
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import bcrypt
import jwt
from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS

from db import execute, fetch_all, fetch_one, init_db
from thingsboard_service import ThingsBoardError, ThingsBoardService

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent

PORT = int(os.getenv("PORT", "3001"))
HOST = os.getenv("HOST", "0.0.0.0")
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "*")
STORE_DIR = BASE_DIR / "storage"
TTL_MS = int(os.getenv("UPLOAD_TTL_MS", str(30 * 60 * 1000)))
MAX_BODY_BYTES = int(os.getenv("MAX_BODY_BYTES", str(80 * 1024 * 1024)))
HTTPS_KEY_PATH = os.getenv("HTTPS_KEY_PATH", str(BASE_DIR / "ssl" / "localhost+2-key.pem")).strip()
HTTPS_CERT_PATH = os.getenv("HTTPS_CERT_PATH", str(BASE_DIR / "ssl" / "localhost+2.pem")).strip()
HTTPS_ONLY = os.getenv("HTTPS_ONLY", "true").lower() == "true"
TEXTURES_DIR = PROJECT_DIR / "public" / "texture"
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me-at-least-32-bytes")
JWT_EXPIRES_IN = os.getenv("JWT_EXPIRES_IN", "7d")
BCRYPT_ROUNDS = int(os.getenv("BCRYPT_ROUNDS", "12"))

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_BODY_BYTES
CORS(app, resources={r"/*": {"origins": CORS_ORIGIN}}, supports_credentials=False)
thingsboard_service = ThingsBoardService()


@app.after_request
def add_cors_headers(response: Response) -> Response:
    response.headers.setdefault("Access-Control-Allow-Origin", CORS_ORIGIN)
    response.headers.setdefault("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
    response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, Authorization")
    return response


@app.route("/api/health", methods=["GET"])
def health() -> Response:
    return jsonify({"ok": True})


@app.route("/api/auth/register", methods=["POST"])
def register() -> tuple[Response, int] | Response:
    body = request.get_json(silent=True) or {}
    name = normalize_text(body.get("name"))
    email = normalize_email(body.get("email"))
    password = str(body.get("password") or "")

    validation_error = validate_teacher_credentials(name, email, password)
    if validation_error:
        return jsonify({"error": validation_error}), 400

    existing = fetch_one("SELECT id FROM teachers WHERE email = ?", (email,))
    if existing:
        return jsonify({"error": "Email gia registrata"}), 409

    teacher_id = str(uuid.uuid4())
    created_at = now_iso()
    password_hash = hash_password(password)
    access_code = create_unique_teacher_access_code(name)

    execute(
        """
        INSERT INTO teachers (id, name, email, password_hash, access_code, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (teacher_id, name, email, password_hash, access_code, created_at),
    )

    teacher = {
        "id": teacher_id,
        "name": name,
        "email": email,
        "accessCode": access_code,
        "createdAt": created_at,
    }

    return jsonify({"token": sign_teacher_token(teacher), "teacher": teacher}), 201


@app.route("/api/auth/login", methods=["POST"])
def login() -> tuple[Response, int] | Response:
    body = request.get_json(silent=True) or {}
    email = normalize_email(body.get("email"))
    password = str(body.get("password") or "")

    if not email or not password:
        return jsonify({"error": "Email e password sono obbligatorie"}), 400

    row = fetch_one("SELECT * FROM teachers WHERE email = ?", (email,))
    if not row or not check_password(password, row["password_hash"]):
        return jsonify({"error": "Credenziali non valide"}), 401

    teacher = teacher_response_from_row(row)
    return jsonify({"token": sign_teacher_token(teacher), "teacher": teacher})


@app.route("/api/auth/me", methods=["GET"])
def me() -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher
    return jsonify({"teacher": teacher})


@app.route("/api/experiences", methods=["GET"])
def list_experiences() -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    rows = fetch_all(
        """
        SELECT id, title, description, device_id, created_at, updated_at
        FROM experiences
        WHERE teacher_id = ?
        ORDER BY updated_at DESC, created_at DESC
        """,
        (teacher["id"],),
    )
    return jsonify({"experiences": [experience_response_from_row(row) for row in rows]})


@app.route("/api/experiences", methods=["POST"])
def create_experience() -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    body = request.get_json(silent=True) or {}
    title = normalize_text(body.get("title"))
    description = normalize_text(body.get("description"))
    glb_base64 = strip_data_url_prefix(body.get("glbBase64"))
    config_json = body.get("configJson")
    device_id = normalize_text(body.get("deviceId")) or None

    if not title:
        return jsonify({"error": "Titolo esperienza obbligatorio"}), 400
    if not glb_base64:
        return jsonify({"error": "GLB esperienza obbligatorio"}), 400
    if not isinstance(config_json, dict):
        return jsonify({"error": "Configurazione JSON non valida"}), 400

    if device_id:
        try:
            available_devices = thingsboard_service.list_devices()
        except ThingsBoardError as error:
            return jsonify({"error": str(error)}), 502
        if not any(device["id"] == device_id for device in available_devices):
            return jsonify({"error": "Dispositivo ThingsBoard non disponibile"}), 400

    try:
        glb_buffer = base64.b64decode(glb_base64, validate=True)
    except Exception:
        return jsonify({"error": "GLB vuoto o base64 non valido"}), 400

    if not glb_buffer:
        return jsonify({"error": "GLB vuoto o base64 non valido"}), 400

    experience_id = str(uuid.uuid4())
    timestamp = now_iso()
    experience_dir = experience_dir_from_id(experience_id)
    experience_dir.mkdir(parents=True, exist_ok=True)

    glb_file_path = experience_dir / "model.glb"
    json_file_path = experience_dir / "config.json"
    glb_file_path.write_bytes(glb_buffer)
    json_file_path.write_text(json.dumps(config_json, indent=2, ensure_ascii=False), encoding="utf-8")

    relative_glb_path = f"storage/experiences/{experience_id}/model.glb"
    relative_json_path = f"storage/experiences/{experience_id}/config.json"

    execute(
        """
        INSERT INTO experiences (
          id, teacher_id, title, description, device_id, glb_path, json_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            experience_id,
            teacher["id"],
            title,
            description,
            device_id,
            relative_glb_path,
            relative_json_path,
            timestamp,
            timestamp,
        ),
    )

    row = fetch_one(
        "SELECT id, title, description, device_id, created_at, updated_at FROM experiences WHERE id = ?",
        (experience_id,),
    )
    return jsonify({"experience": experience_response_from_row(row)}), 201


@app.route("/api/iot/devices", methods=["GET"])
def list_iot_devices() -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    try:
        return jsonify({"devices": thingsboard_service.list_devices()})
    except ThingsBoardError as error:
        return jsonify({"error": str(error)}), 502


@app.route("/api/iot/devices/<device_id>/latest-telemetry", methods=["GET"])
def get_iot_device_latest_telemetry(device_id: str) -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    try:
        timestamp = thingsboard_service.get_latest_telemetry_timestamp(device_id)
        return jsonify({"lastTelemetryTs": timestamp})
    except ThingsBoardError as error:
        return jsonify({"error": str(error)}), 502


@app.route("/api/experiences/<experience_id>", methods=["GET"])
def get_experience(experience_id: str) -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    row = load_teacher_experience_or_null(teacher["id"], experience_id)
    if not row:
        return jsonify({"error": "Esperienza non trovata"}), 404
    return jsonify({"experience": experience_response_from_row(row)})


@app.route("/api/experiences/<experience_id>/glb", methods=["GET"])
def get_experience_glb(experience_id: str) -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    row = load_teacher_experience_or_null(teacher["id"], experience_id)
    if not row:
        return jsonify({"error": "Esperienza non trovata"}), 404
    return stream_file(BASE_DIR / row["glb_path"], "model/gltf-binary", "model.glb")


@app.route("/api/experiences/<experience_id>/json", methods=["GET"])
def get_experience_json(experience_id: str) -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    row = load_teacher_experience_or_null(teacher["id"], experience_id)
    if not row:
        return jsonify({"error": "Esperienza non trovata"}), 404
    return stream_file(BASE_DIR / row["json_path"], "application/json", "config.json")


@app.route("/api/experiences/<experience_id>", methods=["PUT"])
def update_experience(experience_id: str) -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    row = load_teacher_experience_or_null(teacher["id"], experience_id)
    if not row:
        return jsonify({"error": "Esperienza non trovata"}), 404

    body = request.get_json(silent=True) or {}
    title = normalize_text(body.get("title"))
    description = normalize_text(body.get("description"))
    config_json = body.get("configJson")
    device_id = normalize_text(body.get("deviceId")) or None

    if not title:
        return jsonify({"error": "Titolo esperienza obbligatorio"}), 400
    if not isinstance(config_json, dict):
        return jsonify({"error": "Configurazione JSON non valida"}), 400

    if "deviceId" in body and device_id:
        try:
            available_devices = thingsboard_service.list_devices()
        except ThingsBoardError as error:
            return jsonify({"error": str(error)}), 502
        if not any(device["id"] == device_id for device in available_devices):
            return jsonify({"error": "Dispositivo ThingsBoard non disponibile"}), 400

    (BASE_DIR / row["json_path"]).write_text(
        json.dumps(config_json, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    updated_at = now_iso()
    execute(
        """
        UPDATE experiences
        SET title = ?, description = ?, device_id = ?, updated_at = ?
        WHERE id = ? AND teacher_id = ?
        """,
        (title, description, device_id if "deviceId" in body else row["device_id"], updated_at, experience_id, teacher["id"]),
    )

    updated = load_teacher_experience_or_null(teacher["id"], experience_id)
    return jsonify({"experience": experience_response_from_row(updated)})


@app.route("/api/experiences/<experience_id>", methods=["DELETE"])
def delete_experience(experience_id: str) -> tuple[Response, int] | Response:
    teacher = require_auth_or_response()
    if isinstance(teacher, tuple):
        return teacher

    row = load_teacher_experience_or_null(teacher["id"], experience_id)
    if not row:
        return jsonify({"error": "Esperienza non trovata"}), 404

    execute("DELETE FROM experiences WHERE id = ? AND teacher_id = ?", (experience_id, teacher["id"]))
    shutil.rmtree(experience_dir_from_id(experience_id), ignore_errors=True)
    return Response(status=204)


@app.route("/api/public/teachers/<code>/experiences", methods=["GET"])
def public_teacher_experiences(code: str) -> tuple[Response, int] | Response:
    access_code = normalize_access_code(code)
    if not access_code:
        return jsonify({"error": "Codice docente obbligatorio"}), 400

    teacher = fetch_one(
        "SELECT id, name, access_code, created_at FROM teachers WHERE access_code = ?",
        (access_code,),
    )
    if not teacher:
        return jsonify({"error": "Codice docente non trovato"}), 404

    rows = fetch_all(
        """
        SELECT id, title, description, device_id, created_at, updated_at
        FROM experiences
        WHERE teacher_id = ?
        ORDER BY updated_at DESC, created_at DESC
        """,
        (teacher["id"],),
    )
    return jsonify(
        {
            "teacher": {"name": teacher["name"], "accessCode": teacher["access_code"]},
            "experiences": [experience_response_from_row(row) for row in rows],
        }
    )


@app.route("/api/public/experiences/<experience_id>/glb", methods=["GET"])
def public_experience_glb(experience_id: str) -> tuple[Response, int] | Response:
    row = load_experience_or_null(experience_id)
    if not row:
        return jsonify({"error": "Esperienza non trovata"}), 404
    return stream_file(BASE_DIR / row["glb_path"], "model/gltf-binary", "model.glb")


@app.route("/api/public/experiences/<experience_id>/json", methods=["GET"])
def public_experience_json(experience_id: str) -> tuple[Response, int] | Response:
    row = load_experience_or_null(experience_id)
    if not row:
        return jsonify({"error": "Esperienza non trovata"}), 404
    return stream_file(BASE_DIR / row["json_path"], "application/json", "config.json")


@app.route("/api/uploads", methods=["POST"])
def upload_pair() -> tuple[Response, int] | Response:
    body = request.get_json(silent=True) or {}
    glb_base64 = strip_data_url_prefix(body.get("glbBase64"))
    json_base64 = strip_data_url_prefix(body.get("jsonBase64"))

    if not glb_base64 or not json_base64:
        return jsonify({"error": "Campi richiesti mancanti: glbBase64 e jsonBase64"}), 400

    try:
        glb_buffer = base64.b64decode(glb_base64, validate=True)
        json_buffer = base64.b64decode(json_base64, validate=True)
    except Exception:
        return jsonify({"error": "File vuoti o base64 non valido"}), 400

    if not glb_buffer or not json_buffer:
        return jsonify({"error": "File vuoti o base64 non valido"}), 400

    upload_id = str(uuid.uuid4())
    created_at = now_iso()
    expires_at = get_expiration_iso()
    directory = upload_dir_from_id(upload_id)
    directory.mkdir(parents=True, exist_ok=True)

    glb_name = sanitize_filename(body.get("glbName"), "model.glb")
    json_name = sanitize_filename(body.get("jsonName"), "config.json")
    glb_mime = str(body.get("glbMime") or "model/gltf-binary")
    json_mime = str(body.get("jsonMime") or "application/json")

    (directory / "model.glb").write_bytes(glb_buffer)
    (directory / "config.json").write_bytes(json_buffer)

    meta = {
        "id": upload_id,
        "createdAt": created_at,
        "expiresAt": expires_at,
        "glb": {"storedAs": "model.glb", "originalName": glb_name, "mime": glb_mime, "size": len(glb_buffer)},
        "json": {"storedAs": "config.json", "originalName": json_name, "mime": json_mime, "size": len(json_buffer)},
    }
    meta_path_from_id(upload_id).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return jsonify(build_payload_response(meta)), 201


@app.route("/api/upload", methods=["POST"])
def upload_glb_only() -> tuple[Response, int] | Response:
    body = request.get_json(silent=True) or {}
    glb_base64 = strip_data_url_prefix(body.get("glbBase64"))

    if not glb_base64:
        return jsonify({"error": "Campo richiesto mancante: glbBase64"}), 400

    try:
        glb_buffer = base64.b64decode(glb_base64, validate=True)
    except Exception:
        return jsonify({"error": "File vuoto o base64 non valido"}), 400

    if not glb_buffer:
        return jsonify({"error": "File vuoto o base64 non valido"}), 400

    upload_id = str(uuid.uuid4())
    created_at = now_iso()
    expires_at = get_expiration_iso()
    directory = upload_dir_from_id(upload_id)
    directory.mkdir(parents=True, exist_ok=True)

    glb_name = sanitize_filename(body.get("glbName"), "model.glb")
    glb_mime = str(body.get("glbMime") or "model/gltf-binary")
    (directory / "model.glb").write_bytes(glb_buffer)

    meta = {
        "id": upload_id,
        "createdAt": created_at,
        "expiresAt": expires_at,
        "glb": {"storedAs": "model.glb", "originalName": glb_name, "mime": glb_mime, "size": len(glb_buffer)},
    }
    meta_path_from_id(upload_id).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return jsonify(build_payload_response_glb(meta)), 201


@app.route("/api/uploads/<upload_id>", methods=["GET"])
def get_upload(upload_id: str) -> tuple[Response, int] | Response:
    meta = load_meta_or_null(upload_id)
    if not meta:
        return jsonify({"error": "Upload non trovato"}), 404
    return jsonify(build_payload_response(meta))


@app.route("/api/uploads/<upload_id>/glb", methods=["GET"])
def get_upload_glb(upload_id: str) -> tuple[Response, int] | Response:
    meta = load_meta_or_null(upload_id)
    if not meta:
        return jsonify({"error": "Upload non trovato"}), 404
    return stream_file(upload_dir_from_id(upload_id) / meta["glb"]["storedAs"], meta["glb"]["mime"], meta["glb"]["originalName"])


@app.route("/api/uploads/<upload_id>/json", methods=["GET"])
def get_upload_json(upload_id: str) -> tuple[Response, int] | Response:
    meta = load_meta_or_null(upload_id)
    if not meta or "json" not in meta:
        return jsonify({"error": "Upload non trovato"}), 404
    return stream_file(upload_dir_from_id(upload_id) / meta["json"]["storedAs"], meta["json"]["mime"], meta["json"]["originalName"])


@app.route("/api/uploads/<upload_id>", methods=["DELETE"])
def delete_upload_route(upload_id: str) -> Response:
    delete_upload(upload_id)
    return Response(status=204)


@app.route("/api/textures", methods=["GET"])
def list_textures() -> Response:
    allowed_ext = {".jpg", ".jpeg", ".png", ".webp"}
    textures = []
    if TEXTURES_DIR.exists():
        for path in sorted(TEXTURES_DIR.iterdir(), key=lambda item: item.name.lower()):
            if path.is_file() and path.suffix.lower() in allowed_ext:
                textures.append(
                    {
                        "name": prettify_texture_name(path.name),
                        "preview": f"/textures/{path.name}",
                        "value": f"texture/{path.name}",
                        "type": "texture",
                    }
                )
    return jsonify(textures)


@app.route("/textures/<path:file_name>", methods=["GET"])
def serve_texture(file_name: str):
    file_path = (TEXTURES_DIR / file_name).resolve()
    if not str(file_path).startswith(str(TEXTURES_DIR.resolve())) or not file_path.exists():
        return jsonify({"error": "Texture non trovata"}), 404
    return send_file(file_path)


@app.errorhandler(404)
def not_found(_: Exception) -> tuple[Response, int]:
    return jsonify({"error": "Route non trovata"}), 404


@app.errorhandler(413)
def payload_too_large(_: Exception) -> tuple[Response, int]:
    return jsonify({"error": "Payload troppo grande"}), 413


@app.errorhandler(Exception)
def internal_error(error: Exception) -> tuple[Response, int]:
    app.logger.exception(error)
    return jsonify({"error": str(error) or "Errore interno server"}), 500


# Helpers

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_duration_to_seconds(value: str) -> int:
    match = re.fullmatch(r"(\d+)([smhd])?", value.strip().lower())
    if not match:
        return 7 * 24 * 60 * 60
    amount = int(match.group(1))
    unit = match.group(2) or "s"
    return amount * {"s": 1, "m": 60, "h": 3600, "d": 86400}[unit]


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def check_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def sign_teacher_token(teacher: dict[str, Any]) -> str:
    expires_delta = timedelta(seconds=parse_duration_to_seconds(JWT_EXPIRES_IN))
    payload = {
        "sub": teacher["id"],
        "email": teacher["email"],
        "accessCode": teacher["accessCode"],
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def require_auth_or_response() -> dict[str, Any] | tuple[Response, int]:
    auth_header = str(request.headers.get("Authorization") or "")
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0] != "Bearer" or not parts[1]:
        return jsonify({"error": "Token mancante"}), 401

    try:
        payload = jwt.decode(parts[1], JWT_SECRET, algorithms=["HS256"])
        teacher_id = payload.get("sub")
        row = fetch_one("SELECT * FROM teachers WHERE id = ?", (teacher_id,))
        if not row:
            return jsonify({"error": "Token non valido"}), 401
        return teacher_response_from_row(row)
    except Exception:
        return jsonify({"error": "Token non valido o scaduto"}), 401


def teacher_response_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "accessCode": row["access_code"],
        "createdAt": row["created_at"],
    }


def experience_response_from_row(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "description": row["description"] or "",
        "deviceId": row["device_id"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def load_teacher_experience_or_null(teacher_id: str, experience_id: str):
    return fetch_one(
        """
        SELECT id, teacher_id, title, description, device_id, glb_path, json_path, created_at, updated_at
        FROM experiences
        WHERE id = ? AND teacher_id = ?
        """,
        (experience_id, teacher_id),
    )


def load_experience_or_null(experience_id: str):
    return fetch_one(
        """
        SELECT id, teacher_id, title, description, device_id, glb_path, json_path, created_at, updated_at
        FROM experiences
        WHERE id = ?
        """,
        (experience_id,),
    )


def validate_teacher_credentials(name: str, email: str, password: str) -> str:
    if not name:
        return "Nome docente obbligatorio"
    if len(name) < 2:
        return "Il nome docente deve contenere almeno 2 caratteri"
    if not email:
        return "Email obbligatoria"
    if not is_valid_email(email):
        return "Email non valida"
    if not password:
        return "Password obbligatoria"
    if len(password) < 8:
        return "La password deve contenere almeno 8 caratteri"
    return ""


def normalize_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def normalize_email(value: Any) -> str:
    return str(value or "").strip().lower()


def normalize_access_code(value: Any) -> str:
    return str(value or "").strip().upper()


def is_valid_email(value: str) -> bool:
    return bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value))


def create_unique_teacher_access_code(name: str) -> str:
    for _ in range(20):
        code = create_teacher_access_code(name)
        existing = fetch_one("SELECT id FROM teachers WHERE access_code = ?", (code,))
        if not existing:
            return code
    raise RuntimeError("Impossibile generare un codice docente univoco")


def create_teacher_access_code(name: str) -> str:
    prefix = normalize_access_code_prefix(name)
    return f"{prefix}-{random_access_code_suffix(4)}"


def normalize_access_code_prefix(value: str) -> str:
    normalized = unicodedata.normalize("NFD", value or "")
    normalized = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    normalized = re.sub(r"[^A-Z0-9]", "", normalized.upper())
    return (normalized or "DOC")[:8]


def random_access_code_suffix(length: int) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(random.choice(alphabet) for _ in range(length))


def sanitize_filename(filename: Any, fallback: str) -> str:
    base = Path(str(filename or fallback)).name
    safe = re.sub(r"[^\w.-]", "_", base)
    return safe or fallback


def strip_data_url_prefix(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    if not value.startswith("data:"):
        return value
    _, _, data = value.partition(",")
    return data


def get_expiration_iso() -> str:
    return (datetime.now(timezone.utc) + timedelta(milliseconds=TTL_MS)).isoformat().replace("+00:00", "Z")


def upload_dir_from_id(upload_id: str) -> Path:
    return STORE_DIR / upload_id


def experience_dir_from_id(experience_id: str) -> Path:
    return STORE_DIR / "experiences" / experience_id


def meta_path_from_id(upload_id: str) -> Path:
    return upload_dir_from_id(upload_id) / "meta.json"


def get_base_url() -> str:
    proto = request.headers.get("X-Forwarded-Proto") or request.scheme or "http"
    return f"{proto}://{request.host}"


def build_payload_response(meta: dict[str, Any]) -> dict[str, Any]:
    base = get_base_url()
    return {
        "id": meta["id"],
        "createdAt": meta["createdAt"],
        "expiresAt": meta["expiresAt"],
        "glbUrl": f"{base}/api/uploads/{meta['id']}/glb",
        "jsonUrl": f"{base}/api/uploads/{meta['id']}/json",
    }


def build_payload_response_glb(meta: dict[str, Any]) -> dict[str, Any]:
    base = get_base_url()
    return {
        "id": meta["id"],
        "createdAt": meta["createdAt"],
        "expiresAt": meta["expiresAt"],
        "glbUrl": f"{base}/api/uploads/{meta['id']}/glb",
    }


def is_expired(expires_at: str) -> bool:
    try:
        parsed = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        return datetime.now(timezone.utc) > parsed
    except Exception:
        return True


def read_upload_meta(upload_id: str) -> dict[str, Any]:
    return json.loads(meta_path_from_id(upload_id).read_text(encoding="utf-8"))


def delete_upload(upload_id: str) -> None:
    shutil.rmtree(upload_dir_from_id(upload_id), ignore_errors=True)


def load_meta_or_null(upload_id: str) -> dict[str, Any] | None:
    try:
        meta = read_upload_meta(upload_id)
        if is_expired(meta["expiresAt"]):
            delete_upload(upload_id)
            return None
        return meta
    except Exception:
        return None


def cleanup_expired_uploads() -> None:
    if not STORE_DIR.exists():
        return
    for entry in STORE_DIR.iterdir():
        if not entry.is_dir() or entry.name == "experiences":
            continue
        try:
            meta = read_upload_meta(entry.name)
            if is_expired(meta["expiresAt"]):
                delete_upload(entry.name)
        except Exception:
            delete_upload(entry.name)


def start_cleanup_thread() -> None:
    def loop() -> None:
        while True:
            time.sleep(5 * 60)
            try:
                cleanup_expired_uploads()
            except Exception as error:
                app.logger.error("[cleanup] %s", error)

    thread = threading.Thread(target=loop, daemon=True)
    thread.start()


def stream_file(file_path: Path, mime: str, filename: str):
    if not file_path.exists():
        return jsonify({"error": "File non trovato"}), 404
    response = send_file(file_path, mimetype=mime, as_attachment=False, download_name=filename)
    response.headers["Content-Disposition"] = f'inline; filename="{filename.replace(chr(34), "")}"'
    return response


def prettify_texture_name(file_name: str) -> str:
    base = Path(file_name).stem
    base = re.sub(r"[_-]+", " ", base)
    base = re.sub(r"\s+", " ", base).strip()
    return " ".join(word[:1].upper() + word[1:] for word in base.split(" "))


def create_ssl_context():
    has_key = bool(HTTPS_KEY_PATH)
    has_cert = bool(HTTPS_CERT_PATH)
    if has_key != has_cert:
        raise RuntimeError("Configurazione HTTPS non valida: imposta sia HTTPS_KEY_PATH che HTTPS_CERT_PATH")
    if not has_key and not has_cert:
        if HTTPS_ONLY:
            raise RuntimeError("HTTPS_ONLY=true ma mancano HTTPS_KEY_PATH e HTTPS_CERT_PATH")
        return None

    key_path = Path(HTTPS_KEY_PATH).resolve()
    cert_path = Path(HTTPS_CERT_PATH).resolve()
    return str(cert_path), str(key_path)


def main() -> None:
    STORE_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    cleanup_expired_uploads()
    start_cleanup_thread()
    ssl_context = create_ssl_context()
    protocol = "https" if ssl_context else "http"
    print(f"[backend] listening on {protocol}://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, ssl_context=ssl_context, debug=False)


if __name__ == "__main__":
    main()
