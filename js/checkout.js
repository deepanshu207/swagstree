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

// ── UPI Configuration ──────────────────────────────────────────────────────
const UPI_ID   = '7683020636@pthdfc';
const UPI_NAME = 'Swag+Stree'; // merchant name (URL-encoded spaces)
// ───────────────────────────────────────────────────────────────────────────

(function loadCodMinPayment() {
    if (typeof db === 'undefined') return;
    db.collection('settings').doc('cod').get().then(doc => {
        if (doc.exists && typeof doc.data().minPayment === 'number') {
            codMinPayment = doc.data().minPayment;
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
    
    addToBagWithSelection(id, size, color);
}

function addToBagWithSelection(id, size, color) {
    const p = products.find(x => x.id === id);
    if(!p) return;
    
    const existing = cart.find(item => item.id === id && item.variantSize === size && item.variantColor === color);
    if(existing) {
        existing.qty++;
    } else {
        cart.push({...p, variantSize: size, variantColor: color, qty: 1});
    }
    updateCartUI();
    
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

function changeQty(idx, delta) {
    cart[idx].qty += delta;
    if(cart[idx].qty <= 0) cart.splice(idx, 1);
    openCart();
    updateCartUI();
}

// Array to hold active promos loaded from Firestore
let activePromosList = [];

async function loadPromos() {
    try {
        const snap = await db.collection('settings').doc('promos').get();
        if (snap.exists) {
            activePromosList = snap.data().list || [];
        }
    } catch(e) {
        console.error("Failed to load promos", e);
    }
}

// Ensure promos are loaded early
loadPromos();

function applyPromo() {
    const code = document.getElementById('promo-code').value.trim().toUpperCase();
    if (!code) return;
    
    const promo = activePromosList.find(p => p.code === code);
    
    if (promo) {
        activePromo = { code: promo.code, discount: promo.discount / 100 }; // Convert % to decimal
        showToast("Promo Applied: " + promo.discount + "% OFF");
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

    if (method === 'cod') {
        upiBox.style.display = 'none';
        return;
    }

    upiBox.style.display = 'block';

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

    let upiContent = document.getElementById('upi-brand-header');
    if (!upiContent) return; // If upi-brand-header was cleared out or changed, we'll replace the inner HTML of the upiBox
    
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
            <div style="background:#fff; border-radius:10px; padding:6px; display:inline-block; margin-bottom:12px;">
                <img src="assets/qr.png" alt="UPI QR Code" style="width:160px; height:160px; border-radius:6px; display:block;">
            </div>
            <p style="font-size:11px; color:#666; margin:0 0 12px; text-align:center;">
                ${cfg.hint}. After paying,<br>place the order and upload screenshot on WhatsApp.
            </p>
        `;
    } else {
        html += `
            <button onclick="openUpiApp('${cfg.appKey}')"
                style="width:100%; padding:15px; border:none; border-radius:12px; background:${cfg.btnBg}; color:#fff; font-weight:800; font-size:14px; cursor:pointer; letter-spacing:0.5px; margin-bottom:12px; box-shadow:0 4px 15px rgba(0,0,0,0.4);">
                &#x26A1; Open ${cfg.label} &amp; Pay ${amtLabel}
            </button>
            <p style="font-size:11px; color:#666; margin:0 0 12px; text-align:center;">
                ${cfg.hint}. After paying,<br>place the order and upload screenshot on WhatsApp.
            </p>
            <div id="upi-qr-fallback" style="display:none; border-top:1px solid #222; padding-top:12px; text-align:center;">
                <p style="font-size:11px; color:#777; margin:0 0 8px;">App not installed? Scan QR instead:</p>
                <div style="background:#fff; border-radius:10px; padding:6px; display:inline-block;">
                    <img src="assets/qr.png" alt="UPI QR Code" style="width:140px; height:140px; border-radius:6px; display:block;">
                </div>
                <p style="font-size:10px; color:#555; margin:6px 0 0;">UPI ID: <b style="color:#fff;">${UPI_ID}</b></p>
            </div>
        `;
    }
    
    upiBox.innerHTML = html;
}

function payCodAdvance(method) {
    if (method === 'upi') {
        const box = document.getElementById('cod-qr-box');
        if(box) box.style.display = 'block';
        const confirmBtn = document.getElementById('btn-confirm-cod');
        if (confirmBtn) confirmBtn.style.display = 'block';
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
        const container = document.getElementById('cod-advance-payment-options');
        
        if (cfg && container) {
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
                <button onclick="closeCodConfirmModal()" style="width:100%; padding:10px; background:none; color:#555; border:none; cursor:pointer; font-size:13px;">Cancel</button>
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
        const variantText = specs.length > 0 ? specs.join(' • ') : '';
        const priceText = `₹${it.price}`;
        const infoLine = variantText ? `${variantText} • ${priceText}` : priceText;
        
        h += `<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:#111; padding:10px; border-radius:15px; border:1px solid #222">
            <img src="${it.images && it.images.length ? it.images[0] : 'https://placehold.co/400x400/222/FFF?text=No+Image'}" style="width:50px; height:50px; border-radius:8px; object-fit:cover">
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

    // Render available promos
    const promosContainer = document.getElementById('active-promos-display');
    if (promosContainer) {
        if (activePromosList && activePromosList.length > 0) {
            promosContainer.innerHTML = activePromosList.map(p => `
                <div onclick="document.getElementById('promo-code').value='${p.code}'; applyPromo();" 
                     style="background:rgba(255,215,0,0.1); border:1px dashed var(--gold); padding:6px 12px; border-radius:20px; font-size:11px; color:var(--gold); cursor:pointer; font-weight:bold; transition:0.2s;"
                     onmouseover="this.style.background='rgba(255,215,0,0.2)'"
                     onmouseout="this.style.background='rgba(255,215,0,0.1)'">
                    ${p.code} <span style="color:#aaa; font-weight:normal; margin-left:4px;">(-${p.discount}%)</span>
                </div>
            `).join('');
        } else {
            promosContainer.innerHTML = '';
        }
    }

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
    if (!currentUser) return showToast("Please login to order");

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
    let orderTable = `<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;"><div style="background: #000; color: #FFD700; padding: 20px; text-align: center;"><h1 style="margin: 0; font-size: 24px;">SWAG STREE</h1><p style="margin: 5px 0 0; color: #fff; font-size: 12px; letter-spacing: 2px;">OFFICIAL INVOICE #${orderId}</p></div><div style="padding: 20px;"><p><strong>Customer:</strong> ${n}<br><strong>Phone:</strong> ${p}<br><strong>Address:</strong> ${a}<br><strong>Payment:</strong> ${paymentMethod.toUpperCase()}${promoLine}${codNote}</p><table style="width: 100%; border-collapse: collapse; margin-top: 20px;"><thead><tr style="border-bottom: 2px solid #FFD700;"><th style="text-align: left; padding: 10px 5px;">Product</th><th style="text-align: center; padding: 10px 5px;">Variant</th><th style="text-align: center; padding: 10px 5px;">Qty</th><th style="text-align: right; padding: 10px 5px;">Price</th></tr></thead><tbody>${cart.map(it => {
        const specs = [];
        if (it.variantSize && it.variantSize !== 'Standard') specs.push(it.variantSize);
        if (it.variantColor) specs.push(formatColorName(it.variantColor));
        const variantDesc = specs.length > 0 ? specs.join(' / ') : '-';
        return `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 5px;"><img src="${it.images && it.images.length ? it.images[0] : ''}" width="50" height="50" style="border-radius: 4px; object-fit: cover; margin-right: 10px; vertical-align:middle;" alt="product"><span style="font-size: 14px; vertical-align:middle;">${it.name}</span></td><td style="padding: 10px 5px; text-align: center;">${variantDesc}</td><td style="padding: 10px 5px; text-align: center;">${it.qty}</td><td style="padding: 10px 5px; text-align: right;">&#8377;${it.price * it.qty}</td></tr>`;
    }).join('')}${discountLine}</tbody></table><div style="margin-top: 20px; text-align: right; border-top: 2px solid #FFD700; padding-top: 10px;"><span style="font-size: 20px; font-weight: bold; color: #FFD700;">Grand Total: &#8377;${total}</span></div></div><div style="background:#f9f9f9; padding:15px; text-align:center; font-size:11px; color:#999;">Thank you for shopping with Swag Stree! 🛍️<br>For queries, contact us on <a href="https://chat.whatsapp.com/GO2JIzNSswT6KlpJH45hHS" style="color:#25D366">WhatsApp</a></div></div>`;

    const orderDoc = {
        orderId,
        uid: currentUser.uid,
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
        await emailjs.send('service_kur7gle', 'template_3g1oy0z', { customer_name: n, order_summary: orderTable, order_id: orderId, total_amount: total });
        showToast('Success! Order Placed.');
        cart = [];
        activePromo = null;
        updateCartUI();
        closeModal('cart-modal');
        loadOrders();
    } catch(e) {
        console.error('Order Error:', e);
        showToast('Failed to place order');
    }

    if (btn) { btn.disabled = false; btn.innerText = 'Place Order'; }
}

function loadOrders() { 
    const container = document.getElementById('order-history'); 
    if (!currentUser) return; 
    
    container.innerHTML = `<p style="text-align:center; color:#666; font-size:12px;">Syncing orders...</p>`; 
    
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
            if (countContainer) countContainer.innerHTML = '0 Orders';
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
                    return `<div style="display:flex; align-items:center; gap:10px; margin-bottom:5px"><img src="${i.images && i.images.length ? i.images[0] : ''}" style="width:40px;height:40px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'"><span style="font-size:12px">${i.name}${descSuffix} ×${i.qty||1}</span><span style="margin-left:auto; font-size:12px; color:var(--gold)">₹${i.price * (i.qty||1)}</span></div>`;
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
