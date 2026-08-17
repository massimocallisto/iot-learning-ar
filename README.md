# iot-learning-ar

A web-based prototype for creating, configuring, and viewing interactive 3D learning experiences.

The application allows a teacher to upload a 3D model, configure Points of Interest on model parts, and publish the experience so that students can access it through a browser. The viewer is designed to support standard 3D visualization and can be extended toward WebXR, AR/VR, and real-time IoT data integration.

## Project overview

The project is composed of two main parts:

- **Frontend**: React/Vite web application used by teachers and students.
- **Backend**: Python/Flask API used for authentication, experience management, file upload, and public student access.

Main user flows:

- Teacher registration and login.
- Teacher dashboard for managing experiences.
- 3D model upload.
- Point of Interest configuration.
- Student access through teacher code.
- 3D experience visualization.

## Requirements

Before running the project, make sure you have the following tools installed:

- **Python** 3.10 or higher (backend).
- **Node.js** 18 or higher and **npm** 9 or higher (frontend only).
- **Git**.
- **mkcert**, used to generate trusted local SSL certificates.
- A modern browser such as Chrome, Edge, or Firefox.

For WebXR/AR testing, HTTPS is required. Local development should therefore be run using SSL certificates.

## Initial setup

Clone the repository:

```bash
git clone <repository-url>
cd configuratore_tesi
```

Install project dependencies:

```bash
npm install
```

Install the Python backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

## SSL certificate generation

The project is configured to run both the frontend and backend over HTTPS during local development.

The expected certificate files are:

```text
ssl/localhost+2.pem
ssl/localhost+2-key.pem
```

### 1. Install mkcert

#### macOS

```bash
brew install mkcert
brew install nss
```

#### Windows

Using Chocolatey:

```bash
choco install mkcert
```

Or install `mkcert` manually from the official release page.

#### Linux

Install `mkcert` using your package manager or from the official release page.

### 2. Install the local Certificate Authority

Run:

```bash
mkcert -install
```

This creates and installs a local development Certificate Authority trusted by your machine.

### 3. Create the SSL folder

From the project root:

```bash
mkdir -p ssl
```

On Windows PowerShell:

```powershell
mkdir ssl
```

If the folder already exists, this step can be skipped.

### 4. Generate local certificates

From the project root:

```bash
mkcert -cert-file ssl/localhost+2.pem -key-file ssl/localhost+2-key.pem localhost 127.0.0.1 ::1
```

This generates certificates valid for:

```text
localhost
127.0.0.1
::1
```

## Running the project locally

Open two terminal windows in the project root.

```bash
cd configuratore_tesi
```

### 1. Start the backend over HTTPS

In the first terminal:

```bash
python backend/app.py
```

The backend will be available at:

```text
https://localhost:3001
```

You can test it with:

```bash
curl -k https://localhost:3001/api/health
```

Expected response:

```json
{
  "ok": true
}
```

### 2. Start the frontend over HTTPS

In the second terminal:

```bash
npm run start:https:local
```

The frontend will be available at:

```text
https://localhost:4200
```

Open the application in your browser:

```text
https://localhost:4200
```

## Local development on another device

If you want to open the application from another device on the same network, such as an Android tablet or a VR headset, you must use the local IP address of your development machine instead of `localhost`.

For example:

```text
https://192.168.1.50:4200
```

To find your local IP address:

### macOS

```bash
ipconfig getifaddr en0
```

### Windows

```bash
ipconfig
```

Look for the IPv4 address of your active network adapter.

### Regenerate certificates with the local IP

If your local IP is `192.168.1.50`, regenerate the certificates as follows:

```bash
mkcert -cert-file ssl/localhost+2.pem -key-file ssl/localhost+2-key.pem localhost 127.0.0.1 ::1 192.168.1.50
```

Then restart both backend and frontend.

The frontend will be available at:

```text
https://192.168.1.50:4200
```

The backend will be available at:

```text
https://192.168.1.50:3001
```

> Note: the external device must trust the generated certificate. For stable testing on tablets or headsets, consider installing the mkcert root CA on the device or exposing the application through a trusted HTTPS tunnel.

## Available commands

### Start frontend in HTTPS mode

```bash
npm run start:https:local
```

Starts the frontend development server on:

```text
https://localhost:4200
```

### Start backend in HTTPS mode

```bash
python backend/app.py
```

Starts the backend API server on:

```text
https://localhost:3001
```

### Start backend without HTTPS

```bash
HTTPS_KEY_PATH='' HTTPS_CERT_PATH='' HTTPS_ONLY=false python3 backend/app.py
```

Starts the backend API server using plain HTTP.

This mode is useful only for simple local debugging. It should not be used when testing WebXR features, because WebXR requires a secure context.

### Build the frontend

```bash
npm run build
```

Builds the frontend for production.

## Environment configuration

The frontend can be configured using environment variables.

Create a `.env.local` file in the project root if needed:

```env
VITE_API_BASE_URL=https://localhost:3001/api
```

When accessing the application from another device, use the IP address of your development machine:

```env
VITE_API_BASE_URL=https://192.168.1.50:3001/api
```

During local development, Vite proxies `/api` and `/textures` to `https://localhost:3001`, avoiding protocol and certificate mismatches. Outside Vite development, the frontend uses the current hostname and port `3001` unless an explicit API URL is configured.

## Backend API

The backend exposes API endpoints for:

- Teacher authentication.
- Teacher registration.
- Experience creation.
- Experience listing.
- GLB model upload.
- JSON configuration upload.
- Public student access.
- Public model and configuration retrieval.

Main endpoint groups:

```text
/api/auth/*
/api/experiences/*
/api/public/*
```

Health check:

```text
GET /api/health
```

## Typical usage flow

### Teacher flow

1. Open the frontend.
2. Register or log in as a teacher.
3. Create a new experience.
4. Upload a 3D model.
5. Configure Points of Interest on the model.
6. Save and publish the experience.

### Student flow

1. Open the frontend.
2. Enter the teacher code.
3. Select an available experience.
4. Open the 3D viewer.
5. Explore the model and interact with the configured Points of Interest.

## WebXR notes

The application can be extended to support WebXR-based AR or VR experiences.

Important notes:

- WebXR requires HTTPS.
- AR support depends on the browser and device.
- Desktop browsers generally do not support immersive AR.
- Android devices require Chrome and ARCore support for WebXR AR.
- VR headsets require a browser/runtime that supports WebXR immersive VR.

For VR support, the viewer should use a WebXR VR entry point such as Three.js `VRButton`.

For AR support, the viewer should use a WebXR AR entry point such as Three.js `ARButton`.

## Troubleshooting

### `ENOENT: no such file or directory, open 'ssllocalhost+2.pem'`

This usually means the SSL certificate path is using Windows-style backslashes.

Use:

```text
ssl/localhost+2.pem
ssl/localhost+2-key.pem
```

instead of:

```text
ssl\localhost+2.pem
ssl\localhost+2-key.pem
```

### `net::ERR_SSL_PROTOCOL_ERROR`

This usually means the frontend is calling the backend using HTTPS, but the backend is running in HTTP mode.

Make sure the backend is started with:

```bash
python backend/app.py
```

The backend should be available at:

```text
https://localhost:3001
```

### Browser warning about certificate

If the browser shows a certificate warning, verify that:

1. The certificate was generated using `mkcert`.
2. `mkcert -install` was executed.
3. The certificate includes the hostname or IP address you are using.
4. The browser was restarted after installing the local CA.

### WebXR shows `AR not supported`

This is expected on many desktop browsers and laptops.

For AR testing, use a compatible Android device with Chrome and ARCore support.

For VR testing, use a compatible WebXR headset and make sure the viewer includes VR support.

## Production notes

This repository is currently intended as a research and thesis prototype.

Before production deployment, the following aspects should be reviewed:

- Authentication and authorization.
- HTTPS termination.
- File upload validation.
- Rate limiting.
- Public access rules for student experiences.
- Storage configuration.
- Logging and monitoring.
- Database persistence and backup strategy.
- Integration with external platforms or IoT services.

## License

Add the project license here.




# Python backend

The Flask backend preserves the SQLite schema and HTTP API used by the frontend.

## Install

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

On Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run in HTTPS mode

Generate certificates in the project root, for example:

```bash
mkdir -p ssl
mkcert -cert-file ssl/localhost+2.pem -key-file ssl/localhost+2-key.pem localhost 127.0.0.1 ::1
```

Then run:

```bash
python app.py
```

The backend starts on:

```text
https://localhost:3001
```

## API compatibility

Implemented endpoint groups:

```text
GET    /api/health
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me
GET    /api/iot/devices
GET    /api/iot/devices/:id/simulation
POST   /api/iot/devices/:id/simulation
DELETE /api/iot/devices/:id/simulation
WS     /api/ws/experiences/:id/telemetry?teacherCode=:code
GET    /api/experiences
POST   /api/experiences
GET    /api/experiences/:id
GET    /api/experiences/:id/glb
GET    /api/experiences/:id/json
PUT    /api/experiences/:id
DELETE /api/experiences/:id
GET    /api/public/teachers/:code/experiences
GET    /api/public/experiences/:id/glb
GET    /api/public/experiences/:id/json
POST   /api/uploads
POST   /api/upload
GET    /api/uploads/:id
GET    /api/uploads/:id/glb
GET    /api/uploads/:id/json
DELETE /api/uploads/:id
GET    /api/textures
GET    /textures/:file
```

## Notes

### ThingsBoard

Il backend autentica il proprio client REST con una API key ThingsBoard. Imposta le
variabili d'ambiente prima di avviare il backend:

```text
THINGSBOARD_BASE_URL=https://eu.thingsboard.cloud
THINGSBOARD_API_KEY=<api-key ThingsBoard>
THINGSBOARD_TIMEOUT_SECONDS=10
THINGSBOARD_REALTIME_POLL_SECONDS=1
```

Puoi copiare `backend/.env.example` in `backend/.env`: il backend lo carica
automaticamente senza sovrascrivere eventuali variabili d'ambiente del sistema.
In alternativa, puoi impostarle in PowerShell:

```powershell
$env:THINGSBOARD_API_KEY = "api-key-segreta"
python backend/app.py
```

`GET /api/iot/devices` esegue `GET /api/tenant/devices?pageSize=100&page=0` con
`X-Authorization: ApiKey <THINGSBOARD_API_KEY>` e restituisce per ciascun device solo `id`, `name` e `type`.

L'API key serve tutte le comunicazioni con ThingsBoard, incluso il controllo degli
aggiornamenti ogni secondo. Solo il backend esegue questo controllo: il frontend riceve
gli aggiornamenti tramite WebSocket e non effettua polling. Puoi aumentare
`THINGSBOARD_REALTIME_POLL_SECONDS` per ridurre il numero di richieste REST.

### Test real-time end-to-end

1. Avvia backend e frontend, accedi come docente e collega un device a un'esperienza.
2. Nel configuratore premi **Avvia simulazione**: il backend pubblica subito e poi ogni 10 secondi tramite l'HTTP Device API di ThingsBoard.
3. Apri l'esperienza come studente con il codice docente. UI e label `{{telemetryKey}}` si aggiornano tramite WebSocket senza polling.
4. Torna nel configuratore e premi **Ferma simulazione**.

Check automatico del parsing dei messaggi ThingsBoard:

```powershell
.\backend\.venv\Scripts\python.exe -m unittest backend/test_realtime.py
```

The SQLite database is stored in:

```text
backend/data/app.db
```

Persistent experience files are stored in:

```text
backend/storage/experiences/<experienceId>/
```

Temporary uploads are stored in:

```text
backend/storage/<uploadId>/
```
