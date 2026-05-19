import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../../core/services/pwa';

@Component({
  selector: 'app-instalar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instalar.html'
})
export class InstalarComponent {
  pwaService = inject(PwaService);
}