export interface Turno {
  id: number;
  barbershop_id?: string;
  servicio: string;
  barbero: string;
  cliente: string;
  cliente_id?: number;
  monto: number;
  // Añadimos 'pending_confirmation' para aislar las reservas hechas por la web pública
  estado: 'pending_confirmation' | 'pending' | 'in_progress' | 'finished' | 'completed' | 'annulled';
  fecha: string;
  metodoPago?: string | null;
  horaInicio?: string | null;
  notas?: string;
  // Para medir la efectividad de la web vs presencial
  origen?: 'web' | 'local'; 
}

export interface Cliente {
  id?: number;
  barbershop_id?: string;
  nombre: string;         
  telefono: string;       
  email?: string;
  fecha_nacimiento?: string; 
  avatar_url?: string;
  
  // Motor de Fidelización y Retención
  puntos_acumulados?: number; 
  visitas_totales?: number;   
  ultima_visita?: string;     
  
  notas_tecnicas?: string;
  fecha_registro?: string;
  estado?: string;
}

export interface Empleado {
  id: number;
  barbershop_id?: string;
  nombre: string;
  email: string;
  telefono?: string;
  rol: 'admin' | 'barbero' | 'recepcion';
  comision?: number | null;
  activo: boolean;
  avatar_url?: string | null;
  bio?: string | null;
  estado_asistencia?: 'disponible' | 'ocupado' | 'pausa' | 'descanso';
  ultima_vez_disponible?: string | null;
}

export interface Categoria {
  id: number;
  barbershop_id?: string;
  nombre: string;
}

export interface Servicio {
  id: number;
  barbershop_id?: string;
  nombre: string;
  categoria: string;
  descripcion?: string | null;
  precio: number;
  duracion: number;
  activo: boolean;
}

export interface Gasto {
  id: number;
  barbershop_id?: string;
  descripcion: string;
  monto: number;
  metodoPago: string;
  fecha: string;
  empleado_id?: number | null;
  estado?: 'activo' | 'anulado' | 'liquidado';
}

export interface TrabajoPortafolio {
  id: number;
  barbershop_id?: string;
  empleado_id: number;
  url_imagen: string;
  fecha: string;
}

export interface Comision {
  id: number;
  barbershop_id?: string;
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