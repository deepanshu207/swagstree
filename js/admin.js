// ==========================================
// SWAG STREE | ADMIN TOOLS
// ==========================================

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
    
    container.innerHTML = variantBlocks.map(v => `
        <div class="variant-block" id="${v.id}" style="background:#1a1a1a; padding:15px; border-radius:10px; border:1px solid #333; margin-bottom:15px; position:relative;">
            <i class="fa fa-times" style="position:absolute; top:10px; right:15px; color:#666; cursor:pointer;" onclick="removeVariant('${v.id}')"></i>
            
            <div style="display:flex; gap:10px; align-items:center; flex-wrap: wrap; margin-top:5px; margin-bottom:15px;">
                <input list="size-options-${v.id}" id="v-size-${v.id}" placeholder="Size (Blank = Standard)" value="${v.size === 'Standard' ? '' : v.size}" oninput="updateVariant('${v.id}', 'size', this.value)" style="flex:1; min-width: 100px; padding:8px; border-radius:5px; border:1px solid #444; background:#222; color:#fff;">
                <datalist id="size-options-${v.id}">
                    ${ALL_SIZES.map(s => `<option value="${s.id}">`).join('')}
                </datalist>
                <input list="color-options-${v.id}" id="v-color-${v.id}" placeholder="Color" value="${v.color || ''}" oninput="updateVariant('${v.id}', 'color', this.value)" style="flex:1; min-width: 100px; padding:8px; border-radius:5px; border:1px solid #444; background:#222; color:#fff;">
                <datalist id="color-options-${v.id}">
                    ${ALL_COLORS.map(c => `<option value="${c}">`).join('')}
                </datalist>
                <input list="pattern-options-${v.id}" id="v-pattern-${v.id}" placeholder="Pattern (e.g. Floral)" value="${v.pattern || ''}" oninput="updateVariant('${v.id}', 'pattern', this.value)" style="flex:1; min-width: 100px; padding:8px; border-radius:5px; border:1px solid #444; background:#222; color:#fff;">
                <datalist id="pattern-options-${v.id}">
                    ${ALL_PATTERNS.map(p => `<option value="${p}">`).join('')}
                </datalist>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap: wrap;">
                <input id="v-price-${v.id}" type="number" placeholder="Custom Price (Blank = Base Price)" value="${v.price || ''}" oninput="updateVariant('${v.id}', 'price', this.value)" style="flex:1; padding:8px; border-radius:5px; border:1px solid #444; background:#222; color:#fff;">
                <span title="Overrides default price. Leave blank to inherit base price." style="cursor:help; color:#aaa; font-size:14px; margin-left:-5px;">ⓘ</span>
                <label style="flex:1; padding:8px; border-radius:5px; border:1px dashed #666; background:#222; color:#ccc; text-align:center; cursor:pointer; font-size:12px;">
                    Upload Variant Images
                    <input type="file" multiple accept="image/*" style="display:none;" onchange="handleFileSelect(this, '${v.id}')">
                </label>
                <label style="flex:1; padding:8px; border-radius:5px; border:1px dashed #25D366; background:#222; color:#ccc; text-align:center; cursor:pointer; font-size:12px;">
                    Upload Pattern/Color Swatch
                    <input type="file" accept="image/*" style="display:none;" onchange="handleSwatchSelect(this, '${v.id}')">
                </label>
            </div>
            <div style="display:flex; flex-wrap:wrap; align-items:center; gap:15px; margin-top:10px;">
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" id="v-active-${v.id}" ${v.isActive !== false ? 'checked' : ''} onchange="updateVariant('${v.id}', 'isActive', this.checked)">
                    <label for="v-active-${v.id}" style="font-size:12px; color:#aaa; cursor:pointer; margin:0;">Active <span title="Uncheck to hide this variant from the store" style="cursor:help; color:#aaa;">ⓘ</span></label>
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" id="v-include-${v.id}" ${v.includeBase === false ? 'checked' : ''} onchange="updateVariant('${v.id}', 'includeBase', !this.checked)">
                    <label for="v-include-${v.id}" style="font-size:12px; color:#aaa; cursor:pointer; margin:0;">Hide Main Carousel Images</label>
                </div>
                <div style="display:flex; align-items:center; gap:5px;">
                    <input type="checkbox" id="v-track-${v.id}" ${v.trackStock ? 'checked' : ''} onchange="updateVariant('${v.id}', 'trackStock', this.checked); renderVariantBlocks();">
                    <label for="v-track-${v.id}" style="font-size:12px; color:#aaa; cursor:pointer; margin:0;">Track Stock</label>
                </div>
                ${v.trackStock ? `<input type="number" placeholder="Stock Qty" value="${v.stockCount || 0}" oninput="updateVariant('${v.id}', 'stockCount', parseInt(this.value)||0)" style="width:80px; padding:6px; border-radius:5px; border:1px solid #444; background:#222; color:#fff;">` : ''}
            </div>
            <div id="v-preview-${v.id}" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:10px;"></div>
            <div id="v-swatch-${v.id}" style="display:flex; gap:5px; flex-wrap:wrap; margin-top:5px;"></div>
        </div>
    `).join('');

    variantBlocks.forEach(v => {
        renderImagePreviews(v.id);
        renderSwatchPreview(v.id);
    });
}

// Swap
function swapArr(arr, index, newIdx, vId) {
    const temp = arr[index];
    arr[index] = arr[newIdx];
    arr[newIdx] = temp;
    
    renderImagePreviews(vId);
}

function renderSwatchPreview(vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    const sContainer = document.getElementById(`v-swatch-${v.id}`);
    if (!sContainer) return;
    
    sContainer.innerHTML = '';
    
    if (v.existingPreviewImage) {
        sContainer.innerHTML = `
            <div style="position:relative; width:40px; height:40px; border-radius:8px; overflow:hidden; border:2px solid var(--gold);">
                <img src="${v.existingPreviewImage}" style="width:100%; height:100%; object-fit:cover;">
                <i class="fa fa-times" style="position:absolute; top:2px; right:2px; color:var(--red); cursor:pointer; font-size:10px; background:rgba(0,0,0,0.5); padding:2px; border-radius:2px;" onclick="removeExistingSwatch('${v.id}')"></i>
                <div style="position:absolute; bottom:0; width:100%; font-size:8px; background:rgba(0,0,0,0.7); text-align:center; color:#fff;">Swatch</div>
            </div>
        `;
    } else if (v.currentPreviewFile) {
        const url = URL.createObjectURL(v.currentPreviewFile);
        sContainer.innerHTML = `
            <div style="position:relative; width:40px; height:40px; border-radius:8px; overflow:hidden; border:2px dashed var(--gold);">
                <img src="${url}" style="width:100%; height:100%; object-fit:cover;">
                <i class="fa fa-times" style="position:absolute; top:2px; right:2px; color:var(--red); cursor:pointer; font-size:10px; background:rgba(0,0,0,0.5); padding:2px; border-radius:2px;" onclick="removeNewSwatch('${v.id}')"></i>
                <div style="position:absolute; bottom:0; width:100%; font-size:8px; background:rgba(0,0,0,0.7); text-align:center; color:#fff;">Swatch</div>
            </div>
        `;
    }
}

function addVariantBlock() {
    variantBlocks.push({
        id: 'v_' + Math.random().toString(36).substr(2, 9),
        size: 'Standard',
        color: '',
        pattern: '',
        price: null,
        includeBase: true,
        isActive: true,
        trackStock: false,
        stockCount: 0,
        existingImages: [],
        currentFiles: [],
        existingPreviewImage: '',
        currentPreviewFile: null
    });
    renderVariantBlocks();
}

function handleFileSelect(input, vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    v.currentFiles.push(...Array.from(input.files));
    renderImagePreviews(vId);
}

function handleSwatchSelect(input, vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    if (input.files && input.files.length > 0) {
        v.currentPreviewFile = input.files[0];
        v.existingPreviewImage = '';
    }
    renderSwatchPreview(vId);
}

function removeNewVariantImage(vId, index) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    v.currentFiles.splice(index, 1);
    renderImagePreviews(vId);
}

function removeExistingVariantImage(vId, index) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    v.existingImages.splice(index, 1);
    renderImagePreviews(vId);
}

function removeExistingSwatch(vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (v) v.existingPreviewImage = '';
    renderSwatchPreview(vId);
}

function removeNewSwatch(vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (v) v.currentPreviewFile = null;
    renderSwatchPreview(vId);
}

function updateVariant(id, field, value) {
    const v = variantBlocks.find(x => x.id === id);
    if (v) v[field] = value;
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
        let thumbUrl = 'https://placehold.co/400x400/111/111?text=+';
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
    existingImageUrls = [...(p.images || [])]; 
    currentProductFiles = []; 
    renderImagePreviews(); 
    
    // Load variants or fallback
    if (p.variants && Array.isArray(p.variants)) {
        variantBlocks = p.variants.map(v => ({
            id: 'v_' + Math.random().toString(36).substr(2, 9),
            size: v.size || 'Standard',
            color: v.color || '',
            pattern: v.pattern || '',
            price: v.price || null,
            includeBase: v.includeBase !== false,
            isActive: v.isActive !== false,
            trackStock: !!v.trackStock,
            stockCount: v.stockCount || 0,
            existingImages: [...(v.images || [])],
            currentFiles: [],
            existingPreviewImage: v.previewImage || '',
            currentPreviewFile: null
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
                        pattern: '',
                        price: null,
                        includeBase: true,
                        isActive: true,
                        trackStock: false,
                        stockCount: 0,
                        existingImages: [],
                        currentFiles: [],
                        existingPreviewImage: '',
                        currentPreviewFile: null
                    });
                });
            } else {
                variantBlocks.push({
                    id: 'v_' + Math.random().toString(36).substr(2, 9),
                    size: sz,
                    color: '',
                    price: null,
                    includeBase: true,
                    isActive: true,
                    trackStock: false,
                    stockCount: 0,
                    existingImages: [],
                    currentFiles: [],
                    existingPreviewImage: '',
                    currentPreviewFile: null
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
    currentProductFiles = []; 
    variantBlocks = [];
    document.getElementById('m-name').value = ""; 
    document.getElementById('m-price').value = ""; 
    document.getElementById('m-desc').value = "";
    
    renderImagePreviews('base'); 
    renderVariantBlocks();
    document.getElementById('prod-modal').style.display = 'flex'; 
}

function renderImagePreviews(targetId = 'base') { 
    const container = document.getElementById(targetId === 'base' ? 'm-preview' : `v-preview-${targetId}`); 
    if(!container) return;
    container.innerHTML = ""; 
    
    let exist = targetId === 'base' ? existingImageUrls : (variantBlocks.find(x => x.id === targetId)?.existingImages || []);
    let curr = targetId === 'base' ? currentProductFiles : (variantBlocks.find(x => x.id === targetId)?.currentFiles || []);

    exist.forEach((url, i) => { 
        const wrap = document.createElement('div'); 
        wrap.className = 'thumb-wrap'; 
        wrap.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover"><div class="thumb-del" onclick="${targetId === 'base' ? `existingImageUrls.splice(${i},1);renderImagePreviews('base')` : `removeExistingVariantImage('${targetId}', ${i})`}">×</div>`; 
        container.appendChild(wrap); 
    }); 
    
    curr.forEach((file, i) => { 
        const wrap = document.createElement('div'); 
        wrap.className = 'thumb-wrap'; 
        wrap.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover"><div class="thumb-del" onclick="${targetId === 'base' ? `currentProductFiles.splice(${i},1);renderImagePreviews('base')` : `removeNewVariantImage('${targetId}', ${i})`}">×</div>`; 
        container.appendChild(wrap); 
    }); 
}

async function saveProduct() { 
    const n = document.getElementById('m-name').value;
    const pr = document.getElementById('m-price').value; 
    if(!n || !pr) return showToast("Fields missing"); 
    
    const btn = document.getElementById('m-save'); 
    btn.disabled = true; 
    btn.innerText = "Processing..."; 
    
    try { 
        // Upload new base images to Cloudinary
        const upPromises = currentProductFiles.map(async f => { 
            const fd = new FormData(); 
            fd.append("file", f); 
            fd.append("upload_preset", PRESET); 
            const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {method:"POST", body:fd}); 
            const d = await r.json(); 
            return d.secure_url; 
        }); 
        const newUrls = await Promise.all(upPromises); 
        
        // Upload variant images
        const parsedVariants = [];
        for (let v of variantBlocks) {
            const vUpPromises = v.currentFiles.map(async f => {
                const fd = new FormData(); 
                fd.append("file", f); 
                fd.append("upload_preset", PRESET); 
                const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {method:"POST", body:fd}); 
                const d = await r.json(); 
                return d.secure_url; 
            });
            const vNewUrls = await Promise.all(vUpPromises);
            
            let uploadedPreviewUrl = v.existingPreviewImage || '';
            if (v.currentPreviewFile) {
                const fd = new FormData(); 
                fd.append("file", v.currentPreviewFile); 
                fd.append("upload_preset", PRESET); 
                const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {method:"POST", body:fd}); 
                const d = await r.json(); 
                uploadedPreviewUrl = d.secure_url;
            }
            
            let finalPatternName = v.pattern ? v.pattern.trim() : '';
            if (!finalPatternName && uploadedPreviewUrl) {
                finalPatternName = `Design-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
            }
            
            const colorValues = v.color ? v.color.split(',').map(c => c.trim()).filter(c => c) : [''];
            colorValues.forEach(col => {
                const parsedVariant = {
                    size: v.size,
                    color: col,
                    pattern: finalPatternName,
                    price: v.price ? Number(v.price) : null,
                    includeBase: v.includeBase !== false,
                    isActive: v.isActive !== false,
                    trackStock: !!v.trackStock,
                    stockCount: v.stockCount || 0,
                    images: [...v.existingImages, ...vNewUrls],
                    previewImage: uploadedPreviewUrl
                };
                parsedVariants.push(parsedVariant);
            });
        }
        
        const data = { 
            name: n, 
            price: Number(pr), 
            description: document.getElementById('m-desc').value, 
            images: [...existingImageUrls, ...newUrls],
            variants: parsedVariants,
            // Fallback for older legacy UI code
            sizes: [...new Set(parsedVariants.map(v => v.size))],
            colors: [...new Set(parsedVariants.map(v => v.color).filter(c => c))],
            sizeColorMap: {}
        }; 
        
        parsedVariants.forEach(v => {
            if(!data.sizeColorMap[v.size]) data.sizeColorMap[v.size] = [];
            if(v.color && !data.sizeColorMap[v.size].includes(v.color)) {
                data.sizeColorMap[v.size].push(v.color);
            }
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
        showToast("Error saving product"); 
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
    existingImageUrls = [...(p.images || [])]; 
    currentProductFiles = []; 
    
    // Load variants or fallback
    if (p.variants && Array.isArray(p.variants)) {
        variantBlocks = p.variants.map(v => ({
            id: 'v_' + Math.random().toString(36).substr(2, 9),
            size: v.size || 'Standard',
            color: v.color || '',
            pattern: v.pattern || '',
            price: v.price || null,
            includeBase: v.includeBase !== false,
            isActive: v.isActive !== false,
            trackStock: !!v.trackStock,
            stockCount: v.stockCount || 0,
            existingImages: [...(v.images || [])],
            currentFiles: []
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
                        price: null,
                        includeBase: true,
                        isActive: true,
                        trackStock: false,
                        stockCount: 0,
                        existingImages: [],
                        currentFiles: []
                    });
                });
            } else {
                variantBlocks.push({
                    id: 'v_' + Math.random().toString(36).substr(2, 9),
                    size: sz,
                    color: '',
                    price: null,
                    includeBase: true,
                    isActive: true,
                    trackStock: false,
                    stockCount: 0,
                    existingImages: [],
                    currentFiles: []
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
