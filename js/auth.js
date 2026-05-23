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
    let val = inp.value; 
    
    // Auto-format phone numbers
    if (/^\d/.test(val)) { 
        if (!val.startsWith('+91')) {
            inp.value = '+91' + val.replace('+91', ''); 
        }
        document.getElementById('pass-area').style.display = 'none'; 
        btn.innerText = (confirmationResult || mockWhatsAppOtp) ? "Verify Code" : "Send OTP via WhatsApp"; 
    } else { 
        document.getElementById('pass-area').style.display = 'block'; 
        btn.innerText = isRegMode ? "Register" : "Login"; 
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
                
                // In production, this would call a backend endpoint to send a WhatsApp message via Twilio/MSG91
                console.log(`[PRODUCTION MOCK] Sending WhatsApp OTP to ${id}: ${mockWhatsAppOtp}`);
                
                // Show the OTP field
                document.getElementById('otp-area').style.display = 'block'; 
                
                // Simulate WhatsApp API success
                showToast(`OTP Sent to WhatsApp (Mock code: ${mockWhatsAppOtp})`);
                btn.innerText = "Verify Code";
            } else { 
                // Verify OTP
                const enteredOtp = document.getElementById('au-otp').value;
                if (enteredOtp === mockWhatsAppOtp) {
                    showToast("WhatsApp OTP Verified!");
                    // Mock login (Since we can't mint custom tokens on client side, we use email/pass mock or anonymous for demo)
                    // For demo, we just login anonymously and link phone number visually.
                    const cred = await auth.signInAnonymously();
                    currentUser = cred.user; // Overwrite UI
                    showToast("Login Successful!");
                    mockWhatsAppOtp = null;
                } else {
                    showToast("Invalid OTP. Try again.");
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
