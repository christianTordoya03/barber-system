import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.html',
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  showPassword = signal<boolean>(false);

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  async onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    const correo = this.loginForm.getRawValue().email.trim();
    const password = this.loginForm.getRawValue().password;

    try {
      const { data, error } = await this.supabase.client.auth.signInWithPassword({ 
        email: correo, 
        password 
      });
      if (error) throw error;

      // Buscamos si el usuario existe en la tabla de empleados
      const { data: empleado } = await this.supabase.client
        .from('empleados')
        .select('rol')
        .eq('email', correo)
        .maybeSingle(); // Usamos maybeSingle para que no arroje error si no lo encuentra

      // ENRUTADOR MAESTRO DE TRES VÍAS
      if (empleado?.rol === 'admin') {
        this.router.navigate(['/admin/dashboard']);
      } else if (empleado?.rol === 'barbero') {
        this.router.navigate(['/barbero/dashboard']);
      } else {
        // Si no es admin ni barbero, es un CLIENTE
        this.router.navigate(['/cliente/home']);
      }

    } catch (error) {
      console.error('Error al iniciar sesión', error);
      alert('Credenciales incorrectas o error de conexión');
    } finally {
      this.isLoading.set(false);
    }
  }
}