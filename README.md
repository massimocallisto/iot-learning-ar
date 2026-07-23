# Configuratore Tesi

A web-based prototype for creating, configuring, and viewing interactive 3D learning experiences.

The application allows a teacher to upload a 3D model, configure Points of Interest on model parts, and publish the experience so that students can access it through a browser. The viewer is designed to support standard 3D visualization and can be extended toward WebXR, AR/VR, and real-time IoT data integration.

## Project overview

The project is composed of two main parts:

- **Frontend**: React/Vite web application used by teachers and students.
- **Backend**: Node.js/Express API used for authentication, experience management, file upload, and public student access.

Main user flows:

- Teacher registration and login.
- Teacher dashboard for managing experiences.
- 3D model upload.
- Point of Interest configuration.
- Student access through teacher code.
- 3D experience visualization.

## Requirements

Before running the project, make sure you have the following tools installed:

- **Node.js** 18 or higher.
- **npm** 9 or higher.
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
npm run backend:https:local
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

## Available npm scripts

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
npm run backend:https:local
```

Starts the backend API server on:

```text
https://localhost:3001
```

### Start backend without HTTPS

```bash
npm run backend
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

If no explicit API base URL is configured, the frontend should use the current hostname and call the backend on port `3001`.

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
npm run backend:https:local
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
