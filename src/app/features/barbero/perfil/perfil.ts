import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffService } from '../../../core/services/staff';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ToastService } from '../../../core/services/toast';
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

  avatarUrl = signal<string | null>(null);
  nombre = signal<string>('Cargando...');
  empleadoId = signal<number | null>(null);
  bio = signal<string>('');

  // Portafolio
  portafolio = signal<TrabajoPortafolio[]>([]);
  isUploadingPortafolio = signal<boolean>(false);

  // Estados de Modales
  isBioModalOpen = signal<boolean>(false);
  tempBio = signal<string>('');
  isPhotoModalOpen = signal<boolean>(false); 
  
  // Visor de Portafolio
  isTrabajoModalOpen = signal<boolean>(false);
  trabajoSeleccionado = signal<TrabajoPortafolio | null>(null);

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  async ngOnInit() {
    // CAMBIO AQUÍ
    const { data: { session } } = await this.supabase.client.auth.getSession();
    const emp = this.staffService.empleados().find(e => e.email === session?.user?.email);
    
    if (emp) {
      this.empleadoId.set(emp.id!);
      this.nombre.set(emp.nombre);
      this.avatarUrl.set(emp.avatar_url || null);
      this.bio.set(emp.bio || '');
      this.cargarPortafolio(emp.id!);
    }
  }

  // --- CARGA DE PORTAFOLIO ---
  async cargarPortafolio(id: number) {
    const trabajos = await this.staffService.obtenerPortafolio(id) as TrabajoPortafolio[];
    this.portafolio.set(trabajos);
  }

  // --- NUEVA LÓGICA: VALIDAR DURACIÓN DEL VIDEO ---
  private getVideoDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(video.duration);
      };
      video.src = URL.createObjectURL(file);
    });
  }

  // --- NUEVA LÓGICA: DETECTAR SI ES VIDEO PARA LA VISTA ---
  isVideo(url: string | undefined): boolean {
    if (!url) return false;
    // Comprueba si el archivo termina en extensiones de video conocidas
    return url.toLowerCase().match(/\.(mp4|webm|mov|quicktime)$/i) !== null;
  }

  async onPortafolioSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.empleadoId()) {
      
      // VALIDACIÓN: Si es un video, comprobamos la duración (Máx 10 seg)
      if (file.type.startsWith('video/')) {
        const duracion = await this.getVideoDuration(file);
        if (duracion > 10.5) { // Damos un pequeño margen de medio segundo por precisión
          this.toast.show('El video es muy largo. Máximo 10 segundos.', 'error');
          // Limpiamos el input para que pueda seleccionar otro
          event.target.value = '';
          return;
        }
      }

      this.isUploadingPortafolio.set(true);
      const url = await this.staffService.subirFotoPortafolio(file); 
      
      if (url) {
        const fechaActual = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
        const nuevo = await this.staffService.agregarTrabajoPortafolio({
          empleado_id: this.empleadoId()!,
          url_imagen: url,
          fecha: fechaActual
        });
        
        if (nuevo) {
          this.portafolio.update(p => [nuevo as TrabajoPortafolio, ...p]);
          this.toast.show('¡Trabajo subido al portafolio!');
        }
      } else {
        this.toast.show('Error al subir el archivo', 'error');
      }
      this.isUploadingPortafolio.set(false);
      event.target.value = ''; // Resetear el input
    }
  }

  verTrabajo(trabajo: TrabajoPortafolio) {
    this.trabajoSeleccionado.set(trabajo);
    this.isTrabajoModalOpen.set(true);
  }

  confirmarEliminarDirecto(trabajo: TrabajoPortafolio) {
    this.trabajoSeleccionado.set(trabajo);
    this.confirmConfig.set({
      isOpen: true, 
      title: 'Eliminar Trabajo', 
      message: '¿Estás seguro de que deseas eliminar este trabajo de tu portafolio?', 
      type: 'danger', 
      confirmText: 'Eliminar',
      action: async () => {
        const t = this.trabajoSeleccionado();
        if (t) {
          await this.staffService.eliminarTrabajoPortafolio(t.id, t.url_imagen);
          this.portafolio.update(p => p.filter(item => item.id !== t.id));
          this.toast.show('Trabajo eliminado del portafolio');
          this.isTrabajoModalOpen.set(false);
          this.cerrarConfirmacion();
        }
      }
    });
  }

  confirmarEliminarTrabajo() {
    this.confirmConfig.set({
      isOpen: true, title: 'Eliminar Trabajo', message: '¿Estás seguro de que deseas eliminar este trabajo de tu portafolio?', type: 'danger', confirmText: 'Eliminar',
      action: async () => {
        const t = this.trabajoSeleccionado();
        if (t) {
          await this.staffService.eliminarTrabajoPortafolio(t.id, t.url_imagen);
          this.portafolio.update(p => p.filter(item => item.id !== t.id));
          this.toast.show('Trabajo eliminado');
          this.isTrabajoModalOpen.set(false);
          this.cerrarConfirmacion();
        }
      }
    });
  }

  // --- LÓGICA DE PERFIL Y BIO ---
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file && this.empleadoId()) {
      const url = await this.staffService.subirAvatar(file); 
      if (url) {
        await this.staffService.actualizarEmpleado(this.empleadoId()!, { avatar_url: url });
        this.avatarUrl.set(url);
        this.toast.show('¡Imagen de perfil actualizada!');
      }
    }
  }

  abrirFoto() {
    if (this.avatarUrl()) this.isPhotoModalOpen.set(true);
    else document.querySelector<HTMLInputElement>('#avatarInput')?.click();
  }

  cerrarFoto() {
    this.isPhotoModalOpen.set(false);
  }

  abrirModalBio() {
    this.tempBio.set(this.bio()); 
    this.isBioModalOpen.set(true);
  }

  async guardarBio() {
    if (this.empleadoId()) {
      await this.staffService.actualizarEmpleado(this.empleadoId()!, { bio: this.tempBio() });
      this.bio.set(this.tempBio());
      this.isBioModalOpen.set(false);
      this.toast.show('Descripción actualizada exitosamente');
    }
  }

  confirmarEliminarBio() {
    this.confirmConfig.set({
      isOpen: true, title: 'Eliminar Descripción', message: '¿Borrar tu descripción?', type: 'danger', confirmText: 'Eliminar',
      action: async () => {
        await this.staffService.actualizarEmpleado(this.empleadoId()!, { bio: null });
        this.bio.set('');
        this.toast.show('Descripción eliminada');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }
}