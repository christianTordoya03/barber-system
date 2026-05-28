import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { ToastService } from '../../../core/services/toast';
import { StaffService } from '../../../core/services/staff';
import { GastosService } from '../../../core/services/gastos';
import { SupabaseService } from '../../../core/supabase/supabase'; // <-- INYECTADO
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
  private supabase = inject(SupabaseService); // <-- INYECTADO

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

  staffForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    rol: ['barbero', Validators.required],
    comision: [50, [Validators.required, Validators.min(0), Validators.max(100)]],
    password: [''] // <-- NUEVO CAMPO AÑADIDO
  });

  constructor() {
    this.staffForm.get('rol')?.valueChanges.subscribe(rol => {
      const comisionCtrl = this.staffForm.get('comision');
      // Admin y Recepción no ganan por corte
      if (rol === 'admin' || rol === 'recepcion') { 
        comisionCtrl?.disable(); 
        comisionCtrl?.setValue(0); 
      } else { 
        comisionCtrl?.enable(); 
        if (comisionCtrl?.value === 0) comisionCtrl?.setValue(50); 
      }
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
    
    // Reseteamos incluyendo contraseña obligatoria
    this.staffForm.reset({ nombre: '', email: '', telefono: '', rol: 'barbero', comision: 50, password: '' });
    this.staffForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
    this.staffForm.get('password')?.updateValueAndValidity();
    
    this.staffForm.get('comision')?.enable();
    this.isModalOpen.set(true);
  }

  abrirModalEditar(miembro: Empleado) {
    this.isEditing.set(true);
    this.miembroActualId.set(miembro.id!);
    this.avatarFile.set(null);
    this.avatarPreview.set(miembro.avatar_url || null);

    // Al editar, quitamos la validación de contraseña
    this.staffForm.get('password')?.clearValidators();
    this.staffForm.get('password')?.updateValueAndValidity();

    this.staffForm.patchValue({
      nombre: miembro.nombre,
      email: miembro.email,
      telefono: miembro.telefono || '',
      rol: miembro.rol,
      comision: miembro.comision || 0,
      password: ''
    });

    if (miembro.rol === 'admin' || miembro.rol === 'recepcion') this.staffForm.get('comision')?.disable();
    else this.staffForm.get('comision')?.enable();

    this.isModalOpen.set(true);
  }

  cerrarModal() { 
    this.isModalOpen.set(false); 
    this.isUploading.set(false); 
  }

  async guardarMiembro() {
    if (this.staffForm.invalid) { this.staffForm.markAllAsTouched(); return; }
    this.isUploading.set(true);

    const formValues = this.staffForm.getRawValue() as any;
    let finalAvatarUrl = this.avatarPreview();

    if (this.avatarFile()) {
      const uploadedUrl = await this.staffService.subirAvatar(this.avatarFile()!);
      if (uploadedUrl) finalAvatarUrl = uploadedUrl;
    }

    const dataAguardar = {
      nombre: formValues.nombre,
      email: formValues.email,
      telefono: formValues.telefono,
      rol: formValues.rol,
      comision: formValues.rol === 'admin' || formValues.rol === 'recepcion' ? null : formValues.comision,
      avatar_url: finalAvatarUrl
    };

    if (this.isEditing()) {
      const id = this.miembroActualId();
      if (id) {
        await this.staffService.actualizarEmpleado(id, dataAguardar);
        this.toastService.show('Personal actualizado correctamente');
      }
    } else {
      // NUEVO: CREAR LA CUENTA REAL EN SUPABASE AUTH
      const { error } = await this.supabase.client.auth.signUp({
        email: formValues.email,
        password: formValues.password,
        options: {
          data: { full_name: formValues.nombre, telefono: formValues.telefono }
        }
      });

      if (error) {
        this.toastService.show('Error al registrar credenciales: ' + error.message, 'error');
        this.isUploading.set(false);
        return;
      }

      // Si se crea en Auth, lo guardamos en la tabla empleados
      const nuevo: Empleado = { id: Date.now(), ...dataAguardar, activo: true };
      await this.staffService.agregarEmpleado(nuevo);
      this.toastService.show(`Registrado. Clave: ${formValues.password}`);
    }

    this.cerrarModal();
  }

  toggleEstadoMiembro(id: number, nombre: string, estadoActual: boolean) {
    const accion = estadoActual ? 'desactivar' : 'reactivar';
    this.confirmConfig.set({
      isOpen: true,
      title: estadoActual ? 'Desactivar Acceso' : 'Reactivar Acceso',
      message: `¿Es seguro de ${accion} el acceso de "${nombre}"?`,
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