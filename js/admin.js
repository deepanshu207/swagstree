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

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('m-sizes-colors');
    if (container && typeof ALL_SIZES !== 'undefined') {
        container.innerHTML = ALL_SIZES.map(s => `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <label style="display:flex; align-items:center; gap:5px; width:120px; font-weight:bold; cursor:pointer; font-size:12px; margin-bottom:0;">
                    <input type="checkbox" id="m-size-${s.id}" style="width:auto; margin:0;" onchange="toggleSizeInput('${s.id}')"> ${s.label}
                </label>
                <input id="m-colors-${s.id}" placeholder="Colors: e.g. Black, Red, White" disabled style="margin:0; padding:8px 12px; font-size:13px; flex:1;">
            </div>
        `).join('');
    }
});

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
    
    container.innerHTML = itemsToRender.map(p => `
        <div style="display:flex; align-items:center; gap:12px; background:#111; padding:12px; border-radius:15px; margin-bottom:12px; border:1px solid #222">
            <img src="${p.images && p.images.length ? p.images[0] : 'https://placehold.co/400x400/222/FFF?text=No+Image'}" style="width:40px;height:40px;border-radius:5px;object-fit:cover">
            <div style="flex:1"><b>${p.name}</b></div>
            <div style="display:flex; gap:15px; align-items:center;">
                <i class="fa fa-copy" style="color:#aaa; cursor:pointer;" title="Copy Product" onclick="copyProduct('${p.id}')"></i>
                <i class="fa fa-edit" style="color:var(--gold); cursor:pointer" onclick="openEdit('${p.id}')"></i>
                <i class="fa fa-trash" style="color:var(--red); cursor:pointer" onclick="if(confirm('Delete?')) db.collection('products').doc('${p.id}').delete()"></i>
            </div>
        </div>
    `).join(''); 
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
    
    // Load sizes and colors mapping
    const sizes = ALL_SIZES.map(s => s.id);
    const map = p.sizeColorMap || {};
    sizes.forEach(sz => {
        const checkbox = document.getElementById(`m-size-${sz}`);
        const input = document.getElementById(`m-colors-${sz}`);
        if (checkbox && input) {
            if (sz in map || (p.sizes && Array.isArray(p.sizes) && p.sizes.includes(sz))) {
                checkbox.checked = true;
                input.disabled = false;
                const colors = map[sz] || [];
                input.value = colors.join(', ');
            } else {
                checkbox.checked = false;
                input.disabled = true;
                input.value = '';
            }
        }
    });

    document.getElementById('prod-modal').style.display = 'flex'; 
}

function openAdd() { 
    editingId = null; 
    existingImageUrls = []; 
    currentProductFiles = []; 
    document.getElementById('m-name').value = ""; 
    document.getElementById('m-price').value = ""; 
    document.getElementById('m-desc').value = "";
    
    // Clear size and color checkboxes & inputs
    const sizes = ALL_SIZES.map(s => s.id);
    sizes.forEach(sz => {
        const checkbox = document.getElementById(`m-size-${sz}`);
        const input = document.getElementById(`m-colors-${sz}`);
        if (checkbox && input) {
            checkbox.checked = false;
            input.disabled = true;
            input.value = '';
        }
    });

    renderImagePreviews(); 
    document.getElementById('prod-modal').style.display = 'flex'; 
}

function toggleSizeInput(sz) {
    const checkbox = document.getElementById(`m-size-${sz}`);
    const isChecked = checkbox ? checkbox.checked : false;
    const input = document.getElementById(`m-colors-${sz}`);
    if (input) {
        input.disabled = !isChecked;
        if (!isChecked) input.value = '';
    }
}

function handleFileSelect(input) { 
    const files = Array.from(input.files); 
    currentProductFiles = [...currentProductFiles, ...files]; 
    renderImagePreviews(); 
    input.value = ""; 
}

function renderImagePreviews() { 
    const container = document.getElementById('m-preview'); 
    container.innerHTML = ""; 
    
    existingImageUrls.forEach((url, i) => { 
        const wrap = document.createElement('div'); 
        wrap.className = 'thumb-wrap'; 
        wrap.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover"><div class="thumb-del">×</div>`; 
        wrap.querySelector('.thumb-del').onclick = () => { 
            existingImageUrls.splice(i, 1); 
            renderImagePreviews(); 
        }; 
        container.appendChild(wrap); 
    }); 
    
    currentProductFiles.forEach((file, i) => { 
        const wrap = document.createElement('div'); 
        wrap.className = 'thumb-wrap'; 
        wrap.innerHTML = `<img src="${URL.createObjectURL(file)}" style="width:100%;height:100%;object-fit:cover"><div class="thumb-del">×</div>`; 
        wrap.querySelector('.thumb-del').onclick = () => { 
            currentProductFiles.splice(i, 1); 
            renderImagePreviews(); 
        }; 
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
        // Upload new images to Cloudinary
        const upPromises = currentProductFiles.map(async f => { 
            const fd = new FormData(); 
            fd.append("file", f); 
            fd.append("upload_preset", PRESET); 
            const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {method:"POST", body:fd}); 
            const d = await r.json(); 
            return d.secure_url; 
        }); 
        const newUrls = await Promise.all(upPromises); 
        
        // Parse sizeColorMap, sizes, colors
        const sizeColorMap = {};
        const activeSizes = [];
        const allColors = new Set();
        const sizes = ALL_SIZES.map(s => s.id);
        
        sizes.forEach(sz => {
            const checkbox = document.getElementById(`m-size-${sz}`);
            const input = document.getElementById(`m-colors-${sz}`);
            if (checkbox && checkbox.checked) {
                activeSizes.push(sz);
                const colorsVal = input.value.trim();
                const colorsArr = colorsVal ? colorsVal.split(',').map(c => c.trim()).filter(c => c.length > 0) : [];
                sizeColorMap[sz] = colorsArr;
                colorsArr.forEach(c => allColors.add(c));
            }
        });

        const data = { 
            name: n, 
            price: Number(pr), 
            description: document.getElementById('m-desc').value, 
            images: [...existingImageUrls, ...newUrls],
            sizes: activeSizes,
            colors: Array.from(allColors),
            sizeColorMap: sizeColorMap
        }; 
        
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
    renderImagePreviews(); 
    
    // Load sizes and colors mapping
    const sizes = ALL_SIZES.map(s => s.id);
    const map = p.sizeColorMap || {};
    sizes.forEach(sz => {
        const checkbox = document.getElementById(`m-size-${sz}`);
        const input = document.getElementById(`m-colors-${sz}`);
        if (checkbox && input) {
            if (sz in map || (p.sizes && Array.isArray(p.sizes) && p.sizes.includes(sz))) {
                checkbox.checked = true;
                input.disabled = false;
                const colors = map[sz] || [];
                input.value = colors.join(', ');
            } else {
                checkbox.checked = false;
                input.disabled = true;
                input.value = '';
            }
        }
    });

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
