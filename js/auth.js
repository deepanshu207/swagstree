// ==========================================
// SWAG STREE | AUTHENTICATION SYSTEM
// ==========================================

const ADMIN_EMAIL = "admin@swagstree.com";
const SUPER_ADMIN_EMAIL = "superadmin@swagstree.com";

// ── Admin and Superadmin Role UI Sync ───────────────────────────────────────
function updateAdminPrivilegesUI() {
    const navAdm = document.getElementById('nav-adm');
    if (navAdm) navAdm.style.display = isAdmin ? 'block' : 'none';
    
    const admDesktop = document.getElementById('nav-adm-desktop');
    if (admDesktop) admDesktop.style.display = isAdmin ? 'block' : 'none';
    
    const adminCust = document.getElementById('admin-customers-section');
    if (adminCust) adminCust.style.display = isAdmin ? 'block' : 'none';

    const navSuper = document.getElementById('nav-super');
    if (navSuper) navSuper.style.display = isSuperAdmin ? 'block' : 'none';
    
    const navSuperDesktop = document.getElementById('nav-super-desktop');
    if (navSuperDesktop) navSuperDesktop.style.display = isSuperAdmin ? 'block' : 'none';

    // Redirect to home if user is in admin view but no longer admin
    const adminView = document.getElementById('admin-view');
    if (adminView && adminView.classList.contains('active') && !isAdmin) {
        if (typeof nav === 'function') nav('home');
    }
    
    // Redirect to home if user is in super view but no longer superadmin
    const superView = document.getElementById('super-view');
    if (superView && superView.classList.contains('active') && !isSuperAdmin) {
        if (typeof nav === 'function') nav('home');
    }

    if (isSuperAdmin && typeof loadAssignedAdmins === 'function') {
        loadAssignedAdmins();
    }

    // Update WhatsApp icon visibility when user role changes
    if (typeof updateWhatsAppVisibility === 'function') updateWhatsAppVisibility();

    // Show/hide Brevo quota card based on admin privileges
    const brevoCard = document.getElementById('admin-brevo-quota-card');
    if (brevoCard) {
        brevoCard.style.display = (isAdmin || isSuperAdmin) ? 'flex' : 'none';
    }
}

// Global real-time listener for admins
db.collection("admins").onSnapshot(snap => {
    assignedAdmins = [];
    snap.forEach(doc => {
        assignedAdmins.push({
            email: doc.id.toLowerCase(),
            status: doc.data().status || "active"
        });
    });

    if (currentUser) {
        const emailLower = currentUser.email ? currentUser.email.toLowerCase() : "";
        isSuperAdmin = (emailLower === SUPER_ADMIN_EMAIL);
        
        const isAdminDeactivated = assignedAdmins.some(a => a.email === ADMIN_EMAIL.toLowerCase() && a.status === "deactivated");
        const isCustomAdminActive = assignedAdmins.some(a => a.email === emailLower && a.status === "active");

        isAdmin = (emailLower === SUPER_ADMIN_EMAIL || (emailLower === ADMIN_EMAIL && !isAdminDeactivated) || isCustomAdminActive);
        
        updateAdminPrivilegesUI();
        
        if (isAdmin && typeof renderAdmin === 'function') {
            renderAdmin();
            if (typeof loadCodSettings === 'function') loadCodSettings();
            if (typeof loadMaxQtySettings === 'function') loadMaxQtySettings();
            if (typeof loadPromoSettings === 'function') loadPromoSettings();
            if (typeof loadPaginationSettings === 'function') loadPaginationSettings();
            if (typeof loadTelegramSettings === 'function') loadTelegramSettings();
            if (typeof loadEmailSettings === 'function') loadEmailSettings();
            if (typeof loadFeedbackPlacementSettings === 'function') loadFeedbackPlacementSettings();
            if (typeof loadAdminFooterSettings === 'function') loadAdminFooterSettings();
            if (isSuperAdmin && typeof loadSessionSettings === 'function') loadSessionSettings();
            if (isSuperAdmin && typeof loadBackupSettings === 'function') loadBackupSettings();
        }
    }
}, error => {
    console.error("Error listening to admins:", error);
});

// ── Auth State Listener ─────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
    currentUser = user;
    
    if (user) {
        const emailLower = user.email ? user.email.toLowerCase() : "";
        
        // Auto-align any guest orders matching this email to the registered UID
        if (emailLower) {
            alignGuestOrders(emailLower, user.uid);
        }
        
        // Start the session inactivity tracker and load current duration
        if (typeof startSessionTracker === 'function') {
            startSessionTracker();
            loadSessionSettings();
        }

        // Load and merge user cart from Firestore
        db.collection("users").doc(user.uid).get().then(doc => {
            if (doc.exists && doc.data().cart) {
                const savedCart = doc.data().cart;
                if (Array.isArray(savedCart)) {
                    if (typeof mergeCarts === 'function') {
                        const merged = mergeCarts(cart, savedCart);
                        cart.length = 0;
                        merged.forEach(item => cart.push(item));
                    }
                    if (typeof saveCartToStorage === 'function') {
                        saveCartToStorage();
                    }
                }
            } else {
                if (typeof syncCartToFirestore === 'function') {
                    syncCartToFirestore();
                }
            }
            if (typeof updateCartUI === 'function') updateCartUI();
        }).catch(err => {
            console.error("Error loading/merging user cart:", err);
        });

        
        isSuperAdmin = (emailLower === SUPER_ADMIN_EMAIL);
        
        const isAdminDeactivated = assignedAdmins.some(a => a.email === ADMIN_EMAIL.toLowerCase() && a.status === "deactivated");
        const isCustomAdminActive = assignedAdmins.some(a => a.email === emailLower && a.status === "active");

        isAdmin = (emailLower === SUPER_ADMIN_EMAIL || (emailLower === ADMIN_EMAIL && !isAdminDeactivated) || isCustomAdminActive);

        // Sync email to Firestore and listen for real-time deactivation
        db.collection("users").doc(user.uid).onSnapshot(doc => {
            const data = doc.exists ? doc.data() : {};
            if (data.status === "deactivated") {
                auth.signOut();
                showToast("❌ Your account has been deactivated.");
                return;
            }

            wishlist = data.wishlist || [];

            // Pre-fill profile fields with saved data
            const savedName = data.displayName || user.displayName || '';
            const savedPhone = data.phone || user.phoneNumber || '';

            const profName = document.getElementById('prof-name');
            const profPhone = document.getElementById('prof-phone');
            const profEmailReadOnly = document.getElementById('prof-email-readonly-text');
            if (profName) profName.value = savedName;
            if (profPhone) profPhone.value = savedPhone;
            if (profEmailReadOnly) profEmailReadOnly.textContent = user.email || '';

            renderStore();
        });

        if (user.email) {
            db.collection("users").doc(user.uid).set({
                email: user.email
            }, { merge: true }).catch(e => console.error("Error syncing email:", e));
        }

        // Toggle visibility of email/password controls based on provider type
        const isPasswordUser = user.providerData && user.providerData.some(p => p.providerId === 'password');
        const emailSec = document.getElementById('profile-email-section');
        const passSec = document.getElementById('profile-pass-section');
        if (emailSec) emailSec.style.display = isPasswordUser ? 'block' : 'none';
        if (passSec) passSec.style.display = isPasswordUser ? 'block' : 'none';

        // Render admin list if admin
        if (isAdmin && typeof renderAdmin === 'function') {
            renderAdmin();
            if (typeof loadCodSettings === 'function') loadCodSettings();
            if (typeof loadMaxQtySettings === 'function') loadMaxQtySettings();
            if (typeof loadPromoSettings === 'function') loadPromoSettings();
            if (typeof loadPaginationSettings === 'function') loadPaginationSettings();
            if (typeof loadTelegramSettings === 'function') loadTelegramSettings();
            if (typeof loadEmailSettings === 'function') loadEmailSettings();
            if (typeof loadFeedbackPlacementSettings === 'function') loadFeedbackPlacementSettings();
            if (typeof loadAdminFooterSettings === 'function') loadAdminFooterSettings();
            if (isSuperAdmin && typeof loadSessionSettings === 'function') loadSessionSettings();
            if (isSuperAdmin && typeof loadBackupSettings === 'function') loadBackupSettings();
        }

        // Update profile header
        const displayName = user.displayName || '';
        const email = user.email || '';
        const initials = (displayName || email).charAt(0).toUpperCase();

        const avatar = document.getElementById('profile-avatar');
        if (avatar) avatar.innerText = initials;

        const nameDisplay = document.getElementById('profile-name-display');
        if (nameDisplay) nameDisplay.innerText = displayName || email || 'User';

        const emailDisplay = document.getElementById('profile-email-display');
        if (emailDisplay) emailDisplay.innerText = email;

        // Populate the read-only email field in Edit Profile form
        const profEmailReadonly = document.getElementById('prof-email-readonly-text');
        if (profEmailReadonly) profEmailReadonly.textContent = email;

        document.getElementById('auth-ui').style.display = 'none';
        document.getElementById('dash-ui').style.display = 'block';

        if (typeof loadOrders === "function") {
            displayedOrdersLimit = ordersPageLimitSetting;
            loadOrders();
        }
    } else {
        isSuperAdmin = false;
        isAdmin = false;
        isRegMode = false;
        const nameField = document.getElementById('reg-name-field');
        const phoneField = document.getElementById('reg-phone-field');
        const toggleText = document.getElementById('toggle-text');
        const btn = document.getElementById('au-btn');
        const forgotLink = document.getElementById('forgot-password-link');

        if (nameField) nameField.style.display = 'none';
        if (phoneField) phoneField.style.display = 'none';
        if (toggleText) toggleText.innerText = "New here? Register";
        if (btn) btn.innerText = "Login";
        if (forgotLink) forgotLink.style.display = 'block';

        document.getElementById('auth-ui').style.display = 'block';
        document.getElementById('dash-ui').style.display = 'none';
        wishlist = [];
        
        // Clear cart on logout/timeout
        cart.length = 0;
        if (typeof saveCartToStorage === 'function') {
            saveCartToStorage();
        }
        
        renderStore();
        
        // Stop the session inactivity tracker
        if (typeof stopSessionTracker === 'function') {
            stopSessionTracker();
        }
    }

    updateAdminPrivilegesUI();
    if (typeof loadData === "function") loadData();
});

// ── Toggle Login / Register Mode ────────────────────────────────────────────
function toggleAuthMode() {
    isRegMode = !isRegMode;
    const nameField = document.getElementById('reg-name-field');
    const phoneField = document.getElementById('reg-phone-field');
    const toggleText = document.getElementById('toggle-text');
    const btn = document.getElementById('au-btn');
    const forgotLink = document.getElementById('forgot-password-link');

    if (nameField) nameField.style.display = isRegMode ? 'block' : 'none';
    if (phoneField) phoneField.style.display = isRegMode ? 'block' : 'none';
    if (toggleText) toggleText.innerText = isRegMode ? "Already have an account? Login" : "New here? Register";
    if (btn) btn.innerText = isRegMode ? "Create Account" : "Login";
    if (forgotLink) forgotLink.style.display = isRegMode ? 'none' : 'block';
}

// ── Google Login ────────────────────────────────────────────────────────────
async function handleGoogleLogin() {
    const btn = document.querySelector('[onclick="handleGoogleLogin()"]');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        // Always try popup first — works on both desktop and modern mobile browsers.
        // Fall back to redirect only if the browser explicitly blocks popups.
        try {
            const result = await auth.signInWithPopup(provider);
            if (result && result.user) {
                showToast("✅ Google Login Successful!");
            }
        } catch (popupError) {
            // Popup was blocked or not supported — fall back to redirect
            if (
                popupError.code === 'auth/popup-blocked' ||
                popupError.code === 'auth/popup-closed-by-user' ||
                popupError.code === 'auth/cancelled-popup-request'
            ) {
                // Only show redirect fallback message for actual block, not user cancel
                if (popupError.code === 'auth/popup-blocked') {
                    showToast("Popup blocked. Redirecting to Google...");
                    await auth.signInWithRedirect(provider);
                } else {
                    // User closed popup — do nothing
                    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
                    return;
                }
            } else {
                throw popupError; // Re-throw other errors
            }
        }
    } catch (error) {
        console.error("Google Auth Error:", error);
        if (error.code === 'auth/operation-not-allowed') {
            showToast("Google Sign-in is not enabled. Contact admin.");
        } else if (error.code === 'auth/network-request-failed') {
            showToast("Network error. Check your connection.");
        } else if (error.code === 'auth/account-exists-with-different-credential') {
            showToast("This email is already registered with email & password. Please login using Email.");
        } else {
            showToast("Google Login Failed. Try again.");
        }
    } finally {
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
    }
}

// Handle redirect result (fallback for popup-blocked browsers)
auth.getRedirectResult().then(result => {
    if (result && result.user) {
        showToast("✅ Google Login Successful!");
    }
}).catch(error => {
    // Ignore the common 'no redirect pending' case — it fires on every page load
    if (error && error.code !== 'auth/no-auth-event' && error.message) {
        console.error("Redirect Auth Error:", error);
        // Only show toast for real errors, not the default no-pending-redirect
        if (error.code && error.code !== 'auth/no-current-user') {
            if (error.code === 'auth/account-exists-with-different-credential') {
                showToast("This email is already registered with email & password. Please login using Email.");
            } else {
                showToast("Google Login Failed. Try again.");
            }
        }
    }
});

// ── Email / Password Auth ───────────────────────────────────────────────────
async function handleMainAuth() {
    const id = document.getElementById('au-id').value.trim();
    const pass = document.getElementById('au-pass').value;
    const btn = document.getElementById('au-btn');

    if (!id) return showToast("Please enter your email.");
    if (!pass) return showToast("Please enter your password.");

    btn.disabled = true;
    btn.innerText = "Please wait...";

    try {
        if (isRegMode) {
            // REGISTER
            const nameVal = (document.getElementById('au-name') || {}).value || '';
            const phoneVal = (document.getElementById('au-phone') || {}).value || '';

            const cred = await auth.createUserWithEmailAndPassword(id, pass);

            // Save name to Firebase Auth profile
            if (nameVal) {
                await cred.user.updateProfile({ displayName: nameVal });
            }

            // Save to Firestore (name + optional phone)
            await db.collection("users").doc(cred.user.uid).set({
                displayName: nameVal,
                phone: phoneVal,
                email: id,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            showToast("✅ Account Created! Welcome!");
        } else {
            // LOGIN
            await auth.signInWithEmailAndPassword(id, pass);
            showToast("✅ Login Successful!");
        }
    } catch (e) {
        console.error("Auth Error:", e);
        const msgs = {
            'auth/email-already-in-use': "Email already in use. Try logging in.",
            'auth/wrong-password': "Incorrect password.",
            'auth/user-not-found': "No account found with this email.",
            'auth/invalid-email': "Please enter a valid email address.",
            'auth/weak-password': "Password should be at least 6 characters.",
            'auth/too-many-requests': "Too many attempts. Try again later.",
            'auth/invalid-credential': "Incorrect email or password.",
        };
        showToast(msgs[e.code] || "Authentication failed. Check your details.");
        btn.innerText = isRegMode ? "Create Account" : "Login";
    } finally {
        btn.disabled = false;
        if (!btn.innerText.includes("wait")) {
            btn.innerText = isRegMode ? "Create Account" : "Login";
        }
    }
}

// ── Forgot Password ─────────────────────────────────────────────────────────
async function forgotPassword() {
    const email = document.getElementById('au-id').value.trim();
    const btn = document.getElementById('au-btn');

    if (!email) return showToast("Please enter your email.");

    btn.disabled = true;
    btn.innerText = "Sending...";

    try {
        await auth.sendPasswordResetEmail(email);
        showToast("📧 Password reset email sent! Check your inbox.");
    } catch (e) {
        console.error("Forgot password error:", e);
        const msgs = {
            'auth/user-not-found': "No account found with this email.",
            'auth/invalid-email': "Please enter a valid email address.",
        };
        showToast(msgs[e.code] || "Failed to send reset email. Try again.");
    } finally {
        btn.disabled = false;
        btn.innerText = isRegMode ? "Create Account" : "Login";
    }
}

// ── Save Profile (Name & Phone) ─────────────────────────────────────────────
async function saveProfile() {
    if (!currentUser) return showToast("Please login first.");

    const nameVal = document.getElementById('prof-name').value.trim();
    const phoneVal = document.getElementById('prof-phone').value.trim();

    if (!nameVal) return showToast("Please enter your name.");

    const saveBtn = document.querySelector('[onclick="saveProfile()"]');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerText = "Saving..."; }

    try {
        // Update Firebase Auth display name
        await currentUser.updateProfile({ displayName: nameVal });

        // Save to Firestore
        await db.collection("users").doc(currentUser.uid).set({
            displayName: nameVal,
            phone: phoneVal
        }, { merge: true });

        // Update the header card live
        const nameDisplay = document.getElementById('profile-name-display');
        if (nameDisplay) nameDisplay.innerText = nameVal;
        const avatar = document.getElementById('profile-avatar');
        if (avatar) avatar.innerText = nameVal.charAt(0).toUpperCase();

        showToast("✅ Profile updated!");
    } catch (e) {
        console.error("Profile update error:", e);
        showToast("Failed to update profile. Try again.");
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<i class="fa fa-save"></i> &nbsp;Save Changes'; }
    }
}

// ── Change Email (with re-auth + verification) ──────────────────────────────
async function changeEmail() {
    if (!currentUser) return showToast("Please login first.");
    if (!currentUser.email) return showToast("Email change is only available for email/password accounts.");

    const newEmail = document.getElementById('prof-new-email').value.trim();
    const currPass = document.getElementById('prof-curr-pass').value;

    if (!newEmail) return showToast("Please enter the new email address.");
    if (!currPass) return showToast("Please enter your current password to confirm.");

    const changeBtn = document.querySelector('[onclick="changeEmail()"]');
    if (changeBtn) { changeBtn.disabled = true; changeBtn.innerText = "Processing..."; }

    try {
        // Step 1: Re-authenticate the user (required by Firebase before sensitive ops)
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currPass);
        await currentUser.reauthenticateWithCredential(credential);

        // Step 2: Send verification to NEW email and update
        await currentUser.verifyBeforeUpdateEmail(newEmail);

        // Clear the fields
        document.getElementById('prof-new-email').value = '';
        document.getElementById('prof-curr-pass').value = '';

        showToast("📧 Verification sent! Check your new email inbox to confirm the change.");
    } catch (e) {
        console.error("Email change error:", e);
        const msgs = {
            'auth/wrong-password': "Incorrect current password.",
            'auth/invalid-email': "The new email address is invalid.",
            'auth/email-already-in-use': "This email is already registered.",
            'auth/requires-recent-login': "Please log out and log back in before changing email.",
        };
        showToast(msgs[e.code] || "Failed to change email. Try again.");
    } finally {
        if (changeBtn) { changeBtn.disabled = false; changeBtn.innerHTML = '<i class="fa fa-paper-plane"></i> &nbsp;Send Verification & Change'; }
    }
}

// ── Change Password (with re-auth) ──────────────────────────────────────────
async function changePassword() {
    if (!currentUser) return showToast("Please login first.");
    if (!currentUser.email) return showToast("Password change is only available for email/password accounts.");

    const currPass = document.getElementById('prof-pass-current').value;
    const newPass = document.getElementById('prof-pass-new').value;
    const confirmPass = document.getElementById('prof-pass-confirm').value;

    if (!currPass) return showToast("Please enter your current password.");
    if (!newPass) return showToast("Please enter your new password.");
    if (!confirmPass) return showToast("Please confirm your new password.");
    if (newPass !== confirmPass) return showToast("New passwords do not match.");
    if (newPass.length < 6) return showToast("Password should be at least 6 characters.");

    const changeBtn = document.querySelector('[onclick="changePassword()"]');
    if (changeBtn) { changeBtn.disabled = true; changeBtn.innerText = "Updating..."; }

    try {
        // Step 1: Re-authenticate the user (required by Firebase before sensitive ops)
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, currPass);
        await currentUser.reauthenticateWithCredential(credential);

        // Step 2: Update password
        await currentUser.updatePassword(newPass);

        // Step 3: Update email in Firestore after successful password change (if needed)
        // This ensures email consistency in Firestore after password change
        await db.collection("users").doc(currentUser.uid).set({
            email: currentUser.email
        }, { merge: true });

        // Clear the fields
        document.getElementById('prof-pass-current').value = '';
        document.getElementById('prof-pass-new').value = '';
        document.getElementById('prof-pass-confirm').value = '';

        showToast("🔐 Password updated successfully!");
    } catch (e) {
        console.error("Password change error:", e);
        const msgs = {
            'auth/wrong-password': "Incorrect current password.",
            'auth/weak-password': "New password should be at least 6 characters.",
            'auth/requires-recent-login': "Please log out and log back in before changing password.",
        };
        showToast(msgs[e.code] || "Failed to change password. Try again.");
    } finally {
        if (changeBtn) { changeBtn.disabled = false; changeBtn.innerHTML = '<i class="fa fa-lock"></i> &nbsp;Change Password'; }
    }
}

async function loadAllCustomers() {
    if (!isAdmin) return;
    const container = document.getElementById('all-customers-list');
    if (!container) return;
    
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px; width:100%;">
            <div class="premium-loader"></div>
            <p style="color:#aaa; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin:0; font-weight:700;">Loading customers</p>
        </div>
    `;
    
    try {
        const snap = await db.collection("users").get();
        if (snap.empty) {
            container.innerHTML = `<p style="text-align:center; color:#555;">No customers found.</p>`;
            return;
        }
        
        let allUsers = [];
        snap.forEach(doc => allUsers.push(doc.data()));
        
        allUsers.sort((a, b) => {
            const tA = a.createdAt ? a.createdAt.toMillis() : 0;
            const tB = b.createdAt ? b.createdAt.toMillis() : 0;
            return tB - tA; // descending
        });
        
        let html = '';
        allUsers.forEach(data => {
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'Unknown';
            html += `
                <div style="background:#111; padding:15px; border-radius:8px; border:1px solid #333; margin-top:10px; display:flex; align-items:center; gap:15px;">
                    <div style="width:40px; height:40px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center; font-weight:bold; color:#FFD700;">
                        ${(data.displayName || data.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div style="flex:1;">
                        <div style="font-weight:bold; font-size:15px;">${data.displayName || 'Unnamed User'}</div>
                        <div style="color:#aaa; font-size:13px;">${data.email || 'No email'} ${data.phone ? '• ' + data.phone : ''}</div>
                        <div style="color:#666; font-size:11px; margin-top:4px;">Joined: ${date}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (e) {
        console.error("Error loading customers:", e);
        container.innerHTML = `<p style="text-align:center; color:#ff4444;">Failed to load customers.</p>`;
    }
}

// ── SUPERADMIN CAPABILITIES ──────────────────────────────────────────────────

// 1. Manage Admins
let adminsUnsubscribe = null;
function loadAssignedAdmins() {
    if (!isSuperAdmin) return;
    const container = document.getElementById('super-admin-list');
    if (!container) return;

    if (adminsUnsubscribe) {
        return;
    }

    adminsUnsubscribe = db.collection("admins").onSnapshot(snap => {
        let firebaseAdmins = {};
        snap.forEach(doc => {
            firebaseAdmins[doc.id.toLowerCase()] = doc.data();
        });

        let assignedList = [];
        
        // Add default admin
        const adminEmailLower = ADMIN_EMAIL.toLowerCase();
        const adminStatus = firebaseAdmins[adminEmailLower] ? (firebaseAdmins[adminEmailLower].status || "active") : "active";
        assignedList.push({
            email: adminEmailLower,
            isSystem: true,
            label: 'Admin (System)',
            status: adminStatus
        });
        
        // Add default superadmin
        assignedList.push({
            email: SUPER_ADMIN_EMAIL.toLowerCase(),
            isSystem: true,
            label: 'Superadmin (System)',
            status: 'active'
        });

        // Add custom admins
        Object.keys(firebaseAdmins).forEach(email => {
            if (email !== ADMIN_EMAIL.toLowerCase() && email !== SUPER_ADMIN_EMAIL.toLowerCase()) {
                assignedList.push({
                    email: email,
                    isSystem: false,
                    label: 'Admin',
                    status: firebaseAdmins[email].status || 'active'
                });
            }
        });

        let html = '';
        assignedList.forEach(item => {
            const email = item.email;
            const isSuper = (email === SUPER_ADMIN_EMAIL.toLowerCase());
            const isAdminSystem = (email === ADMIN_EMAIL.toLowerCase());
            
            const isDeactivated = item.status === "deactivated";
            const statusText = isDeactivated ? "Deactivated" : "Active";
            const statusColor = isDeactivated ? "var(--red)" : "#2ecc71";
            const statusBg = isDeactivated ? "rgba(255, 71, 87, 0.1)" : "rgba(46, 204, 113, 0.1)";
            const toggleBtnLabel = isDeactivated ? "Activate" : "Deactivate";
            const toggleBtnColor = isDeactivated ? "#2ecc71" : "var(--red)";
            
            const statusBadgeHtml = `<span style="font-size:9px; font-weight:700; color:${statusColor}; background:${statusBg}; border:1px solid ${statusColor}33; padding:2px 6px; border-radius:4px; margin-left:8px; text-transform:uppercase; letter-spacing:0.5px;">${statusText}</span>`;
            
            const tagHtml = isSuper ? `<span style="font-size:9px; font-weight:700; color:var(--gold); background:rgba(255,215,0,0.1); border:1px solid rgba(255,215,0,0.3); padding:2px 6px; border-radius:4px; margin-left:8px; text-transform:uppercase; letter-spacing:0.5px;">${item.label}</span>` :
                            isAdminSystem ? `<span style="font-size:9px; font-weight:700; color:var(--gold); background:rgba(255,215,0,0.1); border:1px solid rgba(255,215,0,0.3); padding:2px 6px; border-radius:4px; margin-left:8px; text-transform:uppercase; letter-spacing:0.5px;">${item.label}</span>${statusBadgeHtml}` :
                            statusBadgeHtml;
            
            let actionHtml = '';
            if (isSuper) {
                actionHtml = `<span style="font-size:11px; color:#444; font-weight:700; text-transform:uppercase;">System Superadmin</span>`;
            } else {
                const toggleAction = `toggleAdminStatus('${email}', '${item.status}')`;
                const toggleBtn = `<button class="btn-gold" style="width:auto; padding:6px 10px; font-size:11px; margin:0; background:${toggleBtnColor}; color:#fff;" onclick="${toggleAction}"><i class="fa fa-power-off"></i> ${toggleBtnLabel}</button>`;
                const deleteBtn = isAdminSystem ? '' : `<i class="fa fa-trash" style="color:var(--red); cursor:pointer; font-size:14px; margin-left:10px;" onclick="deleteAdminRole('${email}')" title="Remove Admin"></i>`;
                
                actionHtml = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${toggleBtn}
                        ${deleteBtn}
                    </div>
                `;
            }
            
            html += `
                <div style="background:#1a1a1a; padding:10px 15px; border-radius:10px; display:flex; align-items:center; justify-content:space-between; border:1px solid #222; flex-wrap:wrap; gap:10px;">
                    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                        <i class="fa fa-user-cog" style="color:var(--gold); font-size:13px;"></i>
                        <span style="font-size:13px; font-weight:600; color:#eee;">${email}</span>
                        ${tagHtml}
                    </div>
                    ${actionHtml}
                </div>
            `;
        });
        container.innerHTML = html;
    }, error => {
        console.error("Error loading assigned admins:", error);
    });
}

async function addAdminRole() {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    
    const emailInput = document.getElementById('super-admin-email');
    if (!emailInput) return;
    
    const email = emailInput.value.trim().toLowerCase();
    if (!email) return showToast("Please enter an email address.");
    if (!email.includes('@') || email.length < 5) return showToast("Invalid email address.");

    if (email === ADMIN_EMAIL.toLowerCase() || email === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return showToast("This email is already a system admin/superadmin.");
    }

    try {
        await db.collection("admins").doc(email).set({
            status: "active",
            assignedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        emailInput.value = '';
        showToast("✅ Admin added successfully!");
    } catch (e) {
        console.error("Error adding admin:", e);
        showToast("Failed to add admin.");
    }
}

async function deleteAdminRole(email) {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    if (!confirm(`Are you sure you want to remove admin privileges for ${email}?`)) return;

    try {
        await db.collection("admins").doc(email.toLowerCase()).delete();
        showToast("🗑️ Admin role removed.");
    } catch (e) {
        console.error("Error deleting admin:", e);
        showToast("Failed to delete admin.");
    }
}

async function toggleAdminStatus(email, currentStatus) {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    
    const newStatus = currentStatus === "deactivated" ? "active" : "deactivated";
    const msg = newStatus === "deactivated" ? `deactivate admin privileges for ${email}?` : `reactivate admin privileges for ${email}?`;
    if (!confirm(`Are you sure you want to ${msg}`)) return;

    try {
        await db.collection("admins").doc(email.toLowerCase()).set({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        showToast(`✅ Admin status updated to ${newStatus}.`);
    } catch (e) {
        console.error("Error toggling admin status:", e);
        showToast("Failed to update admin status.");
    }
}

// 2. Manage Customers
let superCustomersCache = [];
let displayedSuperCustomersLimit = 20;

async function loadSuperCustomers() {
    if (!isSuperAdmin) return;
    const container = document.getElementById('super-customer-list');
    if (!container) return;

    displayedSuperCustomersLimit = 20;
    container.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 0; gap:12px; width:100%;">
            <div class="premium-loader"></div>
            <p style="color:#aaa; font-size:11px; letter-spacing:2px; text-transform:uppercase; margin:0; font-weight:700;">Syncing customer profiles</p>
        </div>
    `;

    try {
        const snap = await db.collection("users").get();
        if (snap.empty) {
            container.innerHTML = `<p style="text-align:center; color:#555; font-size:12px;">No customers found.</p>`;
            superCustomersCache = [];
            return;
        }

        superCustomersCache = [];
        snap.forEach(doc => {
            superCustomersCache.push({
                uid: doc.id,
                ...doc.data()
            });
        });

        superCustomersCache.sort((a, b) => {
            const nameA = (a.displayName || a.email || '').toLowerCase();
            const nameB = (b.displayName || b.email || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        renderSuperCustomersList(superCustomersCache);
    } catch (e) {
        console.error("Error loading super customers:", e);
        container.innerHTML = `<p style="text-align:center; color:var(--red); font-size:12px;">Failed to load customers.</p>`;
    }
}

function renderSuperCustomersList(list) {
    const container = document.getElementById('super-customer-list');
    if (!container) return;

    const lmContainer = document.getElementById('super-customer-load-more-container');

    if (list.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:#555; font-size:12px; padding:20px 0;">No matching customers found.</p>`;
        if (lmContainer) lmContainer.innerHTML = '';
        return;
    }

    let itemsToRender = list;
    if (list.length > displayedSuperCustomersLimit) {
        itemsToRender = list.slice(0, displayedSuperCustomersLimit);
        if (lmContainer) {
            lmContainer.innerHTML = `<button class="btn-gold" style="width:auto; padding:8px 16px; font-size:11px; margin-bottom:15px;" onclick="loadMoreSuperCustomers()"><i class="fa fa-chevron-down"></i> Load More</button>`;
        }
    } else {
        if (lmContainer) lmContainer.innerHTML = '';
    }

    let html = '';
    itemsToRender.forEach(c => {
        const isDeactivated = c.status === "deactivated";
        const statusText = isDeactivated ? "Deactivated" : "Active";
        const statusColor = isDeactivated ? "var(--red)" : "#2ecc71";
        const statusBg = isDeactivated ? "rgba(255, 71, 87, 0.1)" : "rgba(46, 204, 113, 0.1)";
        const toggleBtnLabel = isDeactivated ? "Activate" : "Deactivate";
        const toggleBtnColor = isDeactivated ? "#2ecc71" : "var(--red)";
        
        const emailLower = (c.email || '').toLowerCase();
        const isSelfOrSystem = emailLower === SUPER_ADMIN_EMAIL.toLowerCase() || emailLower === ADMIN_EMAIL.toLowerCase();

        const actionButtons = isSelfOrSystem ? `
            <span style="font-size:11px; color:#444; font-weight:700; text-transform:uppercase;">System Account</span>
        ` : `
            <button class="btn-gold" style="width:auto; padding:6px 10px; font-size:11px; margin:0;" onclick="openSuperEditCust('${c.uid}', '${(c.displayName || '').replace(/'/g, "\\'")}', '${(c.email || '').replace(/'/g, "\\'")}', '${c.phone || ''}')"><i class="fa fa-edit"></i> Edit</button>
            <button class="btn-gold" style="width:auto; padding:6px 10px; font-size:11px; margin:0; background:${toggleBtnColor}; color:#fff;" onclick="toggleCustomerStatus('${c.uid}', '${c.status || 'active'}')"><i class="fa fa-power-off"></i> ${toggleBtnLabel}</button>
            <button class="btn-gold" style="width:auto; padding:6px 10px; font-size:11px; margin:0; background:#222; border:1px solid #444; color:#fff;" onclick="clearCustomerOrderHistory('${c.uid}', '${emailLower}')"><i class="fa fa-history"></i> Purge History</button>
        `;

        html += `
            <div style="background:#181818; padding:15px; border-radius:12px; border:1px solid #282828; display:flex; flex-direction:column; gap:12px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:35px; height:35px; border-radius:50%; background:#333; display:flex; align-items:center; justify-content:center; font-weight:bold; color:var(--gold); font-size:14px;">
                            ${(c.displayName || c.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:700; font-size:13px; color:#eee;">${c.displayName || 'Unnamed User'}</div>
                            <div style="color:#888; font-size:11px; margin-top:2px;">${c.email || 'No email'} ${c.phone ? ' • ' + c.phone : ''}</div>
                        </div>
                    </div>
                    <span style="font-size:10px; font-weight:700; padding:4px 8px; border-radius:6px; color:${statusColor}; background:${statusBg}; border:1px solid ${statusColor}33; text-transform:uppercase; letter-spacing:0.5px;">${statusText}</span>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-top:5px; padding-top:8px; border-top:1px solid #222;">
                    ${actionButtons}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function filterSuperCustomers() {
    const q = document.getElementById('super-customer-search').value.toLowerCase().trim();
    if (!q) {
        renderSuperCustomersList(superCustomersCache);
        return;
    }

    const filtered = superCustomersCache.filter(c => {
        const name = (c.displayName || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        const phone = (c.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
    });
    renderSuperCustomersList(filtered);
}

function resetSuperCustomerLimitAndFilter() {
    displayedSuperCustomersLimit = 20;
    filterSuperCustomers();
}

function loadMoreSuperCustomers() {
    displayedSuperCustomersLimit += 20;
    filterSuperCustomers();
}

async function toggleCustomerStatus(uid, currentStatus) {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    
    const newStatus = currentStatus === "deactivated" ? "active" : "deactivated";
    const msg = newStatus === "deactivated" ? "deactivate this customer's account and log them out?" : "reactivate this customer's account?";
    if (!confirm(`Are you sure you want to ${msg}`)) return;

    try {
        await db.collection("users").doc(uid).set({
            status: newStatus
        }, { merge: true });
        
        const cached = superCustomersCache.find(x => x.uid === uid);
        if (cached) cached.status = newStatus;
        
        filterSuperCustomers();
        showToast(`✅ Customer status updated to ${newStatus}.`);
    } catch (e) {
        console.error("Error toggling customer status:", e);
        showToast("Failed to update status.");
    }
}

function openSuperEditCust(uid, name, email, phone) {
    const modal = document.getElementById('super-edit-cust-modal');
    if (!modal) return;

    document.getElementById('sec-cust-uid').value = uid;
    document.getElementById('sec-cust-name').value = name;
    document.getElementById('sec-cust-email').value = email;
    document.getElementById('sec-cust-phone').value = phone;

    modal.style.display = 'flex';
}

async function saveCustomerDetails() {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");

    const uid = document.getElementById('sec-cust-uid').value;
    const name = document.getElementById('sec-cust-name').value.trim();
    const email = document.getElementById('sec-cust-email').value.trim();
    const phone = document.getElementById('sec-cust-phone').value.trim();

    if (!name) return showToast("Name is required.");

    const btn = document.getElementById('sec-save-btn');
    btn.disabled = true;
    btn.innerText = "Saving...";

    try {
        await db.collection("users").doc(uid).set({
            displayName: name,
            email: email,
            phone: phone
        }, { merge: true });

        const cached = superCustomersCache.find(x => x.uid === uid);
        if (cached) {
            cached.displayName = name;
            cached.email = email;
            cached.phone = phone;
        }

        filterSuperCustomers();
        closeModal('super-edit-cust-modal');
        showToast("✅ Profile details updated successfully!");
    } catch (e) {
        console.error("Error updating customer details:", e);
        showToast("Failed to update profile.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Save Changes";
    }
}

async function clearCustomerOrderHistory(uid, email) {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    if (!confirm(`Are you sure you want to PERMANENTLY erase all order history for customer (${email || uid})?\nThis action cannot be undone.`)) return;

    try {
        const snap1 = await db.collection("orders").where("uid", "==", uid).get();
        
        let batch = db.batch();
        let count = 0;
        snap1.forEach(doc => {
            batch.delete(doc.ref);
            count++;
        });

        if (count > 0) {
            await batch.commit();
        }

        showToast(`🗑️ Erased ${count} orders for this customer.`);
    } catch (e) {
        console.error("Error clearing customer order history:", e);
        showToast("Failed to erase order history.");
    }
}

// 3. Bulk & Destructive resets
async function batchDeleteCollection(collectionName) {
    const snap = await db.collection(collectionName).get();
    if (snap.empty) return 0;
    
    let docs = snap.docs;
    let deletedCount = 0;
    
    while(docs.length > 0) {
        const chunk = docs.splice(0, 400);
        const batch = db.batch();
        chunk.forEach(doc => {
            batch.delete(doc.ref);
            deletedCount++;
        });
        await batch.commit();
    }
    return deletedCount;
}

async function deleteAllProductsPrompt() {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    
    if (!confirm("⚠️ DANGER: You are about to delete ALL products in the catalog.\nThis will wipe all variants and inventory. Continue?")) return;
    const confirmText = prompt("To verify, please type 'DELETE ALL PRODUCTS' in the box below:");
    if (confirmText !== "DELETE ALL PRODUCTS") {
        return showToast("Verification failed. Deletion aborted.");
    }

    try {
        showToast("Processing bulk deletion...");
        const count = await batchDeleteCollection("products");
        showToast(`🗑️ Erased ${count} products.`);
        if (typeof applySortAndFilter === 'function') applySortAndFilter();
    } catch (e) {
        console.error("Error deleting products:", e);
        showToast("Failed to delete products.");
    }
}

async function deleteAllOrdersPrompt() {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    
    if (!confirm("⚠️ DANGER: You are about to delete ALL orders in the database.\nThis will wipe out all customer order logs. Continue?")) return;
    const confirmText = prompt("To verify, please type 'DELETE ALL ORDERS' in the box below:");
    if (confirmText !== "DELETE ALL ORDERS") {
        return showToast("Verification failed. Deletion aborted.");
    }

    try {
        showToast("Processing bulk deletion...");
        const count = await batchDeleteCollection("orders");
        showToast(`🗑️ Erased ${count} orders.`);
    } catch (e) {
        console.error("Error deleting orders:", e);
        showToast("Failed to delete orders.");
    }
}

async function cleanEverythingPrompt() {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    
    if (!confirm("🚨 WARNING: You are initiating a complete factory reset.\nThis will erase ALL products, orders, promos, settings, and assigned admin roles. Continue?")) return;
    if (!confirm("Are you absolutely sure? Everything will be wiped out completely.")) return;
    const confirmText = prompt("To confirm the FACTORY RESET, type 'RESET EVERYTHING':");
    if (confirmText !== "RESET EVERYTHING") {
        return showToast("Verification failed. Reset aborted.");
    }

    try {
        showToast("Performing factory reset...");
        
        const productsCount = await batchDeleteCollection("products");
        const ordersCount = await batchDeleteCollection("orders");
        const adminsCount = await batchDeleteCollection("admins");

        // Clear backup logs
        const backupSnapshot = await db.collection("mail").where("to", "==", "backup@swagstree.com").get();
        const backupBatch = db.batch();
        backupSnapshot.forEach(doc => {
            backupBatch.delete(doc.ref);
        });
        await backupBatch.commit();
        await db.collection("settings").doc("backup").delete();

        await db.collection("settings").doc("cod").delete();
        await db.collection("settings").doc("cart").delete();
        await db.collection("settings").doc("promos").delete();

        showToast(`✅ Factory Reset Complete. Erased: ${productsCount} products, ${ordersCount} orders, and ${adminsCount} admins.`);
        if (typeof applySortAndFilter === 'function') applySortAndFilter();
    } catch (e) {
        console.error("Error in factory reset:", e);
        showToast("Reset failed.");
    }
}

window.deleteFirebaseBackupsPrompt = async function() {
    if (!isSuperAdmin) return showToast("Only superadmin can perform this action.");
    if (!confirm("🚨 WARNING: This will permanently delete all backup email records for backup@swagstree.com and reset your backup timestamp. Continue?")) return;
    
    try {
        showToast("Deleting backup email records...");
        const snapshot = await db.collection("mail").where("to", "==", "backup@swagstree.com").get();
        if (snapshot.empty) {
            showToast("No backup records found.");
            return;
        }
        
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        
        await db.collection("settings").doc("backup").delete();
        showToast(`✅ Deleted ${snapshot.size} backup records.`);
        
        const statusEl = document.getElementById('admin-backup-status-text');
        if (statusEl) statusEl.innerHTML = "Last Auto-Backup: Never";
        
    } catch (e) {
        console.error("Error deleting backups:", e);
        showToast("Failed to delete backup logs.");
    }
}

async function alignGuestOrders(email, newUid) {
    if (!email || !newUid) return;
    try {
        const emailLower = email.toLowerCase().trim();
        const ordersRef = db.collection("orders");
        const snapshot = await ordersRef.where("email", "==", emailLower).get();
        if (snapshot.empty) return;

        const batch = db.batch();
        let alignedCount = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.isGuest || (data.uid && data.uid.startsWith("guest_")) || data.uid !== newUid) {
                batch.update(doc.ref, {
                    uid: newUid,
                    isGuest: false
                });
                alignedCount++;
            }
        });

        if (alignedCount > 0) {
            await batch.commit();
            console.log(`Successfully aligned ${alignedCount} guest orders to registered user profile (${newUid}).`);
        }
    } catch (e) {
        console.error("Error aligning guest orders:", e);
    }
}
window.alignGuestOrders = alignGuestOrders;

// ── Session Timeout Inactivity Tracker ───────────────────────────────────────
let sessionTimeoutMinutes = 30;
let sessionCheckInterval = null;
let activityListenersAttached = false;

function updateSessionTimeoutInterval(minutes) {
    sessionTimeoutMinutes = minutes;
    console.log(`[Session] Timeout updated to: ${minutes} minutes`);
}
window.updateSessionTimeoutInterval = updateSessionTimeoutInterval;

function recordActivity() {
    if (!currentUser) return;
    localStorage.setItem('swag_last_activity', Date.now().toString());
}

function attachActivityListeners() {
    if (activityListenersAttached) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => {
        window.addEventListener(evt, recordActivity, { passive: true });
    });
    activityListenersAttached = true;
}

function removeActivityListeners() {
    if (!activityListenersAttached) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => {
        window.removeEventListener(evt, recordActivity);
    });
    activityListenersAttached = false;
}

async function loadSessionSettings() {
    try {
        const snap = await db.collection('settings').doc('session').get();
        if (snap.exists && typeof snap.data().timeoutMinutes === 'number') {
            sessionTimeoutMinutes = snap.data().timeoutMinutes;
            const inp = document.getElementById('admin-session-timeout');
            if (inp) inp.value = sessionTimeoutMinutes;
        }
    } catch (e) {
        console.error("Error loading session settings:", e);
    }
}
window.loadSessionSettings = loadSessionSettings;
window.fetchSessionSettings = loadSessionSettings;

async function saveSessionSettings() {
    const inp = document.getElementById('admin-session-timeout');
    if (!inp) return;
    let val = parseInt(inp.value, 10);
    if (isNaN(val) || val < 1) val = 30;
    inp.value = val;
    try {
        await db.collection('settings').doc('session').set({ timeoutMinutes: val }, { merge: true });
        sessionTimeoutMinutes = val;
        showToast('✅ Session timeout saved: ' + val + ' minutes');
    } catch(e) {
        console.error('saveSessionSettings error:', e);
        showToast('Failed to save session settings');
    }
}
window.saveSessionSettings = saveSessionSettings;

function checkSessionTimeout() {
    if (!currentUser) {
        stopSessionTracker();
        return;
    }

    const lastActivityStr = localStorage.getItem('swag_last_activity');
    if (!lastActivityStr) {
        recordActivity();
        return;
    }

    const lastActivity = parseInt(lastActivityStr, 10);
    const elapsedMinutes = (Date.now() - lastActivity) / (60 * 1000);

    if (elapsedMinutes >= sessionTimeoutMinutes) {
        console.log(`[Session] Timeout reached. ${elapsedMinutes.toFixed(1)} mins elapsed. Logging out.`);
        stopSessionTracker();
        auth.signOut().then(() => {
            showToast("⚠️ Your session has timed out due to inactivity. Please log in again.");
        }).catch(err => {
            console.error("Sign out error on session timeout:", err);
        });
    }
}

function startSessionTracker() {
    recordActivity();
    attachActivityListeners();
    
    if (!sessionCheckInterval) {
        sessionCheckInterval = setInterval(checkSessionTimeout, 5000);
    }
    window.addEventListener('focus', checkSessionTimeout);
}
window.startSessionTracker = startSessionTracker;

function stopSessionTracker() {
    removeActivityListeners();
    if (sessionCheckInterval) {
        clearInterval(sessionCheckInterval);
        sessionCheckInterval = null;
    }
    window.removeEventListener('focus', checkSessionTimeout);
    localStorage.removeItem('swag_last_activity');
}
window.stopSessionTracker = stopSessionTracker;