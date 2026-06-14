import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning'; // <-- Añadimos 'warning'
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(message: string, type: 'success' | 'error' | 'warning' = 'success') {
    const id = Date.now();
    this.toasts.update(current => [...current, { id, message, type }]);
    
    // Se elimina automáticamente después de 3.5 segundos
    setTimeout(() => {
      this.remove(id);
    }, 3500);
  }

  // Métodos de conveniencia añadidos
  showSuccess(message: string) {
    this.show(message, 'success');
  }

  showError(message: string) {
    this.show(message, 'error');
  }

  showWarning(message: string) {
    this.show(message, 'warning');
  }

  remove(id: number) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}