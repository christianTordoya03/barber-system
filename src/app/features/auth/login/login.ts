import { Component, inject, OnInit, signal } from '@angular/core';
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
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  public supabase = inject(SupabaseService);
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  isTenantLoading = signal<boolean>(true); // Variable que controla la animación de carga

  loginForm = this.fb.nonNullable.group({
    identificador: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async ngOnInit() {
    if (!this.supabase.tenant()) {
      this.isTenantLoading.set(true); 
      
      // 1. Leemos la URL actual de la barra del navegador
      const hostActual = window.location.hostname;
      
      let query = this.supabase.client
        .from('barbershops')
        .select('id, name, logo_url, color_tema');

      // 2. LÓGICA SAAS: Si estamos programando en local, forzamos un ID. 
      // Si estamos en internet, buscamos por la columna dominio.
      if (hostActual === 'localhost') {
        // AQUÍ DEJAS EL ID DE TU DEMO O DE MARINA MIENTRAS PROGRAMAS
        query = query.eq('id', '7d790667-8d0b-4c1d-835f-3fd39abc20bd'); 
      } else {
        // Esto funcionará automáticamente cuando agregues la columna 'dominio' a tu BD
        query = query.eq('dominio', hostActual); 
      }
        
      const { data, error } = await query.single();
        
      if (error) {
        console.error('Error cargando el tenant (¿Falta la columna dominio?):', error.message);
      }

      if (data) {
        this.supabase.tenant.set(data);
      }
      
      this.isTenantLoading.set(false); 
    } else {
      this.isTenantLoading.set(false);
    }
  }

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

    // 3. CORREO DINÁMICO: Limpiamos el nombre del tenant para usarlo como dominio de email
    const tenantName = this.supabase.tenant()?.name || 'aureumlogic';
    const dominioDinamico = tenantName.toLowerCase().replace(/\s+/g, '') + '.com';

    // Si escribe un correo, lo usa. Si escribe un celular, le adjunta el dominio dinámico.
    const correo = inputId.includes('@') ? inputId : `${inputId}@${dominioDinamico}`;

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