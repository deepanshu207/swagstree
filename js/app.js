// ==========================================
// SWAG STREE | CORE APPLICATION STATE
// ==========================================

// 1. CONFIGURATION
emailjs.init("k3l2JkCbjMs8WOAXg");
const firebaseConfig = { 
    apiKey: "AIzaSyAKXSFKuhQXMGvmtjh0CHnz48vbYz9a_4A", 
    authDomain: "swagstree-web.firebaseapp.com", 
    projectId: "swagstree-web" 
};
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
var auth = firebase.auth();
const CLOUD_NAME = "mysharecloud";
const PRESET = "swagstree_upload";

// 2. GLOBAL STATE
var products = [];
var cart = [];
var wishlist = [];
var currentUser = null;
var isAdmin = false;
var isSuperAdmin = false;
var assignedAdmins = [];
var productsPageLimitSetting = 20;
var editingId = null;

// UI State
var isRegMode = false;
var selectedSize = 'S';
var selectedColor = '';
var activeProductId = null;
var currentProductFiles = [];
var existingImageUrls = [];
var filterActiveSizes = [];
var filterActiveColors = [];
var filterActivePatterns = [];
var filterMinPrice = null;
var filterMaxPrice = null;
var priceAbsoluteMin = 0;
var priceAbsoluteMax = 10000;
var confirmationResult = null; // Used for SMS OTP fallback
var displayedProductsLimit = 20;
var displayedWishlistLimit = 20;
var displayedOrdersLimit = 20;
var ordersUnsubscribe = null;

// 3. UTILITIES
function showToast(m) { 
    const t = document.getElementById('toast'); 
    t.innerText = m; 
    t.style.display = 'block'; 
    setTimeout(() => t.style.display = 'none', 2000); 
}

function formatColorName(col) {
    if (!col) return '';
    const clean = col.trim().toLowerCase();
    const map = {
        '#000000': 'Black',
        '#ffffff': 'White',
        '#ff0000': 'Red',
        '#0000ff': 'Blue',
        '#00ff00': 'Green',
        '#ffff00': 'Yellow',
        '#932a2a': 'Maroon',
        '#808080': 'Grey',
        '#ffc0cb': 'Pink',
        '#ffa500': 'Orange',
        '#800080': 'Purple',
        '#a52a2a': 'Brown'
    };
    if (clean in map) return map[clean];
    if (col.startsWith('#')) return col.toUpperCase();
    return col.charAt(0).toUpperCase() + col.slice(1).toLowerCase();
}

function copyToClipboard(text) { 
    const dummy = document.createElement("input"); 
    document.body.appendChild(dummy); 
    dummy.value = text; 
    dummy.select(); 
    document.execCommand("copy"); 
    document.body.removeChild(dummy); 
    showToast("Link copied!"); 
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
}

// 4. NAVIGATION SYSTEM
function nav(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); 
    document.getElementById(id + '-view').classList.add('active'); 
    
    if (id === 'home' && new URLSearchParams(window.location.search).has('id')) {
        // Clear search params to exit product detail view mode cleanly without hard reloading page
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Close any open modals and detail overlays to ensure the main section is visible
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    const detailView = document.getElementById('detail-view');
    if (detailView) detailView.style.display = 'none';
    window.history.replaceState({}, '', window.location.pathname);
    
    // Sync active state between desktop and mobile nav
    const desktopNavs = document.querySelectorAll(`.desktop-nav .nav-item`);
    const bottomNavs = document.querySelectorAll(`.bottom-nav .nav-item`);
    
    desktopNavs.forEach(n => {
        const clickAttr = n.getAttribute('onclick') || '';
        if (clickAttr.includes(`'${id}'`)) n.classList.add('active');
    });
    bottomNavs.forEach(n => {
        const clickAttr = n.getAttribute('onclick') || '';
        if (clickAttr.includes(`'${id}'`)) n.classList.add('active');
    }); 

    // Reset wishlist page limit when navigating to wishlist
    if (id === 'wish') {
        displayedWishlistLimit = productsPageLimitSetting;
        if (typeof renderStore === 'function') renderStore();
    }

    // Render admin list on navigation to admin view
    if (id === 'admin') {
        renderAdmin();
        if (typeof loadCodSettings === 'function') loadCodSettings();
        if (typeof loadMaxQtySettings === 'function') loadMaxQtySettings();
        if (typeof loadPromoSettings === 'function') loadPromoSettings();
        if (typeof loadPaginationSettings === 'function') loadPaginationSettings();
    }
    if (id === 'super') {
        if (typeof loadSuperCustomers === 'function') loadSuperCustomers();
        if (typeof loadAssignedAdmins === 'function') loadAssignedAdmins();
    }
}

// Initialize on load
window.onload = () => { 
    const searchInput = document.getElementById('app_search');
    if(searchInput) { 
        searchInput.value = ""; 
        searchInput.setAttribute('readonly', 'true'); 
        setTimeout(() => { searchInput.value = ""; }, 500); 
    }

    // If a shared product link was opened, show loading overlay immediately
    // so the home screen never flashes before the product opens.
    const deepId = new URLSearchParams(window.location.search).get('id');
    if (deepId) {
        const overlay = document.getElementById('deep-link-overlay');
        if (overlay) overlay.style.display = 'flex';
    }
};
