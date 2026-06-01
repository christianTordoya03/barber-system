import { Component, inject, effect } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { SupabaseService } from './core/supabase/supabase';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class App {
  private supabase = inject(SupabaseService);
  private titleService = inject(Title); // Herramienta de Angular para cambiar el <title>
  private document = inject(DOCUMENT);  // Herramienta de Angular para modificar el HTML

  constructor() {
    // El 'effect' es un vigilante. Cada vez que la señal tenant() cambie, esto se ejecuta.
    effect(() => {
      const tenant = this.supabase.tenant();
      
      if (tenant) {
        // 1. Cambiamos el texto de la pestaña del navegador
        this.titleService.setTitle(`${tenant.name}`);

        // 2. Cambiamos el icono de la pestaña (Favicon)
        const favicon = this.document.getElementById('app-favicon') as HTMLLinkElement;
        if (favicon) {
          favicon.href = tenant.logo_url;
        }

        // 3. Cambiamos el icono de Apple (para cuando lo instalan en iPhone)
        const appleIcon = this.document.getElementById('apple-icon') as HTMLLinkElement;
        if (appleIcon) {
          appleIcon.href = tenant.logo_url;
        }
      }
    });
  }
}