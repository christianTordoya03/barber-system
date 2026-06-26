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
    const bsId = await this.supabase.obtenerBarbershopId(); // Obtenemos el ID de la barbería actual
    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('*')
      .eq('barbershop_id', bsId) // <-- Filtro maestro
      .order('id', { ascending: false });
      
    if (!error && data) {
      this.turnos.set(data as Turno[]);
    }
  }

  // --- CONSULTA CORREGIDA: Buscamos por el NOMBRE del barbero ---
  async obtenerHorasOcupadas(nombreBarbero: string, fechaISO: string): Promise<string[]> {
    const [year, month, day] = fechaISO.split('-');
    const fechaFiltro = `${day}/${month}/${year}`;
    const bsId = await this.supabase.obtenerBarbershopId();
    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('fecha')
      .eq('barbershop_id', bsId)
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
    // 1. Capturamos el ID de la barbería actual desde la señal global
    const bsId = this.supabase.tenant()?.id; 

    // 2. Le inyectamos el ID al objeto del turno
    const turnoParaGuardar = {
      ...turno,
      barbershop_id: bsId
    };

    // 3. Lo enviamos a Supabase con el dato completo
    const { data, error } = await this.supabase.client
      .from('turnos')
      .insert(turnoParaGuardar)
      .select()
      .single();

    if (error) {
      console.error('Error insertando turno', error);
      return null;
    }

    if (data) {
      // SOLUCIÓN ANTI-DUPLICADOS: Verificamos si el RealTime ya lo agregó
      this.turnos.update(ts => {
        const yaExiste = ts.some(t => t.id === data.id);
        if (yaExiste) {
          return ts; // Si ya está en la lista, no hacemos nada
        }
        return [data as Turno, ...ts]; // Si no está, lo agregamos
      });
      return data;
    }
  }

  async actualizarTurno(id: number, cambios: Partial<Turno>) {
    // 1. ACTUALIZACIÓN OPTIMISTA (La clave de la reactividad)
    // Esto cambia la información localmente al instante para que la pantalla no se quede congelada.
    this.turnos.update(turnosActuales => 
      turnosActuales.map(t => t.id === id ? { ...t, ...cambios } : t)
    );

    // 2. Ejecutar la actualización real en la base de datos de Supabase
    const { error } = await this.supabase.client
      .from('turnos')
      .update(cambios)
      .eq('id', id);

    if (error) {
      console.error('Error actualizando turno en Supabase:', error);
      // Si llega a fallar la red, recargamos los datos para evitar datos falsos en pantalla
      this.cargarTurnos(); 
    }
  }

  private escucharTurnosRealTime() {
    this.supabase.client
      .channel('turnos_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          this.turnos.update(t => {
            // Check if the record already exists
            const yaExiste = t.some(item => item.id === payload.new['id']);
            if (yaExiste) {
              return t; // If it exists, do not modify the array
            }
            // If it doesn't exist, add it
            return [payload.new as Turno, ...t];
          });
        } else if (payload.eventType === 'UPDATE') {
          this.turnos.update(t => t.map(item => (item.id === payload.new['id'] ? (payload.new as Turno) : item)));
        } else if (payload.eventType === 'DELETE') {
          this.turnos.update(t => t.filter(item => item.id !== payload.old['id']));
        }
      })
      .subscribe();
  }
}