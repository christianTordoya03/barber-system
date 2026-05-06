export interface Turno {
  id: number;
  servicio: string;
  barbero: string;
  cliente: string;
  monto: number;
  estado: 'pending' | 'in_progress' | 'finished' | 'completed' | 'annulled';
  fecha: string;
  metodoPago?: string | null;
  horaInicio?: string | null;
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