import { getApiBase, readError } from './api.js';

const tokenKey = 'teacher-auth-token';
const teacherKey = 'teacher-auth-profile';

function saveTeacher(teacher) {
  localStorage.setItem(teacherKey, JSON.stringify(teacher));
}

function saveSession(data) {
  localStorage.setItem(tokenKey, data.token);
  saveTeacher(data.teacher);
}

async function postAuth(path, body) {
  const response = await fetch(`${getApiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(await readError(response));
  return response.json();
}

export const authService = {
  async register(name, email, password) {
    const data = await postAuth('/auth/register', { name, email, password });
    saveSession(data);
    return data.teacher;
  },

  async login(email, password) {
    const data = await postAuth('/auth/login', { email, password });
    saveSession(data);
    return data.teacher;
  },

  async me() {
    const response = await fetch(`${getApiBase()}/auth/me`, {
      headers: this.authHeaders()
    });

    if (!response.ok) {
      this.clearSession();
      throw new Error(await readError(response));
    }

    const data = await response.json();
    saveTeacher(data.teacher);
    return data.teacher;
  },

  logout() {
    this.clearSession();
  },

  getToken() {
    return localStorage.getItem(tokenKey) || '';
  },

  getStoredTeacher() {
    const raw = localStorage.getItem(teacherKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return Boolean(this.getToken());
  },

  authHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  },

  clearSession() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(teacherKey);
  }
};
