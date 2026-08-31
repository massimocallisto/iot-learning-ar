import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { load, uploadViewe } from '../script/main.js';
import { ThreeViewer } from '../script/viewer/ThreeViewer.js';
import { experienceService } from '../services/experienceService.js';
import { viewerSession } from '../services/viewerSession.js';

function formatTelemetryValue(point) {
  const value = point?.value;
  if (value === null || value === undefined || value === '') return '—';
  const formatted = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return point?.unit ? `${formatted} ${point.unit}` : formatted;
}

export function ViewerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const uploadIdRef = useRef(viewerSession.getId());
  const [payload, setPayload] = useState(null);
  const [telemetry, setTelemetry] = useState({ loading: false, values: {}, deviceName: '', deviceDescription: '', deviceActive: false, deviceConnected: false, error: '' });
  const [simulation, setSimulation] = useState({ active: false, loading: false, error: '' });

  const publicExperienceId = searchParams.get('experienceId') || '';
  const returnTeacherCode = searchParams.get('teacherCode') || '';

  useEffect(() => {
    const onExperienceClose = () => {
      if (publicExperienceId) {
        const query = returnTeacherCode ? `?teacherCode=${encodeURIComponent(returnTeacherCode)}` : '';
        navigate(`/visualizzatore${query}`);
        return;
      }

      navigate('/configuratore');
    };

    window.addEventListener('experience:close', onExperienceClose);

    return () => {
      window.removeEventListener('experience:close', onExperienceClose);
    };
  }, [navigate, publicExperienceId, returnTeacherCode]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      if (publicExperienceId) {
        try {
          const [glb, json] = await Promise.all([
            experienceService.getPublicExperienceGlb(publicExperienceId),
            experienceService.getPublicExperienceJson(publicExperienceId)
          ]);

          if (!cancelled) setPayload({ glb, json, isPublic: true });
        } catch (err) {
          console.error(err);
          alert('Esperienza non disponibile.');
          navigate('/visualizzatore');
        }

        return;
      }

      const uploadId = viewerSession.getId();
      uploadIdRef.current = uploadId;

      if (!uploadId) {
        navigate('/visualizzatore');
        return;
      }

      try {
        const [glb, json] = await Promise.all([
          viewerSession.getGlb(uploadId),
          viewerSession.getJson(uploadId)
        ]);

        if (!glb || !json) {
          alert('Nessun file disponibile. Torna al visualizzatore.');
          navigate('/visualizzatore');
          return;
        }

        if (!cancelled) setPayload({ glb, json, isPublic: false });
      } catch (err) {
        console.error(err);
        alert('Nessun file disponibile. Torna al visualizzatore.');
        navigate('/visualizzatore');
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [navigate, publicExperienceId]);

  useEffect(() => {
    if (!publicExperienceId) return undefined;
    setTelemetry({ loading: true, values: {}, deviceName: '', deviceDescription: '', deviceActive: false, deviceConnected: false, error: '' });
    return experienceService.subscribeToPublicExperienceTelemetry(publicExperienceId, returnTeacherCode, {
      onOpen: () => setTelemetry((current) => ({ ...current, error: '' })),
      onError: (error) => setTelemetry((current) => ({ ...current, loading: false, error })),
      onTelemetry: (message) => setTelemetry((current) => {
        const values = { ...current.values, ...message.telemetry };
        window.dispatchEvent(new CustomEvent('experience:telemetry', { detail: values }));
        return {
          loading: false,
          values,
          deviceName: message.deviceName ?? current.deviceName,
          deviceDescription: message.deviceDescription ?? current.deviceDescription,
          deviceActive: message.deviceActive ?? current.deviceActive,
          deviceConnected: message.deviceConnected ?? current.deviceConnected,
          error: ''
        };
      })
    });
  }, [publicExperienceId, returnTeacherCode]);

  useEffect(() => {
    if (!publicExperienceId) return undefined;
    let cancelled = false;
    experienceService.getPublicExperienceSimulation(publicExperienceId, returnTeacherCode)
      .then((active) => !cancelled && setSimulation({ active, loading: false, error: '' }))
      .catch((error) => !cancelled && setSimulation({ active: false, loading: false, error: error.message }));
    return () => { cancelled = true; };
  }, [publicExperienceId, returnTeacherCode]);

  async function toggleSimulation() {
    if (simulation.loading) return;
    setSimulation((current) => ({ ...current, loading: true, error: '' }));
    try {
      const active = await experienceService.setPublicExperienceSimulation(
        publicExperienceId,
        returnTeacherCode,
        !simulation.active
      );
      setSimulation({ active, loading: false, error: '' });
    } catch (error) {
      setSimulation((current) => ({ ...current, loading: false, error: error.message }));
    }
  }

  useEffect(() => {
    if (!payload || !canvasRef.current || !hostRef.current || viewerRef.current) return;

    let disposed = false;

    async function initViewer() {
      try {
        const viewer = new ThreeViewer({
          canvas: canvasRef.current,
          container: hostRef.current
        });

        viewerRef.current = viewer;
        await uploadViewe(payload.glb, viewer, payload.json);
        const deviceId = viewerSession.getDeviceId();
        const telemetryProvider = payload.isPublic
          ? () => experienceService.getPublicExperienceTelemetry(publicExperienceId, returnTeacherCode)
          : (deviceId ? () => experienceService.getIotDeviceTelemetry(deviceId) : null);
        await load(viewer, { telemetryProvider });

        if (!payload.isPublic && uploadIdRef.current) {
          await viewerSession.deleteUpload(uploadIdRef.current);
        }

        if (disposed) {
          viewer.dispose();
          viewerRef.current = null;
        }
      } catch (err) {
        console.error(err);
        alert('Errore durante il caricamento del viewer.');
        viewerRef.current?.dispose();
        viewerRef.current = null;
      }
    }

    void initViewer();

    return () => {
      disposed = true;
    };
  }, [payload, publicExperienceId, returnTeacherCode]);

  useEffect(() => {
    return () => {
      document.body.classList.remove('ar-mode', 'experience-ended');
      const overlay = document.querySelector('#ar-overlay');
      overlay?.remove();
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []);

  return (
    <div className="layout">
      <button id="ui-fab" className="ui-fab" aria-label="Apri controlli">☰</button>

      <aside className="control" id="control">
        <div className="control-inner">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <div id="gesture-debug" />
          </div>

          {payload?.isPublic && telemetry.deviceConnected && (
            <details className="ctrl-section device-telemetry-section">
              <summary className="ctrl-title device-telemetry-summary">
                <span>{telemetry.deviceName || 'Device collegato'}</span>
                <span className={`badge ${telemetry.deviceActive ? 'bg-success' : 'bg-danger'}`}>
                  {telemetry.deviceActive ? 'Attivo' : 'Inattivo'}
                </span>
              </summary>
              <div className="device-telemetry-content" aria-live="polite">
                <div className="form-check form-switch telemetry-label-toggle mb-3">
                  <input
                    id="student-simulation-toggle"
                    className="form-check-input"
                    type="checkbox"
                    checked={simulation.active}
                    disabled={simulation.loading}
                    onChange={() => void toggleSimulation()}
                  />
                  <label className="form-check-label" htmlFor="student-simulation-toggle">
                    Simulatore test (15 s)
                  </label>
                  </div>
                {simulation.error && <p className="device-telemetry-message device-telemetry-error">{simulation.error}</p>}
                {telemetry.loading ? (
                  <p className="device-telemetry-message mb-0">Caricamento dati...</p>
                ) : telemetry.error ? (
                  <p className="device-telemetry-message device-telemetry-error mb-0">{telemetry.error}</p>
                ) : Object.keys(telemetry.values).length || telemetry.deviceName ? (
                  <dl className="device-telemetry-list mb-0">
                    <div className="device-telemetry-item">
                      <dt>Descrizione</dt>
                      <dd>{telemetry.deviceDescription || '—'}</dd>
                    </div>
                    {Object.entries(telemetry.values)
                      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
                      .map(([key, point]) => (
                        <div key={key} className="device-telemetry-item">
                          <dt>{point?.icon && <span className="telemetry-icon" aria-hidden="true">{point.icon}</span>}{key}</dt>
                          <dd>{formatTelemetryValue(point)}</dd>
                        </div>
                      ))}
                  </dl>
                ) : (
                  <p className="device-telemetry-message mb-0">Nessun dato disponibile dal device.</p>
                )}
              </div>
            </details>
          )}

          <div id="imperative-control-root" />
        </div>
      </aside>

      <main ref={hostRef} id="viewerHost" className="viewer">
        <canvas ref={canvasRef} id="threeCanvas" />
      </main>
    </div>
  );
}
