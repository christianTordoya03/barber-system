import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TransactionCardComponent } from '../../../shared/ui/transaction-card/transaction-card';
import { ModalDetalleComponent } from '../../../shared/ui/modal-detalle/modal-detalle';
import { ModalCobroComponent } from '../../../shared/ui/modal-cobro/modal-cobro';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { TurnosService } from '../../../core/services/turnos';
import { ToastService } from '../../../core/services/toast';
import { StaffService } from '../../../core/services/staff';
import { CatalogoService } from '../../../core/services/catalogo';
import { OrdenAtencionComponent } from '../../../shared/ui/orden-atencion/orden-atencion';
import { SupabaseService } from '../../../core/supabase/supabase';
// import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, TransactionCardComponent, ModalDetalleComponent, ModalCobroComponent, ModalConfirmComponent, ReactiveFormsModule, OrdenAtencionComponent],
  templateUrl: './dashboard.html',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private toastService = inject(ToastService);
  private staffService = inject(StaffService);
  private catalogoService = inject(CatalogoService);
  private supabase = inject(SupabaseService);

  now = signal(Date.now());
  intervalId: any;

  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));
  servicios = this.catalogoService.servicios;
  esAdmin = signal<boolean>(false);
  // public qrUrl: string = 'https://sistema.marina305.net/instalar';

  hoyStr = signal<string>(this.formatDateToDDMMYYYY(new Date()));

  searchTerm = signal<string>('');
  searchBarbero = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = 10;

  async ngOnInit() {
    this.intervalId = setInterval(() => {
      this.now.set(Date.now());
      const fechaActualReal = this.formatDateToDDMMYYYY(new Date());
      if (this.hoyStr() !== fechaActualReal) {
        this.hoyStr.set(fechaActualReal);
        this.staffService.cargarEmpleados();
      }
    }, 10000);

    const { data: { user } } = await this.supabase.client.auth.getUser();
    if (user) {
      const { data } = await this.supabase.client.from('empleados').select('rol').eq('email', user.email).maybeSingle();
      this.esAdmin.set(data?.rol?.toLowerCase() === 'admin');
    }
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  getDuracionServicio(nombreServicio: string): number {
    const srv = this.servicios().find(s => s.nombre === nombreServicio);
    return srv?.duracion || 30;
  }

  // descargarQR() {
  //   //   // Buscamos el elemento canvas que genera la librería
  //   const canvas = document.querySelector('qrcode canvas') as HTMLCanvasElement;
  //   if (canvas) {
  //     //     // Convertimos el canvas a una URL de imagen
  //     const imagenUrl = canvas.toDataURL('image/png');

  //     //     // Creamos un enlace invisible para forzar la descarga
  //     const enlaceDescarga = document.createElement('a');
  //     enlaceDescarga.href = imagenUrl;
  //     enlaceDescarga.download = 'QR-Marina305-Instalacion.png';

  //     //     // Simulamos el clic y lo eliminamos
  //     document.body.appendChild(enlaceDescarga);
  //     enlaceDescarga.click();
  //     document.body.removeChild(enlaceDescarga);
  //   } else {
  //     console.error('No se pudo encontrar el canvas del código QR');
  //   }
  // }

  calcularProgreso(turno: any): number {
    if (turno.estado !== 'in_progress' || !turno.horaInicio) return 0;
    const duracionMinutos = this.getDuracionServicio(turno.servicio);
    const inicioMs = new Date(turno.horaInicio).getTime();
    if (isNaN(inicioMs)) return 0; // <- Agrega esta línea salvavidas

    const transcurridoMin = (this.now() - inicioMs) / 60000;
    let prog = (transcurridoMin / duracionMinutos) * 100;
    return Math.min(Math.max(prog, 0), 100);
  }

  getTiempoRestante(turno: any): string {
    if (turno.estado !== 'in_progress' || !turno.horaInicio) return '';
    const duracionMinutos = this.getDuracionServicio(turno.servicio);
    const inicioMs = new Date(turno.horaInicio).getTime();
    const transcurridoMin = (this.now() - inicioMs) / 60000;
    const restante = duracionMinutos - transcurridoMin;
    if (restante > 0) return `Faltan ~${Math.ceil(restante)} min`;
    return `Retrasado ~${Math.ceil(Math.abs(restante))} min`;
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

  formatearFechaCard(fechaStr: string): string {
    if (!fechaStr) return '';
    const d = this.parseDateStr(fechaStr);
    const timePart = fechaStr.includes(',') ? fechaStr.split(',')[1].trim() : fechaStr.split(' ')[1]?.trim() || '';
    const match = timePart.match(/(\d{1,2}):(\d{2})/);

    if (!d || !match) return fechaStr; // Si algo falla, devuelve el original

    let hours = parseInt(match[1], 10);
    const minutes = match[2];

    if (timePart.toLowerCase().includes('p') && hours < 12) hours += 12;
    if (timePart.toLowerCase().includes('a') && hours === 12) hours = 0;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12;
    h12 = h12 ? h12 : 12;

    return `${d.day}/${d.month}/${d.year} - ${h12}:${minutes} ${ampm}`;
  }

  ultimosMovimientos = computed(() => {
    const hoyVal = this.getValorFecha(this.hoyStr());
    const filtrados = this.turnosService.turnos().filter(t => {
      // if (t.estado === 'annulled') return false; 

      const turnoVal = this.getValorFecha(t.fecha);
      if (turnoVal > hoyVal) return false;
      if (turnoVal === hoyVal) return true;
      return (t.estado === 'pending' || t.estado === 'in_progress' || t.estado === 'finished');
    });

    const getPriority = (estado: string) => {
      if (estado === 'finished') return 1;
      if (estado === 'in_progress') return 2;
      if (estado === 'pending') return 3;
      if (estado === 'completed') return 4;
      if (estado === 'annulled') return 5;
      return 5;
    };

    return filtrados.sort((a, b) => {
      const pA = getPriority(a.estado);
      const pB = getPriority(b.estado);

      // 1. Primero por Estado
      if (pA !== pB) return pA - pB;

      // 2. Desempate
      if (a.estado === 'completed') {
        return b.id - a.id; // Los cobrados, el más reciente arriba
      } else {
        // <-- NUEVO: ORDEN CRONOLÓGICO REAL PARA LOS PENDIENTES
        const minA = this.obtenerMinutosDesdeFecha(a.fecha);
        const minB = this.obtenerMinutosDesdeFecha(b.fecha);
        if (minA !== minB) return minA - minB;

        return a.id - b.id;
      }
    });
  });

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

  limpiarBusqueda() {
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  turnosFiltradosBusqueda = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const barberoFiltro = this.searchBarbero();
    let lista = this.ultimosMovimientos();

    if (barberoFiltro) lista = lista.filter(t => t.barbero === barberoFiltro);
    if (term) lista = lista.filter(t => t.cliente?.toLowerCase().includes(term) || t.servicio?.toLowerCase().includes(term));
    return lista;
  });

  paginatedTurnos = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return this.turnosFiltradosBusqueda().slice(startIndex, startIndex + this.pageSize);
  });

  totalPages = computed(() => Math.ceil(this.turnosFiltradosBusqueda().length / this.pageSize) || 1);

  nextPage() { if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1); }
  prevPage() { if (this.currentPage() > 1) this.currentPage.update(p => p - 1); }

  turnosParaMetricas = computed(() => {
    const barberoFiltro = this.searchBarbero();
    if (!barberoFiltro) return this.ultimosMovimientos();
    return this.ultimosMovimientos().filter(t => t.barbero === barberoFiltro);
  });

  dineroEnCaja = computed(() => this.turnosParaMetricas().filter(t => t.estado === 'completed').reduce((total, turno) => total + (turno.monto || 0), 0));

  cortesRealizados = computed(() => this.turnosParaMetricas().filter(t => t.estado === 'completed').length);

  comisionesAPagar = computed(() => {
    const completados = this.turnosParaMetricas().filter(t => t.estado === 'completed');
    return completados.reduce((total, turno) => {
      const b = this.barberos().find(x => x.nombre === turno.barbero);
      const porcentaje = b?.comision || 50;
      return total + ((turno.monto || 0) * (porcentaje / 100));
    }, 0);
  });

  isDetalleModalOpen = signal<boolean>(false);
  detalleSeleccionado = signal<any>(null);

  isModalCobroOpen = signal<boolean>(false);
  cobroSeleccionado = signal<any>(null);

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => { } });

  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0], cliente: ['', Validators.required], servicio: ['', Validators.required], barbero: ['', Validators.required], monto: [0, [Validators.required, Validators.min(0)]], metodoPago: ['Yape', Validators.required]
  });

  isEditPendienteModalOpen = signal<boolean>(false);
  editPendienteForm = this.fb.nonNullable.group({
    id: [0], cliente: ['', Validators.required], servicio: ['', Validators.required], barbero: ['', Validators.required], monto: [0, [Validators.required, Validators.min(0)]]
  });

  constructor() {
    this.editForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) { this.editForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false }); }
    });
    this.editPendienteForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) { this.editPendienteForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false }); }
    });
  }

  // --- NUEVA FUNCIÓN PARA INICIAR DESDE LA TABLA ---
  iniciarTurnoManual(id: number) {
    const turno = this.turnosService.turnos().find(t => t.id === id);
    if (!turno) return;

    // 1. Verificamos si el barbero ya tiene otro turno en estado "in_progress"
    const tieneEnCurso = this.turnosService.turnos().some(t =>
      t.barbero === turno.barbero &&
      t.estado === 'in_progress' &&
      t.id !== id
    );

    // 2. Separamos la lógica de guardado en una función para llamarla después (o de inmediato)
    const ejecutarInicio = () => {
      this.turnosService.actualizarTurno(id, {
        estado: 'in_progress',
        horaInicio: new Date().toISOString()
      });

      const barberoObj = this.staffService.empleados().find(e => e.nombre === turno.barbero);
      if (barberoObj) {
        this.staffService.actualizarEmpleado(barberoObj.id, { estado_asistencia: 'ocupado' });
      }

      this.toastService.show(`Servicio de ${turno.barbero} iniciado.`);
      this.cerrarConfirmacion(); // Por si venimos del modal
    };

    // 3. Evaluamos: ¿Lanzar alerta o iniciar de una vez?
    if (tieneEnCurso) {
      this.confirmConfig.set({
        isOpen: true,
        title: 'Barbero Ocupado',
        message: `El barbero ${turno.barbero} ya tiene un servicio en curso. ¿Estás seguro de iniciar otro al mismo tiempo?`,
        type: 'info',
        confirmText: 'Sí, Iniciar de todos modos',
        action: ejecutarInicio
      });
    } else {
      ejecutarInicio(); // Si está libre, iniciamos sin preguntar
    }
  }

  abrirModalCobro(id: number) {
    const cobro = this.ultimosMovimientos().find(c => c.id === id);
    if (cobro) { this.cobroSeleccionado.set(cobro); this.isModalCobroOpen.set(true); }
  }

  cerrarModalCobro() {
    this.isModalCobroOpen.set(false);
    setTimeout(() => this.cobroSeleccionado.set(null), 300);
  }

  confirmarCobro(metodo: string) {
    const id = this.cobroSeleccionado()?.id;
    if (id) {
      this.turnosService.actualizarTurno(id, { estado: 'completed', fecha: new Date().toLocaleString('es-PE'), metodoPago: metodo });

      // SOLUCIÓN: LIBERAR BARBERO Y REINICIAR SU RELOJ A LA HORA ACTUAL
      const turno = this.ultimosMovimientos().find(t => t.id === id);
      if (turno && turno.barbero) {
        const barberoObj = this.staffService.empleados().find(e => e.nombre === turno.barbero);
        if (barberoObj) {
          this.staffService.actualizarEmpleado(barberoObj.id, {
            estado_asistencia: 'disponible',
            ultima_vez_disponible: new Date().toISOString() // <-- ¡Esta es la línea mágica que faltaba!
          });
        }
      }

      this.toastService.show(`Turno cobrado con ${metodo}`);
    }
    this.cerrarModalCobro();
  }

  verDetalle(id: number) {
    const mov = this.ultimosMovimientos().find(m => m.id === id);
    if (mov) { this.detalleSeleccionado.set(mov); this.isDetalleModalOpen.set(true); }
  }

  cerrarDetalle() { this.isDetalleModalOpen.set(false); }

  abrirModalEditar(id: number) {
    const mov = this.ultimosMovimientos().find(m => m.id === id);
    const turno = this.turnosService.turnos().find(t => t.id === id);
    if (turno && turno.estado === 'completed' && !this.esAdmin()) {
      this.toastService.show('Seguridad: Acción denegada. El ticket ya fue cobrado y está cerrado.', 'error');
      return;
    }
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
    const turno = this.turnosService.turnos().find(t => t.id === id);

    // 1. EL CANDADO PERFECTO: Cubre En Curso, Por Cobrar y COMPLETADO (Pagado)
    if (turno && (turno.estado === 'in_progress' || turno.estado === 'finished' || turno.estado === 'completed') && !this.esAdmin()) {
      this.toastService.show('Seguridad: Acción denegada. Solo el Administrador puede anular operaciones iniciadas o cobradas.', 'error');
      return;
    }

    const esPendiente = turno?.estado === 'pending' || turno?.estado === 'in_progress';

    this.confirmConfig.set({
      isOpen: true,
      title: esPendiente ? 'Cancelar Turno' : 'Anular Cobro',
      message: esPendiente ? '¿Es seguro de cancelar este servicio?' : '¿Es seguro de anular este ingreso de caja?',
      type: 'danger',
      confirmText: esPendiente ? 'Sí, Cancelar' : 'Sí, Anular',
      action: () => {
        // Cancelamos el turno en la base de datos
        this.turnosService.actualizarTurno(id, { estado: 'annulled' });

        // 2. LIBERAR BARBERO Y ACTUALIZAR RELOJ (Si estaba en curso o por cobrar)
        if (turno && turno.barbero && (turno.estado === 'in_progress' || turno.estado === 'finished')) {
          const barberoObj = this.staffService.empleados().find(e => e.nombre === turno.barbero);
          if (barberoObj) {
            this.staffService.actualizarEmpleado(barberoObj.id, {
              estado_asistencia: 'disponible',
              ultima_vez_disponible: new Date().toISOString()
            });
          }
        }

        this.toastService.show('Acción completada correctamente');
        this.cerrarConfirmacion();
      }
    });
  }

  restaurarCobro(id: number) {
    if (!this.esAdmin()) {
      this.toastService.show('Seguridad: Solo el administrador puede restaurar registros anulados.', 'error');
      return;
    }
    this.confirmConfig.set({
      isOpen: true, title: 'Restaurar Cobro', message: '¿Deseas deshacer la anulación y devolver el registro a la caja?', type: 'info', confirmText: 'Sí, Restaurar',
      action: () => {
        this.turnosService.actualizarTurno(id, { estado: 'completed' });
        this.toastService.show('Cobro restaurado exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }
}