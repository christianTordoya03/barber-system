import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { StaffService } from '../../../core/services/staff';
import { GastosService } from '../../../core/services/gastos';
import { SupabaseService } from '../../../core/supabase/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-barbero-historial',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './historial.html'
})
export class BarberoHistorialComponent implements OnInit {
  private turnosService = inject(TurnosService);
  private staffService = inject(StaffService);
  private gastosService = inject(GastosService);
  private supabase = inject(SupabaseService);

  nombreCompleto = signal<string>('');
  empleadoId = signal<number | null>(null);
  comisionPorcentaje = signal<number>(50);

  // --- FILTROS DE RANGO ---
  hoyStrHtml = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  })();

  fechaInicio = signal<string>(this.hoyStrHtml);
  fechaFin = signal<string>(this.hoyStrHtml);
  
  filtroAplicado = signal({
    inicio: this.hoyStrHtml,
    fin: this.hoyStrHtml
  });

  hasSearched = signal<boolean>(false);

  async ngOnInit() {
    // CAMBIO AQUÍ
    const { data: { session } } = await this.supabase.client.auth.getSession();
    const emp = this.staffService.empleados().find(e => e.email === session?.user?.email);
    
    if (emp) {
      this.nombreCompleto.set(emp.nombre);
      this.empleadoId.set(emp.id!);
      this.comisionPorcentaje.set(emp.comision || 50);
    }
  }

  // Utilidad para leer fechas
  private parseDateStr(fechaStr: string) {
    const match = fechaStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) return { day: match[1].padStart(2, '0'), month: match[2].padStart(2, '0'), year: match[3] };
    return null;
  }

  // --- CÁLCULOS FILTRADOS ---
  turnosFiltrados = computed(() => {
    if (!this.hasSearched()) return [];
    
    const filtro = this.filtroAplicado();
    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');

    return this.turnosService.turnos().filter(t => {
      // Validar barbero y que el turno esté pagado o finalizado
      if (t.barbero !== this.nombreCompleto() || (t.estado !== 'completed' && t.estado !== 'finished')) return false;
      const d = this.parseDateStr(t.fecha);
      if (d) {
        const itemStr = `${d.year}${d.month}${d.day}`;
        return itemStr >= inicioStr && itemStr <= finStr;
      }
      return false;
    }).reverse();
  });

  adelantosFiltrados = computed(() => {
    if (!this.hasSearched()) return [];
    
    const id = this.empleadoId();
    if (!id) return [];
    
    const filtro = this.filtroAplicado();
    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');

    return this.gastosService.gastos().filter(g => {
      if (g.empleado_id !== id || g.estado === 'anulado') return false;
      const d = this.parseDateStr(g.fecha);
      if (d) {
        const itemStr = `${d.year}${d.month}${d.day}`;
        return itemStr >= inicioStr && itemStr <= finStr;
      }
      return false;
    });
  });

  // --- MATEMÁTICAS ---
  totalProducido = computed(() => this.turnosFiltrados().reduce((acc, t) => acc + Number(t.monto), 0));
  comisionNeta = computed(() => (this.totalProducido() * this.comisionPorcentaje()) / 100);
  totalAdelantos = computed(() => this.adelantosFiltrados().reduce((acc, g) => acc + Number(g.monto), 0));
  pagoFinal = computed(() => this.comisionNeta() - this.totalAdelantos());

  // --- ACCIONES ---
  buscar() {
    this.filtroAplicado.set({ inicio: this.fechaInicio(), fin: this.fechaFin() });
    this.hasSearched.set(true);
  }

  generarPDF() {
    const doc = new jsPDF();
    doc.setProperties({
      title: 'Reporte de Ganancias y Adelantos',
      subject: 'Marina 305 Barber Shop',
      author: 'Marina 305'
    });
    const filtro = this.filtroAplicado();
    const [y1, m1, d1] = filtro.inicio.split('-');
    const [y2, m2, d2] = filtro.fin.split('-');
    const subtitulo = `Barbero: ${this.nombreCompleto()} | Del ${d1}/${m1}/${y1} al ${d2}/${m2}/${y2}`;
    
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(89, 93, 100);
    doc.text("REPORTE DE GANANCIAS Y ADELANTOS", 105, 20, { align: "center" });
    
    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    doc.line(14, 26, 196, 26);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(subtitulo, 14, 38);

    const bodyData: any[] = [];
    
    // Cortes
    if (this.turnosFiltrados().length > 0) {
      this.turnosFiltrados().forEach(t => bodyData.push([`${t.fecha.split(',')[0]} - ${t.servicio}`, `S/ ${Number(t.monto).toFixed(2)}`]));
      bodyData.push([{ content: 'Total Generado por Cortes:', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `S/ ${this.totalProducido().toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
      bodyData.push([{ content: `Tu Comisión (${this.comisionPorcentaje()}%):`, styles: { fontStyle: 'bold', fillColor: [254, 243, 199] } }, { content: `S/ ${this.comisionNeta().toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [254, 243, 199] } }]);
    }
    
    // Adelantos
    if (this.adelantosFiltrados().length > 0) {
      bodyData.push([{ content: '--- ADELANTOS / DESCUENTOS ---', colSpan: 2, styles: { halign: 'center', fillColor: [254, 226, 226], textColor: [220, 38, 38], fontStyle: 'bold' } }]);
      this.adelantosFiltrados().forEach(g => bodyData.push([`${g.fecha.split(',')[0]} - ${g.descripcion}`, `- S/ ${Number(g.monto).toFixed(2)}`]));
      bodyData.push([{ content: 'Total Adelantos Restados:', styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }, { content: `- S/ ${this.totalAdelantos().toFixed(2)}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }]);
    }
    
    // Total Final
    bodyData.push([{ content: 'TOTAL NETO A RECIBIR:', styles: { fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [6, 78, 59] } }, { content: `S/ ${this.pagoFinal().toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [6, 78, 59] } }]);
    
    autoTable(doc, {
      startY: 45,
      head: [['Detalle', 'Monto']],
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: [89, 93, 100], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } }
    });

    const blob = doc.output('blob');
    window.open(URL.createObjectURL(blob), '_blank');
  }
}