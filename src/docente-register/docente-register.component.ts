import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, Teacher } from '../service/auth.service';

@Component({
  selector: 'app-docente-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './docente-register.component.html',
  styleUrl: './docente-register.component.css'
})
export class DocenteRegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  name = '';
  email = '';
  password = '';
  error = '';
  isLoading = false;
  teacher?: Teacher;
  showPassword = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async submit(): Promise<void> {
    this.error = '';
    this.teacher = undefined;
    this.isLoading = true;

    try {
      this.teacher = await this.auth.register(this.name, this.email, this.password);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Registrazione fallita.';
    } finally {
      this.isLoading = false;
    }
  }

  goToConfigurator(): void {
    this.router.navigate(['/configuratore']);
  }
}
