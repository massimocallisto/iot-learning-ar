import { Routes } from '@angular/router';
import { ConfigurazioneComponent } from '../configurazione/configurazione.component';
import { ConfiguratoreComponent } from '../configuratore/configuratore.component';
import { DocenteLoginComponent } from '../docente-login/docente-login.component';
import { DocenteRegisterComponent } from '../docente-register/docente-register.component';
import { HomeComponent } from '../home/home.component';
import { VisualizzatoreComponent } from '../visualizzatore/visualizzatore.component';
import { VieweComponent } from '../viewe/viewe.component';
import { teacherAuthGuard } from '../service/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'docente/login', component: DocenteLoginComponent },
  { path: 'docente/registrazione', component: DocenteRegisterComponent },
  { path: 'configuratore', component: ConfiguratoreComponent, canActivate: [teacherAuthGuard] },
  { path: 'configurazione', component: ConfigurazioneComponent, canActivate: [teacherAuthGuard] },
  { path: 'visualizzatore', component: VisualizzatoreComponent },
  { path: 'viewe', component: VieweComponent }
];
