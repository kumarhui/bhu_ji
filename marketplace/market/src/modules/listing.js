import { firebaseConfig } from '../api/config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const gallery = document.getElementById('gallery');
const titleEl = document.getElementById('listingTitle');
const priceEl = document.getElementById('listingPrice');
const dateEl = document.getElementById('listingDate');
const descEl = document.getElementById('listingDesc');
const categoryEl = document.getElementById('listingCategory');
const contactEl = document.getElementById('listingContact');
const actionsEl = document.getElementById('listingActions');
const statusBadge = document.getElementById('statusBadge');
const errorEl = document.getElementById('listingError');
let currentDocRef = null;
let currentDeletionCode = null;

const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

const buildGallery = (images = []) => {
    gallery.innerHTML = '';
    if (!images.length) {
        gallery.innerHTML = '<div class="listing-placeholder">No photos available</div>';
        return;
    }
    images.forEach((src) => {
        const thumb = document.createElement('div');
        thumb.className = 'listing-thumb';
        const img = document.createElement('img');
        img.src = src;
        img.alt = 'Listing image';
        thumb.appendChild(img);
        gallery.appendChild(thumb);
    });
};

const createActionLink = (href, label, className = '') => {
    const btn = document.createElement('a');
    btn.href = href;
    btn.target = '_blank';
    btn.rel = 'noreferrer';
    btn.textContent = label;
    btn.className = className;
    return btn;
};

const showError = (message) => {
    errorEl.hidden = false;
    errorEl.style.color = '#dc2626';
    errorEl.textContent = message;
};

const showSuccess = (message) => {
    errorEl.hidden = false;
    errorEl.style.color = '#059669';
    errorEl.textContent = message;
};

const toTitleCase = (value) => {
    if (!value) return 'Untitled';
    return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
};

const displayListing = (item) => {
    if (!item) {
        showError('Listing not found.');
        return;
    }

    titleEl.textContent = toTitleCase(item.title);
    priceEl.textContent = `₹ ${item.price || '0.00'}`;
    dateEl.textContent = `Posted on ${formatDate(item.createdAt)}`;
    descEl.textContent = item.description || 'No description provided.';
    categoryEl.textContent = `Category: ${item.category || 'Uncategorized'}`;
    contactEl.textContent = `Contact: ${item.phone || 'Not shared'}`;
    statusBadge.textContent = item.sold ? 'Sold' : 'Available';
    statusBadge.classList.remove('sold', 'available');
    statusBadge.classList.add(item.sold ? 'sold' : 'available');

    const imageSources = item.imageUrls && item.imageUrls.length ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
    buildGallery(imageSources);

    const phoneRaw = (item.phone || '').replace(/\D/g, '');
    if (phoneRaw) {
        actionsEl.appendChild(createActionLink(`tel:${item.phone}`, 'Call Seller', 'call-btn'));
        const waLink = `https://wa.me/${phoneRaw}?text=${encodeURIComponent(`Hi, I’m interested in your '${item.title || 'item'}' listing.`)}`;
        actionsEl.appendChild(createActionLink(waLink, 'WhatsApp', 'whatsapp-btn'));
    } else {
        showError('Contact number not available.');
    }

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = 'Delete Listing';
    deleteBtn.addEventListener('click', async () => {
        const code = prompt('Enter the 6-digit deletion code you received when posting this listing:');
        if (!code) return;
        if (!currentDeletionCode) {
            showError('Deletion code missing.');
            return;
        }
        if (code.trim() !== currentDeletionCode) {
            showError('Incorrect deletion code.');
            return;
        }
        if (!currentDocRef) {
            showError('Cannot delete listing right now.');
            return;
        }
        try {
            await deleteDoc(currentDocRef);
            showSuccess('Listing deleted. Redirecting to marketplace…');
            setTimeout(() => window.location.href = 'index1.html', 1000);
        } catch (error) {
            console.error(error);
            showError('Failed to delete the listing.');
        }
    });
    actionsEl.appendChild(deleteBtn);
};

const params = new URLSearchParams(window.location.search);
const listingId = params.get('id');

if (!listingId) {
    showError('No listing specified.');
} else {
    const listingRef = doc(db, 'listings', listingId);
    getDoc(listingRef).then((snapshot) => {
        if (!snapshot.exists()) {
            showError('Listing not found.');
            return;
        }
        currentDocRef = listingRef;
        currentDeletionCode = snapshot.data().deletionCode;
        displayListing(snapshot.data());
    }).catch((err) => {
        console.error(err);
        showError('Failed to load listing.');
    });
}
