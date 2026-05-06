import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StaffService } from '../../../core/services/staff'; 
import { ToastService } from '../../../core/services/toast';
import { TurnosService } from '../../../core/services/turnos'; // <-- IMPORTANTE
import { ModalConfirmComponent } from '../modal-confirm/modal-confirm'; // <-- IMPORTANTE

@Component({
  selector: 'app-orden-atencion',
  standalone: true,
  imports: [CommonModule, ModalConfirmComponent],
  templateUrl: './orden-atencion.html',
  styles: [`
    .hide-scroll::-webkit-scrollbar { display: none; }
    .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  `]
})
export class OrdenAtencionComponent {
  staffService = inject(StaffService);
  toastService = inject(ToastService);
  turnosService = inject(TurnosService);

  // Variables para el Modal de Confirmación
  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });
  
  // Variables para controlar la vista del "Select" si el usuario cancela
  selectElementAManejar: HTMLSelectElement | null = null;
  estadoOriginal: string = 'descanso';

  barberosOrdenados = computed(() => {
    let lista = [...this.staffService.empleados().filter(e => e.rol === 'barbero')];
    return lista.sort((a, b) => {
      const getPriority = (estado?: string) => {
         if (estado === 'disponible') return 1;
         if (estado === 'ocupado') return 2;
         if (estado === 'pausa') return 3;
         return 4; // descanso
      };
      const pA = getPriority(a.estado_asistencia);
      const pB = getPriority(b.estado_asistencia);

      if (pA !== pB) return pA - pB;

      if (a.estado_asistencia === 'disponible' && b.estado_asistencia === 'disponible') {
         const timeA = a.ultima_vez_disponible ? new Date(a.ultima_vez_disponible).getTime() : 0;
         const timeB = b.ultima_vez_disponible ? new Date(b.ultima_vez_disponible).getTime() : 0;
         return timeA - timeB; 
      }
      return 0;
    });
  });

  cambiarEstadoBarbero(id: number, event: Event) {
    const target = event.target as HTMLSelectElement;
    const nuevoEstado = target.value as 'disponible' | 'ocupado' | 'pausa' | 'descanso';
    const barbero = this.staffService.empleados().find(e => e.id === id);

    // Verificamos si tiene un corte "en curso" activo
    const tieneCorteActivo = this.turnosService.turnos().some(t => 
      t.barbero === barbero?.nombre && t.estado === 'in_progress'
    );

    // SI ESTÁ OCUPADO (Cortando) Y TRATAS DE CAMBIARLO A OTRA COSA -> MOSTRAR MODAL
    if (tieneCorteActivo && nuevoEstado !== 'ocupado') {
      
      // Guardamos la referencia para revertir la vista si le damos a "Cancelar"
      this.selectElementAManejar = target;
      this.estadoOriginal = barbero?.estado_asistencia || 'descanso';

      this.confirmConfig.set({
        isOpen: true,
        title: 'Barbero en un Corte',
        message: `El barbero ${barbero?.nombre?.split(' ')[0]} tiene un corte activo en este momento.\n\nSi olvidó cerrarlo en su aplicación, te recomendamos cerrarlo primero desde la Agenda. ¿Estás seguro de forzar su estado a ${nuevoEstado}?`,
        type: 'danger',
        confirmText: 'Sí, Forzar Cambio',
        action: () => {
          this.selectElementAManejar = null; // Limpiamos para no revertir
          this.ejecutarCambio(id, nuevoEstado);
          this.confirmConfig.update(c => ({ ...c, isOpen: false }));
        }
      });
      return;
    }

    // Si no está ocupado, o el Admin lo está poniendo explícitamente en "ocupado", pasa directo
    this.ejecutarCambio(id, nuevoEstado);
  }

  ejecutarCambio(id: number, nuevoEstado: string) {
    const barbero = this.staffService.empleados().find(e => e.id === id);
    const nombreBarbero = barbero?.nombre;

    // 1. Si lo ponemos disponible, buscamos si dejó un corte "En curso"
    if (nuevoEstado === 'disponible' && nombreBarbero) {
      const corteActivo = this.turnosService.turnos().find(t => 
        t.barbero === nombreBarbero && t.estado === 'in_progress'
      );

      // 2. Si existe, lo cerramos automáticamente como "Terminado" (finished)
      if (corteActivo) {
        this.turnosService.actualizarTurno(corteActivo.id, { estado: 'finished' });
        this.toastService.show(`Corte de ${corteActivo.cliente} movido a 'Terminado'`);
      }
    }

    // 3. Actualizamos el estado del empleado como siempre
    const payload: any = { estado_asistencia: nuevoEstado };
    if (nuevoEstado === 'disponible') {
      payload.ultima_vez_disponible = new Date().toISOString();
    }

    this.staffService.actualizarEmpleado(id, payload);
    this.toastService.show(`Estado de ${nombreBarbero?.split(' ')[0]} cambiado a ${nuevoEstado}`);
  }

  cancelarCambio() {
    // Si el usuario cancela, el select regresa visualmente al estado donde estaba
    if (this.selectElementAManejar) {
      this.selectElementAManejar.value = this.estadoOriginal;
      this.selectElementAManejar = null;
    }
    this.confirmConfig.update(c => ({ ...c, isOpen: false }));
  }
}