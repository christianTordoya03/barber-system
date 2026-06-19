import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, FormsModule, Validators } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { StaffService } from '../../../core/services/staff';
import { CatalogoService } from '../../../core/services/catalogo';
import { ToastService } from '../../../core/services/toast';
import { ModalDetalleComponent } from '../../../shared/ui/modal-detalle/modal-detalle';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';
import { Turno, Empleado } from '../../../core/models/marina';
import { RouterModule } from '@angular/router';
import { WhatsappService } from '../../../core/services/whatsapp';

@Component({
  selector: 'app-admin-agenda',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, ModalDetalleComponent, ModalConfirmComponent, RouterModule],
  templateUrl: './agenda.html'
})
export class AgendaComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private staffService = inject(StaffService);
  private catalogoService = inject(CatalogoService);
  private toastService = inject(ToastService);
  private whatsappService = inject(WhatsappService);

  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));
  servicios = this.catalogoService.servicios;
  solicitudesWeb = computed(() => 
    this.turnosService.turnos().filter(t => t.estado === 'pending_confirmation')
  );

  obtenerFechaActual() {
    const d = new Date();
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // CONVERTIDO A SEÑAL PARA LA MEDIANOCHE
  hoyStrHtml = signal<string>(this.obtenerFechaActual());
  
  fechaInicio = signal<string>(this.hoyStrHtml());
  fechaFin = signal<string>(this.hoyStrHtml());
  searchTermBarbero = signal<string>(''); 
  
  filtroAplicado = signal({
    inicio: this.hoyStrHtml(),
    fin: this.hoyStrHtml()
  });

  intervalId: any;

  ngOnInit() {
    this.buscar();
    
    this.intervalId = setInterval(() => {
      const nuevoHoy = this.obtenerFechaActual();
      if (this.hoyStrHtml() !== nuevoHoy) {
         // Si el admin estaba viendo "Hoy", le auto-adelantamos el día
         const estabaViendoHoy = this.fechaInicio() === this.hoyStrHtml() && this.fechaFin() === this.hoyStrHtml();
         this.hoyStrHtml.set(nuevoHoy);
         
         if (estabaViendoHoy) {
           this.verHoy(); 
         }
      }
    }, 10000);
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
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

  extraerHora(fechaCompleta: string): string {
    if (!fechaCompleta.includes(',')) return '--:--';
    const timePart = fechaCompleta.split(',')[1].trim(); 
    const match = timePart.match(/(\d{1,2}):(\d{2})/);
    if (!match) return '--:--';
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    if (timePart.toLowerCase().includes('p') && hours < 12) hours += 12;
    if (timePart.toLowerCase().includes('a') && hours === 12) hours = 0;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    let h12 = hours % 12;
    h12 = h12 ? h12 : 12;
    return `${h12}:${minutes} ${ampm}`;
  }

  extraerFechaCorta(fechaCompleta: string): string {
    if (!fechaCompleta.includes(',')) return '';
    const datePart = fechaCompleta.split(',')[0].trim(); 
    const partes = datePart.split('/');
    if (partes.length >= 2) return `${partes[0]}/${partes[1]}`;
    return '';
  }

  onSearchBarbero(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.searchTermBarbero.set(target.value);
  }

  buscar() {
    this.filtroAplicado.set({ inicio: this.fechaInicio(), fin: this.fechaFin() });
  }

  verHoy() {
    this.fechaInicio.set(this.hoyStrHtml());
    this.fechaFin.set(this.hoyStrHtml());
    this.searchTermBarbero.set(''); 
    this.buscar();
  }

  barberosConAgenda = computed(() => {
    const inicioStr = this.filtroAplicado().inicio.replace(/-/g, '');
    const finStr = this.filtroAplicado().fin.replace(/-/g, '');
    const filtroBarbero = this.searchTermBarbero();

    let listaBarberos = this.barberos();
    if (filtroBarbero) {
      listaBarberos = listaBarberos.filter(b => b.nombre === filtroBarbero);
    }

    const resultado: { barbero: Empleado, turnos: Turno[] }[] = [];

    for (const barbero of listaBarberos) {
      const turnosDelBarbero = this.turnosService.turnos()
        .filter(t => {
          if (t.barbero !== barbero.nombre || t.estado === 'annulled') return false;
          const d = this.parseDateStr(t.fecha);
          if (!d) return false;
          const itemStr = `${d.year}${d.month}${d.day}`;
          return itemStr >= inicioStr && itemStr <= finStr;
        })
        .sort((a, b) => {
          const valA = this.getValorFecha(a.fecha);
          const valB = this.getValorFecha(b.fecha);
          if (valA !== valB) return valA - valB; 
          
          const compHora = this.extraerHora(a.fecha).localeCompare(this.extraerHora(b.fecha)); 
          if (compHora !== 0) return compHora;
          
          // DESEMPATE: Si la hora exacta es igual, va primero el más antiguo (el que se creó primero)
          return a.id - b.id;
        });

      if (turnosDelBarbero.length > 0) {
        resultado.push({ barbero: barbero, turnos: turnosDelBarbero });
      }
    }
    return resultado;
  });

  confirmarSolicitudWeb(turno: Turno) {
    // 1. Lo pasamos a 'pending' para que entre a la agenda oficial del barbero
    this.turnosService.actualizarTurno(turno.id, { estado: 'pending' });
    
    // 2. Extraemos el teléfono que guardamos temporalmente en la nota en el Wizard
    const match = turno.notas?.match(/\(Telf:\s*([0-9+]+)\)/);
    const telefono = match ? match[1] : '';

    // 3. Obtenemos la plantilla y reemplazamos los datos
    // Si no hay plantilla en BD, usamos un texto por defecto elegante
    const plantilla = this.whatsappService.obtenerPlantilla('confirmacion') || 
      'Hola {nombre} ✂️ Tu cita en Marina 305 para tu {servicio} el {fecha} a las {hora} con {barbero} ha sido confirmada. ¡Te esperamos!';
    
    const mensaje = this.whatsappService.generarMensaje(plantilla, {
      clienteNombre: turno.cliente || 'amigo',
      servicio: turno.servicio,
      barbero: turno.barbero,
      fecha: this.extraerFechaCorta(turno.fecha),
      hora: this.extraerHora(turno.fecha)
    });

    

    // 4. Disparamos WhatsApp y avisamos al usuario
    this.whatsappService.enviarMensaje(telefono, mensaje);
    this.toastService.show('Reserva confirmada. Abriendo WhatsApp...', 'success');
  }

  rechazarSolicitudWeb(turno: Turno) {
    // Si la rechazan, se anula y libera el espacio automáticamente
    this.turnosService.actualizarTurno(turno.id, { estado: 'annulled' });
    this.toastService.show('Solicitud web rechazada', 'success');
  }

  turnosTotalesRango = computed(() => {
    return this.barberosConAgenda().reduce((acc, item) => acc.concat(item.turnos), [] as Turno[]);
  });

  ingresosProyectadosRango = computed(() => {
    return this.turnosTotalesRango().reduce((acc, t) => acc + Number(t.monto), 0);
  });

  isDetalleModalOpen = signal<boolean>(false);
  detalleSeleccionado = signal<Turno | null>(null);

  isEditModalOpen = signal<boolean>(false);
  editForm = this.fb.nonNullable.group({
    id: [0], cliente: ['', Validators.required], servicio: ['', Validators.required], barbero: ['', Validators.required],
    fecha: ['', Validators.required], hora: ['', Validators.required], monto: [0, [Validators.required, Validators.min(0)]]
  });

  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });

  constructor() {
    this.editForm.get('servicio')?.valueChanges.subscribe(nombreServicio => {
      const servicioObj = this.servicios().find(s => s.nombre === nombreServicio);
      if (servicioObj) this.editForm.patchValue({ monto: servicioObj.precio }, { emitEvent: false });
    });
  }

  verDetalle(turno: Turno) {
    this.detalleSeleccionado.set(turno);
    this.isDetalleModalOpen.set(true);
  }
  
  cerrarDetalle() {
    this.isDetalleModalOpen.set(false);
  }

  abrirModalEditar(turno: Turno) {
    const d = this.parseDateStr(turno.fecha);
    let timeHtml = '12:00';
    
    if (turno.fecha.includes(',')) {
      const timePart = turno.fecha.split(',')[1].trim(); 
      const match = timePart.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        if (timePart.toLowerCase().includes('p') && hours < 12) hours += 12;
        if (timePart.toLowerCase().includes('a') && hours === 12) hours = 0;
        timeHtml = `${hours.toString().padStart(2, '0')}:${minutes}`;
      }
    }

    this.editForm.patchValue({
      id: turno.id,
      cliente: turno.cliente,
      servicio: turno.servicio,
      barbero: turno.barbero,
      monto: turno.monto,
      fecha: d ? `${d.year}-${d.month}-${d.day}` : this.hoyStrHtml(),
      hora: timeHtml
    });
    this.isEditModalOpen.set(true);
  }

  guardarEdicion() {
    if (this.editForm.invalid) return;
    const formValues = this.editForm.getRawValue();
    
    const [year, month, day] = formValues.fecha.split('-');
    const [hour, minute] = formValues.hora.split(':');
    const fechaObj = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const fechaLlegada = fechaObj.toLocaleString('es-PE');

    this.turnosService.actualizarTurno(formValues.id, { 
      cliente: formValues.cliente, 
      servicio: formValues.servicio, 
      barbero: formValues.barbero, 
      monto: formValues.monto,
      fecha: fechaLlegada
    });
    
    this.toastService.show('Reserva actualizada correctamente');
    this.isEditModalOpen.set(false);
  }

  anularTurno(turno: Turno) {
    this.confirmConfig.set({
      isOpen: true,
      title: 'Anular Reserva',
      message: `¿Estás seguro de anular la reserva de ${turno.cliente || 'este cliente'}? Esta acción eliminará el turno de la agenda.`,
      type: 'danger', confirmText: 'Sí, Anular',
      action: () => {
        this.turnosService.actualizarTurno(turno.id, { estado: 'annulled' });
        this.toastService.show('Reserva anulada exitosamente');
        this.cerrarConfirmacion();
      }
    });
  }

  cerrarConfirmacion() {
    this.confirmConfig.update(c => ({ ...c, isOpen: false }));
  }
}