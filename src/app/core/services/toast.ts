import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  toasts = signal<Toast[]>([]);

  show(message: string, type: 'success' | 'error' = 'success') {
    const id = Date.now();
    this.toasts.update(current => [...current, { id, message, type }]);
    
    // Se elimina automáticamente después de 3.5 segundos
    setTimeout(() => {
      this.remove(id);
    }, 3500);
  }

  remove(id: number) {
    this.toasts.update(current => current.filter(t => t.id !== id));
  }
}