export interface Turno {
  id: number;
  servicio: string;
  barbero: string;
  cliente: string;
  cliente_id?: number;
  monto: number;
  estado: 'pending' | 'in_progress' | 'finished' | 'completed' | 'annulled';
  fecha: string;
  metodoPago?: string | null;
  horaInicio?: string | null;
  notas?: string;
}

export interface Cliente {
  id?: number;
  nombre: string;
  telefono: string;      // Campo clave para tus promociones
  email?: string;        // Opcional para el cliente, valioso para ti
  fecha_nacimiento?: string; // Para enviar promociones de cumpleaños
  avatar_url?: string;
  puntos_acumulados?: number;
  notas_tecnicas?: string; // Notas de cortes anteriores (visibles para barberos)
  fecha_registro?: string;
}

export interface Empleado {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  rol: 'admin' | 'barbero';
  comision?: number | null;
  activo: boolean;
  avatar_url?: string | null;
  bio?: string | null;
  estado_asistencia?: 'disponible' | 'ocupado' | 'pausa' | 'descanso';
  ultima_vez_disponible?: string | null;
}

export interface Categoria {
  id: number;
  nombre: string;
}

export interface Servicio {
  id: number;
  nombre: string;
  categoria: string;
  descripcion?: string | null;
  precio: number;
  duracion: number;
  activo: boolean;
}

export interface Gasto {
  id: number;
  descripcion: string;
  monto: number;
  metodoPago: string;
  fecha: string;
  empleado_id?: number | null;
  estado?: 'activo' | 'anulado' | 'liquidado';
}

export interface TrabajoPortafolio {
  id: number;
  empleado_id: number;
  url_imagen: string;
  fecha: string;
}

export interface Comision {
  id: number;
  empleado_id: number;
  tipo: 'propina' | 'producto' | 'servicio_extra';
  monto: number;
  descripcion?: string;
  fecha: string;
  created_at?: string;
  estado?: 'activo' | 'anulado';
  empleados?: { nombre: string }; // Relación para los reportes del Admin
}

export interface PerfilCliente {
  id?: string;
  user_id?: string;
  email: string;
  nombre: string;
  telefono?: string;
  puntos: number;
  cortes_totales: number;
  nivel: 'Classic' | 'Silver' | 'Gold' | string;
  created_at?: string;
}