document.addEventListener('DOMContentLoaded', () => {
  const devBtns = document.querySelectorAll('.dev-btn');
  const modal = document.getElementById('dev-modal');
  const modalText = document.getElementById('modal-text');
  const modalTitle = document.getElementById('modal-title');
  const modalOk = document.getElementById('modal-close');
  const modalX = document.getElementById('modal-x');
  const searchInput = document.getElementById('hostel-search');
  const emptyState = document.getElementById('empty-state');
  const hostelGrid = document.querySelector('.hostel-grid');

  // Modal functions
  function openModal(name) {
    modalText.textContent = `${name} — still in development. Check back soon for updates!`;
    if (modalTitle) modalTitle.textContent = name;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
    if (modalOk) modalOk.focus();
  }

  function closeModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; // Restore scroll
  }

  // Event listeners for development buttons
  devBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const name = btn.getAttribute('data-name') || 'This hostel';
      openModal(name);
    });
  });

  // Modal close handlers
  if (modalOk) modalOk.addEventListener('click', closeModal);
  if (modalX) modalX.addEventListener('click', closeModal);

  // Close on overlay click
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
      closeModal();
    }
  });

  // Search/filter functionality
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();
      const cards = document.querySelectorAll('.hostel-card');
      let visibleCount = 0;

      cards.forEach(card => {
        const title = card.querySelector('.hostel-title')?.textContent?.toLowerCase() || '';
        const desc = card.querySelector('.hostel-desc')?.textContent?.toLowerCase() || '';
        
        if (!query || title.includes(query) || desc.includes(query)) {
          card.style.display = '';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      // Show/hide empty state
      if (emptyState) {
        if (visibleCount === 0 && query) {
          emptyState.style.display = 'block';
          hostelGrid.style.display = 'none';
        } else {
          emptyState.style.display = 'none';
          hostelGrid.style.display = 'grid';
        }
      }
    });

    // Clear search on Escape
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        searchInput.value = '';
        searchInput.dispatchEvent(new Event('input'));
      }
    });
  }

  // Keyboard navigation for hostel grid
  const grid = document.querySelector('.hostel-grid');
  if (grid) {
    grid.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const focusable = Array.from(grid.querySelectorAll('a:not([style*="display: none"]), button:not([style*="display: none"])'));
        const currentIndex = focusable.indexOf(document.activeElement);
        
        if (currentIndex >= 0) {
          let nextIndex = currentIndex + (e.key === 'ArrowRight' ? 1 : -1);
          
          // Wrap around
          if (nextIndex < 0) nextIndex = focusable.length - 1;
          if (nextIndex >= focusable.length) nextIndex = 0;
          
          if (focusable[nextIndex]) {
            focusable[nextIndex].focus();
            e.preventDefault();
          }
        }
      }
    });
  }

  // Add smooth scroll behavior
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add loading animation completion
  window.addEventListener('load', () => {
    document.body.classList.add('loaded');
  });

  // Intersection Observer for cards (optional enhancement)
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    // Observe all cards
    document.querySelectorAll('.hostel-card').forEach(card => {
      observer.observe(card);
    });
  }
});