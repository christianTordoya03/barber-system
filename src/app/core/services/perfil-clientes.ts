import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { PerfilCliente } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class PerfilClienteService {
  private supabase = inject(SupabaseService);
  
  // Señal que guardará los datos de fidelización del usuario logueado
  perfilActual = signal<PerfilCliente | null>(null);

  async cargarPerfil() {
    // 1. Obtenemos la sesión de Auth
    const { data: { session } } = await this.supabase.client.auth.getSession();
    if (!session?.user?.email) return;

    const email = session.user.email;
    const nombre = session.user.user_metadata?.['nombre'] || 'Socio VIP';

    // 2. Buscamos su perfil de gamificación
    const { data, error } = await this.supabase.client
      .from('perfil_clientes')
      .select('*')
      .eq('email', email)
      .single();

    if (data) {
      this.perfilActual.set(data as PerfilCliente);
    } else {
      // 3. Si no existe, le creamos uno nuevo con 10 puntos de regalo
      const nuevoPerfil = {
        user_id: session.user.id,
        email: email,
        nombre: nombre,
        puntos: 10,
        cortes_totales: 0,
        nivel: 'Classic'
      };
      
      const { data: createdData } = await this.supabase.client
        .from('perfil_clientes')
        .insert(nuevoPerfil)
        .select()
        .single();
        
      if (createdData) {
        this.perfilActual.set(createdData as PerfilCliente);
      }
    }
  }
}