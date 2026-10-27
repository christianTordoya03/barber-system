import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { StaffService } from '../../../core/services/staff';
import { GastosService } from '../../../core/services/gastos';
import { ComisionesService } from '../../../core/services/comisiones';
import { SupabaseService } from '../../../core/supabase/supabase';
// IMPORTANTE: Cambiamos a la versión que soporta estilos
import * as XLSX from 'xlsx-js-style'; 

@Component({
  selector: 'app-lista-empleado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-empleado.html',
})
export class ListaEmpleadoComponent implements OnInit {
  private turnosService = inject(TurnosService);
  private staffService = inject(StaffService);
  private gastosService = inject(GastosService);
  private comisionesService = inject(ComisionesService);
  private supabase = inject(SupabaseService);

  hoyStrHtml = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  })();

  fechaInicio = signal<string>(this.hoyStrHtml);
  fechaFin = signal<string>(this.hoyStrHtml);
  nombreEmpleadoReporte = signal<string>('');

  barberos = computed(() => this.staffService.empleados().filter(e => e.rol === 'barbero'));

  filtroAplicado = signal({
    empleado: '',
    inicio: this.hoyStrHtml,
    fin: this.hoyStrHtml
  });

  ventasTotales = signal<any[]>([]);

  async ngOnInit() {
    const bsId = await this.supabase.obtenerBarbershopId();
    if (bsId) {
      const { data } = await this.supabase.client
        .from('ventas_productos')
        .select('*, productos(nombre)')
        .eq('barbershop_id', bsId);
      this.ventasTotales.set(data || []);
    }
  }

  // --- MOTOR DE METAS DEL EQUIPO ---
  resumenMetasEquipo = computed(() => {
    const inicioStr = this.filtroAplicado().inicio.replace(/-/g, '');
    const finStr = this.filtroAplicado().fin.replace(/-/g, '');
    
    return this.barberos().map(barbero => {
      const totalGenerado = this.turnosService.turnos().filter(t => {
        if (t.estado !== 'completed' || t.barbero !== barbero.nombre || !t.fecha) return false;
        const match = t.fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        let itemStr = '';
        if (match) itemStr = `${match[3]}${match[2].padStart(2, '0')}${match[1].padStart(2, '0')}`;
        else {
          const matchISO = t.fecha.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (matchISO) itemStr = `${matchISO[1]}${matchISO[2].padStart(2, '0')}${matchISO[3].padStart(2, '0')}`;
        }
        return itemStr >= inicioStr && itemStr <= finStr;
      }).reduce((acc, t) => acc + Number(t.monto), 0);

      return {
        nombre: barbero.nombre,
        generado: totalGenerado,
        metaAlcanzada: totalGenerado >= 1200,
        porcentaje: totalGenerado >= 1200 ? 50 : 45
      };
    }).sort((a, b) => b.generado - a.generado);
  });

  // --- MOTORES INDIVIDUALES ---
  turnosEmpleado = computed(() => {
    const filtro = this.filtroAplicado();
    if (!filtro.empleado) return [];
    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');
    return this.turnosService.turnos().filter(t => {
      if (t.estado !== 'completed' || t.barbero !== filtro.empleado || !t.fecha) return false;
      let itemStr = '';
      const match = t.fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) itemStr = `${match[3]}${match[2].padStart(2, '0')}${match[1].padStart(2, '0')}`;
      else {
        const matchISO = t.fecha.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (matchISO) itemStr = `${matchISO[1]}${matchISO[2].padStart(2, '0')}${matchISO[3].padStart(2, '0')}`;
      }
      return itemStr >= inicioStr && itemStr <= finStr;
    });
  });

  comisionesEmpleado = computed(() => {
    const filtro = this.filtroAplicado();
    const empObj = this.barberos().find(e => e.nombre === filtro.empleado);
    if (!empObj) return [];
    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');
    return this.comisionesService.comisiones().filter(c => {
      if (c.estado === 'anulado' || Number(c.empleado_id) !== empObj.id || !c.fecha) return false;
      let itemStr = '';
      const match = c.fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) itemStr = `${match[3]}${match[2].padStart(2, '0')}${match[1].padStart(2, '0')}`;
      else {
        const matchISO = c.fecha.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (matchISO) itemStr = `${matchISO[1]}${matchISO[2].padStart(2, '0')}${matchISO[3].padStart(2, '0')}`;
      }
      return itemStr >= inicioStr && itemStr <= finStr;
    });
  });

  ventasEmpleado = computed(() => {
    const filtro = this.filtroAplicado();
    const empObj = this.barberos().find(e => e.nombre === filtro.empleado);
    if (!empObj) return [];
    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');

    return this.ventasTotales().filter(v => {
      if (v.empleado_id !== empObj.id || v.estado === 'anulado') return false;
      const dateObj = new Date(v.fecha_venta);
      const itemStr = `${dateObj.getFullYear()}${(dateObj.getMonth() + 1).toString().padStart(2, '0')}${dateObj.getDate().toString().padStart(2, '0')}`;
      return itemStr >= inicioStr && itemStr <= finStr;
    });
  });

  adelantosEmpleado = computed(() => {
    const filtro = this.filtroAplicado();
    const empObj = this.barberos().find(e => e.nombre === filtro.empleado);
    if (!empObj) return [];
    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');
    return this.gastosService.gastos().filter(g => {
      if (g.estado === 'anulado' || g.empleado_id !== empObj.id || !g.fecha) return false;
      let itemStr = '';
      const match = g.fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) itemStr = `${match[3]}${match[2].padStart(2, '0')}${match[1].padStart(2, '0')}`;
      else {
        const matchISO = g.fecha.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (matchISO) itemStr = `${matchISO[1]}${matchISO[2].padStart(2, '0')}${matchISO[3].padStart(2, '0')}`;
      }
      return itemStr >= inicioStr && itemStr <= finStr;
    });
  });

  // --- MATEMÁTICA FINAL (CÁLCULO AUTOMÁTICO DE META) ---
  totalGeneradoEmpleado = computed(() => this.turnosEmpleado().reduce((acc, t) => acc + Number(t.monto), 0));
  // porcentajeComisionEmpleado = computed(() => this.totalGeneradoEmpleado() >= 1200 ? 50 : 45);
  porcentajeComisionEmpleado = computed(() => {
    const emp = this.barberos().find(e => e.nombre === this.filtroAplicado().empleado);
    return emp?.comision || 50; 
  });
  comisionNetaEmpleado = computed(() => (this.totalGeneradoEmpleado() * this.porcentajeComisionEmpleado()) / 100);

  totalComisionesProductos = computed(() => this.ventasEmpleado().reduce((acc, v) => acc + Number(v.monto_comision), 0));
  totalComisionesExtraEmpleado = computed(() => this.comisionesEmpleado().reduce((acc, c) => acc + Number(c.monto), 0) + this.totalComisionesProductos());
  totalAdelantosEmpleado = computed(() => this.adelantosEmpleado().reduce((acc, g) => acc + Number(g.monto), 0));
  pagoFinalEmpleado = computed(() => (this.comisionNetaEmpleado() + this.totalComisionesExtraEmpleado()) - this.totalAdelantosEmpleado());

  buscar() {
    this.filtroAplicado.set({ empleado: this.nombreEmpleadoReporte(), inicio: this.fechaInicio(), fin: this.fechaFin() });
  }

  seleccionarDesdeMeta(nombre: string) {
    this.nombreEmpleadoReporte.set(nombre);
    this.buscar();
  }

  // ===============================================
  // EXPORTACIÓN A EXCEL HERMOSO (ESTILO CONTABLE)
  // ===============================================
  generarExcelEstilizado() {
    const filtro = this.filtroAplicado();
    const wsData: any[][] = [];

    // Formatos y Estilos de xlsx-js-style
    const formatoMoneda = '"S/" #,##0.00';
    const tituloEstilo = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 }, fill: { fgColor: { rgb: "1F2937" } }, alignment: { horizontal: "center", vertical: "center" } };
    const subtituloEstilo = { font: { italic: true, sz: 11 }, alignment: { horizontal: "center" } };
    const cabeceraAzul = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "3B82F6" } } };
    const cabeceraEsmeralda = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "10B981" } } };
    const cabeceraRoja = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "EF4444" } } };
    const negrita = { font: { bold: true } };
    const negritaVerde = { font: { bold: true, color: { rgb: "059669" } } };
    const negritaRoja = { font: { bold: true, color: { rgb: "DC2626" } } };
    const totalEstilo = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 }, fill: { fgColor: { rgb: "059669" } } };

    // Construcción de filas
    wsData.push([{ v: "LIQUIDACIÓN DE BARBERO - EL SERBIO", t: "s", s: tituloEstilo }, { v: "", t: "s", s: tituloEstilo }]);
    wsData.push([{ v: `Barbero: ${filtro.empleado}  |  Del ${filtro.inicio} al ${filtro.fin}`, t: "s", s: subtituloEstilo }, ""]);
    wsData.push([]);

    // 1. CORTES
    if (this.turnosEmpleado().length > 0) {
      wsData.push([{ v: "1. SERVICIOS REALIZADOS", s: cabeceraAzul }, { v: "MONTO", s: cabeceraAzul }]);
      this.turnosEmpleado().forEach(t => {
        wsData.push([`${t.fecha.split(',')[0]} - ${t.servicio}`, { v: Number(t.monto), t: "n", z: formatoMoneda }]);
      });
      wsData.push([{ v: "TOTAL GENERADO POR SERVICIOS:", s: negrita }, { v: this.totalGeneradoEmpleado(), t: "n", z: formatoMoneda, s: negrita }]);
      wsData.push([{ v: `COMISIÓN A PAGAR (${this.porcentajeComisionEmpleado()}%):`, s: negritaVerde }, { v: this.comisionNetaEmpleado(), t: "n", z: formatoMoneda, s: negritaVerde }]);
      wsData.push([]);
    }

    // 2. PRODUCTOS
    if (this.ventasEmpleado().length > 0) {
      wsData.push([{ v: "2. COMISIONES POR PRODUCTOS", s: cabeceraEsmeralda }, { v: "MONTO", s: cabeceraEsmeralda }]);
      this.ventasEmpleado().forEach(v => {
        wsData.push([`${v.fecha_venta.split('T')[0]} - ${v.productos?.nombre} (Cant: ${v.cantidad})`, { v: Number(v.monto_comision), t: "n", z: formatoMoneda }]);
      });
      wsData.push([{ v: "TOTAL COMISIONES POR VENTAS:", s: negrita }, { v: this.totalComisionesProductos(), t: "n", z: formatoMoneda, s: negrita }]);
      wsData.push([]);
    }

    // 3. PROPINAS
    if (this.comisionesEmpleado().length > 0) {
      wsData.push([{ v: "3. PROPINAS Y EXTRAS", s: cabeceraEsmeralda }, { v: "MONTO", s: cabeceraEsmeralda }]);
      this.comisionesEmpleado().forEach(c => {
        wsData.push([`${c.fecha} - ${c.tipo.toUpperCase()} (${c.descripcion || ''})`, { v: Number(c.monto), t: "n", z: formatoMoneda }]);
      });
      const soloPropinas = this.comisionesEmpleado().reduce((acc, c) => acc + Number(c.monto), 0);
      wsData.push([{ v: "TOTAL PROPINAS / EXTRAS:", s: negrita }, { v: soloPropinas, t: "n", z: formatoMoneda, s: negrita }]);
      wsData.push([]);
    }

    // 4. ADELANTOS
    if (this.adelantosEmpleado().length > 0) {
      wsData.push([{ v: "4. ADELANTOS Y DESCUENTOS", s: cabeceraRoja }, { v: "MONTO DESC.", s: cabeceraRoja }]);
      this.adelantosEmpleado().forEach(g => {
        wsData.push([`${g.fecha.split(',')[0]} - ${g.descripcion}`, { v: Number(g.monto), t: "n", z: formatoMoneda }]);
      });
      wsData.push([{ v: "TOTAL ADELANTOS RESTADOS:", s: negritaRoja }, { v: this.totalAdelantosEmpleado(), t: "n", z: formatoMoneda, s: negritaRoja }]);
      wsData.push([]);
    }

    // 5. TOTAL NETO
    wsData.push([{ v: "TOTAL NETO A PAGAR:", s: totalEstilo }, { v: this.pagoFinalEmpleado(), t: "n", z: formatoMoneda, s: totalEstilo }]);

    // Generar Hoja
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajustes visuales de Excel
    ws["!cols"] = [{ wch: 55 }, { wch: 22 }]; // Ancho de columnas
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Combina A1:B1
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }  // Combina A2:B2
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Liquidación");
    XLSX.writeFile(wb, `Liquidacion_${filtro.empleado.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
  }
}