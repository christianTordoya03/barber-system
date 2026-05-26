import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html',
})
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  successMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  registerForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    telefono: ['', [Validators.required, Validators.minLength(9)]],
    fechaNacimiento: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  togglePassword() {
    this.showPassword.update(v => !v);
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    this.isLoading.set(true);
    this.successMessage.set(null);

    const { fullName, telefono, fechaNacimiento, password } = this.registerForm.getRawValue();
    
    // EL TRUCO: Creamos el correo falso para Supabase auth
    const emailFormateado = `${telefono.trim()}@marina305.com`;

    try {
      const { data, error } = await this.supabase.client.auth.signUp({
        email: emailFormateado,
        password,
        options: { 
          data: { 
            full_name: fullName,
            telefono: telefono 
          } 
        }
      });
      
      if (error) throw error;

      // Guardamos en la base de datos de clientes con los campos que ya manejabas
      const { error: clienteError } = await this.supabase.client.from('clientes').insert({
        nombre: fullName,
        telefono: telefono,
        email: emailFormateado,
        fecha_nacimiento: fechaNacimiento || null
      });

      if (clienteError) {
        console.error('Error registrando base de clientes:', clienteError);
      }

      this.successMessage.set('¡Cuenta creada exitosamente! Ya puedes iniciar sesión.');
      this.registerForm.reset();

    } catch (error: any) {
      console.error('Error al registrar', error);
      alert(error.message || 'Error al crear la cuenta, el celular ya podría estar en uso.');
    } finally {
      this.isLoading.set(false);
    }
  }
}