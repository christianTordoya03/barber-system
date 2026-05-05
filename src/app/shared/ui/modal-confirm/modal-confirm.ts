import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-confirm',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal-confirm.html'
})
export class ModalConfirmComponent {
  isOpen = input.required<boolean>();
  title = input.required<string>();
  message = input.required<string>();
  confirmText = input<string>('Confirmar');
  type = input<'danger' | 'info'>('danger'); // Define si el botón/ícono es rojo o azul

  onConfirm = output<void>();
  onCancel = output<void>();
}