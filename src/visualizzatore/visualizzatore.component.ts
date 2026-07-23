import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ExperienceService,
  ExperienceSummary,
  PublicTeacherExperiences
} from '../service/experience.service.js';

@Component({
  selector: 'app-visualizzatore',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './visualizzatore.component.html',
  styleUrl: './visualizzatore.component.css',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class VisualizzatoreComponent implements OnInit {
  title = 'visualizzatore';
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly experienceService = inject(ExperienceService);

  code = '';
  isLoading = false;
  error = '';
  result?: PublicTeacherExperiences;

  async ngOnInit(): Promise<void> {
    const teacherCode = this.route.snapshot.queryParamMap.get('teacherCode') || '';
    if (!teacherCode) return;

    this.code = teacherCode;
    await this.searchExperiences();
  }

  async searchExperiences(): Promise<void> {
    const code = this.code.trim();
    this.error = '';
    this.result = undefined;

    if (!code) {
      this.error = 'Inserisci il codice docente.';
      return;
    }

    this.isLoading = true;

    try {
      this.result = await this.experienceService.getPublicExperiencesByTeacherCode(code);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Impossibile trovare le esperienze.';
    } finally {
      this.isLoading = false;
    }
  }

  openExperience(experience: ExperienceSummary): void {
    this.router.navigate(['/viewe'], {
      queryParams: {
        experienceId: experience.id,
        teacherCode: this.result?.teacher.accessCode || this.code.trim()
      }
    });
  }
}
