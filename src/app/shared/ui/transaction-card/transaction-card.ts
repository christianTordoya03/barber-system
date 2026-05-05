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
  status = input<'pending' | 'completed' | 'annulled'>('completed');
  type = input<'income' | 'expense'>('income');
  
  // NUEVO CAMPO: Lo hacemos opcional porque los "pendientes" aún no tienen método de pago
  paymentMethod = input<string | undefined | null>(); 

  onPay = output<void>();
  onEdit = output<void>();
  onAnnul = output<void>();
  onView = output<void>();
  onRestore = output<void>(); 
}