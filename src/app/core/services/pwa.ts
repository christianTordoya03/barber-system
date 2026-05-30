import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private promptEvent: any;
  
  public canInstall = signal<boolean>(false);
  public isIos = signal<boolean>(false);

  constructor() {
    // Escudo: Verificamos que estamos en el navegador para evitar errores de consola
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      this.detectarDispositivo();
      this.initPwaListener();
    }
  }

  private detectarDispositivo() {
    const userAgent = window.navigator.userAgent.toLowerCase();
    // Mejora: Detecta iPhones, iPods, y iPads (incluso los nuevos que se hacen pasar por Mac)
    const esApple = /iphone|ipad|ipod/.test(userAgent) || (userAgent.includes('mac') && 'ontouchend' in document);
    this.isIos.set(esApple);
  }

  private initPwaListener() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault(); 
      this.promptEvent = event; 
      this.canInstall.set(true); // ¡Esto enciende tu botón azul!
    });
  }

  public async installApp() {
    if (!this.promptEvent) return;

    this.promptEvent.prompt();
    const choiceResult = await this.promptEvent.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      console.log('App instalada con éxito');
      this.canInstall.set(false);
    }
    
    this.promptEvent = null;
  }
}