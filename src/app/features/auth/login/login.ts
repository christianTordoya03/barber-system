import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router'; // <-- AGREGAR ESTO
import { SupabaseService } from '../../../core/supabase/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule], // <-- AGREGAR AQUÍ TAMBIÉN
  templateUrl: './login.html',
})
export class LoginComponent {
  // ... mantén todo tu código exacto como lo tienes aquí abajo ...
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    const { email, password } = this.loginForm.getRawValue();

    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({ 
        email, 
        password 
      });
      
      if (error) throw error;
      
      this.router.navigate(['/admin']);
      
    } catch (error) {
      console.error('Error al iniciar sesión', error);
      alert('Credenciales incorrectas o error de conexión');
    } finally {
      this.isLoading.set(false);
    }
  }
}