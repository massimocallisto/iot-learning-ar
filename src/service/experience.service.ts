import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface ExperienceSummary {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTeacherExperiences {
  teacher: {
    name: string;
    accessCode: string;
  };
  experiences: ExperienceSummary[];
}

@Injectable({ providedIn: 'root' })
export class ExperienceService {
  private readonly auth = inject(AuthService);
  private readonly apiBase = `${window.location.protocol}//${window.location.hostname}:3001/api`;

  async getMyExperiences(): Promise<ExperienceSummary[]> {
    const response = await fetch(`${this.apiBase}/experiences`, {
      headers: this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    const data = await response.json();
    return data.experiences || [];
  }

  async createExperience(input: {
    title: string;
    description: string;
    glbBase64: string;
    configJson: unknown;
  }): Promise<ExperienceSummary> {
    const response = await fetch(`${this.apiBase}/experiences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders()
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    const data = await response.json();
    return data.experience;
  }

  async getExperience(id: string): Promise<ExperienceSummary> {
    const response = await fetch(`${this.apiBase}/experiences/${encodeURIComponent(id)}`, {
      headers: this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    const data = await response.json();
    return data.experience;
  }

  async getExperienceGlb(id: string): Promise<Response> {
    const response = await fetch(`${this.apiBase}/experiences/${encodeURIComponent(id)}/glb`, {
      headers: this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    return response;
  }

  async getExperienceJson(id: string): Promise<unknown> {
    const response = await fetch(`${this.apiBase}/experiences/${encodeURIComponent(id)}/json`, {
      headers: this.authHeaders()
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    return response.json();
  }

  async updateExperience(id: string, input: {
    title: string;
    description: string;
    configJson: unknown;
  }): Promise<ExperienceSummary> {
    const response = await fetch(`${this.apiBase}/experiences/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders()
      },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    const data = await response.json();
    return data.experience;
  }

  async deleteExperience(id: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/experiences/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: this.authHeaders()
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(await this.readError(response));
    }
  }

  async getPublicExperiencesByTeacherCode(code: string): Promise<PublicTeacherExperiences> {
    const response = await fetch(`${this.apiBase}/public/teachers/${encodeURIComponent(code.trim())}/experiences`);

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    return response.json();
  }

  async getPublicExperienceGlb(id: string): Promise<Response> {
    const response = await fetch(`${this.apiBase}/public/experiences/${encodeURIComponent(id)}/glb`);

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    return response;
  }

  async getPublicExperienceJson(id: string): Promise<Response> {
    const response = await fetch(`${this.apiBase}/public/experiences/${encodeURIComponent(id)}/json`);

    if (!response.ok) {
      throw new Error(await this.readError(response));
    }

    return response;
  }

  private authHeaders(): HeadersInit {
    const token = this.auth.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
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
