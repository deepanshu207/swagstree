// ==========================================
// SWAG STREE | CART, CHECKOUT & ORDERS
// ==========================================

// Global variables fallback definition to prevent browser cache mismatch crashes
if (typeof products === 'undefined') window.products = [];
if (typeof selectedSize === 'undefined') window.selectedSize = 'S';
if (typeof selectedColor === 'undefined') window.selectedColor = '';
if (typeof cart === 'undefined') window.cart = [];
if (typeof isAdmin === 'undefined') window.isAdmin = false;
if (typeof currentUser === 'undefined') window.currentUser = null;

let activePromo = null;
let codMinPayment = 100; // Default, loaded from Firestore
let _pendingOrderArgs = null;
let globalMaxCartQty = 1;

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
        specs.push(formatColorName(color));
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

async function loadPromos() {
    try {
        const snap = await db.collection('settings').doc('promos').get();
        if (snap.exists) {
            const list = snap.data().list || [];
            const now = Date.now();
            let updated = false;
            
            list.forEach(p => {
                if (!p.expiresAt) {
                    p.expiresAt = now + (30 * 24 * 60 * 60 * 1000);
                    updated = true;
                }
            });

            const unexpired = list.filter(p => !(p.expiresAt && now > p.expiresAt));
            activePromosList = unexpired;
            if (list.length !== unexpired.length || updated) {
                await db.collection('settings').doc('promos').set({ list: unexpired }, { merge: true });
                if (typeof adminPromoList !== 'undefined') {
                    adminPromoList = unexpired;
                    if (typeof renderAdminPromoList === 'function') {
                        renderAdminPromoList();
                    }
                }
            }
        }
    } catch(e) {
        console.error("Failed to load promos", e);
    }
}

// Ensure promos are loaded early
loadPromos();

async function applyPromo() {
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    if (!code) return;
    
    const promo = activePromosList.find(p => p.code === code);
    
    if (promo) {
        if (promo.expiresAt && Date.now() > promo.expiresAt) {
            activePromo = null;
            showToast("Invalid or Expired Promo Code");
            activePromosList = activePromosList.filter(p => p.code !== code);
            try {
                await db.collection('settings').doc('promos').set({ list: activePromosList }, { merge: true });
                if (typeof adminPromoList !== 'undefined') {
                    adminPromoList = activePromosList;
                    if (typeof renderAdminPromoList === 'function') {
                        renderAdminPromoList();
                    }
                }
            } catch(e) {
                console.error("Failed to auto-delete expired promo", e);
            }
        } else {
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
    cart.forEach((it, idx) => {
        const specs = [];
        if (it.variantSize && it.variantSize !== 'Standard') {
            specs.push(it.variantSize);
        }
        if (it.variantColor) {
            specs.push(formatColorName(it.variantColor));
        }
        if (it.variantPattern && !it.variantPattern.startsWith('Design-')) {
            specs.push(it.variantPattern);
        }
        const variantText = specs.length > 0 ? specs.join(' • ') : '';
        const priceText = `₹${it.price}`;
        const infoLine = variantText ? `${variantText} • ${priceText}` : priceText;
        
        const imgUrl = it.image || it.variantImage || (it.images && it.images[0]) || 'https://placehold.co/400x400/222/FFF?text=No+Image';
        
        // Pattern swatch: shown as a small overlay badge on the product image when available
        const patternSwatchHtml = it.variantPatternImage ? `
            <div style="position:relative; width:50px; height:50px; flex-shrink:0;">
                <img src="${imgUrl}" style="width:50px; height:50px; border-radius:8px; object-fit:cover">
                <img src="${it.variantPatternImage}" title="Pattern: ${it.variantPattern || ''}" style="position:absolute; bottom:-4px; right:-4px; width:22px; height:22px; border-radius:4px; object-fit:cover; border:2px solid #1a1a1a; box-shadow:0 1px 4px rgba(0,0,0,0.5);">
            </div>` : `<img src="${imgUrl}" style="width:50px; height:50px; border-radius:8px; object-fit:cover">`;
        
        h += `<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:#111; padding:10px; border-radius:15px; border:1px solid #222">
            ${patternSwatchHtml}
            <div style="flex:1"><div style="font-size:13px; font-weight:600">${it.name}</div><div style="font-size:11px; color:var(--gold)">${infoLine}</div></div>
            <div class="qty-ctrl">
                <span class="qty-btn" onclick="changeQty(${idx},-1)">-</span>
                <span style="font-size:14px; width:20px; text-align:center">${it.qty}</span>
                <span class="qty-btn" onclick="changeQty(${idx},1)">+</span>
            </div>
        </div>`;
    });
    
    document.getElementById('cart-items').innerHTML = h || `<p style="text-align:center; color:#555">Bag is empty</p>`;
    
    // Calculate Totals
    let subtotal = cart.reduce((s,i) => s + (i.price * i.qty), 0);
    let discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    let total = subtotal - discount;
    
    document.getElementById('cart-subtotal').innerText = `₹${subtotal}`;
    document.getElementById('cart-discount').innerText = discount > 0 ? `-₹${discount}` : `₹0`;
    document.getElementById('cart-total').innerText = `₹${total}`;
    
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
}

async function placeOrder() {
    const n = document.getElementById('c-name').value.trim();
    const p = document.getElementById('c-phone').value.trim();
    const a = document.getElementById('c-addr').value.trim();
    const activeChip = document.querySelector('.payment-chip.active');
    if (!activeChip) return showToast("Select a payment method");
    const paymentMethod = activeChip.dataset.method;

    if (!n || p.length < 10 || a.length < 5) return showToast("Details incomplete");
    if (cart.length === 0) return showToast("Bag is empty");
    // Guest checkout allowed — no login required

    // ── COD Gate: show advance-payment confirmation modal ──────────────────────
    if (paymentMethod === 'cod') {
        try {
            const snap = await db.collection('settings').doc('cod').get();
            if (snap.exists && typeof snap.data().minPayment === 'number') {
                codMinPayment = snap.data().minPayment;
            }
        } catch(e) { /* use cached value */ }
        _pendingOrderArgs = { n, p, a, paymentMethod };
        _showCodConfirmModal(codMinPayment);
        return;
    }
    // ──────────────────────────────────────────────────────────────────────────

    await _executeOrder({ n, p, a, paymentMethod });
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

async function _executeOrder({ n, p, a, paymentMethod, codMinAmount, codAdvancePaid }) {
    const btn = document.getElementById('btn-checkout');
    if (btn) { btn.disabled = true; btn.innerText = 'Placing...'; }

    let subtotal = cart.reduce((s,i) => s + (i.price * i.qty), 0);
    let discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    let total = subtotal - discount;
    const orderId = Math.random().toString(36).toUpperCase().substring(2, 10);

    const promoLine = activePromo ? `<br><strong>Promo Code:</strong> ${activePromo.code} (${Math.round(activePromo.discount * 100)}% OFF)` : '';
    const discountLine = discount > 0 ? `<tr><td colspan="3" style="padding:8px 5px; text-align:right; color:#888;">Discount (${activePromo ? activePromo.code : ''})</td><td style="padding:8px 5px; text-align:right; color:#e74c3c;">-₹${discount}</td></tr><tr><td colspan="3" style="padding:4px 5px; text-align:right; color:#888; font-size:12px;">Subtotal</td><td style="padding:4px 5px; text-align:right; color:#888; font-size:12px;">₹${subtotal}</td></tr>` : '';
    const codNote = (paymentMethod === 'cod' && codMinAmount) ? `<br><span style="color:#e67e22;"><strong>COD Advance:</strong> &#8377;${codMinAmount} to be paid via UPI before delivery</span>` : '';
    
    let msg = `*NEW ORDER (${orderId})*\n\n`;
    cart.forEach(it => {
        const specs = [];
        if (it.variantSize && it.variantSize !== 'Standard') specs.push(it.variantSize);
        if (it.variantColor) specs.push(formatColorName(it.variantColor));
        if (it.variantPattern && !it.variantPattern.startsWith('Design-')) specs.push(it.variantPattern);
        const specStr = specs.length > 0 ? ` [${specs.join(', ')}]` : '';
        msg += `- ${it.qty}x ${it.name}${specStr} (₹${it.price * it.qty})\n`;
    });

    // Guest support: generate a stable guest identifier tied to this order
    const effectiveUid = currentUser ? currentUser.uid : ('guest_' + orderId);
    const isGuest = !currentUser;

    // ── Build premium order email ────────────────────────────────────────────
    const _pill = (label, val) => `<span style="display:inline-block;background:#f0f0f0;color:#333;font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.5px;margin:1px 2px 1px 0;text-transform:uppercase;">${label}: ${val}</span>`;

    const _itemRows = cart.map(it => {
        const colorLabel = it.variantColorName || (it.variantColor ? formatColorName(it.variantColor) : '');
        const imgUrl = it.image || it.variantImage || (it.images && it.images[0]) || 'https://placehold.co/400x400/222/FFF?text=No+Image';
        const hasSwatch = !!it.variantPatternImage;
        const showPatternText = it.variantPattern && !it.variantPattern.startsWith('Design-') && !hasSwatch;

        const variantPills = [
            (it.variantSize && it.variantSize !== 'Standard') ? _pill('Size', it.variantSize) : '',
            colorLabel ? _pill('Color', colorLabel) : '',
            showPatternText ? _pill('Pattern', it.variantPattern) : ''
        ].join('');

        const swatchCell = hasSwatch
            ? `<tr><td style="padding:4px 0 0;text-align:center;">
                <img src="${it.variantPatternImage}" width="32" height="32"
                     style="border-radius:6px;object-fit:cover;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.18);display:block;margin:0 auto;"
                     alt="pattern" title="${it.variantPattern || 'Pattern'}">
               </td></tr>`
            : '';

        return `
        <tr>
          <td style="padding:14px 0;border-bottom:1px solid #f3f3f3;vertical-align:top;width:76px;">
            <table style="border-collapse:collapse;margin:0;">
              <tr><td style="padding:0;">
                <img src="${imgUrl}" width="60" height="60"
                     style="border-radius:10px;object-fit:cover;display:block;border:1px solid #eee;" alt="product">
              </td></tr>
              ${swatchCell}
            </table>
          </td>
          <td style="padding:14px 12px;border-bottom:1px solid #f3f3f3;vertical-align:top;">
            <div style="font-size:14px;font-weight:700;color:#111;margin-bottom:7px;line-height:1.35;">${it.name}</div>
            <div>${variantPills}</div>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #f3f3f3;vertical-align:top;text-align:right;white-space:nowrap;">
            <div style="font-size:11px;color:#aaa;margin-bottom:3px;">Qty: ${it.qty}</div>
            <div style="font-size:16px;font-weight:800;color:#111;">&#8377;${it.price * it.qty}</div>
            ${it.qty > 1 ? `<div style="font-size:10px;color:#ccc;margin-top:2px;">&#8377;${it.price} each</div>` : ''}
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
        items: cart,
        subtotal,
        discount,
        total,
        paymentMethod,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (paymentMethod === 'cod') {
        orderDoc.codMinAmount = codMinAmount || codMinPayment;
        orderDoc.codAdvancePaid = codAdvancePaid || false;
    }

    try {
        await db.collection('orders').add(orderDoc);
        
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
        // -----------------------------
        
        await emailjs.send('service_pdnmeeb', 'template_pugghm5', { customer_name: n, order_summary: orderTable, order_id: orderId, total_amount: total }, 'k3l2JkCbjMs8WOAXg');
        showToast('Success! Order Placed.');
        cart = [];
        activePromo = null;
        updateCartUI();
        // Clear checkout form fields for next order
        const nameField = document.getElementById('c-name');
        const phoneField = document.getElementById('c-phone');
        const addrField = document.getElementById('c-addr');
        if (nameField) nameField.value = '';
        if (phoneField) phoneField.value = '';
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
        const errMsg = e && e.text ? `Failed: ${e.text}` : 'Failed to place order';
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
                ${isAdmin ? `<div style="color:var(--gold); font-size:11px; margin-bottom:8px; padding-bottom:5px; border-bottom:1px solid #333;"><b>Customer:</b> ${o.recipient || 'N/A'} | <b>Phone:</b> ${o.phone || 'N/A'}<br><b>Address:</b> ${o.address || 'N/A'}</div>` : ''}
                <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">Payment: <b>${o.paymentMethod ? o.paymentMethod.toUpperCase() : 'N/A'}</b>${o.paymentMethod === 'cod' && o.codMinAmount ? ` <span style="color:#e67e22; font-size:10px;">(Advance: ₹${o.codMinAmount})</span>` : ''}</div>
                ${(o.items || []).map(i => {
                    const specs = [];
                    if (i.variantSize && i.variantSize !== 'Standard' && i.variantSize !== 'N/A') {
                        specs.push(i.variantSize);
                    }
                    if (i.variantColor) {
                        specs.push(formatColorName(i.variantColor));
                    }
                    const variantDesc = specs.length > 0 ? specs.join(' • ') : '';
                    const descSuffix = variantDesc ? ` <span style="color:#666">(${variantDesc})</span>` : '';
                    const imgUrl = (i.images && i.images.length) ? i.images[0] : '';
                    const patternOverlayHtml = i.variantPatternImage ? `
                        <div style="position:relative; width:40px; height:40px; flex-shrink:0;">
                            <img src="${imgUrl}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;">
                            <img src="${i.variantPatternImage}" title="Pattern: ${i.variantPattern || ''}" style="position:absolute; bottom:-2px; right:-2px; width:16px; height:16px; border-radius:3px; object-fit:cover; border:1px solid #1a1a1a; box-shadow:0 1px 3px rgba(0,0,0,0.5);">
                        </div>` : `<img src="${imgUrl}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" onerror="this.style.display='none'">`;
                    return `<div style="display:flex; align-items:center; gap:10px; margin-bottom:5px">${patternOverlayHtml}<span style="font-size:12px">${i.name}${descSuffix} ×${i.qty||1}</span><span style="margin-left:auto; font-size:12px; color:var(--gold)">₹${i.price * (i.qty||1)}</span></div>`;
                }).join('')}
                ${promoInfo}
                <div style="margin-top:10px; font-weight:bold; color:var(--gold); text-align:right; font-size:16px;">Total: ₹${o.total || 0}</div>
            </div>`; 
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
