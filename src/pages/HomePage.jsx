import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <div id="setup-container" className="min-vh-100 d-flex align-items-center bg-light">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-7 col-xl-6">
            <div className="card shadow border-0 rounded-4">
              <div className="card-body p-4 p-md-5">
                <div className="text-center mb-4">
                  <h1 className="h3 mb-1">Configuratore 3D</h1>
                  <p className="text-muted mb-0">Seleziona il tipo di utente.</p>
                </div>

                <div className="home-actions">
                  <Link to="/docente/login" className="btn btn-primary btn-lg w-100">
                    Docente
                  </Link>

                  <Link to="/visualizzatore" className="btn btn-outline-primary btn-lg w-100">
                    Studente
                  </Link>
                </div>

                <div className="d-flex gap-2 mt-3 flex-wrap justify-content-center" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
