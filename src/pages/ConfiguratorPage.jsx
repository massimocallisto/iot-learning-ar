import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService.js';
import { experienceService } from '../services/experienceService.js';
import { viewerSession } from '../services/viewerSession.js';

export function ConfiguratorPage() {
  const navigate = useNavigate();
  const glbInputRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isTeacherLoading, setIsTeacherLoading] = useState(false);
  const [isExperiencesLoading, setIsExperiencesLoading] = useState(false);
  const [deletingExperienceId, setDeletingExperienceId] = useState('');
  const [teacher, setTeacher] = useState(authService.getStoredTeacher());
  const [experiences, setExperiences] = useState([]);
  const [dashboardError, setDashboardError] = useState('');
  const [connectIotDevice, setConnectIotDevice] = useState(false);
  const [iotDevices, setIotDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [isDevicesLoading, setIsDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  async function loadIotDevices() {
    setIsDevicesLoading(true);
    setDevicesError('');

    try {
      setIotDevices(await experienceService.getIotDevices());
    } catch (err) {
      setIotDevices([]);
      setDevicesError(err instanceof Error ? err.message : 'Impossibile caricare i dispositivi IoT.');
    } finally {
      setIsDevicesLoading(false);
    }
  }

  function changeIotConnection(enabled) {
    setConnectIotDevice(enabled);
    if (!enabled) {
      setSelectedDeviceId('');
      setDevicesError('');
      return;
    }
    if (!iotDevices.length && !isDevicesLoading) void loadIotDevices();
  }

  async function loadExperiences() {
    setIsExperiencesLoading(true);

    try {
      setExperiences(await experienceService.getMyExperiences());
    } catch (err) {
      setExperiences([]);
      setDashboardError(err instanceof Error ? err.message : 'Impossibile caricare le esperienze.');
    } finally {
      setIsExperiencesLoading(false);
    }
  }

  async function loadDashboardData() {
    setDashboardError('');
    setTeacher(authService.getStoredTeacher());
    setIsTeacherLoading(true);

    try {
      setTeacher(await authService.me());
      await loadExperiences();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Impossibile caricare il profilo docente.');
    } finally {
      setIsTeacherLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
  }, []);

  async function toggleDashboard() {
    const next = !isDashboardOpen;
    setIsDashboardOpen(next);

    if (next) {
      await loadDashboardData();
    }
  }

  async function deleteExperience(experience) {
    const confirmed = window.confirm(`Eliminare l'esperienza "${experience.title}"?`);
    if (!confirmed) return;

    setDashboardError('');
    setDeletingExperienceId(experience.id);

    try {
      await experienceService.deleteExperience(experience.id);
      setExperiences((items) => items.filter((item) => item.id !== experience.id));
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Eliminazione esperienza fallita.');
    } finally {
      setDeletingExperienceId('');
    }
  }

  function logout() {
    authService.logout();
    navigate('/docente/login');
  }

  async function upload() {
    setIsLoading(true);
    const glb = glbInputRef.current;

    if (!glb?.files?.[0]) {
      alert('Caricare il GLB.');
      setIsLoading(false);
      return;
    }

    try {
      viewerSession.setDeviceId(connectIotDevice ? selectedDeviceId : null);
      await viewerSession.setFile(glb.files[0]);
      navigate('/configurazione');
    } catch (err) {
      console.error(err);
      alert('Upload al backend fallito.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div id="setup-container" className="min-vh-100 d-flex align-items-center bg-light">
      <button
        className="user-menu-button"
        type="button"
        aria-label="Apri dashboard docente"
        aria-expanded={isDashboardOpen}
        onClick={toggleDashboard}
      >
        <span className="user-menu-initial">{teacher?.name?.charAt(0) || 'D'}</span>
      </button>

      {isDashboardOpen && (
        <>
          <div className="dashboard-backdrop" onClick={toggleDashboard} />
          <section className="teacher-dashboard" role="dialog" aria-modal="true" aria-label="Dashboard docente">
            <div className="dashboard-header">
              <div>
                <h2>Dashboard docente</h2>
                <p>Profilo e gestione esperienze</p>
              </div>
              <button className="dashboard-close" type="button" aria-label="Chiudi dashboard" onClick={toggleDashboard}>x</button>
            </div>

            {dashboardError && <div className="alert alert-danger dashboard-alert" role="alert">{dashboardError}</div>}

            <section className="dashboard-section">
              <div className="section-title">Docente</div>

              {isTeacherLoading && !teacher ? (
                <p className="empty-state">Caricamento profilo...</p>
              ) : teacher ? (
                <div className="teacher-profile">
                  <div>
                    <span>Nome</span>
                    <strong>{teacher.name}</strong>
                  </div>
                  <div>
                    <span>Email</span>
                    <strong>{teacher.email}</strong>
                  </div>
                  <div>
                    <span>Codice docente</span>
                    <strong className="teacher-code">{teacher.accessCode}</strong>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="dashboard-section experiences-section">
              <div className="section-heading-row">
                <div className="section-title">Esperienze</div>
                <button className="btn btn-sm btn-outline-primary" type="button" onClick={loadExperiences} disabled={isExperiencesLoading}>
                  Aggiorna
                </button>
              </div>

              {isExperiencesLoading ? (
                <p className="empty-state">Caricamento esperienze...</p>
              ) : experiences.length ? (
                <div className="experience-list">
                  {experiences.map((experience) => (
                    <article className="experience-card" key={experience.id}>
                      <div>
                        <h3>{experience.title}</h3>
                        <p>{experience.description || 'Nessuna descrizione.'}</p>
                        <span>Ultima modifica: {experience.updatedAt}</span>
                      </div>
                      <div className="experience-actions">
                        <button className="btn btn-sm btn-primary" type="button" onClick={() => navigate(`/configurazione?experienceId=${encodeURIComponent(experience.id)}`)}>
                          Modifica
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          type="button"
                          onClick={() => deleteExperience(experience)}
                          disabled={deletingExperienceId === experience.id}
                        >
                          {deletingExperienceId === experience.id ? 'Elimino...' : 'Elimina'}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Non ci sono ancora esperienze salvate.</p>
              )}
            </section>

            <button className="btn btn-outline-danger w-100" type="button" onClick={logout}>Esci</button>
          </section>
        </>
      )}

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-7 col-xl-6">
            <div className="card shadow border-0 rounded-4">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <h1 className="h3 mb-1">Crea un esperienza</h1>
                  <p className="text-muted mb-0">Carica il file richiesto.</p>
                </div>

                <div className="mb-3">
                  <label htmlFor="glb" className="form-label fw-semibold">Modello base</label>
                  <div className="input-group">
                    <span className="input-group-text">🧩</span>
                    <input ref={glbInputRef} type="file" id="glb" accept=".glb" className="form-control" />
                  </div>
                  <div className="form-text">Carica un file .glb</div>
                </div>

                <fieldset className="mb-4">
                  <legend className="form-label fw-semibold mb-2">Collega un dispositivo IoT</legend>
                  <div className="form-check mb-2">
                    <input className="form-check-input" type="radio" name="iotConnection" id="iotConnectionNo" checked={!connectIotDevice} onChange={() => changeIotConnection(false)} />
                    <label className="form-check-label" htmlFor="iotConnectionNo">No, usa solo POI descrittivi</label>
                  </div>
                  <div className="form-check">
                    <input className="form-check-input" type="radio" name="iotConnection" id="iotConnectionYes" checked={connectIotDevice} onChange={() => changeIotConnection(true)} />
                    <label className="form-check-label" htmlFor="iotConnectionYes">Sì, collega un dispositivo IoT esistente</label>
                  </div>

                  {connectIotDevice && (
                    <div className="mt-3">
                      <label className="form-label fw-semibold" htmlFor="iotDevice">Dispositivo ThingsBoard</label>
                      <select id="iotDevice" className="form-select" value={selectedDeviceId} onChange={(event) => setSelectedDeviceId(event.target.value)} disabled={isDevicesLoading}>
                        <option value="">{isDevicesLoading ? 'Caricamento dispositivi...' : 'Seleziona un dispositivo'}</option>
                        {iotDevices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
                      </select>
                      {devicesError && <div className="form-text text-danger">{devicesError}</div>}
                    </div>
                  )}
                </fieldset>

                <button
                  id="generateBtn"
                  type="button"
                  className="btn btn-primary btn-lg w-100"
                  onClick={upload}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                      Caricamento...
                    </>
                  ) : 'Crea'}
                </button>

                <div className="d-flex gap-2 mt-3 flex-wrap">
                  <span className="badge text-bg-secondary">GLB</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
