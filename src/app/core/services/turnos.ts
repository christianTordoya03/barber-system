import { inject, Injectable, signal } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { Turno } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class TurnosService {
  private supabase = inject(SupabaseService);
  turnos = signal<Turno[]>([]);

  constructor() {
    this.cargarTurnos();
    this.escucharTurnosRealTime();
  }

  async cargarTurnos() {
    const { data, error } = await this.supabase.client.from('turnos').select('*').order('id', { ascending: false });
    if (!error && data) {
      this.turnos.set(data as Turno[]);
    }
  }

  // --- CONSULTA CORREGIDA: Buscamos por el NOMBRE del barbero ---
  async obtenerHorasOcupadas(nombreBarbero: string, fechaISO: string): Promise<string[]> {
    const [year, month, day] = fechaISO.split('-');
    const fechaFiltro = `${day}/${month}/${year}`;

    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('fecha')
      .eq('barbero', nombreBarbero) // <-- Filtramos por texto, no por ID
      .like('fecha', `${fechaFiltro}%`) // <-- Compatibilidad absoluta
      .neq('estado', 'annulled'); 

    if (error || !data) {
      console.error('Error consultando disponibilidad:', error);
      return [];
    }
    
    return data.map(t => {
      const partes = t.fecha.split(',');
      if (partes.length > 1) {
        return partes[1].trim().substring(0, 5);
      }
      return '';
    }).filter(h => h !== '');
  }

  async agregarTurno(turno: Turno) {
    const { data, error } = await this.supabase.client.from('turnos').insert(turno).select().single();
    if (error) {
      console.error('Error insertando turno:', error);
      return null;
    }
    return data;
  }

  async actualizarTurno(id: number, cambios: Partial<Turno>) {
    const { error } = await this.supabase.client.from('turnos').update(cambios).eq('id', id);
    if (error) console.error('Error actualizando turno:', error);
  }

  private escucharTurnosRealTime() {
    this.supabase.client
      .channel('turnos_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          this.turnos.update(t => [payload.new as Turno, ...t]);
        } else if (payload.eventType === 'UPDATE') {
          this.turnos.update(t => t.map(item => (item.id === payload.new['id'] ? (payload.new as Turno) : item)));
        } else if (payload.eventType === 'DELETE') {
          this.turnos.update(t => t.filter(item => item.id !== payload.old['id']));
        }
      })
      .subscribe();
  }
}