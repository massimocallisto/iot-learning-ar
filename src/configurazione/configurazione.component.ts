import {
  Component,
  ElementRef,
  ViewChild,
  OnDestroy,
  inject,
  AfterViewInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';

//test
import { ActivatedRoute, Router } from '@angular/router';

import { uploadConfigurazione as uploadConfigurazione } from '../script/main.js';
import { ThreeViewer } from '../script/viewer/ThreeViewer.js';
import { ExperienceService } from '../service/experience.service.js';
import { ViewerSessionService } from '../service/viewer-session.service.js';

@Component({
  selector: 'app-configurazione',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './configurazione.component.html',
  styleUrl: './configurazione.component.css'
})
export class ConfigurazioneComponent implements AfterViewInit, OnDestroy {
  //test
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

  private readonly viewerSession = inject(ViewerSessionService);
  private readonly experienceService = inject(ExperienceService);


  // questi vengono valorizzati quando il DOM dell'@else esiste
    private canvasEl?: HTMLCanvasElement;
    private hostEl?: HTMLDivElement;
    private id?: String;

  
  
   
    // ViewChild con setter: si attiva quando Angular crea/distrugge la view
    @ViewChild('threeCanvas')
    set threeCanvasRef(v: ElementRef<HTMLCanvasElement> | undefined) {
      this.canvasEl = v?.nativeElement;
      this.tryInitViewer();
    }
  
    @ViewChild('viewerHost')
    set viewerHostRef(v: ElementRef<HTMLDivElement> | undefined) {
      this.hostEl = v?.nativeElement;
      this.tryInitViewer();
    } 
  
    viewer?: ThreeViewer;
   
  
    showSetup = true;
    isLoading = false;
  
    // flag per capire quando l’utente ha premuto "upload"
    private shouldInitViewer = false;
  
    // input file salvati prima di cambiare schermata
    private glb?: any;
    private editingExperienceId = '';
    private editingConfigJson?: unknown;
    experienceTitle = '';
    experienceDescription = '';
    isSavingExperience = false;
    saveMessage = '';
    saveError = '';
    private readonly onExperienceSave = (event: Event) => {
      const configJson = (event as CustomEvent).detail?.configJson;
      void this.saveExperience(configJson);
    };

    async ngAfterViewInit(): Promise<void> {
      window.addEventListener('experience:save', this.onExperienceSave);
      this.editingExperienceId = this.route.snapshot.queryParamMap.get('experienceId') || '';
      this.id =  this.viewerSession.getId();
      //test
      if (this.editingExperienceId) {
        try {
          const [experience, glbResponse, configJson] = await Promise.all([
            this.experienceService.getExperience(this.editingExperienceId),
            this.experienceService.getExperienceGlb(this.editingExperienceId),
            this.experienceService.getExperienceJson(this.editingExperienceId)
          ]);

          this.experienceTitle = experience.title;
          this.experienceDescription = experience.description;
          this.glb = glbResponse;
          this.editingConfigJson = configJson;
          this.shouldInitViewer = true;
          this.tryInitViewer();
        } catch (err) {
          console.error(err);
          alert('Impossibile caricare esperienza da modificare.');
          this.router.navigate(['/configuratore']);
        }
      } else if(!this.id){
        this.router.navigate(['']);
      }else{
        this.glb = await this.viewerSession.getGlb(this.id);
        
        if(!this.glb){
          alert('Nessun file disponibile. Torn al configuratore.');
          return;
        }

        this.shouldInitViewer = true;
        this.tryInitViewer();
      } 


    }
  
  

  
    private async tryInitViewer() {
      if (!this.shouldInitViewer) return;
      if (!this.canvasEl || !this.hostEl) return;
      if (!this.glb) return;
      if (this.viewer) return;
     

  
      try {
        // Viewer creato solo quando canvas + host sono davvero disponibili.
        this.viewer = new ThreeViewer({
          canvas: this.canvasEl,
          container: this.hostEl
        });
  
        /* const glbInput = this.fileToInput(this.glbFile);
        const jsonInput = this.fileToInput(this.jsonFile); */
        
        // Pipeline completa: parse JSON, load GLB, crea controlli dinamici.
        await uploadConfigurazione(this.glb, this.viewer, this.editingConfigJson as any);


  
      } catch (err) {
        console.error(err);
      alert('Errore durante il caricamento del viewer.');
      this.viewer?.dispose();
      this.viewer = undefined;
      } 
    }
  

  
  
    ngOnDestroy(): void {
      window.removeEventListener('experience:save', this.onExperienceSave);
      this.viewer?.dispose();
    }


    private async saveExperience(configJson: unknown): Promise<void> {
      if (this.isSavingExperience) return;

      this.saveError = '';
      this.saveMessage = '';

      const title = this.experienceTitle.trim();
      if (!title) {
        this.saveError = 'Inserisci il titolo dell\'esperienza.';
        return;
      }

      const glbFile = this.viewerSession.getGlbFile();
      if (!this.editingExperienceId && !glbFile) {
        this.saveError = 'File GLB originale non disponibile. Torna al configuratore e ricarica il modello.';
        return;
      }

      if (!configJson) {
        this.saveError = 'Configurazione JSON non disponibile.';
        return;
      }

      this.isSavingExperience = true;

      try {
        if (this.editingExperienceId) {
          await this.experienceService.updateExperience(this.editingExperienceId, {
            title,
            description: this.experienceDescription.trim(),
            configJson
          });
        } else {
          const glbBase64 = await this.viewerSession.fileToBase64(glbFile as File);

          await this.experienceService.createExperience({
            title,
            description: this.experienceDescription.trim(),
            glbBase64,
            configJson
          });
        }

        this.saveMessage = this.editingExperienceId
          ? 'Esperienza aggiornata correttamente.'
          : 'Esperienza salvata correttamente.';

        if (this.id && !this.editingExperienceId) {
          await this.viewerSession.deleteUpload(this.id);
        }

        this.router.navigate(['/configuratore']);
      } catch (err) {
        this.saveError = err instanceof Error ? err.message : 'Salvataggio esperienza fallito.';
      } finally {
        this.isSavingExperience = false;
      }
    }
  




}
