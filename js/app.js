/**
 * PRO TRADING ACADEMY USA - Portal de Estudio Trading
 * Main JavaScript File
 */

// ============================================
// Navbar scroll effect
// ============================================
(function() {
  const navbar = document.getElementById('navbar');
  if (!navbar) return;

  function handleScroll() {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Initial check
})();

// ============================================
// Mobile menu toggle
// ============================================
(function() {
  const navbar = document.getElementById('navbar');
  const toggle = document.getElementById('mobileToggle');
  const menu = document.getElementById('navMenu');
  if (!navbar || !toggle || !menu) return;

  function closeMenu() {
    navbar.classList.remove('nav-open');
    toggle.classList.remove('active');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-menu-open');
  }

  function openMenu() {
    navbar.classList.add('nav-open');
    toggle.classList.add('active');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.classList.add('nav-menu-open');
  }

  toggle.setAttribute('aria-label', 'Abrir menú');
  toggle.setAttribute('aria-expanded', 'false');

  toggle.addEventListener('click', function() {
    if (navbar.classList.contains('nav-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menu.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) closeMenu();
  });
})();

// ============================================
// Scroll animations (Intersection Observer)
// ============================================
(function() {
  const elements = document.querySelectorAll('.animate-on-scroll');
  if (!elements.length) return;

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -50px 0px'
  });

  elements.forEach(function(el) {
    observer.observe(el);
  });
})();

// ============================================
// Counter animation
// ============================================
(function() {
  const counters = document.querySelectorAll('[data-count]');
  if (!counters.length) return;

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'));
    const duration = 2000;
    const start = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const easeProgress = 1 - (1 - progress) * (1 - progress);
      const current = Math.floor(start + (target - start) * easeProgress);

      el.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = target.toLocaleString();
        // Add suffix if needed
        if (target === 95) {
          el.textContent = target + '%';
        } else if (target >= 1000) {
          el.textContent = target.toLocaleString() + '+';
        } else {
          el.textContent = target.toLocaleString() + '+';
        }
      }
    }

    requestAnimationFrame(update);
  }

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function(counter) {
    observer.observe(counter);
  });
})();

// ============================================
// Counter animation for counter-section
// ============================================
(function() {
  const counters = document.querySelectorAll('.counter-number[data-count]');
  if (!counters.length) return;

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'));
    const duration = 2500;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(target * easeProgress);

      if (target === 95) {
        el.textContent = current + '%';
      } else {
        el.textContent = current.toLocaleString() + '+';
      }

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function(counter) {
    observer.observe(counter);
  });
})();

// ============================================
// Hero chart bars animation
// ============================================
(function() {
  const chartContainer = document.getElementById('chartBars');
  if (!chartContainer || chartContainer.hidden) return;

  const data = [
    { h: 45, type: 'green' }, { h: 30, type: 'red' }, { h: 60, type: 'green' },
    { h: 25, type: 'red' }, { h: 70, type: 'green' }, { h: 50, type: 'green' },
    { h: 35, type: 'red' }, { h: 80, type: 'green' }, { h: 40, type: 'red' },
    { h: 65, type: 'green' }, { h: 55, type: 'green' }, { h: 20, type: 'red' },
    { h: 75, type: 'green' }, { h: 90, type: 'green' }, { h: 45, type: 'red' },
    { h: 85, type: 'green' }, { h: 50, type: 'green' }, { h: 30, type: 'red' },
    { h: 70, type: 'green' }, { h: 60, type: 'green' }, { h: 95, type: 'green' },
    { h: 40, type: 'red' }, { h: 55, type: 'green' }, { h: 80, type: 'green' },
    { h: 35, type: 'red' }, { h: 65, type: 'green' }, { h: 75, type: 'green' },
    { h: 50, type: 'green' }, { h: 85, type: 'green' }, { h: 42, type: 'red' }
  ];

  data.forEach(function(bar, i) {
    const el = document.createElement('div');
    el.className = 'chart-bar ' + bar.type;
    el.style.height = '0%';
    chartContainer.appendChild(el);

    setTimeout(function() {
      el.style.height = bar.h + '%';
    }, 100 + i * 50);
  });
})();

// ============================================
// Hero particles
// ============================================
(function() {
  const container = document.getElementById('particles');
  if (!container) return;

  for (let i = 0; i < 20; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.top = Math.random() * 100 + '%';
    particle.style.width = (Math.random() * 6 + 2) + 'px';
    particle.style.height = particle.style.width;
    particle.style.animationDuration = (Math.random() * 20 + 10) + 's';
    particle.style.animationDelay = (Math.random() * 10) + 's';
    container.appendChild(particle);
  }
})();

// ============================================
// FAQ toggle (for landing page)
// ============================================
function toggleFaq(el) {
  const item = el.closest('.faq-item');
  if (!item) return;

  const isActive = item.classList.contains('active');

  // Close all FAQ items
  document.querySelectorAll('.faq-item').forEach(function(faq) {
    faq.classList.remove('active');
  });

  // Toggle the clicked one
  if (!isActive) {
    item.classList.add('active');
  }
}

// ============================================
// Smooth scroll for anchor links
// ============================================
(function() {
  function getNavOffset() {
    const navbar = document.querySelector('.navbar');
    return navbar ? navbar.offsetHeight : 0;
  }

  function scrollToTarget(target, behavior) {
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - getNavOffset() - 20;
    window.scrollTo({ top: top, behavior: behavior || 'smooth' });
  }

  function closeMobileNav() {
    const navbar = document.getElementById('navbar');
    if (navbar && window.innerWidth < 768) {
      navbar.classList.remove('nav-open');
      document.body.classList.remove('nav-menu-open');
    }
  }

  document.querySelectorAll('a[href^="#"]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        scrollToTarget(target, 'smooth');
        closeMobileNav();
      }
    });
  });

  function scrollToHashOnLoad() {
    const hash = window.location.hash;
    if (!hash || hash === '#') return;
    const target = document.querySelector(hash);
    if (!target) return;
    requestAnimationFrame(function() {
      scrollToTarget(target, 'auto');
    });
  }

  window.addEventListener('load', scrollToHashOnLoad);
  window.addEventListener('hashchange', scrollToHashOnLoad);
})();

// ============================================
// Active nav link highlight on scroll
// ============================================
(function() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.navbar-nav a');
  if (!sections.length || !navLinks.length) return;

  function highlightNav() {
    const scrollPos = window.scrollY + 100;

    sections.forEach(function(section) {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.forEach(function(link) {
          link.classList.remove('active');
          if (link.getAttribute('href') === '#' + id) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  window.addEventListener('scroll', highlightNav);
})();

// ============================================
// Toast notification helper
// ============================================
function showToast(message, type) {
  type = type || 'info';
  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-exclamation-circle',
    info: 'fas fa-info-circle'
  };

  // Remove existing toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<i class="' + icons[type] + ' toast-icon"></i>' +
    '<span>' + message + '</span>';
  document.body.appendChild(toast);

  setTimeout(function() { toast.classList.add('show'); }, 50);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

// ============================================
// Lazy load images (if any)
// ============================================
(function() {
  if ('IntersectionObserver' in window) {
    const lazyImages = document.querySelectorAll('img[data-src]');
    const imgObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          const img = entry.target;
          img.src = img.getAttribute('data-src');
          img.removeAttribute('data-src');
          imgObserver.unobserve(img);
        }
      });
    });

    lazyImages.forEach(function(img) {
      imgObserver.observe(img);
    });
  }
})();

// ============================================
// Add loading class removal
// ============================================
window.addEventListener('load', function() {
  document.body.classList.add('loaded');
});

console.log('Pro Trading Academy USA Portal loaded successfully.');
