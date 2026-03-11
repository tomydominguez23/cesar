/* ============================================
   PRO TRADING ACADEMY USA - Panel de Administración
   Admin JavaScript
   ============================================ */

(function() {
  'use strict';

  // ---- Sidebar Toggle ----
  const sidebar = document.querySelector('.admin-sidebar');
  const sidebarToggle = document.querySelector('.sidebar-toggle');
  const adminLayout = document.querySelector('.admin-layout');

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      adminLayout.classList.toggle('sidebar-collapsed');
      localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
  }

  if (localStorage.getItem('sidebar-collapsed') === 'true') {
    sidebar?.classList.add('collapsed');
    adminLayout?.classList.add('sidebar-collapsed');
  }

  // Mobile sidebar
  const mobileToggle = document.querySelector('.mobile-sidebar-toggle');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 1024 && sidebar?.classList.contains('mobile-open')) {
      if (!sidebar.contains(e.target) && !e.target.closest('.sidebar-toggle')) {
        sidebar.classList.remove('mobile-open');
      }
    }
  });

  // ---- Toast Notifications ----
  window.AdminToast = {
    container: null,

    init() {
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
      }
    },

    show(type, title, message, duration = 4000) {
      this.init();
      const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
      };

      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.innerHTML = `
        <i class="fa-solid ${icons[type]} toast-icon"></i>
        <div class="toast-content">
          <div class="toast-title">${title}</div>
          ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;

      this.container.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
      }, duration);
    },

    success(title, message) { this.show('success', title, message); },
    error(title, message) { this.show('error', title, message); },
    warning(title, message) { this.show('warning', title, message); },
    info(title, message) { this.show('info', title, message); }
  };

  // ---- Modal System ----
  window.AdminModal = {
    open(modalId) {
      const overlay = document.getElementById(modalId);
      if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    },

    close(modalId) {
      const overlay = document.getElementById(modalId);
      if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    },

    closeAll() {
      document.querySelectorAll('.modal-overlay').forEach(m => {
        m.classList.remove('active');
      });
      document.body.style.overflow = '';
    }
  };

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      AdminModal.closeAll();
    }
    if (e.target.closest('.modal-close')) {
      const overlay = e.target.closest('.modal-overlay');
      if (overlay) overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      AdminModal.closeAll();
    }
  });

  // ---- Dropdown System ----
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-dropdown]');
    if (trigger) {
      e.stopPropagation();
      const menu = trigger.nextElementSibling;
      document.querySelectorAll('.dropdown-menu.active').forEach(d => {
        if (d !== menu) d.classList.remove('active');
      });
      menu?.classList.toggle('active');
      return;
    }
    document.querySelectorAll('.dropdown-menu.active').forEach(d => d.classList.remove('active'));
  });

  // ---- Tab System ----
  document.querySelectorAll('.tabs').forEach(tabContainer => {
    const tabs = tabContainer.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const parent = tabContainer.parentElement;
        parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const targetEl = parent.querySelector(`#${target}`);
        if (targetEl) targetEl.classList.add('active');
      });
    });
  });

  // ---- Module Expand/Collapse ----
  document.addEventListener('click', (e) => {
    const moduleHeader = e.target.closest('.module-header');
    if (moduleHeader && !e.target.closest('.table-action-btn') && !e.target.closest('.dropdown')) {
      const moduleItem = moduleHeader.closest('.module-item');
      moduleItem.classList.toggle('expanded');
    }
  });

  // ---- File Upload Areas ----
  document.querySelectorAll('.file-upload-area').forEach(area => {
    const input = area.querySelector('input[type="file"]');

    area.addEventListener('click', () => input?.click());

    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
      area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (input && files.length) {
        input.files = files;
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  // ---- Search Filter for Tables ----
  window.filterTable = function(inputEl, tableId) {
    const query = inputEl.value.toLowerCase();
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  };

  // ---- Confirm Delete ----
  window.confirmDelete = function(itemName) {
    return confirm(`¿Estás seguro de eliminar "${itemName}"? Esta acción no se puede deshacer.`);
  };

  // ---- Format Numbers ----
  window.formatNumber = function(num) {
    return new Intl.NumberFormat('es-US').format(num);
  };

  window.formatCurrency = function(num) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  // ---- Date Formatter ----
  window.formatDate = function(date) {
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric'
    }).format(new Date(date));
  };

  // ---- Demo Data Store ----
  window.AdminData = {
    courses: [
      { id: 1, title: 'Primeros Pasos', description: 'Introducción al mundo del trading', modules: 4, lessons: 18, students: 342, status: 'published', plan: 'basico', image: '' },
      { id: 2, title: 'El Mercado', description: 'Comprende cómo funciona el mercado financiero', modules: 6, lessons: 32, students: 287, status: 'published', plan: 'medio', image: '' },
      { id: 3, title: 'Análisis Técnico', description: 'Domina las herramientas de análisis técnico', modules: 8, lessons: 45, students: 198, status: 'published', plan: 'avanzado', image: '' },
      { id: 4, title: 'Trading Avanzado', description: 'Estrategias avanzadas de trading profesional', modules: 10, lessons: 56, students: 156, status: 'published', plan: 'pro', image: '' },
      { id: 5, title: 'Gestión de Riesgo', description: 'Protege tu capital con estrategias de riesgo', modules: 5, lessons: 22, students: 234, status: 'draft', plan: 'medio', image: '' },
      { id: 6, title: 'Psicología del Trading', description: 'Control emocional y disciplina', modules: 3, lessons: 15, students: 0, status: 'draft', plan: 'avanzado', image: '' }
    ],

    users: [
      { id: 1, name: 'Carlos Rodríguez', email: 'carlos@email.com', plan: 'pro', status: 'active', joined: '2025-11-15', progress: 78, revenue: 1799 },
      { id: 2, name: 'María García', email: 'maria@email.com', plan: 'avanzado', status: 'active', joined: '2025-12-01', progress: 45, revenue: 1000 },
      { id: 3, name: 'Juan Martínez', email: 'juan@email.com', plan: 'medio', status: 'active', joined: '2026-01-10', progress: 62, revenue: 699 },
      { id: 4, name: 'Ana López', email: 'ana@email.com', plan: 'basico', status: 'active', joined: '2026-01-22', progress: 31, revenue: 399 },
      { id: 5, name: 'Pedro Sánchez', email: 'pedro@email.com', plan: 'pro', status: 'active', joined: '2025-10-05', progress: 91, revenue: 1799 },
      { id: 6, name: 'Laura Torres', email: 'laura@email.com', plan: 'avanzado', status: 'inactive', joined: '2025-09-20', progress: 55, revenue: 1000 },
      { id: 7, name: 'Roberto Díaz', email: 'roberto@email.com', plan: 'medio', status: 'active', joined: '2026-02-14', progress: 12, revenue: 699 },
      { id: 8, name: 'Sofia Ramírez', email: 'sofia@email.com', plan: 'pro', status: 'active', joined: '2026-01-05', progress: 68, revenue: 1799 },
      { id: 9, name: 'Diego Hernández', email: 'diego@email.com', plan: 'basico', status: 'cancelled', joined: '2025-08-15', progress: 22, revenue: 399 },
      { id: 10, name: 'Carmen Flores', email: 'carmen@email.com', plan: 'avanzado', status: 'active', joined: '2026-03-01', progress: 5, revenue: 1000 }
    ],

    plans: [
      { id: 1, name: 'Básico', price: 399, currency: 'USD', interval: 'one-time', features: ['Primeros Pasos', 'FAQ', 'Soporte básico'], stripeId: '', color: '#6b7280', students: 89 },
      { id: 2, name: 'Medio', price: 699, currency: 'USD', interval: 'one-time', features: ['Todo lo de Básico', 'El Mercado', 'Gestión de Riesgo', 'Soporte prioritario'], stripeId: '', color: '#3b82f6', students: 134 },
      { id: 3, name: 'Avanzado', price: 1000, currency: 'USD', interval: 'one-time', features: ['Todo lo de Medio', 'Análisis Técnico', 'Psicología del Trading', 'Mentorías grupales'], stripeId: '', color: '#8b5cf6', students: 87 },
      { id: 4, name: 'Pro Trading', price: 1799, currency: 'USD', interval: 'one-time', features: ['Acceso total', 'Trading Avanzado', 'Mentorías 1:1', 'Señales en vivo', 'Comunidad VIP'], stripeId: '', color: '#e8a838', students: 52 }
    ],

    monthlyRevenue: [28400, 31200, 35800, 42100, 38900, 45200, 51800, 48300, 53600, 58200, 62400, 67800],
    monthlyUsers: [32, 28, 41, 53, 47, 62, 58, 71, 65, 78, 82, 95],
    monthLabels: ['Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene', 'Feb']
  };

  // ---- Chart Helpers ----
  window.createChart = function(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    return new Chart(canvas.getContext('2d'), config);
  };

  window.chartColors = {
    primary: '#0d4f4f',
    primaryLight: 'rgba(13,79,79,0.1)',
    accent: '#00c9a7',
    accentLight: 'rgba(0,201,167,0.1)',
    secondary: '#e8a838',
    secondaryLight: 'rgba(232,168,56,0.1)',
    info: '#3b82f6',
    infoLight: 'rgba(59,130,246,0.1)',
    danger: '#ef4444',
    success: '#10b981',
    purple: '#8b5cf6'
  };

  window.defaultChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: '#1a1a2e',
        titleFont: { family: 'Inter', size: 12, weight: '600' },
        bodyFont: { family: 'Inter', size: 12 },
        padding: 12,
        cornerRadius: 8,
        displayColors: false
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: 'Inter', size: 11 },
          color: '#8a94a6'
        }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)', drawBorder: false },
        ticks: {
          font: { family: 'Inter', size: 11 },
          color: '#8a94a6'
        }
      }
    }
  };

  // ---- Page Animation ----
  const content = document.querySelector('.admin-content');
  if (content) {
    content.classList.add('animate-fade-in');
  }

  // ---- Initialize ----
  console.log('Admin Panel initialized');

})();
