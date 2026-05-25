// ==========================================
// SWAG STREE | AUTHENTICATION SYSTEM
// ==========================================

const ADMIN_EMAIL = "admin@swagstree.com";

// ── Auth State Listener ─────────────────────────────────────────────────────
auth.onAuthStateChanged(user => {
    currentUser = user;
    isAdmin = (user && user.email === ADMIN_EMAIL);

    // Toggle admin nav
    document.getElementById('nav-adm').style.display = isAdmin ? 'block' : 'none';
    const admDesktop = document.getElementById('nav-adm-desktop');
    if (admDesktop) admDesktop.style.display = isAdmin ? 'block' : 'none';

    if (user) {
        // Sync email to Firestore
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
            if (typeof loadAdminPromoSettings === 'function') loadAdminPromoSettings();
            if (typeof loadCodSettings === 'function') loadCodSettings();
        }

        // Sync wishlist from Firestore
        db.collection("users").doc(user.uid).onSnapshot(doc => {
            const data = doc.exists ? doc.data() : {};
            wishlist = data.wishlist || [];

            // Pre-fill profile fields with saved data
            const savedName = data.displayName || user.displayName || '';
            const savedPhone = data.phone || user.phoneNumber || '';

            const profName = document.getElementById('prof-name');
            const profPhone = document.getElementById('prof-phone');
            if (profName) profName.value = savedName;
            if (profPhone) profPhone.value = savedPhone;

            renderStore();
        });

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

        document.getElementById('auth-ui').style.display = 'none';
        document.getElementById('dash-ui').style.display = 'block';

        if (typeof loadOrders === "function") {
            displayedOrdersLimit = 20;
            loadOrders();
        }
    } else {
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
        renderStore();
    }

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
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        if (window.innerWidth < 768) {
            await auth.signInWithRedirect(provider);
        } else {
            await auth.signInWithPopup(provider);
            showToast("✅ Google Login Successful!");
        }
    } catch (error) {
        console.error("Google Auth Error:", error);
        if (error.code === 'auth/operation-not-allowed') {
            showToast("Enable Google Sign-in in Firebase Console first.");
        } else {
            showToast("Google Login Failed. Try again.");
        }
    }
}

// Handle redirect result for mobile Google Login
auth.getRedirectResult().then(result => {
    if (result && result.user) {
        showToast("✅ Google Login Successful!");
    }
}).catch(error => {
    console.error("Redirect Auth Error:", error);
    showToast("Google Login Failed. Try again.");
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