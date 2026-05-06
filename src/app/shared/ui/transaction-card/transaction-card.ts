import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-transaction-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './transaction-card.html'
})
export class TransactionCardComponent {
  title = input.required<string>();
  subtitle = input.required<string>();
  amount = input.required<number>();
  status = input<'pending' | 'in_progress' | 'finished' | 'completed' | 'annulled'>('completed');
  type = input<'income' | 'expense'>('income');
  paymentMethod = input<string | undefined | null>(); 

  // --- NUEVOS INPUTS PARA LA BARRA DE PROGRESO ---
  progress = input<number>(0);
  timeText = input<string>('');

  onPay = output<void>();
  onEdit = output<void>();
  onAnnul = output<void>();
  onView = output<void>();
  onRestore = output<void>();
}