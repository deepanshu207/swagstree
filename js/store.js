// ==========================================
// SWAG STREE | STORE & PRODUCT RENDERING
// ==========================================

// Global variables fallback definition to prevent browser cache mismatch crashes
if (typeof window.filterActiveColors === 'undefined') window.filterActiveColors = [];
if (typeof window.filterActiveSizes === 'undefined') window.filterActiveSizes = [];
if (typeof window.filterActivePatterns === 'undefined') window.filterActivePatterns = [];
if (typeof window.filterMinPrice === 'undefined') window.filterMinPrice = null;
if (typeof window.filterMaxPrice === 'undefined') window.filterMaxPrice = null;
if (typeof window.priceAbsoluteMin === 'undefined') window.priceAbsoluteMin = 0;
if (typeof window.priceAbsoluteMax === 'undefined') window.priceAbsoluteMax = 10000;
if (typeof window.selectedColor === 'undefined') window.selectedColor = '';
if (typeof window.activeProductId === 'undefined') window.activeProductId = null;
if (typeof window.isAdmin === 'undefined') window.isAdmin = false;
if (typeof window.products === 'undefined') window.products = [];
if (typeof window.productsLoaded === 'undefined') window.productsLoaded = false;

if (typeof window.productsPageLimitSetting === 'undefined') window.productsPageLimitSetting = 20;
if (typeof window.ordersPageLimitSetting === 'undefined') window.ordersPageLimitSetting = 20;
if (typeof window.customersPageLimitSetting === 'undefined') window.customersPageLimitSetting = 10;
if (typeof window.displayedProductsLimit === 'undefined') window.displayedProductsLimit = window.productsPageLimitSetting;
if (typeof window.displayedWishlistLimit === 'undefined') window.displayedWishlistLimit = window.productsPageLimitSetting;
if (typeof window.displayedOrdersLimit === 'undefined') window.displayedOrdersLimit = window.ordersPageLimitSetting;
if (typeof window.displayedAllCustomersLimit === 'undefined') window.displayedAllCustomersLimit = window.customersPageLimitSetting;
if (typeof window.ordersUnsubscribe === 'undefined') window.ordersUnsubscribe = null;
if (typeof window.deepLinkHandled === 'undefined') window.deepLinkHandled = false;

if (typeof formatColorName === 'undefined') {
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

    window.formatColorName = function (col) {
        if (!col) return '';
        const clean = col.trim().toLowerCase();
        const cleanNoSpaces = clean.replace(/\s+/g, '');

        // Check customColorsMap first
        if (customColorsMap[clean]) return customColorsMap[clean].name;
        if (customColorsMap[cleanNoSpaces]) return customColorsMap[cleanNoSpaces].name;

        // Hex → name map (100+ common colors)
        const hexMap = {
            '#4b5320': 'Mehndi Green',
            '#000000': 'Black', '#ffffff': 'White', '#ff0000': 'Red', '#0000ff': 'Blue',
            '#008000': 'Green', '#00ff00': 'Lime', '#ffff00': 'Yellow', '#ffa500': 'Orange',
            '#800080': 'Purple', '#ff00ff': 'Magenta', '#00ffff': 'Cyan', '#008080': 'Teal',
            '#808080': 'Grey', '#c0c0c0': 'Silver', '#ffc0cb': 'Pink', '#a52a2a': 'Brown',
            '#800000': 'Maroon', '#932a2a': 'Maroon', '#000080': 'Navy', '#191970': 'Midnight Blue',
            '#4169e1': 'Royal Blue', '#1e90ff': 'Dodger Blue', '#00bfff': 'Deep Sky Blue',
            '#87ceeb': 'Sky Blue', '#87cefa': 'Light Sky Blue', '#add8e6': 'Light Blue',
            '#b0c4de': 'Light Steel Blue', '#6495ed': 'Cornflower Blue', '#4682b4': 'Steel Blue',
            '#5f9ea0': 'Cadet Blue', '#00ced1': 'Dark Turquoise', '#40e0d0': 'Turquoise',
            '#48d1cc': 'Medium Turquoise', '#afeeee': 'Pale Turquoise', '#e0ffff': 'Light Cyan',
            '#7fffd4': 'Aquamarine', '#66cdaa': 'Medium Aquamarine', '#20b2aa': 'Light Sea Green',
            '#3cb371': 'Medium Sea Green', '#2e8b57': 'Sea Green', '#006400': 'Dark Green',
            '#228b22': 'Forest Green', '#32cd32': 'Lime Green', '#90ee90': 'Light Green',
            '#98fb98': 'Pale Green', '#8fbc8f': 'Dark Sea Green', '#9acd32': 'Yellow Green',
            '#6b8e23': 'Olive Drab', '#808000': 'Olive', '#556b2f': 'Dark Olive Green',
            '#00ff7f': 'Spring Green', '#00fa9a': 'Medium Spring Green', '#7cfc00': 'Lawn Green',
            '#adff2f': 'Green Yellow', '#ffd700': 'Gold', '#daa520': 'Goldenrod',
            '#b8860b': 'Dark Goldenrod', '#f0e68c': 'Khaki', '#eee8aa': 'Pale Goldenrod',
            '#bdb76b': 'Dark Khaki', '#ff8c00': 'Dark Orange', '#ff6347': 'Tomato',
            '#ff4500': 'Orange Red', '#ff7f50': 'Coral', '#ffa07a': 'Light Salmon',
            '#fa8072': 'Salmon', '#e9967a': 'Dark Salmon', '#f08080': 'Light Coral',
            '#cd5c5c': 'Indian Red', '#dc143c': 'Crimson', '#b22222': 'Firebrick',
            '#8b0000': 'Dark Red', '#ff69b4': 'Hot Pink', '#ff1493': 'Deep Pink',
            '#db7093': 'Pale Violet Red', '#c71585': 'Medium Violet Red',
            '#ba55d3': 'Medium Orchid', '#da70d6': 'Orchid', '#ee82ee': 'Violet',
            '#dda0dd': 'Plum', '#d8bfd8': 'Thistle', '#e6e6fa': 'Lavender',
            '#9370db': 'Medium Purple', '#8a2be2': 'Blue Violet', '#9400d3': 'Dark Violet',
            '#4b0082': 'Indigo', '#6a5acd': 'Slate Blue', '#483d8b': 'Dark Slate Blue',
            '#7b68ee': 'Medium Slate Blue', '#d2b48c': 'Tan', '#bc8f8f': 'Rosy Brown',
            '#f4a460': 'Sandy Brown', '#d2691e': 'Chocolate', '#a0522d': 'Sienna',
            '#8b4513': 'Saddle Brown', '#cd853f': 'Peru', '#deb887': 'Burly Wood',
            '#ffe4c4': 'Bisque', '#ffdead': 'Navajo White', '#f5deb3': 'Wheat',
            '#faebd7': 'Antique White', '#fffaf0': 'Floral White', '#f5f5dc': 'Beige',
            '#fff8dc': 'Cornsilk', '#fffacd': 'Lemon Chiffon', '#fffff0': 'Ivory',
            '#f0fff0': 'Honeydew', '#f5fffa': 'Mint Cream', '#f0f8ff': 'Alice Blue',
            '#fff0f5': 'Lavender Blush', '#fff5ee': 'Seashell', '#f8f8ff': 'Ghost White',
            '#d3d3d3': 'Light Grey', '#a9a9a9': 'Dark Grey', '#696969': 'Dim Grey',
            '#778899': 'Light Slate Grey', '#708090': 'Slate Grey', '#2f4f4f': 'Dark Slate Grey',
        };
        if (clean in hexMap) return hexMap[clean];
        if (clean.startsWith('#')) return col.trim().toUpperCase(); // Unknown hex → show hex
        // Named color → capitalize each word
        return col.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    };

    // Export customColorsMap helper for cleanColor resolution in renderDetailColors
    window.customColorsMap = customColorsMap;
}

// ── Deep Link Handler ────────────────────────────────────────────────────────
// Called once after products first load. Reads ?id= from the URL and opens
// the matching product. The black overlay (shown since page load) hides first
// so there is zero home-screen flash. URL is kept intact in the address bar.
function checkDeepLink() {
    if (deepLinkHandled) return;
    deepLinkHandled = true;

    const overlay = document.getElementById('deep-link-overlay');

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const color = params.get('color');
    const size = params.get('size');

    if (!id) {
        if (overlay) overlay.style.display = 'none';
        return;
    }

    const p = products.find(x => x.id === id);
    if (!p) {
        if (overlay) overlay.style.display = 'none';
        showToast('Product not found.');
        return;
    }

    // Hide overlay then open product — no flash, URL stays as share link
    if (overlay) overlay.style.display = 'none';
    showDetail(id, color, size);
}

function updateDetailURL() {
    if (activeProductId) {
        const params = new URLSearchParams(window.location.search);
        params.set('id', activeProductId);
        if (selectedColor) params.set('color', selectedColor);
        else params.delete('color');
        if (selectedSize && selectedSize !== 'Standard') params.set('size', selectedSize);
        else params.delete('size');
        window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
}

// 1. DATA LOADING
function loadData() {
    if (typeof startFeaturesConfigListener === 'function') startFeaturesConfigListener();

    db.collection("products").onSnapshot(snap => {
        products = snap.docs.map(doc => {
            const p = { ...doc.data(), id: doc.id };
            p.normalizedVariants = normalizeVariants(p);
            return p;
        });
        window.productsLoaded = true;
        renderStore();
        renderFilters();
        if (typeof refreshAiChatProductCards === 'function') refreshAiChatProductCards();
        if (typeof renderAdmin === "function") renderAdmin();
        checkDeepLink(); // open shared product link if present
        
        // Refresh cart contents and badge to reflect any stock updates
        if (typeof updateCartUI === 'function') updateCartUI();
        if (typeof openCart === 'function') {
            const cartModal = document.getElementById('cart-modal');
            if (cartModal && cartModal.style.display === 'flex') {
                openCart();
            }
        }
    }, error => {
        console.error("Firestore products onSnapshot error:", error);
    });

    db.collection("feedbacks").orderBy("timestamp", "desc").onSnapshot(snap => {
        window.feedbacks = snap.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        renderFeedbacks();
        if (typeof renderAdminFeedbackList === "function") renderAdminFeedbackList();
    }, error => {
        console.error("Firestore feedbacks error:", error);
    });

    db.collection("settings").doc("diaries").onSnapshot(snap => {
        window.diariesSettings = snap.exists ? snap.data() : { placement: 'last', n: 6, showSection: true };
        if (window.productsLoaded) {
            renderStore();
            renderFeedbacks();
        }
    });

    db.collection("settings").doc("footer").onSnapshot(snap => {
        window.footerSettings = snap.exists ? snap.data() : {
            showFooter: false,
            footerTemplate: 'classic',
            footerLayout: 'auto',
            copyright: "Swagstree",
            aboutText: `<h3>Who We Are</h3><p>Swag Stree is a premier fashion brand dedicated to delivering trendsetting, high-quality, and comfortable apparel directly to your doorstep. We merge modern styles with premium craftsmanship to create garments that make you look and feel confident.</p><h3>Our Commitment</h3><p>We are driven by three core pillars:</p><ul><li><b>Premium Fabrics:</b> Handpicked materials for maximum durability and comfort.</li><li><b>Exquisite Tailoring:</b> Designed for perfect fits and elegant silhouettes.</li><li><b>Customer First:</b> Quick delivery, seamless returns, and dedicated support.</li></ul>`,
            showGps: true,
            gpsLat: "28.6139",
            gpsLng: "77.2090",
            contactPhone: "8800467686"
        };
        if (typeof renderFooter === 'function') renderFooter();
    });

    db.collection("announcements").orderBy("timestamp", "desc").onSnapshot(snap => {
        window.activeAnnouncements = [];
        snap.forEach(doc => {
            window.activeAnnouncements.push({
                id: doc.id,
                ...doc.data()
            });
        });
        window._announcementsHydrated = true;
        if (typeof syncCatalogControlsReady === 'function') syncCatalogControlsReady();
        if (typeof updateAnnouncementBellUI === 'function') updateAnnouncementBellUI();
    }, error => {
        console.error("Firestore announcements list load error:", error);
        window.activeAnnouncements = window.activeAnnouncements || [];
        window._announcementsHydrated = true;
        if (typeof syncCatalogControlsReady === 'function') syncCatalogControlsReady();
    });
}

function renderStore() {
    renderProducts(products, 'product-grid');
    
    const wishSortEl = document.getElementById('wish-sort-logic');
    const sort = wishSortEl ? wishSortEl.value : 'none';
    let wishProducts = products.filter(p => wishlist.includes(p.id));

    const wishSearchEl = document.getElementById('wish_search');
    const wishQ = wishSearchEl ? wishSearchEl.value.trim().toLowerCase() : '';
    if (wishQ) {
        wishProducts = wishProducts.filter(p => (p.name || '').toLowerCase().includes(wishQ));
    }
    
    if (sort === 'low') wishProducts.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    if (sort === 'high') wishProducts.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    if (sort === 'newest') {
        wishProducts.sort((a, b) => {
            const timeA = getProductTimestamp(a);
            const timeB = getProductTimestamp(b);
            if (timeA !== timeB) return timeB - timeA;
            return b.id.localeCompare(a.id);
        });
    }
    if (sort === 'best') {
        wishProducts.sort((a, b) => {
            const salesA = a.salesCount || (a.popularity || (a.name.length % 5) * 12);
            const salesB = b.salesCount || (b.popularity || (b.name.length % 5) * 12);
            if (salesA !== salesB) return salesB - salesA;
            return a.name.localeCompare(b.name);
        });
    }
    
    renderProducts(wishProducts, 'wish-grid');
    if (typeof window.initHeroCarousel === 'function') window.initHeroCarousel();
}

// 2. RENDERING LOGIC
function productCardHtml(p) {
    const isFav = wishlist.includes(p.id);

    const activeVariants = p.variants && Array.isArray(p.variants) ? p.variants.filter(v => v.isActive !== false) : [];

    // Home Page Image Visibility Logic
    let displayImages = [];
    if (!p.hideMainCarousel) {
        displayImages = [...(p.images || [])];
    }

    // Add images from variants that opted-in to the home screen
    activeVariants.filter(v => v.showInMainCarousel).forEach(v => {
        if (v.images) displayImages = [...displayImages, ...v.images];
    });

    // Remove duplicates and empty strings
    displayImages = [...new Set(displayImages)].filter(img => img && img.trim() !== '');

    // Fallback if absolutely empty
    if (displayImages.length === 0 && activeVariants.length > 0 && !p.hideNoImagePlaceholder) {
        const vWithImg = activeVariants.find(v => v.images && v.images.length > 0);
        if (vWithImg) displayImages = vWithImg.images;
    }

    // If they strictly want to hide placeholder when hiding main carousel and there's no images
    if (p.hideMainCarousel && p.hideNoImagePlaceholder) {
        displayImages = [];
    }

    let isOutOfStock = false;
    if (activeVariants.length > 0) {
        const trackingVariants = activeVariants.filter(v => v.trackStock);
        if (trackingVariants.length > 0 && trackingVariants.every(v => (v.stockCount || 0) <= 0)) {
            isOutOfStock = true;
        }
    }

    const is360Enabled = !!(window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer);
    const has360 = is360Enabled && (!!p.is360 || (p.normalizedVariants && p.normalizedVariants.some(v => v.isActive !== false && v.is360)));

    let quickAddHtml = `<div class="quick-add" onclick="event.stopPropagation(); addToBag('${p.id}')" style="${isOutOfStock ? 'opacity:0.5; pointer-events:none;' : ''}">
        <i class="fa ${isOutOfStock ? 'fa-ban' : 'fa-plus'}"></i>
    </div>`;

    return `
    <div class="card"> 
        <div class="wish-btn ${isFav ? 'active' : ''}" onclick="event.stopPropagation(); toggleWish('${p.id}')">
            <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
        </div> 
        <div class="share-btn" onclick="event.stopPropagation(); shareProduct('${p.id}')">
            <i class="fa fa-share-alt"></i>
        </div> 
        ${quickAddHtml}
        <div class="carousel-box" onclick="showDetail('${p.id}')"> 
            ${has360 ? `
            <div style="position: absolute; top: 10px; left: 50%; transform: translateX(-50%); z-index: 100; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); border: 1px solid var(--gold); border-radius: 20px; padding: 3px 8px; color: var(--gold); font-size: 8px; font-weight: 800; display: flex; align-items: center; gap: 4px; pointer-events: none; letter-spacing: 0.5px; box-shadow: 0 4px 10px rgba(0,0,0,0.5);">
                <i class="fa fa-sync" style="font-size: 8px;"></i> 360° VIEW
            </div>
            ` : ''}
            ${isOutOfStock ? '<div style="position:absolute; inset:0; background:rgba(0,0,0,0.5); z-index:5; display:flex; align-items:center; justify-content:center; border-radius:15px 15px 0 0;"><span style="background:rgba(255,0,0,0.85); color:#fff; padding:6px 12px; border-radius:4px; font-weight:800; font-size:12px; letter-spacing:1px;">OUT OF STOCK</span></div>' : ''}
            <div class="carousel" onscroll="updateDots(this)">
                ${displayImages.length ? displayImages.map(img => `<img src="${img}" loading="lazy">`).join('') : (p.hideNoImagePlaceholder ? '' : '<img src="https://placehold.co/400x400/222/FFF?text=No+Image" loading="lazy">')}
            </div> 
            <div class="indicators">
                ${displayImages.length > 1 ? displayImages.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('') : ''}
            </div> 
        </div> 
        <div style="padding:12px" onclick="showDetail('${p.id}')"> 
            <div style="font-size:12px; font-weight:600; color:#ccc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${p.name}</div> 
            <div style="color:var(--gold); font-weight:800; margin-top:4px">₹${p.price}</div> 
        </div> 
    </div>`;
}

let infiniteScrollObserver = null;
let isLoadingMore = false;

function setupInfiniteScrollObserver() {
    if (infiniteScrollObserver) {
        infiniteScrollObserver.disconnect();
    }

    infiniteScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoadingMore) {
                const target = entry.target.getAttribute('data-target');
                isLoadingMore = true;

                setTimeout(() => {
                    if (target === 'products') {
                        loadMoreProducts();
                    } else if (target === 'wishlist') {
                        loadMoreWishlist();
                    }
                    isLoadingMore = false;
                }, 300);
            }
        });
    }, {
        rootMargin: '100px',
        threshold: 0.1
    });

    document.querySelectorAll('.infinite-scroll-loader').forEach(el => {
        infiniteScrollObserver.observe(el);
    });
}

function isProductOutOfStock(p) {
    const activeVariants = p.variants && Array.isArray(p.variants) ? p.variants.filter(v => v.isActive !== false) : [];
    if (activeVariants.length > 0) {
        const trackingVariants = activeVariants.filter(v => v.trackStock);
        if (trackingVariants.length > 0 && trackingVariants.every(v => (v.stockCount || 0) <= 0)) {
            return true;
        }
    }
    return false;
}
window.isProductOutOfStock = isProductOutOfStock;

function formatCatalogProductCount(visible, total, variant) {
    const v = Number(visible) || 0;
    const t = Number(total) || 0;
    const useShort = variant === 'short';
    if (typeof window.getI18nText === 'function') {
        return useShort
            ? window.getI18nText('showing_products_short', { visible: v, total: t })
            : window.getI18nText('showing_products', { visible: v, total: t });
    }
    return useShort
        ? `Showing ${v} of ${t} Pro...`
        : `Showing ${v} of ${t} Products`;
}

function escapeCatalogCountHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function emphasizeCatalogCountText(text) {
    return String(text).split(/(\d+)/).map((part) => {
        if (/^\d+$/.test(part)) {
            return `<span class="catalog-count-num">${part}</span>`;
        }
        if (!part) return '';
        return `<span class="catalog-count-word">${escapeCatalogCountHtml(part)}</span>`;
    }).join('');
}

function renderCatalogCountMarkup(visible, total, variant) {
    const text = formatCatalogProductCount(visible, total, variant);
    const icon = '<i class="fa fa-layer-group catalog-count-icon" aria-hidden="true"></i>';
    return icon + `<span class="catalog-count-text">${emphasizeCatalogCountText(text)}</span>`;
}

function applyCatalogCountLabel(el, visible, total) {
    if (!el) return;
    el.dataset.visible = String(visible);
    el.dataset.total = String(total);
    const plainText = formatCatalogProductCount(visible, total, 'full');
    el.innerHTML = renderCatalogCountMarkup(visible, total, 'full');
    el.setAttribute('aria-label', plainText);
    el.style.display = 'inline-flex';

    requestAnimationFrame(() => {
        if (!el.isConnected) return;
        if (el.scrollWidth > el.clientWidth + 2) {
            const shortText = formatCatalogProductCount(visible, total, 'short');
            el.innerHTML = renderCatalogCountMarkup(visible, total, 'short');
            el.setAttribute('aria-label', shortText);
        }
    });
}

window.refreshCatalogCountLabels = function() {
    const productCount = document.getElementById('product-count');
    const wishCount = document.getElementById('wish-count');
    if (productCount && productCount.style.display !== 'none' && productCount.dataset.visible != null) {
        applyCatalogCountLabel(
            productCount,
            Number(productCount.dataset.visible),
            Number(productCount.dataset.total)
        );
    }
    if (wishCount && wishCount.style.display !== 'none' && wishCount.dataset.visible != null) {
        applyCatalogCountLabel(
            wishCount,
            Number(wishCount.dataset.visible),
            Number(wishCount.dataset.total)
        );
    }
};

function renderProducts(items, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;

    // Filter out completely out-of-stock products for storefront and wishlist
    items = items.filter(p => !isProductOutOfStock(p));

    if (targetId === 'product-grid') {
        const loadMoreBtnContainer = document.getElementById('load-more-container');
        const countContainer = document.getElementById('product-count');
        const sortLogicContainer = document.getElementById('sort-logic-container');

        if (items.length === 0 && !window.productsLoaded) {
            if (countContainer) countContainer.style.display = 'none';
            if (sortLogicContainer) sortLogicContainer.style.display = 'none';
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            container.innerHTML = `
                <div class="premium-loader-container">
                    <div class="premium-loader"></div>
                    <p style="color:#aaa; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin:0; font-weight:700;">Loading Products</p>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-media"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                    </div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-media"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                    </div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-media"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                    </div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-media"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                    </div>
                </div>
            `;
            return;
        }

        if (items.length === 0) {
            container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#555;">No products found.</p>`;
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            if (countContainer) {
                applyCatalogCountLabel(countContainer, 0, 0);
            }
            if (sortLogicContainer) sortLogicContainer.style.display = 'none';
            return;
        }

        let itemsToRender = items;
        if (items.length > displayedProductsLimit) {
            itemsToRender = items.slice(0, displayedProductsLimit);
            if (loadMoreBtnContainer) {
                loadMoreBtnContainer.innerHTML = `
                <div class="infinite-scroll-loader" data-target="products" style="display:flex; justify-content:center; align-items:center; padding: 20px 0; gap: 8px; width: 100%;">
                    <div class="premium-loader" style="width:24px; height:24px; border-width:2.5px;"></div>
                    <span style="font-size:11px; color:#aaa; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Loading More...</span>
                </div>`;
            }
        } else {
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
        }

        if (countContainer) {
            const visible = Math.min(items.length, displayedProductsLimit);
            applyCatalogCountLabel(countContainer, visible, items.length);
        }
        if (sortLogicContainer) {
            const showSort = typeof isCatalogControlEnabled === 'function'
                ? isCatalogControlEnabled('home', 'sort')
                : true;
            sortLogicContainer.style.display = showSort ? 'flex' : 'none';
        }

        const settings = window.diariesSettings || { placement: 'last', showSection: true };
        const feedbackCards = (typeof getFeedbackCardsHtml === 'function' && settings.showSection !== false) ? getFeedbackCardsHtml() : [];

        function getDiariesSectionHtml(cards) {
            if (!cards || cards.length === 0) return '';
            const sectionTitle = settings.sectionTitle || '✨ CUSTOMER DIARIES';
            const sectionSubtitle = settings.sectionSubtitle || 'See how our Swag Fam is styling Swag Stree! Tag us on Instagram to get featured.';
            return `
            <div class="feedback-section-container-in-grid" style="grid-column: 1 / -1; margin-top:20px; margin-bottom:0; padding-top:20px; border-top:1px solid #222; width: 100%;">
                <div style="padding:0 15px; margin-bottom:15px; text-align:center;">
                    <h3 style="margin:0; font-size:18px; color:var(--gold); letter-spacing:1px; text-transform:uppercase; font-weight:900;">${sectionTitle}</h3>
                    <p style="margin:5px 0 0 0; font-size:12px; color:#777;">${sectionSubtitle}</p>
                </div>
                <div class="feedback-grid" style="padding:0;">${cards.join('')}</div>
            </div>`;
        }

        let finalHtml = '';
        if (settings.placement === 'first') {
            finalHtml = getDiariesSectionHtml(feedbackCards) + itemsToRender.map(productCardHtml).join('');
        } else if (settings.placement === 'last') {
            finalHtml = itemsToRender.map(productCardHtml).join('') + getDiariesSectionHtml(feedbackCards);
        } else if (settings.placement === 'custom') {
            const n = settings.n || 6;
            const pCards = itemsToRender.map(productCardHtml);
            let combined = [];

            for (let i = 0; i < pCards.length; i++) {
                combined.push(pCards[i]);
                if ((i + 1) % n === 0 && i !== pCards.length - 1) {
                    combined.push(getDiariesSectionHtml(feedbackCards));
                }
            }
            if (pCards.length > 0 && !combined.includes(getDiariesSectionHtml(feedbackCards))) {
                combined.push(getDiariesSectionHtml(feedbackCards));
            }
            finalHtml = combined.join('');
        } else {
            finalHtml = itemsToRender.map(productCardHtml).join('');
        }

        container.innerHTML = finalHtml;
    } else if (targetId === 'wish-grid') {
        const loadMoreBtnContainer = document.getElementById('wish-load-more-container');
        const countContainer = document.getElementById('wish-count');
        const sortLogicContainer = document.getElementById('wish-sort-logic-container');

        if (items.length === 0 && !window.productsLoaded) {
            if (countContainer) countContainer.style.display = 'none';
            if (sortLogicContainer) sortLogicContainer.style.display = 'none';
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            container.innerHTML = `
                <div class="premium-loader-container">
                    <div class="premium-loader"></div>
                    <p style="color:#aaa; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin:0; font-weight:700;">Loading Wishlist</p>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-media"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                    </div>
                </div>
                <div class="skeleton-card">
                    <div class="skeleton-media"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-price"></div>
                    </div>
                </div>
            `;
            return;
        }

        if (items.length === 0) {
            container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#555;">No products in wishlist yet.</p>`;
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            if (countContainer) {
                applyCatalogCountLabel(countContainer, 0, 0);
            }
            if (sortLogicContainer) sortLogicContainer.style.display = 'none';
            return;
        }

        let itemsToRender = items;
        if (items.length > displayedWishlistLimit) {
            itemsToRender = items.slice(0, displayedWishlistLimit);
            if (loadMoreBtnContainer) {
                loadMoreBtnContainer.innerHTML = `
                <div class="infinite-scroll-loader" data-target="wishlist" style="display:flex; justify-content:center; align-items:center; padding: 20px 0; gap: 8px; width: 100%;">
                     <div class="premium-loader" style="width:24px; height:24px; border-width:2.5px;"></div>
                     <span style="font-size:11px; color:#aaa; font-weight:700; letter-spacing:1px; text-transform:uppercase;">Loading More...</span>
                </div>`;
            }
        } else {
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
        }

        if (countContainer) {
            const visible = Math.min(items.length, displayedWishlistLimit);
            applyCatalogCountLabel(countContainer, visible, items.length);
        }
        if (sortLogicContainer) {
            const showSort = typeof isCatalogControlEnabled === 'function'
                ? isCatalogControlEnabled('wishlist', 'sort')
                : true;
            sortLogicContainer.style.display = showSort ? 'flex' : 'none';
        }

        container.innerHTML = itemsToRender.map(productCardHtml).join('');
    } else {
        if (items.length === 0) {
            container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#555;">No products found.</p>`;
            return;
        }
        container.innerHTML = items.map(productCardHtml).join('');
    }

    setupInfiniteScrollObserver();

    if (targetId === 'product-grid' || targetId === 'wish-grid') {
        requestAnimationFrame(() => {
            if (typeof syncStorefrontFooterMount === 'function') {
                syncStorefrontFooterMount(targetId);
            }
        });
    }

    if ((targetId === 'product-grid' || targetId === 'wish-grid') && typeof updateCatalogControlsRowLayout === 'function') {
        updateCatalogControlsRowLayout();
    }
    if ((targetId === 'product-grid' || targetId === 'wish-grid') && typeof syncCatalogControlsReady === 'function') {
        syncCatalogControlsReady();
    }
}

// 3. PRODUCT DETAILS
function normalizeVariants(p) {
    if (p.variants && Array.isArray(p.variants) && p.variants.length > 0) {
        const normalized = [];
        let fallbackIndex = 1;
        p.variants.filter(v => v.isActive !== false).forEach(v => {
            const sizeValues = v.size ? v.size.split(',').map(s => s.trim()).filter(s => s) : ['Standard'];
            const colorValues = v.color ? v.color.split(',').map(c => c.trim()).filter(c => c) : [''];
            const colorNameValues = v.colorName ? v.colorName.split(',').map(c => c.trim()) : [];
            let patternValues = v.pattern ? v.pattern.split(',').map(p => p.trim()).filter(p => p) : [''];
            const patternNameValues = v.patternName ? v.patternName.split(',').map(p => p.trim()) : [];
            const showPatternText = !!v.showPatternText;

            if (v.previewImages && v.previewImages.length > 0) {
                const imgCount = v.previewImages.length;
                const newPatternValues = [];
                for (let i = 0; i < imgCount; i++) {
                    let patVal = patternValues[i] || '';
                    if (!patVal || patVal === '') {
                        const baseName = (patternValues.length > 0 && patternValues[0] !== '') ? patternValues[0] : 'Design';
                        patVal = `${baseName} ${i + 1}`;
                    }
                    newPatternValues.push(patVal);
                }
                patternValues = newPatternValues;
            } else if (patternValues.length === 1 && patternValues[0] === '' && (v.previewImage || v.existingPreviewImage)) {
                patternValues = ['Design 1'];
            }

            sizeValues.forEach(sz => {
                colorValues.forEach((col, colIdx) => {
                    patternValues.forEach((pat, patIdx) => {
                        let finalPatternName = pat;
                        let patPreviewUrl = '';
                        let finalColorName = colorNameValues[colIdx] || col;
                        // patternDisplayName: custom text override (like colorName for colors)
                        const patternDisplayName = patternNameValues[patIdx] || '';
                        if (v.previewImages && v.previewImages.length > 0) {
                            patPreviewUrl = v.previewImages[patIdx] || v.previewImages[0] || '';
                        } else if (v.previewImage || v.existingPreviewImage) {
                            patPreviewUrl = v.previewImage || v.existingPreviewImage;
                        }

                        if (!finalPatternName && patPreviewUrl) {
                            finalPatternName = `Design-${fallbackIndex++}`;
                        }

                        normalized.push({
                            ...v,
                            size: sz,
                            color: col,
                            colorName: finalColorName,
                            pattern: finalPatternName,
                            patternDisplayName: patternDisplayName,
                            showPatternText: showPatternText,
                            previewImage: patPreviewUrl
                        });
                    });
                });
            });
        });
        return normalized;
    }
    const variants = [];
    const sizes = p.sizes || [];
    const map = p.sizeColorMap || {};
    if (sizes.length === 0) return [];
    sizes.forEach(sz => {
        const colors = map[sz] || [];
        if (colors.length > 0) {
            colors.forEach(col => {
                variants.push({ size: sz, color: col, pattern: '', price: null, images: [] });
            });
        } else {
            variants.push({ size: sz, color: '', pattern: '', price: null, images: [] });
        }
    });
    return variants;
}

function getSelectedVariant(p) {
    if (!p || !p.normalizedVariants) return null;
    let match = p.normalizedVariants.find(v => v.size === selectedSize && v.color === selectedColor && v.pattern === (window.selectedPattern || ''));
    if (!match) match = p.normalizedVariants.find(v => v.size === selectedSize && v.color === selectedColor);
    if (!match) match = p.normalizedVariants.find(v => v.size === selectedSize);
    return match;
}

function showDetail(id, initialColor = null, initialSize = null) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    activeProductId = id;
    p.normalizedVariants = normalizeVariants(p);

    document.getElementById('det-name').innerText = p.name;
    document.getElementById('det-desc').innerText = p.description || "Premium Quality.";

    // Set up sizes
    const uniqueSizes = [...new Set(p.normalizedVariants.map(v => v.size))];
    const sizeSelector = document.getElementById('detail-size-selector');
    const sizesContainer = document.getElementById('det-sizes-container');

    if (uniqueSizes.length === 0 || (uniqueSizes.length === 1 && uniqueSizes[0] === 'Standard')) {
        sizesContainer.style.display = 'none';
        selectedSize = 'Standard';
        if (uniqueSizes.length === 0) selectedColor = '';
    } else {
        sizesContainer.style.display = 'block';
        if (initialSize && uniqueSizes.includes(initialSize)) {
            selectedSize = initialSize;
        } else {
            selectedSize = uniqueSizes[0];
        }

        sizeSelector.innerHTML = uniqueSizes.map(sz => `
            <div class="size-chip ${sz === selectedSize ? 'active' : ''}" onclick="selectDetailSize('${sz}', this)">${sz === 'Standard' ? 'Free Size' : sz}</div>
        `).join('');
    }

    renderDetailColors(p, initialColor);
    renderDetailPatterns(p);
    updateVariantUI(p);
    updateDetailURL();

    // Check if 360 viewer is enabled and product has multiple images
    const trigger360 = document.getElementById('det-360-trigger');
    if (trigger360) {
        const active360Img = window.getActive360Images(p);
        if (active360Img) {
            trigger360.style.display = 'flex';
        } else {
            trigger360.style.display = 'none';
        }
    }

    const detView = document.getElementById('detail-view');
    detView.style.display = 'block';
    detView.classList.add('active-detail-flex');

    if (typeof loadProductComments === 'function') loadProductComments(id);

    // Hide WhatsApp icon on product detail
    if (typeof updateWhatsAppVisibility === 'function') updateWhatsAppVisibility();
}

function selectDetailSize(sz, el) {
    selectedSize = sz;
    el.parentElement.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');

    const p = products.find(x => x.id === activeProductId);
    if (p) {
        renderDetailColors(p);
        renderDetailPatterns(p);
        updateVariantUI(p);
        updateDetailURL();
    }
}

function selectDetailColor(col, el) {
    selectedColor = col;
    el.parentElement.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');

    const p = products.find(x => x.id === activeProductId);
    if (p) {
        renderDetailPatterns(p);
        updateVariantUI(p);
        updateDetailURL();
    }
}

function renderDetailColors(p, initialColor = null) {
    const colorsContainer = document.getElementById('det-colors-container');
    const colorSelector = document.getElementById('detail-color-selector');
    if (!colorsContainer || !colorSelector) return;

    const colors = [...new Set(p.normalizedVariants.filter(v => v.size === selectedSize).map(v => v.color).filter(c => c))];

    if (colors.length === 0) {
        colorsContainer.style.display = 'none';
        selectedColor = '';
    } else {
        colorsContainer.style.display = 'block';
        if (initialColor && colors.includes(initialColor)) {
            selectedColor = initialColor;
        } else {
            // Only reset color if the current selectedColor isn't available for this size
            if (!colors.includes(selectedColor)) selectedColor = colors[0];
        }

        colorSelector.innerHTML = colors.map(col => {
            const v = p.normalizedVariants.find(x => x.size === selectedSize && x.color === col);
            // Normalize for CSS: hex stays as-is; check customColorsMap; otherwise strip spaces
            let cleanColor = col.trim();
            if (!cleanColor.startsWith('#')) {
                const normName = cleanColor.toLowerCase();
                const normNameNoSpaces = normName.replace(/\s+/g, '');
                if (window.customColorsMap && window.customColorsMap[normName]) {
                    cleanColor = window.customColorsMap[normName].hex;
                } else if (window.customColorsMap && window.customColorsMap[normNameNoSpaces]) {
                    cleanColor = window.customColorsMap[normNameNoSpaces].hex;
                } else {
                    cleanColor = normNameNoSpaces;
                }
            }
            const isWhite = cleanColor === '#ffffff' || cleanColor === 'white' || cleanColor === '#fff';
            const indicatorBorder = isWhite ? '1px solid rgba(255, 255, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)';
            const colorPreview = `<span class="color-indicator" style="background:${cleanColor}; border:${indicatorBorder};"></span>`;

            return `
                <div class="color-chip ${col === selectedColor ? 'active' : ''}" onclick="selectDetailColor('${col}', this)">
                    ${colorPreview}<span>${v ? v.colorName : formatColorName(col)}</span>
                </div>
            `;
        }).join('');
    }
}

function selectDetailPattern(pat, el) {
    window.selectedPattern = pat;
    el.parentElement.querySelectorAll('.size-chip, .color-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');

    const p = products.find(x => x.id === activeProductId);
    if (p) updateVariantUI(p);
}

function renderDetailPatterns(p) {
    const patternsContainer = document.getElementById('det-patterns-container');
    const patternSelector = document.getElementById('detail-pattern-selector');
    if (!patternsContainer || !patternSelector) return;

    // Filter variants that match current size and color, then get unique patterns
    const patterns = [...new Set(p.normalizedVariants.filter(v => v.size === selectedSize && v.color === selectedColor).map(v => v.pattern).filter(pat => pat))];

    if (patterns.length === 0) {
        patternsContainer.style.display = 'none';
        window.selectedPattern = '';
    } else {
        patternsContainer.style.display = 'block';
        if (!patterns.includes(window.selectedPattern)) window.selectedPattern = patterns[0];

        patternSelector.innerHTML = patterns.map(pat => {
            const v = p.normalizedVariants.find(x => x.size === selectedSize && x.color === selectedColor && x.pattern === pat);
            const hasImage = v && v.previewImage;
            // Display text logic:
            // - If patternDisplayName set: use it (like colorName for colors)
            // - If no image: always show pattern text (text-only pattern)
            // - If has image + showPatternText checked: show text alongside image
            // - If has image + showPatternText NOT checked: show only image (no text)
            const displayText = v && v.patternDisplayName ? v.patternDisplayName : pat;
            const shouldShowText = !hasImage || (v && v.showPatternText);

            if (hasImage) {
                const imgHtml = `<img src="${v.previewImage}" style="width:28px; height:28px; border-radius:5px; object-fit:cover; border:1px solid rgba(255,255,255,0.2); vertical-align:middle; flex-shrink:0;">`;
                const textHtml = shouldShowText ? `<span style="font-size:11px; font-weight:600; margin-left:5px; line-height:1.2;">${displayText}</span>` : '';
                return `
                <div class="size-chip color-chip ${pat === window.selectedPattern ? 'active' : ''}" style="padding:5px ${shouldShowText ? '8px 5px 5px' : '5px'}; border-radius:8px; display:inline-flex; align-items:center; gap:0;" onclick="selectDetailPattern('${pat}', this)" title="${displayText}">
                    ${imgHtml}${textHtml}
                </div>
                `;
            }

            // Text-only pattern
            return `
            <div class="size-chip color-chip ${pat === window.selectedPattern ? 'active' : ''}" style="padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center;" onclick="selectDetailPattern('${pat}', this)" title="${displayText}">
                <span>${displayText}</span>
            </div>
            `;
        }).join('');
    }
}

function updateVariantUI(p, scrollGallery = true, overrideActiveIdx = null) {
    const v = getSelectedVariant(p);

    // Update Price
    const priceToDisplay = (v && v.price !== null && v.price !== undefined) ? v.price : p.price;
    document.getElementById('det-price').innerText = `₹${priceToDisplay}`;

    // Update Images: Gather images or placeholders for all variants and main images
    let imagesToDisplay = [];
    let imageToVariantMap = [];
    const addedImages = new Set();

    const mainImages = [];
    const mainImagesMap = [];
    if (!p.hideMainDetailsCarousel && p.images && p.images.length > 0) {
        p.images.forEach(img => {
            if (!addedImages.has(img)) {
                addedImages.add(img);
                mainImages.push(img);
                mainImagesMap.push({
                    url: img,
                    color: '',
                    size: ''
                });
            }
        });
    }

    const variantImages = [];
    const variantImagesMap = [];
    if (p.normalizedVariants && p.normalizedVariants.length > 0) {
        p.normalizedVariants.forEach(variant => {
            const shouldHide = variant.hideDetailsGallery === true || variant.hideDetailsGallery === 'true';
            if (shouldHide) {
                return; // Skip this variant's images and placeholder entirely
            }
            if (variant.images && variant.images.length > 0) {
                variant.images.forEach(img => {
                    if (!addedImages.has(img)) {
                        addedImages.add(img);
                        variantImages.push(img);
                        variantImagesMap.push({
                            url: img,
                            color: variant.color || '',
                            size: variant.size || ''
                        });
                    }
                });
            } else {
                // Pre-generate a placeholder key to avoid duplicate placeholders for the same color/size
                const placeholderKey = `placeholder-${variant.color || ''}-${variant.size || ''}`;
                if (!addedImages.has(placeholderKey)) {
                    addedImages.add(placeholderKey);
                    const placeholderImg = "https://placehold.co/400x400/222/FFF?text=No+Image";
                    variantImages.push(placeholderImg);
                    variantImagesMap.push({
                        url: placeholderImg,
                        color: variant.color || '',
                        size: variant.size || '',
                        isPlaceholder: true
                    });
                }
            }
        });
    }

    // Combine based on admin-configured position (defaults to 'end')
    const pos = p.mainImagesPosition || 'end';
    if (pos === 'end') {
        imagesToDisplay = [...variantImages, ...mainImages];
        imageToVariantMap = [...variantImagesMap, ...mainImagesMap];
    } else {
        imagesToDisplay = [...mainImages, ...variantImages];
        imageToVariantMap = [...mainImagesMap, ...variantImagesMap];
    }

    // Determine targetIndex based on currently selected options
    const targetIndex = imagesToDisplay.length > 0
        ? imageToVariantMap.findIndex(m => m.color === selectedColor && (selectedSize === 'Standard' || m.size === selectedSize))
        : -1;
    const activeThumbIdx = (overrideActiveIdx !== null && overrideActiveIdx !== undefined)
        ? overrideActiveIdx
        : (targetIndex > -1 ? targetIndex : 0);

    window.detailGalleryImages = imagesToDisplay.slice();
    window.detailGalleryActiveIndex = activeThumbIdx > -1 ? activeThumbIdx : 0;

    // Render gallery with mapping metadata
    const galleryHtml = imagesToDisplay.length 
        ? imagesToDisplay.map((img, index) => {
            const mapInfo = imageToVariantMap[index] || { color: '', size: '' };
            return `<img src="${img}" class="det-gallery-zoomable" data-color="${mapInfo.color}" data-size="${mapInfo.size}" data-index="${index}" onclick="openProductDetailImageZoom(${index}, event)" alt="Product image ${index + 1}">`;
        }).join('') 
        : (p.hideNoImagePlaceholder ? '' : '<img src="https://placehold.co/400x400/222/FFF?text=No+Image">');

    const detGallery = document.getElementById('det-gallery');
    const imageListString = imagesToDisplay.join(',');
    if (detGallery) {
        if (detGallery.getAttribute('data-loaded-images') !== imageListString) {
            detGallery.innerHTML = galleryHtml;
            detGallery.setAttribute('data-loaded-images', imageListString);
        }
    }
    
    const indicatorsContainer = document.getElementById('det-indicators');
    if (indicatorsContainer) {
        indicatorsContainer.innerHTML = imagesToDisplay.length > 1 
            ? imagesToDisplay.map((_, i) => `<div class="dot ${i === activeThumbIdx ? 'active' : ''}"></div>`).join('') 
            : '';
    }

    // Render thumbnails strip
    const thumbsContainer = document.getElementById('det-thumbs');
    if (thumbsContainer) {
        if (imagesToDisplay.length > 1) {
            thumbsContainer.style.display = 'flex';
            const thumbsHtml = imagesToDisplay.map((img, idx) => {
                const mapInfo = imageToVariantMap[idx] || { color: '', size: '' };
                const borderStyle = idx === activeThumbIdx ? 'border: 2px solid var(--gold);' : 'border: 2px solid #222;';
                return `
                    <div class="det-thumb-item" data-index="${idx}" style="width: 45px; height: 60px; border-radius: 6px; overflow: hidden; cursor: pointer; flex-shrink: 0; transition: border-color 0.2s; ${borderStyle}" onclick="clickDetThumb(${idx})">
                        <img src="${img}" style="width: 100%; height: 100%; object-fit: cover; object-position: top;">
                    </div>
                `;
            }).join('');
            
            if (thumbsContainer.getAttribute('data-loaded-images') !== imageListString) {
                thumbsContainer.innerHTML = thumbsHtml;
                thumbsContainer.setAttribute('data-loaded-images', imageListString);
            } else {
                updateActiveThumbnailBorder(activeThumbIdx);
            }
        } else {
            thumbsContainer.style.display = 'none';
        }
    }

    // Scroll to the current selected variant's first image if we're not triggered by a scroll event
    if (scrollGallery && imagesToDisplay.length > 0 && !window.detGalleryScrollingNow) {
        if (activeThumbIdx > -1) {
            const imgEl = detGallery.children[activeThumbIdx];
            if (imgEl) {
                window.detGalleryScrollingNow = true; // Block scroll listener from interfering during smooth scroll transitions
                clearTimeout(window.detGalleryScrollEndTimeout);
                setTimeout(() => {
                    detGallery.scrollTo({ left: imgEl.offsetLeft, behavior: 'smooth' });
                    updateActiveThumbnailBorder(activeThumbIdx);
                    setTimeout(() => {
                        window.detGalleryScrollingNow = false;
                    }, 800); // Failsafe unlock after 800ms
                }, 50);
            }
        }
    }

    // Update Button and Stock Info
    const btn = document.getElementById('det-btn');
    if (!btn) return;

    let isOutOfStock = false;
    let lowStockText = '';

    if (v && v.trackStock) {
        if ((v.stockCount || 0) <= 0) {
            isOutOfStock = true;
        } else if (v.stockCount <= 5) {
            lowStockText = `Only ${v.stockCount} left in stock!`;
        }
    }

    // Add low stock warning UI before the button if exists
    let warningContainer = document.getElementById('det-stock-warning');
    if (!warningContainer) {
        warningContainer = document.createElement('div');
        warningContainer.id = 'det-stock-warning';
        warningContainer.style = 'color:#e74c3c; font-size:12px; font-weight:bold; margin-bottom:10px; text-align:center;';
        btn.parentNode.insertBefore(warningContainer, btn);
    }
    warningContainer.innerText = lowStockText;

    let qtyInCart = 0;
    if (typeof cart !== 'undefined' && v) {
        const existing = cart.find(item => item.id === p.id && item.variantSize === v.size && item.variantColor === v.color && (item.variantPattern || '') === (window.selectedPattern || ''));
        if (existing) qtyInCart = existing.qty;
    }

    if (qtyInCart > 0) {
        const reachedLimit = v && ((v.trackStock && qtyInCart >= v.stockCount) || (!v.trackStock && qtyInCart >= (typeof globalMaxCartQty !== 'undefined' ? globalMaxCartQty : 1)));
        btn.style.padding = "0";
        btn.style.background = "var(--gold)";
        btn.style.color = "#000";
        btn.disabled = false;
        btn.innerHTML = `
            <div style="display:flex; width:100%; align-items:center; justify-content:space-between; font-size:24px;">
                <div style="padding:15px 30px; cursor:pointer; flex:1; text-align:center; background:rgba(0,0,0,0.08);" onclick="event.stopPropagation(); updateVariantCartQty('${p.id}', '${v.size}', '${v.color}', '${window.selectedPattern || ''}', -1)">-</div>
                <div style="padding:15px; flex:2; font-size:16px; text-align:center; white-space:nowrap; font-weight:900;">${qtyInCart} IN BAG</div>
                <div style="padding:15px 30px; cursor:pointer; flex:1; text-align:center; background:rgba(0,0,0,0.08); ${reachedLimit ? 'opacity:0.3; pointer-events:none;' : ''}" onclick="event.stopPropagation(); ${reachedLimit ? '' : `updateVariantCartQty('${p.id}', '${v.size}', '${v.color}', '${window.selectedPattern || ''}', 1)`}">+</div>
            </div>
        `;
        btn.onclick = null;
    } else if (isOutOfStock) {
        btn.style.padding = "15px";
        btn.innerText = "OUT OF STOCK";
        btn.style.background = "#333";
        btn.style.color = "#777";
        btn.disabled = true;
        btn.onclick = null;
    } else {
        btn.style.padding = "15px";
        btn.style.background = "var(--gold)";
        btn.style.color = "#000";
        btn.disabled = false;

        let label = "ADD TO BAG";
        const specs = [];
        if (selectedSize && selectedSize !== 'Standard') specs.push(`Size: ${selectedSize}`);
        if (selectedColor) {
            const dispColor = (v && v.color === selectedColor && v.colorName) ? v.colorName : formatColorName(selectedColor);
            specs.push(`Color: ${dispColor}`);
        }
        if (window.selectedPattern) {
            const hasPatternImg = v && v.previewImage;
            if (!hasPatternImg && !window.selectedPattern.startsWith('Design-')) {
                specs.push(`Pattern: ${window.selectedPattern}`);
            }
        }
        if (specs.length > 0) label += ` (${specs.join(', ')})`;
        btn.innerHTML = label;

        btn.onclick = () => {
            const uniqueSizes = [...new Set(p.normalizedVariants.map(v => v.size))];
            if (uniqueSizes.length > 0 && !selectedSize) return showToast("Please select a size");
            const availableColors = p.normalizedVariants.filter(x => x.size === selectedSize).map(x => x.color).filter(c => c);
            if (availableColors.length > 0 && !selectedColor) return showToast("Please select a color");

            addToBagWithSelection(p.id, selectedSize, selectedColor, window.selectedPattern || '');
            // Don't close detail instantly, let them use the stepper
            updateVariantUI(p);
        };
    }
    const trigger360 = document.getElementById('det-360-trigger');
    if (trigger360) {
        const active360Img = window.getActive360Images(p);
        if (active360Img) {
            trigger360.style.display = 'flex';
        } else {
            trigger360.style.display = 'none';
        }
    }

    const zoomTrigger = document.getElementById('det-zoom-trigger');
    if (zoomTrigger) {
        zoomTrigger.style.display = imagesToDisplay.length > 0 ? 'inline-flex' : 'none';
    }
}

function closeDetail() {
    const detView = document.getElementById('detail-view');
    detView.style.display = 'none';
    detView.classList.remove('active-detail-flex');
    window.history.replaceState({}, '', window.location.pathname);
    if (typeof closeAnnouncementImageZoom === 'function') closeAnnouncementImageZoom();

    if (typeof stopProductCommentsListener === 'function') stopProductCommentsListener();
    window.selectedCommentRating = 0;

    // Restore WhatsApp icon visibility when closing product detail
    if (typeof updateWhatsAppVisibility === 'function') updateWhatsAppVisibility();
}

// 4. INTERACTIVITY
function toggleWish(id) {
    if (!currentUser) return showToast("Login first");
    let newWish = wishlist.includes(id) ? wishlist.filter(x => x !== id) : [...wishlist, id];
    db.collection("users").doc(currentUser.uid).set({ wishlist: newWish }, { merge: true });
}

async function shareProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    
    const params = new URLSearchParams();
    params.set('id', id);
    if (selectedColor && activeProductId === id) {
        params.set('color', selectedColor);
    }
    if (selectedSize && selectedSize !== 'Standard' && activeProductId === id) {
        params.set('size', selectedSize);
    }
    
    const shareUrl = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    const shareText = `👗 *${p.name}*\n💰 ₹${p.price}\n\n🛍️ Shop now on Swag Stree:\n${shareUrl}`;
    if (navigator.share) {
        try {
            await navigator.share({ title: p.name, text: shareText });
        } catch (err) { }
    } else {
        copyToClipboard(shareUrl);
        showToast('Link copied to clipboard!');
    }
}

function searchHandler() {
    displayedProductsLimit = productsPageLimitSetting;
    const q = document.getElementById('app_search').value.toLowerCase();
    renderProducts(products.filter(p => p.name.toLowerCase().includes(q)), 'product-grid');
}

function wishSearchHandler() {
    displayedWishlistLimit = productsPageLimitSetting;
    renderStore();
}
window.wishSearchHandler = wishSearchHandler;

function updateDots(el) {
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    const diariesRoot = el.closest('.feedback-diaries-carousel');
    const dotRoot = diariesRoot || el.parentElement;
    const dots = dotRoot.querySelectorAll('.dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));

    // For product detail gallery: Automatically switch active variant selections on scroll
    if (el.id === 'det-gallery') {
        if (window.detGalleryScrollingNow) {
            // Keep the lock active and refresh the debounce timer as long as scrolling continues
            clearTimeout(window.detGalleryScrollEndTimeout);
            window.detGalleryScrollEndTimeout = setTimeout(() => {
                window.detGalleryScrollingNow = false;
            }, 200); // Unlock 200ms after the last scroll event finishes
            return;
        }
        const activeImg = el.children[idx];
        if (activeImg) {
            const imgColor = activeImg.getAttribute('data-color');
            const imgSize = activeImg.getAttribute('data-size');
            const p = products.find(x => x.id === activeProductId);
            
            if (p) {
                let changed = false;

                // Sync visible color
                if (imgColor && imgColor !== selectedColor) {
                    selectedColor = imgColor;
                    changed = true;
                    // Highlight color chip
                    const colorChips = document.querySelectorAll('#detail-color-selector .color-chip');
                    colorChips.forEach(chip => {
                        const clickAttr = chip.getAttribute('onclick') || '';
                        chip.classList.toggle('active', clickAttr.includes(`'${imgColor}'`));
                    });
                }

                // Sync visible size
                if (imgSize && imgSize !== 'Standard' && imgSize !== selectedSize) {
                    selectedSize = imgSize;
                    changed = true;
                }

                if (changed) {
                    // Update selectors and buttons without scrolling the gallery container again
                    window.detGalleryScrollingNow = true;
                    syncSizeChips();
                    renderDetailColors(p);
                    renderDetailPatterns(p);
                    updateVariantUI(p, false, idx);
                    updateDetailURL();
                    window.detGalleryScrollingNow = false;
                }
            }
        }
        // Update thumbnail borders to show active image indicator
        updateActiveThumbnailBorder(idx);
    }
}

function clickDetThumb(idx) {
    const detGallery = document.getElementById('det-gallery');
    if (!detGallery) return;
    const imgEl = detGallery.children[idx];
    if (imgEl) {
        window.detGalleryScrollingNow = true;
        clearTimeout(window.detGalleryScrollEndTimeout);
        detGallery.scrollTo({ left: imgEl.offsetLeft, behavior: 'smooth' });
        updateActiveThumbnailBorder(idx);
        
        // Also sync option selection states matching this thumbnail
        const imgColor = imgEl.getAttribute('data-color');
        const imgSize = imgEl.getAttribute('data-size');
        const p = products.find(x => x.id === activeProductId);
        if (p) {
            let changed = false;
            if (imgColor && imgColor !== selectedColor) {
                selectedColor = imgColor;
                changed = true;
            }
            if (imgSize && imgSize !== 'Standard' && imgSize !== selectedSize) {
                selectedSize = imgSize;
                changed = true;
            }
            if (changed) {
                syncSizeChips();
                renderDetailColors(p);
                renderDetailPatterns(p);
                updateVariantUI(p, false, idx);
                updateDetailURL();
            }
        }
        setTimeout(() => {
            window.detGalleryScrollingNow = false;
        }, 800); // Failsafe unlock after 800ms
    }
}

function syncSizeChips() {
    const sizeChips = document.querySelectorAll('#detail-size-selector .size-chip');
    sizeChips.forEach(chip => {
        const sz = chip.innerText.trim();
        const displaySz = selectedSize === 'Standard' ? 'Free Size' : selectedSize;
        chip.classList.toggle('active', sz === displaySz);
    });
}
window.syncSizeChips = syncSizeChips;

function updateActiveThumbnailBorder(idx) {
    window.detailGalleryActiveIndex = idx;
    const thumbs = document.querySelectorAll('#det-thumbs .det-thumb-item');
    thumbs.forEach((thumb, i) => {
        if (i === idx) {
            thumb.style.borderColor = 'var(--gold)';
        } else {
            thumb.style.borderColor = '#222';
        }
    });
}

function selectChip(el, type) {
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    selectedSize = el.innerText;
}

// 5. FILTERING SYSTEM
function toggleFilter() {
    const slider = document.getElementById('filter-slider');
    const overlay = document.querySelector('.filter-overlay');
    slider.classList.toggle('active');
    overlay.style.display = slider.classList.contains('active') ? 'block' : 'none';

    // Hide/show WhatsApp icon when filter slider toggles
    if (typeof updateWhatsAppVisibility === 'function') updateWhatsAppVisibility();
}
window.toggleFilter = toggleFilter;

function setFilterSize(el, sz) {
    displayedProductsLimit = productsPageLimitSetting;
    const idx = filterActiveSizes.indexOf(sz);
    if (idx > -1) {
        filterActiveSizes.splice(idx, 1);
        el.classList.remove('active');
    } else {
        filterActiveSizes.push(sz);
        el.classList.add('active');
    }
    applySortAndFilter();
}

function setFilterColor(el, col) {
    displayedProductsLimit = productsPageLimitSetting;
    const idx = filterActiveColors.indexOf(col);
    if (idx > -1) {
        filterActiveColors.splice(idx, 1);
        el.classList.remove('active');
    } else {
        filterActiveColors.push(col);
        el.classList.add('active');
    }
    applySortAndFilter();
}

function setFilterPattern(el, pat) {
    displayedProductsLimit = productsPageLimitSetting;
    const idx = filterActivePatterns.indexOf(pat);
    if (idx > -1) {
        filterActivePatterns.splice(idx, 1);
        el.classList.remove('active');
    } else {
        filterActivePatterns.push(pat);
        el.classList.add('active');
    }
    applySortAndFilter();
}

function updatePriceSliderUI() {
    const minRange = document.getElementById('price-min-range');
    const maxRange = document.getElementById('price-max-range');
    const minInput = document.getElementById('price-min-input');
    const maxInput = document.getElementById('price-max-input');
    const track = document.querySelector('.price-slider-track');

    if (!minRange || !maxRange || !minInput || !maxInput || !track) return;

    const minVal = parseFloat(minRange.value);
    const maxVal = parseFloat(maxRange.value);

    const min = parseFloat(minRange.min) || 0;
    const max = parseFloat(minRange.max) || 5000;
    const range = max - min;

    const minPercent = range > 0 ? ((minVal - min) / range) * 100 : 0;
    const maxPercent = range > 0 ? ((maxVal - min) / range) * 100 : 100;

    track.style.left = minPercent + '%';
    track.style.width = (maxPercent - minPercent) + '%';

    minInput.value = Math.round(minVal);
    maxInput.value = Math.round(maxVal);
}

function renderFilters() {
    // Price boundary calculation
    if (products.length > 0) {
        const prices = products.map(p => parseFloat(p.price) || 0);
        priceAbsoluteMin = Math.floor(Math.min(...prices));
        priceAbsoluteMax = Math.ceil(Math.max(...prices));
        if (priceAbsoluteMin === priceAbsoluteMax) {
            priceAbsoluteMin = Math.max(0, priceAbsoluteMin - 100);
            priceAbsoluteMax = priceAbsoluteMax + 100;
        }
    } else {
        priceAbsoluteMin = 0;
        priceAbsoluteMax = 5000;
    }

    if (filterMinPrice === null) filterMinPrice = priceAbsoluteMin;
    if (filterMaxPrice === null) filterMaxPrice = priceAbsoluteMax;

    // Clamp current values to absolute bounds in case catalog changed
    filterMinPrice = Math.max(priceAbsoluteMin, Math.min(priceAbsoluteMax, filterMinPrice));
    filterMaxPrice = Math.max(priceAbsoluteMin, Math.min(priceAbsoluteMax, filterMaxPrice));

    // Setup slider inputs in UI
    const minRange = document.getElementById('price-min-range');
    const maxRange = document.getElementById('price-max-range');
    if (minRange && maxRange) {
        minRange.min = priceAbsoluteMin;
        minRange.max = priceAbsoluteMax;
        maxRange.min = priceAbsoluteMin;
        maxRange.max = priceAbsoluteMax;

        minRange.value = filterMinPrice;
        maxRange.value = filterMaxPrice;
    }

    const minInput = document.getElementById('price-min-input');
    const maxInput = document.getElementById('price-max-input');
    if (minInput && maxInput) {
        minInput.min = priceAbsoluteMin;
        minInput.max = priceAbsoluteMax;
        maxInput.min = priceAbsoluteMin;
        maxInput.max = priceAbsoluteMax;

        minInput.value = Math.round(filterMinPrice);
        maxInput.value = Math.round(filterMaxPrice);
    }

    updatePriceSliderUI();

    if (minRange && maxRange) {
        minRange.oninput = function () {
            let minVal = parseFloat(minRange.value);
            let maxVal = parseFloat(maxRange.value);
            if (minVal > maxVal) {
                minRange.value = maxVal;
                minVal = maxVal;
            }
            filterMinPrice = minVal;
            updatePriceSliderUI();
            applySortAndFilter();
        };

        maxRange.oninput = function () {
            let minVal = parseFloat(minRange.value);
            let maxVal = parseFloat(maxRange.value);
            if (maxVal < minVal) {
                maxRange.value = minVal;
                maxVal = minVal;
            }
            filterMaxPrice = maxVal;
            updatePriceSliderUI();
            applySortAndFilter();
        };
    }

    if (minInput && maxInput) {
        minInput.onchange = function () {
            let val = parseFloat(minInput.value);
            if (isNaN(val) || val < priceAbsoluteMin) val = priceAbsoluteMin;
            if (val > filterMaxPrice) val = filterMaxPrice;
            minInput.value = Math.round(val);
            minRange.value = val;
            filterMinPrice = val;
            updatePriceSliderUI();
            applySortAndFilter();
        };

        maxInput.onchange = function () {
            let val = parseFloat(maxInput.value);
            if (isNaN(val) || val > priceAbsoluteMax) val = priceAbsoluteMax;
            if (val < filterMinPrice) val = filterMinPrice;
            maxInput.value = Math.round(val);
            maxRange.value = val;
            filterMaxPrice = val;
            updatePriceSliderUI();
            applySortAndFilter();
        };
    }

    // allSizes: Set of uppercase size strings
    const allSizes = new Set();
    // allColors: Map of colorValue -> { displayName, colorValue }
    const allColors = new Map();
    // patternGroups: Map of groupKey -> { key, url, displayName, showPatternText, patternKeys }
    const patternGroups = new Map();

    products.forEach(p => {
        const normVars = p.normalizedVariants && p.normalizedVariants.length > 0
            ? p.normalizedVariants
            : normalizeVariants(p);

        normVars.forEach(v => {
            // SIZES
            if (v.size) {
                const upper = v.size.trim().toUpperCase();
                if (upper && upper !== 'STANDARD') allSizes.add(upper);
            }

            // COLORS
            if (v.color && v.color.trim()) {
                const colorVal = v.color.trim();
                const displayName = (v.colorName && v.colorName.trim()) ? v.colorName.trim() : formatColorName(colorVal);
                if (!allColors.has(colorVal)) {
                    allColors.set(colorVal, { displayName, colorVal });
                }
            }

            // PATTERNS (grouped to prevent duplicates)
            if (v.pattern && v.pattern.trim()) {
                const patVal = v.pattern.trim();
                const previewUrl = v.previewImage || '';
                const displayName = (v.patternDisplayName && v.patternDisplayName.trim()) ? v.patternDisplayName.trim() : patVal;

                const groupKey = previewUrl ? previewUrl : displayName.toLowerCase();

                if (!patternGroups.has(groupKey)) {
                    patternGroups.set(groupKey, {
                        key: groupKey,
                        url: previewUrl,
                        displayName: displayName,
                        showPatternText: !!v.showPatternText,
                        patternKeys: new Set([patVal])
                    });
                } else {
                    const group = patternGroups.get(groupKey);
                    group.patternKeys.add(patVal);
                    if (v.showPatternText) group.showPatternText = true;
                    if (displayName && (!group.displayName || group.displayName === patVal)) {
                        group.displayName = displayName;
                    }
                }
            }
        });
    });

    const sizesContainer = document.getElementById('filter-sizes');
    if (sizesContainer) {
        sizesContainer.innerHTML = Array.from(allSizes).map(sz =>
            `<div class="size-chip ${filterActiveSizes.includes(sz) ? 'active' : ''}" onclick="setFilterSize(this, '${sz}')">${sz}</div>`
        ).join('');
    }

    const colorsContainer = document.getElementById('filter-colors');
    if (colorsContainer) {
        colorsContainer.innerHTML = Array.from(allColors.entries()).map(([colorVal, info]) => {
            let cleanColor = colorVal.trim();
            if (!cleanColor.startsWith('#')) {
                const normName = cleanColor.toLowerCase();
                const normNameNoSpaces = normName.replace(/\s+/g, '');
                if (window.customColorsMap && window.customColorsMap[normName]) {
                    cleanColor = window.customColorsMap[normName].hex;
                } else if (window.customColorsMap && window.customColorsMap[normNameNoSpaces]) {
                    cleanColor = window.customColorsMap[normNameNoSpaces].hex;
                } else {
                    cleanColor = normNameNoSpaces;
                }
            }
            const isWhite = cleanColor.toLowerCase() === '#ffffff' || cleanColor.toLowerCase() === 'white';
            const indicatorBorder = isWhite ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.15)';
            const colorPreview = `<span class="color-indicator" style="background:${cleanColor}; border:${indicatorBorder};"></span>`;
            const safeVal = colorVal.replace(/'/g, "\\'");
            return `
                <div class="color-chip ${filterActiveColors.includes(colorVal) ? 'active' : ''}" onclick="setFilterColor(this, '${safeVal}')">
                    ${colorPreview}<span>${info.displayName}</span>
                </div>
            `;
        }).join('');
    }

    const patternsContainer = document.getElementById('filter-patterns');
    if (patternsContainer) {
        patternsContainer.innerHTML = Array.from(patternGroups.values()).map(group => {
            const previewUrl = group.url;
            const displayName = group.displayName;
            const showText = group.showPatternText;
            const activeMatch = filterActivePatterns.includes(group.key);

            if (previewUrl) {
                const imgHtml = `<img src="${previewUrl}" style="width:26px; height:26px; border-radius:5px; object-fit:cover; border:1px solid rgba(255,255,255,0.2); flex-shrink:0;">`;
                const textHtml = showText ? `<span style="font-size:11px; font-weight:600; margin-left:5px;">${displayName}</span>` : '';
                return `
                <div class="size-chip color-chip ${activeMatch ? 'active' : ''}" style="padding:5px ${showText ? '8px 5px 5px' : '5px'}; border-radius:8px; display:inline-flex; align-items:center;" onclick="setFilterPattern(this, '${group.key}')" title="${displayName}">
                    ${imgHtml}${textHtml}
                </div>`;
            }
            return `
            <div class="size-chip color-chip ${activeMatch ? 'active' : ''}" style="padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold; display:inline-flex; align-items:center;" onclick="setFilterPattern(this, '${group.key}')" title="${displayName}">
                <span>${displayName}</span>
            </div>`;
        }).join('');
    }
}

function resetFilters() {
    displayedProductsLimit = productsPageLimitSetting;
    filterActiveSizes = [];
    filterActiveColors = [];
    filterActivePatterns = [];

    filterMinPrice = priceAbsoluteMin;
    filterMaxPrice = priceAbsoluteMax;

    const minRange = document.getElementById('price-min-range');
    const maxRange = document.getElementById('price-max-range');
    if (minRange && maxRange) {
        minRange.value = priceAbsoluteMin;
        maxRange.value = priceAbsoluteMax;
    }

    const minInput = document.getElementById('price-min-input');
    const maxInput = document.getElementById('price-max-input');
    if (minInput && maxInput) {
        minInput.value = priceAbsoluteMin;
        maxInput.value = priceAbsoluteMax;
    }

    updatePriceSliderUI();

    const sortLogic = document.getElementById('sort-logic');
    if (sortLogic) sortLogic.value = 'none';
    const sortLogicFilter = document.getElementById('sort-logic-filter');
    if (sortLogicFilter) sortLogicFilter.value = 'none';

    document.querySelectorAll('#filter-slider .size-chip, #filter-slider .color-chip').forEach(c => c.classList.remove('active'));
    applySortAndFilter();
}
window.resetFilters = resetFilters;

function getProductTimestamp(p) {
    if (!p.updatedAt) return 0;
    if (typeof p.updatedAt.toDate === 'function') return p.updatedAt.toDate().getTime();
    if (p.updatedAt.seconds) return p.updatedAt.seconds * 1000;
    if (typeof p.updatedAt === 'number') return p.updatedAt;
    if (p.updatedAt instanceof Date) return p.updatedAt.getTime();
    const parsed = Date.parse(p.updatedAt);
    return isNaN(parsed) ? 0 : parsed;
}

function applySortAndFilter() {
    const sortEl = document.getElementById('sort-logic');
    const sort = sortEl ? sortEl.value : 'none';
    let filtered = [...products];

    // Filter by Price Range
    if (filterMinPrice !== null) {
        filtered = filtered.filter(p => (parseFloat(p.price) || 0) >= filterMinPrice);
    }
    if (filterMaxPrice !== null) {
        filtered = filtered.filter(p => (parseFloat(p.price) || 0) <= filterMaxPrice);
    }

    // Filter by size, color, pattern multi-selects (OR within categories, AND between categories)
    if (filterActiveSizes.length > 0 || filterActiveColors.length > 0 || filterActivePatterns.length > 0) {
        filtered = filtered.filter(p => {
            const normVars = p.normalizedVariants && p.normalizedVariants.length > 0
                ? p.normalizedVariants : normalizeVariants(p);

            return normVars.some(v => {
                if (filterActiveSizes.length > 0) {
                    const vSize = v.size ? v.size.trim().toUpperCase() : 'STANDARD';
                    if (!filterActiveSizes.includes(vSize)) return false;
                }

                if (filterActiveColors.length > 0) {
                    const vCol = v.color ? v.color.trim() : '';
                    if (!filterActiveColors.includes(vCol)) return false;
                }

                if (filterActivePatterns.length > 0) {
                    if (!v.pattern) return false;
                    const patVal = v.pattern.trim();
                    const previewUrl = v.previewImage || '';
                    const displayName = (v.patternDisplayName && v.patternDisplayName.trim()) ? v.patternDisplayName.trim() : patVal;
                    const vGroupKey = previewUrl ? previewUrl : displayName.toLowerCase();
                    if (!filterActivePatterns.includes(vGroupKey)) return false;
                }

                return true;
            });
        });
    }

    if (sort === 'low') filtered.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
    if (sort === 'high') filtered.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    if (sort === 'newest') {
        filtered.sort((a, b) => {
            const timeA = getProductTimestamp(a);
            const timeB = getProductTimestamp(b);
            if (timeA !== timeB) return timeB - timeA;
            return b.id.localeCompare(a.id);
        });
    }
    if (sort === 'best') {
        filtered.sort((a, b) => {
            const salesA = a.salesCount || (a.popularity || (a.name.length % 5) * 12);
            const salesB = b.salesCount || (b.popularity || (b.name.length % 5) * 12);
            if (salesA !== salesB) return salesB - salesA;
            return a.name.localeCompare(b.name);
        });
    }
    renderProducts(filtered, 'product-grid');
}

function changeSortLogic(val, source) {
    if (val === undefined) {
        const mainSort = document.getElementById('sort-logic');
        val = mainSort ? mainSort.value : 'none';
        source = 'main';
    }
    if (source === 'main') {
        const filterSort = document.getElementById('sort-logic-filter');
        if (filterSort) filterSort.value = val;
    } else {
        const mainSort = document.getElementById('sort-logic');
        if (mainSort) mainSort.value = val;
    }
    displayedProductsLimit = productsPageLimitSetting;
    applySortAndFilter();
}

function loadMoreProducts() {
    displayedProductsLimit += productsPageLimitSetting;
    const q = document.getElementById('app_search').value.toLowerCase();
    if (q) {
        renderProducts(products.filter(p => p.name.toLowerCase().includes(q)), 'product-grid');
    } else {
        applySortAndFilter();
    }
}

function changeWishlistSort(val) {
    displayedWishlistLimit = productsPageLimitSetting;
    renderStore();
}
window.changeWishlistSort = changeWishlistSort;

function loadMoreWishlist() {
    displayedWishlistLimit += productsPageLimitSetting;
    renderStore();
}

window.loadMoreWishlist = loadMoreWishlist;

function buildInstagramEmbedFrame(postId) {
    const id = String(postId || '').trim();
    if (!id) return '';
    return `
        <div class="ig-embed-clip">
            <iframe class="ig-embed-frame" src="https://www.instagram.com/p/${id}/embed" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media" title="Instagram post"></iframe>
        </div>
    `;
}

window.handleFeedbackImageError = function (imgEl, postId) {
    if (!postId) return;
    const parent = imgEl.parentElement;
    if (parent) {
        parent.innerHTML = buildInstagramEmbedFrame(postId);
        parent.style.position = 'relative';
        parent.style.overflow = 'hidden';
        parent.style.background = '#111';
    }
};

function getActiveFeedbackLink(card) {
    if (!card) return null;
    let allLinks = [];
    try {
        allLinks = JSON.parse(card.dataset.links || '[]');
    } catch (e) {
        allLinks = [];
    }
    if (!allLinks.length) return null;

    let activeIdx = 0;
    const carousel = card.querySelector('.feedback-diaries-slides, .carousel');
    if (carousel) {
        const offsetWidth = carousel.offsetWidth || 1;
        activeIdx = Math.round(carousel.scrollLeft / offsetWidth);
        if (activeIdx >= allLinks.length) activeIdx = 0;
    }
    return allLinks[activeIdx] || allLinks[0];
}

function resolveNativeAppUrl(webUrl) {
    if (!webUrl) return null;
    const igMatch = webUrl.match(/instagram\.com\/(?:[^/]+\/)?(p|reel|tv)\/([^/?#&\s]+)/i);
    if (igMatch) {
        const kind = igMatch[1].toLowerCase();
        const code = igMatch[2];
        if (kind === 'reel') return 'instagram://reel/' + code;
        if (kind === 'tv') return 'instagram://tv/' + code;
        return 'instagram://p/' + code + '/';
    }
    if (webUrl.includes('facebook.com')) {
        return 'fb://facewebmodal/f?href=' + encodeURIComponent(webUrl);
    }
    return null;
}

function openNativeOrWebUrl(webUrl) {
    if (!webUrl) return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const appUrl = isMobile ? resolveNativeAppUrl(webUrl) : null;

    if (!isMobile || !appUrl) {
        window.open(webUrl, '_blank', 'noopener,noreferrer');
        return;
    }

    let leftPage = false;
    const markLeft = () => { leftPage = true; };
    const onVis = () => { if (document.hidden) markLeft(); };

    window.addEventListener('blur', markLeft, { once: true });
    window.addEventListener('pagehide', markLeft, { once: true });
    document.addEventListener('visibilitychange', onVis);

    // Anchor click keeps iOS user-gesture chain for custom scheme links
    const linkEl = document.createElement('a');
    linkEl.href = appUrl;
    linkEl.style.display = 'none';
    linkEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(linkEl);
    linkEl.click();
    document.body.removeChild(linkEl);
    window.location.assign(appUrl);

    setTimeout(() => {
        document.removeEventListener('visibilitychange', onVis);
        if (!leftPage) {
            const webAnchor = document.createElement('a');
            webAnchor.href = webUrl;
            webAnchor.style.display = 'none';
            webAnchor.setAttribute('aria-hidden', 'true');
            document.body.appendChild(webAnchor);
            webAnchor.click();
            document.body.removeChild(webAnchor);
        }
    }, 1500);
}

window.openFeedbackPost = function (el, evt) {
    if (evt) {
        evt.preventDefault();
        evt.stopPropagation();
    }
    const card = el.closest('.feedback-card');
    const targetLink = getActiveFeedbackLink(card);
    if (!targetLink) return false;
    openNativeOrWebUrl(targetLink);
    return false;
};

function getFeedbackCardsHtml() {
    if (!window.feedbacks || window.feedbacks.length === 0) {
        return [];
    }

    return window.feedbacks.filter(f => f.active !== false && f.active !== 'false').flatMap(f => {
        const platformIconStyle = 'color:#E1306C; font-size:16px; cursor:pointer;';

        let customImages = (f.imageUrls || (f.imageUrl ? [f.imageUrl] : []))
            .filter(url => url && url.trim() !== '')
            .map(url => {
                if (url.includes('github.com') && url.includes('/blob/')) {
                    return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
                }
                return url.trim();
            })
            .filter(url => {
                if (url.includes('instagram.com') && !url.includes('/media')) return false;
                if (url.includes('facebook.com') && !url.includes('fbcdn')) return false;
                return true;
            });

        function normalizeFacebookLink(link) {
            if (!link) return '';
            link = link.trim();
            if (link.includes('facebook.com') && link.includes('fbid=')) {
                try {
                    const searchStr = link.split('?')[1];
                    if (searchStr) {
                        const urlParams = new URLSearchParams(searchStr);
                        const fbid = urlParams.get('fbid');
                        if (fbid) {
                            return `https://www.facebook.com/photo.php?fbid=${fbid}`;
                        }
                    }
                } catch (e) {
                    console.error("Facebook link normalization failed:", e);
                }
            }
            return link;
        }

        const links = f.showMultiple && f.link
            ? f.link.split(',').map(url => normalizeFacebookLink(url.trim())).filter(url => url)
            : [normalizeFacebookLink((f.link || '').trim())];

        return links.map(link => {
            let postImgUrls = [];

            if (f.showMultiple) {
                if (link && f.platform === 'instagram') {
                    const match = link.match(/(?:instagram\.com)\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#&]+)/i);
                    if (match && match[1]) {
                        postImgUrls.push(`https://www.instagram.com/p/${match[1]}/media/?size=l`);
                    }
                }
            } else {
                const allLinks = f.link ? f.link.split(',').map(url => url.trim()).filter(url => url) : [];
                allLinks.forEach(l => {
                    if (l && f.platform === 'instagram') {
                        const match = l.match(/(?:instagram\.com)\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#&]+)/i);
                        if (match && match[1]) {
                            postImgUrls.push(`https://www.instagram.com/p/${match[1]}/media/?size=l`);
                        }
                    }
                });
            }

            const position = f.imgPosition || 'first';
            let images = [...customImages];
            if (postImgUrls.length > 0) {
                if (position === 'first') {
                    images = [...postImgUrls, ...customImages];
                } else if (position === 'last') {
                    images = [...customImages, ...postImgUrls];
                }
            }

            // Skip rendering if there is no image, no link, and no text caption
            if (images.length === 0 && !link && !f.text) {
                return '';
            }

            // Skip rendering social media cards if there's no link and no images
            if ((f.platform === 'instagram' || f.platform === 'facebook') && images.length === 0 && !link) {
                return '';
            }

            // Render official Instagram/Facebook iframe embeds if no images to display in carousel
            if (images.length === 0 && link && (f.platform === 'instagram' || f.platform === 'facebook')) {
                const fallbackLinks = f.showMultiple
                    ? [link]
                    : (f.link ? f.link.split(',').map(url => url.trim()).filter(url => url) : []);

                if (fallbackLinks.length > 0) {
                    return fallbackLinks.map(fl => {
                        if (fl.includes('instagram.com') && (fl.includes('/p/') || fl.includes('/reel/') || fl.includes('/tv/'))) {
                            const match = fl.match(/(?:instagram\.com)\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#&]+)/i);
                            if (match && match[1]) {
                                return `
                                <div class="feedback-card" style="background:#111; border:1px solid #222; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 4px 15px rgba(0,0,0,0.2);">
                                    ${buildInstagramEmbedFrame(match[1])}
                                </div>
                                `;
                            }
                        } else if (fl.includes('facebook.com')) {
                            return `
                            <div class="feedback-card" style="background:#111; border:1px solid #222; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 4px 15px rgba(0,0,0,0.2); min-height:480px;">
                                <iframe src="https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(fl)}&show_text=true&width=auto" style="width:100%; height:100%; min-height:480px; border:none; display:block; background:#fff;" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media; picture-in-picture"></iframe>
                            </div>
                            `;
                        }
                        return '';
                    }).join('');
                }
            }

            // Compute links for this card (stored in data-links attribute to avoid HTML encoding issues)
            const allLinksForCard = f.showMultiple
                ? [link]
                : (f.link ? f.link.split(',').map(url => url.trim()).filter(url => url) : []);
            // Escape for HTML attribute (used in data-links)
            const dataLinksAttr = JSON.stringify(allLinksForCard).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

            let mediaHtml = '';
            if (images.length === 1) {
                const match = images[0].match(/(?:instagram\.com)\/(?:p|reel|tv)\/([^/?#&]+)/i);
                const postId = match ? match[1] : '';
                const onerrorAttr = postId ? `onerror="window.handleFeedbackImageError && window.handleFeedbackImageError(this, '${postId}')"` : '';
                mediaHtml = `
                <div onclick="return window.openFeedbackPost(this, event)" class="feedback-media feedback-diaries-single" style="cursor:pointer;">
                     <img src="${images[0]}" referrerpolicy="no-referrer" ${onerrorAttr} class="feedback-img">
                </div>`;
            } else if (images.length > 1) {
                const slideImages = images.map(url => {
                    const match = url.match(/(?:instagram\.com)\/(?:p|reel|tv)\/([^/?#&]+)/i);
                    const postId = match ? match[1] : '';
                    const onerrorAttr = postId ? `onerror="window.handleFeedbackImageError && window.handleFeedbackImageError(this, '${postId}')"` : '';
                    return `
                    <div onclick="return window.openFeedbackPost(this, event)" class="feedback-diaries-slide">
                        <img src="${url}" referrerpolicy="no-referrer" ${onerrorAttr} class="feedback-img">
                    </div>
                    `;
                }).join('');

                const dotHtml = images.map((_, i) => `
                    <div class="dot ${i === 0 ? 'active' : ''}" onclick="event.stopPropagation(); const c = this.closest('.feedback-diaries-carousel').querySelector('.feedback-diaries-slides'); c.scrollTo({left: ${i} * c.offsetWidth, behavior: 'smooth'});"></div>
                `).join('');

                mediaHtml = `
                <div class="feedback-diaries-carousel">
                    <div class="carousel feedback-diaries-slides" onscroll="updateDots(this)">
                        ${slideImages}
                    </div>
                    <div class="feedback-carousel-nav">
                        <button type="button" class="feedback-carousel-btn" aria-label="Previous" onclick="event.stopPropagation(); const c = this.closest('.feedback-diaries-carousel').querySelector('.feedback-diaries-slides'); c.scrollBy({left:-c.offsetWidth, behavior:'smooth'})">
                            <i class="fa fa-chevron-left"></i>
                        </button>
                        <div class="feedback-carousel-dots">
                            ${dotHtml}
                        </div>
                        <button type="button" class="feedback-carousel-btn" aria-label="Next" onclick="event.stopPropagation(); const c = this.closest('.feedback-diaries-carousel').querySelector('.feedback-diaries-slides'); c.scrollBy({left:c.offsetWidth, behavior:'smooth'})">
                            <i class="fa fa-chevron-right"></i>
                        </button>
                    </div>
                </div>`;
            } else {
                mediaHtml = `<div style="padding:15px 15px 0 15px; color:rgba(255, 215, 0, 0.12); font-size:36px; line-height:1; font-family:serif; font-weight:bold;">“</div>`;
            }

            const cardStyle = `background:#111; border:1px solid #222; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 4px 15px rgba(0,0,0,0.2); transition:transform 0.3s, border-color 0.3s;`;

            let platformIcon = '';
            if (f.platform === 'instagram') {
                platformIcon = `<button type="button" class="feedback-post-open-btn feedback-ig-btn" aria-label="Open on Instagram" onclick="return window.openFeedbackPost(this, event)"><i class="fab fa-instagram"></i></button>`;
            } else if (f.platform === 'facebook') {
                platformIcon = `<button type="button" class="feedback-post-open-btn feedback-fb-btn" aria-label="Open on Facebook" onclick="return window.openFeedbackPost(this, event)"><i class="fab fa-facebook"></i></button>`;
            } else {
                platformIcon = `<i class="fa fa-star" style="color:var(--gold); font-size:14px;"></i>`;
            }

            return `
            <div class="feedback-card" style="${cardStyle}" data-links="${dataLinksAttr}" onmouseover="this.style.transform='translateY(-5px)'; this.style.borderColor='var(--gold)';" onmouseout="this.style.transform='none'; this.style.borderColor='#222';">
                ${mediaHtml}
                <div class="feedback-caption">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:13px; font-weight:700; color:var(--gold); font-family:'Outfit', sans-serif; letter-spacing:0.3px;">${f.username ? ((f.platform === 'instagram' || f.platform === 'facebook') && !f.username.startsWith('@') ? '@' + f.username : f.username) : 'Customer'}</span>
                        </div>
                        ${platformIcon}
                    </div>
                    <p style="font-size:12px; ${images.length === 0 ? 'font-style: italic; color: #eee;' : 'color: #ccc;'} line-height:1.6; margin:6px 0 0 0; white-space:pre-wrap; flex:1; font-family:'Outfit', sans-serif; font-weight:300;">${f.text || ''}</p>
                    ${allLinksForCard.length > 0 ? `<button type="button" class="feedback-post-open-btn feedback-view-post-btn" onclick="return window.openFeedbackPost(this, event)">View Post <i class="fa fa-arrow-right" aria-hidden="true"></i></button>` : ''}
                </div>
            </div>
            `;
        });
    }).filter(html => html !== '');
}

function renderFeedbacks() {
    const container = document.getElementById('feedback-section-container');
    if (!container) return;

    const settings = window.diariesSettings || { placement: 'none' };
    if (!window.feedbacks || window.feedbacks.length === 0 || settings.placement !== 'none') {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const grid = document.getElementById('feedback-grid');
    if (!grid) return;

    grid.innerHTML = getFeedbackCardsHtml().join('');

    if (window.instgrm) {
        window.instgrm.Embeds.process();
    } else {
        const scriptId = 'instagram-embed-script';
        if (!document.getElementById(scriptId)) {
            const s = document.createElement('script');
            s.id = scriptId;
            s.async = true;
            s.src = "https://www.instagram.com/embed.js";
            document.body.appendChild(s);
        } else {
            setTimeout(() => {
                if (window.instgrm) window.instgrm.Embeds.process();
            }, 1000);
        }
    }
}

// ── Footer Storefront Render & Navigation ──
let footerPreviousSectionId = 'home';

function renderFooter(explicitMountSection) {
    const settings = window.footerSettings || {
        showFooter: true,
        copyright: "Swagstree",
        footerTemplate: 'classic',
        footerLayout: 'auto',
        aboutText: "Swagstree is your premium fashion destination, offering curated apparel designs, comfortable fits, and modern styles directly to your doorstep. We are committed to high quality manufacturing, premium textiles, and excellent customer support.",
        showGps: true,
        gpsLat: "28.6139",
        gpsLng: "77.2090",
        contactPhone: "8800467686"
    };

    const templateId = typeof normalizeFooterTemplateId === 'function'
        ? normalizeFooterTemplateId(settings.footerTemplate)
        : (settings.footerTemplate || 'classic');
    const layoutId = typeof normalizeFooterLayoutId === 'function'
        ? normalizeFooterLayoutId(settings.footerLayout)
        : (settings.footerLayout || 'auto');
    const copyrightOn = typeof isFooterCopyrightEnabled === 'function'
        ? isFooterCopyrightEnabled(settings)
        : settings.showCopyright === true;
    const luxuryBrandOn = typeof isLuxuryBrandEnabled === 'function'
        ? isLuxuryBrandEnabled(settings)
        : settings.showLuxuryBrand === true;
    const luxuryBrandText = typeof getLuxuryBrandText === 'function'
        ? getLuxuryBrandText(settings)
        : (settings.copyright || '').trim();
    const showLuxuryBrandStrip = templateId === 'luxury' && luxuryBrandOn && !!luxuryBrandText;

    const footerEl = document.getElementById('app-footer');
    if (footerEl) {
        const currentSection = document.querySelector('.section.active');
        const currentId = currentSection ? currentSection.id.replace('-view', '') : 'home';
        const hasVisibleContent = !!settings.showFooter || copyrightOn;
        const shouldShow = hasVisibleContent && (currentId === 'home' || currentId === 'wish');
        const mountSection = (explicitMountSection === 'home' || explicitMountSection === 'wish')
            ? explicitMountSection
            : ((currentId === 'home' || currentId === 'wish')
                ? currentId
                : (footerPreviousSectionId || 'home'));

        footerEl.classList.toggle('hidden', !shouldShow);
        document.body.classList.toggle('footer-hidden', !shouldShow);

        if (typeof applyFooterShellClasses === 'function') {
            applyFooterShellClasses(footerEl, templateId, layoutId);
        }
        footerEl.classList.toggle('footer-copyright-on', copyrightOn);
        footerEl.classList.toggle('footer-copyright-off', !copyrightOn);
        footerEl.classList.toggle('footer-luxury-brand-on', showLuxuryBrandStrip);
        footerEl.classList.toggle('footer-luxury-brand-off', !showLuxuryBrandStrip);

        if (typeof mountStorefrontFooter === 'function') {
            mountStorefrontFooter(footerEl, layoutId, mountSection);
        }

        footerEl.classList.toggle('hidden', !shouldShow);

        const syncPadding = () => {
            if (typeof applyFooterBodyPadding === 'function') {
                applyFooterBodyPadding(footerEl, layoutId);
            }
        };
        syncPadding();
        requestAnimationFrame(syncPadding);
    }

    const linksHost = document.getElementById('footer-links-host');
    if (linksHost) {
        if (!!settings.showFooter) {
            linksHost.innerHTML = typeof buildFooterLinksHtml === 'function'
                ? buildFooterLinksHtml(templateId, settings)
                : linksHost.innerHTML;
            linksHost.style.display = 'block';
        } else {
            linksHost.innerHTML = '';
            linksHost.style.display = 'none';
        }
    }

    // Update Copyright Label
    const copyrightRow = document.getElementById('footer-copyright-row');
    if (copyrightRow) {
        const hideCopyrightRowForLuxury = templateId === 'luxury';
        copyrightRow.style.display = (copyrightOn && !hideCopyrightRowForLuxury) ? 'flex' : 'none';
    }
    const copyrightTextEl = document.getElementById('footer-copyright-text');
    if (copyrightTextEl) {
        copyrightTextEl.innerText = settings.copyright || 'Swagstree';
        copyrightTextEl.style.display = copyrightOn ? '' : 'none';
    }
    const luxuryBrand = document.getElementById('footer-luxury-brand-text');
    if (luxuryBrand) {
        luxuryBrand.textContent = luxuryBrandText;
        const luxuryBrandWrap = luxuryBrand.closest('.footer-luxury-brand');
        if (luxuryBrandWrap) {
            luxuryBrandWrap.style.display = showLuxuryBrandStrip ? '' : 'none';
        }
    }

    // Legacy links row visibility handled via linksHost above

    // Auto-upgrade simple placeholders to premium templates
    const premiumAbout = `<h3>Who We Are</h3><p>Established in 2018, Swag Stree has grown into a premier fashion brand dedicated to delivering trendsetting, high-quality, and comfortable apparel directly to your doorstep. We merge modern styles with premium craftsmanship to create garments that make you look and feel confident.</p><h3>Our Commitment</h3><p>We are driven by three core pillars:</p><ul><li><b>Premium Fabrics:</b> Handpicked materials for maximum durability and comfort.</li><li><b>Exquisite Tailoring:</b> Designed for perfect fits and elegant silhouettes.</li><li><b>Customer First:</b> Quick delivery, seamless returns, and dedicated support.</li></ul>`;
    const premiumPrivacy = `<h3>Privacy Policy & Order Processing</h3><p>At Swag Stree, we value the trust you place in us and are fully committed to protecting your personal information. Below, we explain our data practices and how your order is processed through each status update.</p><h3>1. Information We Collect</h3><p>When you place an order or interact with our app, we collect relevant information to process transactions, including:</p><ul><li>Contact details (Name, phone number, email address).</li><li>Delivery and billing address details.</li></ul><h3>2. Order Status Walkthrough</h3><p>To keep you informed at every stage of your purchase, your order progresses through these standard phases:</p><ul><li><b>Pending:</b> Your order has been successfully placed and is awaiting verification by our team.</li><li><b>Confirmed:</b> The payment/order details have been verified, and we are preparing your items for packaging.</li><li><b>Shipped:</b> Your package has been handed over to our courier partner. Tracking details will be shared via WhatsApp/SMS.</li><li><b>Delivered:</b> Your order has been successfully delivered to your specified shipping address.</li><li><b>Cancelled:</b> The order was cancelled by either the customer or our system due to stock limitations or payment issues.</li></ul><h3>3. Data Security & Storage</h3><p>Your session details, account credentials, and transactions are fully secured. We use Google Firebase for secure user authentication, password hashing, and token encryption. We strictly share shipping info with authorized delivery partners only.</p>`;
    
    let rawAbout = settings.aboutText || '';
    if (!rawAbout || !rawAbout.includes('2018')) {
        rawAbout = premiumAbout;
    }
    
    let rawPrivacy = settings.privacyText || '';
    if (!rawPrivacy || !rawPrivacy.includes('Pending') || !rawPrivacy.includes('Confirmed') || !rawPrivacy.includes('Shipped')) {
        rawPrivacy = premiumPrivacy;
    }

    // Update About Us text description
    const aboutTextEl = document.getElementById('about-content-text');
    if (aboutTextEl) {
        if (/<[a-z][\s\S]*>/i.test(rawAbout)) {
            aboutTextEl.innerHTML = rawAbout;
        } else {
            aboutTextEl.innerHTML = `<p>${rawAbout.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
        }
    }

    // Update GPS Maps & Address Support
    const mapContainer = document.getElementById('about-map-container');
    const mapWrapper = document.getElementById('about-map-iframe-wrapper');
    const addressTextEl = document.getElementById('about-address-text');
    const addressCardEl = document.getElementById('about-address-card');
    
    if (mapContainer && mapWrapper) {
        const hasAddress = !!(settings.contactAddress && settings.contactAddress.trim());
        if (hasAddress) {
            mapContainer.style.display = 'block';
            if (addressTextEl) addressTextEl.textContent = settings.contactAddress.trim();
            if (addressCardEl) addressCardEl.style.display = 'flex';
            
            let mapSrc = '';
            if (settings.gpsQuery && settings.gpsQuery.trim()) {
                const query = settings.gpsQuery.trim();
                if (query.includes('src="') && query.includes('iframe')) {
                    const match = query.match(/src="([^"]+)"/);
                    mapSrc = match ? match[1] : '';
                } else if (query.startsWith('http')) {
                    mapSrc = query;
                } else {
                    mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
                }
            } else if (settings.gpsLat && settings.gpsLng) {
                const lat = encodeURIComponent(settings.gpsLat.trim());
                const lng = encodeURIComponent(settings.gpsLng.trim());
                mapSrc = `https://maps.google.com/maps?q=${lat},${lng}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
            } else {
                // Default to using address text for search query directly!
                mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(settings.contactAddress.trim())}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
            }
            
            if (settings.showGps !== false && mapSrc) {
                mapWrapper.style.display = 'block';
                mapWrapper.innerHTML = `<iframe 
                    width="100%" 
                    height="100%" 
                    frameborder="0" 
                    style="border:0;" 
                    src="${mapSrc}" 
                    allowfullscreen>
                </iframe>`;
                // Ensure heading "Find Us On Map" sibling p element is visible
                const mapHeading = mapWrapper.previousElementSibling;
                if (mapHeading) mapHeading.style.display = 'block';
            } else {
                mapWrapper.style.display = 'none';
                mapWrapper.innerHTML = '';
                const mapHeading = mapWrapper.previousElementSibling;
                if (mapHeading) mapHeading.style.display = 'none';
            }
        } else {
            // Hide the entire location container if no address is set
            mapContainer.style.display = 'none';
            mapWrapper.innerHTML = '';
        }
    }

    // Update Contact Us Direct Link
    const contactLink = document.getElementById('footer-contact-link');
    if (contactLink) {
        const phone = settings.contactPhone ? settings.contactPhone.trim() : '8800467686';
        contactLink.href = "tel:" + phone;
    }

    // Update Privacy Policy content area
    const privacyContentEl = document.getElementById('privacy-content-text');
    if (privacyContentEl) {
        if (/<[a-z][\s\S]*>/i.test(rawPrivacy)) {
            privacyContentEl.innerHTML = rawPrivacy;
        } else {
            const paragraphs = rawPrivacy.split('\n\n').map(p => {
                const line = p.trim().replace(/\n/g, '<br>');
                if (line.startsWith('1.') || line.startsWith('2.') || line.startsWith('3.')) {
                    return `<p><strong>${line}</strong></p>`;
                }
                return `<p>${line}</p>`;
            }).join('');
            privacyContentEl.innerHTML = paragraphs || `<p>No privacy policy configured.</p>`;
        }
    }
}
window.renderFooter = renderFooter;

let footerResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(footerResizeTimer);
    footerResizeTimer = setTimeout(() => {
        if (typeof renderFooter === 'function') renderFooter();
    }, 150);
});

function openFooterPage(pageId) {
    // Save previous active section to return back to it
    const activeSection = document.querySelector('.section.active');
    if (activeSection && activeSection.id !== 'about-view' && activeSection.id !== 'privacy-view' && activeSection.id !== 'promo-view') {
        footerPreviousSectionId = activeSection.id.replace('-view', '');
    }

    // Hide all sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));

    // Show selected footer view section
    const targetView = document.getElementById(pageId + '-view');
    if (targetView) {
        targetView.classList.add('active');
        window.scrollTo(0, 0);
    }
}
window.openFooterPage = openFooterPage;

function closeFooterPage() {
    // Restore previous active section
    if (typeof navigateTo === 'function') {
        navigateTo(footerPreviousSectionId);
    } else {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const fallback = document.getElementById(footerPreviousSectionId + '-view');
        if (fallback) fallback.classList.add('active');
    }
}
function getActive360Images(p) {
    const isEnabled = window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer;
    if (!isEnabled) return null;

    const v = getSelectedVariant(p);
    if (v && v.is360 && v.images && v.images.length >= 2) {
        return v.images;
    }
    if (p.is360 && p.images && p.images.length >= 2) {
        return p.images;
    }
    return null;
}
window.getActive360Images = getActive360Images;



function closeAnnouncementModal() {
    const modal = document.getElementById('announcement-modal');
    if (modal) modal.style.display = 'none';
    closeAnnouncementImageZoom();
    updateAnnouncementBellUI();
}
window.closeAnnouncementModal = closeAnnouncementModal;

function isValidAnnouncementImageUrl(url) {
    const img = String(url || '').trim();
    return img && img !== 'null' && img !== 'undefined'
        && (img.startsWith('http://') || img.startsWith('https://'));
}

function getAnnouncementImages(ann) {
    if (!ann) return [];
    if (Array.isArray(ann.images) && ann.images.length) {
        return ann.images.map(u => String(u || '').trim()).filter(isValidAnnouncementImageUrl);
    }
    const legacy = String(ann.image || '').trim();
    return isValidAnnouncementImageUrl(legacy) ? [legacy] : [];
}
window.getAnnouncementImages = getAnnouncementImages;

let announcementZoomState = {
    images: [],
    index: 0,
    scale: 1,
    translateX: 0,
    translateY: 0,
    pinching: false,
    pinchStartDistance: 0,
    pinchStartScale: 1,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0
};

function applyAnnouncementZoomTransform() {
    const img = document.getElementById('announcement-lightbox-img');
    if (!img) return;
    const { scale, translateX, translateY } = announcementZoomState;
    img.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

function updateAnnouncementZoomUi() {
    const counter = document.getElementById('announcement-lightbox-counter');
    const prevBtn = document.querySelector('.announcement-lightbox-prev');
    const nextBtn = document.querySelector('.announcement-lightbox-next');
    const total = announcementZoomState.images.length;
    const current = total ? announcementZoomState.index + 1 : 0;

    if (counter) counter.textContent = total ? `${current} / ${total}` : '0 / 0';
    if (prevBtn) prevBtn.style.display = total > 1 ? 'grid' : 'none';
    if (nextBtn) nextBtn.style.display = total > 1 ? 'grid' : 'none';
}

function resetAnnouncementZoomView() {
    announcementZoomState.scale = 1;
    announcementZoomState.translateX = 0;
    announcementZoomState.translateY = 0;
    applyAnnouncementZoomTransform();
}

function openMediaZoomLightbox(images, startIndex) {
    const list = (images || []).filter(Boolean);
    if (!list.length) return;

    announcementZoomState.images = list;
    announcementZoomState.index = Math.max(0, Math.min(startIndex || 0, list.length - 1));
    resetAnnouncementZoomView();

    const lightbox = document.getElementById('announcement-image-lightbox');
    const img = document.getElementById('announcement-lightbox-img');
    if (img) img.src = list[announcementZoomState.index];
    if (lightbox) lightbox.style.display = 'flex';
    updateAnnouncementZoomUi();
}
window.openMediaZoomLightbox = openMediaZoomLightbox;

function openProductDetailImageZoom(index, event) {
    if (event) event.stopPropagation();
    const images = window.detailGalleryImages || [];
    if (!images.length) return;
    window.detailGalleryActiveIndex = Math.max(0, Math.min(index || 0, images.length - 1));
    openMediaZoomLightbox(images, window.detailGalleryActiveIndex);
}
window.openProductDetailImageZoom = openProductDetailImageZoom;

function openAnnouncementImageZoom(announcementId, imageIndex, event) {
    if (event) event.stopPropagation();

    const ann = (window.activeAnnouncements || []).find(a => a.id === announcementId);
    const images = getAnnouncementImages(ann);
    if (!images.length) return;

    openMediaZoomLightbox(images, imageIndex || 0);
}
window.openAnnouncementImageZoom = openAnnouncementImageZoom;

function closeAnnouncementImageZoom(event) {
    if (event) {
        const target = event.target;
        const isBackdrop = target && target.id === 'announcement-image-lightbox';
        const isCloseBtn = target && target.classList && target.classList.contains('announcement-lightbox-close');
        if (!isBackdrop && !isCloseBtn) return;
        event.stopPropagation();
    }

    const lightbox = document.getElementById('announcement-image-lightbox');
    if (lightbox) lightbox.style.display = 'none';
    const img = document.getElementById('announcement-lightbox-img');
    if (img) img.src = '';
    announcementZoomState.images = [];
    resetAnnouncementZoomView();
}
window.closeAnnouncementImageZoom = closeAnnouncementImageZoom;

function announcementImageZoomNav(delta, event) {
    if (event) event.stopPropagation();
    const total = announcementZoomState.images.length;
    if (total <= 1) return;

    announcementZoomState.index = (announcementZoomState.index + delta + total) % total;
    const img = document.getElementById('announcement-lightbox-img');
    if (img) img.src = announcementZoomState.images[announcementZoomState.index];
    resetAnnouncementZoomView();
    updateAnnouncementZoomUi();
}
window.announcementImageZoomNav = announcementImageZoomNav;

function setAnnouncementZoomScale(delta, event) {
    if (event) event.stopPropagation();
    announcementZoomState.scale = Math.min(4, Math.max(1, announcementZoomState.scale + delta));
    if (announcementZoomState.scale === 1) {
        announcementZoomState.translateX = 0;
        announcementZoomState.translateY = 0;
    }
    applyAnnouncementZoomTransform();
}
window.setAnnouncementZoomScale = setAnnouncementZoomScale;

function resetAnnouncementZoomScale(event) {
    if (event) event.stopPropagation();
    resetAnnouncementZoomView();
}
window.resetAnnouncementZoomScale = resetAnnouncementZoomScale;

function initAnnouncementImageZoomGestures() {
    const stage = document.getElementById('announcement-lightbox-stage');
    const img = document.getElementById('announcement-lightbox-img');
    if (!stage || !img || stage.dataset.zoomBound === '1') return;
    stage.dataset.zoomBound = '1';

    stage.addEventListener('wheel', (e) => {
        if (document.getElementById('announcement-image-lightbox')?.style.display === 'none') return;
        e.preventDefault();
        setAnnouncementZoomScale(e.deltaY < 0 ? 0.15 : -0.15);
    }, { passive: false });

    stage.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (announcementZoomState.scale > 1) resetAnnouncementZoomView();
        else {
            announcementZoomState.scale = 2;
            applyAnnouncementZoomTransform();
        }
    });

    stage.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            announcementZoomState.pinching = true;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            announcementZoomState.pinchStartDistance = Math.hypot(dx, dy);
            announcementZoomState.pinchStartScale = announcementZoomState.scale;
        } else if (e.touches.length === 1 && announcementZoomState.scale > 1) {
            announcementZoomState.dragging = true;
            announcementZoomState.dragStartX = e.touches[0].clientX;
            announcementZoomState.dragStartY = e.touches[0].clientY;
            announcementZoomState.dragOriginX = announcementZoomState.translateX;
            announcementZoomState.dragOriginY = announcementZoomState.translateY;
        }
    }, { passive: true });

    stage.addEventListener('touchmove', (e) => {
        if (announcementZoomState.pinching && e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const distance = Math.hypot(dx, dy);
            if (announcementZoomState.pinchStartDistance > 0) {
                const ratio = distance / announcementZoomState.pinchStartDistance;
                announcementZoomState.scale = Math.min(4, Math.max(1, announcementZoomState.pinchStartScale * ratio));
                applyAnnouncementZoomTransform();
            }
        } else if (announcementZoomState.dragging && e.touches.length === 1) {
            announcementZoomState.translateX = announcementZoomState.dragOriginX + (e.touches[0].clientX - announcementZoomState.dragStartX);
            announcementZoomState.translateY = announcementZoomState.dragOriginY + (e.touches[0].clientY - announcementZoomState.dragStartY);
            applyAnnouncementZoomTransform();
        }
    }, { passive: true });

    const endTouch = () => {
        announcementZoomState.pinching = false;
        announcementZoomState.dragging = false;
        if (announcementZoomState.scale < 1) {
            resetAnnouncementZoomView();
        }
    };
    stage.addEventListener('touchend', endTouch, { passive: true });
    stage.addEventListener('touchcancel', endTouch, { passive: true });

    img.addEventListener('mousedown', (e) => {
        if (announcementZoomState.scale <= 1) return;
        e.preventDefault();
        announcementZoomState.dragging = true;
        announcementZoomState.dragStartX = e.clientX;
        announcementZoomState.dragStartY = e.clientY;
        announcementZoomState.dragOriginX = announcementZoomState.translateX;
        announcementZoomState.dragOriginY = announcementZoomState.translateY;
    });
    window.addEventListener('mousemove', (e) => {
        if (!announcementZoomState.dragging) return;
        announcementZoomState.translateX = announcementZoomState.dragOriginX + (e.clientX - announcementZoomState.dragStartX);
        announcementZoomState.translateY = announcementZoomState.dragOriginY + (e.clientY - announcementZoomState.dragStartY);
        applyAnnouncementZoomTransform();
    });
    window.addEventListener('mouseup', () => {
        announcementZoomState.dragging = false;
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnnouncementImageZoomGestures);
} else {
    initAnnouncementImageZoomGestures();
}

let currentAnnouncementIndex = 0;

function openAnnouncementModal() {
    const list = window.activeAnnouncements || [];
    if (list.length === 0) {
        showToast("No active announcements.");
        return;
    }
    currentAnnouncementIndex = 0;
    const modal = document.getElementById('announcement-modal');
    if (modal) modal.style.display = 'flex';
    renderAnnouncementSlide();
}
window.openAnnouncementModal = openAnnouncementModal;

window.expandedAnnouncementId = null;

function toggleAnnouncementExpand(id, event) {
    if (event) event.stopPropagation();
    if (window.expandedAnnouncementId === id) {
        window.expandedAnnouncementId = null;
    } else {
        window.expandedAnnouncementId = id;
        
        // Auto-mark as read when clicked to expand
        let readIds = [];
        try {
            readIds = JSON.parse(localStorage.getItem('swagstree_read_announcements') || '[]');
        } catch(e) {
            readIds = [];
        }
        if (!readIds.includes(id)) {
            readIds.push(id);
            localStorage.setItem('swagstree_read_announcements', JSON.stringify(readIds));
        }
    }
    renderAnnouncementSlide();
    updateAnnouncementBellUI();
}
window.toggleAnnouncementExpand = toggleAnnouncementExpand;

function renderAnnouncementSlide() {
    const list = window.activeAnnouncements || [];
    const container = document.getElementById('announcement-slides-container');
    if (!container) return;
    
    if (list.length === 0) {
        container.innerHTML = `<p style="color:#666; text-align:center; font-size:12px; padding:20px 0;">No active announcements.</p>`;
        return;
    }
    
    let readIds = [];
    try {
        readIds = JSON.parse(localStorage.getItem('swagstree_read_announcements') || '[]');
    } catch(e) {
        readIds = [];
    }
    
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; max-height:400px; overflow-y:auto; padding-right:4px;">
            ${list.map(ann => {
                const isUnread = !readIds.includes(ann.id);
                const isExpanded = window.expandedAnnouncementId === ann.id;
                const dateStr = ann.timestamp ? new Date(ann.timestamp.seconds * 1000).toLocaleDateString([], {month: 'short', day: 'numeric'}) : 'Just now';
                const images = getAnnouncementImages(ann);
                const imagesHtml = images.length ? `
                        <div class="announcement-images-gallery">
                            ${images.map((url, idx) => `
                                <button type="button" class="announcement-gallery-thumb" onclick="openAnnouncementImageZoom('${ann.id}', ${idx}, event)" title="Tap to zoom">
                                    <img src="${url}" alt="Announcement image ${idx + 1}" loading="lazy">
                                    <span class="announcement-gallery-zoom-hint"><i class="fa fa-magnifying-glass-plus"></i></span>
                                </button>
                            `).join('')}
                        </div>
                ` : '';
                
                return `
                    <div style="border: 1px solid ${isUnread ? 'rgba(255,215,0,0.2)' : '#222'}; background:${isUnread ? 'rgba(255,215,0,0.02)' : '#111'}; border-radius:10px; overflow:hidden; transition:all 0.2s; display:flex; flex-direction:column;">
                        <!-- Email Header Row -->
                        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px; cursor:pointer;" onclick="toggleAnnouncementExpand('${ann.id}', event)">
                            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                                <i class="fa ${isUnread ? 'fa-envelope' : 'fa-envelope-open'}" 
                                   style="color:${isUnread ? '#ff4757' : '#666'}; font-size:13px; flex-shrink:0; cursor:pointer; padding: 4px;" 
                                   onclick="toggleAnnouncementReadState('${ann.id}', event)" 
                                   title="Mark as ${isUnread ? 'Read' : 'Unread'}"></i>
                                <span style="font-size:12px; color:${isUnread ? '#fff' : '#bbb'}; font-weight:${isUnread ? '700' : '400'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1;">
                                    ${ann.message}
                                </span>
                            </div>
                            <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
                                <span style="font-size:10px; color:#666;">${dateStr}</span>
                                <i class="fa ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}" style="color:#888; font-size:10px;"></i>
                            </div>
                        </div>
                        
                        <!-- Expanded Details -->
                        ${isExpanded ? `
                        <div style="padding: 12px; background:#0a0a0a; border-top:1px solid #222; display:flex; flex-direction:column; gap:10px;">
                            ${imagesHtml}
                            <p style="color:#eee; font-size:12px; line-height:1.6; margin:0; word-break:break-word; white-space:pre-wrap; text-align:left;">${ann.message}</p>
                            
                            <div style="display:flex; align-items:center; justify-content:space-between; margin-top:5px; border-top:1px dashed #222; padding-top:8px;">
                                <span style="font-size:9px; color:#555;">${ann.timestamp ? new Date(ann.timestamp.seconds * 1000).toLocaleString() : 'Just now'}</span>
                                <button onclick="toggleAnnouncementReadState('${ann.id}', event)" style="background:none; border:none; color:var(--gold); font-size:10px; font-weight:700; cursor:pointer; text-decoration:underline; outline:none; padding:0;">
                                    Mark as ${isUnread ? 'Read' : 'Unread'}
                                </button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    const controls = document.getElementById('announcement-controls');
    if (controls) controls.style.display = 'none';
}

function toggleAnnouncementReadState(id, event) {
    if (event) event.stopPropagation();
    let readIds = [];
    try {
        readIds = JSON.parse(localStorage.getItem('swagstree_read_announcements') || '[]');
    } catch(e) {
        readIds = [];
    }
    
    if (readIds.includes(id)) {
        readIds = readIds.filter(x => x !== id);
    } else {
        readIds.push(id);
    }
    localStorage.setItem('swagstree_read_announcements', JSON.stringify(readIds));
    
    renderAnnouncementSlide();
    updateAnnouncementBellUI();
}
window.toggleAnnouncementReadState = toggleAnnouncementReadState;

function updateAnnouncementBellUI() {
    const bellConfigs = [
        { btnId: 'announcement-bell-btn', badgeId: 'announcement-badge' },
        { btnId: 'wish-announcement-bell-btn', badgeId: 'wish-announcement-badge' }
    ];

    const list = window.activeAnnouncements || [];
    let readIds = [];
    try {
        readIds = JSON.parse(localStorage.getItem('swagstree_read_announcements') || '[]');
    } catch (e) {
        readIds = [];
    }
    const unread = list.filter(ann => !readIds.includes(ann.id));

    bellConfigs.forEach(({ btnId, badgeId }) => {
        const btn = document.getElementById(btnId);
        if (!btn || btn.style.display === 'none') return;
        const bellIcon = btn.querySelector('i');
        const badge = document.getElementById(badgeId);
        if (!bellIcon) return;

        if (list.length === 0) {
            bellIcon.style.color = '#ffd700';
            bellIcon.style.opacity = '1.0';
            if (badge) {
                badge.style.display = 'none';
                badge.textContent = '';
            }
            return;
        }

        if (unread.length > 0) {
            bellIcon.style.color = '#ff4757';
            bellIcon.style.opacity = '1.0';
            if (badge) {
                badge.textContent = unread.length > 9 ? '9+' : String(unread.length);
                badge.style.display = 'flex';
            }
        } else {
            bellIcon.style.color = '#ffd700';
            bellIcon.style.opacity = '1.0';
            if (badge) {
                badge.style.display = 'none';
                badge.textContent = '';
            }
        }
    });
}
window.updateAnnouncementBellUI = updateAnnouncementBellUI;


