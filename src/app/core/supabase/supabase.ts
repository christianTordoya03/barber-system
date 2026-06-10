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
    if (this.barbershopIdCache) return this.barbershopIdCache;

    const { data: { session } } = await this.client.auth.getSession();
    if (!session?.user?.email) return null;

    // Buscamos si es empleado o cliente
    let bsId = null;
    const { data: emp } = await this.client.from('empleados').select('barbershop_id').eq('email', session.user.email).maybeSingle();

    if (emp?.barbershop_id) {
      bsId = emp.barbershop_id;
    } else {
      const { data: cli } = await this.client.from('clientes').select('barbershop_id').eq('email', session.user.email).maybeSingle();
      if (cli?.barbershop_id) bsId = cli.barbershop_id;
    }

    if (bsId) {
      this.barbershopIdCache = bsId;
      await this.cargarDatosTenant(bsId); // <-- Llamamos a la función que carga el logo
    }

    return this.barbershopIdCache;
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