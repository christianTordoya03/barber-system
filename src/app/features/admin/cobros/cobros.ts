import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ModalDetalleComponent } from '../../../shared/ui/modal-detalle/modal-detalle';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { TurnosService } from '../../../core/services/turnos';
import { ToastService } from '../../../core/services/toast';
import { StaffService } from '../../../core/services/staff';
import { CatalogoService } from '../../../core/services/catalogo';
import { SupabaseService } from '../../../core/supabase/supabase';

@Component({
  selector: 'app-cobros',
  standalone: true,
  imports: [CommonModule, RouterModule, ModalDetalleComponent, ModalConfirmComponent, ReactiveFormsModule],
  templateUrl: './cobros.html',
})
export class CobrosComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private toastService = inject(ToastService);
  private staffService = inject(StaffService);
  private catalogoService = inject(CatalogoService);
  private supabase = inject(SupabaseService);

  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));
  servicios = this.catalogoService.servicios;
  esAdmin = signal<boolean>(false);

  hoyStr = signal<string>(this.formatDateToDDMMYYYY(new Date()));

  searchTerm = signal<string>('');
  searchBarbero = signal<string>(''); 
  currentPage = signal<number>(1);
  pageSize = 10;

  now = signal(Date.now());
  intervalId: any;

  async ngOnInit() {
    this.intervalId = setInterval(() => {
      this.now.set(Date.now());
      const fechaActualReal = this.formatDateToDDMMYYYY(new Date());
      if (this.hoyStr() !== fechaActualReal) {
        this.hoyStr.set(fechaActualReal);
      }
    }, 10000);

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

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  formatDateToDDMMYYYY(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  private obtenerMinutosDesdeFecha(fechaStr: string): number {
    if (!fechaStr) return 0;
    const timePart = fechaStr.includes(',') ? fechaStr.split(',')[1].trim() : fechaStr.split(' ')[1]?.trim() || '';
    const match = timePart.match(/(\d{1,2}):(\d{2})/);
    if (!match) return 0;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    
    if (timePart.toLowerCase().includes('p') && hours < 12) hours += 12;
    if (timePart.toLowerCase().includes('a') && hours === 12) hours = 0;
    
    return (hours * 60) + minutes;
  }

  barberoSeleccionadoParaCobro = signal<string>('');

  turnosParaCobrar = computed(() => {
    const hoyVal = this.getValorFecha(this.hoyStr());
    const filtrados = this.turnosService.turnos().filter(t => {
      const turnoVal = this.getValorFecha(t.fecha);
      if (turnoVal > hoyVal) return false; 
      return (t.estado === 'pending' || t.estado === 'in_progress' || t.estado === 'finished');
    });

    return filtrados.sort((a, b) => {
      const getPriority = (estado: string) => {
        if (estado === 'finished') return 1; 
        if (estado === 'in_progress') return 2;
        if (estado === 'pending') return 3;
        return 4;
      };
      
      const pA = getPriority(a.estado);
      const pB = getPriority(b.estado);
      
      if (pA !== pB) return pA - pB;
      return a.id - b.id; 
    });
  });

  turnosParaCobrarFiltrados = computed(() => {
    const filtro = this.barberoSeleccionadoParaCobro();
    const todos = this.turnosParaCobrar();
    if (!filtro) return todos;
    return todos.filter(t => t.barbero === filtro);
  });

  turnosLista = computed(() => {
    const hoyVal = this.getValorFecha(this.hoyStr());
    
    const filtrados = this.turnosService.turnos().filter(t => {
      const turnoVal = this.getValorFecha(t.fecha);
      if (turnoVal > hoyVal) return false; 
      if (turnoVal === hoyVal) return true; 
      return (t.estado === 'pending' || t.estado === 'in_progress' || t.estado === 'finished');
    });

    return filtrados.sort((a, b) => {
      const getPriority = (estado: string) => {
        if (estado === 'finished') return 1;    
        if (estado === 'in_progress') return 2; 
        if (estado === 'pending') return 3;     
        if (estado === 'completed') return 4;   
        return 5;                               
      };
      
      const pA = getPriority(a.estado);
      const pB = getPriority(b.estado);
      
      if (pA !== pB) return pA - pB;
      
      // --- CORRECCIÓN: ORDENAMIENTO CRONOLÓGICO REAL ---
      const valDiaA = this.getValorFecha(a.fecha);
      const valDiaB = this.getValorFecha(b.fecha);
      const minA = this.obtenerMinutosDesdeFecha(a.fecha);
      const minB = this.obtenerMinutosDesdeFecha(b.fecha);

      if (a.estado === 'completed' || a.estado === 'annulled') {
        // Los completados/anulados: El más reciente arriba (Descendente)
        if (valDiaA !== valDiaB) return valDiaB - valDiaA;
        if (minA !== minB) return minB - minA;
        return b.id - a.id; // Desempate por ID si tienen exactamente el mismo minuto
      } else {
        // Los pendientes/en_curso: El más antiguo arriba (Ascendente para atenderlos primero)
        if (valDiaA !== valDiaB) return valDiaA - valDiaB;
        if (minA !== minB) return minA - minB;
        return a.id - b.id; 
      }
    });
  });

  turnosFiltradosBusqueda = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const barberoFiltro = this.searchBarbero();
    let lista = this.turnosLista();

    if (barberoFiltro) lista = lista.filter(t => t.barbero === barberoFiltro);
    if (term) lista = lista.filter(t => t.cliente?.toLowerCase().includes(term) || t.servicio?.toLowerCase().includes(term));
    return lista;
  });

  paginatedTurnos = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return this.turnosFiltradosBusqueda().slice(startIndex, startIndex + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.turnosFiltradosBusqueda().length / this.pageSize) || 1);

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
    this.currentPage.set(1);
  }

  onSearchBarbero(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.searchBarbero.set(target.value);
    this.currentPage.set(1);
  }

  nextPage() { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }
  prevPage() { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }

  getDuracionServicio(nombreServicio: string): number {
    const srv = this.servicios().find(s => s.nombre === nombreServicio);
    return srv?.duracion || 30;
  }

  calcularProgreso(turno: any): number {
    if (turno.estado !== 'in_progress' || !turno.horaInicio) return 0;
    const duracionMinutos = this.getDuracionServicio(turno.servicio);
    const inicioMs = new Date(turno.horaInicio).getTime();
    const transcurridoMin = (this.now() - inicioMs) / 60000;
    let prog = (transcurridoMin / duracionMinutos) * 100;
    return Math.min(Math.max(prog, 0), 100);
  }

  getTiempoRestante(turno: any): string {
    if (turno.estado !== 'in_progress' || !turno.horaInicio) return '';
    const duracionMinutos = this.getDuracionServicio(turno.servicio);
    const transcurridoMin = (this.now() - new Date(turno.horaInicio).getTime()) / 60000;
    const restante = duracionMinutos - transcurridoMin;
    if (restante > 0) return `Faltan ~${Math.ceil(restante)} min`;
    return `Retrasado ~${Math.ceil(Math.abs(restante))} min`;
  }

  // --- FORMULARIO AMPLIADO PARA PAGO MIXTO ---
  cobroForm = this.fb.nonNullable.group({
    barberoFiltro: [''], 
    turnoId: ['', Validators.required],
    formaPago: ['', Validators.required],
    esPagoMixto: [false],
    formaPago2: [''],
    montoPago1: [0, [Validators.min(0)]]
  });

  servicioSeleccionado = signal<string>('');
  precioSeleccionado = signal<number | null>(null);

  isDetalleModalOpen = signal<boolean>(false);
  detalleSeleccionado = signal<any>(null);

  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0], cliente: ['', Validators.required], servicio: ['', Validators.required], barbero: ['', Validators.required], monto: [0, [Validators.required, Validators.min(0)]], metodoPago: ['Yape', Validators.required]
  });

  isEditPendienteModalOpen = signal<boolean>(false);
  editPendienteForm = this.fb.nonNullable.group({
    id: [0], cliente: ['', Validators.required], servicio: ['', Validators.required], barbero: ['', Validators.required], monto: [0, [Validators.required, Validators.min(0)]]
  });

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  constructor() {
    this.cobroForm.get('barberoFiltro')?.valueChanges.subscribe(val => {
      this.barberoSeleccionadoParaCobro.set(val);
      const turnoSeleccionadoId = Number(this.cobroForm.get('turnoId')?.value);
      if (turnoSeleccionadoId) {
        const turnoValido = this.turnosParaCobrarFiltrados().find(t => t.id === turnoSeleccionadoId);
        if (!turnoValido) {
          this.cobroForm.patchValue({ turnoId: '' }, { emitEvent: false });
          this.servicioSeleccionado.set('');
          this.precioSeleccionado.set(null);
        }
      }
    });

    this.cobroForm.get('turnoId')?.valueChanges.subscribe(id => {
      const turno = this.turnosParaCobrar().find(t => t.id === Number(id));
      if (turno) { this.servicioSeleccionado.set(turno.servicio); this.precioSeleccionado.set(turno.monto); } 
      else { this.servicioSeleccionado.set(''); this.precioSeleccionado.set(null); }
    });
    
    this.editForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) this.editForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false });
    });
    
    this.editPendienteForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) this.editPendienteForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false });
    });
  }

  // Calcula automáticamente lo que falta pagar en base al total y lo que se puso en el input 1
  getMontoRestante(): number {
    const total = this.precioSeleccionado() || 0;
    const pagado1 = this.cobroForm.get('montoPago1')?.value || 0;
    const restante = total - pagado1;
    return restante > 0 ? restante : 0;
  }

  iniciarTurnoManual(id: number) {
    const turno = this.turnosService.turnos().find(t => t.id === id);
    if (!turno) return;

    const tieneEnCurso = this.turnosService.turnos().some(t => t.barbero === turno.barbero && t.estado === 'in_progress' && t.id !== id);

    const ejecutarInicio = () => {
      this.turnosService.actualizarTurno(id, { estado: 'in_progress', horaInicio: new Date().toISOString() });
      const barberoObj = this.staffService.empleados().find(e => e.nombre === turno.barbero);
      if (barberoObj) this.staffService.actualizarEmpleado(barberoObj.id, { estado_asistencia: 'ocupado' });
      this.toastService.show(`Servicio de ${turno.barbero} iniciado.`);
      this.cerrarConfirmacion(); 
    };

    if (tieneEnCurso) {
      this.confirmConfig.set({ isOpen: true, title: 'Barbero Ocupado', message: `El barbero ${turno.barbero} ya tiene un servicio en curso. ¿Estás seguro de iniciar otro al mismo tiempo?`, type: 'info', confirmText: 'Sí, Iniciar de todos modos', action: ejecutarInicio });
    } else {
      ejecutarInicio();
    }
  }

  realizarCobro() {
    if (this.cobroForm.invalid) { this.cobroForm.markAllAsTouched(); return; }
    
    const formVals = this.cobroForm.getRawValue();
    let formaPagoFinal = formVals.formaPago;

    if (formVals.esPagoMixto) {
      if (!formVals.formaPago || !formVals.formaPago2 || formVals.montoPago1 <= 0) {
        this.toastService.show('Complete todos los métodos y montos para el pago dividido', 'error');
        return;
      }
      const monto2 = this.getMontoRestante();
      formaPagoFinal = `${formVals.formaPago} (S/ ${formVals.montoPago1}) + ${formVals.formaPago2} (S/ ${monto2})`;
    }

    // ¡CAMBIO CLAVE AQUÍ! Buscar el turno en la lista TOTAL antes de que desaparezca de las listas filtradas
    const turno = this.turnosService.turnos().find(t => t.id === Number(formVals.turnoId));

    // Ahora sí, actualizamos el turno
    this.turnosService.actualizarTurno(Number(formVals.turnoId), { estado: 'completed', fecha: new Date().toLocaleString('es-PE'), metodoPago: formaPagoFinal });
    
    // Liberar al barbero
    if (turno && turno.barbero) {
      const barberoObj = this.staffService.empleados().find(e => e.nombre === turno.barbero);
      if (barberoObj) {
        this.staffService.actualizarEmpleado(barberoObj.id, { 
          estado_asistencia: 'disponible',
          ultima_vez_disponible: new Date().toISOString() 
        });
      }
    }

    this.toastService.show(`Servicio cobrado correctamente`);
    this.cobroForm.reset({ barberoFiltro: '', turnoId: '', formaPago: '', esPagoMixto: false, formaPago2: '', montoPago1: 0 });
    this.servicioSeleccionado.set(''); 
    this.precioSeleccionado.set(null);
  }
  

  verDetalle(id: number) {
    const cobro = this.turnosLista().find(c => c.id === id);
    if (cobro) { this.detalleSeleccionado.set(cobro); this.isDetalleModalOpen.set(true); }
  }
  
  cerrarDetalle() { this.isDetalleModalOpen.set(false); setTimeout(() => this.detalleSeleccionado.set(null), 300); }

  abrirModalEditar(id: number) {
    const mov = this.turnosLista().find(m => m.id === id);
    if (mov) {
      if (mov.estado === 'pending' || mov.estado === 'in_progress' || mov.estado === 'finished') {
        this.editPendienteForm.patchValue({ id: mov.id, cliente: mov.cliente, servicio: mov.servicio, barbero: mov.barbero, monto: mov.monto }, { emitEvent: false });
        this.isEditPendienteModalOpen.set(true);
      } else {
        this.editForm.patchValue({ id: mov.id, cliente: mov.cliente, servicio: mov.servicio, barbero: mov.barbero, monto: mov.monto, metodoPago: mov.metodoPago || 'Efectivo' }, { emitEvent: false });
        this.isEditModalOpen.set(true);
      }
    }
  }

  abrirModalEditarPendiente(id: number) {
    const turno = this.turnosLista().find(t => t.id === id);
    if (turno) {
      this.editPendienteForm.patchValue({ id: turno.id, barbero: turno.barbero, cliente: turno.cliente, servicio: turno.servicio, monto: turno.monto }, { emitEvent: false });
      this.isEditPendienteModalOpen.set(true);
    }
  }

  guardarEdicion() {
    if (this.editForm.invalid) return;
    const val = this.editForm.getRawValue();
    this.turnosService.actualizarTurno(val.id, { cliente: val.cliente, servicio: val.servicio, barbero: val.barbero, monto: val.monto, metodoPago: val.metodoPago });
    this.toastService.show('Cobro editado correctamente');
    this.isEditModalOpen.set(false);
  }

  guardarEdicionPendiente() {
    if (this.editPendienteForm.invalid) return;
    const val = this.editPendienteForm.getRawValue();
    this.turnosService.actualizarTurno(val.id, { cliente: val.cliente, servicio: val.servicio, barbero: val.barbero, monto: val.monto });
    this.toastService.show('Turno actualizado correctamente');
    this.isEditPendienteModalOpen.set(false);
  }

  anularCobro(id: number) {
    // Asegúrate de usar el arreglo correcto de turnos que tengas en cobros.ts (turnosLista o similar)
    const turno = this.turnosService.turnos().find(t => t.id === id);
    
    // BLOQUEO ANTIFUGA
    if (turno && (turno.estado === 'in_progress' || turno.estado === 'finished') && !this.esAdmin()) {
      this.toastService.show('Seguridad: Solo el administrador puede cancelar un servicio en curso.', 'error');
      return;
    }

    const esPendiente = turno?.estado === 'pending' || turno?.estado === 'in_progress';
    
    this.confirmConfig.set({
      isOpen: true,
      title: esPendiente ? 'Cancelar Turno' : 'Anular Cobro',
      message: esPendiente ? '¿Es seguro de cancelar este servicio?' : '¿Es seguro de anular este registro?',
      type: 'danger', 
      confirmText: esPendiente ? 'Sí, Cancelar' : 'Sí, Anular',
      action: () => {
        this.turnosService.actualizarTurno(id, { estado: 'annulled' });
        
        // Liberar al barbero y reiniciar reloj si estaba en curso/terminado
        if (turno && turno.barbero && (turno.estado === 'in_progress' || turno.estado === 'finished')) {
          const barberoObj = this.staffService.empleados().find(e => e.nombre === turno.barbero);
          if (barberoObj) {
            this.staffService.actualizarEmpleado(barberoObj.id, { 
              estado_asistencia: 'disponible',
              ultima_vez_disponible: new Date().toISOString()
            });
          }
        }
        
        this.toastService.show(esPendiente ? 'Turno cancelado exitosamente' : 'Cobro anulado exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }

  restaurarCobro(id: number) {
    this.confirmConfig.set({
      isOpen: true, title: 'Restaurar Cobro', message: '¿Deseas deshacer la anulación y restaurar este registro a la caja?', type: 'info', confirmText: 'Sí, Restaurar',
      action: () => {
        this.turnosService.actualizarTurno(id, { estado: 'completed' });
        this.toastService.show('Cobro restaurado exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }
}