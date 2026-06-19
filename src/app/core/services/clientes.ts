import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { Cliente } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private supabase = inject(SupabaseService);

  // Señal reactiva para mantener la lista de clientes disponible en la app
  clientes = signal<Cliente[]>([]);

  constructor() {
    this.cargarClientes();
  }

  async cargarClientes() {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { data, error } = await this.supabase.client
      .from('clientes')
      .select('*')
      .eq('barbershop_id', bsId)
      .order('id', { ascending: false });

    if (data) {
      this.clientes.set(data as Cliente[]);
    }
  }

  async upsertClienteExpress(nombreIngresado: string, whatsapp: string, fechaNacimiento: string) {
    if (!whatsapp || whatsapp.trim() === '') return null; // Prevención de búsquedas en blanco

    const { data: existente } = await this.supabase.client
      .from('clientes')
      .select('*')
      .eq('telefono', whatsapp.trim())
      .maybeSingle();

    // 1. Limpiamos la fecha para evitar el error de Supabase (invalid input syntax for type date: "")
    const fechaLimpia = fechaNacimiento && fechaNacimiento.trim() !== '' ? fechaNacimiento : null;

    if (existente) {
      // 2. Usamos la fecha limpia para la actualización
      if (!existente['fecha_nacimiento'] && fechaLimpia) {
        await this.supabase.client.from('clientes').update({ fecha_nacimiento: fechaLimpia }).eq('id', existente.id);
      }
      return existente;
    }

    const bsId = await this.supabase.obtenerBarbershopId();
    
    // 3. Armamos el paquete de datos base sin la fecha
    const payload: any = {
      nombre: nombreIngresado,
      telefono: whatsapp.trim(),
      barbershop_id: bsId,
      visitas_totales: 0,
      puntos_acumulados: 0
    };

    // 4. Solo inyectamos la fecha si realmente tiene un valor válido
    if (fechaLimpia) {
      payload.fecha_nacimiento = fechaLimpia;
    }

    const { data: nuevo, error: insertError } = await this.supabase.client
      .from('clientes')
      .insert([payload])
      .select()
      .single();

    if (insertError) throw insertError;
    return nuevo;
  }

  async agregarCliente(nuevoCliente: Cliente) {
    const bsId = await this.supabase.obtenerBarbershopId();
    const payload = { ...nuevoCliente, barbershop_id: bsId };
    const { data, error } = await this.supabase.client
      .from('clientes')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Error al agregar cliente:', error);
      throw error;
    }

    if (data) {
      this.clientes.update(lista => [data as Cliente, ...lista]);
      return data as Cliente;
    }
    return null;
  }

  async buscarClientePorTelefono(telefono: string): Promise<Cliente | null> {
    if (!telefono || telefono.trim() === '') return null; // Prevención de búsquedas en blanco
    
    const { data, error } = await this.supabase.client
      .from('clientes')
      .select('*')
      .eq('telefono', telefono.trim())
      .maybeSingle(); // maybeSingle evita errores si devuelve 0 filas

    return data ? (data as Cliente) : null;
  }

  async actualizarCliente(id: number, cambios: Partial<Cliente>) {
    this.clientes.update(lista => lista.map(c => c.id === id ? { ...c, ...cambios } : c));
    const { error } = await this.supabase.client
      .from('clientes')
      .update(cambios)
      .eq('id', id);

    if (error) {
      console.error('Error al actualizar cliente:', error);
      this.cargarClientes();
    }
  }

  // Motor de Fidelización
  async registrarVisitaYSumarPuntos(clienteId: number, puntosActuales: number, visitasTotales: number = 0) {
    // Si llega a 5, el próximo (el actual que se está pagando) canjea la promo y reinicia el contador a 0
    const nuevosPuntos = puntosActuales >= 5 ? 0 : puntosActuales + 1;
    const nuevasVisitas = visitasTotales + 1;

    const { error } = await this.supabase.client
      .from('clientes')
      .update({ 
        puntos_acumulados: nuevosPuntos,
        visitas_totales: nuevasVisitas,
        ultima_visita: new Date().toISOString()
      })
      .eq('id', clienteId);

    if (!error) {
      this.cargarClientes(); 
      return true;
    }
    return false;
  }
}