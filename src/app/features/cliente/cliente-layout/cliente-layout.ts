import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm'; // 👈 Se añadió la importación

@Component({
  selector: 'app-cliente-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalConfirmComponent], // 👈 Se agregó a los imports
  templateUrl: './cliente-layout.html',
})
export class ClienteLayoutComponent implements OnInit {
  public supabase = inject(SupabaseService);
  private router = inject(Router);
  
  // Señal para guardar el nombre real del cliente
  nombreCliente = signal<string>('Socio');
  
  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  async ngOnInit() {
    // Extraemos al usuario logueado de la sesión actual
    const { data: { user } } = await this.supabase.client.auth.getUser();
    
    // Al registrarse, guardamos el full_name en los metadatos de Supabase, lo leemos de ahí:
    if (user?.user_metadata?.['full_name']) {
      // Extraemos solo el primer nombre para que el saludo se vea limpio y amigable
      const primerNombre = user.user_metadata['full_name'].split(' ')[0];
      this.nombreCliente.set(primerNombre);
    }
  }

  confirmarLogout() {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Cerrar Sesión',
      message: '¿Estás seguro de que deseas salir de tu cuenta Marina 305?',
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