# Configuratore 3D - frontend React/Vite

Questa versione sostituisce il frontend Angular con un frontend React basato su Vite.
Il backend Express/SQLite è stato mantenuto invariato, così come la logica JavaScript/Three.js del viewer e del configuratore 3D.

## Cosa è stato migrato

- Routing Angular -> React Router.
- Componenti Angular -> pagine React.
- Servizi Angular -> moduli JavaScript React-friendly.
- Guard docente -> route protetta React.
- Forms Angular -> state React.
- Integrazione con viewer/configuratore Three.js mantenuta tramite i moduli in `src/script`.
- Script HTTPS resi compatibili con macOS/Windows/Linux tramite `cross-env`.

## Struttura principale

```text
src/
  App.jsx
  main.jsx
  pages/
    HomePage.jsx
    TeacherLoginPage.jsx
    TeacherRegisterPage.jsx
    ConfiguratorPage.jsx
    ConfigurationPage.jsx
    StudentAccessPage.jsx
    ViewerPage.jsx
  services/
    api.js
    authService.js
    experienceService.js
    viewerSession.js
  script/
    ... moduli Three.js/WebXR già esistenti ...
backend/
  server.js
  db.js
```

## Installazione

```bash
npm install
```

## Avvio backend

HTTP:

```bash
npm run backend
```

HTTPS locale:

```bash
npm run backend:https:local
```

## Avvio frontend

HTTP:

```bash
npm run dev
```

HTTPS locale:

```bash
npm run start:https:local
```

Gli script HTTPS cercano i certificati in:

```text
ssl/localhost+2.pem
ssl/localhost+2-key.pem
```

Per generarli con `mkcert`:

```bash
brew install mkcert
mkcert -install
mkdir -p ssl
mkcert -cert-file ssl/localhost+2.pem -key-file ssl/localhost+2-key.pem localhost 127.0.0.1 ::1
```

Se devi aprire l'app da tablet/visore sulla stessa rete, includi anche l'IP del computer:

```bash
mkcert -cert-file ssl/localhost+2.pem -key-file ssl/localhost+2-key.pem localhost 127.0.0.1 ::1 192.168.1.50
```

## Configurazione API

Di default il frontend chiama il backend su:

```text
<protocollo pagina>//<hostname>:3001/api
```

Esempio:

```text
https://localhost:3001/api
https://192.168.1.50:3001/api
```

Se vuoi forzare URL diversi, crea `.env.local`:

```bash
VITE_API_BASE_URL=https://localhost:3001/api
VITE_API_ORIGIN=https://localhost:3001
```

## Note tecniche

Il codice Three.js è ancora imperativo e manipola direttamente il DOM. Per evitare conflitti con React, le UI generate dinamicamente vengono montate dentro:

```html
<div id="imperative-control-root"></div>
```

In futuro conviene trasformare gradualmente i controlli del configuratore in componenti React puri. Per ora, questa migrazione mantiene la logica esistente e riduce il rischio di regressioni sul viewer WebXR.

## Verifica

```bash
npm run build
```

Nel container in cui è stato prodotto questo archivio non è stato possibile completare `npm install` perché il registry npm non era disponibile in cache/offline. I file JavaScript non-JSX sono stati verificati con `node --check`; la build React va eseguita nella tua macchina dopo `npm install`.
