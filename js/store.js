// ==========================================
// SWAG STREE | STORE & PRODUCT RENDERING
// ==========================================

// 1. DATA LOADING
function loadData() { 
    db.collection("products").onSnapshot(snap => { 
        products = snap.docs.map(doc => ({...doc.data(), id:doc.id})); 
        renderStore(); 
        if(isAdmin && typeof renderAdmin === "function") renderAdmin(); 
    }); 
}

function renderStore() { 
    renderProducts(products, 'product-grid'); 
    renderProducts(products.filter(p => wishlist.includes(p.id)), 'wish-grid'); 
}

// 2. RENDERING LOGIC
function renderProducts(items, targetId) { 
    const container = document.getElementById(targetId); 
    if(!container) return;
    
    if(items.length === 0) {
        container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#555;">No products found.</p>`;
        return;
    }
    
    container.innerHTML = items.map(p => { 
        const isFav = wishlist.includes(p.id); 
        return `
        <div class="card"> 
            <div class="wish-btn ${isFav?'active':''}" onclick="event.stopPropagation(); toggleWish('${p.id}')">
                <i class="fa${isFav?'s':'r'} fa-heart"></i>
            </div> 
            <div class="share-btn" onclick="event.stopPropagation(); shareProduct('${p.id}')">
                <i class="fa fa-share-alt"></i>
            </div> 
            <div class="quick-add" onclick="event.stopPropagation(); addToBag('${p.id}')">
                <i class="fa fa-plus"></i>
            </div> 
            <div class="carousel-box" onclick="showDetail('${p.id}')"> 
                <div class="carousel" onscroll="updateDots(this)">
                    ${p.images ? p.images.map(img => `<img src="${img}" loading="lazy">`).join('') : ''}
                </div> 
                <div class="indicators">
                    ${p.images ? p.images.map((_, i) => `<div class="dot ${i===0?'active':''}"></div>`).join('') : ''}
                </div> 
            </div> 
            <div style="padding:12px" onclick="showDetail('${p.id}')"> 
                <div style="font-size:12px; font-weight:600; color:#ccc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${p.name}</div> 
                <div style="color:var(--gold); font-weight:800; margin-top:4px">₹${p.price}</div> 
            </div> 
        </div>`; 
    }).join(''); 
}

// 3. PRODUCT DETAILS
function showDetail(id) { 
    const p = products.find(x => x.id === id); 
    if(!p) return;
    
    document.getElementById('det-name').innerText = p.name; 
    document.getElementById('det-price').innerText = `₹${p.price}`; 
    document.getElementById('det-desc').innerText = p.description || "Premium Quality."; 
    
    document.getElementById('det-gallery').innerHTML = p.images ? p.images.map(img => `<img src="${img}">`).join('') : ''; 
    document.getElementById('det-indicators').innerHTML = p.images ? p.images.map((_, i) => `<div class="dot ${i===0?'active':''}"></div>`).join('') : ''; 
    
    document.getElementById('det-btn').onclick = () => { addToBag(id); closeDetail(); }; 
    document.getElementById('detail-view').style.display = 'block'; 
}

function closeDetail() { 
    document.getElementById('detail-view').style.display = 'none'; 
}

// 4. INTERACTIVITY
function toggleWish(id) { 
    if(!currentUser) return showToast("Login first"); 
    let newWish = wishlist.includes(id) ? wishlist.filter(x => x !== id) : [...wishlist, id]; 
    db.collection("users").doc(currentUser.uid).set({ wishlist: newWish }, { merge: true }); 
}

async function shareProduct(id) { 
    const p = products.find(x => x.id === id); 
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${id}`; 
    if (navigator.share) { 
        try { 
            await navigator.share({ title: 'Swag Stree', text: p ? `Check out ${p.name}` : 'Look!', url: shareUrl }); 
        } catch (err) {} 
    } else { 
        copyToClipboard(shareUrl); 
    } 
}

function searchHandler() { 
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

function setFilterSize(el) {
    document.querySelectorAll('#filter-sizes .chip').forEach(c => c.classList.remove('active'));
    if(filterActiveSize === el.innerText) filterActiveSize = null;
    else { filterActiveSize = el.innerText; el.classList.add('active'); }
    applySortAndFilter();
}

function applySortAndFilter() {
    const sort = document.getElementById('sort-logic').value;
    let filtered = [...products];
    
    if(filterActiveSize) {
        // In a real app with inventory, you'd filter by available size. Here we mock it.
        // For now we just pretend all sizes exist or skip real filtering if data lacks it.
    }
    
    if(sort === 'low') filtered.sort((a,b) => a.price - b.price);
    if(sort === 'high') filtered.sort((a,b) => b.price - a.price);
    renderProducts(filtered, 'product-grid');
}
