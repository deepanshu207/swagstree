// ==========================================
// SHIPPING OPTIMIZER — Extension Firebase (isolated)
// Project: extension-e6e32 (NOT swagstree-web)
// Swagstree storefront continues using global db/auth in app.js
// ==========================================

(function() {
    const SO_FB_APP_NAME = 'shippingOptimizer';
    const SO_SUPERADMIN_EMAIL = 'superadmin@swagstree.com';

    const SO_FIREBASE_CONFIG = {
        apiKey: 'AIzaSyDJd0Ufed0zwCHYmakz-WcncU_NSWxkJ1U',
        authDomain: 'extension-e6e32.firebaseapp.com',
        projectId: 'extension-e6e32',
        storageBucket: 'extension-e6e32.firebasestorage.app',
        messagingSenderId: '860976240598',
        appId: '1:860976240598:web:e5d903d52db5b71e48b677',
        measurementId: 'G-WCTXFCDXLT'
    };

    function soInitExtensionApp() {
        if (typeof firebase === 'undefined' || !firebase.initializeApp) return null;
        try {
            return firebase.app(SO_FB_APP_NAME);
        } catch (_) {
            return firebase.initializeApp(SO_FIREBASE_CONFIG, SO_FB_APP_NAME);
        }
    }

    window.soGetExtensionApp = function() {
        return soInitExtensionApp();
    };

    window.soGetExtensionDb = function() {
        const app = soInitExtensionApp();
        return app ? firebase.firestore(app) : null;
    };

    window.soGetExtensionAuth = function() {
        const app = soInitExtensionApp();
        return app ? firebase.auth(app) : null;
    };

    window.soExtensionProjectId = function() {
        return SO_FIREBASE_CONFIG.projectId;
    };

    window.soIsExtensionFirebaseAuthed = function() {
        const soAuth = window.soGetExtensionAuth();
        return !!(soAuth && soAuth.currentUser
            && String(soAuth.currentUser.email || '').toLowerCase() === SO_SUPERADMIN_EMAIL);
    };

    function soSafeLoadShippingOptimizerAdmin() {
        if (typeof loadShippingOptimizerAdmin !== 'function') return;
        const panel = document.getElementById('shipping-optimizer-accordion-content');
        if (!panel || panel.style.display === 'none') return;
        Promise.resolve(loadShippingOptimizerAdmin()).catch((e) => {
            console.warn('Shipping Optimizer admin load:', e && e.message ? e.message : e);
        });
    }

    async function soFinishExtensionAuthSuccess(silent) {
        window.renderSoExtensionAuthBanner();
        if (!silent && typeof showToast === 'function') {
            showToast('Extension Firebase connected (same superadmin session).');
        }
        soSafeLoadShippingOptimizerAdmin();
    }

    /** Auto sign-in to extension-e6e32 with same email/password as Swagstree login */
    window.soSyncExtensionAuthWithCredentials = async function(email, password, silent) {
        const soAuth = window.soGetExtensionAuth();
        if (!soAuth || !email || !password) return false;
        const normalized = String(email).trim().toLowerCase();
        if (normalized !== SO_SUPERADMIN_EMAIL) return false;
        if (window.soIsExtensionFirebaseAuthed()) return true;
        try {
            await soAuth.signInWithEmailAndPassword(normalized, password);
            if (!window.soIsExtensionFirebaseAuthed()) {
                await soAuth.signOut();
                return false;
            }
            await soFinishExtensionAuthSuccess(silent);
            return true;
        } catch (e) {
            console.warn('Extension Firebase auto sign-in:', e.code || e.message);
            return false;
        }
    };

    /** Auto sign-in after Google login on Swagstree */
    window.soSyncExtensionAuthWithGoogleResult = async function(result, silent) {
        const soAuth = window.soGetExtensionAuth();
        if (!soAuth || !result) return false;
        const email = String(result.user?.email || '').toLowerCase();
        if (email !== SO_SUPERADMIN_EMAIL) return false;
        if (window.soIsExtensionFirebaseAuthed()) return true;
        try {
            const credential = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
            if (credential) {
                await soAuth.signInWithCredential(credential);
            } else {
                const provider = new firebase.auth.GoogleAuthProvider();
                provider.setCustomParameters({ login_hint: SO_SUPERADMIN_EMAIL });
                const extResult = await soAuth.signInWithPopup(provider);
                if (String(extResult.user?.email || '').toLowerCase() !== SO_SUPERADMIN_EMAIL) {
                    await soAuth.signOut();
                    return false;
                }
            }
            if (!window.soIsExtensionFirebaseAuthed()) return false;
            await soFinishExtensionAuthSuccess(silent);
            return true;
        } catch (e) {
            console.warn('Extension Firebase Google sync:', e.code || e.message);
            return false;
        }
    };

    window.soRefreshExtensionAuthFromSession = function() {
        window.renderSoExtensionAuthBanner();
    };

    window.renderSoExtensionAuthBanner = function() {
        const banner = document.getElementById('so-extension-auth-banner');
        if (!banner) return;
        const ready = window.soIsExtensionFirebaseAuthed();
        const project = SO_FIREBASE_CONFIG.projectId;
        if (ready) {
            banner.className = 'so-ext-auth-banner so-ext-auth-banner--ok';
            banner.innerHTML = `<span><i class="fa fa-circle-check"></i> Extension Firebase connected · <code>${project}</code> · ${SO_SUPERADMIN_EMAIL}</span>`;
            banner.hidden = false;
            return;
        }
        banner.className = 'so-ext-auth-banner so-ext-auth-banner--warn';
        banner.innerHTML = `
            <div class="so-ext-auth-banner-text">
                <strong>Extension Firebase — one-time connect</strong>
                <span>Use the <strong>same</strong> <code>${SO_SUPERADMIN_EMAIL}</code> password as Swagstree. Sign in once — it stays connected on this device.</span>
            </div>
            <div class="so-ext-auth-banner-actions">
                <button type="button" class="so-btn-sm so-btn-touch" onclick="toggleSoExtensionEmailAuth()">Use same Swagstree password</button>
                <button type="button" class="so-btn-sm so-btn-touch" onclick="signInSoExtensionFirebaseGoogle()">Sign in with Google</button>
            </div>
            <div id="so-extension-email-auth" class="so-ext-email-auth" hidden>
                <input id="so-ext-auth-email" type="email" value="${SO_SUPERADMIN_EMAIL}" readonly>
                <input id="so-ext-auth-password" type="password" placeholder="Same password as Swagstree login" autocomplete="current-password">
                <button type="button" class="so-btn-sm so-btn-touch" onclick="signInSoExtensionFirebaseEmail()">Connect</button>
            </div>`;
        banner.hidden = false;
    };

    window.toggleSoExtensionEmailAuth = function() {
        const el = document.getElementById('so-extension-email-auth');
        if (el) el.hidden = !el.hidden;
    };

    window.signInSoExtensionFirebaseGoogle = async function() {
        const soAuth = window.soGetExtensionAuth();
        if (!soAuth) {
            if (typeof showToast === 'function') showToast('Extension Firebase SDK not ready.');
            return;
        }
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            provider.setCustomParameters({ login_hint: SO_SUPERADMIN_EMAIL });
            const result = await soAuth.signInWithPopup(provider);
            const email = String(result.user?.email || '').toLowerCase();
            if (email !== SO_SUPERADMIN_EMAIL) {
                await soAuth.signOut();
                if (typeof showToast === 'function') showToast('Use superadmin@swagstree.com on extension-e6e32.');
                return;
            }
            window.renderSoExtensionAuthBanner();
            if (typeof showToast === 'function') showToast('Extension Firebase connected.');
            soSafeLoadShippingOptimizerAdmin();
        } catch (e) {
            if (typeof showToast === 'function') showToast('Extension sign-in failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.signInSoExtensionFirebaseEmail = async function() {
        const soAuth = window.soGetExtensionAuth();
        if (!soAuth) {
            if (typeof showToast === 'function') showToast('Extension Firebase SDK not ready.');
            return;
        }
        const email = String(document.getElementById('so-ext-auth-email')?.value || '').trim().toLowerCase();
        const password = String(document.getElementById('so-ext-auth-password')?.value || '');
        if (!email || !password) {
            if (typeof showToast === 'function') showToast('Enter extension Firebase email and password.');
            return;
        }
        try {
            await soAuth.signInWithEmailAndPassword(email, password);
            if (!window.soIsExtensionFirebaseAuthed()) {
                await soAuth.signOut();
                if (typeof showToast === 'function') showToast('Only superadmin@swagstree.com can manage extension data.');
                return;
            }
            await soFinishExtensionAuthSuccess(false);
        } catch (e) {
            if (typeof showToast === 'function') showToast('Extension sign-in failed: ' + (e.message || 'Unknown error'));
        }
    };

    window.soEnsureExtensionFirebaseReady = async function() {
        if (!window.soGetExtensionDb()) {
            return { ok: false, reason: 'Extension Firebase SDK not loaded.' };
        }
        window.renderSoExtensionAuthBanner();
        if (window.soIsExtensionFirebaseAuthed()) return { ok: true };
        return {
            ok: true,
            readOnly: true,
            reason: 'Signed in to Swagstree only — you can view extension data. Sign in to Extension Firebase to save.'
        };
    };

    // Restore extension auth session on page load (reads work without auth; writes need this)
    document.addEventListener('DOMContentLoaded', function() {
        const soAuth = window.soGetExtensionAuth();
        if (soAuth) {
            soAuth.onAuthStateChanged(function() {
                if (document.getElementById('so-extension-auth-banner')) {
                    window.renderSoExtensionAuthBanner();
                }
            });
        }
    });
})();
