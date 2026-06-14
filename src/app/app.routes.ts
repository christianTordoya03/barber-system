import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';

export const routes: Routes = [
  // =========================================================
  // RUTAS DEL CLIENTE VIP (Protegidas por AuthGuard)
  // =========================================================
  {
    path: 'cliente',
    loadComponent: () => import('./features/cliente/cliente-layout/cliente-layout').then(m => m.ClienteLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./features/cliente/cliente-home/cliente-home').then(m => m.ClienteHomeComponent)
      },
      {
        path: 'reservar',
        loadComponent: () => import('./features/cliente/cliente-reservar/cliente-reservar').then(m => m.ClienteReservarComponent)
      },
      {
        path: 'perfil',
        loadComponent: () => import('./features/cliente/cliente-perfil/cliente-perfil').then(m => m.ClientePerfilComponent)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  },

  // =========================================================
  // RUTAS DEL ADMINISTRADOR (Protegidas por AuthGuard)
  // =========================================================
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-layout/admin-layout').then(m => m.AdminLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'agenda',
        loadComponent: () => import('./features/admin/agenda/agenda').then(m => m.AgendaComponent)
      },
      {
        path: 'cobros',
        loadComponent: () => import('./features/admin/cobros/cobros').then(m => m.CobrosComponent)
      },
      {
        path: 'gastos',
        loadComponent: () => import('./features/admin/gastos/gastos').then(m => m.GastosComponent)
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
        path: 'realizar-servicio',
        loadComponent: () => import('./features/admin/realizar-servicio/realizar-servicio').then(m => m.RealizarServicioComponent)
      },
      {
        path: 'lista-empleado',
        loadComponent: () => import('./features/admin/lista-empleado/lista-empleado').then(m => m.ListaEmpleadoComponent)
      },
      {
        path: 'reportes',
        loadComponent: () => import('./features/admin/reportes/reportes').then(m => m.ReportesComponent)
      },
      // NUEVA RUTA DE INVENTARIO AÑADIDA AQUÍ
      {
        path: 'inventario',
        loadComponent: () => import('./features/admin/inventario/inventario').then(m => m.InventarioComponent)
      }
    ]
  },

  // =========================================================
  // RUTAS DEL BARBERO (Protegidas por AuthGuard)
  // =========================================================
  {
    path: 'barbero',
    loadComponent: () => import('./features/barbero/barbero-layout/barbero-layout').then(m => m.BarberoLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/barbero/dashboard/dashboard').then(m => m.BarberoDashboardComponent)
      },
      {
        path: 'historial',
        loadComponent: () => import('./features/barbero/historial/historial').then(m => m.BarberoHistorialComponent)
      },
      {
        path: 'perfil',
        loadComponent: () => import('./features/barbero/perfil/perfil').then(m => m.BarberoPerfilComponent)
      }
    ]
  },

  // =========================================================
  // RUTAS DE AUTENTICACIÓN (Públicas)
  // =========================================================
  {
    path: 'instalar',
    loadComponent: () => import('./features/clientes/instalar/instalar').then(m => m.InstalarComponent)
  },
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

  // Redirección por defecto si la ruta no existe o entran a la raíz
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];