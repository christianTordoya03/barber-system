import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupabaseService } from '../../../core/supabase/supabase';
import { ToastService } from '../../../core/services/toast';

@Component({
  selector: 'app-crm-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './crm-clientes.html'
})
export class CrmClientesComponent implements OnInit {
  public supabase = inject(SupabaseService);
  private toast = inject(ToastService);

  clientes = signal<any[]>([]);
  isLoading = signal<boolean>(true);
  
  // --- BUSCADOR Y PAGINACIÓN ---
  busqueda = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = 15;

  clientesFiltrados = computed(() => {
    const query = this.busqueda().toLowerCase().trim();
    if (!query) return this.clientes();
    
    return this.clientes().filter(c => 
      (c.nombre || '').toLowerCase().includes(query) || 
      (c.telefono && c.telefono.includes(query))
    );
  });

  totalPages = computed(() => Math.ceil(this.clientesFiltrados().length / this.pageSize) || 1);

  paginatedClientes = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize;
    return this.clientesFiltrados().slice(startIndex, startIndex + this.pageSize);
  });

  // --- ESTADOS PARA MODALES ---
  isAddModalOpen = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  nuevoClienteNombre = signal<string>('');
  nuevoClienteTelefono = signal<string>('');

  isEditModalOpen = signal<boolean>(false);
  isEditing = signal<boolean>(false);
  clienteSeleccionado = signal<any>(null);
  editClienteNombre = signal<string>('');
  editClienteTelefono = signal<string>('');
  mostrarToggleIds = signal<number[]>([]);

  isDeleteModalOpen = signal<boolean>(false);
  isDeleting = signal<boolean>(false);

  async ngOnInit() {
    await this.cargarClientes();
  }

  async cargarClientes() {
    this.isLoading.set(true);
    try {
      // 1. Descargamos la lista limpia de la base de datos
      const { data, error } = await this.supabase.client
        .from('clientes')
        .select('*');

      if (error) throw error;
      
      if (data) {
        // 2. Motor de Ordenamiento Inteligente Frontend
        const clientesOrdenados = data.sort((a, b) => {
          
          // Función interna para decidir cuál es el "momento" más importante del cliente
          const getRelevancia = (c: any) => {
            if (c.ultima_visita) return new Date(c.ultima_visita).getTime();
            if (c.created_at) return new Date(c.created_at).getTime();
            return c.id; // Respaldo técnico de emergencia
          };

          const tiempoA = getRelevancia(a);
          const tiempoB = getRelevancia(b);

          // Si llegaran a empatar en el mismo segundo, el ID más alto (el más reciente) gana
          if (tiempoA === tiempoB) return b.id - a.id;
          
          // Ordenamos de mayor a menor (los más recientes hasta arriba)
          return tiempoB - tiempoA;
        });

        this.clientes.set(clientesOrdenados);
      }
    } catch (error) {
      console.error('Error al cargar clientes:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  onBusquedaChange(termino: string) {
    this.busqueda.set(termino);
    this.currentPage.set(1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) this.currentPage.update(p => p + 1);
  }

  prevPage() {
    if (this.currentPage() > 1) this.currentPage.update(p => p - 1);
  }

  onTelefonoChange(valor: string) {
    const soloNumeros = valor.replace(/[^0-9]/g, '').slice(0, 9);
    this.nuevoClienteTelefono.set(soloNumeros);
  }

  onEditTelefonoChange(valor: string) {
    const soloNumeros = valor.replace(/[^0-9]/g, '').slice(0, 9);
    this.editClienteTelefono.set(soloNumeros);
  }

  // --- LÓGICA: CREAR CLIENTE ---
  abrirModalNuevo() {
    this.nuevoClienteNombre.set('');
    this.nuevoClienteTelefono.set('');
    this.isAddModalOpen.set(true);
  }

  cerrarModalNuevo() {
    this.isAddModalOpen.set(false);
  }

  async guardarNuevoCliente() {
    const nombre = this.nuevoClienteNombre().trim();
    const telefono = this.nuevoClienteTelefono().trim();

    if (nombre.length < 2) {
      this.toast.show('El nombre debe tener al menos 2 letras', 'warning');
      return;
    }

    this.isSaving.set(true);

    try {
      const bsId = this.supabase.tenant()?.id;
      const nuevo = {
        nombre: nombre,
        telefono: telefono || null,
        barbershop_id: bsId,
        visitas_totales: 0,
        puntos_acumulados: 0,
        ultima_visita: null
      };

      const { data, error } = await this.supabase.client
        .from('clientes')
        .insert(nuevo)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        this.clientes.update(c => [data, ...c]);
        this.toast.show('Cliente agregado exitosamente', 'success');
        this.cerrarModalNuevo();
        this.currentPage.set(1);
        this.busqueda.set('');
      }
    } catch (error: any) {
      console.error(error);
      if (error.code === '23505') {
        this.toast.show('Este número de celular ya está registrado', 'error');
      } else {
        this.toast.show('Hubo un error al guardar el cliente', 'error');
      }
    } finally {
      this.isSaving.set(false);
    }
  }

  // --- LÓGICA: EDITAR CLIENTE ---
  abrirModalEditar(cliente: any) {
    this.clienteSeleccionado.set(cliente);
    this.editClienteNombre.set(cliente.nombre);
    this.editClienteTelefono.set(cliente.telefono || '');
    this.isEditModalOpen.set(true);
  }

  cerrarModalEditar() {
    this.isEditModalOpen.set(false);
    this.clienteSeleccionado.set(null);
  }

  async guardarEdicion() {
    const cliente = this.clienteSeleccionado();
    if (!cliente) return;

    const nombre = this.editClienteNombre().trim();
    const telefono = this.editClienteTelefono().trim();

    if (nombre.length < 2) {
      this.toast.show('El nombre debe tener al menos 2 letras', 'warning');
      return;
    }

    this.isEditing.set(true);

    try {
      const updates = {
        nombre: nombre,
        telefono: telefono || null
      };

      const { error } = await this.supabase.client
        .from('clientes')
        .update(updates)
        .eq('id', cliente.id);

      if (error) throw error;

      // Actualizamos la lista local en tiempo real sin recargar de BD
      this.clientes.update(c => c.map(item => item.id === cliente.id ? { ...item, ...updates } : item));
      this.toast.show('Cliente actualizado', 'success');
      this.cerrarModalEditar();

    } catch (error: any) {
      console.error(error);
      if (error.code === '23505') {
        this.toast.show('Ese celular ya pertenece a otro cliente', 'error');
      } else {
        this.toast.show('Error al actualizar el cliente', 'error');
      }
    } finally {
      this.isEditing.set(false);
    }
  }

  // --- LÓGICA: ELIMINAR CLIENTE ---
  abrirModalEliminar(cliente: any) {
    this.clienteSeleccionado.set(cliente);
    this.isDeleteModalOpen.set(true);
  }

  cerrarModalEliminar() {
    this.isDeleteModalOpen.set(false);
    this.clienteSeleccionado.set(null);
  }

  async confirmarEliminar() {
    const cliente = this.clienteSeleccionado();
    if (!cliente) return;

    this.isDeleting.set(true);

    try {
      const { error } = await this.supabase.client
        .from('clientes')
        .delete()
        .eq('id', cliente.id);

      if (error) throw error;

      // Removemos de la lista local
      this.clientes.update(c => c.filter(item => item.id !== cliente.id));
      this.toast.show('Cliente eliminado', 'success');
      this.cerrarModalEliminar();

      // Si nos quedamos sin clientes en la página actual, retrocedemos una página
      if (this.paginatedClientes().length === 0 && this.currentPage() > 1) {
        this.prevPage();
      }

    } catch (error) {
      console.error(error);
      this.toast.show('Error al eliminar, asegúrate que no tenga cobros asociados', 'error');
    } finally {
      this.isDeleting.set(false);
    }
  }

  // --- LÓGICA DE INTERFAZ Y WHATSAPP ---
  obtenerEstado(cliente: any): 'NUEVO' | 'INACTIVO' | 'ACTIVO' {
    const visitas = cliente.visitas_totales || 0;
    
    // Si tiene exactamente 0 visitas, es NUEVO y le toca mensaje de Bienvenida
    if (visitas === 0) return 'NUEVO';
    
    // Si ya tiene 1 visita o más, evaluamos cuánto tiempo ha pasado
    if (cliente.ultima_visita) {
      const diffDias = (new Date().getTime() - new Date(cliente.ultima_visita).getTime()) / (1000 * 3600 * 24);
      // Si pasaron más de 28 días, pasa a INACTIVO para recuperarlo
      return diffDias > 28 ? 'INACTIVO' : 'ACTIVO';
    }
    
    return 'ACTIVO'; // Estado por defecto si ya se hizo al menos 1 corte
  }

  formatearFechaLiteral(fechaIso: string): string {
    if (!fechaIso) return 'Sin registro';
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const fecha = new Date(fechaIso);
    return `${fecha.getDate()} ${meses[fecha.getMonth()]}. ${fecha.getFullYear()}`;
  }

  abrirWhatsAppBienvenida(clienteId: number, telefono: string, nombre: string) {
    if (!telefono) return;
    const linkReserva = 'https://sistema.marina305.net/reserva/marina305';
    
    // Mostramos el interruptor de Sí/No para este cliente
    this.mostrarToggleIds.update(ids => [...new Set([...ids, clienteId])]);

    const mensaje = `*¡Hola ${nombre}!* Bienvenido a *Marina 305*.\n\nTu tarjeta de fidelización ya está activa: cada 5 cortes, el 6to es *GRATIS*.\n\nPara tu próxima cita, agéndala aquí:\n${linkReserva}`;
    window.open(`https://wa.me/${this.limpiarNumero(telefono)}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }

  abrirWhatsAppRecuperacion(clienteId: number, telefono: string, nombre: string) {
    if (!telefono) return;
    const linkReserva = 'https://sistema.marina305.net/reserva/marina305';
    
    const mensaje = `*¡Hola ${nombre}!* Te extrañamos por *Marina 305*.\n\nHan pasado algunas semanas desde tu último corte y queríamos invitarte a refrescar tu estilo.\n\n¿Te gustaría agendar una cita para estos días?\nPuedes ver nuestros horarios aquí:\n${linkReserva}`;
    window.open(`https://wa.me/${this.limpiarNumero(telefono)}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }

  async marcarMensajeEnviado(clienteId: any, enviado: boolean) {
    // Ocultamos el interruptor inmediatamente para limpiar la pantalla
    this.mostrarToggleIds.update(ids => ids.filter(id => id !== clienteId));

    this.clientes.update(c => c.map(item => 
      item.id === clienteId ? { ...item, mensaje_bienvenida_enviado: enviado } : item
    ));

    try {
      const { error } = await this.supabase.client
        .from('clientes')
        .update({ mensaje_bienvenida_enviado: enviado })
        .eq('id', clienteId);

      if (error) throw error;
      
      if (enviado) {
        this.toast.show('Marcado como enviado', 'success');
      }

    } catch (error) {
      console.error('Error al actualizar estado del mensaje:', error);
      this.clientes.update(c => c.map(item => 
        item.id === clienteId ? { ...item, mensaje_bienvenida_enviado: !enviado } : item
      ));
      this.toast.show('Error al guardar el estado', 'error');
    }
  }

  private limpiarNumero(telefono: string): string {
    const num = telefono.replace(/[^0-9]/g, '');
    return num.length === 9 ? `51${num}` : num;
  }
}