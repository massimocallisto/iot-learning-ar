import { getApiBase, getApiOrigin, readError } from './api.js';
import { authService } from './authService.js';

let iotDevicesCache = null;
let iotDevicesRequest = null;

export const experienceService = {
  async getIotDevices() {
    if (iotDevicesCache) return iotDevicesCache;
    if (iotDevicesRequest) return iotDevicesRequest;

    iotDevicesRequest = fetch(`${getApiBase()}/iot/devices`, {
      headers: authService.authHeaders()
    }).then(async (response) => {
      if (!response.ok) throw new Error(await readError(response));
      const data = await response.json();
      iotDevicesCache = data.devices || [];
      return iotDevicesCache;
    }).finally(() => {
      iotDevicesRequest = null;
    });

    return iotDevicesRequest;
  },

  async getIotDeviceLatestTelemetry(deviceId) {
    const response = await fetch(`${getApiBase()}/iot/devices/${encodeURIComponent(deviceId)}/latest-telemetry`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.lastTelemetryTs ?? null;
  },

  async getIotDeviceTelemetryCatalog(deviceId) {
    const response = await fetch(`${getApiBase()}/iot/devices/${encodeURIComponent(deviceId)}/telemetry-catalog`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.telemetryKeys || [];
  },

  async getIotDeviceTelemetry(deviceId) {
    const response = await fetch(`${getApiBase()}/iot/devices/${encodeURIComponent(deviceId)}/telemetry`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.telemetry || {};
  },

  async getIotDeviceStatus(deviceId) {
    const response = await fetch(`${getApiBase()}/iot/devices/${encodeURIComponent(deviceId)}/status`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.active === true;
  },

  async getIotDeviceSimulation(deviceId) {
    const response = await fetch(`${getApiBase()}/iot/devices/${encodeURIComponent(deviceId)}/simulation`, {
      headers: authService.authHeaders()
    });
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()).active === true;
  },

  async setIotDeviceSimulation(deviceId, active) {
    const response = await fetch(`${getApiBase()}/iot/devices/${encodeURIComponent(deviceId)}/simulation`, {
      method: active ? 'POST' : 'DELETE',
      headers: active ? { 'Content-Type': 'application/json', ...authService.authHeaders() } : authService.authHeaders(),
      body: active ? JSON.stringify({ intervalSeconds: 15 }) : undefined
    });
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()).active === true;
  },

  async getMyExperiences() {
    const response = await fetch(`${getApiBase()}/experiences`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.experiences || [];
  },

  async createExperience(input) {
    const response = await fetch(`${getApiBase()}/experiences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.authHeaders()
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.experience;
  },

  async getExperience(id) {
    const response = await fetch(`${getApiBase()}/experiences/${encodeURIComponent(id)}`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.experience;
  },

  async getExperienceGlb(id) {
    const response = await fetch(`${getApiBase()}/experiences/${encodeURIComponent(id)}/glb`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    return response;
  },

  async getExperienceJson(id) {
    const response = await fetch(`${getApiBase()}/experiences/${encodeURIComponent(id)}/json`, {
      headers: authService.authHeaders()
    });

    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },

  async updateExperience(id, input) {
    const response = await fetch(`${getApiBase()}/experiences/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...authService.authHeaders()
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.experience;
  },

  async deleteExperience(id) {
    const response = await fetch(`${getApiBase()}/experiences/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authService.authHeaders()
    });

    if (!response.ok && response.status !== 404) throw new Error(await readError(response));
  },

  async getPublicExperiencesByTeacherCode(code) {
    const response = await fetch(`${getApiBase()}/public/teachers/${encodeURIComponent(code.trim())}/experiences`);

    if (!response.ok) throw new Error(await readError(response));
    return response.json();
  },

  async getPublicExperienceGlb(id) {
    const response = await fetch(`${getApiBase()}/public/experiences/${encodeURIComponent(id)}/glb`);

    if (!response.ok) throw new Error(await readError(response));
    return response;
  },

  async getPublicExperienceJson(id) {
    const response = await fetch(`${getApiBase()}/public/experiences/${encodeURIComponent(id)}/json`);

    if (!response.ok) throw new Error(await readError(response));
    return response;
  },

  async getPublicExperienceTelemetry(id, teacherCode) {
    const query = new URLSearchParams({ teacherCode });
    const response = await fetch(`${getApiBase()}/public/experiences/${encodeURIComponent(id)}/telemetry?${query}`);

    if (!response.ok) throw new Error(await readError(response));
    const data = await response.json();
    return data.telemetry || {};
  },

  async getPublicExperienceSimulation(id, teacherCode) {
    const query = new URLSearchParams({ teacherCode });
    const response = await fetch(`${getApiBase()}/public/experiences/${encodeURIComponent(id)}/simulation?${query}`);
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()).active === true;
  },

  async setPublicExperienceSimulation(id, teacherCode, active) {
    const query = new URLSearchParams({ teacherCode });
    const response = await fetch(`${getApiBase()}/public/experiences/${encodeURIComponent(id)}/simulation?${query}`, {
      method: active ? 'POST' : 'DELETE'
    });
    if (!response.ok) throw new Error(await readError(response));
    return (await response.json()).active === true;
  },

  subscribeToPublicExperienceTelemetry(id, teacherCode, handlers) {
    let socket;
    let retryTimer;
    let stopped = false;

    const connect = () => {
      const origin = new URL(getApiOrigin() || window.location.origin, window.location.origin);
      origin.protocol = origin.protocol === 'https:' ? 'wss:' : 'ws:';
      origin.pathname = `/api/ws/experiences/${encodeURIComponent(id)}/telemetry`;
      origin.search = new URLSearchParams({ teacherCode });
      socket = new WebSocket(origin);
      socket.onopen = () => handlers.onOpen?.();
      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'error') handlers.onError?.(message.error);
        if (message.type === 'telemetry') handlers.onTelemetry?.(message);
      };
      socket.onerror = () => handlers.onError?.('Connessione real-time non disponibile.');
      socket.onclose = () => {
        handlers.onError?.('Connessione real-time interrotta. Avvia o riavvia il backend.');
        if (!stopped) retryTimer = window.setTimeout(connect, 2000);
      };
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }
};
