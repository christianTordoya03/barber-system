import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { StaffService } from '../../../core/services/staff';
import { GastosService } from '../../../core/services/gastos';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ToastService } from '../../../core/services/toast';
import { CatalogoService } from '../../../core/services/catalogo';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { Turno } from '../../../core/models/marina';

@Component({
  selector: 'app-barbero-dashboard',
  standalone: true,
  imports: [CommonModule, ModalConfirmComponent, ReactiveFormsModule],
  templateUrl: './dashboard.html'
})
export class BarberoDashboardComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private staffService = inject(StaffService);
  private gastosService = inject(GastosService);
  private supabase = inject(SupabaseService);
  private toast = inject(ToastService);
  private catalogoService = inject(CatalogoService);

  nombreCompleto = signal<string>('');
  nombreCorto = signal<string>('Barbero');
  miEstado = computed(() => {
    const emp = this.staffService.empleados().find(e => e.id === this.empleadoId());
    return emp?.estado_asistencia || 'descanso';
  });

  cambiarMiEstado(nuevoEstado: 'disponible' | 'pausa') {
    if (!this.empleadoId()) return;
    const payload: any = { estado_asistencia: nuevoEstado };
    
    // Si se pone disponible, guardamos el milisegundo exacto para la fila
    if (nuevoEstado === 'disponible') {
      payload.ultima_vez_disponible = new Date().toISOString();
    }
    
    this.staffService.actualizarEmpleado(this.empleadoId()!, payload);
    this.toast.show(`Estado cambiado a: ${nuevoEstado}`);
  }
  empleadoId = signal<number | null>(null);
  comisionPorcentaje = signal<number>(50);
  serviciosDisponibles = this.catalogoService.servicios;

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'info' as 'info'|'danger', confirmText: '', action: () => {} });

  // CONVERTIDO A SEÑAL PARA REACCIONAR A LA MEDIANOCHE
  hoyStr = signal<string>(this.formatDateToDDMMYYYY(new Date()));
  
  diasSemana = signal<any[]>([]);
  diaSeleccionado = signal<Date>(new Date());
  fechaSeleccionadaStr = computed(() => this.formatDateToDDMMYYYY(this.diaSeleccionado()));

  // Cronómetro en vivo
  now = signal(Date.now());
  intervalId: any;

  // --- MODAL DE NUEVA RESERVA ---
  isReservaModalOpen = signal<boolean>(false);
  reservaForm = this.fb.nonNullable.group({
    cliente: ['', Validators.required],
    servicio: ['', Validators.required],
    fecha: ['', Validators.required],
    hora: ['10:00', Validators.required]
  });

  ngOnInit() {
    this.generarSemana();
    this.cargarDatosBarbero();

    // EL CORAZÓN DEL SISTEMA: Late cada 10 segundos
    this.intervalId = setInterval(() => {
      this.now.set(Date.now()); // Avanza las barras de progreso
      
      // MAGIA NOCTURNA: Si cambió el día, actualizamos todo
      const fechaActualReal = this.formatDateToDDMMYYYY(new Date());
      if (this.hoyStr() !== fechaActualReal) {
        this.hoyStr.set(fechaActualReal);
        this.diaSeleccionado.set(new Date());
        this.generarSemana();

        this.staffService.cargarEmpleados();
      }
    }, 10000);
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  // --- EXTRACCIÓN LIMPIA DE SUPABASE ---
  async cargarDatosBarbero() {
    const { data: { session } } = await this.supabase.client.auth.getSession();
    const emp = this.staffService.empleados().find(e => e.email === session?.user?.email);
    
    if (emp) {
      this.nombreCompleto.set(emp.nombre);
      this.nombreCorto.set(emp.nombre.split(' ')[0]);
      this.empleadoId.set(emp.id!);
      this.comisionPorcentaje.set(emp.comision || 50);
    }
  }

  private parseDateStr(fechaStr: string) {
    const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return { day: match[1].padStart(2, '0'), month: match[2].padStart(2, '0'), year: match[3] };
    return null;
  }

  private esFechaIgual(fechaBD: string, fechaFormateada: string): boolean {
    const d = this.parseDateStr(fechaBD);
    if (!d) return false;
    return `${d.day}/${d.month}/${d.year}` === fechaFormateada;
  }

  private getValorFecha(fechaStr: string): number {
    const d = this.parseDateStr(fechaStr);
    if (!d) return 0;
    return parseInt(`${d.year}${d.month}${d.day}`);
  }

  misTurnosTotales = computed(() => this.turnosService.turnos().filter(t => t.barbero === this.nombreCompleto()));
  turnosDeHoy = computed(() => this.misTurnosTotales().filter(t => this.esFechaIgual(t.fecha, this.hoyStr())));
  
  colaTrabajo = computed(() => {
    const hoyVal = this.getValorFecha(this.hoyStr());
    
    return this.misTurnosTotales()
      .filter(t => {
        const turnoVal = this.getValorFecha(t.fecha);
        if (turnoVal > hoyVal) return false; 
        return t.estado === 'pending' || t.estado === 'in_progress';
      })
      .sort((a, b) => {
        const valA = this.getValorFecha(a.fecha);
        const valB = this.getValorFecha(b.fecha);
        if (valA !== valB) return valA - valB;
        
        // 1. Intentamos ordenar por la hora extraída
        const compHora = this.extraerHora(a.fecha).localeCompare(this.extraerHora(b.fecha));
        if (compHora !== 0) return compHora;

        // 2. DESEMPATE: Si tienen la misma hora exacta, va primero el más antiguo (el que se registró primero)
        return a.id - b.id; 
      });
  });

  turnoActual = computed(() => this.colaTrabajo().length > 0 ? this.colaTrabajo()[0] : null);
  turnosEnEspera = computed(() => this.colaTrabajo().slice(1));

  progresoActual = computed(() => {
    const turno = this.turnoActual();
    if (!turno || turno.estado !== 'in_progress' || !turno.horaInicio) return 0;
    const srv = this.serviciosDisponibles().find(s => s.nombre === turno.servicio);
    const duracionMinutos = srv?.duracion || 30;
    const inicioMs = new Date(turno.horaInicio).getTime();
    const transcurridoMin = (this.now() - inicioMs) / 60000;
    let prog = (transcurridoMin / duracionMinutos) * 100;
    return Math.min(Math.max(prog, 0), 100);
  });

  // 1. Adelantos recibidos específicamente HOY
  adelantosHoy = computed(() => {
    if (!this.empleadoId()) return 0;
    return this.gastosService.gastos()
      .filter(g => 
        g.empleado_id === this.empleadoId() && 
        g.estado === 'activo' && 
        this.esFechaIgual(g.fecha, this.hoyStr()) // Comparamos con la fecha actual
      )
      .reduce((acc, g) => acc + Number(g.monto), 0);
  });

  // 2. Deuda Total (Suma de todos los préstamos activos sin importar la fecha)
  deudaTotalAcumulada = computed(() => {
    if (!this.empleadoId()) return 0;
    return this.gastosService.gastos()
      .filter(g => g.empleado_id === this.empleadoId() && g.estado === 'activo')
      .reduce((acc, g) => acc + Number(g.monto), 0);
  });

  turnosAgenda = computed(() => {
  return this.misTurnosTotales()
    .filter(t => this.esFechaIgual(t.fecha, this.fechaSeleccionadaStr()))
    .sort((a, b) => {
      // Definimos los pesos de prioridad
      const prioridad = (estado: string) => {
        switch (estado) {
          case 'in_progress': return 1; // En curso
          case 'pending':     return 2; // Pendiente
          case 'finished':    return 3; // 3. Terminado (Esperando pago)    
          case 'completed':   return 4; // 4 Pagado/Terminado
          case 'annulled':    return 5; // 5 Anulado
          default:            return 6;
        }
      };

      const pA = prioridad(a.estado);
      const pB = prioridad(b.estado);

      // Si tienen distinta prioridad, ordenamos por ella
      if (pA !== pB) return pA - pB;

      // Si tienen la misma prioridad (ej. dos pendientes), ordenamos por hora e ID (desempate)
      const compHora = this.extraerHora(a.fecha).localeCompare(this.extraerHora(b.fecha));
      if (compHora !== 0) return compHora;
      
      return a.id - b.id;
    });
});

  dineroGeneradoHoy = computed(() => {
    const terminados = this.turnosDeHoy().filter(t => t.estado === 'finished' || t.estado === 'completed');
    return terminados.reduce((acc, t) => acc + Number(t.monto), 0);
  });

  comisionGanadaHoy = computed(() => (this.dineroGeneradoHoy() * this.comisionPorcentaje()) / 100);

  deudaTotalPendiente = computed(() => {
    if (!this.empleadoId()) return 0;
    
    // Filtramos TODOS los gastos de este empleado que sigan 'activos' 
    // (Sin importar la fecha, hasta que el admin los liquide)
    const gastosPendientes = this.gastosService.gastos()
      .filter(g => g.empleado_id === this.empleadoId() && g.estado === 'activo');
      
    return gastosPendientes.reduce((acc, g) => acc + Number(g.monto), 0);
  });

  // El Neto ahora resta toda la deuda acumulada
  netoEstimadoHoy = computed(() => this.comisionGanadaHoy() - this.deudaTotalAcumulada());

  formatDateToDDMMYYYY(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  extraerHora(fechaCompleta: string): string {
    if (!fechaCompleta.includes(',')) return '--:--';
    const timePart = fechaCompleta.split(',')[1].trim(); 
    const match = timePart.match(/(\d{1,2}):(\d{2})/);
    if (!match) return '--:--';
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const esPM = timePart.toLowerCase().includes('p');
    const esAM = timePart.toLowerCase().includes('a');
    if (esPM && hours < 12) hours += 12;
    if (esAM && hours === 12) hours = 0;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12;
    h12 = h12 ? h12 : 12; 
    return `${h12}:${minutes} ${ampm}`;
  }

  generarSemana() {
    const hoy = new Date();
    const diaSemana = hoy.getDay() === 0 ? 7 : hoy.getDay(); 
    const primerDia = new Date(hoy);
    primerDia.setDate(hoy.getDate() - diaSemana + 1);

    const semana = [];
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(primerDia);
      fecha.setDate(primerDia.getDate() + i);
      semana.push({
        fechaCompleta: fecha,
        diaNombre: nombresDias[fecha.getDay()],
        diaNumero: fecha.getDate(),
        esHoy: fecha.toDateString() === hoy.toDateString(),
        fechaFormateada: this.formatDateToDDMMYYYY(fecha)
      });
    }
    this.diasSemana.set(semana);
  }

  seleccionarDia(fecha: Date) {
    this.diaSeleccionado.set(fecha);
  }

  tieneTurnos(fechaStr: string): boolean {
    return this.misTurnosTotales().some(t => this.esFechaIgual(t.fecha, fechaStr));
  }

  iniciarCorte(turno: Turno) {
    this.turnosService.actualizarTurno(turno.id, { 
      estado: 'in_progress', 
      horaInicio: new Date().toISOString() 
    });
    // <-- NUEVO: Ponemos al barbero en "Ocupado" automáticamente
    if (this.empleadoId()) {
      this.staffService.actualizarEmpleado(this.empleadoId()!, { estado_asistencia: 'ocupado' });
    }
  }

  confirmarTerminar(turno: Turno) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Terminar Servicio',
      message: `¿Confirmas que terminaste el corte de ${turno.cliente || 'este cliente'}? Se le indicará pasar a caja.`,
      type: 'info',
      confirmText: 'Sí, Terminar',
      action: () => {
        this.turnosService.actualizarTurno(turno.id, { estado: 'finished' });
        // <-- NUEVO: El barbero vuelve a Disponible y se va al final de la fila
        if (this.empleadoId()) {
          this.staffService.actualizarEmpleado(this.empleadoId()!, { 
            estado_asistencia: 'disponible',
            ultima_vez_disponible: new Date().toISOString()
          });
        }
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() {
    this.confirmConfig.update(c => ({ ...c, isOpen: false }));
  }

  abrirModalReserva() {
    const yyyy = this.diaSeleccionado().getFullYear();
    const mm = (this.diaSeleccionado().getMonth() + 1).toString().padStart(2, '0');
    const dd = this.diaSeleccionado().getDate().toString().padStart(2, '0');
    
    this.reservaForm.reset({
      cliente: '',
      servicio: '',
      fecha: `${yyyy}-${mm}-${dd}`,
      hora: '10:00'
    });
    this.isReservaModalOpen.set(true);
  }

  guardarReserva() {
    if (this.reservaForm.invalid) {
      this.reservaForm.markAllAsTouched();
      return;
    }
    const formValues = this.reservaForm.getRawValue();
    const [year, month, day] = formValues.fecha.split('-');
    const [hour, minute] = formValues.hora.split(':');
    const fechaObj = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const fechaCompleta = fechaObj.toLocaleString('es-PE');
    
    const servicioObj = this.serviciosDisponibles().find(s => s.nombre === formValues.servicio);

    const nuevaReserva: Turno = {
      id: Date.now(),
      servicio: formValues.servicio,
      barbero: this.nombreCompleto(),
      cliente: formValues.cliente.trim(),
      monto: servicioObj?.precio || 0,
      estado: 'pending',
      fecha: fechaCompleta, 
      metodoPago: 'Pendiente'
    };

    this.turnosService.agregarTurno(nuevaReserva);
    this.toast.show('¡Reserva agregada a tu agenda!');
    this.isReservaModalOpen.set(false);
  }
}