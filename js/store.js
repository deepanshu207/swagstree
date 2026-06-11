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

if (typeof window.displayedProductsLimit === 'undefined') window.displayedProductsLimit = (typeof window.productsPageLimitSetting !== 'undefined' ? window.productsPageLimitSetting : 20);
if (typeof window.displayedWishlistLimit === 'undefined') window.displayedWishlistLimit = (typeof window.productsPageLimitSetting !== 'undefined' ? window.productsPageLimitSetting : 20);
if (typeof window.displayedOrdersLimit === 'undefined') window.displayedOrdersLimit = 20;
if (typeof window.ordersUnsubscribe === 'undefined') window.ordersUnsubscribe = null;
if (typeof window.deepLinkHandled === 'undefined') window.deepLinkHandled = false;

if (typeof formatColorName === 'undefined') {
    // We map custom/common names to hex codes for the preview bubble,
    // and also return friendly display names.
    const customColorsMap = {
        'mehndi green': { hex: '#4b5320', name: 'Mehendi Green' }, // olive-drab/army green
        'mehndigreen': { hex: '#4b5320', name: 'Mehendi Green' },
        'mehendi green': { hex: '#4b5320', name: 'Mehendi Green' },
        'mehendigreen': { hex: '#4b5320', name: 'Mehendi Green' },
        'light green': { hex: '#90ee90', name: 'Light Green' },
        'lightgreen': { hex: '#90ee90', name: 'Light Green' },
        'dark green': { hex: '#006400', name: 'Dark Green' },
        'darkgreen': { hex: '#006400', name: 'Dark Green' },
        'navy blue': { hex: '#000080', name: 'Navy Blue' },
        'navyblue': { hex: '#000080', name: 'Navy Blue' },
        'dusty pink': { hex: '#dcaebb', name: 'Dusty Pink' },
        'dustypink': { hex: '#dcaebb', name: 'Dusty Pink' },
        'light blue': { hex: '#add8e6', name: 'Light Blue' },
        'lightblue': { hex: '#add8e6', name: 'Light Blue' },
        'pastel pink': { hex: '#ffd1dc', name: 'Pastel Pink' },
        'pastelpink': { hex: '#ffd1dc', name: 'Pastel Pink' },
        'wine': { hex: '#722f37', name: 'Wine' },
        'burgundy': { hex: '#800020', name: 'Burgundy' },
        'olive': { hex: '#808000', name: 'Olive' },
        'mustard': { hex: '#ffdb58', name: 'Mustard' },
        'rust': { hex: '#b7410e', name: 'Rust' },
        'peach': { hex: '#ffcba4', name: 'Peach' },
        'coral': { hex: '#ff7f50', name: 'Coral' },
        'lavender': { hex: '#e6e6fa', name: 'Lavender' },
        'mauve': { hex: '#e0b0ff', name: 'Mauve' },
        'mint': { hex: '#3eb489', name: 'Mint' },
        'cream': { hex: '#fffdd0', name: 'Cream' },
        'beige': { hex: '#f5f5dc', name: 'Beige' },
        'khaki': { hex: '#c3b091', name: 'Khaki' }
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
    showDetail(id);
}

// 1. DATA LOADING
function loadData() {
    db.collection("products").onSnapshot(snap => {
        products = snap.docs.map(doc => {
            const p = { ...doc.data(), id: doc.id };
            p.normalizedVariants = normalizeVariants(p);
            return p;
        });
        window.productsLoaded = true;
        renderStore();
        renderFilters();
        if (typeof renderAdmin === "function") renderAdmin();
        checkDeepLink(); // open shared product link if present
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
}

function renderStore() {
    renderProducts(products, 'product-grid');
    renderProducts(products.filter(p => wishlist.includes(p.id)), 'wish-grid');
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

function renderProducts(items, targetId) {
    const container = document.getElementById(targetId);
    if (!container) return;

    if (targetId === 'product-grid') {
        const loadMoreBtnContainer = document.getElementById('load-more-container');
        const countContainer = document.getElementById('product-count');

        if (items.length === 0 && !window.productsLoaded) {
            if (countContainer) countContainer.style.display = 'none';
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
                countContainer.innerHTML = '0 Products';
                countContainer.style.display = 'inline-flex';
            }
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
            countContainer.innerHTML = `Showing ${visible} of ${items.length} Products`;
            countContainer.style.display = 'inline-flex';
        }

        const settings = window.diariesSettings || { placement: 'last', showSection: true };
        const feedbackCards = (typeof getFeedbackCardsHtml === 'function' && settings.showSection !== false) ? getFeedbackCardsHtml() : [];

        function getDiariesSectionHtml(cards) {
            if (!cards || cards.length === 0) return '';
            const sectionTitle = settings.sectionTitle || '✨ CUSTOMER DIARIES';
            const sectionSubtitle = settings.sectionSubtitle || 'See how our Swag Fam is styling Swag Stree! Tag us on Instagram to get featured.';
            return `
            <div class="feedback-section-container-in-grid" style="grid-column: 1 / -1; margin-top:20px; margin-bottom:20px; padding-top:20px; border-top:1px solid #222; border-bottom:1px solid #222; width: 100%;">
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

        if (items.length === 0 && !window.productsLoaded) {
            if (countContainer) countContainer.style.display = 'none';
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
                countContainer.innerHTML = '0 Items';
                countContainer.style.display = 'inline-flex';
            }
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
            countContainer.innerHTML = `Showing ${visible} of ${items.length} Items`;
            countContainer.style.display = 'inline-flex';
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

function showDetail(id) {
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
        selectedSize = uniqueSizes[0];

        sizeSelector.innerHTML = uniqueSizes.map(sz => `
            <div class="size-chip ${sz === selectedSize ? 'active' : ''}" onclick="selectDetailSize('${sz}', this)">${sz === 'Standard' ? 'Free Size' : sz}</div>
        `).join('');
    }

    renderDetailColors(p);
    renderDetailPatterns(p);
    updateVariantUI(p);

    document.getElementById('detail-view').style.display = 'block';
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
    }
}

function renderDetailColors(p) {
    const colorsContainer = document.getElementById('det-colors-container');
    const colorSelector = document.getElementById('detail-color-selector');
    if (!colorsContainer || !colorSelector) return;

    const colors = [...new Set(p.normalizedVariants.filter(v => v.size === selectedSize).map(v => v.color).filter(c => c))];

    if (colors.length === 0) {
        colorsContainer.style.display = 'none';
        selectedColor = '';
    } else {
        colorsContainer.style.display = 'block';
        // Only reset color if the current selectedColor isn't available for this size
        if (!colors.includes(selectedColor)) selectedColor = colors[0];

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

function updateVariantUI(p) {
    const v = getSelectedVariant(p);

    // Update Price
    const priceToDisplay = (v && v.price !== null && v.price !== undefined) ? v.price : p.price;
    document.getElementById('det-price').innerText = `₹${priceToDisplay}`;

    // Update Images
    let imagesToDisplay = [];
    let mainImages = [];
    let variantImages = [];

    // 1. Variant Images (Shown in details gallery if not hidden for this specific variant)
    if (v && v.images && v.images.length > 0 && !v.hideDetailsGallery) {
        variantImages.push(...v.images);
    }

    // 2. Main Images (Shown if not hidden at product level)
    if (!p.hideMainDetailsCarousel) {
        if (p.images && p.images.length > 0) {
            mainImages.push(...p.images);
        }
    }

    // Position
    if (p.mainImagesPosition === 'end') {
        imagesToDisplay = [...variantImages, ...mainImages];
    } else {
        imagesToDisplay = [...mainImages, ...variantImages];
    }

    // Remove duplicates
    imagesToDisplay = [...new Set(imagesToDisplay)];

    document.getElementById('det-gallery').innerHTML = imagesToDisplay.length ? imagesToDisplay.map(img => `<img src="${img}">`).join('') : (p.hideNoImagePlaceholder ? '' : '<img src="https://placehold.co/400x400/222/FFF?text=No+Image">');
    document.getElementById('det-indicators').innerHTML = imagesToDisplay.length > 1 ? imagesToDisplay.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}"></div>`).join('') : '';

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
        btn.style.padding = "0";
        btn.style.background = "var(--gold)";
        btn.style.color = "#000";
        btn.disabled = false;
        btn.innerHTML = `
            <div style="display:flex; width:100%; align-items:center; justify-content:space-between; font-size:24px;">
                <div style="padding:15px 30px; cursor:pointer; flex:1; text-align:center; background:rgba(0,0,0,0.08);" onclick="event.stopPropagation(); updateVariantCartQty('${p.id}', '${v.size}', '${v.color}', '${window.selectedPattern || ''}', -1)">-</div>
                <div style="padding:15px; flex:2; font-size:16px; text-align:center; white-space:nowrap; font-weight:900;">${qtyInCart} IN BAG</div>
                <div style="padding:15px 30px; cursor:pointer; flex:1; text-align:center; background:rgba(0,0,0,0.08);" onclick="event.stopPropagation(); updateVariantCartQty('${p.id}', '${v.size}', '${v.color}', '${window.selectedPattern || ''}', 1)">+</div>
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
}

function closeDetail() {
    document.getElementById('detail-view').style.display = 'none';
    window.history.replaceState({}, '', window.location.pathname);
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
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${id}`;
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

function updateDots(el) {
    const idx = Math.round(el.scrollLeft / el.offsetWidth);
    const dots = el.parentElement.querySelectorAll('.dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
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
}

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
            const isWhite = colorVal.toLowerCase() === '#ffffff' || colorVal.toLowerCase() === 'white';
            const indicatorBorder = isWhite ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.15)';
            const colorPreview = `<span class="color-indicator" style="background:${colorVal}; border:${indicatorBorder};"></span>`;
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

    document.querySelectorAll('#filter-slider .size-chip, #filter-slider .color-chip').forEach(c => c.classList.remove('active'));
    applySortAndFilter();
}

function applySortAndFilter() {
    const sort = document.getElementById('sort-logic').value;
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

    if (sort === 'low') filtered.sort((a, b) => a.price - b.price);
    if (sort === 'high') filtered.sort((a, b) => b.price - a.price);
    renderProducts(filtered, 'product-grid');
}

function changeSortLogic() {
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

function loadMoreWishlist() {
    displayedWishlistLimit += productsPageLimitSetting;
    renderStore();
}

window.handleFeedbackImageError = function (imgEl, postId) {
    if (!postId) return;
    const container = imgEl.parentElement;
    if (!container) return;

    container.innerHTML = `
        <iframe src="https://www.instagram.com/p/${postId}/embed" style="width:100%; height:100%; border:none; display:block; background:#fff;" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media"></iframe>
    `;

    if (container.style.aspectRatio) {
        container.style.aspectRatio = 'auto';
        container.style.height = '460px';
    }
};

window.openFeedbackPost = function (el, allLinks) {
    if (!allLinks || allLinks.length === 0) return;

    const card = el.closest('.feedback-card');
    let activeIdx = 0;
    if (card) {
        const carousel = card.querySelector('.carousel');
        if (carousel) {
            const scrollLeft = carousel.scrollLeft;
            const offsetWidth = carousel.offsetWidth || 1;
            activeIdx = Math.round(scrollLeft / offsetWidth);
        }
    }

    const targetLink = allLinks[activeIdx] || allLinks[0];
    if (targetLink) {
        window.open(targetLink, '_blank');
    }
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
                                    <div style="position:relative; width:100%; height:0; padding-bottom:calc(100% + 60px); overflow:hidden; background:#fff;">
                                        <iframe src="https://www.instagram.com/p/${match[1]}/embed" style="position:absolute; top:0; left:0; width:100%; height:460px; border:none;" frameborder="0" scrolling="no" allowtransparency="true" allow="encrypted-media"></iframe>
                                    </div>
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

            let mediaHtml = '';
            if (images.length === 1) {
                const match = images[0].match(/(?:instagram\.com)\/(?:p|reel|tv)\/([^/?#&]+)/i);
                const postId = match ? match[1] : '';
                const onerrorAttr = postId ? `onerror="window.handleFeedbackImageError && window.handleFeedbackImageError(this, '${postId}')"` : '';
                mediaHtml = `
                <div style="position:relative; overflow:hidden; border-radius:10px 10px 0 0; aspect-ratio: 1/1; background:#000; border-bottom: 1px solid #222;">
                     <img src="${images[0]}" referrerpolicy="no-referrer" ${onerrorAttr} style="width:100%; height:100%; object-fit:cover; transition:transform 0.3s;" class="feedback-img">
                </div>`;
            } else if (images.length > 1) {
                const slideImages = images.map(url => {
                    const match = url.match(/(?:instagram\.com)\/(?:p|reel|tv)\/([^/?#&]+)/i);
                    const postId = match ? match[1] : '';
                    const onerrorAttr = postId ? `onerror="window.handleFeedbackImageError && window.handleFeedbackImageError(this, '${postId}')"` : '';
                    return `
                    <div style="width:100%; height:100%; flex-shrink:0; position:relative; scroll-snap-align:center;">
                        <img src="${url}" referrerpolicy="no-referrer" ${onerrorAttr} style="width:100%; height:100%; object-fit:cover;">
                    </div>
                    `;
                }).join('');

                const dotHtml = images.map((_, i) => `
                    <div class="dot ${i === 0 ? 'active' : ''}" style="cursor:pointer; pointer-events:auto;" onclick="event.stopPropagation(); const c = this.parentElement.previousElementSibling; c.scrollTo({left: ${i} * c.offsetWidth, behavior: 'smooth'});"></div>
                `).join('');

                mediaHtml = `
                <div class="carousel-box" style="border-radius:10px 10px 0 0; border-bottom: 1px solid #222;">
                    <div class="carousel" onscroll="updateDots(this)">
                        ${slideImages}
                    </div>
                    <div style="position:absolute; top:50%; left:8px; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; z-index:2; border:1px solid rgba(255,255,255,0.2);" onclick="event.stopPropagation(); const c = this.parentElement.querySelector('.carousel'); c.scrollBy({left:-c.offsetWidth, behavior:'smooth'})">&lt;</div>
                    <div style="position:absolute; top:50%; right:8px; transform:translateY(-50%); background:rgba(0,0,0,0.6); color:#fff; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:10px; z-index:2; border:1px solid rgba(255,255,255,0.2);" onclick="event.stopPropagation(); const c = this.parentElement.querySelector('.carousel'); c.scrollBy({left:c.offsetWidth, behavior:'smooth'})">&gt;</div>
                    <div class="indicators">
                        ${dotHtml}
                    </div>
                </div>`;
            } else {
                mediaHtml = `<div style="padding:15px 15px 0 15px; color:rgba(255, 215, 0, 0.12); font-size:36px; line-height:1; font-family:serif; font-weight:bold;">“</div>`;
            }

            const cardStyle = `background:#111; border:1px solid #222; border-radius:12px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 4px 15px rgba(0,0,0,0.2); transition:transform 0.3s, border-color 0.3s;`;

            const allLinksForCard = f.showMultiple
                ? [link]
                : (f.link ? f.link.split(',').map(url => url.trim()).filter(url => url) : []);
            const serializedLinks = JSON.stringify(allLinksForCard).replace(/"/g, '&quot;');

            let platformIcon = '';
            if (f.platform === 'instagram') {
                platformIcon = `<i class="fab fa-instagram" style="color:#E1306C; font-size:16px; cursor:pointer;" onclick="event.stopPropagation(); window.openFeedbackPost(this, ${serializedLinks})"></i>`;
            } else if (f.platform === 'facebook') {
                platformIcon = `<i class="fab fa-facebook" style="color:#1877F2; font-size:16px; cursor:pointer;" onclick="event.stopPropagation(); window.openFeedbackPost(this, ${serializedLinks})"></i>`;
            } else {
                platformIcon = `<i class="fa fa-star" style="color:var(--gold); font-size:14px;"></i>`;
            }

            return `
            <div class="feedback-card" style="${cardStyle}" onmouseover="this.style.transform='translateY(-5px)'; this.style.borderColor='var(--gold)';" onmouseout="this.style.transform='none'; this.style.borderColor='#222';">
                ${mediaHtml}
                <div style="padding:15px; display:flex; flex-direction:column; gap:8px; flex:1;">
                    <div style="display:flex; align-items:center; justify-content:space-between;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-size:13px; font-weight:700; color:var(--gold); font-family:'Outfit', sans-serif; letter-spacing:0.3px;">${f.username ? ((f.platform === 'instagram' || f.platform === 'facebook') && !f.username.startsWith('@') ? '@' + f.username : f.username) : 'Customer'}</span>
                        </div>
                        ${platformIcon}
                    </div>
                    <p style="font-size:12px; ${images.length === 0 ? 'font-style: italic; color: #eee;' : 'color: #ccc;'} line-height:1.6; margin:6px 0 0 0; white-space:pre-wrap; flex:1; font-family:'Outfit', sans-serif; font-weight:300;">${f.text || ''}</p>
                    ${allLinksForCard.length > 0 ? `<div onclick="event.stopPropagation(); window.openFeedbackPost(this, ${serializedLinks})" style="font-size:10px; color:var(--gold); display:flex; align-items:center; gap:4px; font-weight:bold; margin-top:5px; text-transform:uppercase; letter-spacing:0.5px; font-family:'Outfit', sans-serif; cursor:pointer;">View Post <i class="fa fa-arrow-right" style="font-size:8px;"></i></div>` : ''}
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
