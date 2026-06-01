import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  public client: SupabaseClient;
  private barbershopIdCache: string | null = null; // Guardamos el ID en memoria

  constructor() {
    this.client = createClient(
      environment.supabaseUrl,
      environment.supabaseKey
    );
  }

  // NUEVA FUNCIÓN: Obtiene el ID de la barbería del usuario logueado
  async obtenerBarbershopId(): Promise<string | null> {
    if (this.barbershopIdCache) return this.barbershopIdCache;

    const { data: { session } } = await this.client.auth.getSession();
    if (!session?.user?.email) return null;

    const { data } = await this.client
      .from('empleados')
      .select('barbershop_id')
      .eq('email', session.user.email)
      .maybeSingle();

    if (data?.barbershop_id) {
      this.barbershopIdCache = data.barbershop_id;
    }
    
    return this.barbershopIdCache;
  }
}