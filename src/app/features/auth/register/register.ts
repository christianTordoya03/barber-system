import { Component, inject, OnInit, signal } from '@angular/core';
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
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  public supabase = inject(SupabaseService); 
  private router = inject(Router);

  isLoading = signal<boolean>(false);
  isTenantLoading = signal<boolean>(true); // Controla la animación de carga
  successMessage = signal<string | null>(null);
  showPassword = signal<boolean>(false);

  registerForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    telefono: ['', [Validators.required, Validators.minLength(9)]],
    fechaNacimiento: [''],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  async ngOnInit() {
    // Verificamos si ya tenemos cargada la barbería, si no, la buscamos
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
        console.error('Error cargando la barbería en Registro:', error.message);
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
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    
    // Validamos que el tenant (la barbería) exista antes de registrar
    const tenantData = this.supabase.tenant();
    if (!tenantData || !tenantData.id) {
      alert('Error: No se pudo identificar la barbería a la que te estás registrando.');
      return;
    }

    this.isLoading.set(true);
    this.successMessage.set(null);

    const { fullName, telefono, fechaNacimiento, password } = this.registerForm.getRawValue();
    
    // 1. Limpiamos el celular: dejamos SOLO NÚMEROS
    const telefonoLimpio = telefono.replace(/[^0-9]/g, '');

    // 2. Limpiamos el nombre de la barbería: sin tildes, espacios ni símbolos
    const tenantName = tenantData.name || 'aureumlogic';
    const dominioDinamico = tenantName
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9]/g, '') 
      + '.com';

    // 3. Generamos un correo perfectamente válido siempre
    const emailFormateado = `${telefonoLimpio}@${dominioDinamico}`;

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

      // GUARDAR AL CLIENTE LIGADO A SU BARBERÍA (Multi-tenant)
      const { error: clienteError } = await this.supabase.client.from('clientes').insert({
        nombre: fullName,
        telefono: telefono,
        email: emailFormateado,
        fecha_nacimiento: fechaNacimiento || null,
        barbershop_id: tenantData.id // <--- LA LLAVE MAESTRA
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