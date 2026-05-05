import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-detalle',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-detalle.html'
})
export class ModalDetalleComponent {
  isOpen = input.required<boolean>();
  data = input<any>(null); // Recibe toda la info de la transacción
  onClose = output<void>();
}