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
  showPassword = signal<boolean>(false); // NUEVO: Estado para ver contraseña

  loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // NUEVO: Función para alternar el ojito
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

      const { data: empleado } = await this.supabase.client
        .from('empleados')
        .select('rol')
        .eq('email', correo)
        .single();

      // NUEVA LÓGICA BLINDADA: Solo el que diga 'admin' en la tabla entra al panel maestro
      if (empleado?.rol === 'admin') {
        this.router.navigate(['/admin/dashboard']);
      } else {
        // Cualquier otro usuario (barbero o recién registrado) va al panel de empleado
        this.router.navigate(['/barbero/dashboard']);
      }

    } catch (error) {
      console.error('Error al iniciar sesión', error);
      alert('Credenciales incorrectas o error de conexión');
    } finally {
      this.isLoading.set(false);
    }
  }
}