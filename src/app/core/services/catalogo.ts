import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { Servicio, Categoria } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private supabase = inject(SupabaseService);
  
  servicios = signal<Servicio[]>([]);
  categorias = signal<Categoria[]>([]);

  constructor() { this.cargarDatos(); }

  async cargarDatos() {
    const bsId = await this.supabase.obtenerBarbershopId();
    const [resServicios, resCategorias] = await Promise.all([
      this.supabase.client.from('servicios').select('*').eq('barbershop_id', bsId).order('id', { ascending: false }),
      this.supabase.client.from('categorias').select('*').eq('barbershop_id', bsId).order('id', { ascending: false })
    ]);
    if (resServicios.data) this.servicios.set(resServicios.data as Servicio[]);
    if (resCategorias.data) this.categorias.set(resCategorias.data as Categoria[]);
  }

  // --- SERVICIOS ---
  async agregarServicio(nuevoServicio: Servicio) {
    const bsId = await this.supabase.obtenerBarbershopId();
    this.servicios.update(lista => [nuevoServicio, ...lista]);
    const { id, ...bd } = nuevoServicio;
    const payload = { ...bd, barbershop_id: bsId };
    const { data, error } = await this.supabase.client.from('servicios').insert(payload).select().single();
    if (error) this.cargarDatos();
    else if (data) this.servicios.update(l => l.map(s => s.id === nuevoServicio.id ? (data as Servicio) : s));
  }

  async actualizarServicio(id: number, cambios: Partial<Servicio>) {
    this.servicios.update(l => l.map(s => s.id === id ? { ...s, ...cambios } : s));
    const { error } = await this.supabase.client.from('servicios').update(cambios).eq('id', id);
    if (error) this.cargarDatos();
  }

  async eliminarServicio(id: number) {
    this.servicios.update(l => l.filter(s => s.id !== id));
    const { error } = await this.supabase.client.from('servicios').delete().eq('id', id);
    if (error) this.cargarDatos();
  }

  // --- CATEGORÍAS ---
  async agregarCategoria(nueva: Categoria) {
    const bsId = await this.supabase.obtenerBarbershopId();
    this.categorias.update(lista => [nueva, ...lista]);
    const { id, ...bd } = nueva;
    const payload = { ...bd, barbershop_id: bsId };
    const { data, error } = await this.supabase.client.from('categorias').insert(payload).select().single();
    if (error) this.cargarDatos();
    else if (data) this.categorias.update(l => l.map(c => c.id === nueva.id ? (data as Categoria) : c));
  }

  async actualizarCategoria(id: number, cambios: Partial<Categoria>) {
    this.categorias.update(l => l.map(c => c.id === id ? { ...c, ...cambios } : c));
    const { error } = await this.supabase.client.from('categorias').update(cambios).eq('id', id);
    if (error) this.cargarDatos();
  }

  async eliminarCategoria(id: number) {
    this.categorias.update(l => l.filter(c => c.id !== id));
    const { error } = await this.supabase.client.from('categorias').delete().eq('id', id);
    if (error) this.cargarDatos();
  }
}