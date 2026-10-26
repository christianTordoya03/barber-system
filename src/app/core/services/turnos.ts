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
    
    // 1. EL ESCUDO DE DESPERTAR CON RETRASO
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          // Le damos 500ms a Supabase para que reconecte su antena 
          // antes de pedir los datos, evitando traer basura del caché.
          setTimeout(() => {
            this.cargarTurnos();
          }, 500);
        }
      });
    }
  }

  async cargarTurnos() {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('*')
      .eq('barbershop_id', bsId)
      .order('id', { ascending: false });
      
    if (!error && data) {
      // 2. DESTRUCCIÓN Y REEMPLAZO (Cero duplicados)
      // .set() borra la lista vieja y pone la nueva versión exacta de la BD.
      this.turnos.set(data as Turno[]);
    }
  }

  async obtenerHorasOcupadas(nombreBarbero: string, fechaISO: string): Promise<string[]> {
    const [year, month, day] = fechaISO.split('-');
    const fechaFiltro = `${day}/${month}/${year}`;
    const bsId = await this.supabase.obtenerBarbershopId();
    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('fecha')
      .eq('barbershop_id', bsId)
      .eq('barbero', nombreBarbero) 
      .like('fecha', `${fechaFiltro}%`) 
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

  // ==========================================
  // 3. MODO PESIMISTA ESTRICTO
  // ==========================================
  async agregarTurno(turno: Turno) {
    // 1. OBTENER LA FECHA EXACTA DE HOY
    const hoy = new Date();
    const dia = hoy.getDate().toString().padStart(2, '0');
    const mes = (hoy.getMonth() + 1).toString().padStart(2, '0');
    const anio = hoy.getFullYear();
    const fechaHoyExacta = `${dia}/${mes}/${anio}`;

    // 2. VERIFICAR SI EL TURNO ES PARA HOY (Respeta las citas programadas del futuro)
    const esTurnoParaHoy = turno.fecha.startsWith(fechaHoyExacta);

    // 3. CANDADO DE HORARIO (Bloquea de 10:00 PM a 5:59 AM solo si es para hoy)
    const horaActual = hoy.getHours();
    if (esTurnoParaHoy && (horaActual >= 22 || horaActual < 6)) {
      throw new Error('FUERA_DE_HORARIO'); 
    }

    // 4. DETECTOR DE MICRO-CORTES
    if (!navigator.onLine) throw new Error('OFFLINE'); 

    const bsId = this.supabase.tenant()?.id; 
    const turnoParaGuardar = { ...turno, barbershop_id: bsId };

    // 5. CRONÓMETRO DE 8 SEGUNDOS (Modo pesimista)
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000));
    const peticion = this.supabase.client.from('turnos').insert(turnoParaGuardar).select().single();

    // 6. COMPETENCIA ENTRE LA RED Y EL CRONÓMETRO
    const resultado: any = await Promise.race([peticion, timeout]);

    if (resultado && resultado.error) {
      console.error('Error insertando turno', resultado.error);
      throw resultado.error; 
    }

    if (resultado && resultado.data) {
      await this.cargarTurnos();
      return resultado.data;
    }
  }

  // ==========================================
  // MODO PESIMISTA: ACTUALIZAR TURNO
  // ==========================================
  async actualizarTurno(id: number, cambios: Partial<Turno>) {
    if (!navigator.onLine) throw new Error('OFFLINE'); // 1. Detector

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000));
    const peticion = this.supabase.client.from('turnos').update(cambios).eq('id', id);

    const resultado: any = await Promise.race([peticion, timeout]);

    if (resultado && resultado.error) {
      console.error('Error actualizando turno en Supabase:', resultado.error);
      throw resultado.error; 
    }

    await this.cargarTurnos();
  }

  // ==========================================
  // 4. MOTOR EN TIEMPO REAL LIMPIO
  // ==========================================
  private escucharTurnosRealTime() {
    this.supabase.client
      .channel('turnos_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, () => {
        // PROHIBIDO USAR PUSH O MAP AQUÍ.
        // Si otro dispositivo crea, edita o elimina un turno, simplemente
        // le decimos a esta pantalla que descargue la base de datos fresca.
        this.cargarTurnos();
      })
      .subscribe();
  }
}