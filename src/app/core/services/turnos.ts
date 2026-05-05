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
  }

  // 1. LEER DE LA NUBE
  async cargarTurnos() {
    const { data, error } = await this.supabase.client
      .from('turnos')
      .select('*')
      .order('id', { ascending: false }); // Trae los últimos primero
    
    if (error) {
       console.error('Error cargando la base de datos', error);
       return;
    }
    if (data) this.turnos.set(data as Turno[]);
  }

  // 2. CREAR EN LA NUBE
  async agregarTurno(nuevoTurno: Turno) {
    // Optimistic UI: Lo mostramos al instante en pantalla con su ID temporal
    this.turnos.update(lista => [nuevoTurno, ...lista]);

    // Usamos magia de JavaScript para separar el "id" del resto de datos
    const { id, ...turnoParaBD } = nuevoTurno;

    const { data, error } = await this.supabase.client
      .from('turnos')
      .insert(turnoParaBD) // Enviamos todo MENOS el id temporal
      .select()
      .single();
    
    if (error) {
      this.toast.show('Error al guardar en la nube', 'error');
      this.cargarTurnos(); // Si falla el internet, recargamos la info real
    } else if (data) {
      // Reemplazamos el turno temporal con el turno real (que ya tiene el ID oficial de Supabase)
      this.turnos.update(lista => lista.map(t => t.id === nuevoTurno.id ? (data as Turno) : t));
    }
  }

  // 3. ACTUALIZAR EN LA NUBE (Cobrar, Anular, Editar)
  async actualizarTurno(id: number, cambios: Partial<Turno>) {
    // Optimistic UI: Actualizamos pantalla instantáneamente
    this.turnos.update(lista => 
      lista.map(turno => turno.id === id ? { ...turno, ...cambios } : turno)
    );

    // Mandamos el cambio a la nube
    const { error } = await this.supabase.client
      .from('turnos')
      .update(cambios)
      .eq('id', id);
    
    if (error) {
      this.toast.show('Error de sincronización con la nube', 'error');
      this.cargarTurnos(); // Si falla, recargamos
    }
  }
}