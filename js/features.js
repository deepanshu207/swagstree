// ==========================================
// SWAG STREE | ADVANCED MODERN FEATURES
// ==========================================

// 1. DEFAULT FEATURE CONFIGURATION STATE
window.APP_FEATURES = window.APP_FEATURES || {
    threeSixtyViewer: true,
    aiChatbot: true,
    themeSwitcher: true,
    multiLanguage: true,
    announcementBar: true,
    widgets: {
        recentOrders: true,
        discountWheel: true,
        stockCountdown: true,
        newsletterPopup: true
    },
    socialAuth: {
        google: true,
        facebook: true,
        instagram: true,
        phone: true
    }
};

// 2. DICTIONARY FOR MULTI-LANGUAGE
const I18N_DICTIONARY = {
    en: {
        search_placeholder: "Search products...",
        showing_products: "Showing {visible} of {total} Products",
        wishlist_title: "My Wishlist",
        cart_title: "Shopping Cart",
        checkout: "Checkout Now",
        add_to_cart: "Add to Cart",
        new_item: "New Item",
        admin_tools: "Admin Tools",
        default_sorting: "Sort: Default",
        low_high: "Price: Low to High",
        high_low: "Price: High to Low",
        ai_chat_title: "Swag Stree Support AI",
        ai_chat_welcome: "Hi! How can I help you style your day today?",
        spin_wheel_title: "Spin & Win!",
        spin_wheel_sub: "Spin the wheel to get exclusive discounts!",
        spin_btn: "SPIN NOW",
        newsletter_title: "Unlock Premium Swag",
        newsletter_sub: "Subscribe to our VIP newsletter for 10% off your next purchase.",
        subscribe: "Subscribe",
        low_stock: "Hurry! Only {qty} left in stock!"
    },
    hi: {
        search_placeholder: "उत्पाद खोजें...",
        showing_products: "{total} में से {visible} उत्पाद दिख रहे हैं",
        wishlist_title: "मेरी विशलिस्ट",
        cart_title: "शॉपिंग कार्ट",
        checkout: "चेकआउट करें",
        add_to_cart: "कार्ट में जोड़ें",
        new_item: "नया उत्पाद",
        admin_tools: "प्रशासक उपकरण",
        default_sorting: "क्रम: डिफ़ॉल्ट",
        low_high: "कीमत: कम से अधिक",
        high_low: "कीमत: अधिक से कम",
        ai_chat_title: "स्वैग स्त्री सहायता एआई",
        ai_chat_welcome: "नमस्ते! आज मैं आपकी क्या सहायता कर सकता हूँ?",
        spin_wheel_title: "स्पिन करें और जीतें!",
        spin_wheel_sub: "विशेष छूट पाने के लिए पहिया घुमाएं!",
        spin_btn: "घुमाएं",
        newsletter_title: "प्रीमियम स्वैग अनलॉक करें",
        newsletter_sub: "अगली खरीदारी पर 10% छूट के लिए वीआईपी न्यूजलेटर की सदस्यता लें।",
        subscribe: "सदस्यता लें",
        low_stock: "जल्दी करें! स्टॉक में केवल {qty} बचे हैं!"
    },
    es: {
        search_placeholder: "Buscar productos...",
        showing_products: "Mostrando {visible} de {total} Productos",
        wishlist_title: "Mi Lista",
        cart_title: "Carrito de Compras",
        checkout: "Pagar Ahora",
        add_to_cart: "Añadir al Carrito",
        new_item: "Nuevo Artículo",
        admin_tools: "Herramientas Admin",
        default_sorting: "Orden: Por defecto",
        low_high: "Precio: Bajo a Alto",
        high_low: "Precio: Alto a Bajo",
        ai_chat_title: "Soporte AI de Swag Stree",
        ai_chat_welcome: "¡Hola! ¿Cómo puedo ayudarte hoy?",
        spin_wheel_title: "¡Gira y Gana!",
        spin_wheel_sub: "¡Gira la rueda para obtener descuentos exclusivos!",
        spin_btn: "GIRAR AHORA",
        newsletter_title: "Desbloquea Swag Premium",
        newsletter_sub: "Suscríbete al boletín VIP para recibir un 10% de descuento.",
        subscribe: "Suscribirse",
        low_stock: "¡Prisa! ¡Solo quedan {qty} en stock!"
    }
};

let currentLanguage = 'en';

// Translate Page Elements
function setLanguage(lang) {
    if (!I18N_DICTIONARY[lang]) return;
    currentLanguage = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (I18N_DICTIONARY[lang][key]) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = I18N_DICTIONARY[lang][key];
            } else {
                el.innerText = I18N_DICTIONARY[lang][key];
            }
        }
    });
    // Trigger re-render of products to update counts and badges
    if (typeof applySortAndFilter === 'function') {
        applySortAndFilter();
    }
}
window.setLanguage = setLanguage;

// Get Translated Text Helper
function getI18nText(key, replacements = {}) {
    let txt = I18N_DICTIONARY[currentLanguage]?.[key] || I18N_DICTIONARY['en'][key] || key;
    for (const [k, v] of Object.entries(replacements)) {
        txt = txt.replace(`{${k}}`, v);
    }
    return txt;
}
window.getI18nText = getI18nText;

// 3. THEME MANAGEMENT SYSTEM
const PALETTES = {
    outlaw: {
        gold: '#FFD700',
        bg: '#000000',
        card: '#111111',
        border: '#222222',
        accent: '#FFD700'
    },
    midnight: {
        gold: '#00ffff',
        bg: '#060814',
        card: '#0e1124',
        border: '#1f2444',
        accent: '#e024ff'
    },
    emerald: {
        gold: '#d4af37',
        bg: '#051811',
        card: '#0a2b1f',
        border: '#144c37',
        accent: '#2ecc71'
    },
    crimson: {
        gold: '#ff3f3f',
        bg: '#0c0707',
        card: '#1a1010',
        border: '#332020',
        accent: '#ff7f7f'
    },
    light: {
        gold: '#c29a53',
        bg: '#f8f9fa',
        card: '#ffffff',
        border: '#e2e8f0',
        accent: '#c29a53'
    }
};

function selectTheme(themeKey) {
    const pal = PALETTES[themeKey];
    if (!pal) return;
    
    // Apply standard variables to root
    const root = document.documentElement;
    root.style.setProperty('--gold', pal.gold);
    root.style.setProperty('--bg', pal.bg);
    root.style.setProperty('--card', pal.card);
    root.style.setProperty('--border', pal.border);
    root.style.setProperty('--accent-glow', pal.accent);
    
    // For light theme specific adjustments
    if (themeKey === 'light') {
        document.body.style.color = '#1a202c';
        document.querySelectorAll('.bottom-nav').forEach(el => el.style.background = '#ffffff');
        root.style.setProperty('--text-color', '#1a202c');
    } else {
        document.body.style.color = '#ffffff';
        document.querySelectorAll('.bottom-nav').forEach(el => el.style.background = '#000000');
        root.style.setProperty('--text-color', '#ffffff');
    }
    
    localStorage.setItem('swag_theme_pref', themeKey);
}
window.selectTheme = selectTheme;

// 4. FLOATING AI SUPPORT CHATBOT
let chatHistory = [];
function toggleAIChat() {
    const chatContainer = document.getElementById('ai-chat-box');
    if (!chatContainer) return;
    const isHidden = chatContainer.style.display === 'none' || !chatContainer.style.display;
    chatContainer.style.display = isHidden ? 'flex' : 'none';
    
    if (isHidden && chatHistory.length === 0) {
        appendChatMessage('bot', getI18nText('ai_chat_welcome'));
    }
}
window.toggleAIChat = toggleAIChat;

function appendChatMessage(sender, text) {
    const body = document.getElementById('ai-chat-body');
    if (!body) return;
    
    const div = document.createElement('div');
    div.style.margin = '8px 0';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '10px';
    div.style.maxWidth = '85%';
    div.style.fontSize = '12px';
    div.style.lineHeight = '1.4';
    
    if (sender === 'bot') {
        div.style.background = 'var(--card)';
        div.style.border = '1px solid var(--border)';
        div.style.color = 'var(--text-color, #fff)';
        div.style.alignSelf = 'flex-start';
    } else {
        div.style.background = 'var(--gold)';
        div.style.color = '#000';
        div.style.alignSelf = 'flex-end';
        div.style.marginLeft = 'auto';
    }
    
    div.innerText = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    chatHistory.push({ sender, text });
}

function handleBotReply(text) {
    // Simple Intelligent Matcher based on catalog
    setTimeout(() => {
        const query = text.toLowerCase();
        let reply = "I'm not sure about that. Let me connect you with our main WhatsApp support team!";
        
        if (query.includes('hello') || query.includes('hi') || query.includes('hey')) {
            reply = "Hello there! How can I help you find your perfect outfit today?";
        } else if (query.includes('price') || query.includes('cost') || query.includes('how much')) {
            // Find items matched
            const matched = window.products ? window.products.filter(p => query.includes(p.name.toLowerCase())) : [];
            if (matched.length > 0) {
                reply = matched.map(p => `The price of ${p.name} is ₹${p.price}.`).join(' ');
            } else {
                reply = "Our standard sets range from ₹100 to ₹1500. Tell me which product you are looking at!";
            }
        } else if (query.includes('size') || query.includes('fit')) {
            reply = "We offer sizes from S to XL! You can choose your size directly on the product's details page.";
        } else if (query.includes('status') || query.includes('track') || query.includes('order')) {
            reply = "You can view your order tracking details under 'Profile & Orders' tab at the top right of the page!";
        } else if (query.includes('discount') || query.includes('offer') || query.includes('coupon') || query.includes('code')) {
            reply = "Try spinning our Discount Wheel on the screen, or use code 'WELCOME10' to get 10% off!";
        } else {
            // General product listing search helper
            const matched = window.products ? window.products.filter(p => p.name.toLowerCase().split(' ').some(w => query.includes(w))) : [];
            if (matched.length > 0) {
                reply = `We found matching items: ${matched.slice(0, 3).map(p => p.name).join(', ')}. Check them out in the grid!`;
            }
        }
        
        appendChatMessage('bot', reply);
    }, 800);
}
window.handleBotReply = handleBotReply;

function sendChatMessageWithText(text) {
    appendChatMessage('user', text);
    handleBotReply(text);
}
window.sendChatMessageWithText = sendChatMessageWithText;

function sendChatMessage() {
    const input = document.getElementById('ai-chat-input');
    if (!input || !input.value.trim()) return;
    
    const text = input.value.trim();
    appendChatMessage('user', text);
    input.value = '';
    
    handleBotReply(text);
}
window.sendChatMessage = sendChatMessage;

// 5. 360-DEGREE PRODUCT ROTATE VIEWER
let startX = 0;
let currentIndex360 = 0;
let isDragging360 = false;
let images360 = [];

function open360Viewer(prodId) {
    const p = window.products ? window.products.find(x => x.id === prodId) : null;
    if (!p || !p.images || p.images.length < 2) {
        showToast("Add at least 2 product images to view in 360° mode.");
        return;
    }
    
    images360 = p.images;
    currentIndex360 = 0;
    
    // Inject and open Modal
    let modal = document.getElementById('viewer-360-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'viewer-360-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(0,0,0,0.95)';
        modal.style.zIndex = '999999';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        modal.innerHTML = `
            <div style="position:absolute; top:20px; right:20px; font-size:24px; color:#fff; cursor:pointer;" onclick="close360Viewer()">&times;</div>
            <h4 style="color:var(--gold); margin:0 0 10px 0; text-transform:uppercase; letter-spacing:1px;">Drag left/right to rotate</h4>
            <div id="rotate-area" style="width:90%; max-width:400px; height:400px; background:#111; border:1px solid #333; border-radius:18px; display:flex; align-items:center; justify-content:center; overflow:hidden; position:relative; cursor:grab;">
                <img id="image-360-frame" style="width:100%; height:100%; object-fit:cover;" src="" draggable="false">
                <div style="position:absolute; bottom:15px; background:rgba(0,0,0,0.6); padding:4px 10px; border-radius:15px; font-size:10px; color:#aaa;"><i class="fa fa-sync"></i> 360° MODE</div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Drag listeners
        const area = document.getElementById('rotate-area');
        area.addEventListener('mousedown', startRotateDrag);
        area.addEventListener('mousemove', moveRotateDrag);
        area.addEventListener('mouseup', endRotateDrag);
        area.addEventListener('mouseleave', endRotateDrag);
        
        area.addEventListener('touchstart', startRotateDrag, {passive: true});
        area.addEventListener('touchmove', moveRotateDrag, {passive: true});
        area.addEventListener('touchend', endRotateDrag);
    }
    
    modal.style.display = 'flex';
    update360Frame();
}
window.open360Viewer = open360Viewer;

function close360Viewer() {
    const modal = document.getElementById('viewer-360-modal');
    if (modal) modal.style.display = 'none';
}
window.close360Viewer = close360Viewer;

function update360Frame() {
    const imgEl = document.getElementById('image-360-frame');
    if (imgEl && images360[currentIndex360]) {
        imgEl.src = images360[currentIndex360];
    }
}

function startRotateDrag(e) {
    isDragging360 = true;
    startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const area = document.getElementById('rotate-area');
    if (area) area.style.cursor = 'grabbing';
}

function moveRotateDrag(e) {
    if (!isDragging360 || images360.length === 0) return;
    const currentX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const diff = currentX - startX;
    
    // Sensitivity: change frame every 15 pixels dragged
    if (Math.abs(diff) > 15) {
        if (diff > 0) {
            currentIndex360 = (currentIndex360 + 1) % images360.length;
        } else {
            currentIndex360 = (currentIndex360 - 1 + images360.length) % images360.length;
        }
        startX = currentX;
        update360Frame();
    }
}

function endRotateDrag() {
    isDragging360 = false;
    const area = document.getElementById('rotate-area');
    if (area) area.style.cursor = 'grab';
}

// 6. INTERACTIVE WIDGETS
// Discount Spin Wheel Widget
function openDiscountWheel() {
    if (!window.APP_FEATURES.widgets.discountWheel) return;
    
    let modal = document.getElementById('spin-wheel-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'spin-wheel-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(0,0,0,0.85)';
        modal.style.zIndex = '999998';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        modal.innerHTML = `
            <div style="background:#111; border:1px solid var(--border); border-radius:24px; padding:30px; width:90%; max-width:380px; text-align:center; position:relative; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                <div style="position:absolute; top:15px; right:15px; color:#aaa; font-size:20px; cursor:pointer;" onclick="closeDiscountWheel()">&times;</div>
                <h3 style="color:var(--gold); margin:0 0 5px 0;" data-i18n="spin_wheel_title">Spin & Win!</h3>
                <p style="color:#aaa; font-size:11px; margin:0 0 20px 0;" data-i18n="spin_wheel_sub">Spin the wheel to get exclusive discounts!</p>
                
                <div style="width:240px; height:240px; margin:0 auto 20px auto; position:relative;">
                    <div id="wheel-pointer" style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); width:0; height:0; border-left:12px solid transparent; border-right:12px solid transparent; border-top:20px solid var(--gold); z-index:10;"></div>
                    <svg id="wheel-canvas" viewBox="0 0 200 200" style="width:100%; height:100%; transition: transform 4s cubic-bezier(0.1, 0.8, 0.1, 1); border-radius:50%; border:5px solid var(--border); background:#1a1a1a;">
                        <circle cx="100" cy="100" r="95" fill="none"/>
                        <!-- Slice 1 -->
                        <path d="M100 100 L100 5 A95 95 0 0 1 182 52 Z" fill="#222"/>
                        <!-- Slice 2 -->
                        <path d="M100 100 L182 52 A95 95 0 0 1 182 148 Z" fill="#FFD700"/>
                        <!-- Slice 3 -->
                        <path d="M100 100 L182 148 A95 95 0 0 1 100 195 Z" fill="#333"/>
                        <!-- Slice 4 -->
                        <path d="M100 100 L100 195 A95 95 0 0 1 18 148 Z" fill="#FFD700"/>
                        <!-- Slice 5 -->
                        <path d="M100 100 L18 148 A95 95 0 0 1 18 52 Z" fill="#222"/>
                        <!-- Slice 6 -->
                        <path d="M100 100 L18 52 A95 95 0 0 1 100 5 Z" fill="#FFD700"/>
                        
                        <!-- Text -->
                        <text x="120" y="45" fill="#fff" font-size="9" transform="rotate(30, 100, 100)">10% OFF</text>
                        <text x="120" y="45" fill="#000" font-size="9" transform="rotate(90, 100, 100)">TRY AGAIN</text>
                        <text x="120" y="45" fill="#fff" font-size="9" transform="rotate(150, 100, 100)">15% OFF</text>
                        <text x="120" y="45" fill="#000" font-size="9" transform="rotate(210, 100, 100)">FREE SHIP</text>
                        <text x="120" y="45" fill="#fff" font-size="9" transform="rotate(270, 100, 100)">5% OFF</text>
                        <text x="120" y="45" fill="#000" font-size="9" transform="rotate(330, 100, 100)">JACKPOT</text>
                    </svg>
                </div>
                
                <button id="spin-wheel-btn" class="btn-gold" style="width:100%; border-radius:12px;" onclick="spinDiscountWheel()" data-i18n="spin_btn">SPIN NOW</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
}
window.openDiscountWheel = openDiscountWheel;

function closeDiscountWheel() {
    const modal = document.getElementById('spin-wheel-modal');
    if (modal) modal.style.display = 'none';
}
window.closeDiscountWheel = closeDiscountWheel;

let isWheelSpinning = false;
function spinDiscountWheel() {
    if (isWheelSpinning) return;
    isWheelSpinning = true;
    
    const wheel = document.getElementById('wheel-canvas');
    const btn = document.getElementById('spin-wheel-btn');
    if (btn) btn.disabled = true;
    
    // Generate random rotation: 5-10 full spins + random degree
    const degrees = 1800 + Math.floor(Math.random() * 360);
    wheel.style.transform = `rotate(${degrees}deg)`;
    
    setTimeout(() => {
        isWheelSpinning = false;
        if (btn) btn.disabled = false;
        
        // Determine prize based on degree remainder
        const actualDeg = degrees % 360;
        let reward = "WELCOME10";
        let message = "Congratulations! You won 10% OFF! Coupon code: WELCOME10";
        
        if (actualDeg >= 0 && actualDeg < 60) {
            reward = (window.APP_FEATURES_CONTENT && window.APP_FEATURES_CONTENT.wheelJackpotCode) || "SWAGJACKPOT";
            message = `JACKPOT! You won 25% OFF! Coupon: ${reward}`;
        } else if (actualDeg >= 60 && actualDeg < 120) {
            reward = "SAVE5";
            message = "You won 5% OFF! Coupon: SAVE5";
        } else if (actualDeg >= 120 && actualDeg < 180) {
            reward = "FREESHIP";
            message = "Free Shipping code won! Code: FREESHIP";
        } else if (actualDeg >= 180 && actualDeg < 240) {
            reward = "SAVE15";
            message = "You won 15% OFF! Coupon: SAVE15";
        }
        
        showToast(message);
        localStorage.setItem('swag_coupon_win', reward);
        
        // Autocomplete Promo Code Input if it is on the page
        const promoInput = document.getElementById('promo-code');
        if (promoInput) {
            promoInput.value = reward;
        }
        
        setTimeout(closeDiscountWheel, 1500);
    }, 4100);
}
window.spinDiscountWheel = spinDiscountWheel;

// Social proof activity popup generator
const DUMMY_CITIES = ['New Delhi', 'Mumbai', 'Bangalore', 'Kolkata', 'Chennai', 'Hyderabad', 'Jaipur', 'Indore'];
const DUMMY_NAMES = ['Karan', 'Asha', 'Pooja', 'Rahul', 'Sneha', 'Vikram', 'Rhea', 'Ananya'];

function triggerRecentActivityNotification() {
    if (!window.APP_FEATURES.widgets.recentOrders) return;
    
    // Choose random items
    const cityName = DUMMY_CITIES[Math.floor(Math.random() * DUMMY_CITIES.length)];
    const buyerName = DUMMY_NAMES[Math.floor(Math.random() * DUMMY_NAMES.length)];
    const productList = window.products || [];
    if (productList.length === 0) return;
    const randomProduct = productList[Math.floor(Math.random() * productList.length)];
    
    let popup = document.getElementById('recent-activity-popup');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'recent-activity-popup';
        popup.style.position = 'fixed';
        popup.style.bottom = '85px';
        popup.style.left = '15px';
        popup.style.background = 'rgba(17,17,17,0.95)';
        popup.style.border = '1px solid var(--border)';
        popup.style.borderRadius = '14px';
        popup.style.padding = '10px 15px';
        popup.style.zIndex = '99999';
        popup.style.display = 'flex';
        popup.style.alignItems = 'center';
        popup.style.gap = '10px';
        popup.style.maxWidth = '300px';
        popup.style.boxShadow = '0 6px 20px rgba(0,0,0,0.5)';
        popup.style.transition = 'all 0.5s ease';
        popup.style.transform = 'translateY(100px)';
        popup.style.opacity = '0';
        document.body.appendChild(popup);
    }
    
    const prodImg = (randomProduct.images && randomProduct.images[0]) ? randomProduct.images[0] : '';
    
    popup.innerHTML = `
        ${prodImg ? `<img src="${prodImg}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;">` : `<i class="fa fa-shopping-bag" style="color:var(--gold); font-size:24px;"></i>`}
        <div>
            <p style="margin:0; font-size:11px; color:#fff; font-weight:600;">${buyerName} from ${cityName}</p>
            <p style="margin:2px 0 0 0; font-size:10px; color:#aaa;">just ordered <strong>${randomProduct.name}</strong></p>
        </div>
    `;
    
    // Fade in
    popup.style.transform = 'translateY(0)';
    popup.style.opacity = '1';
    
    // Fade out after 4 seconds
    setTimeout(() => {
        popup.style.transform = 'translateY(100px)';
        popup.style.opacity = '0';
    }, 4000);
}

// Newsletter Subscription Popup
function openNewsletterPopup() {
    if (!window.APP_FEATURES.widgets.newsletterPopup) return;
    
    // Check if dismissed before
    if (sessionStorage.getItem('newsletter_dismissed')) return;
    
    let modal = document.getElementById('newsletter-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'newsletter-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = 'rgba(0,0,0,0.85)';
        modal.style.zIndex = '999997';
        modal.style.display = 'flex';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        modal.innerHTML = `
            <div style="background:#0f0f0f; border:1px solid var(--border); border-radius:24px; padding:35px 25px; width:90%; max-width:400px; text-align:center; position:relative; box-shadow: 0 12px 40px rgba(0,0,0,0.6);">
                <div style="position:absolute; top:15px; right:15px; color:#666; font-size:20px; cursor:pointer;" onclick="closeNewsletterPopup()">&times;</div>
                <div style="width:60px; height:60px; border-radius:50%; background:rgba(255,215,0,0.08); border:1px solid rgba(255,215,0,0.2); display:grid; place-items:center; margin:0 auto 15px auto;">
                    <i class="fa fa-envelope-open" style="color:var(--gold); font-size:24px;"></i>
                </div>
                <h3 style="color:#fff; margin:0 0 8px 0; font-weight:800; font-size:18px;" data-i18n="newsletter_title">Unlock Premium Swag</h3>
                <p style="color:#888; font-size:11px; line-height:1.5; margin:0 0 25px 0;" data-i18n="newsletter_sub">Subscribe to our VIP newsletter for 10% off your next purchase.</p>
                
                <input type="email" id="newsletter-email-input" placeholder="Enter your email" style="width:100%; padding:12px; background:#181818; border:1px solid #282828; color:#fff; border-radius:12px; font-size:13px; margin-bottom:15px; outline:none; box-sizing:border-box;">
                <button class="btn-gold" style="width:100%; border-radius:12px; font-size:12px; padding:12px;" onclick="submitNewsletter()" data-i18n="subscribe">Subscribe</button>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
}
window.openNewsletterPopup = openNewsletterPopup;

function closeNewsletterPopup() {
    const modal = document.getElementById('newsletter-modal');
    if (modal) modal.style.display = 'none';
    sessionStorage.setItem('newsletter_dismissed', 'true');
}
window.closeNewsletterPopup = closeNewsletterPopup;

function submitNewsletter() {
    const email = document.getElementById('newsletter-email-input')?.value;
    if (!email || !email.includes('@')) {
        showToast("Enter a valid email address.");
        return;
    }
    showToast("Subscribed! Your 10% discount code is: WELCOME10");
    closeNewsletterPopup();
}
window.submitNewsletter = submitNewsletter;

// Global features content configuration object fallback
window.APP_FEATURES_CONTENT = window.APP_FEATURES_CONTENT || {
    announcementText: "✨ EXTRA 10% OFF ON PRE-PAID ORDERS! CODE: PREPAID10 ✨",
    chatbotWelcome: "Hi! How can I help you style your day today?",
    chatbotChips: "Sizes, Price, Track Order, Discount Code",
    newsletterDelay: 5,
    wheelJackpotCode: "WIN50"
};

function toggleThemeDrawer() {
    const drawer = document.getElementById('theme-drawer');
    if (!drawer) return;
    if (drawer.classList.contains('open')) {
        drawer.classList.remove('open');
    } else {
        drawer.classList.add('open');
    }
}
window.toggleThemeDrawer = toggleThemeDrawer;

function changeVisitorTheme(themeKey) {
    selectTheme(themeKey);
    const buttons = document.querySelectorAll('.theme-palette-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    // Find matching button to make active
    const btn = Array.from(buttons).find(x => x.getAttribute('onclick')?.includes(`'${themeKey}'`));
    if (btn) btn.classList.add('active');
}
window.changeVisitorTheme = changeVisitorTheme;

function applyCustomHexColors(colors) {
    const root = document.documentElement;
    if (colors.gold) root.style.setProperty('--gold', colors.gold);
    if (colors.bg) root.style.setProperty('--bg', colors.bg);
    if (colors.card) root.style.setProperty('--card', colors.card);
    if (colors.border) root.style.setProperty('--border', colors.border);
    if (colors.accent) root.style.setProperty('--accent-glow', colors.accent);
    
    // Auto text and bottom nav colors
    let isLight = false;
    if (colors.bg) {
        const hex = colors.bg.replace('#', '');
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0,2), 16);
            const g = parseInt(hex.substring(2,4), 16);
            const b = parseInt(hex.substring(4,6), 16);
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            isLight = brightness > 150;
        }
    }
    
    if (colors.text) {
        root.style.setProperty('--text-color', colors.text);
        document.body.style.color = colors.text;
    } else {
        const txtColor = isLight ? '#1a202c' : '#ffffff';
        root.style.setProperty('--text-color', txtColor);
        document.body.style.color = txtColor;
    }
    
    document.querySelectorAll('.bottom-nav').forEach(el => {
        el.style.background = isLight ? '#ffffff' : '#000000';
    });
}
window.applyCustomHexColors = applyCustomHexColors;

function applyFeatureTogglesUI() {
    const config = window.APP_FEATURES || {};
    
    // Theme preset
    if (config.themePreset) {
        if (config.themePreset === 'custom' && config.customColors) {
            applyCustomHexColors(config.customColors);
        } else {
            selectTheme(config.themePreset);
        }
    }
    
    // AI Support Chat
    const aiChatBtn = document.getElementById('ai-chat-trigger');
    if (aiChatBtn) {
        aiChatBtn.style.display = config.aiChatbot ? 'grid' : 'none';
        if (!config.aiChatbot) {
            const box = document.getElementById('ai-chat-box');
            if (box) box.style.display = 'none';
        }
    }
    
    // Theme Customizer Drawer
    const themeBtn = document.getElementById('theme-trigger-btn');
    if (themeBtn) {
        themeBtn.style.display = config.themeSwitcher ? 'grid' : 'none';
    }
    
    // Multi Language
    const langWrap = document.getElementById('lang-selector-wrap');
    if (langWrap) {
        langWrap.style.display = config.multiLanguage ? 'block' : 'none';
    }
    
    // Announcement Bar
    const annBar = document.getElementById('announcement-bar');
    if (annBar) {
        annBar.style.display = config.announcementBar ? 'block' : 'none';
    }
    
    // Discount Wheel
    const spinBtn = document.getElementById('spin-trigger-btn');
    if (spinBtn) {
        spinBtn.style.display = (config.widgets && config.widgets.discountWheel) ? 'grid' : 'none';
    }
}
window.applyFeatureTogglesUI = applyFeatureTogglesUI;

function renderChatbotChips(chipsStr) {
    const container = document.getElementById('ai-chat-chips');
    if (!container) return;
    if (!chipsStr) {
        container.style.display = 'none';
        return;
    }
    const list = chipsStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
    if (list.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'flex';
    container.innerHTML = list.map(chip => `
        <div class="ai-chat-chip" onclick="sendChatMessageWithText('${chip.replace(/'/g, "\\'")}')">${chip}</div>
    `).join('');
}
window.renderChatbotChips = renderChatbotChips;

function applyFeatureContentUI() {
    const content = window.APP_FEATURES_CONTENT || {};
    
    const annMarquee = document.getElementById('announcement-marquee');
    if (annMarquee) {
        annMarquee.innerText = content.announcementText || "✨ WELCOME TO SWAG STREE STOREFRONT! ✨";
    }
    
    const welcomeText = content.chatbotWelcome || "Hi! How can I help you style your day today?";
    if (typeof I18N_DICTIONARY !== 'undefined' && I18N_DICTIONARY.en) {
        I18N_DICTIONARY.en.ai_chat_welcome = welcomeText;
    }
    
    const chipsStr = content.chatbotChips || "Sizes, Price, Track Order, Discount Code";
    renderChatbotChips(chipsStr);
}
window.applyFeatureContentUI = applyFeatureContentUI;

// Initialize features system
function initAdvancedFeatures() {
    // 1. Restore theme preference fallback
    const savedTheme = localStorage.getItem('swag_theme_pref');
    if (savedTheme) {
        selectTheme(savedTheme);
    }
    
    // 2. Trigger random activity notifications periodically
    setInterval(triggerRecentActivityNotification, 20000);
    
    // 3. Setup Firestore content listener
    if (typeof db !== 'undefined') {
        db.collection("settings").doc("features_content").onSnapshot(doc => {
            if (doc.exists) {
                window.APP_FEATURES_CONTENT = doc.data();
            } else {
                db.collection("settings").doc("features_content").set(window.APP_FEATURES_CONTENT).catch(e => console.log(e));
            }
            applyFeatureContentUI();
            
            // 4. Trigger newsletter popup after the configured delay
            const delaySec = (window.APP_FEATURES_CONTENT && window.APP_FEATURES_CONTENT.newsletterDelay) || 5;
            setTimeout(openNewsletterPopup, delaySec * 1000);
        }, err => {
            console.log("Firestore content listener error:", err);
            applyFeatureContentUI();
            setTimeout(openNewsletterPopup, 5000);
        });
    } else {
        applyFeatureContentUI();
        setTimeout(openNewsletterPopup, 5000);
    }
}
window.initAdvancedFeatures = initAdvancedFeatures;

document.addEventListener('DOMContentLoaded', initAdvancedFeatures);
