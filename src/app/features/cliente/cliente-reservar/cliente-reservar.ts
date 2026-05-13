import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { StaffService } from '../../../core/services/staff';
import { CatalogoService } from '../../../core/services/catalogo';
import { TurnosService } from '../../../core/services/turnos'; // <-- 1. INYECTAR SERVICIO
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout';
import { Servicio, Empleado, TrabajoPortafolio } from '../../../core/models/marina';

@Component({
  selector: 'app-cliente-reservar',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './cliente-reservar.html'
})
export class ClienteReservarComponent implements OnInit {
  private staffService = inject(StaffService);
  private catalogoService = inject(CatalogoService);
  private turnosService = inject(TurnosService); // <-- 2. INSTANCIAR
  private layoutPadre = inject(ClienteLayoutComponent);

  pasoActual = signal<number>(1);
  reservaConfirmada = signal<boolean>(false);

  servicios = this.catalogoService.servicios;
  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));

  barberoSeleccionado = signal<Empleado | null>(null);
  portfolioBarbero = signal<TrabajoPortafolio[]>([]); 
  servicioSeleccionado = signal<Servicio | null>(null);
  
  fechaSeleccionada = signal<string>('');
  horaSeleccionada = signal<string>('');
  comentario = signal<string>(''); 

  fechaMinima = computed(() => new Date().toISOString().split('T')[0]);

  // Lista base de todas las horas posibles
  horasDisponibles = signal<string[]>([
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30'
  ]);

  // <-- 3. NUEVA SEÑAL: Almacenará dinámicamente las horas que ya tienen dueño
  horasOcupadas = signal<string[]>([]);

  isTrabajoModalOpen = signal<boolean>(false);
  trabajoSeleccionado = signal<TrabajoPortafolio | null>(null);

  ngOnInit() {
    this.catalogoService.cargarDatos();
  }

  async seleccionarBarbero(barbero: Empleado) {
    this.barberoSeleccionado.set(barbero);
    const trabajos = await this.staffService.obtenerPortafolio(barbero.id);
    this.portfolioBarbero.set(trabajos);
    
    // Si por alguna razón ya había una fecha escrita, consultamos disponibilidad
    if (this.fechaSeleccionada()) {
      await this.consultarDisponibilidad(this.fechaSeleccionada());
    }
    
    this.pasoActual.set(2);
  }

  // <-- 4. NUEVO MÉTODO: Se ejecuta al cambiar la fecha en el calendario
  async onFechaCambiada(nuevaFecha: string) {
    this.fechaSeleccionada.set(nuevaFecha);
    this.horaSeleccionada.set(''); // Limpiamos la hora si cambia de día
    await this.consultarDisponibilidad(nuevaFecha);
  }

  private async consultarDisponibilidad(fecha: string) {
    const barbero = this.barberoSeleccionado();
    if (barbero && barbero.id) {
      // Pedimos a Supabase las horas ocupadas de este barbero en este día
      const ocupadas = await this.turnosService.obtenerHorasOcupadas(barbero.id, fecha);
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

  confirmarReserva() {
    this.reservaConfirmada.set(true);
  }

  reiniciarFlujo() {
    this.barberoSeleccionado.set(null);
    this.portfolioBarbero.set([]);
    this.servicioSeleccionado.set(null);
    this.fechaSeleccionada.set('');
    this.horaSeleccionada.set('');
    this.comentario.set('');
    this.horasOcupadas.set([]); // Limpiamos bloqueos
    this.reservaConfirmada.set(false);
    this.pasoActual.set(1);
  }
}