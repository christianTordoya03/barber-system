import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Verificamos si hay una sesión válida
  const { data: { session } } = await supabase.client.auth.getSession();

  if (!session) {
    router.navigate(['/login']); // Sin sesión, al login
    return false;
  }

  // Consultar directamente el rol a la base de datos
  const { data: empleado } = await supabase.client
    .from('empleados')
    .select('rol')
    .eq('email', session.user.email)
    .maybeSingle();

  const rol = empleado?.rol?.toLowerCase(); // Forzar minúsculas para seguridad
  const urlDestino = state.url;

  // Bloquear accesos cruzados (Barbero queriendo entrar a Admin y viceversa)
  if (urlDestino.includes('/admin') && rol !== 'admin' && rol !== 'recepcion') {
    router.navigate(['/login']); 
    return false;
  }

  if (urlDestino.includes('/barbero') && rol !== 'barbero') {
    router.navigate(['/login']);
    return false;
  }

  return true; // Si pasa las validaciones, lo dejamos entrar
};