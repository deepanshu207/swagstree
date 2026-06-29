// ==========================================
// SWAG STREE | INTELLIGENT SUPPORT CHAT
// AI assistant + admin messaging
// ==========================================

Object.assign(window.ADMIN_CAPABILITY_DEFS || {}, {
    manageSupportChat: {
        id: 'manageSupportChat',
        label: 'Manage Support Chats',
        icon: 'fa-headset',
        description: 'View and reply to customer support conversations'
    }
});

window.supportChatState = window.supportChatState || {
    activeThreadId: null,
    adminThreadId: null,
    mode: 'ai',
    activeTab: 'ai',
    loaded: false
};

let customerMessagesUnsub = null;
let adminInboxUnsub = null;
let adminThreadUnsub = null;
let supportMetaUnsub = null;
let supportAdminNotifyUnsub = null;
let supportNotifyInitialized = false;
const supportSeenAdminMsgIds = new Set();
window.supportThreadsCache = window.supportThreadsCache || [];

const AI_SUPPORT_CHIPS = [
    'Suggest outfits under ₹1000',
    'Track my order',
    'Best sellers',
    'Contact support'
];

const ADMIN_SUPPORT_CHIPS = [
    'Order not received',
    'Return or refund',
    'Wrong or damaged item',
    'Payment issue'
];

function normalizeSupportChatFeatures(config) {
    const c = config && typeof config === 'object' ? { ...config } : {};
    if (c.adminSupportChat === undefined && c.aiChatbot !== undefined) {
        c.adminSupportChat = !!c.aiChatbot;
    }
    return c;
}

function isAiChatEnabled() {
    return !!(window.APP_FEATURES && window.APP_FEATURES.aiChatbot);
}

function isAdminSupportChatEnabled() {
    const f = normalizeSupportChatFeatures(window.APP_FEATURES || {});
    return !!f.adminSupportChat;
}

function isAnySupportChatEnabled() {
    return isAiChatEnabled() || isAdminSupportChatEnabled();
}

function getDefaultSupportChatTab() {
    if (isAiChatEnabled()) return 'ai';
    if (isAdminSupportChatEnabled()) return 'admin';
    return 'ai';
}

function applySupportChatTabsVisibility() {
    const aiEnabled = isAiChatEnabled();
    const adminEnabled = isAdminSupportChatEnabled();
    const tabsEl = document.getElementById('ai-chat-tabs');
    const aiTab = document.getElementById('ai-chat-tab-ai');
    const adminTab = document.getElementById('ai-chat-tab-admin');

    if (aiTab) aiTab.style.display = aiEnabled ? '' : 'none';
    if (adminTab) adminTab.style.display = adminEnabled ? '' : 'none';
    if (tabsEl) tabsEl.style.display = (aiEnabled && adminEnabled) ? 'flex' : 'none';

    const active = window.supportChatState.activeTab;
    if ((active === 'ai' && !aiEnabled) || (active === 'admin' && !adminEnabled)) {
        updateSupportChatTabUI(getDefaultSupportChatTab());
    }
}
window.applySupportChatTabsVisibility = applySupportChatTabsVisibility;

const CHAT_PRODUCT_DISPLAY_LIMIT = 10;
const SUPPORT_CHANNEL = 'support';
const AI_CHANNEL = 'ai';
window.SUPPORT_CHANNEL = SUPPORT_CHANNEL;
window.AI_CHANNEL = AI_CHANNEL;
window.supportMessagesCache = window.supportMessagesCache || { ai: [], support: [] };
const supportKnownMsgIds = { ai: new Set(), support: new Set() };

function getMessageChannel(msg) {
    if (!msg) return AI_CHANNEL;
    if (msg.channel === SUPPORT_CHANNEL || msg.channel === AI_CHANNEL) return msg.channel;
    if (msg.sender === 'admin') return SUPPORT_CHANNEL;
    if (msg.type === 'complaint') return SUPPORT_CHANNEL;
    if (msg.escalated) return SUPPORT_CHANNEL;
    return AI_CHANNEL;
}
window.getMessageChannel = getMessageChannel;

function getChatBody(channel) {
    const ch = channel || (window.supportChatState.activeTab === 'admin' ? SUPPORT_CHANNEL : AI_CHANNEL);
    return document.getElementById(ch === SUPPORT_CHANNEL ? 'ai-chat-body-support' : 'ai-chat-body-ai');
}

function showChatBodyForTab(tab) {
    const aiWrap = document.getElementById('ai-chat-body-ai-wrap');
    const supportWrap = document.getElementById('ai-chat-body-support-wrap');
    if (aiWrap) aiWrap.style.display = tab === 'ai' ? 'flex' : 'none';
    if (supportWrap) supportWrap.style.display = tab === 'admin' ? 'flex' : 'none';
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stripUndefinedFields(obj) {
    const clean = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined) clean[key] = obj[key];
    });
    return clean;
}

function getGuestSessionId() {
    let id = localStorage.getItem('swag_support_guest_id');
    if (!id) {
        id = 'g_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        localStorage.setItem('swag_support_guest_id', id);
    }
    return id;
}

function getCustomerThreadIdForUser(uid) {
    return uid ? `uid_${uid}` : `guest_${getGuestSessionId()}`;
}

function getCurrentCustomerThreadId() {
    if (window.supportChatState.adminThreadId) return window.supportChatState.adminThreadId;
    return getCustomerThreadIdForUser(currentUser ? currentUser.uid : null);
}

function getCustomerProfile() {
    const name = document.getElementById('prof-name')?.value?.trim()
        || (currentUser && currentUser.displayName)
        || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : 'Guest');
    const email = currentUser?.email || '';
    return { name, email, uid: currentUser?.uid || null };
}

async function ensureSupportThread(threadId, profile) {
    const ref = db.collection('support_threads').doc(threadId);
    const snap = await ref.get();
    if (snap.exists) return snap.data();
    const data = {
        customerUid: profile.uid || null,
        customerEmail: profile.email || '',
        customerName: profile.name || 'Guest',
        guestSessionId: profile.uid ? null : getGuestSessionId(),
        status: 'open',
        mode: 'ai',
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessagePreview: '',
        lastMessageSender: 'system',
        unreadByAdmin: 0,
        unreadByCustomer: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await ref.set(data);
    return data;
}

async function persistAiChatMessage(threadId, msg) {
    const threadRef = db.collection('support_threads').doc(threadId);
    const msgRef = threadRef.collection('messages').doc();
    const payload = stripUndefinedFields({
        ...msg,
        channel: AI_CHANNEL,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        readByCustomer: true,
        readByAdmin: true
    });
    await msgRef.set(payload);
    return msgRef.id;
}

async function persistSupportMessage(threadId, msg) {
    const threadRef = db.collection('support_threads').doc(threadId);
    const msgRef = threadRef.collection('messages').doc();
    const payload = stripUndefinedFields({
        ...msg,
        channel: SUPPORT_CHANNEL,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        readByCustomer: msg.sender === 'customer' || msg.sender === 'admin',
        readByAdmin: msg.sender === 'admin' || msg.sender === 'customer'
    });
    await msgRef.set(payload);
    const unreadByAdmin = msg.sender === 'customer' ? firebase.firestore.FieldValue.increment(1) : 0;
    const unreadByCustomer = msg.sender === 'admin' ? firebase.firestore.FieldValue.increment(1) : 0;
    const update = {
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSupportMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastMessagePreview: (msg.text || '').slice(0, 120),
        lastMessageSender: msg.sender
    };
    if (msg.customerName) update.customerName = msg.customerName;
    if (msg.customerEmail) update.customerEmail = msg.customerEmail;
    if (msg.sender === 'customer') update.unreadByAdmin = unreadByAdmin;
    if (msg.sender === 'admin') update.unreadByCustomer = unreadByCustomer;
    if (msg.escalated) {
        update.mode = 'human';
        update.status = 'waiting_admin';
    }
    await threadRef.set(update, { merge: true });
    return msgRef.id;
}

async function escalateSupportThread(threadId, reason) {
    await db.collection('support_threads').doc(threadId).set({
        mode: 'human',
        status: 'waiting_admin',
        escalateReason: reason || 'customer_request',
        escalatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

function isSupportChatOpen() {
    const box = document.getElementById('ai-chat-box');
    return !!(box && box.style.display === 'flex');
}

function applySupportUnreadBadge(count) {
    ['header-support-chat-badge', 'wish-header-support-chat-badge'].forEach(id => {
        const badge = document.getElementById(id);
        if (!badge) return;
        const n = Number(count) || 0;
        badge.style.display = n > 0 ? 'flex' : 'none';
        badge.textContent = n > 9 ? '9+' : String(n);
    });
}

function stopSupportCustomerWatcher() {
    if (supportMetaUnsub) {
        supportMetaUnsub();
        supportMetaUnsub = null;
    }
    if (supportAdminNotifyUnsub) {
        supportAdminNotifyUnsub();
        supportAdminNotifyUnsub = null;
    }
    supportNotifyInitialized = false;
    supportSeenAdminMsgIds.clear();
}

function startSupportCustomerWatcher() {
    if (!isAnySupportChatEnabled()) return;
    stopSupportCustomerWatcher();

    const threadId = getCustomerThreadIdForUser(currentUser ? currentUser.uid : null);

    supportMetaUnsub = db.collection('support_threads').doc(threadId).onSnapshot(doc => {
        applySupportUnreadBadge(doc.exists ? (doc.data().unreadByCustomer || 0) : 0);
    }, () => {});

    supportAdminNotifyUnsub = db.collection('support_threads').doc(threadId)
        .collection('messages').orderBy('createdAt', 'desc').limit(15)
        .onSnapshot(snap => {
            if (customerMessagesUnsub) return;

            const adminMsgs = [];
            snap.forEach(doc => {
                const data = doc.data();
                if (doc.data().sender === 'admin' && getMessageChannel(data) === SUPPORT_CHANNEL) {
                    adminMsgs.push({ id: doc.id, text: data.text || '' });
                }
            });

            if (!supportNotifyInitialized) {
                adminMsgs.forEach(m => supportSeenAdminMsgIds.add(m.id));
                supportNotifyInitialized = true;
                return;
            }

            adminMsgs.forEach(m => {
                if (supportSeenAdminMsgIds.has(m.id)) return;
                supportSeenAdminMsgIds.add(m.id);
                if (!isSupportChatOpen()) {
                    const preview = (m.text || '').slice(0, 60);
                    if (typeof showToast === 'function') {
                        showToast(preview ? `Support: ${preview}` : 'New reply from support team');
                    }
                }
            });
        }, () => {});
}

function getContactInfo() {
    const footer = window.footerSettings || {};
    const phone = footer.contactPhone || '8800467686';
    const email = footer.contactEmail || 'support@swagstree.com';
    return { phone, email, wa: '918800467686' };
}

function extractMaxPrice(text) {
    if (!text) return null;
    const q = String(text).toLowerCase().replace(/₹/g, ' ').replace(/,/g, '');
    const patterns = [
        /(?:under|below|upto|up to|max|maximum|within|less than|cheaper than|<=?)\s*(\d{2,6})/,
        /(?:more\s+)?under\s*(\d{2,6})/,
        /(\d{2,6})\s*(?:or less|max|budget|only)/,
        /(?:rs\.?|inr)\s*(\d{2,6})/
    ];
    for (const re of patterns) {
        const m = q.match(re);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n >= 50 && n <= 100000) return n;
        }
    }
    if (/suggest|recommend|show|outfit|styles|more|another|other|budget|affordable|cheap/.test(q)) {
        const m = q.match(/\b(\d{2,5})\b/);
        if (m) {
            const n = parseInt(m[1], 10);
            if (n >= 50 && n <= 100000) return n;
        }
    }
    return null;
}

function cleanProductSearchQuery(query) {
    return (query || '')
        .replace(/suggest|recommend|show|more|under|below|outfits?|styles?|rs\.?|₹|please|help|want|need|find|another|other/gi, ' ')
        .replace(/\d+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function searchProducts(query, maxPrice, displayLimit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    const list = window.products || [];
    const q = cleanProductSearchQuery(query);
    let filtered = list.filter(p => {
        const price = Number(p.price) || 0;
        if (maxPrice != null && price > maxPrice) return false;
        if (!q) return true;
        const hay = `${p.name} ${p.description || ''}`.toLowerCase();
        return hay.includes(q) || q.split(/\s+/).some(w => w.length > 2 && hay.includes(w));
    });
    if (maxPrice != null) {
        filtered = filtered.slice().sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    }
    return {
        items: filtered.slice(0, displayLimit),
        total: filtered.length
    };
}

function buildExploreMoreHtml(total, shown, maxPrice) {
    if (total <= shown) return '';
    const more = total - shown;
    const filterBtn = maxPrice != null
        ? `<button type="button" class="btn-gold ai-chat-filter-btn" onclick="applyChatPriceFilter(${maxPrice})">Apply under ₹${maxPrice} filter</button>`
        : '';
    return `<div class="ai-chat-explore-hint" style="margin-top:8px;font-size:11px;color:#aaa;line-height:1.5;">
        <strong style="color:var(--gold);">${more} more</strong> style${more > 1 ? 's' : ''} match — explore the full catalog or let me filter Home for you.
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
            ${filterBtn}
            <button type="button" class="btn-gold ai-chat-filter-btn" style="background:transparent;border:1px solid var(--gold);color:var(--gold);" onclick="navigateTo('home'); toggleAIChat();">Browse Home</button>
        </div>
    </div>`;
}

window.applyChatPriceFilter = function(maxPrice) {
    const max = Number(maxPrice);
    if (!max || max <= 0) return;
    if (typeof navigateTo === 'function') navigateTo('home');
    window.filterMinPrice = window.priceAbsoluteMin || 0;
    window.filterMaxPrice = max;
    const minRange = document.getElementById('price-min-range');
    const maxRange = document.getElementById('price-max-range');
    const minInput = document.getElementById('price-min-input');
    const maxInput = document.getElementById('price-max-input');
    if (minRange) minRange.value = window.filterMinPrice;
    if (maxRange) maxRange.value = max;
    if (minInput) minInput.value = Math.round(window.filterMinPrice);
    if (maxInput) maxInput.value = Math.round(max);
    if (typeof updatePriceSliderUI === 'function') updatePriceSliderUI();
    if (typeof applySortAndFilter === 'function') applySortAndFilter();
    if (typeof toggleAIChat === 'function') toggleAIChat();
    if (typeof showToast === 'function') showToast(`Showing products under ₹${max}`);
};

function getBestSellerProducts(limit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    const list = (window.products || []).slice();
    list.sort((a, b) => {
        const salesA = a.salesCount || (a.popularity || 0);
        const salesB = b.salesCount || (b.popularity || 0);
        return salesB - salesA;
    });
    return list.slice(0, limit);
}

function detectSupportIntent(text) {
    const q = text.toLowerCase().trim();
    const maxPrice = extractMaxPrice(text);
    if (/^(hi|hello|hey|namaste|good morning|good evening)\b/.test(q)) return 'greeting';
    if (/talk to admin|human|agent|real person|speak to support|connect.*admin|live support/.test(q)) return 'human';
    if (/complaint|issue|problem|defect|damaged|wrong item|return|refund|complain/.test(q)) return 'complaint';
    if (/track|order status|where is my order|my order|track my order/.test(q)) return 'order';
    if (/contact|email|phone|call|whatsapp|support mail|contact support/.test(q)) return 'contact';
    if (/best seller|best sellers|best selling|top selling|popular picks|most popular/.test(q)) return 'best_sellers';
    if (maxPrice != null) return { type: 'price_filter', max: maxPrice };
    if (/suggest|recommend|show me|outfit|dress|kurta|saree|product|styles/.test(q)) return 'suggest';
    if (/price|cost|how much|₹|budget|cheap|affordable/.test(q)) return 'price';
    return 'ai';
}

function buildProductCardsHtml(products) {
    if (!products.length) return '<p style="margin:0;font-size:12px;color:#888;">No matching products found right now.</p>';
    const cards = products.map(p => {
        const img = (p.images && p.images[0]) || (p.variants && p.variants[0]?.images?.[0]) || '';
        return `
        <div class="ai-chat-product-card" onclick="showDetail('${p.id}'); toggleAIChat();">
            ${img ? `<img src="${escHtml(img)}" alt="">` : `<div style="width:52px;height:52px;background:#222;border-radius:8px;display:flex;align-items:center;justify-content:center;"><i class="fa fa-shopping-bag" style="color:var(--gold);"></i></div>`}
            <div class="ai-chat-product-info">
                <div class="ai-chat-product-name">${escHtml(p.name)}</div>
                <div class="ai-chat-product-price">₹${p.price}</div>
                <div class="ai-chat-product-btn">View product →</div>
            </div>
        </div>`;
    }).join('');
    const scrollClass = products.length > 4 ? ' ai-chat-product-scroll' : '';
    return `<div class="${scrollClass.trim()}">${cards}</div>`;
}

function renderSupportQuickChips(tab) {
    const container = document.getElementById('ai-chat-chips');
    if (!container) return;
    let chips = tab === 'admin' ? ADMIN_SUPPORT_CHIPS.slice() : AI_SUPPORT_CHIPS.slice();
    if (tab === 'ai' && !isAdminSupportChatEnabled()) {
        chips = chips.filter(chip => chip !== 'Contact support');
    }
    container.style.display = chips.length ? 'flex' : 'none';
    container.innerHTML = chips.map(chip =>
        `<div class="ai-chat-chip" onclick="sendChatMessageWithText('${chip.replace(/'/g, "\\'")}')">${escHtml(chip)}</div>`
    ).join('');
}

function updateSupportChatTabUI(tab) {
    window.supportChatState.activeTab = tab;
    const aiTab = document.getElementById('ai-chat-tab-ai');
    const adminTab = document.getElementById('ai-chat-tab-admin');
    const input = document.getElementById('ai-chat-input');
    if (aiTab) aiTab.classList.toggle('active', tab === 'ai');
    if (adminTab) adminTab.classList.toggle('active', tab === 'admin');
    if (input) {
        input.placeholder = tab === 'admin'
            ? 'Describe your issue — our team will reply here...'
            : 'Ask about products, prices, or orders...';
    }
    renderSupportQuickChips(tab);
    showChatBodyForTab(tab);
    if (tab === 'admin') {
        updateSupportChatHeader('human', true);
    } else {
        updateSupportChatHeader('ai', false);
    }
}

window.switchSupportChatTab = function(tab) {
    if (tab !== 'ai' && tab !== 'admin') return;
    if (tab === 'ai' && !isAiChatEnabled()) return;
    if (tab === 'admin' && !isAdminSupportChatEnabled()) return;
    updateSupportChatTabUI(tab);
    showChatBodyForTab(tab);
    if (tab === 'admin') {
        const body = getChatBody(SUPPORT_CHANNEL);
        const hasAdminHint = body && body.querySelector('[data-admin-tab-hint]');
        if (body && !hasAdminHint && body.childElementCount === 0) {
            appendSupportBubble('bot', 'You are now in **Live Support**. Tell us your issue and a real admin will reply in this chat.', '', SUPPORT_CHANNEL);
            const last = body.lastElementChild;
            if (last) last.setAttribute('data-admin-tab-hint', '1');
        }
    }
};

function updateSupportChatHeader(mode, waitingHuman) {
    const subtitle = document.getElementById('ai-chat-status-text');
    const modeBadge = document.getElementById('ai-chat-mode-badge');
    if (subtitle) {
        if (waitingHuman) subtitle.innerHTML = '<i class="fa fa-circle" style="font-size:8px;color:var(--gold);"></i> Waiting for admin reply';
        else if (mode === 'human') subtitle.innerHTML = '<i class="fa fa-circle" style="font-size:8px;color:#25D366;"></i> Live support connected';
        else subtitle.innerHTML = '<i class="fa fa-circle" style="font-size:8px;color:#25D366;"></i> AI assistant online';
    }
    if (modeBadge) {
        modeBadge.textContent = waitingHuman ? 'ADMIN' : (mode === 'human' ? 'SUPPORT' : 'AI');
        modeBadge.style.background = waitingHuman ? 'rgba(255,215,0,0.15)' : 'rgba(37,211,102,0.12)';
        modeBadge.style.color = waitingHuman ? 'var(--gold)' : '#25D366';
    }
}

function appendSupportBubble(sender, text, htmlExtra, channel) {
    const body = getChatBody(channel);
    if (!body) return;
    const div = document.createElement('div');
    div.className = `support-msg support-msg-${sender}`;
    div.style.margin = '8px 0';
    div.style.padding = '8px 12px';
    div.style.borderRadius = '10px';
    div.style.maxWidth = '88%';
    div.style.fontSize = '12px';
    div.style.lineHeight = '1.45';

    if (sender === 'customer') {
        div.style.background = 'var(--gold)';
        div.style.color = '#000';
        div.style.marginLeft = 'auto';
        div.innerText = text;
    } else if (sender === 'admin') {
        div.style.background = 'rgba(37, 211, 102, 0.12)';
        div.style.border = '1px solid rgba(37,211,102,0.35)';
        div.style.color = '#fff';
        div.innerHTML = `<div style="font-size:9px;color:#25D366;font-weight:700;margin-bottom:4px;">ADMIN</div>${typeof parseMarkdown === 'function' ? parseMarkdown(text) : escHtml(text)}${htmlExtra || ''}`;
    } else {
        div.style.background = 'var(--card)';
        div.style.border = '1px solid var(--border)';
        div.style.color = 'var(--text-color, #fff)';
        div.innerHTML = (typeof parseMarkdown === 'function' ? parseMarkdown(text) : escHtml(text)) + (htmlExtra || '');
    }
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;

    const ch = channel || (window.supportChatState.activeTab === 'admin' ? SUPPORT_CHANNEL : AI_CHANNEL);
    if (ch === AI_CHANNEL && typeof window.chatHistory !== 'undefined' && Array.isArray(window.chatHistory)) {
        window.chatHistory.push({ sender: sender === 'customer' ? 'user' : 'bot', text });
    }
}

function appendSupportProductCards(products, channel) {
    const body = getChatBody(channel || AI_CHANNEL);
    if (!body) return;
    const wrap = document.createElement('div');
    wrap.style.margin = '4px 0 8px 0';
    wrap.style.maxWidth = '92%';
    wrap.innerHTML = buildProductCardsHtml(products);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
}

async function generateSmartSupportReply(userText) {
    const intent = detectSupportIntent(userText);
    const contact = getContactInfo();

    if (intent === 'greeting') {
        return {
            text: "Hello! Welcome to **Swag Stree**. I can help with outfit suggestions, prices, orders, or connect you with our team. What are you looking for today?"
        };
    }
    if (intent === 'human' || intent === 'complaint') {
        if (isAdminSupportChatEnabled()) {
            return {
                text: "For **live help from our team**, please open the **Live Support** tab above.",
                extraHtml: `<button class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="switchSupportChatTab('admin')">Open Live Support</button>`
            };
        }
        return {
            text: `**Reach Swag Stree Support:**\n- Phone: +91 ${contact.phone}\n- Email: ${contact.email}\n- WhatsApp: wa.me/${contact.wa}`,
            extraHtml: `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
                <a href="tel:${contact.phone}" style="font-size:10px;color:var(--gold);">Call</a>
                <a href="mailto:${contact.email}" style="font-size:10px;color:var(--gold);">Email</a>
                <a href="https://wa.me/${contact.wa}" target="_blank" style="font-size:10px;color:var(--gold);">WhatsApp</a>
            </div>`
        };
    }
    if (intent === 'order') {
        return {
            text: currentUser
                ? "You can **track orders** in Profile → My Orders. I can also connect you with admin for order-specific help."
                : "Please **sign in** to view your orders under Profile. Guest orders linked to your email appear after login.",
            extraHtml: currentUser ? `<button class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('user'); toggleAIChat();">Open My Orders</button>` : ''
        };
    }
    if (intent === 'contact') {
        return {
            text: `**Reach Swag Stree Support:**\n- Phone: +91 ${contact.phone}\n- Email: ${contact.email}\n- WhatsApp: wa.me/${contact.wa}`,
            extraHtml: `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
                <a href="tel:${contact.phone}" style="font-size:10px;color:var(--gold);">Call</a>
                <a href="mailto:${contact.email}" style="font-size:10px;color:var(--gold);">Email</a>
                <a href="https://wa.me/${contact.wa}" target="_blank" style="font-size:10px;color:var(--gold);">WhatsApp</a>
            </div>`
        };
    }
    if (intent === 'best_sellers') {
        const matched = getBestSellerProducts();
        const catalogTotal = (window.products || []).length;
        return {
            text: matched.length
                ? `Here are our **${matched.length} best-selling pick${matched.length > 1 ? 's' : ''}** right now:`
                : 'Products are still loading — try again in a moment, or browse Home.',
            products: matched,
            totalCount: catalogTotal,
            extraHtml: matched.length >= CHAT_PRODUCT_DISPLAY_LIMIT && catalogTotal > matched.length
                ? buildExploreMoreHtml(catalogTotal, matched.length, null)
                : ''
        };
    }
    if (intent === 'suggest' || intent === 'price') {
        const max = extractMaxPrice(userText);
        const result = searchProducts(userText, max);
        const { items, total } = result;
        return {
            text: items.length
                ? `Showing **${items.length}${total > items.length ? ` of ${total}` : ''}** style${total !== 1 ? 's' : ''}${max != null ? ` under **₹${max}**` : ''}:`
                : max != null
                    ? `No products under **₹${max}** right now. Try a higher budget or browse Home.`
                    : "I couldn't find an exact match. Try a product name, color, or budget (e.g. under ₹800).",
            products: items,
            totalCount: total,
            filterMaxPrice: max,
            extraHtml: buildExploreMoreHtml(total, items.length, max)
        };
    }
    if (typeof intent === 'object' && intent.type === 'price_filter') {
        const result = searchProducts('', intent.max);
        const { items, total } = result;
        return {
            text: items.length
                ? `Showing **${items.length} of ${total}** styles under **₹${intent.max}**:`
                : `No products under **₹${intent.max}** right now. Try a higher budget or browse our full catalog.`,
            products: items,
            totalCount: total,
            filterMaxPrice: intent.max,
            extraHtml: buildExploreMoreHtml(total, items.length, intent.max)
        };
    }

    const engine = window.APP_FEATURES_CONTENT?.chatbotEngine || 'local';
    if (engine === 'pollinations' || engine === 'gemini') {
        if (typeof window.getAIResponse === 'function') {
            try {
                const reply = await window.getAIResponse();
                return { text: reply };
            } catch (e) {
                console.error('Cloud AI response failed, using local fallback:', e);
            }
        }
    }
    return generateLocalFallbackReply(userText);
}

function generateLocalFallbackReply(userText) {
    const q = (userText || '').toLowerCase();
    if (/^(hi|hello|hey|namaste)\b/.test(q.trim())) {
        return { text: "Hello! Welcome to **Swag Stree**. Ask for outfit suggestions, prices, order help, or say **Talk to admin** for live support." };
    }
    const max = extractMaxPrice(userText);
    const result = searchProducts(userText.replace(/help|please|want|need|show|find/gi, ''), max);
    const { items, total } = result;
    if (items.length) {
        return {
            text: `Here are **${items.length}${total > items.length ? ` of ${total}` : ''} item${total !== 1 ? 's' : ''}** that may match${max != null ? ` under ₹${max}` : ''}:`,
            products: items,
            totalCount: total,
            filterMaxPrice: max,
            extraHtml: buildExploreMoreHtml(total, items.length, max)
        };
    }
    if (/size|fit|measurement/.test(q)) {
        return { text: "Check the **Size Guide** on any product page. For fit advice, tell me the product name or say **Talk to admin**." };
    }
    if (/discount|coupon|offer|code|wheel/.test(q)) {
        return { text: "Try code **WELCOME10** for 10% off, or spin the **Discount Wheel** on the homepage for more savings." };
    }
    if (/delivery|shipping|dispatch/.test(q)) {
        return { text: "Delivery timelines vary by location. For a specific order update, sign in and open **Profile → My Orders**, or say **Track my order**." };
    }
    return {
        text: "I'm here to help with **products**, **prices**, **orders**, and **styling**.\n\nTry: *Best sellers*, *Suggest outfits under ₹1000*, *Track my order*, or **Talk to admin**."
    };
}

function canAnswerWhileAdminIsPending(intent) {
    return true;
}

function splitMessagesByChannel(messages) {
    const ai = [];
    const support = [];
    (messages || []).forEach(msg => {
        if (getMessageChannel(msg) === SUPPORT_CHANNEL) support.push(msg);
        else ai.push(msg);
    });
    return { ai, support };
}

function getProductsByIds(ids) {
    if (!ids || !ids.length) return [];
    const list = window.products || [];
    return ids.map(id => list.find(p => p.id === id)).filter(Boolean);
}

function rebuildAiReplyProducts(customerText, msg) {
    if (msg.productIds && msg.productIds.length) {
        const resolved = getProductsByIds(msg.productIds);
        if (resolved.length) return resolved;
    }
    if (msg.type !== 'product_suggest' || !customerText) return [];
    const intent = detectSupportIntent(customerText);
    if (intent === 'best_sellers') return getBestSellerProducts();
    if (typeof intent === 'object' && intent.type === 'price_filter') {
        return searchProducts('', intent.max).items;
    }
    if (intent === 'suggest' || intent === 'price') {
        const max = extractMaxPrice(customerText);
        return searchProducts(customerText, max).items;
    }
    return searchProducts(customerText.replace(/help|please|want|need|show|find/gi, ''), extractMaxPrice(customerText)).items;
}

function buildStoredExploreHtml(msg) {
    if (!msg.totalProductCount || !msg.productIds || msg.totalProductCount <= msg.productIds.length) return '';
    return buildExploreMoreHtml(msg.totalProductCount, msg.productIds.length, msg.filterMaxPrice ?? null);
}

function buildAiPersistMeta(reply) {
    if (!reply.products || !reply.products.length) {
        return { type: 'text' };
    }
    return stripUndefinedFields({
        type: 'product_suggest',
        productIds: reply.products.map(p => p.id),
        totalProductCount: reply.totalCount ?? reply.products.length,
        filterMaxPrice: reply.filterMaxPrice ?? null
    });
}

function renderChannelMessages(messages, channel) {
    const body = getChatBody(channel);
    if (!body) return;
    body.innerHTML = '';
    if (channel === AI_CHANNEL && typeof window.chatHistory !== 'undefined') window.chatHistory = [];

    const seen = new Set();
    let lastCustomerText = '';
    (messages || []).forEach(msg => {
        if (msg.id && seen.has(msg.id)) return;
        if (msg.id) seen.add(msg.id);

        if (msg.sender === 'customer') {
            lastCustomerText = msg.text || '';
            appendSupportBubble('customer', msg.text, '', channel);
        } else if (msg.sender === 'admin') {
            appendSupportBubble('admin', msg.text, '', channel);
        } else {
            appendSupportBubble('bot', msg.text, buildStoredExploreHtml(msg), channel);
            if (channel === AI_CHANNEL) {
                const products = rebuildAiReplyProducts(lastCustomerText, msg);
                if (products.length) {
                    appendSupportProductCards(products, channel);
                } else if (msg.type === 'product_suggest' && !(window.products || []).length) {
                    const hint = document.createElement('p');
                    hint.style.cssText = 'margin:4px 0 8px;font-size:11px;color:#888;';
                    hint.textContent = 'Product picks appear once the catalog finishes loading.';
                    body.appendChild(hint);
                }
            }
        }
    });
}

window.refreshAiChatProductCards = function() {
    if (!isSupportChatOpen()) return;
    const msgs = window.supportMessagesCache?.ai || [];
    if (!msgs.length) return;
    renderChannelMessages(msgs, AI_CHANNEL);
};

async function syncSupportChatHeaderFromThread(threadId) {
    try {
        if (window.supportChatState.activeTab === 'ai') {
            updateSupportChatHeader('ai', false);
            return;
        }
        const snap = await db.collection('support_threads').doc(threadId).get();
        if (!snap.exists) {
            updateSupportChatHeader('human', true);
            return;
        }
        const data = snap.data();
        updateSupportChatHeader('human', data.status === 'waiting_admin');
    } catch (e) {
        updateSupportChatHeader('human', true);
    }
}

async function handleAdminSupportMessage(text) {
    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();
    await ensureSupportThread(threadId, profile);

    window.supportChatState.loaded = true;
    appendSupportBubble('customer', text, '', SUPPORT_CHANNEL);

    const customerMsg = {
        sender: 'customer',
        text,
        type: 'complaint',
        customerName: profile.name,
        customerEmail: profile.email,
        escalated: true
    };
    try {
        await persistSupportMessage(threadId, customerMsg);
        await escalateSupportThread(threadId, 'complaint');
    } catch (e) {
        console.warn('Could not persist admin support message:', e);
    }

    updateSupportChatHeader('human', true);
    appendSupportBubble('bot', "Thanks — your message was sent to our **support team**. We'll reply here as soon as possible.\n\nYou can also reach us on WhatsApp while you wait.", getContactInfoHtml(), SUPPORT_CHANNEL);
}

function getContactInfoHtml() {
    const contact = getContactInfo();
    return `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
        <a href="https://wa.me/${contact.wa}" target="_blank" style="font-size:10px;color:var(--gold);">WhatsApp</a>
        <span style="color:#444">•</span>
        <a href="mailto:${escHtml(contact.email)}" style="font-size:10px;color:var(--gold);">${escHtml(contact.email)}</a>
    </div>`;
}

function formatSupportMessageTime(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    if (sameDay) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatSupportDayLabel(ts) {
    if (!ts) return 'Earlier';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    if (Number.isNaN(date.getTime())) return 'Earlier';
    const now = new Date();
    if (date.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function getAdminPreviewPrefix(sender) {
    if (sender === 'customer') return 'Customer';
    if (sender === 'admin') return 'You';
    return 'AI';
}

function renderAdminChatMessage(msg, customerName) {
    const wrap = document.createElement('div');
    const isAdmin = msg.sender === 'admin';
    const isCustomer = msg.sender === 'customer';
    const isBot = !isAdmin && !isCustomer;
    wrap.className = `admin-chat-msg ${isAdmin ? 'admin-chat-msg-admin' : (isCustomer ? 'admin-chat-msg-customer' : 'admin-chat-msg-bot')}`;

    const meta = document.createElement('div');
    meta.className = 'admin-chat-msg-meta';
    const label = isAdmin ? 'You (Admin)' : (isCustomer ? escHtml(customerName || 'Customer') : 'AI Assistant');
    const time = formatSupportMessageTime(msg.createdAt);
    let badge = '';
    if (isCustomer && msg.type === 'complaint') {
        badge = '<span class="admin-chat-msg-badge complaint">Complaint</span>';
    } else if (isBot) {
        badge = '<span class="admin-chat-msg-badge ai">Auto</span>';
    }
    meta.innerHTML = `<strong>${label}</strong>${time ? `<span>${time}</span>` : ''}${badge}`;

    const bubble = document.createElement('div');
    bubble.className = 'admin-chat-msg-bubble';
    bubble.textContent = msg.text || '';

    wrap.appendChild(meta);
    wrap.appendChild(bubble);
    return wrap;
}

function renderAdminChatMessages(messages, customerName) {
    const body = document.getElementById('admin-customer-chat-body');
    if (!body) return;
    body.innerHTML = '';
    let lastDay = '';
    const supportMsgs = (messages || []).filter(m => getMessageChannel(m) === SUPPORT_CHANNEL);
    if (!supportMsgs.length) {
        body.innerHTML = '<p style="color:#666;font-size:12px;text-align:center;padding:20px 0;">No live support messages yet. AI shopping chat is kept private to the customer.</p>';
        return;
    }
    supportMsgs.forEach(msg => {
        const day = formatSupportDayLabel(msg.createdAt);
        if (day !== lastDay) {
            const divider = document.createElement('div');
            divider.className = 'admin-chat-day-divider';
            divider.textContent = day;
            body.appendChild(divider);
            lastDay = day;
        }
        body.appendChild(renderAdminChatMessage(msg, customerName));
    });
    body.scrollTop = body.scrollHeight;
}

async function ensureProductsForChat() {
    if ((window.products || []).length) return true;
    for (let i = 0; i < 24; i++) {
        await new Promise(resolve => setTimeout(resolve, 125));
        if ((window.products || []).length) return true;
    }
    return false;
}

async function handleAiSupportMessage(text) {
    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();

    await ensureSupportThread(threadId, profile);

    window.supportChatState.loaded = true;
    appendSupportBubble('customer', text, '', AI_CHANNEL);

    const customerMsg = {
        sender: 'customer',
        text,
        type: 'text'
    };
    try {
        await persistAiChatMessage(threadId, customerMsg);
    } catch (e) {
        console.warn('Could not persist AI chat message:', e);
    }

    const typing = typeof appendTypingIndicator === 'function' ? appendTypingIndicator() : null;
    try {
        if (/best seller|suggest|recommend|outfit|under|styles|show me|price filter/i.test(text)) {
            await ensureProductsForChat();
        }
        const reply = await generateSmartSupportReply(text);
        if (typeof removeTypingIndicator === 'function') removeTypingIndicator();

        appendSupportBubble('bot', reply.text, reply.extraHtml || '', AI_CHANNEL);
        if (reply.products && reply.products.length) appendSupportProductCards(reply.products, AI_CHANNEL);

        const aiMsg = {
            sender: 'bot',
            text: reply.text,
            ...buildAiPersistMeta(reply)
        };

        try {
            await persistAiChatMessage(threadId, aiMsg);
        } catch (persistErr) {
            console.warn('Could not persist AI reply (shown locally):', persistErr);
        }
    } catch (e) {
        if (typeof removeTypingIndicator === 'function') removeTypingIndicator();
        console.error('Support chat reply failed:', e);
        appendSupportBubble('bot', 'Something went wrong. Please try again' + (isAdminSupportChatEnabled() ? ' or switch to **Live Support**.' : '.'), '', AI_CHANNEL);
    }
}

async function handleSupportCustomerMessage(text) {
    const q = (text || '').trim().toLowerCase();
    if (window.supportChatState.activeTab === 'ai' && isAdminSupportChatEnabled() && /contact support|talk to admin|live support|speak to support/.test(q)) {
        switchSupportChatTab('admin');
        return;
    }
    if (window.supportChatState.activeTab === 'admin') {
        return handleAdminSupportMessage(text);
    }
    return handleAiSupportMessage(text);
}

function stopCustomerMessagesListener() {
    if (customerMessagesUnsub) {
        customerMessagesUnsub();
        customerMessagesUnsub = null;
    }
}

function subscribeCustomerThread(threadId) {
    stopCustomerMessagesListener();
    window.supportChatState.activeThreadId = threadId;
    supportKnownMsgIds.ai.clear();
    supportKnownMsgIds.support.clear();

    customerMessagesUnsub = db.collection('support_threads').doc(threadId)
        .collection('messages').orderBy('createdAt', 'asc').limit(150)
        .onSnapshot(snap => {
            const msgs = [];
            snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            const split = splitMessagesByChannel(msgs);
            window.supportMessagesCache.ai = split.ai;
            window.supportMessagesCache.support = split.support;

            if (!window.supportChatState.loaded) {
                renderChannelMessages(split.ai, AI_CHANNEL);
                renderChannelMessages(split.support, SUPPORT_CHANNEL);
                if (isAiChatEnabled() && !split.ai.length) {
                    let welcome = (window.APP_FEATURES_CONTENT?.chatbotWelcome) || "Hi! I'm your Swag Stree stylist. Ask about products, prices, or orders.";
                    if (isAdminSupportChatEnabled()) {
                        welcome += ' Need a person? Open the **Live Support** tab.';
                    }
                    appendSupportBubble('bot', welcome, '', AI_CHANNEL);
                }
                if (isAdminSupportChatEnabled() && !split.support.length) {
                    const hint = getChatBody(SUPPORT_CHANNEL);
                    if (hint && !hint.querySelector('[data-admin-tab-hint]')) {
                        appendSupportBubble('bot', 'Welcome to **Live Support**. Describe your issue and our team will reply here.', '', SUPPORT_CHANNEL);
                        const last = hint.lastElementChild;
                        if (last) last.setAttribute('data-admin-tab-hint', '1');
                    }
                }
                split.ai.forEach(m => supportKnownMsgIds.ai.add(m.id));
                split.support.forEach(m => supportKnownMsgIds.support.add(m.id));
                window.supportChatState.loaded = true;
                syncSupportChatHeaderFromThread(threadId);
            } else {
                const newSupportAdmin = split.support.filter(m => m.sender === 'admin' && !supportKnownMsgIds.support.has(m.id));
                if (newSupportAdmin.length && isAdminSupportChatEnabled()) {
                    if (typeof switchSupportChatTab === 'function') switchSupportChatTab('admin');
                    newSupportAdmin.forEach(m => {
                        appendSupportBubble('admin', m.text, '', SUPPORT_CHANNEL);
                        supportKnownMsgIds.support.add(m.id);
                        supportSeenAdminMsgIds.add(m.id);
                    });
                    updateSupportChatHeader('human', false);
                    if (typeof showToast === 'function') showToast('New reply from support team');
                }
                split.support.forEach(m => supportKnownMsgIds.support.add(m.id));
                split.ai.forEach(m => supportKnownMsgIds.ai.add(m.id));
            }

            db.collection('support_threads').doc(threadId).set({ unreadByCustomer: 0 }, { merge: true }).catch(() => {});
            applySupportUnreadBadge(0);
        }, () => {
            db.collection('support_threads').doc(threadId).collection('messages').limit(150)
                .onSnapshot(snap => {
                    const msgs = [];
                    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
                    msgs.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
                    const split = splitMessagesByChannel(msgs);
                    window.supportMessagesCache.ai = split.ai;
                    window.supportMessagesCache.support = split.support;
                    renderChannelMessages(split.ai, AI_CHANNEL);
                    renderChannelMessages(split.support, SUPPORT_CHANNEL);
                    window.supportChatState.loaded = true;
                });
        });
}

window.openSupportChat = async function() {
    if (!isAnySupportChatEnabled()) return showToast('Support chat is currently disabled.');
    const box = document.getElementById('ai-chat-box');
    if (!box) return;
    box.style.display = 'flex';
    window.supportChatState.adminThreadId = null;
    window.supportChatState.loaded = false;

    applySupportChatTabsVisibility();
    updateSupportChatTabUI(getDefaultSupportChatTab());

    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();
    await ensureSupportThread(threadId, profile);
    subscribeCustomerThread(threadId);

    await syncSupportChatHeaderFromThread(threadId);
    applySupportUnreadBadge(0);
};

window.toggleAIChat = function() {
    const box = document.getElementById('ai-chat-box');
    if (!box) return;
    const isHidden = box.style.display === 'none' || !box.style.display;
    if (isHidden) openSupportChat();
    else {
        box.style.display = 'none';
        stopCustomerMessagesListener();
    }
};

window.sendChatMessage = async function() {
    const input = document.getElementById('ai-chat-input');
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';
    await handleSupportCustomerMessage(text);
};

window.sendChatMessageWithText = async function(text) {
    if (!text || window.supportChatState?.sendLock) return;
    window.supportChatState.sendLock = true;
    try {
        await handleSupportCustomerMessage(text);
    } finally {
        setTimeout(() => { window.supportChatState.sendLock = false; }, 500);
    }
};

// ── Admin support chat ─────────────────────────────────────────────────────

function hasSupportChatCapability() {
    return typeof hasAdminCapability === 'function' && hasAdminCapability('manageSupportChat');
}

window.openAdminCustomerChat = async function(uid, email, name, threadIdOverride) {
    if (!isAdmin || !hasSupportChatCapability()) return showToast('You do not have permission to manage support chats.');
    const threadId = threadIdOverride || getCustomerThreadIdForUser(uid);
    if (!threadId) return showToast('Unable to create a console thread.');
    window.supportChatState.adminThreadId = threadId;

    document.getElementById('admin-customer-chat-name').textContent = name || 'Customer';
    document.getElementById('admin-customer-chat-email').textContent = email || 'Guest visitor';
    document.getElementById('admin-customer-chat-modal').style.display = 'flex';
    document.getElementById('admin-customer-chat-input').value = '';

    await ensureSupportThread(threadId, { uid, email, name: name || 'Customer' });

    if (adminThreadUnsub) adminThreadUnsub();
    const body = document.getElementById('admin-customer-chat-body');
    const displayName = name || 'Customer';
    if (body) body.innerHTML = '<p style="color:#666;font-size:12px;">Loading conversation...</p>';

    adminThreadUnsub = db.collection('support_threads').doc(threadId)
        .collection('messages').orderBy('createdAt', 'asc').limit(200)
        .onSnapshot(snap => {
            const msgs = [];
            snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            renderAdminChatMessages(msgs, displayName);
            db.collection('support_threads').doc(threadId).set({ unreadByAdmin: 0 }, { merge: true }).catch(() => {});
        }, () => {
            db.collection('support_threads').doc(threadId).collection('messages').limit(200)
                .onSnapshot(snap => {
                    const msgs = [];
                    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
                    msgs.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
                    renderAdminChatMessages(msgs, displayName);
                });
        });
};

window.closeAdminCustomerChat = function() {
    document.getElementById('admin-customer-chat-modal').style.display = 'none';
    if (adminThreadUnsub) { adminThreadUnsub(); adminThreadUnsub = null; }
    window.supportChatState.adminThreadId = null;
};

async function deleteSupportMessagesFromThreadByChannel(threadId, channel) {
    const targetChannel = channel === SUPPORT_CHANNEL ? SUPPORT_CHANNEL : AI_CHANNEL;
    const threadRef = db.collection('support_threads').doc(threadId);
    const snap = await threadRef.collection('messages').get();
    const toDelete = [];
    const remaining = [];

    snap.forEach(doc => {
        const data = doc.data();
        if (getMessageChannel(data) === targetChannel) {
            toDelete.push(doc.ref);
        } else {
            remaining.push({ id: doc.id, ...data });
        }
    });

    if (!toDelete.length) return 0;

    let refs = toDelete.slice();
    while (refs.length) {
        const chunk = refs.splice(0, 400);
        const batch = db.batch();
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
    }

    await updateThreadAfterChannelMessageRemoval(threadRef, remaining, targetChannel);
    return toDelete.length;
}

async function deleteAdminSupportMessagesFromThread(threadId) {
    return deleteSupportMessagesFromThreadByChannel(threadId, SUPPORT_CHANNEL);
}

async function deleteAiSupportMessagesFromThread(threadId) {
    return deleteSupportMessagesFromThreadByChannel(threadId, AI_CHANNEL);
}

async function updateThreadAfterChannelMessageRemoval(threadRef, remaining, targetChannel) {
    remaining.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
    const last = remaining[remaining.length - 1];
    const hasSupportRemaining = remaining.some(m => getMessageChannel(m) === SUPPORT_CHANNEL);
    const update = {
        unreadByAdmin: 0,
        unreadByCustomer: 0
    };

    if (targetChannel === SUPPORT_CHANNEL) {
        update.mode = 'ai';
        update.status = 'open';
        update.escalateReason = firebase.firestore.FieldValue.delete();
        update.escalatedAt = firebase.firestore.FieldValue.delete();
        update.lastSupportMessageAt = firebase.firestore.FieldValue.delete();
    } else if (!hasSupportRemaining) {
        update.mode = 'ai';
        update.status = 'open';
        update.escalateReason = firebase.firestore.FieldValue.delete();
        update.escalatedAt = firebase.firestore.FieldValue.delete();
        update.lastSupportMessageAt = firebase.firestore.FieldValue.delete();
    }

    if (last) {
        update.lastMessageAt = last.createdAt || firebase.firestore.FieldValue.serverTimestamp();
        update.lastMessagePreview = (last.text || '').slice(0, 120);
        update.lastMessageSender = last.sender || 'system';
    } else {
        update.lastMessagePreview = '';
        update.lastMessageSender = 'system';
        update.mode = 'ai';
        update.status = 'open';
    }

    const threadSnap = await threadRef.get();
    if (threadSnap.exists) {
        await threadRef.set(update, { merge: true });
    }
}

async function purgeSupportMessagesOlderThanFromThread(threadId, channel, cutoffMs) {
    const targetChannel = channel === SUPPORT_CHANNEL ? SUPPORT_CHANNEL : AI_CHANNEL;
    const threadRef = db.collection('support_threads').doc(threadId);
    const snap = await threadRef.collection('messages').get();
    const toDelete = [];
    const remaining = [];

    snap.forEach(doc => {
        const data = doc.data();
        const msgTime = data.createdAt?.toMillis?.() || 0;
        if (getMessageChannel(data) === targetChannel && msgTime > 0 && msgTime < cutoffMs) {
            toDelete.push(doc.ref);
        } else {
            remaining.push({ id: doc.id, ...data });
        }
    });

    if (!toDelete.length) return 0;

    let refs = toDelete.slice();
    while (refs.length) {
        const chunk = refs.splice(0, 400);
        const batch = db.batch();
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
    }

    await updateThreadAfterChannelMessageRemoval(threadRef, remaining, targetChannel);
    return toDelete.length;
}

window.purgeSupportMessagesOlderThan = async function(channel, maxAgeMs) {
    if (!isSuperAdmin || !maxAgeMs || maxAgeMs <= 0) return 0;
    const cutoffMs = Date.now() - maxAgeMs;
    const snap = await db.collection('support_threads').get();
    let totalDeleted = 0;
    for (const doc of snap.docs) {
        totalDeleted += await purgeSupportMessagesOlderThanFromThread(doc.id, channel, cutoffMs);
    }
    return totalDeleted;
};

window.purgeEmptySupportThreadsOlderThan = async function(maxAgeMs) {
    if (!isSuperAdmin || !maxAgeMs || maxAgeMs <= 0) return 0;
    const cutoffMs = Date.now() - maxAgeMs;
    const snap = await db.collection('support_threads').get();
    let deleted = 0;

    for (const doc of snap.docs) {
        const data = doc.data();
        const msgSnap = await doc.ref.collection('messages').limit(1).get();
        if (!msgSnap.empty) continue;

        const threadTime = data.lastMessageAt?.toMillis?.() || data.createdAt?.toMillis?.() || 0;
        if (threadTime > 0 && threadTime < cutoffMs) {
            await doc.ref.delete();
            deleted++;
        }
    }
    return deleted;
};

function getCustomerUidsFromParams(uid, mergedUidsParam) {
    let uids = [uid];
    if (mergedUidsParam) {
        uids = String(mergedUidsParam).split(',').map(id => id.trim()).filter(Boolean);
    }
    if (!uids.includes(uid)) uids.unshift(uid);
    return [...new Set(uids)];
}

window.deleteCustomerAdminSupportChats = async function(uid, email, name, mergedUidsParam) {
    if (!isSuperAdmin) return showToast('Only superadmin can delete admin support chats.');

    const uids = getCustomerUidsFromParams(uid, mergedUidsParam);
    const label = name || email || uid;
    if (!confirm(`Delete all Live Support (admin) chat messages for ${label}?\n\nAI Help messages are kept. This cannot be undone.`)) {
        return;
    }

    let totalDeleted = 0;
    try {
        for (const id of uids) {
            totalDeleted += await deleteAdminSupportMessagesFromThread(getCustomerThreadIdForUser(id));
        }

        const activeThreadId = window.supportChatState.adminThreadId;
        if (activeThreadId && uids.some(id => getCustomerThreadIdForUser(id) === activeThreadId)) {
            closeAdminCustomerChat();
        }

        if (typeof loadAdminSupportInbox === 'function') loadAdminSupportInbox();
        if (typeof updateAdminSupportBadge === 'function') updateAdminSupportBadge();

        showToast(totalDeleted
            ? `Deleted ${totalDeleted} Live Support message${totalDeleted === 1 ? '' : 's'}. AI Help history kept.`
            : 'No Live Support messages found for this customer.');
    } catch (e) {
        console.error('deleteCustomerAdminSupportChats failed:', e);
        showToast('Failed to delete admin support chats. Please try again.');
    }
};

window.deleteCustomerAiSupportChats = async function(uid, email, name, mergedUidsParam) {
    if (!isSuperAdmin) return showToast('Only superadmin can delete AI help chats.');

    const uids = getCustomerUidsFromParams(uid, mergedUidsParam);
    const label = name || email || uid;
    if (!confirm(`Delete all AI Help chat messages for ${label}?\n\nLive Support messages are kept. This cannot be undone.`)) {
        return;
    }

    let totalDeleted = 0;
    try {
        for (const id of uids) {
            totalDeleted += await deleteAiSupportMessagesFromThread(getCustomerThreadIdForUser(id));
        }

        const activeThreadId = window.supportChatState.activeThreadId;
        if (activeThreadId && uids.some(id => getCustomerThreadIdForUser(id) === activeThreadId)) {
            window.supportChatState.loaded = false;
            const aiBody = document.getElementById('ai-chat-body-ai');
            if (aiBody) aiBody.innerHTML = '';
            if (window.supportChatState.activeTab === 'ai' && typeof switchSupportChatTab === 'function') {
                switchSupportChatTab('ai');
            }
        }

        showToast(totalDeleted
            ? `Deleted ${totalDeleted} AI Help message${totalDeleted === 1 ? '' : 's'}. Live Support history kept.`
            : 'No AI Help messages found for this customer.');
    } catch (e) {
        console.error('deleteCustomerAiSupportChats failed:', e);
        showToast('Failed to delete AI help chats. Please try again.');
    }
};

window.deleteAllSupportChatsByChannel = async function(channel) {
    if (!isSuperAdmin) return 0;
    const deleteFn = channel === SUPPORT_CHANNEL
        ? deleteAdminSupportMessagesFromThread
        : deleteAiSupportMessagesFromThread;

    const snap = await db.collection('support_threads').get();
    let totalDeleted = 0;
    for (const doc of snap.docs) {
        totalDeleted += await deleteFn(doc.id);
    }
    return totalDeleted;
};

window.sendAdminCustomerChat = async function() {
    if (!hasSupportChatCapability()) return showToast('No permission.');
    const input = document.getElementById('admin-customer-chat-input');
    const text = input?.value?.trim();
    if (!text) return;
    const threadId = window.supportChatState.adminThreadId;
    if (!threadId) return;

    input.value = '';
    try {
        await persistSupportMessage(threadId, {
            sender: 'admin',
            text,
            type: 'text',
            senderEmail: currentUser?.email || '',
            senderName: currentUser?.displayName || 'Admin'
        });
        await db.collection('support_threads').doc(threadId).set({
            mode: 'human',
            status: 'open'
        }, { merge: true });
        if (typeof showToast === 'function') showToast('Message sent to customer');
    } catch (e) {
        console.error('Admin chat send failed:', e);
        if (typeof showToast === 'function') showToast('Failed to send message. Please try again.');
        input.value = text;
    }
};

function threadHasSupportActivity(t) {
    if (!t) return false;
    if ((t.unreadByAdmin || 0) > 0) return true;
    if (t.status === 'waiting_admin') return true;
    if (t.mode === 'human') return true;
    if (t.lastMessageSender === 'admin') return true;
    if (t.lastMessageSender === 'customer' && (t.status === 'waiting_admin' || t.escalateReason)) return true;
    return false;
}

function renderAdminSupportInbox() {
    const container = document.getElementById('admin-support-inbox-list');
    if (!container) return;
    const threads = (window.supportThreadsCache || []).filter(threadHasSupportActivity);
    if (!threads.length) {
        container.innerHTML = '<p style="text-align:center;color:#555;font-size:12px;padding:20px 0;">No support conversations yet.</p>';
        return;
    }
    container.innerHTML = threads.map(t => {
        const unread = t.unreadByAdmin || 0;
        const isWaiting = t.status === 'waiting_admin';
        const safeUid = (t.customerUid || '').replace(/'/g, "\\'");
        const safeEmail = (t.customerEmail || '').replace(/'/g, "\\'");
        const safeName = (t.customerName || 'Customer').replace(/'/g, "\\'");
        const safeThreadId = (t.id || '').replace(/'/g, "\\'");
        const openArgs = t.customerUid
            ? `'${safeUid}','${safeEmail}','${safeName}'`
            : `'','${safeEmail}','${safeName}','${safeThreadId}'`;
        const previewPrefix = getAdminPreviewPrefix(t.lastMessageSender || 'customer');
        const previewText = t.lastMessagePreview || 'No messages yet';
        return `
        <div style="background:#111;border:1px solid #222;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <strong style="font-size:13px;color:#eee;">${escHtml(t.customerName || 'Guest')}</strong>
                    ${!t.customerUid ? '<span style="font-size:9px;color:#666;">Guest</span>' : ''}
                    ${t.customerEmail ? `<span style="font-size:9px;color:#555;">${escHtml(t.customerEmail)}</span>` : ''}
                    ${unread ? `<span style="font-size:9px;background:var(--red);color:#fff;padding:2px 6px;border-radius:8px;">${unread} new</span>` : ''}
                    ${isWaiting ? `<span style="font-size:9px;background:rgba(255,215,0,0.15);color:var(--gold);padding:2px 6px;border-radius:8px;">Needs reply</span>` : ''}
                </div>
                <p style="margin:4px 0 0;font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    <span style="color:var(--gold);font-weight:700;">${previewPrefix}:</span> ${escHtml(previewText)}
                </p>
            </div>
            <button class="btn-gold" style="width:auto;padding:8px 12px;font-size:11px;margin:0;" onclick="openAdminCustomerChat(${openArgs})"><i class="fa fa-comments"></i> Open Chat</button>
        </div>`;
    }).join('');
}

window.loadAdminSupportInbox = function() {
    if (!isAdmin || !hasSupportChatCapability()) return;
    if (adminInboxUnsub) return;
    adminInboxUnsub = db.collection('support_threads').orderBy('lastMessageAt', 'desc').limit(50)
        .onSnapshot(snap => {
            window.supportThreadsCache = [];
            snap.forEach(doc => window.supportThreadsCache.push({ id: doc.id, ...doc.data() }));
            renderAdminSupportInbox();
            updateAdminSupportBadge();
        }, () => {
            db.collection('support_threads').limit(50).onSnapshot(snap => {
                window.supportThreadsCache = [];
                snap.forEach(doc => window.supportThreadsCache.push({ id: doc.id, ...doc.data() }));
                window.supportThreadsCache.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
                renderAdminSupportInbox();
            });
        });
};

window.toggleAdminSupportAccordion = function() {
    const content = document.getElementById('admin-support-accordion-content');
    const icon = document.getElementById('admin-support-accordion-icon');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'flex' : 'none';
    if (icon) icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (isHidden) loadAdminSupportInbox();
};

function updateSupportUnreadBadge() {
    if (!isAnySupportChatEnabled()) return;
    const threadId = getCustomerThreadIdForUser(currentUser ? currentUser.uid : null);
    db.collection('support_threads').doc(threadId).get().then(doc => {
        applySupportUnreadBadge(doc.exists ? (doc.data().unreadByCustomer || 0) : 0);
    }).catch(() => {});
}

function updateAdminSupportBadge() {
    const badge = document.getElementById('admin-support-pending-badge');
    if (!badge) return;
    const total = (window.supportThreadsCache || [])
        .filter(threadHasSupportActivity)
        .reduce((s, t) => s + (t.unreadByAdmin || 0), 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
}

function updateSupportChatVisibility() {
    if (typeof applyCatalogControlsVisibility === 'function') {
        applyCatalogControlsVisibility();
    }
    const adminSection = document.getElementById('admin-support-inbox-section');
    if (adminSection) {
        const showInbox = isAdmin && hasSupportChatCapability() && isAdminSupportChatEnabled();
        adminSection.style.display = showInbox ? 'block' : 'none';
    }
    if (isAnySupportChatEnabled()) startSupportCustomerWatcher();
    else stopSupportCustomerWatcher();
}
window.updateSupportChatVisibility = updateSupportChatVisibility;

window.updateCatalogControlsRowLayout = function() {
    const isMobile = window.innerWidth < 480;
    const isTablet = window.innerWidth >= 480 && window.innerWidth < 1024;

    document.querySelectorAll('.catalog-controls-row').forEach(row => {
        const isWish = row.classList.contains('catalog-row-wishlist') || !!row.closest('#wish-view');
        const viewKey = isWish ? 'wishlist' : 'home';

        const chatEnabled = typeof isCatalogControlEnabled === 'function'
            ? isCatalogControlEnabled(viewKey, 'chat')
            : isAnySupportChatEnabled();
        const annEnabled = typeof isCatalogControlEnabled === 'function'
            ? isCatalogControlEnabled(viewKey, 'announcement')
            : window.APP_FEATURES?.announcementBell !== false;

        row.classList.toggle('catalog-row-no-chat', !chatEnabled);
        row.classList.toggle('catalog-row-no-announcement', !annEnabled);
        row.classList.toggle('catalog-row-icons-minimal', !chatEnabled && !annEnabled);

        let actionsWidth = isMobile ? 102 : (isTablet ? 116 : 128);
        if (chatEnabled) actionsWidth += isMobile ? 36 : 40;
        if (annEnabled) actionsWidth += isMobile ? 36 : 40;

        if (isWish) {
            row.classList.add('catalog-row-wishlist');
            if (!chatEnabled && !annEnabled) {
                const sortWidth = isMobile ? 104 : (isTablet ? 118 : 130);
                row.style.setProperty('--catalog-actions-width', `${sortWidth}px`);
            } else {
                row.style.setProperty('--catalog-actions-width', `${actionsWidth}px`);
            }
            return;
        }

        row.style.setProperty('--catalog-actions-width', `${actionsWidth}px`);
    });

    if (typeof refreshCatalogCountLabels === 'function') refreshCatalogCountLabels();
};

let catalogLayoutResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(catalogLayoutResizeTimer);
    catalogLayoutResizeTimer = setTimeout(() => {
        if (typeof updateCatalogControlsRowLayout === 'function') updateCatalogControlsRowLayout();
    }, 120);
});

window.cleanupSupportChatListeners = function() {
    stopCustomerMessagesListener();
    stopSupportCustomerWatcher();
    if (adminInboxUnsub) {
        adminInboxUnsub();
        adminInboxUnsub = null;
    }
    if (adminThreadUnsub) {
        adminThreadUnsub();
        adminThreadUnsub = null;
    }
    window.supportThreadsCache = [];
    window.supportChatState.activeThreadId = null;
    window.supportChatState.adminThreadId = null;
    window.supportChatState.loaded = false;
    const box = document.getElementById('ai-chat-box');
    if (box) box.style.display = 'none';
    const adminModal = document.getElementById('admin-customer-chat-modal');
    if (adminModal) adminModal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof applyCatalogControlsVisibility === 'function') applyCatalogControlsVisibility();
    updateSupportChatVisibility();
});
