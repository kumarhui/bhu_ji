import { firebaseConfig } from '../api/config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, query, orderBy, where, startAfter, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const feedEl = document.getElementById('item-feed');
const chips = document.querySelectorAll('.cat-chip');

const BATCH_SIZE = 10;
let lastVisible = null;
let loading = false;
let exhausted = false;
let currentCategory = "All";

const loaderEntry = document.createElement('div');
loaderEntry.className = 'feed-loader';
loaderEntry.textContent = 'Loading more listings...';

const toTitleCase = (value) => {
    if (!value) return 'Untitled';
    return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
};

const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

const createActionButtons = (item) => {
    const phoneRaw = (item.phone || '').replace(/\D/g, '');
    const whatsappHref = phoneRaw ? `https://wa.me/${phoneRaw}?text=${encodeURIComponent(`Hi, I’m interested in your '${item.title || 'item'}' listing on Campus Market.`)}` : '#';
    return `
        <div class="card-actions">
            <a href="tel:${item.phone}" class="call-btn">
                Call Seller
            </a>
            <a href="${whatsappHref}" target="_blank" rel="noreferrer" class="whatsapp-btn">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.672.149-.198.297-.767.966-.94 1.165-.173.198-.346.223-.643.074-.297-.149-1.255-.462-2.39-1.475-.883-.786-1.48-1.754-1.653-2.051-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.297-.497.099-.198.05-.372-.025-.521-.074-.148-.672-1.612-.92-2.207-.243-.579-.49-.5-.672-.51l-.573-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.625.712.226 1.36.194 1.872.118.571-.086 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.123-.272-.198-.57-.347zM12 2C6.477 2 2 6.477 2 12c0 1.863.615 3.575 1.663 4.956L2 22l5.154-1.653A9.939 9.939 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2z"/>
                </svg>
                WhatsApp
            </a>
        </div>
    `;
};

const buildCard = (doc) => {
    const item = doc.data();
    const imageSrc = (item.imageUrls && item.imageUrls.length > 0
        ? item.imageUrls[0]
        : item.imageUrl) || 'https://via.placeholder.com/400x220?text=No+image';
    const status = item.sold ? 'Sold' : 'Available';
    const statusClass = item.sold ? 'sold' : 'available';
    const dateCopy = formatDate(item.createdAt);
    const displayTitle = toTitleCase(item.title);

    return `
        <div class="card" data-doc-id="${doc.id}">
            <img src="${imageSrc}" loading="lazy" alt="${item.title || 'Listing'}">
            <div class="card-info">
                <div class="card-header">
                    <span class="price-tag">Rs. ${item.price}</span>
                    <span class="status-badge ${statusClass}">${status}</span>
                </div>
                <h3 class="title">${displayTitle}</h3>
                <p class="card-date">Posted on ${dateCopy}</p>
                ${createActionButtons(item)}
            </div>
        </div>
    `;
};

const showEmptyState = () => {
    feedEl.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 50px; color: #64748b;">No items found in this category.</p>';
};

const fetchBatch = async (reset = false) => {
    if (loading) return;
    loading = true;

    if (reset) {
        feedEl.innerHTML = '';
        lastVisible = null;
        exhausted = false;
    }

    if (!reset) {
        feedEl.appendChild(loaderEntry);
    } else {
        feedEl.innerHTML = '<p style="grid-column: 1/-1; text-align:center; padding: 32px; color: #64748b;">Loading listings...</p>';
    }

    const buildQuery = (cursor = null) => {
        const constraints = [];
        if (currentCategory !== "All") {
            constraints.push(where("category", "==", currentCategory));
        }
        constraints.push(orderBy("createdAt", "desc"));
        if (cursor) {
            constraints.push(startAfter(cursor));
        }
        constraints.push(limit(BATCH_SIZE));
        return query(collection(db, "listings"), ...constraints);
    };

    const q = buildQuery(lastVisible);

    try {
        const snapshot = await getDocs(q);

        loaderEntry.remove();

        if (reset) {
            feedEl.innerHTML = '';
        }

        if (snapshot.empty) {
            exhausted = true;
            if (reset) {
                showEmptyState();
            }
            loading = false;
            return;
        }

        snapshot.forEach((doc) => {
            feedEl.innerHTML += buildCard(doc);
        });

        lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (snapshot.size < BATCH_SIZE) {
            exhausted = true;
        }
    } catch (error) {
        console.error(error);
    } finally {
        loaderEntry.remove();
        loading = false;
    }
};

const handleScroll = () => {
    if (loading || exhausted) return;
    const scrollPosition = window.innerHeight + window.pageYOffset;
    const threshold = document.body.offsetHeight - 300;
    if (scrollPosition >= threshold) {
        fetchBatch();
    }
};

feedEl.addEventListener('click', (event) => {
    const card = event.target.closest('.card');
    if (!card) return;
    if (event.target.closest('.call-btn') || event.target.closest('.whatsapp-btn')) return;
    const docId = card.getAttribute('data-doc-id');
    if (docId) {
        window.open(`listing.html?id=${docId}`, '_blank');
    }
});

chips.forEach((chip) => {
    chip.addEventListener('click', () => {
        chips.forEach((currentChip) => currentChip.classList.remove('active'));
        chip.classList.add('active');
        currentCategory = chip.getAttribute('data-category');
        exhausted = false;
        lastVisible = null;
        fetchBatch(true);
    });
});

window.addEventListener('scroll', handleScroll);

fetchBatch(true);
