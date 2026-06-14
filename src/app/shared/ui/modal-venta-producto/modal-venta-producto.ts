import { Component, EventEmitter, Input, OnInit, Output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventarioService, Producto } from '../../../core/services/inventario';
import { ToastService } from '../../../core/services/toast';
import { StaffService } from '../../../core/services/staff'; // <-- Inyectamos el servicio oficial

@Component({
  selector: 'app-modal-venta-producto',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-venta-producto.html'
})
export class ModalVentaProductoComponent implements OnInit {
  @Input() producto!: Producto;
  @Input() barbershopId!: string | null;
  @Output() cerrar = new EventEmitter<void>();

  private inventarioService = inject(InventarioService);
  private toastService = inject(ToastService);
  private staffService = inject(StaffService); // <-- Añadido

  cantidad: number = 1;
  empleadoSeleccionado: number | null = null;
  porcentajeComision: number = 20;
  metodoPago: string = 'Efectivo';
  
  procesando: boolean = false;

  // Tomamos los empleados directamente de tu memoria global de forma segura
  empleadosActivos = computed(() => this.staffService.empleados().filter(e => e.activo));

  ngOnInit() {
    // Ya no hacemos peticiones manuales a Supabase aquí, usamos el Computed
  }

  get totalVenta(): number {
    return this.producto.precio_venta * this.cantidad;
  }

  get costoTotal(): number {
    return this.producto.costo_unitario * this.cantidad;
  }

  get montoComision(): number {
    return this.totalVenta * (this.porcentajeComision / 100);
  }

  get gananciaNeta(): number {
    return this.totalVenta - this.costoTotal - this.montoComision;
  }

  validarCantidad() {
    if (this.cantidad > this.producto.stock) {
      this.cantidad = this.producto.stock;
    } else if (this.cantidad < 1) {
      this.cantidad = 1;
    }
  }

  async confirmarVenta() {
    if (!this.empleadoSeleccionado) {
      this.toastService.showWarning('Por favor, selecciona un empleado');
      return;
    }

    if (!this.barbershopId || !this.producto.id) return;

    this.procesando = true;

    try {
      await this.inventarioService.venderProducto(
        this.barbershopId,
        this.producto.id,
        this.empleadoSeleccionado,
        this.cantidad,
        this.porcentajeComision,
        this.metodoPago
      );

      this.toastService.showSuccess('¡Venta registrada con éxito!');
      this.cerrarModal();
      
    } catch (error: any) {
      console.error(error);
      this.toastService.showError(error.message || 'Error al procesar la venta');
    } finally {
      this.procesando = false;
    }
  }

  cerrarModal() {
    this.cerrar.emit();
  }
}