document.addEventListener('DOMContentLoaded', () => {
  const yearsView = document.getElementById('years-view');
  const alumniView = document.getElementById('alumni-view');
  const profileView = document.getElementById('profile-view');
  const cardsContainer = document.getElementById('cards-container');
  const alumniContainer = document.getElementById('alumni-container');
  const profileDetails = document.getElementById('profile-details');
  const backToYearsButton = document.getElementById('back-to-years-button');
  const backToAlumniButton = document.getElementById('back-to-alumni-button');
  const alumniYearTitle = document.getElementById('alumni-year-title');
  const loadingOverlay = document.getElementById('loading-overlay');
  const yearSearchInput = document.getElementById('year-search');
  const alumniSearchInput = document.getElementById('alumni-search');
  
  let alumniData = {};
  let availableYears = [];
  let currentYear = null;
  let currentAlumniList = [];

  // Show/Hide Loading
  function showLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.remove('hidden');
    }
  }

  function hideLoading() {
    if (loadingOverlay) {
      loadingOverlay.classList.add('hidden');
    }
  }

  // Fetch data from Google Sheet
  async function getAlumniDataFromSheet() {
    const url = "https://docs.google.com/spreadsheets/d/1BN1xX36P5mcTuBRslao27lqsQzLs6MU4TZtavZ8ZFow/gviz/tq?tqx=out:json";
    showLoading();
    try {
      const res = await fetch(url);
      const text = await res.text();
      
      // Parse the Google Sheets JSON response
      const jsonString = text.substring(47).slice(0, -2);
      const json = JSON.parse(jsonString);
      
      let data = {};
      let yearsSet = new Set();

      // Check if we have valid data
      if (!json.table || !json.table.rows) {
        throw new Error("Invalid data structure from Google Sheets");
      }

      json.table.rows.forEach(row => {
        // Skip if row doesn't have data
        if (!row.c) return;
        
        const name        = row.c[1]?.v || "";
        const email       = row.c[2]?.v || "";
        const year        = row.c[3]?.v || "";
        const posted      = row.c[4]?.v || "";
        const profileImg  = row.c[5]?.v || "";
        const achievements= row.c[6]?.v || "";
        const extra       = row.c[7]?.v || "";
        const roomNo      = row.c[8]?.v || "";

        // Skip rows without year or name
        if (!year || !name) return;
        
        if (!data[year]) data[year] = [];
        data[year].push({ 
          name, 
          profileImg: profileImg || "", 
          email, 
          posted, 
          achievements, 
          extra, 
          roomNo 
        });
        yearsSet.add(year);
      });

      hideLoading();
      return { data, years: Array.from(yearsSet).sort() };
    } catch (error) {
      console.error("Failed to fetch or parse sheet data:", error);
      hideLoading();
      showError("Failed to load alumni data. Please check your internet connection and try again.");
      return { data: {}, years: [] };
    }
  }

  function showError(message) {
    cardsContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i class="fas fa-exclamation-triangle"></i>
        <p>${message}</p>
        <button class="retry-button" onclick="location.reload()">Retry</button>
      </div>
    `;
  }

  function createYearCards() {
    cardsContainer.innerHTML = '';
    
    if (availableYears.length === 0) {
      cardsContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fas fa-calendar-times"></i>
          <p>No batch years available</p>
        </div>
      `;
      return;
    }

    availableYears.forEach((yearText, index) => {
      const card = document.createElement('a');
      card.href = "#";
      card.className = "card";
      card.textContent = yearText;
      card.style.animationDelay = `${index * 0.05}s`;
      card.addEventListener('click', (e) => {
        e.preventDefault();
        currentYear = yearText;
        displayAlumni(currentYear);
      });
      cardsContainer.appendChild(card);
    });
  }

  function displayAlumni(year) {
    yearsView.classList.add('hidden');
    profileView.classList.add('hidden');
    alumniView.classList.remove('hidden');
    alumniYearTitle.textContent = `Alumni of ${year}`;
    
    if (alumniSearchInput) {
      alumniSearchInput.value = '';
    }
    
    const yearAlumni = alumniData[year] || [];
    currentAlumniList = yearAlumni;
    renderAlumniCards(yearAlumni);
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderAlumniCards(alumniList) {
    alumniContainer.innerHTML = "";
    
    if (alumniList.length === 0) {
      alumniContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <i class="fas fa-user-slash"></i>
          <p>No alumni found</p>
        </div>
      `;
      return;
    }

    alumniList.forEach((alumnus, index) => {
      try {
        const alumniCard = document.createElement('div');
        alumniCard.className = 'alumni-card';
        alumniCard.style.animationDelay = `${index * 0.05}s`;
        alumniCard.addEventListener('click', () => displayProfile(alumnus));

        // Avatar logic
        let avatar;
        const hasValidImage = alumnus.profileImg && 
                             alumnus.profileImg !== "" && 
                             alumnus.profileImg !== "https://via.placeholder.com/150" &&
                             !alumnus.profileImg.includes('placeholder');
        
        if (!hasValidImage) {
          avatar = document.createElement('div');
          avatar.className = 'avatar-fallback';
          avatar.textContent = alumnus.name ? alumnus.name.charAt(0).toUpperCase() : "?";
        } else {
          avatar = document.createElement('img');
          avatar.src = alumnus.profileImg;
          avatar.alt = alumnus.name || 'Alumni';
          avatar.onerror = function() {
            const fallback = document.createElement('div');
            fallback.className = 'avatar-fallback';
            fallback.textContent = alumnus.name ? alumnus.name.charAt(0).toUpperCase() : "?";
            this.parentNode.replaceChild(fallback, this);
          };
        }
        alumniCard.appendChild(avatar);

        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = alumnus.name || 'Unknown';
        alumniCard.appendChild(name);

        alumniContainer.appendChild(alumniCard);
      } catch (e) {
        console.error('Card render error:', e, alumnus);
      }
    });
  }

  function displayProfile(alumnus) {
    alumniView.classList.add('hidden');
    profileView.classList.remove('hidden');

    const hasValidImage = alumnus.profileImg && 
                         alumnus.profileImg !== "" && 
                         alumnus.profileImg !== "https://via.placeholder.com/150" &&
                         !alumnus.profileImg.includes('placeholder');

    let avatarHtml;
    if (!hasValidImage) {
      const initial = alumnus.name ? alumnus.name.charAt(0).toUpperCase() : "?";
      avatarHtml = `<div class="avatar-fallback">${initial}</div>`;
    } else {
      const initial = alumnus.name ? alumnus.name.charAt(0).toUpperCase() : "?";
      avatarHtml = `<img src="${alumnus.profileImg}" alt="${alumnus.name || 'Alumni'}" onerror="this.outerHTML='<div class=\\'avatar-fallback\\'>${initial}</div>';" />`;
    }

    profileDetails.innerHTML = `
      ${avatarHtml}
      <h2>${alumnus.name || 'Unknown'}</h2>
      <div class="profile-item">
        <strong><i class="fas fa-envelope"></i> Email</strong>
        <p>${alumnus.email || 'Not provided'}</p>
      </div>
      <div class="profile-item">
        <strong><i class="fas fa-map-marker-alt"></i> Currently Posted</strong>
        <p>${alumnus.posted || 'Not provided'}</p>
      </div>
      <div class="profile-item">
        <strong><i class="fas fa-trophy"></i> Achievements</strong>
        <p>${alumnus.achievements || 'Not provided'}</p>
      </div>
      ${alumnus.roomNo ? `<div class="profile-item">
        <strong><i class="fas fa-door-open"></i> Room No.</strong>
        <p>${alumnus.roomNo}</p>
      </div>` : ""}
      ${alumnus.extra ? `<div class="profile-item">
        <strong><i class="fas fa-info-circle"></i> Other Details</strong>
        <p>${alumnus.extra}</p>
      </div>` : ""}
    `;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Search functionality for years
  if (yearSearchInput) {
    yearSearchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const cards = cardsContainer.querySelectorAll('.card');
      
      cards.forEach(card => {
        const yearText = card.textContent.toLowerCase();
        if (yearText.includes(searchTerm)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  }

  // Search functionality for alumni
  if (alumniSearchInput) {
    alumniSearchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      const filteredAlumni = currentAlumniList.filter(alumnus => 
        alumnus.name && alumnus.name.toLowerCase().includes(searchTerm)
      );
      renderAlumniCards(filteredAlumni);
    });
  }

  backToYearsButton.addEventListener('click', () => {
    alumniView.classList.add('hidden');
    yearsView.classList.remove('hidden');
    currentYear = null;
    if (yearSearchInput) {
      yearSearchInput.value = '';
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  backToAlumniButton.addEventListener('click', () => {
    if (currentYear) {
      profileView.classList.add('hidden');
      alumniView.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  // Start the app once data loads
  getAlumniDataFromSheet().then(obj => {
    alumniData = obj.data;
    availableYears = obj.years;
    createYearCards();
  });
});