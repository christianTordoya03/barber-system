import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { ToastService } from '../../../core/services/toast';
import { CatalogoService } from '../../../core/services/catalogo';
import { Categoria } from '../../../core/models/marina';

@Component({
  selector: 'app-categorias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalConfirmComponent],
  templateUrl: './categorias.html',
})
export class CategoriasComponent {
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);
  private catalogoService = inject(CatalogoService);

  categorias = this.catalogoService.categorias;
  isModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  categoriaActualId = signal<number | null>(null);

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger'|'info', confirmText: '', action: () => {} });

  categoriaForm = this.fb.nonNullable.group({ nombre: ['', Validators.required] });

  abrirModalAgregar() {
    this.isEditing.set(false);
    this.categoriaActualId.set(null);
    this.categoriaForm.reset();
    this.isModalOpen.set(true);
  }

  abrirModalEditar(categoria: any) {
    this.isEditing.set(true);
    this.categoriaActualId.set(categoria.id);
    this.categoriaForm.patchValue({ nombre: categoria.nombre });
    this.isModalOpen.set(true);
  }

  cerrarModal() { this.isModalOpen.set(false); }

  guardarCategoria() {
    if (this.categoriaForm.invalid) return;
    const { nombre } = this.categoriaForm.getRawValue();

    if (this.isEditing()) {
      const id = this.categoriaActualId();
      if (id) {
        this.catalogoService.actualizarCategoria(id, { nombre });
        this.toastService.show('Categoría actualizada en la nube');
      }
    } else {
      const nueva: Categoria = { id: Date.now(), nombre };
      this.catalogoService.agregarCategoria(nueva);
      this.toastService.show('Categoría creada en la nube');
    }
    this.cerrarModal();
  }

  eliminarCategoria(id: number, nombre: string) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Eliminar Categoría',
      message: `¿Estás seguro de eliminar la categoría "${nombre}"?`,
      type: 'danger',
      confirmText: 'Eliminar',
      action: () => {
        this.catalogoService.eliminarCategoria(id);
        this.toastService.show('Categoría eliminada de la nube');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }
}