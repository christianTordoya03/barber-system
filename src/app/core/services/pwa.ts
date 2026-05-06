// import { Injectable, signal } from '@angular/core';

// @Injectable({
//   providedIn: 'root'
// })
// export class PwaService {
//   // Guardará el evento nativo del celular
//   private promptEvent: any;
  
//   // Señal que le dirá al HTML si debe mostrar el botón o no
//   public canInstall = signal<boolean>(false);

//   constructor() {
//     this.initPwaListener();
//   }

//   private initPwaListener() {
//     // Aquí es donde "escuchamos" al celular (solo en Android/Chrome)
//     window.addEventListener('beforeinstallprompt', (event) => {
//       event.preventDefault(); // Evitamos que salga el mensaje feo por defecto de Google
//       this.promptEvent = event; // Guardamos la orden de instalación
//       this.canInstall.set(true); // ¡Encendemos el botón azul!
//     });
//   }

//   public async installApp() {
//     if (!this.promptEvent) return;

//     // Al hacer clic en tu botón, disparamos la instalación nativa
//     this.promptEvent.prompt();

//     // Esperamos a ver si el cliente le da a "Aceptar" o "Cancelar" en su pantalla
//     const choiceResult = await this.promptEvent.userChoice;
    
//     if (choiceResult.outcome === 'accepted') {
//       console.log('El cliente instaló la app con éxito');
//       this.canInstall.set(false); // Ocultamos el botón para que no vuelva a salir
//     }
    
//     this.promptEvent = null;
//   }
// }