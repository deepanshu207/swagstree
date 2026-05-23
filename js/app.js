// ==========================================
// SWAG STREE | CORE APPLICATION STATE
// ==========================================

// 1. CONFIGURATION
emailjs.init("k0dMkc3ECEKI5SBkW");
const firebaseConfig = { 
    apiKey: "AIzaSyAKXSFKuhQXMGvmtjh0CHnz48vbYz9a_4A", 
    authDomain: "swagstree-web.firebaseapp.com", 
    projectId: "swagstree-web" 
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const CLOUD_NAME = "mysharecloud";
const PRESET = "swagstree_upload";

// 2. GLOBAL STATE
let products = [];
let cart = [];
let wishlist = [];
let currentUser = null;
let isAdmin = false;
let editingId = null;

// UI State
let isRegMode = false;
let selectedSize = 'S';
let currentProductFiles = [];
let existingImageUrls = [];
let filterActiveSize = null;
let confirmationResult = null; // Used for SMS OTP fallback

// 3. UTILITIES
function showToast(m) { 
    const t = document.getElementById('toast'); 
    t.innerText = m; 
    t.style.display = 'block'; 
    setTimeout(() => t.style.display = 'none', 2000); 
}

function copyToClipboard(text) { 
    const dummy = document.createElement("input"); 
    document.body.appendChild(dummy); 
    dummy.value = text; 
    dummy.select(); 
    document.execCommand("copy"); 
    document.body.removeChild(dummy); 
    showToast("Link copied!"); 
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
}

// 4. NAVIGATION SYSTEM
function nav(id, el) { 
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active')); 
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); 
    document.getElementById(id + '-view').classList.add('active'); 
    
    // Sync active state between desktop and mobile nav
    const desktopNavs = document.querySelectorAll(`.desktop-nav .nav-item[onclick="nav('${id}', this)"]`);
    const bottomNavs = document.querySelectorAll(`.bottom-nav .nav-item[onclick="nav('${id}', this)"]`);
    if (desktopNavs.length) desktopNavs[0].classList.add('active');
    if (bottomNavs.length) bottomNavs[0].classList.add('active');
    
    if(el) el.classList.add('active'); 
}

// Initialize on load
window.onload = () => { 
    const searchInput = document.getElementById('app_search');
    if(searchInput) { 
        searchInput.value = ""; 
        searchInput.setAttribute('readonly', 'true'); 
        setTimeout(() => { searchInput.value = ""; }, 500); 
    }
};
