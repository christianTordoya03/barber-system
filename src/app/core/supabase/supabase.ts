import { Injectable, signal } from '@angular/core'; // <-- Asegúrate de importar signal
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public client: SupabaseClient;
  private barbershopIdCache: string | null = null;

  // NUEVO: Señal que guardará la marca dinámica del cliente actual
  public tenant = signal<{
    id: string;
    name: string;
    logo_url: string;
    color_tema: string;
    instagram_url?: string; // El signo de interrogación significa que es opcional
    facebook_url?: string;
    tiktok_url?: string;
  } | null>(null);

  constructor() {
    this.client = createClient(environment.supabaseUrl, environment.supabaseKey);
  }

  async obtenerBarbershopId(): Promise<string | null> {
    // 1. PRIMER FILTRO: Si estamos en el Wizard Web, usamos el ID cargado
    const tenantActual = this.tenant();
    if (tenantActual && tenantActual.id) {
      return tenantActual.id;
    }

    // 2. SEGUNDO FILTRO: Intentamos buscar sesión de Admin (Con Try/Catch antibalas)
    try {
      const { data: session } = await this.client.auth.getSession();
      if (session?.session?.user) {
        const { data: empleado } = await this.client
          .from('empleados')
          .select('barbershop_id')
          .eq('email', session.session.user.email)
          .maybeSingle();
        
        if (empleado?.barbershop_id) {
          return empleado.barbershop_id;
        }
      }
    } catch (e) {
      // Si el navegador lanza el error "NavigatorLockAcquireTimeoutError", lo atrapamos silenciosamente
      console.warn("Ignorando error de bloqueo del navegador", e);
    }

    // 3. PARACAÍDAS: Código neutral si no hay sesión ni tenant aún
    return '00000000-0000-0000-0000-000000000000';
  }

  // NUEVO: Descarga el logo y nombre de la barbería
  private async cargarDatosTenant(id: string) {
    if (this.tenant()) return;

    const { data } = await this.client
      .from('barbershops')
      // Solo agregamos "id, " al inicio del select
      .select('id, name, logo_url, color_tema')
      .eq('id', id)
      .single();

    if (data) {
      this.tenant.set(data);
    }
  }
}