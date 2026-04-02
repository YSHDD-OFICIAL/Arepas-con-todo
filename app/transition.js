// transition.js
let transitionActive = false;

export function navigate(url, skipTransition = false) {
  if (transitionActive) return;
  if (skipTransition) {
    window.location.href = url;
    return;
  }
  transitionActive = true;
  document.body.classList.add('fade-out');
  setTimeout(() => {
    window.location.href = url;
  }, 200);
}

export function preload(url) {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

// Preload páginas comunes
preload('menu.html');
preload('carrito.html');
preload('cuenta.html');

// Interceptar clics en enlaces internos
document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a');
  if (anchor && anchor.href && anchor.href.startsWith(window.location.origin) && !anchor.target && !anchor.hasAttribute('data-no-transition')) {
    e.preventDefault();
    navigate(anchor.href);
  }
});

// Añadir fade-in al cargar
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('fade-in');
});