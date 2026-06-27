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

  // --- MODO RÁFAGA (CREAR CLIENTES MASIVAMENTE) ---
  isAddModalOpen = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  
  // Arreglo dinámico para las filas de ingreso rápido
  bulkClientes = signal<{nombre: string, telefono: string}[]>(this.generarFilasVacias(5));

  // --- MODO COLA DE WHATSAPP ---
  clientesParaBienvenida = computed(() => {
    return this.clientes().filter(c => 
      (c.visitas_totales === 0 || !c.visitas_totales) && !c.mensaje_bienvenida_enviado
    );
  });
  
  isColaActiva = signal<boolean>(false);
  colaDeEnvio = signal<any[]>([]);
  colaIndex = signal<number>(0);

  // --- ESTADOS PARA MODALES DE EDICIÓN / ELIMINACIÓN ---
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
      const { data, error } = await this.supabase.client.from('clientes').select('*');
      if (error) throw error;
      
      if (data) {
        const clientesOrdenados = data.sort((a, b) => {
          const getRelevancia = (c: any) => {
            if (c.ultima_visita) return new Date(c.ultima_visita).getTime();
            if (c.created_at) return new Date(c.created_at).getTime();
            return c.id; 
          };
          const tiempoA = getRelevancia(a);
          const tiempoB = getRelevancia(b);
          if (tiempoA === tiempoB) return b.id - a.id;
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

  // --- LÓGICA: INGRESO RÁFAGA (BULK) ---
  generarFilasVacias(cantidad: number) {
    return Array(cantidad).fill(null).map(() => ({ nombre: '', telefono: '' }));
  }

  abrirModalBulk() {
    this.bulkClientes.set(this.generarFilasVacias(5));
    this.isAddModalOpen.set(true);
  }

  cerrarModalBulk() {
    this.isAddModalOpen.set(false);
  }

  onBulkChange(index: number, campo: 'nombre' | 'telefono', valor: string) {
    const actuales = [...this.bulkClientes()];
    
    if (campo === 'telefono') {
      actuales[index][campo] = valor.replace(/[^0-9]/g, '').slice(0, 9);
    } else {
      actuales[index][campo] = valor;
    }
    
    // Auto-crear una fila extra si el usuario escribe en la última fila
    if (index === actuales.length - 1 && actuales[index].nombre.trim().length > 0) {
      actuales.push({ nombre: '', telefono: '' });
    }
    
    this.bulkClientes.set(actuales);
  }

  async guardarClientesBulk() {
    // Filtramos solo las filas que tengan al menos el nombre completo
    const validos = this.bulkClientes().filter(c => c.nombre.trim().length >= 2);
    
    if (validos.length === 0) {
      this.toast.show('Escribe al menos el nombre de un cliente', 'warning');
      return;
    }

    // 1. Mapeamos todos los números de celular que ya existen en tu sistema local
    const telefonosExistentes = this.clientes()
      .map(c => c.telefono?.trim())
      .filter(t => !!t);

    // 2. Clasificamos los registros limpios de los duplicados
    const duplicadosDetectados: string[] = [];
    const filtradosParaGuardar = [];

    for (const cliente of validos) {
      const telTrim = cliente.telefono?.trim();
      
      if (telTrim && telefonosExistentes.includes(telTrim)) {
        // Guardamos el nombre del repetido para avisar luego
        duplicadosDetectados.push(cliente.nombre);
      } else {
        filtradosParaGuardar.push(cliente);
      }
    }

    // 3. Escenarios de control
    if (filtradosParaGuardar.length === 0) {
      this.toast.show('Todos los números ingresados ya existen en la base de datos', 'warning');
      return;
    }

    // Si hay repetidos, lanzamos un aviso preventivo pero dejamos continuar al resto
    if (duplicadosDetectados.length > 0) {
      this.toast.show(`Omitidos por número duplicado: ${duplicadosDetectados.join(', ')}`, 'warning');
    }

    this.isSaving.set(true);

    try {
      const bsId = this.supabase.tenant()?.id;
      const nuevos = filtradosParaGuardar.map(c => ({
        nombre: c.nombre.trim(),
        telefono: c.telefono.trim() || null,
        barbershop_id: bsId,
        visitas_totales: 0,
        puntos_acumulados: 0,
        mensaje_bienvenida_enviado: false
      }));

      // Enviamos solo el lote libre de duplicados
      const { data, error } = await this.supabase.client
        .from('clientes')
        .insert(nuevos)
        .select();

      if (error) throw error;

      if (data) {
        this.clientes.update(c => [...data.reverse(), ...c]);
        this.toast.show(`¡Éxito! Se registraron ${data.length} nuevos clientes`, 'success');
        this.cerrarModalBulk();
        this.currentPage.set(1);
        this.busqueda.set('');
      }
    } catch (error: any) {
      console.error(error);
      this.toast.show('Hubo un error inesperado al guardar el lote', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  // --- LÓGICA: COLA DE MENSAJES WHATSAPP ---
  iniciarCola() {
    const pendientes = this.clientesParaBienvenida();
    if (pendientes.length === 0) return;
    
    this.colaDeEnvio.set([...pendientes]);
    this.colaIndex.set(0);
    this.isColaActiva.set(true);
  }

  cerrarCola() {
    this.isColaActiva.set(false);
    this.colaDeEnvio.set([]);
  }

  async enviarSiguienteEnCola() {
    const cliente = this.colaDeEnvio()[this.colaIndex()];
    if (!cliente) {
      this.cerrarCola();
      return;
    }

    if (cliente.telefono) {
      const linkReserva = 'https://sistema.marina305.net/reserva/marina305';
      const mensaje = `*¡Hola!* Te saluda *Marina 305 Barber Shop*.\n\nA partir de hoy te estaremos compartiendo *promociones, novedades y beneficios exclusivos*.\n\n¿Quieres reservar tu próxima cita? Responde a este mensaje y con gusto te ayudamos.\n\nPara tu próxima cita, agéndala aquí:\n${linkReserva}`;
      
      // Abrimos WhatsApp en una nueva pestaña (seguro contra bloqueos porque el usuario hizo clic)
      window.open(`https://wa.me/${this.limpiarNumero(cliente.telefono)}?text=${encodeURIComponent(mensaje)}`, '_blank');
      
      // Marcamos en la DB silenciosamente (sin toast de éxito para no inundar la pantalla)
      await this.marcarMensajeEnviado(cliente.id, true, true);
    } else {
      this.toast.show(`Omitiendo a ${cliente.nombre} (No tiene celular)`, 'warning');
    }

    // Avanzamos al siguiente o terminamos
    if (this.colaIndex() + 1 >= this.colaDeEnvio().length) {
      setTimeout(() => {
        this.toast.show('¡Cola de mensajes finalizada!', 'success');
        this.cerrarCola();
      }, 500);
    } else {
      this.colaIndex.update(i => i + 1);
    }
  }

  // --- EDICIÓN Y ELIMINACIÓN (Mantenido intacto) ---
  onEditTelefonoChange(valor: string) {
    const soloNumeros = valor.replace(/[^0-9]/g, '').slice(0, 9);
    this.editClienteTelefono.set(soloNumeros);
  }

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
    if (nombre.length < 2) return this.toast.show('El nombre debe tener al menos 2 letras', 'warning');
    this.isEditing.set(true);
    try {
      const updates = { nombre: nombre, telefono: telefono || null };
      const { error } = await this.supabase.client.from('clientes').update(updates).eq('id', cliente.id);
      if (error) throw error;
      this.clientes.update(c => c.map(item => item.id === cliente.id ? { ...item, ...updates } : item));
      this.toast.show('Cliente actualizado', 'success');
      this.cerrarModalEditar();
    } catch (error: any) {
      if (error.code === '23505') this.toast.show('Ese celular ya pertenece a otro cliente', 'error');
      else this.toast.show('Error al actualizar el cliente', 'error');
    } finally {
      this.isEditing.set(false);
    }
  }

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
      const { error } = await this.supabase.client.from('clientes').delete().eq('id', cliente.id);
      if (error) throw error;
      this.clientes.update(c => c.filter(item => item.id !== cliente.id));
      this.toast.show('Cliente eliminado', 'success');
      this.cerrarModalEliminar();
      if (this.paginatedClientes().length === 0 && this.currentPage() > 1) this.prevPage();
    } catch (error) {
      this.toast.show('Error al eliminar, asegúrate que no tenga cobros asociados', 'error');
    } finally {
      this.isDeleting.set(false);
    }
  }

  obtenerEstado(cliente: any): 'NUEVO' | 'INACTIVO' | 'ACTIVO' {
    const visitas = cliente.visitas_totales || 0;
    if (visitas === 0) return 'NUEVO';
    if (cliente.ultima_visita) {
      const diffDias = (new Date().getTime() - new Date(cliente.ultima_visita).getTime()) / (1000 * 3600 * 24);
      return diffDias > 21 ? 'INACTIVO' : 'ACTIVO';
    }
    return 'ACTIVO';
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
    this.mostrarToggleIds.update(ids => [...new Set([...ids, clienteId])]);
    const mensaje = `*¡Hola!* Te saluda *Marina 305 Barber Shop*.\n\nA partir de hoy te estaremos compartiendo *promociones, novedades y beneficios exclusivos*.\n\n¿Quieres reservar tu próxima cita? Responde a este mensaje y con gusto te ayudamos.\n\nPara tu próxima cita, agéndala aquí:\n${linkReserva}`;
    window.open(`https://wa.me/${this.limpiarNumero(telefono)}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }

  abrirWhatsAppRecuperacion(clienteId: number, telefono: string, nombre: string) {
    if (!telefono) return;
    const linkReserva = 'https://sistema.marina305.net/reserva/marina305';
    const mensaje = `*¡Hola ${nombre}!* Te extrañamos por *Marina 305*.\n\nHan pasado algunas semanas desde tu último corte y queríamos invitarte a refrescar tu estilo.\n\n¿Te gustaría agendar una cita para estos días?\nPuedes ver nuestros horarios aquí:\n${linkReserva}`;
    window.open(`https://wa.me/${this.limpiarNumero(telefono)}?text=${encodeURIComponent(mensaje)}`, '_blank');
  }

  async marcarMensajeEnviado(clienteId: any, enviado: boolean, silent = false) {
    this.mostrarToggleIds.update(ids => ids.filter(id => id !== clienteId));
    this.clientes.update(c => c.map(item => item.id === clienteId ? { ...item, mensaje_bienvenida_enviado: enviado } : item));
    try {
      const { error } = await this.supabase.client.from('clientes').update({ mensaje_bienvenida_enviado: enviado }).eq('id', clienteId);
      if (error) throw error;
      if (enviado && !silent) this.toast.show('Marcado como enviado', 'success');
    } catch (error) {
      this.clientes.update(c => c.map(item => item.id === clienteId ? { ...item, mensaje_bienvenida_enviado: !enviado } : item));
      if (!silent) this.toast.show('Error al guardar el estado', 'error');
    }
  }

  private limpiarNumero(telefono: string): string {
    const num = telefono.replace(/[^0-9]/g, '');
    return num.length === 9 ? `51${num}` : num;
  }
}