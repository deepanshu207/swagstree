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

function getCommentSortTime(c) {
    if (!c) return 0;
    return c.updatedAt?.toMillis?.()
        || c.reviewedAt?.toMillis?.()
        || c.createdAt?.toMillis?.()
        || 0;
}

function getUserPendingReview(productId) {
    const pending = getUserReviewsForProduct(productId).filter(c => c.status === 'pending');
    if (!pending.length) return null;
    return pending.slice().sort((a, b) => getCommentSortTime(b) - getCommentSortTime(a))[0];
}

function getUserLatestApprovedReview(productId) {
    const approved = getUserReviewsForProduct(productId).filter(c => c.status === 'approved');
    if (!approved.length) return null;
    return approved.slice().sort((a, b) => getCommentSortTime(b) - getCommentSortTime(a))[0];
}

function getUserLatestHiddenReview(productId) {
    const hidden = getUserReviewsForProduct(productId).filter(c => c.status === 'hidden');
    if (!hidden.length) return null;
    return hidden.slice().sort((a, b) => getCommentSortTime(b) - getCommentSortTime(a))[0];
}

/** What the signed-in customer should see in "Your review". Pending update wins over last live review. */
function getUserDisplayReview(productId) {
    return getUserPendingReview(productId)
        || getUserLatestApprovedReview(productId);
}

function dedupeApprovedByUser(comments) {
    const byUid = new Map();
    comments.forEach(c => {
        if (c.status !== 'approved' || !c.uid) return;
        const existing = byUid.get(c.uid);
        if (!existing || getCommentSortTime(c) > getCommentSortTime(existing)) {
            byUid.set(c.uid, c);
        }
    });
    return Array.from(byUid.values()).sort((a, b) => getCommentSortTime(b) - getCommentSortTime(a));
}

function getUserReviewForProduct(productId) {
    return getUserDisplayReview(productId);
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
    return `<button type="button" class="product-review-edit-link" onclick="startEditProductComment('${safeId}')" title="Edit your review" aria-label="Edit your review"><i class="fa fa-pencil"></i></button>`;
}

function renderInlineCommentEditHtml(c) {
    const safeId = String(c.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const rating = window.selectedCommentRating || c.rating || 0;
    const textContent = escapeHtml(c.text || '');

    return `
        <div id="det-comment-form" class="product-review-card product-review-card--editing" data-comment-id="${safeId}">
            <div class="product-review-edit-banner">
                <i class="fa fa-pencil"></i>
                <span>Editing your review</span>
            </div>
            <div class="product-review-edit-body">
                <div class="product-review-edit-label">Your rating</div>
                <div id="det-comment-rating-input" class="product-review-edit-stars">${renderStarRatingHtml(rating, true, '22px')}</div>
                <div class="product-review-edit-label">Your review <span class="product-review-edit-optional">(optional)</span></div>
                <textarea id="det-comment-text" class="product-review-edit-textarea"
                    placeholder="Update your experience (min ${COMMENT_TEXT_MIN} characters if you write something)..."
                    maxlength="${COMMENT_TEXT_MAX}">${textContent}</textarea>
                <p class="product-review-edit-hint">You're updating your existing review. Changes need admin approval before going live.</p>
                <div class="product-review-edit-actions">
                    <button type="button" class="product-review-btn product-review-btn--cancel" onclick="cancelEditProductComment()">Cancel</button>
                    <button type="button" class="product-review-btn product-review-btn--save" onclick="submitProductComment()">Update review</button>
                </div>
            </div>
        </div>`;
}

function renderCommentFormHtml() {
    const rating = window.selectedCommentRating || 0;

    return `
        <div id="det-comment-form" class="product-review-card product-review-card--compose">
            <div class="product-review-compose-title">Rate this product</div>
            <p class="product-review-compose-subtitle">Share a star rating. A written review is optional.</p>
            <div id="det-comment-rating-input" class="product-review-edit-stars">${renderStarRatingHtml(rating, true, '22px')}</div>
            <div class="product-review-edit-label">Your review <span class="product-review-edit-optional">(optional)</span></div>
            <textarea id="det-comment-text" class="product-review-edit-textarea"
                placeholder="Share your experience (min ${COMMENT_TEXT_MIN} characters if you write something)..."
                maxlength="${COMMENT_TEXT_MAX}"></textarea>
            <p class="product-review-edit-hint">Reviews are published after admin approval.</p>
            <div class="product-review-edit-actions product-review-edit-actions--compose">
                <button type="button" class="product-review-btn product-review-btn--save" onclick="submitProductComment()">Post review</button>
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
        document.querySelector('.product-review-card--editing')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        document.getElementById('det-comment-text')?.focus();
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
    window._activeProductPurchaseState = {};
};

function renderProductCommentsSection() {
    const section = document.getElementById('det-comments-section');
    if (!section) return;

    if (!isProductCommentsEnabled()) {
        section.style.display = 'none';
        return;
    }

    const productId = typeof activeProductId !== 'undefined' ? activeProductId : null;
    if (!productId) {
        section.style.display = 'none';
        return;
    }

    const approved = window.productCommentsCache.filter(c => isReviewEligibleForPublicDisplay(c));
    const publicApproved = dedupeApprovedByUser(approved);

    const ratedApproved = publicApproved.filter(c => c.rating);
    const avgRating = ratedApproved.length
        ? ratedApproved.reduce((s, c) => s + (c.rating || 0), 0) / ratedApproved.length
        : 0;
    const avgDisplay = ratedApproved.length ? avgRating.toFixed(1) : null;

    let summaryHtml = '';
    if (publicApproved.length > 0) {
        summaryHtml = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px; flex-wrap:wrap;">
                ${avgDisplay ? renderStarRatingHtml(Math.round(avgRating), false, '13px') : ''}
                <span style="font-size:12px; color:#888;">
                    ${avgDisplay ? `<strong style="color:var(--gold);">${avgDisplay}</strong> · ` : ''}${publicApproved.length} review${publicApproved.length !== 1 ? 's' : ''}
                </span>
            </div>`;
    }

    const myPending = currentUser ? getUserPendingReview(productId) : null;
    const myApproved = currentUser ? getUserLatestApprovedReview(productId) : null;
    const myReview = currentUser ? getUserDisplayReview(productId) : null;

    if (!shouldShowProductReviewsSection(productId, publicApproved, myReview)) {
        section.style.display = 'none';
        section.innerHTML = '';
        return;
    }
    section.style.display = 'block';

    let visiblePublicApproved = publicApproved;
    if (currentUser && (myReview || myApproved)) {
        visiblePublicApproved = publicApproved.filter(c => c.uid !== currentUser.uid);
    }

    const listHtml = visiblePublicApproved.length === 0 && !myReview
        ? (canUserReviewProduct(productId)
            ? `<p style="color:#555; font-size:12px; margin:0 0 15px 0;">No reviews yet. Share your rating from your order.</p>`
            : '')
        : visiblePublicApproved.map(c => commentCardHtml(c, false)).join('');

    let yourReviewHtml = '';
    if (currentUser && myReview) {
        yourReviewHtml = `
            <div class="product-review-yours-wrap">
                <div class="product-review-yours-label">Your review</div>
                ${commentCardHtml(
                    myReview,
                    false,
                    myReview.status === 'pending',
                    false,
                    false,
                    true
                )}
            </div>`;
        if (myPending && myApproved) {
            yourReviewHtml += `<p class="product-review-pending-note"><i class="fa fa-clock"></i> Your updated review is awaiting approval. It will replace your current review once approved.</p>`;
        }
    }

    let formHtml = '';
    if (currentUser && !myPending && !myApproved && canUserReviewProduct(productId)) {
        formHtml = renderCommentFormHtml();
    }

    section.innerHTML = `
        <div style="border-top:1px solid #222; padding-top:20px; margin-top:10px;">
            <p style="font-size:11px; color:#666; margin:0 0 12px 0; letter-spacing:1px;">CUSTOMER REVIEWS</p>
            ${summaryHtml}
            ${yourReviewHtml}
            <div id="det-comments-list" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
                ${listHtml}
            </div>
            ${formHtml}
        </div>`;
}

function commentCardHtml(c, isAdmin, isPending, isRejected, isHidden, isYourReview) {
    const safeId = String(c.id || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    if (!isAdmin && isReviewOwner(c) && window.editingCommentId === c.id) {
        return renderInlineCommentEditHtml(c);
    }

    const initials = (c.userName || c.userEmail || 'U').charAt(0).toUpperCase();
    const displayName = isYourReview ? 'You' : (c.userName || 'Customer');
    const pendingFlag = isPending === true || (isPending !== false && c.status === 'pending');
    const rejectedFlag = isRejected === true || (isRejected !== false && c.status === 'rejected');
    const hiddenFlag = isHidden === true || (isHidden !== false && c.status === 'hidden');
    const statusBadge = pendingFlag
        ? `<span style="font-size:9px; color:var(--gold); background:rgba(255,215,0,0.1); padding:2px 6px; border-radius:4px; margin-left:6px;">PENDING</span>`
        : rejectedFlag && isAdmin
            ? `<span style="font-size:9px; color:var(--red); background:rgba(255,71,87,0.1); padding:2px 6px; border-radius:4px; margin-left:6px;">REJECTED</span>`
            : hiddenFlag
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
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#555; border-color:#666;" onclick="restoreProductComment('${safeId}')"><i class="fa fa-eye"></i> Restore</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#e74c3c; border-color:#c0392b;" onclick="rejectProductComment('${safeId}')"><i class="fa fa-times"></i> Reject</button>
                </div>`;
        } else {
            actionsHtml = `
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#2ecc71;" onclick="approveProductComment('${safeId}')"><i class="fa fa-check"></i> Approve</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#555;" onclick="hideProductComment('${safeId}')"><i class="fa fa-eye-slash"></i> Hide</button>
                    <button class="btn-gold" style="width:auto; padding:6px 12px; font-size:11px; margin:0; background:#e74c3c;" onclick="deleteProductComment('${safeId}')"><i class="fa fa-trash"></i> Delete</button>
                </div>`;
        }
    } else if (isReviewOwner(c) && !isAdmin) {
        /* Edit control shown in card header */
    }

    const textHtml = (c.text && String(c.text).trim())
        ? `<p class="product-review-card-text">${escapeHtml(c.text)}</p>`
        : `<p class="product-review-card-text product-review-card-text--empty">Rating only — no written review</p>`;
    const editedMeta = c.updatedAt
        ? `<span class="product-review-edited">· edited ${formatCommentDate(c.updatedAt)}</span>`
        : '';
    const showEditLink = isReviewOwner(c) && !isAdmin && window.editingCommentId !== c.id;

    return `
        <div class="product-review-card${isYourReview ? ' product-review-card--yours' : ''}">
            ${productLine}
            <div class="product-review-card-row">
                <div class="product-review-card-avatar">${initials}</div>
                <div class="product-review-card-content">
                    <div class="product-review-card-header">
                        <div class="product-review-card-meta">
                            <span class="product-review-card-name">${escapeHtml(displayName)}</span>
                            ${statusBadge}
                            ${!isAdmin ? `<span class="product-review-card-date">${formatCommentDate(c.createdAt)}${editedMeta}</span>` : ''}
                        </div>
                        ${showEditLink ? renderOwnerEditButton(safeId) : ''}
                    </div>
                    ${ratingHtml ? `<div class="product-review-card-stars">${ratingHtml}</div>` : ''}
                    ${textHtml}
                    ${isAdmin ? adminMeta : ''}
                    ${actionsHtml}
                </div>
            </div>
        </div>`;
}

window._activeProductPurchaseState = window._activeProductPurchaseState || {};
window._purchaseVerifyCache = window._purchaseVerifyCache || {};

const REVIEW_INELIGIBLE_ORDER_STATUSES = new Set(['cancelled', 'returned']);

function isReviewEligibleForPublicDisplay(c) {
    if (!c || c.status !== 'approved') return false;
    return c.verifiedPurchase !== false;
}

function getProductPurchaseState(productId) {
    if (!productId || !currentUser) return false;
    return window._activeProductPurchaseState[productId];
}

function isProductPurchaseCheckReady(productId) {
    const state = getProductPurchaseState(productId);
    return state === true || state === false;
}

function shouldShowProductReviewsSection(productId, publicApproved, myReview) {
    if (publicApproved.length > 0 || myReview) return true;
    if (!currentUser) return false;
    if (!isProductPurchaseCheckReady(productId)) return false;
    return canUserReviewProduct(productId);
}

async function hasUserPurchasedProduct(productId) {
    if (!currentUser || !productId || typeof db === 'undefined') return false;

    const cacheKey = `${currentUser.uid}:${productId}`;
    if (window._purchaseVerifyCache[cacheKey] !== undefined) {
        return window._purchaseVerifyCache[cacheKey];
    }

    try {
        const snap = await db.collection('orders').where('uid', '==', currentUser.uid).limit(200).get();
        const purchased = snap.docs.some(doc => {
            const data = doc.data() || {};
            if (REVIEW_INELIGIBLE_ORDER_STATUSES.has(data.status)) return false;
            return (data.items || []).some(item => item && item.id === productId);
        });
        window._purchaseVerifyCache[cacheKey] = purchased;
        return purchased;
    } catch (e) {
        console.error('hasUserPurchasedProduct error:', e);
        return false;
    }
}

async function refreshProductPurchaseEligibility(productId) {
    if (!productId) return false;
    if (!currentUser) {
        window._activeProductPurchaseState[productId] = false;
        return false;
    }

    window._activeProductPurchaseState[productId] = 'loading';
    if (window._commentsLoadedProductId === productId) {
        renderProductCommentsSection();
    }

    const purchased = await hasUserPurchasedProduct(productId);
    window._activeProductPurchaseState[productId] = purchased;
    return purchased;
}

function canUserReviewProduct(productId) {
    if (!currentUser || !productId) return false;
    return getProductPurchaseState(productId) === true;
}
window.canUserReviewProduct = canUserReviewProduct;

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
        if (productId) delete window._activeProductPurchaseState[productId];
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

    refreshProductPurchaseEligibility(productId).then(() => {
        if (window._commentsLoadedProductId === productId) {
            renderProductCommentsSection();
        }
    });

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

    if (!canUserReviewProduct(activeProductId)) {
        const eligible = await refreshProductPurchaseEligibility(activeProductId);
        if (!eligible) {
            return showToast('You can only review products you have purchased.');
        }
    }

    const textEl = document.getElementById('det-comment-text');
    const text = textEl ? textEl.value.trim() : '';
    const rating = window.selectedCommentRating || 0;
    const validationError = validateReviewInput(text, rating);
    if (validationError) return showToast(validationError);

    const editingId = window.editingCommentId;
    const existingReview = editingId
        ? window.productCommentsCache.find(c => c.id === editingId)
        : null;
    const pendingReview = getUserPendingReview(activeProductId);
    const approvedReview = getUserLatestApprovedReview(activeProductId);

    if (editingId) {
        if (!existingReview || !isReviewOwner(existingReview)) {
            return showToast('You can only edit your own review.');
        }
        if (existingReview.productId !== activeProductId) {
            return showToast('This review belongs to another product.');
        }
    } else if (pendingReview) {
        return showToast('You already have a review awaiting approval.');
    } else if (approvedReview) {
        return showToast('Tap the pencil icon on your review to update it.');
    }

    const p = (typeof products !== 'undefined' ? products : []).find(x => x.id === activeProductId);
    const userName = document.getElementById('prof-name')?.value?.trim()
        || currentUser.displayName
        || (currentUser.email ? currentUser.email.split('@')[0] : 'Customer');

    try {
        if (editingId && existingReview) {
            if (existingReview.status === 'pending') {
                await db.collection('product_comments').doc(editingId).update({
                    rating,
                    text,
                    status: 'pending',
                    reviewedAt: null,
                    reviewedBy: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                showToast('Your review was updated. Pending approval before it goes live.');
            } else {
                const targetPending = pendingReview && pendingReview.id !== editingId ? pendingReview : null;
                if (targetPending) {
                    await db.collection('product_comments').doc(targetPending.id).update({
                        rating,
                        text,
                        status: 'pending',
                        reviewedAt: null,
                        reviewedBy: null,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
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
                        verifiedPurchase: true,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        reviewedAt: null,
                        reviewedBy: null,
                        replacesCommentId: existingReview.id
                    });
                }
                showToast('Your update was submitted. Your previous review stays visible until this is approved.');
            }
            resetCommentFormState();
            if (textEl) textEl.value = '';
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
                verifiedPurchase: true,
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

async function approveProductCommentInternal(commentId) {
    if (!hasAdminCapability('approveComments')) return showToast('You do not have permission to moderate reviews.');

    const fromCache = window.commentsModerationCache.find(c => c.id === commentId)
        || window.productCommentsCache.find(c => c.id === commentId);
    let comment = fromCache;
    if (!comment) {
        const snap = await db.collection('product_comments').doc(commentId).get();
        if (!snap.exists) return showToast('Review not found.');
        comment = { id: snap.id, ...snap.data() };
    }

    if (comment.status !== 'pending') {
        return showToast('Only pending reviews can be approved. Use Restore for hidden reviews.');
    }

    try {
        const relatedSnap = await db.collection('product_comments')
            .where('productId', '==', comment.productId)
            .get();

        const batch = db.batch();
        relatedSnap.forEach(doc => {
            const data = doc.data();
            if (data.uid !== comment.uid) return;

            if (doc.id === commentId) {
                batch.update(doc.ref, {
                    status: 'approved',
                    verifiedPurchase: data.verifiedPurchase !== false,
                    reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    reviewedBy: currentUser ? (currentUser.email || '') : ''
                });
            } else {
                const status = data.status;
                if (status === 'approved' || status === 'pending' || status === 'hidden') {
                    batch.delete(doc.ref);
                }
            }
        });
        await batch.commit();
        showToast('✅ Review approved.');
    } catch (e) {
        console.error('approveProductComment error:', e);
        showToast('Failed to approve review.');
    }
}

async function updateCommentStatus(commentId, status) {
    if (!hasAdminCapability('approveComments')) return showToast('You do not have permission to moderate reviews.');
    try {
        await db.collection('product_comments').doc(commentId).update({
            status,
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: currentUser ? (currentUser.email || '') : ''
        });
        showToast(status === 'hidden' ? 'Review hidden from product page.' : 'Review updated.');
    } catch (e) {
        console.error('updateCommentStatus error:', e);
        showToast('Failed to update review.');
    }
}

window.approveProductComment = function(commentId) {
    approveProductCommentInternal(commentId);
};

window.rejectProductComment = async function(commentId) {
    if (!hasAdminCapability('approveComments')) return showToast('You do not have permission to moderate reviews.');
    if (!confirm('Reject and remove this review? It will not be shown to the customer.')) return;
    try {
        await db.collection('product_comments').doc(commentId).delete();
        showToast('Review rejected and removed.');
    } catch (e) {
        console.error('rejectProductComment error:', e);
        showToast('Failed to reject review.');
    }
};

window.hideProductComment = async function(commentId) {
    if (!hasAdminCapability('approveComments')) return showToast('You do not have permission to moderate reviews.');

    const comment = window.commentsModerationCache.find(c => c.id === commentId)
        || window.productCommentsCache.find(c => c.id === commentId);
    if (!comment) return showToast('Review not found.');

    if (comment.status === 'pending') {
        return showToast('Use Reject to remove a pending review. Hide only applies to live reviews.');
    }

    if (comment.status !== 'approved') {
        return showToast('Only approved reviews can be hidden.');
    }

    if (!confirm('Hide this review from the product page? The customer will no longer see it publicly. You can restore it later from the Hidden tab.')) return;

    try {
        await db.collection('product_comments').doc(commentId).update({
            status: 'hidden',
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: currentUser ? (currentUser.email || '') : ''
        });
        showToast('Review hidden from product page.');
    } catch (e) {
        console.error('hideProductComment error:', e);
        showToast('Failed to hide review.');
    }
};

window.restoreProductComment = async function(commentId) {
    if (!hasAdminCapability('approveComments')) return showToast('You do not have permission to moderate reviews.');

    const comment = window.commentsModerationCache.find(c => c.id === commentId)
        || window.productCommentsCache.find(c => c.id === commentId);
    if (!comment) return showToast('Review not found.');
    if (comment.status !== 'hidden') return showToast('Only hidden reviews can be restored.');

    if (!confirm('Restore this review on the product page?\n\nThis re-publishes only this review. It does not approve or remove any other pending updates from the same customer.')) return;

    try {
        await db.collection('product_comments').doc(commentId).update({
            status: 'approved',
            reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reviewedBy: currentUser ? (currentUser.email || '') : ''
        });
        showToast('Review restored to the product page.');
    } catch (e) {
        console.error('restoreProductComment error:', e);
        showToast('Failed to restore review.');
    }
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
