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


// 5. UNIFIED MEDIA VIEWER (Zoom + 360° Spin + Video)
let mvState = {
    mode: 'gallery',
    images: [],
    imageIndex: 0,
    spinFrames: [],
    spinIndex: 0,
    spinCol: 0,
    spinRow: 0,
    spinCols: 1,
    spinRows: 1,
    panoramaImages: [],
    panoramaIndex: 0,
    pannellumInstance: null,
    videojsPlayer: null,
    videoUrl: '',
    videoSavedAs360: false,
    videoLikelyEquirectangular: null,
    videoAllowModeSwitch: false,
    title: '',
    scale: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startSpinCol: 0,
    velocityX: 0,
    momentumId: null,
    autoSpin: false,
    autoSpinId: null,
    guideShown: false,
    isPinching: false,
    pinchStartDist: 0,
    pinchStartScale: 1,
    lastTapAt: 0,
    spinAccumX: 0
};

function mvIsCoarsePointer() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}

const MV_MODAL_DOM_VERSION = 6;

function mvSpinPixelsPerFrame() {
    return mvIsCoarsePointer() ? 220 : 64;
}

function mvNormalizeSpinGrid() {
    const n = mvState.spinFrames.length;
    if (n < 1) return;
    mvState.spinCols = n;
    mvState.spinRows = 1;
    mvState.spinIndex = Math.max(0, Math.min(n - 1, mvState.spinIndex || 0));
    mvState.spinCol = mvState.spinIndex;
    mvState.spinRow = 0;
}

function mvSetSpinIndex(idx) {
    const n = mvState.spinFrames.length;
    if (n < 1) return;
    const next = ((idx % n) + n) % n;
    if (next === mvState.spinIndex) return;
    mvState.spinIndex = next;
    mvState.spinCol = next;
    mvState.spinRow = 0;
    const imgEl = document.getElementById('mv-image');
    if (imgEl) {
        imgEl.style.opacity = '0.55';
    }
    renderMediaViewerContent();
    if (imgEl) {
        requestAnimationFrame(() => {
            imgEl.style.opacity = '1';
        });
    }
}

function mvStepSpin(dir) {
    if (mvState.mode !== 'spin360' || mvState.spinFrames.length < 2) return;
    cancelAnimationFrame(mvState.momentumId);
    mvState.spinAccumX = 0;
    mvSetSpinIndex(mvState.spinIndex + dir);
}

function mvTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
}

function updateMediaViewerHints() {
    const hintEl = document.getElementById('mv-hint');
    const guideText = document.getElementById('mv-guide-text');
    const frameLabel = document.getElementById('mv-frame-label');
    const guideIcon = document.getElementById('mv-guide-icon');
    const isVideo = mvState.mode === 'video';
    const isVideo360 = mvState.mode === 'video360';
    const isSpin = mvState.mode === 'spin360';
    const isPanorama = mvState.mode === 'panorama360';

    if (guideIcon) {
        guideIcon.className = isVideo360 || isPanorama ? 'fa fa-street-view' : (isSpin ? 'fa fa-arrows-left-right' : (isVideo ? 'fa fa-play' : 'fa fa-magnifying-glass-plus'));
    }

    if (hintEl) {
        if (isVideo) hintEl.textContent = 'Normal video playback';
        else if (isVideo360) hintEl.textContent = 'Drag to look around while the video plays';
        else if (isPanorama) hintEl.textContent = 'Drag to look around — like Google Street View';
        else if (isSpin) hintEl.textContent = 'Swipe left or right to rotate the product';
        else hintEl.textContent = 'Pinch or +/− to zoom';
    }
    if (guideText) {
        if (isVideo) guideText.textContent = 'Tap play on the video';
        else if (isVideo360) guideText.textContent = 'Move your finger to explore the 360° video';
        else if (isPanorama) guideText.textContent = 'Move your finger to look around the scene';
        else guideText.textContent = isSpin
            ? 'Swipe to see the product from different angles'
            : 'Pinch or tap + to zoom in';
    }
    const modeDesc = document.getElementById('mv-mode-desc');
    if (modeDesc) {
        let desc = '';
        if (isSpin) {
            desc = 'Swipe to rotate — each frame is one step around the product';
        } else if (isPanorama) {
            const url = mvState.panoramaImages[mvState.panoramaIndex];
            const isDemo = mvIsDemoPanoramaUrl(url);
            desc = isDemo
                ? 'Demo scenery only — upload your own 360° camera photo in Admin for your product'
                : 'Look around — full 360° room view (from a 360° camera, not product spin)';
        } else if (isVideo) {
            desc = 'Flat video — your normal product clip';
        } else if (isVideo360) {
            desc = 'Immersive 360° video — drag to look around';
        }
        modeDesc.textContent = desc;
        modeDesc.style.display = desc ? 'block' : 'none';
    }
    if (frameLabel) {
        if (isVideo) {
            frameLabel.textContent = 'Video';
            frameLabel.style.display = 'block';
        } else if (isVideo360) {
            frameLabel.textContent = '360° Video';
            frameLabel.style.display = 'block';
        } else if (isPanorama && mvState.panoramaImages.length) {
            const sceneLabel = mvState.panoramaImages.length > 1
                ? `Look around · Scene ${mvState.panoramaIndex + 1} / ${mvState.panoramaImages.length}`
                : 'Look around';
            frameLabel.textContent = sceneLabel;
            frameLabel.style.display = 'block';
        } else if (isSpin && mvState.spinFrames.length) {
            frameLabel.textContent = `Rotate · frame ${mvState.spinIndex + 1} of ${mvState.spinFrames.length}`;
            frameLabel.style.display = 'block';
        } else if (!isVideo && mvState.images.length > 1 && mvState.mode === 'gallery') {
            frameLabel.textContent = `Photo ${mvState.imageIndex + 1} / ${mvState.images.length}`;
            frameLabel.style.display = 'block';
        } else {
            frameLabel.textContent = '';
            frameLabel.style.display = 'none';
        }
    }
    updateMediaViewerToolbar();
    mvUpdateModeSwitcher();
    mvUpdateVideoModeSwitcher();
    mvUpdatePanoramaSceneNav();
}

function updateMediaViewerToolbar() {
    const isVideo = mvState.mode === 'video';
    const isVideo360 = mvState.mode === 'video360';
    const isPanorama = mvState.mode === 'panorama360';
    document.querySelectorAll('.mv-toolbar-zoom').forEach(el => {
        el.style.display = (isVideo || isVideo360 || isPanorama) ? 'none' : '';
    });
    const dividerZoom = document.getElementById('mv-divider-zoom');
    if (dividerZoom) dividerZoom.style.display = (isVideo || isVideo360 || isPanorama) ? 'none' : '';
    const spinTools = ['mv-btn-play', 'mv-btn-step-back', 'mv-btn-step-fwd', 'mv-divider-spin'];
    spinTools.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = (mvState.mode === 'spin360') ? (id === 'mv-divider-spin' ? 'inline-block' : 'flex') : 'none';
    });
}

function ensureMediaViewerModal() {
    let modal = document.getElementById('media-viewer-modal');
    const domOk = modal
        && modal.getAttribute('data-mv-version') === String(MV_MODAL_DOM_VERSION)
        && modal.querySelector('.mv-topbar')
        && modal.querySelector('#mv-btn-step-back')
        && modal.querySelector('#mv-mode-desc');
    if (modal && !domOk) {
        modal.remove();
        modal = null;
    }
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'media-viewer-modal';
    modal.className = 'media-viewer-modal';
    modal.setAttribute('data-mv-version', String(MV_MODAL_DOM_VERSION));
        modal.innerHTML = `
        <div class="mv-topbar">
            <div class="mv-topbar-text">
                <h3 id="mv-title">Product View</h3>
                <p id="mv-hint">Pinch or use +/− to zoom</p>
            </div>
            <button class="mv-close" onclick="closeMediaViewer()" aria-label="Close">&times;</button>
        </div>
        <div id="mv-stage" class="mv-stage">
            <div id="mv-loader" class="mv-loader">
                <div class="spinner-360"></div>
                <p id="mv-load-status">Loading...</p>
            </div>
            <img id="mv-image" class="mv-image" src="" alt="" draggable="false">
            <div id="mv-panorama" class="mv-panorama" style="display:none;"></div>
            <video id="mv-video" class="mv-video" playsinline controls style="display:none;"></video>
            <div id="mv-guide" class="mv-guide">
                <i class="fa fa-arrows-left-right" id="mv-guide-icon"></i>
                <p id="mv-guide-text">Swipe left or right to spin the product</p>
            </div>
            <button type="button" id="mv-prev" class="mv-nav mv-prev" style="display:none;" aria-label="Previous frame"><i class="fa fa-chevron-left"></i></button>
            <button type="button" id="mv-next" class="mv-nav mv-next" style="display:none;" aria-label="Next frame"><i class="fa fa-chevron-right"></i></button>
        </div>
        <div class="mv-bottom">
            <div id="mv-mode-switcher" class="mv-mode-switcher" style="display:none;">
                <button type="button" id="mv-mode-spin" class="mv-mode-btn" onclick="mediaViewerSwitchMode('spin360')"><i class="fa fa-arrows-rotate"></i><span>Rotate Product</span></button>
                <button type="button" id="mv-mode-pano" class="mv-mode-btn" onclick="mediaViewerSwitchMode('panorama360')"><i class="fa fa-street-view"></i><span>Look Around</span></button>
            </div>
            <p id="mv-mode-desc" class="mv-mode-desc" style="display:none;"></p>
            <div id="mv-video-mode-switcher" class="mv-mode-switcher" style="display:none;">
                <button type="button" id="mv-mode-video-flat" class="mv-mode-btn" onclick="mediaViewerSwitchVideoMode('video')"><i class="fa fa-play-circle"></i><span>Flat Video</span></button>
                <button type="button" id="mv-mode-video-360" class="mv-mode-btn" onclick="mediaViewerSwitchVideoMode('video360')"><i class="fa fa-street-view"></i><span>Immersive 360°</span></button>
            </div>
            <p id="mv-frame-label" class="mv-frame-label"></p>
            <div class="mv-toolbar">
                <button id="mv-btn-spin" class="mv-btn mv-btn-label" onclick="mediaViewerSwitchMode('spin360')" title="360° Product Spin" style="display:none;"><i class="fa fa-rotate"></i><span>360° Spin</span></button>
                <button id="mv-btn-pano" class="mv-btn mv-btn-label" onclick="mediaViewerSwitchMode('panorama360')" title="Immersive 360° View" style="display:none;"><i class="fa fa-street-view"></i><span>Immersive</span></button>
                <button id="mv-btn-step-back" class="mv-btn" onclick="mvStepSpin(-1)" title="Previous frame" style="display:none;" aria-label="Previous frame"><i class="fa fa-chevron-left"></i></button>
                <button id="mv-btn-play" class="mv-btn" onclick="toggleMediaAutoSpin()" title="Auto rotate" style="display:none;"><i class="fa fa-play"></i></button>
                <button id="mv-btn-step-fwd" class="mv-btn" onclick="mvStepSpin(1)" title="Next frame" style="display:none;" aria-label="Next frame"><i class="fa fa-chevron-right"></i></button>
                <button id="mv-btn-pano-prev" class="mv-btn" onclick="mvPanoramaNav(-1)" title="Previous scene" style="display:none;" aria-label="Previous scene"><i class="fa fa-chevron-left"></i></button>
                <button id="mv-btn-pano-next" class="mv-btn" onclick="mvPanoramaNav(1)" title="Next scene" style="display:none;" aria-label="Next scene"><i class="fa fa-chevron-right"></i></button>
                <span class="mv-divider mv-toolbar-zoom" id="mv-divider-spin" style="display:none;"></span>
                <button class="mv-btn mv-toolbar-zoom" onclick="mediaViewerZoom(-0.4)" title="Zoom out" aria-label="Zoom out"><i class="fa fa-minus"></i></button>
                <button class="mv-btn mv-toolbar-zoom" onclick="mediaViewerZoom(0.4)" title="Zoom in" aria-label="Zoom in"><i class="fa fa-plus"></i></button>
                <button class="mv-btn mv-toolbar-zoom" onclick="mediaViewerReset()" title="Reset view" aria-label="Reset"><i class="fa fa-rotate-left"></i></button>
                <span class="mv-divider mv-toolbar-zoom" id="mv-divider-zoom"></span>
                <button class="mv-btn" onclick="toggleMediaFullscreen()" title="Fullscreen" aria-label="Fullscreen"><i class="fa fa-expand"></i></button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const bindNavBtn = (id, dir) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const go = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            cancelAnimationFrame(mvState.momentumId);
            mvState.isDragging = false;
            mvState.spinAccumX = 0;
            if (mvState.mode === 'spin360') mvStepSpin(dir);
            else mediaViewerNav(dir);
        };
        btn.addEventListener('click', go);
        btn.addEventListener('touchend', go, { passive: false });
    };
    bindNavBtn('mv-prev', -1);
    bindNavBtn('mv-next', 1);

    const stage = document.getElementById('mv-stage');
    stage.addEventListener('mousedown', mediaViewerDragStart);
    stage.addEventListener('mousemove', mediaViewerDragMove);
    stage.addEventListener('mouseup', mediaViewerDragEnd);
    stage.addEventListener('mouseleave', mediaViewerDragEnd);
    stage.addEventListener('touchstart', mediaViewerTouchStart, { passive: false });
    stage.addEventListener('touchmove', mediaViewerTouchMove, { passive: false });
    stage.addEventListener('touchend', mediaViewerTouchEnd);
    stage.addEventListener('touchcancel', mediaViewerTouchEnd);
    stage.addEventListener('wheel', e => {
        if (mvState.mode === 'video' || mvState.mode === 'video360' || mvState.mode === 'panorama360') return;
        e.preventDefault();
        mediaViewerZoom(e.deltaY < 0 ? 0.15 : -0.15);
    }, { passive: false });

    return modal;
}

let pannellumLoadPromise = null;

function loadPannellumAssets() {
    if (window.pannellum) return Promise.resolve();
    if (pannellumLoadPromise) return pannellumLoadPromise;
    pannellumLoadPromise = new Promise((resolve, reject) => {
        if (!document.getElementById('pannellum-css')) {
            const link = document.createElement('link');
            link.id = 'pannellum-css';
            link.rel = 'stylesheet';
            link.href = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css';
            document.head.appendChild(link);
        }
        if (window.pannellum) {
            resolve();
            return;
        }
        let script = document.getElementById('pannellum-js');
        if (!script) {
            script = document.createElement('script');
            script.id = 'pannellum-js';
            script.src = 'https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load immersive 360 viewer'));
            document.head.appendChild(script);
        } else {
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => reject(new Error('Failed to load immersive 360 viewer')), { once: true });
        }
    });
    return pannellumLoadPromise;
}

const LEGACY_PANORAMA_URL_MAP = {
    'assets/demo/360/panorama/cerro-toco.jpg': 'https://pannellum.org/images/cerro-toco-0.jpg',
    'assets/demo/360/panorama/alma.jpg': 'https://raw.githubusercontent.com/mpetroff/pannellum/master/examples/examplepano.jpg',
    'assets/demo/360/panorama/equirectangular-sw.jpg': 'https://upload.wikimedia.org/wikipedia/commons/8/83/Equirectangular_projection_SW.jpg'
};

const DEMO_PANORAMA_HINTS = ['pannellum.org', 'mpetroff/pannellum', 'wikimedia.org', 'cerro-toco', 'examplepano'];

function mvIsDemoPanoramaUrl(url) {
    const u = String(url || '').toLowerCase();
    const trimmed = u.replace(/^\//, '');
    if (LEGACY_PANORAMA_URL_MAP[trimmed]) return true;
    return DEMO_PANORAMA_HINTS.some(h => u.includes(h));
}

function mvResolveMediaUrl(url) {
    if (!url) return url;
    const trimmed = String(url).replace(/^\//, '');
    if (LEGACY_PANORAMA_URL_MAP[trimmed]) return LEGACY_PANORAMA_URL_MAP[trimmed];
    if (/^https?:\/\//i.test(url)) return url;
    const base = window.location.origin + '/';
    return new URL(trimmed, base).href;
}
window.mvResolveMediaUrl = mvResolveMediaUrl;

function mvIsEquirectangularAspect(width, height) {
    if (!width || !height) return false;
    const ratio = width / height;
    return ratio >= 1.75 && ratio <= 2.25;
}
window.mvIsEquirectangularAspect = mvIsEquirectangularAspect;

function mvProbeVideoUrl(url) {
    const absoluteUrl = mvResolveMediaUrl(url);
    return new Promise((resolve, reject) => {
        const vid = document.createElement('video');
        vid.preload = 'metadata';
        vid.muted = true;
        vid.playsInline = true;
        vid.setAttribute('playsinline', '');
        if (/^https?:\/\//i.test(absoluteUrl)) vid.crossOrigin = 'anonymous';
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('Video metadata timed out'));
        }, 15000);
        const cleanup = () => {
            clearTimeout(timer);
            vid.onloadedmetadata = null;
            vid.onerror = null;
            vid.removeAttribute('src');
            vid.load();
        };
        vid.onloadedmetadata = () => {
            const width = vid.videoWidth;
            const height = vid.videoHeight;
            const ratio = height > 0 ? width / height : 0;
            const isEquirectangular = mvIsEquirectangularAspect(width, height);
            cleanup();
            resolve({ width, height, ratio, isEquirectangular, url: absoluteUrl });
        };
        vid.onerror = () => {
            cleanup();
            reject(new Error('Could not read video metadata'));
        };
        vid.src = absoluteUrl;
    });
}
window.mvProbeVideoUrl = mvProbeVideoUrl;

function mvShowLoader(message = 'Loading...') {
    const loader = document.getElementById('mv-loader');
    const status = document.getElementById('mv-load-status');
    if (loader) loader.style.display = 'flex';
    if (status) status.textContent = message;
}

function mvHideLoader() {
    const loader = document.getElementById('mv-loader');
    const status = document.getElementById('mv-load-status');
    if (loader) loader.style.display = 'none';
    if (status) status.textContent = 'Loading...';
}

function mvDismissGuide() {
    mvState.guideShown = true;
    const guide = document.getElementById('mv-guide');
    if (guide) {
        guide.style.opacity = '0';
        setTimeout(() => { guide.style.display = 'none'; }, 400);
    }
}

function destroyVideo360Viewer() {
    if (mvState.videojsPlayer) {
        try { mvState.videojsPlayer.dispose(); } catch (e) { /* ignore */ }
        mvState.videojsPlayer = null;
    }
    const panoEl = document.getElementById('mv-panorama');
    if (panoEl) {
        panoEl.innerHTML = '';
        if (mvState.mode === 'video360') panoEl.style.display = 'none';
    }
}

let video360LoadPromise = null;

function loadVideo360Assets() {
    if (window.videojs && window._video360PluginLoaded) {
        return loadPannellumAssets();
    }
    if (video360LoadPromise) return video360LoadPromise;
    video360LoadPromise = loadPannellumAssets().then(() => new Promise((resolve, reject) => {
        if (!document.getElementById('videojs-css')) {
            const link = document.createElement('link');
            link.id = 'videojs-css';
            link.rel = 'stylesheet';
            link.href = 'https://vjs.zencdn.net/7.21.1/video-js.css';
            document.head.appendChild(link);
        }
        const finishPlugin = () => {
            if (window._video360PluginLoaded) {
                resolve();
                return;
            }
            let plugin = document.getElementById('videojs-pannellum-plugin-js');
            if (!plugin) {
                plugin = document.createElement('script');
                plugin.id = 'videojs-pannellum-plugin-js';
                plugin.src = 'js/videojs-pannellum-plugin.js?v=1.0';
                plugin.onload = () => { window._video360PluginLoaded = true; resolve(); };
                plugin.onerror = () => reject(new Error('Failed to load 360 video plugin'));
                document.body.appendChild(plugin);
            } else {
                plugin.addEventListener('load', () => { window._video360PluginLoaded = true; resolve(); }, { once: true });
                plugin.addEventListener('error', () => reject(new Error('Failed to load 360 video plugin')), { once: true });
            }
        };
        if (window.videojs) {
            finishPlugin();
            return;
        }
        let script = document.getElementById('videojs-js');
        if (!script) {
            script = document.createElement('script');
            script.id = 'videojs-js';
            script.src = 'https://vjs.zencdn.net/7.21.1/video.min.js';
            script.onload = finishPlugin;
            script.onerror = () => reject(new Error('Failed to load video player'));
            document.body.appendChild(script);
        } else {
            script.addEventListener('load', finishPlugin, { once: true });
            script.addEventListener('error', () => reject(new Error('Failed to load video player')), { once: true });
        }
    }));
    return video360LoadPromise;
}

async function initVideo360Viewer(url) {
    if (!url) return;
    const absoluteUrl = mvResolveMediaUrl(url);
    await loadVideo360Assets();
    destroyPanoramaViewer();
    destroyVideo360Viewer();
    const imgEl = document.getElementById('mv-image');
    const vidEl = document.getElementById('mv-video');
    const panoEl = document.getElementById('mv-panorama');
    const loader = document.getElementById('mv-loader');
    const guide = document.getElementById('mv-guide');
    if (imgEl) imgEl.style.display = 'none';
    if (vidEl) { vidEl.pause(); vidEl.style.display = 'none'; vidEl.removeAttribute('src'); }
    if (!panoEl) return;
    if (loader) loader.style.display = 'flex';
    if (guide) guide.style.display = 'flex';
    panoEl.style.display = 'block';
    panoEl.innerHTML = '';
    const videoEl = document.createElement('video');
    videoEl.id = 'mv-video360-el';
    videoEl.className = 'video-js vjs-default-skin vjs-big-play-centered';
    videoEl.controls = true;
    videoEl.preload = 'auto';
    videoEl.playsInline = true;
    videoEl.setAttribute('playsinline', '');
    videoEl.crossOrigin = 'anonymous';
    videoEl.style.width = '100%';
    videoEl.style.height = '100%';
    const sourceEl = document.createElement('source');
    sourceEl.src = absoluteUrl;
    sourceEl.type = 'video/mp4';
    videoEl.appendChild(sourceEl);
    panoEl.appendChild(videoEl);
    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn) => {
            if (settled) return;
            settled = true;
            clearTimeout(safetyTimer);
            fn();
        };
        const safetyTimer = setTimeout(() => {
            if (loader) loader.style.display = 'none';
            finish(() => reject(new Error('360 video load timeout')));
        }, 18000);
        try {
            mvState.videojsPlayer = window.videojs('mv-video360-el', {
                plugins: {
                    pannellum: {
                        hfov: 100,
                        minHfov: 50,
                        maxHfov: 120
                    }
                }
            }, () => {
                if (loader) loader.style.display = 'none';
                setTimeout(mvDismissGuide, 1200);
                finish(() => resolve());
            });
        } catch (e) {
            if (loader) loader.style.display = 'none';
            console.error('360 video init error:', e);
            showToast('Could not load immersive 360° video.');
            finish(() => reject(e));
        }
    });
}

function destroyPanoramaViewer() {
    if (mvState.pannellumInstance) {
        try { mvState.pannellumInstance.destroy(); } catch (e) { /* ignore */ }
        mvState.pannellumInstance = null;
    }
    const panoEl = document.getElementById('mv-panorama');
    if (panoEl) {
        panoEl.innerHTML = '';
        panoEl.style.display = 'none';
    }
}

function mvFallbackToSpinIfAvailable() {
    if (mvState.spinFrames.length < 2) return false;
    destroyPanoramaViewer();
    mvHideLoader();
    mvState.mode = 'spin360';
    mvState.guideShown = false;
    const guide = document.getElementById('mv-guide');
    if (guide) { guide.style.opacity = '1'; guide.style.display = 'flex'; }
    const titleEl = document.getElementById('mv-title');
    if (titleEl) titleEl.textContent = mvState.title + ' · Rotate Product';
    renderMediaViewerContent();
    updateMediaViewerHints();
    updateMediaViewerToolbar();
    mvUpdateModeSwitcher();
    mvUpdatePanoramaSceneNav();
    showToast('Showing product rotation — swipe to turn the item.');
    return true;
}

async function initPanoramaViewer(url) {
    if (!url) return;
    const absoluteUrl = mvResolveMediaUrl(url);
    await loadPannellumAssets();
    destroyPanoramaViewer();
    destroyVideo360Viewer();
    const imgEl = document.getElementById('mv-image');
    const vidEl = document.getElementById('mv-video');
    const panoEl = document.getElementById('mv-panorama');
    const guide = document.getElementById('mv-guide');
    if (imgEl) imgEl.style.display = 'none';
    if (vidEl) { vidEl.style.display = 'none'; vidEl.pause(); }
    if (!panoEl) return;

    mvShowLoader('Loading panorama...');
    if (guide) guide.style.display = 'flex';
    panoEl.style.display = 'block';

    try {
        await new Promise((resolve, reject) => {
            const img = new Image();
            const timer = setTimeout(() => reject(new Error('Panorama image timed out')), 20000);
            img.onload = () => { clearTimeout(timer); resolve(); };
            img.onerror = () => { clearTimeout(timer); reject(new Error('Panorama image failed to load')); };
            img.src = absoluteUrl;
        });
    } catch (e) {
        mvHideLoader();
        console.error('Panorama preload error:', e, absoluteUrl);
        showToast('Could not load immersive 360° image.');
        throw e;
    }

    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    return new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn) => {
            if (settled) return;
            settled = true;
            clearTimeout(fallbackTimer);
            clearTimeout(safetyHideTimer);
            fn();
        };
        const safetyHideTimer = setTimeout(() => {
            if (settled) return;
            clearInterval(pollInterval);
            mvHideLoader();
            setTimeout(mvDismissGuide, 1200);
            finish(() => resolve());
        }, 2000);
        const fallbackTimer = setTimeout(() => {
            clearInterval(pollInterval);
            mvHideLoader();
            console.warn('Panorama viewer load timeout:', absoluteUrl);
            finish(() => reject(new Error('Panorama viewer timeout')));
        }, 12000);

        let pollInterval = null;
        try {
            panoEl.innerHTML = '';
            mvState.pannellumInstance = window.pannellum.viewer('mv-panorama', {
                type: 'equirectangular',
                panorama: absoluteUrl,
                autoLoad: true,
                showControls: false,
                mouseZoom: true,
                draggable: true,
                friction: 0.12,
                hfov: 100,
                minHfov: 50,
                maxHfov: 120,
                backgroundColor: [10, 10, 10],
                onLoad: () => {
                    clearInterval(pollInterval);
                    mvHideLoader();
                    setTimeout(mvDismissGuide, 1200);
                    finish(() => resolve());
                },
                onError: (msg) => {
                    clearInterval(pollInterval);
                    mvHideLoader();
                    console.error('Panorama load error:', msg, absoluteUrl);
                    finish(() => reject(new Error(String(msg))));
                }
            });
            pollInterval = setInterval(() => {
                if (settled) {
                    clearInterval(pollInterval);
                    return;
                }
                try {
                    if (mvState.pannellumInstance && typeof mvState.pannellumInstance.isLoaded === 'function' && mvState.pannellumInstance.isLoaded()) {
                        clearInterval(pollInterval);
                        mvHideLoader();
                        setTimeout(mvDismissGuide, 1200);
                        finish(() => resolve());
                    }
                } catch (e) { /* ignore poll errors */ }
            }, 150);
        } catch (e) {
            if (pollInterval) clearInterval(pollInterval);
            mvHideLoader();
            finish(() => reject(e));
        }
    });
}

function mvUpdateVideoModeSwitcher() {
    const switcher = document.getElementById('mv-video-mode-switcher');
    const btnFlat = document.getElementById('mv-mode-video-flat');
    const btn360 = document.getElementById('mv-mode-video-360');
    const isVideoMode = mvState.mode === 'video' || mvState.mode === 'video360';
    const featureOn = !!(window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer);
    const canImmersive = featureOn && (
        mvState.videoSavedAs360 ||
        mvState.videoLikelyEquirectangular === true
    );
    const showSwitcher = isVideoMode && !!mvState.videoUrl && mvState.videoAllowModeSwitch && canImmersive;
    if (switcher) switcher.style.display = showSwitcher ? 'flex' : 'none';
    if (btnFlat) {
        btnFlat.style.display = showSwitcher ? '' : 'none';
        btnFlat.classList.toggle('active', mvState.mode === 'video');
    }
    if (btn360) {
        btn360.style.display = showSwitcher ? '' : 'none';
        btn360.disabled = false;
        btn360.classList.remove('mv-mode-btn--disabled');
        btn360.classList.toggle('active', mvState.mode === 'video360');
        btn360.title = 'Immersive 360° (2:1 equirectangular video)';
    }
}

function mvApplyVideoViewerTitle() {
    const titleEl = document.getElementById('mv-title');
    if (!titleEl) return;
    let suffix = '';
    if (mvState.mode === 'video360') suffix = ' · Immersive 360° Video';
    else if (mvState.mode === 'video') suffix = ' · Flat Video';
    titleEl.textContent = mvState.title + suffix;
}

async function mvOpenVideoViewer(prefer360) {
    const url = mvResolveMediaUrl(mvState.videoUrl);
    let use360 = !!prefer360;
    const guide = document.getElementById('mv-guide');
    const imgEl = document.getElementById('mv-image');
    const vidEl = document.getElementById('mv-video');
    const loader = document.getElementById('mv-loader');

    try {
        const probe = await mvProbeVideoUrl(url);
        mvState.videoLikelyEquirectangular = probe.isEquirectangular;
        if (use360 && !probe.isEquirectangular) {
            use360 = false;
            showToast('Playing as flat video — file is not a 2:1 equirectangular 360° video.');
        }
    } catch (e) {
        mvState.videoLikelyEquirectangular = null;
        if (use360) {
            console.warn('Video probe failed:', e);
        }
    }

    mvState.mode = use360 ? 'video360' : 'video';
    mvApplyVideoViewerTitle();

    if (guide) {
        if (use360) {
            guide.style.opacity = '1';
            guide.style.display = 'flex';
            mvState.guideShown = false;
        } else {
            guide.style.display = 'none';
            mvState.guideShown = true;
        }
    }
    if (imgEl) imgEl.style.display = 'none';

    mvUpdateVideoModeSwitcher();
    updateMediaViewerHints();

    if (use360) {
        try {
            await initVideo360Viewer(url);
        } catch (e) {
            destroyVideo360Viewer();
            mvState.mode = 'video';
            mvApplyVideoViewerTitle();
            if (guide) { guide.style.display = 'none'; mvState.guideShown = true; }
            if (loader) loader.style.display = 'none';
            renderMediaViewerContent();
            mvUpdateVideoModeSwitcher();
            updateMediaViewerHints();
            showToast('Switched to flat video — immersive 360° failed to load.');
        }
    } else {
        destroyVideo360Viewer();
        const panoEl = document.getElementById('mv-panorama');
        if (panoEl) { panoEl.style.display = 'none'; panoEl.innerHTML = ''; }
        if (loader) loader.style.display = 'none';
        renderMediaViewerContent();
    }
}

function mediaViewerSwitchVideoMode(mode) {
    if (!mvState.videoUrl || !mvState.videoAllowModeSwitch) return;
    if (mode !== 'video' && mode !== 'video360') return;
    if (mode === mvState.mode) return;
    if (mode === 'video360' && mvState.videoLikelyEquirectangular === false) {
        showToast('This video is not 2:1 equirectangular — use Flat Video.');
        return;
    }
    mvOpenVideoViewer(mode === 'video360').catch(() => {});
}
window.mediaViewerSwitchVideoMode = mediaViewerSwitchVideoMode;

function mvUpdateModeSwitcher() {
    const switcher = document.getElementById('mv-mode-switcher');
    const btnSpin = document.getElementById('mv-mode-spin');
    const btnPano = document.getElementById('mv-mode-pano');
    const hasSpin = mvState.spinFrames.length >= 2;
    const hasPano = mvState.panoramaImages.length >= 1;
    const showSwitcher = hasSpin && hasPano && (mvState.mode === 'spin360' || mvState.mode === 'panorama360');
    if (switcher) switcher.style.display = showSwitcher ? 'flex' : 'none';
    if (btnSpin) btnSpin.classList.toggle('active', mvState.mode === 'spin360');
    if (btnPano) btnPano.classList.toggle('active', mvState.mode === 'panorama360');
}

function mvUpdatePanoramaSceneNav() {
    const btnPrev = document.getElementById('mv-btn-pano-prev');
    const btnNext = document.getElementById('mv-btn-pano-next');
    const show = mvState.mode === 'panorama360' && mvState.panoramaImages.length > 1;
    if (btnPrev) btnPrev.style.display = show ? 'flex' : 'none';
    if (btnNext) btnNext.style.display = show ? 'flex' : 'none';
}

function mvPanoramaNav(dir) {
    const n = mvState.panoramaImages.length;
    if (n < 2) return;
    mvState.panoramaIndex = (mvState.panoramaIndex + dir + n) % n;
    initPanoramaViewer(mvState.panoramaImages[mvState.panoramaIndex]).then(() => {
        updateMediaViewerHints();
    }).catch(() => {
        if (!mvFallbackToSpinIfAvailable()) {
            showToast('Could not load this scene — try another or use Rotate Product.');
        }
    });
}
window.mvPanoramaNav = mvPanoramaNav;

function openMediaViewer(opts = {}) {
    const modal = ensureMediaViewerModal();
    stopMediaAutoSpin();
    cancelAnimationFrame(mvState.momentumId);
    destroyPanoramaViewer();
    destroyVideo360Viewer();

    mvState.mode = opts.mode || 'gallery';
    mvState.images = opts.images || [];
    mvState.imageIndex = opts.startIndex || 0;
    mvState.spinFrames = opts.spinFrames || [];
    mvState.panoramaImages = (opts.panoramaImages || []).map(u => mvResolveMediaUrl(u));
    mvState.panoramaIndex = opts.panoramaIndex || 0;
    mvState.spinRows = 1;
    mvState.spinCols = mvState.spinFrames.length || 1;
    mvNormalizeSpinGrid();
    mvState.spinIndex = 0;
    mvState.spinCol = 0;
    mvState.spinRow = 0;
    mvState.videoUrl = opts.videoUrl || '';
    mvState.videoSavedAs360 = !!opts.videoSavedAs360;
    mvState.videoLikelyEquirectangular = null;
    mvState.videoAllowModeSwitch = !!(opts.videoUrl && (opts.mode === 'video' || opts.mode === 'video360' || opts.videoAllowModeSwitch));
    mvState.title = opts.title || 'Product View';
    mvState.scale = 1;
    mvState.panX = 0;
    mvState.panY = 0;
    mvState.guideShown = false;

    const titleEl = document.getElementById('mv-title');
    const hintEl = document.getElementById('mv-hint');
    const imgEl = document.getElementById('mv-image');
    const vidEl = document.getElementById('mv-video');
    const loader = document.getElementById('mv-loader');
    const guide = document.getElementById('mv-guide');
    const btnSpin = document.getElementById('mv-btn-spin');
    const btnPano = document.getElementById('mv-btn-pano');
    const btnPlay = document.getElementById('mv-btn-play');
    const btnStepBack = document.getElementById('mv-btn-step-back');
    const btnStepFwd = document.getElementById('mv-btn-step-fwd');
    const dividerSpin = document.getElementById('mv-divider-spin');
    const btnPrev = document.getElementById('mv-prev');
    const btnNext = document.getElementById('mv-next');

    const hasSpin = mvState.spinFrames.length >= 2;
    const hasPano = mvState.panoramaImages.length >= 1;
    const isSpin = mvState.mode === 'spin360';
    const isPanorama = mvState.mode === 'panorama360';
    const isVideo360 = mvState.mode === 'video360';
    const isVideo = mvState.mode === 'video';

    if (titleEl) {
        let suffix = '';
        if (isSpin) suffix = ' · Rotate Product';
        else if (isPanorama) suffix = ' · Look Around';
        else if (isVideo360) suffix = ' · Immersive 360° Video';
        else if (isVideo) suffix = ' · Flat Video';
        titleEl.textContent = mvState.title + suffix;
    }
    if (loader) loader.style.display = 'none';
    if (guide) {
        if (isVideo) {
            guide.style.display = 'none';
            mvState.guideShown = true;
        } else if (isVideo360) {
            guide.style.opacity = '1';
            guide.style.display = 'flex';
            mvState.guideShown = false;
        } else {
            guide.style.opacity = '1';
            guide.style.display = 'flex';
        }
    }
    if (vidEl) { vidEl.pause(); vidEl.style.display = 'none'; }
    if (imgEl && !isPanorama && !isVideo360) imgEl.style.display = 'block';

    if (btnSpin) btnSpin.style.display = (hasSpin && !isSpin && !isPanorama && !isVideo && !isVideo360) ? 'flex' : 'none';
    if (btnPano) btnPano.style.display = (hasPano && !isSpin && !isPanorama && !isVideo && !isVideo360) ? 'flex' : 'none';
    if (btnPlay) btnPlay.style.display = isSpin ? 'flex' : 'none';
    if (btnStepBack) btnStepBack.style.display = isSpin ? 'flex' : 'none';
    if (btnStepFwd) btnStepFwd.style.display = isSpin ? 'flex' : 'none';
    if (dividerSpin) dividerSpin.style.display = ((hasSpin || hasPano) && !isVideo && !isPanorama) ? 'inline-block' : 'none';

    const showNav = !isVideo && !isVideo360 && !isPanorama && (
        (isSpin && mvState.spinFrames.length > 1) ||
        (!isSpin && mvState.images.length > 1)
    );
    if (btnPrev) btnPrev.style.display = showNav ? 'flex' : 'none';
    if (btnNext) btnNext.style.display = showNav ? 'flex' : 'none';

    document.body.classList.add('media-viewer-open');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateMediaViewerHints();
    updateMediaViewerToolbar();
    mvUpdateModeSwitcher();
    mvUpdateVideoModeSwitcher();
    mvUpdatePanoramaSceneNav();

    if (isPanorama && hasPano) {
        mvHideLoader();
        initPanoramaViewer(mvState.panoramaImages[mvState.panoramaIndex]).catch(() => {
            if (!mvFallbackToSpinIfAvailable()) {
                showToast('Could not load look-around view.');
            }
        });
    } else if ((isVideo || isVideo360) && mvState.videoUrl) {
        const prefer360 = isVideo360 || mvState.videoSavedAs360;
        mvOpenVideoViewer(prefer360).catch(() => {});
    } else {
        renderMediaViewerContent();
        if (isSpin && mvState.spinFrames.length > 0) {
            preloadMediaFrames(mvState.spinFrames);
        }
    }
}
window.openMediaViewer = openMediaViewer;

function preloadMediaFrames(urls) {
    if (mvState.mode !== 'spin360') return;
    mvShowLoader('Loading spin frames...');
    let loaded = 0;
    const total = urls.length;
    const safetyTimer = setTimeout(() => {
        if (mvState.mode === 'spin360') mvHideLoader();
    }, 20000);
    const finishOne = () => {
        loaded++;
        const status = document.getElementById('mv-load-status');
        if (status && mvState.mode === 'spin360') {
            status.textContent = `Loading ${Math.round((loaded / total) * 100)}%`;
        }
        if (loaded >= total && mvState.mode === 'spin360') {
            clearTimeout(safetyTimer);
            mvHideLoader();
        }
    };
    urls.forEach(url => {
        const img = new Image();
        img.onload = img.onerror = finishOne;
        img.src = mvResolveMediaUrl(url);
    });
}

function renderMediaViewerContent() {
    const imgEl = document.getElementById('mv-image');
    const vidEl = document.getElementById('mv-video');
    if (!imgEl) return;

    if (mvState.mode === 'panorama360' || mvState.mode === 'video360') {
        return;
    }

    if (mvState.mode === 'video' && mvState.videoUrl) {
        imgEl.style.display = 'none';
        if (vidEl) {
            vidEl.style.display = 'block';
            vidEl.src = mvResolveMediaUrl(mvState.videoUrl);
            vidEl.controls = true;
            vidEl.playsInline = true;
            vidEl.setAttribute('playsinline', '');
            vidEl.load();
            const tryPlay = () => { vidEl.play().catch(() => {}); };
            if (vidEl.readyState >= 2) tryPlay();
            else vidEl.onloadeddata = tryPlay;
        }
        updateMediaViewerHints();
        return;
    }

    if (vidEl) { vidEl.style.display = 'none'; vidEl.pause(); }
    imgEl.style.display = 'block';

    let src = '';
    if (mvState.mode === 'spin360' && mvState.spinFrames.length) {
        mvNormalizeSpinGrid();
        const idx = Math.max(0, Math.min(mvState.spinFrames.length - 1, mvState.spinIndex));
        src = mvState.spinFrames[idx];
    } else if (mvState.images.length) {
        const idx = Math.max(0, Math.min(mvState.images.length - 1, mvState.imageIndex));
        src = mvState.images[idx];
    }
    imgEl.src = src;
    updateMediaTransform();
    updateMediaViewerHints();
}

function updateMediaTransform() {
    const imgEl = document.getElementById('mv-image');
    if (imgEl && mvState.mode !== 'video') {
        imgEl.style.transform = `scale(${mvState.scale}) translate(${mvState.panX / mvState.scale}px, ${mvState.panY / mvState.scale}px)`;
    }
}

function mediaViewerZoom(delta) {
    if (mvState.mode === 'video' || mvState.mode === 'video360' || mvState.mode === 'panorama360') return;
    cancelAnimationFrame(mvState.momentumId);
    mvState.scale = Math.max(1, Math.min(4, mvState.scale + delta));
    if (mvState.scale === 1) { mvState.panX = 0; mvState.panY = 0; }
    updateMediaTransform();
}
window.mediaViewerZoom = mediaViewerZoom;
window.zoom360 = mediaViewerZoom;

function mediaViewerReset() {
    cancelAnimationFrame(mvState.momentumId);
    stopMediaAutoSpin();
    if (mvState.mode === 'panorama360' && mvState.pannellumInstance) {
        try {
            mvState.pannellumInstance.setPitch(0);
            mvState.pannellumInstance.setYaw(0);
            mvState.pannellumInstance.setHfov(100);
        } catch (e) { /* ignore */ }
        return;
    }
    mvState.scale = 1;
    mvState.panX = 0;
    mvState.panY = 0;
    mvState.spinIndex = 0;
    mvState.spinCol = 0;
    mvState.spinRow = 0;
    mvState.spinAccumX = 0;
    renderMediaViewerContent();
}
window.mediaViewerReset = mediaViewerReset;
window.reset360 = mediaViewerReset;

function mediaViewerNav(dir) {
    if (mvState.mode === 'spin360' && mvState.spinFrames.length > 1) {
        mvStepSpin(dir);
        return;
    }
    if (mvState.mode !== 'gallery' || !mvState.images.length) return;
    mvState.imageIndex = (mvState.imageIndex + dir + mvState.images.length) % mvState.images.length;
    mvState.scale = 1;
    mvState.panX = 0;
    mvState.panY = 0;
    renderMediaViewerContent();
}
window.mediaViewerNav = mediaViewerNav;

window.mvStepSpin = mvStepSpin;

function mediaViewerSwitchMode(mode) {
    if (mode === 'panorama360' && mvState.panoramaImages.length >= 1) {
        stopMediaAutoSpin();
        cancelAnimationFrame(mvState.momentumId);
        mvHideLoader();
        destroyVideo360Viewer();
        mvState.mode = 'panorama360';
        mvState.guideShown = false;
        const btnSpin = document.getElementById('mv-btn-spin');
        const btnPano = document.getElementById('mv-btn-pano');
        const btnPlay = document.getElementById('mv-btn-play');
        const btnStepBack = document.getElementById('mv-btn-step-back');
        const btnStepFwd = document.getElementById('mv-btn-step-fwd');
        const btnPrev = document.getElementById('mv-prev');
        const btnNext = document.getElementById('mv-next');
        const dividerSpin = document.getElementById('mv-divider-spin');
        if (btnSpin) btnSpin.style.display = 'none';
        if (btnPano) btnPano.style.display = 'none';
        if (btnPlay) btnPlay.style.display = 'none';
        if (btnStepBack) btnStepBack.style.display = 'none';
        if (btnStepFwd) btnStepFwd.style.display = 'none';
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) btnNext.style.display = 'none';
        if (dividerSpin) dividerSpin.style.display = 'inline-block';
        const guide = document.getElementById('mv-guide');
        if (guide) { guide.style.opacity = '1'; guide.style.display = 'flex'; }
        const titleEl = document.getElementById('mv-title');
        if (titleEl) titleEl.textContent = mvState.title + ' · Look Around';
        updateMediaViewerHints();
        updateMediaViewerToolbar();
        mvUpdateModeSwitcher();
        mvUpdatePanoramaSceneNav();
        initPanoramaViewer(mvState.panoramaImages[mvState.panoramaIndex]).catch(() => {
            if (!mvFallbackToSpinIfAvailable()) {
                showToast('Could not load look-around view.');
            }
        });
        return;
    }
    if (mode === 'spin360' && mvState.spinFrames.length >= 2) {
        destroyPanoramaViewer();
        destroyVideo360Viewer();
        mvState.mode = 'spin360';
        mvNormalizeSpinGrid();
        mvState.scale = 1;
        mvState.panX = 0;
        mvState.panY = 0;
        mvState.guideShown = false;
        const btnSpin = document.getElementById('mv-btn-spin');
        const btnPano = document.getElementById('mv-btn-pano');
        const btnPlay = document.getElementById('mv-btn-play');
        const btnStepBack = document.getElementById('mv-btn-step-back');
        const btnStepFwd = document.getElementById('mv-btn-step-fwd');
        const btnPrev = document.getElementById('mv-prev');
        const btnNext = document.getElementById('mv-next');
        const dividerSpin = document.getElementById('mv-divider-spin');
        if (btnSpin) btnSpin.style.display = 'none';
        if (btnPano) btnPano.style.display = 'none';
        if (btnPlay) btnPlay.style.display = 'flex';
        if (btnStepBack) btnStepBack.style.display = 'flex';
        if (btnStepFwd) btnStepFwd.style.display = 'flex';
        if (btnPrev) btnPrev.style.display = mvState.spinFrames.length > 1 ? 'flex' : 'none';
        if (btnNext) btnNext.style.display = mvState.spinFrames.length > 1 ? 'flex' : 'none';
        if (dividerSpin) dividerSpin.style.display = 'inline-block';
        const guide = document.getElementById('mv-guide');
        if (guide) { guide.style.opacity = '1'; guide.style.display = 'flex'; }
        const titleEl = document.getElementById('mv-title');
        if (titleEl) titleEl.textContent = mvState.title + ' · Rotate Product';
        updateMediaViewerHints();
        updateMediaViewerToolbar();
        mvUpdateModeSwitcher();
        mvUpdatePanoramaSceneNav();
        renderMediaViewerContent();
        preloadMediaFrames(mvState.spinFrames);
    }
}
window.mediaViewerSwitchMode = mediaViewerSwitchMode;

function mediaViewerDragStart(e) {
    if (mvState.mode === 'video' || mvState.mode === 'video360' || mvState.mode === 'panorama360') return;
    if (e.target && e.target.closest && (e.target.closest('.mv-nav') || e.target.closest('.mv-toolbar'))) return;
    cancelAnimationFrame(mvState.momentumId);
    stopMediaAutoSpin();

    if (!mvState.guideShown) {
        mvState.guideShown = true;
        mvDismissGuide();
    }

    mvState.isDragging = true;
    const cx = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const cy = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    mvState.startX = cx;
    mvState.startY = cy;
    mvState.lastX = cx;
    mvState.lastY = cy;
    mvState.startSpinCol = mvState.spinCol;
    mvState.spinAccumX = 0;
    mvState.velocityX = 0;
    const stage = document.getElementById('mv-stage');
    if (stage) stage.style.cursor = 'grabbing';
}

function mediaViewerDragMove(e) {
    if (!mvState.isDragging || mvState.mode === 'video') return;
    const cx = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const cy = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

    if (mvState.scale > 1) {
        mvState.panX += (cx - mvState.lastX);
        mvState.panY += (cy - mvState.lastY);
        const maxPan = (mvState.scale - 1) * 350;
        mvState.panX = Math.max(-maxPan, Math.min(maxPan, mvState.panX));
        mvState.panY = Math.max(-maxPan, Math.min(maxPan, mvState.panY));
        updateMediaTransform();
    } else if (mvState.mode === 'spin360') {
        const deltaX = cx - mvState.lastX;
        mvState.spinAccumX += deltaX;
        if (!mvIsCoarsePointer()) {
            const ppf = mvSpinPixelsPerFrame();
            let frameDelta = Math.trunc(mvState.spinAccumX / ppf);
            frameDelta = Math.max(-1, Math.min(1, frameDelta));
            if (frameDelta !== 0) {
                mvState.spinAccumX -= frameDelta * ppf;
                mvSetSpinIndex(mvState.spinIndex + frameDelta);
            }
        }
    }

    mvState.velocityX = cx - mvState.lastX;
    mvState.lastX = cx;
    mvState.lastY = cy;
}

function mediaViewerDragEnd() {
    if (!mvState.isDragging) return;
    const dragX = mvState.lastX - mvState.startX;
    mvState.isDragging = false;
    const stage = document.getElementById('mv-stage');
    if (stage) stage.style.cursor = 'grab';

    if (mvState.mode === 'spin360' && mvState.scale === 1) {
        const ppf = mvSpinPixelsPerFrame();
        const coarse = mvIsCoarsePointer();
        if (coarse) {
            if (Math.abs(mvState.spinAccumX) > ppf * 0.22) {
                mvStepSpin(mvState.spinAccumX < 0 ? 1 : -1);
            }
            mvState.spinAccumX = 0;
        } else if (Math.abs(mvState.velocityX) > 10) {
            mvState.velocityX *= 0.35;
            applyMediaMomentum();
        } else if (Math.abs(dragX) > ppf * 0.3) {
            mvStepSpin(dragX < 0 ? 1 : -1);
        }
    } else if (mvState.mode === 'gallery' && mvState.scale === 1 && mvState.images.length > 1 && Math.abs(dragX) > 48) {
        mediaViewerNav(dragX < 0 ? 1 : -1);
    }
}

function applyMediaMomentum() {
    if (mvIsCoarsePointer()) return;
    cancelAnimationFrame(mvState.momentumId);
    const coarse = mvIsCoarsePointer();
    const friction = coarse ? 0.9 : 0.84;
    const ppf = mvSpinPixelsPerFrame();
    let accumulated = 0;

    function step() {
        mvState.velocityX *= friction;
        accumulated += mvState.velocityX;
        let colChange = Math.trunc(accumulated / ppf);
        if (coarse) colChange = Math.max(-1, Math.min(1, colChange));
        if (colChange !== 0) {
            mvSetSpinIndex(mvState.spinIndex + colChange);
            accumulated -= colChange * ppf;
        }
        if (Math.abs(mvState.velocityX) > (coarse ? 0.12 : 0.25)) {
            mvState.momentumId = requestAnimationFrame(step);
        }
    }
    mvState.momentumId = requestAnimationFrame(step);
}

function toggleMediaAutoSpin() {
    if (mvState.autoSpin) {
        stopMediaAutoSpin();
    } else {
        mvState.autoSpin = true;
        const btn = document.getElementById('mv-btn-play');
        if (btn) btn.innerHTML = '<i class="fa fa-pause"></i>';
        let lastTime = performance.now();
        function step(ts) {
            if (!mvState.autoSpin) return;
            if (ts - lastTime >= 180) {
                mvSetSpinIndex(mvState.spinIndex + 1);
                lastTime = ts;
            }
            mvState.autoSpinId = requestAnimationFrame(step);
        }
        mvState.autoSpinId = requestAnimationFrame(step);
    }
}
window.toggleMediaAutoSpin = toggleMediaAutoSpin;
window.toggleAutoRotate360 = toggleMediaAutoSpin;

function stopMediaAutoSpin() {
    mvState.autoSpin = false;
    cancelAnimationFrame(mvState.autoSpinId);
    const btn = document.getElementById('mv-btn-play');
    if (btn) btn.innerHTML = '<i class="fa fa-play"></i>';
}

function toggleMediaFullscreen() {
    const modal = document.getElementById('media-viewer-modal');
    if (!modal) return;
    if (!document.fullscreenElement) {
        modal.requestFullscreen().catch(() => {});
    } else {
        document.exitFullscreen().catch(() => {});
    }
}
window.toggleMediaFullscreen = toggleMediaFullscreen;
window.toggleFullscreen360 = toggleMediaFullscreen;

function mediaViewerTouchStart(e) {
    if (mvState.mode === 'video' || mvState.mode === 'video360' || mvState.mode === 'panorama360') return;
    if (e.target && e.target.closest && e.target.closest('.mv-nav')) return;
    if (e.touches.length === 2) {
        e.preventDefault();
        cancelAnimationFrame(mvState.momentumId);
        stopMediaAutoSpin();
        mvState.isPinching = true;
        mvState.isDragging = false;
        mvState.pinchStartDist = mvTouchDistance(e.touches);
        mvState.pinchStartScale = mvState.scale;
        return;
    }
    if (e.touches.length === 1) mediaViewerDragStart(e);
}

function mediaViewerTouchMove(e) {
    if (mvState.mode === 'video' || mvState.mode === 'video360' || mvState.mode === 'panorama360') return;
    if (mvState.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = mvTouchDistance(e.touches);
        if (mvState.pinchStartDist > 0) {
            const rawRatio = dist / mvState.pinchStartDist;
            const pinchSens = mvIsCoarsePointer() ? 0.48 : 0.85;
            const ratio = 1 + (rawRatio - 1) * pinchSens;
            mvState.scale = Math.max(1, Math.min(4, mvState.pinchStartScale * ratio));
            if (mvState.scale === 1) { mvState.panX = 0; mvState.panY = 0; }
            updateMediaTransform();
        }
        return;
    }
    if (mvState.isDragging && e.touches.length === 1) {
        e.preventDefault();
        mediaViewerDragMove(e);
    }
}

function mediaViewerTouchEnd(e) {
    if (mvState.isPinching) {
        mvState.isPinching = false;
        if (mvState.scale === 1) { mvState.panX = 0; mvState.panY = 0; updateMediaTransform(); }
        return;
    }
    const moved = Math.hypot(mvState.lastX - mvState.startX, mvState.lastY - mvState.startY);
    mediaViewerDragEnd();
    if (mvState.mode !== 'video' && mvState.mode !== 'video360' && moved < 12 && e && e.changedTouches && e.changedTouches.length === 1) {
        const now = Date.now();
        if (now - mvState.lastTapAt < 300) {
            if (mvState.scale > 1) mediaViewerReset();
            else mediaViewerZoom(1);
            mvState.lastTapAt = 0;
            return;
        }
        mvState.lastTapAt = now;
    }
}

function closeMediaViewer() {
    const modal = document.getElementById('media-viewer-modal');
    if (modal) modal.style.display = 'none';
    document.body.classList.remove('media-viewer-open');
    document.body.style.overflow = '';
    stopMediaAutoSpin();
    cancelAnimationFrame(mvState.momentumId);
    mvHideLoader();
    destroyPanoramaViewer();
    destroyVideo360Viewer();
    const vidEl = document.getElementById('mv-video');
    if (vidEl) { vidEl.pause(); vidEl.src = ''; }
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

    const detView = document.getElementById('detail-view');
    if (detView && detView.style.display !== 'none') {
        detView.scrollTop = 0;
    }
}
window.closeMediaViewer = closeMediaViewer;
window.close360Viewer = closeMediaViewer;

function open360Viewer(prodId) {
    const p = window.products ? window.products.find(x => x.id === prodId) : null;
    if (!p) return;
    const media = window.resolveProductMedia ? window.resolveProductMedia(p) : null;
    const hasSpin = !!(media && media.spinFrames && media.spinFrames.length >= 2);
    const hasPano = !!(media && media.panoramaImages && media.panoramaImages.length >= 1);
    if (!hasSpin && !hasPano) {
        showToast('Add rotation photos or a look-around panorama in Admin.');
        return;
    }
    const galleryImages = (window.detailGalleryImages && window.detailGalleryImages.length)
        ? window.detailGalleryImages
        : (p.images || []);
    const startSpin = hasSpin;
    openMediaViewer({
        mode: startSpin ? 'spin360' : 'panorama360',
        spinFrames: media.spinFrames || [],
        panoramaImages: (media.panoramaImages || []).map(mvResolveMediaUrl),
        spinCols: media.spinCols,
        spinRows: media.spinRows,
        images: galleryImages,
        title: p.name || 'Product View'
    });
    if (startSpin && hasPano) {
        setTimeout(() => showToast('Swipe to rotate · tap Look Around for 360° room view'), 400);
    } else if (startSpin) {
        setTimeout(() => showToast('Swipe left or right to rotate the product'), 400);
    }
}
window.open360Viewer = open360Viewer;

function openGalleryZoom(prodId, startIndex) {
    const p = window.products ? window.products.find(x => x.id === prodId) : null;
    if (!p) return;
    const media = window.resolveProductMedia ? window.resolveProductMedia(p) : {};
    const images = (window.detailGalleryImages && window.detailGalleryImages.length)
        ? window.detailGalleryImages
        : (p.images || []);
    if (!images.length) return;
    openMediaViewer({
        mode: 'gallery',
        images,
        startIndex: startIndex || 0,
        spinFrames: media.spinFrames || [],
        panoramaImages: media.panoramaImages || [],
        spinCols: media.spinCols,
        spinRows: media.spinRows,
        title: p.name || 'Product View'
    });
}
window.openGalleryZoom = openGalleryZoom;

function openProductVideo(prodId, videoUrl, opts = {}) {
    const p = window.products ? window.products.find(x => x.id === prodId) : null;
    if (!videoUrl) return;
    const featureOn = !!(window.APP_FEATURES && window.APP_FEATURES.threeSixtyViewer);
    const savedAs360 = !!(opts && opts.is360) && featureOn;
    openMediaViewer({
        mode: savedAs360 ? 'video360' : 'video',
        videoUrl,
        videoSavedAs360: savedAs360,
        videoAllowModeSwitch: featureOn,
        title: (p && p.name) ? p.name : 'Product Video'
    });
}
window.openProductVideo = openProductVideo;

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
    const admin360PanoramaContainer = document.getElementById('m-is360-panorama-container');
    if (admin360PanoramaContainer) {
        admin360PanoramaContainer.style.display = is360Enabled ? 'flex' : 'none';
    }
    const adminSpinUpload = document.getElementById('m-spin-upload-container');
    if (adminSpinUpload) {
        if (!is360Enabled) {
            adminSpinUpload.style.display = 'none';
        } else {
            const mIs360 = document.getElementById('m-is360');
            adminSpinUpload.style.display = (mIs360 && mIs360.checked) ? 'block' : 'none';
        }
    }
    const adminPanoramaUpload = document.getElementById('m-panorama-upload-container');
    if (adminPanoramaUpload) {
        if (!is360Enabled) {
            adminPanoramaUpload.style.display = 'none';
        } else {
            const mIs360Panorama = document.getElementById('m-is360-panorama');
            adminPanoramaUpload.style.display = (mIs360Panorama && mIs360Panorama.checked) ? 'block' : 'none';
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
