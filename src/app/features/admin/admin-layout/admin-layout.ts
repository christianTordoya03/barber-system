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
export class AdminLayoutComponent implements OnInit {
  public supabase = inject(SupabaseService);
  private router = inject(Router);
  
  isMobileMenuOpen = signal<boolean>(false);
  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });
  esAdmin = signal<boolean>(false);

  async ngOnInit() {
    await this.supabase.obtenerBarbershopId();
    
    const { data: { user } } = await this.supabase.client.auth.getUser();
    if (user) {
      const { data } = await this.supabase.client
        .from('empleados')
        .select('rol')
        .eq('email', user.email)
        .maybeSingle();
      this.esAdmin.set(data?.rol?.toLowerCase() === 'admin');
    }

    // Ejecutamos la limpieza automática al iniciar el layout
    await this.limpiarCitasFantasmas();
  }

  // --- NUEVA FUNCIÓN: CAZAFANTASMAS ---
  async limpiarCitasFantasmas() {
    try {
      const bsId = this.supabase.tenant()?.id;
      if (!bsId) return;

      // 1. Obtenemos la fecha de hoy en formato YYYY-MM-DD
      const hoy = new Date();
      const hoyStr = `${hoy.getFullYear()}-${(hoy.getMonth() + 1).toString().padStart(2, '0')}-${hoy.getDate().toString().padStart(2, '0')}`;

      // 2. Buscamos todas las citas "pendientes" o "en curso" de la barbería
      const { data: turnosAtrasados, error: fetchError } = await this.supabase.client
        .from('turnos')
        .select('id, fecha, estado')
        .eq('barbershop_id', bsId)
        .in('estado', ['pending', 'pending_confirmation', 'in_progress']);

      if (fetchError || !turnosAtrasados) return;

      // 3. Filtramos SOLO las que son de días anteriores
      const turnosParaAnular = turnosAtrasados.filter(turno => {
        if (!turno.fecha) return false;
        
        // La fecha viene en formato "DD/MM/YYYY, HH:mm:ss"
        const fechaCita = turno.fecha.split(',')[0].trim();
        const [dia, mes, anio] = fechaCita.split('/');
        const fechaCitaFormatoIso = `${anio}-${mes}-${dia}`;
        
        // Comparamos: si la fecha de la cita es MENOR a hoy, es un fantasma
        return fechaCitaFormatoIso < hoyStr;
      });

      // 4. Si hay fantasmas, los anula silenciosamente en bloque
      if (turnosParaAnular.length > 0) {
        const idsParaAnular = turnosParaAnular.map(t => t.id);
        
        await this.supabase.client
          .from('turnos')
          .update({ estado: 'annulled', notas: 'Anulado automáticamente por el sistema (No Show)' })
          .in('id', idsParaAnular);
          
        console.log(`🧹 Limpieza automática: Se anularon ${idsParaAnular.length} citas de días anteriores.`);
      }
    } catch (error) {
      console.error('Error en el limpiador automático:', error);
    }
  }
  // --- FIN CAZAFANTASMAS ---

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