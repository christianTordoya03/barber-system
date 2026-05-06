import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TurnosService } from '../../../core/services/turnos';
import { StaffService } from '../../../core/services/staff';
import { GastosService } from '../../../core/services/gastos'; // <-- IMPORTAMOS GASTOS
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-lista-empleado',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lista-empleado.html',
})
export class ListaEmpleadoComponent {
  private turnosService = inject(TurnosService);
  private staffService = inject(StaffService);
  private gastosService = inject(GastosService); // <-- INYECTAMOS GASTOS

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
  // 1. CÁLCULO DE SERVICIOS
  turnosEmpleado = computed(() => {
    const filtro = this.filtroAplicado();
    if (!filtro.empleado) return [];
    
    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');

    return this.turnosService.turnos().filter(t => {
      if (t.estado !== 'completed' || t.barbero !== filtro.empleado) return false;
      
      const match = t.fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        const itemStr = `${year}${month}${day}`;
        return itemStr >= inicioStr && itemStr <= finStr;
      }
      return false;
    });
  });

  // 2. CÁLCULO DE ADELANTOS (GASTOS ASIGNADOS A ÉL)
  adelantosEmpleado = computed(() => {
    const filtro = this.filtroAplicado();
    if (!filtro.empleado) return [];

    // Buscamos el ID del empleado seleccionado
    const empleadoObj = this.barberos().find(e => e.nombre === filtro.empleado);
    if (!empleadoObj) return [];

    const inicioStr = filtro.inicio.replace(/-/g, '');
    const finStr = filtro.fin.replace(/-/g, '');

    return this.gastosService.gastos().filter(g => {
      // Debe estar asignado a este empleado y NO estar anulado
      if (g.estado === 'anulado' || g.empleado_id !== empleadoObj.id) return false;

      const match = g.fecha.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        const itemStr = `${year}${month}${day}`;
        return itemStr >= inicioStr && itemStr <= finStr;
      }
      return false;
    });
  });

  // 3. MATEMÁTICA FINAL
  totalGeneradoEmpleado = computed(() => this.turnosEmpleado().reduce((acc, t) => acc + Number(t.monto), 0));
  
  porcentajeComisionEmpleado = computed(() => {
    const emp = this.barberos().find(e => e.nombre === this.filtroAplicado().empleado);
    return emp?.comision || 0;
  });

  comisionNetaEmpleado = computed(() => (this.totalGeneradoEmpleado() * this.porcentajeComisionEmpleado()) / 100);
  
  totalAdelantosEmpleado = computed(() => this.adelantosEmpleado().reduce((acc, g) => acc + Number(g.monto), 0));

  pagoFinalEmpleado = computed(() => this.comisionNetaEmpleado() - this.totalAdelantosEmpleado());

  buscar() {
    this.filtroAplicado.set({
      empleado: this.nombreEmpleadoReporte(),
      inicio: this.fechaInicio(),
      fin: this.fechaFin()
    });
  }

  generarPDF() {
    const doc = new jsPDF();
    const filtro = this.filtroAplicado();
    doc.setProperties({
      title: `Reporte de Comisiones - ${filtro.empleado}`,
      subject: 'Marina 305 Barber Shop',
      author: 'Marina 305'
    });
    const [y1, m1, d1] = filtro.inicio.split('-');
    const [y2, m2, d2] = filtro.fin.split('-');
    const subtitulo = `Barbero: ${filtro.empleado} | Del ${d1}/${m1}/${y1} al ${d2}/${m2}/${y2}`;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(89, 93, 100);
    doc.text("REPORTE DE COMISIONES Y ADELANTOS", 105, 20, { align: "center" });

    doc.setLineWidth(0.5);
    doc.setDrawColor(150, 150, 150);
    doc.line(14, 26, 196, 26);

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text(subtitulo, 14, 38);

    const bodyData: any[] = [];

    // Sección: Servicios
    if (this.turnosEmpleado().length > 0) {
      this.turnosEmpleado().forEach(t => bodyData.push([`${t.fecha.split(',')[0]} - ${t.servicio}`, `S/ ${Number(t.monto).toFixed(2)}`]));
      bodyData.push([{ content: 'Total Generado por el Barbero:', styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }, { content: `S/ ${this.totalGeneradoEmpleado().toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }]);
      bodyData.push([{ content: `Comisión a Pagar (${this.porcentajeComisionEmpleado()}%):`, styles: { fontStyle: 'bold', fillColor: [254, 243, 199] } }, { content: `S/ ${this.comisionNetaEmpleado().toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [254, 243, 199] } }]);
    }

    // Sección: Adelantos
    if (this.adelantosEmpleado().length > 0) {
      bodyData.push([{ content: '--- ADELANTOS / GASTOS ---', colSpan: 2, styles: { halign: 'center', fillColor: [254, 226, 226], textColor: [220, 38, 38], fontStyle: 'bold' } }]);
      this.adelantosEmpleado().forEach(g => bodyData.push([`${g.fecha.split(',')[0]} - ${g.descripcion}`, `- S/ ${Number(g.monto).toFixed(2)}`]));
      bodyData.push([{ content: 'Total Adelantos:', styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }, { content: `- S/ ${this.totalAdelantosEmpleado().toFixed(2)}`, styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }]);
    }

    // Sección: Total Final
    bodyData.push([{ content: 'TOTAL NETO A PAGAR:', styles: { fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [6, 78, 59] } }, { content: `S/ ${this.pagoFinalEmpleado().toFixed(2)}`, styles: { fontStyle: 'bold', fillColor: [209, 250, 229], textColor: [6, 78, 59] } }]);

    autoTable(doc, {
      startY: 45,
      head: [['Detalle', 'Monto']],
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: [89, 93, 100], textColor: 255, fontStyle: 'bold' },
      columnStyles: { 1: { halign: 'right' } }
    });

    // Genera el archivo en la memoria del navegador
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    // Abre una nueva pestaña con el visualizador de PDF
    window.open(url, '_blank');
  }
}