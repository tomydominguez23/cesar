(function() {
  "use strict";

  function setupDashNavbar() {
    const navbar = document.querySelector(".dash-navbar");
    if (!navbar || navbar.dataset.mobileNavReady === "1") return;

    const container = navbar.querySelector(".container-lg");
    const links = navbar.querySelector(".dash-nav-links");
    if (!container || !links) return;

    navbar.dataset.mobileNavReady = "1";

    let toggle = navbar.querySelector(".dash-mobile-toggle");
    if (!toggle) {
      toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "dash-mobile-toggle";
      toggle.setAttribute("aria-label", "Abrir menú del portal");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = "<span></span><span></span><span></span>";
      container.appendChild(toggle);
    }

    function closeMenu() {
      navbar.classList.remove("dash-nav-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("dash-nav-menu-open");
    }

    toggle.addEventListener("click", function() {
      const isOpen = navbar.classList.toggle("dash-nav-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
      document.body.classList.toggle("dash-nav-menu-open", isOpen);
    });

    links.querySelectorAll("a").forEach(function(link) {
      link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", function() {
      if (window.innerWidth > 768) closeMenu();
    });
  }

  document.addEventListener("DOMContentLoaded", setupDashNavbar);

  window.PTAMobilePortalNav = {
    setupDashNavbar
  };
})();
