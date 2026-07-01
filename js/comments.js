// ==========================================
// SWAG STREE | PRODUCT COMMENTS SYSTEM
// ==========================================

window.ADMIN_CAPABILITY_DEFS = window.ADMIN_CAPABILITY_DEFS || {
    approveComments: {
        id: 'approveComments',
        label: 'Approve Product Comments',
        icon: 'fa-comments',
        description: 'Review, approve, or reject customer comments on product pages'
    }
};

window.productCommentsCache = window.productCommentsCache || [];
window.commentsModerationCache = window.commentsModerationCache || [];
window.selectedCommentRating = 0;
window.editingCommentId = null;
window.currentAdminCapabilities = window.currentAdminCapabilities || {};
const COMMENT_TEXT_MIN = 3;
const COMMENT_TEXT_MAX = 1000;
let productCommentsUnsubscribe = null;
let commentsModerationUnsubscribe = null;

window.COMMENTS_SETTINGS = window.COMMENTS_SETTINGS || { enabled: true };
let commentsSettingsUnsubscribe = null;
let lastCommentsEnabledState = null;

function isProductCommentsEnabled() {
    if (window.COMMENTS_SETTINGS && window.COMMENTS_SETTINGS.enabled === false) return false;
    if (window.APP_FEATURES && window.APP_FEATURES.productComments === false) return false;
    return true;
}

function renderCommentsEnabledControls() {
    const enabled = isProductCommentsEnabled();
    const statusEl = document.getElementById('admin-comments-enabled-status');
    const badgeEl = document.getElementById('admin-comments-enabled-badge');
    const enableBtn = document.getElementById('admin-comments-enable-btn');
    const disableBtn = document.getElementById('admin-comments-disable-btn');
    const saving = !!window._commentsSettingsSaving;

    if (badgeEl) {
        badgeEl.textContent = enabled ? 'ENABLED' : 'DISABLED';
        badgeEl.style.color = enabled ? '#2ecc71' : 'var(--red)';
        badgeEl.style.background = enabled ? 'rgba(46, 204, 113, 0.12)' : 'rgba(255, 71, 87, 0.12)';
        badgeEl.style.borderColor = enabled ? 'rgba(46, 204, 113, 0.35)' : 'rgba(255, 71, 87, 0.35)';
    }
    if (statusEl) {
        statusEl.textContent = enabled
            ? 'Customers can view and submit reviews on product pages.'
            : 'Reviews are hidden on all product pages. Existing reviews are kept in admin.';
        statusEl.style.color = enabled ? '#aaa' : '#888';
    }
    if (enableBtn) {
        enableBtn.disabled = saving || enabled;
        enableBtn.style.opacity = (saving || enabled) ? '0.4' : '1';
        enableBtn.style.cursor = (saving || enabled) ? 'not-allowed' : 'pointer';
    }
    if (disableBtn) {
        disableBtn.disabled = saving || !enabled;
        disableBtn.style.opacity = (saving || !enabled) ? '0.4' : '1';
        disableBtn.style.cursor = (saving || !enabled) ? 'not-allowed' : 'pointer';
    }
}

function refreshCommentsEnabledUI(forceReload) {
    const enabled = isProductCommentsEnabled();
    const changed = lastCommentsEnabledState !== enabled;
    lastCommentsEnabledState = enabled;

    renderCommentsEnabledControls();

    if (!forceReload && !changed) return;

    if (typeof activeProductId !== 'undefined' && activeProductId) {
        if (enabled && typeof loadProductComments === 'function') {
            loadProductComments(activeProductId);
        } else if (typeof stopProductCommentsListener === 'function') {
            stopProductCommentsListener();
            const section = document.getElementById('det-comments-section');
            if (section) section.style.display = 'none';
        }
    }
}
window.refreshCommentsEnabledUI = refreshCommentsEnabledUI;

function hasAdminCapability(capId) {
    if (typeof isSuperAdmin !== 'undefined' && isSuperAdmin) return true;
    if (!currentUser || !currentUser.email) return false;
    const emailLower = currentUser.email.toLowerCase();
    if (emailLower === SUPER_ADMIN_EMAIL.toLowerCase()) return true;
    const isAdminDeactivated = (typeof assignedAdmins !== 'undefined' && Array.isArray(assignedAdmins))
        && assignedAdmins.some(a => a.email === ADMIN_EMAIL.toLowerCase() && a.status === 'deactivated');
    if (emailLower === ADMIN_EMAIL.toLowerCase() && !isAdminDeactivated) return true;
    return !!(window.currentAdminCapabilities && window.currentAdminCapabilities[capId]);
}
window.hasAdminCapability = hasAdminCapability;

function resolveAllCapabilities(capabilitiesObj) {
    const all = {};
    Object.keys(window.ADMIN_CAPABILITY_DEFS).forEach(key => {
        all[key] = !!(capabilitiesObj && capabilitiesObj[key]);
    });
    return all;
}

function resolveFullCapabilitiesForEmail(email, adminDocData) {
    const emailLower = (email || '').toLowerCase();
    if (emailLower === SUPER_ADMIN_EMAIL.toLowerCase()) {
        const all = {};
        Object.keys(window.ADMIN_CAPABILITY_DEFS).forEach(k => { all[k] = true; });
        return all;
    }
    if (emailLower === ADMIN_EMAIL.toLowerCase()) {
        const isDeactivated = adminDocData && adminDocData.status === 'deactivated';
        if (!isDeactivated) {
            const all = {};
            Object.keys(window.ADMIN_CAPABILITY_DEFS).forEach(k => { all[k] = true; });
            return all;
        }
    }
    return resolveAllCapabilities(adminDocData && adminDocData.capabilities);
}
window.resolveFullCapabilitiesForEmail = resolveFullCapabilitiesForEmail;

function syncCurrentAdminCapabilities() {
    if (!currentUser || !currentUser.email) {
        window.currentAdminCapabilities = {};
        return;
    }
    const emailLower = currentUser.email.toLowerCase();
    const adminDoc = (typeof assignedAdmins !== 'undefined' ? assignedAdmins : []).find(a => a.email === emailLower);
    const docData = adminDoc ? { status: adminDoc.status, capabilities: adminDoc.capabilities } : null;
    window.currentAdminCapabilities = resolveFullCapabilitiesForEmail(emailLower, docData);
    updateCommentsAdminUIVisibility();
}
window.syncCurrentAdminCapabilities = syncCurrentAdminCapabilities;

function updateCommentsAdminUIVisibility() {
    const section = document.getElementById('admin-comments-moderation');
    if (section) {
        section.style.display = (typeof isAdmin !== 'undefined' && isAdmin) ? 'block' : 'none';
    }
    const moderationBody = document.getElementById('admin-comments-moderation-body');
    if (moderationBody) {
        moderationBody.style.display = hasAdminCapability('approveComments') ? 'flex' : 'none';
    }
    if (!hasAdminCapability('approveComments') && typeof stopCommentsModerationListener === 'function') {
        stopCommentsModerationListener();
    }
}
window.updateCommentsAdminUIVisibility = updateCommentsAdminUIVisibility;

window.initCommentsSettingsListener = function() {
    if (commentsSettingsUnsubscribe) return;
    commentsSettingsUnsubscribe = db.collection('settings').doc('comments').onSnapshot(doc => {
        window.COMMENTS_SETTINGS = doc.exists ? doc.data() : { enabled: true };
        refreshCommentsEnabledUI(true);
    }, err => console.error('Comments settings listener error:', err));
};

window.loadCommentsSettings = async function() {
    if (!isAdmin) return;
    initCommentsSettingsListener();
    try {
        const snap = await db.collection('settings').doc('comments').get();
        window.COMMENTS_SETTINGS = snap.exists ? snap.data() : { enabled: true };
        refreshCommentsEnabledUI(true);
    } catch (e) {
        console.error('loadCommentsSettings error:', e);
        renderCommentsEnabledControls();
    }
};

window.setCommentsEnabled = async function(enabled) {
    if (!isAdmin) return showToast('Only admins can change review settings.');
    if (window._commentsSettingsSaving) return;
    if (isProductCommentsEnabled() === enabled) {
        renderCommentsEnabledControls();
        return;
    }

    window._commentsSettingsSaving = true;
    renderCommentsEnabledControls();

    try {
        await db.collection('settings').doc('comments').set({ enabled }, { merge: true });
        await db.collection('settings').doc('features_config').set({ productComments: enabled }, { merge: true });
        window.COMMENTS_SETTINGS = { ...(window.COMMENTS_SETTINGS || {}), enabled };
        if (window.APP_FEATURES) window.APP_FEATURES.productComments = enabled;

        const superToggle = document.getElementById('toggle-product-comments');
        if (superToggle) superToggle.checked = enabled;

        lastCommentsEnabledState = null;
        refreshCommentsEnabledUI(true);
        showToast(enabled ? '✅ Customer reviews enabled.' : 'Reviews disabled on all products.');
    } catch (e) {
        console.error('setCommentsEnabled error:', e);
        showToast('Failed to update review settings.');
        renderCommentsEnabledControls();
    } finally {
        window._commentsSettingsSaving = false;
        renderCommentsEnabledControls();
    }
};

window.enableCustomerReviews = function() {
    setCommentsEnabled(true);
};

window.disableCustomerReviews = function() {
    if (!confirm('Disable customer reviews on all product pages?')) return;
    setCommentsEnabled(false);
};

window.toggleAdminCapabilitiesAccordion = function(email) {
    const capAccordionId = `admin-caps-${email.replace(/[^a-z0-9]/g, '-')}`;
    const el = document.getElementById(capAccordionId);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'flex' : 'none';
};

window.saveAdminCapabilities = async function(email) {
    if (!isSuperAdmin) return showToast('Only superadmin can assign capabilities.');
    const capAccordionId = `admin-caps-${email.replace(/[^a-z0-9]/g, '-')}`;
    const capabilities = {};
    Object.keys(window.ADMIN_CAPABILITY_DEFS).forEach(capKey => {
        const checkbox = document.getElementById(`cap-${capKey}-${capAccordionId}`);
        capabilities[capKey] = !!(checkbox && checkbox.checked);
    });
    try {
        await db.collection('admins').doc(email.toLowerCase()).set({ capabilities }, { merge: true });
        showToast('✅ Admin capabilities updated.');
    } catch (e) {
        console.error('saveAdminCapabilities error:', e);
        showToast('Failed to save capabilities.');
    }
};

function formatCommentDate(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderStarRatingHtml(rating, interactive, sizeClass) {
    const size = sizeClass || '14px';
    let html = '<span class="comment-stars" style="display:inline-flex; gap:2px;">';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= rating;
        const color = filled ? 'var(--gold)' : '#444';
        if (interactive) {
            html += `<i class="fa fa-star comment-star-input" data-rating="${i}" onclick="setCommentRating(${i})" style="font-size:${size}; color:${color}; cursor:pointer;"></i>`;
        } else {
            html += `<i class="fa fa-star" style="font-size:${size}; color:${color};"></i>`;
        }
    }
    html += '</span>';
    return html;
}
window.renderStarRatingHtml = renderStarRatingHtml;

window.setCommentRating = function(rating) {
    window.selectedCommentRating = rating;
    const container = document.getElementById('det-comment-rating-input');
    if (container) container.innerHTML = renderStarRatingHtml(rating, true, '18px');
};

function isReviewOwner(c) {
    return !!(currentUser && c && c.uid === currentUser.uid);
}

function getUserReviewsForProduct(productId) {
    if (!currentUser || !productId) return [];
    return window.productCommentsCache.filter(c => c.uid === currentUser.uid && c.productId === productId);
}

function getUserReviewForProduct(productId) {
    const reviews = getUserReviewsForProduct(productId);
    if (!reviews.length) return null;
    return reviews.slice().sort((a, b) => {
        const ta = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const tb = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return tb - ta;
    })[0];
}

function validateReviewInput(text, rating) {
    if (rating < 1 || rating > 5) return 'Please select a star rating (1–5)';
    if (text.length > COMMENT_TEXT_MAX) return `Review is too long (max ${COMMENT_TEXT_MAX} characters)`;
    if (text.length > 0 && text.length < COMMENT_TEXT_MIN) {
        return `Review text must be at least ${COMMENT_TEXT_MIN} characters, or leave it blank`;
    }
    return null;
}

function resetCommentFormState() {
    window.selectedCommentRating = 0;
    window.editingCommentId = null;
}

function renderOwnerEditButton(safeId) {
    return `
        <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#222; border:1px solid #444; color:#fff;" onclick="startEditProductComment('${safeId}')"><i class="fa fa-edit"></i> Edit Review</button>
        </div>`;
}

function renderCommentFormHtml(editingComment) {
    const isEditing = !!editingComment;
    const rating = isEditing ? (editingComment.rating || 0) : (window.selectedCommentRating || 0);
    const heading = isEditing ? 'EDIT YOUR REVIEW' : 'YOUR RATING';
    const submitLabel = isEditing ? 'Save Changes' : 'Submit Review';
    const hint = isEditing
        ? 'Updated reviews are sent for admin approval again before they appear publicly.'
        : 'Rating is required. Written review is optional. All reviews need admin approval.';

    return `
        <div id="det-comment-form" style="background:#111; border:1px solid #222; border-radius:12px; padding:14px;">
            <p style="font-size:11px; color:#666; margin:0 0 8px 0;">${heading}</p>
            <div id="det-comment-rating-input" style="margin-bottom:12px;">${renderStarRatingHtml(rating, true, '18px')}</div>
            <textarea id="det-comment-text" placeholder="Share your experience (optional — min ${COMMENT_TEXT_MIN} characters if you write something)..."
                maxlength="${COMMENT_TEXT_MAX}" style="margin:0 0 10px 0; font-size:13px; height:80px; resize:vertical;"></textarea>
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <span style="font-size:10px; color:#555;">${hint}</span>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${isEditing ? `<button type="button" class="btn-gold" style="width:auto; padding:10px 16px; font-size:12px; margin:0; background:#333; color:#ccc;" onclick="cancelEditProductComment()">Cancel</button>` : ''}
                    <button class="btn-gold" style="width:auto; padding:10px 20px; font-size:12px; margin:0;" onclick="submitProductComment()">${submitLabel}</button>
                </div>
            </div>
        </div>`;
}

window.startEditProductComment = function(commentId) {
    const c = window.productCommentsCache.find(x => x.id === commentId);
    if (!c || !isReviewOwner(c)) return showToast('You can only edit your own review.');
    window.editingCommentId = commentId;
    window.selectedCommentRating = c.rating || 0;
    renderProductCommentsSection();
    requestAnimationFrame(() => {
        const textEl = document.getElementById('det-comment-text');
        if (textEl) textEl.value = c.text || '';
        const ratingEl = document.getElementById('det-comment-rating-input');
        if (ratingEl) ratingEl.innerHTML = renderStarRatingHtml(c.rating || 0, true, '18px');
        textEl?.focus();
        document.getElementById('det-comment-form')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
};

window.cancelEditProductComment = function() {
    resetCommentFormState();
    renderProductCommentsSection();
};

function stopProductCommentsListener() {
    if (productCommentsUnsubscribe) {
        productCommentsUnsubscribe();
        productCommentsUnsubscribe = null;
    }
    window.productCommentsCache = [];
}
window.stopProductCommentsListener = stopProductCommentsListener;

function stopCommentsModerationListener() {
    if (commentsModerationUnsubscribe) {
        commentsModerationUnsubscribe();
        commentsModerationUnsubscribe = null;
    }
    window.commentsModerationCache = [];
}
window.stopCommentsModerationListener = stopCommentsModerationListener;

window.cleanupCommentsListeners = function() {
    stopProductCommentsListener();
    stopCommentsModerationListener();
    window.currentAdminCapabilities = {};
    lastCommentsEnabledState = null;
    resetCommentFormState();
    window._commentsLoadedProductId = null;
};

function renderProductCommentsSection() {
    const section = document.getElementById('det-comments-section');
    if (!section) return;

    if (!isProductCommentsEnabled()) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';

    const productId = typeof activeProductId !== 'undefined' ? activeProductId : null;
    if (!productId) return;

    const approved = window.productCommentsCache.filter(c => c.status === 'approved');
    const myPending = currentUser
        ? window.productCommentsCache.filter(c => c.uid === currentUser.uid && c.status === 'pending' && c.productId === productId)
        : [];
    const myRejected = currentUser
        ? window.productCommentsCache.filter(c => c.uid === currentUser.uid && c.status === 'rejected' && c.productId === productId)
        : [];
    const myHidden = currentUser
        ? window.productCommentsCache.filter(c => c.uid === currentUser.uid && c.status === 'hidden' && c.productId === productId)
        : [];

    const ratedApproved = approved.filter(c => c.rating);
    const avgRating = ratedApproved.length
        ? ratedApproved.reduce((s, c) => s + (c.rating || 0), 0) / ratedApproved.length
        : 0;
    const avgDisplay = ratedApproved.length ? avgRating.toFixed(1) : null;

    let summaryHtml = '';
    if (approved.length > 0) {
        summaryHtml = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                ${avgDisplay ? renderStarRatingHtml(Math.round(avgRating), false, '13px') : ''}
                <span style="font-size:12px; color:#888;">
                    ${avgDisplay ? `<strong style="color:var(--gold);">${avgDisplay}</strong> · ` : ''}${approved.length} review${approved.length !== 1 ? 's' : ''}
                </span>
            </div>`;
    }

    const listHtml = approved.length === 0
        ? `<p style="color:#555; font-size:12px; margin:0 0 15px 0;">No reviews yet. Be the first to share your experience!</p>`
        : approved.map(c => commentCardHtml(c, false)).join('');

    const pendingNotice = myPending.length
        ? `<div style="background:rgba(255,215,0,0.08); border:1px solid rgba(255,215,0,0.25); border-radius:10px; padding:10px 12px; margin-bottom:12px;">
            <p style="margin:0 0 8px 0; font-size:11px; color:var(--gold); font-weight:700;"><i class="fa fa-clock"></i> Your review${myPending.length > 1 ? 's' : ''} awaiting approval</p>
            ${myPending.map(c => commentCardHtml(c, false, true)).join('')}
           </div>`
        : '';

    const rejectedNotice = myRejected.length
        ? `<div style="background:rgba(255,71,87,0.06); border:1px solid rgba(255,71,87,0.2); border-radius:10px; padding:10px 12px; margin-bottom:12px;">
            <p style="margin:0 0 8px 0; font-size:11px; color:var(--red); font-weight:700;"><i class="fa fa-times-circle"></i> Review not published</p>
            ${myRejected.map(c => commentCardHtml(c, false, false, true)).join('')}
           </div>`
        : '';

    const hiddenNotice = myHidden.length
        ? `<div style="background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.12); border-radius:10px; padding:10px 12px; margin-bottom:12px;">
            <p style="margin:0 0 8px 0; font-size:11px; color:#888; font-weight:700;"><i class="fa fa-eye-slash"></i> Your review was hidden by admin</p>
            ${myHidden.map(c => commentCardHtml(c, false, false, false, true)).join('')}
           </div>`
        : '';

    const myReviewsForProduct = getUserReviewsForProduct(productId);
    const isEditing = !!(window.editingCommentId && myReviewsForProduct.some(c => c.id === window.editingCommentId));
    const editingComment = isEditing
        ? myReviewsForProduct.find(c => c.id === window.editingCommentId)
        : null;
    const hasReviewForProduct = myReviewsForProduct.length > 0;
    const hasPendingForProduct = myPending.length > 0;

    let formHtml = '';
    if (!currentUser) {
        formHtml = `<p style="font-size:12px; color:#666; margin:0;"><i class="fa fa-lock"></i> <a href="#" onclick="event.preventDefault(); navigateTo('user')" style="color:var(--gold);">Sign in</a> to leave a review</p>`;
    } else if (isEditing && editingComment) {
        formHtml = renderCommentFormHtml(editingComment);
    } else if (hasPendingForProduct) {
        formHtml = `<p style="font-size:12px; color:#888; margin:0;"><i class="fa fa-hourglass-half"></i> Your review is awaiting admin approval. Use <strong>Edit Review</strong> above to change your rating or comment — updates will need approval again.</p>`;
    } else if (hasReviewForProduct) {
        formHtml = `<p style="font-size:12px; color:#888; margin:0;"><i class="fa fa-edit"></i> You already reviewed this product. Use <strong>Edit Review</strong> on your review above to update your rating or comment.</p>`;
    } else {
        formHtml = renderCommentFormHtml(null);
    }

    section.innerHTML = `
        <div style="border-top:1px solid #222; padding-top:20px; margin-top:10px;">
            <p style="font-size:11px; color:#666; margin:0 0 12px 0; letter-spacing:1px;">CUSTOMER REVIEWS</p>
            ${summaryHtml}
            <div id="det-comments-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
                ${listHtml}
            </div>
            ${pendingNotice}
            ${rejectedNotice}
            ${hiddenNotice}
            ${formHtml}
        </div>`;

    if (isEditing && editingComment) {
        requestAnimationFrame(() => {
            const textEl = document.getElementById('det-comment-text');
            if (textEl) textEl.value = editingComment.text || '';
            window.selectedCommentRating = editingComment.rating || 0;
            const ratingEl = document.getElementById('det-comment-rating-input');
            if (ratingEl) ratingEl.innerHTML = renderStarRatingHtml(editingComment.rating || 0, true, '18px');
        });
    }
}

function commentCardHtml(c, isAdmin, isPending, isRejected, isHidden) {
    const safeId = String(c.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const initials = (c.userName || c.userEmail || 'U').charAt(0).toUpperCase();
    const statusBadge = isPending
        ? `<span style="font-size:9px; color:var(--gold); background:rgba(255,215,0,0.1); padding:2px 6px; border-radius:4px; margin-left:6px;">PENDING</span>`
        : isRejected
            ? `<span style="font-size:9px; color:var(--red); background:rgba(255,71,87,0.1); padding:2px 6px; border-radius:4px; margin-left:6px;">NOT PUBLISHED</span>`
            : isHidden
                ? `<span style="font-size:9px; color:#888; background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; margin-left:6px;">HIDDEN</span>`
                : (isAdmin && c.status === 'hidden')
                    ? `<span style="font-size:9px; color:#888; background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; margin-left:6px;">HIDDEN</span>`
                    : '';
    const ratingHtml = c.rating ? renderStarRatingHtml(c.rating, false, '11px') : '';
    const productLine = isAdmin && c.productName
        ? `<p style="margin:0 0 4px 0; font-size:11px; color:var(--gold);"><i class="fa fa-box"></i> ${escapeHtml(c.productName)}</p>`
        : '';
    const adminMeta = isAdmin
        ? `<p style="margin:4px 0 0 0; font-size:10px; color:#555;">${escapeHtml(c.userEmail || '')} · ${formatCommentDate(c.createdAt)}</p>`
        : `<span style="font-size:10px; color:#555;">${formatCommentDate(c.createdAt)}</span>`;

    let actionsHtml = '';
    if (isAdmin && hasAdminCapability('approveComments')) {
        if (c.status === 'pending') {
            actionsHtml = `
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#2ecc71; border-color:#27ae60;" onclick="approveProductComment('${safeId}')"><i class="fa fa-check"></i> Approve</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#e74c3c; border-color:#c0392b;" onclick="rejectProductComment('${safeId}')"><i class="fa fa-times"></i> Reject</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#555;" onclick="hideProductComment('${safeId}')"><i class="fa fa-eye-slash"></i> Hide</button>
                </div>`;
        } else if (c.status === 'approved') {
            actionsHtml = `
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#555; border-color:#666;" onclick="hideProductComment('${safeId}')"><i class="fa fa-eye-slash"></i> Hide</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#e74c3c; border-color:#c0392b;" onclick="deleteProductComment('${safeId}')"><i class="fa fa-trash"></i> Delete</button>
                </div>`;
        } else if (c.status === 'hidden') {
            actionsHtml = `
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#2ecc71;" onclick="approveProductComment('${safeId}')"><i class="fa fa-check"></i> Show / Approve</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#e74c3c;" onclick="deleteProductComment('${safeId}')"><i class="fa fa-trash"></i> Delete</button>
                </div>`;
        } else {
            actionsHtml = `
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#2ecc71;" onclick="approveProductComment('${safeId}')"><i class="fa fa-check"></i> Approve</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#555;" onclick="hideProductComment('${safeId}')"><i class="fa fa-eye-slash"></i> Hide</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#e74c3c;" onclick="deleteProductComment('${safeId}')"><i class="fa fa-trash"></i> Delete</button>
                </div>`;
        }
    } else if (isReviewOwner(c)) {
        actionsHtml = renderOwnerEditButton(safeId);
    }

    const textHtml = (c.text && String(c.text).trim())
        ? `<p style="margin:0; font-size:13px; color:#aaa; line-height:1.5; word-break:break-word;">${escapeHtml(c.text)}</p>`
        : `<p style="margin:0; font-size:12px; color:#666; font-style:italic;">Rating only — no written review</p>`;
    const editedMeta = c.updatedAt
        ? `<span style="font-size:10px; color:#666; margin-left:6px;">· edited ${formatCommentDate(c.updatedAt)}</span>`
        : '';

    return `
        <div style="background:#111; border:1px solid #222; border-radius:10px; padding:12px 14px;">
            ${productLine}
            <div style="display:flex; align-items:flex-start; gap:10px;">
                <div style="width:32px; height:32px; border-radius:50%; background:#222; border:1px solid #333; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:700; color:var(--gold); flex-shrink:0;">${initials}</div>
                <div style="flex:1; min-width:0;">
                    <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px; margin-bottom:4px;">
                        <span style="font-size:13px; font-weight:600; color:#eee;">${escapeHtml(c.userName || 'Customer')}</span>
                        ${statusBadge}
                        ${!isAdmin ? `${adminMeta}${editedMeta}` : ''}
                    </div>
                    ${ratingHtml ? `<div style="margin-bottom:6px;">${ratingHtml}</div>` : ''}
                    ${textHtml}
                    ${isAdmin ? adminMeta : ''}
                    ${actionsHtml}
                </div>
            </div>
        </div>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

window.loadProductComments = function(productId) {
    if (window._commentsLoadedProductId !== productId) {
        resetCommentFormState();
    }
    window._commentsLoadedProductId = productId;

    if (productCommentsUnsubscribe) {
        productCommentsUnsubscribe();
        productCommentsUnsubscribe = null;
    }
    window.productCommentsCache = [];

    if (!productId || !isProductCommentsEnabled()) {
        renderProductCommentsSection();
        return;
    }

    productCommentsUnsubscribe = db.collection('product_comments')
        .where('productId', '==', productId)
        .onSnapshot(snap => {
            window.productCommentsCache = [];
            snap.forEach(doc => {
                window.productCommentsCache.push({ id: doc.id, ...doc.data() });
            });
            window.productCommentsCache.sort((a, b) => {
                const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
                const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
                return tb - ta;
            });
            renderProductCommentsSection();
        }, err => {
            console.error('Product comments listener error:', err);
            renderProductCommentsSection();
        });
};

window.submitProductComment = async function() {
    if (!currentUser) return showToast('Please sign in to leave a review');
    if (!isProductCommentsEnabled()) return showToast('Reviews are currently disabled');
    if (!activeProductId) return;

    const textEl = document.getElementById('det-comment-text');
    const text = textEl ? textEl.value.trim() : '';
    const rating = window.selectedCommentRating || 0;
    const validationError = validateReviewInput(text, rating);
    if (validationError) return showToast(validationError);

    const editingId = window.editingCommentId;
    const existingReview = editingId
        ? window.productCommentsCache.find(c => c.id === editingId)
        : getUserReviewForProduct(activeProductId);

    if (editingId) {
        if (!existingReview || !isReviewOwner(existingReview)) {
            return showToast('You can only edit your own review.');
        }
        if (existingReview.productId !== activeProductId) {
            return showToast('This review belongs to another product.');
        }
    } else if (existingReview) {
        return showToast('You already reviewed this product. Tap Edit Review to update it.');
    }

    const p = (typeof products !== 'undefined' ? products : []).find(x => x.id === activeProductId);
    const userName = document.getElementById('prof-name')?.value?.trim()
        || currentUser.displayName
        || (currentUser.email ? currentUser.email.split('@')[0] : 'Customer');

    try {
        if (editingId && existingReview) {
            await db.collection('product_comments').doc(editingId).update({
                rating,
                text,
                status: 'pending',
                reviewedAt: null,
                reviewedBy: null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            resetCommentFormState();
            if (textEl) textEl.value = '';
            showToast('✅ Review updated! It will appear again after admin approval.');
        } else {
            await db.collection('product_comments').add({
                productId: activeProductId,
                productName: p ? p.name : 'Unknown Product',
                uid: currentUser.uid,
                userName,
                userEmail: currentUser.email || '',
                rating,
                text,
                status: 'pending',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: null,
                reviewedAt: null,
                reviewedBy: null
            });
            resetCommentFormState();
            if (textEl) textEl.value = '';
            showToast('✅ Review submitted! It will appear after admin approval.');
        }
        renderProductCommentsSection();
    } catch (e) {
        console.error('submitProductComment error:', e);
        showToast('Failed to submit review. Please try again.');
    }
};

// ── Admin Moderation ────────────────────────────────────────────────────────

window.commentsModerationFilter = 'pending';

window.toggleCommentsModerationAccordion = function() {
    const content = document.getElementById('admin-comments-accordion-content');
    const icon = document.getElementById('admin-comments-accordion-icon');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'flex' : 'none';
    if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (isHidden && typeof loadCommentsModeration === 'function') loadCommentsModeration();
    if (isHidden && typeof loadCommentsSettings === 'function') loadCommentsSettings();
};

window.setCommentsModerationFilter = function(filter) {
    window.commentsModerationFilter = filter;
    ['pending', 'approved', 'rejected', 'hidden'].forEach(f => {
        const btn = document.getElementById(`admin-comments-filter-${f}`);
        if (btn) {
            btn.style.background = f === filter ? 'var(--gold)' : '#222';
            btn.style.color = f === filter ? '#000' : '#fff';
            btn.style.borderColor = f === filter ? 'var(--gold)' : '#444';
        }
    });
    renderCommentsModerationList();
};

function renderCommentsModerationList() {
    const container = document.getElementById('admin-comments-moderation-list');
    const badge = document.getElementById('admin-comments-pending-badge');
    if (!container) return;

    const filter = window.commentsModerationFilter || 'pending';
    const filtered = window.commentsModerationCache.filter(c => c.status === filter);
    const pendingCount = window.commentsModerationCache.filter(c => c.status === 'pending').length;

    if (badge) {
        badge.textContent = pendingCount;
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }

    if (filtered.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#555; font-size:12px; padding:20px 0;">No ${filter} reviews.</p>`;
        return;
    }

    container.innerHTML = filtered.map(c => commentCardHtml(c, true)).join('');
}

window.loadCommentsModeration = function() {
    if (!hasAdminCapability('approveComments')) return;
    if (commentsModerationUnsubscribe) return;

    const handleModerationSnapshot = (snap) => {
        window.commentsModerationCache = [];
        snap.forEach(doc => {
            window.commentsModerationCache.push({ id: doc.id, ...doc.data() });
        });
        window.commentsModerationCache.sort((a, b) => {
            const ta = a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0;
            return tb - ta;
        });
        renderCommentsModerationList();
    };

    const handleModerationError = (err) => {
        console.error('Comments moderation listener error:', err);
        if (commentsModerationUnsubscribe) {
            commentsModerationUnsubscribe();
            commentsModerationUnsubscribe = null;
        }
        commentsModerationUnsubscribe = db.collection('product_comments')
            .limit(200)
            .onSnapshot(handleModerationSnapshot, () => {
                const container = document.getElementById('admin-comments-moderation-list');
                if (container) {
                    container.innerHTML = `<p style="text-align:center; color:#ff4444; font-size:12px;">Unable to load reviews right now.</p>`;
                }
            });
    };

    commentsModerationUnsubscribe = db.collection('product_comments')
        .orderBy('createdAt', 'desc')
        .limit(200)
        .onSnapshot(handleModerationSnapshot, handleModerationError);
};

async function updateCommentStatus(commentId, status) {
    if (!hasAdminCapability('approveComments')) return showToast('You do not have permission to moderate reviews.');
    try {
        await db.collection('product_comments').doc(commentId).update({
            status,
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: currentUser ? (currentUser.email || '') : ''
        });
        showToast(status === 'approved' ? '✅ Review approved.' : status === 'hidden' ? 'Review hidden from product page.' : 'Review rejected.');
    } catch (e) {
        console.error('updateCommentStatus error:', e);
        showToast('Failed to update review.');
    }
}

window.approveProductComment = function(commentId) {
    updateCommentStatus(commentId, 'approved');
};

window.rejectProductComment = function(commentId) {
    updateCommentStatus(commentId, 'rejected');
};

window.hideProductComment = function(commentId) {
    updateCommentStatus(commentId, 'hidden');
};

window.deleteProductComment = async function(commentId) {
    if (!hasAdminCapability('approveComments')) return showToast('You do not have permission to delete reviews.');
    if (!confirm('Permanently delete this review?')) return;
    try {
        await db.collection('product_comments').doc(commentId).delete();
        showToast('🗑️ Review deleted.');
    } catch (e) {
        console.error('deleteProductComment error:', e);
        showToast('Failed to delete review.');
    }
};

if (typeof db !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof initCommentsSettingsListener === 'function') initCommentsSettingsListener();
    });
}
