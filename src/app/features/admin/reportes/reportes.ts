import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { GastosService } from '../../../core/services/gastos';
import { ComisionesService } from '../../../core/services/comisiones';
import { SupabaseService } from '../../../core/supabase/supabase';
import * as XLSX from 'xlsx-js-style'; // <- Usamos la librería con estilos

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
})
export class ReportesComponent implements OnInit {
  private turnosService = inject(TurnosService);
  private gastosService = inject(GastosService);
  private comisionesService = inject(ComisionesService);
  private supabase = inject(SupabaseService);

  tipoFiltro = signal<'mes' | 'rango'>('mes');
  
  // Variables para rango de meses
  mesInicioSeleccionado = signal<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  anioInicioSeleccionado = signal<string>(new Date().getFullYear().toString());
  mesFinSeleccionado = signal<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  anioFinSeleccionado = signal<string>(new Date().getFullYear().toString());

  // Variables de paginación
  paginaActual = signal<number>(1);
  itemsPorPagina = signal<number>(15);

  meses = [
    { valor: '01', nombre: 'Enero' }, { valor: '02', nombre: 'Febrero' },
    { valor: '03', nombre: 'Marzo' }, { valor: '04', nombre: 'Abril' },
    { valor: '05', nombre: 'Mayo' }, { valor: '06', nombre: 'Junio' },
    { valor: '07', nombre: 'Julio' }, { valor: '08', nombre: 'Agosto' },
    { valor: '09', nombre: 'Septiembre' }, { valor: '10', nombre: 'Octubre' },
    { valor: '11', nombre: 'Noviembre' }, { valor: '12', nombre: 'Diciembre' }
  ];
  anios = ['2024', '2025', '2026'];

  hoyStrHtml = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  })();

  fechaInicio = signal<string>(this.hoyStrHtml);
  fechaFin = signal<string>(this.hoyStrHtml);
  
  filtroAplicado = signal({
    tipo: 'mes',
    mesInicio: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    anioInicio: new Date().getFullYear().toString(),
    mesFin: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    anioFin: new Date().getFullYear().toString(),
    inicio: this.hoyStrHtml,
    fin: this.hoyStrHtml
  });

  hasSearched = signal<boolean>(false);
  ventasProductos = signal<any[]>([]);

  async ngOnInit() {
    const bsId = await this.supabase.obtenerBarbershopId();
    if (bsId) {
      const { data } = await this.supabase.client.from('ventas_productos').select('*, productos(nombre)').eq('barbershop_id', bsId);
      this.ventasProductos.set(data || []);
    }
  }

  private parseDateStr(fechaStr: string) {
    const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return { day: match[1].padStart(2, '0'), month: match[2].padStart(2, '0'), year: match[3] };
    return null;
  }

  // --- MOTORES DE FILTRADO ---
  turnosFiltrados = computed(() => {
    if (!this.hasSearched()) return []; 
    const todosLosTurnos = this.turnosService.turnos().filter(t => t.estado === 'completed');
    const filtro = this.filtroAplicado();

    return todosLosTurnos.filter(t => {
      const d = this.parseDateStr(t.fecha);
      if (!d) return false;

      if (filtro.tipo === 'mes') {
        const valMes = parseInt(`${d.year}${d.month}`);
        const mesIniNum = parseInt(`${filtro.anioInicio}${filtro.mesInicio}`);
        const mesFinNum = parseInt(`${filtro.anioFin}${filtro.mesFin}`);
        return valMes >= mesIniNum && valMes <= mesFinNum;
      } else {
        const itemStr = `${d.year}${d.month}${d.day}`;
        const inicioStr = filtro.inicio.replace(/-/g, '');
        const finStr = filtro.fin.replace(/-/g, '');
        return itemStr >= inicioStr && itemStr <= finStr;
      }
    }).sort((a, b) => {
      const dA = this.parseDateStr(a.fecha);
      const dB = this.parseDateStr(b.fecha);
      return parseInt(`${dB?.year}${dB?.month}${dB?.day}`) - parseInt(`${dA?.year}${dA?.month}${dA?.day}`);
    });
  });

  gastosFiltrados = computed(() => {
    if (!this.hasSearched()) return []; 
    const filtro = this.filtroAplicado();
    return this.gastosService.gastos().filter(g => {
      if (g.estado === 'anulado') return false;
      const d = this.parseDateStr(g.fecha);
      if (!d) return false;
      if (filtro.tipo === 'mes') {
        const valMes = parseInt(`${d.year}${d.month}`);
        return valMes >= parseInt(`${filtro.anioInicio}${filtro.mesInicio}`) && valMes <= parseInt(`${filtro.anioFin}${filtro.mesFin}`);
      } else {
        const itemStr = `${d.year}${d.month}${d.day}`;
        return itemStr >= filtro.inicio.replace(/-/g, '') && itemStr <= filtro.fin.replace(/-/g, '');
      }
    });
  });

  comisionesFiltradas = computed(() => {
    if (!this.hasSearched()) return [];
    const filtro = this.filtroAplicado();
    return this.comisionesService.comisiones().filter(c => {
      const d = this.parseDateStr(c.fecha);
      if (!d) return false;
      if (filtro.tipo === 'mes') {
        const valMes = parseInt(`${d.year}${d.month}`);
        return valMes >= parseInt(`${filtro.anioInicio}${filtro.mesInicio}`) && valMes <= parseInt(`${filtro.anioFin}${filtro.mesFin}`);
      } else {
        const itemStr = `${d.year}${d.month}${d.day}`;
        return itemStr >= filtro.inicio.replace(/-/g, '') && itemStr <= filtro.fin.replace(/-/g, '');
      }
    });
  });

  ventasFiltradas = computed(() => {
    if (!this.hasSearched()) return [];
    const filtro = this.filtroAplicado();
    return this.ventasProductos().filter(v => {
      if (v.estado === 'anulado') return false;
      const dateObj = new Date(v.fecha_venta);
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear().toString();

      if (filtro.tipo === 'mes') {
        const valMes = parseInt(`${year}${month}`);
        return valMes >= parseInt(`${filtro.anioInicio}${filtro.mesInicio}`) && valMes <= parseInt(`${filtro.anioFin}${filtro.mesFin}`);
      } else {
        const itemStr = `${year}${month}${day}`;
        return itemStr >= filtro.inicio.replace(/-/g, '') && itemStr <= filtro.fin.replace(/-/g, '');
      }
    });
  });

  // --- LÓGICA DE PAGINACIÓN DE DETALLES ---
  totalPaginas = computed(() => Math.ceil(this.turnosFiltrados().length / this.itemsPorPagina()) || 1);
  
  turnosPaginados = computed(() => {
    const inicio = (this.paginaActual() - 1) * this.itemsPorPagina();
    return this.turnosFiltrados().slice(inicio, inicio + this.itemsPorPagina());
  });

  cambiarPagina(delta: number) {
    const nuevaPagina = this.paginaActual() + delta;
    if (nuevaPagina >= 1 && nuevaPagina <= this.totalPaginas()) {
      this.paginaActual.set(nuevaPagina);
    }
  }

  // --- SUMATORIAS GLOBALES ---
  totalYape = computed(() => this.sumarMetodo('Yape'));
  totalTransferencia = computed(() => this.sumarMetodo('Transferencia'));
  totalEfectivo = computed(() => this.sumarMetodo('Efectivo'));

  totalIngresos = computed(() => this.turnosFiltrados().reduce((acc, t) => acc + Number(t.monto), 0));
  totalIngresosProductos = computed(() => this.ventasFiltradas().reduce((acc, v) => acc + (Number(v.precio_venta_historico) * Number(v.cantidad)), 0));
  totalCostoProductos = computed(() => this.ventasFiltradas().reduce((acc, v) => acc + (Number(v.costo_historico) * Number(v.cantidad)), 0));
  
  totalGastosEfectivo = computed(() => this.gastosFiltrados().filter(g => g.metodoPago && g.metodoPago.toLowerCase() === 'efectivo').reduce((acc, g) => acc + Number(g.monto), 0));
  totalGastosDigitales = computed(() => this.gastosFiltrados().filter(g => !g.metodoPago || g.metodoPago.toLowerCase() !== 'efectivo').reduce((acc, g) => acc + Number(g.monto), 0));
  
  totalGastos = computed(() => this.totalGastosEfectivo() + this.totalGastosDigitales());
  totalCajaEfectivo = computed(() => this.totalEfectivo() - this.totalGastosEfectivo());
  totalNeto = computed(() => this.totalIngresos() + this.totalIngresosProductos() - this.totalGastos() - this.totalCostoProductos());

  private sumarMetodo(metodoBuscado: string) {
    const metodoMin = metodoBuscado.toLowerCase();
    const sumaTurnos = this.turnosFiltrados().reduce((acc, t) => {
      if (!t.metodoPago) return acc;
      const pagoStr = t.metodoPago.trim().toLowerCase();
      if (pagoStr === metodoMin) return acc + Number(t.monto || 0);
      if (pagoStr.includes('+')) {
        for (const parte of pagoStr.split('+')) {
          if (parte.includes(metodoMin)) {
            const match = parte.match(/s\/\s*([\d.]+)/);
            if (match && match[1]) return acc + Number(match[1]);
          }
        }
      }
      return acc;
    }, 0);

    const sumaProductos = this.ventasFiltradas().reduce((acc, v) => {
      if (!v.metodo_pago) return acc;
      if (v.metodo_pago.toLowerCase() === metodoMin) return acc + (Number(v.precio_venta_historico) * Number(v.cantidad));
      return acc;
    }, 0);
    return sumaTurnos + sumaProductos;
  }

  // Se dispara automáticamente al cambiar cualquier filtro
  buscar() {
    this.filtroAplicado.set({ 
      tipo: this.tipoFiltro(), 
      mesInicio: this.mesInicioSeleccionado(), anioInicio: this.anioInicioSeleccionado(), 
      mesFin: this.mesFinSeleccionado(), anioFin: this.anioFinSeleccionado(), 
      inicio: this.fechaInicio(), fin: this.fechaFin() 
    });
    this.hasSearched.set(true); 
    this.paginaActual.set(1); 
  }

  cambiarPestana(tipo: 'mes' | 'rango') {
    this.tipoFiltro.set(tipo);
    this.hasSearched.set(false); 
  }

  // ===============================================
  // EXCEL PROFESIONAL CONTABLE
  // ===============================================
  generarExcelEstilizado() {
    const wb = XLSX.utils.book_new();
    const filtro = this.filtroAplicado();

    let subtitulo = '';
    if (filtro.tipo === 'mes') {
      subtitulo = `Desde ${filtro.mesInicio}/${filtro.anioInicio} hasta ${filtro.mesFin}/${filtro.anioFin}`;
    } else {
      subtitulo = `Del ${filtro.inicio} al ${filtro.fin}`;
    }

    const formatoMoneda = '"S/" #,##0.00';
    const tituloEstilo = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 }, fill: { fgColor: { rgb: "1F2937" } }, alignment: { horizontal: "center", vertical: "center" } };
    const subtituloEstilo = { font: { italic: true, sz: 11 }, alignment: { horizontal: "center" } };
    const cabeceraAzul = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "3B82F6" } } };
    const cabeceraGris = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "4B5563" } } };
    const negrita = { font: { bold: true } };
    const negritaRoja = { font: { bold: true, color: { rgb: "DC2626" } } };
    const totalEstilo = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 }, fill: { fgColor: { rgb: "059669" } } };

    // --- HOJA 1: RESUMEN CONTABLE ---
    const resumenData: any[][] = [];
    resumenData.push([{ v: "REPORTE FINANCIERO - EL SERBIO BARBER SHOP", t: "s", s: tituloEstilo }, { v: "", t: "s", s: tituloEstilo }]);
    resumenData.push([{ v: subtitulo, t: "s", s: subtituloEstilo }, ""]);
    resumenData.push([]);
    
    resumenData.push([{ v: "1. INGRESOS Y FLUJO", s: cabeceraAzul }, { v: "MONTO", s: cabeceraAzul }]);
    resumenData.push(["Total cobrado en Yape", { v: this.totalYape(), t: "n", z: formatoMoneda }]);
    resumenData.push(["Total cobrado en Efectivo", { v: this.totalEfectivo(), t: "n", z: formatoMoneda }]);
    resumenData.push(["Total cobrado en Transferencia", { v: this.totalTransferencia(), t: "n", z: formatoMoneda }]);
    resumenData.push([]);

    resumenData.push([{ v: "2. RENDIMIENTO DEL NEGOCIO", s: cabeceraAzul }, { v: "MONTO", s: cabeceraAzul }]);
    resumenData.push(["Total Ingresos (Servicios de Barbería)", { v: this.totalIngresos(), t: "n", z: formatoMoneda }]);
    resumenData.push(["Total Ingresos (Venta de Productos)", { v: this.totalIngresosProductos(), t: "n", z: formatoMoneda }]);
    resumenData.push([{ v: "(-) Costo de Inventario Vendido", s: negritaRoja }, { v: -this.totalCostoProductos(), t: "n", z: formatoMoneda, s: negritaRoja }]);
    resumenData.push([]);

    resumenData.push([{ v: "3. EGRESOS Y GASTOS", s: cabeceraAzul }, { v: "MONTO", s: cabeceraAzul }]);
    resumenData.push(["Total Gastos pagados en Efectivo", { v: -this.totalGastosEfectivo(), t: "n", z: formatoMoneda }]);
    resumenData.push(["Total Gastos pagados vía Banco/Digital", { v: -this.totalGastosDigitales(), t: "n", z: formatoMoneda }]);
    resumenData.push([]);

    resumenData.push([{ v: "4. BALANCES GLOBALES", s: cabeceraAzul }, { v: "MONTO", s: cabeceraAzul }]);
    resumenData.push([{ v: "TOTAL EFECTIVO FÍSICO EN CAJA", s: negrita }, { v: this.totalCajaEfectivo(), t: "n", z: formatoMoneda, s: negrita }]);
    resumenData.push([{ v: "TOTAL NETO REAL DEL NEGOCIO", s: totalEstilo }, { v: this.totalNeto(), t: "n", z: formatoMoneda, s: totalEstilo }]);

    const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
    wsResumen["!cols"] = [{ wch: 45 }, { wch: 20 }];
    wsResumen["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }];
    XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Contable");

    // --- HOJA 2: DETALLE DE TODOS LOS SERVICIOS ---
    const detalleData: any[][] = [];
    detalleData.push([{ v: "DETALLE OPERATIVO DE SERVICIOS", t: "s", s: tituloEstilo }, "", "", "", "", ""]);
    detalleData.push([{ v: subtitulo, t: "s", s: subtituloEstilo }, "", "", "", "", ""]);
    detalleData.push([]);
    detalleData.push([
      { v: "FECHA", s: cabeceraGris }, { v: "HORA", s: cabeceraGris }, { v: "CLIENTE", s: cabeceraGris }, 
      { v: "SERVICIO", s: cabeceraGris }, { v: "BARBERO", s: cabeceraGris }, { v: "MONTO", s: cabeceraGris }
    ]);

    this.turnosFiltrados().forEach(t => {
      const fechaC = t.fecha.split(',')[0];
      const horaC = t.fecha.includes(',') ? t.fecha.split(',')[1].trim() : '--:--';
      detalleData.push([fechaC, horaC, t.cliente, t.servicio, t.barbero, { v: Number(t.monto), t: "n", z: formatoMoneda }]);
    });

    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
    wsDetalle["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 15 }];
    wsDetalle["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }];
    XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle Servicios");

    // Descargar Archivo
    XLSX.writeFile(wb, `Reporte_Contable_${Date.now()}.xlsx`);
  }
}