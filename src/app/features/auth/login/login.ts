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
      
      const hostActual = window.location.hostname;
      
      let query = this.supabase.client
        .from('barbershops')
        .select('id, name, logo_url, color_tema, instagram_url, facebook_url, tiktok_url');

      // 🔥 EL ESCUDO PROTECTOR 🔥
      if (hostActual === 'localhost' || hostActual === '127.0.0.1') {
        // ID por defecto para pruebas locales (Marina 305)
        query = query.eq('id', '7d790667-8d0b-4c1d-835f-3fd39abc20bd'); 
      } else if (hostActual === 'aureum.localhost') {
        // Búsqueda dinámica para la demo local
        query = query.eq('dominio', hostActual); 
      } else {
        // PRODUCCIÓN (Fallback seguro a Marina 305)
        query = query.eq('id', '7d790667-8d0b-4c1d-835f-3fd39abc20bd'); 
      }
        
      const { data, error } = await query.single();
        
      if (error) {
        console.error('Error cargando el tenant:', error.message);
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

    // LIMPIEZA DEL DOMINIO DINÁMICO (Sin espacios ni tildes)
    const tenantName = this.supabase.tenant()?.name || 'aureumlogic';
    const dominioDinamico = tenantName
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quita tildes
      .replace(/[^a-z0-9]/g, '') // Quita caracteres especiales y espacios
      + '.com';

    let correo = inputId;

    // Si NO escribió un '@', asumimos que es celular y lo limpiamos
    if (!inputId.includes('@')) {
      const telefonoLimpio = inputId.replace(/[^0-9]/g, ''); // Deja solo números
      correo = `${telefonoLimpio}@${dominioDinamico}`;
    }

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