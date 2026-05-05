import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-cobro',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-cobro.html'
})
export class ModalCobroComponent {
  // Lo que recibe del padre (Cobros, Dashboard, etc)
  isOpen = input.required<boolean>();
  cobro = input<any>(null); // Los datos del ticket

  // Lo que le responde al padre
  onClose = output<void>();
  onConfirm = output<string>(); // Le devuelve el método de pago ('Yape', 'Efectivo'...)

  // Lógica interna del modal
  metodoPagoSeleccionado = signal<string>('Yape');
  isProcessing = signal<boolean>(false);

  confirmar() {
    this.isProcessing.set(true);
    
    // Simulamos el tiempo de proceso interno antes de avisarle al padre
    setTimeout(() => {
      this.isProcessing.set(false);
      this.onConfirm.emit(this.metodoPagoSeleccionado());
      this.metodoPagoSeleccionado.set('Yape'); // Reseteamos para la próxima vez
    }, 800);
  }
}