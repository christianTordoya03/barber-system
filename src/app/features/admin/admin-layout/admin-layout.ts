import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.html',
})
export class AdminLayoutComponent {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  // Variable para controlar el menú desplegable en celular
  isMobileMenuOpen = signal<boolean>(false);

  async logout() {
    await this.supabase.client.auth.signOut();
    this.router.navigate(['/login']);
  }
}