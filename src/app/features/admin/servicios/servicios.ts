import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { ToastService } from '../../../core/services/toast';
import { CatalogoService } from '../../../core/services/catalogo';
import { Servicio } from '../../../core/models/marina';

@Component({
  selector: 'app-servicios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalConfirmComponent],
  templateUrl: './servicios.html',
})
export class ServiciosComponent {
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private catalogoService = inject(CatalogoService);

  servicios = this.catalogoService.servicios;
  categoriasDisponibles = this.catalogoService.categorias; 
  
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  servicioActualId = signal<number | null>(null);

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger'|'info', confirmText: '', action: () => {} });

  servicioForm = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    categoria: ['', Validators.required],
    duracion: [30, [Validators.required, Validators.min(5)]],
    precio: [0, [Validators.required, Validators.min(1)]],
    descripcion: ['']
  });

  abrirModalAgregar() {
    this.isEditing.set(false);
    this.servicioActualId.set(null);
    const primeraCat = this.categoriasDisponibles().length > 0 ? this.categoriasDisponibles()[0].nombre : '';
    this.servicioForm.reset({ categoria: primeraCat, duracion: 30, precio: 0, descripcion: '' });
    this.isModalOpen.set(true);
  }

  abrirModalEditar(servicio: any) {
    this.isEditing.set(true);
    this.servicioActualId.set(servicio.id);
    this.servicioForm.patchValue({ nombre: servicio.nombre, categoria: servicio.categoria, duracion: servicio.duracion, precio: servicio.precio, descripcion: servicio.descripcion });
    this.isModalOpen.set(true);
  }

  cerrarModal() { this.isModalOpen.set(false); }

  guardarServicio() {
    if (this.servicioForm.invalid) { this.servicioForm.markAllAsTouched(); return; }
    const formValues = this.servicioForm.getRawValue() as any;

    if (this.isEditing()) {
      const id = this.servicioActualId();
      if (id) {
        this.catalogoService.actualizarServicio(id, formValues);
        this.toastService.show('Servicio actualizado en la nube');
      }
    } else {
      const nuevoServicio: Servicio = { id: Date.now(), ...formValues, activo: true };
      this.catalogoService.agregarServicio(nuevoServicio);
      this.toastService.show('Servicio creado en la nube');
    }
    this.cerrarModal();
  }

  eliminarServicio(id: number, nombre: string) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Eliminar Servicio',
      message: `¿Estás seguro de que deseas eliminar el servicio "${nombre}"?`,
      type: 'danger',
      confirmText: 'Eliminar',
      action: () => {
        this.catalogoService.eliminarServicio(id);
        this.toastService.show('Servicio eliminado de la nube');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }
}