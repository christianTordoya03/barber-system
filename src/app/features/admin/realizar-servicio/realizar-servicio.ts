import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { ToastService } from '../../../core/services/toast';
import { CatalogoService } from '../../../core/services/catalogo';
import { StaffService } from '../../../core/services/staff';
import { Turno } from '../../../core/models/marina';
import { OrdenAtencionComponent } from '../../../shared/ui/orden-atencion/orden-atencion';
import { ModalConfirmComponent } from '../../../shared/ui/modal-confirm/modal-confirm';

@Component({
  selector: 'app-realizar-servicio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, OrdenAtencionComponent, ModalConfirmComponent],
  templateUrl: './realizar-servicio.html',
})
export class RealizarServicioComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private toastService = inject(ToastService);
  private catalogoService = inject(CatalogoService);
  private staffService = inject(StaffService);

  isLoading = signal<boolean>(false);
  confirmConfig = signal({ isOpen: false, title: '', message: '', type: 'danger' as 'danger' | 'info', confirmText: '', action: () => {} });
  cerrarConfirmacion() { this.confirmConfig.update(c => ({ ...c, isOpen: false })); }

  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));
  servicios = this.catalogoService.servicios;

  // Fechas y horas por defecto (Ahora mismo)
  hoyStrHtml = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  })();
  horaActualStr = new Date().toTimeString().substring(0, 5);

  servicioForm = this.fb.nonNullable.group({
    barberoId: ['', Validators.required],
    clienteNombre: '',
    servicioId: ['', Validators.required],
    fecha: [this.hoyStrHtml, Validators.required],
    hora: [this.horaActualStr, Validators.required],
    iniciarInmediatamente: [false] // <-- NUEVO CHECKBOX
  });

  // Señales para reaccionar en la vista
  barberoSeleccionadoId = signal<string>('');
  fechaSeleccionada = signal<string>(this.hoyStrHtml);

  now = signal(Date.now());
  intervalId: any;

  ngOnInit() {
    this.intervalId = setInterval(() => this.now.set(Date.now()), 10000);
    // Escuchar cambios en el formulario en tiempo real
    this.servicioForm.get('barberoId')?.valueChanges.subscribe(v => this.barberoSeleccionadoId.set(v));
    this.servicioForm.get('fecha')?.valueChanges.subscribe(v => this.fechaSeleccionada.set(v));
  }

  ngOnDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  // --- LÓGICA DE LA MINI-AGENDA ---
  private parseDateStr(fechaStr: string) {
    const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return { day: match[1].padStart(2, '0'), month: match[2].padStart(2, '0'), year: match[3] };
    return null;
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

  agendaDelDia = computed(() => {
    const bId = this.barberoSeleccionadoId();
    if (!bId) return [];
    
    const barberoObj = this.barberos().find(b => b.id === Number(bId));
    if (!barberoObj) return [];

    const fechaFiltro = this.fechaSeleccionada(); 
    if (!fechaFiltro) return [];
    
    const [year, month, day] = fechaFiltro.split('-');
    const stringBusqueda = `${year}${month}${day}`;

    return this.turnosService.turnos()
      .filter(t => {
        // Ignoramos los anulados, los completados y finalizados. Solo vemos pendientes y en progreso
        if (t.barbero !== barberoObj.nombre) return false;
        if (t.estado !== 'pending' && t.estado !== 'in_progress') return false;
        
        const d = this.parseDateStr(t.fecha);
        if (!d) return false;
        
        return `${d.year}${d.month}${d.day}` === stringBusqueda;
      })
      .sort((a, b) => this.extraerHora(a.fecha).localeCompare(this.extraerHora(b.fecha)));
  });

  getDuracionServicio(nombreServicio: string): number {
    const srv = this.servicios().find(s => s.nombre === nombreServicio);
    return srv?.duracion || 30; // 30 min por defecto
  }

  getTiempoRestante(turno: Turno): string {
    if (turno.estado !== 'in_progress' || !turno.horaInicio) return '';
    
    const duracionMinutos = this.getDuracionServicio(turno.servicio);
    const inicioMs = new Date(turno.horaInicio).getTime();
    const transcurridoMin = (this.now() - inicioMs) / 60000;
    const restante = duracionMinutos - transcurridoMin;

    if (restante > 0) {
      return `Faltan ~${Math.ceil(restante)} min`;
    } else {
      return `Retrasado ~${Math.ceil(Math.abs(restante))} min`;
    }
  }

  // NUEVA FUNCIÓN PARA LA BARRA DEL ADMIN
  calcularProgreso(turno: Turno): number {
    if (turno.estado !== 'in_progress' || !turno.horaInicio) return 0;
    const srv = this.servicios().find(s => s.nombre === turno.servicio);
    const duracionMinutos = srv?.duracion || 30;
    
    const inicioMs = new Date(turno.horaInicio).getTime();
    const transcurridoMin = (this.now() - inicioMs) / 60000;
    
    let prog = (transcurridoMin / duracionMinutos) * 100;
    return Math.min(Math.max(prog, 0), 100);
  }

  // --- ACCIÓN PRINCIPAL ---
  onSubmit(event?: Event) {
    if (event) event.preventDefault();
    if (this.servicioForm.invalid) {
      this.servicioForm.markAllAsTouched();
      return;
    }
    
    this.isLoading.set(true);
    
    const formValues = this.servicioForm.getRawValue();
    const servicio = this.servicios().find(s => s.id === Number(formValues.servicioId));
    const barbero = this.barberos().find(b => b.id === Number(formValues.barberoId));

    const [year, month, day] = formValues.fecha.split('-');
    const [hour, minute] = formValues.hora.split(':');
    const fechaObj = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const fechaLlegada = fechaObj.toLocaleString('es-PE');
    
    const iniciarYa = formValues.iniciarInmediatamente;

    // Lógica que realmente guarda el turno en la Base de Datos
    const ejecutarGuardado = () => {
      const nuevoTurno: Turno = {
        id: Date.now(),
        servicio: servicio?.nombre || 'Servicio Estándar',
        barbero: barbero?.nombre || 'Barbero',
        cliente: formValues.clienteNombre?.trim() || 'Cliente marina 305',
        monto: servicio?.precio || 0,
        estado: iniciarYa ? 'in_progress' : 'pending',
        horaInicio: iniciarYa ? new Date().toISOString() : undefined,
        fecha: fechaLlegada, 
        metodoPago: 'Pendiente'
      };

      this.turnosService.agregarTurno(nuevoTurno);

      if (iniciarYa && barbero) {
        this.staffService.actualizarEmpleado(barbero.id, { estado_asistencia: 'ocupado' });
      }
      
      setTimeout(() => {
        this.isLoading.set(false);
        this.toastService.show(iniciarYa ? '¡Turno iniciado con éxito!' : '¡Turno agendado con éxito!');
        this.servicioForm.patchValue({ clienteNombre: '', servicioId: '', barberoId: '', iniciarInmediatamente: false });
        this.barberoSeleccionadoId.set(''); 
        this.cerrarConfirmacion();
      }, 800);
    };

    // Validamos si marcó el checkbox Y el barbero ya está ocupado
    if (iniciarYa && barbero) {
      const tieneEnCurso = this.turnosService.turnos().some(t => t.barbero === barbero.nombre && t.estado === 'in_progress');
      if (tieneEnCurso) {
        this.isLoading.set(false); // Quitamos el spinner temporalmente
        this.confirmConfig.set({
          isOpen: true,
          title: 'Barbero Ocupado',
          message: `El barbero ${barbero.nombre} ya tiene un servicio en curso. ¿Estás seguro de asignarle e iniciar este nuevo servicio de inmediato?`,
          type: 'info',
          confirmText: 'Sí, Iniciar',
          action: () => {
            this.isLoading.set(true);
            ejecutarGuardado(); // Guardamos si dice que sí
          }
        });
        return; // Pausamos la ejecución aquí hasta que responda
      }
    }

    // Si no está ocupado o no marcó el inicio rápido, se guarda normal
    ejecutarGuardado();
  }
}