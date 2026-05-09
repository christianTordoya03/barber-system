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

  hoyStr = signal<string>(this.formatDateToDDMMYYYY(new Date()));
  
  diasSemana = signal<any[]>([]);
  diaSeleccionado = signal<Date>(new Date());
  fechaSeleccionadaStr = computed(() => this.formatDateToDDMMYYYY(this.diaSeleccionado()));

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

  // --- MODAL DE EDICIÓN ---
  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0],
    cliente: ['', Validators.required],
    servicio: ['', Validators.required],
    fecha: ['', Validators.required],
    hora: ['', Validators.required],
    monto: [0, [Validators.required, Validators.min(0)]]
  });

  constructor() {
    // Sincronizar monto al cambiar servicio en edición
    this.editForm.get('servicio')?.valueChanges.subscribe(nombre => {
      const s = this.serviciosDisponibles().find(x => x.nombre === nombre);
      if (s) this.editForm.patchValue({ monto: s.precio }, { emitEvent: false });
    });
  }

  ngOnInit() {
    this.generarSemana();
    this.cargarDatosBarbero();

    this.intervalId = setInterval(() => {
      this.now.set(Date.now()); 
      
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

  getFechaActualLocal(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getHoraActualLocal(): string {
    const d = new Date();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
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
        
        const compHora = this.extraerHora(a.fecha).localeCompare(this.extraerHora(b.fecha));
        if (compHora !== 0) return compHora;

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

  adelantosHoy = computed(() => {
    if (!this.empleadoId()) return 0;
    return this.gastosService.gastos()
      .filter(g => 
        g.empleado_id === this.empleadoId() && 
        g.estado === 'activo' && 
        this.esFechaIgual(g.fecha, this.hoyStr())
      )
      .reduce((acc, g) => acc + Number(g.monto), 0);
  });

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
        const prioridad = (estado: string) => {
          switch (estado) {
            case 'in_progress': return 1;
            case 'pending':     return 2;
            case 'finished':    return 3;
            case 'completed':   return 4;
            case 'annulled':    return 5;
            default:            return 6;
          }
        };

        const pA = prioridad(a.estado);
        const pB = prioridad(b.estado);

        if (pA !== pB) return pA - pB;

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
    const gastosPendientes = this.gastosService.gastos()
      .filter(g => g.empleado_id === this.empleadoId() && g.estado === 'activo');
    return gastosPendientes.reduce((acc, g) => acc + Number(g.monto), 0);
  });

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

  // --- MÉTODOS DE RESERVA ---
  abrirModalReserva() {
    this.reservaForm.patchValue({
      fecha: this.getFechaActualLocal(),
      hora: this.getHoraActualLocal()
    });
    this.isReservaModalOpen.set(true);
  }

  async guardarReserva() {
    if (this.reservaForm.invalid) {
      this.reservaForm.markAllAsTouched();
      return;
    }
    const val = this.reservaForm.getRawValue();

    const [year, month, day] = val.fecha.split('-');
    const [hour, minute] = val.hora.split(':');
    
    const fechaLlegada = `${day}/${month}/${year}, ${hour}:${minute}:00`;
    const servicioSeleccionado = this.serviciosDisponibles().find(s => s.nombre === val.servicio);

    const nuevoTurno: Turno = { 
      id: Date.now(),
      servicio: val.servicio,
      barbero: this.nombreCompleto(),
      cliente: val.cliente?.trim() || 'Cliente de paso',
      monto: servicioSeleccionado?.precio || 0,
      estado: 'pending',
      fecha: fechaLlegada,
      metodoPago: 'Pendiente'
    };

    this.turnosService.agregarTurno(nuevoTurno); 
    this.toast.show('¡Reserva agendada con éxito!');
    
    this.isReservaModalOpen.set(false);
    this.reservaForm.reset({
      cliente: '',
      servicio: '',
      fecha: this.getFechaActualLocal(),
      hora: this.getHoraActualLocal()
    });
  }

  // --- MÉTODOS DE EDICIÓN Y ANULACIÓN ---
  abrirModalEditar(turno: Turno) {
    let fechaInput = this.getFechaActualLocal();
    let horaInput = this.getHoraActualLocal();

    if (turno.fecha && turno.fecha.includes(',')) {
      const [fechaPart, horaPart] = turno.fecha.split(',');
      const [d, m, y] = fechaPart.trim().split('/');
      if (d && m && y) {
        fechaInput = `${y}-${m}-${d}`;
      }
      if (horaPart) {
        horaInput = horaPart.trim().substring(0, 5);
      }
    }

    this.editForm.patchValue({
      id: turno.id,
      cliente: turno.cliente || '',
      servicio: turno.servicio,
      fecha: fechaInput,
      hora: horaInput,
      monto: turno.monto
    });
    this.isEditModalOpen.set(true);
  }

  guardarEdicion() {
    if (this.editForm.invalid) return;
    const val = this.editForm.getRawValue();
    const [y, m, d] = val.fecha.split('-');
    const fechaLlegada = `${d}/${m}/${y}, ${val.hora}:00`;

    this.turnosService.actualizarTurno(val.id, {
      cliente: val.cliente,
      servicio: val.servicio,
      fecha: fechaLlegada,
      monto: val.monto
    });

    this.toast.show('Cita actualizada correctamente');
    this.isEditModalOpen.set(false);
  }

  anularTurno(id: number) {
    this.confirmConfig.set({
      isOpen: true,
      title: '¿Anular cita?',
      message: 'Esta acción cancelará el turno y lo quitará de tu agenda de hoy.',
      type: 'danger',
      confirmText: 'Sí, Anular',
      action: () => {
        this.turnosService.actualizarTurno(id, { estado: 'annulled' });
        this.toast.show('Turno anulado exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }
}