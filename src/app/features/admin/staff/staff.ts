import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { ToastService } from '../../../core/services/toast';
import { StaffService } from '../../../core/services/staff';
import { GastosService } from '../../../core/services/gastos';
import { Empleado } from '../../../core/models/marina';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalConfirmComponent],
  templateUrl: './staff.html',
})
export class StaffComponent {
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private staffService = inject(StaffService);
  private gastosService = inject(GastosService);

  miembrosStaff = this.staffService.empleados;

  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  miembroActualId = signal<number | null>(null);

  isHistorialModalOpen = signal<boolean>(false);
  nombreEmpleadoHistorial = signal<string>('');
  pagosDelEmpleado = signal<any[]>([]);

  avatarFile = signal<File | null>(null);
  avatarPreview = signal<string | null>(null);
  isUploading = signal<boolean>(false);

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger'|'info', confirmText: '', action: () => {} });

  // 1. ELIMINAMOS LA CONTRASEÑA DE AQUÍ PARA QUE NO LA PIDA
  staffForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    rol: ['barbero', Validators.required],
    comision: [50, [Validators.required, Validators.min(0), Validators.max(100)]]
  });

  constructor() {
    this.staffForm.get('rol')?.valueChanges.subscribe(rol => {
      const comisionCtrl = this.staffForm.get('comision');
      if (rol === 'admin') { comisionCtrl?.disable(); comisionCtrl?.setValue(0); }
       else { comisionCtrl?.enable(); if (comisionCtrl?.value === 0) comisionCtrl?.setValue(50); }
    });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.avatarFile.set(file);
      const reader = new FileReader();
      reader.onload = (e: any) => this.avatarPreview.set(e.target.result);
      reader.readAsDataURL(file);
    }
  }

  abrirHistorialPagos(empleado: Empleado) {
    this.nombreEmpleadoHistorial.set(empleado.nombre);
    const historial = this.gastosService.gastos().filter(g => g.empleado_id === empleado.id && g.estado !== 'anulado');
    this.pagosDelEmpleado.set(historial);
    this.isHistorialModalOpen.set(true);
  }

  abrirModalAgregar() {
    this.isEditing.set(false);
    this.miembroActualId.set(null);
    this.avatarFile.set(null);
    this.avatarPreview.set(null);

    // 2. LIMPIAMOS LA LÓGICA DE VALIDACIÓN DE LA CONTRASEÑA
    this.staffForm.reset({ nombre: '', email: '', telefono: '', rol: 'barbero', comision: 50 });
    this.staffForm.get('comision')?.enable();
    this.isModalOpen.set(true);
  }

  abrirModalEditar(miembro: Empleado) {
    this.isEditing.set(true);
    this.miembroActualId.set(miembro.id!);
    this.avatarFile.set(null);
    this.avatarPreview.set(miembro.avatar_url || null);

    this.staffForm.patchValue({
      nombre: miembro.nombre,
      email: miembro.email,
      telefono: miembro.telefono || '',
      rol: miembro.rol,
      comision: miembro.comision || 0
    });

    if (miembro.rol === 'admin') this.staffForm.get('comision')?.disable();
    else this.staffForm.get('comision')?.enable();

    this.isModalOpen.set(true);
  }

  cerrarModal() {
     this.isModalOpen.set(false);
     this.isUploading.set(false);
  }

  async guardarMiembro() {
    // Si el formulario es inválido, detiene el proceso
    if (this.staffForm.invalid) { this.staffForm.markAllAsTouched(); return; }

    this.isUploading.set(true);

    const formValues = this.staffForm.getRawValue() as any;
    let finalAvatarUrl = this.avatarPreview();

    if (this.avatarFile()) {
      const uploadedUrl = await this.staffService.subirAvatar(this.avatarFile()!);
      if (uploadedUrl) finalAvatarUrl = uploadedUrl;
    }

    const dataAguardar = {
      ...formValues,
      comision: formValues.rol === 'admin' ? null : formValues.comision,
      avatar_url: finalAvatarUrl
    };

    if (this.isEditing()) {
      const id = this.miembroActualId();
      if (id) {
        await this.staffService.actualizarEmpleado(id, dataAguardar);
        this.toastService.show('Personal actualizado en la nube');
      }
    } else {
      const nuevo: Empleado = { id: Date.now(), ...dataAguardar, activo: true };
      await this.staffService.agregarEmpleado(nuevo);
      this.toastService.show('Personal registrado en la nube');
    }

    this.cerrarModal();
  }

  toggleEstadoMiembro(id: number, nombre: string, estadoActual: boolean) {
    const accion = estadoActual ? 'desactivar' : 'reactivar';
    this.confirmConfig.set({
      isOpen: true,
      title: estadoActual ? 'Desactivar Acceso' : 'Reactivar Acceso',
      message: `¿Estás seguro de ${accion} el acceso de "${nombre}"?`,
      type: estadoActual ? 'danger' : 'info',
      confirmText: estadoActual ? 'Desactivar' : 'Reactivar',
      action: () => {
        this.staffService.actualizarEmpleado(id, { activo: !estadoActual });
        this.toastService.show(`Personal ${estadoActual ? 'desactivado' : 'reactivado'} correctamente`);
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }
}