import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffService } from '../../../core/services/staff';
import { CatalogoService } from '../../../core/services/catalogo';
import { TurnosService } from '../../../core/services/turnos';
import { ToastService } from '../../../core/services/toast';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout';
import { Servicio, Empleado, TrabajoPortafolio } from '../../../core/models/marina';
import { SupabaseService } from '../../../core/supabase/supabase'; // <-- Importado

@Component({
  selector: 'app-cliente-reservar',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './cliente-reservar.html'
})
export class ClienteReservarComponent implements OnInit {
  private staffService = inject(StaffService);
  private catalogoService = inject(CatalogoService);
  private turnosService = inject(TurnosService);
  private toast = inject(ToastService);
  private layoutPadre = inject(ClienteLayoutComponent);
  private supabase = inject(SupabaseService); // <-- Inyectado

  pasoActual = signal<number>(1);
  reservaConfirmada = signal<boolean>(false);

  // --- SEÑAL PARA EL NOMBRE REAL DEL CLIENTE ---
  nombreUsuarioLogeado = signal<string>('Socio VIP');

  servicios = this.catalogoService.servicios;
  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));

  barberoSeleccionado = signal<Empleado | null>(null);
  portfolioBarbero = signal<TrabajoPortafolio[]>([]); 
  servicioSeleccionado = signal<Servicio | null>(null);
  
  fechaSeleccionada = signal<string>('');
  horaSeleccionada = signal<string>('');
  comentario = signal<string>(''); 

  fechaMinima = computed(() => {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    const localDate = new Date(hoy.getTime() - (offset*60*1000));
    return localDate.toISOString().split('T')[0];
  });

  horaActualMilitar = computed(() => {
    const hoy = new Date();
    return `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}`;
  });

  fechaSeleccionadaFormateada = computed(() => {
    if (!this.fechaSeleccionada()) return '';
    const [year, month, day] = this.fechaSeleccionada().split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${day} de ${meses[parseInt(month, 10) - 1]} del ${year}`;
  });

  horaSeleccionadaFormateada = computed(() => {
    let hora = this.horaSeleccionada();
    if (!hora) return '';
    
    // Si la hora ya viene con el texto AM/PM, la respetamos
    if (hora.toLowerCase().includes('pm') || hora.toLowerCase().includes('am')) {
        return hora.toUpperCase();
    }

    let [h, m] = hora.split(':');
    let hour = parseInt(h, 10);
    
    // FILTRO ANTI-MADRUGADAS: Si marca entre 1 y 7, es PM seguro.
    if (hour > 0 && hour <= 7) {
      hour += 12;
    }

    const ampm = hour >= 12 ? 'PM' : 'AM';
    let hour12 = hour % 12 || 12;
    return `${hour12.toString().padStart(2, '0')}:${m.substring(0, 2)} ${ampm}`;
  });

  horasDisponibles = signal<string[]>([
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30'
  ]);

  horasOcupadas = signal<string[]>([]);
  isTrabajoModalOpen = signal<boolean>(false);
  trabajoSeleccionado = signal<TrabajoPortafolio | null>(null);

  async ngOnInit() {
    this.catalogoService.cargarDatos();
    await this.cargarDatosUsuario(); // <-- Se ejecuta al abrir la pantalla
  }

  // --- FUNCIÓN QUE LEE EL NOMBRE DE LA BD ---
  async cargarDatosUsuario() {
    try {
      const { data: { user } } = await this.supabase.client.auth.getUser();
      if (user) {
        const nombre = user.user_metadata?.['full_name'] || user.user_metadata?.['nombre'] || 'Socio VIP';
        this.nombreUsuarioLogeado.set(nombre);
      }
    } catch (e) {
      console.error('Error al obtener usuario', e);
    }
  }

  async seleccionarBarbero(barbero: Empleado) {
    this.barberoSeleccionado.set(barbero);
    if (barbero.id) {
      const trabajos = await this.staffService.obtenerPortafolio(barbero.id);
      this.portfolioBarbero.set(trabajos);
    }
    if (this.fechaSeleccionada()) await this.consultarDisponibilidad(this.fechaSeleccionada());
    this.pasoActual.set(2);
  }

  async onFechaCambiada(nuevaFecha: string) {
    this.fechaSeleccionada.set(nuevaFecha);
    this.horaSeleccionada.set('');
    await this.consultarDisponibilidad(nuevaFecha);
  }

  private async consultarDisponibilidad(fecha: string) {
    const barbero = this.barberoSeleccionado();
    if (barbero?.nombre) {
      const ocupadas = await this.turnosService.obtenerHorasOcupadas(barbero.nombre, fecha);
      this.horasOcupadas.set(ocupadas);
    }
  }

  verTrabajo(trabajo: TrabajoPortafolio) {
    this.trabajoSeleccionado.set(trabajo);
    this.isTrabajoModalOpen.set(true);
  }

  isVideo(url: string | undefined): boolean {
    if (!url) return false;
    return url.toLowerCase().match(/\.(mp4|webm|mov|quicktime)(\?.*)?$/i) !== null;
  }

  continuarAServicios() {
    if (this.fechaSeleccionada() && this.horaSeleccionada()) {
      this.pasoActual.set(3);
    }
  }

  seleccionarServicio(serv: Servicio) {
    this.servicioSeleccionado.set(serv);
    this.pasoActual.set(4); 
  }

  async confirmarReserva() {
    const barbero = this.barberoSeleccionado();
    const servicio = this.servicioSeleccionado();
    
    if (barbero === null || servicio === null || !this.fechaSeleccionada() || !this.horaSeleccionada()) {
      this.toast.show('Faltan datos para la reserva.', 'error');
      return;
    }

    const [year, month, day] = this.fechaSeleccionada().split('-');
    const fechaLlegada = `${day}/${month}/${year}, ${this.horaSeleccionada()}:00`;

    const nuevoTurno = {
      id: Date.now(), 
      barbero: barbero.nombre, 
      cliente: this.nombreUsuarioLogeado(), // <-- MAGIA APLICADA: Forzamos el nombre seguro
      servicio: servicio.nombre,
      monto: servicio.precio,
      estado: 'pending' as const,
      fecha: fechaLlegada,
      metodoPago: 'Pendiente',
      notas: this.comentario() || '' 
    };

    try {
      await this.turnosService.agregarTurno(nuevoTurno as any);
      this.reservaConfirmada.set(true);
    } catch (error) {
      this.toast.show('Error al agendar la cita.', 'error');
    }
  }

  reiniciarFlujo() {
    this.barberoSeleccionado.set(null);
    this.portfolioBarbero.set([]);
    this.servicioSeleccionado.set(null);
    this.fechaSeleccionada.set('');
    this.horaSeleccionada.set('');
    this.comentario.set('');
    this.horasOcupadas.set([]);
    this.reservaConfirmada.set(false);
    this.pasoActual.set(1);
  }
}