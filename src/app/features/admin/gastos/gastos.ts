import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { GastosService } from '../../../core/services/gastos';
import { StaffService } from '../../../core/services/staff';
import { ToastService } from '../../../core/services/toast';
import { ComisionesService } from '../../../core/services/comisiones';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { Gasto, Comision } from '../../../core/models/marina';

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
  private comisionesService = inject(ComisionesService);

  gastos = this.gastosService.gastos;
  comisiones = this.comisionesService.comisiones;
  empleadosActivos = computed(() => this.staffService.empleados().filter(e => e.activo));

  // Formulario de Creación de Gasto General
  gastoForm = this.fb.nonNullable.group({
    descripcion: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(1)]],
    metodoPago: ['', Validators.required],
    empleado_id: ['']
  });

  // Formulario de Creación de Propina o Comisión Extra ajustado
  comisionForm = this.fb.nonNullable.group({
    empleado_id: ['', Validators.required],
    tipo: ['propina' as const, Validators.required],
    monto: [0, [Validators.required, Validators.min(0.1)]], // Permite decimales válidos
    descripcion: ['']
  });

  // Modal Edición de Gasto
  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0],
    descripcion: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(1)]],
    metodoPago: ['', Validators.required],
    empleado_id: ['']
  });

  // Modal Edición de Comisión
  isEditComisionModalOpen = signal<boolean>(false);
  editComisionForm = this.fb.nonNullable.group({
    id: [0],
    empleado_id: ['', Validators.required],
    tipo: ['propina' as 'propina' | 'producto' | 'servicio_extra', Validators.required],
    monto: [0, [Validators.required, Validators.min(0.1)]],
    descripcion: ['']
  });

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  // --- LÓGICA DE PROPINAS Y COMISIONES EXTRAS ---

  private formatDateToDDMMYYYY(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  async registrarComision() {
    // Alerta visual instantánea si falta el barbero o el monto es inválido
    if (this.comisionForm.invalid) {
      this.comisionForm.markAllAsTouched();
      this.toastService.show('Por favor, selecciona un barbero e ingresa un monto válido mayor a 0.', 'error');
      return;
    }
    
    const formValues = this.comisionForm.getRawValue();
    const fechaActualStr = this.formatDateToDDMMYYYY(new Date());

    const nuevaComision: Omit<Comision, 'id' | 'created_at'> = {
      empleado_id: Number(formValues.empleado_id),
      tipo: formValues.tipo as 'propina' | 'producto' | 'servicio_extra',
      monto: Number(formValues.monto),
      descripcion: formValues.descripcion || undefined,
      fecha: fechaActualStr,
      estado: 'activo'
    };

    const res = await this.comisionesService.agregarComision(nuevaComision);
    if (res) {
      this.toastService.show('Propina/Comisión registrada correctamente');
      
      // Reseteamos valores y limpiamos explícitamente las banderas de error en la UI
      this.comisionForm.reset({ empleado_id: '', tipo: 'propina', monto: 0, descripcion: '' });
      this.comisionForm.markAsPristine();
      this.comisionForm.markAsUntouched();
    } else {
      this.toastService.show('Error al guardar el registro en la base de datos.', 'error');
    }
  }

  abrirModalEditarComision(comision: Comision) {
    this.editComisionForm.patchValue({
      id: comision.id,
      empleado_id: comision.empleado_id.toString(),
      tipo: comision.tipo,
      monto: comision.monto,
      descripcion: comision.descripcion || ''
    });
    this.isEditComisionModalOpen.set(true);
  }

  async guardarEdicionComision() {
    if (this.editComisionForm.invalid) {
      this.toastService.show('Verifica los datos ingresados.', 'error');
      return;
    }
    
    const val = this.editComisionForm.getRawValue();
    const cambios = {
      empleado_id: Number(val.empleado_id),
      tipo: val.tipo,
      monto: Number(val.monto),
      descripcion: val.descripcion || undefined
    };

    const ok = await this.comisionesService.actualizarComision(val.id, cambios);
    if (ok) {
      this.toastService.show('Registro extra actualizado');
      this.isEditComisionModalOpen.set(false);
    } else {
      this.toastService.show('Error al actualizar.', 'error');
    }
  }

  anularComision(id: number) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Anular Propina / Comisión',
      message: '¿Estás seguro de anular este ingreso extra? Dejará de sumar en el perfil y reportes del barbero.',
      type: 'danger',
      confirmText: 'Sí, Anular',
      action: async () => {
        await this.comisionesService.anularComision(id);
        this.toastService.show('Ingreso extra anulado');
        this.cerrarConfirmacion();
      }
    });
  }

  restaurarComision(id: number) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Restaurar Propina / Comisión',
      message: '¿Deseas restaurar este ingreso extra? Volverá a estar activo y sumará a los reportes del barbero.',
      type: 'info',
      confirmText: 'Sí, Restaurar',
      action: async () => {
        await this.comisionesService.restaurarComision(id);
        this.toastService.show('Ingreso extra restaurado');
        this.cerrarConfirmacion();
      }
    });
  }

  // --- LÓGICA DE GASTOS GENERALES ---

  registrarGasto() {
    if (this.gastoForm.invalid) {
      this.gastoForm.markAllAsTouched();
      this.toastService.show('Por favor, completa la descripción y monto del gasto.', 'error');
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

  guardarEdicion() {
    if (this.editForm.invalid) return;
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
      isOpen: true, title: 'Anular Gasto', message: '¿Estás seguro de anular este gasto?', type: 'danger', confirmText: 'Sí, Anular',
      action: () => {
        this.gastosService.anularGasto(id);
        this.toastService.show('Gasto anulado');
        this.cerrarConfirmacion();
      }
    });
  }

  liquidarAdelanto(id: number) {
    this.confirmConfig.set({
      isOpen: true, title: 'Liquidar Adelanto', message: '¿Confirmas que ya descontaste este adelanto?', type: 'info', confirmText: 'Sí, Liquidar',
      action: () => {
        this.gastosService.liquidarGasto(id);
        this.cerrarConfirmacion();
      }
    });
  }

  restaurarGasto(id: number) {
    this.confirmConfig.set({
      isOpen: true, title: 'Restaurar Gasto', message: '¿Restaurar este gasto?', type: 'info', confirmText: 'Sí, Restaurar',
      action: () => {
        this.gastosService.restaurarGasto(id);
        this.toastService.show('Gasto restaurado');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }

  getNombreEmpleado(id: number | null | undefined): string {
    if (!id) return '';
    const emp = this.staffService.empleados().find(e => e.id === id);
    return emp ? `(Pago a: ${emp.nombre})` : '';
  }

  getNombreEmpleadoOnly(id: number): string {
    const emp = this.staffService.empleados().find(e => e.id === id);
    return emp ? emp.nombre : 'Desconocido';
  }
}