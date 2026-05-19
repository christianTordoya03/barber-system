import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ToastService } from '../../../core/services/toast'; // <-- Añadimos el Toast
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm'; // <-- Añadimos el Modal

@Component({
  selector: 'app-cliente-perfil',
  standalone: true,
  // ¡IMPORTANTE! Añadimos ModalConfirmComponent a los imports
  imports: [CommonModule, RouterModule, ModalConfirmComponent],
  templateUrl: './cliente-perfil.html',
})
export default class ClientePerfilComponent implements OnInit, OnDestroy {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private toast = inject(ToastService); // Inyectamos el servicio de alertas premium

  private turnoChannel: any;

  nombreCliente = signal('Cargando...');
  nivelActual = signal('Clásico'); 
  cortesAcumulados = signal(0); 
  referidos = signal(0); 
  cortesTotalesHistoricos = signal(0); 
  proximoNivel = signal('Plata');
  cortesParaProximoNivel = signal(10); 
  pestanaNivelActiva = signal<'clasico' | 'plata' | 'oro'>('clasico');
  citaActiva = signal<any>(null);
  historialCitas = signal<any[]>([]);

  // --- CONTROL DE MODALES ---
  isCancelModalOpen = signal(false);
  isLogoutModalOpen = signal(false);

  async ngOnInit() {
    this.solicitarPermisosNotificacion();
    await this.cargarDatosReales();
    this.conectarCanalTiempoReal(); 
  }

  conectarCanalTiempoReal() {
    this.turnoChannel = this.supabase.client
      .channel('cambios-perfil-turnos')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        async () => {
          await this.cargarDatosReales(); 
        }
      )
      .subscribe();
  }

  async cargarDatosReales() {
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      if (!user) {
        this.abrirModalCerrarSesion();
        return;
      }

      const nombreUsuario = user.user_metadata?.['full_name'] || user.user_metadata?.['nombre'] || 'Socio VIP';
      this.nombreCliente.set(nombreUsuario);

      const { data: turnos, error } = await this.supabase.client
        .from('turnos')
        .select('*') 
        .ilike('cliente', `%${nombreUsuario}%`)
        .order('id', { ascending: false });

      if (!error && turnos) {
        this.procesarCitasYGamificacion(turnos);
      }
    } catch (error) {
      console.error('Error cargando el perfil real:', error);
    }
  }

  procesarCitasYGamificacion(turnos: any[]) {
    if (!turnos || turnos.length === 0) {
      this.citaActiva.set(null);
      this.historialCitas.set([]);
      return;
    }

    const pendientes = turnos.filter(t => {
      const estado = (t.estado || '').toLowerCase();
      return estado === 'pendiente' || estado === 'pending' || 
             estado === 'confirmado' || estado === 'confirmed' || 
             estado === 'agendado' || estado === 'en progreso';
    });
    
    const completadas = turnos.filter(t => {
      const estado = (t.estado || '').toLowerCase();
      return estado === 'atendido' || estado === 'completado' || 
             estado === 'completed' || estado === 'cobrado' || 
             estado === 'finalizado';
    });

    const procesarFechaHora = (turno: any) => {
      let fechaFinal = turno.fecha ? turno.fecha.split(',')[0].trim() : 'Fecha a confirmar';
      let horaCruda = '--:--';

      if (turno.hora) {
        horaCruda = turno.hora;
      } else if (turno.fecha && turno.fecha.includes(',')) {
        const partes = turno.fecha.split(',');
        horaCruda = partes.length > 1 ? partes[1].trim() : '--:--';
      }

      let horaAMPM = horaCruda;
      if (horaCruda !== '--:--' && horaCruda.includes(':')) {
        if (horaCruda.toLowerCase().includes('pm') || horaCruda.toLowerCase().includes('am')) {
          horaAMPM = horaCruda.toUpperCase();
        } else {
          let [h, m] = horaCruda.split(':');
          let horas = parseInt(h, 10);
          if (horas > 0 && horas <= 7) horas += 12; 
          const ampm = horas >= 12 ? 'PM' : 'AM';
          let horas12 = horas % 12 || 12; 
          horaAMPM = `${horas12.toString().padStart(2, '0')}:${m.substring(0, 2)} ${ampm}`;
        }
      }

      return { fecha: fechaFinal, hora: horaAMPM };
    };

    if (pendientes.length > 0) {
      const proxima = pendientes[0];
      const { fecha, hora } = procesarFechaHora(proxima);

      this.citaActiva.set({
        id: proxima.id,
        fecha: fecha,
        hora: hora,
        servicio: proxima.servicio || proxima.servicios?.nombre || 'Corte Premium', 
        barbero: proxima.barbero || proxima.empleados?.nombre || 'Staff',         
        estado: proxima.estado
      });
    } else {
      this.citaActiva.set(null);
    }

    this.historialCitas.set(completadas.slice(0, 5).map(t => {
      const { fecha, hora } = procesarFechaHora(t);
      return {
        id: t.id,
        fecha: `${fecha} • ${hora}`,
        servicio: t.servicio || t.servicios?.nombre || 'Corte Premium',
        barbero: t.barbero || t.empleados?.nombre || 'Staff'
      };
    }));

    const total = completadas.length;
    this.cortesTotalesHistoricos.set(total);
    this.cortesAcumulados.set(total % 10); 

    if (total < 10) {
      this.nivelActual.set('Clásico');
      this.proximoNivel.set('Plata');
      this.cortesParaProximoNivel.set(10);
      this.pestanaNivelActiva.set('clasico');
    } else if (total < 25) {
      this.nivelActual.set('Plata');
      this.proximoNivel.set('Oro');
      this.cortesParaProximoNivel.set(25);
      this.pestanaNivelActiva.set('plata');
    } else {
      this.nivelActual.set('Oro');
      this.proximoNivel.set('Diamante'); 
      this.cortesParaProximoNivel.set(total);
      this.pestanaNivelActiva.set('oro');
    }
  }

  cambiarPestanaNivel(nivel: 'clasico' | 'plata' | 'oro') {
    this.hacerVibrarCelular(40);
    this.pestanaNivelActiva.set(nivel);
  }

  solicitarPermisosNotificacion() {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }

  hacerVibrarCelular(patron: number | number[] = 200) {
    if ('vibrate' in navigator) navigator.vibrate(patron);
  }

  enviarNotificacionPush(titulo: string, mensaje: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titulo, {
        body: mensaje,
        icon: '/assets/icons/icon-192x192.png',
        vibrate: [200, 100, 200]
      } as any); 
    }
  }

  // === NUEVAS ACCIONES CON MODALES ===

  abrirModalCancelar() {
    this.hacerVibrarCelular([300, 100, 300]);
    this.isCancelModalOpen.set(true); // Abre el modal de cancelación
  }

  async confirmarCancelacion() {
    this.isCancelModalOpen.set(false); // Cierra el modal primero
    if (this.citaActiva()) {
      try {
        await this.supabase.client
          .from('turnos')
          .update({ estado: 'Cancelado' })
          .eq('id', this.citaActiva().id);

        this.citaActiva.set(null);
        this.enviarNotificacionPush('Cita Cancelada 🚫', 'Tu cita fue cancelada. ¡Te esperamos pronto!');
        this.toast.show('Cita cancelada correctamente.', 'success'); // Usamos el Toast
        await this.cargarDatosReales();
      } catch(e) {
        this.toast.show('Hubo un error al cancelar. Intenta de nuevo.', 'error'); // Toast de error
      }
    }
  }

  abrirModalCerrarSesion() {
    this.hacerVibrarCelular(100);
    this.isLogoutModalOpen.set(true); // Abre el modal de cerrar sesión
  }

  async confirmarCerrarSesion() {
    this.isLogoutModalOpen.set(false);
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/auth/login']);
  }

  ngOnDestroy() {
    if (this.turnoChannel) {
      this.supabase.client.removeChannel(this.turnoChannel);
    }
  }
}