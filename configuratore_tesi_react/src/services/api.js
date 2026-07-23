export function getApiBase() {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:3001/api`;
}

export function getApiOrigin() {
  const configured = import.meta.env.VITE_API_ORIGIN;
  if (configured) return configured.replace(/\/$/, '');
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export async function readError(response) {
  try {
    const data = await response.json();
    return data?.error || `Errore richiesta (${response.status})`;
  } catch {
    return `Errore richiesta (${response.status})`;
  }
}
