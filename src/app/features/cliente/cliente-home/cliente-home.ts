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
  // 🔥 1. CAMBIO AQUÍ: Ahora es PUBLIC
  public supabase = inject(SupabaseService);

  nombreCliente = signal('Cargando...'); 
  
  spotlightVideos = signal<any[]>([]);
  videoActivo = signal<any>(null); 

  async ngOnInit() {
    await this.cargarDatosUsuario(); 
    await this.cargarSpotLightReal(); 
  }

  async cargarDatosUsuario() {
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      if (user) {
        let nombreUsuario = user.user_metadata?.['full_name'] || user.user_metadata?.['nombre'] || 'Socio VIP';
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

  private obtenerVideosEstaticos() {

    const logoTenant = this.supabase.tenant()?.logo_url || '/logo-icon.jpg';


    return [
      { id: 'est_1', barbero: 'Cambio Radical', mediaUrl: 'videos/bar1.mp4', posterUrl: logoTenant },
      { id: 'est_2', barbero: 'Colorimetría', mediaUrl: 'videos/bar2.mp4', posterUrl: logoTenant },
      { id: 'est_3', barbero: 'Fade Impecable', mediaUrl: 'videos/test2.mp4', posterUrl: logoTenant }
    ];
  }

  esVideo(url: string | undefined): boolean {
    if (!url) return false;
    return url.toLowerCase().match(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i) !== null;
  }

  async cargarSpotLightReal() {
    try {
      const tenantId = this.supabase.tenant()?.id;

      // 🔥 2. CAMBIO AQUÍ: Pedimos la info relacional y filtramos por barbería
      const { data: videosReales, error } = await this.supabase.client
        .from('portafolio') 
        .select('*, empleados(nombre)')
        .eq('barbershop_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(20); 

      let catalogoFinal: any[] = [];

      if (videosReales && videosReales.length > 0) {
        catalogoFinal = videosReales.map(v => {
          // Revisamos si el archivo es un video
          const isVid = this.esVideo(v.url_imagen);
          
          return {
            id: v.id,
            barbero: v.empleados?.nombre || 'Especialista',
            mediaUrl: v.url_imagen,
            // LA MAGIA: Si es video, usamos el logo dinámico de la barbería actual como portada. 
            // Si es foto, mostramos la foto normal.
            posterUrl: isVid ? (this.supabase.tenant()?.logo_url || '/logo-icon.jpg') : v.url_imagen 
          };
        });
      }
      if (catalogoFinal.length < 6) {
        const estaticos = this.obtenerVideosEstaticos();
        catalogoFinal = [...catalogoFinal, ...estaticos].slice(0, 6); 
      }

      this.spotlightVideos.set(catalogoFinal);

    } catch (error) {
      console.error("Error cargando spotlight:", error);
      this.spotlightVideos.set(this.obtenerVideosEstaticos());
    }
  }

  abrirVideo(item: any) {
    this.videoActivo.set(item);
    document.body.style.overflow = 'hidden'; 
  }

  cerrarVideo() {
    this.videoActivo.set(null);
    document.body.style.overflow = ''; 
  }
}