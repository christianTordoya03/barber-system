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

  // Añade esto dentro de tu clase ClientesService
  // AÑADIR ESTA FUNCIÓN AL FINAL DE LA CLASE
  async upsertClienteExpress(nombre: string, whatsapp: string, cumpleanos: string) {
    const { data: existente, error: searchError } = await this.supabase.client
      .from('clientes')
      .select('*')
      .eq('telefono', whatsapp)
      .single();

    if (existente) {
      // Si el cliente ya existe pero le faltaba su cumpleaños, podemos actualizarlo
      if (!existente['cumpleanos']) {
        await this.supabase.client.from('clientes').update({ cumpleanos: cumpleanos }).eq('id', existente.id);
      }
      return existente;
    }

    const bsId = await this.supabase.obtenerBarbershopId();
    const { data: nuevo, error: insertError } = await this.supabase.client
      .from('clientes')
      .insert([{
        nombre_completo: nombre,
        telefono: whatsapp,
        cumpleanos: cumpleanos,
        estado: 'activo',
        barbershop_id: bsId // <-- Inyectamos
      }])
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
    const { data, error } = await this.supabase.client
      .from('clientes')
      .select('*')
      .eq('telefono', telefono)
      .single();

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
}