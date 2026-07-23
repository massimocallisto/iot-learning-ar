import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  inject
} from '@angular/core';

import { Router } from '@angular/router';
import { AuthService, Teacher } from '../service/auth.service.js';
import { ExperienceService, ExperienceSummary } from '../service/experience.service.js';
import { ViewerSessionService } from '../service/viewer-session.service.js';

@Component({
  selector: 'app-configuratore',
  standalone:true,
  imports: [],
  templateUrl: './configuratore.component.html',
  styleUrl: './configuratore.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ConfiguratoreComponent implements OnInit {
  title='configuratore';
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly experiencesService = inject(ExperienceService);
  private readonly viewerSession = inject(ViewerSessionService);

  isLoading = false;
  isDashboardOpen = false;
  isTeacherLoading = false;
  isExperiencesLoading = false;
  deletingExperienceId = '';
  teacher?: Teacher | null;
  experiences: ExperienceSummary[] = [];
  dashboardError = '';

  async ngOnInit(): Promise<void> {
    await this.loadDashboardData();
  }

  async toggleDashboard(): Promise<void> {
    this.isDashboardOpen = !this.isDashboardOpen;

    if (this.isDashboardOpen) {
      await this.loadDashboardData();
    }
  }

  async refreshExperiences(): Promise<void> {
    await this.loadExperiences();
  }

  editExperience(experience: ExperienceSummary): void {
    this.router.navigate(['/configurazione'], {
      queryParams: { experienceId: experience.id }
    });
  }

  async deleteExperience(experience: ExperienceSummary): Promise<void> {
    const confirmed = window.confirm(`Eliminare l'esperienza "${experience.title}"?`);
    if (!confirmed) return;

    this.dashboardError = '';
    this.deletingExperienceId = experience.id;

    try {
      await this.experiencesService.deleteExperience(experience.id);
      this.experiences = this.experiences.filter((item) => item.id !== experience.id);
    } catch (err) {
      this.dashboardError = err instanceof Error ? err.message : 'Eliminazione esperienza fallita.';
    } finally {
      this.deletingExperienceId = '';
    }
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/docente/login']);
  }

  async upload() {
    this.isLoading = true;

    const glb = document.querySelector('#glb') as HTMLInputElement | null;

    if (!glb?.files?.[0]) {
      alert('Caricare il GLB.');
      this.isLoading = false;
      return;
    }

    try {
      await this.viewerSession.setFile(glb.files[0]);
      this.router.navigate(['/configurazione']);
    } catch (err) {
      console.error(err);
      alert('Upload al backend fallito.');
    } finally {
      this.isLoading = false;
    }


  }

  private async loadDashboardData(): Promise<void> {
    this.dashboardError = '';
    this.teacher = this.auth.getStoredTeacher();
    this.isTeacherLoading = true;

    try {
      this.teacher = await this.auth.me();
      await this.loadExperiences();
    } catch (err) {
      this.dashboardError = err instanceof Error ? err.message : 'Impossibile caricare il profilo docente.';
    } finally {
      this.isTeacherLoading = false;
    }
  }

  private async loadExperiences(): Promise<void> {
    this.isExperiencesLoading = true;

    try {
      this.experiences = await this.experiencesService.getMyExperiences();
    } catch (err) {
      this.experiences = [];
      this.dashboardError = err instanceof Error ? err.message : 'Impossibile caricare le esperienze.';
    } finally {
      this.isExperiencesLoading = false;
    }
  }
}
