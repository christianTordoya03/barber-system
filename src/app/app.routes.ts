import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'update-password',
    loadComponent: () => import('./features/auth/update-password/update-password').then(m => m.UpdatePasswordComponent)
  },
  // --- NUEVA RUTA DEL ADMINISTRADOR ---
  {
    path: 'admin',
    canActivate: [authGuard],
    loadComponent: () => import('./features/admin/admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'realizar-servicio',
        loadComponent: () => import('./features/admin/realizar-servicio/realizar-servicio').then(m => m.RealizarServicioComponent)
      },
      {
        path: 'cobros',
        loadComponent: () => import('./features/admin/cobros/cobros').then(m => m.CobrosComponent)
      },
      {
        path: 'servicios',
        loadComponent: () => import('./features/admin/servicios/servicios').then(m => m.ServiciosComponent)
      },
      {
        path: 'categorias',
        loadComponent: () => import('./features/admin/categorias/categorias').then(m => m.CategoriasComponent)
      },
      {
        path: 'staff',
        loadComponent: () => import('./features/admin/staff/staff').then(m => m.StaffComponent)
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'reportes',
        loadComponent: () => import('./features/admin/reportes/reportes').then(m => m.ReportesComponent)
      },
      {
        path: 'gastos',
        loadComponent: () => import('./features/admin/gastos/gastos').then(m => m.GastosComponent)
      },
      { 
         path: 'lista-empleado', 
         loadComponent: () => import('./features/admin/lista-empleado/lista-empleado').then(m => m.ListaEmpleadoComponent) 
      },
      // Por ahora, si entra a /admin, lo mandamos a realizar-servicio para que no vea la pantalla negra
      { path: '', redirectTo: 'realizar-servicio', pathMatch: 'full' }
    ]
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];