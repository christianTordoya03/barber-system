import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TransactionCardComponent } from '../../../shared/ui/transaction-card/transaction-card';
import { ModalDetalleComponent } from '../../../shared/ui/modal-detalle/modal-detalle';
import { ModalCobroComponent } from '../../../shared/ui/modal-cobro/modal-cobro';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { TurnosService } from '../../../core/services/turnos';
import { ToastService } from '../../../core/services/toast';
import { StaffService } from '../../../core/services/staff';
import { CatalogoService } from '../../../core/services/catalogo';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TransactionCardComponent, ModalDetalleComponent, ModalCobroComponent, ModalConfirmComponent, ReactiveFormsModule],
  templateUrl: './dashboard.html',
})
export class DashboardComponent {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private toastService = inject(ToastService);
  private staffService = inject(StaffService);
  private catalogoService = inject(CatalogoService);

  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));
  servicios = this.catalogoService.servicios;

  ultimosMovimientos = computed(() => {
    return [...this.turnosService.turnos()].sort((a, b) => {
      if (a.estado === 'pending' && b.estado !== 'pending') return -1;
      if (a.estado !== 'pending' && b.estado === 'pending') return 1;
      if (a.estado === 'annulled' && b.estado !== 'annulled') return 1;
      if (a.estado !== 'annulled' && b.estado === 'annulled') return -1;
      return b.id - a.id;
    });
  });

  dineroEnCaja = computed(() => this.ultimosMovimientos().filter(t => t.estado === 'completed').reduce((total, turno) => total + (turno.monto || 0), 0));
  cortesRealizados = computed(() => this.ultimosMovimientos().filter(t => t.estado === 'completed').length);
  comisionesAPagar = computed(() => this.dineroEnCaja() * 0.50);

  isDetalleModalOpen = signal<boolean>(false);
  detalleSeleccionado = signal<any>(null);

  isModalCobroOpen = signal<boolean>(false);
  cobroSeleccionado = signal<any>(null);

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  // Modal para Completados
  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0],
    cliente: ['', Validators.required],
    servicio: ['', Validators.required],
    barbero: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(0)]],
    metodoPago: ['Yape', Validators.required]
  });

  // Modal para Pendientes
  isEditPendienteModalOpen = signal<boolean>(false);
  editPendienteForm = this.fb.nonNullable.group({
    id: [0],
    cliente: ['', Validators.required],
    servicio: ['', Validators.required],
    barbero: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(0)]]
  });

  constructor() {
    // Escuchar cuando cambian el servicio en el modal de completados
    this.editForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) {
        this.editForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false });
      }
    });

    // Escuchar cuando cambian el servicio en el modal de pendientes
    this.editPendienteForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) {
        this.editPendienteForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false });
      }
    });
  }

  abrirModalCobro(id: number) {
    const cobro = this.ultimosMovimientos().find(c => c.id === id);
    if (cobro) {
      this.cobroSeleccionado.set(cobro);
      this.isModalCobroOpen.set(true);
    }
  }

  cerrarModalCobro() {
    this.isModalCobroOpen.set(false);
    setTimeout(() => this.cobroSeleccionado.set(null), 300);
  }

  confirmarCobro(metodo: string) {
    const id = this.cobroSeleccionado()?.id;
    if (id) {
      this.turnosService.actualizarTurno(id, { estado: 'completed', fecha: new Date().toLocaleString('es-PE'), metodoPago: metodo });
      this.toastService.show(`Turno cobrado con ${metodo}`);
    }
    this.cerrarModalCobro();
  }

  verDetalle(id: number) {
    const mov = this.ultimosMovimientos().find(m => m.id === id);
    if (mov) { this.detalleSeleccionado.set(mov); this.isDetalleModalOpen.set(true); }
  }
  
  cerrarDetalle() { 
    this.isDetalleModalOpen.set(false); 
  }

  abrirModalEditar(id: number) {
    const mov = this.ultimosMovimientos().find(m => m.id === id);
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
    const turno = this.ultimosMovimientos().find(t => t.id === id);
    const esPendiente = turno?.estado === 'pending';

    this.confirmConfig.set({
      isOpen: true,
      title: esPendiente ? 'Cancelar Turno' : 'Anular Cobro',
      message: esPendiente ? '¿Estás seguro de cancelar este servicio en curso?' : '¿Estás seguro de anular este registro? Se restará de tu caja.',
      type: 'danger',
      confirmText: esPendiente ? 'Sí, Cancelar' : 'Sí, Anular',
      action: () => {
        this.turnosService.actualizarTurno(id, { estado: 'annulled' });
        this.toastService.show(esPendiente ? 'Turno cancelado exitosamente' : 'Cobro anulado exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }

  restaurarCobro(id: number) {
    this.confirmConfig.set({
      isOpen: true, 
      title: 'Restaurar Cobro', 
      message: '¿Deseas deshacer la anulación y devolver el registro a la caja?', 
      type: 'info', 
      confirmText: 'Sí, Restaurar',
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