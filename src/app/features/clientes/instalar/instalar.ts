// import { Component, inject } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { PwaService } from '../../../core/services/pwa';

// @Component({
//   selector: 'app-instalar',
//   standalone: true,
//   imports: [CommonModule],
//   template: `
//     <div class="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center animate-fade-in-up font-sans selection:bg-blue-500 selection:text-white">
      
//       <!-- Logo de la Barbería -->
//       <div class="mb-8">
//         <img class="mx-auto h-28 w-auto object-contain drop-shadow-2xl" src="logo-marina305.png" alt="Marina 305 Barber Shop">
//       </div>
      
//       <h1 class="text-3xl font-black text-white tracking-tight mb-2">Marina 305 App</h1>
//       <p class="text-zinc-400 mb-10 max-w-xs mx-auto text-sm">Gestiona tus cortes, revisa tus comisiones y agenda reservas al instante.</p>
      
//       @if (pwaService.canInstall()) {
//         <!-- BOTÓN MÁGICO PARA ANDROID/CHROME -->
//         <button (click)="pwaService.installApp()" class="w-full max-w-xs bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold text-base py-4 px-8 rounded-2xl shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex items-center justify-center">
//           <svg class="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
//           Instalar Aplicación
//         </button>
//       } @else {
//         <!-- INSTRUCCIONES PARA IPHONE (Safari) O SI YA ESTÁ INSTALADA -->
//         <div class="bg-[#111111] border border-zinc-800 rounded-3xl p-6 max-w-xs w-full text-left shadow-2xl relative overflow-hidden">
//           <div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-red-600 via-gray-200 to-blue-600"></div>
          
//           <p class="text-sm text-white font-bold mb-4 flex items-center">
//             <svg class="w-5 h-5 mr-2 text-zinc-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm4.207 12.793-1.414 1.414L12 13.414l-2.793 2.793-1.414-1.414L10.586 12 7.793 9.207l1.414-1.414L12 10.586l2.793-2.793 1.414 1.414L13.414 12l2.793 2.793z"></path></svg>
//              ¿Estás en un iPhone?
//           </p>
//           <ol class="text-sm text-zinc-400 space-y-3 list-decimal list-inside">
//             <li>Toca el botón <span class="font-bold text-white">Compartir</span> en la barra inferior.</li>
//             <li>Busca y toca <span class="font-bold text-white">"Agregar a inicio"</span>.</li>
//             <li>Abre la app desde tu menú.</li>
//           </ol>
//         </div>
//       }
//     </div>
//   `
// })
// export class InstalarComponent {
//   pwaService = inject(PwaService);
// }