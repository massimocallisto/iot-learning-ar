import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService.js';

export function TeacherRegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [teacher, setTeacher] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setTeacher(null);
    setIsLoading(true);

    try {
      setTeacher(await authService.register(name, email, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registrazione fallita.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-page min-vh-100 d-flex align-items-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-8 col-lg-5">
            <div className="card shadow border-0 rounded-4">
              <div className="card-body p-4 p-md-5">
                <div className="mb-4">
                  <h1 className="h3 mb-1">Registrazione docente</h1>
                  <p className="text-muted mb-0">Crea un account e ottieni il codice da condividere con gli studenti.</p>
                </div>

                {error && <div className="alert alert-danger" role="alert">{error}</div>}

                {teacher ? (
                  <>
                    <div className="alert alert-success" role="status">
                      <strong>Account creato.</strong>
                      <div>Codice docente: <span className="teacher-code">{teacher.accessCode}</span></div>
                    </div>

                    <button className="btn btn-primary btn-lg w-100" type="button" onClick={() => navigate('/configuratore')}>
                      Vai al configuratore
                    </button>
                  </>
                ) : (
                  <form onSubmit={submit}>
                    <div className="mb-3">
                      <label className="form-label" htmlFor="name">Nome docente</label>
                      <input
                        id="name"
                        className="form-control"
                        type="text"
                        name="name"
                        autoComplete="name"
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label" htmlFor="email">Email</label>
                      <input
                        id="email"
                        className="form-control"
                        type="email"
                        name="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                      />
                    </div>

                    <div className="mb-4">
                      <label className="form-label" htmlFor="password">Password</label>
                      <div className="password-field">
                        <input
                          id="password"
                          className="form-control"
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          autoComplete="new-password"
                          minLength={8}
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                        />
                        <button
                          className="password-toggle"
                          type="button"
                          aria-label={showPassword ? 'Nascondi password' : 'Mostra password'}
                          onClick={() => setShowPassword((value) => !value)}
                        >
                          <span aria-hidden="true">&#128065;&#xfe0e;</span>
                        </button>
                      </div>
                    </div>

                    <button className="btn btn-primary btn-lg w-100" type="submit" disabled={isLoading}>
                      {isLoading ? 'Creazione in corso...' : 'Crea account'}
                    </button>
                  </form>
                )}

                <div className="auth-links">
                  <Link to="/">Torna alla home</Link>
                  <Link to="/docente/login">Ho gia un account</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
