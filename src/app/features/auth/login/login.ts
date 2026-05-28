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
    identificador: ['', [Validators.required]],
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
    
    const inputId = this.loginForm.getRawValue().identificador.trim();
    const password = this.loginForm.getRawValue().password;

    const correo = inputId.includes('@') ? inputId : `${inputId}@marina305.com`;

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
        .maybeSingle();

      // NORMALIZAR ROL PARA EVITAR ERRORES DE MAYÚSCULAS/MINÚSCULAS
      const rolNormalizado = empleado?.rol?.toLowerCase();

      if (rolNormalizado === 'admin' || rolNormalizado === 'recepcion') {
        this.router.navigate(['/admin/dashboard']);
      } else if (rolNormalizado === 'barbero') {
        this.router.navigate(['/barbero/dashboard']);
      } else {
        // CLIENTE
        this.router.navigate(['/cliente/home']);
      }

    } catch (error) {
      console.error('Error al iniciar sesión', error);
      alert('Credenciales incorrectas');
    } finally {
      this.isLoading.set(false);
    }
  }
}