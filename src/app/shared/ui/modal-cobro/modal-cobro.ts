import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-modal-cobro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modal-cobro.html'
})
export class ModalCobroComponent {
  isOpen = input.required<boolean>();
  cobro = input<any>(null); 

  onClose = output<void>();
  onConfirm = output<string>(); 

  metodoPagoSeleccionado = signal<string>('Yape');
  isProcessing = signal<boolean>(false);
  
  esPagoMixto = signal<boolean>(false);
  formaPago1 = signal<string>('');
  formaPago2 = signal<string>('');
  montoPago1 = signal<number>(0);

  constructor() {
    // Limpia el modal cada vez que se abre
    effect(() => {
       if (this.isOpen() && this.cobro()) {
         this.esPagoMixto.set(false);
         this.metodoPagoSeleccionado.set('Yape');
         this.formaPago1.set('');
         this.formaPago2.set('');
         this.montoPago1.set(0);
       }
    }, { allowSignalWrites: true });
  }

  getMontoRestante(): number {
    const total = this.cobro()?.monto || 0;
    const pagado1 = this.montoPago1() || 0;
    const restante = total - pagado1;
    return restante > 0 ? restante : 0;
  }

  toggleMixto(event: Event) {
    const isChecked = (event.target as HTMLInputElement).checked;
    this.esPagoMixto.set(isChecked);
  }

  confirmar() {
    this.isProcessing.set(true);
    let metodoFinal = this.metodoPagoSeleccionado();

    if (this.esPagoMixto()) {
      const monto2 = this.getMontoRestante();
      metodoFinal = `${this.formaPago1()} (S/ ${this.montoPago1()}) + ${this.formaPago2()} (S/ ${monto2})`;
    }

    setTimeout(() => {
      this.isProcessing.set(false);
      this.onConfirm.emit(metodoFinal);
    }, 800);
  }
}