import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { ToastService } from '../../../core/services/toast';
import { CatalogoService } from '../../../core/services/catalogo'; // <-- IMPORTAMOS CATÁLOGO
import { StaffService } from '../../../core/services/staff';
import { Turno } from '../../../core/models/marina';

@Component({
  selector: 'app-realizar-servicio',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './realizar-servicio.html',
})
export class RealizarServicioComponent {
  private fb = inject(FormBuilder);
  private turnosService = inject(TurnosService);
  private toastService = inject(ToastService);
  private catalogoService = inject(CatalogoService);
  private staffService = inject(StaffService);

  isLoading = signal<boolean>(false);

  barberos = computed(() => {
    return this.staffService.empleados().filter(e => e.rol === 'barbero' && e.activo);
  });
  
  // Ahora la lista de servicios viene del cerebro central
  servicios = this.catalogoService.servicios;

  servicioForm = this.fb.nonNullable.group({
    barberoId: ['', Validators.required],
    clienteNombre: '',
    servicioId: ['', Validators.required]
  });

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

    // Generamos la fecha exacta del momento
    const fechaLlegada = new Date().toLocaleString('es-PE', { 
      year: 'numeric', month: '2-digit', day: '2-digit', 
      hour: '2-digit', minute:'2-digit', second:'2-digit' 
    });

    const nuevoTurno: Turno = {
       id: Date.now(), // <-- ¡AÑADE ESTA LÍNEA AQUÍ!
       servicio: servicio?.nombre || 'Servicio Estándar',
       barbero: barbero?.nombre || 'Barbero',
       cliente: formValues.clienteNombre?.trim() || 'Cliente de paso',
       monto: servicio?.precio || 0,
       estado: 'pending',
       fecha: fechaLlegada,
       metodoPago: 'Pendiente'
    };

    this.turnosService.agregarTurno(nuevoTurno);
    
    setTimeout(() => { 
      this.isLoading.set(false);
      this.toastService.show('¡Turno registrado con éxito! Ya está guardado en la nube.');
      this.servicioForm.reset({ clienteNombre: '', barberoId: '', servicioId: '' });
    }, 800);
  }
}