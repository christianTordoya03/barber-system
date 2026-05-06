import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme';
import { ToastComponent } from './shared/ui/toast/toast';
// import { PwaService } from './core/services/pwa'; // <-- 1. Importa

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('barber-saas');
  themeService = inject(ThemeService);
  // pwaService = inject(PwaService); // <-- 2. Inyecta para que inicie al cargar la app
}