import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { Empleado } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private supabase = inject(SupabaseService);
  empleados = signal<Empleado[]>([]);

  constructor() { this.cargarEmpleados(); }

  async cargarEmpleados() {
    const { data, error } = await this.supabase.client.from('empleados').select('*').order('id', { ascending: true });
    if (data) this.empleados.set(data as Empleado[]);
  }

  // --- NUEVA FUNCIÓN PARA SUBIR FOTOS ---
  async subirAvatar(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error } = await this.supabase.client.storage.from('avatars').upload(fileName, file);
    if (error) {
      console.error('Error subiendo imagen:', error);
      return null;
    }

    const { data } = this.supabase.client.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async agregarEmpleado(nuevoEmpleado: Empleado) {
    this.empleados.update(lista => [...lista, nuevoEmpleado]);
    const { id, ...empleadoParaBD } = nuevoEmpleado;
    const { data, error } = await this.supabase.client.from('empleados').insert(empleadoParaBD).select().single();
    if (error) this.cargarEmpleados(); 
    else if (data) this.empleados.update(lista => lista.map(e => e.id === nuevoEmpleado.id ? (data as Empleado) : e));
  }

  async actualizarEmpleado(id: number, cambios: Partial<Empleado>) {
    this.empleados.update(lista => lista.map(e => e.id === id ? { ...e, ...cambios } : e));
    const { error } = await this.supabase.client.from('empleados').update(cambios).eq('id', id);
    if (error) this.cargarEmpleados();
  }
}