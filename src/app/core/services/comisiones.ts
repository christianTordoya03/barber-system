import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { Comision } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class ComisionesService {
  private supabase = inject(SupabaseService);
  comisiones = signal<Comision[]>([]);

  constructor() {
    this.cargarTodas();
    this.escucharComisionesRealTime();
  }

  async cargarTodas() {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { data, error } = await this.supabase.client
      .from('comisiones')
      .select('*, empleados(nombre)')
      .eq('barbershop_id', bsId)
      .order('id', { ascending: false });

    if (!error && data) {
      const lista = (data as Comision[]).sort((a, b) => {
        if (a.estado === 'anulado' && b.estado !== 'anulado') return 1;
        if (a.estado !== 'anulado' && b.estado === 'anulado') return -1;
        return b.id - a.id;
      });
      this.comisiones.set(lista);
    }
  }

  async agregarComision(comision: Omit<Comision, 'id' | 'created_at'>) {
    const bsId = await this.supabase.obtenerBarbershopId();
    const payload = {
      empleado_id: Number(comision.empleado_id),
      tipo: comision.tipo,
      monto: Number(comision.monto),
      descripcion: comision.descripcion || null,
      fecha: comision.fecha,
      estado: 'activo',
      barbershop_id: bsId
    };

    const { data, error } = await this.supabase.client.from('comisiones').insert(payload).select().single();

    if (!error) {
      await this.cargarTodas();
      return data || true; // Retorno seguro en caso de restricciones RLS de lectura
    }
    console.error('Error Supabase al insertar comisión:', error);
    return null;
  }

  async actualizarComision(id: number, cambios: Partial<Comision>) {
    const { error } = await this.supabase.client
      .from('comisiones')
      .update(cambios)
      .eq('id', id);

    if (!error) await this.cargarTodas();
    return !error;
  }

  async anularComision(id: number) {
    const { error } = await this.supabase.client
      .from('comisiones')
      .update({ estado: 'anulado' })
      .eq('id', id);

    if (!error) await this.cargarTodas();
    return !error;
  }

  async restaurarComision(id: number) {
    const { error } = await this.supabase.client
      .from('comisiones')
      .update({ estado: 'activo' })
      .eq('id', id);

    if (!error) await this.cargarTodas();
    return !error;
  }

  private escucharComisionesRealTime() {
    this.supabase.client
      .channel('comisiones_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comisiones' }, () => {
        this.cargarTodas();
      })
      .subscribe();
  }
}