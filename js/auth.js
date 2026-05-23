// ==========================================
// SWAG STREE | AUTHENTICATION SYSTEM
// ==========================================

const ADMIN_EMAIL = "admin@swagstree.com";
let mockWhatsAppOtp = null; // For simulating WhatsApp OTP

// Listen to Auth State
auth.onAuthStateChanged(user => { 
    currentUser = user; 
    isAdmin = (user && user.email === ADMIN_EMAIL); 
    
    // Toggle Admin Navigation visibility
    document.getElementById('nav-adm').style.display = isAdmin ? 'block' : 'none'; 
    const admDesktop = document.getElementById('nav-adm-desktop');
    if(admDesktop) admDesktop.style.display = isAdmin ? 'block' : 'none';
    
    if(user) { 
        // User is logged in
        db.collection("users").doc(user.uid).onSnapshot(doc => { 
            wishlist = doc.exists ? doc.data().wishlist || [] : []; 
            renderStore(); 
        }); 
        
        document.getElementById('dash-name').innerText = user.email || user.phoneNumber || "User"; 
        document.getElementById('auth-ui').style.display = 'none'; 
        document.getElementById('dash-ui').style.display = 'block'; 
        
        // Expose loadOrders from checkout.js if it exists, otherwise define it there.
        if (typeof loadOrders === "function") loadOrders(); 
    } else { 
        // User logged out
        document.getElementById('auth-ui').style.display = 'block'; 
        document.getElementById('dash-ui').style.display = 'none'; 
        wishlist = []; 
        renderStore(); 
    } 
    
    // Trigger initial data load
    if (typeof loadData === "function") loadData(); 
});

function toggleAuthMode() { 
    isRegMode = !isRegMode; 
    document.getElementById('reg-extra').style.display = isRegMode ? 'block' : 'none'; 
    document.getElementById('toggle-text').innerText = isRegMode ? "Already have an account? Login" : "New here? Register";
    handleSmartAuthUI(); 
}

function handleSmartAuthUI() { 
    const inp = document.getElementById('au-id');
    const btn = document.getElementById('au-btn'); 
    let val = inp.value.trim(); 
    const otpArea = document.getElementById('otp-area');
    
    // Detect phone number: starts with + or a digit
    if (/^(\+?\d)/.test(val)) { 
        // Auto-prepend +91 if not already there
        if (!val.startsWith('+91') && !val.startsWith('+')) {
            inp.value = '+91' + val; 
        }
        document.getElementById('pass-area').style.display = 'none'; 
        otpArea.style.display = mockWhatsAppOtp ? 'block' : 'none';
        btn.innerText = mockWhatsAppOtp ? "Verify OTP" : "Send OTP"; 
    } else { 
        // Email mode: show password, hide OTP
        document.getElementById('pass-area').style.display = 'block'; 
        otpArea.style.display = 'none';
        mockWhatsAppOtp = null; // Reset OTP state when switching to email
        btn.innerText = isRegMode ? "Register" : "Login"; 
    } 
}

async function handleGoogleLogin() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await auth.signInWithPopup(provider);
        showToast("Google Login Successful!");
    } catch(error) {
        console.error("Google Auth Error:", error);
        if (error.code === 'auth/operation-not-allowed') {
            showToast("Google Login not enabled in Firebase Console");
        } else {
            showToast("Google Login Failed.");
        }
    }
}

async function handleMainAuth() { 
    const id = document.getElementById('au-id').value.trim();
    const pass = document.getElementById('au-pass').value; 
    const btn = document.getElementById('au-btn');
    
    try { 
        if(id.startsWith('+')) { 
            // PHONE AUTHENTICATION (WhatsApp OTP Mock Flow)
            if(!mockWhatsAppOtp) { 
                // Generate a mock 4-digit code
                mockWhatsAppOtp = Math.floor(1000 + Math.random() * 9000).toString();
                
                // In production, call your backend to send WhatsApp message via MSG91/Twilio
                console.log(`[MOCK] WhatsApp OTP for ${id}: ${mockWhatsAppOtp}`);
                
                // Show the OTP field
                document.getElementById('otp-area').style.display = 'block'; 
                btn.innerText = "Verify OTP";
                
                showToast(`📱 OTP Sent! (Mock: ${mockWhatsAppOtp})`);
            } else { 
                // Verify OTP
                const enteredOtp = document.getElementById('au-otp').value.trim();
                if (enteredOtp === mockWhatsAppOtp) {
                    btn.innerText = "Verifying...";
                    // Use anonymous auth as placeholder for WhatsApp users
                    const cred = await auth.signInAnonymously();
                    // Store phone number in Firestore user profile
                    await db.collection("users").doc(cred.user.uid).set({ phone: id, loginMethod: 'whatsapp' }, { merge: true });
                    showToast("✅ Login Successful!");
                    mockWhatsAppOtp = null;
                } else {
                    showToast("❌ Invalid OTP. Try again.");
                }
            } 
        } else { 
            // EMAIL AUTHENTICATION
            btn.innerText = "Authenticating...";
            if(isRegMode) {
                await auth.createUserWithEmailAndPassword(id, pass); 
            } else {
                await auth.signInWithEmailAndPassword(id, pass); 
            } 
            showToast("Login Successful!");
        } 
    } catch(e) { 
        console.error(e);
        showToast("Authentication Error. Check details."); 
        btn.innerText = "Try Again";
    } 
}
