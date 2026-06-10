import { Component, inject, effect, OnInit } from '@angular/core';
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
export class App implements OnInit {
  private supabase = inject(SupabaseService);
  private titleService = inject(Title);
  private document = inject(DOCUMENT);

  constructor() {
    // Esto ya lo teníamos: Cambia el título y el ícono de la pestaña mágicamente
    effect(() => {
      const tenant = this.supabase.tenant();
      
      if (tenant) {
        this.titleService.setTitle(`${tenant.name}`);
        const favicon = this.document.getElementById('app-favicon') as HTMLLinkElement;
        if (favicon) favicon.href = tenant.logo_url;
        const appleIcon = this.document.getElementById('apple-icon') as HTMLLinkElement;
        if (appleIcon) appleIcon.href = tenant.logo_url;
      }
    });
  }

  // 🔥 NUEVO: Carga la barbería desde la raíz de la app
  async ngOnInit() {
    if (!this.supabase.tenant()) {
      const hostActual = window.location.hostname;
      
      let query = this.supabase.client
        .from('barbershops')
        .select('id, name, logo_url, color_tema, instagram_url, facebook_url, tiktok_url');

      // EL ESCUDO PROTECTOR (Ahora vive a nivel global)
      if (hostActual === 'localhost' || hostActual === '127.0.0.1') {
        query = query.eq('id', '7d790667-8d0b-4c1d-835f-3fd39abc20bd'); 
      } else if (hostActual === 'aureum.localhost') {
        query = query.eq('dominio', hostActual); 
      } else {
        query = query.eq('id', '7d790667-8d0b-4c1d-835f-3fd39abc20bd'); 
      }
        
      const { data, error } = await query.single();
      
      if (data) {
        this.supabase.tenant.set(data);
      }
    }
  }
}