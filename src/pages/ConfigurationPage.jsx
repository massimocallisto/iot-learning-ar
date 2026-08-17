import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { uploadConfigurazione } from '../script/main.js';
import { ThreeViewer } from '../script/viewer/ThreeViewer.js';
import { experienceService } from '../services/experienceService.js';
import { viewerSession } from '../services/viewerSession.js';

export function ConfigurationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const routeExperienceId = searchParams.get('experienceId') || '';
  const canvasRef = useRef(null);
  const hostRef = useRef(null);
  const viewerRef = useRef(null);
  const uploadIdRef = useRef(viewerSession.getId());
  const titleRef = useRef('');
  const descriptionRef = useRef('');
  const savingRef = useRef(false);
  const telemetryCatalogRef = useRef([]);
  const telemetryValuesRef = useRef({});

  const [payload, setPayload] = useState(null);
  const [experienceTitle, setExperienceTitle] = useState('');
  const [experienceDescription, setExperienceDescription] = useState('');
  const [isSavingExperience, setIsSavingExperience] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [editingExperienceId, setEditingExperienceId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState(viewerSession.getDeviceId() || '');
  const [iotDevices, setIotDevices] = useState([]);
  const [isDevicesLoading, setIsDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');
  const [isDevicePickerOpen, setIsDevicePickerOpen] = useState(false);
  const [lastTelemetryTs, setLastTelemetryTs] = useState(undefined);
  const [isTelemetryLoading, setIsTelemetryLoading] = useState(false);
  const [telemetryError, setTelemetryError] = useState('');
  const [isDeviceActive, setIsDeviceActive] = useState(false);
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [isSimulationLoading, setIsSimulationLoading] = useState(false);

  useEffect(() => {
    titleRef.current = experienceTitle;
  }, [experienceTitle]);

  useEffect(() => {
    descriptionRef.current = experienceDescription;
  }, [experienceDescription]);

  useEffect(() => {
    savingRef.current = isSavingExperience;
  }, [isSavingExperience]);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      const experienceId = routeExperienceId;
      setEditingExperienceId(experienceId);

      if (experienceId) {
        try {
          const [experience, glbResponse, configJson] = await Promise.all([
            experienceService.getExperience(experienceId),
            experienceService.getExperienceGlb(experienceId),
            experienceService.getExperienceJson(experienceId)
          ]);

          if (cancelled) return;
          setExperienceTitle(experience.title || '');
          setExperienceDescription(experience.description || '');
          setSelectedDeviceId(experience.deviceId || '');
          titleRef.current = experience.title || '';
          descriptionRef.current = experience.description || '';
          setPayload({ glb: glbResponse, configJson });
        } catch (err) {
          console.error(err);
          alert('Impossibile caricare esperienza da modificare.');
          navigate('/configuratore');
        }

        return;
      }

      const uploadId = viewerSession.getId();
      uploadIdRef.current = uploadId;
      setSelectedDeviceId(viewerSession.getDeviceId() || '');

      if (!uploadId) {
        navigate('/');
        return;
      }

      try {
        const glbResponse = await viewerSession.getGlb(uploadId);
        if (cancelled) return;

        if (!glbResponse) {
          alert('Nessun file disponibile. Torna al configuratore.');
          navigate('/configuratore');
          return;
        }

        setPayload({ glb: glbResponse, configJson: null });
      } catch (err) {
        console.error(err);
        alert('Nessun file disponibile. Torna al configuratore.');
        navigate('/configuratore');
      }
    }

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [navigate, routeExperienceId]);

  const loadIotDevices = useCallback(async () => {
    setIsDevicesLoading(true);
    setDevicesError('');
    try {
      setIotDevices(await experienceService.getIotDevices());
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Impossibile caricare i dispositivi IoT.');
    } finally {
      setIsDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedDeviceId) {
      setLastTelemetryTs(undefined);
      setTelemetryError('');
      telemetryCatalogRef.current = [];
      telemetryValuesRef.current = {};
      setIsDeviceActive(false);
      setIsSimulationActive(false);
      window.dispatchEvent(new CustomEvent('experience:telemetry-catalog', {
        detail: { keys: [], values: {}, deviceConnected: false, loading: false }
      }));
      return;
    }

    let cancelled = false;
    void loadIotDevices();
    setIsTelemetryLoading(true);
    setTelemetryError('');
    telemetryCatalogRef.current = [];
    telemetryValuesRef.current = {};
    setIsDeviceActive(false);
    setIsSimulationActive(false);
    window.dispatchEvent(new CustomEvent('experience:telemetry-catalog', {
      detail: { keys: [], values: {}, deviceConnected: true, loading: true }
    }));
    void Promise.all([
      experienceService.getIotDeviceLatestTelemetry(selectedDeviceId),
      experienceService.getIotDeviceTelemetryCatalog(selectedDeviceId),
      experienceService.getIotDeviceTelemetry(selectedDeviceId),
      experienceService.getIotDeviceStatus(selectedDeviceId).catch(() => false),
      experienceService.getIotDeviceSimulation(selectedDeviceId).catch(() => false)
    ])
      .then(([timestamp, keys, values, active, simulationActive]) => {
        if (!cancelled) {
          setLastTelemetryTs(timestamp);
          telemetryCatalogRef.current = keys;
          telemetryValuesRef.current = values;
          setIsDeviceActive(active);
          setIsSimulationActive(simulationActive);
          window.dispatchEvent(new CustomEvent('experience:telemetry-catalog', {
            detail: { keys, values, deviceConnected: true, loading: false }
          }));
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Impossibile caricare la telemetria.';
          setTelemetryError(message);
          telemetryCatalogRef.current = [];
          telemetryValuesRef.current = {};
          setIsDeviceActive(false);
          window.dispatchEvent(new CustomEvent('experience:telemetry-catalog', {
            detail: { keys: [], values: {}, deviceConnected: true, loading: false, error: message }
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsTelemetryLoading(false);
      });

    return () => { cancelled = true; };
  }, [loadIotDevices, selectedDeviceId]);

  function changeDevice(deviceId) {
    setSelectedDeviceId(deviceId);
    viewerSession.setDeviceId(deviceId || null);
    setIsDevicePickerOpen(false);
  }

  async function toggleSimulation() {
    if (!selectedDeviceId || isSimulationLoading) return;
    setIsSimulationLoading(true);
    setTelemetryError('');
    try {
      setIsSimulationActive(await experienceService.setIotDeviceSimulation(selectedDeviceId, !isSimulationActive));
    } catch (err) {
      setTelemetryError(err instanceof Error ? err.message : 'Impossibile modificare la simulazione.');
    } finally {
      setIsSimulationLoading(false);
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
        await uploadConfigurazione(payload.glb, viewer, payload.configJson);
        window.dispatchEvent(new CustomEvent('experience:telemetry-catalog', {
          detail: {
            keys: telemetryCatalogRef.current,
            values: telemetryValuesRef.current,
            deviceConnected: Boolean(selectedDeviceId),
            loading: false
          }
        }));

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
  }, [payload]);

  const saveExperience = useCallback(async (configJson) => {
    if (savingRef.current) return;

    setSaveError('');
    setSaveMessage('');

    const title = titleRef.current.trim();
    const description = descriptionRef.current.trim();

    if (!title) {
      setSaveError('Inserisci il titolo dell\'esperienza.');
      return;
    }

    const glbFile = viewerSession.getGlbFile();
    if (!editingExperienceId && !glbFile) {
      setSaveError('File GLB originale non disponibile. Torna al configuratore e ricarica il modello.');
      return;
    }

    if (!configJson) {
      setSaveError('Configurazione JSON non disponibile.');
      return;
    }

    savingRef.current = true;
    setIsSavingExperience(true);

    try {
      if (editingExperienceId) {
        await experienceService.updateExperience(editingExperienceId, {
          title,
          description,
          configJson,
          deviceId: selectedDeviceId || null
        });
      } else {
        const glbBase64 = await viewerSession.fileToBase64(glbFile);
        await experienceService.createExperience({
          title,
          description,
          glbBase64,
          configJson,
          deviceId: selectedDeviceId || null
        });
      }

      setSaveMessage(editingExperienceId
        ? 'Esperienza aggiornata correttamente.'
        : 'Esperienza salvata correttamente.');

      if (uploadIdRef.current && !editingExperienceId) {
        await viewerSession.deleteUpload(uploadIdRef.current);
      }

      navigate('/configuratore');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Salvataggio esperienza fallito.');
    } finally {
      savingRef.current = false;
      setIsSavingExperience(false);
    }
  }, [editingExperienceId, navigate, selectedDeviceId]);

  useEffect(() => {
    const onExperienceSave = (event) => {
      const configJson = event.detail?.configJson;
      void saveExperience(configJson);
    };

    window.addEventListener('experience:save', onExperienceSave);

    return () => {
      window.removeEventListener('experience:save', onExperienceSave);
    };
  }, [saveExperience]);

  useEffect(() => {
    return () => {
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
            <strong>Configurazione</strong>
          </div>

          <section className="ctrl-section experience-metadata-section">
            <div className="ctrl-title">Esperienza</div>

            <div className="mb-3">
              <label className="form-label fw-semibold" htmlFor="experienceTitle">Titolo</label>
              <input
                id="experienceTitle"
                className="form-control"
                type="text"
                name="experienceTitle"
                placeholder="Inserire titolo esperienza"
                value={experienceTitle}
                onChange={(event) => setExperienceTitle(event.target.value)}
              />
            </div>

            <div>
              <label className="form-label fw-semibold" htmlFor="experienceDescription">Descrizione</label>
              <textarea
                id="experienceDescription"
                className="form-control"
                name="experienceDescription"
                rows="3"
                placeholder="Descrivi brevemente cosa vedra lo studente"
                value={experienceDescription}
                onChange={(event) => setExperienceDescription(event.target.value)}
              />
            </div>

            {isSavingExperience && <div className="alert alert-info mt-3 mb-0" role="status">Salvataggio esperienza in corso...</div>}
            {saveMessage && <div className="alert alert-success mt-3 mb-0" role="status">{saveMessage}</div>}
            {saveError && <div className="alert alert-danger mt-3 mb-0" role="alert">{saveError}</div>}
          </section>

          <section className="ctrl-section" aria-live="polite">
            <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
              <div className="ctrl-title mb-0">Device IoT collegato</div>
              {selectedDeviceId && (
                <span className={`badge ${isDeviceActive ? 'bg-success' : 'bg-danger'}`}>
                  {isDeviceActive ? 'Attivo' : 'Inattivo'}
                </span>
              )}
            </div>

            {selectedDeviceId ? (
              <>
                <div className="fw-semibold">{iotDevices.find((device) => device.id === selectedDeviceId)?.name || 'Caricamento device...'}</div>
                <div className="d-flex align-items-center gap-2 mt-2 flex-wrap">
                  <span className={`form-text mt-0 ${telemetryError ? 'text-danger' : ''}`}>
                    {isTelemetryLoading ? 'Caricamento ultima telemetria...' : telemetryError || (lastTelemetryTs ? `Ultima telemetria: ${new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(lastTelemetryTs))}` : 'Nessuna telemetria disponibile')}
                  </span>
                  <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => { setIsDevicePickerOpen(true); void loadIotDevices(); }}>
                    Cambia device
                  </button>
                  <button type="button" className={`btn btn-sm ${isSimulationActive ? 'btn-outline-danger' : 'btn-outline-success'}`} disabled={isSimulationLoading} onClick={() => void toggleSimulation()}>
                    {isSimulationLoading ? 'Attendere...' : isSimulationActive ? 'Ferma simulazione' : 'Avvia simulazione'}
                  </button>
                </div>
              </>
            ) : (
              <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap">
                <span className="form-text mt-0">Nessun device collegato</span>
                <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => { setIsDevicePickerOpen(true); void loadIotDevices(); }}>
                  Collega device
                </button>
              </div>
            )}
          </section>

          <div id="imperative-control-root" />
        </div>
      </aside>

      <main ref={hostRef} id="viewerHost" className="viewer">
        <canvas ref={canvasRef} id="threeCanvas" />
      </main>

      {isDevicePickerOpen && (
        <>
          <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-labelledby="devicePickerTitle">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h2 className="modal-title fs-5" id="devicePickerTitle">Seleziona device IoT</h2>
                  <button type="button" className="btn-close" aria-label="Chiudi" onClick={() => setIsDevicePickerOpen(false)} />
                </div>
                <div className="modal-body">
                  {isDevicesLoading ? <p className="mb-0 text-muted">Caricamento dispositivi...</p> : devicesError ? <p className="mb-0 text-danger">{devicesError}</p> : (
                    <div className="list-group">
                      {selectedDeviceId && (
                        <button type="button" className="list-group-item list-group-item-action" onClick={() => changeDevice('')}>Disconnetti device</button>
                      )}
                      {iotDevices.map((device) => (
                        <button type="button" className={`list-group-item list-group-item-action${device.id === selectedDeviceId ? ' active' : ''}`} key={device.id} onClick={() => changeDevice(device.id)}>
                          {device.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setIsDevicePickerOpen(false)} />
        </>
      )}
    </div>
  );
}
