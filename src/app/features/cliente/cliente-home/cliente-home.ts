import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ClienteLayoutComponent } from '../cliente-layout/cliente-layout';

@Component({
  selector: 'app-cliente-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cliente-home.html',
})
export class ClienteHomeComponent implements OnInit {
  // Inyectamos el Layout padre para acceder a su señal cargada
  private layoutPadre = inject(ClienteLayoutComponent);

  nombreCliente = signal<string>('Socio');
  puntosAcumulados = signal<number>(350);
  nivelActual = signal<'Classic' | 'Silver' | 'Gold'>('Classic');
  cortesFaltantes = signal<number>(2);

  promociones = signal([
    { id: 1, titulo: 'Martes de Barba Pro', descuento: '20% OFF', descripcion: 'Aplica para todos los perfilados agendando hoy.' },
    { id: 2, titulo: 'Corte + Bebida de Cortesía', descuento: 'Gratis', descripcion: 'Disfruta de una bebida premium en tu visita.' }
  ]);

  spotlightVideos = signal([
    { id: 1, barbero: 'Christian', estilo: 'Mid Fade Texturizado', videoUrl: '' },
    { id: 2, barbero: 'Alex', estilo: 'Classic Pompadour', videoUrl: '' },
    { id: 3, barbero: 'Carlos', estilo: 'Beard Lineup', videoUrl: '' },
  ]);

  videoActivo = signal<string | null>(null);

  ngOnInit() {
    // Sincronizamos nuestra señal local con la señal real del padre
    this.nombreCliente.set(this.layoutPadre.nombreCliente());
  }

  abrirVideo(url: string) {
    this.videoActivo.set(url);
  }

  cerrarVideo() {
    this.videoActivo.set(null);
  }
}