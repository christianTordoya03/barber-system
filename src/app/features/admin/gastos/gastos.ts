import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GastosService } from '../../../core/services/gastos';
import { StaffService } from '../../../core/services/staff';
import { ToastService } from '../../../core/services/toast';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { Gasto } from '../../../core/models/marina';

@Component({
  selector: 'app-gastos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalConfirmComponent],
  templateUrl: './gastos.html',
})
export class GastosComponent {
  private fb = inject(FormBuilder);
  private gastosService = inject(GastosService);
  private staffService = inject(StaffService);
  private toastService = inject(ToastService);

  gastos = this.gastosService.gastos;
  empleadosActivos = computed(() => this.staffService.empleados().filter(e => e.activo));

  // Formulario de Creación
  gastoForm = this.fb.nonNullable.group({
    descripcion: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(1)]],
    metodoPago: ['', Validators.required],
    empleado_id: ['']
  });

  // NUEVO: Formulario y estado del Modal de Edición
  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0],
    descripcion: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(1)]],
    metodoPago: ['', Validators.required],
    empleado_id: ['']
  });

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  registrarGasto() {
    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      return;
    }
    const formValues = this.gastoForm.getRawValue();
    const fechaActual = new Date().toLocaleString('es-PE', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute:'2-digit', second:'2-digit' 
    });

    const nuevoGasto: Gasto = {
      id: Date.now(),
      descripcion: formValues.descripcion,
      monto: formValues.monto,
      metodoPago: formValues.metodoPago,
      fecha: fechaActual,
      empleado_id: formValues.empleado_id ? Number(formValues.empleado_id) : null,
      estado: 'activo'
    };

    this.gastosService.agregarGasto(nuevoGasto);
    this.toastService.show('Gasto registrado correctamente');
    this.gastoForm.reset({ descripcion: '', monto: 0, metodoPago: '', empleado_id: '' });
  }

  // NUEVO: Abrir modal de edición
  abrirModalEditar(id: number) {
    const gasto = this.gastos().find(g => g.id === id);
    if (gasto) {
      this.editForm.patchValue({
        id: gasto.id,
        descripcion: gasto.descripcion,
        monto: gasto.monto,
        metodoPago: gasto.metodoPago,
        empleado_id: gasto.empleado_id ? gasto.empleado_id.toString() : ''
      });
      this.isEditModalOpen.set(true);
    }
  }

  // NUEVO: Guardar edición
  guardarEdicion() {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const val = this.editForm.getRawValue();
    const cambios = {
      descripcion: val.descripcion,
      monto: val.monto,
      metodoPago: val.metodoPago,
      empleado_id: val.empleado_id ? Number(val.empleado_id) : null
    };

    this.gastosService.actualizarGasto(val.id, cambios);
    this.toastService.show('Gasto editado correctamente');
    this.isEditModalOpen.set(false);
  }

  anularGasto(id: number) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Anular Gasto',
      message: '¿Estás seguro de anular este gasto? Dejará de sumarse en los reportes financieros, pero el registro se mantendrá en el historial.',
      type: 'danger',
      confirmText: 'Sí, Anular',
      action: () => {
        this.gastosService.anularGasto(id);
        this.toastService.show('Gasto anulado correctamente');
        this.cerrarConfirmacion();
      }
    });
  }

  liquidarAdelanto(id: number) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Liquidar Adelanto',
      message: '¿Confirmas que ya descontaste este adelanto del pago del barbero? Una vez liquidado, dejará de restar de su saldo pendiente.',
      type: 'info',
      confirmText: 'Sí, Liquidar',
      action: () => {
        this.gastosService.liquidarGasto(id);
        this.cerrarConfirmacion();
      }
    });
  }

  restaurarGasto(id: number) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Restaurar Gasto',
      message: '¿Deseas deshacer la anulación? Este monto volverá a restarse de tu caja en los reportes financieros.',
      type: 'info',
      confirmText: 'Sí, Restaurar',
      action: () => {
        this.gastosService.restaurarGasto(id);
        this.toastService.show('Gasto restaurado correctamente');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() {
    this.confirmConfig.update(c => ({ ...c, isOpen: false }));
  }

  getNombreEmpleado(id: number | null | undefined): string {
    if (!id) return '';
    const emp = this.staffService.empleados().find(e => e.id === id);
    return emp ? `(Pago a: ${emp.nombre})` : '';
  }
}