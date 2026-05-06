import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';
import { StaffService } from '../../../core/services/staff';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';

@Component({
  selector: 'app-barbero-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalConfirmComponent],
  templateUrl: './barbero-layout.html'
})
export class BarberoLayoutComponent implements OnInit {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private staffService = inject(StaffService); 

  nombreBarbero = signal<string>('Barbero');
  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  async ngOnInit() {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    const emp = this.staffService.empleados().find(e => e.email === user?.email);
    if (emp) {
      this.nombreBarbero.set(emp.nombre);
    }
  }

  confirmarLogout() {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas salir de tu cuenta?',
      type: 'danger',
      confirmText: 'Sí, Salir',
      action: async () => {
        this.cerrarConfirmacion();
        await this.supabase.client.auth.signOut();
        this.router.navigate(['/login']);
      }
    });
  }

  cerrarConfirmacion() {
    this.confirmConfig.update(c => ({ ...c, isOpen: false }));
  }
}