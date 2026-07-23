import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { authService } from './services/authService.js';
import { HomePage } from './pages/HomePage.jsx';
import { TeacherLoginPage } from './pages/TeacherLoginPage.jsx';
import { TeacherRegisterPage } from './pages/TeacherRegisterPage.jsx';
import { ConfiguratorPage } from './pages/ConfiguratorPage.jsx';
import { ConfigurationPage } from './pages/ConfigurationPage.jsx';
import { StudentAccessPage } from './pages/StudentAccessPage.jsx';
import { ViewerPage } from './pages/ViewerPage.jsx';

function RequireTeacher({ children }) {
  const location = useLocation();

  if (!authService.isLoggedIn()) {
    return <Navigate to="/docente/login" replace state={{ from: location }} />;
  }

  return children;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/docente/login" element={<TeacherLoginPage />} />
      <Route path="/docente/registrazione" element={<TeacherRegisterPage />} />
      <Route
        path="/configuratore"
        element={
          <RequireTeacher>
            <ConfiguratorPage />
          </RequireTeacher>
        }
      />
      <Route
        path="/configurazione"
        element={
          <RequireTeacher>
            <ConfigurationPage />
          </RequireTeacher>
        }
      />
      <Route path="/visualizzatore" element={<StudentAccessPage />} />
      <Route path="/viewe" element={<ViewerPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
