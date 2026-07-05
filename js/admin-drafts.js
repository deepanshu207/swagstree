// ==========================================
// SWAG STREE | ADMIN CRUD DRAFTS (single slot)
// ==========================================

(function() {
    const ADMIN_DRAFT_KEY = 'swagstree_admin_draft_v1';
    const ADMIN_DRAFT_MAX_BYTES = 100000;
    let unsavedResolver = null;
    let categoryDraftTimer = null;
    let productDraftTimer = null;

    function adminDraftRead() {
        try {
            const raw = localStorage.getItem(ADMIN_DRAFT_KEY);
            if (!raw) return null;
            const draft = JSON.parse(raw);
            if (!draft || typeof draft !== 'object' || !draft.type) return null;
            return draft;
        } catch (e) {
            console.warn('adminDraftRead failed:', e);
            return null;
        }
    }

    function adminDraftWrite(draft) {
        if (!draft) return false;
        try {
            const json = JSON.stringify(draft);
            if (json.length > ADMIN_DRAFT_MAX_BYTES) {
                console.warn('Admin draft too large; not saved.');
                return false;
            }
            localStorage.setItem(ADMIN_DRAFT_KEY, json);
            return true;
        } catch (e) {
            console.warn('adminDraftWrite failed:', e);
            return false;
        }
    }

    window.adminDraftWrite = adminDraftWrite;

    function adminDraftClear() {
        try { localStorage.removeItem(ADMIN_DRAFT_KEY); } catch (e) { /* ignore */ }
        adminDraftRenderBanners();
    }

    function adminDraftFormatAge(ts) {
        const ms = Date.now() - (Number(ts) || 0);
        if (ms < 60000) return 'just now';
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
        if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
        return `${Math.floor(ms / 86400000)}d ago`;
    }

    function adminPromptUnsaved(message) {
        return new Promise(resolve => {
            const modal = document.getElementById('admin-unsaved-modal');
            const msgEl = document.getElementById('admin-unsaved-message');
            if (!modal || !msgEl) {
                resolve(window.confirm(message + '\n\nOK = Save, Cancel = Keep editing') ? 'save' : 'cancel');
                return;
            }
            unsavedResolver = resolve;
            msgEl.textContent = message;
            modal.style.display = 'flex';
        });
    }

    window.adminUnsavedResolve = function(choice) {
        const modal = document.getElementById('admin-unsaved-modal');
        if (modal) modal.style.display = 'none';
        if (unsavedResolver) unsavedResolver(choice || 'cancel');
        unsavedResolver = null;
    };

    async function adminHandleDirtyLeave(message, onSave, onDiscard) {
        const choice = await adminPromptUnsaved(message);
        if (choice === 'cancel') return false;
        if (choice === 'save') {
            const ok = await onSave();
            if (!ok) return false;
        } else if (choice === 'discard') {
            if (typeof onDiscard === 'function') onDiscard();
        }
        return true;
    }

    function adminDraftRenderBanners() {
        /* Silent drafts — no in-form banners (avoids layout jump + scroll). */
    }

    function escapeAdminDraftHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function adminAnyUnsavedDirty() {
        const prodOpen = document.getElementById('prod-modal')?.style.display === 'flex';
        if (prodOpen && typeof adminIsProductDirty === 'function' && adminIsProductDirty()) return true;
        if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) return true;
        if (typeof isCategoryFormDirty === 'function' && isCategoryFormDirty()) return true;
        return false;
    }

    window.adminPromptUnsavedChoice = adminPromptUnsaved;
    window.adminDraftClear = adminDraftClear;
    window.adminDraftRead = adminDraftRead;
    window.adminDraftRenderBanners = adminDraftRenderBanners;
    window.adminAnyUnsavedDirty = adminAnyUnsavedDirty;

    window.adminApproveCategoryDraft = async function() {
        if (typeof saveCategory === 'function') await saveCategory();
    };

    window.adminRejectCategoryDraft = function() {
        if (typeof discardCategoryDraft === 'function') discardCategoryDraft(true);
    };

    window.adminApproveProductDraft = async function() {
        if (typeof saveProduct === 'function') await saveProduct();
    };

    window.adminRejectProductDraft = function() {
        if (typeof discardProductDraft === 'function') discardProductDraft(true);
    };

    window.adminGuardCategoryLeave = async function(message, next) {
        if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) {
            const inlineId = window.inlineEditingCategoryId;
            if (inlineId && typeof isInlineCategoryDirty === 'function' && isInlineCategoryDirty(inlineId)) {
                const choice = await adminPromptUnsaved(message || 'Save category changes?');
                if (choice === 'cancel') return false;
                if (choice === 'save') {
                    if (typeof saveInlineCategory === 'function') await saveInlineCategory(inlineId);
                    if (isInlineCategoryDirty(inlineId)) return false;
                } else if (typeof cancelInlineCategoryEdit === 'function') {
                    cancelInlineCategoryEdit();
                }
            } else if (typeof isCategoryFormDirty === 'function' && isCategoryFormDirty()) {
                const proceed = await adminHandleDirtyLeave(
                    message || 'You have unsaved category changes.',
                    async () => {
                        if (typeof saveCategory !== 'function') return false;
                        await saveCategory();
                        return !(typeof isCategoryFormDirty === 'function' && isCategoryFormDirty());
                    },
                    () => { if (typeof discardCategoryDraft === 'function') discardCategoryDraft(true); }
                );
                if (!proceed) return false;
            }
            if (typeof next === 'function') await next();
            return true;
        }
        if (typeof isCategoryFormDirty !== 'function' || !isCategoryFormDirty()) {
            if (typeof next === 'function') return next();
            return true;
        }
        const proceed = await adminHandleDirtyLeave(
            message || 'You have unsaved category changes.',
            async () => {
                if (typeof saveCategory !== 'function') return false;
                await saveCategory();
                return !(typeof isCategoryFormDirty === 'function' && isCategoryFormDirty());
            },
            () => { if (typeof discardCategoryDraft === 'function') discardCategoryDraft(true); }
        );
        if (!proceed) return false;
        if (typeof next === 'function') await next();
        return true;
    };

    window.adminGuardProductLeave = async function(message, next) {
        const modal = document.getElementById('prod-modal');
        const open = modal && modal.style.display === 'flex';
        if (!open || typeof adminIsProductDirty !== 'function' || !adminIsProductDirty()) {
            if (typeof next === 'function') return next();
            return true;
        }
        const proceed = await adminHandleDirtyLeave(
            message || 'You have unsaved product changes.',
            async () => {
                if (typeof saveProduct !== 'function') return false;
                await saveProduct();
                return !(typeof adminIsProductDirty === 'function' && adminIsProductDirty());
            },
            () => { if (typeof discardProductDraft === 'function') discardProductDraft(true); }
        );
        if (!proceed) return false;
        if (typeof next === 'function') await next();
        return true;
    };

    window.adminTryNavigateAway = async function(targetView, navigateFn) {
        const prodOpen = document.getElementById('prod-modal')?.style.display === 'flex';
        if (prodOpen) {
            const ok = await adminGuardProductLeave('Save product changes before leaving?', () => {
                adminProductSnapshot = null;
                closeModal('prod-modal');
            });
            if (!ok) return false;
        }
        const onAdmin = document.getElementById('admin-view')?.classList.contains('active');
        const leavingAdmin = onAdmin && targetView !== 'admin';
        if (leavingAdmin && typeof isCategoryFormDirty === 'function' && isCategoryFormDirty()) {
            const ok = await adminGuardCategoryLeave('Save category changes before leaving Admin?', () => {});
            if (!ok) return false;
        }
        if (typeof navigateFn === 'function') navigateFn();
        return true;
    };

    window.adminScheduleCategoryDraftSave = function() {
        clearTimeout(categoryDraftTimer);
        categoryDraftTimer = setTimeout(() => {
            if (typeof persistCategoryDraft === 'function') persistCategoryDraft();
        }, 800);
    };

    window.adminScheduleProductDraftSave = function() {
        clearTimeout(productDraftTimer);
        productDraftTimer = setTimeout(() => {
            if (typeof persistProductDraft === 'function') persistProductDraft();
        }, 600);
    };

    window.addEventListener('beforeunload', (e) => {
        if (adminAnyUnsavedDirty()) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    document.addEventListener('DOMContentLoaded', () => {
        adminDraftRenderBanners();
    });
})();
