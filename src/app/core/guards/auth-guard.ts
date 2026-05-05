import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../supabase/supabase';

export const authGuard: CanActivateFn = async (route, state) => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  // Le preguntamos a Supabase si el usuario tiene una sesión real y vigente
  const { data } = await supabase.client.auth.getSession();

  if (data.session) {
    return true; // Adelante, pasa al panel de admin
  } else {
    router.navigate(['/login']); // Bloqueado, devuelta al login
    return false;
  }
};