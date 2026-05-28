import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalConfirmComponent],
  templateUrl: './admin-layout.html',
})
export class AdminLayoutComponent implements OnInit{
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  
  isMobileMenuOpen = signal<boolean>(false);
  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });
  esAdmin = signal<boolean>(false);

  async ngOnInit() {
    const { data: { user } } = await this.supabase.client.auth.getUser();
    if (user) {
      const { data } = await this.supabase.client
        .from('empleados')
        .select('rol')
        .eq('email', user.email)
        .maybeSingle();
      this.esAdmin.set(data?.rol?.toLowerCase() === 'admin');
    }
  }

  confirmarLogout() {
    this.isMobileMenuOpen.set(false); // Cerramos el menú móvil si está abierto
    this.confirmConfig.set({
      isOpen: true,
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas salir del panel de administración?',
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