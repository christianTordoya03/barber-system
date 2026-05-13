import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { ToastService } from './toast';
import { Turno } from '../models/marina';

@Injectable({
  providedIn: 'root'
})
export class TurnosService {
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  turnos = signal<Turno[]>([]);

  constructor() {
    this.cargarTurnos();
    this.escucharTurnosRealTime(); // <-- ¡NUEVA LÍNEA MÁGICA!
  }

  async cargarTurnos() {
    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error cargando turnos', error);
      return;
    }
    if (data) this.turnos.set(data as Turno[]);
  }

  // Devuelve un array de strings con las horas ya reservadas, ej: ['15:30', '16:00']
  async obtenerHorasOcupadas(barberoId: number, fecha: string): Promise<string[]> {
    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('horaInicio')
      // Usamos la propiedad reglamentaria 'barbero_id' de tu modelo Turno
      .eq('barbero_id', barberoId) 
      .eq('fecha', fecha)
      // Excluimos los turnos anulados para liberar esa hora si se canceló
      .neq('estado', 'annulled'); 

    if (error || !data) {
      console.error('Error consultando disponibilidad:', error);
      return [];
    }
    
    // Devolvemos un listado limpio de horas ocupadas, ej: ['15:30', '16:00']
    return data.map(t => t.horaInicio).filter((h): h is string => !!h);
  }

  // --- ESCUCHA EN TIEMPO REAL ---
  private escucharTurnosRealTime() {
    this.supabase.client
      .channel('cambios-en-turnos') // Nombre del canal
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        (payload) => {
          // Si hay un cambio, recargamos la lista automáticamente
          this.cargarTurnos();

          // Opcional: Mostrar un aviso si es un corte nuevo
          if (payload.eventType === 'INSERT') {
            // Esto se disparará en el celular del barbero
          }
        }
      )
      .subscribe();
  }

  async agregarTurno(nuevoTurno: Turno) {
    const { id, ...turnoParaBD } = nuevoTurno;
    const { data, error } = await this.supabase.client
      .from('turnos')
      .insert(turnoParaBD)
      .select()
      .single();

    if (error) {
      this.toast.show('Error al guardar en la nube', 'error');
    }
    // No necesitamos actualizar el signal manualmente porque el Real-time lo hará por nosotros
  }

  async actualizarTurno(id: number, cambios: Partial<Turno>) {
    const { error } = await this.supabase.client
      .from('turnos')
      .update(cambios)
      .eq('id', id);

    if (error) {
      this.toast.show('Error de sincronización', 'error');
    }
    // El Real-time se encarga de refrescar la pantalla de todos
  }
}