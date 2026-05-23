// ==========================================
// SWAG STREE | CART, CHECKOUT & ORDERS
// ==========================================

let activePromo = null;

function addToBag(id) { 
    const p = products.find(x => x.id === id);
    if(!p) return;
    
    const existing = cart.find(item => item.id === id && item.variantSize === selectedSize);
    if(existing) {
        existing.qty++;
    } else {
        cart.push({...p, variantSize: selectedSize, qty: 1});
    }
    updateCartUI();
    showToast("Added to Bag"); 
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
        h += `<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; background:#111; padding:10px; border-radius:15px; border:1px solid #222">
            <img src="${it.images ? it.images[0] : ''}" style="width:50px; height:50px; border-radius:8px; object-fit:cover">
            <div style="flex:1"><div style="font-size:13px; font-weight:600">${it.name}</div><div style="font-size:11px; color:var(--gold)">${it.variantSize} • ₹${it.price}</div></div>
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

    let orderTable = `<div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden;"><div style="background: #000; color: #FFD700; padding: 20px; text-align: center;"><h1 style="margin: 0; font-size: 24px;">SWAG STREE</h1><p style="margin: 5px 0 0; color: #fff; font-size: 12px; letter-spacing: 2px;">OFFICIAL INVOICE #${orderId}</p></div><div style="padding: 20px;"><p><strong>Customer:</strong> ${n}<br><strong>Phone:</strong> ${p}<br><strong>Address:</strong> ${a}<br><strong>Payment:</strong> ${paymentMethod.toUpperCase()}</p><table style="width: 100%; border-collapse: collapse; margin-top: 20px;"><thead><tr style="border-bottom: 2px solid #FFD700;"><th style="text-align: left; padding: 10px 5px;">Product</th><th style="text-align: center; padding: 10px 5px;">Size</th><th style="text-align: center; padding: 10px 5px;">Qty</th><th style="text-align: right; padding: 10px 5px;">Price</th></tr></thead><tbody>${cart.map(it => `<tr style="border-bottom: 1px solid #eee;"><td style="padding: 10px 5px; display: flex; align-items: center;"><img src="${it.images[0]}" width="50" height="50" style="border-radius: 4px; object-fit: cover; margin-right: 10px;" alt="product"><span style="font-size: 14px;">${it.name}</span></td><td style="padding: 10px 5px; text-align: center;">${it.variantSize}</td><td style="padding: 10px 5px; text-align: center;">${it.qty}</td><td style="padding: 10px 5px; text-align: right;">₹${it.price * it.qty}</td></tr>`).join('')}</tbody></table><div style="margin-top: 20px; text-align: right; border-top: 2px solid #000; padding-top: 10px;"><span style="font-size: 18px; font-weight: bold;">Grand Total: ₹${total}</span></div></div></div>`;

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
    let query = isAdmin ? ordersRef.orderBy("timestamp", "desc") : ordersRef.where("uid", "==", currentUser.uid).orderBy("timestamp", "desc"); 
    
    query.onSnapshot(snap => { 
        if (snap.empty) { 
            container.innerHTML = `<p style="text-align:center;color:#444;font-size:12px">No orders found.</p>`; 
            return; 
        } 
        container.innerHTML = snap.docs.map(doc => { 
            const o = doc.data(); 
            return `
            <div class="order-card">
                <div style="display:flex; justify-content:space-between; font-size:10px; color:#666; margin-bottom:8px">
                    <span>#${doc.id.slice(-6).toUpperCase()}</span>
                    <span>${o.timestamp ? o.timestamp.toDate().toLocaleDateString() : 'New'}</span>
                </div>
                ${isAdmin ? `<div style="color:var(--gold); font-size:11px; margin-bottom:8px; padding-bottom:5px; border-bottom:1px solid #333;"><b>Customer:</b> ${o.recipient || 'N/A'} (${o.phone || 'N/A'})</div>` : ''}
                <div style="font-size: 11px; color: #aaa; margin-bottom: 8px;">Method: ${o.paymentMethod ? o.paymentMethod.toUpperCase() : 'N/A'}</div>
                ${o.items.map(i => `<div style="display:flex; align-items:center; gap:10px; margin-bottom:5px"><img src="${i.images ? i.images[0] : ''}" style="width:35px;height:35px;object-fit:cover;border-radius:4px"><span style="font-size:12px">${i.name} (${i.variantSize || 'N/A'}) x${i.qty||1}</span></div>`).join('')}
                <div style="margin-top:10px; font-weight:bold; color:var(--gold); text-align:right">₹${o.total}</div>
            </div>`; 
        }).join(''); 
    }); 
}
