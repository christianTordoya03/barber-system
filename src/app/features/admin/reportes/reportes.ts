import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { GastosService } from '../../../core/services/gastos';
import { ComisionesService } from '../../../core/services/comisiones';
import { SupabaseService } from '../../../core/supabase/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  mesSeleccionado = signal<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));
  anioSeleccionado = signal<string>(new Date().getFullYear().toString());

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
    mes: (new Date().getMonth() + 1).toString().padStart(2, '0'),
    anio: new Date().getFullYear().toString(),
    inicio: this.hoyStrHtml,
    fin: this.hoyStrHtml
  });

  hasSearched = signal<boolean>(false);
  ventasProductos = signal<any[]>([]);

  async ngOnInit() {
    const bsId = await this.supabase.obtenerBarbershopId();
    if (bsId) {
      const { data } = await this.supabase.client
        .from('ventas_productos')
        .select('*')
        .eq('barbershop_id', bsId);
      this.ventasProductos.set(data || []);
    }
  }

  private parseDateStr(fechaStr: string) {
    const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      return { day: match[1].padStart(2, '0'), month: match[2].padStart(2, '0'), year: match[3] };
    }
    return null;
  }

  // --- MOTORES DE FILTRADO ---
  turnosFiltrados = computed(() => {
    if (!this.hasSearched()) return []; 
    const todosLosTurnos = this.turnosService.turnos().filter(t => t.estado === 'completed');
    const filtro = this.filtroAplicado();

    if (filtro.tipo === 'mes') {
      return todosLosTurnos.filter(t => {
        const d = this.parseDateStr(t.fecha);
        return d && d.month === filtro.mes && d.year === filtro.anio;
      });
    } else {
      const inicioStr = filtro.inicio.replace(/-/g, '');
      const finStr = filtro.fin.replace(/-/g, '');
      return todosLosTurnos.filter(t => {
        const d = this.parseDateStr(t.fecha);
        if (d) {
          const itemStr = `${d.year}${d.month}${d.day}`;
          return itemStr >= inicioStr && itemStr <= finStr;
        }
        return false;
      });
    }
  });

  gastosFiltrados = computed(() => {
    if (!this.hasSearched()) return []; 
    const filtro = this.filtroAplicado();
    const todosLosGastos = this.gastosService.gastos().filter(g => g.estado !== 'anulado');

    if (filtro.tipo === 'mes') {
      return todosLosGastos.filter(g => {
        const d = this.parseDateStr(g.fecha);
        return d && d.month === filtro.mes && d.year === filtro.anio;
      });
    } else {
      const inicioStr = filtro.inicio.replace(/-/g, '');
      const finStr = filtro.fin.replace(/-/g, '');
      return todosLosGastos.filter(g => {
        const d = this.parseDateStr(g.fecha);
        if (d) {
          const itemStr = `${d.year}${d.month}${d.day}`;
          return itemStr >= inicioStr && itemStr <= finStr;
        }
        return false;
      });
    }
  });

  comisionesFiltradas = computed(() => {
    if (!this.hasSearched()) return [];
    const filtro = this.filtroAplicado();
    const todasLasComisiones = this.comisionesService.comisiones();

    if (filtro.tipo === 'mes') {
      return todasLasComisiones.filter(c => {
        const d = this.parseDateStr(c.fecha);
        return d && d.month === filtro.mes && d.year === filtro.anio;
      });
    } else {
      const inicioStr = filtro.inicio.replace(/-/g, '');
      const finStr = filtro.fin.replace(/-/g, '');
      return todasLasComisiones.filter(c => {
        const d = this.parseDateStr(c.fecha);
        if (d) {
          const itemStr = `${d.year}${d.month}${d.day}`;
          return itemStr >= inicioStr && itemStr <= finStr;
        }
        return false;
      });
    }
  });

  ventasFiltradas = computed(() => {
    if (!this.hasSearched()) return [];
    const filtro = this.filtroAplicado();
    const todasLasVentas = this.ventasProductos();

    return todasLasVentas.filter(v => {
      const dateObj = new Date(v.fecha_venta);
      const day = dateObj.getDate().toString().padStart(2, '0');
      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
      const year = dateObj.getFullYear().toString();

      if (filtro.tipo === 'mes') {
        return month === filtro.mes && year === filtro.anio;
      } else {
        const inicioStr = filtro.inicio.replace(/-/g, '');
        const finStr = filtro.fin.replace(/-/g, '');
        const itemStr = `${year}${month}${day}`;
        return itemStr >= inicioStr && itemStr <= finStr;
      }
    });
  });

  // --- SUMATORIAS GLOBALES ---
  totalYape = computed(() => this.sumarMetodo('Yape'));
  totalYapeJk = computed(() => this.sumarMetodo('Yape JK'));
  totalTarjeta = computed(() => this.sumarMetodo('Tarjeta'));
  totalTransferencia = computed(() => this.sumarMetodo('Transferencia'));
  totalEfectivo = computed(() => this.sumarMetodo('Efectivo'));

  totalIngresos = computed(() => this.turnosFiltrados().reduce((acc, t) => acc + Number(t.monto), 0));

  totalIngresosProductos = computed(() => 
    this.ventasFiltradas().reduce((acc, v) => acc + (Number(v.precio_venta_historico) * Number(v.cantidad)), 0)
  );

  totalCostoProductos = computed(() => 
    this.ventasFiltradas().reduce((acc, v) => acc + (Number(v.costo_historico) * Number(v.cantidad)), 0)
  );

  totalComisionesNuevosProductos = computed(() => 
    this.ventasFiltradas().reduce((acc, v) => acc + Number(v.monto_comision), 0)
  );

  totalSoloComisiones = computed(() => this.comisionesFiltradas().filter(c => c.tipo === 'producto').reduce((acc, c) => acc + Number(c.monto), 0));
  totalSoloServiciosExtra = computed(() => this.comisionesFiltradas().filter(c => c.tipo === 'servicio_extra').reduce((acc, c) => acc + Number(c.monto), 0));
  totalSoloPropinas = computed(() => this.comisionesFiltradas().filter(c => c.tipo === 'propina').reduce((acc, c) => acc + Number(c.monto), 0));
  
  totalComisiones = computed(() => 
    this.comisionesFiltradas().reduce((acc, c) => acc + Number(c.monto), 0) + this.totalComisionesNuevosProductos()
  );

  totalGastosEfectivo = computed(() => this.gastosFiltrados().filter(g => g.metodoPago && g.metodoPago.toLowerCase() === 'efectivo').reduce((acc, g) => acc + Number(g.monto), 0));
  totalGastosDigitales = computed(() => this.gastosFiltrados().filter(g => !g.metodoPago || g.metodoPago.toLowerCase() !== 'efectivo').reduce((acc, g) => acc + Number(g.monto), 0));
  
  totalGastos = computed(() => this.totalGastosEfectivo() + this.totalGastosDigitales());
  totalCajaEfectivo = computed(() => this.totalEfectivo() - this.totalGastosEfectivo());
  
  totalNeto = computed(() => 
    this.totalIngresos() + this.totalIngresosProductos() - this.totalGastos() - this.totalCostoProductos()
  );

  // NUEVO: Ahora suma cortes (turnos) y productos (ventas)
  private sumarMetodo(metodoBuscado: string) {
    const metodoMin = metodoBuscado.toLowerCase();
    
    // 1. Sumar cortes (turnos)
    const sumaTurnos = this.turnosFiltrados().reduce((acc, t) => {
      if (!t.metodoPago) return acc;
      const pagoStr = t.metodoPago.trim().toLowerCase();
      
      if (pagoStr === metodoMin) return acc + Number(t.monto || 0);
      
      if (pagoStr.includes('+')) {
        const partes = pagoStr.split('+');
        for (const parte of partes) {
          if (parte.includes(metodoMin)) {
            const match = parte.match(/s\/\s*([\d.]+)/);
            if (match && match[1]) return acc + Number(match[1]);
          }
        }
      }
      return acc;
    }, 0);

    // 2. Sumar productos (ventas)
    const sumaProductos = this.ventasFiltradas().reduce((acc, v) => {
      if (!v.metodo_pago) return acc;
      if (v.metodo_pago.toLowerCase() === metodoMin) {
        return acc + (Number(v.precio_venta_historico) * Number(v.cantidad));
      }
      return acc;
    }, 0);

    return sumaTurnos + sumaProductos;
  }

  buscar() {
    this.filtroAplicado.set({ tipo: this.tipoFiltro(), mes: this.mesSeleccionado(), anio: this.anioSeleccionado(), inicio: this.fechaInicio(), fin: this.fechaFin() });
    this.hasSearched.set(true); 
  }

  cambiarPestana(tipo: 'mes' | 'rango') {
    this.tipoFiltro.set(tipo);
    this.hasSearched.set(false); 
  }

  generarPDF() {
    const doc = new jsPDF();
    doc.setProperties({ title: 'Reporte General', subject: 'Marina 305' });
    let subtitulo = '';
    const filtro = this.filtroAplicado();

    if (filtro.tipo === 'mes') {
      const nombreMes = this.meses.find(m => m.valor === filtro.mes)?.nombre;
      subtitulo = `Reporte Mensual: ${nombreMes} ${filtro.anio}`;
    } else {
      const [y1, m1, d1] = filtro.inicio.split('-');
      const [y2, m2, d2] = filtro.fin.split('-');
      subtitulo = `Del ${d1}/${m1}/${y1} al ${d2}/${m2}/${y2}`;
    }

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE DE INGRESOS Y GASTOS", 105, 20, { align: "center" });
    doc.setLineWidth(0.5);
    doc.line(14, 26, 196, 26);
    doc.setFontSize(12);
    doc.text(subtitulo, 14, 38);

    autoTable(doc, {
      startY: 45,
      head: [['Descripción', 'Monto']],
      body: [
        ['Total Tarjeta', `S/ ${this.totalTarjeta().toFixed(2)}`],
        ['Total Yape', `S/ ${this.totalYape().toFixed(2)}`],
        ['Total Yape JK', `S/ ${this.totalYapeJk().toFixed(2)}`],
        ['Total Efectivo', `S/ ${this.totalEfectivo().toFixed(2)}`],
        ['Total Transferencia', `S/ ${this.totalTransferencia().toFixed(2)}`],
        
        ['Total Ingresos (Servicios)', `S/ ${this.totalIngresos().toFixed(2)}`],
        ['Total Ingresos (Productos)', `S/ ${this.totalIngresosProductos().toFixed(2)}`],
        ['(-) Costo de Productos Vendidos', `S/ ${this.totalCostoProductos().toFixed(2)}`],
        
        ['(+) Total Solo Propinas', `S/ ${this.totalSoloPropinas().toFixed(2)}`],
        ['(+) Comisiones Inventario Antiguo', `S/ ${this.totalSoloComisiones().toFixed(2)}`],
        ['(+) Comisiones Inventario Nuevo', `S/ ${this.totalComisionesNuevosProductos().toFixed(2)}`],
        ['(+) Total Servicios Extras', `S/ ${this.totalSoloServiciosExtra().toFixed(2)}`],
        ['TOTAL EXTRAS / COMISIONES', `S/ ${this.totalComisiones().toFixed(2)}`],
        
        ['Total Gastos (Efectivo)', `S/ ${this.totalGastosEfectivo().toFixed(2)}`],
        ['Total Gastos (Bancos/Digital)', `S/ ${this.totalGastosDigitales().toFixed(2)}`],
        ['Total (Efectivo) físico en caja', `S/ ${this.totalCajaEfectivo().toFixed(2)}`],
        ['Total Neto Real', `S/ ${this.totalNeto().toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [89, 93, 100], textColor: 255 },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
      willDrawCell: (data) => {
        if (data.section === 'body') {
          if ([5, 6, 7, 12, 16].includes(data.row.index)) {
            doc.setFont("helvetica", "bold");
            if (data.row.index === 16) {
              doc.setFillColor(89, 93, 100);
              doc.setTextColor(255, 255, 255);
            }
          }
        }
      }
    });

    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  }
}