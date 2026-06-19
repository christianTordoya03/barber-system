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
  // 1. Agregamos 'pending_confirmation' a la firma del input
  status = input<'pending_confirmation' | 'pending' | 'in_progress' | 'finished' | 'completed' | 'annulled'>('completed');
  type = input<'income' | 'expense'>('income');
  paymentMethod = input<string | undefined | null>(); 

  progress = input<number>(0);
  timeText = input<string>('');

  onStart = output<void>(); 
  onPay = output<void>();
  onEdit = output<void>();
  onAnnul = output<void>();
  onView = output<void>();
  onRestore = output<void>();
}