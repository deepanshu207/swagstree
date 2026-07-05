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
if (typeof window.existingSpinUrls === 'undefined') window.existingSpinUrls = [];
if (typeof window.existingPanoramaUrls === 'undefined') window.existingPanoramaUrls = [];
if (typeof window.existingVideoUrls === 'undefined') window.existingVideoUrls = [];

function normalizeStoredVideo(v) {
    if (!v) return null;
    if (typeof v === 'string') {
        const url = v.trim();
        return url ? { url, is360: false } : null;
    }
    if (v instanceof File) {
        return { file: v, url: '', is360: !!v._is360 };
    }
    const url = String(v.url || '').trim();
    if (!url && !(v.file instanceof File)) return null;
    return {
        url,
        is360: !!v.is360,
        file: v.file instanceof File ? v.file : undefined
    };
}
window.normalizeStoredVideo = normalizeStoredVideo;

function getStoredVideoLabel(entry) {
    const n = normalizeStoredVideo(entry);
    if (!n) return 'Video';
    if (n.file instanceof File) {
        const name = n.file.name;
        return name.length > 18 ? name.substring(0, 18) + '…' : name;
    }
    return n.is360 ? '360° video' : 'Saved video';
}

function adminResolveMediaUrl(item) {
    if (!item) return '';
    if (item instanceof File) return URL.createObjectURL(item);
    return String(item);
}

function adminMediaScopeBadge(scope) {
    const isVariant = scope === 'variant';
    return `<span class="admin-media-scope ${isVariant ? 'admin-media-scope--variant' : 'admin-media-scope--global'}">${isVariant ? '🎯 This variant' : '🌐 All variants'}</span>`;
}

function adminMediaTypeBadge(type, extra) {
    const types = {
        gallery: { cls: 'admin-media-type--gallery', icon: '🖼️', label: 'Gallery photo' },
        swatch: { cls: 'admin-media-type--swatch', icon: '🎨', label: 'Swatch' },
        spin: { cls: 'admin-media-type--spin', icon: '🔄', label: 'Rotation frame' },
        video: { cls: 'admin-media-type--video', icon: '🎬', label: 'Video file' },
        panorama: { cls: 'admin-media-type--panorama', icon: '🌐', label: 'Panorama' }
    };
    const t = types[type] || types.gallery;
    return `<span class="admin-media-type ${t.cls}">${t.icon} ${t.label}${extra ? ` · ${extra}` : ''}</span>`;
}

function adminMediaSectionHead(scope, type, title, subtitle) {
    return `
        <div class="admin-media-section-head">
            <div class="admin-media-section-badges">
                ${adminMediaScopeBadge(scope)}
                ${adminMediaTypeBadge(type)}
            </div>
            <p class="admin-media-section-title">${title}</p>
            ${subtitle ? `<p class="admin-media-section-sub">${subtitle}</p>` : ''}
        </div>`;
}

function adminMediaEmptyHint(text) {
    return `<p class="admin-media-empty">${text}</p>`;
}

function adminMediaThumbHtml(opts) {
    const {
        url, index, targetId, previewFn, onRemove, spinAddFn, size = 60,
        objectFit = 'cover', badge, isNew = false, extraClass = ''
    } = opts;
    const borderCls = isNew ? 'admin-media-thumb--new' : '';
    return `
        <div class="admin-media-thumb ${borderCls} ${extraClass}" data-idx="${index}" style="width:${size}px; height:${size}px;">
            ${badge ? `<div class="admin-media-thumb__badge">${badge}</div>` : ''}
            <img src="${url}" draggable="false" alt="" style="width:100%;height:100%;object-fit:${objectFit};">
            <button type="button" class="admin-media-thumb__preview" onclick="event.stopPropagation(); ${previewFn}" title="Preview" aria-label="Preview">
                <i class="fa fa-eye"></i>
            </button>
            ${spinAddFn ? `<button type="button" class="admin-media-thumb__spin-add" onclick="event.stopPropagation(); ${spinAddFn}" title="Add to rotation frames" aria-label="Add to rotation frames"><i class="fa fa-refresh"></i></button>` : ''}
            ${onRemove ? `<button type="button" class="admin-media-thumb__remove" onclick="event.stopPropagation(); ${onRemove}" title="Remove" aria-label="Remove"><i class="fa fa-times"></i></button>` : ''}
        </div>`;
}

function adminIs360FeatureEnabled() {
    return !!(window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer);
}

function adminBuildGallerySpinToolbar(targetId, imageCount) {
    if (!adminIs360FeatureEnabled() || !imageCount) return '';
    return `
        <div class="admin-gallery-spin-toolbar">
            <button type="button" class="admin-media-action-btn admin-media-action-btn--gold" onclick="useGalleryImagesAsSpinFrames('${targetId}', true)">
                <i class="fa fa-refresh"></i> Use gallery as rotation frames
            </button>
            <button type="button" class="admin-media-action-btn" onclick="useGalleryImagesAsSpinFrames('${targetId}', false)">
                <i class="fa fa-plus"></i> Append gallery to rotation
            </button>
        </div>`;
}

function adminEnsureSpin360Enabled(targetId) {
    if (targetId === 'base') {
        const chk = document.getElementById('m-is360');
        if (chk && !chk.checked) {
            chk.checked = true;
            toggle360Badge('base', true);
        }
        toggleAdmin360Accordion('base', true);
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (v && !v.is360) {
            v.is360 = true;
            renderVariantBlocks();
            setTimeout(() => {
                toggleAdmin360Accordion(targetId, true);
                syncAdmin360AccordionSummary(targetId);
                syncAdminMediaStatus(targetId);
            }, 80);
            return;
        }
        toggleAdmin360Accordion(targetId, true);
    }
    syncAdmin360AccordionSummary(targetId);
}

function adminEnsurePanorama360Enabled(targetId) {
    if (targetId === 'base') {
        const chk = document.getElementById('m-is360-panorama');
        if (chk && !chk.checked) {
            chk.checked = true;
            toggle360PanoramaBadge('base', true);
        }
        toggleAdmin360Accordion('base', true);
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (v && !v.is360Panorama) {
            v.is360Panorama = true;
            renderVariantBlocks();
            setTimeout(() => {
                toggleAdmin360Accordion(targetId, true);
                syncAdmin360AccordionSummary(targetId);
                syncAdminMediaStatus(targetId);
            }, 80);
            return;
        }
        toggleAdmin360Accordion(targetId, true);
    }
    syncAdmin360AccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
}

function adminGetMediaStatusParts(targetId) {
    const parts = [];
    const gallery = targetId === 'base'
        ? (existingImageUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.images || []).length);
    const videos = targetId === 'base'
        ? (existingVideoUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.videos || []).length);
    const spins = targetId === 'base'
        ? (existingSpinUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.spinImages || []).length);
    const panos = targetId === 'base'
        ? (existingPanoramaUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.panoramaImages || []).length);
    if (gallery) parts.push(`${gallery} gallery`);
    if (videos) parts.push(`${videos} video`);
    if (spins) parts.push(`${spins} rotation frame${spins === 1 ? '' : 's'}`);
    if (panos) parts.push(`${panos} panorama`);
    return parts;
}

function syncAdminMediaStatus(targetId) {
    const el = document.getElementById(`admin-media-status-${targetId}`);
    if (!el) return;
    const parts = adminGetMediaStatusParts(targetId);
    el.textContent = parts.length
        ? `Configured: ${parts.join(' · ')}`
        : 'No extra media yet — gallery photos are enough for most products';
}
window.syncAdminMediaStatus = syncAdminMediaStatus;

function useGalleryImagesAsSpinFrames(targetId, replace = true) {
    const gallery = targetId === 'base'
        ? (existingImageUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.images || []);
    if (!gallery.length) return showToast('Add gallery photos first.');
    const previousCount = targetId === 'base'
        ? (existingSpinUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.spinImages || []).length);
    adminEnsureSpin360Enabled(targetId);
    const frames = gallery.map(img => img);
    if (targetId === 'base') {
        existingSpinUrls = replace ? [...frames] : [...(existingSpinUrls || []), ...frames];
        renderSpinPreviews('base');
        adminScrollToSpinSection('base');
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        v.spinImages = replace ? [...frames] : [...(v.spinImages || []), ...frames];
        renderSpinPreviews(targetId);
        adminScrollToSpinSection(targetId);
    }
    syncAdmin360AccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
    const n = targetId === 'base' ? existingSpinUrls.length : (variantBlocks.find(x => x.id === targetId)?.spinImages || []).length;
    if (replace) {
        showToast(`Rotation frames set from gallery (${n} frame${n === 1 ? '' : 's'}${previousCount ? `, replaced ${previousCount}` : ''}). Save to keep.`);
    } else {
        showToast(`Added gallery photos to rotation (${n} total). Save to keep.`);
    }
}
window.useGalleryImagesAsSpinFrames = useGalleryImagesAsSpinFrames;

function addGalleryImageToSpinFrames(targetId, index) {
    const gallery = targetId === 'base'
        ? (existingImageUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.images || []);
    const img = gallery[index];
    if (!img) return;
    adminEnsureSpin360Enabled(targetId);
    if (targetId === 'base') {
        existingSpinUrls = [...(existingSpinUrls || []), img];
        renderSpinPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        v.spinImages = [...(v.spinImages || []), img];
        renderSpinPreviews(targetId);
    }
    syncAdmin360AccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
    showToast(`Gallery photo #${index + 1} added to rotation frames.`);
}
window.addGalleryImageToSpinFrames = addGalleryImageToSpinFrames;

function toggleAdmin360Accordion(targetId, forceOpen) {
    const content = document.getElementById(`admin-360-accord-content-${targetId}`);
    const accordion = document.getElementById(`admin-360-accord-${targetId}`);
    const icon = document.getElementById(`admin-360-accord-icon-${targetId}`);
    const header = accordion?.querySelector('.admin-media-360-accord-header');
    if (!content || !accordion) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : content.style.display === 'none';
    content.style.display = shouldOpen ? 'block' : 'none';
    accordion.classList.toggle('is-open', shouldOpen);
    if (icon) icon.style.transform = shouldOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (header) header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}
window.toggleAdmin360Accordion = toggleAdmin360Accordion;

function syncAdminSpinFramesAccordionSummary(targetId) {
    const el = document.getElementById(`admin-spin-accord-summary-${targetId}`);
    if (!el) return;
    const items = targetId === 'base'
        ? (existingSpinUrls || [])
        : ((variantBlocks.find(x => x.id === targetId)?.spinImages || []));
    if (!items.length) {
        el.textContent = 'No frames yet — tap to upload or copy from gallery';
        return;
    }
    el.textContent = `${items.length} rotation frame${items.length === 1 ? '' : 's'} · tap to preview, reorder, or upload`;
}
window.syncAdminSpinFramesAccordionSummary = syncAdminSpinFramesAccordionSummary;

function toggleAdminSpinFramesAccordion(targetId, forceOpen) {
    const content = document.getElementById(`admin-spin-accord-content-${targetId}`);
    const accordion = document.getElementById(`admin-spin-accord-${targetId}`);
    const icon = document.getElementById(`admin-spin-accord-icon-${targetId}`);
    const header = accordion?.querySelector('.admin-spin-frames-accord-header');
    if (!content || !accordion) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : content.style.display === 'none';
    content.style.display = shouldOpen ? 'block' : 'none';
    accordion.classList.toggle('is-open', shouldOpen);
    if (icon) icon.style.transform = shouldOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (header) header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}
window.toggleAdminSpinFramesAccordion = toggleAdminSpinFramesAccordion;

function adminSpinFramesSectionHtml(targetId, scope, visibleStyle = 'none') {
    const isBase = targetId === 'base';
    const containerId = isBase ? 'm-spin-upload-container' : `v-spin-upload-${targetId}`;
    const previewId = isBase ? 'm-spin-preview' : `v-spin-preview-${targetId}`;
    return `
                    <div id="${containerId}" style="display:${visibleStyle};">
                        <div class="admin-spin-frames-accordion" id="admin-spin-accord-${targetId}">
                            <div class="admin-spin-frames-accord-header" onclick="toggleAdminSpinFramesAccordion('${targetId}')" role="button" tabindex="0" aria-expanded="false" aria-controls="admin-spin-accord-content-${targetId}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAdminSpinFramesAccordion('${targetId}');}">
                                <div class="admin-spin-frames-accord-header-text">
                                    <span class="admin-spin-frames-accord-title"><i class="fa fa-refresh" aria-hidden="true"></i> Rotation frames</span>
                                    <span id="admin-spin-accord-summary-${targetId}" class="admin-spin-frames-accord-summary">Tap to manage spin photos</span>
                                </div>
                                <i id="admin-spin-accord-icon-${targetId}" class="fa fa-chevron-down admin-spin-frames-chevron" aria-hidden="true"></i>
                            </div>
                            <div id="admin-spin-accord-content-${targetId}" class="admin-spin-frames-accord-content" style="display:none;">
                                <p class="admin-media-section-sub admin-spin-frames-accord-intro">Still images — drag to reorder · 👁 to preview · powers the <strong>Rotate</strong> button on the shop</p>
                                <div id="${previewId}" class="admin-media-preview-grid admin-media-preview-grid--spin"></div>
                                <label class="admin-media-upload admin-media-upload--spin">
                                    <span class="admin-media-upload__icon">🔄</span>
                                    <span class="admin-media-upload__text">Add your own rotation photos</span>
                                    <input type="file" multiple accept="image/*" style="display:none;" onchange="handleSpinFileSelect(this, '${targetId}')">
                                </label>
                                <button type="button" onclick="useGalleryImagesAsSpinFrames('${targetId}', true)" class="admin-media-action-btn admin-media-action-btn--gold" style="width:100%; margin-bottom:6px;">Use gallery photos as rotation frames</button>
                                <button type="button" onclick="loadDemo360Spin('${targetId}')" class="admin-media-demo-btn admin-media-demo-btn--gold">Use demo spin (16 Vespa frames)</button>
                            </div>
                        </div>
                    </div>`;
}
window.adminSpinFramesSectionHtml = adminSpinFramesSectionHtml;

function syncAdmin360AccordionSummary(targetId) {
    const el = document.getElementById(`admin-360-accord-summary-${targetId}`);
    if (!el) return;
    const spinCount = targetId === 'base'
        ? (existingSpinUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.spinImages || []).length);
    const panoCount = targetId === 'base'
        ? (existingPanoramaUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.panoramaImages || []).length);
    const spinOn = targetId === 'base'
        ? !!document.getElementById('m-is360')?.checked
        : !!(variantBlocks.find(x => x.id === targetId)?.is360);
    const panoOn = targetId === 'base'
        ? !!document.getElementById('m-is360-panorama')?.checked
        : !!(variantBlocks.find(x => x.id === targetId)?.is360Panorama);
    const parts = [];
    if (spinOn) parts.push(`Rotate: ${spinCount} frame${spinCount === 1 ? '' : 's'}`);
    if (panoOn) parts.push(`Panorama: ${panoCount} scene${panoCount === 1 ? '' : 's'}`);
    el.textContent = parts.length ? parts.join(' · ') : 'Optional — rotate & look-around';
}
window.syncAdmin360AccordionSummary = syncAdmin360AccordionSummary;

function adminBindSortableThumbGrid(container, list, renderFn, draggableSelector = '.admin-media-thumb') {
    if (!window.Sortable || !container || !list || list.length < 2) return;
    if (container._sortable) container._sortable.destroy();
    container._sortable = Sortable.create(container, {
        animation: 150,
        draggable: draggableSelector,
        delay: 120,
        delayOnTouchOnly: true,
        touchStartThreshold: 4,
        onEnd(evt) {
            if (evt.oldIndex === evt.newIndex) return;
            const moved = list.splice(evt.oldIndex, 1)[0];
            list.splice(evt.newIndex, 0, moved);
            renderFn();
        }
    });
}

function renderAdminVideoBlockHtml(targetId, scope) {
    const isBase = targetId === 'base';
    const title = scope === 'variant' ? 'Variant video' : 'Product video';
    const sub = scope === 'variant'
        ? 'Overrides product-wide video for this combo · shoppers tap Video on the detail page'
        : 'Default clip for all variants · shoppers tap Video on the detail page';
    return `
        <div class="admin-media-block admin-media-block--video">
            ${adminMediaSectionHead(scope, 'video', title, sub)}
            <div id="${isBase ? 'm-video-preview' : `v-video-preview-${targetId}`}" class="admin-media-preview-grid admin-media-preview-grid--video"></div>
            <label class="admin-media-upload admin-media-upload--video">
                <span class="admin-media-upload__icon">🎬</span>
                <span class="admin-media-upload__text">Upload product video</span>
                <input type="file" accept="video/*" style="display:none;" onchange="handleVideoFileSelect(this, '${targetId}')">
            </label>
            <button type="button" onclick="loadDemo360Video('${targetId}')" class="admin-media-demo-btn admin-media-demo-btn--blue">Use demo 360° video</button>
            <p class="admin-extra-media-tip">After upload you can <strong>preview the clip</strong> and optionally <strong>create rotation frames</strong> for the Rotate button — video still plays separately.</p>
        </div>`;
}
window.renderAdminVideoBlockHtml = renderAdminVideoBlockHtml;

function renderAdminOptional360AccordionHtml(targetId, scope, opts = {}) {
    const isBase = targetId === 'base';
    const v = opts.variant;
    const show360 = opts.show360 !== false;
    if (!show360) return '';
    const toggle = renderAdminToggle;
    const spinVisible = isBase ? 'none' : (v && v.is360 ? 'block' : 'none');
    const panoVisible = isBase ? 'none' : (v && v.is360Panorama ? 'block' : 'none');

    return `
        <div class="admin-media-360-accordion" id="admin-360-accord-${targetId}">
            <div class="admin-media-360-accord-header" onclick="toggleAdmin360Accordion('${targetId}')" role="button" tabindex="0" aria-expanded="false" aria-controls="admin-360-accord-content-${targetId}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleAdmin360Accordion('${targetId}');}">
                <div class="admin-media-360-accord-header-text">
                    <i class="fa fa-street-view" aria-hidden="true"></i>
                    <span>Additional 360° — rotate &amp; panorama</span>
                    <span id="admin-360-accord-summary-${targetId}" class="admin-media-360-accord-summary">Optional — rotate &amp; look-around</span>
                </div>
                <i id="admin-360-accord-icon-${targetId}" class="fa fa-chevron-down admin-media-360-chevron" aria-hidden="true"></i>
            </div>
            <div id="admin-360-accord-content-${targetId}" class="admin-media-360-accord-content" style="display:none;">
                <p class="admin-extra-media-intro">Not needed for every product. <strong>Rotate</strong> = swipe stills to turn the item. <strong>Look Around</strong> = drag a 360° panorama. Copy from gallery or extract from your video above.</p>
                <div class="admin-extra-media-section">
                    ${isBase ? `
                    <div id="m-is360-container" class="admin-media-360-toggle-row">
                        <input type="checkbox" id="m-is360" style="width:auto; margin:0;" onchange="toggle360Badge('base', this.checked);">
                        <label for="m-is360" class="admin-media-360-toggle-label">
                            <span>Enable Rotate Product (spin frames)</span>
                            <span id="base-360-badge" class="admin-media-active-badge" style="display:none;">ACTIVE</span>
                        </label>
                    </div>` : `
                    <div class="admin-media-360-toggles">
                        ${toggle(`v-is360-${targetId}`, !!(v && v.is360), `updateVariant('${targetId}', 'is360', this.checked); renderVariantBlocks(); syncAdmin360AccordionSummary('${targetId}');`, 'Rotate Product (spin frames)', '#FFD700')}
                    </div>`}
                    ${adminSpinFramesSectionHtml(targetId, scope, isBase ? 'none' : spinVisible)}
                </div>
                <div class="admin-extra-media-divider"></div>
                <div class="admin-extra-media-section">
                    ${isBase ? `
                    <div id="m-is360-panorama-container" class="admin-media-360-toggle-row">
                        <input type="checkbox" id="m-is360-panorama" style="width:auto; margin:0;" onchange="toggle360PanoramaBadge('base', this.checked);">
                        <label for="m-is360-panorama" class="admin-media-360-toggle-label">
                            <span>Enable Look Around (panorama)</span>
                            <span id="base-360-pano-badge" class="admin-media-active-badge admin-media-active-badge--blue" style="display:none;">ACTIVE</span>
                        </label>
                    </div>` : `
                    <div class="admin-media-360-toggles">
                        ${toggle(`v-is360-pano-${targetId}`, !!(v && v.is360Panorama), `updateVariant('${targetId}', 'is360Panorama', this.checked); renderVariantBlocks(); syncAdmin360AccordionSummary('${targetId}');`, 'Look Around (panorama)', '#64b5f6')}
                    </div>`}
                    <div id="${isBase ? 'm-panorama-upload-container' : `v-panorama-upload-${targetId}`}" style="display:${isBase ? 'none' : panoVisible}; margin-top:8px;">
                        ${adminMediaSectionHead(scope, 'panorama', 'Immersive panorama', '2:1 equirectangular — drag thumbs to reorder scenes · 👁 to preview')}
                        <div id="${isBase ? 'm-panorama-preview' : `v-panorama-preview-${targetId}`}" class="admin-media-preview-grid admin-media-preview-grid--panorama"></div>
                        <label class="admin-media-upload admin-media-upload--pano">
                            <span class="admin-media-upload__icon">🌐</span>
                            <span class="admin-media-upload__text">Upload panorama</span>
                            <input type="file" multiple accept="image/*" style="display:none;" onchange="handlePanoramaFileSelect(this, '${targetId}')">
                        </label>
                        <button type="button" onclick="loadDemo360Panorama('${targetId}')" class="admin-media-demo-btn admin-media-demo-btn--blue">Use demo panoramas (3 scenes)</button>
                    </div>
                </div>
            </div>
        </div>`;
}
window.renderAdminOptional360AccordionHtml = renderAdminOptional360AccordionHtml;

function previewAdminGallery(targetId, index) {
    const images = targetId === 'base'
        ? (existingImageUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.images || []);
    const urls = images.map(img => adminResolveMediaUrl(img)).filter(Boolean);
    if (!urls.length) return showToast('No gallery photos to preview.');
    if (typeof openMediaViewer !== 'function') return;
    openMediaViewer({
        mode: 'gallery',
        images: urls,
        startIndex: Math.max(0, Math.min(index || 0, urls.length - 1)),
        title: document.getElementById('m-name')?.value || 'Gallery Preview'
    });
}
window.previewAdminGallery = previewAdminGallery;

function previewAdminPanorama(targetId, index) {
    const items = targetId === 'base'
        ? (existingPanoramaUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.panoramaImages || []);
    const urls = items.map(img => adminResolveMediaUrl(img)).filter(Boolean);
    if (!urls.length) return showToast('No panorama to preview.');
    if (typeof openMediaViewer !== 'function') return;
    openMediaViewer({
        mode: 'panorama360',
        panoramaImages: urls,
        panoramaIndex: Math.max(0, Math.min(index || 0, urls.length - 1)),
        title: document.getElementById('m-name')?.value || 'Panorama Preview'
    });
}
window.previewAdminPanorama = previewAdminPanorama;

function previewAdminSwatch(targetId, index) {
    const v = variantBlocks.find(x => x.id === targetId);
    if (!v) return;
    const urls = (v.previewImages || []).map(img => adminResolveMediaUrl(img)).filter(Boolean);
    if (!urls.length) return showToast('No swatch to preview.');
    if (typeof openMediaViewer !== 'function') return;
    openMediaViewer({
        mode: 'gallery',
        images: urls,
        startIndex: Math.max(0, Math.min(index || 0, urls.length - 1)),
        title: 'Pattern / Color Swatch'
    });
}
window.previewAdminSwatch = previewAdminSwatch;

function previewAdminSpinFrame(targetId, index) {
    const items = targetId === 'base'
        ? (existingSpinUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.spinImages || []);
    const url = adminResolveMediaUrl(items[index]);
    if (!url) return;
    if (typeof openMediaViewer !== 'function') return;
    openMediaViewer({
        mode: 'gallery',
        images: [url],
        startIndex: 0,
        title: `Rotation frame ${(index || 0) + 1}`
    });
}
window.previewAdminSpinFrame = previewAdminSpinFrame;

function mergeStoredVideos(listA, listB) {
    const map = new Map();
    [...(listA || []), ...(listB || [])].forEach(v => {
        const n = normalizeStoredVideo(v);
        if (!n) return;
        const key = n.url || (n.file ? `file:${n.file.name}:${n.file.size}` : '');
        if (!key) return;
        const prev = map.get(key);
        map.set(key, prev ? { ...prev, is360: prev.is360 || n.is360, file: prev.file || n.file } : n);
    });
    return [...map.values()];
}

if (typeof window.currentProductFiles === 'undefined') window.currentProductFiles = [];

if (typeof window.adminProductsPageLimitSetting === 'undefined') window.adminProductsPageLimitSetting = 20;
if (typeof window.adminProductsPage === 'undefined') window.adminProductsPage = 1;

function getAdminProductsPageSize() {
    const n = parseInt(window.adminProductsPageLimitSetting, 10);
    return (!n || n < 1) ? 20 : n;
}

function renderAdminProductsPagination(totalFiltered) {
    const container = document.getElementById('admin-load-more-container');
    if (!container) return;
    const pageSize = getAdminProductsPageSize();
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    let page = window.adminProductsPage || 1;
    if (page > totalPages) {
        page = totalPages;
        window.adminProductsPage = page;
    }
    if (!totalFiltered) {
        container.innerHTML = '';
        return;
    }
    if (totalPages <= 1) {
        container.innerHTML = `
            <div class="admin-products-pagination admin-products-pagination--single">
                <span class="admin-products-page-info">${totalFiltered} product${totalFiltered === 1 ? '' : 's'}</span>
            </div>`;
        return;
    }
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalFiltered);
    container.innerHTML = `
        <div class="admin-products-pagination">
            <button type="button" class="admin-products-page-btn" ${page <= 1 ? 'disabled' : ''} onclick="goAdminProductsPage(${page - 1})" aria-label="Previous page">
                <i class="fa fa-chevron-left"></i> Prev
            </button>
            <span class="admin-products-page-info">
                Page ${page} of ${totalPages}<br>
                Showing ${start}–${end} of ${totalFiltered} product${totalFiltered === 1 ? '' : 's'}
            </span>
            <button type="button" class="admin-products-page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="goAdminProductsPage(${page + 1})" aria-label="Next page">
                Next <i class="fa fa-chevron-right"></i>
            </button>
        </div>`;
}

function goAdminProductsPage(page) {
    const totalFiltered = adminGetFilteredProducts().length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / getAdminProductsPageSize()));
    window.adminProductsPage = Math.max(1, Math.min(totalPages, page));
    renderAdmin();
    const anchor = document.getElementById('admin-products-section') || document.getElementById('admin-list');
    if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.goAdminProductsPage = goAdminProductsPage;
if (typeof window.adminProductSearchQuery === 'undefined') window.adminProductSearchQuery = '';
if (typeof window.adminProductFilter === 'undefined') window.adminProductFilter = 'all';
const adminExpandedStockProductIds = new Set();
let adminProductSnapshot = null;

function adminToggleStockExpand(productId) {
    if (adminExpandedStockProductIds.has(productId)) {
        adminExpandedStockProductIds.delete(productId);
    } else {
        adminExpandedStockProductIds.add(productId);
    }
    renderAdmin();
}
window.adminToggleStockExpand = adminToggleStockExpand;

function adminSerializeProductForm() {
    const fileTag = (f) => (f instanceof File ? `file:${f.name}:${f.size}` : String(f || ''));
    const categoryContainer = document.getElementById('m-category-checkboxes');
    const categoryIds = categoryContainer
        ? [...categoryContainer.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value).sort()
        : [];
    return JSON.stringify({
        name: document.getElementById('m-name')?.value || '',
        price: document.getElementById('m-price')?.value || '',
        desc: document.getElementById('m-desc')?.value || '',
        hideMain: !!document.getElementById('m-hide-main')?.checked,
        hideMainDet: !!document.getElementById('m-hide-main-details')?.checked,
        mainPos: document.getElementById('m-main-pos')?.value || '',
        hidePlaceholder: !!document.getElementById('m-hide-main-placeholder')?.checked,
        is360: !!document.getElementById('m-is360')?.checked,
        is360Pano: !!document.getElementById('m-is360-panorama')?.checked,
        trackGlobal: !!document.getElementById('m-track-global-stock')?.checked,
        globalQty: document.getElementById('m-global-stock-qty')?.value || '',
        categoryIds,
        images: (existingImageUrls || []).map(fileTag),
        spins: (existingSpinUrls || []).map(fileTag),
        panos: (existingPanoramaUrls || []).map(fileTag),
        videos: (existingVideoUrls || []).map(v => {
            const n = normalizeStoredVideo(v);
            return n?.file instanceof File ? `file:${n.file.name}` : String(n?.url || '');
        }),
        variants: (variantBlocks || []).map(v => JSON.stringify({
            size: v.size, color: v.color, pattern: v.pattern, price: v.price,
            isActive: v.isActive, images: (v.images || []).map(fileTag).length,
            spin: (v.spinImages || []).length
        }))
    });
}

function adminUrlOnlyMedia(item) {
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (item && typeof item === 'object' && item.url) return item.url;
    return null;
}

function adminHasPendingUploadFiles() {
    const check = (arr) => (arr || []).some(x => x instanceof File);
    if (check(existingImageUrls) || check(existingSpinUrls) || check(existingPanoramaUrls)) return true;
    if ((existingVideoUrls || []).some(v => normalizeStoredVideo(v)?.file instanceof File)) return true;
    return (variantBlocks || []).some(v =>
        check(v.images) || check(v.spinImages) || check(v.panoramaImages) ||
        (v.videos || []).some(vid => normalizeStoredVideo(vid)?.file instanceof File)
    );
}

function adminSerializeVideosForDraft(arr) {
    return (arr || []).map(v => {
        const n = normalizeStoredVideo(v);
        if (!n) return null;
        if (n.file instanceof File) return { pendingFile: true, name: n.file.name, is360: !!n.is360 };
        if (n.url) return { url: n.url, is360: !!n.is360 };
        return null;
    }).filter(Boolean);
}

function adminBuildProductDraftPayload() {
    const categoryContainer = document.getElementById('m-category-checkboxes');
    const categoryIds = categoryContainer
        ? [...categoryContainer.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value)
        : [];
    return {
        editingId: editingId || null,
        name: document.getElementById('m-name')?.value || '',
        price: document.getElementById('m-price')?.value || '',
        desc: document.getElementById('m-desc')?.value || '',
        hideMain: !!document.getElementById('m-hide-main')?.checked,
        hideMainDet: !!document.getElementById('m-hide-main-details')?.checked,
        mainPos: document.getElementById('m-main-pos')?.value || 'end',
        hidePlaceholder: !!document.getElementById('m-hide-main-placeholder')?.checked,
        is360: !!document.getElementById('m-is360')?.checked,
        is360Pano: !!document.getElementById('m-is360-panorama')?.checked,
        trackGlobal: !!document.getElementById('m-track-global-stock')?.checked,
        globalQty: document.getElementById('m-global-stock-qty')?.value || '',
        categoryIds,
        images: (existingImageUrls || []).map(adminUrlOnlyMedia).filter(Boolean),
        spins: (existingSpinUrls || []).map(adminUrlOnlyMedia).filter(Boolean),
        panos: (existingPanoramaUrls || []).map(adminUrlOnlyMedia).filter(Boolean),
        videos: adminSerializeVideosForDraft(existingVideoUrls),
        variants: (variantBlocks || []).map(v => ({
            size: v.size || 'Standard',
            color: v.color || '',
            colorName: v.colorName || '',
            pattern: v.pattern || '',
            patternName: v.patternName || '',
            showPatternText: !!v.showPatternText,
            price: v.price ?? null,
            hideDetailsGallery: !!v.hideDetailsGallery,
            showInMainCarousel: !!v.showInMainCarousel,
            isActive: v.isActive !== false,
            trackVariantStock: !!v.trackVariantStock,
            trackComboStock: !!v.trackComboStock,
            variantStockCount: v.variantStockCount ?? 0,
            trackStock: !!v.trackStock,
            stockCount: v.stockCount || 0,
            stockBySku: { ...(v.stockBySku || {}) },
            is360: !!v.is360,
            is360Panorama: !!v.is360Panorama,
            threeSixtyCols: v.threeSixtyCols || 1,
            threeSixtyRows: v.threeSixtyRows || 1,
            images: (v.images || []).map(adminUrlOnlyMedia).filter(Boolean),
            spinImages: (v.spinImages || []).map(adminUrlOnlyMedia).filter(Boolean),
            panoramaImages: (v.panoramaImages || []).map(adminUrlOnlyMedia).filter(Boolean),
            videos: adminSerializeVideosForDraft(v.videos),
            previewImages: (v.previewImages || []).map(adminUrlOnlyMedia).filter(Boolean)
        })),
        hasPendingFiles: adminHasPendingUploadFiles()
    };
}

function adminMapDraftVariantToBlock(v) {
    const block = mapSavedVariantToBlock({
        ...v,
        images: v.images || [],
        spinImages: v.spinImages || [],
        panoramaImages: v.panoramaImages || [],
        videos: (v.videos || []).map(x => {
            if (!x) return null;
            if (x.file instanceof File) return { file: x.file, url: '', is360: !!x.is360 };
            if (x.url) return { url: x.url, is360: !!x.is360 };
            return null;
        }).filter(Boolean),
        previewImages: v.previewImages || []
    });
    block.id = 'v_' + Math.random().toString(36).substr(2, 9);
    return block;
}

function applyProductDraftForm(form) {
    if (!form) return;
    editingId = form.editingId || null;
    adminSetModalTitle(form.editingId ? 'edit' : 'add');
    adminShowValidationErrors([]);
    document.getElementById('m-name').value = form.name || '';
    document.getElementById('m-price').value = form.price || '';
    document.getElementById('m-desc').value = form.desc || '';
    document.getElementById('m-hide-main').checked = !!form.hideMain;
    document.getElementById('m-hide-main-details').checked = !!form.hideMainDet;
    document.getElementById('m-main-pos').value = form.mainPos || 'end';
    document.getElementById('m-main-pos-container').style.display = form.hideMainDet ? 'none' : 'flex';
    document.getElementById('m-hide-main-placeholder').checked = !!form.hidePlaceholder;
    existingImageUrls = [...(form.images || [])];
    existingSpinUrls = [...(form.spins || [])];
    existingPanoramaUrls = [...(form.panos || [])];
    existingVideoUrls = (form.videos || []).map(v => {
        if (!v) return null;
        if (v.file instanceof File) return { file: v.file, url: '', is360: !!v.is360 };
        if (v.url) return { url: v.url, is360: !!v.is360 };
        return null;
    }).filter(Boolean);
    variantBlocks = (form.variants || []).map(adminMapDraftVariantToBlock);
    syncAdmin360PanelVisibility();
    const mainIs360 = document.getElementById('m-is360');
    if (mainIs360) {
        mainIs360.checked = !!form.is360;
        toggle360Badge('base', !!form.is360);
    }
    const mainIs360Panorama = document.getElementById('m-is360-panorama');
    if (mainIs360Panorama) {
        mainIs360Panorama.checked = !!form.is360Pano;
        toggle360PanoramaBadge('base', !!form.is360Pano);
    }
    if (typeof hydrateGlobalStockForm === 'function') {
        hydrateGlobalStockForm({
            trackGlobalStock: !!form.trackGlobal,
            globalStockCount: parseInt(form.globalQty, 10) || 0
        });
    }
    const trackChk = document.getElementById('m-track-global-stock');
    const qtyEl = document.getElementById('m-global-stock-qty');
    if (trackChk) trackChk.checked = !!form.trackGlobal;
    if (qtyEl) qtyEl.value = form.globalQty || '0';
    if (typeof toggleGlobalStockUI === 'function') toggleGlobalStockUI();
    renderImagePreviews('base');
    renderSpinPreviews('base');
    renderPanoramaPreviews('base');
    renderVideoPreviews('base');
    renderVariantBlocks();
    if (typeof renderProductCategoryCheckboxes === 'function') {
        renderProductCategoryCheckboxes(form.categoryIds || []);
    }
    syncAdmin360AccordionSummary('base');
    syncAdminMediaStatus('base');
    if (!window._adminProductLiveBaseline && editingId) {
        const liveProduct = (products || []).find(x => x.id === editingId);
        window._adminProductLiveBaseline = adminBuildLiveProductSnapshot(liveProduct);
    }
    if (typeof adminActivateProductDraftUi === 'function') {
        adminActivateProductDraftUi(editingId ? 'edit' : 'new');
    }
    adminResetProductSnapshot();
    if (editingId && window._adminProductLiveBaseline) {
        setTimeout(() => adminSyncProductEditDraftUi(), 150);
    }
}
window.applyProductDraftForm = applyProductDraftForm;

function getProductDraftKey(id) {
    const pid = id ?? editingId;
    return pid ? `edit:${pid}` : 'new';
}

window._adminProductLiveBaseline = window._adminProductLiveBaseline || null;
window._adminProductDraftUiActive = window._adminProductDraftUiActive || false;
window._adminProductDraftLoaded = window._adminProductDraftLoaded || false;

let _productDraftUiTimer = null;

function adminDraftHintValue(val, maxLen) {
    const s = String(val ?? '').trim();
    if (!s) return '(empty)';
    return s.length > (maxLen || 48) ? `${s.slice(0, maxLen || 48)}…` : s;
}

function adminBuildLiveProductSnapshot(p) {
    if (!p) return null;
    const categoryIds = typeof getProductCategoryIds === 'function'
        ? [...getProductCategoryIds(p)].sort()
        : [];
    return {
        name: p.name || '',
        price: String(p.price ?? ''),
        desc: p.description || '',
        hideMain: !!p.hideMainCarousel,
        hideMainDet: !!p.hideMainDetailsCarousel,
        mainPos: p.mainImagesPosition || 'end',
        hidePlaceholder: !!p.hideNoImagePlaceholder,
        is360: !!p.is360,
        is360Pano: !!p.is360Panorama,
        trackGlobal: !!p.trackGlobalStock,
        globalQty: String(p.globalStockCount ?? 0),
        categoryIds: categoryIds.join(','),
        imageCount: (p.images || []).length,
        spinCount: (p.spinImages || []).length,
        panoCount: (p.panoramaImages || []).length,
        videoCount: (p.videos || []).length,
        variantCount: (p.variants || []).length
    };
}

function adminBuildCurrentFormCompareSnapshot() {
    const categoryContainer = document.getElementById('m-category-checkboxes');
    const categoryIds = categoryContainer
        ? [...categoryContainer.querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value).sort().join(',')
        : '';
    return {
        name: document.getElementById('m-name')?.value || '',
        price: document.getElementById('m-price')?.value || '',
        desc: document.getElementById('m-desc')?.value || '',
        hideMain: !!document.getElementById('m-hide-main')?.checked,
        hideMainDet: !!document.getElementById('m-hide-main-details')?.checked,
        mainPos: document.getElementById('m-main-pos')?.value || 'end',
        hidePlaceholder: !!document.getElementById('m-hide-main-placeholder')?.checked,
        is360: !!document.getElementById('m-is360')?.checked,
        is360Pano: !!document.getElementById('m-is360-panorama')?.checked,
        trackGlobal: !!document.getElementById('m-track-global-stock')?.checked,
        globalQty: document.getElementById('m-global-stock-qty')?.value || '0',
        categoryIds,
        imageCount: (existingImageUrls || []).length,
        spinCount: (existingSpinUrls || []).length,
        panoCount: (existingPanoramaUrls || []).length,
        videoCount: (existingVideoUrls || []).length,
        variantCount: (variantBlocks || []).length
    };
}

function adminMarkDraftFieldEl(el, isDraft, hint) {
    if (typeof window.adminMarkDraftFieldEl === 'function' && window.adminMarkDraftFieldEl !== adminMarkDraftFieldEl) {
        window.adminMarkDraftFieldEl(el, isDraft, hint);
        return;
    }
    if (!el) return;
    el.classList.toggle('admin-field--draft', !!isDraft);
    if (isDraft && hint) {
        el.setAttribute('title', hint);
        el.setAttribute('aria-description', hint);
    } else {
        el.removeAttribute('title');
        el.removeAttribute('aria-description');
    }
}

function adminMarkDraftSectionEl(el, isDraft, hint) {
    if (typeof window.adminMarkDraftSectionEl === 'function' && window.adminMarkDraftSectionEl !== adminMarkDraftSectionEl) {
        window.adminMarkDraftSectionEl(el, isDraft, hint);
        return;
    }
    if (!el) return;
    el.classList.toggle('admin-section--draft', !!isDraft);
    if (isDraft && hint) el.setAttribute('title', hint);
    else el.removeAttribute('title');
}

function adminClearProductDraftUi() {
    window._adminProductDraftUiActive = false;
    window._adminProductDraftLoaded = false;
    const modal = document.getElementById('prod-modal');
    if (modal) modal.classList.remove('prod-modal--draft-view');
    const bar = document.getElementById('admin-product-draft-mode-bar');
    if (bar) {
        bar.hidden = true;
        bar.style.display = 'none';
    }
    document.querySelectorAll('#prod-modal .admin-field--draft, #prod-modal .admin-section--draft').forEach(el => {
        el.classList.remove('admin-field--draft', 'admin-section--draft');
        el.removeAttribute('title');
        el.removeAttribute('aria-description');
    });
}
window.adminClearProductDraftUi = adminClearProductDraftUi;

function adminSyncProductEditDraftUi() {
    if (!window._adminProductLiveBaseline) return;
    const dirty = typeof adminIsProductDirty === 'function' && adminIsProductDirty();
    if (!dirty && !window._adminProductDraftLoaded) {
        const bar = document.getElementById('admin-product-draft-mode-bar');
        if (bar) {
            bar.hidden = true;
            bar.style.display = 'none';
        }
        document.querySelectorAll('#prod-modal .admin-field--draft, #prod-modal .admin-section--draft').forEach(el => {
            el.classList.remove('admin-field--draft', 'admin-section--draft');
            el.removeAttribute('title');
            el.removeAttribute('aria-description');
        });
        window._adminProductDraftUiActive = false;
        return;
    }
    window._adminProductDraftUiActive = true;
    const modal = document.getElementById('prod-modal');
    if (modal) modal.classList.add('prod-modal--draft-view');
    const bar = document.getElementById('admin-product-draft-mode-bar');
    const textEl = bar?.querySelector('.admin-draft-mode-bar__text');
    if (bar) {
        bar.hidden = false;
        bar.style.display = '';
    }
    if (textEl) {
        textEl.innerHTML = window._adminProductDraftLoaded
            ? '<strong>Draft view</strong> — amber fields differ from actual (live). Hover for the live value.'
            : '<strong>Actual view</strong> — amber fields differ from what is live. Save Product to publish or save as draft.';
    }
    adminSyncProductDraftFieldUi();
}

function adminActivateProductDraftUi(mode) {
    window._adminProductDraftUiActive = true;
    window._adminProductDraftLoaded = true;
    const modal = document.getElementById('prod-modal');
    if (modal) modal.classList.add('prod-modal--draft-view');
    const bar = document.getElementById('admin-product-draft-mode-bar');
    const textEl = bar?.querySelector('.admin-draft-mode-bar__text');
    if (bar) bar.hidden = false;
    if (textEl) {
        textEl.innerHTML = mode === 'edit'
            ? '<strong>Draft view</strong> — amber fields differ from actual (live). Hover for the live value. Publish with <em>Save Product</em> to go live.'
            : '<strong>New product draft</strong> — not on the storefront yet. Amber fields are draft-only until you publish.';
    }
    adminSyncProductDraftFieldUi();
}
window.adminActivateProductDraftUi = adminActivateProductDraftUi;

function adminSyncProductDraftFieldUi() {
    if (!window._adminProductDraftUiActive) return;
    const live = window._adminProductLiveBaseline;
    const isNew = !live;
    const cur = adminBuildCurrentFormCompareSnapshot();

    const differs = (key, emptyMeansDraft) => {
        if (isNew) return emptyMeansDraft ? !!String(cur[key] ?? '').trim() || cur[key] === true : !!cur[key];
        return String(cur[key] ?? '') !== String(live[key] ?? '');
    };

    const hint = (key, label, formatter) => {
        if (isNew) return `Draft — ${label} is not published yet`;
        const liveVal = formatter ? formatter(live[key]) : adminDraftHintValue(live[key]);
        return `Draft ${label} — published: ${liveVal}`;
    };

    adminMarkDraftFieldEl(document.getElementById('m-name'), differs('name', true), hint('name', 'name'));
    adminMarkDraftFieldEl(document.getElementById('m-price'), differs('price', true), hint('price', 'price', v => `₹${v || '0'}`));
    adminMarkDraftFieldEl(document.getElementById('m-desc'), differs('desc', true), hint('desc', 'description'));

    const catContainer = document.getElementById('m-category-container');
    adminMarkDraftSectionEl(catContainer, differs('categoryIds', true), isNew
        ? 'Draft categories — not published yet'
        : `Draft categories — published selection differs`);

    adminMarkDraftSectionEl(
        document.getElementById('m-global-stock-container'),
        differs('trackGlobal') || differs('globalQty'),
        isNew ? 'Draft stock settings — not published' : 'Draft stock — differs from published product'
    );

    const galleryPanel = document.querySelector('#prod-modal .admin-media-panel--global');
    const mediaDiff = differs('imageCount') || differs('spinCount') || differs('panoCount') || differs('videoCount');
    adminMarkDraftSectionEl(galleryPanel, mediaDiff, isNew
        ? 'Draft media — not on storefront until published'
        : 'Draft media — differs from published listing');

    adminMarkDraftSectionEl(
        document.getElementById('m-variants-container'),
        differs('variantCount'),
        isNew ? 'Draft variants — not published' : 'Draft variants — differ from published product'
    );

    adminMarkDraftFieldEl(document.getElementById('m-hide-main'), differs('hideMain'), hint('hideMain', 'home carousel visibility', v => v ? 'hidden' : 'shown'));
    adminMarkDraftFieldEl(document.getElementById('m-hide-main-details'), differs('hideMainDet'), hint('hideMainDet', 'details carousel visibility', v => v ? 'hidden' : 'shown'));
    adminMarkDraftFieldEl(document.getElementById('m-main-pos'), differs('mainPos'), hint('mainPos', 'main image position'));
    adminMarkDraftFieldEl(document.getElementById('m-hide-main-placeholder'), differs('hidePlaceholder'), hint('hidePlaceholder', 'placeholder visibility', v => v ? 'hidden' : 'shown'));
    adminMarkDraftFieldEl(document.getElementById('m-is360'), differs('is360'), hint('is360', 'rotate 360°', v => v ? 'on' : 'off'));
    adminMarkDraftFieldEl(document.getElementById('m-is360-panorama'), differs('is360Pano'), hint('is360Pano', 'look around panorama', v => v ? 'on' : 'off'));
}
window.adminSyncProductDraftFieldUi = adminSyncProductDraftFieldUi;

function adminProductDraftPayloadHasContent(form) {
    if (!form) return false;
    if ((form.name || '').trim()) return true;
    if ((form.desc || '').trim()) return true;
    if (form.price !== '' && form.price != null) return true;
    if (form.images?.length || form.spins?.length || form.panos?.length || form.videos?.length) return true;
    if (form.variants?.length) return true;
    if (form.hasPendingFiles) return true;
    return false;
}

function adminProductFormHasDraftableContent() {
    return adminProductDraftPayloadHasContent(adminBuildProductDraftPayload());
}
window.adminProductFormHasDraftableContent = adminProductFormHasDraftableContent;

function adminFinalizeProductModalClose() {
    if (typeof flushProductDraft === 'function') flushProductDraft();
    if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
    if (typeof scheduleAdminDraftUiRefresh === 'function') scheduleAdminDraftUiRefresh();
}
window.adminFinalizeProductModalClose = adminFinalizeProductModalClose;

function flushProductDraft() {
    if (typeof adminAutoSaveProductDraft === 'function') {
        adminAutoSaveProductDraft({ silent: true, force: true });
        return true;
    }
    const modal = document.getElementById('prod-modal');
    if (!modal || modal.style.display !== 'flex') return false;
    if (typeof adminCrudDraftsEnabled === 'function' && !adminCrudDraftsEnabled()) return false;
    if (typeof adminIsProductDirty === 'function' && !adminIsProductDirty()) return false;
    const form = adminBuildProductDraftPayload();
    if (!adminProductDraftPayloadHasContent(form)) return false;
    const key = getProductDraftKey(form.editingId);
    if (typeof adminDraftUpsert === 'function') {
        return adminDraftUpsert('product', key, {
            entityId: form.editingId || null,
            label: (form.name || '').trim() || (form.editingId ? 'Product edit' : 'New product'),
            form
        }, { skipUi: true });
    }
    return false;
}
window.flushProductDraft = flushProductDraft;

function adminGetOrphanedNewProductDraftEntry() {
    return typeof adminGetOrphanedNewProductDraft === 'function' ? adminGetOrphanedNewProductDraft() : null;
}

function adminProductHasEditDraft(id) {
    return typeof adminDraftIsVisible === 'function' && adminDraftIsVisible('product', `edit:${id}`);
}

function adminNewProductDraftRowHtml() {
    const item = adminGetOrphanedNewProductDraftEntry();
    if (!item?.entry?.form) return '';
    const form = item.entry.form;
    const label = (form.name || '').trim() || 'Untitled product';
    const priceLabel = form.price ? `₹${Number(form.price) || 0}` : '—';
    const age = typeof adminDraftFormatAge === 'function' ? adminDraftFormatAge(item.entry.updatedAt) : '';
    let thumbUrl = 'https://placehold.co/400x400/1a1a1a/666?text=Draft';
    if (form.images?.length) thumbUrl = form.images[0];
    else if (form.variants?.length) {
        const v = form.variants.find(x => x.images?.length);
        if (v) thumbUrl = v.images[0];
    }
    const safeName = label.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const pendingNote = form.hasPendingFiles ? '<span class="admin-draft-indicator admin-draft-indicator--warn">Re-upload files</span>' : '';
    return `
        <div class="admin-product-row admin-product-row--draft" role="button" tabindex="0" onclick="adminOpenNewProductDraft()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();adminOpenNewProductDraft();}">
            <div class="admin-product-thumb-wrap admin-product-thumb-wrap--draft">
                <img src="${thumbUrl}" class="admin-product-thumb" alt="" loading="lazy">
                <span class="admin-draft-indicator">Draft</span>
            </div>
            <div class="admin-product-body">
                <div class="admin-product-title-row">
                    <b class="admin-product-name">${safeName}</b>
                    <span class="admin-product-price">${priceLabel}</span>
                    <span class="admin-draft-age">Saved ${age}</span>
                    ${pendingNote}
                </div>
                <p class="admin-product-draft-hint">Unsaved new product — tap to continue, publish, or save as draft</p>
            </div>
            <div class="admin-product-actions">
                <i class="fa fa-play" title="Continue draft" onclick="event.stopPropagation();adminOpenNewProductDraft()"></i>
                <i class="fa fa-trash" title="Delete draft" onclick="event.stopPropagation();adminDeleteNewProductDraft()"></i>
            </div>
        </div>`;
}

window.adminOpenNewProductDraft = function() {
    if (typeof adminRestoreDraft === 'function') adminRestoreDraft('product', 'new');
};

window.adminDeleteNewProductDraft = function() {
    if (typeof adminDeleteDraft === 'function') adminDeleteDraft('product', 'new');
};

function persistProductDraft() {
    flushProductDraft();
    if (typeof updateAdminNewProductDraftBadge === 'function') updateAdminNewProductDraftBadge();
}
window.persistProductDraft = persistProductDraft;

function clearProductDraftForCurrent() {
    if (typeof adminDraftRemove === 'function') adminDraftRemove('product', getProductDraftKey(editingId));
}

async function saveProductAsDraft(silent) {
    if (typeof adminCrudDraftsEnabled === 'function' && !adminCrudDraftsEnabled()) {
        if (!silent) showToast('Drafts are disabled in Superadmin settings.');
        return false;
    }
    let form = adminBuildProductDraftPayload();
    if (!adminProductDraftPayloadHasContent(form)) {
        if (!silent) showToast('Add a name, price, or details before saving as draft.');
        return false;
    }
    const key = getProductDraftKey(form.editingId);
    if (typeof adminDraftPrepareProductFormForSave === 'function' &&
        typeof adminCrudDraftsMediaEnabled === 'function' && adminCrudDraftsMediaEnabled()) {
        try {
            form = await adminDraftPrepareProductFormForSave(form, key);
        } catch (e) {
            console.warn('saveProductAsDraft media persist failed:', e);
        }
    }
    if (typeof adminDraftUpsert === 'function') {
        adminDraftUpsert('product', key, {
            entityId: form.editingId || null,
            label: (form.name || '').trim() || (form.editingId ? 'Product edit' : 'New product'),
            form
        }, { skipUi: true });
    }
    if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
    adminProductSnapshot = null;
    if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
    window._adminProductLiveBaseline = null;
    if (typeof adminHideSaveProgress === 'function') adminHideSaveProgress();
    closeModal('prod-modal');
    if (typeof scheduleAdminDraftUiRefresh === 'function') scheduleAdminDraftUiRefresh();
    if (!silent) showToast('Saved as draft.');
    return true;
}
window.saveProductAsDraft = saveProductAsDraft;

function discardProductDraft(silent) {
    clearProductDraftForCurrent();
    if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
    adminProductSnapshot = null;
    if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
    window._adminProductLiveBaseline = null;
    closeModal('prod-modal');
    if (typeof scheduleAdminDraftUiRefresh === 'function') scheduleAdminDraftUiRefresh();
    if (!silent) showToast('Draft discarded.');
}
window.discardProductDraft = discardProductDraft;

function renderProductModalDraftBanner() {
    const el = document.getElementById('admin-product-draft-banner');
    const switcher = document.getElementById('admin-product-draft-switcher');
    if (switcher && !switcher.hidden) {
        if (el) { el.hidden = true; el.innerHTML = ''; }
        return;
    }
    if (!el) return;
    if (!editingId || typeof adminDraftGetEntry !== 'function') {
        el.hidden = true;
        el.innerHTML = '';
        return;
    }
    const key = `edit:${editingId}`;
    if (typeof adminDraftIsActive === 'function' && adminDraftIsActive('product', key) && window._adminProductDraftLoaded) {
        el.hidden = true;
        el.innerHTML = '';
        return;
    }
    const item = adminDraftGetEntry('product', key);
    if (!item) {
        el.hidden = true;
        el.innerHTML = '';
        return;
    }
    const age = item && typeof adminDraftFormatAge === 'function' ? adminDraftFormatAge(item.entry.updatedAt) : '';
    el.hidden = false;
    el.innerHTML = `
        <div class="admin-draft-banner admin-draft-banner--modal">
            <div class="admin-draft-banner__text">
                <strong>Unpublished draft</strong> saved ${age}
                <div class="admin-draft-recovery-hint">Switch to Draft tab above, or compare actual vs draft</div>
            </div>
            <div class="admin-draft-banner__actions">
                <button type="button" class="btn-gold admin-draft-btn-continue" onclick="adminLoadEditProductDraft()">Load draft</button>
                <button type="button" class="admin-btn-secondary admin-draft-btn-compare" onclick="adminOpenProductDraftCompare()"><i class="fa fa-columns"></i> Compare</button>
                <button type="button" class="admin-btn-secondary admin-draft-btn-delete" onclick="adminDiscardEditProductDraft()">Delete draft</button>
                <button type="button" class="admin-btn-secondary admin-draft-btn-original" onclick="adminLoadOriginalProduct()">Load original</button>
            </div>
        </div>`;
}
window.renderProductModalDraftBanner = renderProductModalDraftBanner;

window.adminLoadEditProductDraft = function() {
    if (!editingId) return;
    const modal = document.getElementById('prod-modal');
    if (modal?.style.display === 'flex' && typeof adminSwitchProductView === 'function') {
        adminSwitchProductView('draft');
        return;
    }
    if (typeof adminRestoreDraft === 'function') adminRestoreDraft('product', `edit:${editingId}`);
};

window.adminDiscardEditProductDraft = function() {
    if (!editingId) return;
    const wasDraft = window._adminProductViewMode === 'draft';
    if (typeof adminDeleteDraft === 'function') adminDeleteDraft('product', `edit:${editingId}`);
    window._adminProductViewMode = 'live';
    window._adminProductDraftLoaded = false;
    if (wasDraft) {
        const p = (products || []).find(x => x.id === editingId);
        if (p && typeof adminApplyLiveProductToForm === 'function') adminApplyLiveProductToForm(p);
        if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
    }
    if (typeof adminRenderProductDraftSwitcher === 'function') adminRenderProductDraftSwitcher();
    renderProductModalDraftBanner();
};

function adminBindProductDraftListeners() {
    const modal = document.getElementById('prod-modal');
    if (!modal || modal.dataset.draftUiBound) return;
    modal.dataset.draftUiBound = '1';
    const onChange = () => {
        clearTimeout(_productDraftUiTimer);
        _productDraftUiTimer = setTimeout(() => {
            if (window._adminProductDraftUiActive || window._adminProductDraftLoaded) {
                adminSyncProductDraftFieldUi();
            } else if (window._adminProductLiveBaseline) {
                adminSyncProductEditDraftUi();
            }
        }, 200);
        if (typeof adminScheduleProductDraftSave === 'function') adminScheduleProductDraftSave();
    };
    modal.addEventListener('input', onChange);
    modal.addEventListener('change', onChange);
}

function adminTryRestoreProductDraft(expectedId) {
    /* Recovery handled by admin draft panel after reload/timeout — no auto-prompt. */
    return false;
}

function adminResetProductSnapshot() {
    setTimeout(() => { adminProductSnapshot = adminSerializeProductForm(); }, 120);
}

function adminIsProductDirty() {
    if (!adminProductSnapshot) return false;
    return adminProductSnapshot !== adminSerializeProductForm();
}

async function closeProductModal() {
    if (typeof adminGuardProductLeave === 'function') {
        await adminGuardProductLeave('Publish, save as draft, or discard your changes?', () => {
            adminProductSnapshot = null;
            if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
            window._adminProductLiveBaseline = null;
            if (typeof adminHideSaveProgress === 'function') adminHideSaveProgress();
            if (typeof flushProductDraft === 'function') flushProductDraft();
            if (typeof adminDraftClearActive === 'function') adminDraftClearActive();
            closeModal('prod-modal');
            if (typeof scheduleAdminDraftUiRefresh === 'function') scheduleAdminDraftUiRefresh();
        });
        return;
    }
    if (adminIsProductDirty()) {
        if (!confirm('You have unsaved changes. Close without saving?')) return;
    }
    adminProductSnapshot = null;
    if (typeof adminHideSaveProgress === 'function') adminHideSaveProgress();
    closeModal('prod-modal');
}
window.closeProductModal = closeProductModal;

function adminSetModalTitle(mode) {
    const el = document.getElementById('m-modal-title');
    if (!el) return;
    if (mode === 'edit') el.textContent = 'Edit Product';
    else if (mode === 'copy') el.textContent = 'Duplicate Product';
    else el.textContent = 'Add New Product';
}

function adminFilterProducts() {
    const searchEl = document.getElementById('admin-product-search');
    const filterEl = document.getElementById('admin-product-filter');
    adminProductSearchQuery = searchEl ? searchEl.value : '';
    adminProductFilter = filterEl ? filterEl.value : 'all';
    window.adminProductsPage = 1;
    renderAdmin();
}
window.adminFilterProducts = adminFilterProducts;

function adminProductHasVariants(p) {
    return !!(p.variants && Array.isArray(p.variants) && p.variants.length > 0);
}

function adminProductHasGalleryImages(p) {
    if (p.images && p.images.length) return true;
    if (!adminProductHasVariants(p)) return false;
    return p.variants.some(v => v.images && v.images.length);
}

function adminProductHasCategory(p) {
    if (typeof getProductCategoryIds === 'function') {
        return getProductCategoryIds(p).length > 0;
    }
    return !!(p.categoryId || p.categoryName || (p.categoryIds && p.categoryIds.length));
}

function adminProductHasAnyMedia(p) {
    if (adminProductHasGalleryImages(p)) return true;
    if (p.videos && p.videos.length) return true;
    if (p.is360 || p.is360Panorama) return true;
    if (p.spinImages && p.spinImages.length) return true;
    if (p.panoramaImages && p.panoramaImages.length) return true;
    if (adminProductHasVariants(p)) {
        return p.variants.some(v =>
            (v.videos && v.videos.length) || v.is360 || v.is360Panorama
            || (v.spinImages && v.spinImages.length) || (v.panoramaImages && v.panoramaImages.length)
        );
    }
    return false;
}

function adminProductHasVideo(p) {
    if (p.videos && p.videos.length) return true;
    if (adminProductHasVariants(p)) {
        return p.variants.some(v => v.videos && v.videos.length);
    }
    return false;
}

function adminProductHasSpin(p) {
    if (p.is360 || (p.spinImages && p.spinImages.length)) return true;
    if (adminProductHasVariants(p)) {
        return p.variants.some(v => v.is360 || (v.spinImages && v.spinImages.length));
    }
    return false;
}

function adminProductHasPanorama(p) {
    if (p.is360Panorama || (p.panoramaImages && p.panoramaImages.length)) return true;
    if (adminProductHasVariants(p)) {
        return p.variants.some(v => v.is360Panorama || (v.panoramaImages && v.panoramaImages.length));
    }
    return false;
}

function adminGetFilteredProducts() {
    let list = products || [];
    const q = (adminProductSearchQuery || '').trim().toLowerCase();
    if (q) {
        list = list.filter(p => {
            const name = (p.name || '').toLowerCase();
            const cat = (typeof resolveProductCategoryLabel === 'function' ? resolveProductCategoryLabel(p) : (p.categoryName || '')).toLowerCase();
            const id = (p.id || '').toLowerCase();
            const price = String(p.price || '');
            return name.includes(q) || cat.includes(q) || id.includes(q) || price.includes(q);
        });
    }
    switch (adminProductFilter) {
        case 'oos':
            list = list.filter(p => typeof isProductOutOfStock === 'function' && isProductOutOfStock(p));
            break;
        case 'in_stock':
            list = list.filter(p => !(typeof isProductOutOfStock === 'function' && isProductOutOfStock(p)));
            break;
        case 'no_variants':
            list = list.filter(p => !adminProductHasVariants(p));
            break;
        case 'variants':
            list = list.filter(adminProductHasVariants);
            break;
        case 'no_images':
            list = list.filter(p => !adminProductHasGalleryImages(p));
            break;
        case 'no_category':
            list = list.filter(p => !adminProductHasCategory(p));
            break;
        case 'no_media':
            list = list.filter(p => !adminProductHasAnyMedia(p));
            break;
        case 'media':
            list = list.filter(adminProductHasAnyMedia);
            break;
        case 'has_video':
            list = list.filter(adminProductHasVideo);
            break;
        case 'has_spin':
            list = list.filter(adminProductHasSpin);
            break;
        case 'has_panorama':
            list = list.filter(adminProductHasPanorama);
            break;
        default:
            break;
    }
    return list;
}

function adminGetVariantBlockErrors(v, index) {
    const errors = [];
    const variantTracksStock = !!(v.trackVariantStock || v.trackComboStock || v.trackStock);
    const isStockError = variantTracksStock && (typeof expandVariantBlockSkus === 'function'
        ? (v.trackComboStock
            ? expandVariantBlockSkus(v).some(sku => {
                const q = getVariantSkuStock(v, sku.key);
                return q === undefined || q === null || isNaN(q) || q < 0;
            })
            : (getVariantBlockStockCount(v) === undefined || getVariantBlockStockCount(v) === null || isNaN(getVariantBlockStockCount(v)) || getVariantBlockStockCount(v) < 0))
        : (v.stockCount === undefined || v.stockCount === null || isNaN(v.stockCount) || v.stockCount < 0));
    const isPriceError = v.price !== '' && v.price !== null && v.price !== undefined && (isNaN(v.price) || Number(v.price) < 0);
    if (isStockError) errors.push(`Variant ${index + 1}: stock quantity is invalid.`);
    if (isPriceError) errors.push(`Variant ${index + 1}: custom price is invalid.`);
    return errors;
}

function adminValidateProductForm() {
    const errors = [];
    const name = document.getElementById('m-name')?.value?.trim();
    const priceRaw = document.getElementById('m-price')?.value;
    if (!name) errors.push('Product name is required.');
    if (priceRaw === '' || priceRaw === null || isNaN(Number(priceRaw)) || Number(priceRaw) < 0) {
        errors.push('Enter a valid base price (0 or more).');
    }
    if (document.getElementById('m-track-global-stock')?.checked) {
        const qty = parseInt(document.getElementById('m-global-stock-qty')?.value, 10);
        if (isNaN(qty) || qty < 0) errors.push('Global stock quantity must be 0 or more.');
    }
    (variantBlocks || []).forEach((v, i) => {
        errors.push(...adminGetVariantBlockErrors(v, i));
    });
    return errors;
}

function adminShowValidationErrors(errors) {
    const el = document.getElementById('m-validation-errors');
    if (!el) return;
    if (!errors.length) {
        el.style.display = 'none';
        el.innerHTML = '';
        return;
    }
    el.style.display = 'block';
    el.innerHTML = `<strong>Fix before saving:</strong><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function deleteProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return showToast('Product not found.');
    const safeName = (p.name || 'this product').replace(/"/g, "'");
    if (!confirm(`Delete "${safeName}"?\n\nThis removes the product from your catalog. Media files stay on Cloudinary until a superadmin purge.`)) return;
    try {
        await db.collection('products').doc(id).delete();
        showToast(`Deleted "${safeName}".`);
    } catch (e) {
        console.error(e);
        showToast('Could not delete product: ' + (e.message || 'Unknown error'));
    }
}
window.deleteProduct = deleteProduct;

function adminProductMediaBadges(p) {
    const badges = [];
    if (p.videos && p.videos.length) badges.push('<span class="admin-product-media-badge admin-product-media-badge--video" title="Has video">▶</span>');
    if (p.is360 || (p.spinImages && p.spinImages.length >= 2)) badges.push('<span class="admin-product-media-badge admin-product-media-badge--spin" title="Rotate frames">↻</span>');
    if (p.is360Panorama || (p.panoramaImages && p.panoramaImages.length)) badges.push('<span class="admin-product-media-badge admin-product-media-badge--pano" title="Panorama">◎</span>');
    const vCount = (p.variants && p.variants.length) || 0;
    if (vCount) badges.push(`<span class="admin-product-media-badge admin-product-media-badge--variant" title="${vCount} variant block(s)">${vCount}v</span>`);
    return badges.length ? `<span class="admin-product-media-badges">${badges.join('')}</span>` : '';
}


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

function toggleAdminGuideSection(sectionId) {
    const content = document.getElementById(`admin-guide-section-${sectionId}`);
    const icon = document.getElementById(`admin-guide-section-icon-${sectionId}`);
    const accordion = document.getElementById(`admin-guide-section-accord-${sectionId}`);
    const header = accordion?.querySelector('.admin-guide-section-header');
    if (!content || !accordion) return;
    const shouldOpen = content.style.display === 'none' || !content.style.display;
    content.style.display = shouldOpen ? 'block' : 'none';
    accordion.classList.toggle('is-open', shouldOpen);
    if (icon) icon.style.transform = shouldOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (header) header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}
window.toggleAdminGuideSection = toggleAdminGuideSection;

function toggleProductGuideAccordion(forceOpen) {
    const content = document.getElementById('admin-product-guide-content');
    const icon = document.getElementById('admin-product-guide-icon');
    const accordion = document.getElementById('admin-product-guide-accordion');
    const header = accordion?.querySelector('.admin-product-guide-header');
    if (!content || !accordion) return;

    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : content.style.display === 'none';
    content.style.display = shouldOpen ? 'block' : 'none';
    accordion.classList.toggle('is-open', shouldOpen);
    if (icon) icon.style.transform = shouldOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (header) header.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}
window.toggleProductGuideAccordion = toggleProductGuideAccordion;

function resetProductGuideAccordion() {
    toggleProductGuideAccordion(false);
    ['media-types', 'extract-frames', 'panorama', 'video', '360-panel', 'variants', 'admin-tools'].forEach((id) => {
        const content = document.getElementById(`admin-guide-section-${id}`);
        const icon = document.getElementById(`admin-guide-section-icon-${id}`);
        const accordion = document.getElementById(`admin-guide-section-accord-${id}`);
        if (content) content.style.display = 'none';
        if (accordion) accordion.classList.remove('is-open');
        if (icon) icon.style.transform = 'rotate(-90deg)';
    });
}
window.resetProductGuideAccordion = resetProductGuideAccordion;

function mapSavedVariantToBlock(v) {
    const block = {
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
        trackVariantStock: !!v.trackVariantStock,
        trackComboStock: !!v.trackComboStock,
        variantStockCount: v.variantStockCount ?? v.stockCount ?? 0,
        trackStock: !!v.trackStock,
        stockCount: v.stockCount || 0,
        stockBySku: { ...(v.stockBySku || {}) },
        is360: !!v.is360,
        is360Panorama: !!v.is360Panorama,
        threeSixtyCols: v.threeSixtyCols || 1,
        threeSixtyRows: v.threeSixtyRows || 1,
        spinImages: [...(v.spinImages || [])],
        panoramaImages: [...(v.panoramaImages || [])],
        videos: (v.videos || []).map(normalizeStoredVideo).filter(Boolean),
        images: [...(v.images || [])],
        previewImages: v.previewImages || (v.previewImage ? [v.previewImage] : [])
    };
    migrateVariantStockFields(block);
    return block;
}

function toggleGlobalStockUI() {
    const on = !!document.getElementById('m-track-global-stock')?.checked;
    const wrap = document.getElementById('m-global-stock-qty-wrap');
    if (wrap) wrap.style.display = on ? 'flex' : 'none';
}
window.toggleGlobalStockUI = toggleGlobalStockUI;

function hydrateGlobalStockForm(p) {
    const trackEl = document.getElementById('m-track-global-stock');
    const qtyEl = document.getElementById('m-global-stock-qty');
    if (!trackEl || !qtyEl) return;
    trackEl.checked = !!(p && p.trackGlobalStock);
    qtyEl.value = p && p.trackGlobalStock ? (parseInt(p.globalStockCount, 10) || 0) : '';
    toggleGlobalStockUI();
}
window.hydrateGlobalStockForm = hydrateGlobalStockForm;

function readGlobalStockFromForm() {
    const trackEl = document.getElementById('m-track-global-stock');
    const qtyEl = document.getElementById('m-global-stock-qty');
    const trackGlobalStock = !!trackEl?.checked;
    return {
        trackGlobalStock,
        globalStockCount: trackGlobalStock ? Math.max(0, parseInt(qtyEl?.value, 10) || 0) : 0
    };
}
window.readGlobalStockFromForm = readGlobalStockFromForm;

function ensureVariantStockMap(v) {
    if (!v.stockBySku || typeof v.stockBySku !== 'object') v.stockBySku = {};
}

function getVariantSkuStock(v, skuKey) {
    ensureVariantStockMap(v);
    if (Object.prototype.hasOwnProperty.call(v.stockBySku, skuKey)) {
        return parseInt(v.stockBySku[skuKey], 10) || 0;
    }
    return parseInt(v.stockCount, 10) || 0;
}

function migrateVariantStockFields(v) {
    if (v.trackVariantStock === undefined && v.trackComboStock === undefined) {
        if (v.trackStock) {
            const skus = (typeof expandVariantBlockSkus === 'function') ? expandVariantBlockSkus(v) : [];
            const hasSkuMap = v.stockBySku && typeof v.stockBySku === 'object' && Object.keys(v.stockBySku).length > 0;
            if (skus.length > 1 && hasSkuMap) {
                v.trackComboStock = true;
                v.trackVariantStock = false;
            } else {
                v.trackVariantStock = true;
                v.trackComboStock = false;
            }
        } else {
            v.trackVariantStock = false;
            v.trackComboStock = false;
        }
    }
    if (v.variantStockCount === undefined || v.variantStockCount === null) {
        v.variantStockCount = parseInt(v.stockCount, 10) || 0;
    }
    ensureVariantStockMap(v);
}

function updateVariantBlockStock(vId, qty) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    const n = Math.max(0, parseInt(qty, 10) || 0);
    v.variantStockCount = n;
    v.stockCount = n;
}
window.updateVariantBlockStock = updateVariantBlockStock;

function renderAdminToggle(id, checked, onChange, label, color) {
    return `
            <label class="toggle-container" style="display:flex; align-items:center; gap:10px; cursor:pointer; user-select:none; padding:8px 10px; border-radius:8px; background:#111; border:1px solid #2a2a2a; min-width:0; flex:1; --toggle-color:${color || '#FFD700'};">
                <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} onchange="${onChange}" class="toggle-input" style="opacity:0; width:0; height:0; position:absolute;">
                <div class="toggle-track-container" style="position:relative; width:38px; height:20px; flex-shrink:0; pointer-events:none;">
                    <span class="toggle-track" style="position:absolute; inset:0; border-radius:20px; background:#333; transition:0.2s;"></span>
                    <span class="toggle-handle" style="position:absolute; top:3px; left:3px; width:14px; height:14px; border-radius:50%; background:#fff; transition:0.2s;"></span>
                </div>
                <span class="toggle-label" style="font-size:12px; color:#777; line-height:1.3;">${label}</span>
            </label>`;
}

function buildVariantStockHtml(v) {
    migrateVariantStockFields(v);
    const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const skus = (typeof expandVariantBlockSkus === 'function') ? expandVariantBlockSkus(v) : [];

    const blockQty = parseInt(v.variantStockCount ?? v.stockCount, 10) || 0;
    const blockSection = `
                    <div style="padding:8px 10px; border-radius:8px; background:#0d0d0d; border:1px solid #2a2a2a; grid-column:1 / -1;">
                        <p style="margin:0 0 6px; font-size:10px; color:#ffb347; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Level 2 · Whole variant</p>
                        <p style="margin:0 0 8px; font-size:10px; color:#666; line-height:1.35;">One quantity shared by every size/color/pattern in this block. Overrides product global.</p>
                        ${renderAdminToggle(`v-track-block-${v.id}`, !!v.trackVariantStock, `updateVariant('${v.id}', 'trackVariantStock', this.checked); renderVariantBlocks();`, 'Track whole-variant stock', '#ffb347')}
                        <div id="v-block-stock-qty-${v.id}" style="display:${v.trackVariantStock ? 'block' : 'none'}; margin-top:8px;">
                            <input type="number" min="0" placeholder="0" value="${blockQty}" oninput="updateVariantBlockStock('${v.id}', this.value)" style="width:100%; max-width:140px; box-sizing:border-box; padding:6px 8px; border-radius:6px; border:1px solid #444; background:#222; color:#FFD700; font-size:13px; font-weight:700; text-align:center;">
                            <span style="display:block; margin-top:4px; font-size:10px; color:#666;">units for this entire variant block</span>
                        </div>
                    </div>`;

    let comboSection = `
                    <div style="padding:8px 10px; border-radius:8px; background:#0d0d0d; border:1px solid #2a2a2a; grid-column:1 / -1; margin-top:6px;">
                        <p style="margin:0 0 6px; font-size:10px; color:#FFD700; font-weight:700; text-transform:uppercase; letter-spacing:0.4px;">Level 3 · Per combination</p>
                        <p style="margin:0 0 8px; font-size:10px; color:#666; line-height:1.35;">Separate quantity per size / color / pattern row. Overrides whole-variant when enabled.</p>
                        ${renderAdminToggle(`v-track-combo-${v.id}`, !!v.trackComboStock, `updateVariant('${v.id}', 'trackComboStock', this.checked); renderVariantBlocks();`, 'Track per-combo stock', '#FFD700')}`;

    if (v.trackComboStock && skus.length) {
        if (skus.length === 1) {
            const sku = skus[0];
            const qty = getVariantSkuStock(v, sku.key);
            comboSection += `
                        <div style="margin-top:8px;">
                            <input type="number" min="0" placeholder="0" value="${qty}" oninput="updateVariantSkuStock('${v.id}', '${esc(sku.key)}', parseInt(this.value)||0)" onchange="renderVariantBlocks()" style="width:100%; max-width:140px; box-sizing:border-box; padding:6px 8px; border-radius:6px; border:1px solid #444; background:#222; color:#FFD700; font-size:13px; font-weight:700; text-align:center;">
                        </div>`;
        } else {
            const rows = skus.map(sku => {
                const qty = getVariantSkuStock(v, sku.key);
                return `
                            <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                                <span style="flex:1; font-size:10px; color:#bbb; line-height:1.35;">${sku.label}</span>
                                <input type="number" min="0" value="${qty}" oninput="updateVariantSkuStock('${v.id}', '${esc(sku.key)}', parseInt(this.value)||0)" style="width:76px; padding:5px 6px; border-radius:5px; border:1px solid #444; background:#222; color:#FFD700; font-size:12px; font-weight:700; text-align:center;">
                            </div>`;
            }).join('');
            comboSection += `<div style="margin-top:8px;">${rows}</div>`;
        }
    }
    comboSection += `</div>`;

    return blockSection + comboSection;
}

function updateVariantSkuStock(vId, skuKey, qty) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    ensureVariantStockMap(v);
    v.stockBySku[skuKey] = Math.max(0, qty);
    const skus = (typeof expandVariantBlockSkus === 'function') ? expandVariantBlockSkus(v) : [];
    if (skus.length === 1) {
        v.stockCount = v.stockBySku[skuKey];
    } else if (skus.length > 1) {
        v.stockCount = skus.reduce((sum, s) => sum + getVariantSkuStock(v, s.key), 0);
    }
}
window.updateVariantSkuStock = updateVariantSkuStock;

function finalizeVariantStockForSave(v) {
    migrateVariantStockFields(v);
    if (!v.trackComboStock) return;
    ensureVariantStockMap(v);
    const skus = (typeof expandVariantBlockSkus === 'function') ? expandVariantBlockSkus(v) : [];
    const validKeys = new Set(skus.map(s => s.key));
    Object.keys(v.stockBySku).forEach(k => {
        if (!validKeys.has(k)) delete v.stockBySku[k];
    });
    skus.forEach(sku => {
        if (!Object.prototype.hasOwnProperty.call(v.stockBySku, sku.key)) {
            v.stockBySku[sku.key] = getVariantBlockStockCount(v);
        }
        v.stockBySku[sku.key] = Math.max(0, parseInt(v.stockBySku[sku.key], 10) || 0);
    });
    if (skus.length === 1) {
        v.stockCount = getVariantSkuStock(v, skus[0].key);
    } else if (skus.length > 1) {
        v.stockCount = skus.reduce((sum, s) => sum + getVariantSkuStock(v, s.key), 0);
    }
    v.trackStock = !!(v.trackVariantStock || v.trackComboStock);
}

function getVariantBlockStockCount(v) {
    return parseInt(v.variantStockCount ?? v.stockCount, 10) || 0;
}

function migrateVariantStockMaps() {
    variantBlocks.forEach(v => {
        migrateVariantStockFields(v);
        finalizeVariantStockForSave(v);
        v.trackStock = !!(v.trackVariantStock || v.trackComboStock);
        if (v.trackVariantStock) {
            v.variantStockCount = getVariantBlockStockCount(v);
            v.stockCount = v.variantStockCount;
        }
    });
}

function renderVariantBlocks() {
    const container = document.getElementById('m-variants-container');
    if (!container) return;
    
    const is360Enabled = !!(window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer);
    
    container.innerHTML = variantBlocks.map((v, idx) => {
        const hasSwatches = v.previewImages && v.previewImages.length > 0;
        const has360Video = (v.videos || []).some(vid => {
            const n = normalizeStoredVideo(vid);
            return !!(n && n.is360);
        });
        const colorPreviewStyle = v.color ? `background:${v.color.trim()}; display:inline-block; width:14px; height:14px; border-radius:50%; border:1px solid #666; vertical-align:middle; margin-right:4px; flex-shrink:0;` : 'display:none;';

        const toggle = renderAdminToggle;

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
                    ${is360Enabled && v.is360 ? `<span style="margin-left: 6px; padding:2px 6px; font-size:9px; font-weight:800; border-radius:4px; background:rgba(255,215,0,0.15); color:var(--gold); border:1px solid rgba(255,215,0,0.3); letter-spacing:0.5px;">SPIN</span>` : ''}
                    ${is360Enabled && v.is360Panorama ? `<span style="margin-left: 6px; padding:2px 6px; font-size:9px; font-weight:800; border-radius:4px; background:rgba(100,181,246,0.15); color:#64b5f6; border:1px solid rgba(100,181,246,0.3); letter-spacing:0.5px;">IMMERSIVE</span>` : ''}
                    ${has360Video ? `<span style="margin-left: 6px; padding:2px 6px; font-size:9px; font-weight:800; border-radius:4px; background:rgba(100,181,246,0.15); color:#64b5f6; border:1px solid rgba(100,181,246,0.3); letter-spacing:0.5px;">360° VIDEO</span>` : ''}
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

                <!-- Variant media panel -->
                <div class="admin-media-panel admin-media-panel--variant">
                    <p class="admin-media-panel-intro">🎯 <strong>Variant media</strong> — customers see this when they pick this size / color / pattern combo</p>
                    <p id="admin-media-status-${v.id}" class="admin-media-status-line">No extra media yet — gallery photos are enough for most products</p>

                    <div class="admin-media-block">
                        ${adminMediaSectionHead('variant', 'gallery', 'Gallery photos', 'Full-size images in the product detail carousel')}
                        <div id="v-preview-${v.id}" class="admin-media-preview-grid"></div>
                        <label class="admin-media-upload">
                            <span class="admin-media-upload__icon">🖼️</span>
                            <span class="admin-media-upload__text">Add gallery photos</span>
                            <input type="file" multiple accept="image/*" style="display:none;" onchange="handleFileSelect(this, '${v.id}')">
                        </label>
                    </div>

                    <div class="admin-media-block">
                        ${adminMediaSectionHead('variant', 'swatch', 'Pattern / color swatches', 'Tiny previews on pattern chips — not the main gallery')}
                        <div id="v-swatch-${v.id}" class="admin-media-preview-grid admin-media-preview-grid--swatch"></div>
                        <label class="admin-media-upload admin-media-upload--swatch">
                            <span class="admin-media-upload__icon">🎨</span>
                            <span class="admin-media-upload__text">Add swatch image(s)</span>
                            <input type="file" multiple accept="image/*" style="display:none;" onchange="handleSwatchSelect(this, '${v.id}')">
                        </label>
                    </div>

                    ${renderAdminVideoBlockHtml(v.id, 'variant')}
                    ${renderAdminOptional360AccordionHtml(v.id, 'variant', { variant: v, show360: is360Enabled })}

                </div>

                <!-- Row 5: Toggle options (2-col grid on wide, 1-col on narrow) -->
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:6px;">
                    ${toggle(`v-active-${v.id}`, v.isActive !== false, `updateVariant('${v.id}', 'isActive', this.checked); const badge = document.getElementById('v-active-badge-${v.id}'); if(badge) { badge.style.background = this.checked ? '#1a3a1a' : '#3a1a1a'; badge.style.color = this.checked ? '#4caf50' : '#e57373'; badge.innerHTML = this.checked ? '● Active' : '○ Hidden'; }`, 'Active', '#4caf50')}
                    ${toggle(`v-hidedet-${v.id}`, !!v.hideDetailsGallery, `updateVariant('${v.id}', 'hideDetailsGallery', this.checked)`, 'Hide Details Images In Gallery', '#e57373')}
                    ${toggle(`v-showmain-${v.id}`, !!v.showInMainCarousel, `updateVariant('${v.id}', 'showInMainCarousel', this.checked)`, 'Show on Home Screen', '#64b5f6')}
                    ${hasSwatches ? toggle(`v-showpattext-${v.id}`, !!v.showPatternText, `updateVariant('${v.id}', 'showPatternText', this.checked)`, 'Show Pattern Text', '#25D366') : ''}
                </div>
                <div style="margin-top:6px; padding:10px; border-radius:8px; background:#111; border:1px solid rgba(255,179,71,0.2);">
                    <p style="font-size:10px; color:#ffb347; margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.5px;">Variant Stock <span style="color:#666; text-transform:none;">(levels 2 &amp; 3 — override product global)</span></p>
                    <div style="display:grid; grid-template-columns:1fr; gap:6px;">
                    ${buildVariantStockHtml(v)}
                    </div>
                </div>

            </div>
        </div>
    `;
    }).join('');

    variantBlocks.forEach((v, index) => {
        renderImagePreviews(v.id);
        renderSpinPreviews(v.id);
        renderPanoramaPreviews(v.id);
        renderVideoPreviews(v.id);
        renderSwatchPreview(v.id);
        syncAdmin360AccordionSummary(v.id);
        syncAdminMediaStatus(v.id);
        
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
            const variantTracksStock = !!(v.trackVariantStock || v.trackComboStock || v.trackStock);
            const isStockError = variantTracksStock && (typeof expandVariantBlockSkus === 'function'
                ? (v.trackComboStock
                    ? expandVariantBlockSkus(v).some(sku => {
                        const q = getVariantSkuStock(v, sku.key);
                        return q === undefined || q === null || isNaN(q) || q < 0;
                    })
                    : (getVariantBlockStockCount(v) === undefined || getVariantBlockStockCount(v) === null || isNaN(getVariantBlockStockCount(v)) || getVariantBlockStockCount(v) < 0))
                : (v.stockCount === undefined || v.stockCount === null || isNaN(v.stockCount) || v.stockCount < 0));

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
    if (window._adminProductDraftUiActive && typeof adminSyncProductDraftFieldUi === 'function') {
        adminSyncProductDraftFieldUi();
    }
}

// Swatch preview rendering with Sortable and unified index badges
function renderSwatchPreview(vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    const container = document.getElementById(`v-swatch-${vId}`);
    if (!container) return;
    const items = v.previewImages || [];
    if (!items.length) {
        container.innerHTML = adminMediaEmptyHint('No swatches yet — tap 👁 on any thumb to preview after upload');
        return;
    }
    const gridHtml = items.map((img, i) => {
        const isFile = img instanceof File;
        const url = adminResolveMediaUrl(img);
        return adminMediaThumbHtml({
            url, index: i, targetId: vId,
            previewFn: `previewAdminSwatch('${vId}', ${i})`,
            onRemove: `removeSwatch('${vId}', ${i})`,
            size: 48, isNew: isFile, extraClass: 'admin-media-thumb--swatch'
        });
    }).join('');
    container.innerHTML = `<p class="admin-media-drag-hint">Drag swatches to reorder · 👁 to preview</p><div class="admin-media-preview-grid-inner">${gridHtml}</div>`;
    const sortTarget = container.querySelector('.admin-media-preview-grid-inner');
    if (sortTarget) {
        adminBindSortableThumbGrid(sortTarget, v.previewImages, () => renderSwatchPreview(vId));
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
        trackVariantStock: false,
        trackComboStock: false,
        variantStockCount: 0,
        trackStock: false,
        stockCount: 0,
        stockBySku: {},
        is360: false,
        is360Panorama: false,
        spinImages: [],
        panoramaImages: [],
        videos: [],
        images: [],
        previewImages: []
    });
    renderVariantBlocks();
}

function handleSpinFileSelect(input, vId) {
    if (!input.files || input.files.length === 0) return;
    const newFiles = Array.from(input.files);
    adminEnsureSpin360Enabled(vId);
    if (vId === 'base') {
        existingSpinUrls = [...(existingSpinUrls || []), ...newFiles];
        renderSpinPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === vId);
        if (!v) return;
        v.spinImages = [...(v.spinImages || []), ...newFiles];
        renderSpinPreviews(vId);
    }
    syncAdmin360AccordionSummary(vId);
    input.value = '';
    if (typeof adminScheduleProductDraftSave === 'function') adminScheduleProductDraftSave();
}
window.handleSpinFileSelect = handleSpinFileSelect;

function handlePanoramaFileSelect(input, vId) {
    if (!input.files || input.files.length === 0) return;
    const newFiles = Array.from(input.files);
    adminEnsurePanorama360Enabled(vId);
    if (vId === 'base') {
        existingPanoramaUrls = [...(existingPanoramaUrls || []), ...newFiles];
        renderPanoramaPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === vId);
        if (!v) return;
        v.panoramaImages = [...(v.panoramaImages || []), ...newFiles];
        renderPanoramaPreviews(vId);
    }
    syncAdminMediaStatus(vId);
    input.value = '';
    if (typeof adminScheduleProductDraftSave === 'function') adminScheduleProductDraftSave();
}
window.handlePanoramaFileSelect = handlePanoramaFileSelect;

const DEMO_360_SPIN_FRAMES = Array.from({ length: 16 }, (_, i) =>
    `assets/demo/360/spin/${String(i + 1).padStart(2, '0')}.jpg`
);
const DEMO_360_PANORAMAS = [
    'https://pannellum.org/images/cerro-toco-0.jpg',
    'https://raw.githubusercontent.com/mpetroff/pannellum/master/examples/examplepano.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg'
];
const DEMO_360_VIDEO = {
    url: 'https://pannellum.org/images/video/jfk.mp4',
    is360: true
};

function loadDemo360Video(targetId = 'base') {
    const entry = { ...DEMO_360_VIDEO, _promptFrames: true };
    if (targetId === 'base') {
        existingVideoUrls = [...(existingVideoUrls || []), entry];
        renderVideoPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        v.videos = [...(v.videos || []), entry];
        renderVariantBlocks();
    }
    showToast('Demo 360° video loaded. Preview below — optionally create rotation frames.');
}
window.loadDemo360Video = loadDemo360Video;

function loadDemo360Spin(targetId = 'base') {
    if (targetId === 'base') {
        const chk = document.getElementById('m-is360');
        if (chk) chk.checked = true;
        toggle360Badge('base', true);
        existingSpinUrls = [...DEMO_360_SPIN_FRAMES];
        renderSpinPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        v.is360 = true;
        v.spinImages = [...DEMO_360_SPIN_FRAMES];
        renderVariantBlocks();
    }
    toggleAdmin360Accordion(targetId, true);
    syncAdmin360AccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
    showToast('Demo rotation loaded (16 frames). Save product to keep.');
}
window.loadDemo360Spin = loadDemo360Spin;

function loadDemo360Panorama(targetId = 'base') {
    if (targetId === 'base') {
        const chk = document.getElementById('m-is360-panorama');
        if (chk) chk.checked = true;
        toggle360PanoramaBadge('base', true);
        existingPanoramaUrls = [...DEMO_360_PANORAMAS];
        renderPanoramaPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        v.is360Panorama = true;
        v.panoramaImages = [...DEMO_360_PANORAMAS];
        renderVariantBlocks();
    }
    toggleAdmin360Accordion(targetId, true);
    syncAdmin360AccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
    showToast('Demo panoramas loaded — replace with your own 360° photo before going live.');
}
window.loadDemo360Panorama = loadDemo360Panorama;

function handleVideoFileSelect(input, vId) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const entry = { file, url: '', is360: false, _promptFrames: true };
    let newIndex = 0;
    if (vId === 'base') {
        existingVideoUrls = [...(existingVideoUrls || []), entry];
        newIndex = existingVideoUrls.length - 1;
        renderVideoPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === vId);
        if (!v) return;
        v.videos = [...(v.videos || []), entry];
        newIndex = v.videos.length - 1;
        renderVideoPreviews(vId);
    }
    input.value = '';
    showToast('Video added — preview below. Optionally extract panorama or rotation frames.');
    syncAdminMediaStatus(vId);
    adminDetectVideoFormatOnUpload(vId, newIndex);
    setTimeout(() => {
        const wrap = document.getElementById(vId === 'base' ? 'm-video-preview' : `v-video-preview-${vId}`);
        const card = wrap?.querySelectorAll('.admin-video-card')[newIndex];
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
    if (typeof adminScheduleProductDraftSave === 'function') adminScheduleProductDraftSave();
}

function dismissVideoFrameOffer(targetId, index) {
    const items = targetId === 'base'
        ? (existingVideoUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.videos || []);
    if (items[index]) items[index]._promptFrames = false;
    renderVideoPreviews(targetId);
}
window.dismissVideoFrameOffer = dismissVideoFrameOffer;
window.handleVideoFileSelect = handleVideoFileSelect;

function toggleVideo360(targetId, index, checked) {
    const items = targetId === 'base'
        ? (existingVideoUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.videos || []);
    const entry = items[index];
    if (!entry) return;
    const apply = () => {
        if (entry instanceof File) {
            entry._is360 = !!checked;
        } else if (typeof entry === 'object') {
            entry.is360 = !!checked;
        }
        renderVideoPreviews(targetId);
    };
    if (!checked) {
        apply();
        return;
    }
    const normalized = normalizeStoredVideo(entry);
    let url = normalized?.url || '';
    let revoke = null;
    if (normalized?.file instanceof File) {
        url = URL.createObjectURL(normalized.file);
        revoke = url;
    }
    if (!url || typeof mvProbeVideoUrl !== 'function') {
        apply();
        return;
    }
    mvProbeVideoUrl(url).then((probe) => {
        if (!probe.isEquirectangular) {
            showToast('Kept as flat video — immersive 360° needs a 2:1 equirectangular file.');
            if (entry instanceof File) entry._is360 = false;
            else if (typeof entry === 'object') entry.is360 = false;
            renderVideoPreviews(targetId);
            if (revoke) URL.revokeObjectURL(revoke);
            return;
        }
        apply();
        if (revoke) URL.revokeObjectURL(revoke);
    }).catch(() => {
        apply();
        if (revoke) URL.revokeObjectURL(revoke);
    });
}
window.toggleVideo360 = toggleVideo360;

async function adminPrepareVideoSource(entry) {
    if (entry?.file instanceof File) {
        return { url: URL.createObjectURL(entry.file), revoke: true, useCrossOrigin: false };
    }
    let url = entry?.url || '';
    if (!url) throw new Error('No video URL');
    if (url.startsWith('blob:') || url.startsWith('data:')) {
        return { url, revoke: false, useCrossOrigin: false };
    }
    const absolute = typeof mvResolveMediaUrl === 'function' ? mvResolveMediaUrl(url) : url;
    try {
        const resp = await fetch(absolute, { mode: 'cors', credentials: 'omit' });
        if (!resp.ok) throw new Error('fetch failed');
        const blob = await resp.blob();
        if (!blob || !blob.size) throw new Error('empty blob');
        return { url: URL.createObjectURL(blob), revoke: true, useCrossOrigin: false };
    } catch (e) {
        console.warn('Video fetch for extraction failed, trying direct URL:', e);
        return { url: absolute, revoke: false, useCrossOrigin: true };
    }
}

function adminWaitVideoReady(video) {
    return new Promise((resolve, reject) => {
        if (video.readyState >= 2 && video.videoWidth > 0) {
            resolve();
            return;
        }
        const timer = setTimeout(() => {
            cleanup();
            if (video.readyState >= 1 && video.videoWidth > 0) resolve();
            else reject(new Error('Video load timed out'));
        }, 25000);
        const cleanup = () => {
            clearTimeout(timer);
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('error', onErr);
        };
        const onReady = () => { cleanup(); resolve(); };
        const onErr = () => { cleanup(); reject(new Error('Could not load video')); };
        video.addEventListener('loadeddata', onReady, { once: true });
        video.addEventListener('error', onErr, { once: true });
    });
}

function adminSeekVideo(video, time) {
    return new Promise((resolve) => {
        if (!video.duration || !isFinite(video.duration)) {
            resolve();
            return;
        }
        const target = Math.min(Math.max(0, time), Math.max(0, video.duration - 0.05));
        if (Math.abs(video.currentTime - target) < 0.05) {
            resolve();
            return;
        }
        const timer = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
        }, 5000);
        const onSeeked = () => {
            clearTimeout(timer);
            video.removeEventListener('seeked', onSeeked);
            resolve();
        };
        video.addEventListener('seeked', onSeeked);
        try {
            video.currentTime = target;
        } catch (e) {
            clearTimeout(timer);
            resolve();
        }
    });
}

async function adminExtractFramesFromVideoUrl(url, frameCount = 16, opts = {}) {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.preload = 'auto';
    if (opts.useCrossOrigin) video.crossOrigin = 'anonymous';
    video.src = url;
    await adminWaitVideoReady(video);
    const duration = video.duration;
    if (!duration || !isFinite(duration) || duration <= 0) {
        throw new Error('Could not read video duration');
    }
    const maxW = 1280;
    let w = video.videoWidth || 1280;
    let h = video.videoHeight || 720;
    if (!w || !h) throw new Error('Could not read video dimensions');
    if (w > maxW) {
        h = Math.round(h * (maxW / w));
        w = maxW;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const files = [];
    for (let i = 0; i < frameCount; i++) {
        const t = frameCount <= 1
            ? Math.max(0, duration * 0.5)
            : (duration * i) / (frameCount - 1);
        await adminSeekVideo(video, t);
        try {
            ctx.drawImage(video, 0, 0, w, h);
        } catch (e) {
            throw new Error('CORS_BLOCKED');
        }
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob) {
            throw new Error('CORS_BLOCKED');
        }
        files.push(new File([blob], `spin-frame-${String(i + 1).padStart(2, '0')}.jpg`, { type: 'image/jpeg' }));
        if (typeof opts.onProgress === 'function') {
            opts.onProgress(Math.round(((i + 1) / frameCount) * 100), i + 1, frameCount);
        }
    }
    video.pause();
    video.removeAttribute('src');
    video.load();
    return files;
}

window.extractVideoFramesForSpin = extractVideoFramesForSpin;

function adminApplySpinFramesFromVideo(targetId, frames, previousCount) {
    if (targetId === 'base') {
        const chk = document.getElementById('m-is360');
        if (chk) chk.checked = true;
        toggle360Badge('base', true);
        const spinWrap = document.getElementById('m-spin-upload-container');
        if (spinWrap) spinWrap.style.display = 'block';
        existingSpinUrls = [...frames];
        renderSpinPreviews('base');
        adminScrollToSpinSection('base');
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        v.is360 = true;
        v.spinImages = [...frames];
        renderVariantBlocks();
        setTimeout(() => adminScrollToSpinSection(targetId), 80);
    }
    const n = frames.length;
    if (previousCount > 0) {
        showToast(`Rotation updated: ${n} frames from video (replaced ${previousCount} old frame${previousCount === 1 ? '' : 's'}). Save product to keep.`);
    } else {
        showToast(`Rotation ready: ${n} frames from video. Save product to keep.`);
    }
    syncAdmin360AccordionSummary(targetId);
}

function adminScrollToSpinSection(targetId) {
    toggleAdmin360Accordion(targetId, true);
    const el = document.getElementById(targetId === 'base' ? 'm-spin-upload-container' : `v-spin-upload-${targetId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    syncAdminSpinFramesAccordionSummary(targetId);
}

async function extractVideoFramesForSpin(targetId, index, frameMode = ADMIN_DEFAULT_FRAME_COUNT) {
    const items = targetId === 'base'
        ? (existingVideoUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.videos || []);
    const entry = normalizeStoredVideo(items[index]);
    if (!entry) return showToast('Video not found.');
    if (!entry.url && !(entry.file instanceof File)) {
        return showToast('Upload the video file first, then create rotation frames, then save.');
    }
    const previousCount = targetId === 'base'
        ? (existingSpinUrls || []).length
        : ((variantBlocks.find(x => x.id === targetId)?.spinImages || []).length);
    let prep;
    try {
        prep = await adminPrepareVideoSource(entry);
    } catch (e) {
        return showToast('Upload the video first.');
    }
    let frameCount = ADMIN_DEFAULT_FRAME_COUNT;
    try {
        const is360Video = await adminVideoIsEquirectangular(entry, prep.url, prep.useCrossOrigin);
        if (is360Video && !entry._spin360Warned) {
            entry._spin360Warned = true;
            showToast('Note: rotation frames from 360° video may look warped — flat video is best for product spin.');
        }
        if (frameMode === 'auto') {
            adminSetSaveProgress(0, 'Analyzing video length…');
            const probeVideo = document.createElement('video');
            probeVideo.muted = true;
            probeVideo.playsInline = true;
            probeVideo.preload = 'auto';
            if (prep.useCrossOrigin) probeVideo.crossOrigin = 'anonymous';
            probeVideo.src = prep.url;
            await adminWaitVideoReady(probeVideo);
            frameCount = adminAutoFrameCount(probeVideo.duration);
            probeVideo.removeAttribute('src');
            probeVideo.load();
        } else {
            frameCount = adminClampFrameCount(frameMode);
        }
        adminSetSaveProgress(0, `Creating ${frameCount} rotation frames… 0%`);
        const frames = await adminExtractFramesFromVideoUrl(prep.url, frameCount, {
            useCrossOrigin: prep.useCrossOrigin,
            onProgress(pct, done, total) {
                adminSetSaveProgress(pct, `Creating rotation frames… ${done}/${total} (${pct}%)`);
            }
        });
        adminHideSaveProgress();
        if (!frames.length) return showToast('Could not create frames from this video.');
        adminApplySpinFramesFromVideo(targetId, frames, previousCount);
        syncAdmin360AccordionSummary(targetId);
        if (items[index]) items[index]._promptFrames = false;
        renderVideoPreviews(targetId);
    } catch (e) {
        adminHideSaveProgress();
        console.error('Frame extraction failed:', e);
        if (String(e.message) === 'CORS_BLOCKED') {
            showToast('Re-upload the video file, then create rotation frames.');
        } else {
            showToast('Could not create rotation frames from video.');
        }
    } finally {
        if (prep?.revoke) URL.revokeObjectURL(prep.url);
    }
}

function extractVideoFramesCustom(targetId, index) {
    const input = document.getElementById(`admin-frame-custom-${targetId}-${index}`);
    const raw = parseInt(input?.value, 10);
    if (!raw || raw < ADMIN_MIN_FRAME_COUNT || raw > ADMIN_MAX_FRAME_COUNT) {
        return showToast(`Enter ${ADMIN_MIN_FRAME_COUNT}–${ADMIN_MAX_FRAME_COUNT} frames.`);
    }
    extractVideoFramesForSpin(targetId, index, raw);
}
window.extractVideoFramesCustom = extractVideoFramesCustom;

async function adminVideoIsEquirectangular(entry, prepUrl, useCrossOrigin) {
    if (entry?.is360) return true;
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    if (useCrossOrigin) video.crossOrigin = 'anonymous';
    video.src = prepUrl;
    try {
        await adminWaitVideoReady(video);
        const w = video.videoWidth || 0;
        const h = video.videoHeight || 0;
        if (!w || !h) return false;
        const ratio = w / h;
        return ratio >= 1.85 && ratio <= 2.15;
    } finally {
        video.removeAttribute('src');
        video.load();
    }
}

function adminApplyPanoramaFromVideo(targetId, frameFile, replace = false) {
    adminEnsurePanorama360Enabled(targetId);
    if (targetId === 'base') {
        existingPanoramaUrls = replace ? [frameFile] : [...(existingPanoramaUrls || []), frameFile];
        renderPanoramaPreviews('base');
        toggleAdmin360Accordion('base', true);
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        v.is360Panorama = true;
        v.panoramaImages = replace ? [frameFile] : [...(v.panoramaImages || []), frameFile];
        renderVariantBlocks();
        setTimeout(() => toggleAdmin360Accordion(targetId, true), 80);
    }
    syncAdmin360AccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
}

async function extractPanoramaFromVideo(targetId, index) {
    const items = targetId === 'base'
        ? (existingVideoUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.videos || []);
    const entry = normalizeStoredVideo(items[index]);
    if (!entry) return showToast('Video not found.');
    if (!entry.url && !(entry.file instanceof File)) {
        return showToast('Upload the video first, then extract a panorama still.');
    }
    let prep;
    try {
        prep = await adminPrepareVideoSource(entry);
    } catch (e) {
        return showToast('Upload the video first.');
    }
    try {
        adminSetSaveProgress(0, 'Checking video format…');
        const is360Video = await adminVideoIsEquirectangular(entry, prep.url, prep.useCrossOrigin);
        if (!is360Video) {
            adminHideSaveProgress();
            return showToast('Panorama needs a 360° equirectangular video (2:1). For flat video use rotation frames instead.');
        }
        adminSetSaveProgress(20, 'Extracting panorama still…');
        const frames = await adminExtractFramesFromVideoUrl(prep.url, 1, {
            useCrossOrigin: prep.useCrossOrigin,
            onProgress(pct) {
                adminSetSaveProgress(20 + Math.round(pct * 0.75), `Extracting panorama still… ${pct}%`);
            }
        });
        adminHideSaveProgress();
        if (!frames.length) return showToast('Could not extract panorama from this video.');
        adminApplyPanoramaFromVideo(targetId, frames[0]);
        if (items[index]) items[index]._promptFrames = false;
        renderVideoPreviews(targetId);
        showToast('Panorama still added for Look Around. Save product to keep.');
    } catch (e) {
        adminHideSaveProgress();
        console.error('Panorama extract failed:', e);
        if (String(e.message) === 'CORS_BLOCKED') {
            showToast('Re-upload the video file, then extract panorama.');
        } else {
            showToast('Could not extract panorama from video.');
        }
    } finally {
        if (prep?.revoke) URL.revokeObjectURL(prep.url);
    }
}
window.extractPanoramaFromVideo = extractPanoramaFromVideo;

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
    if (typeof adminScheduleProductDraftSave === 'function') adminScheduleProductDraftSave();
}

function handleSwatchSelect(input, vId) {
    const v = variantBlocks.find(x => x.id === vId);
    if (!v) return;
    if (input.files && input.files.length > 0) {
        v.previewImages = [...(v.previewImages || []), ...Array.from(input.files)];
    }
    renderVariantBlocks();
    input.value = '';
    if (typeof adminScheduleProductDraftSave === 'function') adminScheduleProductDraftSave();
}

function removeSpinImage(vId, index) {
    if (vId === 'base') {
        existingSpinUrls.splice(index, 1);
        renderSpinPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === vId);
        if (v && v.spinImages) v.spinImages.splice(index, 1);
        renderSpinPreviews(vId);
    }
}
window.removeSpinImage = removeSpinImage;

function removePanoramaImage(vId, index) {
    if (vId === 'base') {
        existingPanoramaUrls.splice(index, 1);
        renderPanoramaPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === vId);
        if (v && v.panoramaImages) v.panoramaImages.splice(index, 1);
        renderPanoramaPreviews(vId);
    }
}
window.removePanoramaImage = removePanoramaImage;

function removeVideoItem(vId, index) {
    if (vId === 'base') {
        existingVideoUrls.splice(index, 1);
        renderVideoPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === vId);
        if (v && v.videos) v.videos.splice(index, 1);
        renderVideoPreviews(vId);
    }
}
window.removeVideoItem = removeVideoItem;

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
    if (v) v[field] = value;
}

function removeVariant(id) {
    if (!confirm('Remove this variant block and its media settings?')) return;
    variantBlocks = variantBlocks.filter(x => x.id !== id);
    renderVariantBlocks();
}

function renderAdmin() { 
    const container = document.getElementById('admin-list');
    if (typeof renderAdminDraftRecoveryPanel === 'function') renderAdminDraftRecoveryPanel();
    if (typeof renderAdminFavorites === 'function') renderAdminFavorites();
    if(!container) return;
    
    const loadMoreContainer = document.getElementById('admin-load-more-container');
    const countContainer = document.getElementById('admin-product-count');
    
    if (products.length === 0 && window.productsLoaded) {
        if (countContainer) {
            countContainer.textContent = '0 products';
            countContainer.style.display = 'inline-flex';
        }
        if (loadMoreContainer) loadMoreContainer.innerHTML = '';
        container.innerHTML = `${adminNewProductDraftRowHtml()}<div class="admin-product-empty">No products in your catalog yet. Tap <strong>+ NEW ITEM</strong> to add one.</div>`;
        if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
        return;
    }

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
    
    let itemsToRender = adminGetFilteredProducts();
    const totalFiltered = itemsToRender.length;
    const totalAll = products.length;
    const pageSize = getAdminProductsPageSize();
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    if ((window.adminProductsPage || 1) > totalPages) window.adminProductsPage = totalPages;
    const page = window.adminProductsPage || 1;
    const pageStart = (page - 1) * pageSize;
    
    if (countContainer) {
        const filterNote = totalFiltered !== totalAll ? ` (filtered from ${totalAll})` : '';
        if (!totalFiltered) {
            countContainer.textContent = totalAll ? 'No matches' : '0 products';
        } else if (totalPages > 1) {
            const visibleEnd = Math.min(pageStart + pageSize, totalFiltered);
            countContainer.textContent = `Page ${page}/${totalPages} · ${pageStart + 1}–${visibleEnd} of ${totalFiltered}${filterNote}`;
        } else {
            countContainer.textContent = `${totalFiltered} product${totalFiltered === 1 ? '' : 's'}${filterNote}`;
        }
        countContainer.style.display = 'inline-flex';
    }
    
    if (totalFiltered > pageSize) {
        itemsToRender = itemsToRender.slice(pageStart, pageStart + pageSize);
    }
    renderAdminProductsPagination(totalFiltered);

    const productEditDraftIds = typeof adminGetProductEditDraftIdSet === 'function'
        ? adminGetProductEditDraftIdSet()
        : new Set();
    
    if (!itemsToRender.length && products.length > 0) {
        container.innerHTML = `${adminNewProductDraftRowHtml()}<div class="admin-product-empty">No products match your search. <button type="button" class="admin-product-empty__clear" onclick="document.getElementById('admin-product-search').value='';document.getElementById('admin-product-filter').value='all';adminFilterProducts();">Clear filters</button></div>`;
        if (loadMoreContainer) loadMoreContainer.innerHTML = '';
        if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
        return;
    }
    
    container.innerHTML = adminNewProductDraftRowHtml() + itemsToRender.map(p => {
        let thumbUrl = 'https://placehold.co/400x400/222/FFF?text=+';
        if (p.images && p.images.length > 0) {
            thumbUrl = p.images[0];
        } else if (p.variants && Array.isArray(p.variants)) {
            const vWithImg = p.variants.find(v => v.images && v.images.length > 0);
            if (vWithImg) thumbUrl = vWithImg.images[0];
        }

        const activeVariants = p.variants && Array.isArray(p.variants) ? p.variants.filter(v => v.isActive !== false) : [];
        const isOutOfStock = typeof isProductOutOfStock === 'function'
            ? isProductOutOfStock(p)
            : (typeof variantBlockHasStock === 'function'
                ? (activeVariants.length > 0 && activeVariants.some(v => v.trackStock) && !activeVariants.filter(v => v.trackStock).some(v => variantBlockHasStock(v)))
                : false);

        let stockHtml = '';
        const stockBadges = [];
        const pushStockBadge = (label, stock, tracking) => {
            let cls = 'admin-stock-badge admin-stock-badge--unlimited';
            let text = `${label}: Unlimited`;
            if (tracking) {
                if (stock <= 0) {
                    cls = 'admin-stock-badge admin-stock-badge--oos';
                    text = `${label}: 0 left`;
                } else {
                    cls = 'admin-stock-badge admin-stock-badge--tracked';
                    text = `${label}: ${stock} left`;
                }
            }
            stockBadges.push(`<span class="${cls}">${text}</span>`);
        };
        const pushVariantChip = (label, note = '') => {
            const safe = String(label || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (!safe) return;
            const text = note ? `${safe}: ${note}` : safe;
            stockBadges.push(`<span class="admin-stock-badge admin-stock-badge--variant">${text}</span>`);
        };

        if (p.trackGlobalStock || activeVariants.length > 0) {
            if (p.trackGlobalStock) {
                pushStockBadge('Global stock', parseInt(p.globalStockCount, 10) || 0, true);
            }

            activeVariants.forEach(v => {
                migrateVariantStockFields(v);
                const mode = (typeof getVariantStockMode === 'function') ? getVariantStockMode(v) : (v.trackComboStock ? 'combo' : (v.trackVariantStock ? 'block' : (v.trackStock ? 'block' : 'inherit')));
                const skus = (typeof expandVariantBlockSkus === 'function') ? expandVariantBlockSkus(v) : [];
                const nameParts = [];
                if (v.size && v.size !== 'Standard') nameParts.push(v.size);
                if (v.colorName) nameParts.push(v.colorName);
                else if (v.color) nameParts.push(v.color);
                if (v.patternName) nameParts.push(v.patternName);
                else if (v.pattern) nameParts.push(v.pattern);
                const varName = (skus.length === 1 ? skus[0].label : nameParts.join(' · ')) || 'Standard';

                if (mode === 'combo' && skus.length > 1) {
                    skus.forEach(sku => {
                        pushStockBadge(sku.label, getVariantSkuStock(v, sku.key), true);
                    });
                } else if (mode === 'combo' && skus.length === 1) {
                    pushStockBadge(varName, getVariantSkuStock(v, skus[0].key), true);
                } else if (mode === 'block') {
                    pushStockBadge(varName, getVariantBlockStockCount(v), true);
                } else if (mode === 'inherit' && p.trackGlobalStock) {
                    if (skus.length > 1) {
                        skus.forEach(sku => pushVariantChip(sku.label, 'global'));
                    } else {
                        const label = varName !== 'Standard' ? varName : nameParts.join(' · ');
                        if (label) {
                            pushVariantChip(label, 'global');
                        } else if (v.price) {
                            pushVariantChip(`₹${v.price}`, 'global');
                        } else if ((v.images && v.images.length) || (v.previewImages && v.previewImages.length) || v.is360 || v.is360Panorama) {
                            pushVariantChip('Variant block', 'global');
                        }
                    }
                } else if (!p.trackGlobalStock) {
                    pushStockBadge(varName, 0, false);
                }
            });
        }

        const maxStockBadges = 5;
        const stockExpanded = adminExpandedStockProductIds.has(p.id);
        if (stockBadges.length) {
            const visible = stockExpanded ? stockBadges : stockBadges.slice(0, maxStockBadges);
            const extra = stockExpanded ? 0 : stockBadges.length - maxStockBadges;
            let moreHtml = '';
            if (extra > 0) {
                moreHtml = `<button type="button" class="admin-stock-badge admin-stock-badge--more" onclick="adminToggleStockExpand('${p.id}')" title="Show all stock lines">+${extra} more</button>`;
            } else if (stockExpanded && stockBadges.length > maxStockBadges) {
                moreHtml = `<button type="button" class="admin-stock-badge admin-stock-badge--more" onclick="adminToggleStockExpand('${p.id}')">Show less</button>`;
            }
            stockHtml = `<div class="admin-product-stock">${visible.join('')}${moreHtml}</div>`;
        }

        const catLabel = typeof resolveProductCategoryLabel === 'function' ? resolveProductCategoryLabel(p) : (p.categoryName || '');
        const safeName = (p.name || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const priceLabel = `₹${Number(p.price) || 0}`;
        const mediaBadges = adminProductMediaBadges(p);
        const hasEditDraft = productEditDraftIds.has(p.id);
        const editDraftBadge = hasEditDraft
            ? '<span class="admin-draft-indicator admin-draft-indicator--inline">Draft</span>'
            : '';
        return `
        <div class="admin-product-row${hasEditDraft ? ' admin-product-row--has-edit-draft' : ''}">
            <div class="admin-product-thumb-wrap">
                <img src="${thumbUrl}" class="admin-product-thumb" alt="" loading="lazy">
            </div>
            <div class="admin-product-body">
                <div class="admin-product-title-row">
                    <b class="admin-product-name">${safeName}</b>
                    ${editDraftBadge}
                    <span class="admin-product-price">${priceLabel}</span>
                    ${catLabel ? `<span class="admin-product-cat">${typeof escapeCategoryHtml === 'function' ? escapeCategoryHtml(catLabel) : catLabel}</span>` : ''}
                    ${mediaBadges}
                    ${isOutOfStock ? `<span class="admin-product-oos">Out of stock</span>` : ''}
                </div>
                ${stockHtml}
            </div>
            <div class="admin-product-actions">
                <i class="fa fa-copy" title="Duplicate product" onclick="copyProduct('${p.id}')"></i>
                <i class="fa fa-edit" title="Edit product" onclick="openEdit('${p.id}')"></i>
                <i class="fa fa-trash" title="Delete product" onclick="deleteProduct('${p.id}')"></i>
            </div>
        </div>
    `}).join('');
    if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
    if (typeof updateAdminNewProductDraftBadge === 'function') updateAdminNewProductDraftBadge();
}

window.loadMoreAdminProducts = function() {
    goAdminProductsPage((window.adminProductsPage || 1) + 1);
};

function adminApplyLiveProductToForm(p) {
    if (!p) return;
    adminSetModalTitle('edit');
    adminShowValidationErrors([]);
    document.getElementById('m-name').value = p.name;
    document.getElementById('m-price').value = p.price;
    document.getElementById('m-desc').value = p.description || '';
    document.getElementById('m-hide-main').checked = !!p.hideMainCarousel;
    document.getElementById('m-hide-main-details').checked = !!p.hideMainDetailsCarousel;
    document.getElementById('m-main-pos').value = p.mainImagesPosition || 'end';
    document.getElementById('m-main-pos-container').style.display = p.hideMainDetailsCarousel ? 'none' : 'flex';
    document.getElementById('m-hide-main-placeholder').checked = !!p.hideNoImagePlaceholder;
    existingImageUrls = [...(p.images || [])];
    existingSpinUrls = [...(p.spinImages || [])];
    existingPanoramaUrls = [...(p.panoramaImages || [])];
    existingVideoUrls = (p.videos || []).map(normalizeStoredVideo).filter(Boolean);

    const is360Enabled = !!(window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer);
    syncAdmin360PanelVisibility();
    const mainIs360 = document.getElementById('m-is360');
    if (mainIs360) {
        mainIs360.checked = !!p.is360;
        toggle360Badge('base', is360Enabled && !!p.is360);
    }
    const mainIs360Panorama = document.getElementById('m-is360-panorama');
    if (mainIs360Panorama) {
        mainIs360Panorama.checked = !!p.is360Panorama;
        toggle360PanoramaBadge('base', is360Enabled && !!p.is360Panorama);
    }
    const baseSpinUpload = document.getElementById('m-spin-upload-container');
    if (baseSpinUpload) baseSpinUpload.style.display = (is360Enabled && p.is360) ? 'block' : 'none';

    renderImagePreviews('base');
    renderSpinPreviews('base');
    renderPanoramaPreviews('base');
    renderVideoPreviews('base');
    syncAdmin360AccordionSummary('base');
    syncAdminMediaStatus('base');
    if (typeof hydrateGlobalStockForm === 'function') hydrateGlobalStockForm(p);

    if (p.variants && Array.isArray(p.variants)) {
        variantBlocks = p.variants.map(mapSavedVariantToBlock);
        migrateVariantStockMaps();
    } else {
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
                        size: sz, color: col, colorName: '', pattern: '', patternName: '',
                        showPatternText: false, price: null, hideDetailsGallery: false,
                        showInMainCarousel: false, isActive: true, trackVariantStock: false,
                        trackComboStock: false, variantStockCount: 0, trackStock: false,
                        stockCount: 0, images: [], previewImages: pImg ? [pImg] : []
                    });
                });
            } else {
                variantBlocks.push({
                    id: 'v_' + Math.random().toString(36).substr(2, 9),
                    size: sz, color: '', colorName: '', pattern: '', patternName: '',
                    showPatternText: false, price: p.price, hideDetailsGallery: false,
                    showInMainCarousel: false, isActive: true, trackVariantStock: false,
                    trackComboStock: false, variantStockCount: 0, trackStock: false,
                    stockCount: 0, images: [], previewImages: []
                });
            }
        });
    }

    renderImagePreviews('base');
    renderVariantBlocks();
    if (p.is360 || p.is360Panorama || (p.spinImages || []).length || (p.panoramaImages || []).length) {
        toggleAdmin360Accordion('base', true);
    } else {
        toggleAdmin360Accordion('base', false);
    }
    variantBlocks.forEach(v => {
        if (v.is360 || v.is360Panorama || (v.spinImages || []).length || (v.panoramaImages || []).length) {
            toggleAdmin360Accordion(v.id, true);
        }
    });
    if (typeof hydrateProductCategoryForm === 'function') hydrateProductCategoryForm(p);
}
window.adminApplyLiveProductToForm = adminApplyLiveProductToForm;

function openEdit(id) {
    editingId = id;
    if (typeof adminDraftSetActive === 'function') adminDraftSetActive('product', getProductDraftKey(id));
    const p = products.find(x => x.id === id);
    if (!p) return showToast('Product not found.');
    window._adminProductLiveBaseline = adminBuildLiveProductSnapshot(p);
    if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
    window._adminProductDraftLoaded = false;
    window._adminProductViewMode = 'live';
    adminApplyLiveProductToForm(p);
    if (typeof resetProductGuideAccordion === 'function') resetProductGuideAccordion();
    document.getElementById('prod-modal').style.display = 'flex';
    adminResetProductSnapshot();
    adminBindProductDraftListeners();
    renderProductModalDraftBanner();
    if (typeof adminRenderProductDraftSwitcher === 'function') adminRenderProductDraftSwitcher();
}

function toggle360Badge(id, checked) {
    if (id === 'base') {
        const b = document.getElementById('base-360-badge');
        if (b) b.style.display = checked ? 'inline-block' : 'none';
        const spinUpload = document.getElementById('m-spin-upload-container');
        if (spinUpload) spinUpload.style.display = checked ? 'block' : 'none';
        syncAdmin360AccordionSummary('base');
    }
}
window.toggle360Badge = toggle360Badge;

function toggle360PanoramaBadge(id, checked) {
    if (id === 'base') {
        const b = document.getElementById('base-360-pano-badge');
        if (b) b.style.display = checked ? 'inline-block' : 'none';
        const panoUpload = document.getElementById('m-panorama-upload-container');
        if (panoUpload) panoUpload.style.display = checked ? 'block' : 'none';
        syncAdmin360AccordionSummary('base');
    }
}
window.toggle360PanoramaBadge = toggle360PanoramaBadge;

function syncAdmin360PanelVisibility() {
    const is360Enabled = adminIs360FeatureEnabled();
    const accordion = document.getElementById('admin-360-accord-base');
    if (accordion) accordion.style.display = is360Enabled ? 'block' : 'none';
}
window.syncAdmin360PanelVisibility = syncAdmin360PanelVisibility;

function openAdd() {
    if (adminGetOrphanedNewProductDraftEntry()) {
        adminOpenNewProductDraft();
        return;
    }
    editingId = null;
    window._adminProductLiveBaseline = null;
    if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
    adminSetModalTitle('add');
    adminShowValidationErrors([]);
    existingImageUrls = [];
    existingSpinUrls = [];
    existingPanoramaUrls = [];
    existingVideoUrls = [];
    variantBlocks = [];
    document.getElementById('m-name').value = ""; 
    document.getElementById('m-price').value = ""; 
    document.getElementById('m-desc').value = "";
    document.getElementById('m-hide-main').checked = false;
    document.getElementById('m-hide-main-details').checked = false;
    document.getElementById('m-main-pos').value = 'end';
    document.getElementById('m-main-pos-container').style.display = 'flex';
    document.getElementById('m-hide-main-placeholder').checked = false;
    
    const is360Enabled = !!(window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer);
    syncAdmin360PanelVisibility();
    const mainIs360 = document.getElementById('m-is360');
    if (mainIs360) {
        mainIs360.checked = false;
        toggle360Badge('base', false);
    }
    const mainIs360Panorama = document.getElementById('m-is360-panorama');
    if (mainIs360Panorama) {
        mainIs360Panorama.checked = false;
        toggle360PanoramaBadge('base', false);
    }
    const baseSpinUpload = document.getElementById('m-spin-upload-container');
    if (baseSpinUpload) baseSpinUpload.style.display = 'none';
    
    renderImagePreviews('base');
    renderSpinPreviews('base');
    renderPanoramaPreviews('base');
    renderVideoPreviews('base');
    syncAdmin360AccordionSummary('base');
    syncAdminMediaStatus('base');
    toggleAdmin360Accordion('base', false);
    if (typeof hydrateGlobalStockForm === 'function') hydrateGlobalStockForm(null);
    renderVariantBlocks();
    if (typeof hydrateProductCategoryForm === 'function') hydrateProductCategoryForm(null);
    if (typeof resetProductGuideAccordion === 'function') resetProductGuideAccordion();
    if (typeof adminDraftSetActive === 'function') adminDraftSetActive('product', 'new');
    document.getElementById('prod-modal').style.display = 'flex';
    adminResetProductSnapshot();
    adminBindProductDraftListeners();
    renderProductModalDraftBanner();
}

function renderImagePreviews(targetId = 'base') { 
    const container = document.getElementById(targetId === 'base' ? 'm-preview' : `v-preview-${targetId}`); 
    if (!container) return;
    const spinAddEnabled = adminIs360FeatureEnabled();
    const buildThumb = (img, i, removeFn) => {
        const isFile = img instanceof File;
        const url = adminResolveMediaUrl(img);
        return adminMediaThumbHtml({
            url, index: i, targetId,
            previewFn: `previewAdminGallery('${targetId}', ${i})`,
            spinAddFn: spinAddEnabled ? `addGalleryImageToSpinFrames('${targetId}', ${i})` : null,
            onRemove: removeFn,
            size: 64, isNew: isFile, badge: i + 1,
            extraClass: 'admin-media-thumb--gallery'
        });
    };
    if (targetId === 'base') {
        const items = existingImageUrls || [];
        const gridHtml = items.length
            ? items.map((img, i) => buildThumb(img, i, `existingImageUrls.splice(${i},1);renderImagePreviews('base')`)).join('')
            : '';
        container.innerHTML = items.length
            ? `<p class="admin-media-drag-hint">Drag photos to reorder · 👁 preview · 🔄 add to rotation</p><div class="admin-media-preview-grid-inner">${gridHtml}</div>${adminBuildGallerySpinToolbar('base', items.length)}`
            : adminMediaEmptyHint('No main gallery photos — optional. Tap 👁 to preview after upload.');
        const sortTarget = container.querySelector('.admin-media-preview-grid-inner');
        if (items.length && sortTarget) {
            adminBindSortableThumbGrid(sortTarget, existingImageUrls, () => renderImagePreviews('base'));
        }
        syncAdminMediaStatus('base');
        if (window._adminProductDraftUiActive && typeof adminSyncProductDraftFieldUi === 'function') {
            adminSyncProductDraftFieldUi();
        }
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (!v) return;
        const items = v.images || [];
        const gridHtml = items.length
            ? items.map((img, i) => buildThumb(img, i, `removeVariantImage('${targetId}', ${i})`)).join('')
            : '';
        container.innerHTML = items.length
            ? `<p class="admin-media-drag-hint">Drag photos to reorder · 👁 preview · 🔄 add to rotation</p><div class="admin-media-preview-grid-inner">${gridHtml}</div>${adminBuildGallerySpinToolbar(targetId, items.length)}`
            : adminMediaEmptyHint('No variant gallery photos — optional, falls back to main images on the shop');
        const sortTarget = container.querySelector('.admin-media-preview-grid-inner');
        if (items.length && sortTarget) {
            adminBindSortableThumbGrid(sortTarget, v.images, () => renderImagePreviews(targetId));
        }
        syncAdminMediaStatus(targetId);
    }
}

// Global helper to upload a file to Cloudinary (images + videos) with optional per-file progress
function uploadToCloudinary(file, onProgress) {
    const isVideo = file.type && file.type.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', PRESET);
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`);
        if (xhr.upload && typeof onProgress === 'function') {
            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) onProgress(e.loaded / e.total);
            };
        }
        xhr.onload = () => {
            try {
                const d = JSON.parse(xhr.responseText || '{}');
                if (d.secure_url) resolve(d.secure_url);
                else reject(new Error(d.error ? d.error.message : 'Cloudinary upload failed'));
            } catch (e) {
                reject(new Error('Cloudinary upload failed'));
            }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(fd);
    });
}

const ADMIN_DEFAULT_FRAME_COUNT = 16;
const ADMIN_MIN_FRAME_COUNT = 8;
const ADMIN_MAX_FRAME_COUNT = 72;

function adminClampFrameCount(n) {
    const v = parseInt(n, 10);
    if (!v || !isFinite(v)) return ADMIN_DEFAULT_FRAME_COUNT;
    return Math.min(ADMIN_MAX_FRAME_COUNT, Math.max(ADMIN_MIN_FRAME_COUNT, v));
}

function adminAutoFrameCount(duration) {
    if (!duration || !isFinite(duration) || duration <= 0) return ADMIN_DEFAULT_FRAME_COUNT;
    const raw = Math.round(duration * 2);
    const snapped = Math.min(ADMIN_MAX_FRAME_COUNT, Math.max(ADMIN_MIN_FRAME_COUNT, raw));
    return snapped % 2 === 0 ? snapped : Math.min(ADMIN_MAX_FRAME_COUNT, snapped + 1);
}

function adminSetSaveProgress(percent, label) {
    const wrap = document.getElementById('admin-save-progress');
    const bar = document.getElementById('admin-save-progress-bar');
    const text = document.getElementById('admin-save-progress-text');
    if (wrap) wrap.style.display = 'block';
    if (bar) bar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    if (text) text.textContent = label || '';
}

function adminHideSaveProgress() {
    const wrap = document.getElementById('admin-save-progress');
    if (wrap) wrap.style.display = 'none';
    const bar = document.getElementById('admin-save-progress-bar');
    if (bar) bar.style.width = '0%';
    const text = document.getElementById('admin-save-progress-text');
    if (text) text.textContent = '';
}

async function adminUploadManyFiles(files, onProgress) {
    if (!files.length) return [];
    const fileProgress = new Array(files.length).fill(0);
    let completed = 0;
    const report = () => {
        if (!onProgress) return;
        const sum = fileProgress.reduce((a, b) => a + b, 0);
        const pct = Math.round((sum / files.length) * 100);
        onProgress(pct, completed, files.length);
    };
    return Promise.all(files.map((file, i) =>
        uploadToCloudinary(file, (p) => {
            fileProgress[i] = p;
            report();
        }).then(url => {
            fileProgress[i] = 1;
            completed++;
            report();
            return url;
        })
    ));
}

function adminCreateUploadBatch() {
    const files = [];
    return {
        add(item) {
            if (item instanceof File) {
                const index = files.length;
                files.push(item);
                return { __uploadIndex: index };
            }
            return item;
        },
        async run(onProgress) {
            const urls = files.length ? await adminUploadManyFiles(files, onProgress) : [];
            return (ref) => {
                if (ref && typeof ref === 'object' && ref.__uploadIndex !== undefined) {
                    return urls[ref.__uploadIndex];
                }
                return ref;
            };
        }
    };
}

function adminFrameExtractControlsHtml(targetId, index, compact = false) {
    const inputId = `admin-frame-custom-${targetId}-${index}`;
    return `
        <div class="admin-video-frame-tools${compact ? ' admin-video-frame-tools--compact' : ''}">
            <div class="admin-video-frame-tools__row">
                <button type="button" class="admin-media-action-btn admin-media-action-btn--gold" onclick="event.stopPropagation(); extractVideoFramesForSpin('${targetId}', ${index}, ${ADMIN_DEFAULT_FRAME_COUNT})">${ADMIN_DEFAULT_FRAME_COUNT} frames</button>
                <button type="button" class="admin-media-action-btn" onclick="event.stopPropagation(); extractVideoFramesForSpin('${targetId}', ${index}, 'auto')">Auto</button>
            </div>
            <div class="admin-video-frame-tools__custom">
                <input type="number" id="${inputId}" class="admin-frame-custom-input" min="${ADMIN_MIN_FRAME_COUNT}" max="${ADMIN_MAX_FRAME_COUNT}" value="24" aria-label="Custom frame count" onclick="event.stopPropagation();">
                <button type="button" class="admin-media-action-btn" onclick="event.stopPropagation(); extractVideoFramesCustom('${targetId}', ${index})">Custom</button>
            </div>
            <p class="admin-video-frame-tools__hint">Default ${ADMIN_DEFAULT_FRAME_COUNT} · Auto fits clip length (${ADMIN_MIN_FRAME_COUNT}–${ADMIN_MAX_FRAME_COUNT}) · works with flat and 360° video</p>
        </div>`;
}

function adminVideoExtractPanelHtml(targetId, index, is360, highlight = false) {
    const extractCls = highlight ? ' admin-video-card__extract--highlight' : '';
    const panoSection = is360
        ? `<div class="admin-video-extract-section admin-video-extract-section--pano">
                <p class="admin-video-extract-section__title">Panorama still → Look Around</p>
                <button type="button" class="admin-video-card__extract admin-video-card__extract--pano" onclick="event.stopPropagation(); extractPanoramaFromVideo('${targetId}', ${index})">
                    <i class="fa fa-street-view"></i> Extract panorama still <em>(2:1 360° video)</em>
                </button>
                <p class="admin-video-extract-muted">One equirectangular frame for the Street View–style <strong>Look Around</strong> button.</p>
            </div>`
        : `<div class="admin-video-extract-section">
                <p class="admin-video-extract-muted">Panorama extract needs a <strong>2:1 equirectangular</strong> (360°) video. Mark immersive 360° above or upload a 360° clip.</p>
            </div>`;
    return `
        <details class="admin-video-card__extract-panel"${highlight ? ' open' : ''} onclick="event.stopPropagation();">
            <summary class="admin-video-card__extract${extractCls}"><i class="fa fa-magic"></i> Extract from video</summary>
            <div class="admin-video-extract-section">
                <p class="admin-video-extract-section__title">Rotation frames → Rotate</p>
                ${adminFrameExtractControlsHtml(targetId, index, true)}
                ${is360 ? '<p class="admin-video-extract-warn">360° footage: rotation frames may look warped — flat product videos work best for spin.</p>' : ''}
            </div>
            ${panoSection}
        </details>`;
}

function adminVideoNewUploadOfferHtml(targetId, index, is360) {
    const panoBtn = is360
        ? `<button type="button" class="admin-media-action-btn admin-video-offer-pano-btn" onclick="event.stopPropagation(); extractPanoramaFromVideo('${targetId}', ${index})"><i class="fa fa-street-view"></i> Panorama</button>`
        : '';
    return `
        <div class="admin-video-frame-offer${is360 ? ' admin-video-frame-offer--360' : ''}">
            <p>${is360
                ? '360° video — extract panorama for <strong>Look Around</strong> and/or rotation frames for <strong>Rotate</strong>.'
                : 'Also add swipe-to-rotate photos from this clip?'}</p>
            <div class="admin-video-frame-offer__actions">
                ${panoBtn}
                <button type="button" class="admin-media-action-btn admin-media-action-btn--gold" onclick="event.stopPropagation(); extractVideoFramesForSpin('${targetId}', ${index}, ${ADMIN_DEFAULT_FRAME_COUNT})">${ADMIN_DEFAULT_FRAME_COUNT} rotation frames</button>
            </div>
            <button type="button" class="admin-media-action-btn admin-video-frame-offer__dismiss" onclick="event.stopPropagation(); dismissVideoFrameOffer('${targetId}', ${index})">Not now</button>
        </div>`;
}

async function adminDetectVideoFormatOnUpload(targetId, index) {
    const items = targetId === 'base'
        ? (existingVideoUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.videos || []);
    const entry = items[index];
    if (!entry || typeof entry !== 'object') return;
    const normalized = normalizeStoredVideo(entry);
    if (!normalized?.file && !normalized?.url) return;
    let prep;
    try {
        prep = await adminPrepareVideoSource(normalized);
    } catch {
        return;
    }
    try {
        const is360Video = await adminVideoIsEquirectangular(normalized, prep.url, prep.useCrossOrigin);
        if (!is360Video) return;
        entry.is360 = true;
        entry._promptFrames = true;
        entry._is360Detected = true;
        renderVideoPreviews(targetId);
        showToast('360° video detected — extract panorama (Look Around) and/or rotation frames (Rotate).');
    } catch (e) {
        console.warn('adminDetectVideoFormatOnUpload:', e);
    } finally {
        if (prep?.revoke) URL.revokeObjectURL(prep.url);
    }
}

function renderSpinPreviews(targetId = 'base') {
    const container = document.getElementById(targetId === 'base' ? 'm-spin-preview' : `v-spin-preview-${targetId}`);
    if (!container) return;
    const items = targetId === 'base' ? (existingSpinUrls || []) : (variantBlocks.find(x => x.id === targetId)?.spinImages || []);
    const helpHtml = items.length
        ? `<p class="admin-media-spin-help">Powers the <strong>Rotate</strong> button on the shop. Save product, then test on the storefront.</p>`
        : `<p class="admin-media-spin-meta admin-media-empty">No rotation frames yet — upload photos, copy from gallery, or extract from a video card.</p>`;
    const actionsHtml = items.length >= 2 ? `
        <div class="admin-media-spin-actions">
            <button type="button" class="admin-media-action-btn admin-media-action-btn--gold" onclick="previewAdminSpin('${targetId}')">
                <i class="fa fa-play-circle"></i> Preview full rotation
            </button>
            <button type="button" class="admin-media-action-btn" onclick="clearSpinFrames('${targetId}')">Clear all frames</button>
        </div>` : '';
    const gridHtml = items.map((img, i) => {
        const isFile = img instanceof File;
        const url = adminResolveMediaUrl(img);
        return adminMediaThumbHtml({
            url, index: i, targetId,
            previewFn: `previewAdminSpinFrame('${targetId}', ${i})`,
            onRemove: `removeSpinImage('${targetId}', ${i})`,
            size: 52, objectFit: 'contain', isNew: isFile,
            badge: i + 1, extraClass: 'admin-media-thumb--spin admin-spin-thumb'
        });
    }).join('');
    container.innerHTML = `${helpHtml}<div class="admin-spin-grid admin-media-preview-grid admin-media-preview-grid--spin">${gridHtml}</div>${actionsHtml}`;

    const grid = container.querySelector('.admin-spin-grid');
    if (grid) {
        adminBindSortableThumbGrid(grid, targetId === 'base' ? existingSpinUrls : (variantBlocks.find(x => x.id === targetId)?.spinImages), () => renderSpinPreviews(targetId), '.admin-spin-thumb');
    }
    syncAdminSpinFramesAccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
}

function previewAdminSpin(targetId = 'base') {
    const items = targetId === 'base' ? (existingSpinUrls || []) : (variantBlocks.find(x => x.id === targetId)?.spinImages || []);
    const frames = items.map(img => adminResolveMediaUrl(img)).filter(Boolean);
    if (frames.length < 2) return showToast('Need at least 2 rotation frames to preview.');
    if (typeof openMediaViewer !== 'function') return;
    const name = document.getElementById('m-name')?.value || 'Product Preview';
    openMediaViewer({
        mode: 'spin360',
        spinFrames: frames,
        title: name,
        images: frames
    });
}
window.previewAdminSpin = previewAdminSpin;

function clearSpinFrames(targetId = 'base') {
    if (targetId === 'base') {
        existingSpinUrls = [];
        renderSpinPreviews('base');
    } else {
        const v = variantBlocks.find(x => x.id === targetId);
        if (v) v.spinImages = [];
        renderSpinPreviews(targetId);
    }
    syncAdmin360AccordionSummary(targetId);
    showToast('Rotation frames cleared.');
}
window.clearSpinFrames = clearSpinFrames;
window.renderSpinPreviews = renderSpinPreviews;

function renderPanoramaPreviews(targetId = 'base') {
    const container = document.getElementById(targetId === 'base' ? 'm-panorama-preview' : `v-panorama-preview-${targetId}`);
    if (!container) return;
    const items = targetId === 'base' ? (existingPanoramaUrls || []) : (variantBlocks.find(x => x.id === targetId)?.panoramaImages || []);
    const scopeLabel = targetId === 'base' ? '🌐 All variants' : '🎯 This variant';
    if (!items.length) {
        container.innerHTML = adminMediaEmptyHint('No panorama yet — tap 👁 after upload to look around in preview');
        syncAdmin360AccordionSummary(targetId);
        syncAdminMediaStatus(targetId);
        return;
    }
    const meta = `<p class="admin-media-spin-meta">${scopeLabel} · <strong>${items.length}</strong> scene${items.length === 1 ? '' : 's'} · drag to reorder · 👁 to preview</p>`;
    const gridHtml = items.map((img, i) => {
        const isFile = img instanceof File;
        const url = adminResolveMediaUrl(img);
        return adminMediaThumbHtml({
            url, index: i, targetId,
            previewFn: `previewAdminPanorama('${targetId}', ${i})`,
            onRemove: `removePanoramaImage('${targetId}', ${i})`,
            size: 80, objectFit: 'cover', isNew: isFile,
            badge: i + 1, extraClass: 'admin-media-thumb--panorama admin-pano-thumb'
        });
    }).join('');
    container.innerHTML = `${meta}<div class="admin-pano-grid admin-media-preview-grid-inner">${gridHtml}</div>`;
    const grid = container.querySelector('.admin-pano-grid');
    const list = targetId === 'base' ? existingPanoramaUrls : (variantBlocks.find(x => x.id === targetId)?.panoramaImages);
    if (grid) {
        adminBindSortableThumbGrid(grid, list, () => renderPanoramaPreviews(targetId), '.admin-pano-thumb');
    }
    syncAdmin360AccordionSummary(targetId);
    syncAdminMediaStatus(targetId);
}
window.renderPanoramaPreviews = renderPanoramaPreviews;

function previewAdminVideo(targetId, index) {
    const items = targetId === 'base'
        ? (existingVideoUrls || [])
        : (variantBlocks.find(x => x.id === targetId)?.videos || []);
    const entry = normalizeStoredVideo(items[index]);
    if (!entry) return;
    let url = entry.url;
    let revoke = null;
    if (entry.file instanceof File) {
        url = URL.createObjectURL(entry.file);
        revoke = url;
    }
    if (!url || typeof openMediaViewer !== 'function') return;
    openMediaViewer({
        mode: entry.is360 ? 'video360' : 'video',
        videoUrl: url,
        videoSavedAs360: !!entry.is360,
        videoAllowModeSwitch: true,
        title: entry.is360 ? '360° Video Preview' : 'Video Preview'
    });
    if (revoke) {
        setTimeout(() => URL.revokeObjectURL(revoke), 60000);
    }
}
window.previewAdminVideo = previewAdminVideo;

function renderVideoPreviews(targetId = 'base') {
    const container = document.getElementById(targetId === 'base' ? 'm-video-preview' : `v-video-preview-${targetId}`);
    if (!container) return;
    const items = targetId === 'base' ? (existingVideoUrls || []) : (variantBlocks.find(x => x.id === targetId)?.videos || []);
    const scopeBadge = adminMediaScopeBadge(targetId === 'base' ? 'global' : 'variant');
    if (!items.length) {
        container.innerHTML = adminMediaEmptyHint('No video yet — tap ▶ on a video card to preview after upload');
        syncAdminMediaStatus(targetId);
        return;
    }
    container.innerHTML = items.map((vid, i) => {
        const entry = normalizeStoredVideo(vid);
        if (!entry) return '';
        const label = getStoredVideoLabel(vid);
        const is360 = !!entry.is360;
        const promptFrames = !!(vid && vid._promptFrames);
        return `
            <div class="admin-video-card ${is360 ? 'admin-video-card--360' : ''}${promptFrames ? ' admin-video-card--new' : ''}">
                <div class="admin-video-card__head">
                    ${scopeBadge}
                    ${adminMediaTypeBadge('video', is360 ? 'Immersive 360°' : 'Flat playback')}
                </div>
                <button type="button" class="admin-video-card__preview" onclick="previewAdminVideo('${targetId}', ${i})" title="Preview video">
                    <i class="fa fa-${is360 ? 'street-view' : 'play-circle'}"></i>
                    <span class="admin-video-card__label">${label}</span>
                    <span class="admin-video-card__play-hint">Tap to preview</span>
                    <button type="button" class="admin-video-card__remove" onclick="event.stopPropagation(); removeVideoItem('${targetId}', ${i})" title="Remove"><i class="fa fa-times"></i></button>
                </button>
                ${promptFrames ? adminVideoNewUploadOfferHtml(targetId, i, is360) : ''}
                <label class="admin-video-card__toggle" onclick="event.stopPropagation();">
                    <input type="checkbox" ${is360 ? 'checked' : ''} onchange="toggleVideo360('${targetId}', ${i}, this.checked)">
                    <span>Play as immersive 360° video <em>(2:1 equirectangular only)</em></span>
                </label>
                ${adminVideoExtractPanelHtml(targetId, i, is360, false)}
                <p class="admin-video-card__note">Shop: <strong>Video</strong> plays this clip · <strong>Rotate</strong> = swipe stills · <strong>Look Around</strong> = drag a 360° scene (panorama still from 2:1 video or photo).</p>
            </div>`;
    }).join('');
    syncAdminMediaStatus(targetId);
}
window.renderVideoPreviews = renderVideoPreviews;

async function saveProduct() { 
    const validationErrors = adminValidateProductForm();
    if (validationErrors.length) {
        adminShowValidationErrors(validationErrors);
        if (typeof adminCrudDraftsEnabled === 'function' && adminCrudDraftsEnabled()) {
            showToast('Fix errors to publish, or use Save as draft to keep your work.');
        } else {
            showToast('Fix the errors below before saving.');
        }
        return;
    }
    adminShowValidationErrors([]);

    const n = document.getElementById('m-name').value.trim();
    const pr = document.getElementById('m-price').value; 
    if(!n || pr === '') return showToast("Name and price are required");

    let spinEnabled = !!document.getElementById('m-is360')?.checked;
    let panoEnabled = !!document.getElementById('m-is360-panorama')?.checked;
    let spinAutoOff = false;
    let panoAutoOff = false;
    if (spinEnabled && (existingSpinUrls || []).length < 2) {
        spinEnabled = false;
        spinAutoOff = true;
        const chk = document.getElementById('m-is360');
        if (chk) chk.checked = false;
        toggle360Badge('base', false);
    }
    if (panoEnabled && (existingPanoramaUrls || []).length < 1) {
        panoEnabled = false;
        panoAutoOff = true;
        const chk = document.getElementById('m-is360-panorama');
        if (chk) chk.checked = false;
        toggle360PanoramaBadge('base', false);
    }
    if (spinAutoOff || panoAutoOff) {
        const parts = [];
        if (spinAutoOff) parts.push('Rotate (need at least 2 frames)');
        if (panoAutoOff) parts.push('Look Around (need at least 1 panorama)');
        showToast(`360° turned off: ${parts.join(' · ')}`);
    }
    for (const v of variantBlocks) {
        if (v.is360 && (v.spinImages || []).length < 2) v.is360 = false;
        if (v.is360Panorama && (v.panoramaImages || []).length < 1) v.is360Panorama = false;
    }

    const btn = document.getElementById('m-save');
    btn.disabled = true; 
    btn.innerText = "Saving..."; 
    
    try { 
        const batch = adminCreateUploadBatch();
        const finalMainImages = (existingImageUrls || []).map(img => batch.add(img));
        const finalSpinImages = (existingSpinUrls || []).map(img => batch.add(img));
        const finalPanoramaImages = (existingPanoramaUrls || []).map(img => batch.add(img));
        const finalVideos = (existingVideoUrls || []).map(entry => {
            const n = normalizeStoredVideo(entry);
            if (!n) return null;
            const url = n.file instanceof File ? batch.add(n.file) : n.url;
            if (!url) return null;
            return { url, is360: !!n.is360 };
        }).filter(Boolean);

        migrateVariantStockMaps();

        const parsedVariantsResult = variantBlocks.map(v => {
            const uploadedVariantImages = (v.images || []).map(img => batch.add(img));
            const uploadedSpinImages = (v.spinImages || []).map(img => batch.add(img));
            const uploadedPanoramaImages = (v.panoramaImages || []).map(img => batch.add(img));
            const uploadedVideos = (v.videos || []).map(entry => {
                const n = normalizeStoredVideo(entry);
                if (!n) return null;
                const url = n.file instanceof File ? batch.add(n.file) : n.url;
                if (!url) return null;
                return { url, is360: !!n.is360 };
            }).filter(Boolean);
            const uploadedPreviewUrls = (v.previewImages || []).map(img => batch.add(img));

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
                trackVariantStock: !!v.trackVariantStock,
                trackComboStock: !!v.trackComboStock,
                variantStockCount: getVariantBlockStockCount(v),
                trackStock: !!(v.trackVariantStock || v.trackComboStock),
                stockCount: typeof v.stockCount === 'number' ? v.stockCount : (parseInt(v.stockCount, 10) || 0),
                stockBySku: v.stockBySku && typeof v.stockBySku === 'object' ? { ...v.stockBySku } : {},
                is360: !!v.is360,
                is360Panorama: !!v.is360Panorama,
                threeSixtyCols: uploadedSpinImages.length || (v.threeSixtyCols ? Number(v.threeSixtyCols) : 1),
                threeSixtyRows: v.threeSixtyRows ? Number(v.threeSixtyRows) : 1,
                spinImages: uploadedSpinImages,
                panoramaImages: uploadedPanoramaImages,
                videos: uploadedVideos,
                images: uploadedVariantImages,
                previewImages: uploadedPreviewUrls
            };
        }).filter(x => x !== null);

        const resolve = await batch.run((pct, done, total) => {
            adminSetSaveProgress(pct, total ? `Uploading ${done}/${total}… ${pct}%` : 'Preparing…');
        });

        const resolvedMainImages = finalMainImages.map(resolve);
        const resolvedSpinImages = finalSpinImages.map(resolve);
        const resolvedPanoramaImages = finalPanoramaImages.map(resolve);
        const resolvedVideos = finalVideos.map(v => ({ url: resolve(v.url), is360: v.is360 }));

        const parsedVariants = parsedVariantsResult.map(v => ({
            ...v,
            images: v.images.map(resolve),
            spinImages: v.spinImages.map(resolve),
            panoramaImages: v.panoramaImages.map(resolve),
            videos: v.videos.map(vid => ({ url: resolve(vid.url), is360: vid.is360 })),
            previewImages: v.previewImages.map(resolve),
            threeSixtyCols: v.spinImages.length || v.threeSixtyCols
        }));
        
        const mergedVariants = [];
        parsedVariants.forEach(v => {
            const dup = mergedVariants.find(x => x.size.trim().toLowerCase() === v.size.trim().toLowerCase() && 
                                                 x.color.trim().toLowerCase() === v.color.trim().toLowerCase() && 
                                                 x.pattern.trim().toLowerCase() === v.pattern.trim().toLowerCase());
            if (dup) {
                dup.images = [...new Set([...(dup.images || []), ...(v.images || [])])];
                dup.previewImages = [...new Set([...(dup.previewImages || []), ...(v.previewImages || [])])];
                if (v.trackVariantStock || v.trackComboStock || v.trackStock) {
                    dup.trackStock = true;
                    if (v.trackComboStock) {
                        dup.trackComboStock = true;
                        dup.stockBySku = dup.stockBySku || {};
                        if (v.stockBySku && typeof v.stockBySku === 'object') {
                            Object.entries(v.stockBySku).forEach(([k, n]) => {
                                dup.stockBySku[k] = (parseInt(dup.stockBySku[k], 10) || 0) + (parseInt(n, 10) || 0);
                            });
                        }
                    }
                    if (v.trackVariantStock) {
                        dup.trackVariantStock = true;
                        dup.variantStockCount = (parseInt(dup.variantStockCount, 10) || 0) + getVariantBlockStockCount(v);
                        dup.stockCount = dup.variantStockCount;
                    } else if (!v.trackComboStock && v.trackStock) {
                        dup.stockCount = (parseInt(dup.stockCount, 10) || 0) + (parseInt(v.stockCount, 10) || 0);
                    }
                }
                if (dup.price === null || dup.price === undefined) {
                    dup.price = v.price;
                }
                if (v.isActive) dup.isActive = true;
                if (v.is360) {
                    dup.is360 = true;
                    dup.spinImages = [...new Set([...(dup.spinImages || []), ...(v.spinImages || [])])];
                    dup.threeSixtyCols = dup.spinImages.length || (v.threeSixtyCols ? Number(v.threeSixtyCols) : 1);
                    dup.threeSixtyRows = v.threeSixtyRows ? Number(v.threeSixtyRows) : 1;
                }
                if (v.is360Panorama) {
                    dup.is360Panorama = true;
                    dup.panoramaImages = [...new Set([...(dup.panoramaImages || []), ...(v.panoramaImages || [])])];
                }
                if (v.videos && v.videos.length) {
                    dup.videos = mergeStoredVideos(dup.videos, v.videos);
                }
                if (v.hideDetailsGallery) dup.hideDetailsGallery = true;
                if (v.showInMainCarousel) dup.showInMainCarousel = true;
                if (v.showPatternText) dup.showPatternText = true;
            } else {
                mergedVariants.push(v);
            }
        });
        
        const globalStock = typeof readGlobalStockFromForm === 'function'
            ? readGlobalStockFromForm()
            : { trackGlobalStock: false, globalStockCount: 0 };

        const data = { 
            name: n, 
            price: Number(pr), 
            description: document.getElementById('m-desc').value, 
            ...(typeof readProductCategoryFromForm === 'function' ? readProductCategoryFromForm() : {}),
            hideMainCarousel: document.getElementById('m-hide-main').checked,
            hideMainDetailsCarousel: document.getElementById('m-hide-main-details').checked,
            mainImagesPosition: document.getElementById('m-main-pos').value,
            hideNoImagePlaceholder: document.getElementById('m-hide-main-placeholder').checked,
            is360: spinEnabled,
            is360Panorama: panoEnabled,
            threeSixtyCols: resolvedSpinImages.length || 1,
            threeSixtyRows: 1,
            spinImages: resolvedSpinImages,
            panoramaImages: resolvedPanoramaImages,
            videos: resolvedVideos,
            trackGlobalStock: globalStock.trackGlobalStock,
            globalStockCount: globalStock.globalStockCount,
            images: resolvedMainImages,
            variants: mergedVariants,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ...(editingId ? {} : { createdAt: firebase.firestore.FieldValue.serverTimestamp() }),
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
        
        adminSetSaveProgress(96, 'Saving to database…');
        if(editingId) {
            await db.collection("products").doc(editingId).update(data); 
        } else {
            await db.collection("products").add(data); 
        }
        
        adminHideSaveProgress();
        adminProductSnapshot = null;
        if (typeof adminClearProductDraftUi === 'function') adminClearProductDraftUi();
        window._adminProductLiveBaseline = null;
        if (typeof clearProductDraftForCurrent === 'function') clearProductDraftForCurrent();
        showToast(editingId ? 'Product updated!' : 'Product created!');
        closeModal('prod-modal'); 
    } catch(e) { 
        adminHideSaveProgress();
        console.error(e);
        if (typeof adminCrudDraftsEnabled === 'function' && adminCrudDraftsEnabled() && typeof saveProductAsDraft === 'function') {
            await saveProductAsDraft(true);
            showToast('Could not publish — saved as draft. Fix issues and try again.');
        } else {
            showToast("Error saving product: " + e.message);
        }
    } 
    btn.disabled = false; 
    btn.innerText = "Save Product"; 
}

// Render admin list on load if already authenticated as admin
if (isAdmin) {
    renderAdmin();
    loadPromoSettings();
    if (typeof loadAnnouncementSettingsAdmin === 'function') loadAnnouncementSettingsAdmin();
}

// ── Admin Copy / Import / Export ───────────────────────────────────────────
function copyProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return showToast('Product not found.');
    
    editingId = null;
    adminSetModalTitle('copy');
    adminShowValidationErrors([]);
    showToast('Duplicate shares the same media URLs until you upload new files.');
    document.getElementById('m-name').value = p.name + " - Copy"; 
    document.getElementById('m-price').value = p.price; 
    document.getElementById('m-desc').value = p.description || ""; 
    document.getElementById('m-hide-main').checked = !!p.hideMainCarousel;
    document.getElementById('m-hide-main-details').checked = !!p.hideMainDetailsCarousel;
    document.getElementById('m-main-pos').value = p.mainImagesPosition || 'end';
    document.getElementById('m-main-pos-container').style.display = p.hideMainDetailsCarousel ? 'none' : 'flex';
    document.getElementById('m-hide-main-placeholder').checked = !!p.hideNoImagePlaceholder;
    
    syncAdmin360PanelVisibility();
    const mainIs360 = document.getElementById('m-is360');
    if (mainIs360) {
        mainIs360.checked = !!p.is360;
        toggle360Badge('base', !!p.is360);
    }
    const mainIs360Panorama = document.getElementById('m-is360-panorama');
    if (mainIs360Panorama) {
        mainIs360Panorama.checked = !!p.is360Panorama;
        toggle360PanoramaBadge('base', !!p.is360Panorama);
    }

    existingImageUrls = [...(p.images || [])];
    existingSpinUrls = [...(p.spinImages || [])];
    existingPanoramaUrls = [...(p.panoramaImages || [])];
    existingVideoUrls = (p.videos || []).map(normalizeStoredVideo).filter(Boolean);
    if (typeof hydrateGlobalStockForm === 'function') hydrateGlobalStockForm(p);
    
    // Load variants or fallback
    if (p.variants && Array.isArray(p.variants)) {
        variantBlocks = p.variants.map(mapSavedVariantToBlock);
        migrateVariantStockMaps();
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
                        trackVariantStock: false,
                        trackComboStock: false,
                        variantStockCount: 0,
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
                    trackVariantStock: false,
                    trackComboStock: false,
                    variantStockCount: 0,
                    trackStock: false,
                    stockCount: 0,
                    images: [],
                    previewImages: []
                });
            }
        });
    }

    renderImagePreviews('base');
    renderSpinPreviews('base');
    renderPanoramaPreviews('base');
    renderVideoPreviews('base');
    syncAdmin360AccordionSummary('base');
    syncAdminMediaStatus('base');
    renderVariantBlocks();
    if (p.is360 || p.is360Panorama || (p.spinImages || []).length || (p.panoramaImages || []).length) {
        toggleAdmin360Accordion('base', true);
    } else {
        toggleAdmin360Accordion('base', false);
    }
    variantBlocks.forEach(v => {
        if (v.is360 || v.is360Panorama || (v.spinImages || []).length || (v.panoramaImages || []).length) {
            toggleAdmin360Accordion(v.id, true);
        }
    });
    if (typeof hydrateProductCategoryForm === 'function') hydrateProductCategoryForm(p);
    if (typeof resetProductGuideAccordion === 'function') resetProductGuideAccordion();
    document.getElementById('prod-modal').style.display = 'flex';
    adminResetProductSnapshot();
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
        "Category": (typeof resolveProductCategoryLabel === 'function' ? resolveProductCategoryLabel(p) : (p.categoryName || "")),
        "Images": (p.images && Array.isArray(p.images)) ? p.images.join(', ') : "",
        "SpinImages": (p.spinImages && Array.isArray(p.spinImages)) ? p.spinImages.join(', ') : "",
        "PanoramaImages": (p.panoramaImages && Array.isArray(p.panoramaImages)) ? p.panoramaImages.join(', ') : "",
        "VideosJSON": (p.videos && p.videos.length) ? JSON.stringify(p.videos) : "",
        "Is360": p.is360 ? 'yes' : 'no',
        "Is360Panorama": p.is360Panorama ? 'yes' : 'no',
        "TrackGlobalStock": p.trackGlobalStock ? 'yes' : 'no',
        "GlobalStockCount": p.globalStockCount || 0,
        "VariantsJSON": (p.variants && p.variants.length) ? JSON.stringify(p.variants) : "",
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
            
            showToast(`Importing ${importedRows.length} products…`);
            adminSetSaveProgress(0, `Importing 0/${importedRows.length}…`);
            
            let updatedCount = 0;
            let createdCount = 0;
            let rowIndex = 0;
            
            for (const row of importedRows) {
                rowIndex++;
                adminSetSaveProgress(Math.round((rowIndex / importedRows.length) * 100), `Importing ${rowIndex}/${importedRows.length}…`);
                const sizeColorMapStr = row.SizeColorMap || "{}";
                let sizeColorMapObj = {};
                try {
                    sizeColorMapObj = JSON.parse(sizeColorMapStr);
                } catch(e) {
                    console.warn("Invalid SizeColorMap JSON inside Excel row:", row.Name, e);
                }
                
                let variants = [];
                if (row.VariantsJSON) {
                    try {
                        variants = JSON.parse(row.VariantsJSON);
                        if (!Array.isArray(variants)) variants = [];
                    } catch (e) {
                        console.warn('Invalid VariantsJSON for row:', row.Name, e);
                    }
                }
                
                const cleanItem = {
                    name: row.Name || "Unnamed Product",
                    price: Number(row.Price) || 0,
                    description: row.Description || "",
                    ...(typeof resolveCategoryIdFromImportValue === 'function'
                        ? resolveCategoryIdFromImportValue(row.Category)
                        : {}),
                    images: row.Images ? String(row.Images).split(',').map(u => u.trim()).filter(u => u.length > 0) : [],
                    spinImages: row.SpinImages ? String(row.SpinImages).split(',').map(u => u.trim()).filter(u => u.length > 0) : [],
                    panoramaImages: row.PanoramaImages ? String(row.PanoramaImages).split(',').map(u => u.trim()).filter(u => u.length > 0) : [],
                    is360: String(row.Is360 || '').toLowerCase() === 'yes',
                    is360Panorama: String(row.Is360Panorama || '').toLowerCase() === 'yes',
                    trackGlobalStock: String(row.TrackGlobalStock || '').toLowerCase() === 'yes',
                    globalStockCount: parseInt(row.GlobalStockCount, 10) || 0,
                    sizes: row.Sizes ? String(row.Sizes).split(',').map(s => s.trim()).filter(s => s.length > 0) : [],
                    colors: row.Colors ? String(row.Colors).split(',').map(c => c.trim()).filter(c => c.length > 0) : [],
                    sizeColorMap: sizeColorMapObj,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                if (variants.length) cleanItem.variants = variants;
                if (row.VideosJSON) {
                    try {
                        const vids = JSON.parse(row.VideosJSON);
                        if (Array.isArray(vids)) cleanItem.videos = vids;
                    } catch (e) {
                        console.warn('Invalid VideosJSON for row:', row.Name, e);
                    }
                }
                
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
                cleanItem.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await db.collection("products").add(cleanItem);
                createdCount++;
            }
            
            adminHideSaveProgress();
            showToast(`Import done: ${updatedCount} updated, ${createdCount} created.`);
            input.value = ''; // Reset input element
        } catch (err) {
            adminHideSaveProgress();
            console.error("Excel Import Error:", err);
            showToast("Import failed: invalid Excel file format");
        }
    };
    reader.onerror = () => {
        adminHideSaveProgress();
        showToast('Could not read import file.');
        input.value = '';
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
            
            // Storefront products limit
            if (typeof data.limit !== 'undefined') {
                const val = data.limit;
                const inp = document.getElementById('admin-products-page-limit');
                if (inp) inp.value = val;
                if (typeof productsPageLimitSetting !== 'undefined') productsPageLimitSetting = val;
                if (typeof displayedProductsLimit !== 'undefined') displayedProductsLimit = val;
                if (typeof displayedWishlistLimit !== 'undefined') displayedWishlistLimit = val;
            }

            // Admin catalog list limit
            const adminVal = typeof data.adminProductsLimit !== 'undefined' ? data.adminProductsLimit : data.limit;
            if (typeof adminVal !== 'undefined') {
                const val = adminVal;
                const inpAdmin = document.getElementById('admin-editing-products-page-limit');
                if (inpAdmin) inpAdmin.value = val;
                window.adminProductsPageLimitSetting = val;
            }
            
            // Orders limit
            if (typeof data.ordersLimit !== 'undefined') {
                const val = data.ordersLimit;
                const inp = document.getElementById('admin-orders-page-limit');
                if (inp) inp.value = val;
                if (typeof ordersPageLimitSetting !== 'undefined') ordersPageLimitSetting = val;
                if (typeof displayedOrdersLimit !== 'undefined') displayedOrdersLimit = val;
            }

            // Customers limit
            if (typeof data.customersLimit !== 'undefined') {
                const val = data.customersLimit;
                const inp = document.getElementById('admin-customers-page-limit');
                if (inp) inp.value = val;
                if (typeof customersPageLimitSetting !== 'undefined') customersPageLimitSetting = val;
                if (typeof displayedAllCustomersLimit !== 'undefined') displayedAllCustomersLimit = val;
                if (typeof displayedSuperCustomersLimit !== 'undefined') displayedSuperCustomersLimit = val;
            }
        }
        if (typeof window.loadAdminFeatureContent === 'function') {
            window.loadAdminFeatureContent();
        }
    } catch(e) {
        console.error('loadPaginationSettings error:', e);
    }
}

window.savePaginationSettings = async function() {
    const inp = document.getElementById('admin-products-page-limit');
    const inpAdmin = document.getElementById('admin-editing-products-page-limit');
    const inpOrders = document.getElementById('admin-orders-page-limit');
    const inpCustomers = document.getElementById('admin-customers-page-limit');
    
    let val = 20;
    if (inp) {
        val = parseInt(inp.value, 10);
        if (isNaN(val) || val < 1) val = 20;
        inp.value = val;
    }

    let valAdmin = 20;
    if (inpAdmin) {
        valAdmin = parseInt(inpAdmin.value, 10);
        if (isNaN(valAdmin) || valAdmin < 1) valAdmin = 20;
        inpAdmin.value = valAdmin;
    }
    
    let valOrders = 20;
    if (inpOrders) {
        valOrders = parseInt(inpOrders.value, 10);
        if (isNaN(valOrders) || valOrders < 1) valOrders = 20;
        inpOrders.value = valOrders;
    }

    let valCustomers = 10;
    if (inpCustomers) {
        valCustomers = parseInt(inpCustomers.value, 10);
        if (isNaN(valCustomers) || valCustomers < 1) valCustomers = 10;
        inpCustomers.value = valCustomers;
    }
    
    try {
        const payload = { limit: val, adminProductsLimit: valAdmin, ordersLimit: valOrders, customersLimit: valCustomers };
        await db.collection('settings').doc('pagination').set(payload, { merge: true });
        
        if (typeof productsPageLimitSetting !== 'undefined') productsPageLimitSetting = val;
        if (typeof displayedProductsLimit !== 'undefined') displayedProductsLimit = val;
        if (typeof displayedWishlistLimit !== 'undefined') displayedWishlistLimit = val;
        window.adminProductsPageLimitSetting = valAdmin;
        window.adminProductsPage = 1;
        
        if (typeof ordersPageLimitSetting !== 'undefined') ordersPageLimitSetting = valOrders;
        if (typeof displayedOrdersLimit !== 'undefined') displayedOrdersLimit = valOrders;

        if (typeof customersPageLimitSetting !== 'undefined') customersPageLimitSetting = valCustomers;
        if (typeof displayedAllCustomersLimit !== 'undefined') displayedAllCustomersLimit = valCustomers;
        if (typeof displayedSuperCustomersLimit !== 'undefined') displayedSuperCustomersLimit = valCustomers;
        
        showToast('✅ Pagination settings saved successfully!');
        if (typeof renderStore === 'function') renderStore();
        if (typeof loadOrders === 'function') loadOrders();
        if (typeof filterSuperCustomers === 'function') filterSuperCustomers();
        if (typeof filterAllCustomers === 'function') filterAllCustomers();
        if (typeof renderAdmin === 'function') renderAdmin();
    } catch(e) {
        console.error('savePaginationSettings error:', e);
        showToast('Failed to save pagination settings');
    }
}

// ── Promo Code Settings ─────────────────────────────────────────────────────
let adminPromoList = [];
let promoListInterval = null;
let promoPickerEnabled = false;

async function loadPromoSettings() {
    try {
        const snap = await db.collection('settings').doc('promos').get();
        if (snap.exists) {
            const data = snap.data() || {};
            const list = data.list || [];
            promoPickerEnabled = data.showPromoInOptions === true || data.showPromoPicker === true;
            adminPromoList = list.map(p => {
                if (p.expiresAt && !p.endsAt) {
                    p.endsAt = p.expiresAt;
                }
                if (p.showInOptions === undefined) {
                    p.showInOptions = p.showInPicker === true;
                }
                return p;
            });
        }
        const pickerToggle = document.getElementById('admin-promo-show-picker');
        if (pickerToggle) pickerToggle.checked = promoPickerEnabled;
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
                    <label style="display:flex; align-items:center; gap:8px; font-size:11px; color:#bbb; cursor:pointer;">
                        <input type="checkbox" id="inline-promo-show-in-picker-${index}" ${(p.showInOptions || p.showInPicker) ? 'checked' : ''} style="margin:0; width:15px; height:15px;">
                        Show this promo in checkout options
                    </label>
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

        const optionsBadge = (p.showInOptions || p.showInPicker)
            ? `<span style="color:var(--gold); font-size:10px; margin-left:8px; font-weight:700;">[In checkout options]</span>`
            : '';

        return `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; border-radius:10px; border:1px dashed #444; flex-wrap:wrap; gap:10px;">
                <div>
                    <span style="color:var(--gold); font-weight:bold; font-size:13px; letter-spacing:1px;">${p.code}</span>
                    <span style="color:#aaa; font-size:11px; margin-left:8px;">${p.discount}% OFF</span>
                    ${usesText}
                    ${optionsBadge}
                    ${scheduleText}
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <label style="display:flex; align-items:center; gap:4px; font-size:10px; color:#888; cursor:pointer;" title="Show in checkout options">
                        <input type="checkbox" ${(p.showInOptions || p.showInPicker) ? 'checked' : ''} onchange="togglePromoShowInOptions(${index}, this.checked)" style="margin:0; width:14px; height:14px;">
                        Options
                    </label>
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
    
    const newPromo = {
        code,
        discount,
        usedCount: 0,
        showInOptions: !!document.getElementById('admin-promo-show-in-picker')?.checked
    };
    
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
    const showInPickerInp = document.getElementById('admin-promo-show-in-picker');
    if (showInPickerInp) showInPickerInp.checked = false;
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
        await db.collection('settings').doc('promos').set({
            list: adminPromoList
        }, { merge: true });
        renderAdminPromoList();
        
        if (typeof activePromosList !== 'undefined') {
            activePromosList = adminPromoList;
        }
    } catch(e) {
        console.error('saveAdminPromoSettings error:', e);
        showToast('Failed to save promo settings');
    }
}

async function savePromoOptionsSetting() {
    try {
        promoPickerEnabled = !!document.getElementById('admin-promo-show-picker')?.checked;
        await db.collection('settings').doc('promos').set({
            showPromoInOptions: promoPickerEnabled,
            showPromoPicker: promoPickerEnabled
        }, { merge: true });
        if (typeof window.checkoutPromoPickerEnabled !== 'undefined') {
            window.checkoutPromoPickerEnabled = promoPickerEnabled;
        }
        showToast(promoPickerEnabled
            ? 'Promo options enabled — customers will see Apply Promo at checkout'
            : 'Promo options disabled — Apply Promo hidden at checkout');
    } catch (e) {
        console.error('savePromoOptionsSetting error:', e);
        showToast('Failed to save promo options setting');
    }
}
window.savePromoOptionsSetting = savePromoOptionsSetting;

window.editPromoCode = function(index) {
    editingPromoIndex = index;
    renderAdminPromoList();
}

window.cancelInlineEdit = function() {
    editingPromoIndex = null;
    renderAdminPromoList();
}

window.togglePromoShowInOptions = async function(index, checked) {
    if (index < 0 || index >= adminPromoList.length) return;
    adminPromoList[index].showInOptions = !!checked;
    adminPromoList[index].showInPicker = !!checked;
    try {
        await saveAdminPromoSettings();
        showToast(checked ? 'Promo will appear in checkout options' : 'Promo hidden from checkout options');
    } catch (e) {
        console.error('togglePromoShowInOptions failed:', e);
        showToast('Failed to update promo option');
    }
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

    const showInOptionsInp = document.getElementById(`inline-promo-show-in-picker-${index}`);
    p.showInOptions = !!showInOptionsInp?.checked;
    p.showInPicker = p.showInOptions;
    
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

        const docs = snapshot.docs;
        for (let i = 0; i < docs.length; i += 450) {
            const batch = db.batch();
            docs.slice(i, i + 450).forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            adminSetSaveProgress(Math.round(((i + 450) / docs.length) * 100), `Deleting ${Math.min(i + 450, docs.length)}/${docs.length}…`);
        }
        adminHideSaveProgress();
        showToast(`All ${docs.length} products deleted.`);
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
    
    if (typeof openAdminFeedbackAccordion === 'function') openAdminFeedbackAccordion();
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
            showCopyright: false,
            showLuxuryBrand: false,
            footerTemplate: 'classic',
            footerLayout: 'auto',
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
        const showLuxuryBrandEl = document.getElementById('admin-footer-show-luxury-brand');
        const luxuryBrandTextEl = document.getElementById('admin-footer-luxury-brand-text');
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
        if (showCopyrightEl) showCopyrightEl.checked = settings.showCopyright === true;
        if (showLuxuryBrandEl) showLuxuryBrandEl.checked = settings.showLuxuryBrand === true;
        if (luxuryBrandTextEl) luxuryBrandTextEl.value = settings.luxuryBrandText || settings.copyright || '';
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

        if (typeof renderAdminFooterTemplatePicker === 'function') {
            renderAdminFooterTemplatePicker(settings.footerTemplate, settings.footerLayout);
        }
    } catch (e) {
        console.error('loadAdminFooterSettings error:', e);
    }
}
window.loadAdminFooterSettings = loadAdminFooterSettings;

async function saveAdminFooterSettings() {
    const showFooterEl = document.getElementById('admin-footer-show-footer');
    const showCopyrightEl = document.getElementById('admin-footer-show-copyright');
    const showLuxuryBrandEl = document.getElementById('admin-footer-show-luxury-brand');
    const luxuryBrandTextEl = document.getElementById('admin-footer-luxury-brand-text');
    const copyrightEl = document.getElementById('admin-footer-copyright');
    const aboutTextEl = document.getElementById('admin-footer-about-text');
    const addressEl = document.getElementById('admin-footer-address');
    const showGpsEl = document.getElementById('admin-footer-show-gps');
    const gpsLatEl = document.getElementById('admin-footer-gps-lat');
    const gpsLngEl = document.getElementById('admin-footer-gps-lng');
    const gpsQueryEl = document.getElementById('admin-footer-gps-query');
    const phoneEl = document.getElementById('admin-footer-phone');
    const privacyEl = document.getElementById('admin-footer-privacy-text');
    const templateEl = document.querySelector('input[name="admin-footer-template"]:checked');
    const layoutEl = document.querySelector('input[name="admin-footer-layout"]:checked');
    
    const templateId = templateEl ? templateEl.value : 'classic';
    const isLuxuryTemplate = templateId === 'luxury';

    const settings = {
        showFooter: showFooterEl ? showFooterEl.checked : true,
        showCopyright: showCopyrightEl ? showCopyrightEl.checked : false,
        showLuxuryBrand: isLuxuryTemplate && showLuxuryBrandEl ? showLuxuryBrandEl.checked : false,
        luxuryBrandText: luxuryBrandTextEl ? luxuryBrandTextEl.value.trim() : '',
        copyright: copyrightEl ? copyrightEl.value.trim() : "",
        footerTemplate: templateId,
        footerLayout: layoutEl ? layoutEl.value : 'auto',
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

const BACKUP_FORMAT_VERSION = 2;
const FIRESTORE_BACKUP_COLLECTIONS = [
    'products', 'orders', 'feedbacks', 'product_comments', 'categories', 'admins', 'settings', 'announcements'
];

async function fetchCollectionBackupDocs(collectionName) {
    const snap = await db.collection(collectionName).get();
    const docs = [];
    snap.forEach((doc) => docs.push({ id: doc.id, data: doc.data() }));
    return docs;
}

async function fetchUsersBackupDocs() {
    const usersSnap = await db.collection('users').get();
    const usersList = [];
    for (const doc of usersSnap.docs) {
        const userData = doc.data();
        const addrSnap = await db.collection('users').doc(doc.id).collection('addresses').get();
        const addresses = [];
        addrSnap.forEach((aDoc) => addresses.push({ id: aDoc.id, data: aDoc.data() }));
        usersList.push({ id: doc.id, data: userData, addresses });
    }
    return usersList;
}

async function fetchSupportThreadsBackupDocs() {
    const supportSnap = await db.collection('support_threads').get();
    const supportThreadsList = [];
    for (const doc of supportSnap.docs) {
        const msgSnap = await db.collection('support_threads').doc(doc.id).collection('messages').get();
        const messages = [];
        msgSnap.forEach((mDoc) => messages.push({ id: mDoc.id, data: mDoc.data() }));
        supportThreadsList.push({ id: doc.id, data: doc.data(), messages });
    }
    return supportThreadsList;
}

async function buildBackupPayload(scope = 'full') {
    const projectId = (typeof firebaseConfig !== 'undefined' && firebaseConfig.projectId) ? firebaseConfig.projectId : 'swagstree-web';
    const createdAt = new Date().toISOString();

    if (scope === 'users') {
        return {
            _meta: {
                version: BACKUP_FORMAT_VERSION,
                createdAt,
                scope: 'users',
                app: 'swagstree',
                projectId,
                collections: ['users']
            },
            users: await fetchUsersBackupDocs()
        };
    }

    const backupData = {
        _meta: {
            version: BACKUP_FORMAT_VERSION,
            createdAt,
            scope: 'full',
            app: 'swagstree',
            projectId,
            collections: [...FIRESTORE_BACKUP_COLLECTIONS, 'support_threads', 'users']
        }
    };

    for (const col of FIRESTORE_BACKUP_COLLECTIONS) {
        backupData[col] = await fetchCollectionBackupDocs(col);
    }
    backupData.support_threads = await fetchSupportThreadsBackupDocs();
    backupData.users = await fetchUsersBackupDocs();
    return backupData;
}

function buildBackupFilename(scope, isAuto) {
    const dateStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    if (scope === 'users') {
        return `swagstree_users_backup_${isAuto ? 'auto_' : 'manual_'}${dateStr}.json`;
    }
    return `swagstree_backup_${isAuto ? 'auto_' : 'manual_'}${dateStr}.json`;
}

async function fetchAuthUsersExport() {
    const user = typeof auth !== 'undefined' ? auth.currentUser : null;
    if (!user) throw new Error('You must be logged in to export auth users.');
    const token = await user.getIdToken(true);
    const resp = await fetch('/api/auth/export', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
    });
    let data = {};
    try {
        data = await resp.json();
    } catch (_) {
        throw new Error('Auth export server returned an invalid response.');
    }
    if (!resp.ok || !data.ok) {
        throw new Error(data.error || `Auth export failed (${resp.status}).`);
    }
    return data;
}

async function deliverBackupJson(backupData, filename, isAuto, forceEmail) {
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const now = new Date();

    if (isAuto || forceEmail) {
        try {
            showToast('⏳ Uploading backup to secure storage...');
            const fd = new FormData();
            fd.append('file', blob, filename);
            fd.append('upload_preset', typeof PRESET !== 'undefined' ? PRESET : 'swagstree_upload');
            const cloudName = typeof CLOUD_NAME !== 'undefined' ? CLOUD_NAME : 'mysharecloud';
            const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: 'POST',
                body: fd
            });
            const d = await r.json();
            if (!r.ok) throw new Error(d.error ? d.error.message : 'Cloudinary upload failed');
            const downloadUrl = d.secure_url;
            await db.collection('mail').add({
                to: 'backup@swagstree.com',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                message: {
                    subject: `Swag Stree ${isAuto ? 'Auto' : 'Manual'} Backup: ${filename}`,
                    text: `Your ${isAuto ? 'automated' : 'manual'} database backup is ready.\n\nDownload Link: ${downloadUrl}\n\nCollections: ${(backupData._meta?.collections || []).join(', ')}\n\nGenerated at: ${now.toLocaleString()}`
                }
            });
            showToast('✅ Backup completed and emailed to backup@swagstree.com!');
        } catch (err) {
            console.error('Backup upload/email failed:', err);
            showToast('⚠️ Backup failed to email (CORS or Storage error)');
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

    const nowMs = Date.now();
    await db.collection('settings').doc('backup').set({ lastBackupTime: nowMs }, { merge: true });
    const statusEl = document.getElementById('admin-backup-status-text');
    if (statusEl) {
        statusEl.innerHTML = `Last Backup Time: <b>${new Date(nowMs).toLocaleString()}</b>`;
    }
}

function isValidBackupData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data._meta?.scope === 'users') return Array.isArray(data.users);
    return !!(data.products && data.orders && data.settings && data.users);
}

async function restoreUsersBackupDocs(users) {
    const batcher = new FirestoreBatcher();
    for (const user of users) {
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
    await batcher.commit();
}

async function restoreFullBackupDocs(data) {
    const batcher = new FirestoreBatcher();
    const cols = [...FIRESTORE_BACKUP_COLLECTIONS];
    for (const col of cols) {
        if (data[col] && Array.isArray(data[col])) {
            for (const doc of data[col]) {
                await batcher.set(db.collection(col).doc(doc.id), doc.data);
            }
        }
    }

    if (data.support_threads && Array.isArray(data.support_threads)) {
        for (const thread of data.support_threads) {
            await batcher.set(db.collection('support_threads').doc(thread.id), thread.data);
            if (thread.messages && Array.isArray(thread.messages)) {
                for (const msg of thread.messages) {
                    await batcher.set(
                        db.collection('support_threads').doc(thread.id).collection('messages').doc(msg.id),
                        msg.data
                    );
                }
            }
        }
    }

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
    showToast('⏳ Preparing database backup... Please wait.');
    try {
        await runBackup(false, false);
    } catch (err) {
        console.error('Manual backup failed:', err);
        showToast('Failed to generate backup');
    }
}

async function triggerManualBackupEmail() {
    showToast('⏳ Preparing database backup for email... Please wait.');
    try {
        await runBackup(false, true);
    } catch (err) {
        console.error('Manual email backup failed:', err);
        showToast('Failed to generate backup');
    }
}

async function triggerUsersBackup() {
    if (!isSuperAdmin) return showToast('Only superadmin can export users & auth.');

    showToast('⏳ Preparing users & auth backup...');
    try {
        const payload = await buildBackupPayload('users');
        try {
            const authExport = await fetchAuthUsersExport();
            payload.auth_users = authExport.users || [];
            payload._meta.authUsersCount = payload.auth_users.length;
            payload._meta.authExported = true;
            payload._meta.authExportedAt = authExport.exportedAt;
        } catch (authErr) {
            console.warn('Auth export unavailable:', authErr);
            payload._meta.authExported = false;
            payload._meta.authExportNote = authErr.message || 'Auth export requires FIREBASE_SERVICE_ACCOUNT on the server.';
        }

        await deliverBackupJson(payload, buildBackupFilename('users', false), false, false);
        const authNote = payload._meta.authExported
            ? ` (${payload.auth_users.length} Firebase Auth accounts included)`
            : ' (Firestore profiles only — configure auth export on server for login metadata)';
        showToast(`✅ Users backup download started${authNote}`);
    } catch (err) {
        console.error('Users backup failed:', err);
        showToast('Failed to create users backup.');
    }
}

async function runBackup(isAuto = false, forceEmail = false) {
    const backupData = await buildBackupPayload('full');
    await deliverBackupJson(backupData, buildBackupFilename('full', isAuto), isAuto, forceEmail);
}

async function restoreBackupFromFile(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (!isValidBackupData(data)) {
                showToast('⚠️ Invalid backup file format!');
                input.value = '';
                return;
            }

            const isUsersScope = data._meta?.scope === 'users';
            const confirmMsg = isUsersScope
                ? 'CRITICAL WARNING:\n\nThis will overwrite Firestore user profiles and saved addresses from the backup file.\nFirebase Auth login accounts are NOT changed by this restore.\n\nType "RESTORE USERS" to proceed:'
                : 'CRITICAL WARNING:\n\nRestoring this backup will insert or overwrite documents in all collections (products, orders, feedbacks, announcements, comments, users, settings, admins, support chats).\n\nDownload a backup of your current database first.\n\nType "RESTORE" to proceed:';

            const expectedPhrase = isUsersScope ? 'RESTORE USERS' : 'RESTORE';
            const promptVal = prompt(confirmMsg);
            if (promptVal !== expectedPhrase) {
                showToast('Restore operation cancelled.');
                input.value = '';
                return;
            }

            showToast('⏳ Restoring database in batches... Do not close the window.');

            if (isUsersScope) {
                await restoreUsersBackupDocs(data.users);
                showToast('✅ User profiles restored successfully! Reloading page...');
            } else {
                await restoreFullBackupDocs(data);
                showToast('✅ Database restored successfully! Reloading page...');
            }

            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (err) {
            console.error('Error restoring backup:', err);
            showToast('Failed to restore backup. Please ensure the file is valid JSON.');
        } finally {
            input.value = '';
        }
    };
    reader.readAsText(file);
}

window.loadBackupSettings = loadBackupSettings;
window.saveBackupSettings = saveBackupSettings;
window.triggerManualBackup = triggerManualBackup;
window.triggerManualBackupEmail = triggerManualBackupEmail;
window.triggerUsersBackup = triggerUsersBackup;
window.restoreBackupFromFile = restoreBackupFromFile;

// ── Global Announcement Administration ──────────────────────────────────────
let editingAnnouncementId = null;
window.announcementDraftImages = window.announcementDraftImages || [];

function isValidAnnouncementImageUrl(url) {
    const img = String(url || '').trim();
    return img && img !== 'null' && img !== 'undefined'
        && (img.startsWith('http://') || img.startsWith('https://'));
}

function getAnnouncementImagesFromData(data) {
    if (!data) return [];
    if (Array.isArray(data.images) && data.images.length) {
        return data.images.map(u => String(u || '').trim()).filter(isValidAnnouncementImageUrl);
    }
    const legacy = String(data.image || '').trim();
    return isValidAnnouncementImageUrl(legacy) ? [legacy] : [];
}

function renderAnnouncementImagesPreview() {
    const container = document.getElementById('admin-announcement-images-preview');
    if (!container) return;

    const images = window.announcementDraftImages || [];
    if (!images.length) {
        container.innerHTML = '<p class="announcement-admin-images-empty">No images added — announcement will be text only.</p>';
        return;
    }

    container.innerHTML = images.map((url, index) => `
        <div class="announcement-admin-image-card">
            <img src="${url}" alt="Announcement image ${index + 1}">
            <button type="button" class="announcement-admin-image-remove" onclick="removeAnnouncementImageAt(${index})" title="Remove image">
                <i class="fa fa-times"></i>
            </button>
        </div>
    `).join('');
}

function clearAnnouncementImages() {
    window.announcementDraftImages = [];
    const fileInput = document.getElementById('admin-announcement-file');
    if (fileInput) fileInput.value = '';
    renderAnnouncementImagesPreview();
}

function toggleAdminSectionAccordion(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (!content) return;

    if (content.style.display === 'none' || !content.style.display) {
        content.style.display = 'flex';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
    }
}

function openAdminSectionAccordion(contentId, iconId) {
    const content = document.getElementById(contentId);
    const icon = document.getElementById(iconId);
    if (!content) return;
    content.style.display = 'flex';
    if (icon) icon.style.transform = 'rotate(0deg)';
}

function ensureAdminStoreToolsOpen() {
    openAdminSectionAccordion('admin-store-tools-accordion-content', 'admin-store-tools-accordion-icon');
}
window.ensureAdminStoreToolsOpen = ensureAdminStoreToolsOpen;

window.toggleAdminStoreToolsAccordion = function() {
    toggleAdminSectionAccordion('admin-store-tools-accordion-content', 'admin-store-tools-accordion-icon');
};

window.openAdminStoreToolsAccordion = function() {
    openAdminSectionAccordion('admin-store-tools-accordion-content', 'admin-store-tools-accordion-icon');
};

window.toggleAdminPromoAccordion = function() {
    if (typeof adminEnsureParentStoreToolsOpen === 'function') adminEnsureParentStoreToolsOpen('admin-promo-settings');
    else if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    toggleAdminSectionAccordion('admin-promo-accordion-content', 'admin-promo-accordion-icon');
};

window.toggleAdminPaginationAccordion = function() {
    if (typeof adminEnsureParentStoreToolsOpen === 'function') adminEnsureParentStoreToolsOpen('admin-pagination-settings');
    else if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    toggleAdminSectionAccordion('admin-pagination-accordion-content', 'admin-pagination-accordion-icon');
};

window.toggleAdminFeedbackAccordion = function() {
    if (typeof adminEnsureParentStoreToolsOpen === 'function') adminEnsureParentStoreToolsOpen('admin-feedback-settings');
    else if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    toggleAdminSectionAccordion('admin-feedback-accordion-content', 'admin-feedback-accordion-icon');
};

window.openAdminFeedbackAccordion = function() {
    if (typeof adminEnsureParentStoreToolsOpen === 'function') adminEnsureParentStoreToolsOpen('admin-feedback-settings');
    else if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    openAdminSectionAccordion('admin-feedback-accordion-content', 'admin-feedback-accordion-icon');
};

function toggleAnnouncementAccordion() {
    if (typeof adminEnsureParentStoreToolsOpen === 'function') adminEnsureParentStoreToolsOpen('admin-announcement-settings');
    else if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
    const content = document.getElementById('announcement-accordion-content');
    const icon = document.getElementById('announcement-accordion-icon');
    if (!content) return;
    
    if (content.style.display === 'none') {
        content.style.display = 'flex';
        if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
        content.style.display = 'none';
        if (icon) icon.style.transform = 'rotate(-90deg)';
    }
}
window.toggleAnnouncementAccordion = toggleAnnouncementAccordion;

async function handleAnnouncementFileUpload(input) {
    if (!input.files || input.files.length === 0) return;

    const uploadLabel = document.querySelector('label[for="admin-announcement-file"]');
    const originalText = uploadLabel ? uploadLabel.innerHTML : '<i class="fa fa-cloud-upload-alt"></i> Add Images';
    const files = Array.from(input.files);

    if (uploadLabel) uploadLabel.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Uploading ${files.length}…`;

    try {
        for (const file of files) {
            const url = await uploadToCloudinary(file);
            window.announcementDraftImages.push(url);
        }
        renderAnnouncementImagesPreview();
        showToast(`${files.length} image${files.length === 1 ? '' : 's'} uploaded.`);
    } catch (e) {
        console.error(e);
        showToast('Upload failed: ' + e.message);
    } finally {
        if (uploadLabel) uploadLabel.innerHTML = originalText;
        input.value = '';
    }
}
window.handleAnnouncementFileUpload = handleAnnouncementFileUpload;

function removeAnnouncementImageAt(index) {
    if (!Array.isArray(window.announcementDraftImages)) return;
    window.announcementDraftImages.splice(index, 1);
    renderAnnouncementImagesPreview();
}
window.removeAnnouncementImageAt = removeAnnouncementImageAt;

function removeAnnouncementImage() {
    clearAnnouncementImages();
}
window.removeAnnouncementImage = removeAnnouncementImage;

async function publishAnnouncement() {
    const textEl = document.getElementById("admin-announcement-msg");
    if (!textEl) return;

    const msg = textEl.value.trim();
    const images = (window.announcementDraftImages || []).filter(isValidAnnouncementImageUrl);

    if (!msg) {
        showToast("Please enter an announcement message.");
        return;
    }

    const payload = {
        message: msg,
        images,
        image: firebase.firestore.FieldValue.delete(),
        lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editingAnnouncementId) {
            await db.collection("announcements").doc(editingAnnouncementId).update(payload);
            showToast("Announcement updated successfully!");
            cancelAnnouncementEdit();
        } else {
            const id = 'ann_' + Date.now();
            await db.collection("announcements").doc(id).set({
                id,
                message: msg,
                images,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast("Announcement published successfully!");
            textEl.value = "";
            clearAnnouncementImages();
        }
    } catch (e) {
        console.error("Error publishing/updating announcement:", e);
        showToast("Failed to publish: " + e.message);
    }
}
window.publishAnnouncement = publishAnnouncement;

async function deleteAnnouncementAdmin(id) {
    if (!confirm("Are you sure you want to delete this announcement?")) return;
    try {
        await db.collection("announcements").doc(id).delete();
        showToast("Announcement deleted successfully!");
        if (editingAnnouncementId === id) {
            cancelAnnouncementEdit();
        }
    } catch (e) {
        console.error("Error deleting announcement:", e);
        showToast("Failed to delete: " + e.message);
    }
}
window.deleteAnnouncementAdmin = deleteAnnouncementAdmin;

async function editAnnouncementAdmin(id) {
    try {
        const snap = await db.collection("announcements").doc(id).get();
        if (!snap.exists) {
            showToast("Announcement not found.");
            return;
        }
        const data = snap.data();
        const textEl = document.getElementById("admin-announcement-msg");
        const pubBtn = document.getElementById("admin-announcement-pub-btn");
        const cancelBtn = document.getElementById("admin-announcement-cancel-btn");
        
        if (textEl) textEl.value = data.message || "";
        window.announcementDraftImages = getAnnouncementImagesFromData(data);
        renderAnnouncementImagesPreview();

        editingAnnouncementId = id;
        if (pubBtn) pubBtn.textContent = "Update Announcement";
        if (cancelBtn) cancelBtn.style.display = "block";
        
        // Open the accordion if it is currently closed
        if (typeof adminEnsureParentStoreToolsOpen === 'function') adminEnsureParentStoreToolsOpen('admin-announcement-settings');
        else if (typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
        const content = document.getElementById('announcement-accordion-content');
        const icon = document.getElementById('announcement-accordion-icon');
        if (content && content.style.display === 'none') {
            content.style.display = 'flex';
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    } catch (e) {
        console.error("Error editing announcement:", e);
    }
}
window.editAnnouncementAdmin = editAnnouncementAdmin;

function cancelAnnouncementEdit() {
    editingAnnouncementId = null;
    const textEl = document.getElementById("admin-announcement-msg");
    const pubBtn = document.getElementById("admin-announcement-pub-btn");
    const cancelBtn = document.getElementById("admin-announcement-cancel-btn");
    
    if (textEl) textEl.value = "";
    clearAnnouncementImages();
    if (pubBtn) pubBtn.textContent = "Publish";
    if (cancelBtn) cancelBtn.style.display = "none";
}
window.cancelAnnouncementEdit = cancelAnnouncementEdit;

function loadAnnouncementSettingsAdmin() {
    renderAnnouncementImagesPreview();
    db.collection("announcements").orderBy("timestamp", "desc").onSnapshot(snap => {
        const list = [];
        snap.forEach(doc => {
            list.push({
                id: doc.id,
                ...doc.data()
            });
        });
        renderAdminAnnouncements(list);
    }, error => {
        console.error("Error loading announcements in admin:", error);
    });
}
window.loadAnnouncementSettingsAdmin = loadAnnouncementSettingsAdmin;

function renderAdminAnnouncements(list) {
    const container = document.getElementById('admin-announcements-list');
    if (!container) return;
    
    if (!list || list.length === 0) {
        container.innerHTML = `<p style="color:#666; font-size:11px; margin:0; text-align:center; padding: 20px 0;">No announcements published yet.</p>`;
        return;
    }
    
    container.innerHTML = list.map(ann => {
        const images = getAnnouncementImagesFromData(ann);
        const thumb = images[0]
            ? `<img src="${images[0]}" style="width:40px; height:40px; object-fit:cover; border-radius:4px; border:1px solid #222; flex-shrink:0;">`
            : `<div style="width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:#222; border-radius:4px; border:1px solid #333; flex-shrink:0;"><i class="fa fa-bullhorn" style="color:#ffd700; font-size:12px;"></i></div>`;
        const imageCount = images.length > 1
            ? `<span style="font-size:9px; color:var(--gold); font-weight:700;">+${images.length - 1} img</span>`
            : '';

        return `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px; background:#111; border:1px solid #333; border-radius:8px;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:0;">
                ${thumb}
                <div style="min-width:0; flex:1;">
                    <p style="margin:0; font-size:11px; color:#fff; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; word-break:break-word;">${ann.message}</p>
                    <div style="display:flex; align-items:center; gap:6px; margin-top:2px;">
                        <span style="font-size:9px; color:#666;">${ann.timestamp ? new Date(ann.timestamp.seconds * 1000).toLocaleString() : 'Just now'}</span>
                        ${imageCount}
                    </div>
                </div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button onclick="editAnnouncementAdmin('${ann.id}')" style="background:#ffd700; border:none; color:#000; font-size:10px; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:700;"><i class="fa fa-edit"></i></button>
                <button onclick="deleteAnnouncementAdmin('${ann.id}')" style="background:#ff4757; border:none; color:#fff; font-size:10px; padding:4px 8px; border-radius:4px; cursor:pointer; font-weight:700;"><i class="fa fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}







