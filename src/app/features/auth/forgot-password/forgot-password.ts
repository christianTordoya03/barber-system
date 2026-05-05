import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/supabase';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private supabase = inject(SupabaseService);

  isLoading = signal<boolean>(false);
  isSent = signal<boolean>(false);

  forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]]
  });

  async onSubmit() {
    if (this.forgotForm.invalid) return;

    this.isLoading.set(true);
    const { email } = this.forgotForm.getRawValue();

    try {
      const { error } = await this.supabase.client.auth.resetPasswordForEmail(email, {
        redirectTo: 'http://localhost:4200/update-password'
      });
      if (error) throw error;
      this.isSent.set(true);
    } catch (error: any) {
      console.error('Error al recuperar', error);
      alert(error.message || 'Ocurrió un error');
    } finally {
      this.isLoading.set(false);
    }
  }
}