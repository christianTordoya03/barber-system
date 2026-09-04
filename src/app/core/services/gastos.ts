import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { ToastService } from './toast';
import { Gasto } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class GastosService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  gastos = signal<Gasto[]>([]);

  constructor() {
    this.cargarGastos();
    this.escucharGastosRealTime();

    // --- ESCUDO 1: RECONEXIÓN AUTOMÁTICA AL DESPERTAR PANTALLA ---
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('App nuevamente visible: Recargando gastos de Supabase...');
          this.cargarGastos();
        }
      });
    }
  }

  async cargarGastos() {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { data } = await this.supabase.client.from('gastos').select('*').eq('barbershop_id', bsId).order('id', { ascending: false });
    
    if (data) {
      const lista = data as Gasto[];
      lista.sort((a, b) => {
        // 1. Los anulados siempre al puro final
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;

        // 2. Los liquidados justo arriba de los anulados (pero debajo de los activos)
        if (a.estado === 'liquidado' && b.estado === 'activo') return 1;
        if (a.estado === 'activo' && b.estado === 'liquidado') return -1;

        // 3. Por defecto, el más nuevo arriba
        return b.id - a.id;
      });
      this.gastos.set(lista);
    }
  }

  // --- EL MOTOR DE TIEMPO REAL ---
  private escucharGastosRealTime() {
    this.supabase.client
      .channel('cambios-en-gastos')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gastos' },
        () => {
          // Cuando el Admin guarda un gasto, esto recarga la pantalla del barbero en silencio
          this.cargarGastos();
        }
      )
      .subscribe();
  }

  // --- ESCUDO 2: MODO PESIMISTA (Base de datos primero, UI después) ---

  async agregarGasto(nuevoGasto: Gasto) {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { id, ...bd } = nuevoGasto;
    const payload = { ...bd, barbershop_id: bsId };
    
    // 1. PRIMERO LA VERDAD ABSOLUTA
    const { data, error } = await this.supabase.client.from('gastos').insert(payload).select().single();

    // 2. VERIFICACIÓN (Si falla, la UI nunca se entera ni se dibuja)
    if (error) {
      console.error('Fallo en Supabase al guardar gasto:', error);
      this.toast.show('Error de red al guardar el gasto. No se registró.', 'error');
      throw error; // Obliga al componente HTML a detener cualquier loader
    } 
    
    // 3. ACTUALIZACIÓN VISUAL (Solo si hubo éxito)
    if (data) {
      this.gastos.update(lista => [data as Gasto, ...lista]);
      this.toast.show('Gasto registrado con éxito', 'success');
    }
  }

  async actualizarGasto(id: number, cambios: Partial<Gasto>) {
    const { error } = await this.supabase.client.from('gastos').update(cambios).eq('id', id);
    
    if (error) {
      console.error('Fallo en Supabase al actualizar gasto:', error);
      this.toast.show('Error de red al actualizar. Intenta de nuevo.', 'error');
      throw error;
    }

    this.gastos.update(lista => lista.map(g => g.id === id ? { ...g, ...cambios } : g));
    this.toast.show('Gasto actualizado correctamente', 'success');
  }

  async anularGasto(id: number) {
    const { error } = await this.supabase.client.from('gastos').update({ estado: 'anulado' }).eq('id', id);
    
    if (error) {
      console.error('Fallo en Supabase al anular:', error);
      this.toast.show('Error de red al anular. Intenta de nuevo.', 'error');
      throw error;
    }

    this.gastos.update(lista => {
      const actualizada = lista.map(g => g.id === id ? { ...g, estado: 'anulado' as const } : g);
      return actualizada.sort((a, b) => {
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;
        if (a.estado === 'liquidado' && b.estado === 'activo') return 1;
        if (a.estado === 'activo' && b.estado === 'liquidado') return -1;
        return b.id - a.id;
      });
    });
    this.toast.show('Gasto anulado', 'success');
  }

  async liquidarGasto(id: number) {
    const { error } = await this.supabase.client.from('gastos').update({ estado: 'liquidado' }).eq('id', id);

    if (error) {
      console.error('Fallo en Supabase al liquidar:', error);
      this.toast.show('Error de red al liquidar adelanto. No se guardó.', 'error');
      throw error;
    } 

    this.gastos.update(lista => {
      const actualizada = lista.map(g => g.id === id ? { ...g, estado: 'liquidado' as const } : g);
      return actualizada.sort((a, b) => {
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;
        if (a.estado === 'liquidado' && b.estado === 'activo') return 1;
        if (a.estado === 'activo' && b.estado === 'liquidado') return -1;
        return b.id - a.id;
      });
    });
    this.toast.show('Adelanto marcado como liquidado', 'success');
  }

  async restaurarGasto(id: number) {
    const { error } = await this.supabase.client.from('gastos').update({ estado: 'activo' }).eq('id', id);
    
    if (error) {
      console.error('Fallo en Supabase al restaurar:', error);
      this.toast.show('Error de red al restaurar. Intenta de nuevo.', 'error');
      throw error;
    }

    this.gastos.update(lista => {
      const actualizada = lista.map(g => g.id === id ? { ...g, estado: 'activo' as const } : g);
      return actualizada.sort((a, b) => {
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;
        if (a.estado === 'liquidado' && b.estado === 'activo') return 1;
        if (a.estado === 'activo' && b.estado === 'liquidado') return -1;
        return b.id - a.id;
      });
    });
    this.toast.show('Gasto restaurado a estado activo', 'success');
  }
}