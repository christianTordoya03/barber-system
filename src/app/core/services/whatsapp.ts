import { Injectable, signal, inject } from '@angular/core';
import { SupabaseService } from '../supabase/supabase';

export interface PlantillaWhatsApp {
  id?: number;
  tipo: string;
  mensaje: string;
  activo?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private supabase = inject(SupabaseService);
  
  // Señal para tener las plantillas disponibles en memoria
  plantillas = signal<PlantillaWhatsApp[]>([]);

  constructor() {
    this.cargarPlantillas();
  }

  async cargarPlantillas() {
    const bsId = await this.supabase.obtenerBarbershopId();
    if (!bsId) return;

    const { data, error } = await this.supabase.client
      .from('whatsapp_plantillas')
      .select('*')
      .eq('barbershop_id', bsId)
      .eq('activo', true);

    if (!error && data) {
      this.plantillas.set(data as PlantillaWhatsApp[]);
    }
  }

  // Busca la plantilla por tipo (ej: 'confirmacion', 'recordatorio', 'bienvenida')
  obtenerPlantilla(tipo: string): string {
    const plantilla = this.plantillas().find(p => p.tipo === tipo);
    return plantilla?.mensaje || '';
  }

  // Motor para reemplazar las variables {texto} por los datos reales del cliente/turno
  generarMensaje(plantilla: string, datos: any): string {
    if (!plantilla) return '';
    
    let mensajeArmado = plantilla;
    
    // Diccionario de reemplazos
    const reemplazos: { [key: string]: string } = {
      '{nombre}': datos.clienteNombre || 'amigo',
      '{fecha}': datos.fecha || '',
      '{hora}': datos.hora || '',
      '{barbero}': datos.barbero || 'nuestro especialista',
      '{servicio}': datos.servicio || 'tu cita',
      '{puntos}': datos.puntos || '0',
      '{dias}': datos.dias_inactivo || 'varios'
    };

    // Reemplaza cada llave que encuentre en el texto
    for (const [llave, valor] of Object.entries(reemplazos)) {
      // Usamos expresión regular global para reemplazar todas las apariciones
      const regex = new RegExp(llave, 'g');
      mensajeArmado = mensajeArmado.replace(regex, valor);
    }

    return mensajeArmado;
  }

  // Genera el enlace y abre WhatsApp
  enviarMensaje(telefono: string, mensaje: string) {
    if (!telefono) return;
    
    // Aseguramos que el teléfono tenga el código de país (Ej: +51 para Perú)
    // Si ya lo tiene, lo respetamos, si no, se lo agregamos (puedes ajustar el 51 según tu país)
    const numeroLimpio = telefono.replace(/[^0-9]/g, '');
    const telefonoFinal = numeroLimpio.startsWith('51') ? numeroLimpio : `51${numeroLimpio}`;
    
    const textoCodificado = encodeURIComponent(mensaje);
    const url = `https://wa.me/${telefonoFinal}?text=${textoCodificado}`;
    
    // Abre en una nueva pestaña (WhatsApp Web o la App nativa)
    window.open(url, '_blank');
  }
}