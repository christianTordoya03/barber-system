import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalDetalleComponent } from '../../../shared/ui/modal-detalle/modal-detalle';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { TurnosService } from '../../../core/services/turnos';
import { ToastService } from '../../../core/services/toast';
import { StaffService } from '../../../core/services/staff';
import { CatalogoService } from '../../../core/services/catalogo';

@Component({
  selector: 'app-cobros',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalDetalleComponent, ModalConfirmComponent, ReactiveFormsModule],
  templateUrl: './cobros.html',
})
export class CobrosComponent {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private toastService = inject(ToastService);
  private staffService = inject(StaffService);
  private catalogoService = inject(CatalogoService);

  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));
  servicios = this.catalogoService.servicios;

  turnosPendientes = computed(() => this.turnosService.turnos().filter(t => t.estado === 'pending'));

  turnosLista = computed(() => {
    return [...this.turnosService.turnos()].sort((a, b) => {
      if (a.estado === 'pending' && b.estado !== 'pending') return -1;
      if (a.estado !== 'pending' && b.estado === 'pending') return 1;
      if (a.estado === 'annulled' && b.estado !== 'annulled') return 1;
      if (a.estado !== 'annulled' && b.estado === 'annulled') return -1;
      return b.id - a.id;
    });
  });

  cobroForm = this.fb.nonNullable.group({
    turnoId: ['', Validators.required],
    formaPago: ['', Validators.required]
  });

  servicioSeleccionado = signal<string>('');
  precioSeleccionado = signal<number | null>(null);

  isDetalleModalOpen = signal<boolean>(false);
  detalleSeleccionado = signal<any>(null);

  // Modal de Edición Completados
  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0], 
    cliente: ['', Validators.required], 
    servicio: ['', Validators.required], 
    barbero: ['', Validators.required], 
    monto: [0, [Validators.required, Validators.min(0)]], 
    metodoPago: ['Yape', Validators.required]
  });

  // Modal de Edición Pendientes
  isEditPendienteModalOpen = signal<boolean>(false);
  editPendienteForm = this.fb.nonNullable.group({
    id: [0], 
    cliente: ['', Validators.required], 
    servicio: ['', Validators.required], 
    barbero: ['', Validators.required], 
    monto: [0, [Validators.required, Validators.min(0)]]
  });

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  constructor() {
    this.cobroForm.get('turnoId')?.valueChanges.subscribe(id => {
      const turno = this.turnosPendientes().find(t => t.id === Number(id));
      if (turno) { this.servicioSeleccionado.set(turno.servicio); this.precioSeleccionado.set(turno.monto); } 
      else { this.servicioSeleccionado.set(''); this.precioSeleccionado.set(null); }
    });

    this.editForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) this.editForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false });
    });

    this.editPendienteForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) this.editPendienteForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false });
    });
  }

  realizarCobro() {
    if (this.cobroForm.invalid) { this.cobroForm.markAllAsTouched(); return; }
    const { turnoId, formaPago } = this.cobroForm.getRawValue();
    this.turnosService.actualizarTurno(Number(turnoId), { estado: 'completed', fecha: new Date().toLocaleString('es-PE'), metodoPago: formaPago });
    this.toastService.show(`Servicio cobrado correctamente con ${formaPago}`);
    this.cobroForm.reset({ turnoId: '', formaPago: '' });
    this.servicioSeleccionado.set(''); this.precioSeleccionado.set(null);
  }

  verDetalle(id: number) {
    const cobro = this.turnosLista().find(c => c.id === id);
    if (cobro) { this.detalleSeleccionado.set(cobro); this.isDetalleModalOpen.set(true); }
  }

  cerrarDetalle() { 
    this.isDetalleModalOpen.set(false); 
    setTimeout(() => this.detalleSeleccionado.set(null), 300); 
  }

  abrirModalEditar(id: number) {
    const mov = this.turnosLista().find(m => m.id === id);
    if (mov) {
      if (mov.estado === 'pending') {
        this.editPendienteForm.patchValue(
          { id: mov.id, cliente: mov.cliente, servicio: mov.servicio, barbero: mov.barbero, monto: mov.monto }, 
          { emitEvent: false }
        );
        this.isEditPendienteModalOpen.set(true);
      } else {
        this.editForm.patchValue(
          { id: mov.id, cliente: mov.cliente, servicio: mov.servicio, barbero: mov.barbero, monto: mov.monto, metodoPago: mov.metodoPago || 'Efectivo' }, 
          { emitEvent: false }
        );
        this.isEditModalOpen.set(true);
      }
    }
  }

  abrirModalEditarPendiente(id: number) {
    const turno = this.turnosLista().find(t => t.id === id);
    if (turno) {
      this.editPendienteForm.patchValue(
        { id: turno.id, barbero: turno.barbero, cliente: turno.cliente, servicio: turno.servicio, monto: turno.monto }, 
        { emitEvent: false }
      );
      this.isEditPendienteModalOpen.set(true);
    }
  }

  guardarEdicion() {
    if (this.editForm.invalid) return;
    const val = this.editForm.getRawValue();
    this.turnosService.actualizarTurno(val.id, { cliente: val.cliente, servicio: val.servicio, barbero: val.barbero, monto: val.monto, metodoPago: val.metodoPago });
    this.toastService.show('Cobro editado correctamente');
    this.isEditModalOpen.set(false);
  }

  guardarEdicionPendiente() {
    if (this.editPendienteForm.invalid) return;
    const val = this.editPendienteForm.getRawValue();
    this.turnosService.actualizarTurno(val.id, { cliente: val.cliente, servicio: val.servicio, barbero: val.barbero, monto: val.monto });
    this.toastService.show('Turno actualizado correctamente');
    this.isEditPendienteModalOpen.set(false);
  }

  anularCobro(id: number) {
    const turno = this.turnosLista().find(t => t.id === id);
    const esPendiente = turno?.estado === 'pending';

    this.confirmConfig.set({
      isOpen: true,
      title: esPendiente ? 'Cancelar Turno' : 'Anular Cobro',
      message: esPendiente ? '¿Estás seguro de cancelar este servicio en curso?' : '¿Estás seguro de anular este registro? Se restará de la caja.',
      type: 'danger', confirmText: esPendiente ? 'Sí, Cancelar' : 'Sí, Anular',
      action: () => {
        this.turnosService.actualizarTurno(id, { estado: 'annulled' });
        this.toastService.show(esPendiente ? 'Turno cancelado exitosamente' : 'Cobro anulado exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }

  restaurarCobro(id: number) {
    this.confirmConfig.set({
      isOpen: true, title: 'Restaurar Cobro', message: '¿Deseas deshacer la anulación y restaurar este registro a la caja?', type: 'info', confirmText: 'Sí, Restaurar',
      action: () => {
        this.turnosService.actualizarTurno(id, { estado: 'completed' });
        this.toastService.show('Cobro restaurado exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }
  
  cerrarConfirmacion() { 
    this.confirmConfig.update(c => ({ ...c, isOpen: false })); 
  }
}