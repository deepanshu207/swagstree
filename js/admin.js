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
if (typeof isAdmin === 'undefined') window.isAdmin = false;
if (typeof products === 'undefined') window.products = [];
if (typeof editingId === 'undefined') window.editingId = null;
if (typeof existingImageUrls === 'undefined') window.existingImageUrls = [];
if (typeof currentProductFiles === 'undefined') window.currentProductFiles = [];

if (typeof editingProductsLimit === 'undefined') window.editingProductsLimit = 20;

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
    }
    
    container.innerHTML = itemsToRender.map(p => {
        let thumbUrl = 'https://placehold.co/400x400/222/FFF?text=+';
        if (p.images && p.images.length > 0) {
            thumbUrl = p.images[0];
        } else if (p.variants && Array.isArray(p.variants)) {
            const vWithImg = p.variants.find(v => v.images && v.images.length > 0);
            if (vWithImg) thumbUrl = vWithImg.images[0];
        }
        return `
        <div style="display:flex; align-items:center; gap:12px; background:#111; padding:12px; border-radius:15px; margin-bottom:12px; border:1px solid #222">
            <img src="${thumbUrl}" style="width:40px;height:40px;border-radius:5px;object-fit:cover">
            <div style="flex:1"><b>${p.name}</b></div>
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
    document.getElementById('m-main-pos').value = p.mainImagesPosition || 'start';
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
    document.getElementById('m-main-pos').value = 'start';
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
        // Upload all base images (interleaved support)
        const finalMainImages = [];
        for (let img of existingImageUrls) {
            if (img instanceof File) {
                const url = await uploadToCloudinary(img);
                finalMainImages.push(url);
            } else {
                finalMainImages.push(img);
            }
        }
        
        // Upload variant images & swatches
        const parsedVariants = [];
        for (let v of variantBlocks) {
            const uploadedVariantImages = [];
            for (let img of (v.images || [])) {
                if (img instanceof File) {
                    const url = await uploadToCloudinary(img);
                    uploadedVariantImages.push(url);
                } else {
                    uploadedVariantImages.push(img);
                }
            }
            
            const uploadedPreviewUrls = [];
            for (let img of (v.previewImages || [])) {
                if (img instanceof File) {
                    const url = await uploadToCloudinary(img);
                    uploadedPreviewUrls.push(url);
                } else {
                    uploadedPreviewUrls.push(img);
                }
            }
            
            let finalSize = v.size || 'Standard';
            let finalColor = v.color || '';
            let finalColorName = v.colorName || '';
            let finalPattern = v.pattern || '';
            let finalPatternName = v.patternName || '';
            
            if (finalSize === 'Standard' && !finalColor && !finalPattern && uploadedPreviewUrls.length === 0) {
                continue;
            }
            
            const parsedVariant = {
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
                stockCount: v.stockCount || 0,
                images: uploadedVariantImages,
                previewImages: uploadedPreviewUrls
            };
            
            parsedVariants.push(parsedVariant);
        }
        
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
                    dup.stockCount = (dup.stockCount || 0) + (v.stockCount || 0);
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
    loadAdminPromoSettings();
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
    document.getElementById('m-main-pos').value = p.mainImagesPosition || 'start';
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

// ── Promo Code Settings ─────────────────────────────────────────────────────
let adminPromoList = [];

async function loadAdminPromoSettings() {
    try {
        const snap = await db.collection('settings').doc('promos').get();
        if (snap.exists) {
            adminPromoList = snap.data().list || [];
        }
        renderAdminPromoList();
    } catch(e) {
        console.error('loadAdminPromoSettings error:', e);
    }
}

function renderAdminPromoList() {
    const listEl = document.getElementById('admin-promo-list');
    if (!listEl) return;
    
    if (adminPromoList.length === 0) {
        listEl.innerHTML = '<div style="font-size:11px; color:#555;">No active promo codes.</div>';
        return;
    }
    
    listEl.innerHTML = adminPromoList.map((p, index) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:10px; border:1px dashed #444;">
            <div>
                <span style="color:var(--gold); font-weight:bold; font-size:13px; letter-spacing:1px;">${p.code}</span>
                <span style="color:#aaa; font-size:11px; margin-left:8px;">${p.discount}% OFF</span>
            </div>
            <i class="fa fa-trash" style="color:#ff4444; font-size:12px; cursor:pointer; padding:5px;" onclick="removePromoCode(${index})"></i>
        </div>
    `).join('');
}

async function addPromoCode() {
    const codeInput = document.getElementById('admin-promo-code');
    const discInput = document.getElementById('admin-promo-discount');
    const code = codeInput.value.trim().toUpperCase();
    const discount = Number(discInput.value);
    
    if (!code) return showToast('Enter a promo code');
    if (isNaN(discount) || discount < 1 || discount > 100) return showToast('Enter valid discount % (1-100)');
    
    // Check if it already exists
    if (adminPromoList.find(p => p.code === code)) {
        return showToast('Promo code already exists');
    }
    
    adminPromoList.push({ code, discount });
    await saveAdminPromoSettings();
    
    codeInput.value = '';
    discInput.value = '';
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
