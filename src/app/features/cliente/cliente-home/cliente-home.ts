import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase'; // <-- Importamos Supabase

@Component({
  selector: 'app-cliente-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cliente-home.html',
})
export class ClienteHomeComponent implements OnInit {
  private supabase = inject(SupabaseService);

  // Señales reactivas
  nombreCliente = signal('Cargando...'); // Inicialmente muestra esto
  nivelActual = signal('Clásico'); // Luego lo podemos conectar también
  
  spotlightVideos = signal<any[]>([]);
  videoActivo = signal<string | null>(null);

  promociones = signal([
    { id: 1, titulo: 'Mes del Trabajador', descripcion: '15% de descuento en Corte + Facial', descuento: '-15%' },
    { id: 2, titulo: 'Referidos VIP', descripcion: 'Trae 3 amigos y gana un marcado gratis', descuento: 'Gratis' }
  ]);

  async ngOnInit() {
    await this.cargarDatosUsuario(); // 1. Carga tu nombre real
    this.cargarSpotlightReal();      // 2. Carga las fotos de los barberos
  }

  // --- CONEXIÓN A SUPABASE PARA LEER EL USUARIO ---
  async cargarDatosUsuario() {
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      if (user) {
        // Lee el nombre desde la metadata de Google o el registro
        const nombre = user.user_metadata?.['full_name'] || user.user_metadata?.['nombre'] || 'Socio VIP';
        this.nombreCliente.set(nombre);

        // Opcional: Podrías consultar la tabla "turnos" aquí también para saber su nivel,
        // igual que lo hicimos en el Perfil.
      } else {
        this.nombreCliente.set('Socio VIP');
      }
    } catch (error) {
      console.error('Error cargando usuario:', error);
      this.nombreCliente.set('Socio VIP');
    }
  }

  // --- CARGA DEL PORTAFOLIO DESDE SUPABASE ---
  async cargarSpotlightReal() {
    const { data, error } = await this.supabase.client
      .from('portafolio') 
      .select('id, url_imagen, fecha, empleados(nombre)') 
      .not('url_imagen', 'is', null) 
      .not('url_imagen', 'eq', '')   
      .limit(6);

    if (!error && data) {
      const trabajosTransformados = data.map((item: any) => ({
        id: item.id,
        barbero: item.empleados?.nombre || 'Marina 305',
        estilo: item.fecha ? `Corte del ${item.fecha}` : 'Estilo Premium',
        mediaUrl: item.url_imagen 
      }));
      this.spotlightVideos.set(trabajosTransformados);
    } else if (error) {
      console.error('Error cargando portafolio:', error);
    }
  }

  // --- FUNCIONES DEL MODAL DE VIDEO/FOTO ---
  abrirVideo(url: string) {
    this.videoActivo.set(url);
    document.body.style.overflow = 'hidden';
  }

  cerrarVideo() {
    this.videoActivo.set(null);
    document.body.style.overflow = '';
  }

  isVideo(url: string): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('.mp4') || lowerUrl.includes('.webm') || lowerUrl.includes('.ogg');
  }
}