import { Injectable } from '@angular/core';

export interface Teacher {
  id: string;
  name: string;
  email: string;
  accessCode: string;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  teacher: Teacher;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'teacher-auth-token';
  private readonly teacherKey = 'teacher-auth-profile';
  private readonly apiBase = `${window.location.protocol}//${window.location.hostname}:3001/api`;

  async register(name: string, email: string, password: string): Promise<Teacher> {
    const data = await this.postAuth('/auth/register', { name, email, password });
    this.saveSession(data);
    return data.teacher;
  }

  async login(email: string, password: string): Promise<Teacher> {
    const data = await this.postAuth('/auth/login', { email, password });
    this.saveSession(data);
    return data.teacher;
  }

  async me(): Promise<Teacher> {
    const response = await fetch(`${this.apiBase}/auth/me`, {
      headers: this.authHeaders()
    });

    if (!response.ok) {
      this.clearSession();
      throw new Error(await this.readError(response));
    }

    const data = await response.json();
    this.saveTeacher(data.teacher);
    return data.teacher;
  }

  logout(): void {
    this.clearSession();
  }

  getToken(): string {
    return localStorage.getItem(this.tokenKey) || '';
  }

  getStoredTeacher(): Teacher | null {
    const raw = localStorage.getItem(this.teacherKey);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Teacher;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return Boolean(this.getToken());
  }

  private async postAuth(path: string, body: unknown): Promise<AuthResponse> {
    const response = await fetch(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    return response.json();
  }

  private authHeaders(): HeadersInit {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private saveSession(data: AuthResponse): void {
    localStorage.setItem(this.tokenKey, data.token);
    this.saveTeacher(data.teacher);
  }

  private saveTeacher(teacher: Teacher): void {
    localStorage.setItem(this.teacherKey, JSON.stringify(teacher));
  }

  private clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.teacherKey);
  }

  private async readError(response: Response): Promise<string> {
    try {
      const data = await response.json();
      return data?.error || `Errore richiesta (${response.status})`;
    } catch {
      return `Errore richiesta (${response.status})`;
    }
  }
}
