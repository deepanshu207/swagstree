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

if (typeof displayedProductsLimit === 'undefined') window.displayedProductsLimit = 20;
if (typeof displayedWishlistLimit === 'undefined') window.displayedWishlistLimit = 20;
if (typeof displayedOrdersLimit === 'undefined') window.displayedOrdersLimit = 20;
if (typeof ordersUnsubscribe === 'undefined') window.ordersUnsubscribe = null;
if (typeof deepLinkHandled === 'undefined') window.deepLinkHandled = false;

if (typeof formatColorName === 'undefined') {
    window.formatColorName = function(col) {
        if (!col) return '';
        const clean = col.trim().toLowerCase();
        const map = {
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
    };
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
        products = snap.docs.map(doc => ({...doc.data(), id:doc.id})); 
        renderStore(); 
        renderFilters();
        if(isAdmin && typeof renderAdmin === "function") renderAdmin();
        checkDeepLink(); // open shared product link if present
    }, error => {
        console.error("Firestore products onSnapshot error:", error);
    }); 
}

function renderStore() { 
    renderProducts(products, 'product-grid'); 
    renderProducts(products.filter(p => wishlist.includes(p.id)), 'wish-grid'); 
}

// 2. RENDERING LOGIC
function productCardHtml(p) {
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
                ${p.images && p.images.length ? p.images.map(img => `<img src="${img}" loading="lazy">`).join('') : '<img src="https://placehold.co/400x400/222/FFF?text=No+Image" loading="lazy">'}
            </div> 
            <div class="indicators">
                ${p.images && p.images.length > 1 ? p.images.map((_, i) => `<div class="dot ${i===0?'active':''}"></div>`).join('') : ''}
            </div> 
        </div> 
        <div style="padding:12px" onclick="showDetail('${p.id}')"> 
            <div style="font-size:12px; font-weight:600; color:#ccc; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${p.name}</div> 
            <div style="color:var(--gold); font-weight:800; margin-top:4px">₹${p.price}</div> 
        </div> 
    </div>`;
}

function renderProducts(items, targetId) { 
    const container = document.getElementById(targetId); 
    if(!container) return;
    
    if (targetId === 'product-grid') {
        const loadMoreBtnContainer = document.getElementById('load-more-container');
        const countContainer = document.getElementById('product-count');
        if (items.length === 0) {
            container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#555;">No products found.</p>`;
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            if (countContainer) countContainer.innerHTML = '0 Products';
            return;
        }
        
        let itemsToRender = items;
        if (items.length > displayedProductsLimit) {
            itemsToRender = items.slice(0, displayedProductsLimit);
            if (loadMoreBtnContainer) {
                loadMoreBtnContainer.innerHTML = `<button class="btn-gold" style="width:auto; min-width:180px; margin:auto;" onclick="loadMoreProducts()">Show More</button>`;
            }
        } else {
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
        }
        
        if (countContainer) {
            const visible = Math.min(items.length, displayedProductsLimit);
            countContainer.innerHTML = `Showing ${visible} of ${items.length} Products`;
        }
        
        container.innerHTML = itemsToRender.map(productCardHtml).join(''); 
    } else if (targetId === 'wish-grid') {
        const loadMoreBtnContainer = document.getElementById('wish-load-more-container');
        const countContainer = document.getElementById('wish-count');
        if (items.length === 0) {
            container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#555;">No products in wishlist yet.</p>`;
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
            if (countContainer) countContainer.innerHTML = '0 Items';
            return;
        }
        
        let itemsToRender = items;
        if (items.length > displayedWishlistLimit) {
            itemsToRender = items.slice(0, displayedWishlistLimit);
            if (loadMoreBtnContainer) {
                loadMoreBtnContainer.innerHTML = `<button class="btn-gold" style="width:auto; min-width:180px; margin:auto;" onclick="loadMoreWishlist()">Show More</button>`;
            }
        } else {
            if (loadMoreBtnContainer) loadMoreBtnContainer.innerHTML = '';
        }
        
        if (countContainer) {
            const visible = Math.min(items.length, displayedWishlistLimit);
            countContainer.innerHTML = `Showing ${visible} of ${items.length} Items`;
        }
        
        container.innerHTML = itemsToRender.map(productCardHtml).join(''); 
    } else {
        if(items.length === 0) {
            container.innerHTML = `<p style="text-align:center; grid-column: 1/-1; color:#555;">No products found.</p>`;
            return;
        }
        container.innerHTML = items.map(productCardHtml).join(''); 
    }
}

// 3. PRODUCT DETAILS
function showDetail(id) { 
    const p = products.find(x => x.id === id); 
    if(!p) return;
    
    activeProductId = id; // Track active product ID
    
    document.getElementById('det-name').innerText = p.name; 
    document.getElementById('det-price').innerText = `₹${p.price}`; 
    document.getElementById('det-desc').innerText = p.description || "Premium Quality."; 
    
    document.getElementById('det-gallery').innerHTML = p.images && p.images.length ? p.images.map(img => `<img src="${img}">`).join('') : '<img src="https://placehold.co/400x400/222/FFF?text=No+Image">'; 
    document.getElementById('det-indicators').innerHTML = p.images && p.images.length > 1 ? p.images.map((_, i) => `<div class="dot ${i===0?'active':''}"></div>`).join('') : ''; 
    
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
            <div class="size-chip ${sz === selectedSize ? 'active' : ''}" onclick="selectDetailSize('${sz}', this)">${sz}</div>
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
    el.parentElement.querySelectorAll('.size-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    
    const p = products.find(x => x.id === activeProductId);
    if (p) {
        renderDetailColors(p);
    }
}

function selectDetailColor(col, el) {
    selectedColor = col;
    el.parentElement.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
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
        
        colorSelector.innerHTML = colors.map(col => {
            const cleanColor = col.trim();
            const isWhite = cleanColor.toLowerCase() === '#ffffff' || cleanColor.toLowerCase() === 'white';
            const indicatorBorder = isWhite ? '1px solid rgba(255, 255, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)';
            const colorPreview = `<span class="color-indicator" style="background:${cleanColor}; border:${indicatorBorder};"></span>`;
            return `
                <div class="color-chip ${col === selectedColor ? 'active' : ''}" onclick="selectDetailColor('${col}', this)">
                    ${colorPreview}<span>${formatColorName(col)}</span>
                </div>
            `;
        }).join('');
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
        specs.push(`Color: ${formatColorName(selectedColor)}`);
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
    if (!p) return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${id}`;
    const shareText = `👗 *${p.name}*\n💰 ₹${p.price}\n\n🛍️ Shop now on Swag Stree:\n${shareUrl}`;
    if (navigator.share) { 
        try { 
            await navigator.share({ title: p.name, text: shareText });
        } catch (err) {} 
    } else { 
        copyToClipboard(shareUrl);
        showToast('Link copied to clipboard!');
    } 
}

function searchHandler() { 
    displayedProductsLimit = 20;
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
    displayedProductsLimit = 20;
    document.querySelectorAll('#filter-sizes .size-chip').forEach(c => c.classList.remove('active'));
    if(filterActiveSize === sz) filterActiveSize = null;
    else { filterActiveSize = sz; el.classList.add('active'); }
    applySortAndFilter();
}

function setFilterColor(el, col) {
    displayedProductsLimit = 20;
    document.querySelectorAll('#filter-colors .color-chip').forEach(c => c.classList.remove('active'));
    if(filterActiveColor === col) filterActiveColor = null;
    else { filterActiveColor = col; el.classList.add('active'); }
    applySortAndFilter();
}

function renderFilters() {
    const allSizes = new Set(['S', 'M', 'L', 'XL', 'XXL']);
    const allColors = new Map(); // displayName -> hex/value
    
    products.forEach(p => {
        if (p.sizes && Array.isArray(p.sizes)) p.sizes.forEach(s => allSizes.add(s.trim().toUpperCase()));
        if (p.colors && Array.isArray(p.colors)) {
            p.colors.forEach(c => {
                const cleanValue = c.trim().toLowerCase();
                const displayName = formatColorName(c);
                if (displayName && !allColors.has(displayName)) {
                    allColors.set(displayName, cleanValue);
                }
            });
        }
    });
    
    const sizesContainer = document.getElementById('filter-sizes');
    if (sizesContainer) {
        sizesContainer.innerHTML = Array.from(allSizes).map(sz => `
            <div class="size-chip ${filterActiveSize === sz ? 'active' : ''}" onclick="setFilterSize(this, '${sz}')">${sz}</div>
        `).join('');
    }
    
    const colorsContainer = document.getElementById('filter-colors');
    if (colorsContainer) {
        colorsContainer.innerHTML = Array.from(allColors.entries()).map(([displayName, value]) => {
            const isWhite = value === '#ffffff' || value === 'white';
            const indicatorBorder = isWhite ? '1px solid rgba(255, 255, 255, 0.6)' : '1px solid rgba(255, 255, 255, 0.15)';
            const colorPreview = `<span class="color-indicator" style="background:${value}; border:${indicatorBorder};"></span>`;
            return `
                <div class="color-chip ${filterActiveColor === displayName ? 'active' : ''}" onclick="setFilterColor(this, '${displayName}')">
                    ${colorPreview}<span>${displayName}</span>
                </div>
            `;
        }).join('');
    }
}

function resetFilters() {
    displayedProductsLimit = 20;
    filterActiveSize = null;
    filterActiveColor = null;
    const sortLogic = document.getElementById('sort-logic');
    if (sortLogic) sortLogic.value = 'none';
    document.querySelectorAll('#filter-slider .size-chip, #filter-slider .color-chip').forEach(c => c.classList.remove('active'));
    applySortAndFilter();
}

function applySortAndFilter() {
    const sort = document.getElementById('sort-logic').value;
    let filtered = [...products];
    
    if(filterActiveSize) {
        filtered = filtered.filter(p => p.sizes && Array.isArray(p.sizes) && p.sizes.some(s => s.trim().toUpperCase() === filterActiveSize));
    }
    
    if(filterActiveColor) {
        filtered = filtered.filter(p => p.colors && Array.isArray(p.colors) && p.colors.some(c => formatColorName(c) === filterActiveColor));
    }
    
    if(sort === 'low') filtered.sort((a,b) => a.price - b.price);
    if(sort === 'high') filtered.sort((a,b) => b.price - a.price);
    renderProducts(filtered, 'product-grid');
}

function changeSortLogic() {
    displayedProductsLimit = 20;
    applySortAndFilter();
}

function loadMoreProducts() {
    displayedProductsLimit += 20;
    const q = document.getElementById('app_search').value.toLowerCase(); 
    if (q) {
        renderProducts(products.filter(p => p.name.toLowerCase().includes(q)), 'product-grid');
    } else {
        applySortAndFilter();
    }
}

function loadMoreWishlist() {
    displayedWishlistLimit += 20;
    renderStore();
}
