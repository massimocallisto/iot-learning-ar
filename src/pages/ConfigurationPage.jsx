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

  const [payload, setPayload] = useState(null);
  const [experienceTitle, setExperienceTitle] = useState('');
  const [experienceDescription, setExperienceDescription] = useState('');
  const [isSavingExperience, setIsSavingExperience] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [editingExperienceId, setEditingExperienceId] = useState('');

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
          configJson
        });
      } else {
        const glbBase64 = await viewerSession.fileToBase64(glbFile);
        await experienceService.createExperience({
          title,
          description,
          glbBase64,
          configJson,
          deviceId: viewerSession.getDeviceId()
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
  }, [editingExperienceId, navigate]);

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

          <div id="imperative-control-root" />
        </div>
      </aside>

      <main ref={hostRef} id="viewerHost" className="viewer">
        <canvas ref={canvasRef} id="threeCanvas" />
      </main>
    </div>
  );
}
