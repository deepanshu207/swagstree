// ==========================================
// SWAG STREE | ADMIN TOOLS
// ==========================================

function renderAdmin() { 
    const container = document.getElementById('admin-list');
    if(!container) return;
    
    container.innerHTML = products.map(p => `
        <div style="display:flex; align-items:center; gap:12px; background:#111; padding:12px; border-radius:15px; margin-bottom:12px; border:1px solid #222">
            <img src="${p.images && p.images.length ? p.images[0] : ''}" style="width:40px;height:40px;border-radius:5px;object-fit:cover">
            <div style="flex:1"><b>${p.name}</b></div>
            <div style="display:flex; gap:15px">
                <i class="fa fa-edit" style="color:var(--gold); cursor:pointer" onclick="openEdit('${p.id}')"></i>
                <i class="fa fa-trash" style="color:var(--red); cursor:pointer" onclick="if(confirm('Delete?')) db.collection('products').doc('${p.id}').delete()"></i>
            </div>
        </div>
    `).join(''); 
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
    document.getElementById('prod-modal').style.display = 'flex'; 
}

function openAdd() { 
    editingId = null; 
    existingImageUrls = []; 
    currentProductFiles = []; 
    document.getElementById('m-name').value = ""; 
    document.getElementById('m-price').value = ""; 
    document.getElementById('m-desc').value = "";
    renderImagePreviews(); 
    document.getElementById('prod-modal').style.display = 'flex'; 
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
        
        const data = { 
            name: n, 
            price: Number(pr), 
            description: document.getElementById('m-desc').value, 
            images: [...existingImageUrls, ...newUrls] 
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
