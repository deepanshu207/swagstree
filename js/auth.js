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

        if (typeof loadOrders === "function") loadOrders();
    } else {
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

    if (nameField) nameField.style.display = isRegMode ? 'block' : 'none';
    if (phoneField) phoneField.style.display = isRegMode ? 'block' : 'none';
    if (toggleText) toggleText.innerText = isRegMode ? "Already have an account? Login" : "New here? Register";
    if (btn) btn.innerText = isRegMode ? "Create Account" : "Login";
}

// ── Google Login ────────────────────────────────────────────────────────────
async function handleGoogleLogin() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        showToast("✅ Google Login Successful!");
    } catch (error) {
        console.error("Google Auth Error:", error);
        if (error.code === 'auth/operation-not-allowed') {
            showToast("Enable Google Sign-in in Firebase Console first.");
        } else {
            showToast("Google Login Failed. Try again.");
        }
    }
}

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
