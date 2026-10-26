import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';
import { Servicio, Categoria } from '../models/marina';

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private supabase = inject(SupabaseService);
  
  servicios = signal<Servicio[]>([]);
  categorias = signal<Categoria[]>([]);

  constructor() { 
    this.cargarDatos(); 
    this.escucharCambiosCatalogo();

    // --- ESCUDO: RECONEXIÓN AUTOMÁTICA AL DESPERTAR PANTALLA ---
    // Esto garantiza que el cliente siempre vea el precio real (ej: 60 soles)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('App visible: Recargando catálogo desde Supabase...');
          this.cargarDatos(); 
        }
      });
    }
  }

  async cargarDatos() {
    const bsId = await this.supabase.obtenerBarbershopId();
    const [resServicios, resCategorias] = await Promise.all([
      this.supabase.client.from('servicios').select('*').eq('barbershop_id', bsId).order('id', { ascending: false }),
      this.supabase.client.from('categorias').select('*').eq('barbershop_id', bsId).order('id', { ascending: false })
    ]);
    if (resServicios.data) this.servicios.set(resServicios.data as Servicio[]);
    if (resCategorias.data) this.categorias.set(resCategorias.data as Categoria[]);
  }

  private escucharCambiosCatalogo() {
    this.supabase.client
      .channel('cambios-catalogo-general')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'servicios' },
        () => { this.cargarDatos(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categorias' },
        () => { this.cargarDatos(); }
      )
      .subscribe();
  }

  // --- MODO PESIMISTA: SERVICIOS ---
  async agregarServicio(nuevoServicio: Servicio) {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { id, ...bd } = nuevoServicio;
    const payload = { ...bd, barbershop_id: bsId };
    
    const { data, error } = await this.supabase.client.from('servicios').insert(payload).select().single();
    
    if (error) {
      console.error('Error en Supabase al agregar servicio:', error);
      throw error;
    }
    
    if (data) {
      this.servicios.update(lista => [data as Servicio, ...lista]);
    }
  }

  async actualizarServicio(id: number, cambios: Partial<Servicio>) {
    const { error } = await this.supabase.client.from('servicios').update(cambios).eq('id', id);
    
    if (error) {
      console.error('Error en Supabase al actualizar servicio:', error);
      throw error;
    }
    
    this.servicios.update(l => l.map(s => s.id === id ? { ...s, ...cambios } : s));
  }

  async eliminarServicio(id: number) {
    const { error } = await this.supabase.client.from('servicios').delete().eq('id', id);
    
    if (error) {
      console.error('Error en Supabase al eliminar servicio:', error);
      throw error;
    }
    
    this.servicios.update(l => l.filter(s => s.id !== id));
  }

  // --- MODO PESIMISTA: CATEGORÍAS ---
  async agregarCategoria(nueva: Categoria) {
    const bsId = await this.supabase.obtenerBarbershopId();
    const { id, ...bd } = nueva;
    const payload = { ...bd, barbershop_id: bsId };
    
    const { data, error } = await this.supabase.client.from('categorias').insert(payload).select().single();
    
    if (error) {
      console.error('Error en Supabase al agregar categoría:', error);
      throw error;
    }
    
    if (data) {
      this.categorias.update(lista => [data as Categoria, ...lista]);
    }
  }

  async actualizarCategoria(id: number, cambios: Partial<Categoria>) {
    const { error } = await this.supabase.client.from('categorias').update(cambios).eq('id', id);
    
    if (error) {
      console.error('Error en Supabase al actualizar categoría:', error);
      throw error;
    }
    
    this.categorias.update(l => l.map(c => c.id === id ? { ...c, ...cambios } : c));
  }

  async eliminarCategoria(id: number) {
    const { error } = await this.supabase.client.from('categorias').delete().eq('id', id);
    
    if (error) {
      console.error('Error en Supabase al eliminar categoría:', error);
      throw error;
    }
    
    this.categorias.update(l => l.filter(c => c.id !== id));
  }
}