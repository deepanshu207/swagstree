// ==========================================
// SWAG STREE | ADMIN CRUD DRAFTS (seller-style)
// ==========================================

(function() {
    const ADMIN_DRAFTS_KEY = 'swagstree_admin_drafts_v2';
    const ADMIN_DRAFTS_LEGACY_KEY = 'swagstree_admin_draft_v1';
    const ADMIN_DRAFTS_LEGACY_ARCHIVE_KEY = 'swagstree_admin_draft_archive_v1';
    const ADMIN_DRAFTS_MAX_BYTES = 500000;
    const ADMIN_DRAFTS_MAX_PER_TYPE = 25;

    let unsavedResolver = null;
    let categoryDraftTimer = null;
    let productDraftTimer = null;

    window._activeAdminDraftKey = window._activeAdminDraftKey || null;

    function adminCrudDraftsEnabled() {
        return !!(window.APP_FEATURES && window.APP_FEATURES.adminCrudDrafts !== false);
    }

    function adminDraftEscapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function adminDraftFormatAge(ts) {
        const ms = Date.now() - (Number(ts) || 0);
        if (ms < 60000) return 'just now';
        if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
        if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
        return `${Math.floor(ms / 86400000)}d ago`;
    }

    function adminDraftEmptyStore() {
        return { v: 2, categories: {}, products: {} };
    }

    function adminDraftComposeActiveKey(type, key) {
        return `${type}:${key}`;
    }

    function adminDraftSetActive(type, key) {
        window._activeAdminDraftKey = type && key ? adminDraftComposeActiveKey(type, key) : null;
    }

    function adminDraftClearActive() {
        window._activeAdminDraftKey = null;
    }

    function adminDraftIsActive(type, key) {
        return window._activeAdminDraftKey === adminDraftComposeActiveKey(type, key);
    }

    function adminDraftMigrateLegacy() {
        try {
            const legacyRaw = localStorage.getItem(ADMIN_DRAFTS_LEGACY_KEY);
            const archiveRaw = localStorage.getItem(ADMIN_DRAFTS_LEGACY_ARCHIVE_KEY);
            const store = adminDraftsReadAll();
            let changed = false;

            [legacyRaw, archiveRaw].forEach(raw => {
                if (!raw) return;
                try {
                    const draft = JSON.parse(raw);
                    if (!draft || !draft.type || !draft.form) return;
                    const bucket = draft.type === 'category' ? 'categories' : draft.type === 'product' ? 'products' : null;
                    if (!bucket) return;
                    const entityId = draft.entityId || draft.form.editingCategoryId || draft.form.editingId || null;
                    const key = entityId ? `edit:${entityId}` : 'new';
                    if (!store[bucket][key]) {
                        store[bucket][key] = {
                            form: draft.form,
                            label: draft.label || draft.form.name || (bucket === 'products' ? 'Product' : 'Category'),
                            entityId,
                            updatedAt: draft.updatedAt || draft.archivedAt || Date.now()
                        };
                        changed = true;
                    }
                } catch (e) { /* ignore */ }
            });

            if (legacyRaw) {
                localStorage.removeItem(ADMIN_DRAFTS_LEGACY_KEY);
                changed = true;
            }
            if (archiveRaw) {
                localStorage.removeItem(ADMIN_DRAFTS_LEGACY_ARCHIVE_KEY);
                changed = true;
            }
            if (changed) adminDraftsWriteAll(store);
        } catch (e) {
            console.warn('adminDraftMigrateLegacy failed:', e);
        }
    }

    function adminDraftsReadAll() {
        adminDraftMigrateLegacy();
        try {
            const raw = localStorage.getItem(ADMIN_DRAFTS_KEY);
            if (!raw) return adminDraftEmptyStore();
            const store = JSON.parse(raw);
            if (!store || typeof store !== 'object') return adminDraftEmptyStore();
            store.categories = store.categories && typeof store.categories === 'object' ? store.categories : {};
            store.products = store.products && typeof store.products === 'object' ? store.products : {};
            store.v = 2;
            return store;
        } catch (e) {
            console.warn('adminDraftsReadAll failed:', e);
            return adminDraftEmptyStore();
        }
    }

    function adminDraftsWriteAll(store) {
        if (!store) return false;
        try {
            const json = JSON.stringify(store);
            if (json.length > ADMIN_DRAFTS_MAX_BYTES) {
                console.warn('Admin drafts exceed storage cap; oldest entries trimmed.');
                adminDraftsEvictOldest(store);
                const trimmed = JSON.stringify(store);
                if (trimmed.length > ADMIN_DRAFTS_MAX_BYTES) return false;
                localStorage.setItem(ADMIN_DRAFTS_KEY, trimmed);
                return true;
            }
            localStorage.setItem(ADMIN_DRAFTS_KEY, json);
            return true;
        } catch (e) {
            console.warn('adminDraftsWriteAll failed:', e);
            return false;
        }
    }

    function adminDraftsEvictOldest(store) {
        ['categories', 'products'].forEach(bucket => {
            const entries = Object.entries(store[bucket] || {});
            if (entries.length <= ADMIN_DRAFTS_MAX_PER_TYPE) return;
            entries.sort((a, b) => (Number(a[1]?.updatedAt) || 0) - (Number(b[1]?.updatedAt) || 0));
            const removeCount = entries.length - ADMIN_DRAFTS_MAX_PER_TYPE;
            entries.slice(0, removeCount).forEach(([key]) => {
                delete store[bucket][key];
            });
        });
    }

    function adminDraftGetEntry(type, key) {
        if (!type || !key) return null;
        const store = adminDraftsReadAll();
        const bucket = type === 'category' ? 'categories' : type === 'product' ? 'products' : null;
        if (!bucket) return null;
        const entry = store[bucket][key];
        if (!entry?.form) return null;
        return { type, key, entry };
    }

    function adminDraftIsVisible(type, key) {
        if (!adminCrudDraftsEnabled()) return false;
        if (adminDraftIsActive(type, key)) return false;
        return !!adminDraftGetEntry(type, key);
    }

    function adminDraftUpsert(type, key, payload, opts) {
        if (!adminCrudDraftsEnabled() || !type || !key || !payload) return false;
        const store = adminDraftsReadAll();
        const bucket = type === 'category' ? 'categories' : type === 'product' ? 'products' : null;
        if (!bucket) return false;
        store[bucket][key] = {
            form: payload.form,
            label: payload.label || 'Untitled',
            entityId: payload.entityId || null,
            updatedAt: Date.now()
        };
        adminDraftsEvictOldest(store);
        const ok = adminDraftsWriteAll(store);
        if (ok && !(opts && opts.skipUi)) {
            renderAdminDraftRecoveryPanel();
        }
        return ok;
    }

    function adminDraftRemove(type, key) {
        if (!type || !key) return;
        const store = adminDraftsReadAll();
        const bucket = type === 'category' ? 'categories' : type === 'product' ? 'products' : null;
        if (!bucket) return;
        if (store[bucket][key]) delete store[bucket][key];
        adminDraftsWriteAll(store);
        if (adminDraftIsActive(type, key)) adminDraftClearActive();
        renderAdminDraftRecoveryPanel();
    }

    function adminDraftRemoveAll() {
        try { localStorage.removeItem(ADMIN_DRAFTS_KEY); } catch (e) { /* ignore */ }
        adminDraftClearActive();
        renderAdminDraftRecoveryPanel();
    }

    function adminDraftListEntries() {
        const store = adminDraftsReadAll();
        const items = [];
        Object.entries(store.categories || {}).forEach(([key, entry]) => {
            items.push({ type: 'category', key, entry });
        });
        Object.entries(store.products || {}).forEach(([key, entry]) => {
            items.push({ type: 'product', key, entry });
        });
        items.sort((a, b) => (Number(b.entry?.updatedAt) || 0) - (Number(a.entry?.updatedAt) || 0));
        return items;
    }

    function adminGetVisibleProductDraft(key) {
        if (!adminDraftIsVisible('product', key)) return null;
        return adminDraftGetEntry('product', key);
    }

    function adminGetVisibleCategoryDraft(key) {
        if (!adminDraftIsVisible('category', key)) return null;
        return adminDraftGetEntry('category', key);
    }

    function adminGetOrphanedNewProductDraft() {
        return adminGetVisibleProductDraft('new');
    }

    function adminGetOrphanedNewCategoryDraft() {
        return adminGetVisibleCategoryDraft('new');
    }

    function adminDraftsStorageInfo() {
        try {
            const raw = localStorage.getItem(ADMIN_DRAFTS_KEY) || '';
            const store = adminDraftsReadAll();
            return {
                bytes: raw.length,
                total: Object.keys(store.categories || {}).length + Object.keys(store.products || {}).length,
                categories: Object.keys(store.categories || {}).length,
                products: Object.keys(store.products || {}).length
            };
        } catch (e) {
            return { bytes: 0, total: 0, categories: 0, products: 0 };
        }
    }

    function adminDraftFormatBytes(bytes) {
        const n = Number(bytes) || 0;
        if (n < 1024) return `${n} B`;
        if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
        return `${(n / (1024 * 1024)).toFixed(2)} MB`;
    }

    function updateSuperadminDraftStorageInfo() {
        const el = document.getElementById('admin-drafts-storage-info');
        if (!el) return;
        const info = adminDraftsStorageInfo();
        el.textContent = info.total
            ? `${info.total} draft${info.total === 1 ? '' : 's'} · ${adminDraftFormatBytes(info.bytes)} in browser storage`
            : 'No drafts stored in this browser';
    }

    function updateAdminNewProductDraftBadge() {
        const btn = document.getElementById('admin-new-product-btn');
        if (!btn) return;
        const hasDraft = !!adminGetOrphanedNewProductDraft();
        btn.classList.toggle('has-new-draft', hasDraft);
        let badge = btn.querySelector('.admin-new-draft-btn-badge');
        if (hasDraft) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'admin-new-draft-btn-badge';
                badge.textContent = 'Draft';
                btn.appendChild(badge);
            }
        } else if (badge) {
            badge.remove();
        }
    }

    function renderAdminDraftRecoveryPanel() {
        const el = document.getElementById('admin-draft-recovery-panel');
        if (el) {
            el.hidden = true;
            el.innerHTML = '';
        }
        updateAdminNewProductDraftBadge();
        updateSuperadminDraftStorageInfo();
    }

    window.adminRestoreDraft = function(type, key) {
        if (!adminCrudDraftsEnabled()) return;
        const item = adminDraftGetEntry(type, key);
        if (!item?.entry?.form) return;

        if (type === 'category') {
            if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) {
                showToast('Save or discard your current category edits first.');
                return;
            }
            if (typeof openAdminCategoryAccordion === 'function') openAdminCategoryAccordion();
            if (typeof applyCategoryFormState === 'function') applyCategoryFormState(item.entry.form);
            adminDraftSetActive('category', key);
            showToast('Category draft opened — publish with Add/Save or use Save as draft.');
        } else if (type === 'product') {
            const modal = document.getElementById('prod-modal');
            if (modal?.style.display === 'flex' && typeof adminIsProductDirty === 'function' && adminIsProductDirty()) {
                showToast('Save or discard your current product edits first.');
                return;
            }
            if (modal) modal.style.display = 'flex';
            if (typeof applyProductDraftForm === 'function') applyProductDraftForm(item.entry.form);
            adminDraftSetActive('product', key);
            if (typeof adminBindProductDraftListeners === 'function') adminBindProductDraftListeners();
            if (typeof adminResetProductSnapshot === 'function') adminResetProductSnapshot();
            if (typeof renderProductModalDraftBanner === 'function') renderProductModalDraftBanner();
            if (item.entry.form.hasPendingFiles) {
                showToast('Draft opened — re-upload any files that were not saved.');
            } else {
                showToast('Draft opened — publish with Save Product or Save as draft.');
            }
        }

        renderAdminDraftRecoveryPanel();
        if (typeof renderAdmin === 'function') renderAdmin();
    };

    window.adminDeleteDraft = function(type, key) {
        adminDraftRemove(type, key);
        showToast('Draft deleted.');
        if (typeof renderAdmin === 'function') renderAdmin();
        if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
    };

    window.adminDeleteAllDrafts = function() {
        if (!adminDraftListEntries().length) return;
        if (!window.confirm('Delete all drafts on this device?')) return;
        adminDraftRemoveAll();
        showToast('All drafts cleared.');
        if (typeof renderAdmin === 'function') renderAdmin();
    };

    function adminPromptUnsaved(message, withDraft) {
        return new Promise(resolve => {
            const modal = document.getElementById('admin-unsaved-modal');
            const msgEl = document.getElementById('admin-unsaved-message');
            const draftBtn = document.getElementById('admin-unsaved-btn-draft');
            if (!modal || !msgEl) {
                resolve(window.confirm(message + '\n\nOK = Save, Cancel = Keep editing') ? 'save' : 'cancel');
                return;
            }
            unsavedResolver = resolve;
            msgEl.textContent = message;
            if (draftBtn) draftBtn.style.display = (withDraft && adminCrudDraftsEnabled()) ? 'block' : 'none';
            modal.style.display = 'flex';
        });
    }

    window.adminUnsavedResolve = function(choice) {
        const modal = document.getElementById('admin-unsaved-modal');
        if (modal) modal.style.display = 'none';
        if (unsavedResolver) unsavedResolver(choice || 'cancel');
        unsavedResolver = null;
    };

    async function adminHandleDirtyLeave(message, handlers) {
        const withDraft = !!(handlers && handlers.onSaveDraft);
        const choice = await adminPromptUnsaved(message, withDraft);
        if (choice === 'cancel') return false;
        if (choice === 'save') {
            const ok = handlers.onSave ? await handlers.onSave() : false;
            if (!ok) return false;
        } else if (choice === 'draft') {
            if (handlers.onSaveDraft) await handlers.onSaveDraft();
        } else if (choice === 'discard') {
            if (handlers.onDiscard) handlers.onDiscard();
        }
        return true;
    }

    function adminAnyUnsavedDirty() {
        const prodOpen = document.getElementById('prod-modal')?.style.display === 'flex';
        if (prodOpen && typeof adminIsProductDirty === 'function' && adminIsProductDirty()) return true;
        if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) return true;
        if (typeof isCategoryFormDirty === 'function' && isCategoryFormDirty()) return true;
        return false;
    }

    function adminDraftRead() {
        const items = adminDraftListEntries().filter(item => adminDraftIsVisible(item.type, item.key));
        if (!items.length) return null;
        const item = items[0];
        return {
            type: item.type,
            form: item.entry.form,
            label: item.entry.label,
            entityId: item.entry.entityId,
            updatedAt: item.entry.updatedAt
        };
    }

    function adminDraftWrite(draft) {
        if (!draft || !draft.type || !draft.form) return false;
        const entityId = draft.entityId || draft.form.editingCategoryId || draft.form.editingId || null;
        const key = entityId ? `edit:${entityId}` : 'new';
        return adminDraftUpsert(draft.type, key, {
            form: draft.form,
            label: draft.label,
            entityId
        });
    }

    function adminDraftClear() {
        adminDraftRemoveAll();
    }

    window.adminCrudDraftsEnabled = adminCrudDraftsEnabled;
    window.adminPromptUnsavedChoice = (msg, withDraft) => adminPromptUnsaved(msg, withDraft);
    window.adminDraftUpsert = adminDraftUpsert;
    window.adminDraftRemove = adminDraftRemove;
    window.adminDraftRemoveAll = adminDraftRemoveAll;
    window.adminDraftGetEntry = adminDraftGetEntry;
    window.adminDraftIsVisible = adminDraftIsVisible;
    window.adminDraftSetActive = adminDraftSetActive;
    window.adminDraftClearActive = adminDraftClearActive;
    window.adminGetVisibleProductDraft = adminGetVisibleProductDraft;
    window.adminGetVisibleCategoryDraft = adminGetVisibleCategoryDraft;
    window.adminGetOrphanedNewProductDraft = adminGetOrphanedNewProductDraft;
    window.adminGetOrphanedNewCategoryDraft = adminGetOrphanedNewCategoryDraft;
    window.updateAdminNewProductDraftBadge = updateAdminNewProductDraftBadge;
    window.adminDraftsStorageInfo = adminDraftsStorageInfo;
    window.adminDraftFormatAge = adminDraftFormatAge;
    window.adminDraftFormatBytes = adminDraftFormatBytes;
    window.adminDraftClear = adminDraftClear;
    window.adminDraftRead = adminDraftRead;
    window.adminDraftWrite = adminDraftWrite;
    window.renderAdminDraftRecoveryPanel = renderAdminDraftRecoveryPanel;
    window.updateSuperadminDraftStorageInfo = updateSuperadminDraftStorageInfo;
    window.adminAnyUnsavedDirty = adminAnyUnsavedDirty;

    window.adminGuardCategoryLeave = async function(message, next) {
        if (window.inlineEditingCategoryId && typeof isInlineCategoryDirty === 'function' &&
            !isInlineCategoryDirty(window.inlineEditingCategoryId) && typeof cancelInlineCategoryEdit === 'function') {
            cancelInlineCategoryEdit();
        }

        if (typeof isAnyCategoryCrudDirty !== 'function' || !isAnyCategoryCrudDirty()) {
            if (typeof next === 'function') await next();
            return true;
        }

        const inlineId = window.inlineEditingCategoryId;
        if (inlineId && typeof isInlineCategoryDirty === 'function' && isInlineCategoryDirty(inlineId)) {
            const choice = await adminPromptUnsaved(message || 'Save category changes?', adminCrudDraftsEnabled());
            if (choice === 'cancel') return false;
            if (choice === 'save') {
                if (typeof saveInlineCategory === 'function') await saveInlineCategory(inlineId);
                if (isInlineCategoryDirty(inlineId)) return false;
            } else if (choice === 'draft') {
                if (typeof saveCategoryAsDraft === 'function') await saveCategoryAsDraft(true);
            } else if (typeof discardCategoryDraft === 'function') {
                discardCategoryDraft(true);
            } else if (typeof cancelInlineCategoryEdit === 'function') {
                cancelInlineCategoryEdit();
            }
        }

        if (typeof isCategoryFormDirty === 'function' && isCategoryFormDirty()) {
            const proceed = await adminHandleDirtyLeave(
                message || 'You have unsaved category changes.',
                {
                    onSave: async () => {
                        if (typeof saveCategory !== 'function') return false;
                        await saveCategory();
                        return !(typeof isCategoryFormDirty === 'function' && isCategoryFormDirty());
                    },
                    onSaveDraft: async () => {
                        if (typeof saveCategoryAsDraft === 'function') await saveCategoryAsDraft(true);
                    },
                    onDiscard: () => { if (typeof discardCategoryDraft === 'function') discardCategoryDraft(true); }
                }
            );
            if (!proceed) return false;
        }

        if (typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) return false;
        if (typeof next === 'function') await next();
        return true;
    };

    window.adminGuardProductLeave = async function(message, next) {
        const modal = document.getElementById('prod-modal');
        const open = modal && modal.style.display === 'flex';
        if (!open) {
            if (typeof next === 'function') return next();
            return true;
        }

        const dirty = typeof adminIsProductDirty === 'function' && adminIsProductDirty();
        const hasContent = typeof adminProductFormHasDraftableContent === 'function' && adminProductFormHasDraftableContent();

        if (!dirty && !hasContent) {
            if (typeof adminFinalizeProductModalClose === 'function') adminFinalizeProductModalClose();
            if (typeof next === 'function') await next();
            return true;
        }

        if (!dirty && hasContent) {
            if (typeof adminFinalizeProductModalClose === 'function') adminFinalizeProductModalClose();
            if (typeof next === 'function') await next();
            return true;
        }

        const proceed = await adminHandleDirtyLeave(
            message || 'You have unsaved product changes.',
            {
                onSave: async () => {
                    if (typeof saveProduct !== 'function') return false;
                    await saveProduct();
                    return !(typeof adminIsProductDirty === 'function' && adminIsProductDirty());
                },
                onSaveDraft: async () => {
                    if (typeof saveProductAsDraft === 'function') await saveProductAsDraft(true);
                },
                onDiscard: () => { if (typeof discardProductDraft === 'function') discardProductDraft(true); }
            }
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
        if (leavingAdmin && typeof isAnyCategoryCrudDirty === 'function' && isAnyCategoryCrudDirty()) {
            const ok = await adminGuardCategoryLeave('Save category changes before leaving Admin?', () => {});
            if (!ok) return false;
        }
        if (typeof navigateFn === 'function') navigateFn();
        return true;
    };

    window.adminScheduleCategoryDraftSave = function() {
        if (!adminCrudDraftsEnabled()) return;
        clearTimeout(categoryDraftTimer);
        categoryDraftTimer = setTimeout(() => {
            if (typeof persistCategoryDraft === 'function') persistCategoryDraft();
        }, 800);
    };

    window.adminScheduleProductDraftSave = function() {
        if (!adminCrudDraftsEnabled()) return;
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
        adminDraftMigrateLegacy();
        renderAdminDraftRecoveryPanel();
        updateSuperadminDraftStorageInfo();
    });
})();
