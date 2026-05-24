// ==========================================
// SWAG STREE | STORE & PRODUCT RENDERING
// ==========================================

// Global variables fallback definition to prevent browser cache mismatch crashes
if (typeof filterActiveColor === 'undefined') window.filterActiveColor = null;
if (typeof filterActiveSize === 'undefined') window.filterActiveSize = null;
if (typeof selectedColor === 'undefined') window.selectedColor = '';
if (typeof activeProductId === 'undefined') window.activeProductId = null;
if (typeof isAdmin === 'undefined') window.isAdmin = false;
if (typeof products === 'undefined') window.products = [];

// 1. DATA LOADING
function loadData() { 
    db.collection("products").onSnapshot(snap => { 
        products = snap.docs.map(doc => ({...doc.data(), id:doc.id})); 
        renderStore(); 
        renderFilters();
        if(isAdmin && typeof renderAdmin === "function") renderAdmin(); 
    }, error => {
        console.error("Firestore products onSnapshot error:", error);
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
    
    activeProductId = id; // Track active product ID
    
    document.getElementById('det-name').innerText = p.name; 
    document.getElementById('det-price').innerText = `₹${p.price}`; 
    document.getElementById('det-desc').innerText = p.description || "Premium Quality."; 
    
    document.getElementById('det-gallery').innerHTML = p.images ? p.images.map(img => `<img src="${img}">`).join('') : ''; 
    document.getElementById('det-indicators').innerHTML = p.images ? p.images.map((_, i) => `<div class="dot ${i===0?'active':''}"></div>`).join('') : ''; 
    
    // Set up available sizes
    const sizes = (p.sizes && Array.isArray(p.sizes)) ? p.sizes : [];
    const sizeSelector = document.getElementById('detail-size-selector');
    const sizesContainer = document.getElementById('det-sizes-container');
    
    if (sizes.length === 0) {
        sizesContainer.style.display = 'none';
        selectedSize = 'Standard';
    } else {
        sizesContainer.style.display = 'block';
        selectedSize = sizes[0]; // Default to first available size
        
        sizeSelector.innerHTML = sizes.map(sz => `
            <div class="chip ${sz === selectedSize ? 'active' : ''}" onclick="selectDetailSize('${sz}', this)">${sz}</div>
        `).join('');
    }

    // Render colors for default selected size
    renderDetailColors(p);

    document.getElementById('det-btn').onclick = () => { 
        if (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0 && !selectedSize) {
            return showToast("Please select a size");
        }
        const colors = (p.sizeColorMap && Array.isArray(p.sizeColorMap[selectedSize])) ? p.sizeColorMap[selectedSize] : [];
        if (colors.length > 0 && !selectedColor) {
            return showToast("Please select a color");
        }
        addToBagWithSelection(id, selectedSize, selectedColor); 
        closeDetail(); 
    }; 
    
    document.getElementById('detail-view').style.display = 'block'; 
}

function selectDetailSize(sz, el) {
    selectedSize = sz;
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const p = products.find(x => x.id === activeProductId);
    if (p) {
        renderDetailColors(p);
    }
}

function selectDetailColor(col, el) {
    selectedColor = col;
    el.parentElement.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const p = products.find(x => x.id === activeProductId);
    if (p) {
        updateAddToCartButtonText(p);
    }
}

function renderDetailColors(p) {
    const colorsContainer = document.getElementById('det-colors-container');
    const colorSelector = document.getElementById('detail-color-selector');
    
    if (!colorsContainer || !colorSelector) return;
    
    const colors = (p.sizeColorMap && Array.isArray(p.sizeColorMap[selectedSize])) ? p.sizeColorMap[selectedSize] : [];
    
    if (colors.length === 0) {
        colorsContainer.style.display = 'none';
        selectedColor = '';
    } else {
        colorsContainer.style.display = 'block';
        selectedColor = colors[0]; // Default to first available color
        
        colorSelector.innerHTML = colors.map(col => `
            <div class="chip ${col === selectedColor ? 'active' : ''}" onclick="selectDetailColor('${col}', this)">${col}</div>
        `).join('');
    }
    
    updateAddToCartButtonText(p);
}

function updateAddToCartButtonText(p) {
    const btn = document.getElementById('det-btn');
    if (!btn) return;
    
    let label = "ADD TO BAG";
    const specs = [];
    if (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0 && selectedSize) {
        specs.push(`Size: ${selectedSize}`);
    }
    if (selectedColor) {
        specs.push(`Color: ${selectedColor}`);
    }
    
    if (specs.length > 0) {
        label += ` (${specs.join(', ')})`;
    }
    
    btn.innerText = label;
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

function setFilterColor(el) {
    document.querySelectorAll('#filter-colors .chip').forEach(c => c.classList.remove('active'));
    if(filterActiveColor === el.innerText) filterActiveColor = null;
    else { filterActiveColor = el.innerText; el.classList.add('active'); }
    applySortAndFilter();
}

function renderFilters() {
    const allSizes = new Set(['S', 'M', 'L', 'XL', 'XXL']);
    const allColors = new Set();
    
    products.forEach(p => {
        if (p.sizes && Array.isArray(p.sizes)) p.sizes.forEach(s => allSizes.add(s));
        if (p.colors && Array.isArray(p.colors)) p.colors.forEach(c => allColors.add(c));
    });
    
    const sizesContainer = document.getElementById('filter-sizes');
    if (sizesContainer) {
        sizesContainer.innerHTML = Array.from(allSizes).map(sz => `
            <div class="chip ${filterActiveSize === sz ? 'active' : ''}" onclick="setFilterSize(this)">${sz}</div>
        `).join('');
    }
    
    const colorsContainer = document.getElementById('filter-colors');
    if (colorsContainer) {
        colorsContainer.innerHTML = Array.from(allColors).map(col => `
            <div class="chip ${filterActiveColor === col ? 'active' : ''}" onclick="setFilterColor(this)">${col}</div>
        `).join('');
    }
}

function applySortAndFilter() {
    const sort = document.getElementById('sort-logic').value;
    let filtered = [...products];
    
    if(filterActiveSize) {
        filtered = filtered.filter(p => p.sizes && Array.isArray(p.sizes) && p.sizes.includes(filterActiveSize));
    }
    
    if(filterActiveColor) {
        filtered = filtered.filter(p => p.colors && Array.isArray(p.colors) && p.colors.includes(filterActiveColor));
    }
    
    if(sort === 'low') filtered.sort((a,b) => a.price - b.price);
    if(sort === 'high') filtered.sort((a,b) => b.price - a.price);
    renderProducts(filtered, 'product-grid');
}
