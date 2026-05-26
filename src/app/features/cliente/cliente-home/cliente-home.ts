import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase'; 

@Component({
  selector: 'app-cliente-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cliente-home.html',
})
export class ClienteHomeComponent implements OnInit {
  private supabase = inject(SupabaseService);

  nombreCliente = signal('Cargando...'); 
  
  // Spotlight
  spotlightVideos = signal<any[]>([]);
  videoActivo = signal<any>(null); // Guardará todo el objeto del video

  promociones = signal([
    { id: 1, titulo: 'Combo Premium', descripcion: '15% de descuento en Corte + Limpieza Facial', descuento: '-15%' },
    { id: 2, titulo: 'Programa de Referidos', descripcion: 'Trae 3 amigos y gana un servicio de barba o cejas gratis', descuento: 'Gratis' }
  ]);

  async ngOnInit() {
    await this.cargarDatosUsuario(); 
    await this.cargarSpotLightReal(); 
  }

  async cargarDatosUsuario() {
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      if (user) {
        let nombreUsuario = user.user_metadata?.['full_name'] || user.user_metadata?.['nombre'] || 'Socio VIP';
        
        // Buscar el nombre real en la tabla clientes por si lo actualizó
        const { data: clienteData } = await this.supabase.client
          .from('clientes')
          .select('nombre')
          .eq('email', user.email)
          .maybeSingle();

        if (clienteData?.nombre) {
          nombreUsuario = clienteData.nombre;
        }
        
        this.nombreCliente.set(nombreUsuario);
      } else {
        this.nombreCliente.set('Socio VIP');
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      this.nombreCliente.set('Socio VIP');
    }
  }

  // --- 1. VIDEOS PREMIUM DE RESPALDO (ESTÁTICOS) ---
  // Nota: Las imágenes 'poster1.jpg', etc., deben existir en tu carpeta public/videos/ o usar una por defecto.
  private obtenerVideosEstaticos() {
    return [
      { id: 'est_1', barbero: 'Cambio Radical', mediaUrl: 'videos/REEL 17 CAMBIO RADICAL.mp4', posterUrl: 'logo-marina305.png' },
      { id: 'est_2', barbero: 'Colorimetría', mediaUrl: 'videos/REEL 18 coloraciòn uniforme corregido.mp4', posterUrl: 'logo-marina305.png' },
      { id: 'est_3', barbero: 'Fade Impecable', mediaUrl: 'videos/REEL 25 FADE.mp4', posterUrl: 'logo-marina305.png' },
      { id: 'est_4', barbero: 'Resultados HD', mediaUrl: 'videos/REEL 29 RESULTADOS.mp4', posterUrl: 'logo-marina305.png' },
      { id: 'est_5', barbero: 'Taper Fade', mediaUrl: 'videos/REEL O HISTORIA 19 CORTE.mp4', posterUrl: 'logo-marina305.png' },
      { id: 'est_6', barbero: 'Diseño Freestyle', mediaUrl: 'videos/VIDEO HISTORIA NUEVO.mp4', posterUrl: 'logo-marina305.png' },
    ];
  }

  // --- 2. CARGA HÍBRIDA (REAL + ESTÁTICOS) ---
  async cargarSpotLightReal() {
    try {
      // Intentamos traer lo de la base de datos (Supabase)
      const { data: videosReales, error } = await this.supabase.client
        .from('portafolio') 
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20); 

      let catalogoFinal: any[] = [];

      // Si hay videos reales, los priorizamos
      if (videosReales && videosReales.length > 0) {
        catalogoFinal = [...videosReales];
      }

      // Fusión: Si hay menos de 6, rellenamos con los tuyos para que no se vea vacío
      if (catalogoFinal.length < 6) {
        const estaticos = this.obtenerVideosEstaticos();
        catalogoFinal = [...catalogoFinal, ...estaticos].slice(0, 6); 
      }

      this.spotlightVideos.set(catalogoFinal);

    } catch (error) {
      console.error("Error cargando spotlight:", error);
      // Si falla el internet o la base de datos, siempre carga tu catálogo estático
      this.spotlightVideos.set(this.obtenerVideosEstaticos());
    }
  }

  // --- 3. FUNCIONES DEL MODAL DE VIDEO (TIKTOK STYLE) ---
  abrirVideo(item: any) {
    this.videoActivo.set(item);
    document.body.style.overflow = 'hidden'; // Bloquea el scroll del fondo
  }

  cerrarVideo() {
    this.videoActivo.set(null);
    document.body.style.overflow = ''; // Libera el scroll del fondo
  }
}