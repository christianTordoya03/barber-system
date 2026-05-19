import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // 1. Leemos el localStorage, pero si está vacío, el respaldo (fallback) será 'dark' 👈
  private themeSignal = signal<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
  );

  // Exponemos la señal como lectura para tus componentes
  public theme = this.themeSignal.asReadonly();

  constructor() {
    // 2. Aplicamos el tema correcto en el segundo en que se levanta el servicio
    this.aplicarTemaHtml(this.themeSignal());
  }

  /**
   * Alterna entre modo claro y oscuro
   */
  public toggleTheme() {
    const nuevoTema = this.themeSignal() === 'light' ? 'dark' : 'light';
    this.themeSignal.set(nuevoTema);
    localStorage.setItem('theme', nuevoTema);
    this.aplicarTemaHtml(nuevoTema);
  }

  /**
   * Inyecta o remueve la clase 'dark' en la etiqueta <html> para Tailwind
   */
  private aplicarTemaHtml(tema: 'light' | 'dark') {
    const root = window.document.documentElement;
    if (tema === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
}