import { ApplicationConfig, LOCALE_ID, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions, withPreloading, PreloadAllModules } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async'; // <-- Habilita modales fluidos
import { routes } from './app.routes';

// Importamos y registramos los datos del español de Perú
import localeEsPe from '@angular/common/locales/es-PE';
import { registerLocaleData } from '@angular/common';

registerLocaleData(localeEsPe, 'es-PE');

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes, 
      withViewTransitions(), 
      withPreloading(PreloadAllModules)
    ),
    provideAnimationsAsync(), // <-- Proveedor fundamental para la UI
    { provide: LOCALE_ID, useValue: 'es-PE' } // <-- Estandariza fechas a español
  ]
};