// ==========================================
// SWAG STREE | STORE & PRODUCT RENDERING
// ==========================================

// Global variables fallback definition to prevent browser cache mismatch crashes
if (typeof filterActiveColor === 'undefined') window.filterActiveColor = null;
if (typeof filterActiveSize === 'undefined') window.filterActiveSize = null;
if (typeof filterActivePattern === 'undefined') window.filterActivePattern = null;
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
        products = snap.docs.map(doc => {
            const p = {...doc.data(), id:doc.id};
            p.normalizedVariants = normalizeVariants(p);
            return p;
        }); 
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
        <div class="wish-btn ${isFav?'active':''}" onclick="event.stopPropagation(); toggleWish('${p.id}')">
            <i class="fa${isFav?'s':'r'} fa-heart"></i>
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
                ${displayImages.length > 1 ? displayImages.map((_, i) => `<div class="dot ${i===0?'active':''}"></div>`).join('') : ''}
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
            
            if (patternValues.length === 1 && patternValues[0] === '' && v.previewImages && v.previewImages.length > 1) {
                patternValues = v.previewImages.map((_, i) => `Design ${i + 1}`);
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
    if(!p) return;
    
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
            const cleanColor = col.trim();
            const isWhite = cleanColor.toLowerCase() === '#ffffff' || cleanColor.toLowerCase() === 'white';
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
    document.getElementById('det-indicators').innerHTML = imagesToDisplay.length > 1 ? imagesToDisplay.map((_, i) => `<div class="dot ${i===0?'active':''}"></div>`).join('') : ''; 
    
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
        if (selectedColor) specs.push(`Color: ${formatColorName(selectedColor)}`);
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

function setFilterPattern(el, pat) {
    displayedProductsLimit = 20;
    document.querySelectorAll('#filter-patterns .size-chip').forEach(c => c.classList.remove('active'));
    if(filterActivePattern === pat) filterActivePattern = null;
    else { filterActivePattern = pat; el.classList.add('active'); }
    applySortAndFilter();
}

function renderFilters() {
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
            `<div class="size-chip ${filterActiveSize === sz ? 'active' : ''}" onclick="setFilterSize(this, '${sz}')">${sz}</div>`
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
                <div class="color-chip ${filterActiveColor === colorVal ? 'active' : ''}" onclick="setFilterColor(this, '${safeVal}')">
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
            const activeMatch = filterActivePattern === group.key;

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
    displayedProductsLimit = 20;
    filterActiveSize = null;
    filterActiveColor = null;
    filterActivePattern = null;
    const sortLogic = document.getElementById('sort-logic');
    if (sortLogic) sortLogic.value = 'none';
    document.querySelectorAll('#filter-slider .size-chip, #filter-slider .color-chip').forEach(c => c.classList.remove('active'));
    applySortAndFilter();
}

function applySortAndFilter() {
    const sort = document.getElementById('sort-logic').value;
    let filtered = [...products];

    if (filterActiveSize) {
        filtered = filtered.filter(p => {
            // Use normalizedVariants so comma-split sizes are expanded
            const normVars = p.normalizedVariants && p.normalizedVariants.length > 0
                ? p.normalizedVariants : normalizeVariants(p);
            return normVars.some(v => v.size && v.size.trim().toUpperCase() === filterActiveSize);
        });
    }

    if (filterActiveColor) {
        filtered = filtered.filter(p => {
            // Use normalizedVariants so comma-split colors are expanded; match by raw color value
            const normVars = p.normalizedVariants && p.normalizedVariants.length > 0
                ? p.normalizedVariants : normalizeVariants(p);
            return normVars.some(v => v.color && v.color.trim() === filterActiveColor);
        });
    }

    if (filterActivePattern) {
        filtered = filtered.filter(p => {
            const normVars = p.normalizedVariants && p.normalizedVariants.length > 0
                ? p.normalizedVariants : normalizeVariants(p);
            return normVars.some(v => {
                if (!v.pattern) return false;
                const patVal = v.pattern.trim();
                const previewUrl = v.previewImage || '';
                const displayName = (v.patternDisplayName && v.patternDisplayName.trim()) ? v.patternDisplayName.trim() : patVal;
                const vGroupKey = previewUrl ? previewUrl : displayName.toLowerCase();
                return vGroupKey === filterActivePattern;
            });
        });
    }

    if (sort === 'low') filtered.sort((a, b) => a.price - b.price);
    if (sort === 'high') filtered.sort((a, b) => b.price - a.price);
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
