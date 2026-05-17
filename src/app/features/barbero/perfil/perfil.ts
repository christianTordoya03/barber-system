import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffService } from '../../../core/services/staff';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ToastService } from '../../../core/services/toast';
import { ComisionesService } from '../../../core/services/comisiones';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { TrabajoPortafolio } from '../../../core/models/marina';

@Component({
  selector: 'app-barbero-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalConfirmComponent],
  templateUrl: './perfil.html'
})
export class BarberoPerfilComponent implements OnInit {
  private staffService = inject(StaffService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private comisionesService = inject(ComisionesService);

  avatarUrl = signal<string | null>(null);
  nombre = signal<string>('Cargando...');
  empleadoId = signal<number | null>(null);
  bio = signal<string>('');

  portafolio = signal<TrabajoPortafolio[]>([]);
  isUploadingPortafolio = signal<boolean>(false);

  // Computamos las ganancias extras globales del barbero logueado
  misComisiones = computed(() => {
    const id = this.empleadoId();
    if (!id) return [];
    return this.comisionesService.comisiones().filter(c =>
      Number(c.empleado_id) === Number(id) &&
      c.estado !== 'anulado'
    );
  });

  totalComisionesAcumuladas = computed(() => {
    return this.misComisiones().reduce((acc, curr) => acc + Number(curr.monto), 0);
  });

  isBioModalOpen = signal<boolean>(false);
  tempBio = signal<string>('');
  isPhotoModalOpen = signal<boolean>(false);
  isTrabajoModalOpen = signal<boolean>(false);
  trabajoSeleccionado = signal<TrabajoPortafolio | null>(null);

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => { } });

  async ngOnInit() {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    const emp = this.staffService.empleados().find(e => e.email === session?.user?.email);

    if (emp) {
      this.empleadoId.set(emp.id!);
      this.nombre.set(emp.nombre);
      this.avatarUrl.set(emp.avatar_url || null);
      this.bio.set(emp.bio || '');
      this.cargarPortafolio(emp.id!);

      this.comisionesService.cargarTodas();
    }
  }

  async cargarPortafolio(id: number) {
    const trabajos = await this.staffService.obtenerPortafolio(id) as TrabajoPortafolio[];
    this.portafolio.set(trabajos);
  }

  private getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.playsInline = true; video.muted = true;
      const timeout = setTimeout(() => { resolve(0); }, 2500);
      video.onloadedmetadata = () => { clearTimeout(timeout); window.URL.revokeObjectURL(video.src); resolve(video.duration); };
      video.onerror = () => { clearTimeout(timeout); resolve(0); };
      video.src = URL.createObjectURL(file); video.load();
    });
  }

  isVideo(url: string | undefined): boolean {
    if (!url) return false;
    return url.toLowerCase().match(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i) !== null;
  }

  async onPortafolioSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.empleadoId()) {

      // Añadimos un límite de peso estricto (Ejemplo: 15MB expresados en bytes)
      const maxSize = 15 * 1024 * 1024;
      if (file.size > maxSize) {
        this.toast.show('El archivo supera el límite de 15MB.', 'error');
        event.target.value = '';
        return;
      }

      if (file.type.startsWith('video/') || this.isVideo(file.name)) {
        const duracion = await this.getVideoDuration(file);
        if (duracion > 10.5) {
          this.toast.show('El video es muy largo. Máximo 10 segundos.', 'error');
          event.target.value = '';
          return;
        }
      }

      this.isUploadingPortafolio.set(true);
      const url = await this.staffService.subirFotoPortafolio(file);
      if (url) {
        const fechaActual = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
        const nuevo = await this.staffService.agregarTrabajoPortafolio({ empleado_id: this.empleadoId()!, url_imagen: url, fecha: fechaActual });
        if (nuevo) {
          this.portafolio.update(p => [nuevo as TrabajoPortafolio, ...p]);
          this.toast.show('¡Trabajo subido al portafolio!');
        }
      }
      this.isUploadingPortafolio.set(false);
      event.target.value = '';
    }
  }

  verTrabajo(trabajo: TrabajoPortafolio) { this.trabajoSeleccionado.set(trabajo); this.isTrabajoModalOpen.set(true); }

  confirmarEliminarDirecto(trabajo: TrabajoPortafolio) {
    this.trabajoSeleccionado.set(trabajo);
    this.confirmConfig.set({
      isOpen: true, title: 'Eliminar Trabajo', message: '¿Eliminar del portafolio?', type: 'danger', confirmText: 'Eliminar',
      action: async () => {
        const t = this.trabajoSeleccionado();
        if (t) {
          await this.staffService.eliminarTrabajoPortafolio(t.id, t.url_imagen);
          this.portafolio.update(p => p.filter(item => item.id !== t.id));
          this.toast.show('Trabajo eliminado');
          this.isTrabajoModalOpen.set(false); this.cerrarConfirmacion();
        }
      }
    });
  }

  confirmarEliminarTrabajo() { this.confirmarEliminarDirecto(this.trabajoSeleccionado()!); }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.empleadoId()) {
      const url = await this.staffService.subirAvatar(file);
      if (url) {
        await this.staffService.actualizarEmpleado(this.empleadoId()!, { avatar_url: url });
        this.avatarUrl.set(url); this.toast.show('¡Imagen actualizada!');
      }
    }
  }

  abrirFoto() { if (this.avatarUrl()) this.isPhotoModalOpen.set(true); else document.querySelector<HTMLInputElement>('#avatarInput')?.click(); }
  cerrarFoto() { this.isPhotoModalOpen.set(false); }

  abrirModalBio() { this.tempBio.set(this.bio()); this.isBioModalOpen.set(true); }

  async guardarBio() {
    if (this.empleadoId()) {
      await this.staffService.actualizarEmpleado(this.empleadoId()!, { bio: this.tempBio() });
      this.bio.set(this.tempBio()); this.isBioModalOpen.set(false); this.toast.show('Descripción actualizada');
    }
  }

  confirmarEliminarBio() {
    this.confirmConfig.set({
      isOpen: true, title: 'Eliminar Descripción', message: '¿Borrar descripción?', type: 'danger', confirmText: 'Eliminar',
      action: async () => {
        await this.staffService.actualizarEmpleado(this.empleadoId()!, { bio: null });
        this.bio.set(''); this.toast.show('Descripción borrada'); this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }
}