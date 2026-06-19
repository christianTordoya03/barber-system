import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';
import { CatalogoService } from '../../../core/services/catalogo';
import { StaffService } from '../../../core/services/staff';
import { TurnosService } from '../../../core/services/turnos';
import { ClientesService } from '../../../core/services/clientes';
import { ToastService } from '../../../core/services/toast';
import { Servicio, Empleado } from '../../../core/models/marina';

@Component({
  selector: 'app-booking-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-wizard.html'
})
export class BookingWizardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public supabase = inject(SupabaseService);
  private catalogoService = inject(CatalogoService);
  private staffService = inject(StaffService);
  private turnosService = inject(TurnosService);
  private clientesService = inject(ClientesService);
  private toast = inject(ToastService);

  pasoActual = signal<number>(1);
  subPasoCalendario = signal<'dias' | 'horas'>('dias');

  isLoading = signal<boolean>(true);
  isCheckingPhone = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  reservaConfirmada = signal<boolean>(false);

  telefonoCliente = signal<string>('');
  nombreCliente = signal<string>('');
  notaCliente = signal<string>('');
  
  servicioSeleccionado = signal<Servicio | null>(null);
  barberoSeleccionado = signal<Empleado | null>(null);
  fechaSeleccionada = signal<string>('');
  horaSeleccionada = signal<string>('');

  servicios = computed(() => this.catalogoService.servicios());
  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo));
  
  horasDisponibles = signal<string[]>([
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', 
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
  ]);
  horasOcupadas = signal<string[]>([]);
  diasDisponibles = signal<any[]>([]);

  primerDiaStr = computed(() => {
    const dias = this.diasDisponibles();
    return dias.length > 0 ? dias[0].strFormat : '';
  });

  horaActualMilitarStr = signal<string>('');

  async ngOnInit() {
    this.actualizarHoraMilitar();
    this.generarDiasSiguientes(); 

    const slug = this.route.snapshot.paramMap.get('barbershop_slug');
    if (!slug) {
      this.toast.show('Barbería no encontrada', 'error');
      return;
    }

    const { data: tenant, error } = await this.supabase.client
      .from('barbershops')
      .select('*')
      .eq('dominio', slug)
      .maybeSingle();

     

    if (!tenant || error) {
      this.toast.show('Esta página no existe o no está disponible', 'error');
      this.isLoading.set(false);
      return;
    }

    this.supabase.tenant.set(tenant);


    await Promise.all([
      this.catalogoService.cargarDatos(),
      this.staffService.cargarEmpleados()
    ]);

    this.isLoading.set(false);
  }

  actualizarHoraMilitar() {
    const hoy = new Date();
    const hora = `${hoy.getHours().toString().padStart(2, '0')}:${hoy.getMinutes().toString().padStart(2, '0')}`;
    this.horaActualMilitarStr.set(hora);
  }

  irAPaso(paso: number) {
    this.pasoActual.set(paso);
    if (paso === 4) {
      this.subPasoCalendario.set('dias');
    }
  }

  // --- NUEVA FUNCIÓN PARA LIMPIAR EL TELÉFONO (Soluciona el error NG5002) ---
  onTelefonoChange(valor: string) {
    if (!valor) {
      this.telefonoCliente.set('');
      return;
    }
    // Si hay texto, lo convertimos a String por seguridad y aplicamos el filtro
    const valorLimpio = String(valor).replace(/[^0-9]/g, '').slice(0, 9);
    this.telefonoCliente.set(valorLimpio);
  }

  async validarTelefono() {
    const tel = this.telefonoCliente().trim();
    if (!tel || tel.length !== 9) {
      this.toast.show('Ingresa un celular válido de 9 dígitos', 'warning');
      return;
    }

    this.isCheckingPhone.set(true);
    const cliente = await this.clientesService.buscarClientePorTelefono(tel);
    if (cliente) {
      this.nombreCliente.set(cliente.nombre);
      this.toast.show(`¡Hola de nuevo, ${cliente.nombre}!`, 'success');
    }
    
    this.isCheckingPhone.set(false);
    this.irAPaso(2); 
  }

  seleccionarServicio(servicio: Servicio) {
    this.servicioSeleccionado.set(servicio);
    this.irAPaso(3); 
  }

  seleccionarBarbero(barbero: Empleado | null) {
    this.barberoSeleccionado.set(barbero);
    this.irAPaso(4); 
    this.subPasoCalendario.set('dias'); 
  }

  async seleccionarFecha(fecha: string) {
    this.fechaSeleccionada.set(fecha);
    this.horaSeleccionada.set('');
    this.subPasoCalendario.set('horas'); 
    
    const barbero = this.barberoSeleccionado();
    if (barbero) {
      const ocupadas = await this.turnosService.obtenerHorasOcupadas(barbero.nombre, fecha);
      this.horasOcupadas.set(ocupadas);
    } else {
      this.horasOcupadas.set([]); 
    }
  }

  volverADias() {
    this.subPasoCalendario.set('dias');
  }

  seleccionarHora(hora: string) {
    this.horaSeleccionada.set(hora);
    this.irAPaso(5); 
  }

  generarDiasSiguientes() {
    const dias = [];
    const hoy = new Date();
    const nombresDias = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const nombresMeses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    for (let i = 0; i < 14; i++) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
      
      const day = fecha.getDate().toString().padStart(2, '0');
      const month = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const year = fecha.getFullYear();
      
      dias.push({
        strFormat: `${year}-${month}-${day}`,
        diaNombre: nombresDias[fecha.getDay()],
        diaNumero: fecha.getDate(),
        mesNombre: nombresMeses[fecha.getMonth()],
        esHoy: i === 0
      });
    }
    this.diasDisponibles.set(dias);
  }

  async confirmarReserva() {
    const tel = this.telefonoCliente().trim();
    const nom = this.nombreCliente().trim();
    
    // Validación estricta del nombre antes de enviar a DB
    if (!nom || nom.length < 2) {
      this.toast.show('Por favor, dinos cómo te llamas', 'warning');
      return;
    }
    
    this.isSaving.set(true);

    try {
      await this.clientesService.upsertClienteExpress(nom, tel, '');

      const fechaFirme = this.fechaSeleccionada() || this.primerDiaStr();
      const partes = fechaFirme.split('-');
      let fechaLlegada = '';
      
      if (partes.length === 3) {
        const [year, month, day] = partes;
        fechaLlegada = `${day}/${month}/${year}, ${this.horaSeleccionada()}:00`;
      } else {
        const hoy = new Date();
        const d = hoy.getDate().toString().padStart(2, '0');
        const m = (hoy.getMonth() + 1).toString().padStart(2, '0');
        fechaLlegada = `${d}/${m}/${hoy.getFullYear()}, ${this.horaSeleccionada()}:00`;
      }

      const nombreBarbero = this.barberoSeleccionado()?.nombre || this.barberos()[0]?.nombre || 'Staff';
      const servicio = this.servicioSeleccionado();

      const turnoNuevo: any = {
        id: Date.now(),
        servicio: servicio?.nombre,
        barbero: nombreBarbero,
        cliente: nom,
        monto: servicio?.precio || 0,
        estado: 'pending_confirmation',
        origen: 'web', 
        fecha: fechaLlegada,
        metodoPago: 'Pendiente',
        notas: this.notaCliente() + ` (Telf: ${tel})`
      };

      await this.turnosService.agregarTurno(turnoNuevo);
      this.reservaConfirmada.set(true);
      
    } catch (error) {
      console.error(error);
      this.toast.show('Hubo un error al procesar tu reserva', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  reiniciar() {
    this.pasoActual.set(1);
    this.subPasoCalendario.set('dias');
    this.servicioSeleccionado.set(null);
    this.barberoSeleccionado.set(null);
    this.fechaSeleccionada.set('');
    this.horaSeleccionada.set('');
    this.reservaConfirmada.set(false);
    this.telefonoCliente.set('');
    this.nombreCliente.set('');
    this.notaCliente.set('');
  }
}