import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { Empleado, TrabajoPortafolio } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private supabase = inject(SupabaseService);
  empleados = signal<Empleado[]>([]);

  constructor() {
    this.cargarEmpleados();
    this.escucharCambiosEnTiempoReal(); // <-- ¡NUEVO: Encendemos los oídos de Angular!
  }

  async cargarEmpleados() {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { data, error } = await this.supabase.client
      .from('empleados')
      .select('*')
      .eq('barbershop_id', bsId) // <-- Filtro maestro
      .order('id', { ascending: true });

    if (data) {
      const empleadosLista = data as Empleado[];

      // --- AUTO-RESET NOCTURNO (Limpiador Inteligente) ---
      const hoyStr = new Date().toDateString(); // Ej. "Wed May 06 2026"

      empleadosLista.forEach(emp => {
        // Si el barbero NO está en descanso, pero su última actividad fue ayer o antes...
        if (emp.rol === 'barbero' && emp.estado_asistencia !== 'descanso' && emp.ultima_vez_disponible) {
          const ultimaVezStr = new Date(emp.ultima_vez_disponible).toDateString();

          if (ultimaVezStr !== hoyStr) {
            // Lo forzamos a Descanso de forma automática en la Base de Datos
            this.actualizarEmpleado(emp.id, { estado_asistencia: 'descanso' });
          }
        }
      });

      this.empleados.set(empleadosLista);
    }
  }

  // --- NUEVA FUNCIÓN DE TIEMPO REAL ---
  escucharCambiosEnTiempoReal() {
    this.supabase.client.channel('cambios-empleados')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'empleados' },
        (payload) => {
          // Cada vez que Supabase detecte un cambio (como cuando un barbero se pone en Pausa),
          // recargamos la lista silenciosamente para actualizar todas las vistas.
          this.cargarEmpleados();
        }
      )
      .subscribe();
  }

  // --- LÓGICA DE EMPLEADOS / AVATAR ---
  async subirAvatar(file: File): Promise<string | null> {
    // Normalizamos la extensión garantizando que esté en minúsculas
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    // Declaramos de forma explícita el contentType para asegurar renderizado web nativo
    const { error } = await this.supabase.client.storage.from('avatars').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    });

    if (error) {
      console.error('Error subiendo imagen:', error);
      return null;
    }
    const { data } = this.supabase.client.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async agregarEmpleado(nuevoEmpleado: Empleado) {
    const bsId = await this.supabase.obtenerBarbershopId();
    
    // 1. Actualización optimista en la UI
    this.empleados.update(lista => [...lista, nuevoEmpleado]);
    
    // 2. Preparamos el payload
    const { id, ...empleadoParaBD } = nuevoEmpleado;
    const payload = { ...empleadoParaBD, barbershop_id: bsId };
    
    // 3. Petición a Supabase
    const { data, error } = await this.supabase.client
        .from('empleados')
        .insert(payload)
        .select()
        .single();

    // 4. Manejo del resultado
    if (error) {
        console.error("Fallo exacto en Supabase:", error); // AQUÍ VEREMOS LA VERDAD
        // Si tienes un toast service, úsalo aquí: 
        // this.toast.error(error.message);
        this.cargarEmpleados(); // Deshacemos el cambio visual
    } else if (data) {
        this.empleados.update(lista => lista.map(e => e.id === nuevoEmpleado.id ? (data as Empleado) : e));
    }
}

  async actualizarEmpleado(id: number, cambios: Partial<Empleado>) {
    this.empleados.update(lista => lista.map(e => e.id === id ? { ...e, ...cambios } : e));
    const { error } = await this.supabase.client.from('empleados').update(cambios).eq('id', id);
    if (error) this.cargarEmpleados();
  }

  // --- LÓGICA DEL PORTAFOLIO ---
  async obtenerPortafolio(empleadoId: number) {
    const { data } = await this.supabase.client
      .from('portafolio')
      .select('*, empleados(nombre)')
      .eq('empleado_id', empleadoId)
      .order('id', { ascending: false });
    return data || [];
  }

  async subirFotoPortafolio(file: File): Promise<string | null> {
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error } = await this.supabase.client.storage.from('portafolio').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    });

    if (error) {
      console.error('Error subiendo multimedia:', error);
      return null;
    }

    const { data } = this.supabase.client.storage.from('portafolio').getPublicUrl(fileName);
    return data.publicUrl;
  }

  async agregarTrabajoPortafolio(trabajo: Omit<TrabajoPortafolio, 'id'>) {
    const bsId = await this.supabase.obtenerBarbershopId();
    const payload = { ...trabajo, barbershop_id: bsId };
    const { data } = await this.supabase.client.from('portafolio').insert(payload).select().single();
    return data;
  }

  async eliminarTrabajoPortafolio(id: number, url: string) {
    // 1. Borrar de la base de datos (PostgreSQL)
    await this.supabase.client.from('portafolio').delete().eq('id', id);

    // 2. Limpiar el archivo físico del Bucket (Storage)
    const fileName = url.split('/').pop();
    if (fileName) {
      await this.supabase.client.storage.from('portafolio').remove([fileName]);
    }
  }
}