// ==========================================
// SWAG STREE | ADVANCED MODERN FEATURES
// ==========================================

// 1. DEFAULT FEATURE CONFIGURATION STATE
window.APP_FEATURES = window.APP_FEATURES || {
    threeSixtyViewer: false,
    aiChatbot: false,
    adminSupportChat: false,
    themeSwitcher: false,
    multiLanguage: false,
    announcementBar: false,
    announcementBell: true,
    productComments: true,
    productCategories: true,
    adminStorefrontContent: true,
    widgets: {
        recentOrders: false,
        discountWheel: false,
        stockCountdown: false,
        newsletterPopup: false
    },
    socialAuth: {
        google: true,
        facebook: true,
        instagram: true,
        phone: true
    },
    catalogControls: {
        home: { search: true, sort: true, announcement: true, chat: true, categories: true },
        wishlist: { search: false, sort: true, announcement: false, chat: false, categories: true }
    }
};

// 2. DICTIONARY FOR MULTI-LANGUAGE
const I18N_DICTIONARY = {
    en: {
        search_placeholder: "Search products...",
        showing_products: "Showing {visible} of {total} Products",
        showing_products_short: "Showing {visible} of {total} Pro...",
        showing_products_compact: "Showing {visible} of {total} Pro...",
        wishlist_title: "My Wishlist",
        cart_title: "Shopping Cart",
        checkout: "Checkout Now",
        add_to_cart: "Add to Cart",
        new_item: "New Item",
        admin_tools: "Admin Tools",
        default_sorting: "Sort: Default",
        low_high: "Price: Low to High",
        high_low: "Price: High to Low",
        newest: "Newest Arrivals",
        best: "Best Selling",
        sort_by: "Sort By:",
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
        showing_products_short: "{total} में से {visible} Pro...",
        showing_products_compact: "{total} में से {visible} Pro...",
        wishlist_title: "मेरी विशलिस्ट",
        cart_title: "शॉपिंग कार्ट",
        checkout: "चेकआउट करें",
        add_to_cart: "कार्ट में जोड़ें",
        new_item: "नया उत्पाद",
        admin_tools: "प्रशासक उपकरण",
        default_sorting: "क्रम: डिफ़ॉल्ट",
        low_high: "कीमत: कम से अधिक",
        high_low: "कीमत: अधिक से कम",
        newest: "नवीनतम आगमन",
        best: "सबसे लोकप्रिय",
        sort_by: "सॉर्ट करें:",
        ai_chat_title: "स्वैग स्त्री सहायता एआई",
        ai_chat_welcome: "नमस्ते! आज मैं आपकी क्या सहायता कर सकता हूँ?",
        spin_wheel_title: "स्पิน करें और जीतें!",
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
        showing_products_short: "Mostrando {visible} de {total} Pro...",
        showing_products_compact: "Mostrando {visible} de {total} Pro...",
        wishlist_title: "Mi Lista",
        cart_title: "Carrito de Compras",
        checkout: "Pagar Ahora",
        add_to_cart: "Añadir al Carrito",
        new_item: "Nuevo Artículo",
        admin_tools: "Herramientas Admin",
        default_sorting: "Orden: Por defecto",
        low_high: "Precio: Bajo a Alto",
        high_low: "Precio: Alto a Bajo",
        newest: "Recién Llegados",
        best: "Más Vendidos",
        sort_by: "Ordenar por:",
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
window.chatHistory = window.chatHistory || [];

function parseMarkdown(text) {
    if (!text) return "";
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
        
    // Bold: **text** or __text__
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    
    // Italic: *text* or _text_
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    
    // Bullet points: list items starting with - or *
    const lines = html.split('\n');
    let inList = false;
    const processedLines = lines.map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            const content = trimmed.substring(2);
            let result = '';
            if (!inList) {
                result += '<ul style="margin: 4px 0; padding-left: 20px;">';
                inList = true;
            }
            result += `<li>${content}</li>`;
            return result;
        } else {
            let result = '';
            if (inList) {
                result += '</ul>';
                inList = false;
            }
            return result + line;
        }
    });
    if (inList) {
        processedLines.push('</ul>');
    }
    
    return processedLines.join('<br>');
}

function generateSystemPrompt(limitLength = false) {
    let catalogContext = "";
    if (window.products && window.products.length > 0) {
        catalogContext = "Here is our product catalog:\n";
        window.products.forEach((p, idx) => {
            if (limitLength && idx >= 3) return;
            const price = p.price;
            const colors = p.sizes && p.sizeColorMap ? Object.values(p.sizeColorMap).flat() : [];
            const uniqueColors = [...new Set(colors)].filter(Boolean).join(', ');
            const uniqueSizes = p.sizes ? p.sizes.join(', ') : '';
            catalogContext += `- Name: ${p.name}, Price: ₹${price}, Colors available: [${uniqueColors}], Sizes: [${uniqueSizes}]\n`;
        });
    } else {
        catalogContext = "The catalog is currently empty.";
    }

    let cartContext = "";
    if (window.cart && window.cart.length > 0) {
        cartContext = "The user currently has these items in their cart:\n";
        window.cart.forEach(item => {
            cartContext += `- ${item.name} (Size: ${item.variantSize || 'Standard'}, Color: ${item.variantColorName || item.variantColor || 'None'}, Qty: ${item.qty})\n`;
        });
    } else {
        cartContext = "The user's shopping cart is currently empty.";
    }

    return `You are "Swag Stree AI Support", a highly professional, helpful, and friendly fashion styling chatbot for the Swag Stree premium clothing e-commerce storefront.
Your goal is to guide visitors, suggest outfits, answer sizing/styling questions, and help them find products.

${catalogContext}

${cartContext}

IMPORTANT GUIDELINES:
1. ALWAYS respond politely, briefly, and professionally. Keep responses within 2-3 concise paragraphs.
2. Recommend products that are actually in the catalog, matching the user's styling or color query.
3. If they ask about sizes or colors, check the catalog to see what colors and sizes are available for that specific item.
4. If they ask to track or check order status, tell them they can view it under the 'Profile & Orders' tab at the top right of the page.
5. If they ask for discounts/coupons, recommend using the code 'WELCOME10' for 10% off, or spinning the Discount Wheel on the screen.
6. Use simple formatting (bullet points, bold text). Keep HTML/Markdown simple (e.g. **bold** or *italic*). Don't use complicated markdown.
7. If the user asks about something completely unrelated to fashion, clothing, Swag Stree, or order help, politely bring the conversation back to how you can help them style their outfits.`;
}

async function getAIResponse() {
    const contentSettings = window.APP_FEATURES_CONTENT || {};
    const engine = contentSettings.chatbotEngine || 'local';

    if (engine === 'local') {
        throw new Error('Local engine does not use cloud AI');
    }

    if (engine === 'gemini' && contentSettings.geminiApiKey) {
        const systemPrompt = generateSystemPrompt(false);
        const recentHistory = window.chatHistory.slice(-10);
        const apiKey = contentSettings.geminiApiKey.trim();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const contents = recentHistory.map(h => ({
            role: h.sender === 'bot' ? 'model' : 'user',
            parts: [{ text: h.text }]
        }));

        const body = {
            contents: contents,
            systemInstruction: {
                parts: [{ text: systemPrompt }]
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch from Gemini API: ${response.status}`);
        }

        const data = await response.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) {
            throw new Error('Invalid or empty response structure from Gemini API');
        }
        return replyText.trim();
    }

    if (engine === 'pollinations') {
        const systemPrompt = generateSystemPrompt(true);
        const recentHistory = window.chatHistory.slice(-6); // Keep history slightly shorter for GET requests
        let promptWithHistory = "";
        recentHistory.forEach((h, index) => {
            if (index === recentHistory.length - 1) {
                promptWithHistory += h.text;
            } else {
                promptWithHistory += `${h.sender === 'bot' ? 'Assistant' : 'User'} says ${h.text}. `;
            }
        });

        const url = `https://text.pollinations.ai/${encodeURIComponent(promptWithHistory)}?system=${encodeURIComponent(systemPrompt)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Failed to fetch from Pollinations AI');
        }

        const text = await response.text();
        return text.trim();
    }

    throw new Error(`Unsupported chatbot engine: ${engine}`);
}

function appendTypingIndicator() {
    const body = document.getElementById('ai-chat-body-ai') || document.getElementById('ai-chat-body');
    if (!body) return null;
    
    const div = document.createElement('div');
    div.id = 'ai-chat-typing';
    div.style.margin = '8px 0';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '10px';
    div.style.maxWidth = '85%';
    div.style.fontSize = '12px';
    div.style.background = 'var(--card)';
    div.style.border = '1px solid var(--border)';
    div.style.color = '#aaa';
    div.style.alignSelf = 'flex-start';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '4px';
    
    div.innerHTML = `
        <span style="font-weight:600;">AI is styling</span>
        <span class="typing-dot" style="animation-delay: 0s;">.</span>
        <span class="typing-dot" style="animation-delay: 0.2s;">.</span>
        <span class="typing-dot" style="animation-delay: 0.4s;">.</span>
    `;
    
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    return div;
}

function removeTypingIndicator() {
    const div = document.getElementById('ai-chat-typing');
    if (div) div.remove();
}

function toggleAIChat() {
    const chatContainer = document.getElementById('ai-chat-box');
    if (!chatContainer) return;
    const isHidden = chatContainer.style.display === 'none' || !chatContainer.style.display;
    chatContainer.style.display = isHidden ? 'flex' : 'none';
    
    if (isHidden && window.chatHistory.length === 0) {
        appendChatMessage('bot', getI18nText('ai_chat_welcome'));
    }
}
window.toggleAIChat = toggleAIChat;
window.getAIResponse = getAIResponse;

function appendChatMessage(sender, text) {
    const body = document.getElementById('ai-chat-body-ai') || document.getElementById('ai-chat-body');
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
        div.innerHTML = parseMarkdown(text);
    } else {
        div.style.background = 'var(--gold)';
        div.style.color = '#000';
        div.style.alignSelf = 'flex-end';
        div.style.marginLeft = 'auto';
        div.innerText = text;
    }
    
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
    window.chatHistory.push({ sender, text });
}

async function handleBotReply(text) {
    const typingIndicator = appendTypingIndicator();
    
    try {
        const reply = await getAIResponse();
        removeTypingIndicator();
        appendChatMessage('bot', reply);
    } catch (error) {
        console.error("Chatbot API Error, falling back to pattern matcher:", error);
        removeTypingIndicator();
        
        // Dynamic resilient local fallback
        setTimeout(() => {
            const query = text.toLowerCase();
            let reply = "I'm not sure about that. Let me connect you with our main WhatsApp support team!";
            
            if (query.includes('hello') || query.includes('hi') || query.includes('hey')) {
                reply = "Hello there! How can I help you find your perfect outfit today?";
            } else if (query.includes('price') || query.includes('cost') || query.includes('how much')) {
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
                const matched = window.products ? window.products.filter(p => p.name.toLowerCase().split(' ').some(w => query.includes(w))) : [];
                if (matched.length > 0) {
                    reply = `We found matching items: ${matched.slice(0, 3).map(p => p.name).join(', ')}. Check them out in the grid!`;
                }
            }
            
            appendChatMessage('bot', reply);
        }, 500);
    }
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
let images360 = [];
let cols360 = 1;
let rows360 = 1;
let currentCol = 0;
let currentRow = 0;
let scale360 = 1;
let panX360 = 0;
let panY360 = 0;
let isDragging360 = false;
let startX360 = 0;
let startY360 = 0;
let lastX360 = 0;
let lastY360 = 0;
let startCol360 = 0;
let startRow360 = 0;
let velocityX360 = 0;
let velocityY360 = 0;
let momentumFrameId = null;
let isAutoRotating360 = false;
let autoRotateFrameId = null;
let preloadedImages360 = [];
let isPreloaded360 = false;
let hasInteracted360 = false;

function open360Viewer(prodId) {
    const p = window.products ? window.products.find(x => x.id === prodId) : null;
    if (!p) return;
    
    const v = window.getSelectedVariant ? window.getSelectedVariant(p) : null;
    
    let isVariant360 = false;
    let active360Img = null;
    let cols = 1;
    let rows = 1;
    
    if (v && v.is360 && v.images && v.images.length >= 2) {
        active360Img = v.images;
        cols = v.threeSixtyCols || v.images.length;
        rows = v.threeSixtyRows || 1;
        isVariant360 = true;
    } else if (p.is360 && p.images && p.images.length >= 2) {
        active360Img = p.images;
        cols = p.threeSixtyCols || p.images.length;
        rows = p.threeSixtyRows || 1;
    }
    
    if (!active360Img || active360Img.length < 2) {
        showToast("Add at least 2 product images to view in 360° mode.");
        return;
    }
    
    images360 = active360Img;
    cols360 = Number(cols) || images360.length;
    rows360 = Number(rows) || 1;
    
    // Adjust cols to fit total length if mismatch
    if (cols360 * rows360 > images360.length) {
        cols360 = Math.floor(images360.length / rows360) || 1;
    }
    
    currentCol = 0;
    currentRow = 0;
    scale360 = 1;
    panX360 = 0;
    panY360 = 0;
    isDragging360 = false;
    isAutoRotating360 = false;
    hasInteracted360 = false;
    
    // Inject and open Modal
    let modal = document.getElementById('viewer-360-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'viewer-360-modal';
        modal.style.position = 'fixed';
        modal.style.inset = '0';
        modal.style.background = '#0a0a0a';
        modal.style.zIndex = '999999';
        modal.style.display = 'flex';
        modal.style.flexDirection = 'column';
        modal.style.alignItems = 'center';
        modal.style.justifyContent = 'center';
        
        modal.innerHTML = `
            <div style="position:absolute; top:20px; right:20px; width:44px; height:44px; border-radius:50%; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); color:#fff; display:flex; align-items:center; justify-content:center; font-size:22px; cursor:pointer; z-index:1000; transition:all 0.2s; backdrop-filter:blur(8px);" onclick="close360Viewer()" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">&times;</div>
            
            <div style="position:absolute; top:30px; left:30px; z-index:10; font-family:'Outfit', sans-serif;">
                <h3 style="color:#fff; margin:0; font-size:16px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">360° Interactive 3D Spin</h3>
                <p id="viewer-360-instructions" style="color:var(--gold); margin:4px 0 0 0; font-size:11px; letter-spacing:0.5px; opacity:0.8;">Drag in any direction to explore</p>
            </div>
            
            <div id="rotate-area" style="width:100vw; height:100vh; display:flex; align-items:center; justify-content:center; overflow:hidden; cursor:grab; position:relative;">
                <div id="360-preloader" style="position:absolute; inset:0; background:#0a0a0a; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:50;">
                    <div class="spinner-360" style="width:50px; height:50px; border:3px solid rgba(255,215,0,0.1); border-top:3px solid var(--gold); border-radius:50%; animation:spin-360 1s linear infinite; margin-bottom:15px;"></div>
                    <p id="360-preload-status" style="color:#fff; font-size:12px; font-weight:600; letter-spacing:1px;">Loading 3D View... 0%</p>
                </div>
                
                <div id="360-gesture-guide" style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:40; pointer-events:none; background:rgba(0,0,0,0.5); transition:opacity 0.5s;">
                    <div style="text-align:center; animation:pulse-gesture 2.5s infinite; display:flex; flex-direction:column; align-items:center; gap:10px;">
                        <i class="fa fa-hand-pointer" style="font-size:40px; color:var(--gold); filter:drop-shadow(0 0 10px rgba(255,215,0,0.5));"></i>
                        <p style="color:#fff; font-size:12px; font-weight:700; margin:5px 0 0 0; text-transform:uppercase; letter-spacing:1px;">Drag in any direction</p>
                    </div>
                </div>
                
                <img id="image-360-frame" style="max-width:90%; max-height:80%; object-fit:contain; transform: scale(1) translate(0px, 0px); transition: transform 0.1s ease-out; pointer-events:none; user-select:none;" src="" draggable="false">
            </div>
            
            <div style="position:absolute; bottom:40px; left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:12px; background:rgba(15,15,15,0.7); border:1px solid rgba(255,215,0,0.3); padding:10px 20px; border-radius:30px; backdrop-filter:blur(12px); box-shadow:0 8px 32px rgba(0,0,0,0.5); z-index:100;">
                <button onclick="toggleAutoRotate360()" id="btn-360-play" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; outline:none;" title="Auto Spin"><i class="fa fa-play" style="color:var(--gold);"></i></button>
                <div style="width:1px; height:20px; background:rgba(255,255,255,0.15);"></div>
                <button onclick="zoom360(-0.5)" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; outline:none;" title="Zoom Out"><i class="fa fa-minus"></i></button>
                <button onclick="zoom360(0.5)" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; outline:none;" title="Zoom In"><i class="fa fa-plus"></i></button>
                <button onclick="reset360()" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; outline:none;" title="Reset View"><i class="fa fa-rotate-left"></i></button>
                <div style="width:1px; height:20px; background:rgba(255,255,255,0.15);"></div>
                <button onclick="toggleFullscreen360()" style="background:none; border:none; color:#fff; font-size:16px; cursor:pointer; width:36px; height:36px; display:flex; align-items:center; justify-content:center; transition:all 0.2s; outline:none;" title="Fullscreen"><i class="fa fa-expand"></i></button>
            </div>
        `;
        document.body.appendChild(modal);
        
        const area = document.getElementById('rotate-area');
        area.addEventListener('mousedown', startRotateDrag);
        area.addEventListener('mousemove', moveRotateDrag);
        area.addEventListener('mouseup', endRotateDrag);
        area.addEventListener('mouseleave', endRotateDrag);
        
        area.addEventListener('touchstart', startRotateDrag, {passive: true});
        area.addEventListener('touchmove', moveRotateDrag, {passive: true});
        area.addEventListener('touchend', endRotateDrag);
        
        area.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.2 : -0.2;
            zoom360(delta);
        }, {passive: false});
    } else {
        const guide = document.getElementById('360-gesture-guide');
        if (!guide) {
            const rotateArea = document.getElementById('rotate-area');
            const g = document.createElement('div');
            g.id = '360-gesture-guide';
            g.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:40; pointer-events:none; background:rgba(0,0,0,0.5); transition:opacity 0.5s;';
            g.innerHTML = `
                <div style="text-align:center; animation:pulse-gesture 2.5s infinite; display:flex; flex-direction:column; align-items:center; gap:10px;">
                    <i class="fa fa-hand-pointer" style="font-size:40px; color:var(--gold); filter:drop-shadow(0 0 10px rgba(255,215,0,0.5));"></i>
                    <p style="color:#fff; font-size:12px; font-weight:700; margin:5px 0 0 0; text-transform:uppercase; letter-spacing:1px;">Drag in any direction</p>
                </div>
            `;
            rotateArea.appendChild(g);
        } else {
            guide.style.opacity = '1';
        }
        
        const preloader = document.getElementById('360-preloader');
        if (preloader) preloader.style.display = 'flex';
        
        const playBtn = document.getElementById('btn-360-play');
        if (playBtn) playBtn.innerHTML = `<i class="fa fa-play" style="color:var(--gold);"></i>`;
    }
    
    modal.style.display = 'flex';
    update360Frame();
    
    let loadedCount = 0;
    const total = images360.length;
    preloadedImages360 = [];
    isPreloaded360 = false;
    
    const statusText = document.getElementById('360-preload-status');
    if (statusText) statusText.textContent = `Loading 3D View... 0%`;
    
    images360.forEach((url, idx) => {
        const img = new Image();
        img.src = url;
        img.onload = () => {
            preloadedImages360[idx] = img;
            loadedCount++;
            const pct = Math.round((loadedCount / total) * 100);
            if (statusText) statusText.textContent = `Loading 3D View... ${pct}%`;
            if (loadedCount >= total) {
                const preloader = document.getElementById('360-preloader');
                if (preloader) preloader.style.display = 'none';
                isPreloaded360 = true;
            }
        };
        img.onerror = () => {
            loadedCount++;
            const pct = Math.round((loadedCount / total) * 100);
            if (statusText) statusText.textContent = `Loading 3D View... ${pct}%`;
            if (loadedCount >= total) {
                const preloader = document.getElementById('360-preloader');
                if (preloader) preloader.style.display = 'none';
                isPreloaded360 = true;
            }
        };
    });
}
window.open360Viewer = open360Viewer;

function close360Viewer() {
    const modal = document.getElementById('viewer-360-modal');
    if (modal) modal.style.display = 'none';
    stopAutoRotate360();
    cancelAnimationFrame(momentumFrameId);
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
}
window.close360Viewer = close360Viewer;

function update360Frame() {
    const imgEl = document.getElementById('image-360-frame');
    if (!imgEl || images360.length === 0) return;
    let index = currentRow * cols360 + currentCol;
    if (index >= images360.length) index = images360.length - 1;
    if (index < 0) index = 0;
    imgEl.src = images360[index];
}

function startRotateDrag(e) {
    cancelAnimationFrame(momentumFrameId);
    stopAutoRotate360();
    
    if (!hasInteracted360) {
        hasInteracted360 = true;
        const guide = document.getElementById('360-gesture-guide');
        if (guide) guide.style.opacity = '0';
        setTimeout(() => {
            if (guide) guide.remove();
        }, 500);
    }
    
    isDragging360 = true;
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    
    startX360 = clientX;
    startY360 = clientY;
    lastX360 = clientX;
    lastY360 = clientY;
    
    startCol360 = currentCol;
    startRow360 = currentRow;
    
    velocityX360 = 0;
    velocityY360 = 0;
    
    const area = document.getElementById('rotate-area');
    if (area) area.style.cursor = 'grabbing';
}

function moveRotateDrag(e) {
    if (!isDragging360) return;
    
    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    
    const diffX = clientX - startX360;
    const diffY = clientY - startY360;
    
    if (scale360 > 1) {
        panX360 += (clientX - lastX360);
        panY360 += (clientY - lastY360);
        
        const maxPanX = (scale360 - 1) * 300;
        const maxPanY = (scale360 - 1) * 300;
        panX360 = Math.max(-maxPanX, Math.min(maxPanX, panX360));
        panY360 = Math.max(-maxPanY, Math.min(maxPanY, panY360));
        
        update360Transform();
    } else {
        const sensitivityX = 12;
        const sensitivityY = 20;
        
        const colOffset = Math.round(diffX / sensitivityX);
        const rowOffset = Math.round(diffY / sensitivityY);
        
        const mod = (n, m) => ((n % m) + m) % m;
        
        const nextCol = mod(startCol360 + colOffset, cols360);
        const nextRow = Math.max(0, Math.min(rows360 - 1, startRow360 - rowOffset));
        
        if (nextCol !== currentCol || nextRow !== currentRow) {
            currentCol = nextCol;
            currentRow = nextRow;
            update360Frame();
        }
    }
    
    velocityX360 = clientX - lastX360;
    velocityY360 = clientY - lastY360;
    
    lastX360 = clientX;
    lastY360 = clientY;
}

function endRotateDrag() {
    if (!isDragging360) return;
    isDragging360 = false;
    
    const area = document.getElementById('rotate-area');
    if (area) area.style.cursor = 'grab';
    
    if (scale360 === 1 && (Math.abs(velocityX360) > 1 || Math.abs(velocityY360) > 1)) {
        applyMomentum360();
    }
}

function applyMomentum360() {
    cancelAnimationFrame(momentumFrameId);
    
    const friction = 0.95;
    const sensitivityX = 12;
    const sensitivityY = 20;
    
    let accumulatedX = 0;
    let accumulatedY = 0;
    
    function step() {
        velocityX360 *= friction;
        velocityY360 *= friction;
        
        accumulatedX += velocityX360;
        accumulatedY -= velocityY360;
        
        const colChange = Math.round(accumulatedX / sensitivityX);
        const rowChange = Math.round(accumulatedY / sensitivityY);
        
        if (colChange !== 0) {
            const mod = (n, m) => ((n % m) + m) % m;
            currentCol = mod(currentCol + colChange, cols360);
            accumulatedX = 0;
        }
        
        if (rowChange !== 0) {
            currentRow = Math.max(0, Math.min(rows360 - 1, currentRow + rowChange));
            accumulatedY = 0;
        }
        
        update360Frame();
        
        if (Math.abs(velocityX360) > 0.1 || Math.abs(velocityY360) > 0.1) {
            momentumFrameId = requestAnimationFrame(step);
        }
    }
    
    momentumFrameId = requestAnimationFrame(step);
}

function update360Transform() {
    const imgEl = document.getElementById('image-360-frame');
    if (imgEl) {
        imgEl.style.transform = `scale(${scale360}) translate(${panX360 / scale360}px, ${panY360 / scale360}px)`;
    }
}

function zoom360(delta) {
    cancelAnimationFrame(momentumFrameId);
    scale360 = Math.max(1, Math.min(3, scale360 + delta));
    if (scale360 === 1) {
        panX360 = 0;
        panY360 = 0;
    }
    update360Transform();
}
window.zoom360 = zoom360;

function reset360() {
    cancelAnimationFrame(momentumFrameId);
    stopAutoRotate360();
    currentCol = 0;
    currentRow = 0;
    scale360 = 1;
    panX360 = 0;
    panY360 = 0;
    update360Frame();
    update360Transform();
}
window.reset360 = reset360;

function toggleAutoRotate360() {
    if (isAutoRotating360) {
        stopAutoRotate360();
    } else {
        isAutoRotating360 = true;
        const btn = document.getElementById('btn-360-play');
        if (btn) btn.innerHTML = `<i class="fa fa-pause" style="color:var(--gold);"></i>`;
        
        cancelAnimationFrame(momentumFrameId);
        
        let lastTime = performance.now();
        const interval = 120;
        
        function rotateStep(timestamp) {
            if (!isAutoRotating360) return;
            
            if (timestamp - lastTime >= interval) {
                currentCol = (currentCol + 1) % cols360;
                update360Frame();
                lastTime = timestamp;
            }
            autoRotateFrameId = requestAnimationFrame(rotateStep);
        }
        
        autoRotateFrameId = requestAnimationFrame(rotateStep);
    }
}
window.toggleAutoRotate360 = toggleAutoRotate360;

function stopAutoRotate360() {
    isAutoRotating360 = false;
    cancelAnimationFrame(autoRotateFrameId);
    const btn = document.getElementById('btn-360-play');
    if (btn) btn.innerHTML = `<i class="fa fa-play" style="color:var(--gold);"></i>`;
}

function toggleFullscreen360() {
    const modal = document.getElementById('viewer-360-modal');
    if (!modal) return;
    
    if (!document.fullscreenElement) {
        modal.requestFullscreen().catch(err => {
            console.log("Error attempting to enable full-screen mode:", err);
        });
    } else {
        document.exitFullscreen().catch(() => {});
    }
}
window.toggleFullscreen360 = toggleFullscreen360;

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
    chatbotEngine: 'local',
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

const FEATURES_CONFIG_CACHE_KEY = 'swag_features_config';

function cacheFeaturesConfig(config) {
    try {
        if (config && typeof config === 'object') {
            localStorage.setItem(FEATURES_CONFIG_CACHE_KEY, JSON.stringify(config));
        }
    } catch (e) {}
}
window.cacheFeaturesConfig = cacheFeaturesConfig;

function hydrateFeaturesFromCache() {
    try {
        const raw = localStorage.getItem(FEATURES_CONFIG_CACHE_KEY);
        if (!raw) return false;
        const cached = JSON.parse(raw);
        if (cached && typeof cached === 'object') {
            window.APP_FEATURES = { ...window.APP_FEATURES, ...normalizeSupportChatFeatures(cached) };
            window._featuresUiApplied = true;
            return true;
        }
    } catch (e) {}
    return false;
}

function normalizeSupportChatFeatures(config) {
    const c = config && typeof config === 'object' ? { ...config } : {};
    if (c.adminSupportChat === undefined && c.aiChatbot !== undefined) {
        c.adminSupportChat = !!c.aiChatbot;
    }
    return c;
}

function isSupportChatGloballyEnabled(config) {
    const c = normalizeSupportChatFeatures(config || window.APP_FEATURES || {});
    return !!(c.aiChatbot || c.adminSupportChat);
}

function normalizeCatalogControls(config) {
    const c = config && typeof config === 'object' ? config : {};
    const chatGlobal = isSupportChatGloballyEnabled(c);
    const annGlobal = c.announcementBell !== false;
    const defaults = {
        home: { search: true, sort: true, announcement: annGlobal, chat: chatGlobal, categories: true },
        wishlist: { search: false, sort: true, announcement: false, chat: false, categories: true }
    };
    const saved = c.catalogControls || {};
    return {
        home: { ...defaults.home, ...(saved.home || {}) },
        wishlist: { ...defaults.wishlist, ...(saved.wishlist || {}) }
    };
}
window.normalizeCatalogControls = normalizeCatalogControls;

function isAdminStorefrontContentEnabled() {
    return !!(window.APP_FEATURES && window.APP_FEATURES.adminStorefrontContent !== false);
}
window.isAdminStorefrontContentEnabled = isAdminStorefrontContentEnabled;

function applyAdminPanelVisibility() {
    const section = document.getElementById('admin-feature-content-settings');
    if (!section) return;
    const show = typeof isAdmin !== 'undefined' && isAdmin && isAdminStorefrontContentEnabled();
    section.style.display = show ? '' : 'none';
}
window.applyAdminPanelVisibility = applyAdminPanelVisibility;

function isCatalogControlEnabled(view, feature) {
    const config = window.APP_FEATURES || {};
    const cc = normalizeCatalogControls(config);
    const viewKey = view === 'wishlist' ? 'wishlist' : 'home';
    const enabled = cc[viewKey]?.[feature];
    if (feature === 'categories') {
        return config.productCategories !== false && enabled !== false;
    }
    if (feature === 'chat') return isSupportChatGloballyEnabled(config) && enabled;
    if (feature === 'announcement') return config.announcementBell !== false && enabled;
    return enabled;
}
window.isCatalogControlEnabled = isCatalogControlEnabled;

function syncCatalogControlCheckboxes(config) {
    const cc = normalizeCatalogControls(config || window.APP_FEATURES || {});
    const map = [
        ['toggle-home-search', cc.home.search],
        ['toggle-home-sort', cc.home.sort],
        ['toggle-home-announcement', cc.home.announcement],
        ['toggle-home-chat', cc.home.chat],
        ['toggle-home-categories', cc.home.categories],
        ['toggle-wish-search', cc.wishlist.search],
        ['toggle-wish-sort', cc.wishlist.sort],
        ['toggle-wish-announcement', cc.wishlist.announcement],
        ['toggle-wish-chat', cc.wishlist.chat],
        ['toggle-wish-categories', cc.wishlist.categories]
    ];
    map.forEach(([id, checked]) => {
        const el = document.getElementById(id);
        if (el) el.checked = !!checked;
    });
}
window.syncCatalogControlCheckboxes = syncCatalogControlCheckboxes;

function syncCatalogControlsReady() {
    if (!document.body) return;
    if (!window._featuresUiApplied) return;
    if (!window.productsLoaded) return;
    if (window._announcementsHydrated !== true) return;
    document.body.classList.remove('catalog-controls-pending');
    if (typeof updateCatalogControlsRowLayout === 'function') updateCatalogControlsRowLayout();
    if (typeof updateAnnouncementBellUI === 'function') updateAnnouncementBellUI();
    if (typeof renderHomeCategoryBar === 'function') renderHomeCategoryBar();
    if (typeof renderWishCategoryBar === 'function') renderWishCategoryBar();
}
window.syncCatalogControlsReady = syncCatalogControlsReady;

function applyCatalogControlsVisibility() {
    const config = window.APP_FEATURES || {};
    const cc = normalizeCatalogControls(config);
    const chatGlobal = isSupportChatGloballyEnabled(config);
    const annGlobal = config.announcementBell !== false;

    const homeSearch = document.querySelector('#home-view .home-search-wrap');
    if (homeSearch) homeSearch.style.display = cc.home.search ? '' : 'none';

    const wishSearch = document.getElementById('wish-search-wrap');
    if (wishSearch) wishSearch.style.display = cc.wishlist.search ? '' : 'none';

    const homeChat = document.getElementById('header-support-chat-btn');
    const wishChat = document.getElementById('wish-header-support-chat-btn');
    const showHomeChat = chatGlobal && cc.home.chat;
    const showWishChat = chatGlobal && cc.wishlist.chat;
    if (homeChat) {
        homeChat.style.display = showHomeChat ? 'flex' : 'none';
        homeChat.classList.toggle('catalog-action-hidden', !showHomeChat);
    }
    if (wishChat) {
        wishChat.style.display = showWishChat ? 'flex' : 'none';
        wishChat.classList.toggle('catalog-action-hidden', !showWishChat);
    }
    if (!chatGlobal) {
        const box = document.getElementById('ai-chat-box');
        if (box) box.style.display = 'none';
    }

    const homeBell = document.getElementById('announcement-bell-btn');
    const wishBell = document.getElementById('wish-announcement-bell-btn');
    const showHomeAnn = annGlobal && cc.home.announcement;
    const showWishAnn = annGlobal && cc.wishlist.announcement;
    if (homeBell) {
        homeBell.style.display = showHomeAnn ? 'flex' : 'none';
        homeBell.classList.toggle('catalog-action-hidden', !showHomeAnn);
    }
    if (wishBell) {
        wishBell.style.display = showWishAnn ? 'flex' : 'none';
        wishBell.classList.toggle('catalog-action-hidden', !showWishAnn);
    }

    const homeSort = document.getElementById('sort-logic-container');
    const wishSort = document.getElementById('wish-sort-logic-container');
    if (homeSort && homeSort.style.display !== 'none' && !cc.home.sort) {
        homeSort.style.display = 'none';
    }
    if (wishSort && wishSort.style.display !== 'none' && !cc.wishlist.sort) {
        wishSort.style.display = 'none';
    }

    window._featuresUiApplied = true;
    if (typeof updateCatalogControlsRowLayout === 'function') updateCatalogControlsRowLayout();
    if (typeof renderHomeCategoryBar === 'function') renderHomeCategoryBar();
    if (typeof renderWishCategoryBar === 'function') renderWishCategoryBar();
    if (typeof renderCategoryFilterChips === 'function') renderCategoryFilterChips();
    syncCatalogControlsReady();
}
window.applyCatalogControlsVisibility = applyCatalogControlsVisibility;

function applyFeaturesConfigFromFirestore(data) {
    if (data && typeof data === 'object') {
        window.APP_FEATURES = { ...window.APP_FEATURES, ...normalizeSupportChatFeatures(data) };
    }
    cacheFeaturesConfig(window.APP_FEATURES);
    applyFeatureTogglesUI();
}

function startFeaturesConfigListener() {
    if (window._featuresConfigListenerStarted || typeof db === 'undefined') return;
    window._featuresConfigListenerStarted = true;
    db.collection('settings').doc('features_config').onSnapshot(doc => {
        if (doc.exists) {
            applyFeaturesConfigFromFirestore(doc.data());
        } else {
            db.collection('settings').doc('features_config').set(window.APP_FEATURES).catch(() => {});
            cacheFeaturesConfig(window.APP_FEATURES);
            applyFeatureTogglesUI();
        }
    }, err => {
        console.log('Firestore features listener error, using local defaults:', err);
        applyFeatureTogglesUI();
    });
}
window.startFeaturesConfigListener = startFeaturesConfigListener;

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
    
    // AI Support Chat — per-tab visibility handled in applyCatalogControlsVisibility
    const floatBtn = document.getElementById('ai-chat-trigger');
    if (floatBtn) floatBtn.style.display = 'none';
    if (typeof applySupportChatTabsVisibility === 'function') applySupportChatTabsVisibility();
    
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
    
    // Announcement Bar & Bell Icon
    const annBar = document.getElementById('announcement-bar');
    if (annBar) {
        annBar.style.display = config.announcementBar !== false ? 'block' : 'none';
    }
    const bellBtn = document.getElementById('announcement-bell-btn');
    if (bellBtn && config.announcementBell === false) {
        bellBtn.style.display = 'none';
        bellBtn.classList.add('catalog-action-hidden');
    }
    
    // Discount Wheel
    const spinBtn = document.getElementById('spin-trigger-btn');
    if (spinBtn) {
        spinBtn.style.display = (config.widgets && config.widgets.discountWheel) ? 'grid' : 'none';
    }

    // Admin 360 Viewer Controls
    const is360Enabled = !!config.threeSixtyViewer;
    const admin360Container = document.getElementById('m-is360-container');
    if (admin360Container) {
        admin360Container.style.display = is360Enabled ? 'flex' : 'none';
    }
    const admin360Grid = document.getElementById('m-360-grid-settings');
    if (admin360Grid) {
        if (!is360Enabled) {
            admin360Grid.style.display = 'none';
        } else {
            const mIs360 = document.getElementById('m-is360');
            admin360Grid.style.display = (mIs360 && mIs360.checked) ? 'flex' : 'none';
        }
    }
    if (typeof renderVariantBlocks === 'function' && document.getElementById('m-variants-container')) {
        renderVariantBlocks();
    }

    // Sync Superadmin panel checkboxes/inputs reactively
    if (typeof isSuperAdmin !== 'undefined' && isSuperAdmin) {
        const themeSel = document.getElementById('super-theme-select');
        if (themeSel) themeSel.value = config.themePreset || 'outlaw';
        if (config.customColors) {
            if (document.getElementById('picker-bg')) document.getElementById('picker-bg').value = config.customColors.bg || '#000000';
            if (document.getElementById('picker-card')) document.getElementById('picker-card').value = config.customColors.card || '#111111';
            if (document.getElementById('picker-gold')) document.getElementById('picker-gold').value = config.customColors.gold || '#ffd700';
            if (document.getElementById('picker-border')) document.getElementById('picker-border').value = config.customColors.border || '#222222';
            if (document.getElementById('picker-accent')) document.getElementById('picker-accent').value = config.customColors.accent || '#ffd700';
            if (document.getElementById('picker-text')) document.getElementById('picker-text').value = config.customColors.text || '#ffffff';
        }
        if (document.getElementById('toggle-ai-chat')) document.getElementById('toggle-ai-chat').checked = !!config.aiChatbot;
        if (document.getElementById('toggle-admin-support-chat')) {
            document.getElementById('toggle-admin-support-chat').checked = !!normalizeSupportChatFeatures(config).adminSupportChat;
        }
        if (document.getElementById('toggle-360-viewer')) document.getElementById('toggle-360-viewer').checked = !!config.threeSixtyViewer;
        if (document.getElementById('toggle-theme-picker')) document.getElementById('toggle-theme-picker').checked = !!config.themeSwitcher;
        if (document.getElementById('toggle-language')) document.getElementById('toggle-language').checked = !!config.multiLanguage;
        if (document.getElementById('toggle-announcement')) document.getElementById('toggle-announcement').checked = config.announcementBar !== false;
        if (document.getElementById('toggle-announcement-bell')) document.getElementById('toggle-announcement-bell').checked = config.announcementBell !== false;
        if (config.widgets) {
            if (document.getElementById('toggle-discount-wheel')) document.getElementById('toggle-discount-wheel').checked = !!config.widgets.discountWheel;
            if (document.getElementById('toggle-recent-orders')) document.getElementById('toggle-recent-orders').checked = !!config.widgets.recentOrders;
            if (document.getElementById('toggle-newsletter')) document.getElementById('toggle-newsletter').checked = !!config.widgets.newsletterPopup;
        }
        if (document.getElementById('toggle-product-comments')) {
            document.getElementById('toggle-product-comments').checked = config.productComments !== false;
        }
        if (document.getElementById('toggle-product-categories')) {
            document.getElementById('toggle-product-categories').checked = config.productCategories !== false;
        }
        if (document.getElementById('toggle-admin-storefront-content')) {
            document.getElementById('toggle-admin-storefront-content').checked = config.adminStorefrontContent !== false;
        }
        syncCatalogControlCheckboxes(config);
    }

    applyAdminPanelVisibility();

    if (typeof populateProductCategorySelect === 'function') {
        populateProductCategorySelect(
            document.getElementById('m-category-checkboxes')
                ? [...document.getElementById('m-category-checkboxes').querySelectorAll('input[type="checkbox"]:checked')].map(el => el.value)
                : []
        );
    }
    if (typeof renderAdminCategoryList === 'function') renderAdminCategoryList();
    if (typeof renderHomeCategoryBar === 'function') renderHomeCategoryBar();
    if (typeof renderWishCategoryBar === 'function') renderWishCategoryBar();
    if (typeof renderCategoryFilterChips === 'function') renderCategoryFilterChips();

    applyCatalogControlsVisibility();
    if (typeof updateSupportChatVisibility === 'function') updateSupportChatVisibility();
    if (typeof updateAnnouncementBellUI === 'function') updateAnnouncementBellUI();
    if (typeof refreshCommentsEnabledUI === 'function') {
        refreshCommentsEnabledUI(false);
    }
}
window.applyFeatureTogglesUI = applyFeatureTogglesUI;

hydrateFeaturesFromCache();
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyFeatureTogglesUI(), { once: true });
    } else {
        applyFeatureTogglesUI();
    }
}

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
