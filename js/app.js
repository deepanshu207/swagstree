// ==========================================
// SWAG STREE | CORE APPLICATION STATE
// ==========================================

// 1. CONFIGURATION
const firebaseConfig = { 
    apiKey: "AIzaSyAKXSFKuhQXMGvmtjh0CHnz48vbYz9a_4A", 
    authDomain: "swagstree-web.firebaseapp.com", 
    projectId: "swagstree-web",
    storageBucket: "swagstree-web.appspot.com"
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
var ordersPageLimitSetting = 20;
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

// We map custom/common names to hex codes for the preview bubble,
// and also return friendly display names.
const customColorsMap = {
    // Greens
    'mehndi green': { hex: '#4b5320', name: 'Mehendi Green' }, // olive-drab/army green
    'mehndigreen': { hex: '#4b5320', name: 'Mehendi Green' },
    'mehendi green': { hex: '#4b5320', name: 'Mehendi Green' },
    'mehendigreen': { hex: '#4b5320', name: 'Mehendi Green' },
    'light green': { hex: '#90ee90', name: 'Light Green' },
    'lightgreen': { hex: '#90ee90', name: 'Light Green' },
    'dark green': { hex: '#006400', name: 'Dark Green' },
    'darkgreen': { hex: '#006400', name: 'Dark Green' },
    'olive green': { hex: '#556b2f', name: 'Olive Green' },
    'olivegreen': { hex: '#556b2f', name: 'Olive Green' },
    'mint green': { hex: '#98ff98', name: 'Mint Green' },
    'mintgreen': { hex: '#98ff98', name: 'Mint Green' },
    'sage green': { hex: '#87a96b', name: 'Sage Green' },
    'sagegreen': { hex: '#87a96b', name: 'Sage Green' },
    'rama green': { hex: '#008b8b', name: 'Rama Green' },
    'ramagreen': { hex: '#008b8b', name: 'Rama Green' },
    'bottle green': { hex: '#006a4e', name: 'Bottle Green' },
    'bottlegreen': { hex: '#006a4e', name: 'Bottle Green' },
    'sea green': { hex: '#2e8b57', name: 'Sea Green' },
    'seagreen': { hex: '#2e8b57', name: 'Sea Green' },
    'lime green': { hex: '#32cd32', name: 'Lime Green' },
    'limegreen': { hex: '#32cd32', name: 'Lime Green' },
    'army green': { hex: '#4b5320', name: 'Army Green' },
    'armygreen': { hex: '#4b5320', name: 'Army Green' },
    'pista green': { hex: '#93c572', name: 'Pista Green' },
    'pistagreen': { hex: '#93c572', name: 'Pista Green' },
    'emerald green': { hex: '#50c878', name: 'Emerald Green' },
    'emeraldgreen': { hex: '#50c878', name: 'Emerald Green' },
    'neon green': { hex: '#39ff14', name: 'Neon Green' },
    'neongreen': { hex: '#39ff14', name: 'Neon Green' },

    // Pinks
    'dusty pink': { hex: '#dcaebb', name: 'Dusty Pink' },
    'dustypink': { hex: '#dcaebb', name: 'Dusty Pink' },
    'rose dark pink': { hex: '#c21e56', name: 'Rose Dark Pink' },
    'rosedarkpink': { hex: '#c21e56', name: 'Rose Dark Pink' },
    'light pink': { hex: '#ffb6c1', name: 'Light Pink' },
    'lightpink': { hex: '#ffb6c1', name: 'Light Pink' },
    'dark pink': { hex: '#e75480', name: 'Dark Pink' },
    'darkpink': { hex: '#e75480', name: 'Dark Pink' },
    'pastel pink': { hex: '#ffd1dc', name: 'Pastel Pink' },
    'pastelpink': { hex: '#ffd1dc', name: 'Pastel Pink' },
    'baby pink': { hex: '#ffc0cb', name: 'Baby Pink' },
    'babypink': { hex: '#ffc0cb', name: 'Baby Pink' },
    'hot pink': { hex: '#ff69b4', name: 'Hot Pink' },
    'hotpink': { hex: '#ff69b4', name: 'Hot Pink' },
    'onion pink': { hex: '#dcaebb', name: 'Onion Pink' },
    'onionpink': { hex: '#dcaebb', name: 'Onion Pink' },
    'gajari': { hex: '#f08080', name: 'Gajari' },
    'blush pink': { hex: '#fe828c', name: 'Blush Pink' },
    'blushpink': { hex: '#fe828c', name: 'Blush Pink' },
    'fuchsia': { hex: '#ff00ff', name: 'Fuchsia' },

    // Oranges & Peaches
    'light orange': { hex: '#ffb347', name: 'Light Orange' },
    'lightorange': { hex: '#ffb347', name: 'Light Orange' },
    'dark orange': { hex: '#ff8c00', name: 'Dark Orange' },
    'darkorange': { hex: '#ff8c00', name: 'Dark Orange' },
    'peach': { hex: '#ffcba4', name: 'Peach' },
    'coral': { hex: '#ff7f50', name: 'Coral' },
    'rust': { hex: '#b7410e', name: 'Rust' },
    'apricot': { hex: '#fbceb1', name: 'Apricot' },
    'tangerine': { hex: '#f28500', name: 'Tangerine' },

    // Yellows
    'mustard yellow': { hex: '#e1ad01', name: 'Mustard Yellow' },
    'mustardyellow': { hex: '#e1ad01', name: 'Mustard Yellow' },
    'mustard': { hex: '#ffdb58', name: 'Mustard' },
    'light yellow': { hex: '#ffffe0', name: 'Light Yellow' },
    'lightyellow': { hex: '#ffffe0', name: 'Light Yellow' },
    'haldi yellow': { hex: '#e1ad01', name: 'Haldi Yellow' },
    'haldiyellow': { hex: '#e1ad01', name: 'Haldi Yellow' },
    'lemon yellow': { hex: '#fff700', name: 'Lemon Yellow' },
    'lemonyellow': { hex: '#fff700', name: 'Lemon Yellow' },
    'gold': { hex: '#ffd700', name: 'Gold' },
    'canary yellow': { hex: '#ffef00', name: 'Canary Yellow' },
    'canaryyellow': { hex: '#ffef00', name: 'Canary Yellow' },

    // Blues
    'navy blue': { hex: '#000080', name: 'Navy Blue' },
    'navyblue': { hex: '#000080', name: 'Navy Blue' },
    'light blue': { hex: '#add8e6', name: 'Light Blue' },
    'lightblue': { hex: '#add8e6', name: 'Light Blue' },
    'royal blue': { hex: '#4169e1', name: 'Royal Blue' },
    'royalblue': { hex: '#4169e1', name: 'Royal Blue' },
    'sky blue': { hex: '#87ceeb', name: 'Sky Blue' },
    'skyblue': { hex: '#87ceeb', name: 'Sky Blue' },
    'baby blue': { hex: '#89cff0', name: 'Baby Blue' },
    'babyblue': { hex: '#89cff0', name: 'Baby Blue' },
    'firozi': { hex: '#20b2aa', name: 'Firozi' },
    'turquoise': { hex: '#40e0d0', name: 'Turquoise' },
    'indigo': { hex: '#4b0082', name: 'Indigo' },
    'teal': { hex: '#008080', name: 'Teal' },
    'denim blue': { hex: '#1560bd', name: 'Denim Blue' },
    'denimblue': { hex: '#1560bd', name: 'Denim Blue' },
    'powder blue': { hex: '#b0e0e6', name: 'Powder Blue' },
    'powderblue': { hex: '#b0e0e6', name: 'Powder Blue' },

    // Reds, Purples & Browns
    'wine red': { hex: '#4e0f1d', name: 'Wine Red' },
    'winered': { hex: '#4e0f1d', name: 'Wine Red' },
    'wine': { hex: '#722f37', name: 'Wine' },
    'burgundy': { hex: '#800020', name: 'Burgundy' },
    'maroon': { hex: '#800000', name: 'Maroon' },
    'light purple': { hex: '#d8b2d1', name: 'Light Purple' },
    'lightpurple': { hex: '#d8b2d1', name: 'Light Purple' },
    'lavender': { hex: '#e6e6fa', name: 'Lavender' },
    'mauve': { hex: '#e0b0ff', name: 'Mauve' },
    'lilac': { hex: '#c8a2c8', name: 'Lilac' },
    'plum': { hex: '#dda0dd', name: 'Plum' },
    'magenta': { hex: '#ff00ff', name: 'Magenta' },
    'coffee': { hex: '#4b3621', name: 'Coffee' },
    'chocolate': { hex: '#7b3f00', name: 'Chocolate' },
    'tan': { hex: '#d2b48c', name: 'Tan' },
    'terracotta': { hex: '#e2725b', name: 'Terracotta' },
    'crimson': { hex: '#dc143c', name: 'Crimson' },
    'plum purple': { hex: '#8e4585', name: 'Plum Purple' },
    'plumpurple': { hex: '#8e4585', name: 'Plum Purple' },
    'rust orange': { hex: '#c04000', name: 'Rust Orange' },
    'rustorange': { hex: '#c04000', name: 'Rust Orange' },
    'rust red': { hex: '#a83232', name: 'Rust Red' },
    'rustred': { hex: '#a83232', name: 'Rust Red' },
    'brick red': { hex: '#cb4154', name: 'Brick Red' },
    'brickred': { hex: '#cb4154', name: 'Brick Red' },
    'mocha': { hex: '#967969', name: 'Mocha' },

    // Neutrals
    'cream': { hex: '#fffdd0', name: 'Cream' },
    'beige': { hex: '#f5f5dc', name: 'Beige' },
    'khaki': { hex: '#c3b091', name: 'Khaki' },
    'off white': { hex: '#faf0e6', name: 'Off White' },
    'offwhite': { hex: '#faf0e6', name: 'Off White' },
    'charcoal': { hex: '#36454f', name: 'Charcoal' },
    'charcoal grey': { hex: '#36454f', name: 'Charcoal Grey' },
    'charcoalgrey': { hex: '#36454f', name: 'Charcoal Grey' },
    'olive': { hex: '#808000', name: 'Olive' },
    'silver': { hex: '#c0c0c0', name: 'Silver' },
    'grey': { hex: '#808080', name: 'Grey' },
    'gray': { hex: '#808080', name: 'Grey' },
    'ivory': { hex: '#fffff0', name: 'Ivory' },
    'champagne': { hex: '#f7e7ce', name: 'Champagne' },
    'rose gold': { hex: '#b76e79', name: 'Rose Gold' },
    'rosegold': { hex: '#b76e79', name: 'Rose Gold' },
    'copper': { hex: '#b87333', name: 'Copper' },
    'bronze': { hex: '#cd7f32', name: 'Bronze' },
    'seafoam': { hex: '#9fe2bf', name: 'Seafoam' },
    'seafoam green': { hex: '#9fe2bf', name: 'Seafoam Green' },
    'seafoamgreen': { hex: '#9fe2bf', name: 'Seafoam Green' },
    'lavender mist': { hex: '#e6e6fa', name: 'Lavender Mist' },
    'lavendermist': { hex: '#e6e6fa', name: 'Lavender Mist' },
    'brick brown': { hex: '#8b5a2b', name: 'Brick Brown' },
    'brickbrown': { hex: '#8b5a2b', name: 'Brick Brown' },
    'peach puff': { hex: '#ffdab9', name: 'Peach Puff' },
    'peachpuff': { hex: '#ffdab9', name: 'Peach Puff' }
};
window.customColorsMap = customColorsMap;

function formatColorName(col) {
    if (!col) return '';
    const clean = col.trim().toLowerCase();
    const cleanNoSpaces = clean.replace(/\s+/g, '');
    
    // Check customColorsMap first
    if (customColorsMap[clean]) return customColorsMap[clean].name;
    if (customColorsMap[cleanNoSpaces]) return customColorsMap[cleanNoSpaces].name;

    const map = {
        '#4b5320': 'Mehendi Green',
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
window.formatColorName = formatColorName;

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
    // Refresh WhatsApp visibility when any modal closes
    if (typeof updateWhatsAppVisibility === 'function') updateWhatsAppVisibility();
}

// WhatsApp Floating Icon Visibility Controller
// Rules:
// - NEVER show on: product detail
// - Show on: filter slider, checkout modal (allowed)
// - Admin/Superadmin: show ONLY on home and wishlist tabs
// - Customer: show on home, wishlist, profile/orders tabs
function updateWhatsAppVisibility() {
    const btn = document.getElementById('whatsapp-float-btn');
    if (!btn) return;

    // 1. Hide if product detail overlay is open
    const detailView = document.getElementById('detail-view');
    if (detailView && (detailView.style.display === 'block' || detailView.classList.contains('active-detail-flex'))) {
        btn.classList.add('hidden-btn');
        return;
    }

    // 2. Determine which section/tab is currently active
    const activeSection = document.querySelector('.section.active');
    if (!activeSection) {
        btn.classList.add('hidden-btn');
        return;
    }
    const sectionId = activeSection.id; // e.g. 'home-view', 'wish-view', 'user-view', 'admin-view', 'super-view'

    // 3. Apply role-based rules
    if (isAdmin || isSuperAdmin) {
        // Admin/Superadmin: ONLY show on home and wishlist
        if (sectionId === 'home-view' || sectionId === 'wish-view') {
            btn.classList.remove('hidden-btn');
        } else {
            btn.classList.add('hidden-btn');
        }
    } else {
        // Customer: show on home, wishlist, profile/orders (user-view)
        if (sectionId === 'home-view' || sectionId === 'wish-view' || sectionId === 'user-view') {
            btn.classList.remove('hidden-btn');
        } else {
            btn.classList.add('hidden-btn');
        }
    }
}

// 4. NAVIGATION SYSTEM
function nav(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); 
    document.getElementById(id + '-view').classList.add('active'); 
    
    // Show footer always on Home and Wish views only if there is visible content enabled
    if (typeof renderFooter === 'function') {
        renderFooter();
    } else {
        const appFooter = document.getElementById('app-footer');
        if (appFooter) {
            const isLinksEnabled = window.footerSettings && !!window.footerSettings.showFooter;
            const isCopyrightEnabled = !window.footerSettings || window.footerSettings.showCopyright !== false;
            const hasVisibleContent = isLinksEnabled || isCopyrightEnabled;
            const shouldShow = hasVisibleContent && (id === 'home' || id === 'wish');
            
            appFooter.classList.toggle('hidden', !shouldShow);
            document.body.classList.toggle('footer-hidden', !shouldShow);
        }
    }
    if (id === 'home' && new URLSearchParams(window.location.search).has('id')) {
        // Clear search params to exit product detail view mode cleanly without hard reloading page
        window.history.replaceState({}, '', window.location.pathname);
    }

    // Close any open modals and detail overlays to ensure the main section is visible
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    const detailView = document.getElementById('detail-view');
    if (detailView) {
        detailView.style.display = 'none';
        detailView.classList.remove('active-detail-flex');
    }
    window.history.replaceState({}, '', window.location.pathname);
    
    // Sync active state between desktop and mobile nav strictly
    const desktopNavs = document.querySelectorAll(`.desktop-nav .nav-item`);
    const bottomNavs = document.querySelectorAll(`.bottom-nav .nav-item`);
    
    desktopNavs.forEach(n => {
        const clickAttr = n.getAttribute('onclick') || '';
        if (clickAttr.includes(`'${id}'`)) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
    });
    bottomNavs.forEach(n => {
        const clickAttr = n.getAttribute('onclick') || '';
        if (clickAttr.includes(`'${id}'`)) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
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
        if (typeof loadAdminFooterSettings === 'function') loadAdminFooterSettings();
        if (typeof refreshBrevoQuota === 'function') refreshBrevoQuota();
        if (typeof loadCommentsModeration === 'function') loadCommentsModeration();
    }
    if (id === 'super') {
        if (typeof loadSuperCustomers === 'function') loadSuperCustomers();
        if (typeof loadAssignedAdmins === 'function') loadAssignedAdmins();
        if (typeof loadSessionSettings === 'function') loadSessionSettings();
    }
    if (id === 'user') {
        if (typeof loadProfileAddresses === 'function') loadProfileAddresses();
        if (typeof refreshBrevoQuota === 'function') refreshBrevoQuota();
    }

    // Update WhatsApp floating icon visibility based on current tab and user role
    if (typeof updateWhatsAppVisibility === 'function') updateWhatsAppVisibility();
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

    // Real-time Sync of App Features Configuration
    if (typeof db !== 'undefined') {
        db.collection("settings").doc("features_config").onSnapshot(doc => {
            if (doc.exists) {
                window.APP_FEATURES = doc.data();
            } else {
                db.collection("settings").doc("features_config").set(window.APP_FEATURES).catch(e => console.log(e));
            }
            if (typeof window.applyFeatureTogglesUI === 'function') {
                window.applyFeatureTogglesUI();
            }
        }, err => {
            console.log("Firestore features listener error, using local defaults:", err);
            if (typeof window.applyFeatureTogglesUI === 'function') {
                window.applyFeatureTogglesUI();
            }
        });
    }
};
