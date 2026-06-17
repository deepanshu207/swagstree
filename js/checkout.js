// ==========================================
// SWAG STREE | CART, CHECKOUT & ORDERS
// ==========================================

// Global variables fallback definition to prevent browser cache mismatch crashes
if (typeof window.products === 'undefined') window.products = [];
if (typeof window.selectedSize === 'undefined') window.selectedSize = 'S';
if (typeof window.selectedColor === 'undefined') window.selectedColor = '';
if (typeof window.cart === 'undefined') window.cart = [];
if (typeof window.isAdmin === 'undefined') window.isAdmin = false;
if (typeof window.currentUser === 'undefined') window.currentUser = null;

function loadCartFromStorage() {
    try {
        const cached = localStorage.getItem('swagstree_cart');
        if (cached) {
            const loaded = JSON.parse(cached);
            if (Array.isArray(loaded)) {
                cart.length = 0;
                loaded.forEach(item => cart.push(item));
            }
        }
    } catch(e) {
        console.error("Error loading cart:", e);
    }
}
window.loadCartFromStorage = loadCartFromStorage;

function syncCartToFirestore() {
    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection("users").doc(currentUser.uid).set({
            cart: cart
        }, { merge: true }).catch(err => {
            console.error("Error syncing cart to Firestore:", err);
        });
    }
}
window.syncCartToFirestore = syncCartToFirestore;

function saveCartToStorage() {
    try {
        localStorage.setItem('swagstree_cart', JSON.stringify(cart));
        syncCartToFirestore();
    } catch(e) {
        console.error("Error saving cart:", e);
    }
}
window.saveCartToStorage = saveCartToStorage;

function mergeCarts(guestCart, savedCart) {
    const merged = [...savedCart];
    guestCart.forEach(gItem => {
        const existing = merged.find(sItem => 
            sItem.id === gItem.id && 
            sItem.variantSize === gItem.variantSize && 
            sItem.variantColor === gItem.variantColor && 
            (sItem.variantPattern || '') === (gItem.variantPattern || '')
        );
        if (existing) {
            const avail = getCartItemAvailability(existing);
            let limit = globalMaxCartQty || 1;
            if (avail.details && avail.details.trackStock) {
                limit = avail.details.stockCount;
            }
            existing.qty = Math.min(Math.max(existing.qty, gItem.qty), limit);
        } else {
            merged.push(gItem);
        }
    });
    return merged;
}
window.mergeCarts = mergeCarts;

function getCartItemAvailability(item) {
    const p = window.products.find(x => x.id === item.id);
    if (!p) {
        return { available: false, reason: "Product unavailable" };
    }
    const details = getVariantDetails(p, item.variantSize, item.variantColor, item.variantPattern || '');
    if (details.trackStock) {
        if (details.stockCount <= 0) {
            return { available: false, reason: "Out of Stock" };
        }
        if (details.stockCount < item.qty) {
            return { available: false, reason: `Only ${details.stockCount} left`, stockCount: details.stockCount };
        }
    }
    return { available: true, details };
}
window.getCartItemAvailability = getCartItemAvailability;


let activePromo = null;
let codMinPayment = 100; // Default, loaded from Firestore
let _pendingOrderArgs = null;
let globalMaxCartQty = 1;

function resolveCssColor(colorVal) {
    if (!colorVal) return 'transparent';
    let cleanColor = colorVal.trim();
    if (!cleanColor.startsWith('#')) {
        const normName = cleanColor.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Local fallback dictionary for custom colors
        const localMap = {
            'mehendigreen': '#4b5320', 'mehndigreen': '#4b5320', 'armygreen': '#4b5320',
            'rosedarkpink': '#c21e56', 'dustypink': '#dcaebb', 'onionpink': '#dcaebb',
            'lightorange': '#ffb347', 'darkorange': '#ff8c00', 'peach': '#ffcba4',
            'mustardyellow': '#e1ad01', 'haldiyellow': '#e1ad01', 'gold': '#ffd700',
            'navyblue': '#000080', 'royalblue': '#4169e1', 'firozi': '#20b2aa',
            'winered': '#4e0f1d', 'wine': '#722f37', 'burgundy': '#800020'
        };

        if (window.customColorsMap) {
            const rawNorm = cleanColor.toLowerCase();
            const spaceNorm = rawNorm.replace(/\s+/g, '');
            if (window.customColorsMap[rawNorm]) return window.customColorsMap[rawNorm].hex;
            if (window.customColorsMap[spaceNorm]) return window.customColorsMap[spaceNorm].hex;
        }
        
        if (localMap[normName]) {
            return localMap[normName];
        }
        
        return cleanColor.replace(/\s+/g, '');
    }
    return cleanColor;
}

// ── UPI Configuration ──────────────────────────────────────────────────────
const UPI_ID   = '7683020636@pthdfc';
const UPI_NAME = 'Swag+Stree'; // merchant name (URL-encoded spaces)
// ───────────────────────────────────────────────────────────────────────────

(function loadGlobalSettings() {
    if (typeof db === 'undefined') return;
    
    // Load COD settings
    db.collection('settings').doc('cod').get().then(doc => {
        if (doc.exists && typeof doc.data().minPayment === 'number') {
            codMinPayment = doc.data().minPayment;
        }
    }).catch(() => {});

    // Load Cart Quantity limit settings
    db.collection('settings').doc('cart').get().then(doc => {
        if (doc.exists && typeof doc.data().globalMaxQty === 'number') {
            globalMaxCartQty = doc.data().globalMaxQty;
        }
    }).catch(() => {});

    // Load Product Pagination settings
    db.collection('settings').doc('pagination').get().then(doc => {
        if (doc.exists && typeof doc.data().limit === 'number') {
            productsPageLimitSetting = doc.data().limit;
            displayedProductsLimit = productsPageLimitSetting;
            displayedWishlistLimit = productsPageLimitSetting;
            if (typeof renderStore === 'function') renderStore();
        }
    }).catch(() => {});
})();

// Returns the current cart grand total (after promo)
function _getCartTotal() {
    const subtotal = cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    return subtotal - discount;
}

// Build a standard UPI intent URL
function _buildUpiUrl(amount, note) {
    const amt   = encodeURIComponent(amount.toFixed(2));
    const tn    = encodeURIComponent(note || 'Swag Stree Order');
    return `upi://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${amt}&cu=INR&tn=${tn}`;
}

// Open UPI app — uses app-specific scheme first, falls back to generic upi://
function openUpiApp(app) {
    const total  = _getCartTotal();
    if (total <= 0) { showToast('Add items to bag first'); return; }

    const note   = 'Swag Stree Order';
    const base   = _buildUpiUrl(total, note);

    // App-specific intent deep links (Android); generic upi:// as fallback
    const links = {
        paytm:   `paytmmp://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`,
        gpay:    `gpay://upi/pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`,
        phonepe: `phonepe://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`,
        upi:     base
    };

    const url = links[app] || base;

    // Try to open the app. If the scheme isn't installed the browser will
    // silently fail or show an error.
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.click();
}

function addToBag(id) { 
    const p = products.find(x => x.id === id);
    if(!p) return;
    
    // Default values if added directly from product grid
    const size = (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0) ? p.sizes[0] : 'Standard';
    const colorList = (p.sizeColorMap && Array.isArray(p.sizeColorMap[size])) ? p.sizeColorMap[size] : [];
    const color = colorList.length > 0 ? colorList[0] : '';
    
    // We try to grab the first pattern from normalizedVariants if they exist
    let pattern = '';
    if (p.normalizedVariants) {
        const matchingVariants = p.normalizedVariants.filter(v => v.size === size && v.color === color);
        if (matchingVariants.length > 0 && matchingVariants[0].pattern) pattern = matchingVariants[0].pattern;
    }
    
    addToBagWithSelection(id, size, color, pattern);
}

function getVariantDetails(p, size, color, pattern = '') {
    const normVars = p.normalizedVariants && p.normalizedVariants.length > 0
        ? p.normalizedVariants : (typeof normalizeVariants === 'function' ? normalizeVariants(p) : []);
    
    let match = normVars.find(v => v.size === size && v.color === color && (v.pattern || '') === pattern);
    if (!match) match = normVars.find(v => v.size === size && v.color === color);
    if (!match) match = normVars.find(v => v.size === size);
    
    if (match) {
        return {
            price: match.price !== null && match.price !== undefined ? match.price : p.price,
            image: (match.images && match.images[0]) ? match.images[0] : (p.images && p.images[0] ? p.images[0] : 'https://placehold.co/400x400/222/FFF?text=No+Image'),
            trackStock: !!match.trackStock,
            stockCount: typeof match.stockCount === 'number' ? match.stockCount : (parseInt(match.stockCount, 10) || 0),
            patternImage: match.previewImage || '',
            colorName: match.colorName || ''   // human-readable color label (e.g. "Light Pink")
        };
    }
    
    return {
        price: p.price,
        image: p.images && p.images[0] ? p.images[0] : 'https://placehold.co/400x400/222/FFF?text=No+Image',
        trackStock: false,
        stockCount: 0,
        patternImage: '',
        colorName: ''
    };
}

function addToBagWithSelection(id, size, color, pattern = '') {
    const p = products.find(x => x.id === id);
    if(!p) return;
    
    const vDetails = getVariantDetails(p, size, color, pattern);
    
    const existing = cart.find(item => item.id === id && item.variantSize === size && item.variantColor === color && (item.variantPattern || '') === pattern);
    
    const desiredQty = existing ? existing.qty + 1 : 1;
    if (vDetails.trackStock) {
        if (desiredQty > vDetails.stockCount) return showToast(`Cannot add to bag. Only ${vDetails.stockCount} left in stock.`);
    } else {
        if (desiredQty > globalMaxCartQty) return showToast(`Maximum limit of ${globalMaxCartQty} items per order reached.`);
    }

    if(existing) {
        existing.qty++;
        existing.price = vDetails.price;
        existing.variantImage = vDetails.image;
        existing.variantPatternImage = vDetails.patternImage || '';
        existing.variantColorName = vDetails.colorName || '';
        existing.trackStock = vDetails.trackStock;
        existing.stockCount = vDetails.stockCount;
    } else {
        cart.push({...p, variantSize: size, variantColor: color, variantColorName: vDetails.colorName || '', variantPattern: pattern, variantPatternImage: vDetails.patternImage || '', qty: 1, price: vDetails.price, variantImage: vDetails.image, trackStock: vDetails.trackStock, stockCount: vDetails.stockCount});
    }
    updateCartUI();
    saveCartToStorage();
    
    // Refresh storefront and product details
    if (typeof renderProducts === 'function' && typeof products !== 'undefined') {
        const grid = document.getElementById('product-grid');
        if (grid && grid.innerHTML !== '') renderProducts(products, 'product-grid');
    }
    if (typeof updateVariantUI === 'function' && typeof activeProductId !== 'undefined') {
        const p = typeof products !== 'undefined' ? products.find(x => x.id === activeProductId) : null;
        if (p) updateVariantUI(p);
    }
    
    const specs = [];
    if (size && size !== 'Standard') {
        specs.push(size);
    }
    if (color) {
        specs.push(vDetails.colorName || formatColorName(color));
    }
    if (pattern && !pattern.startsWith('Design-') && !vDetails.patternImage) {
        specs.push(pattern);
    }
    const variantText = specs.length > 0 ? ` (${specs.join(' - ')})` : '';
    showToast(`Added to Bag: ${p.name}${variantText}`); 
}

function updateCartUI() {
    const badge = document.getElementById('cart-badge');
    if(badge) badge.innerText = cart.reduce((s,i) => s + i.qty, 0);
}

function updateVariantCartQty(id, size, color, pattern, delta) {
    // If pattern was omitted (e.g. older storefront code), handle argument shift
    if (typeof pattern === 'number') {
        delta = pattern;
        pattern = '';
    }
    
    const idx = cart.findIndex(item => item.id === id && item.variantSize === size && item.variantColor === color && (item.variantPattern || '') === pattern);
    if (idx !== -1) {
        changeQty(idx, delta);
    } else if (delta > 0) {
        addToBagWithSelection(id, size, color, pattern);
    }
}

function changeQty(idx, delta) {
    const item = cart[idx];
    const desiredQty = item.qty + delta;
    
    if (delta > 0) {
        if (item.trackStock) {
            if (desiredQty > item.stockCount) return showToast(`Cannot add more. Only ${item.stockCount} left in stock.`);
        } else {
            if (desiredQty > globalMaxCartQty) return showToast(`Maximum limit of ${globalMaxCartQty} items per order reached.`);
        }
    }
    
    item.qty += delta;
    if(item.qty <= 0) cart.splice(idx, 1);
    
    // Only re-render cart contents if the cart sidebar is currently open
    const cartModal = document.getElementById('cart-modal');
    if (cartModal && cartModal.style.display === 'flex') {
        openCart();
    }
    
    updateCartUI();
    saveCartToStorage();
    
    // Attempt to refresh storefront and product details if functions exist
    if (typeof renderProducts === 'function' && typeof products !== 'undefined') {
        const grid = document.getElementById('product-grid');
        if (grid && grid.innerHTML !== '') renderProducts(products, 'product-grid');
    }
    if (typeof updateVariantUI === 'function' && typeof activeProductId !== 'undefined') {
        const p = typeof products !== 'undefined' ? products.find(x => x.id === activeProductId) : null;
        if (p) updateVariantUI(p);
    }
}

// Array to hold active promos loaded from Firestore
let activePromosList = [];
let loadPromosPromise = null;

async function loadPromos() {
    try {
        const snap = await db.collection('settings').doc('promos').get();
        if (snap.exists) {
            const list = snap.data().list || [];
            
            // Map legacy expiresAt to endsAt
            const normalizedList = list.map(p => {
                if (p.expiresAt && !p.endsAt) {
                    p.endsAt = p.expiresAt;
                }
                return p;
            });

            // Store in memory, let active use-time validation handle rejection rather than mutating store data immediately
            activePromosList = normalizedList;
            if (typeof adminPromoList !== 'undefined') {
                adminPromoList = normalizedList;
            }
        }
    } catch(e) {
        console.error("Failed to load promos", e);
    }
}

// Ensure promos are loaded early
loadPromosPromise = loadPromos();

async function applyPromo() {
    if (loadPromosPromise) {
        try {
            await loadPromosPromise;
        } catch(e) {
            console.error("Error awaiting promos load:", e);
        }
    }
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    if (!code) return;
    
    const promo = activePromosList.find(p => p.code === code);
    const now = Date.now();
    
    if (promo) {
        if (promo.endsAt && now > promo.endsAt) {
            activePromo = null;
            showToast("Invalid or Expired Promo Code");
        } else if (promo.startsAt && now < promo.startsAt) {
            activePromo = null;
            const startStr = new Date(promo.startsAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
            showToast("Promo code active starting " + startStr);
        } else if (promo.maxUses && (promo.usedCount || 0) >= promo.maxUses) {
            activePromo = null;
            showToast("Promo code limit reached");
        } else {
            // Check if logged in user already used this promo code
            if (currentUser) {
                try {
                    const usedSnap = await db.collection('orders')
                        .where('promoCode', '==', promo.code)
                        .where('uid', '==', currentUser.uid)
                        .limit(1)
                        .get();
                    if (!usedSnap.empty) {
                        activePromo = null;
                        showToast("You have already used this promo code");
                        openCart();
                        return;
                    }
                } catch(err) {
                    console.error("Error checking user promo usage", err);
                }
            }
            activePromo = { code: promo.code, discount: promo.discount / 100 }; // Convert % to decimal
            showToast("Promo Applied: " + promo.discount + "% OFF");
        }
    } else {
        activePromo = null;
        showToast("Invalid or Expired Promo Code");
    }
    openCart(); // refresh totals
}

function selectPayment(method) {
    document.querySelectorAll('.payment-chip').forEach(c => c.classList.remove('active'));
    const chip = document.getElementById('pay-' + method);
    if (chip) chip.classList.add('active');

    const upiBox     = document.getElementById('upi-payment-box');
    const codInfoBox = document.getElementById('cod-info-box');
    const qrFallback = document.getElementById('upi-qr-fallback');
    if (qrFallback) qrFallback.style.display = 'none';

    if (codInfoBox) {
        if (method === 'cod') {
            codInfoBox.style.display = 'flex';
            const noticeAmt = document.getElementById('cod-notice-amt');
            if (noticeAmt) noticeAmt.innerHTML = '&#8377;' + codMinPayment;
        } else {
            codInfoBox.style.display = 'none';
        }
    }

    const btnCheckout = document.getElementById('btn-checkout');

    if (method === 'cod') {
        upiBox.style.display = 'none';
        if (btnCheckout) btnCheckout.style.display = 'block';
        return;
    }

    upiBox.style.display = 'block';
    if (btnCheckout) btnCheckout.style.display = 'none';

    const total = _getCartTotal();
    const amtLabel = total > 0 ? '\u20b9' + total : '(add items first)';

    const configs = {
        paytm: {
            label:   'Paytm',
            color:   '#00BAF2',
            bg:      'rgba(0,186,242,0.08)',
            border:  'rgba(0,186,242,0.3)',
            icon:    '&#x1F4B3;',
            btnBg:   'linear-gradient(135deg,#00BAF2,#0080b3)',
            appKey:  'paytm',
            hint:    'Opens Paytm app with amount pre-filled'
        },
        gpay: {
            label:   'Google Pay',
            color:   '#4285F4',
            bg:      'rgba(66,133,244,0.08)',
            border:  'rgba(66,133,244,0.3)',
            icon:    '&#x1F4B0;',
            btnBg:   'linear-gradient(135deg,#4285F4,#1a5dc8)',
            appKey:  'gpay',
            hint:    'Opens Google Pay with amount pre-filled'
        },
        upi: {
            label:   'UPI Scanner',
            color:   '#FFD700',
            bg:      'rgba(255,215,0,0.06)',
            border:  'rgba(255,215,0,0.25)',
            icon:    '&#x1F4F7;',
            btnBg:   'linear-gradient(135deg,#FFD700,#b8860b)',
            appKey:  'upi',
            hint:    'Scan the QR code below to pay'
        }
    };

    const cfg = configs[method];
    if (!cfg) return;
    
    let html = `
        <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:14px;">
            <span style="font-size:22px;">${cfg.icon}</span>
            <span style="color:${cfg.color}; font-weight:800; font-size:15px; letter-spacing:1px;">${cfg.label}</span>
        </div>

        <div style="background:${cfg.bg}; border:1px solid ${cfg.border}; border-radius:12px; padding:10px 14px; margin-bottom:14px; text-align:center;">
            <div style="font-size:11px; color:#777; letter-spacing:1px; margin-bottom:2px;">PAYING</div>
            <div style="font-size:26px; font-weight:900; color:${cfg.color};">${amtLabel}</div>
            <div style="font-size:10px; color:#555; margin-top:2px;">to Swag Stree &bull; ${UPI_ID}</div>
        </div>
    `;

    if (method === 'upi') {
        html += `
            <p style="font-size:11px; color:#666; margin:0 0 12px; text-align:center;">
                ${cfg.hint}. After paying,<br>click the confirmation button below.
            </p>
            <div style="background:transparent; border-radius:10px; display:flex; justify-content:center; margin-bottom:12px; width:100%;">
                <img src="assets/qr.png" alt="UPI QR Code" style="max-width:200px; width:100%; height:auto; border-radius:6px; object-fit:contain;">
            </div>
            <div style="height:1px; background:#333; margin: 10px 0;"></div>
            <button class="btn-gold" onclick="placeOrder()" style="display:block; margin-bottom:10px;">
                <i class="fa fa-check-circle" style="margin-right:8px;"></i>I Paid — Place Order
            </button>
        `;
    } else {
        html += `
            <button onclick="openUpiApp('${cfg.appKey}')"
                style="width:100%; padding:15px; border:none; border-radius:12px; background:${cfg.btnBg}; color:#fff; font-weight:800; font-size:14px; cursor:pointer; letter-spacing:0.5px; margin-bottom:12px; box-shadow:0 4px 15px rgba(0,0,0,0.4);">
                &#x26A1; Open ${cfg.label} &amp; Pay ${amtLabel}
            </button>
            <p style="font-size:11px; color:#666; margin:0 0 12px; text-align:center;">
                After paying via ${cfg.label},<br>click the confirmation button below.
            </p>
            <div style="height:1px; background:#333; margin: 10px 0;"></div>
            <button class="btn-gold" onclick="placeOrder()" style="display:block; margin-bottom:10px;">
                <i class="fa fa-check-circle" style="margin-right:8px;"></i>I Paid — Place Order
            </button>
        `;
    }
    
    upiBox.innerHTML = html;
}

let _initialCodOptionsHtml = null;

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('cod-advance-payment-options');
    if (container) {
        _initialCodOptionsHtml = container.innerHTML;
    }
    loadCartFromStorage();
    updateCartUI();
});

function resetCodPaymentOptions() {
    const container = document.getElementById('cod-advance-payment-options');
    if (container && _initialCodOptionsHtml) {
        container.innerHTML = _initialCodOptionsHtml;
    }
}

function payCodAdvance(method) {
    const container = document.getElementById('cod-advance-payment-options');
    if (!container) return;

    if (method === 'upi') {
        container.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:14px;">
                <span style="font-size:22px;">&#x1F4F7;</span>
                <span style="color:#FFD700; font-weight:800; font-size:15px; letter-spacing:1px;">UPI Scanner</span>
            </div>

            <div style="background:rgba(255,215,0,0.06); border:1px solid rgba(255,215,0,0.25); border-radius:12px; padding:10px 14px; margin-bottom:14px; text-align:center;">
                <div style="font-size:11px; color:#777; letter-spacing:1px; margin-bottom:2px;">PAYING ADVANCE</div>
                <div style="font-size:26px; font-weight:900; color:#FFD700;">&#8377;${codMinPayment}</div>
                <div style="font-size:10px; color:#555; margin-top:2px;">to Swag Stree &bull; ${UPI_ID}</div>
            </div>

            <p style="font-size:11px; color:#666; margin:0 0 12px; text-align:center;">
                Scan the QR code to pay.<br>After paying, click the confirmation button below.
            </p>
            <div style="background:transparent; border-radius:10px; display:flex; justify-content:center; margin-bottom:12px; width:100%;">
                <img src="assets/qr.png" alt="UPI QR Code" style="max-width:200px; width:100%; height:auto; border-radius:6px; object-fit:contain;">
            </div>

            <div style="height:1px; background:#333; margin: 10px 0;"></div>
            <button class="btn-gold" onclick="confirmCodOrder()" style="display:block; margin-bottom:10px;">
                <i class="fa fa-check-circle" style="margin-right:8px;"></i>I Paid — Place COD Order
            </button>
            <div style="display:flex; gap:10px;">
                <button onclick="resetCodPaymentOptions()" style="flex:1; padding:10px; background:#222; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:13px;">Back</button>
                <button onclick="closeCodConfirmModal()" style="flex:1; padding:10px; background:none; color:#555; border:none; cursor:pointer; font-size:13px;">Cancel</button>
            </div>
        `;
    } else {
        const note = 'Swag Stree COD Advance';
        const base = _buildUpiUrl(codMinPayment, note);
        const links = {
            paytm:   `paytmmp://pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${codMinPayment.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`,
            gpay:    `gpay://upi/pay?pa=${UPI_ID}&pn=${UPI_NAME}&am=${codMinPayment.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`
        };
        const url = links[method] || base;
        
        const configs = {
            paytm: { label: 'Paytm', color: '#00BAF2', bg: 'rgba(0,186,242,0.08)', border: 'rgba(0,186,242,0.3)', icon: '&#x1F4B3;', btnBg: 'linear-gradient(135deg,#00BAF2,#0080b3)' },
            gpay: { label: 'Google Pay', color: '#4285F4', bg: 'rgba(66,133,244,0.08)', border: 'rgba(66,133,244,0.3)', icon: '&#x1F4B0;', btnBg: 'linear-gradient(135deg,#4285F4,#1a5dc8)' }
        };
        const cfg = configs[method];
        
        if (cfg) {
            container.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom:14px;">
                    <span style="font-size:22px;">${cfg.icon}</span>
                    <span style="color:${cfg.color}; font-weight:800; font-size:15px; letter-spacing:1px;">${cfg.label}</span>
                </div>

                <div style="background:${cfg.bg}; border:1px solid ${cfg.border}; border-radius:12px; padding:10px 14px; margin-bottom:14px; text-align:center;">
                    <div style="font-size:11px; color:#777; letter-spacing:1px; margin-bottom:2px;">PAYING ADVANCE</div>
                    <div style="font-size:26px; font-weight:900; color:${cfg.color};">&#8377;${codMinPayment}</div>
                    <div style="font-size:10px; color:#555; margin-top:2px;">to Swag Stree &bull; ${UPI_ID}</div>
                </div>

                <button onclick="window.location.href='${url}'"
                    style="width:100%; padding:15px; border:none; border-radius:12px; background:${cfg.btnBg}; color:#fff; font-weight:800; font-size:14px; cursor:pointer; letter-spacing:0.5px; margin-bottom:12px; box-shadow:0 4px 15px rgba(0,0,0,0.4);">
                    &#x26A1; Open ${cfg.label} &amp; Pay &#8377;${codMinPayment}
                </button>
                <p style="font-size:11px; color:#666; margin:0 0 12px; text-align:center;">
                    After paying the advance via ${cfg.label},<br>click the confirmation button below.
                </p>
                <div style="height:1px; background:#333; margin: 10px 0;"></div>
                <button class="btn-gold" id="btn-confirm-cod" onclick="confirmCodOrder()" style="display:block; margin-bottom:10px;">
                    <i class="fa fa-check-circle" style="margin-right:8px;"></i>I Paid — Place COD Order
                </button>
                <div style="display:flex; gap:10px;">
                    <button onclick="resetCodPaymentOptions()" style="flex:1; padding:10px; background:#222; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:13px;">Back</button>
                    <button onclick="closeCodConfirmModal()" style="flex:1; padding:10px; background:none; color:#555; border:none; cursor:pointer; font-size:13px;">Cancel</button>
                </div>
            `;
        }
    }
}

function openCart() {
    let h = ""; 
    const groups = {};
    cart.forEach((it, idx) => {
        if (!groups[it.id]) {
            groups[it.id] = {
                name: it.name,
                image: it.image || it.variantImage || (it.images && it.images[0]) || 'https://placehold.co/400x400/222/FFF?text=No+Image',
                items: []
            };
        }
        groups[it.id].items.push({ item: it, originalIndex: idx });
    });

    let hasUnavailable = false;

    Object.values(groups).forEach(g => {
        const variantListHtml = g.items.map(entry => {
            const it = entry.item;
            const idx = entry.originalIndex;
            const avail = getCartItemAvailability(it);
            
            const specs = [];
            if (it.variantSize && it.variantSize !== 'Standard') {
                specs.push(it.variantSize);
            }
            const _colorLabel = it.variantColorName || (it.variantColor ? formatColorName(it.variantColor) : '');
            if (_colorLabel) {
                specs.push(_colorLabel);
            }
            if (it.variantPattern && !it.variantPattern.startsWith('Design-') && !it.variantPatternImage) {
                specs.push(it.variantPattern);
            }
            const variantText = specs.length > 0 ? specs.join(' • ') : 'Standard';
            
            let swatchHtml = '';
            if (it.variantPatternImage && it.variantColor) {
                swatchHtml = `
                    <div style="display:flex; align-items:center; gap:6px;">
                        <img src="${it.variantPatternImage}" title="Pattern: ${it.variantPattern || ''}" style="width:22px; height:22px; border-radius:4px; object-fit:cover; border:1px solid #333;">
                        <div style="width:14px; height:14px; border-radius:50%; background:${resolveCssColor(it.variantColor)}; border:1px solid rgba(255,255,255,0.2);" title="Color: ${_colorLabel}"></div>
                    </div>
                `;
            } else if (it.variantPatternImage) {
                swatchHtml = `<img src="${it.variantPatternImage}" title="Pattern: ${it.variantPattern || ''}" style="width:22px; height:22px; border-radius:4px; object-fit:cover; border:1px solid #333;">`;
            } else if (it.variantColor) {
                swatchHtml = `<div style="width:14px; height:14px; border-radius:50%; background:${resolveCssColor(it.variantColor)}; border:1px solid rgba(255,255,255,0.2);" title="Color: ${_colorLabel}"></div>`;
            } else {
                swatchHtml = `<div style="width:14px; height:14px; border-radius:50%; background:#333; border:1px solid rgba(255,255,255,0.1);"></div>`;
            }

            let badgeHtml = '';
            let rowStyle = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px dashed #222;';
            if (!avail.available) {
                hasUnavailable = true;
                rowStyle += ' opacity: 0.45;';
                badgeHtml = `<span style="background:var(--red); color:#fff; font-size:9px; padding:2px 6px; border-radius:4px; font-weight:700; margin-left:8px; display:inline-block; vertical-align:middle; text-transform:uppercase;">${avail.reason}</span>`;
            }

            let actionControlHtml = `
                <div class="qty-ctrl" style="margin-left:0;">
                    <span class="qty-btn" onclick="changeQty(${idx},-1)">-</span>
                    <span style="font-size:13px; width:20px; text-align:center; color:#fff;">${it.qty}</span>
                    <span class="qty-btn" onclick="changeQty(${idx},1)">+</span>
                </div>
            `;
            if (!avail.available) {
                actionControlHtml = `
                    <div style="cursor:pointer; padding:6px 12px; display:flex; align-items:center; justify-content:center;" onclick="changeQty(${idx}, -${it.qty})" title="Remove Unavailable Item">
                        <i class="fa fa-trash" style="color:var(--red); font-size:14px;"></i>
                    </div>
                `;
            }

            return `
            <div style="${rowStyle}">
                <div style="display:flex; align-items:center; gap:8px; flex:1;">
                    ${swatchHtml}
                    <div style="font-size:12px; color:#aaa; text-decoration: ${avail.available ? 'none' : 'line-through'};">${variantText} ${badgeHtml}</div>
                    <div style="font-size:12px; color:var(--gold); font-weight:700; margin-left:auto; padding-right:10px; text-decoration: ${avail.available ? 'none' : 'line-through'};">₹${it.price}</div>
                </div>
                ${actionControlHtml}
            </div>`;
        }).join('');

        h += `
        <div style="background:#111; padding:12px; border-radius:15px; border:1px solid #222; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #222;">
                <img src="${g.image}" style="width:36px; height:36px; border-radius:6px; object-fit:cover;">
                <div style="font-size:13px; font-weight:700; color:#fff;">${g.name}</div>
            </div>
            <div style="padding-left:4px;">
                ${variantListHtml}
            </div>
        </div>`;
    });

    let warningBanner = '';
    if (hasUnavailable) {
        warningBanner = `
        <div style="background:rgba(231,76,60,0.08); border:1px solid rgba(231,76,60,0.25); border-radius:12px; padding:10px 14px; margin-bottom:12px; display:flex; align-items:center; gap:10px;">
            <i class="fa fa-exclamation-triangle" style="color:var(--red); font-size:14px; flex-shrink:0;"></i>
            <div style="font-size:11px; color:#ff8080; line-height:1.4;">Some items are unavailable and have been excluded from the total. Please remove them to place order.</div>
        </div>`;
    }

    document.getElementById('cart-items').innerHTML = warningBanner + (h || `<p style="text-align:center; color:#555">Bag is empty</p>`);
    
    // Calculate Totals (excluding unavailable items)
    let subtotal = cart.reduce((s,i) => {
        const avail = getCartItemAvailability(i);
        return avail.available ? s + (i.price * i.qty) : s;
    }, 0);
    let discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    let total = subtotal - discount;
    
    document.getElementById('cart-subtotal').innerText = `₹${subtotal}`;
    document.getElementById('cart-discount').innerText = discount > 0 ? `-₹${discount}` : `₹0`;
    document.getElementById('cart-total').innerText = `₹${total}`;
    
    // Toggle/Disable checkout button if valid subtotal is 0
    const checkoutBtn = document.getElementById('btn-checkout');
    if (checkoutBtn) {
        if (subtotal <= 0) {
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.5';
            checkoutBtn.style.cursor = 'not-allowed';
            checkoutBtn.title = 'Add items first';
        } else {
            checkoutBtn.disabled = false;
            checkoutBtn.style.opacity = '1';
            checkoutBtn.style.cursor = 'pointer';
            checkoutBtn.title = '';
        }
    }

    updateCartUI();

    // Refresh COD notice with current minimum payment amount
    const codInfoBox = document.getElementById('cod-info-box');
    const noticeAmt = document.getElementById('cod-notice-amt');
    const activeChip = document.querySelector('.payment-chip.active');
    const currentMethod = activeChip ? activeChip.dataset.method : 'cod';
    if (codInfoBox) {
        codInfoBox.style.display = currentMethod === 'cod' ? 'flex' : 'none';
    }
    if (noticeAmt) noticeAmt.innerHTML = '&#8377;' + codMinPayment;

    // Promos display removed

    document.getElementById('cart-modal').style.display = 'flex';

    // Hide WhatsApp icon when checkout is open
    if (typeof updateWhatsAppVisibility === 'function') updateWhatsAppVisibility();

    if (typeof autoPopulateCheckoutDetails === 'function') {
        autoPopulateCheckoutDetails();
    }
}

async function placeOrder() {
    const n = document.getElementById('c-name').value.trim();
    const p = document.getElementById('c-phone').value.trim();
    const a = document.getElementById('c-addr').value.trim();
    const emailVal = document.getElementById('c-email') ? document.getElementById('c-email').value.trim() : '';
    const activeChip = document.querySelector('.payment-chip.active');
    if (!activeChip) return showToast("Select a payment method");
    const paymentMethod = activeChip.dataset.method;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!n) {
        return showToast("Please enter your name.");
    }
    if (p.length < 10) {
        return showToast("Please enter a valid 10-digit phone number.");
    }
    if (!emailVal || !emailRegex.test(emailVal)) {
        return showToast("Please enter a valid email address.");
    }
    if (a.length < 5) {
        return showToast("Please enter a complete delivery address (minimum 5 characters).");
    }
    if (cart.length === 0) return showToast("Bag is empty");
    
    // Filter out unavailable/out-of-stock items from the cart automatically
    const validItems = cart.filter(item => getCartItemAvailability(item).available);
    if (validItems.length === 0) {
        return showToast("Please add in-stock items to proceed.");
    }
    
    const hasUnavailable = cart.some(item => !getCartItemAvailability(item).available);
    if (hasUnavailable) {
        showToast("⚠️ Out-of-stock/unavailable items have been excluded from your order.");
    }
    
    // Mutate cart to contain only valid items
    cart.length = 0;
    validItems.forEach(item => cart.push(item));
    saveCartToStorage();
    updateCartUI();
    // Guest checkout allowed — no login required

    // ── COD Gate: show advance-payment confirmation modal ──────────────────────
    if (paymentMethod === 'cod') {
        try {
            const snap = await db.collection('settings').doc('cod').get();
            if (snap.exists && typeof snap.data().minPayment === 'number') {
                codMinPayment = snap.data().minPayment;
            }
        } catch(e) { /* use cached value */ }
        _pendingOrderArgs = { n, p, a, emailVal, paymentMethod };
        _showCodConfirmModal(codMinPayment);
        return;
    }
    // ──────────────────────────────────────────────────────────────────────────

    await _executeOrder({ n, p, a, emailVal, paymentMethod });
}

// Called from COD confirmation modal "Confirm & Place Order"
async function confirmCodOrder() {
    document.getElementById('cod-confirm-modal').style.display = 'none';
    if (!_pendingOrderArgs) return;
    const args = { ..._pendingOrderArgs, codMinAmount: codMinPayment, codAdvancePaid: false };
    _pendingOrderArgs = null;
    await _executeOrder(args);
}

// Called from COD confirmation modal "Pay via UPI Instead"
function codSwitchToUpi() {
    document.getElementById('cod-confirm-modal').style.display = 'none';
    _pendingOrderArgs = null;
    selectPayment('upi');
    showToast('Switched to UPI — scan the QR code to pay');
}

// Called from COD confirmation modal close/cancel
function closeCodConfirmModal() {
    document.getElementById('cod-confirm-modal').style.display = 'none';
    _pendingOrderArgs = null;
}

function _showCodConfirmModal(minAmt) {
    const modal = document.getElementById('cod-confirm-modal');
    if (!modal) return;
    
    // Reset to the initial list of payment options
    resetCodPaymentOptions();
    
    const amtEl = document.getElementById('cod-min-amount-display');
    if (amtEl) amtEl.textContent = '₹' + minAmt;
    modal.style.display = 'flex';
}

async function _executeOrder({ n, p, a, emailVal, paymentMethod, codMinAmount, codAdvancePaid }) {
    const btn = document.getElementById('btn-checkout');
    if (btn) { btn.disabled = true; btn.innerText = 'Placing...'; }

    // Cache details locally for guests/future prepopulation
    if (!currentUser) {
        localStorage.setItem("swagstree_guest_name", n);
        localStorage.setItem("swagstree_guest_phone", p);
        localStorage.setItem("swagstree_guest_email", emailVal);
        localStorage.setItem("swagstree_guest_address", a);
    }

    let subtotal = cart.reduce((s,i) => s + (i.price * i.qty), 0);
    let discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    let total = subtotal - discount;
    const orderId = Math.random().toString(36).toUpperCase().substring(2, 10);

    const promoLine = activePromo ? `<br><strong>Promo Code:</strong> ${activePromo.code} (${Math.round(activePromo.discount * 100)}% OFF)` : '';
    const discountLine = discount > 0 ? `<tr><td colspan="3" style="padding:8px 5px; text-align:right; color:#888;">Discount (${activePromo ? activePromo.code : ''})</td><td style="padding:8px 5px; text-align:right; color:#e74c3c;">-₹${discount}</td></tr><tr><td colspan="3" style="padding:4px 5px; text-align:right; color:#888; font-size:12px;">Subtotal</td><td style="padding:4px 5px; text-align:right; color:#888; font-size:12px;">₹${subtotal}</td></tr>` : '';
    const codNote = (paymentMethod === 'cod' && codMinAmount) ? `<br><span style="color:#e67e22;"><strong>COD Advance:</strong> &#8377;${codMinAmount} to be paid via UPI before delivery</span>` : '';
    
    let msg = `*NEW ORDER (${orderId})*\n\n`;
    const waGroups = {};
    cart.forEach(it => {
        if (!waGroups[it.id]) {
            waGroups[it.id] = { name: it.name, items: [] };
        }
        waGroups[it.id].items.push(it);
    });
    
    Object.values(waGroups).forEach(g => {
        msg += `*${g.name}*:\n`;
        g.items.forEach(it => {
            const specs = [];
            if (it.variantSize && it.variantSize !== 'Standard') specs.push(it.variantSize);
            if (it.variantColor) specs.push(it.variantColorName || formatColorName(it.variantColor));
            if (it.variantPattern && !it.variantPattern.startsWith('Design-') && !it.variantPatternImage) specs.push(it.variantPattern);
            const specStr = specs.length > 0 ? ` [${specs.join(', ')}]` : '';
            msg += `  - ${it.qty}x${specStr} (₹${it.price * it.qty})\n`;
        });
        msg += `\n`;
    });

    // Guest support: generate a stable guest identifier tied to this order
    const effectiveUid = currentUser ? currentUser.uid : ('guest_' + orderId);
    const isGuest = !currentUser;

    // ── Build premium order email ────────────────────────────────────────────
    const _pill = (label, val) => `<span style="display:inline-block;background:#f0f0f0;color:#333;font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.5px;margin:1px 2px 1px 0;text-transform:uppercase;">${label}: ${val}</span>`;

    const emailGroups = {};
    cart.forEach(it => {
        if (!emailGroups[it.id]) {
            emailGroups[it.id] = {
                name: it.name,
                image: it.image || it.variantImage || (it.images && it.images[0]) || 'https://placehold.co/400x400/222/FFF?text=No+Image',
                variants: []
            };
        }
        emailGroups[it.id].variants.push(it);
    });

    const _itemRows = Object.values(emailGroups).map(g => {
        const variantRowsHtml = g.variants.map(it => {
            const colorLabel = it.variantColorName || (it.variantColor ? formatColorName(it.variantColor) : '');
            const hasSwatch = !!it.variantPatternImage;
            const showPatternText = it.variantPattern && !it.variantPattern.startsWith('Design-') && !hasSwatch;

            const patternImgHtml = hasSwatch
                ? `<img src="${it.variantPatternImage}" width="22" height="22" style="border-radius:4px; border:1px solid #ddd; object-fit:cover; display:inline-block; vertical-align:middle; margin-right:6px;" alt="swatch">`
                : '';

            const colorCircleHtml = it.variantColor ? `
                <table width="12" height="12" cellpadding="0" cellspacing="0" style="display:inline-table; border-collapse:collapse; margin-right:6px; vertical-align:middle; line-height:0;">
                  <tr>
                    <td width="12" height="12" style="padding:0; border-radius:50%; background:${resolveCssColor(it.variantColor)}; border:1px solid #ddd; font-size:0px; line-height:0; overflow:hidden;">
                      &nbsp;
                    </td>
                  </tr>
                </table>` : '';

            const swatchIcon = `${patternImgHtml}${colorCircleHtml}`;

            const specs = [];
            if (it.variantSize && it.variantSize !== 'Standard') specs.push(`Size: <strong>${it.variantSize}</strong>`);
            if (colorLabel) specs.push(`Color: <strong>${colorLabel}</strong>`);
            if (showPatternText) specs.push(`Pattern: <strong>${it.variantPattern}</strong>`);
            const specsString = specs.length > 0 ? specs.join(' &nbsp;•&nbsp; ') : 'Standard';

            return `
            <tr>
              <td style="padding:8px 0; border-bottom:1px dashed #eee; font-size:12px; color:#555; vertical-align:middle; line-height:1.4;">
                ${swatchIcon}${specsString}
              </td>
              <td style="padding:8px 0; border-bottom:1px dashed #eee; font-size:12px; color:#111; text-align:right; vertical-align:middle; white-space:nowrap; width:120px;">
                <span style="color:#777; font-size:11px; margin-right:8px;">Qty: ${it.qty}</span>
                <strong style="font-size:13px; font-weight:700;">&#8377;${it.price * it.qty}</strong>
              </td>
            </tr>`;
        }).join('');

        return `
        <tr>
          <td style="padding:14px 0; border-bottom:1px solid #f3f3f3; vertical-align:top; width:54px;">
            <img src="${g.image}" width="54" height="54"
                 style="border-radius:8px; object-fit:cover; display:block; border:1px solid #eee;" alt="product">
          </td>
          <td style="padding:14px 0 14px 12px; border-bottom:1px solid #f3f3f3; vertical-align:top;">
            <div style="font-size:14px; font-weight:700; color:#111; margin-bottom:8px; line-height:1.35;">${g.name}</div>
            <table style="width:100%; border-collapse:collapse; margin:0; background:#fafafa; border-radius:8px; border:1px solid #f0f0f0;">
              <tr>
                <td style="padding:4px 10px;">
                  <table style="width:100%; border-collapse:collapse; margin:0;">
                    ${variantRowsHtml}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
    }).join('');

    const _totalRows = discount > 0 ? `
        <tr>
          <td style="font-size:12px;color:#aaa;padding:3px 0;">Subtotal</td>
          <td style="font-size:12px;color:#aaa;text-align:right;padding:3px 0;">&#8377;${subtotal}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#e74c3c;padding:3px 0;">Discount ${activePromo ? '(' + activePromo.code + ')' : ''}</td>
          <td style="font-size:12px;color:#e74c3c;text-align:right;padding:3px 0;">-&#8377;${discount}</td>
        </tr>
        <tr><td colspan="2" style="padding:6px 0 0;"><div style="height:1px;background:#2a2a2a;"></div></td></tr>` : '';

    const _codRow = (paymentMethod === 'cod' && codMinAmount)
        ? `<div style="margin-top:6px;font-size:11px;color:#e67e22;">COD Advance: &#8377;${codMinAmount} via UPI before delivery</div>` : '';

    const _promoRow = activePromo
        ? `<div style="font-size:11px;color:#e74c3c;margin-top:4px;">Promo: ${activePromo.code} (${Math.round(activePromo.discount * 100)}% OFF)</div>` : '';

    let orderTable =
        `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;">` +

        // ── HEADER ──────────────────────────────────────────────────────────
        `<div style="background:#000000;padding:28px 24px 22px;text-align:center;">
           <div style="font-size:28px;font-weight:900;color:#FFD700;letter-spacing:5px;margin-bottom:8px;">SWAG STREE</div>
           <div style="display:inline-block;border:1px solid rgba(255,215,0,0.35);border-radius:20px;padding:4px 16px;font-size:10px;color:#999;letter-spacing:2px;text-transform:uppercase;">Invoice &nbsp;#${orderId}</div>
         </div>` +

        // ── CUSTOMER INFO ────────────────────────────────────────────────────
        `<table width="100%" style="border-collapse:collapse;background:#fafafa;border-bottom:2px solid #FFD700;">
           <tr>
             <td style="padding:16px 24px;">
               <table width="100%" style="border-collapse:collapse;">
                 <tr>
                   <td style="vertical-align:top;width:55%;padding-right:12px;">
                     <div style="font-size:9px;font-weight:700;color:#bbb;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">DELIVER TO</div>
                     <div style="font-size:15px;font-weight:700;color:#111;margin-bottom:3px;">${n}</div>
                     <div style="font-size:12px;color:#777;margin-bottom:2px;">&#128241; ${p}</div>
                     ${emailVal ? `<div style="font-size:12px;color:#777;margin-bottom:2px;">&#9993; ${emailVal}</div>` : ''}
                     <div style="font-size:12px;color:#777;line-height:1.5;">&#128205; ${a}</div>
                   </td>
                   <td style="vertical-align:top;text-align:right;">
                     <div style="font-size:9px;font-weight:700;color:#bbb;letter-spacing:2px;text-transform:uppercase;margin-bottom:5px;">PAYMENT</div>
                     <div style="display:inline-block;background:${paymentMethod === 'cod' ? '#fff3e0' : '#e8f5e9'};color:${paymentMethod === 'cod' ? '#e67e22' : '#27ae60'};border:1px solid ${paymentMethod === 'cod' ? 'rgba(230,126,34,0.4)' : 'rgba(39,174,96,0.4)'};font-weight:700;font-size:11px;padding:4px 14px;border-radius:20px;letter-spacing:1px;">${paymentMethod.toUpperCase()}</div>
                     ${_promoRow}${_codRow}
                   </td>
                 </tr>
               </table>
             </td>
           </tr>
         </table>` +

        // ── ITEMS HEADER ─────────────────────────────────────────────────────
        `<div style="padding:14px 24px 0;">
           <div style="font-size:9px;font-weight:700;color:#bbb;letter-spacing:2px;text-transform:uppercase;padding-bottom:8px;border-bottom:1px solid #eee;">ITEMS ORDERED</div>
         </div>` +

        // ── ITEM ROWS ────────────────────────────────────────────────────────
        `<table width="100%" style="border-collapse:collapse;padding:0 24px;">
           <tr><td colspan="3" style="padding:0 24px;">
             <table width="100%" style="border-collapse:collapse;">
               ${_itemRows}
             </table>
           </td></tr>
         </table>` +

        // ── TOTAL ────────────────────────────────────────────────────────────
        `<div style="background:#0d0d0d;padding:16px 24px;">
           <table width="100%" style="border-collapse:collapse;">
             ${_totalRows}
             <tr>
               <td style="font-size:13px;font-weight:700;color:#FFD700;letter-spacing:1px;text-transform:uppercase;padding-top:4px;">Grand Total</td>
               <td style="font-size:22px;font-weight:900;color:#FFD700;text-align:right;padding-top:4px;">&#8377;${total}</td>
             </tr>
           </table>
         </div>` +

        // ── FOOTER ───────────────────────────────────────────────────────────
        `<div style="padding:18px 24px;text-align:center;background:#fafafa;">
           <div style="font-size:13px;color:#555;margin-bottom:12px;">Thank you for shopping with <strong style="color:#000;">Swag Stree</strong>! &#128717;</div>
           <a href="https://wa.me/918800467686"
              style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 22px;border-radius:24px;letter-spacing:0.5px;">
             &#128172; WhatsApp &nbsp;+91 8800467686
           </a>
         </div>` +

        `</div>`;

    const orderDoc = {
        orderId,
        uid: effectiveUid,
        isGuest,
        recipient: n,
        phone: p,
        address: a,
        email: emailVal || ((currentUser && currentUser.email) ? currentUser.email : ''),
        items: cart,
        subtotal,
        discount,
        total,
        paymentMethod,
        promoCode: activePromo ? activePromo.code : null,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        notifications: {
            placed: {
                customerMailSent: (emailVal || (currentUser && currentUser.email)) ? true : false,
                adminMailSent: true,
                adminTelegramSent: false
            }
        }
    };
    if (paymentMethod === 'cod') {
        orderDoc.codMinAmount = codMinAmount || codMinPayment;
        orderDoc.codAdvancePaid = codAdvancePaid || false;
    }

    try {
        if (activePromo) {
            // Check once-per-user by phone number
            const phoneClean = p.trim();
            const phoneSnap = await db.collection('orders')
                .where('promoCode', '==', activePromo.code)
                .where('phone', '==', phoneClean)
                .limit(1)
                .get();
            if (!phoneSnap.empty) {
                if (btn) { btn.disabled = false; btn.innerText = 'Place Order'; }
                return showToast("You have already used this promo code");
            }
            
            // Check once-per-user by UID
            if (currentUser) {
                const uidSnap = await db.collection('orders')
                    .where('promoCode', '==', activePromo.code)
                    .where('uid', '==', currentUser.uid)
                    .limit(1)
                    .get();
                if (!uidSnap.empty) {
                    if (btn) { btn.disabled = false; btn.innerText = 'Place Order'; }
                    return showToast("You have already used this promo code");
                }
            }

            const promoRef = db.collection('settings').doc('promos');
            await db.runTransaction(async (transaction) => {
                const promoSnap = await transaction.get(promoRef);
                if (!promoSnap.exists) {
                    throw new Error("Promo code is no longer valid");
                }
                const list = promoSnap.data().list || [];
                const dbPromo = list.find(p => p.code === activePromo.code);
                if (!dbPromo) {
                    throw new Error("Promo code is no longer valid");
                }
                const now = Date.now();
                if (dbPromo.endsAt && now > dbPromo.endsAt) {
                    throw new Error("Promo code has expired");
                }
                if (dbPromo.startsAt && now < dbPromo.startsAt) {
                    throw new Error("Promo code is not yet active");
                }
                if (dbPromo.maxUses && (dbPromo.usedCount || 0) >= dbPromo.maxUses) {
                    throw new Error("Promo code limit reached");
                }
                
                // Increment promo code usedCount
                const newList = list.map(p => {
                    if (p.code === activePromo.code) {
                        p.usedCount = (p.usedCount || 0) + 1;
                    }
                    return p;
                });
                transaction.update(promoRef, { list: newList });
                
                // Add the order document
                const newOrderRef = db.collection('orders').doc();
                transaction.set(newOrderRef, orderDoc);
            });
        } else {
            await db.collection('orders').add(orderDoc);
        }
        
        // --- STOCK DEDUCTION LOGIC ---
        for (const item of cart) {
            if (item.trackStock) {
                try {
                    const pRef = db.collection('products').doc(item.id);
                    const pSnap = await pRef.get();
                    if (pSnap.exists) {
                        const pData = pSnap.data();
                        if (pData.variants && Array.isArray(pData.variants)) {
                            let updated = false;
                            const newVariants = pData.variants.map(v => {
                                if (v.size === item.variantSize && v.color === item.variantColor && (v.pattern || '') === (item.variantPattern || '')) {
                                    updated = true;
                                    return { ...v, stockCount: Math.max(0, (parseInt(v.stockCount, 10) || 0) - item.qty) };
                                }
                                return v;
                            });
                            
                            // If exact match not found (e.g. no color), try size only
                            if (!updated) {
                                newVariants.forEach((v, index) => {
                                    if (!updated && v.size === item.variantSize) {
                                        newVariants[index] = { ...v, stockCount: Math.max(0, (parseInt(v.stockCount, 10) || 0) - item.qty) };
                                        updated = true;
                                    }
                                });
                            }
                            
                            if (updated) {
                                await pRef.update({ variants: newVariants });
                            }
                        }
                    }
                } catch (err) {
                    console.error("Failed to deduct stock for", item.id, err);
                }
            }
        }
        // --- BREVO EMAIL SENDING (LOAD KEY FROM FIRESTORE) ---
        try {
            const emailSnap = await db.collection('settings').doc('email').get();
            let brevoKey = '';
            if (emailSnap.exists) {
                brevoKey = emailSnap.data().brevoKey || '';
            }

            if (brevoKey) {
                const toList = [];
                const bccList = [];
                const customerEmail = emailVal || ((currentUser && currentUser.email) ? currentUser.email : '');
                
                // Build admin recipient list dynamically based on active admins
                const adminRecipients = [];
                adminRecipients.push({
                    email: "superadmin@swagstree.com",
                    name: "Superadmin"
                });
                
                const isDefaultAdminDeactivated = (typeof assignedAdmins !== 'undefined') && assignedAdmins.some(a => a.email === "admin@swagstree.com" && a.status === "deactivated");
                if (!isDefaultAdminDeactivated) {
                    adminRecipients.push({
                        email: "admin@swagstree.com",
                        name: "Admin"
                    });
                }

                if (typeof assignedAdmins !== 'undefined' && Array.isArray(assignedAdmins)) {
                    assignedAdmins.forEach(adm => {
                        const emailLower = adm.email ? adm.email.toLowerCase() : "";
                        if (adm.status === "active" && emailLower !== "admin@swagstree.com" && emailLower !== "superadmin@swagstree.com") {
                            adminRecipients.push({
                                email: adm.email,
                                name: `Admin (${adm.email.split('@')[0]})`
                            });
                        }
                    });
                }

                if (customerEmail) {
                    toList.push({
                        email: customerEmail,
                        name: n
                    });
                    // BCC all active admins, filtering out the customer's email to prevent duplicate recipient errors in Brevo
                    const filteredBcc = adminRecipients.filter(r => r.email.toLowerCase() !== customerEmail.toLowerCase());
                    filteredBcc.forEach(r => bccList.push(r));
                } else {
                    // Fallback for guest checkout (send to admins directly as To recipients)
                    adminRecipients.forEach(r => toList.push(r));
                }

                const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'api-key': brevoKey,
                        'content-type': 'application/json'
                    },
                    body: JSON.stringify({
                        sender: {
                            name: "Swag Stree Orders",
                            email: "orders@swagstree.com"
                        },
                        to: toList,
                        bcc: bccList,
                        subject: `NEW ORDER (${orderId})`,
                        htmlContent: orderTable
                    })
                });
                if (!response.ok) {
                    const errText = await response.text();
                    console.error("Brevo API returned error status:", response.status, errText);
                } else {
                    console.log("Brevo email sent successfully.");
                }
            } else {
                console.error("Brevo API key is not configured in Firestore settings/email");
            }
        } catch (mailErr) {
            console.error("Failed to send email via Brevo", mailErr);
        }
        // ----------------------------
        showToast('Success! Order Placed.');
        cart = [];
        saveCartToStorage();
        activePromo = null;
        updateCartUI();
        // Clear checkout form fields for next order
        const nameField = document.getElementById('c-name');
        const phoneField = document.getElementById('c-phone');
        const emailField = document.getElementById('c-email');
        const addrField = document.getElementById('c-addr');
        if (nameField) nameField.value = '';
        if (phoneField) phoneField.value = '';
        if (emailField) emailField.value = '';
        if (addrField) addrField.value = '';
        closeModal('cart-modal');
        // Only reload order history for logged-in users
        if (currentUser) loadOrders();
        
        // Refresh grids if possible
        if (typeof renderProducts === 'function' && typeof products !== 'undefined') {
            const grid = document.getElementById('product-grid');
            if (grid && grid.innerHTML !== '') renderProducts(products, 'product-grid');
        }
    } catch(e) {
        console.error('Order Error:', e);
        const errMsg = e && e.message ? e.message : (e && e.text ? `Failed: ${e.text}` : 'Failed to place order');
        showToast(errMsg);
    }

    if (btn) { btn.disabled = false; btn.innerText = 'Place Order'; }
}

function loadOrders() { 
    const container = document.getElementById('order-history'); 
    if (!currentUser) return; 
    
    const countContainer = document.getElementById('orders-count');
    if (countContainer) countContainer.style.display = 'none';
    
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px; width:100%;">
            <div class="premium-loader"></div>
            <p style="color:#aaa; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin:0; font-weight:700;">Syncing orders</p>
        </div>
    `; 
    
    // Unsubscribe from old listener to prevent memory leaks on limit changes
    if (ordersUnsubscribe) {
        ordersUnsubscribe();
        ordersUnsubscribe = null;
    }
    
    let ordersRef = db.collection("orders"); 
    
    // Admin query is sorted and limited on Firestore side.
    // User query fetches all matching docs to avoid composite index requirement, and paginates client-side.
    let query = isAdmin 
        ? ordersRef.orderBy("timestamp", "desc").limit(displayedOrdersLimit + 1) 
        : ordersRef.where("uid", "==", currentUser.uid); 
    
    ordersUnsubscribe = query.onSnapshot(snap => { 
        const loadMoreBtnContainer = document.getElementById('orders-load-more-container');
        const countContainer = document.getElementById('orders-count');
        if (snap.empty) { 
            container.innerHTML = `<p style="text-align:center;color:#444;font-size:12px">No orders yet.</p>`; 
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            if (countContainer) {
                countContainer.innerHTML = '0 Orders';
                countContainer.style.display = 'inline-flex';
            }
            return; 
        } 
        
        let docs = snap.docs;
        let showLoadMore = false;
        
        if (isAdmin) {
            if (docs.length > displayedOrdersLimit) {
                showLoadMore = true;
                docs = docs.slice(0, displayedOrdersLimit);
            }
        } else {
            // Sort user orders client-side by timestamp desc
            docs = docs.sort((a, b) => {
                const tsA = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                const tsB = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                return tsB - tsA;
            });
            if (docs.length > displayedOrdersLimit) {
                showLoadMore = true;
                docs = docs.slice(0, displayedOrdersLimit);
            }
        }
        
        // Show/hide Load More button and update count display
        const visibleCount = docs.length;
        if (loadMoreBtnContainer) {
            if (showLoadMore) {
                loadMoreBtnContainer.innerHTML = `<button class="btn-gold" style="width:auto; padding:10px 20px; font-size:12px;" onclick="loadMoreOrders()">LOAD MORE ORDERS</button>`;
            } else {
                loadMoreBtnContainer.innerHTML = '';
            }
        }
        if (countContainer) {
            if (isAdmin) {
                countContainer.innerHTML = showLoadMore ? `Showing ${visibleCount}+ Orders` : `${visibleCount} Orders`;
            } else {
                countContainer.innerHTML = `Showing ${visibleCount} of ${snap.docs.length} Orders`;
            }
            countContainer.style.display = 'inline-flex';
        }
        
        container.innerHTML = docs.map(doc => { 
            const o = doc.data(); 
            const promoInfo = o.discount > 0 ? `<div style="font-size:11px; color:#e74c3c; margin-bottom:5px;">Discount: -₹${o.discount}</div>` : '';
            return `
            <div class="order-card">
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#666; margin-bottom:8px">
                    <span>#${o.orderId || doc.id.slice(-6).toUpperCase()}</span>
                    <span>${o.timestamp ? o.timestamp.toDate().toLocaleDateString('en-IN') : 'New'}</span>
                </div>
                ${isAdmin ? `<div style="color:var(--gold); font-size:11px; margin-bottom:8px; padding-bottom:5px; border-bottom:1px solid #333;"><b>Customer:</b> ${o.recipient || 'N/A'} | <b>Phone:</b> ${o.phone || 'N/A'}${o.email ? ` | <b>Email:</b> ${o.email}` : ''}<br><b>Address:</b> ${o.address || 'N/A'}</div>` : ''}
                <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">Payment: <b>${o.paymentMethod ? o.paymentMethod.toUpperCase() : 'N/A'}</b>${o.paymentMethod === 'cod' && o.codMinAmount ? ` <span style="color:#e67e22; font-size:10px;">(Advance: ₹${o.codMinAmount})</span>` : ''}</div>
                ${(() => {
                    const orderGroups = {};
                    (o.items || []).forEach(i => {
                        const prodId = i.id || i.name;
                        if (!orderGroups[prodId]) {
                            orderGroups[prodId] = {
                                name: i.name,
                                image: (i.images && i.images.length) ? i.images[0] : '',
                                variants: []
                            };
                        }
                        orderGroups[prodId].variants.push(i);
                    });

                    return Object.values(orderGroups).map(g => {
                        const variantListHtml = g.variants.map(i => {
                            const specs = [];
                            if (i.variantSize && i.variantSize !== 'Standard' && i.variantSize !== 'N/A') specs.push(i.variantSize);
                            const _oColorLabel = i.variantColorName || (i.variantColor ? formatColorName(i.variantColor) : '');
                            if (_oColorLabel) specs.push(_oColorLabel);
                            if (i.variantPattern && !i.variantPattern.startsWith('Design-') && !i.variantPatternImage) specs.push(i.variantPattern);
                            const variantDesc = specs.length > 0 ? specs.join(' • ') : 'Standard';

                            const patHtml = i.variantPatternImage ? `
                                <img src="${i.variantPatternImage}" title="Pattern: ${i.variantPattern || ''}" style="width:16px; height:16px; border-radius:3px; object-fit:cover; border:1px solid #1a1a1a; margin-right:5px; vertical-align:middle;">` : '';
                            const colHtml = i.variantColor ? `
                                <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${resolveCssColor(i.variantColor)}; border:1px solid rgba(255,255,255,0.2); margin-right:5px; vertical-align:middle;"></span>` : '';
                            const swatchIconHtml = `${patHtml}${colHtml}`;

                            return `
                            <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#aaa; padding:4px 0; border-bottom:1px dashed #222;">
                                <div style="display:flex; align-items:center;">
                                    ${swatchIconHtml}
                                    <span>${variantDesc}</span>
                                </div>
                                <div style="margin-left:auto; text-align:right;">
                                    <span style="color:#666; margin-right:8px;">×${i.qty||1}</span>
                                    <span style="color:var(--gold)">₹${i.price * (i.qty||1)}</span>
                                </div>
                            </div>`;
                        }).join('');

                        return `
                        <div style="display:flex; gap:10px; margin-bottom:10px; background:#111; padding:8px; border-radius:8px; border:1px solid #222;">
                            <img src="${g.image}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" onerror="this.style.display='none'">
                            <div style="flex:1;">
                                <div style="font-size:12px; font-weight:bold; color:#fff; margin-bottom:5px;">${g.name}</div>
                                <div style="padding-left:5px;">
                                    ${variantListHtml}
                                </div>
                            </div>
                        </div>`;
                    }).join('');
                })()}
                ${promoInfo}
                <div style="margin-top:10px; font-weight:bold; color:var(--gold); text-align:right; font-size:16px;">Total: ₹${o.total || 0}</div>
            </div>`; 
        }).join(''); 
    }, error => {
        console.error("Orders load error:", error);
        container.innerHTML = `<p style="text-align:center;color:#e74c3c;font-size:12px;">Error loading orders. Please try again.</p>`;
    }); 
}

const ORDER_STATUSES = [
    { value: 'pending', label: '⏳ Pending' },
    { value: 'confirmed', label: '✅ Confirmed' },
    { value: 'payment_processed', label: '💳 Payment Processed' },
    { value: 'processing', label: '⚙️ Processing' },
    { value: 'shipped', label: '🚚 Shipped' },
    { value: 'delivered', label: '📦 Delivered' },
    { value: 'cancelled', label: '❌ Cancelled' }
];

const COURIER_COMPANIES = [
    { value: 'Delhivery', label: 'Delhivery' },
    { value: 'DTDC', label: 'DTDC' },
    { value: 'BlueDart', label: 'BlueDart' },
    { value: 'Ekart', label: 'Ekart (Flipkart)' },
    { value: 'SpeedPost', label: 'Speed Post (India Post)' },
    { value: 'FedEx', label: 'FedEx' },
    { value: 'Xpressbees', label: 'Xpressbees' },
    { value: 'Other', label: 'Other / Hand Delivery' }
];

function loadOrders() { 
    const container = document.getElementById('order-history'); 
    if (!currentUser) return; 
    
    const countContainer = document.getElementById('orders-count');
    if (countContainer) countContainer.style.display = 'none';
    
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px; width:100%;">
            <div class="premium-loader"></div>
            <p style="color:#aaa; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin:0; font-weight:700;">Syncing orders</p>
        </div>
    `; 
    
    if (ordersUnsubscribe) {
        ordersUnsubscribe();
        ordersUnsubscribe = null;
    }
    
    let ordersRef = db.collection("orders"); 
    let query = isAdmin 
        ? ordersRef.orderBy("timestamp", "desc").limit(displayedOrdersLimit + 1) 
        : ordersRef.where("uid", "==", currentUser.uid); 
    
    ordersUnsubscribe = query.onSnapshot(snap => { 
        const loadMoreBtnContainer = document.getElementById('orders-load-more-container');
        const countContainer = document.getElementById('orders-count');
        if (snap.empty) { 
            container.innerHTML = `<p style="text-align:center;color:#444;font-size:12px">No orders yet.</p>`; 
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            if (countContainer) {
                countContainer.innerHTML = '0 Orders';
                countContainer.style.display = 'inline-flex';
            }
            return; 
        } 
        
        let docs = snap.docs;
        let showLoadMore = false;
        
        if (isAdmin) {
            if (docs.length > displayedOrdersLimit) {
                showLoadMore = true;
                docs = docs.slice(0, displayedOrdersLimit);
            }
        } else {
            docs = docs.sort((a, b) => {
                const tsA = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                const tsB = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                return tsB - tsA;
            });
            if (docs.length > displayedOrdersLimit) {
                showLoadMore = true;
                docs = docs.slice(0, displayedOrdersLimit);
            }
        }
        
        const visibleCount = docs.length;
        if (loadMoreBtnContainer) {
            if (showLoadMore) {
                loadMoreBtnContainer.innerHTML = `<button class="btn-gold" style="width:auto; padding:10px 20px; font-size:12px;" onclick="loadMoreOrders()">LOAD MORE ORDERS</button>`;
            } else {
                loadMoreBtnContainer.innerHTML = '';
            }
        }
        if (countContainer) {
            if (isAdmin) {
                countContainer.innerHTML = showLoadMore ? `Showing ${visibleCount}+ Orders` : `${visibleCount} Orders`;
            } else {
                countContainer.innerHTML = `Showing ${visibleCount} of ${snap.docs.length} Orders`;
            }
            countContainer.style.display = 'inline-flex';
        }
        
        container.innerHTML = docs.map(doc => { 
            const o = doc.data(); 
            const docId = doc.id;
            const orderIdStr = o.orderId || docId.slice(-6).toUpperCase();
            const promoInfo = o.discount > 0 ? `<div style="font-size:11px; color:#e74c3c; margin-bottom:5px;">Discount: -₹${o.discount}</div>` : '';
            const statusVal = o.status || 'pending';
            const statusInfo = ORDER_STATUSES.find(s => s.value === statusVal) || ORDER_STATUSES[0];
            const currentCourier = o.courier || '';
            const trackingId = o.trackingId || '';
            
            const itemsHtml = (() => {
                const orderGroups = {};
                (o.items || []).forEach(i => {
                    const prodId = i.id || i.name;
                    if (!orderGroups[prodId]) {
                        orderGroups[prodId] = {
                            name: i.name,
                            image: (i.images && i.images.length) ? i.images[0] : '',
                            variants: []
                        };
                    }
                    orderGroups[prodId].variants.push(i);
                });

                return Object.values(orderGroups).map(g => {
                    const variantListHtml = g.variants.map(i => {
                        const specs = [];
                        if (i.variantSize && i.variantSize !== 'Standard' && i.variantSize !== 'N/A') specs.push(i.variantSize);
                        const _oColorLabel = i.variantColorName || (i.variantColor ? formatColorName(i.variantColor) : '');
                        if (_oColorLabel) specs.push(_oColorLabel);
                        if (i.variantPattern && !i.variantPattern.startsWith('Design-') && !i.variantPatternImage) specs.push(i.variantPattern);
                        const variantDesc = specs.length > 0 ? specs.join(' • ') : 'Standard';

                        const patHtml = i.variantPatternImage ? `
                            <img src="${i.variantPatternImage}" title="Pattern: ${i.variantPattern || ''}" style="width:16px; height:16px; border-radius:3px; object-fit:cover; border:1px solid #1a1a1a; margin-right:5px; vertical-align:middle;">` : '';
                        const colHtml = i.variantColor ? `
                            <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${resolveCssColor(i.variantColor)}; border:1px solid rgba(255,255,255,0.2); margin-right:5px; vertical-align:middle;"></span>` : '';
                        const swatchIconHtml = `${patHtml}${colHtml}`;

                        return `
                        <div style="display:flex; align-items:center; justify-content:space-between; font-size:11px; color:#aaa; padding:4px 0; border-bottom:1px dashed #222;">
                            <div style="display:flex; align-items:center;">
                                ${swatchIconHtml}
                                <span>${variantDesc}</span>
                            </div>
                            <div style="margin-left:auto; text-align:right;">
                                <span style="color:#666; margin-right:8px;">×${i.qty||1}</span>
                                <span style="color:var(--gold)">₹${i.price * (i.qty||1)}</span>
                            </div>
                        </div>`;
                    }).join('');

                    return `
                    <div style="display:flex; gap:10px; margin-bottom:10px; background:#111; padding:8px; border-radius:8px; border:1px solid #222;">
                        <img src="${g.image}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" onerror="this.style.display='none'">
                        <div style="flex:1;">
                            <div style="font-size:12px; font-weight:bold; color:#fff; margin-bottom:5px;">${g.name}</div>
                            <div style="padding-left:5px;">
                                ${variantListHtml}
                            </div>
                        </div>
                    </div>`;
                }).join('');
            })();

            if (isAdmin) {
                // Admin detailed card with edit/status/tracking/courier controls
                const statusOptions = ORDER_STATUSES.map(s => `
                    <option value="${s.value}" ${s.value === statusVal ? 'selected' : ''}>${s.label}</option>
                `).join('');
                
                // Check if currentCourier is in the predefined list
                const isPredefined = COURIER_COMPANIES.some(c => c.value === currentCourier);
                const courierSelectValue = currentCourier ? (isPredefined ? currentCourier : 'Other') : '';
                const showCustomInput = courierSelectValue === 'Other';
                
                const courierOptions = COURIER_COMPANIES.map(c => `
                    <option value="${c.value}" ${c.value === courierSelectValue ? 'selected' : ''}>${c.label}</option>
                `).join('');

                return `
                <div id="order-card-${docId}" class="order-card" style="border:1px solid #333; margin-bottom:15px; background:#111; padding:15px; border-radius:15px; transition: background-color 0.4s ease, border-color 0.4s ease;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid #222; padding-bottom:10px;">
                        <div>
                            <span style="font-size:12px; font-weight:700; color:#fff; display:block;">Order #${orderIdStr}</span>
                            <span style="font-size:10px; color:#666;">${o.timestamp ? o.timestamp.toDate().toLocaleString('en-IN') : 'New'}</span>
                        </div>
                        <div style="font-size:11px; background:#1a1a1a; padding:4px 8px; border-radius:6px; border:1px solid #333; color:var(--gold); font-weight:bold;">
                            ₹${o.total || 0}
                        </div>
                    </div>

                    <!-- Customer Profile & Info -->
                    <div style="background:#1a1a1a; border-radius:8px; padding:10px; margin-bottom:12px; font-size:11px; line-height:1.7; border:1px solid #222;">
                        <div style="display:flex; gap:8px; flex-wrap:wrap; font-weight:600; color:#fff; margin-bottom:4px;">
                            <span>👤 ${o.recipient || 'N/A'}</span>
                            <span style="color:#444;">|</span>
                            <span>📱 ${o.phone || 'N/A'}</span>
                            ${o.email ? `
                            <span style="color:#444;">|</span>
                            <span>✉️ ${o.email}</span>` : ''}
                        </div>
                        <div style="color:#aaa;">📍 ${o.address || 'N/A'}</div>
                        <div style="color:#888; margin-top:2px;">💳 Payment: <b style="color:#fff;">${o.paymentMethod ? o.paymentMethod.toUpperCase() : 'N/A'}</b>${o.paymentMethod === 'cod' && o.codMinAmount ? ` <span style="color:#e67e22;">(Advance: ₹${o.codMinAmount})</span>` : ''}</div>
                    </div>

                    <!-- Order Items -->
                    <div style="margin-bottom:12px;">${itemsHtml}</div>
                    ${promoInfo}

                    <!-- Admin Status, Courier and Tracking Update Form -->
                    <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px; padding-top:12px; border-top:1px solid #222;">
                        <div style="display:flex; gap:10px; flex-wrap:wrap;">
                            <div style="flex:1; min-width:140px;">
                                <label style="font-size:9px; color:#666; text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Order Status</label>
                                <select id="status-sel-${docId}" 
                                    style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #333; background:#1a1a1a; color:#fff; font-size:12px; cursor:pointer;">
                                    ${statusOptions}
                                </select>
                            </div>
                            <div style="flex:1; min-width:140px;">
                                <label style="font-size:9px; color:#666; text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Courier Partner</label>
                                <select id="courier-sel-${docId}" 
                                    onchange="const customInp = document.getElementById('courier-custom-row-${docId}'); if (this.value === 'Other') { customInp.style.display = 'block'; } else { customInp.style.display = 'none'; }"
                                    style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #333; background:#1a1a1a; color:#fff; font-size:12px; cursor:pointer;">
                                    <option value="">-- Select Courier --</option>
                                    ${courierOptions}
                                </select>
                            </div>
                            <div style="flex:1; min-width:160px;">
                                <label style="font-size:9px; color:#666; text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Tracking / AWB ID</label>
                                <input id="tracking-input-${docId}" type="text" 
                                    placeholder="e.g. 78291829029"
                                    value="${trackingId}"
                                    style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #333; background:#1a1a1a; color:#fff; font-size:12px; font-family:monospace; margin:0;">
                            </div>
                        </div>
                        
                        <!-- Custom Courier input if 'Other' selected -->
                        <div id="courier-custom-row-${docId}" style="display:${showCustomInput ? 'block' : 'none'}; margin-top:2px;">
                            <label style="font-size:9px; color:#666; text-transform:uppercase; font-weight:700; display:block; margin-bottom:4px;">Custom Delivery Partner Name</label>
                            <input id="courier-custom-input-${docId}" type="text" 
                                placeholder="Enter courier name..."
                                value="${!isPredefined ? currentCourier : ''}"
                                style="width:100%; box-sizing:border-box; padding:8px 10px; border-radius:8px; border:1px solid #333; background:#1a1a1a; color:#fff; font-size:12px; margin:0;">
                        </div>

                        <!-- Notification History Tracking -->
                        <div style="background:#111; border-radius:6px; padding:8px; margin-top:8px; font-size:10px; border:1px dashed #333; line-height:1.4;">
                            <div style="font-weight:700; color:#aaa; margin-bottom:4px; text-transform:uppercase; font-size:9px; letter-spacing:0.5px;">🔔 Notification Status Log:</div>
                            ${(() => {
                                const notifs = o.notifications || {};
                                const statusesList = ['placed', 'pending', 'confirmed', 'payment_processed', 'processing', 'shipped', 'delivered', 'cancelled'];
                                let logHtml = '';
                                statusesList.forEach(st => {
                                    const stNode = notifs[st];
                                    if (stNode && (stNode.customerMailSent || stNode.adminTelegramSent || stNode.adminMailSent)) {
                                        const logs = [];
                                        if (stNode.adminTelegramSent) logs.push('Telegram sent to Admin ✅');
                                        if (stNode.customerMailSent) logs.push('Email sent to Customer ✉️');
                                        if (stNode.adminMailSent) logs.push('Email sent to Admin ✉️');
                                        
                                        const stLabel = ORDER_STATUSES.find(x => x.value === st)?.label || st;
                                        logHtml += `<div style="margin-bottom:2px; color:#ccc;"><strong>${stLabel}:</strong> ${logs.join(' | ')}</div>`;
                                    }
                                });
                                return logHtml || '<div style="color:#666; font-style:italic;">No notifications sent yet.</div>';
                            })()}
                        </div>

                        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:4px;">
                            <button onclick="saveAdminOrderChanges('${docId}', 'none')"
                                style="flex:1; padding:10px; border-radius:8px; border:none; background:var(--gold); color:#000; font-size:12px; font-weight:700; cursor:pointer; min-width:110px;">
                                💾 Save Changes
                            </button>
                            <button onclick="saveAdminOrderChanges('${docId}', 'admin')"
                                style="flex:1; padding:10px; border-radius:8px; border:1px solid #25D366; background:transparent; color:#25D366; font-size:12px; font-weight:700; cursor:pointer; min-width:130px;">
                                📨 Save & Notify Admin
                            </button>
                            <button onclick="saveAdminOrderChanges('${docId}', 'customer')"
                                style="flex:1; padding:10px; border-radius:8px; border:1px solid #0088cc; background:transparent; color:#0088cc; font-size:12px; font-weight:700; cursor:pointer; min-width:140px;">
                                ✉️ Save & Notify Customer
                            </button>
                        </div>
                    </div>
                </div>`;
            } else {
                // Customer read-only card (exactly matching original layout)
                let trackingHtml = '';
                if (trackingId) {
                    const courierLabel = currentCourier || 'Courier';
                    trackingHtml = `
                    <div style="background:#1a1a1a; border:1px solid #222; border-radius:8px; padding:8px 12px; margin-bottom:10px; font-size:11px;">
                        <span style="color:#aaa;">Delivery Partner:</span> <b style="color:#fff;">${courierLabel}</b><br>
                        <span style="color:#aaa;">Tracking ID:</span> <b style="color:var(--gold); font-family:monospace;">${trackingId}</b>
                    </div>`;
                }

                return `
                <div class="order-card">
                    <div style="display:flex; justify-content:space-between; font-size:10px; color:#666; margin-bottom:8px">
                        <span>#${orderIdStr}</span>
                        <span style="display:flex; align-items:center; gap:4px;">
                            <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${statusVal === 'delivered' ? '#2ecc71' : statusVal === 'cancelled' ? '#e74c3c' : '#f1c40f'}"></span>
                            ${statusInfo.label}
                        </span>
                        <span>${o.timestamp ? o.timestamp.toDate().toLocaleDateString('en-IN') : 'New'}</span>
                    </div>
                    <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">Payment: <b>${o.paymentMethod ? o.paymentMethod.toUpperCase() : 'N/A'}</b>${o.paymentMethod === 'cod' && o.codMinAmount ? ` <span style="color:#e67e22; font-size:10px;">(Advance: ₹${o.codMinAmount})</span>` : ''}</div>
                    ${trackingHtml}
                    ${itemsHtml}
                    ${promoInfo}
                    <div style="margin-top:10px; font-weight:bold; color:var(--gold); text-align:right; font-size:16px;">Total: ₹${o.total || 0}</div>
                </div>`; 
            }
        }).join(''); 
    }, error => {
        console.error("Orders load error:", error);
        container.innerHTML = `<p style="text-align:center;color:#e74c3c;font-size:12px;">Error loading orders. Please try again.</p>`;
    }); 
}

function loadMoreOrders() {
    displayedOrdersLimit += 20;
    loadOrders();
}

window.saveAdminOrderChanges = async function(docId, notifyType) {
    const statusVal = document.getElementById(`status-sel-${docId}`).value;
    const courierSelect = document.getElementById(`courier-sel-${docId}`).value;
    const trackingVal = document.getElementById(`tracking-input-${docId}`).value.trim();
    
    let courierVal = courierSelect;
    if (courierSelect === 'Other') {
        const customInp = document.getElementById(`courier-custom-input-${docId}`);
        courierVal = customInp ? customInp.value.trim() : 'Other';
    }
    
    try {
        const snap = await db.collection('orders').doc(docId).get();
        if (snap.exists) {
            const orderData = snap.data();
            const notifications = orderData.notifications || {};
            const statusNode = notifications[statusVal] || {};
            
            if (notifyType === 'admin') {
                if (statusNode.adminTelegramSent || orderData.status === statusVal) {
                    const msg = statusNode.adminTelegramSent 
                        ? `A Telegram notification for "${statusVal}" has already been sent to the admin. Do you want to send it again?`
                        : `Order status is already "${statusVal}". Do you want to send Telegram notification anyway?`;
                    if (!confirm(msg)) return;
                }
            } else if (notifyType === 'customer') {
                const customerEmail = orderData.email ? orderData.email.toLowerCase().trim() : '';
                const isCustAdmin = customerEmail === 'superadmin@swagstree.com' ||
                                    customerEmail === 'admin@swagstree.com' ||
                                    (typeof assignedAdmins !== 'undefined' && Array.isArray(assignedAdmins) && assignedAdmins.some(a => a.email && a.email.toLowerCase() === customerEmail && a.status === 'active'));
                
                if (isCustAdmin) {
                    showToast("⚠️ Customer is Admin/Superadmin. Skip sending email.");
                    notifyType = 'none';
                } else {
                    if (statusNode.customerMailSent || orderData.status === statusVal) {
                        const msg = statusNode.customerMailSent
                            ? `An Email notification for "${statusVal}" has already been sent to the customer. Do you want to send it again?`
                            : `Order status is already "${statusVal}". Do you want to send Email notification anyway?`;
                        if (!confirm(msg)) return;
                    }
                }
            }
        }
    } catch(err) {
        console.error("Error checking existing notification status:", err);
    }
    
    await updateOrderStatus(docId, statusVal, courierVal, trackingVal, notifyType);
};

async function updateOrderStatus(docId, newStatus, courier, trackingId, notifyType) {
    if (!docId) return;
    const statusInfo = ORDER_STATUSES.find(s => s.value === newStatus) || ORDER_STATUSES[0];
    try {
        const docRef = db.collection('orders').doc(docId);
        const snap = await docRef.get();
        if (!snap.exists) return;
        const orderData = snap.data();
        
        let notifications = orderData.notifications || {};
        if (!notifications[newStatus]) {
            notifications[newStatus] = {
                customerMailSent: false,
                adminMailSent: false,
                adminTelegramSent: false
            };
        }
        
        const updateData = {
            status: newStatus,
            courier: courier || '',
            trackingId: trackingId || '',
            statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        if (notifyType === 'admin') {
            await triggerTelegramNotification(orderData, docId, newStatus, courier, trackingId);
            notifications[newStatus].adminTelegramSent = true;
            updateData.notifications = notifications;
        } else if (notifyType === 'customer') {
            await triggerEmailNotification(orderData, docId, newStatus, courier, trackingId);
            notifications[newStatus].customerMailSent = true;
            updateData.notifications = notifications;
        }
        
        await docRef.update(updateData);
        
        // Flash card confirmation
        const cardEl = document.getElementById(`order-card-${docId}`);
        if (cardEl) {
            const originalBg = cardEl.style.backgroundColor;
            const originalBorder = cardEl.style.borderColor;
            
            // Flashing gold/green effect
            cardEl.style.backgroundColor = 'rgba(212, 175, 55, 0.15)';
            cardEl.style.borderColor = 'var(--gold)';
            
            setTimeout(() => {
                cardEl.style.backgroundColor = originalBg;
                cardEl.style.borderColor = originalBorder;
            }, 600);
        }
        
        showToast(`✅ Order updated: ${statusInfo.label}`);
    } catch(e) {
        console.error('updateOrderStatus error:', e);
        showToast('Failed to update order: ' + e.message);
    }
}
window.updateOrderStatus = updateOrderStatus;

async function triggerTelegramNotification(orderData, docId, newStatus, courier, trackingId) {
    function escapeHTML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    try {
        const cfgSnap = await db.collection('settings').doc('telegram').get();
        if (!cfgSnap.exists) {
            showToast('⚠️ Telegram not configured in Admin panel.');
            return;
        }
        const cfg = cfgSnap.data();
        const botToken = cfg.token;
        
        let chatIds = [];
        if (Array.isArray(cfg.chatIds)) {
            chatIds = cfg.chatIds.filter(id => id.trim());
        } else if (cfg.chatId) {
            chatIds = [cfg.chatId.trim()];
        }
        
        if (!botToken || chatIds.length === 0) {
            showToast('⚠️ Missing Telegram Bot Token or Chat ID.');
            return;
        }

        const statusInfo = ORDER_STATUSES.find(s => s.value === newStatus) || { label: newStatus };
        const orderId = orderData.orderId || docId.slice(-6).toUpperCase();
        const itemsList = (orderData.items || [])
            .map(i => `• ${escapeHTML(i.name)} (×${i.qty || 1}) — ₹${(i.price || 0) * (i.qty || 1)}`)
            .join('\n');

        const message = [
            `🛍️ <b>SWAG STREE — Order Update</b>`,
            ``,
            `📋 <b>Order ID:</b> #${escapeHTML(orderId)}`,
            `📦 <b>New Status:</b> ${escapeHTML(statusInfo.label)}`,
            courier ? `🚚 <b>Courier:</b> ${escapeHTML(courier)}` : '',
            trackingId ? `🎫 <b>Tracking ID:</b> <code>${escapeHTML(trackingId)}</code>` : '',
            ``,
            `👤 <b>Customer:</b> ${escapeHTML(orderData.recipient || 'N/A')}`,
            `📱 <b>Phone:</b> ${escapeHTML(orderData.phone || 'N/A')}`,
            `📍 <b>Address:</b> ${escapeHTML(orderData.address || 'N/A')}`,
            ``,
            `🧾 <b>Items:</b>`,
            itemsList,
            ``,
            `💰 <b>Total:</b> ₹${orderData.total || 0}`,
            `💳 <b>Payment:</b> ${orderData.paymentMethod ? escapeHTML(orderData.paymentMethod.toUpperCase()) : 'N/A'}`,
        ].filter(line => line !== '').join('\n');

        // Dispatch notifications to all configured Chat IDs asynchronously
        let successCount = 0;
        await Promise.all(chatIds.map(async (chatId) => {
            try {
                const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}&parse_mode=HTML`;
                const res = await fetch(url, { method: 'GET' });
                const data = await res.json();
                if (data.ok) {
                    successCount++;
                } else {
                    console.error("Telegram API returned error:", data);
                }
            } catch (err) {
                console.error(`Error sending telegram to ${chatId}:`, err);
            }
        }));

        if (successCount > 0) {
            showToast(`📨 Sent notification to ${successCount} admin account(s)!`);
        } else {
            showToast('⚠️ Telegram notification dispatch failed.');
        }
    } catch(e) {
        console.error('triggerTelegramNotification error:', e);
        showToast('Telegram send failed: ' + e.message);
    }
}
window.triggerTelegramNotification = triggerTelegramNotification;

async function triggerEmailNotification(orderData, docId, newStatus, courier, trackingId) {
    // Check if the order has a customer email stored
    const customerEmail = orderData.email;
    if (!customerEmail) {
        console.log("No customer email found for order", docId, "- skipping status email.");
        return;
    }
    
    try {
        const emailSnap = await db.collection('settings').doc('email').get();
        let brevoKey = '';
        if (emailSnap.exists) {
            brevoKey = emailSnap.data().brevoKey || '';
        }
        
        if (!brevoKey) {
            console.error("Brevo API key is not configured in Firestore settings/email - skipping status update email.");
            return;
        }
        
        const orderId = orderData.orderId || docId.slice(-6).toUpperCase();
        
        // Support dynamic title/msg for any status update
        const statusInfo = ORDER_STATUSES.find(s => s.value === newStatus) || { label: newStatus };
        let statusTitle = `Order status update: ${statusInfo.label}`;
        let statusMsg = `Your order **#${orderId}** status has been updated to **${statusInfo.label}**.`;
        
        if (newStatus === 'payment_processed') {
            statusTitle = "Payment Received & Processed! 💳";
            statusMsg = `Thank you! Your payment for order **#${orderId}** has been successfully processed. We are preparing your order for shipment.`;
        } else if (newStatus === 'shipped') {
            statusTitle = "Your Order has been Shipped! 🚚";
            statusMsg = `Great news! Your order **#${orderId}** has been shipped. ${courier ? `It has been sent via **${courier}**.` : ''} ${trackingId ? `Your Tracking ID is: **${trackingId}**` : ''}`;
        } else if (newStatus === 'delivered') {
            statusTitle = "Your Order has been Delivered! 🎉";
            statusMsg = `Hooray! Your order **#${orderId}** has been successfully delivered. Thank you for shopping with Swag Stree!`;
        } else if (newStatus === 'cancelled') {
            statusTitle = "Your Order has been Cancelled ❌";
            statusMsg = `Your order **#${orderId}** has been cancelled.`;
        }
        
        const htmlContent = `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e0e0e0;border-radius:12px;overflow:hidden;padding:24px;">
            <div style="text-align:center;background:#000000;padding:20px;border-radius:8px;margin-bottom:20px;">
                <h1 style="color:#FFD700;margin:0;font-size:24px;letter-spacing:2px;">SWAG STREE</h1>
            </div>
            <h2 style="color:#111;margin-top:0;">${statusTitle}</h2>
            <p style="font-size:14px;color:#555;line-height:1.6;">Hi ${orderData.recipient || 'Customer'},</p>
            <p style="font-size:14px;color:#555;line-height:1.6;">${statusMsg}</p>
            <div style="background:#f9f9f9;padding:15px;border-radius:8px;margin:20px 0;border-left:4px solid #FFD700;">
                <div style="font-size:12px;color:#888;">ORDER SUMMARY:</div>
                <div style="font-weight:bold;font-size:14px;margin-top:5px;color:#111;">Total Amount: ₹${orderData.total}</div>
                <div style="font-size:13px;color:#555;margin-top:3px;">Payment Method: ${orderData.paymentMethod ? orderData.paymentMethod.toUpperCase() : 'N/A'}</div>
            </div>
            <p style="font-size:14px;color:#555;line-height:1.6;">If you have any questions, feel free to contact us via WhatsApp.</p>
            <div style="text-align:center;margin-top:30px;">
                <a href="https://wa.me/918800467686" style="display:inline-block;background:#25D366;color:#ffffff;text-decoration:none;font-size:12px;font-weight:700;padding:10px 22px;border-radius:24px;">Chat on WhatsApp</a>
            </div>
        </div>
        `;
        
        const toList = [
            {
                email: customerEmail,
                name: orderData.recipient || "Customer"
            }
        ];
        
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': brevoKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: {
                    name: "Swag Stree",
                    email: "orders@swagstree.com"
                },
                to: toList,
                subject: `Order #${orderId} - Status Update: ${newStatus.toUpperCase()}`,
                htmlContent: htmlContent
            })
        });
        
        if (!response.ok) {
            console.error("Brevo status email failed:", response.status, await response.text());
        } else {
            console.log(`Brevo status email (${newStatus}) sent successfully.`);
        }
    } catch (err) {
        console.error("Failed to send status email via Brevo", err);
    }
}
window.triggerEmailNotification = triggerEmailNotification;

// ── Checkout Auto-population from Saved Profile Address ──────────────────
async function syncDefaultAddressToCheckout() {
    const addrField = document.getElementById('c-addr');
    if (!addrField) return;

    if (currentUser) {
        try {
            const addrSnap = await db.collection("users").doc(currentUser.uid).collection("addresses").where("isDefault", "==", true).limit(1).get();
            if (!addrSnap.empty) {
                addrField.value = addrSnap.docs[0].data().address || '';
            } else {
                const homeSnap = await db.collection("users").doc(currentUser.uid).collection("addresses").where("tag", "==", "Home").limit(1).get();
                if (!homeSnap.empty) {
                    addrField.value = homeSnap.docs[0].data().address || '';
                } else {
                    const anyAddrSnap = await db.collection("users").doc(currentUser.uid).collection("addresses").limit(1).get();
                    if (!anyAddrSnap.empty) {
                        addrField.value = anyAddrSnap.docs[0].data().address || '';
                    }
                }
            }
        } catch (e) {
            console.error("Error syncing default address to checkout:", e);
        }
    } else {
        let localAddresses = [];
        try {
            localAddresses = JSON.parse(localStorage.getItem("swagstree_addresses") || "[]");
        } catch (e) {
            localAddresses = [];
        }
        const defaultLocal = localAddresses.find(a => a.isDefault);
        if (defaultLocal) {
            addrField.value = defaultLocal.address;
        } else {
            const homeLocal = localAddresses.find(a => a.tag === 'Home');
            if (homeLocal) {
                addrField.value = homeLocal.address;
            } else if (localAddresses.length > 0) {
                addrField.value = localAddresses[0].address;
            }
        }
    }
}

async function autoPopulateCheckoutDetails() {
    const nameField = document.getElementById('c-name');
    const phoneField = document.getElementById('c-phone');
    const emailField = document.getElementById('c-email');
    const addrField = document.getElementById('c-addr');

    if (currentUser) {
        // Logged-in user: Prefill name & email
        if (nameField && !nameField.value.trim()) {
            nameField.value = currentUser.displayName || '';
        }
        if (emailField && !emailField.value.trim()) {
            emailField.value = currentUser.email || '';
        }
        
        try {
            const userDoc = await db.collection("users").doc(currentUser.uid).get();
            if (userDoc.exists) {
                const uData = userDoc.data();
                if (nameField && !nameField.value.trim() && uData.displayName) {
                    nameField.value = uData.displayName;
                }
                if (phoneField && !phoneField.value.trim() && uData.phone) {
                    phoneField.value = uData.phone;
                }
            }

            // Prefill with default profile address from Firestore
            if (addrField && !addrField.value.trim()) {
                await syncDefaultAddressToCheckout();
            }
        } catch (e) {
            console.error("Error populating from Firestore:", e);
        }
    } else {
        // Guest user: Prefill from localStorage cache of previous checkouts
        if (nameField && !nameField.value.trim()) {
            nameField.value = localStorage.getItem("swagstree_guest_name") || '';
        }
        if (phoneField && !phoneField.value.trim()) {
            phoneField.value = localStorage.getItem("swagstree_guest_phone") || '';
        }
        if (emailField && !emailField.value.trim()) {
            emailField.value = localStorage.getItem("swagstree_guest_email") || '';
        }
        if (addrField && !addrField.value.trim()) {
            await syncDefaultAddressToCheckout();
        }
    }
}

// ── Profile Address Accordion Functions ────────────────────────
let activeProfAddressTag = 'Home';
let profLeafletMap = null;
let profLeafletMarker = null;
let editingProfileAddressId = null;

async function reverseGeocodeOSM(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`, {
            headers: {
                'Accept-Language': 'en'
            }
        });
        if (!response.ok) return '';
        const data = await response.json();
        return data.display_name || '';
    } catch (e) {
        console.error("OSM Geocoding failed:", e);
        return '';
    }
}

function toggleProfileAddressAccordion() {
    const content = document.getElementById('prof-addr-accord-content');
    const icon = document.getElementById('prof-addr-accord-icon');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        if (icon) icon.style.transform = 'rotate(180deg)';
        loadProfileAddresses();
    } else {
        content.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function selectProfAddrTag(tag) {
    activeProfAddressTag = tag;
    document.querySelectorAll('.prof-addr-tag').forEach(btn => {
        if (btn.dataset.tag === tag) {
            btn.classList.add('active');
            btn.style.border = '1px solid var(--gold)';
            btn.style.color = '#fff';
        } else {
            btn.classList.remove('active');
            btn.style.border = '1px solid #333';
            btn.style.color = '#888';
        }
    });
    // On switching from home to office to other, clear the address text if NOT editing an existing address
    if (!editingProfileAddressId) {
        const textInput = document.getElementById('prof-new-addr-text');
        if (textInput) textInput.value = '';
    }
}

function toggleProfileMapPicker() {
    const container = document.getElementById('prof-map-picker-container');
    if (container.style.display === 'none') {
        container.style.display = 'block';
        initProfileLeafletMap();
    } else {
        container.style.display = 'none';
    }
}

function initProfileLeafletMap() {
    if (profLeafletMap) {
        setTimeout(() => profLeafletMap.invalidateSize(), 200);
        return;
    }
    const defaultLat = 28.6139;
    const defaultLon = 77.2090;

    profLeafletMap = L.map('prof-map-picker-container').setView([defaultLat, defaultLon], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(profLeafletMap);

    profLeafletMarker = L.marker([defaultLat, defaultLon], { draggable: true }).addTo(profLeafletMap);

    const updateFromCoords = async (lat, lon) => {
        profLeafletMarker.setLatLng([lat, lon]);
        profLeafletMap.panTo([lat, lon]);
        const addrText = await reverseGeocodeOSM(lat, lon);
        if (addrText) {
            document.getElementById('prof-new-addr-text').value = addrText;
        }
    };

    profLeafletMap.on('click', (e) => {
        updateFromCoords(e.latlng.lat, e.latlng.lng);
    });

    profLeafletMarker.on('dragend', () => {
        const pos = profLeafletMarker.getLatLng();
        updateFromCoords(pos.lat, pos.lng);
    });
}

function useProfileCurrentLocation() {
    if (!navigator.geolocation) {
        return showToast("Geolocation is not supported by your browser");
    }
    
    showToast("📍 Requesting current location...");

    const successCallback = async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        showToast("📍 Location found! Fetching address...");
        
        const container = document.getElementById('prof-map-picker-container');
        if (container && container.style.display === 'none') {
            container.style.display = 'block';
        }

        if (profLeafletMap) {
            profLeafletMap.setView([lat, lon], 15);
            profLeafletMarker.setLatLng([lat, lon]);
            setTimeout(() => profLeafletMap.invalidateSize(), 200);
        } else {
            initProfileLeafletMap();
            profLeafletMap.setView([lat, lon], 15);
            profLeafletMarker.setLatLng([lat, lon]);
            setTimeout(() => profLeafletMap.invalidateSize(), 200);
        }
        
        const addrText = await reverseGeocodeOSM(lat, lon);
        if (addrText) {
            document.getElementById('prof-new-addr-text').value = addrText;
            showToast("Address populated.");
        }
    };

    const errorCallback = (err) => {
        console.error("Geolocation error:", err);
        if (err.code === 3 || err.code === 2) {
            // Fallback to lower accuracy if high accuracy timed out or is unavailable (common in mobile browsers indoors)
            showToast("GPS timed out. Trying cell/Wi-Fi geolocation...");
            navigator.geolocation.getCurrentPosition(successCallback, (fallbackErr) => {
                console.error("Fallback geolocation error:", fallbackErr);
                showToast("Unable to retrieve location. Make sure Location Services (GPS) are enabled.");
            }, { enableHighAccuracy: false, timeout: 8000 });
        } else if (err.code === 1) {
            showToast("Location permission denied. Please allow location access.");
        } else {
            showToast("Unable to retrieve location. Please check your GPS settings.");
        }
    };

    navigator.geolocation.getCurrentPosition(successCallback, errorCallback, {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0
    });
}

async function loadProfileAddresses() {
    const listContainer = document.getElementById('prof-saved-addresses-list');
    if (!listContainer) return;

    let addresses = [];
    if (currentUser) {
        try {
            const snap = await db.collection("users").doc(currentUser.uid).collection("addresses").get();
            snap.forEach(doc => {
                addresses.push({ id: doc.id, ...doc.data() });
            });
        } catch (err) {
            console.error("Error loading addresses:", err);
        }
    } else {
        const localData = localStorage.getItem("swagstree_addresses");
        if (localData) {
            try {
                addresses = JSON.parse(localData);
            } catch (e) {
                addresses = [];
            }
        }
    }

    if (addresses.length === 0) {
        listContainer.innerHTML = `<p style="text-align:center; color:#555; font-size:11px; margin:5px 0;">No saved addresses. Add one below.</p>`;
        return;
    }

    addresses.sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

    let html = '';
    addresses.forEach(addr => {
        const badge = addr.isDefault ? `<span style="background:var(--gold); color:#000; font-size:9px; font-weight:700; padding:2px 6px; border-radius:4px; margin-left:6px;">DEFAULT</span>` : '';
        const radioChecked = addr.isDefault ? 'checked' : '';
        
        const onSelect = `selectProfileAddressDefault('${addr.id || addr.address.replace(/'/g, "\\'")}')`;
        const onDelete = `deleteProfileAddress('${addr.id || addr.address.replace(/'/g, "\\'")}')`;
        const onEdit = `editProfileAddress('${addr.id || addr.address.replace(/'/g, "\\'")}')`;
        
        html += `
            <div style="background:#1a1a1a; padding:10px; border-radius:8px; border:1px solid #222; display:flex; align-items:flex-start; gap:10px;">
                <input type="radio" name="selected_profile_address" ${radioChecked} onclick="${onSelect}" style="margin-top:3px; accent-color:var(--gold);">
                <div style="flex:1; font-size:12px;">
                    <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:5px;">
                        <span>📍 ${addr.tag}</span>${badge}
                    </div>
                    <div style="color:#aaa; margin-top:3px; line-height:1.4;">${addr.address}</div>
                </div>
                <div style="display:flex; gap:10px; align-items:center; margin-top:3px;">
                    <i class="fa fa-edit" onclick="${onEdit}" style="color:var(--gold); cursor:pointer; font-size:12px;" title="Edit Address"></i>
                    <i class="fa fa-trash" onclick="${onDelete}" style="color:var(--red); cursor:pointer; font-size:12px;" title="Delete Address"></i>
                </div>
            </div>
        `;
    });
    listContainer.innerHTML = html;
}

async function selectProfileAddressDefault(id) {
    if (currentUser) {
        try {
            const userRef = db.collection("users").doc(currentUser.uid);
            const snapshot = await userRef.collection("addresses").get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.update(doc.ref, { isDefault: (doc.id === id) });
            });
            await batch.commit();
            showToast("Default address updated!");
            loadProfileAddresses();
            await syncDefaultAddressToCheckout();
        } catch (err) {
            console.error("Error setting default address:", err);
        }
    } else {
        let localData = [];
        try {
            localData = JSON.parse(localStorage.getItem("swagstree_addresses") || "[]");
        } catch (e) {
            localData = [];
        }
        localData.forEach(a => a.isDefault = (a.id === id));
        localStorage.setItem("swagstree_addresses", JSON.stringify(localData));
        showToast("Default address updated!");
        loadProfileAddresses();
        await syncDefaultAddressToCheckout();
    }
}

async function editProfileAddress(id) {
    let addr = null;
    if (currentUser) {
        try {
            const doc = await db.collection("users").doc(currentUser.uid).collection("addresses").doc(id).get();
            if (doc.exists) {
                addr = { id: doc.id, ...doc.data() };
            }
        } catch (err) {
            console.error("Error fetching address for edit:", err);
        }
    } else {
        let localData = [];
        try {
            localData = JSON.parse(localStorage.getItem("swagstree_addresses") || "[]");
        } catch (e) {
            localData = [];
        }
        addr = localData.find(a => a.id === id || a.address === id);
    }

    if (!addr) {
        return showToast("Address not found");
    }

    editingProfileAddressId = id;
    
    const titleEl = document.getElementById('prof-addr-form-title');
    if (titleEl) titleEl.innerText = "Edit Address";
    
    const saveBtn = document.getElementById('prof-save-addr-btn');
    if (saveBtn) saveBtn.innerText = "Update Address";
    
    const cancelBtn = document.getElementById('prof-cancel-addr-btn');
    if (cancelBtn) cancelBtn.style.display = 'inline-block';

    selectProfAddrTag(addr.tag);
    
    const textInput = document.getElementById('prof-new-addr-text');
    if (textInput) textInput.value = addr.address;
    
    const defaultCheckbox = document.getElementById('prof-new-addr-default');
    if (defaultCheckbox) defaultCheckbox.checked = addr.isDefault;

    const container = document.getElementById('prof-new-addr-text');
    if (container) {
        container.focus();
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function cancelProfileAddressEdit() {
    editingProfileAddressId = null;
    
    const titleEl = document.getElementById('prof-addr-form-title');
    if (titleEl) titleEl.innerText = "Add New Address";
    
    const saveBtn = document.getElementById('prof-save-addr-btn');
    if (saveBtn) saveBtn.innerText = "Save Address";
    
    const cancelBtn = document.getElementById('prof-cancel-addr-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';

    const textInput = document.getElementById('prof-new-addr-text');
    if (textInput) textInput.value = '';
    const defaultCheckbox = document.getElementById('prof-new-addr-default');
    if (defaultCheckbox) defaultCheckbox.checked = false;
}

async function addNewProfileAddress() {
    const text = document.getElementById('prof-new-addr-text').value.trim();
    const isDefault = document.getElementById('prof-new-addr-default').checked;

    if (!text) {
        return showToast("Please enter address details or select on map");
    }

    const newAddrObj = {
        tag: activeProfAddressTag,
        address: text,
        isDefault: isDefault,
        createdAt: new Date().toISOString()
    };

    if (currentUser) {
        try {
            const userRef = db.collection("users").doc(currentUser.uid);
            if (isDefault) {
                const existing = await userRef.collection("addresses").where("isDefault", "==", true).get();
                const batch = db.batch();
                existing.forEach(doc => {
                    if (!editingProfileAddressId || doc.id !== editingProfileAddressId) {
                        batch.update(doc.ref, { isDefault: false });
                    }
                });
                await batch.commit();
            }

            if (editingProfileAddressId) {
                await userRef.collection("addresses").doc(editingProfileAddressId).update(newAddrObj);
                showToast("Address updated!");
            } else {
                await userRef.collection("addresses").add(newAddrObj);
                showToast("Address added to Profile!");
            }
        } catch (err) {
            console.error("Error saving profile address:", err);
            showToast("Failed to save address");
        }
    } else {
        let localData = [];
        try {
            localData = JSON.parse(localStorage.getItem("swagstree_addresses") || "[]");
        } catch (e) {
            localData = [];
        }

        if (isDefault) {
            localData.forEach(a => {
                if (!editingProfileAddressId || (a.id !== editingProfileAddressId && a.address !== editingProfileAddressId)) {
                    a.isDefault = false;
                }
            });
        }

        if (editingProfileAddressId) {
            const index = localData.findIndex(a => a.id === editingProfileAddressId || a.address === editingProfileAddressId);
            if (index !== -1) {
                localData[index] = { ...localData[index], ...newAddrObj };
                showToast("Address updated locally!");
            } else {
                newAddrObj.id = Math.random().toString(36).substring(2, 9);
                localData.push(newAddrObj);
                showToast("Address added locally!");
            }
        } else {
            newAddrObj.id = Math.random().toString(36).substring(2, 9);
            localData.push(newAddrObj);
            showToast("Address added locally!");
        }
        localStorage.setItem("swagstree_addresses", JSON.stringify(localData));
    }

    cancelProfileAddressEdit();
    loadProfileAddresses();
    await syncDefaultAddressToCheckout();
}

async function deleteProfileAddress(id) {
    if (!confirm("Are you sure you want to delete this address?")) return;

    if (editingProfileAddressId === id) {
        cancelProfileAddressEdit();
    }

    if (currentUser) {
        try {
            await db.collection("users").doc(currentUser.uid).collection("addresses").doc(id).delete();
            showToast("Address deleted from Profile.");
        } catch (err) {
            console.error("Failed deleting address:", err);
        }
    } else {
        let localData = [];
        try {
            localData = JSON.parse(localStorage.getItem("swagstree_addresses") || "[]");
        } catch (e) {
            localData = [];
        }
        localData = localData.filter(a => (a.id !== id && a.address !== id));
        localStorage.setItem("swagstree_addresses", JSON.stringify(localData));
        showToast("Address deleted.");
    }
    loadProfileAddresses();
    await syncDefaultAddressToCheckout();
}


