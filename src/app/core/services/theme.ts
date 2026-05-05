import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Signal para saber el estado actual (por defecto 'light' para que se parezca a su sistema anterior)
  theme = signal<'light' | 'dark'>('light');

  constructor() {
    this.loadTheme();
  }

  toggleTheme() {
    const newTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.theme.set(newTheme);
    this.applyTheme(newTheme);
    localStorage.setItem('marina305_theme', newTheme);
  }

  private loadTheme() {
    // Revisamos si ya había elegido un tema antes
    const savedTheme = localStorage.getItem('marina305_theme') as 'light' | 'dark';
    if (savedTheme) {
      this.theme.set(savedTheme);
      this.applyTheme(savedTheme);
    } else {
      // Si no hay nada, forzamos light
      this.applyTheme('light');
    }
  }

  private applyTheme(theme: 'light' | 'dark') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}