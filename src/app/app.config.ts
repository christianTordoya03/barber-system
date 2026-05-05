import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // withViewTransitions() nos dará animaciones suaves nativas al cambiar de pantalla
    provideRouter(routes, withViewTransitions())
  ]
};