// ==========================================
// SWAG STREE | ADMIN TOOLS
// ==========================================

// Inject custom toggle styles to prevent caching issues
if (!document.getElementById('custom-toggle-styles')) {
    const style = document.createElement('style');
    style.id = 'custom-toggle-styles';
    style.textContent = `
        .toggle-input:checked + .toggle-track-container > .toggle-track {
            background: var(--toggle-color, var(--gold)) !important;
        }
        .toggle-input:checked + .toggle-track-container > .toggle-handle {
            left: 20px !important;
        }
        .toggle-input:checked ~ .toggle-label {
            color: var(--toggle-color, var(--gold)) !important;
        }
    `;
    document.head.appendChild(style);
}

// Global variables fallback definition to prevent browser cache mismatch crashes
if (typeof window.isAdmin === 'undefined') window.isAdmin = false;
if (typeof window.products === 'undefined') window.products = [];
if (typeof window.editingId === 'undefined') window.editingId = null;
if (typeof window.existingImageUrls === 'undefined') window.existingImageUrls = [];
if (typeof window.currentProductFiles === 'undefined') window.currentProductFiles = [];

if (typeof window.editingProductsLimit === 'undefined') window.editingProductsLimit = 20;

const ALL_SIZES = [
    { id: 'XXS', label: 'XXS (Chest: 32")' },
    { id: 'XS', label: 'XS (Chest: 34")' },
    { id: 'S', label: 'S (Chest: 36")' },
    { id: 'M', label: 'M (Chest: 38")' },
    { id: 'L', label: 'L (Chest: 40")' },
    { id: 'XL', label: 'XL (Chest: 42")' },
    { id: 'XXL', label: 'XXL (Chest: 44")' },
    { id: '3XL', label: '3XL (Chest: 46")' },
    { id: '4XL', label: '4XL (Chest: 48")' },
    { id: '5XL', label: '5XL (Chest: 50")' },
    { id: '6XL', label: '6XL (Chest: 52")' },
    { id: '7XL', label: '7XL (Chest: 54")' }
];

const ALL_COLORS = [
    'Red', 'Black', 'White', 'Navy Blue', 'Grey', 'Maroon', 'Olive Green', 
    'Yellow', 'Pink', 'Purple', 'Brown', 'Beige', 'Sky Blue', 'Orange', 'Mustard', 'Teal'
];

const ALL_PATTERNS = [
    'Solid', 'Striped', 'Floral', 'Checked', 'Polka Dot', 'Printed', 'Embroidered', 
    'Abstract', 'Geometric', 'Tie-Dye', 'Camouflage', 'Animal Print'
];

let variantBlocks = [];

function renderVariantBlocks() {
    const container = document.getElementById('m-variants-container');
    if (!container) return;
    
    container.innerHTML = variantBlocks.map((v, idx) => {
        const hasSwatches = v.previewImages && v.previewImages.length > 0;
        const colorPreviewStyle = v.color ? `background:${v.color.trim()}; display:inline-block; width:14px; height:14px; border-radius:50%; border:1px solid #666; vertical-align:middle; margin-right:4px; flex-shrink:0;` : 'display:none;';

        // Helper: styled toggle checkbox
        const toggle = (id, checked, onChange, label, color) => `
            <label class="toggle-container" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; padding:8px 10px; border-radius:8px; background:#111; border:1px solid #2a2a2a; min-width:0; flex:1; --toggle-color:${color||'#FFD700'};">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${onChange}" class="toggle-input" style="opacity:0; width:0; height:0; position:absolute;">
                <div class="toggle-track-container" style="position:relative; width:38px; height:20px; flex-shrink:0; pointer-events:none;">
                    <span class="toggle-track" style="position:absolute; inset:0; border-radius:20px; background:#333; transition:0.2s;"></span>
                    <span class="toggle-handle" style="position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%; background:#fff; transition:0.2s;"></span>
                </div>
                <span class="toggle-label" style="font-size:12px; color:#777; line-height:1.3;">${label}</span>
            </label>`;


        return `
        <div class="variant-block" id="v-block-${v.id}" style="background:#141414; border-radius:12px; border:1px solid #2a2a2a; margin-bottom:14px; overflow:hidden; position:relative;">

            <!-- Header bar -->
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:#1e1e1e; border-bottom:1px solid #2a2a2a; gap:8px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:#FFD700;">
                    <span style="background:#2a2a2a; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; font-size:11px;">${idx + 1}</span>
                    <span style="display:flex; align-items:center; gap:4px;">
                        <span style="${colorPreviewStyle}"></span>
                        ${v.colorName || (v.color ? v.color : '') || 'Variant'}
                        ${v.size && v.size !== 'Standard' ? `<span style="color:#aaa; font-weight:400; font-size:11px;">· ${v.size}</span>` : ''}
                        ${v.pattern ? `<span style="color:#aaa; font-weight:400; font-size:11px;">· ${v.pattern}</span>` : ''}
                    </span>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <span id="v-active-badge-${v.id}" style="font-size:11px; padding:3px 8px; border-radius:20px; background:${v.isActive !== false ? '#1a3a1a' : '#3a1a1a'}; color:${v.isActive !== false ? '#4caf50' : '#e57373'};">
                        ${v.isActive !== false ? '● Active' : '○ Hidden'}
                    </span>
                    <button onclick="removeVariant('${v.id}')" title="Remove variant" style="background:none; border:1px solid #444; border-radius:6px; color:#666; cursor:pointer; padding:4px 8px; font-size:13px; line-height:1;">✕</button>
                </div>
            </div>

            <div style="padding:12px 14px; display:flex; flex-direction:column; gap:12px;">

                <!-- Row 1: Size & Price -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>
                        <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Size</div>
                        <input list="size-options-${v.id}" id="v-size-${v.id}" placeholder="e.g. S, M, XL, L" value="${v.size === 'Standard' ? '' : (v.size || '')}" oninput="updateVariant('${v.id}', 'size', this.value)" onchange="renderVariantBlocks()" style="width:100%; box-sizing:border-box; padding:9px 10px; border-radius:7px; border:1px solid #333; background:#1e1e1e; color:#fff; font-size:13px;">
                        <datalist id="size-options-${v.id}">${ALL_SIZES.map(s => `<option value="${s.id}">`).join('')}</datalist>
                    </div>
                    <div>
                        <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Custom Price <span style="color:#555; font-size:9px;">(blank = base)</span></div>
                        <input id="v-price-${v.id}" type="number" placeholder="₹ Leave blank" value="${v.price || ''}" oninput="updateVariant('${v.id}', 'price', this.value)" onchange="renderVariantBlocks()" style="width:100%; box-sizing:border-box; padding:9px 10px; border-radius:7px; border:1px solid #333; background:#1e1e1e; color:#fff; font-size:13px;">
                    </div>
                </div>

                <!-- Row 2: Color & Color Display Text -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>
                        <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Color Value <span style="color:#555; font-size:9px;">(hex or name)</span></div>
                        <div style="position:relative;">
                            ${v.color ? `<span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); width:14px; height:14px; border-radius:50%; background:${v.color.trim()}; border:1px solid #555; pointer-events:none;"></span>` : ''}
                            <input list="color-options-${v.id}" id="v-color-${v.id}" placeholder="#FF0000, red…" value="${v.color || ''}" oninput="updateVariant('${v.id}', 'color', this.value)" onchange="renderVariantBlocks()" style="width:100%; box-sizing:border-box; padding:9px 10px 9px ${v.color ? '30px' : '10px'}; border-radius:7px; border:1px solid #333; background:#1e1e1e; color:#fff; font-size:13px;">
                            <datalist id="color-options-${v.id}">${ALL_COLORS.map(c => `<option value="${c}">`).join('')}</datalist>
                        </div>
                    </div>
                    <div>
                        <div style="font-size:10px; color:#FFD700; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Color Display Text <span style="color:#555; font-size:9px;">(optional)</span></div>
                        <input id="v-colorname-${v.id}" placeholder="e.g. Sky Blue, Maroon" value="${v.colorName || ''}" oninput="updateVariant('${v.id}', 'colorName', this.value)" onchange="renderVariantBlocks()" style="width:100%; box-sizing:border-box; padding:9px 10px; border-radius:7px; border:1px solid #444; background:#1e1e1e; color:#FFD700; font-size:13px;">
                    </div>
                </div>

                <!-- Row 3: Pattern & Pattern Display Text -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <div>
                        <div style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Pattern <span style="color:#555; font-size:9px;">(comma-sep for multiple)</span></div>
                        <input list="pattern-options-${v.id}" id="v-pattern-${v.id}" placeholder="e.g. Floral, p1, p2" value="${v.pattern || ''}" oninput="updateVariant('${v.id}', 'pattern', this.value)" onchange="renderVariantBlocks()" style="width:100%; box-sizing:border-box; padding:9px 10px; border-radius:7px; border:1px solid #333; background:#1e1e1e; color:#fff; font-size:13px;">
                        <datalist id="pattern-options-${v.id}">${ALL_PATTERNS.map(p => `<option value="${p}">`).join('')}</datalist>
                    </div>
                    <div>
                        <div style="font-size:10px; color:#25D366; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Pattern Display Text <span style="color:#555; font-size:9px;">(optional)</span></div>
                        <input id="v-patternname-${v.id}" placeholder="e.g. Floral Print, Checks" value="${v.patternName || ''}" oninput="updateVariant('${v.id}', 'patternName', this.value)" onchange="renderVariantBlocks()" title="Custom display names (comma-separated). Maps to each pattern key." style="width:100%; box-sizing:border-box; padding:9px 10px; border-radius:7px; border:1px solid #444; background:#1e1e1e; color:#25D366; font-size:13px;">
                    </div>
                </div>

                <!-- Row 4: Upload buttons -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <label style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:12px 8px; border-radius:8px; border:1.5px dashed #444; background:#1a1a1a; color:#aaa; text-align:center; cursor:pointer; font-size:12px; line-height:1.3; min-height:52px;">
                        <span style="font-size:18px;">🖼️</span>
                        <span>Upload Variant Images</span>
                        <input type="file" multiple accept="image/*" style="display:none;" onchange="handleFileSelect(this, '${v.id}')">
                    </label>
                    <label style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:12px 8px; border-radius:8px; border:1.5px dashed #25D366; background:#1a1a1a; color:#25D366; text-align:center; cursor:pointer; font-size:12px; line-height:1.3; min-height:52px;">
                        <span style="font-size:18px;">🎨</span>
                        <span>Pattern / Color Swatch(es)</span>
                        <input type="file" multiple accept="image/*" style="display:none;" onchange="handleSwatchSelect(this, '${v.id}')">
                    </label>
                </div>

                <!-- Image & Swatch previews -->
                <div id="v-preview-${v.id}" style="display:flex; gap:5px; flex-wrap:wrap;"></div>
                <div id="v-swatch-${v.id}" style="display:flex; gap:5px; flex-wrap:wrap;"></div>

                <!-- Row 5: Toggle options (2-col grid on wide, 1-col on narrow) -->
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:6px;">
                    ${toggle(`v-active-${v.id}`, v.isActive !== false, `updateVariant('${v.id}', 'isActive', this.checked); const badge = document.getElementById('v-active-badge-${v.id}'); if(badge) { badge.style.background = this.checked ? '#1a3a1a' : '#3a1a1a'; badge.style.color = this.checked ? '#4caf50' : '#e57373'; badge.innerHTML = this.checked ? '● Active' : '○ Hidden'; }`, 'Active', '#4caf50')}
                    ${toggle(`v-hidedet-${v.id}`, !!v.hideDetailsGallery, `updateVariant('${v.id}', 'hideDetailsGallery', this.checked)`, 'Hide Details Images In Gallery', '#e57373')}
                    ${toggle(`v-showmain-${v.id}`, !!v.showInMainCarousel, `updateVariant('${v.id}', 'showInMainCarousel', this.checked)`, 'Show on Home Screen', '#64b5f6')}
                    ${hasSwatches ? toggle(`v-showpattext-${v.id}`, !!v.showPatternText, `updateVariant('${v.id}', 'showPatternText', this.checked)`, 'Show Pattern Text', '#25D366') : ''}
                    ${toggle(`v-track-${v.id}`, !!v.trackStock, `updateVariant('${v.id}', 'trackStock', this.checked); renderVariantBlocks();`, 'Track Stock', '#FFD700')}
                    <div id="v-stock-qty-container-${v.id}" style="display:${v.trackStock ? 'flex' : 'none'}; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; background:#111; border:1px solid #2a2a2a;">
                        <span style="font-size:12px; color:#aaa; white-space:nowrap;">Stock Qty:</span>
                        <input type="number" placeholder="0" value="${v.stockCount || 0}" oninput="updateVariant('${v.id}', 'stockCount', parseInt(this.value)||0)" onchange="renderVariantBlocks()" style="flex:1; min-width:0; padding:5px 8px; border-radius:5px; border:1px solid #444; background:#222; color:#FFD700; font-size:13px; font-weight:700; text-align:center;">
                    </div>
                </div>

            </div>
        </div>
    `;
    }).join('');

    variantBlocks.forEach((v, index) => {
        renderImagePreviews(v.id);
        renderSwatchPreview(v.id);
        
        const blockEl = document.getElementById(`v-block-${v.id}`);
        if(blockEl) {
            let badge = blockEl.querySelector('.sort-badge');
            if(!badge) {
                badge = document.createElement('div');
                badge.className = 'sort-badge';
                badge.style.cssText = 'position:absolute; top:-10px; left:-10px; background:var(--gold); color:#000; font-weight:bold; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; z-index:10; cursor:grab;';
                blockEl.appendChild(badge);
            }
            badge.innerText = (index + 1);
            
            // Remove old warn badge if left over
            const oldWarn = blockEl.querySelector('.warn-badge');
            if (oldWarn) oldWarn.remove();

            // Check for duplicate variant
            const isDuplicate = variantBlocks.some((x, xIdx) => {
                if (xIdx === index) return false;
                return (x.size || 'Standard').trim().toLowerCase() === (v.size || 'Standard').trim().toLowerCase() &&
                       (x.color || '').trim().toLowerCase() === (v.color || '').trim().toLowerCase() &&
                       (x.pattern || '').trim().toLowerCase() === (v.pattern || '').trim().toLowerCase();
            });

            // Check for stock count error
            const isStockError = v.trackStock && (v.stockCount === undefined || v.stockCount === null || isNaN(v.stockCount) || v.stockCount < 0);

            // Check for price error
            const isPriceError = v.price !== '' && v.price !== null && v.price !== undefined && (isNaN(v.price) || Number(v.price) < 0);

            let infoMsg = '';
            if (isDuplicate) {
                infoMsg = 'Info: This is a duplicate variant combination (Size, Color, Pattern) and will be merged upon saving.';
            } else if (isStockError) {
                infoMsg = 'Error: Track Stock is enabled, but Stock Quantity is invalid.';
            } else if (isPriceError) {
                infoMsg = 'Error: Custom Price is invalid.';
            }

            let infoEl = blockEl.querySelector('.info-badge');
            if (infoMsg) {
                if (!infoEl) {
                    infoEl = document.createElement('div');
                    infoEl.className = 'info-badge';
                    infoEl.style.cssText = 'position:absolute; top:-10px; right:20px; color:#fff; font-weight:bold; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; z-index:10; cursor:help;';
                    blockEl.appendChild(infoEl);
                }
                infoEl.title = infoMsg;
                infoEl.innerHTML = 'ⓘ';
                infoEl.style.background = infoMsg.startsWith('Error:') ? '#e74c3c' : '#3498db';
            } else if (infoEl) {
                infoEl.remove();
            }
        }
    });

    if (window.Sortable) {
        if (container._sortable) container._sortable.destroy();
        container._sortable = Sortable.create(container, {
            animation: 150,
            handle: '.sort-badge',
            onEnd: function (evt) {
                const movedItem = variantBlocks.splice(evt.oldIndex, 1)[0];
                variantBlocks.splice(evt.newIndex, 0, movedItem);
                renderVariantBlocks();
            }
        });
    }
}

// Swatch preview rendering with Sortable and unified index badges
function renderSwatchPreview(vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    const container = document.getElementById(`v-swatch-${vId}`);
    if (!container) return;
    
    let html = (v.previewImages || []).map((img, i) => {
        const isFile = img instanceof File;
        const url = isFile ? URL.createObjectURL(img) : img;
        const borderStyle = isFile ? 'border:2px dashed #25D366;' : 'border:1px solid #444;';
        return `
            <div style="position:relative; width:40px; height:40px; cursor:grab; ${borderStyle} border-radius:5px; overflow:hidden;">
                <div class="sort-badge-img" style="position:absolute; top:2px; left:2px; background:var(--gold); color:#000; font-weight:bold; width:14px; height:14px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:8px; z-index:5;">${i + 1}</div>
                <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                <div onclick="removeSwatch('${vId}', ${i})" style="position:absolute; top:-2px; right:-2px; background:rgba(255,0,0,0.8); color:white; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; font-size:10px; cursor:pointer; font-weight:bold; z-index:6;">&times;</div>
            </div>`;
    }).join('');
    
    container.innerHTML = html;
    
    if (window.Sortable && container) {
        if (container._sortable) container._sortable.destroy();
        container._sortable = Sortable.create(container, {
            animation: 150,
            onEnd: function (evt) {
                const moved = v.previewImages.splice(evt.oldIndex, 1)[0];
                v.previewImages.splice(evt.newIndex, 0, moved);
                renderSwatchPreview(vId);
            }
        });
    }
}

function addVariantBlock() {
    variantBlocks.push({
        id: 'v_' + Math.random().toString(36).substr(2, 9),
        size: 'Standard',
        color: '',
        colorName: '',
        pattern: '',
        patternName: '',
        showPatternText: false,
        price: '',
        hideDetailsGallery: false,
        showInMainCarousel: false,
        isActive: true,
        trackStock: false,
        stockCount: 0,
        images: [],
        previewImages: []
    });
    renderVariantBlocks();
}

function handleFileSelect(input, vId) {
    if(!input.files || input.files.length === 0) return;
    const newFiles = Array.from(input.files);
    
    if (vId === 'base') {
        existingImageUrls = [...existingImageUrls, ...newFiles];
    } else {
        const v = variantBlocks.find(x => x.id === vId);
        if (!v) return;
        v.images = [...(v.images || []), ...newFiles];
    }
    renderImagePreviews(vId);
    input.value = '';
}

function handleSwatchSelect(input, vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    if (input.files && input.files.length > 0) {
        v.previewImages = [...(v.previewImages || []), ...Array.from(input.files)];
    }
    renderVariantBlocks();
    input.value = '';
}

function removeVariantImage(vId, index) {
    const v = variantBlocks.find(x => x.id === vId);
    if (v && v.images) v.images.splice(index, 1);
    renderImagePreviews(vId);
}

function removeSwatch(vId, index) {
    const v = variantBlocks.find(x => x.id === vId);
    if (v && v.previewImages) v.previewImages.splice(index, 1);
    renderVariantBlocks();
}

function updateVariant(id, field, value) {
    const v = variantBlocks.find(x => x.id === id);
    if (v) {
        v[field] = value;
        console.log(`[updateVariant] Variant ${id}: set ${field} =`, value);
    }
}

function removeVariant(id) {
    variantBlocks = variantBlocks.filter(x => x.id !== id);
    renderVariantBlocks();
}

function renderAdmin() { 
    const container = document.getElementById('admin-list');
    if(!container) return;
    
    const loadMoreContainer = document.getElementById('admin-load-more-container');
    const countContainer = document.getElementById('admin-product-count');
    
    if (products.length === 0 && !window.productsLoaded) {
        if (countContainer) countContainer.style.display = 'none';
        if (loadMoreContainer) loadMoreContainer.innerHTML = '';
        container.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; gap: 12px; width: 100%;">
                <div class="premium-loader"></div>
                <p style="color: #aaa; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin: 0; font-weight: 700;">Loading Products</p>
            </div>
        `;
        return;
    }
    
    let itemsToRender = products;
    
    if (products.length > editingProductsLimit) {
        itemsToRender = products.slice(0, editingProductsLimit);
        if (loadMoreContainer) {
            loadMoreContainer.innerHTML = `<button class="btn-gold" style="width:auto; min-width:180px; margin:auto;" onclick="loadMoreAdminProducts()">Show More</button>`;
        }
    } else {
        if (loadMoreContainer) loadMoreContainer.innerHTML = '';
    }
    
    if (countContainer) {
        const visible = Math.min(products.length, editingProductsLimit);
        countContainer.innerHTML = products.length > 0 ? `Showing ${visible} of ${products.length} Products` : '0 Products';
        countContainer.style.display = 'inline-flex';
    }
    
    container.innerHTML = itemsToRender.map(p => {
        let thumbUrl = 'https://placehold.co/400x400/222/FFF?text=+';
        if (p.images && p.images.length > 0) {
            thumbUrl = p.images[0];
        } else if (p.variants && Array.isArray(p.variants)) {
            const vWithImg = p.variants.find(v => v.images && v.images.length > 0);
            if (vWithImg) thumbUrl = vWithImg.images[0];
        }

        const activeVariants = p.variants && Array.isArray(p.variants) ? p.variants.filter(v => v.isActive !== false) : [];
        let isOutOfStock = false;
        if (activeVariants.length > 0) {
            const trackingVariants = activeVariants.filter(v => v.trackStock);
            if (trackingVariants.length > 0 && trackingVariants.every(v => (v.stockCount || 0) <= 0)) {
                isOutOfStock = true;
            }
        }

        let stockHtml = '';
        if (activeVariants.length > 0) {
            stockHtml = `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:2px;">`;
            activeVariants.forEach(v => {
                let badgeColor = '#888';
                let badgeBg = 'rgba(255,255,255,0.05)';
                let border = '1px solid rgba(255,255,255,0.1)';
                let label = '';
                
                const nameParts = [];
                if (v.size && v.size !== 'Standard') nameParts.push(v.size);
                if (v.colorName) nameParts.push(v.colorName);
                else if (v.color) nameParts.push(v.color);
                if (v.patternName) nameParts.push(v.patternName);
                else if (v.pattern) nameParts.push(v.pattern);
                
                const varName = nameParts.join(' / ') || 'Standard';
                
                if (v.trackStock) {
                    const stock = v.stockCount || 0;
                    if (stock <= 0) {
                        badgeColor = '#ff4d4d';
                        badgeBg = 'rgba(255, 77, 77, 0.1)';
                        border = '1px solid rgba(255, 77, 77, 0.2)';
                        label = `${varName}: 0 Left (OOS)`;
                    } else {
                        badgeColor = '#FFD700';
                        badgeBg = 'rgba(255, 215, 0, 0.05)';
                        border = '1px solid rgba(255, 215, 0, 0.2)';
                        label = `${varName}: ${stock} Left`;
                    }
                } else {
                    label = `${varName}: Unlimited`;
                }
                stockHtml += `<span style="font-size:10px; padding:2px 6px; border-radius:4px; color:${badgeColor}; background:${badgeBg}; border:${border}; font-weight:600; text-transform:uppercase; white-space:normal; display:inline-block; max-width:100%; word-break:break-word;">${label}</span>`;
            });
            stockHtml += `</div>`;
        }

        return `
        <div style="display:flex; align-items:center; gap:12px; background:#111; padding:12px; border-radius:15px; margin-bottom:12px; border:1px solid #222">
            <img src="${thumbUrl}" style="width:40px;height:40px;border-radius:5px;object-fit:cover">
            <div style="flex:1; display:flex; flex-direction:column; gap:4px; min-width:0;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <b>${p.name}</b>
                    ${isOutOfStock ? `<span style="background:rgba(255, 77, 77, 0.15); color:#ff4d4d; font-size:10px; font-weight:800; padding:2px 6px; border-radius:4px; border:1px solid rgba(255, 77, 77, 0.3); letter-spacing:0.5px; text-transform:uppercase; display:inline-block;">OUT OF STOCK</span>` : ''}
                </div>
                ${stockHtml}
            </div>
            <div style="display:flex; gap:15px; align-items:center;">
                <i class="fa fa-copy" style="color:#aaa; cursor:pointer;" title="Copy Product" onclick="copyProduct('${p.id}')"></i>
                <i class="fa fa-edit" style="color:var(--gold); cursor:pointer" onclick="openEdit('${p.id}')"></i>
                <i class="fa fa-trash" style="color:var(--red); cursor:pointer" onclick="if(confirm('Delete?')) db.collection('products').doc('${p.id}').delete()"></i>
            </div>
        </div>
    `}).join(''); 
}

function loadMoreAdminProducts() {
    editingProductsLimit += 20;
    renderAdmin();
}

function openEdit(id) { 
    editingId = id; 
    const p = products.find(x => x.id === id); 
    document.getElementById('m-name').value = p.name; 
    document.getElementById('m-price').value = p.price; 
    document.getElementById('m-desc').value = p.description || ""; 
    document.getElementById('m-hide-main').checked = !!p.hideMainCarousel;
    document.getElementById('m-hide-main-details').checked = !!p.hideMainDetailsCarousel;
    document.getElementById('m-main-pos').value = p.mainImagesPosition || 'end';
    document.getElementById('m-main-pos-container').style.display = p.hideMainDetailsCarousel ? 'none' : 'flex';
    document.getElementById('m-hide-main-placeholder').checked = !!p.hideNoImagePlaceholder;
    existingImageUrls = [...(p.images || [])]; 
    renderImagePreviews('base'); 
    
    // Load variants or fallback
    if (p.variants && Array.isArray(p.variants)) {
        variantBlocks = p.variants.map(v => ({
            id: 'v_' + Math.random().toString(36).substr(2, 9),
            size: v.size || 'Standard',
            color: v.color || '',
            colorName: v.colorName || '',
            pattern: v.pattern || '',
            patternName: v.patternName || '',
            showPatternText: !!v.showPatternText,
            price: v.price || null,
            hideDetailsGallery: !!v.hideDetailsGallery,
            showInMainCarousel: !!v.showInMainCarousel,
            isActive: v.isActive !== false,
            trackStock: !!v.trackStock,
            stockCount: v.stockCount || 0,
            images: [...(v.images || [])],
            previewImages: v.previewImages || (v.previewImage ? [v.previewImage] : [])
        }));
    } else {
        // Fallback for older products
        variantBlocks = [];
        const sizes = p.sizes || [];
        const map = p.sizeColorMap || {};
        sizes.forEach(sz => {
            const colors = map[sz] || [];
            if (colors.length > 0) {
                colors.forEach(col => {
                    let pImg = '';
                    if (Array.isArray(p.previewImages)) pImg = p.previewImages[0];
                    else if (p.previewImage) pImg = p.previewImage;

                    variantBlocks.push({
                        id: 'v_' + Math.random().toString(36).substr(2, 9),
                        size: sz,
                        color: col,
                        colorName: '',
                        pattern: '',
                        patternName: '',
                        showPatternText: false,
                        price: null,
                        hideDetailsGallery: false,
                        showInMainCarousel: false,
                        isActive: true,
                        trackStock: false,
                        stockCount: 0,
                        images: [],
                        previewImages: pImg ? [pImg] : []
                    });
                });
            } else {
                variantBlocks.push({
                    id: 'v_' + Math.random().toString(36).substr(2, 9),
                    size: sz,
                    color: '',
                    colorName: '',
                    pattern: '',
                    patternName: '',
                    showPatternText: false,
                    price: p.price,
                    hideDetailsGallery: false,
                    showInMainCarousel: false,
                    isActive: true,
                    trackStock: false,
                    stockCount: 0,
                    images: [],
                    previewImages: []
                });
            }
        });
    }

    renderImagePreviews('base'); 
    renderVariantBlocks();
    document.getElementById('prod-modal').style.display = 'flex'; 
}

function openAdd() { 
    editingId = null; 
    existingImageUrls = []; 
    variantBlocks = [];
    document.getElementById('m-name').value = ""; 
    document.getElementById('m-price').value = ""; 
    document.getElementById('m-desc').value = "";
    document.getElementById('m-hide-main').checked = false;
    document.getElementById('m-hide-main-details').checked = false;
    document.getElementById('m-main-pos').value = 'end';
    document.getElementById('m-main-pos-container').style.display = 'flex';
    document.getElementById('m-hide-main-placeholder').checked = false;
    
    renderImagePreviews('base'); 
    renderVariantBlocks();
    document.getElementById('prod-modal').style.display = 'flex'; 
}

function renderImagePreviews(targetId = 'base') { 
    const container = document.getElementById(targetId === 'base' ? 'm-preview' : `v-preview-${targetId}`); 
    if(!container) return;
    
    let html = '';
    if (targetId === 'base') {
        html += (existingImageUrls || []).map((img, i) => {
            const isFile = img instanceof File;
            const url = isFile ? URL.createObjectURL(img) : img;
            const borderStyle = isFile ? 'border:1px dashed #25D366;' : 'border:1px solid #444;';
            return `
                <div data-type="${isFile ? 'file' : 'url'}" data-idx="${i}" style="position:relative; width:60px; height:60px; border-radius:8px; overflow:hidden; ${borderStyle} cursor:grab;">
                    <div class="sort-badge-img" style="position:absolute; top:2px; left:2px; background:var(--gold); color:#000; font-weight:bold; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; z-index:5;">${i + 1}</div>
                    <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                    <i class="fa fa-times" style="position:absolute; top:2px; right:2px; color:var(--red); cursor:pointer; font-size:12px; background:rgba(0,0,0,0.5); padding:2px; border-radius:4px;" onclick="existingImageUrls.splice(${i},1);renderImagePreviews('base')"></i>
                </div>
            `;
        }).join('');
        container.innerHTML = html;



        if (window.Sortable && container) {
            if (container._sortable) container._sortable.destroy();
            container._sortable = Sortable.create(container, {
                animation: 150,
                onEnd: function (evt) {
                    const movedItem = existingImageUrls.splice(evt.oldIndex, 1)[0];
                    existingImageUrls.splice(evt.newIndex, 0, movedItem);
                    renderImagePreviews('base');
                }
            });
        }
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if(!v) return;
        
        let html = (v.images || []).map((img, i) => {
            const isFile = img instanceof File;
            const url = isFile ? URL.createObjectURL(img) : img;
            const borderStyle = isFile ? 'border:1px dashed #25D366;' : 'border:1px solid #444;';
            return `
                <div data-type="${isFile ? 'file' : 'url'}" data-idx="${i}" style="position:relative; width:60px; height:60px; border-radius:8px; overflow:hidden; ${borderStyle} cursor:grab;">
                    <div class="sort-badge-img" style="position:absolute; top:2px; left:2px; background:var(--gold); color:#000; font-weight:bold; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; z-index:5;">${i + 1}</div>
                    <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                    <i class="fa fa-times" style="position:absolute; top:2px; right:2px; color:var(--red); cursor:pointer; font-size:12px; background:rgba(0,0,0,0.5); padding:2px; border-radius:4px;" onclick="removeVariantImage('${targetId}', ${i})"></i>
                </div>
            `;
        }).join('');
        container.innerHTML = html;

        if (window.Sortable && container) {
            if (container._sortable) container._sortable.destroy();
            container._sortable = Sortable.create(container, {
                animation: 150,
                onEnd: function (evt) {
                    const movedItem = v.images.splice(evt.oldIndex, 1)[0];
                    v.images.splice(evt.newIndex, 0, movedItem);
                    renderImagePreviews(targetId);
                }
            });
        }
    }
}

// Global helper to upload a file to Cloudinary
async function uploadToCloudinary(file) {
    const fd = new FormData(); 
    fd.append("file", file); 
    fd.append("upload_preset", PRESET); 
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {method:"POST", body:fd}); 
    const d = await r.json(); 
    if (!d.secure_url) {
        throw new Error(d.error ? d.error.message : "Cloudinary upload failed");
    }
    return d.secure_url; 
}

async function saveProduct() { 
    const n = document.getElementById('m-name').value;
    const pr = document.getElementById('m-price').value; 
    if(!n || !pr) return showToast("Fields missing");

    const btn = document.getElementById('m-save'); 
    btn.disabled = true; 
    btn.innerText = "Processing..."; 
    
    try { 
        // Upload all base images in parallel (interleaved support)
        const finalMainImages = await Promise.all(
            existingImageUrls.map(async img => {
                if (img instanceof File) {
                    return await uploadToCloudinary(img);
                }
                return img;
            })
        );
        
        // Upload all variant images and swatches in parallel
        const parsedVariantsResult = await Promise.all(variantBlocks.map(async v => {
            const uploadedVariantImages = await Promise.all(
                (v.images || []).map(async img => {
                    if (img instanceof File) {
                        return await uploadToCloudinary(img);
                    }
                    return img;
                })
            );
            
            const uploadedPreviewUrls = await Promise.all(
                (v.previewImages || []).map(async img => {
                    if (img instanceof File) {
                        return await uploadToCloudinary(img);
                    }
                    return img;
                })
            );
            
            let finalSize = v.size || 'Standard';
            let finalColor = v.color || '';
            let finalColorName = v.colorName || '';
            let finalPattern = v.pattern || '';
            let finalPatternName = v.patternName || '';
            
            if (finalSize === 'Standard' && !finalColor && !finalPattern && uploadedPreviewUrls.length === 0) {
                return null;
            }
            
            return {
                size: finalSize,
                color: finalColor,
                colorName: finalColorName,
                pattern: finalPattern,
                patternName: finalPatternName,
                showPatternText: !!v.showPatternText,
                price: v.price ? Number(v.price) : null,
                hideDetailsGallery: !!v.hideDetailsGallery,
                showInMainCarousel: !!v.showInMainCarousel,
                isActive: v.isActive !== false,
                trackStock: !!v.trackStock,
                stockCount: typeof v.stockCount === 'number' ? v.stockCount : (parseInt(v.stockCount, 10) || 0),
                images: uploadedVariantImages,
                previewImages: uploadedPreviewUrls
            };
        }));
        
        const parsedVariants = parsedVariantsResult.filter(x => x !== null);
        
        const mergedVariants = [];
        parsedVariants.forEach(v => {
            const dup = mergedVariants.find(x => x.size.trim().toLowerCase() === v.size.trim().toLowerCase() && 
                                                 x.color.trim().toLowerCase() === v.color.trim().toLowerCase() && 
                                                 x.pattern.trim().toLowerCase() === v.pattern.trim().toLowerCase());
            if (dup) {
                dup.images = [...new Set([...(dup.images || []), ...(v.images || [])])];
                dup.previewImages = [...new Set([...(dup.previewImages || []), ...(v.previewImages || [])])];
                if (v.trackStock) {
                    dup.trackStock = true;
                    dup.stockCount = (parseInt(dup.stockCount, 10) || 0) + (parseInt(v.stockCount, 10) || 0);
                }
                if (dup.price === null || dup.price === undefined) {
                    dup.price = v.price;
                }
                if (v.isActive) dup.isActive = true;
                if (v.hideDetailsGallery) dup.hideDetailsGallery = true;
                if (v.showInMainCarousel) dup.showInMainCarousel = true;
                if (v.showPatternText) dup.showPatternText = true;
            } else {
                mergedVariants.push(v);
            }
        });
        
        const data = { 
            name: n, 
            price: Number(pr), 
            description: document.getElementById('m-desc').value, 
            hideMainCarousel: document.getElementById('m-hide-main').checked,
            hideMainDetailsCarousel: document.getElementById('m-hide-main-details').checked,
            mainImagesPosition: document.getElementById('m-main-pos').value,
            hideNoImagePlaceholder: document.getElementById('m-hide-main-placeholder').checked,
            images: finalMainImages,
            variants: mergedVariants,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            // Fallback for older legacy UI code (using flatMap for comma separation)
            sizes: [...new Set(mergedVariants.flatMap(v => v.size ? v.size.split(',').map(s => s.trim()).filter(s => s) : []))],
            colors: [...new Set(mergedVariants.flatMap(v => v.color ? v.color.split(',').map(c => c.trim()).filter(c => c) : []))],
            sizeColorMap: {}
        }; 
        
        mergedVariants.forEach(v => {
            const vSizes = v.size ? v.size.split(',').map(s => s.trim()).filter(s => s) : ['Standard'];
            const vColors = v.color ? v.color.split(',').map(c => c.trim()).filter(c => c) : [''];
            vSizes.forEach(sz => {
                if(!data.sizeColorMap[sz]) data.sizeColorMap[sz] = [];
                vColors.forEach(col => {
                    if(col && !data.sizeColorMap[sz].includes(col)) {
                        data.sizeColorMap[sz].push(col);
                    }
                });
            });
        });
        
        if(editingId) {
            await db.collection("products").doc(editingId).update(data); 
        } else {
            await db.collection("products").add(data); 
        }
        
        showToast("Saved!"); 
        closeModal('prod-modal'); 
    } catch(e) { 
        console.error(e);
        showToast("Error saving product: " + e.message); 
    } 
    btn.disabled = false; 
    btn.innerText = "Save Product"; 
}

// Render admin list on load if already authenticated as admin
if (isAdmin) {
    renderAdmin();
    loadPromoSettings();
}

// ── Admin Copy / Import / Export ───────────────────────────────────────────
function copyProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    
    editingId = null; // Set to null so it creates a NEW item when saved
    document.getElementById('m-name').value = p.name + " - Copy"; 
    document.getElementById('m-price').value = p.price; 
    document.getElementById('m-desc').value = p.description || ""; 
    document.getElementById('m-hide-main').checked = !!p.hideMainCarousel;
    document.getElementById('m-hide-main-details').checked = !!p.hideMainDetailsCarousel;
    document.getElementById('m-main-pos').value = p.mainImagesPosition || 'end';
    document.getElementById('m-main-pos-container').style.display = p.hideMainDetailsCarousel ? 'none' : 'flex';
    document.getElementById('m-hide-main-placeholder').checked = !!p.hideNoImagePlaceholder;
    existingImageUrls = [...(p.images || [])]; 
    
    // Load variants or fallback
    if (p.variants && Array.isArray(p.variants)) {
        variantBlocks = p.variants.map(v => ({
            id: 'v_' + Math.random().toString(36).substr(2, 9),
            size: v.size || 'Standard',
            color: v.color || '',
            colorName: v.colorName || '',
            pattern: v.pattern || '',
            patternName: v.patternName || '',
            showPatternText: !!v.showPatternText,
            price: v.price || null,
            hideDetailsGallery: !!v.hideDetailsGallery,
            showInMainCarousel: !!v.showInMainCarousel,
            isActive: v.isActive !== false,
            trackStock: !!v.trackStock,
            stockCount: v.stockCount || 0,
            images: [...(v.images || [])],
            previewImages: v.previewImages || (v.previewImage ? [v.previewImage] : [])
        }));
    } else {
        // Fallback for older products
        variantBlocks = [];
        const sizes = p.sizes || [];
        const map = p.sizeColorMap || {};
        sizes.forEach(sz => {
            const colors = map[sz] || [];
            if (colors.length > 0) {
                colors.forEach(col => {
                    variantBlocks.push({
                        id: 'v_' + Math.random().toString(36).substr(2, 9),
                        size: sz,
                        color: col,
                        colorName: '',
                        pattern: '',
                        patternName: '',
                        showPatternText: false,
                        price: null,
                        hideDetailsGallery: false,
                        showInMainCarousel: false,
                        isActive: true,
                        trackStock: false,
                        stockCount: 0,
                        images: [],
                        previewImages: []
                    });
                });
            } else {
                variantBlocks.push({
                    id: 'v_' + Math.random().toString(36).substr(2, 9),
                    size: sz,
                    color: '',
                    colorName: '',
                    pattern: '',
                    patternName: '',
                    showPatternText: false,
                    price: null,
                    hideDetailsGallery: false,
                    showInMainCarousel: false,
                    isActive: true,
                    trackStock: false,
                    stockCount: 0,
                    images: [],
                    previewImages: []
                });
            }
        });
    }

    renderImagePreviews('base'); 
    renderVariantBlocks();
    document.getElementById('prod-modal').style.display = 'flex'; 
}

function exportProducts() {
    if (typeof XLSX === 'undefined') {
        return showToast("Excel exporter is loading, please try again.");
    }
    
    const rows = products.map(p => ({
        "ID": p.id || "",
        "Name": p.name || "",
        "Price": p.price || 0,
        "Description": p.description || "",
        "Images": (p.images && Array.isArray(p.images)) ? p.images.join(', ') : "",
        "Sizes": (p.sizes && Array.isArray(p.sizes)) ? p.sizes.join(', ') : "",
        "Colors": (p.colors && Array.isArray(p.colors)) ? p.colors.join(', ') : "",
        "SizeColorMap": p.sizeColorMap ? JSON.stringify(p.sizeColorMap) : "{}"
    }));
    
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
    
    XLSX.writeFile(workbook, `swagstree_products_export_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast("Catalog exported to Excel successfully!");
}

function triggerImport() {
    const input = document.getElementById('import-file-input');
    if (input) input.click();
}

async function importProducts(input) {
    if (typeof XLSX === 'undefined') {
        return showToast("Excel parser is loading, please try again.");
    }
    
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const importedRows = XLSX.utils.sheet_to_json(worksheet);
            
            showToast(`Importing ${importedRows.length} products from Excel...`);
            
            let updatedCount = 0;
            let createdCount = 0;
            
            for (const row of importedRows) {
                const sizeColorMapStr = row.SizeColorMap || "{}";
                let sizeColorMapObj = {};
                try {
                    sizeColorMapObj = JSON.parse(sizeColorMapStr);
                } catch(e) {
                    console.warn("Invalid SizeColorMap JSON inside Excel row:", row.Name, e);
                }
                
                const cleanItem = {
                    name: row.Name || "Unnamed Product",
                    price: Number(row.Price) || 0,
                    description: row.Description || "",
                    images: row.Images ? String(row.Images).split(',').map(u => u.trim()).filter(u => u.length > 0) : [],
                    sizes: row.Sizes ? String(row.Sizes).split(',').map(s => s.trim()).filter(s => s.length > 0) : [],
                    colors: row.Colors ? String(row.Colors).split(',').map(c => c.trim()).filter(c => c.length > 0) : [],
                    sizeColorMap: sizeColorMapObj
                };
                
                const itemId = row.ID ? String(row.ID).trim() : null;
                if (itemId) {
                    const existing = products.find(p => p.id === itemId);
                    if (existing) {
                        await db.collection("products").doc(itemId).set(cleanItem, { merge: true });
                        updatedCount++;
                        continue;
                    }
                }
                
                // Otherwise, add as a new item
                await db.collection("products").add(cleanItem);
                createdCount++;
            }
            
            showToast(`Excel Import Success: ${updatedCount} updated, ${createdCount} created!`);
            input.value = ''; // Reset input element
        } catch (err) {
            console.error("Excel Import Error:", err);
            showToast("Import failed: invalid Excel file format");
        }
    };
    reader.readAsArrayBuffer(file);
}

// ── COD Settings ────────────────────────────────────────────────────────────

async function loadCodSettings() {
    try {
        const snap = await db.collection('settings').doc('cod').get();
        const val = snap.exists && typeof snap.data().minPayment === 'number'
            ? snap.data().minPayment
            : 100;
        const inp = document.getElementById('admin-cod-min-payment');
        if (inp) inp.value = val;
        if (typeof codMinPayment !== 'undefined') codMinPayment = val;
    } catch(e) {
        console.error('loadCodSettings error:', e);
    }
}

async function saveCodSettings() {
    const inp = document.getElementById('admin-cod-min-payment');
    if (!inp) return;
    const val = Number(inp.value);
    if (isNaN(val) || val < 0) return showToast('Enter a valid amount (0 or more)');
    try {
        await db.collection('settings').doc('cod').set({ minPayment: val }, { merge: true });
        if (typeof codMinPayment !== 'undefined') codMinPayment = val;
        showToast('COD minimum payment saved: \u20b9' + val);
    } catch(e) {
        console.error('saveCodSettings error:', e);
        showToast('Failed to save COD settings');
    }
}

// ── Global Max Quantity Settings ─────────────────────────────────────────────
async function loadMaxQtySettings() {
    try {
        const snap = await db.collection('settings').doc('cart').get();
        if (snap.exists && typeof snap.data().globalMaxQty !== 'undefined') {
            const val = snap.data().globalMaxQty;
            const inp = document.getElementById('admin-max-cart-qty');
            if (inp) inp.value = val;
            if (typeof globalMaxCartQty !== 'undefined') globalMaxCartQty = val;
        }
    } catch(e) {
        console.error('loadMaxQtySettings error:', e);
    }
}

window.saveMaxQtySettings = async function() {
    const inp = document.getElementById('admin-max-cart-qty');
    if (!inp) return;
    let val = parseInt(inp.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    inp.value = val;
    try {
        await db.collection('settings').doc('cart').set({ globalMaxQty: val }, { merge: true });
        if (typeof globalMaxCartQty !== 'undefined') globalMaxCartQty = val;
        showToast('Global max cart quantity saved: ' + val);
    } catch(e) {
        console.error('saveMaxQtySettings error:', e);
        showToast('Failed to save Max Qty settings');
    }
}

// ── Products & Orders Pagination Settings ─────────────────────────────────────
window.loadPaginationSettings = async function() {
    try {
        const snap = await db.collection('settings').doc('pagination').get();
        if (snap.exists) {
            const data = snap.data();
            
            // Products limit
            if (typeof data.limit !== 'undefined') {
                const val = data.limit;
                const inp = document.getElementById('admin-products-page-limit');
                if (inp) inp.value = val;
                if (typeof productsPageLimitSetting !== 'undefined') productsPageLimitSetting = val;
                if (typeof displayedProductsLimit !== 'undefined') displayedProductsLimit = val;
                if (typeof displayedWishlistLimit !== 'undefined') displayedWishlistLimit = val;
            }
            
            // Orders limit
            if (typeof data.ordersLimit !== 'undefined') {
                const val = data.ordersLimit;
                const inp = document.getElementById('admin-orders-page-limit');
                if (inp) inp.value = val;
                if (typeof ordersPageLimitSetting !== 'undefined') ordersPageLimitSetting = val;
                if (typeof displayedOrdersLimit !== 'undefined') displayedOrdersLimit = val;
            }
        }
    } catch(e) {
        console.error('loadPaginationSettings error:', e);
    }
}

window.savePaginationSettings = async function() {
    const inp = document.getElementById('admin-products-page-limit');
    const inpOrders = document.getElementById('admin-orders-page-limit');
    
    let val = 20;
    if (inp) {
        val = parseInt(inp.value, 10);
        if (isNaN(val) || val < 1) val = 20;
        inp.value = val;
    }
    
    let valOrders = 20;
    if (inpOrders) {
        valOrders = parseInt(inpOrders.value, 10);
        if (isNaN(valOrders) || valOrders < 1) valOrders = 20;
        inpOrders.value = valOrders;
    }
    
    try {
        const payload = { limit: val, ordersLimit: valOrders };
        await db.collection('settings').doc('pagination').set(payload, { merge: true });
        
        if (typeof productsPageLimitSetting !== 'undefined') productsPageLimitSetting = val;
        if (typeof displayedProductsLimit !== 'undefined') displayedProductsLimit = val;
        if (typeof displayedWishlistLimit !== 'undefined') displayedWishlistLimit = val;
        
        if (typeof ordersPageLimitSetting !== 'undefined') ordersPageLimitSetting = valOrders;
        if (typeof displayedOrdersLimit !== 'undefined') displayedOrdersLimit = valOrders;
        
        showToast('✅ Pagination settings saved successfully!');
        if (typeof renderStore === 'function') renderStore();
        if (typeof loadOrders === 'function') loadOrders();
    } catch(e) {
        console.error('savePaginationSettings error:', e);
        showToast('Failed to save pagination settings');
    }
}

// ── Promo Code Settings ─────────────────────────────────────────────────────
let adminPromoList = [];
let promoListInterval = null;

async function loadPromoSettings() {
    try {
        const snap = await db.collection('settings').doc('promos').get();
        if (snap.exists) {
            const list = snap.data().list || [];
            adminPromoList = list.map(p => {
                if (p.expiresAt && !p.endsAt) {
                    p.endsAt = p.expiresAt;
                }
                return p;
            });
        }
        renderAdminPromoList();
    } catch(e) {
        console.error('loadPromoSettings error:', e);
    }
}

let editingPromoIndex = null;

function renderAdminPromoList() {
    const listEl = document.getElementById('admin-promo-list');
    if (!listEl) return;
    
    if (promoListInterval) {
        clearInterval(promoListInterval);
        promoListInterval = null;
    }

    const now = Date.now();

    if (adminPromoList.length === 0) {
        listEl.innerHTML = '<div style="font-size:11px; color:#555;">No active promo codes.</div>';
        return;
    }
    
    listEl.innerHTML = adminPromoList.map((p, index) => {
        let scheduleText = '';
        if (p.startsAt || p.endsAt) {
            const startStr = p.startsAt ? new Date(p.startsAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Now';
            const endStr = p.endsAt ? new Date(p.endsAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Never';
            
            if (p.endsAt && now > p.endsAt) {
                scheduleText = `<span style="color:#ff4444; font-size:10px; margin-left:8px; font-weight:700;">[EXPIRED]</span>`;
            } else if (p.startsAt && now < p.startsAt) {
                scheduleText = `<span style="color:#f1c40f; font-size:10px; margin-left:8px;">[Scheduled: ${startStr} to ${endStr}]</span>`;
            } else {
                scheduleText = `<span style="color:#2ecc71; font-size:10px; margin-left:8px;">[Active until: ${endStr}]</span>`;
            }
        } else {
            scheduleText = `<span style="color:#666; font-size:10px; margin-left:8px;">[Always Active]</span>`;
        }

        if (editingPromoIndex === index) {
            // Helper to format timestamps back to datetime-local format (YYYY-MM-DDTHH:MM)
            const toDtLocal = (ts) => {
                if (!ts) return '';
                const d = new Date(ts);
                const pad = (n) => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            };

            return `
                <div style="display:flex; flex-direction:column; gap:10px; background:#1a1a1a; padding:12px; border-radius:12px; border:1px solid #333; width:100%;">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <input id="inline-promo-code-${index}" type="text" value="${p.code}" placeholder="Code" style="margin:0; flex:2; min-width:120px; font-size:12px; text-transform:uppercase;">
                        <div style="position:relative; flex:1; min-width:70px;">
                            <input id="inline-promo-discount-${index}" type="number" min="1" max="100" value="${p.discount}" placeholder="%" style="margin:0; padding-right:20px; font-size:12px; width:100%;">
                            <span style="position:absolute; right:8px; top:50%; transform:translateY(-50%); color:#aaa; font-size:12px; pointer-events:none;">%</span>
                        </div>
                    </div>
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <div style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:4px;">
                            <span style="font-size:11px; color:#aaa;">Active Time Range (Date & Time)</span>
                            <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
                                <div style="display:flex; align-items:center; gap:8px; width:100%;">
                                    <span style="font-size:10px; color:#888; width:35px;">From:</span>
                                    <input id="inline-promo-start-${index}" type="datetime-local" value="${toDtLocal(p.startsAt)}" onchange="this.blur()" style="margin:0; flex:1; font-size:11px; padding:6px; background:#222; border:1px solid #444; color:#fff; border-radius:8px;">
                                </div>
                                <div style="display:flex; align-items:center; gap:8px; width:100%;">
                                    <span style="font-size:10px; color:#888; width:35px;">To:</span>
                                    <input id="inline-promo-end-${index}" type="datetime-local" value="${toDtLocal(p.endsAt)}" onchange="this.blur()" style="margin:0; flex:1; font-size:11px; padding:6px; background:#222; border:1px solid #444; color:#fff; border-radius:8px;">
                                </div>
                            </div>
                        </div>
                        <div style="width:90px; display:flex; flex-direction:column; gap:4px;">
                            <span style="font-size:11px; color:#aaa;">Max Uses</span>
                            <input id="inline-promo-max-uses-${index}" type="number" min="1" placeholder="Unlimited" value="${p.maxUses || ''}" style="margin:0; font-size:11px; padding:6px; background:#222; border:1px solid #444; color:#fff; border-radius:8px; width:100%;">
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; align-items:center; justify-content:flex-end; margin-top:4px;">
                        <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px;" onclick="saveInlinePromoChanges(${index})">Save</button>
                        <button style="width:auto; padding:6px 12px; font-size:11px; background:none; border:1px solid #555; color:#aaa; border-radius:8px; cursor:pointer;" onclick="cancelInlineEdit()">Cancel</button>
                    </div>
                </div>
            `;
        }

        const usesText = p.maxUses 
            ? `<span style="color:#aaa; font-size:10px; margin-left:8px;">[Uses: ${p.usedCount || 0}/${p.maxUses}]</span>`
            : `<span style="color:#aaa; font-size:10px; margin-left:8px;">[Uses: ${p.usedCount || 0}]</span>`;

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:10px; border:1px dashed #444; flex-wrap:wrap; gap:10px;">
                <div>
                    <span style="color:var(--gold); font-weight:bold; font-size:13px; letter-spacing:1px;">${p.code}</span>
                    <span style="color:#aaa; font-size:11px; margin-left:8px;">${p.discount}% OFF</span>
                    ${usesText}
                    ${scheduleText}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <i class="fa fa-edit" style="color:var(--gold); font-size:12px; cursor:pointer; padding:5px;" onclick="editPromoCode(${index})" title="Edit Promo"></i>
                    <i class="fa fa-trash" style="color:#ff4444; font-size:12px; cursor:pointer; padding:5px;" onclick="removePromoCode(${index})" title="Delete Promo"></i>
                </div>
            </div>
        `;
    }).join('');

    const hasExpiring = adminPromoList.some(p => p.endsAt);
    if (hasExpiring) {
        promoListInterval = setInterval(() => {
            renderAdminPromoList();
        }, 30000);
    }
}

async function addPromoCode() {
    const codeInput = document.getElementById('admin-promo-code');
    const discInput = document.getElementById('admin-promo-discount');
    const startInp = document.getElementById('admin-promo-start');
    const endInp = document.getElementById('admin-promo-end');
    const maxUsesInp = document.getElementById('admin-promo-max-uses');
    
    const code = codeInput.value.trim().toUpperCase();
    const discount = Number(discInput.value);
    
    if (!code) return showToast('Enter a promo code');
    if (isNaN(discount) || discount < 1 || discount > 100) return showToast('Enter valid discount % (1-100)');
    
    // Check if it already exists
    if (adminPromoList.find(p => p.code === code)) {
        return showToast('Promo code already exists');
    }
    
    const newPromo = { code, discount, usedCount: 0 };
    
    const startsAtVal = startInp && startInp.value ? new Date(startInp.value).getTime() : null;
    const endsAtVal = endInp && endInp.value ? new Date(endInp.value).getTime() : null;
    const maxUsesVal = maxUsesInp && maxUsesInp.value ? parseInt(maxUsesInp.value, 10) : null;

    if (startsAtVal && endsAtVal && startsAtVal >= endsAtVal) {
        return showToast('Start time must be before end time');
    }

    if (startsAtVal) newPromo.startsAt = startsAtVal;
    if (endsAtVal) newPromo.endsAt = endsAtVal;
    if (maxUsesVal !== null && !isNaN(maxUsesVal)) {
        newPromo.maxUses = maxUsesVal;
    }
    
    adminPromoList.push(newPromo);
    await saveAdminPromoSettings();
    
    codeInput.value = '';
    discInput.value = '';
    if (startInp) startInp.value = '';
    if (endInp) endInp.value = '';
    if (maxUsesInp) maxUsesInp.value = '';
    showToast('Promo code added: ' + code);
}

async function removePromoCode(index) {
    if (index >= 0 && index < adminPromoList.length) {
        const removed = adminPromoList[index].code;
        adminPromoList.splice(index, 1);
        await saveAdminPromoSettings();
        showToast('Removed promo: ' + removed);
    }
}

async function saveAdminPromoSettings() {
    try {
        await db.collection('settings').doc('promos').set({ list: adminPromoList }, { merge: true });
        renderAdminPromoList();
        
        // Also update the global list in checkout.js if it's currently loaded in the same window
        if (typeof activePromosList !== 'undefined') {
            activePromosList = adminPromoList;
        }
    } catch(e) {
        console.error('saveAdminPromoSettings error:', e);
        showToast('Failed to save promo settings');
    }
}

window.editPromoCode = function(index) {
    editingPromoIndex = index;
    renderAdminPromoList();
}

window.cancelInlineEdit = function() {
    editingPromoIndex = null;
    renderAdminPromoList();
}

window.saveInlinePromoChanges = async function(index) {
    const p = adminPromoList[index];
    if (!p) return;
    
    const code = document.getElementById(`inline-promo-code-${index}`).value.trim().toUpperCase();
    const discount = Number(document.getElementById(`inline-promo-discount-${index}`).value);
    
    if (!code) return showToast('Enter a promo code');
    if (isNaN(discount) || discount < 1 || discount > 100) return showToast('Enter valid discount % (1-100)');
    
    const dup = adminPromoList.find((item, idx) => item.code === code && idx !== index);
    if (dup) {
        return showToast('Promo code already exists');
    }
    
    const startInp = document.getElementById(`inline-promo-start-${index}`);
    const endInp = document.getElementById(`inline-promo-end-${index}`);
    const maxUsesInp = document.getElementById(`inline-promo-max-uses-${index}`);
    
    const startsAtVal = startInp && startInp.value ? new Date(startInp.value).getTime() : null;
    const endsAtVal = endInp && endInp.value ? new Date(endInp.value).getTime() : null;
    const maxUsesVal = maxUsesInp && maxUsesInp.value ? parseInt(maxUsesInp.value, 10) : null;

    if (startsAtVal && endsAtVal && startsAtVal >= endsAtVal) {
        return showToast('Start time must be before end time');
    }

    p.code = code;
    p.discount = discount;
    
    if (startsAtVal) {
        p.startsAt = startsAtVal;
    } else {
        delete p.startsAt;
    }
    
    if (endsAtVal) {
        p.endsAt = endsAtVal;
    } else {
        delete p.endsAt;
    }

    if (maxUsesVal !== null && !isNaN(maxUsesVal)) {
        p.maxUses = maxUsesVal;
    } else {
        delete p.maxUses;
    }
    if (p.usedCount === undefined) {
        p.usedCount = 0;
    }
    
    editingPromoIndex = null;
    await saveAdminPromoSettings();
    showToast('Promo code updated: ' + code);
}

// Bind settings loaders to window for cross-script execution
window.loadCodSettings = loadCodSettings;
window.saveCodSettings = saveCodSettings;
window.loadMaxQtySettings = loadMaxQtySettings;
window.loadPromoSettings = loadPromoSettings;


async function loadTelegramSettings() {
    try {
        const snap = await db.collection('settings').doc('telegram').get();
        const container = document.getElementById('telegram-chat-ids-container');
        if (!container) return;
        container.innerHTML = '';
        
        let tokenVal = '';
        let chatIds = [];

        if (snap.exists) {
            const data = snap.data();
            tokenVal = data.token || '';
            if (Array.isArray(data.chatIds)) {
                chatIds = data.chatIds;
            } else if (data.chatId) {
                chatIds = [data.chatId];
            }
        }
        
        const tokenInp = document.getElementById('admin-telegram-token');
        if (tokenInp) tokenInp.value = tokenVal;

        if (chatIds.length === 0) {
            chatIds.push(''); // add at least one empty row
        }

        chatIds.forEach(id => {
            addTelegramChatIdInput(id);
        });
    } catch(e) {
        console.error('loadTelegramSettings error:', e);
    }
}
window.loadTelegramSettings = loadTelegramSettings;

window.addTelegramChatIdInput = function(value = '') {
    const container = document.getElementById('telegram-chat-ids-container');
    if (!container) return;
    
    const wrapper = document.createElement('div');
    wrapper.style = 'display:flex; gap:8px; align-items:center;';
    wrapper.className = 'telegram-chatid-row';
    wrapper.innerHTML = `
        <input type="text" class="telegram-chatid-input" placeholder="e.g. 9654414891" value="${value}" style="margin:0; flex:1; font-size:12px;">
        <button class="btn-gold" style="width:auto; padding:8px 12px; background:var(--red); border:none; color:#fff; font-size:14px; line-height:1; font-weight:bold; margin:0;" onclick="const row = this.parentNode; if (row.classList.contains('marked-deleted')) { row.classList.remove('marked-deleted'); row.style.opacity = '1'; this.innerText = '-'; this.style.background = 'var(--red)'; } else { row.classList.add('marked-deleted'); row.style.opacity = '0.35'; this.innerText = '↺'; this.style.background = '#333'; }">-</button>
    `;
    container.appendChild(wrapper);
};

async function saveTelegramSettings() {
    const tokenInp = document.getElementById('admin-telegram-token');
    if (!tokenInp) return;
    
    const token = tokenInp.value.trim();
    const rows = document.querySelectorAll('.telegram-chatid-row');
    const chatIds = [];
    
    rows.forEach(row => {
        if (!row.classList.contains('marked-deleted')) {
            const el = row.querySelector('.telegram-chatid-input');
            const val = el ? el.value.trim() : '';
            if (val) chatIds.push(val);
        }
    });

    try {
        await db.collection('settings').doc('telegram').set({ token, chatIds, chatId: chatIds[0] || '' }, { merge: true });
        
        // Physically clean up the marked rows from UI since they are saved/persisted now
        document.querySelectorAll('.telegram-chatid-row.marked-deleted').forEach(el => el.remove());
        
        showToast('✅ Telegram settings saved successfully!');
    } catch(e) {
        console.error('saveTelegramSettings error:', e);
        showToast('Failed to save Telegram settings');
    }
}
window.saveTelegramSettings = saveTelegramSettings;

async function deleteAllProducts() {
    if (!confirm("Are you absolutely sure you want to delete ALL products from the catalog? This action cannot be undone.")) {
        return;
    }
    const doubleCheck = prompt("Type 'DELETE ALL' to confirm deletion of all products:");
    if (doubleCheck !== "DELETE ALL") {
        showToast("Deletion cancelled. Confirmation text did not match.");
        return;
    }

    try {
        showToast("Deleting all products...");
        const snapshot = await db.collection('products').get();
        if (snapshot.empty) {
            showToast("No products found to delete.");
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        showToast("All products deleted successfully!");
        if (typeof renderAdmin === "function") renderAdmin();
    } catch (error) {
        console.error("Error deleting all products:", error);
        showToast("Error deleting products: " + error.message);
    }
}
window.deleteAllProducts = deleteAllProducts;

// --- Feedback / Testimonials / Instagram Diaries Admin panel ---
let feedbackFiles = [];

// Unified preview rendering function
function renderFeedbackFormPreviews() {
    const previewContainer = document.getElementById('admin-fb-img-preview-container');
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    
    const manualUrlsVal = document.getElementById('admin-fb-image-urls').value.trim();
    let customImages = manualUrlsVal 
        ? manualUrlsVal.split(',').map(url => {
            url = url.trim();
            if (url.includes('github.com') && url.includes('/blob/')) {
                return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
            }
            return url;
        }).filter(url => url) 
        : [];
    
    // Auto-extract Instagram post images if links are available
    let postImgUrls = [];
    const platformVal = document.getElementById('admin-fb-platform').value;
    const linkInputs = document.querySelectorAll('.diaries-link-input');
    const links = Array.from(linkInputs).map(inp => {
        let url = inp.value.trim();
        if (url.includes('facebook.com') && url.includes('fbid=')) {
            try {
                const searchStr = url.split('?')[1];
                if (searchStr) {
                    const urlParams = new URLSearchParams(searchStr);
                    const fbid = urlParams.get('fbid');
                    if (fbid) {
                        return `https://www.facebook.com/photo.php?fbid=${fbid}`;
                    }
                }
            } catch (e) {}
        }
        return url;
    }).filter(url => url);
    
    if (platformVal === 'instagram') {
        links.forEach(link => {
            if (link.includes('instagram.com')) {
                const match = link.match(/(?:instagram\.com)\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#&]+)/i);
                if (match && match[1]) {
                    postImgUrls.push(`https://www.instagram.com/p/${match[1]}/media/?size=l`);
                }
            }
        });
    }
    
    const imgPosition = document.getElementById('admin-fb-img-position').value;
    
    // 1. Get manual/custom URLs
    let customUrlItems = customImages.map(url => ({ type: 'url', url: url }));
    
    // 2. Get local file items
    let fileItems = feedbackFiles.map((file, idx) => ({ type: 'file', file: file, index: idx }));
    
    // 3. Combine custom images
    let customItems = [...customUrlItems, ...fileItems];
    
    // 4. Get post image items
    let postItems = postImgUrls.map(url => ({ type: 'post', url: url }));
    
    // 5. Sequence them
    let previewItems = [];
    if (imgPosition === 'first') {
        previewItems = [...postItems, ...customItems];
    } else {
        previewItems = [...customItems, ...postItems];
    }
    
    if (previewItems.length > 0) {
        previewContainer.style.display = 'flex';
        previewContainer.style.flexWrap = 'wrap';
        previewContainer.style.gap = '8px';
        previewContainer.style.justifyContent = 'center';
        
        previewItems.forEach((item) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';
            
            const img = document.createElement('img');
            img.style.maxHeight = '60px';
            img.style.borderRadius = '6px';
            img.style.border = '1px solid #444';
            
            if (item.type === 'url' || item.type === 'post') {
                img.src = item.url;
                img.referrerPolicy = "no-referrer";
                
                if (item.type === 'post') {
                    // Add onerror handler to show a placeholder block instead of a broken image icon
                    img.onerror = () => {
                        const match = item.url.match(/(?:instagram\.com)\/(?:p|reel|tv)\/([^/?#&]+)/i);
                        const postId = match ? match[1] : 'Post';
                        wrapper.innerHTML = `
                            <div style="width:60px; height:60px; border-radius:6px; border:1px solid #444; background:#222; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#E1306C; font-size:9px; font-weight:bold; cursor:pointer;" onclick="window.open('${item.url.replace('/media/?size=l', '')}', '_blank')" title="Click to view Instagram post">
                                <i class="fab fa-instagram" style="font-size:18px; margin-bottom:2px;"></i>
                                <span style="max-width:55px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${postId}</span>
                            </div>
                        `;
                    };
                }
                
                wrapper.appendChild(img);
                
                if (item.type === 'url') {
                    const removeBtn = document.createElement('span');
                    removeBtn.innerHTML = '&times;';
                    removeBtn.style = 'position:absolute; top:-4px; right:-4px; background:rgba(255,0,0,0.85); color:#fff; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; font-weight:bold; z-index:5;';
                    removeBtn.onclick = () => {
                        const customIdx = customImages.indexOf(item.url);
                        if (customIdx > -1) {
                            customImages.splice(customIdx, 1);
                            document.getElementById('admin-fb-image-urls').value = customImages.join(', ');
                        }
                        renderFeedbackFormPreviews(); // Re-render
                    };
                    wrapper.appendChild(removeBtn);
                }
            } else if (item.type === 'file') {
                const reader = new FileReader();
                reader.onload = function(e) {
                    img.src = e.target.result;
                }
                reader.readAsDataURL(item.file);
                
                wrapper.appendChild(img);
                
                const removeBtn = document.createElement('span');
                removeBtn.innerHTML = '&times;';
                removeBtn.style = 'position:absolute; top:-4px; right:-4px; background:rgba(255,0,0,0.85); color:#fff; border-radius:50%; width:16px; height:16px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:11px; font-weight:bold; z-index:5;';
                removeBtn.onclick = () => {
                    feedbackFiles.splice(item.index, 1);
                    document.getElementById('admin-fb-filename').innerText = feedbackFiles.length > 0 ? `${feedbackFiles.length} image(s) selected` : 'No image selected';
                    renderFeedbackFormPreviews(); // Re-render
                };
                wrapper.appendChild(removeBtn);
            }
            
            previewContainer.appendChild(wrapper);
        });
        
        document.getElementById('admin-fb-filename').innerText = `${previewItems.length} image(s) configured`;
    } else {
        previewContainer.style.display = 'none';
        document.getElementById('admin-fb-filename').innerText = 'No image selected';
    }
}
window.renderFeedbackFormPreviews = renderFeedbackFormPreviews;

function handleFeedbackFileSelect(input) {
    if (input.files && input.files.length > 0) {
        feedbackFiles = Array.from(input.files);
        renderFeedbackFormPreviews();
    }
}
window.handleFeedbackFileSelect = handleFeedbackFileSelect;

let editingFeedbackId = null;

async function addFeedbackItem() {
    const username = document.getElementById('admin-fb-username').value.trim();
    const text = document.getElementById('admin-fb-text').value.trim();
    const platform = document.getElementById('admin-fb-platform').value;
    
    const linkInputs = document.querySelectorAll('.diaries-link-input');
    const links = Array.from(linkInputs).map(inp => inp.value.trim()).filter(url => url);
    const link = links.join(',');
    
    const manualUrlsVal = document.getElementById('admin-fb-image-urls').value.trim();
    const showMultiple = document.getElementById('admin-fb-show-multiple').checked;
    const imgPosition = document.getElementById('admin-fb-img-position').value;
    const addBtn = document.getElementById('admin-fb-add-btn');

    if (!username) {
        showToast("Please enter a username or handle");
        return;
    }
    
    // Parse manual URLs
    let imageUrls = manualUrlsVal ? manualUrlsVal.split(',').map(url => url.trim()).filter(url => url) : [];

    if (!text && feedbackFiles.length === 0 && imageUrls.length === 0 && !link && !editingFeedbackId) {
        showToast("Please enter feedback text, image URLs, post URL, or add at least one image file");
        return;
    }

    addBtn.disabled = true;
    addBtn.innerText = editingFeedbackId ? "Updating..." : "Submitting...";

    try {
        if (editingFeedbackId) {
            const updateData = {
                username,
                text,
                platform,
                link,
                showMultiple,
                imgPosition
            };

            if (feedbackFiles.length > 0) {
                showToast(`Uploading ${feedbackFiles.length} image(s)...`);
                const uploadedUrls = await Promise.all(feedbackFiles.map(file => uploadToCloudinary(file)));
                imageUrls = imageUrls.concat(uploadedUrls);
            }
            
            updateData.imageUrl = imageUrls[0] || '';
            updateData.imageUrls = imageUrls;

            await db.collection("feedbacks").doc(editingFeedbackId).update(updateData);
            showToast("Feedback updated successfully!");
        } else {
            if (feedbackFiles.length > 0) {
                showToast(`Uploading ${feedbackFiles.length} image(s)...`);
                const uploadedUrls = await Promise.all(feedbackFiles.map(file => uploadToCloudinary(file)));
                imageUrls = imageUrls.concat(uploadedUrls);
            }

            const mainImageUrl = imageUrls.length > 0 ? imageUrls[0] : '';

            await db.collection("feedbacks").add({
                username,
                text,
                platform,
                link,
                imageUrl: mainImageUrl,
                imageUrls: imageUrls,
                active: true,
                showMultiple,
                imgPosition,
                timestamp: Date.now()
            });

            showToast("Feedback added successfully!");
        }
        
        cancelFeedbackEdit();

    } catch (e) {
        console.error("Error saving feedback:", e);
        showToast("Error saving feedback: " + e.message);
    } finally {
        addBtn.disabled = false;
        addBtn.innerText = editingFeedbackId ? "Update" : "Submit";
    }
}
window.addFeedbackItem = addFeedbackItem;

function editFeedbackItem(id) {
    const f = (window.feedbacks || []).find(x => x.id === id);
    if (!f) return;

    editingFeedbackId = id;
    
    document.getElementById('admin-fb-username').value = f.username || '';
    document.getElementById('admin-fb-text').value = f.text || '';
    document.getElementById('admin-fb-platform').value = f.platform || 'instagram';
    document.getElementById('admin-fb-show-multiple').checked = !!f.showMultiple;
    document.getElementById('admin-fb-img-position').value = f.imgPosition || 'first';
    
    let images = f.imageUrls || (f.imageUrl ? [f.imageUrl] : []);
    document.getElementById('admin-fb-image-urls').value = images.join(', ');
    
    const linkContainer = document.getElementById('diaries-links-container');
    if (linkContainer) {
        linkContainer.innerHTML = '';
        const allLinks = f.link ? f.link.split(',').map(url => url.trim()).filter(url => url) : [];
        if (allLinks.length > 0) {
            allLinks.forEach(lnk => addDiariesLinkInput(lnk));
        } else {
            addDiariesLinkInput('');
        }
    }
    
    renderFeedbackFormPreviews();
    
    document.getElementById('admin-fb-add-btn').innerText = 'Update';
    
    let cancelBtn = document.getElementById('admin-fb-cancel-btn');
    if (!cancelBtn) {
        cancelBtn = document.createElement('button');
        cancelBtn.id = 'admin-fb-cancel-btn';
        cancelBtn.className = 'btn-gold';
        cancelBtn.style = 'width:auto; padding:10px 15px; font-size:12px; margin-right:10px; background:#222; border:1px solid #444; color:#fff;';
        cancelBtn.innerText = 'Cancel';
        cancelBtn.onclick = cancelFeedbackEdit;
        const addBtn = document.getElementById('admin-fb-add-btn');
        const actionGroup = document.getElementById('admin-fb-action-btn-group') || addBtn.parentNode;
        actionGroup.insertBefore(cancelBtn, addBtn);
    }
    
    document.getElementById('admin-feedback-settings').scrollIntoView({ behavior: 'smooth' });
}
window.editFeedbackItem = editFeedbackItem;

function cancelFeedbackEdit() {
    editingFeedbackId = null;
    
    document.getElementById('admin-fb-username').value = '';
    document.getElementById('admin-fb-text').value = '';
    document.getElementById('admin-fb-image-urls').value = '';
    document.getElementById('admin-fb-file').value = '';
    document.getElementById('admin-fb-filename').innerText = 'No image selected';
    document.getElementById('admin-fb-show-multiple').checked = false;
    document.getElementById('admin-fb-img-position').value = 'first';
    
    const linkContainer = document.getElementById('diaries-links-container');
    if (linkContainer) {
        linkContainer.innerHTML = '';
        addDiariesLinkInput('');
    }
    
    const previewContainer = document.getElementById('admin-fb-img-preview-container');
    if (previewContainer) {
        previewContainer.style.display = 'none';
        previewContainer.innerHTML = '';
    }
    
    document.getElementById('admin-fb-add-btn').innerText = 'Submit';
    
    const cancelBtn = document.getElementById('admin-fb-cancel-btn');
    if (cancelBtn) cancelBtn.remove();
    
    feedbackFiles = [];
}
window.cancelFeedbackEdit = cancelFeedbackEdit;

function renderAdminFeedbackList() {
    const container = document.getElementById('admin-feedback-list');
    if (!container) return;
    
    const linkContainer = document.getElementById('diaries-links-container');
    if (linkContainer && linkContainer.children.length === 0) {
        addDiariesLinkInput('');
    }

    const list = window.feedbacks || [];
    if (list.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#666; font-size:11px; margin: 10px 0;">No testimonials or posts added yet.</p>`;
        return;
    }

    container.innerHTML = list.map(f => {
        const platformLabel = f.platform === 'instagram' ? 'Instagram' : (f.platform === 'facebook' ? 'Facebook' : 'Testimonial');
        const activeLabel = (f.active !== false && f.active !== 'false')
            ? '<span style="font-size:8px; background:rgba(0,255,0,0.1); color:#00ff00; border:1px solid rgba(0,255,0,0.2); padding:1px 4px; border-radius:4px; font-weight:bold;">ACTIVE</span>' 
            : '<span style="font-size:8px; background:rgba(255,0,0,0.1); color:#ff0000; border:1px solid rgba(255,0,0,0.2); padding:1px 4px; border-radius:4px; font-weight:bold;">HIDDEN</span>';
            
        let customImages = (f.imageUrls || (f.imageUrl ? [f.imageUrl] : []))
            .filter(url => url && url.trim() !== '')
            .filter(url => {
                if (url.includes('instagram.com') && !url.includes('/media')) return false;
                if (url.includes('facebook.com') && !url.includes('fbcdn')) return false;
                return true;
            });
        
        let postImgUrl = '';
        if (f.link && f.link.includes('instagram.com') && (f.link.includes('/p/') || f.link.includes('/reel/') || f.link.includes('/tv/'))) {
            const match = f.link.match(/(?:instagram\.com)\/(?:[^/]+\/)?(?:p|reel|tv)\/([^/?#&]+)/i);
            if (match && match[1]) {
                postImgUrl = `https://www.instagram.com/p/${match[1]}/media/?size=l`;
            }
        }
        
        const position = f.imgPosition || 'first';
        let images = [...customImages];
        if (postImgUrl) {
            if (position === 'first') {
                images.unshift(postImgUrl);
            } else if (position === 'last') {
                images.push(postImgUrl);
            }
        }

        const imgHtml = images.length > 0 ? `<img src="${images[0]}" referrerpolicy="no-referrer" style="width:30px; height:30px; object-fit:cover; border-radius:4px; border:1px solid #333;">` : '';
        const countBadge = images.length > 1 ? `<span style="font-size:8px; background:#444; color:#fff; padding:1px 3px; border-radius:3px; position:absolute; bottom:0; right:0;">${images.length}</span>` : '';
        
        const isActive = f.active !== false && f.active !== 'false';
        const toggleIcon = isActive 
            ? `<i class="fa fa-eye" style="color:#00ff00; cursor:pointer; font-size:12px; padding:5px; margin-right:5px;" onclick="toggleFeedbackActiveStatus('${f.id}', true)" title="Hide feedback"></i>` 
            : `<i class="fa fa-eye-slash" style="color:#888; cursor:pointer; font-size:12px; padding:5px; margin-right:5px;" onclick="toggleFeedbackActiveStatus('${f.id}', false)" title="Show/Activate feedback"></i>`;

        return `
        <div style="display:flex; align-items:center; gap:10px; background:#1a1a1a; padding:10px; border-radius:10px; border:1px solid #333;">
            <div style="position:relative; width:30px; height:30px; flex-shrink:0;">
                ${imgHtml}
                ${countBadge}
            </div>
            <div style="flex:1; min-width:0;">
                <div style="font-size:11px; font-weight:bold; color:#fff; display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span>${f.username}</span>
                    <span style="font-size:8px; background:#333; color:var(--gold); padding:1px 4px; border-radius:4px; text-transform:uppercase;">${platformLabel}</span>
                    ${activeLabel}
                </div>
                <div style="font-size:10px; color:#aaa; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-top:2px;">${f.text || '(No text)'}</div>
            </div>
            <div style="display:flex; align-items:center;">
                ${toggleIcon}
                <i class="fa fa-edit" style="color:var(--gold); cursor:pointer; font-size:12px; padding:5px; margin-right:5px;" onclick="editFeedbackItem('${f.id}')" title="Edit feedback"></i>
                <i class="fa fa-trash" style="color:var(--red); cursor:pointer; font-size:12px; padding:5px;" onclick="deleteFeedbackItem('${f.id}')" title="Delete feedback"></i>
            </div>
        </div>
        `;
    }).join('');
}
window.renderAdminFeedbackList = renderAdminFeedbackList;

async function toggleFeedbackActiveStatus(id, currentStatus) {
    try {
        await db.collection("feedbacks").doc(id).update({ active: !currentStatus });
        showToast("Feedback status updated!");
    } catch (e) {
        showToast("Error updating status: " + e.message);
    }
}
window.toggleFeedbackActiveStatus = toggleFeedbackActiveStatus;

async function deleteFeedbackItem(id) {
    if (!confirm("Are you sure you want to delete this customer feedback/post?")) return;
    try {
        await db.collection("feedbacks").doc(id).delete();
        if (editingFeedbackId === id) cancelFeedbackEdit();
        showToast("Feedback deleted successfully");
    } catch (e) {
        showToast("Error deleting feedback: " + e.message);
    }
}
window.deleteFeedbackItem = deleteFeedbackItem;

async function loadEmailSettings() {
    try {
        const snap = await db.collection('settings').doc('email').get();
        if (snap.exists && snap.data().brevoKey) {
            const el = document.getElementById('admin-brevo-key');
            if (el) el.value = snap.data().brevoKey;
        }
    } catch(e) {
        console.error("loadEmailSettings error:", e);
    }
}
async function saveEmailSettings() {
    const key = document.getElementById('admin-brevo-key').value.trim();
    const confirmMsg = key 
        ? "Are you sure you want to update the Brevo API Key? This will change the email sender configuration." 
        : "Are you sure you want to remove the Brevo API Key? This will disable order email notifications.";
        
    if (!confirm(confirmMsg)) return;

    try {
        await db.collection('settings').doc('email').set({ brevoKey: key }, { merge: true });
        showToast("Email settings saved successfully!");
    } catch(e) {
        console.error("saveEmailSettings error:", e);
        showToast("Failed to save email settings");
    }
}
window.loadEmailSettings = loadEmailSettings;
window.saveEmailSettings = saveEmailSettings;

// ── Diaries Placement Settings ──
async function loadFeedbackPlacementSettings() {
    try {
        const snap = await db.collection('settings').doc('diaries').get();
        const showSection = snap.exists ? (snap.data().showSection !== false) : true;
        const placement = snap.exists ? (snap.data().placement || 'last') : 'last';
        const nValue = snap.exists ? (snap.data().n || 6) : 6;
        const titleVal = snap.exists ? (snap.data().sectionTitle || '') : '';
        const subtitleVal = snap.exists ? (snap.data().sectionSubtitle || '') : '';
        
        const showEl = document.getElementById('admin-fb-show-section');
        if (showEl) showEl.checked = showSection;
        
        const selectEl = document.getElementById('admin-fb-placement');
        if (selectEl) selectEl.value = placement;
        
        const valEl = document.getElementById('admin-fb-n-value');
        if (valEl) valEl.value = nValue;
        
        const titleEl = document.getElementById('admin-fb-section-title');
        if (titleEl) titleEl.value = titleVal;
        
        const subtitleEl = document.getElementById('admin-fb-section-subtitle');
        if (subtitleEl) subtitleEl.value = subtitleVal;
        
        toggleFeedbackPlacementInputs();
    } catch(e) {
        console.error('loadFeedbackPlacementSettings error:', e);
    }
}
window.loadFeedbackPlacementSettings = loadFeedbackPlacementSettings;

window.toggleFeedbackPlacementInputs = function() {
    const showEl = document.getElementById('admin-fb-show-section');
    const controls = document.getElementById('admin-fb-placement-controls');
    const selectEl = document.getElementById('admin-fb-placement');
    const container = document.getElementById('admin-fb-n-container');
    
    const showSection = showEl ? showEl.checked : true;
    if (controls) {
        controls.style.display = showSection ? 'flex' : 'none';
    }
    if (selectEl && container) {
        container.style.display = (showSection && selectEl.value === 'custom') ? 'flex' : 'none';
    }
}

async function saveFeedbackPlacementSettings() {
    const showEl = document.getElementById('admin-fb-show-section');
    const selectEl = document.getElementById('admin-fb-placement');
    const valEl = document.getElementById('admin-fb-n-value');
    const titleEl = document.getElementById('admin-fb-section-title');
    const subtitleEl = document.getElementById('admin-fb-section-subtitle');
    if (!selectEl || !valEl) return;
    
    const showSection = showEl ? showEl.checked : true;
    const placement = selectEl.value;
    const n = parseInt(valEl.value, 10) || 6;
    const sectionTitle = titleEl ? titleEl.value.trim() : '';
    const sectionSubtitle = subtitleEl ? subtitleEl.value.trim() : '';
    
    try {
        await db.collection('settings').doc('diaries').set({ showSection, placement, n, sectionTitle, sectionSubtitle }, { merge: true });
        showToast('✅ Diaries settings saved!');
    } catch(e) {
        console.error('saveFeedbackPlacementSettings error:', e);
        showToast('Failed to save placement settings');
    }
}
window.saveFeedbackPlacementSettings = saveFeedbackPlacementSettings;

window.addDiariesLinkInput = function(value = '') {
    const container = document.getElementById('diaries-links-container');
    if (!container) return;
    
    const wrapper = document.createElement('div');
    wrapper.style = 'display:flex; gap:8px; align-items:center;';
    wrapper.className = 'diaries-link-row';
    
    wrapper.innerHTML = `
        <input type="text" class="diaries-link-input" placeholder="e.g. https://www.instagram.com/p/..." value="${value}" style="margin:0; flex:1; font-size:12px;" oninput="renderFeedbackFormPreviews()">
        <button class="btn-gold" style="width:auto; padding:10px 14px; font-size:12px; margin:0; background:#ff4757; color:#fff;" onclick="this.parentNode.remove(); renderFeedbackFormPreviews();">-</button>
    `;
    container.appendChild(wrapper);
    renderFeedbackFormPreviews();
};

// ── Admin Footer Settings ──
async function loadAdminFooterSettings() {
    try {
        const snap = await db.collection('settings').doc('footer').get();
        const settings = snap.exists ? snap.data() : {
            showFooter: false,
            showCopyright: true,
            copyright: "Swagstree",
            aboutText: `<h3>Who We Are</h3><p>Established in 2018, Swag Stree has grown into a premier fashion brand dedicated to delivering trendsetting, high-quality, and comfortable apparel directly to your doorstep. We merge modern styles with premium craftsmanship to create garments that make you look and feel confident.</p><h3>Our Commitment</h3><p>We are driven by three core pillars:</p><ul><li><b>Premium Fabrics:</b> Handpicked materials for maximum durability and comfort.</li><li><b>Exquisite Tailoring:</b> Designed for perfect fits and elegant silhouettes.</li><li><b>Customer First:</b> Quick delivery, seamless returns, and dedicated support.</li></ul>`,
            showGps: true,
            gpsLat: "28.6139",
            gpsLng: "77.2090",
            gpsQuery: "Swag Stree, Delhi",
            contactPhone: "8800467686",
            contactAddress: "Shop No. 12, Swag Stree, Delhi",
            privacyText: `<h3>Privacy Policy & Order Processing</h3><p>At Swag Stree, we value the trust you place in us and are fully committed to protecting your personal information. Below, we explain our data practices and how your order is processed through each status update.</p><h3>1. Information We Collect</h3><p>When you place an order or interact with our app, we collect relevant information to process transactions, including:</p><ul><li>Contact details (Name, phone number, email address).</li><li>Delivery and billing address details.</li></ul><h3>2. Order Status Walkthrough</h3><p>To keep you informed at every stage of your purchase, your order progresses through these standard phases:</p><ul><li><b>Pending:</b> Your order has been successfully placed and is awaiting verification by our team.</li><li><b>Confirmed:</b> The payment/order details have been verified, and we are preparing your items for packaging.</li><li><b>Shipped:</b> Your package has been handed over to our courier partner. Tracking details will be shared via WhatsApp/SMS.</li><li><b>Delivered:</b> Your order has been successfully delivered to your specified shipping address.</li><li><b>Cancelled:</b> The order was cancelled by either the customer or our system due to stock limitations or payment issues.</li></ul><h3>3. Data Security & Storage</h3><p>Your session details, account credentials, and transactions are fully secured. We use Google Firebase for secure user authentication, password hashing, and token encryption. We strictly share shipping info with authorized delivery partners only.</p>`
        };
        
        // Auto-upgrade simple placeholders to premium templates
        const premiumAbout = `<h3>Who We Are</h3><p>Established in 2018, Swag Stree has grown into a premier fashion brand dedicated to delivering trendsetting, high-quality, and comfortable apparel directly to your doorstep. We merge modern styles with premium craftsmanship to create garments that make you look and feel confident.</p><h3>Our Commitment</h3><p>We are driven by three core pillars:</p><ul><li><b>Premium Fabrics:</b> Handpicked materials for maximum durability and comfort.</li><li><b>Exquisite Tailoring:</b> Designed for perfect fits and elegant silhouettes.</li><li><b>Customer First:</b> Quick delivery, seamless returns, and dedicated support.</li></ul>`;
        const premiumPrivacy = `<h3>Privacy Policy & Order Processing</h3><p>At Swag Stree, we value the trust you place in us and are fully committed to protecting your personal information. Below, we explain our data practices and how your order is processed through each status update.</p><h3>1. Information We Collect</h3><p>When you place an order or interact with our app, we collect relevant information to process transactions, including:</p><ul><li>Contact details (Name, phone number, email address).</li><li>Delivery and billing address details.</li></ul><h3>2. Order Status Walkthrough</h3><p>To keep you informed at every stage of your purchase, your order progresses through these standard phases:</p><ul><li><b>Pending:</b> Your order has been successfully placed and is awaiting verification by our team.</li><li><b>Confirmed:</b> The payment/order details have been verified, and we are preparing your items for packaging.</li><li><b>Shipped:</b> Your package has been handed over to our courier partner. Tracking details will be shared via WhatsApp/SMS.</li><li><b>Delivered:</b> Your order has been successfully delivered to your specified shipping address.</li><li><b>Cancelled:</b> The order was cancelled by either the customer or our system due to stock limitations or payment issues.</li></ul><h3>3. Data Security & Storage</h3><p>Your session details, account credentials, and transactions are fully secured. We use Google Firebase for secure user authentication, password hashing, and token encryption. We strictly share shipping info with authorized delivery partners only.</p>`;
        
        if (!settings.aboutText || !settings.aboutText.includes('2018')) {
            settings.aboutText = premiumAbout;
        }
        if (!settings.privacyText || !settings.privacyText.includes('Pending') || !settings.privacyText.includes('Confirmed') || !settings.privacyText.includes('Shipped')) {
            settings.privacyText = premiumPrivacy;
        }
        
        const showFooterEl = document.getElementById('admin-footer-show-footer');
        const showCopyrightEl = document.getElementById('admin-footer-show-copyright');
        const copyrightEl = document.getElementById('admin-footer-copyright');
        const aboutTextEl = document.getElementById('admin-footer-about-text');
        const addressEl = document.getElementById('admin-footer-address');
        const showGpsEl = document.getElementById('admin-footer-show-gps');
        const gpsLatEl = document.getElementById('admin-footer-gps-lat');
        const gpsLngEl = document.getElementById('admin-footer-gps-lng');
        const gpsQueryEl = document.getElementById('admin-footer-gps-query');
        const phoneEl = document.getElementById('admin-footer-phone');
        const privacyEl = document.getElementById('admin-footer-privacy-text');
        
        if (showFooterEl) showFooterEl.checked = !!settings.showFooter;
        if (showCopyrightEl) showCopyrightEl.checked = settings.showCopyright !== false;
        if (copyrightEl) copyrightEl.value = settings.copyright || '';
        
        if (aboutTextEl) {
            if (aboutTextEl.tagName === 'DIV') aboutTextEl.innerHTML = settings.aboutText || '';
            else aboutTextEl.value = settings.aboutText || '';
        }
        if (addressEl) addressEl.value = settings.contactAddress || '';
        
        if (showGpsEl) {
            showGpsEl.checked = !!settings.showGps;
            const gpsRow = document.getElementById('admin-footer-gps-row');
            if (gpsRow) gpsRow.style.display = settings.showGps ? 'flex' : 'none';
        }
        if (gpsLatEl) gpsLatEl.value = settings.gpsLat || '';
        if (gpsLngEl) gpsLngEl.value = settings.gpsLng || '';
        if (gpsQueryEl) gpsQueryEl.value = settings.gpsQuery || '';
        if (phoneEl) phoneEl.value = settings.contactPhone || '8800467686';
        
        if (privacyEl) {
            if (privacyEl.tagName === 'DIV') privacyEl.innerHTML = settings.privacyText || '';
            else privacyEl.value = settings.privacyText || '';
        }
    } catch (e) {
        console.error('loadAdminFooterSettings error:', e);
    }
}
window.loadAdminFooterSettings = loadAdminFooterSettings;

async function saveAdminFooterSettings() {
    const showFooterEl = document.getElementById('admin-footer-show-footer');
    const showCopyrightEl = document.getElementById('admin-footer-show-copyright');
    const copyrightEl = document.getElementById('admin-footer-copyright');
    const aboutTextEl = document.getElementById('admin-footer-about-text');
    const addressEl = document.getElementById('admin-footer-address');
    const showGpsEl = document.getElementById('admin-footer-show-gps');
    const gpsLatEl = document.getElementById('admin-footer-gps-lat');
    const gpsLngEl = document.getElementById('admin-footer-gps-lng');
    const gpsQueryEl = document.getElementById('admin-footer-gps-query');
    const phoneEl = document.getElementById('admin-footer-phone');
    const privacyEl = document.getElementById('admin-footer-privacy-text');
    
    const settings = {
        showFooter: showFooterEl ? showFooterEl.checked : true,
        showCopyright: showCopyrightEl ? showCopyrightEl.checked : true,
        copyright: copyrightEl ? copyrightEl.value.trim() : "Swagstree",
        aboutText: aboutTextEl ? (aboutTextEl.tagName === 'DIV' ? aboutTextEl.innerHTML.trim() : aboutTextEl.value.trim()) : "",
        contactAddress: addressEl ? addressEl.value.trim() : "",
        showGps: showGpsEl ? showGpsEl.checked : false,
        gpsLat: gpsLatEl ? gpsLatEl.value.trim() : "",
        gpsLng: gpsLngEl ? gpsLngEl.value.trim() : "",
        gpsQuery: gpsQueryEl ? gpsQueryEl.value.trim() : "",
        contactPhone: phoneEl ? phoneEl.value.trim() : "8800467686",
        privacyText: privacyEl ? (privacyEl.tagName === 'DIV' ? privacyEl.innerHTML.trim() : privacyEl.value.trim()) : ""
    };
    
    try {
        await db.collection('settings').doc('footer').set(settings, { merge: true });
        showToast('✅ Footer settings saved successfully!');
        if (typeof renderFooter === 'function') renderFooter();
    } catch(e) {
        console.error('saveAdminFooterSettings error:', e);
        showToast('Failed to save footer settings');
    }
}
window.saveAdminFooterSettings = saveAdminFooterSettings;

window.useCurrentLocation = function() {
    if (!navigator.geolocation) {
        showToast("❌ Geolocation is not supported by your browser");
        return;
    }
    showToast("Detecting location...");
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude.toFixed(6);
            const lng = position.coords.longitude.toFixed(6);
            const latInp = document.getElementById('admin-footer-gps-lat');
            const lngInp = document.getElementById('admin-footer-gps-lng');
            if (latInp) latInp.value = lat;
            if (lngInp) lngInp.value = lng;
            showToast(`✅ Current location loaded: ${lat}, ${lng}`);
        },
        (error) => {
            console.error("Error getting location:", error);
            showToast("❌ Unable to retrieve location: " + error.message);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
};

window.execEditorCommand = function(cmd, value = null) {
    if (cmd === 'createLink') {
        const url = prompt('Enter the link URL (e.g. https://google.com):');
        if (url) {
            document.execCommand(cmd, false, url);
        }
    } else {
        document.execCommand(cmd, false, value);
    }
};

window.toggleFooterAccordion = function(id) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const isHidden = el.style.display === 'none';
    
    // Hide all footer accordions first
    document.querySelectorAll('[id^="footer-acc-"]').forEach(acc => {
        acc.style.display = 'none';
        const head = acc.previousElementSibling;
        if (head) {
            const icon = head.querySelector('.fa-chevron-up, .fa-chevron-down');
            if (icon) {
                icon.className = 'fa fa-chevron-down';
            }
        }
    });
    
    // Toggle selected accordion
    if (isHidden) {
        el.style.display = 'flex';
        const head = el.previousElementSibling;
        if (head) {
            const icon = head.querySelector('.fa-chevron-up, .fa-chevron-down');
            if (icon) {
                icon.className = 'fa fa-chevron-up';
            }
        }
    }
};

async function refreshBrevoQuota() {
    const card = document.getElementById('admin-brevo-quota-card');
    const textNode = document.getElementById('admin-brevo-quota-text');
    const progressContainer = document.getElementById('admin-brevo-progress-container');
    const progressBar = document.getElementById('admin-brevo-progress-bar');
    if (!card || !textNode) return;

    // Show card if user is admin or superadmin
    if ((typeof isAdmin !== 'undefined' && isAdmin) || (typeof isSuperAdmin !== 'undefined' && isSuperAdmin)) {
        card.style.display = 'flex';
    } else {
        card.style.display = 'none';
        return;
    }
    textNode.innerText = "Fetching real-time usage data...";

    try {
        const emailSnap = await db.collection('settings').doc('email').get();
        if (!emailSnap.exists) {
            textNode.innerText = "Configure Brevo API key under settings/email to enable tracking.";
            return;
        }
        const brevoKey = emailSnap.data().brevoKey;
        if (!brevoKey) {
            textNode.innerText = "Configure Brevo API key under settings/email to enable tracking.";
            return;
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/statistics/reports?limit=10', {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                'api-key': brevoKey
            }
        });

        if (!response.ok) {
            throw new Error(`API returned status ${response.status}`);
        }

        const data = await response.json();
        
        // Match UTC date first (since Brevo quota resets at UTC midnight) and fallback to local date string
        const localDateStr = new Date().toLocaleDateString('sv-SE');
        const utcDateStr = new Date().toISOString().split('T')[0];
        
        const reports = data.reports || [];
        let todayReport = reports.find(r => r.date === utcDateStr);
        if (!todayReport && localDateStr !== utcDateStr) {
            todayReport = reports.find(r => r.date === localDateStr);
        }

        let sentToday = 0;
        if (todayReport) {
            sentToday = todayReport.requests || 0;
        }

        const limit = 300;
        const percentage = Math.min((sentToday / limit) * 100, 100);

        textNode.innerHTML = `Sent Today: <b>${sentToday}</b> / <b>${limit}</b> emails (Remaining: <b>${Math.max(0, limit - sentToday)}</b>)`;
        
        if (progressContainer && progressBar) {
            progressContainer.style.display = 'block';
            progressBar.style.width = `${percentage}%`;
            if (percentage >= 90) {
                progressBar.style.background = '#e74c3c';
            } else if (percentage >= 70) {
                progressBar.style.background = '#e67e22';
            } else {
                progressBar.style.background = 'var(--gold)';
            }
        }

    } catch (err) {
        console.error("refreshBrevoQuota error:", err);
        textNode.innerText = "Failed to load usage data. Check API key configuration.";
    }
}
window.refreshBrevoQuota = refreshBrevoQuota;

// ── Backup & Restore (Superadmin only) ──
class FirestoreBatcher {
    constructor() {
        this.batch = db.batch();
        this.count = 0;
    }
    async set(ref, data) {
        this.batch.set(ref, data);
        this.count++;
        if (this.count >= 400) {
            await this.batch.commit();
            this.batch = db.batch();
            this.count = 0;
        }
    }
    async commit() {
        if (this.count > 0) {
            await this.batch.commit();
        }
    }
}

async function loadBackupSettings() {
    try {
        const snap = await db.collection('settings').doc('backup').get();
        const intervalEl = document.getElementById('admin-backup-interval');
        const statusEl = document.getElementById('admin-backup-status-text');
        
        let interval = 'disabled';
        let lastBackupTime = null;
        
        if (snap.exists) {
            const data = snap.data();
            interval = data.interval || 'disabled';
            lastBackupTime = data.lastBackupTime || null;
        }
        
        if (intervalEl) intervalEl.value = interval;
        
        if (statusEl) {
            if (lastBackupTime) {
                const dateStr = new Date(lastBackupTime).toLocaleString();
                statusEl.innerHTML = `Last Backup Time: <b>${dateStr}</b>`;
            } else {
                statusEl.innerHTML = `Last Backup Time: <b>Never</b>`;
            }
        }
        
        // Run auto-backup check
        if (interval !== 'disabled') {
            await checkAndRunAutoBackup(interval, lastBackupTime);
        }
    } catch(e) {
        console.error("loadBackupSettings error:", e);
    }
}

async function saveBackupSettings() {
    const val = document.getElementById('admin-backup-interval').value;
    try {
        await db.collection('settings').doc('backup').set({ interval: val }, { merge: true });
        showToast("Backup settings saved successfully!");
        await loadBackupSettings();
    } catch(e) {
        console.error("saveBackupSettings error:", e);
        showToast("Failed to save backup settings");
    }
}

async function checkAndRunAutoBackup(interval, lastBackupTime) {
    let threshold = 0;
    if (interval === 'hour') threshold = 60 * 60 * 1000;
    else if (interval === 'day') threshold = 24 * 60 * 60 * 1000;
    else if (interval === 'week') threshold = 7 * 24 * 60 * 60 * 1000;
    else if (interval === 'month') threshold = 30 * 24 * 60 * 60 * 1000;
    else if (interval === 'year') threshold = 365 * 24 * 60 * 60 * 1000;
    else return;
    
    const now = Date.now();
    if (!lastBackupTime || (now - lastBackupTime >= threshold)) {
        console.log(`Auto-backup threshold met for interval: ${interval}. Executing backup...`);
        showToast("⏳ Running automated backup...");
        try {
            await runBackup(true); // pass true for auto backup
        } catch(err) {
            console.error("Auto backup failed:", err);
            showToast("⚠️ Automated backup failed");
        }
    }
}

async function triggerManualBackup() {
    showToast("⏳ Preparing database backup... Please wait.");
    try {
        await runBackup(false, false);
    } catch(err) {
        console.error("Manual backup failed:", err);
        showToast("Failed to generate backup");
    }
}

async function triggerManualBackupEmail() {
    showToast("⏳ Preparing database backup for email... Please wait.");
    try {
        await runBackup(false, true);
    } catch(err) {
        console.error("Manual email backup failed:", err);
        showToast("Failed to generate backup");
    }
}

async function runBackup(isAuto = false, forceEmail = false) {
    const collections = ['products', 'orders', 'feedbacks', 'admins', 'settings'];
    const backupData = {};
    
    // Fetch regular collections
    for (const col of collections) {
        const snap = await db.collection(col).get();
        const docs = [];
        snap.forEach(doc => {
            docs.push({ id: doc.id, data: doc.data() });
        });
        backupData[col] = docs;
    }
    
    // Fetch users collection with subcollection addresses
    const usersSnap = await db.collection('users').get();
    const usersList = [];
    for (const doc of usersSnap.docs) {
        const userData = doc.data();
        const addrSnap = await db.collection('users').doc(doc.id).collection('addresses').get();
        const addresses = [];
        addrSnap.forEach(aDoc => {
            addresses.push({ id: aDoc.id, data: aDoc.data() });
        });
        usersList.push({ id: doc.id, data: userData, addresses: addresses });
    }
    backupData['users'] = usersList;
    
    // Convert to JSON and trigger download/email
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const dateStr = now.toISOString().replace(/T/, '_').replace(/\\.+/, '').replace(/:/g, '-');
    const filename = `swagstree_backup_${isAuto ? 'auto_' : 'manual_'}${dateStr}.json`;
    
    if (isAuto || forceEmail) {
        try {
            showToast("⏳ Uploading backup to secure storage...");
            
            const fd = new FormData();
            fd.append("file", blob, filename);
            fd.append("upload_preset", typeof PRESET !== 'undefined' ? PRESET : "swagstree_upload");
            const cloudName = typeof CLOUD_NAME !== 'undefined' ? CLOUD_NAME : "mysharecloud";
            
            const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: "POST",
                body: fd
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ? d.error.message : "Cloudinary upload failed");
            
            const downloadUrl = d.secure_url;
            
            await db.collection('mail').add({
                to: 'backup@swagstree.com',
                message: {
                    subject: `Swag Stree ${isAuto ? 'Auto' : 'Manual'} Backup: ${filename}`,
                    text: `Your ${isAuto ? 'automated' : 'manual'} database backup is ready.\n\nDownload Link: ${downloadUrl}\n\nNote: This file is stored securely in your Cloudinary Storage.\n\nGenerated at: ${now.toLocaleString()}`
                }
            });
            showToast(`✅ Backup completed and emailed to backup@swagstree.com!`);
        } catch (err) {
            console.error("Backup upload/email failed:", err);
            showToast("⚠️ Backup failed to email (CORS or Storage error)");
        }
    } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(`Backup download started: ${filename}`);
    }
    
    URL.revokeObjectURL(url);
    
    // Update last backup timestamp in settings/backup
    const nowMs = Date.now();
    await db.collection('settings').doc('backup').set({ lastBackupTime: nowMs }, { merge: true });
    
    // Refresh status text
    const statusEl = document.getElementById('admin-backup-status-text');
    if (statusEl) {
        statusEl.innerHTML = `Last Backup Time: <b>${new Date(nowMs).toLocaleString()}</b>`;
    }
}

async function restoreBackupFromFile(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validation
            if (!data.products || !data.orders || !data.feedbacks || !data.settings || !data.users || !data.admins) {
                showToast("⚠️ Invalid backup file format!");
                input.value = '';
                return;
            }
            
            const confirmMsg = "CRITICAL WARNING:\n\n" +
                               "Restoring this backup will insert or overwrite documents in all collections (products, orders, feedbacks, users, settings, admins).\n" +
                               "It is highly recommended to download a backup of your current database first.\n\n" +
                               "To proceed with the restore operation, please type \"RESTORE\" in the prompt below:";
            
            const promptVal = prompt(confirmMsg);
            if (promptVal !== 'RESTORE') {
                showToast("Restore operation cancelled.");
                input.value = '';
                return;
            }
            
            showToast("⏳ Restoring database in batches... Do not close the window.");
            
            const batcher = new FirestoreBatcher();
            
            // Restore regular collections
            const cols = ['products', 'orders', 'feedbacks', 'admins', 'settings'];
            for (const col of cols) {
                if (data[col] && Array.isArray(data[col])) {
                    for (const doc of data[col]) {
                        await batcher.set(db.collection(col).doc(doc.id), doc.data);
                    }
                }
            }
            
            // Restore users and subcollection addresses
            if (data.users && Array.isArray(data.users)) {
                for (const user of data.users) {
                    await batcher.set(db.collection('users').doc(user.id), user.data);
                    
                    if (user.addresses && Array.isArray(user.addresses)) {
                        for (const addr of user.addresses) {
                            await batcher.set(
                                db.collection('users').doc(user.id).collection('addresses').doc(addr.id),
                                addr.data
                            );
                        }
                    }
                }
            }
            
            await batcher.commit();
            showToast("✅ Database restored successfully! Reloading page...");
            setTimeout(() => {
                window.location.reload();
            }, 1500);
            
        } catch(err) {
            console.error("Error restoring backup:", err);
            showToast("Failed to restore backup. Please ensure the file is valid JSON.");
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
}

window.loadBackupSettings = loadBackupSettings;
window.saveBackupSettings = saveBackupSettings;
window.triggerManualBackup = triggerManualBackup;
window.restoreBackupFromFile = restoreBackupFromFile;






