import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';

@Component({
  selector: 'app-update-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './update-password.html',
})
export class UpdatePasswordComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  successMessage = signal<string | null>(null);

  updateForm = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  async onSubmit() {
    if (this.updateForm.invalid) return;

    this.isLoading.set(true);
    const { password } = this.updateForm.getRawValue();

    try {
      // Supabase actualiza la contraseña del usuario que acaba de entrar con el link
      const { error } = await this.supabase.client.auth.updateUser({ password });
      if (error) throw error;
      
      this.successMessage.set('Contraseña actualizada con éxito.');
      
      // Esperamos 2 segundos y lo mandamos al admin (o login)
      setTimeout(() => {
        this.router.navigate(['/admin']);
      }, 2000);

    } catch (error: any) {
      console.error('Error al actualizar', error);
      alert(error.message || 'Ocurrió un error al actualizar la contraseña');
    } finally {
      this.isLoading.set(false);
    }
  }
}