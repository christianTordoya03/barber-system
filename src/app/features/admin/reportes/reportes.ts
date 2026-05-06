import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { GastosService } from '../../../core/services/gastos';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reportes.html',
})
export class ReportesComponent {
  private turnosService = inject(TurnosService);
  private gastosService = inject(GastosService);

  // --- ESTADOS DEL FILTRO ---
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

  // NUEVA VARIABLE: Para saber si ya le dio al botón Buscar
  hasSearched = signal<boolean>(false);

  // --- FUNCIÓN ÚTIL PARA LEER FECHAS ROBUSTAS ---
  private parseDateStr(fechaStr: string) {
    // Esto detecta 5/5/2026 o 05/05/2026 sin problemas
    const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      return {
        day: match[1].padStart(2, '0'),
        month: match[2].padStart(2, '0'),
        year: match[3]
      };
    }
    return null;
  }

  // --- MOTOR DE FILTRADO ---
  turnosFiltrados = computed(() => {
    if (!this.hasSearched()) return []; // Si no ha buscado, tabla en blanco

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
    if (!this.hasSearched()) return []; // Si no ha buscado, tabla en blanco
    
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

  // --- CÁLCULOS REACTIVOS (INGRESOS MEJORADOS) ---
  totalYape = computed(() => this.sumarMetodo('Yape'));
  totalYapeJk = computed(() => this.sumarMetodo('Yape JK'));
  totalTarjeta = computed(() => this.sumarMetodo('Tarjeta'));
  totalTransferencia = computed(() => this.sumarMetodo('Transferencia'));
  totalEfectivo = computed(() => this.sumarMetodo('Efectivo'));

  totalIngresos = computed(() => this.turnosFiltrados().reduce((acc, t) => acc + Number(t.monto), 0));

  // --- CÁLCULOS REACTIVOS (GASTOS PRECISOS) ---
  totalGastosEfectivo = computed(() => 
    this.gastosFiltrados()
      .filter(g => g.metodoPago && g.metodoPago.toLowerCase() === 'efectivo')
      .reduce((acc, g) => acc + Number(g.monto), 0)
  );
  
  totalGastosDigitales = computed(() => 
    this.gastosFiltrados()
      .filter(g => !g.metodoPago || g.metodoPago.toLowerCase() !== 'efectivo')
      .reduce((acc, g) => acc + Number(g.monto), 0)
  );

  totalGastos = computed(() => this.totalGastosEfectivo() + this.totalGastosDigitales());

  // Físico vs Global
  totalCajaEfectivo = computed(() => this.totalEfectivo() - this.totalGastosEfectivo());
  totalNeto = computed(() => this.totalIngresos() - this.totalGastos());

  // Suma de métodos blindada a mayúsculas/minúsculas
  private sumarMetodo(metodo: string) {
    return this.turnosFiltrados()
      .filter(t => t.metodoPago && t.metodoPago.trim().toLowerCase() === metodo.toLowerCase())
      .reduce((acc, t) => acc + Number(t.monto), 0);
  }

  buscar() {
    this.filtroAplicado.set({
      tipo: this.tipoFiltro(),
      mes: this.mesSeleccionado(),
      anio: this.anioSeleccionado(),
      inicio: this.fechaInicio(),
      fin: this.fechaFin()
    });
    this.hasSearched.set(true); // <--- Habilita los resultados y el botón de PDF
  }

  cambiarPestana(tipo: 'mes' | 'rango') {
    this.tipoFiltro.set(tipo);
    this.hasSearched.set(false); // <--- Esta línea oculta la tabla al cambiar de pestaña
  }

  // --- GENERACIÓN DEL PDF ---
  generarPDF() {
    const doc = new jsPDF();
    doc.setProperties({
      title: 'Reporte General de Ingresos y Gastos',
      subject: 'Marina 305 Barber Shop',
      author: 'Marina 305'
    });
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
    doc.setTextColor(89, 93, 100);
    doc.text("REPORTE DE INGRESOS Y GASTOS", 105, 20, { align: "center" });

    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    doc.line(14, 26, 196, 26);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
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
        ['Total de Ingresos', `S/ ${this.totalIngresos().toFixed(2)}`],
        ['Total Gastos (Efectivo)', `S/ ${this.totalGastosEfectivo().toFixed(2)}`],
        ['Total Gastos (Bancos/Digital)', `S/ ${this.totalGastosDigitales().toFixed(2)}`],
        ['Total (Efectivo) físico en caja', `S/ ${this.totalCajaEfectivo().toFixed(2)}`],
        ['Total Neto Real', `S/ ${this.totalNeto().toFixed(2)}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [89, 93, 100], textColor: 255, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { halign: 'left' }, 1: { halign: 'center' } },
      
      willDrawCell: (data) => {
        if (data.section === 'body') {
          // Ingresos y Neto en negrita
          if (data.row.index === 5 || data.row.index === 9) {
            doc.setFillColor(89, 93, 100);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
          }
          // Gastos y Caja en negrita normal
          if (data.row.index >= 6 && data.row.index <= 8) {
            doc.setFont("helvetica", "bold");
          }
        }
      }
    });

    // Genera el archivo en la memoria del navegador y abre en nueva pestaña
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }
}