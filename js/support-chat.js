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
    loaded: false
};

let customerMessagesUnsub = null;
let adminInboxUnsub = null;
let adminThreadUnsub = null;
window.supportThreadsCache = window.supportThreadsCache || [];

const SUPPORT_QUICK_CHIPS = [
    'Suggest outfits under ₹1000',
    'Track my order',
    'Best sellers',
    'Contact support',
    'Talk to admin',
    'Return or complaint'
];

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

async function persistSupportMessage(threadId, msg) {
    const threadRef = db.collection('support_threads').doc(threadId);
    const msgRef = threadRef.collection('messages').doc();
    const payload = stripUndefinedFields({
        ...msg,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        readByCustomer: msg.sender === 'customer' || msg.sender === 'ai',
        readByAdmin: msg.sender === 'admin' || msg.sender === 'ai'
    });
    await msgRef.set(payload);
    const unreadByAdmin = msg.sender === 'customer' ? firebase.firestore.FieldValue.increment(1) : 0;
    const unreadByCustomer = msg.sender === 'admin' ? firebase.firestore.FieldValue.increment(1) : 0;
    const update = {
        lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
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

function getContactInfo() {
    const footer = window.footerSettings || {};
    const phone = footer.contactPhone || '8800467686';
    const email = footer.contactEmail || 'support@swagstree.com';
    return { phone, email, wa: '918800467686' };
}

function searchProducts(query, maxPrice) {
    const list = window.products || [];
    const q = (query || '').toLowerCase();
    return list.filter(p => {
        if (maxPrice && Number(p.price) > maxPrice) return false;
        if (!q) return true;
        const hay = `${p.name} ${p.description || ''}`.toLowerCase();
        return hay.includes(q) || q.split(/\s+/).some(w => w.length > 2 && hay.includes(w));
    }).slice(0, 4);
}

function detectSupportIntent(text) {
    const q = text.toLowerCase();
    if (/talk to admin|human|agent|real person|speak to support|connect.*admin/.test(q)) return 'human';
    if (/complaint|issue|problem|defect|damaged|wrong item|return|refund/.test(q)) return 'complaint';
    if (/track|order status|where is my order|my order/.test(q)) return 'order';
    if (/contact|email|phone|call|whatsapp|support mail/.test(q)) return 'contact';
    if (/under ₹?\s*(\d+)|below ₹?\s*(\d+)|budget|cheap|affordable|price filter/.test(q)) {
        const m = q.match(/(\d{3,5})/);
        return { type: 'price_filter', max: m ? parseInt(m[1], 10) : 1000 };
    }
    if (/suggest|recommend|show me|best seller|popular|outfit|dress|kurta|saree|product/.test(q)) return 'suggest';
    if (/price|cost|how much|₹/.test(q)) return 'price';
    return 'ai';
}

function buildProductCardsHtml(products) {
    if (!products.length) return '<p style="margin:0;font-size:12px;color:#888;">No matching products found right now.</p>';
    return products.map(p => {
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
}

function renderSupportQuickChips() {
    const container = document.getElementById('ai-chat-chips');
    if (!container) return;
    container.style.display = 'flex';
    container.innerHTML = SUPPORT_QUICK_CHIPS.map(chip =>
        `<div class="ai-chat-chip" onclick="sendChatMessageWithText('${chip.replace(/'/g, "\\'")}')">${escHtml(chip)}</div>`
    ).join('');
}

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

function appendSupportBubble(sender, text, htmlExtra) {
    const body = document.getElementById('ai-chat-body');
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

    if (typeof window.chatHistory !== 'undefined' && Array.isArray(window.chatHistory)) {
        window.chatHistory.push({ sender: sender === 'customer' ? 'user' : 'bot', text });
    }
}

function appendSupportProductCards(products) {
    const body = document.getElementById('ai-chat-body');
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

    if (intent === 'human' || intent === 'complaint') {
        return {
            text: intent === 'complaint'
                ? "I'm sorry you're facing an issue. I've **escalated this to our admin team**. They will reply here shortly.\n\nYou can also reach us on WhatsApp or email while you wait."
                : "Connecting you with a **live admin**. Please describe your question — our team will reply in this chat shortly.",
            escalate: true,
            extraHtml: `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
                <a href="https://wa.me/${contact.wa}" target="_blank" style="font-size:10px;color:var(--gold);">WhatsApp</a>
                <span style="color:#444">•</span>
                <a href="mailto:${escHtml(contact.email)}" style="font-size:10px;color:var(--gold);">${escHtml(contact.email)}</a>
            </div>`
        };
    }
    if (intent === 'order') {
        return {
            text: currentUser
                ? "You can **track orders** in Profile → My Orders. I can also connect you with admin for order-specific help."
                : "Please **sign in** to view your orders under Profile. Guest orders linked to your email appear after login.",
            extraHtml: currentUser ? `<button class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="nav('user'); toggleAIChat();">Open My Orders</button>` : ''
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
    if (intent === 'suggest' || intent === 'price') {
        const max = typeof intent === 'object' ? intent.max : null;
        const matched = searchProducts(userText.replace(/suggest|recommend|show|price|cost|under|below/gi, ''), max);
        return {
            text: matched.length
                ? `Here are **${matched.length} pick${matched.length > 1 ? 's' : ''}** from our catalog${max ? ` under ₹${max}` : ''}:`
                : "I couldn't find an exact match. Try a product name, color, or budget (e.g. under ₹800).",
            products: matched
        };
    }
    if (typeof intent === 'object' && intent.type === 'price_filter') {
        const matched = searchProducts('', intent.max);
        return {
            text: `Showing styles **under ₹${intent.max}**:`,
            products: matched
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
    const matched = searchProducts(userText.replace(/help|please|want|need|show|find/gi, ''), null);
    if (matched.length) {
        return {
            text: `Here are **${matched.length} item${matched.length > 1 ? 's' : ''}** from our catalog that may match:`,
            products: matched
        };
    }
    if (/hello|hi|hey|namaste/.test(q)) {
        return { text: "Hello! Welcome to **Swag Stree**. Ask for outfit suggestions, prices, order help, or say **Talk to admin** for live support." };
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
        text: "I'm here to help with **products**, **prices**, **orders**, and **styling** — all on-device, no paid API needed.\n\nTry: *Suggest outfits under ₹1000*, *Best sellers*, or **Talk to admin** for live help."
    };
}

async function handleSupportCustomerMessage(text) {
    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();
    await ensureSupportThread(threadId, profile);

    window.supportChatState.loaded = true;
    appendSupportBubble('customer', text);
    await persistSupportMessage(threadId, {
        sender: 'customer',
        text,
        type: 'text',
        customerName: profile.name,
        customerEmail: profile.email
    });

    const threadSnap = await db.collection('support_threads').doc(threadId).get();
    const threadData = threadSnap.exists ? threadSnap.data() : {};
    if (threadData.mode === 'human' && threadData.status === 'waiting_admin') {
        updateSupportChatHeader('human', true);
        appendSupportBubble('bot', 'Your message was sent to our admin team. They will reply here soon.');
        return;
    }

    const typing = typeof appendTypingIndicator === 'function' ? appendTypingIndicator() : null;
    try {
        const reply = await generateSmartSupportReply(text);
        if (typeof removeTypingIndicator === 'function') removeTypingIndicator();

        appendSupportBubble('bot', reply.text, reply.extraHtml || '');
        if (reply.products && reply.products.length) appendSupportProductCards(reply.products);

        await persistSupportMessage(threadId, {
            sender: 'ai',
            text: reply.text,
            type: reply.products ? 'product_suggest' : 'text',
            escalated: !!reply.escalate
        });

        if (reply.escalate) updateSupportChatHeader('human', true);
    } catch (e) {
        if (typeof removeTypingIndicator === 'function') removeTypingIndicator();
        appendSupportBubble('bot', 'Something went wrong. Please try again or tap **Talk to admin**.');
    }
}

function stopCustomerMessagesListener() {
    if (customerMessagesUnsub) {
        customerMessagesUnsub();
        customerMessagesUnsub = null;
    }
}

function renderThreadMessages(messages, isAdminView) {
    const body = document.getElementById(isAdminView ? 'admin-customer-chat-body' : 'ai-chat-body');
    if (!body) return;
    body.innerHTML = '';
    if (typeof window.chatHistory !== 'undefined') window.chatHistory = [];

    messages.forEach(msg => {
        if (msg.sender === 'customer') appendSupportBubble('customer', msg.text);
        else if (msg.sender === 'admin') appendSupportBubble('admin', msg.text);
        else appendSupportBubble('bot', msg.text);
    });
}

function subscribeCustomerThread(threadId) {
    stopCustomerMessagesListener();
    window.supportChatState.activeThreadId = threadId;
    let knownIds = new Set();

    customerMessagesUnsub = db.collection('support_threads').doc(threadId)
        .collection('messages').orderBy('createdAt', 'asc').limit(100)
        .onSnapshot(snap => {
            const msgs = [];
            snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));

            const newAdminMsgs = msgs.filter(m => m.sender === 'admin' && !knownIds.has(m.id));
            if (!window.supportChatState.loaded) {
                renderThreadMessages(msgs, false);
                msgs.forEach(m => knownIds.add(m.id));
                window.supportChatState.loaded = true;
            } else if (newAdminMsgs.length) {
                newAdminMsgs.forEach(m => {
                    appendSupportBubble('admin', m.text);
                    knownIds.add(m.id);
                });
                updateSupportChatHeader('human', false);
            }

            db.collection('support_threads').doc(threadId).set({ unreadByCustomer: 0 }, { merge: true }).catch(() => {});
            updateSupportUnreadBadge();
        }, () => {
            db.collection('support_threads').doc(threadId).collection('messages').limit(100)
                .onSnapshot(snap => {
                    const msgs = [];
                    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
                    msgs.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
                    renderThreadMessages(msgs, false);
                    window.supportChatState.loaded = true;
                });
        });
}

window.openSupportChat = async function() {
    if (!window.APP_FEATURES?.aiChatbot) return showToast('Support chat is currently disabled.');
    const box = document.getElementById('ai-chat-box');
    if (!box) return;
    box.style.display = 'flex';
    window.supportChatState.adminThreadId = null;
    window.supportChatState.loaded = false;

    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();
    await ensureSupportThread(threadId, profile);
    subscribeCustomerThread(threadId);

    const msgSnap = await db.collection('support_threads').doc(threadId).collection('messages').limit(1).get();
    const body = document.getElementById('ai-chat-body');
    if (body && msgSnap.empty && body.childElementCount === 0) {
        const welcome = (window.APP_FEATURES_CONTENT?.chatbotWelcome) || "Hi! I'm your Swag Stree stylist. Ask about products, prices, orders, or tap **Talk to admin** for live help.";
        appendSupportBubble('bot', welcome);
    }
    renderSupportQuickChips();
    updateSupportChatHeader('ai', false);
    updateSupportUnreadBadge();
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
    if (!text) return;
    await handleSupportCustomerMessage(text);
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
    document.getElementById('admin-customer-chat-email').textContent = email || '';
    document.getElementById('admin-customer-chat-modal').style.display = 'flex';
    document.getElementById('admin-customer-chat-input').value = '';

    await ensureSupportThread(threadId, { uid, email, name: name || 'Customer' });

    if (adminThreadUnsub) adminThreadUnsub();
    const body = document.getElementById('admin-customer-chat-body');
    if (body) body.innerHTML = '<p style="color:#666;font-size:12px;">Loading conversation...</p>';

    adminThreadUnsub = db.collection('support_threads').doc(threadId)
        .collection('messages').orderBy('createdAt', 'asc').limit(200)
        .onSnapshot(snap => {
            const msgs = [];
            snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
            if (body) {
                body.innerHTML = '';
                msgs.forEach(msg => {
                    const div = document.createElement('div');
                    div.style.margin = '8px 0';
                    div.style.padding = '8px 12px';
                    div.style.borderRadius = '10px';
                    div.style.maxWidth = '85%';
                    div.style.fontSize = '12px';
                    if (msg.sender === 'admin') {
                        div.style.background = 'var(--gold)';
                        div.style.color = '#000';
                        div.style.marginLeft = 'auto';
                        div.innerText = msg.text;
                    } else if (msg.sender === 'customer') {
                        div.style.background = '#222';
                        div.style.border = '1px solid #333';
                        div.style.color = '#fff';
                        div.innerHTML = `<div style="font-size:9px;color:var(--gold);margin-bottom:4px;">CUSTOMER</div>${escHtml(msg.text)}`;
                    } else {
                        div.style.background = '#1a1a1a';
                        div.style.border = '1px solid #333';
                        div.style.color = '#aaa';
                        div.innerHTML = `<div style="font-size:9px;color:#888;margin-bottom:4px;">AI</div>${escHtml(msg.text)}`;
                    }
                    body.appendChild(div);
                });
                body.scrollTop = body.scrollHeight;
            }
            db.collection('support_threads').doc(threadId).set({ unreadByAdmin: 0 }, { merge: true }).catch(() => {});
        }, () => {
            db.collection('support_threads').doc(threadId).collection('messages').limit(200)
                .onSnapshot(snap => {
                    const msgs = [];
                    snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
                    msgs.sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
                    if (body) {
                        body.innerHTML = '';
                        msgs.forEach(msg => {
                            const div = document.createElement('div');
                            div.style.cssText = 'margin:8px 0;padding:8px 12px;border-radius:10px;font-size:12px;max-width:85%;';
                            div.style.background = msg.sender === 'admin' ? 'var(--gold)' : '#222';
                            div.style.color = msg.sender === 'admin' ? '#000' : '#fff';
                            div.style.marginLeft = msg.sender === 'admin' ? 'auto' : '0';
                            div.textContent = msg.text;
                            body.appendChild(div);
                        });
                        body.scrollTop = body.scrollHeight;
                    }
                });
        });
};

window.closeAdminCustomerChat = function() {
    document.getElementById('admin-customer-chat-modal').style.display = 'none';
    if (adminThreadUnsub) { adminThreadUnsub(); adminThreadUnsub = null; }
    window.supportChatState.adminThreadId = null;
};

window.sendAdminCustomerChat = async function() {
    if (!hasSupportChatCapability()) return showToast('No permission.');
    const input = document.getElementById('admin-customer-chat-input');
    const text = input?.value?.trim();
    if (!text) return;
    const threadId = window.supportChatState.adminThreadId;
    if (!threadId) return;

    input.value = '';
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
};

function renderAdminSupportInbox() {
    const container = document.getElementById('admin-support-inbox-list');
    if (!container) return;
    const threads = window.supportThreadsCache || [];
    if (!threads.length) {
        container.innerHTML = '<p style="text-align:center;color:#555;font-size:12px;padding:20px 0;">No support conversations yet.</p>';
        return;
    }
    container.innerHTML = threads.map(t => {
        const unread = t.unreadByAdmin || 0;
        const safeUid = (t.customerUid || '').replace(/'/g, "\\'");
        const safeEmail = (t.customerEmail || '').replace(/'/g, "\\'");
        const safeName = (t.customerName || 'Customer').replace(/'/g, "\\'");
        const safeThreadId = (t.id || '').replace(/'/g, "\\'");
        const openArgs = t.customerUid
            ? `'${safeUid}','${safeEmail}','${safeName}'`
            : `'','${safeEmail}','${safeName}','${safeThreadId}'`;
        return `
        <div style="background:#111;border:1px solid #222;border-radius:10px;padding:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <strong style="font-size:13px;color:#eee;">${escHtml(t.customerName || 'Guest')}</strong>
                    ${!t.customerUid ? '<span style="font-size:9px;color:#666;">Guest</span>' : ''}
                    ${unread ? `<span style="font-size:9px;background:var(--red);color:#fff;padding:2px 6px;border-radius:8px;">${unread} new</span>` : ''}
                    <span style="font-size:9px;color:#666;text-transform:uppercase;">${escHtml(t.mode || 'ai')}</span>
                </div>
                <p style="margin:4px 0 0;font-size:11px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(t.lastMessagePreview || 'No messages')}</p>
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
    const badge = document.getElementById('header-support-chat-badge');
    if (!badge || !currentUser) return;
    const threadId = getCustomerThreadIdForUser(currentUser.uid);
    db.collection('support_threads').doc(threadId).get().then(doc => {
        const n = doc.exists ? (doc.data().unreadByCustomer || 0) : 0;
        badge.style.display = n > 0 ? 'block' : 'none';
        badge.textContent = n > 9 ? '9+' : String(n);
    }).catch(() => {});
}

function updateAdminSupportBadge() {
    const badge = document.getElementById('admin-support-pending-badge');
    if (!badge) return;
    const total = (window.supportThreadsCache || []).reduce((s, t) => s + (t.unreadByAdmin || 0), 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
}

function updateSupportChatVisibility() {
    const enabled = !!(window.APP_FEATURES && window.APP_FEATURES.aiChatbot);
    const headerBtn = document.getElementById('header-support-chat-btn');
    const floatBtn = document.getElementById('ai-chat-trigger');
    if (headerBtn) headerBtn.style.display = enabled ? 'flex' : 'none';
    if (floatBtn) floatBtn.style.display = enabled ? 'grid' : 'none';
    if (!enabled) {
        const box = document.getElementById('ai-chat-box');
        if (box) box.style.display = 'none';
    }
    const adminSection = document.getElementById('admin-support-inbox-section');
    if (adminSection) {
        adminSection.style.display = (isAdmin && hasSupportChatCapability()) ? 'block' : 'none';
    }
}
window.updateSupportChatVisibility = updateSupportChatVisibility;

window.cleanupSupportChatListeners = function() {
    stopCustomerMessagesListener();
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
    updateSupportChatVisibility();
    if (currentUser) updateSupportUnreadBadge();
});
