import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from '../supabase/supabase'; // Ajusta la ruta si es necesario

export interface Producto {
  id?: string;
  barbershop_id: string;
  nombre: string;
  stock: number;
  costo_unitario: number;
  precio_venta: number;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class InventarioService {
  // Usamos BehaviorSubject para que cualquier componente suscrito reaccione a los cambios
  private productosSubject = new BehaviorSubject<Producto[]>([]);
  public productos$ = this.productosSubject.asObservable();
  
  private realtimeChannel: any;

  constructor(private supabase: SupabaseService) {}

  // 1. Cargar el inventario inicial
  async cargarProductos(barbershopId: string) {
    const { data, error } = await this.supabase.client
      .from('productos')
      .select('*')
      .eq('barbershop_id', barbershopId)
      .eq('activo', true)
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error al cargar inventario:', error);
      throw error;
    }

    this.productosSubject.next(data || []);
  }

  // 2. Escuchar cambios en la base de datos (¡Magia en Tiempo Real!)
  escucharCambiosInventario(barbershopId: string) {
    // Evitamos múltiples suscripciones si se llama varias veces
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
    }

    this.realtimeChannel = this.supabase.client
      .channel('inventario-channel')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'productos', 
          filter: `barbershop_id=eq.${barbershopId}` 
        },
        () => {
          // Si alguien inserta, edita o vende un producto, recargamos la lista silenciosamente.
          // Esto actualizará automáticamente la tabla de cualquier usuario conectado.
          this.cargarProductos(barbershopId);
        }
      )
      .subscribe();
  }

  // Limpiar la suscripción cuando el componente se destruye
  detenerCambiosInventario() {
    if (this.realtimeChannel) {
      this.supabase.client.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  // 3. Crear un nuevo producto
  async crearProducto(producto: Producto) {
    const { error } = await this.supabase.client
      .from('productos')
      .insert(producto);
      
    if (error) throw error;
  }

  // 4. Actualizar producto (Ej. cambiar precio o agregar stock manual)
  async actualizarProducto(id: string, cambios: Partial<Producto>) {
    const { error } = await this.supabase.client
      .from('productos')
      .update(cambios)
      .eq('id', id);

    if (error) throw error;
  }

  // 5. Registrar la Venta Segura (Llama a tu función de base de datos)
  async venderProducto(barbershopId: string, productoId: string, empleadoId: number, cantidad: number, porcentajeComision: number, metodoPago: string) {
    const { data, error } = await this.supabase.client.rpc('realizar_venta_producto', {
      p_barbershop_id: barbershopId,
      p_producto_id: productoId,
      p_empleado_id: empleadoId,
      p_cantidad: cantidad,
      p_porcentaje_comision: porcentajeComision,
      p_metodo_pago: metodoPago
    });

    if (error) throw error;
    return data;
  }

  async editarVentaProducto(ventaId: string, nuevaCantidad: number, nuevoEmpleadoId: number, nuevoPorcentaje: number, nuevoMetodo: string) {
    const { data, error } = await this.supabase.client.rpc('editar_venta_producto', {
      p_venta_id: ventaId,
      p_nueva_cantidad: nuevaCantidad,
      p_nuevo_empleado_id: nuevoEmpleadoId,
      p_nuevo_porcentaje: nuevoPorcentaje,
      p_nuevo_metodo_pago: nuevoMetodo
    });

    if (error) throw error;
    return data;
  }
}