import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { InventarioService, Producto } from '../../../core/services/inventario';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ToastService } from '../../../core/services/toast'; 
import { StaffService } from '../../../core/services/staff';
import { ModalVentaProductoComponent } from '../../../shared/ui/modal-venta-producto/modal-venta-producto';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';

@Component({
  selector: 'app-inventario',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalVentaProductoComponent, ModalConfirmComponent],
  templateUrl: './inventario.html'
})
export class InventarioComponent implements OnInit, OnDestroy {
  inventarioService = inject(InventarioService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private staffService = inject(StaffService);

  barbershopId: string | null = null;
  empleadosActivos = computed(() => this.staffService.empleados().filter(e => e.activo));
  
  mostrarModalVenta = false;
  productoSeleccionado: Producto | null = null;
  mostrarModalCrear = false;
  procesandoCreacion = false;
  nuevoProducto = { nombre: '', stock: 0, costo_unitario: 0, precio_venta: 0 };

  historialVentas = signal<any[]>([]);
  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  // Variables para la Edición de Venta
  mostrarModalEditar = false;
  procesandoEdicion = false;
  ventaAEditar: any = null;
  datosEdicion = { cantidad: 1, empleado_id: null as number | null, porcentaje_comision: 20, metodo_pago: 'Efectivo' };

  // NUEVO: Variables para la Edición del Producto en Inventario
  mostrarModalEditarProd = false;
  procesandoEdicionProd = false;
  productoAEditar: any = null;

  async ngOnInit() {
    try {
      this.barbershopId = this.supabase.tenant()?.id || null;
      if (this.barbershopId) {
        await this.inventarioService.cargarProductos(this.barbershopId);
        this.inventarioService.escucharCambiosInventario(this.barbershopId);
        await this.cargarHistorial(); 
      }
    } catch (error) {
      this.toast.showError('Error al cargar el inventario');
    }
  }

  ngOnDestroy() {
    this.inventarioService.detenerCambiosInventario();
  }

  // --- HISTORIAL DE VENTAS Y ANULACIÓN ---
  async cargarHistorial() {
    if(!this.barbershopId) return;
    const { data } = await this.supabase.client
      .from('ventas_productos')
      .select('*, productos(nombre, stock), empleados(nombre)')
      .eq('barbershop_id', this.barbershopId)
      .order('fecha_venta', { ascending: false });
    this.historialVentas.set(data || []);
  }

  anularVenta(ventaId: string) {
    this.confirmConfig.set({
      isOpen: true, title: 'Anular Venta',
      message: '¿Estás seguro de anular esta venta? El stock del producto será devuelto automáticamente.',
      type: 'danger', confirmText: 'Sí, Anular',
      action: async () => {
        try {
          await this.supabase.client.rpc('anular_venta_producto', { p_venta_id: ventaId });
          this.toast.showSuccess('Venta anulada y stock devuelto.');
          await this.cargarHistorial(); 
          await this.inventarioService.cargarProductos(this.barbershopId!); 
          this.cerrarConfirmacion();
        } catch (e) {
          this.toast.showError('Error al anular la venta.');
        }
      }
    });
  }

  cerrarConfirmacion() {
    this.confirmConfig.update(c => ({ ...c, isOpen: false }));
  }

  // --- LÓGICA DE EDICIÓN DE VENTA ---
  abrirModalEditar(venta: any) {
    this.ventaAEditar = venta;
    this.datosEdicion = { cantidad: venta.cantidad, empleado_id: venta.empleado_id, porcentaje_comision: venta.porcentaje_comision, metodo_pago: venta.metodo_pago || 'Efectivo' };
    this.mostrarModalEditar = true;
  }

  cerrarModalEditar() {
    this.mostrarModalEditar = false;
    this.ventaAEditar = null;
  }

  validarCantidadEdicion() {
    if (!this.ventaAEditar) return;
    const maxPosible = this.ventaAEditar.productos.stock + this.ventaAEditar.cantidad;
    if (this.datosEdicion.cantidad > maxPosible) {
      this.datosEdicion.cantidad = maxPosible;
      this.toast.showWarning(`Solo hay ${maxPosible} unidades disponibles en total.`);
    } else if (this.datosEdicion.cantidad < 1) {
      this.datosEdicion.cantidad = 1;
    }
  }

  get edicionTotalVenta(): number { return this.ventaAEditar ? this.ventaAEditar.precio_venta_historico * this.datosEdicion.cantidad : 0; }
  get edicionCostoTotal(): number { return this.ventaAEditar ? this.ventaAEditar.costo_historico * this.datosEdicion.cantidad : 0; }
  get edicionMontoComision(): number { return this.edicionTotalVenta * (this.datosEdicion.porcentaje_comision / 100); }
  get edicionGananciaNeta(): number { return this.edicionTotalVenta - this.edicionCostoTotal - this.edicionMontoComision; }

  async guardarEdicionVenta() {
    if (!this.datosEdicion.empleado_id) return this.toast.showWarning('Selecciona un empleado');
    if (this.datosEdicion.cantidad < 1) return this.toast.showWarning('Cantidad inválida');
    
    this.procesandoEdicion = true;
    try {
      await this.inventarioService.editarVentaProducto(this.ventaAEditar.id, this.datosEdicion.cantidad, this.datosEdicion.empleado_id, this.datosEdicion.porcentaje_comision, this.datosEdicion.metodo_pago);
      this.toast.showSuccess('Venta actualizada correctamente');
      await this.cargarHistorial();
      await this.inventarioService.cargarProductos(this.barbershopId!);
      this.cerrarModalEditar();
    } catch(e: any) {
      this.toast.showError(e.message || 'Error al editar venta');
    } finally {
      this.procesandoEdicion = false;
    }
  }

  // --- LÓGICA DE VENTA NORMAL ---
  abrirModalVenta(producto: Producto) {
    if (producto.stock <= 0) return this.toast.showWarning('No hay stock suficiente');
    this.productoSeleccionado = producto;
    this.mostrarModalVenta = true;
  }

  async cerrarModalVenta() {
    this.mostrarModalVenta = false;
    this.productoSeleccionado = null;
    await this.cargarHistorial();
  }

  // --- LÓGICA DE CREACIÓN DE PRODUCTO ---
  abrirModalCrear() {
    this.nuevoProducto = { nombre: '', stock: 0, costo_unitario: 0, precio_venta: 0 };
    this.mostrarModalCrear = true;
  }

  cerrarModalCrear() { this.mostrarModalCrear = false; }

  async guardarProducto() {
    if (!this.nuevoProducto.nombre.trim()) return this.toast.showWarning('Nombre obligatorio');
    if (this.nuevoProducto.precio_venta <= 0) return this.toast.showWarning('Precio debe ser mayor a 0');
    if (!this.barbershopId) return;

    this.procesandoCreacion = true;
    try {
      const prod: Producto = {
        barbershop_id: this.barbershopId, nombre: this.nuevoProducto.nombre.toUpperCase(),
        stock: this.nuevoProducto.stock, costo_unitario: this.nuevoProducto.costo_unitario,
        precio_venta: this.nuevoProducto.precio_venta, activo: true
      };
      await this.inventarioService.crearProducto(prod);
      await this.inventarioService.cargarProductos(this.barbershopId);
      this.toast.showSuccess('¡Producto añadido!');
      this.cerrarModalCrear();
    } catch (error) {
      this.toast.showError('Error al crear el producto');
    } finally {
      this.procesandoCreacion = false;
    }
  }

  // --- NUEVO: LÓGICA DE EDICIÓN Y ELIMINACIÓN DE PRODUCTOS ---
  abrirModalEditarProd(producto: Producto) {
    this.productoAEditar = { ...producto }; // Clonar para no alterar la UI hasta que guarde
    this.mostrarModalEditarProd = true;
  }

  cerrarModalEditarProd() {
    this.mostrarModalEditarProd = false;
    this.productoAEditar = null;
  }

  async guardarEdicionProd() {
    if (!this.productoAEditar.nombre.trim()) return this.toast.showWarning('Nombre obligatorio');
    if (this.productoAEditar.precio_venta <= 0) return this.toast.showWarning('Precio debe ser mayor a 0');
    
    this.procesandoEdicionProd = true;
    try {
      const cambios = {
        nombre: this.productoAEditar.nombre.toUpperCase(),
        stock: this.productoAEditar.stock,
        costo_unitario: this.productoAEditar.costo_unitario,
        precio_venta: this.productoAEditar.precio_venta
      };
      await this.inventarioService.actualizarProducto(this.productoAEditar.id, cambios);
      await this.inventarioService.cargarProductos(this.barbershopId!);
      this.toast.showSuccess('Producto actualizado correctamente');
      this.cerrarModalEditarProd();
    } catch (error) {
      this.toast.showError('Error al actualizar el producto');
    } finally {
      this.procesandoEdicionProd = false;
    }
  }

  eliminarProducto(producto: Producto) {
    this.confirmConfig.set({
      isOpen: true, title: 'Eliminar Producto',
      message: `¿Estás seguro de eliminar "${producto.nombre}" del inventario? Esto lo ocultará de tu lista.`,
      type: 'danger', confirmText: 'Sí, Eliminar',
      action: async () => {
        try {
          await this.inventarioService.actualizarProducto(producto.id!, { activo: false });
          await this.inventarioService.cargarProductos(this.barbershopId!);
          this.toast.showSuccess('Producto eliminado.');
          this.cerrarConfirmacion();
        } catch (e) {
          this.toast.showError('Error al eliminar el producto.');
        }
      }
    });
  }
}