import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../service/auth.service';

@Component({
  selector: 'app-docente-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './docente-login.component.html',
  styleUrl: './docente-login.component.css'
})
export class DocenteLoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  password = '';
  error = '';
  isLoading = false;
  showPassword = false;

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async submit(): Promise<void> {
    this.error = '';
    this.isLoading = true;

    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/configuratore']);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Login fallito.';
    } finally {
      this.isLoading = false;
    }
  }
}
