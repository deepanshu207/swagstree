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
    showToast(`Added to Bag: ${p.name} (${size}${color ? ` - ${color}` : ''})`); 
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

function applyPromo() {
    const code = document.getElementById('promo-code').value.toUpperCase().trim();
    if(code === "SWAG10") {
        activePromo = { code: "SWAG10", discount: 0.10 }; // 10% off
        showToast("Promo Code Applied: 10% OFF!");
    } else {
        activePromo = null;
        showToast("Invalid Promo Code");
    }
    openCart(); // refresh totals
}

function selectPayment(method) {
    document.querySelectorAll('.payment-chip').forEach(c => c.classList.remove('active'));
    document.getElementById(`pay-${method}`).classList.add('active');
    
    const upiBox = document.getElementById('upi-payment-box');
    if (method === 'upi') {
        upiBox.style.display = 'block';
    } else {
        upiBox.style.display = 'none';
    }
}

function openCart() {
    let h = ""; 
    cart.forEach((it, idx) => {
        const variantText = it.variantSize + (it.variantColor ? ` • ${it.variantColor}` : '');
        h += `<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:#111; padding:10px; border-radius:15px; border:1px solid #222">
            <img src="${it.images && it.images.length ? it.images[0] : ''}" style="width:50px; height:50px; border-radius:8px; object-fit:cover">
            <div style="flex:1"><div style="font-size:13px; font-weight:600">${it.name}</div><div style="font-size:11px; color:var(--gold)">${variantText} • ₹${it.price}</div></div>
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
    document.getElementById('cart-modal').style.display = 'flex';
}

async function placeOrder() {
    const n = document.getElementById('c-name').value;
    const p = document.getElementById('c-phone').value;
    const a = document.getElementById('c-addr').value;
    const paymentMethod = document.querySelector('.payment-chip.active').dataset.method;
    
    if(!n || p.length < 10 || a.length < 5) return showToast("Details incomplete");
    if(cart.length === 0) return showToast("Bag is empty");
    if(!currentUser) return showToast("Please login to order");
    
    const btn = document.getElementById('btn-checkout'); 
    btn.disabled = true; 
    btn.innerText = "Placing...";
    
    let subtotal = cart.reduce((s,i) => s + (i.price * i.qty), 0);
    let discount = activePromo ? Math.floor(subtotal * activePromo.discount) : 0;
    let total = subtotal - discount;
    const orderId = Math.random().toString(36).toUpperCase().substring(2, 10);

    const promoLine = activePromo ? `<br><strong>Promo Code:</strong> ${activePromo.code} (${Math.round(activePromo.discount * 100)}% OFF)` : '';
    const discountLine = discount > 0 ? `<tr><td colspan="3" style="padding:8px 5px; text-align:right; color:#888;">Discount (${activePromo ? activePromo.code : ''})</td><td style="padding:8px 5px; text-align:right; color:#e74c3c;">-₹${discount}</td></tr><tr><td colspan="3" style="padding:4px 5px; text-align:right; color:#888; font-size:12px;">Subtotal</td><td style="padding:4px 5px; text-align:right; color:#888; font-size:12px;">₹${subtotal}</td></tr>` : '';
    let orderTable = `<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;"><div style="background: #000; color: #FFD700; padding: 20px; text-align: center;"><h1 style="margin: 0; font-size: 24px;">SWAG STREE</h1><p style="margin: 5px 0 0; color: #fff; font-size: 12px; letter-spacing: 2px;">OFFICIAL INVOICE #${orderId}</p></div><div style="padding: 20px;"><p><strong>Customer:</strong> ${n}<br><strong>Phone:</strong> ${p}<br><strong>Address:</strong> ${a}<br><strong>Payment:</strong> ${paymentMethod.toUpperCase()}${promoLine}</p><table style="width: 100%; border-collapse: collapse; margin-top: 20px;"><thead><tr style="border-bottom: 2px solid #FFD700;"><th style="text-align: left; padding: 10px 5px;">Product</th><th style="text-align: center; padding: 10px 5px;">Variant</th><th style="text-align: center; padding: 10px 5px;">Qty</th><th style="text-align: right; padding: 10px 5px;">Price</th></tr></thead><tbody>${cart.map(it => {
        const variantDesc = it.variantSize + (it.variantColor ? ` / ${it.variantColor}` : '');
        return `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 5px;"><img src="${it.images && it.images.length ? it.images[0] : ''}" width="50" height="50" style="border-radius: 4px; object-fit: cover; margin-right: 10px; vertical-align:middle;" alt="product"><span style="font-size: 14px; vertical-align:middle;">${it.name}</span></td><td style="padding: 10px 5px; text-align: center;">${variantDesc}</td><td style="padding: 10px 5px; text-align: center;">${it.qty}</td><td style="padding: 10px 5px; text-align: right;">₹${it.price * it.qty}</td></tr>`;
    }).join('')}${discountLine}</tbody></table><div style="margin-top: 20px; text-align: right; border-top: 2px solid #FFD700; padding-top: 10px;"><span style="font-size: 20px; font-weight: bold; color: #FFD700;">Grand Total: ₹${total}</span></div></div><div style="background:#f9f9f9; padding:15px; text-align:center; font-size:11px; color:#999;">Thank you for shopping with Swag Stree! 🛍️<br>For queries, contact us on <a href="https://chat.whatsapp.com/GO2JIzNSswT6KlpJH45hHS" style="color:#25D366">WhatsApp</a></div></div>`;

    try {
        await db.collection("orders").add({ 
            orderId: orderId, 
            uid: currentUser.uid, 
            recipient: n, 
            phone: p, 
            address: a, 
            items: cart, 
            subtotal: subtotal,
            discount: discount,
            total: total, 
            paymentMethod: paymentMethod,
            timestamp: firebase.firestore.FieldValue.serverTimestamp() 
        });
        
        await emailjs.send("service_kur7gle", "template_3g1oy0z", { customer_name: n, order_summary: orderTable, order_id: orderId, total_amount: total });
        
        showToast("Success! Order Placed."); 
        cart = []; 
        activePromo = null;
        updateCartUI(); 
        closeModal('cart-modal');
        loadOrders();
    } catch(e) { 
        console.error("Order Error:", e); 
        showToast("Failed to place order"); 
    }
    
    btn.disabled = false; 
    btn.innerText = "Place Order";
}

function loadOrders() { 
    const container = document.getElementById('order-history'); 
    if (!currentUser) return; 
    
    container.innerHTML = `<p style="text-align:center; color:#666; font-size:12px;">Syncing orders...</p>`; 
    let ordersRef = db.collection("orders"); 
    
    // NOTE: For user-specific queries, we avoid .orderBy() to prevent the need for a Firestore
    // composite index. We instead fetch all matching docs and sort client-side.
    let query = isAdmin 
        ? ordersRef.orderBy("timestamp", "desc") 
        : ordersRef.where("uid", "==", currentUser.uid); 
    
    query.onSnapshot(snap => { 
        if (snap.empty) { 
            container.innerHTML = `<p style="text-align:center;color:#444;font-size:12px">No orders yet.</p>`; 
            return; 
        } 
        
        // Sort client-side by timestamp for user queries
        let docs = snap.docs;
        if (!isAdmin) {
            docs = docs.sort((a, b) => {
                const tsA = a.data().timestamp ? a.data().timestamp.toMillis() : 0;
                const tsB = b.data().timestamp ? b.data().timestamp.toMillis() : 0;
                return tsB - tsA;
            });
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
                <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">Payment: <b>${o.paymentMethod ? o.paymentMethod.toUpperCase() : 'N/A'}</b></div>
                ${(o.items || []).map(i => {
                    const variantDesc = (i.variantSize || 'N/A') + (i.variantColor ? ` • ${i.variantColor}` : '');
                    return `<div style="display:flex; align-items:center; gap:10px; margin-bottom:5px"><img src="${i.images && i.images.length ? i.images[0] : ''}" style="width:40px;height:40px;object-fit:cover;border-radius:6px" onerror="this.style.display='none'"><span style="font-size:12px">${i.name} <span style="color:#666">(${variantDesc})</span> ×${i.qty||1}</span><span style="margin-left:auto; font-size:12px; color:var(--gold)">₹${i.price * (i.qty||1)}</span></div>`;
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
