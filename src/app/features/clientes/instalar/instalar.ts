import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../../../core/services/pwa';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-instalar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instalar.html'
})
export class InstalarComponent {
  pwaService = inject(PwaService);
}