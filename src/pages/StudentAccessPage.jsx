import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { experienceService } from '../services/experienceService.js';

export function StudentAccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function searchExperiences(codeOverride = code) {
    const teacherCode = codeOverride.trim();
    setError('');
    setResult(null);

    if (!teacherCode) {
      setError('Inserisci il codice docente.');
      return;
    }

    setIsLoading(true);

    try {
      setResult(await experienceService.getPublicExperiencesByTeacherCode(teacherCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile trovare le esperienze.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const teacherCode = searchParams.get('teacherCode') || '';
    if (!teacherCode) return;

    setCode(teacherCode);
    void searchExperiences(teacherCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function openExperience(experience) {
    const teacherCode = result?.teacher?.accessCode || code.trim();
    navigate(`/viewe?experienceId=${encodeURIComponent(experience.id)}&teacherCode=${encodeURIComponent(teacherCode)}`);
  }

  return (
    <div id="setup-container" className="student-page min-vh-100 bg-light">
      <div className="container py-5">
        <div className="row justify-content-center">
          <div className="col-12 col-lg-8 col-xl-7">
            <section className="student-panel">
              <div className="student-header">
                <div>
                  <h1>Accesso studente</h1>
                  <p>Inserisci il codice docente e scegli l'esperienza da visualizzare.</p>
                </div>
                <Link className="btn btn-outline-secondary" to="/">Home</Link>
              </div>

              <form className="code-form" onSubmit={(event) => { event.preventDefault(); void searchExperiences(); }}>
                <label className="form-label fw-semibold" htmlFor="teacherCode">Codice docente</label>
                <div className="input-group input-group-lg">
                  <input
                    id="teacherCode"
                    className="form-control code-input"
                    type="text"
                    name="teacherCode"
                    autoComplete="off"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                  <button className="btn btn-primary" type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                        Cerco...
                      </>
                    ) : 'Cerca'}
                  </button>
                </div>
              </form>

              {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}

              {result && (
                <section className="results-section">
                  <div className="teacher-result">
                    <span>Docente</span>
                    <strong>{result.teacher.name}</strong>
                    <small>{result.teacher.accessCode}</small>
                  </div>

                  {result.experiences.length ? (
                    <div className="experience-list">
                      {result.experiences.map((experience) => (
                        <article className="student-experience-card" key={experience.id}>
                          <div>
                            <h2>{experience.title}</h2>
                            <p>{experience.description || 'Nessuna descrizione disponibile.'}</p>
                            <span>Ultima modifica: {experience.updatedAt}</span>
                          </div>
                          <button className="btn btn-primary" type="button" onClick={() => openExperience(experience)}>
                            Apri esperienza
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-state">Questo docente non ha ancora esperienze disponibili.</p>
                  )}
                </section>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
