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
    this.escucharGastosRealTime(); // <-- 1. ACTIVAMOS LA ESCUCHA AQUÍ
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

  // --- 2. EL MOTOR DE TIEMPO REAL ---
  private escucharGastosRealTime() {
    this.supabase.client
      .channel('cambios-en-gastos')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'gastos' },
        () => {
          // Cuando el Admin guarda un gasto, esta línea recarga la pantalla del barbero en silencio
          this.cargarGastos();
        }
      )
      .subscribe();
  }

  async agregarGasto(nuevoGasto: Gasto) {
    const bsId = await this.supabase.obtenerBarbershopId();
    this.gastos.update(lista => [nuevoGasto, ...lista]);
    const { id, ...bd } = nuevoGasto;
    const payload = { ...bd, barbershop_id: bsId };
    const { data, error } = await this.supabase.client.from('gastos').insert(payload).select().single();

    if (error) {
      this.toast.show('Error al guardar el gasto', 'error');
      this.cargarGastos();
    } else if (data) {
      this.gastos.update(lista => lista.map(g => g.id === nuevoGasto.id ? (data as Gasto) : g));
    }
  }

  async actualizarGasto(id: number, cambios: Partial<Gasto>) {
    this.gastos.update(lista => lista.map(g => g.id === id ? { ...g, ...cambios } : g));
    const { error } = await this.supabase.client.from('gastos').update(cambios).eq('id', id);
    if (error) {
      this.toast.show('Error al actualizar el gasto', 'error');
      this.cargarGastos();
    }
  }

  async anularGasto(id: number) {
    this.gastos.update(lista => {
      const actualizada = lista.map(g => g.id === id ? { ...g, estado: 'anulado' as const } : g);
      return actualizada.sort((a, b) => {
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;
        return b.id - a.id;
      });
    });
    const { error } = await this.supabase.client.from('gastos').update({ estado: 'anulado' }).eq('id', id);
    if (error) {
      this.toast.show('Error al anular', 'error');
      this.cargarGastos();
    }
  }

  async liquidarGasto(id: number) {
    // 1. Actualización optimista en la UI
    this.gastos.update(lista => lista.map(g => g.id === id ? { ...g, estado: 'liquidado' as const } : g));

    // 2. Persistencia en Supabase
    const { error } = await this.supabase.client
      .from('gastos')
      .update({ estado: 'liquidado' })
      .eq('id', id);

    if (error) {
      this.toast.show('Error al liquidar adelanto', 'error');
      this.cargarGastos();
    } else {
      this.toast.show('Adelanto marcado como liquidado');
    }
  }

  async restaurarGasto(id: number) {
    this.gastos.update(lista => {
      const actualizada = lista.map(g => g.id === id ? { ...g, estado: 'activo' as const } : g);
      return actualizada.sort((a, b) => {
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;
        return b.id - a.id;
      });
    });
    const { error } = await this.supabase.client.from('gastos').update({ estado: 'activo' }).eq('id', id);
    if (error) {
      this.toast.show('Error al restaurar', 'error');
      this.cargarGastos();
    }
  }
}