import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions, withPreloading, PreloadAllModules } from '@angular/router'; // <-- Añadimos preloading aquí
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Agregamos el preloading a la configuración del router
    provideRouter(
      routes, 
      withViewTransitions(),
      withPreloading(PreloadAllModules) // <-- ESTA LÍNEA ES LA MAGIA
    )
  ]
};