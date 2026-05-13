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
    const { data, error } = await this.supabase.client
      .from('clientes')
      .select('*')
      .order('id', { ascending: false });
      
    if (data) {
      this.clientes.set(data as Cliente[]);
    }
  }

  async agregarCliente(nuevoCliente: Cliente) {
    const { data, error } = await this.supabase.client
      .from('clientes')
      .insert(nuevoCliente)
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