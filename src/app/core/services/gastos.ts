import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { ToastService } from './toast';
import { Gasto } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class GastosService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  gastos = signal<Gasto[]>([]);

  constructor() { this.cargarGastos(); }

  async cargarGastos() {
    const { data } = await this.supabase.client.from('gastos').select('*').order('id', { ascending: false });
    if (data) {
      const lista = data as Gasto[];
      lista.sort((a, b) => {
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;
        return b.id - a.id;
      });
      this.gastos.set(lista);
    }
  }

  async agregarGasto(nuevoGasto: Gasto) {
    this.gastos.update(lista => [nuevoGasto, ...lista]); 
    const { id, ...bd } = nuevoGasto;
    const { data, error } = await this.supabase.client.from('gastos').insert(bd).select().single();
    
    if (error) {
      this.toast.show('Error al guardar el gasto', 'error');
      this.cargarGastos(); 
    } else if (data) {
      this.gastos.update(lista => lista.map(g => g.id === nuevoGasto.id ? (data as Gasto) : g));
    }
  }

  // NUEVO: Función para actualizar todos los campos de un gasto
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