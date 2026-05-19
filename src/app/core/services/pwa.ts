import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  // Guardará el evento nativo del celular Android
  private promptEvent: any;
  
  // Señales reactivas para la interfaz
  public canInstall = signal<boolean>(false);
  public isIos = signal<boolean>(false);

  constructor() {
    this.detectarDispositivo();
    this.initPwaListener();
  }

  private detectarDispositivo() {
    // Verificamos si el cliente está usando un dispositivo de Apple
    const userAgent = window.navigator.userAgent.toLowerCase();
    const esApple = /iphone|ipad|ipod/.test(userAgent);
    this.isIos.set(esApple);
  }

  private initPwaListener() {
    // Solo Android y Chrome disparan este evento mágico
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault(); // Ocultamos el banner feo del navegador
      this.promptEvent = event; 
      this.canInstall.set(true); // Encendemos nuestro botón personalizado
    });
  }

  public async installApp() {
    if (!this.promptEvent) return;

    // Lanzamos el modal nativo de instalación
    this.promptEvent.prompt();

    // Esperamos la respuesta del cliente
    const choiceResult = await this.promptEvent.userChoice;
    
    if (choiceResult.outcome === 'accepted') {
      console.log('El cliente instaló la app con éxito');
      this.canInstall.set(false); // Ocultamos el botón
    }
    
    this.promptEvent = null;
  }
}