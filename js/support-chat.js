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
window.supportUserEmailCache = window.supportUserEmailCache || {};
window.adminSupportInboxState = window.adminSupportInboxState || {
    activeTab: 'registered',
    search: '',
    page: 1,
    pageSize: 5
};

const STAFF_ADMIN_EMAILS = ['admin@swagstree.com', 'superadmin@swagstree.com'];
const ADMIN_SUPPORT_INBOX_FETCH_LIMIT = 100;

const AI_SUPPORT_CHIPS = [
    'What can you help with?',
    'Suggest outfits under ₹1000',
    'Best sellers',
    "What's new?",
    'Gift ideas under ₹1500',
    'Complete outfit under ₹3000',
    'Browse categories',
    'Track my order',
    'My cart',
    'Offers & promos',
    'Payment & COD',
    'Talk to admin'
];

const CHAT_OCCASION_KEYWORDS = {
    wedding: ['wedding', 'shaadi', 'bridal', 'reception', 'sangeet'],
    party: ['party', 'celebration', 'night out', 'cocktail'],
    office: ['office', 'work', 'formal', 'professional', 'corporate'],
    casual: ['casual', 'everyday', 'daily wear', 'relaxed'],
    festive: ['festive', 'festival', 'diwali', 'holi', 'eid', 'navratri', 'puja'],
    ethnic: ['ethnic', 'traditional', 'indian wear'],
    date: ['date night', 'dinner date', 'romantic']
};

const CHAT_COLOR_KEYWORDS = [
    'red', 'maroon', 'crimson', 'blue', 'navy', 'indigo', 'green', 'olive', 'emerald',
    'black', 'white', 'cream', 'beige', 'pink', 'rose', 'gold', 'yellow', 'orange',
    'purple', 'violet', 'brown', 'grey', 'gray', 'teal', 'turquoise', 'peach', 'mint'
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
    if (isAdminSupportChatEnabled() && isLoggedInCustomer()) return 'admin';
    return 'ai';
}

function isLoggedInCustomer() {
    return !!(currentUser && currentUser.uid);
}

function canUseStorefrontLiveSupport() {
    return isAdminSupportChatEnabled() && isLoggedInCustomer();
}

function applySupportChatTabsVisibility() {
    const aiEnabled = isAiChatEnabled();
    const liveSupportEnabled = isAdminSupportChatEnabled();
    const loggedIn = isLoggedInCustomer();
    const showLiveSupportTab = liveSupportEnabled && loggedIn;
    const tabsEl = document.getElementById('ai-chat-tabs');
    const aiTab = document.getElementById('ai-chat-tab-ai');
    const adminTab = document.getElementById('ai-chat-tab-admin');
    const card = document.getElementById('ai-chat-box');

    if (aiTab) {
        aiTab.hidden = !aiEnabled;
        aiTab.style.display = aiEnabled ? 'flex' : 'none';
    }
    if (adminTab) {
        adminTab.hidden = !showLiveSupportTab;
        adminTab.style.display = showLiveSupportTab ? 'flex' : 'none';
        adminTab.classList.remove('ai-chat-tab--locked');
        adminTab.setAttribute('aria-disabled', 'false');
    }

    const showTabsBar = aiEnabled && showLiveSupportTab;
    if (tabsEl) {
        tabsEl.hidden = !showTabsBar;
        tabsEl.style.display = showTabsBar ? 'flex' : 'none';
        tabsEl.classList.toggle('ai-chat-tabs--visible', showTabsBar);
        tabsEl.setAttribute('aria-hidden', showTabsBar ? 'false' : 'true');
    }
    if (card) {
        card.classList.toggle('ai-chat-card--has-tabs', showTabsBar);
    }

    const active = window.supportChatState.activeTab;
    if ((active === 'ai' && !aiEnabled) || (active === 'admin' && !showLiveSupportTab)) {
        updateSupportChatTabUI(getDefaultSupportChatTab());
    } else if (showTabsBar) {
        updateSupportChatTabUI(active || getDefaultSupportChatTab());
    }
}
window.applySupportChatTabsVisibility = applySupportChatTabsVisibility;

const CHAT_PRODUCT_PAGE_SIZE = 5;
const CHAT_PRODUCT_QUERY_LIMIT = 500;
const CHAT_PRODUCT_DISPLAY_LIMIT = CHAT_PRODUCT_QUERY_LIMIT;

function getProductSearchHaystack(p) {
    const colors = [];
    const sizes = [];
    if (Array.isArray(p.sizes)) sizes.push(...p.sizes);
    if (p.sizeColorMap && typeof p.sizeColorMap === 'object') {
        Object.values(p.sizeColorMap).forEach(arr => {
            if (Array.isArray(arr)) colors.push(...arr);
        });
    }
    if (Array.isArray(p.variants)) {
        p.variants.forEach(v => {
            if (v.size) sizes.push(v.size);
            if (v.colorName) colors.push(v.colorName);
            if (v.color) colors.push(v.color);
            if (v.pattern) colors.push(v.pattern);
        });
    }
    const cat = typeof resolveProductCategoryLabel === 'function'
        ? resolveProductCategoryLabel(p)
        : (p.categoryName || '');
    return `${p.name || ''} ${p.description || ''} ${cat} ${colors.join(' ')} ${sizes.join(' ')}`.toLowerCase();
}

function getCatalogCategoriesForChat(limit = 12) {
    const fromCats = (window.productCategories || []).map(c => c.name).filter(Boolean);
    if (fromCats.length) return fromCats.slice(0, limit);
    const set = new Set();
    (window.products || []).forEach(p => {
        const c = typeof resolveProductCategoryLabel === 'function'
            ? resolveProductCategoryLabel(p)
            : (p.categoryName || '');
        if (c) set.add(c);
    });
    return [...set].slice(0, limit);
}

function getCatalogPriceRange() {
    const prices = (window.products || []).map(p => Number(p.price) || 0).filter(n => n > 0);
    if (!prices.length) return null;
    return { min: Math.min(...prices), max: Math.max(...prices) };
}

function getNewArrivalProducts(limit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    const list = (window.products || []).slice();
    list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || a.createdAt || 0;
        const tb = b.createdAt?.toMillis?.() || b.createdAt || 0;
        return tb - ta;
    });
    return list.slice(0, limit);
}

function getInStockProducts(limit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    return (window.products || []).filter(p => {
        if (p.stockManaged === false) return true;
        if (typeof p.stock === 'number') return p.stock > 0;
        if (Array.isArray(p.variants) && p.variants.length) {
            return p.variants.some(v => (v.stock ?? 1) > 0);
        }
        return true;
    }).slice(0, limit);
}

function searchProductsByCategory(categoryQuery, displayLimit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    const q = (categoryQuery || '').toLowerCase().trim();
    const list = (window.products || []).filter(p => {
        const cat = (typeof resolveProductCategoryLabel === 'function'
            ? resolveProductCategoryLabel(p)
            : (p.categoryName || '')).toLowerCase();
        return !q || cat.includes(q) || q.split(/\s+/).some(w => w.length > 2 && cat.includes(w));
    });
    return { items: list.slice(0, displayLimit), total: list.length };
}

function getCartSummaryForChat() {
    const cart = window.cart || [];
    if (!cart.length) return { empty: true, count: 0, total: 0, items: [] };
    const total = cart.reduce((s, i) => s + (Number(i.price) || 0) * (i.qty || 1), 0);
    return { empty: false, count: cart.reduce((s, i) => s + (i.qty || 1), 0), total, items: cart.slice(0, 5) };
}

function getWishlistCountForChat() {
    const wish = window.wishlist || window.wishlistIds || [];
    if (Array.isArray(wish)) return wish.length;
    return 0;
}

function getActivePromoHints() {
    if (typeof activePromosList !== 'undefined' && Array.isArray(activePromosList) && activePromosList.length) {
        return activePromosList.slice(0, 5).map(p => p.code).filter(Boolean);
    }
    return [];
}

function buildChatHelpMenuHtml() {
    return `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Best sellers')">Best sellers</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Suggest outfits under ₹1000')">Under ₹1000</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText(&quot;What's new?&quot;)">New arrivals</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Browse categories')">Categories</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('My cart')">My cart</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Track my order')">Orders</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Offers & promos')">Promos</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Gift ideas under ₹1500')">Gifts</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Complete outfit under ₹3000')">Full outfit</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Cheapest products')">Budget picks</button>
        <button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:5px 10px;font-size:10px;margin:0;" onclick="sendChatMessageWithText('Talk to admin')">Live support</button>
    </div>`;
}

function getAiSupportChipsFromSettings() {
    const custom = (window.APP_FEATURES_CONTENT?.chatbotChips || '').trim();
    if (!custom) return AI_SUPPORT_CHIPS.slice();
    const parsed = custom.split(',').map(s => s.trim()).filter(Boolean);
    return parsed.length ? parsed : AI_SUPPORT_CHIPS.slice();
}

function findProductByNameQuery(query) {
    const q = cleanProductSearchQuery(query);
    if (!q || q.length < 2) return null;
    const list = window.products || [];
    const exact = list.find(p => (p.name || '').toLowerCase() === q);
    if (exact) return exact;
    const words = q.split(/\s+/).filter(w => w.length > 2);
    let best = null;
    let bestScore = 0;
    list.forEach(p => {
        const hay = getProductSearchHaystack(p);
        const score = words.reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
        if (score > bestScore) {
            bestScore = score;
            best = p;
        }
    });
    return bestScore >= Math.min(2, words.length) ? best : null;
}

function getProductSizeColorSummary(p) {
    if (!p) return '';
    const sizes = Array.isArray(p.sizes) ? [...new Set(p.sizes)].filter(Boolean) : [];
    const colors = [];
    if (p.sizeColorMap && typeof p.sizeColorMap === 'object') {
        Object.values(p.sizeColorMap).forEach(arr => {
            if (Array.isArray(arr)) colors.push(...arr);
        });
    }
    if (Array.isArray(p.variants)) {
        p.variants.forEach(v => {
            if (v.size && !sizes.includes(v.size)) sizes.push(v.size);
            if (v.colorName) colors.push(v.colorName);
        });
    }
    const uniqueColors = [...new Set(colors)].filter(Boolean);
    const parts = [];
    if (sizes.length) parts.push(`Sizes: ${sizes.join(', ')}`);
    if (uniqueColors.length) parts.push(`Colors: ${uniqueColors.join(', ')}`);
    return parts.join(' · ');
}

function extractMinPrice(text) {
    if (!text) return null;
    const q = String(text).toLowerCase().replace(/₹/g, ' ').replace(/,/g, '');
    const patterns = [
        /(?:above|over|more than|minimum|min|at least|from)\s*(\d{2,6})/,
        /(?:between|from)\s*(\d{2,6})\s*(?:and|to|-)\s*(\d{2,6})/
    ];
    const between = q.match(patterns[1]);
    if (between) {
        const n = parseInt(between[1], 10);
        if (n >= 50 && n <= 100000) return n;
    }
    const m = q.match(patterns[0]);
    if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 50 && n <= 100000) return n;
    }
    return null;
}

function extractColorsFromQuery(text) {
    const q = (text || '').toLowerCase();
    return CHAT_COLOR_KEYWORDS.filter(c => new RegExp(`\\b${c}\\b`).test(q));
}

function detectOccasionFromQuery(text) {
    const q = (text || '').toLowerCase();
    for (const [occasion, keywords] of Object.entries(CHAT_OCCASION_KEYWORDS)) {
        if (keywords.some(kw => q.includes(kw))) return occasion;
    }
    return null;
}

function productMatchesColors(p, colors) {
    if (!colors || !colors.length) return true;
    const hay = getProductSearchHaystack(p);
    return colors.some(c => hay.includes(c));
}

function scoreProductRelevance(p, queryTokens, colors, occasion) {
    const hay = getProductSearchHaystack(p);
    let score = 0;
    queryTokens.forEach(t => { if (t.length > 2 && hay.includes(t)) score += 2; });
    if (colors.length && productMatchesColors(p, colors)) score += 3;
    if (occasion) {
        const occWords = CHAT_OCCASION_KEYWORDS[occasion] || [];
        if (occWords.some(w => hay.includes(w))) score += 2;
    }
    score += (p.salesCount || p.popularity || 0) * 0.01;
    return score;
}

function searchProductsAdvanced(text, displayLimit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    const list = window.products || [];
    const maxPrice = extractMaxPrice(text);
    const minPrice = extractMinPrice(text);
    const colors = extractColorsFromQuery(text);
    const occasion = detectOccasionFromQuery(text);
    const inStockOnly = /in stock|available now/.test((text || '').toLowerCase());
    const q = cleanProductSearchQuery(text);
    const tokens = q.split(/\s+/).filter(w => w.length > 2);

    let filtered = list.filter(p => {
        const price = Number(p.price) || 0;
        if (maxPrice != null && price > maxPrice) return false;
        if (minPrice != null && price < minPrice) return false;
        if (colors.length && !productMatchesColors(p, colors)) return false;
        if (inStockOnly) {
            if (p.stockManaged !== false && typeof p.stock === 'number' && p.stock <= 0) return false;
        }
        if (!tokens.length && !occasion) return true;
        const hay = getProductSearchHaystack(p);
        if (occasion) {
            const occWords = CHAT_OCCASION_KEYWORDS[occasion] || [];
            if (occWords.some(w => hay.includes(w))) return true;
        }
        if (!tokens.length) return !!occasion;
        return hay.includes(q) || tokens.some(w => hay.includes(w));
    });

    filtered = filtered.slice().sort((a, b) => {
        const sa = scoreProductRelevance(a, tokens, colors, occasion);
        const sb = scoreProductRelevance(b, tokens, colors, occasion);
        if (sb !== sa) return sb - sa;
        return (Number(a.price) || 0) - (Number(b.price) || 0);
    });

    return {
        items: filtered.slice(0, displayLimit),
        total: filtered.length,
        meta: { maxPrice, minPrice, colors, occasion }
    };
}

function findProductsForComparison(text) {
    const raw = (text || '').trim();
    const patterns = [
        /compare\s+(.+?)\s+(?:and|with|vs\.?|versus)\s+(.+)/i,
        /(.+?)\s+vs\.?\s+(.+)/i,
        /(?:which is (?:better|cheaper)|difference between)\s+(.+?)\s+(?:and|or)\s+(.+)/i,
        /(.+?)\s+or\s+(.+?)\s+(?:which|what)/i
    ];
    for (const re of patterns) {
        const m = raw.match(re);
        if (!m) continue;
        const a = findProductByNameQuery(m[1]);
        const b = findProductByNameQuery(m[2]);
        if (a && b && a.id !== b.id) return [a, b];
        if (a || b) return [a, b].filter(Boolean);
    }
    return [];
}

function buildProductComparisonText(products) {
    if (!products || products.length < 2) return null;
    const [a, b] = products;
    const priceA = Number(a.price) || 0;
    const priceB = Number(b.price) || 0;
    const cheaper = priceA <= priceB ? a : b;
    const pricier = priceA <= priceB ? b : a;
    const diff = Math.abs(priceA - priceB);
    const sumA = getProductSizeColorSummary(a);
    const sumB = getProductSizeColorSummary(b);
    return `**Compare:**\n\n**${a.name}** — ₹${priceA}${sumA ? `\n${sumA}` : ''}\n\n**${b.name}** — ₹${priceB}${sumB ? `\n${sumB}` : ''}\n\n**Verdict:** **${cheaper.name}** is ₹${diff} cheaper. Open each product for full details, reviews & size guide.`;
}

function getSimilarProducts(anchor, limit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    if (!anchor) return [];
    const cat = (typeof resolveProductCategoryLabel === 'function'
        ? resolveProductCategoryLabel(anchor)
        : (anchor.categoryName || '')).toLowerCase();
    const tokens = (anchor.name || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const list = (window.products || []).filter(p => p.id !== anchor.id);
    const scored = list.map(p => {
        const hay = getProductSearchHaystack(p);
        const pCat = (typeof resolveProductCategoryLabel === 'function'
            ? resolveProductCategoryLabel(p)
            : (p.categoryName || '')).toLowerCase();
        let score = 0;
        if (cat && pCat === cat) score += 4;
        else if (cat && pCat.includes(cat.split(' ')[0])) score += 2;
        tokens.forEach(t => { if (hay.includes(t)) score += 2; });
        if (productMatchesColors(p, extractColorsFromQuery(anchor.name || ''))) score += 1;
        score += (p.salesCount || p.popularity || 0) * 0.01;
        return { p, score };
    });
    scored.sort((x, y) => y.score - x.score);
    return scored.filter(x => x.score > 0).slice(0, limit).map(x => x.p);
}

function getCheapestProducts(limit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    return (window.products || []).slice()
        .filter(p => (Number(p.price) || 0) > 0)
        .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
        .slice(0, limit);
}

function getPremiumProducts(limit = CHAT_PRODUCT_DISPLAY_LIMIT) {
    return (window.products || []).slice()
        .filter(p => (Number(p.price) || 0) > 0)
        .sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
        .slice(0, limit);
}

function buildOutfitBundleUnderBudget(budget, limit = 3) {
    const max = Number(budget) || 3000;
    const list = (window.products || []).slice()
        .filter(p => (Number(p.price) || 0) > 0 && (Number(p.price) || 0) <= max)
        .sort((a, b) => (b.salesCount || b.popularity || 0) - (a.salesCount || a.popularity || 0));
    const picked = [];
    const usedCats = new Set();
    let total = 0;
    for (const p of list) {
        if (picked.length >= limit) break;
        const cat = (typeof resolveProductCategoryLabel === 'function'
            ? resolveProductCategoryLabel(p)
            : (p.categoryName || 'other')).toLowerCase();
        const price = Number(p.price) || 0;
        if (usedCats.has(cat) && picked.length < limit - 1) continue;
        if (total + price > max) continue;
        picked.push(p);
        usedCats.add(cat);
        total += price;
    }
    if (!picked.length) {
        return { items: list.slice(0, limit), total: list.slice(0, limit).reduce((s, p) => s + (Number(p.price) || 0), 0), budget: max, partial: true };
    }
    return { items: picked, total, budget: max, partial: false };
}

function getGiftRecipientHint(text) {
    const q = (text || '').toLowerCase();
    if (/mom|mother|mum|maa/.test(q)) return 'mom';
    if (/dad|father|papa/.test(q)) return 'dad';
    if (/wife|husband|partner|spouse/.test(q)) return 'partner';
    if (/friend|bestie|bff/.test(q)) return 'friend';
    if (/sister|brother|sibling/.test(q)) return 'sibling';
    if (/girlfriend|boyfriend/.test(q)) return 'partner';
    return 'someone special';
}

function buildStylingAdviceReply(text) {
    const anchor = findProductByNameQuery(text);
    const colors = extractColorsFromQuery(text);
    if (anchor) {
        const similar = getSimilarProducts(anchor, 4);
        const anchorColors = extractColorsFromQuery(getProductSearchHaystack(anchor));
        const tips = [
            'Pair with **neutral tones** (cream, beige, white) for an elegant look.',
            'Add **gold or statement accessories** to elevate ethnic pieces.',
            'Match footwear to the occasion — flats for daily, heels for parties.'
        ];
        if (anchorColors.length) {
            tips.unshift(`**${anchor.name}** comes in ${anchorColors.join(', ')} — try contrasting or tonal accessories.`);
        }
        return {
            text: `**Style tips for ${anchor.name}:**\n\n${tips.map(t => `• ${t}`).join('\n')}\n\nSimilar picks you may like:`,
            products: similar.length ? similar : [anchor],
            totalCount: similar.length || 1
        };
    }
    if (colors.length) {
        const result = searchProductsAdvanced(`${colors[0]} outfit`, CHAT_PRODUCT_DISPLAY_LIMIT);
        return {
            text: `**${colors[0].charAt(0).toUpperCase() + colors[0].slice(1)} styling:** Works well with neutrals, metallics, or complementary tones. Here are **${colors[0]}** picks from our catalog:`,
            products: result.items,
            totalCount: result.total,
            filterMaxPrice: result.meta?.maxPrice ?? null
        };
    }
    return {
        text: '**Styling tips:**\n• Mention a **product name** for pairing advice\n• Ask e.g. *"red kurta under ₹1500"* or *"complete outfit under ₹3000"*\n• For weddings/parties, say the **occasion** + budget'
    };
}

function searchFabricCareInCatalog(text) {
    const q = (text || '').toLowerCase();
    const fabricTerms = ['cotton', 'silk', 'linen', 'rayon', 'georgette', 'chiffon', 'velvet', 'wool', 'polyester', 'satin'];
    const careTerms = ['wash', 'dry clean', 'iron', 'care'];
    const terms = [...fabricTerms, ...careTerms].filter(t => q.includes(t));
    const product = findProductByNameQuery(text);
    if (product && product.description) {
        const desc = product.description.slice(0, 280);
        return {
            text: `**${product.name}** — fabric & care from listing:\n\n${desc}${product.description.length > 280 ? '…' : ''}\n\nSee the product page for full details.`,
            products: [product],
            totalCount: 1
        };
    }
    const list = (window.products || []).filter(p => {
        const hay = `${p.description || ''} ${getProductSearchHaystack(p)}`.toLowerCase();
        return terms.some(t => hay.includes(t));
    });
    if (list.length) {
        return {
            text: `Found **${list.length}** item${list.length === 1 ? '' : 's'} with fabric/care info matching your question:`,
            products: list.slice(0, CHAT_PRODUCT_DISPLAY_LIMIT),
            totalCount: list.length
        };
    }
    return {
        text: '**Fabric & care:** Details are on each product page (description + care notes). Tell me a **product name**, or say **Talk to admin** for specific fabric questions.'
    };
}
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

function normalizeSupportEmail(email) {
    return (email || '').trim().toLowerCase();
}

function isGuestSupportUid(uid) {
    const id = (uid || '').trim();
    return !id || id.toLowerCase().startsWith('guest_');
}

function getSupportVisitorLabel(thread) {
    if (!thread) return 'Visitor';
    const uid = (thread.customerUid || '').trim();
    const email = normalizeSupportEmail(thread.customerEmail);
    if (uid && !isGuestSupportUid(uid)) return 'Registered customer';
    if (email) return 'Guest checkout';
    if ((thread.id || '').startsWith('guest_')) return 'Anonymous visitor';
    return 'Guest visitor';
}

function getSupportVisitorBadgeHtml(thread) {
    const label = getSupportVisitorLabel(thread);
    const colors = {
        'Registered customer': { bg: 'rgba(46,204,113,0.12)', fg: '#2ecc71' },
        'Guest checkout': { bg: 'rgba(255,215,0,0.12)', fg: 'var(--gold)' },
        'Anonymous visitor': { bg: 'rgba(136,136,136,0.15)', fg: '#aaa' },
        'Guest visitor': { bg: 'rgba(136,136,136,0.15)', fg: '#aaa' }
    };
    const c = colors[label] || colors['Guest visitor'];
    return `<span style="font-size:9px;background:${c.bg};color:${c.fg};padding:2px 6px;border-radius:8px;">${escHtml(label)}</span>`;
}

function getStaffAdminEmails() {
    const emails = new Set(STAFF_ADMIN_EMAILS.map(e => e.toLowerCase()));
    if (typeof assignedAdmins !== 'undefined' && Array.isArray(assignedAdmins)) {
        assignedAdmins.forEach(a => {
            if (a.email) emails.add(a.email.toLowerCase());
        });
    }
    return emails;
}

function isRegisteredSupportThread(thread) {
    if (!thread) return false;
    const uid = (thread.customerUid || '').trim();
    if (uid && !isGuestSupportUid(uid)) return true;
    const threadId = (thread.id || '').trim();
    if (threadId.startsWith('uid_')) {
        const threadUid = threadId.slice(4);
        if (threadUid && !isGuestSupportUid(threadUid)) return true;
    }
    return false;
}

function isGuestSupportThread(thread) {
    return !isRegisteredSupportThread(thread);
}

function isStaffSelfSupportThread(thread) {
    if (!thread) return false;
    const staffEmails = getStaffAdminEmails();
    const email = normalizeSupportEmail(thread.customerEmail);
    if (email && staffEmails.has(email)) return true;

    const uid = (thread.customerUid || '').trim();
    if (uid && currentUser && isAdmin && currentUser.uid === uid) return true;

    const threadId = (thread.id || '').trim();
    if (currentUser && isAdmin && threadId === getCustomerThreadIdForUser(currentUser.uid)) return true;

    return false;
}

function getSupportThreadCustomerUid(thread) {
    const uid = (thread?.customerUid || '').trim();
    if (uid && !isGuestSupportUid(uid)) return uid;
    const threadId = (thread?.id || '').trim();
    if (threadId.startsWith('uid_')) {
        const fromId = threadId.slice(4);
        if (fromId && !isGuestSupportUid(fromId)) return fromId;
    }
    return uid || '';
}

function enrichThreadFromCustomerCaches(thread) {
    const uid = getSupportThreadCustomerUid(thread);
    if (!uid) return thread;
    const caches = [window.allCustomersCache, window.superCustomersCache].filter(Array.isArray);
    for (const cache of caches) {
        const match = cache.find(c => c.uid === uid || (Array.isArray(c._mergedUids) && c._mergedUids.includes(uid)));
        if (!match) continue;
        const email = typeof getCustomerDisplayEmail === 'function' ? getCustomerDisplayEmail(match) : (match.email || '');
        const name = typeof getCustomerDisplayName === 'function' ? getCustomerDisplayName(match) : (match.displayName || '');
        if (email && !thread._resolvedEmail && !thread.customerEmail) thread._resolvedEmail = email;
        if (name && !thread._resolvedDisplayName && (!thread.customerName || thread.customerName === 'Customer' || thread.customerName === 'Guest')) {
            thread._resolvedDisplayName = name;
        }
        break;
    }
    return thread;
}

function getSupportThreadDisplayEmail(thread) {
    const direct = normalizeSupportEmail(thread?.customerEmail || thread?._resolvedEmail);
    if (direct) return direct;

    const uid = getSupportThreadCustomerUid(thread);
    if (uid && window.supportUserEmailCache?.[uid]?.email) {
        return normalizeSupportEmail(window.supportUserEmailCache[uid].email);
    }

    enrichThreadFromCustomerCaches(thread);
    return normalizeSupportEmail(thread?._resolvedEmail || thread?.customerEmail);
}

function getSupportThreadDisplayName(thread) {
    const current = (thread?._resolvedDisplayName || thread?.customerName || '').trim();
    if (current && current !== 'Customer' && current !== 'Guest') return current;

    const uid = getSupportThreadCustomerUid(thread);
    if (uid && window.supportUserEmailCache?.[uid]?.name) {
        return window.supportUserEmailCache[uid].name;
    }

    enrichThreadFromCustomerCaches(thread);
    const resolved = (thread?._resolvedDisplayName || thread?.customerName || '').trim();
    if (resolved && resolved !== 'Customer' && resolved !== 'Guest') return resolved;

    const email = getSupportThreadDisplayEmail(thread);
    if (email) return email.split('@')[0];
    return resolved || 'Guest';
}

async function fetchRegisteredCustomerProfile(uid, threadId) {
    if (!uid) return { email: '', name: '' };

    const cached = window.supportUserEmailCache?.[uid];
    if (cached && (cached.email || cached.name)) return cached;

    let email = '';
    let name = '';

    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists) {
            const data = userDoc.data() || {};
            email = (data.email || '').trim();
            name = (data.displayName || '').trim();
        }
    } catch (e) { /* ignore */ }

    if (!email) {
        try {
            const orderSnap = await db.collection('orders').where('uid', '==', uid).limit(8).get();
            const orders = [];
            orderSnap.forEach(doc => orders.push(doc.data()));
            orders.sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));
            for (const order of orders) {
                const orderEmail = (order.email || '').trim();
                if (orderEmail) {
                    email = orderEmail;
                    if (!name) name = (order.recipient || '').trim();
                    break;
                }
            }
        } catch (e) { /* ignore */ }
    }

    if ((!email || !name) && threadId) {
        try {
            const msgSnap = await db.collection('support_threads').doc(threadId)
                .collection('messages').where('sender', '==', 'customer').limit(12).get();
            msgSnap.forEach(doc => {
                const data = doc.data() || {};
                if (!email && data.customerEmail) email = String(data.customerEmail).trim();
                if (!name && data.customerName) name = String(data.customerName).trim();
            });
        } catch (e) { /* ignore */ }
    }

    const result = {
        email: normalizeSupportEmail(email),
        name: (name || '').trim()
    };
    window.supportUserEmailCache = window.supportUserEmailCache || {};
    window.supportUserEmailCache[uid] = result;
    return result;
}

async function enrichSupportThreadsFromUsers() {
    const threads = window.supportThreadsCache || [];
    threads.forEach(enrichThreadFromCustomerCaches);

    const targets = threads.filter(t => isRegisteredSupportThread(t) && !getSupportThreadDisplayEmail(t));
    if (!targets.length) return;

    await Promise.all(targets.map(async thread => {
        const uid = getSupportThreadCustomerUid(thread);
        if (!uid) return;

        const profile = await fetchRegisteredCustomerProfile(uid, thread.id);
        if (!profile.email && !profile.name) return;

        if (profile.email) thread._resolvedEmail = profile.email;
        if (profile.name) thread._resolvedDisplayName = profile.name;

        const patch = {};
        if (profile.email && !thread.customerEmail) patch.customerEmail = profile.email;
        if (profile.name && (!thread.customerName || thread.customerName === 'Customer' || thread.customerName === 'Guest')) {
            patch.customerName = profile.name;
        }
        if (Object.keys(patch).length) {
            db.collection('support_threads').doc(thread.id).set(patch, { merge: true }).catch(() => {});
        }
    }));
}

function getSupportThreadAccountHint(thread) {
    const uid = getSupportThreadCustomerUid(thread);
    if (!uid) return 'No email on file';
    return `Account · …${uid.slice(-8)}`;
}

function prepareSupportThreadsForInbox() {
    (window.supportThreadsCache || []).forEach(enrichThreadFromCustomerCaches);
}

function getSupportInboxThreads(includeStaff) {
    return (window.supportThreadsCache || [])
        .filter(threadHasSupportActivity)
        .filter(t => includeStaff || !isStaffSelfSupportThread(t));
}

function threadMatchesInboxSearch(thread, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return true;
    const haystack = [
        getSupportThreadDisplayName(thread),
        getSupportThreadDisplayEmail(thread),
        thread.lastMessagePreview,
        thread.id,
        getSupportVisitorLabel(thread)
    ].join(' ').toLowerCase();
    return haystack.includes(q);
}

function getFilteredSupportInboxThreads() {
    const state = window.adminSupportInboxState || {};
    const tab = state.activeTab === 'guests' ? 'guests' : 'registered';
    const search = state.search || '';
    return getSupportInboxThreads(false).filter(thread => {
        const matchesTab = tab === 'registered' ? isRegisteredSupportThread(thread) : isGuestSupportThread(thread);
        return matchesTab && threadMatchesInboxSearch(thread, search);
    });
}

function resetAdminSupportInboxPage() {
    window.adminSupportInboxState.page = 1;
}

window.setAdminSupportInboxTab = function(tab) {
    if (tab !== 'registered' && tab !== 'guests') return;
    window.adminSupportInboxState.activeTab = tab;
    resetAdminSupportInboxPage();
    renderAdminSupportInbox();
};

window.onAdminSupportInboxSearch = function(value) {
    window.adminSupportInboxState.search = value || '';
    resetAdminSupportInboxPage();
    renderAdminSupportInbox();
};

window.goAdminSupportInboxPage = function(page) {
    const filtered = getFilteredSupportInboxThreads();
    const pageSize = window.adminSupportInboxState.pageSize || 5;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const nextPage = Math.min(Math.max(1, page), totalPages);
    window.adminSupportInboxState.page = nextPage;
    renderAdminSupportInbox();
};

function hasGuestLiveSupportContact() {
    if (currentUser?.email) return true;
    return !!normalizeSupportEmail(getCustomerProfile().email);
}

function promptGuestLiveSupportContact(pendingText) {
    window.supportChatState.pendingLiveSupportMessage = pendingText || null;
    const modal = document.getElementById('guest-support-contact-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const input = document.getElementById('guest-support-contact-email');
    if (input) {
        try {
            input.value = localStorage.getItem('swagstree_guest_email') || '';
        } catch (e) {
            input.value = '';
        }
        setTimeout(() => input.focus(), 100);
    }
}

window.submitGuestSupportContact = async function() {
    const input = document.getElementById('guest-support-contact-email');
    const email = normalizeSupportEmail(input?.value);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (typeof showToast === 'function') showToast('Please enter a valid email address.');
        return;
    }

    try {
        localStorage.setItem('swagstree_guest_email', email);
    } catch (e) { /* ignore */ }

    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();
    try {
        await ensureSupportThread(threadId, { ...profile, email });
        await db.collection('support_threads').doc(threadId).set({
            customerEmail: email,
            customerName: profile.name || 'Guest'
        }, { merge: true });

        const guestDocId = typeof buildGuestCustomerDocId === 'function'
            ? buildGuestCustomerDocId(email)
            : null;
        if (guestDocId) {
            await db.collection('users').doc(guestDocId).set({
                email,
                displayName: (profile.name || email.split('@')[0]).trim(),
                phone: (profile.phone || '').trim(),
                isGuest: true,
                guestSupport: true,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }
    } catch (e) {
        console.warn('Could not save guest support email:', e);
    }

    if (typeof closeModal === 'function') closeModal('guest-support-contact-modal');

    const pending = window.supportChatState.pendingLiveSupportMessage;
    window.supportChatState.pendingLiveSupportMessage = null;
    if (pending) {
        await handleAdminSupportMessage(pending);
    } else if (typeof showToast === 'function') {
        showToast('Email saved. You can now message live support.');
    }
};

window.goToSignInFromGuestSupport = function() {
    window.supportChatState.pendingLiveSupportMessage = null;
    if (typeof closeModal === 'function') closeModal('guest-support-contact-modal');
    if (typeof toggleAIChat === 'function') toggleAIChat();
    if (typeof navigateTo === 'function') navigateTo('user');
};

async function ensureGuestLiveSupportReady(pendingText) {
    if (hasGuestLiveSupportContact()) return true;
    promptGuestLiveSupportContact(pendingText);
    return false;
}

function showGuestLiveSupportHint() {
    if (hasGuestLiveSupportContact()) return;
    const body = getChatBody(SUPPORT_CHANNEL);
    if (!body || body.querySelector('[data-guest-contact-hint]')) return;
    appendSupportBubble(
        'bot',
        'To reach our support team, please **enter your email** when prompted, or **sign in** so we can link your orders.',
        '',
        SUPPORT_CHANNEL
    );
    const last = body.lastElementChild;
    if (last) last.setAttribute('data-guest-contact-hint', '1');
}

function findSupportThreadInCache({ uid, email, threadId } = {}) {
    const cache = window.supportThreadsCache || [];
    if (threadId) {
        const direct = cache.find(t => t.id === threadId);
        if (direct) return direct;
    }
    const emailNorm = normalizeSupportEmail(email);
    if (emailNorm) {
        const matches = cache.filter(t => normalizeSupportEmail(t.customerEmail) === emailNorm);
        if (matches.length) {
            return matches.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0))[0];
        }
    }
    const uidTrim = (uid || '').trim();
    if (uidTrim) {
        const matches = cache.filter(t => t.customerUid === uidTrim || t.id === `uid_${uidTrim}`);
        if (matches.length) {
            return matches.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0))[0];
        }
    }
    return null;
}

async function fetchSupportThreadByEmail(email) {
    const trimmed = (email || '').trim();
    if (!trimmed) return null;
    try {
        const snap = await db.collection('support_threads').where('customerEmail', '==', trimmed).limit(25).get();
        const threads = [];
        snap.forEach(doc => threads.push({ id: doc.id, ...doc.data() }));
        if (!threads.length) return null;
        threads.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
        return threads.find(threadHasSupportActivity) || threads[0];
    } catch (e) {
        console.warn('fetchSupportThreadByEmail failed:', e);
        return null;
    }
}

async function resolveAdminSupportThreadId(uid, email, threadIdOverride) {
    if (threadIdOverride) return threadIdOverride;

    const cached = findSupportThreadInCache({ uid, email });
    if (cached?.id) return cached.id;

    const uidTrim = (uid || '').trim();
    if (uidTrim && !isGuestSupportUid(uidTrim)) {
        const registeredId = getCustomerThreadIdForUser(uidTrim);
        const doc = await db.collection('support_threads').doc(registeredId).get();
        if (doc.exists) return registeredId;
        return registeredId;
    }

    if (uidTrim && isGuestSupportUid(uidTrim)) {
        const guestUidThread = getCustomerThreadIdForUser(uidTrim);
        const guestDoc = await db.collection('support_threads').doc(guestUidThread).get();
        if (guestDoc.exists) return guestUidThread;
    }

    const byEmail = await fetchSupportThreadByEmail(email);
    if (byEmail?.id) return byEmail.id;

    return null;
}

function expandAdminSupportInbox() {
    const content = document.getElementById('admin-support-accordion-content');
    const icon = document.getElementById('admin-support-accordion-icon');
    if (content && content.style.display === 'none') {
        content.style.display = 'flex';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
    if (typeof loadAdminSupportInbox === 'function') loadAdminSupportInbox();
}

function getCurrentCustomerThreadId() {
    if (window.supportChatState.adminThreadId) return window.supportChatState.adminThreadId;
    return getCustomerThreadIdForUser(currentUser ? currentUser.uid : null);
}

function getCustomerProfile() {
    const name = document.getElementById('prof-name')?.value?.trim()
        || (currentUser && currentUser.displayName)
        || (currentUser && currentUser.email ? currentUser.email.split('@')[0] : 'Guest');
    let email = currentUser?.email || '';
    if (!email) {
        try {
            email = localStorage.getItem('swagstree_guest_email') || '';
        } catch (e) { /* ignore */ }
    }
    return { name, email, uid: currentUser?.uid || null };
}

async function ensureSupportThread(threadId, profile) {
    const ref = db.collection('support_threads').doc(threadId);
    const snap = await ref.get();
    if (snap.exists) {
        const existing = snap.data() || {};
        const updates = {};
        if (profile.email && !existing.customerEmail) updates.customerEmail = profile.email;
        if (profile.name && (!existing.customerName || existing.customerName === 'Customer' || existing.customerName === 'Guest')) {
            updates.customerName = profile.name;
        }
        if (profile.uid && !existing.customerUid) updates.customerUid = profile.uid;
        if (Object.keys(updates).length) await ref.set(updates, { merge: true });
        return { ...existing, ...updates };
    }
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
    if (msg.sender === 'admin') {
        update.unreadByCustomer = unreadByCustomer;
        if (msg.senderName) update.lastAdminSenderName = msg.senderName;
        if (msg.senderEmail) update.lastAdminSenderEmail = msg.senderEmail;
    }
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
        .replace(/suggest|recommend|show|more|under|below|outfits?|styles?|rs\.?|₹|please|help|want|need|find|another|other|compare|similar|gift|complete|cheapest|premium|versus|vs\.?/gi, ' ')
        .replace(/\b\d+\b/g, ' ')
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
        const hay = getProductSearchHaystack(p);
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
    if (/^(help|what can you help|what can you do|options|menu)\b/.test(q)) return 'help';
    if (/browse categor|shop by categor|all categor|list categor/.test(q)) return 'category';
    if (/offer|promo|coupon|discount|wheel|deal/.test(q)) return 'promo';
    if (/deliver|shipping|dispatch|when will i get/.test(q)) return 'delivery';
    if (/compare|versus|vs\.?\s+\w|difference between|which is (better|cheaper)/.test(q)) return 'compare';
    if (/similar to|like this|alternative to|something like|alternate to|items like/.test(q)) return 'similar';
    if (/complete (the )?look|full outfit|entire outfit|outfit combo|outfit under|complete outfit/.test(q)) return 'outfit_bundle';
    if (/gift (for|idea)|present for|birthday gift|anniversary gift|gift under/.test(q)) return 'gift';
    if (/what goes with|pair with|coordinate with|style (with|tip)|fashion advice|what color (goes|matches)|color combination/.test(q)) return 'styling_advice';
    if (/cheapest|lowest price|most affordable|budget pick|under ₹?\d+.*cheapest/.test(q)) return 'cheapest';
    if (/premium|luxury|most expensive|highest price|splurge|top tier/.test(q)) return 'premium';
    if (/fabric|material|cotton|silk|linen|georgette|chiffon|wash|care instruction|dry clean|how to wash/.test(q)) return 'fabric_care';
    if (/bulk order|wholesale|large quantity|corporate order|bulk purchase/.test(q)) return 'bulk';
    const occasion = detectOccasionFromQuery(q);
    if (occasion && /wear|outfit|dress|suggest|recommend|look|for/.test(q)) return { type: 'occasion', occasion };
    if (extractColorsFromQuery(q).length >= 1 && (maxPrice != null || /under|below|in /.test(q))) return 'advanced_search';
    if (/talk to admin|human|agent|real person|speak to support|connect.*admin|live support|contact support/.test(q)) return 'human';
    if (/complaint|issue|problem|defect|damaged|wrong item|return|refund|complain/.test(q)) return 'complaint';
    if (/my cart|what.?s in my cart|cart items|shopping cart/.test(q)) return 'cart';
    if (/wishlist|wish list|saved items|heart list/.test(q)) return 'wishlist';
    if (/track|order status|where is my order|my order|track my order/.test(q)) return 'order';
    if (/contact|email|phone|call|whatsapp|support mail|contact support/.test(q)) return 'contact';
    if (/cod|cash on delivery|upi advance|pay on delivery/.test(q)) return 'payment';
    if (/payment|pay online|upi|card|how to pay|checkout/.test(q)) return 'payment';
    if (/how to order|place order|how do i buy|how to shop/.test(q)) return 'how_to_order';
    if (/sign in|login|log in|create account|register/.test(q)) return 'login';
    if (/size guide|size chart|measurement|what size|fit guide/.test(q)) return 'size_guide';
    if (/new arrival|what.?s new|latest|just launched|new in/.test(q)) return 'new_arrivals';
    if (/in stock|available now|out of stock|stock/.test(q)) return 'stock';
    if (/categor|collection|section/.test(q) && !/suggest|recommend|under/.test(q)) return 'category';
    if (/best seller|best sellers|best selling|top selling|popular picks|most popular/.test(q)) return 'best_sellers';
    if (/all products?|full (catalog|list)|entire catalog|every product|whole catalog|complete (catalog|list)|products? list|give all|show all products?|list all products?|see all products?|browse all|view all products?|entire (stock|range|collection)/.test(q)) return 'full_catalog';
    if (maxPrice != null) return { type: 'price_filter', max: maxPrice };
    if (/suggest|recommend|show me|outfit|dress|kurta|saree|coord|shirt|product|styles|looking for/.test(q)) return 'suggest';
    if (/price|cost|how much|₹|budget|cheap|affordable/.test(q)) return 'price';
    return 'ai';
}

function getFullCatalogProducts(limit = CHAT_PRODUCT_QUERY_LIMIT) {
    return (window.products || []).slice(0, limit);
}

function formatChatProductListIntro(count, label = 'product') {
    if (!count) return '';
    const plural = count === 1 ? label : `${label}s`;
    const initial = Math.min(CHAT_PRODUCT_PAGE_SIZE, count);
    if (count <= CHAT_PRODUCT_PAGE_SIZE) return `**${count}** ${plural}`;
    return `**${count}** ${plural} — showing **${initial}** (tap **Show more** for ${CHAT_PRODUCT_PAGE_SIZE} more)`;
}

function chatCatalogOverflowExtra(total, stored, maxPrice) {
    return stored < total ? buildExploreMoreHtml(total, stored, maxPrice) : '';
}

function getChatProductImage(p) {
    if (!p) return '';
    return (p.images && p.images[0]) || (p.variants && p.variants[0]?.images?.[0]) || '';
}

window.supportChatProductLists = window.supportChatProductLists || {};

function registerChatProductList(productIds) {
    const id = 'cpl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    const ids = (productIds || []).filter(Boolean).slice(0, CHAT_PRODUCT_QUERY_LIMIT);
    window.supportChatProductLists[id] = {
        ids,
        shown: Math.min(CHAT_PRODUCT_PAGE_SIZE, ids.length)
    };
    return id;
}

function getProductsForChatList(listId) {
    const state = window.supportChatProductLists[listId];
    if (!state) return [];
    const catalog = window.products || [];
    return state.ids.map(pid => catalog.find(p => p.id === pid)).filter(Boolean);
}

function buildSingleProductCardHtml(p) {
    const img = getChatProductImage(p);
    const thumb = img
        ? `<div class="ai-chat-product-card-img-wrap"><img src="${escHtml(img)}" alt="${escHtml(p.name || 'Product')}" loading="lazy"></div>`
        : `<div class="ai-chat-product-card-img-wrap ai-chat-product-card-img-wrap--empty"><i class="fa fa-shopping-bag" style="color:var(--gold);"></i></div>`;
    return `
        <div class="ai-chat-product-card" onclick="showDetail('${p.id}'); toggleAIChat();">
            ${thumb}
            <div class="ai-chat-product-info">
                <div class="ai-chat-product-name">${escHtml(p.name)}</div>
                <div class="ai-chat-product-price">₹${p.price}</div>
                <div class="ai-chat-product-btn">View product →</div>
            </div>
        </div>`;
}

function buildShowMoreButtonHtml(listId, shown, total) {
    const remaining = total - shown;
    if (remaining <= 0) return '';
    const next = Math.min(CHAT_PRODUCT_PAGE_SIZE, remaining);
    return `<button type="button" class="btn-gold ai-chat-show-more-btn" data-list-id="${escHtml(listId)}" onclick="showMoreChatProducts('${escHtml(listId)}')">Show more (${shown} of ${total} · +${next})</button>`;
}

function buildPaginatedProductListHtml(listId) {
    const state = window.supportChatProductLists[listId];
    if (!state) return '';
    const all = getProductsForChatList(listId);
    const visible = all.slice(0, state.shown);
    const cards = visible.map(p => buildSingleProductCardHtml(p)).join('');
    const showMore = buildShowMoreButtonHtml(listId, state.shown, all.length);
    const endHint = !showMore && all.length > CHAT_PRODUCT_PAGE_SIZE
        ? `<p class="ai-chat-list-end-hint">All ${all.length} products shown</p>`
        : '';
    return `<div class="ai-chat-product-list" id="${escHtml(listId)}">${cards}${showMore}${endHint}</div>`;
}

window.showMoreChatProducts = function(listId) {
    const state = window.supportChatProductLists[listId];
    const container = document.getElementById(listId);
    if (!state || !container) return;
    const all = getProductsForChatList(listId);
    const prevShown = state.shown;
    state.shown = Math.min(state.shown + CHAT_PRODUCT_PAGE_SIZE, all.length);
    const newItems = all.slice(prevShown, state.shown);

    container.querySelectorAll('.ai-chat-show-more-btn, .ai-chat-list-end-hint').forEach(el => el.remove());

    if (newItems.length) {
        container.insertAdjacentHTML('beforeend', newItems.map(p => buildSingleProductCardHtml(p)).join(''));
    }

    const showMore = buildShowMoreButtonHtml(listId, state.shown, all.length);
    if (showMore) {
        container.insertAdjacentHTML('beforeend', showMore);
    } else if (all.length > CHAT_PRODUCT_PAGE_SIZE) {
        container.insertAdjacentHTML('beforeend', `<p class="ai-chat-list-end-hint">All ${all.length} products shown</p>`);
    }

    const body = getChatBody(AI_CHANNEL);
    if (body) body.scrollTop = body.scrollHeight;
};

function buildProductCardsHtml(products) {
    if (!products.length) return '<p style="margin:0;font-size:12px;color:#888;">No matching products found right now.</p>';
    const listId = registerChatProductList(products.map(p => p.id));
    return buildPaginatedProductListHtml(listId);
}

function buildExploreMoreHtml(total, storedCount, maxPrice) {
    if (total <= storedCount) return '';
    const more = total - storedCount;
    const filterBtn = maxPrice != null
        ? `<button type="button" class="btn-gold ai-chat-filter-btn" onclick="applyChatPriceFilter(${maxPrice})">Apply under ₹${maxPrice} filter</button>`
        : '';
    return `<div class="ai-chat-explore-hint" style="margin-top:8px;font-size:11px;color:#aaa;line-height:1.5;">
        <strong style="color:var(--gold);">${more} more</strong> style${more > 1 ? 's' : ''} in catalog — open Home to browse all, or refine your search.
        <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
            ${filterBtn}
            <button type="button" class="btn-gold ai-chat-filter-btn" style="background:transparent;border:1px solid var(--gold);color:var(--gold);" onclick="navigateTo('home'); toggleAIChat();">Browse Home</button>
        </div>
    </div>`;
}

function renderSupportQuickChips(tab) {
    const container = document.getElementById('ai-chat-chips');
    if (!container) return;
    let chips = tab === 'admin' ? ADMIN_SUPPORT_CHIPS.slice() : getAiSupportChipsFromSettings();
    if (tab === 'ai' && !isAdminSupportChatEnabled()) {
        chips = chips.filter(chip => !/talk to admin|contact support|live support/i.test(chip));
    }
    container.style.display = chips.length ? 'flex' : 'none';
    container.innerHTML = chips.map(chip =>
        `<div class="ai-chat-chip" onclick="sendChatMessageWithText('${chip.replace(/'/g, "\\'")}')">${escHtml(chip)}</div>`
    ).join('');
}
window.renderSupportQuickChips = renderSupportQuickChips;

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
    if (tab === 'admin' && !canUseStorefrontLiveSupport()) return;

    updateSupportChatTabUI(tab);
    showChatBodyForTab(tab);
    if (tab === 'admin') {
        const body = getChatBody(SUPPORT_CHANNEL);
        const hasAdminHint = body && body.querySelector('[data-admin-tab-hint]');
        if (body && !hasAdminHint && body.childElementCount === 0) {
            appendSupportBubble('bot', 'You are now in **Live Support**. Tell us your issue and our team will reply here.', '', SUPPORT_CHANNEL);
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
            text: "Hello! Welcome to **Swag Stree**. I can help with **products**, **prices**, **orders**, **cart**, and **styling tips**. What are you looking for today?",
            extraHtml: buildChatHelpMenuHtml()
        };
    }
    if (intent === 'help') {
        const cats = getCatalogCategoriesForChat(6);
        const range = getCatalogPriceRange();
        const rangeTxt = range ? ` Prices from **₹${range.min}** to **₹${range.max}**.` : '';
        const catTxt = cats.length ? `\n\n**Shop by category:** ${cats.join(', ')}` : '';
        return {
            text: `I can help you with:${rangeTxt}\n\n• **Product suggestions** (e.g. "outfits under ₹1000")\n• **Best sellers** & **what's new**\n• **Advanced:** compare products, similar styles, gifts, full outfits, occasion wear\n• **Multi-filter:** e.g. "red kurta under ₹1500 in stock"\n• **Track orders** & **cart**\n• **Payment / COD** info\n• **Talk to admin** for live help${catTxt}`,
            extraHtml: buildChatHelpMenuHtml()
        };
    }
    if (intent === 'cart') {
        const cart = getCartSummaryForChat();
        if (cart.empty) {
            return {
                text: 'Your **cart is empty**. Browse Home or ask me for suggestions — e.g. *Best sellers* or *Suggest outfits under ₹1000*.',
                extraHtml: `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('home'); toggleAIChat();">Browse Home</button>`
            };
        }
        const lines = cart.items.map(i => `• ${i.name} (×${i.qty || 1}) — ₹${(Number(i.price) || 0) * (i.qty || 1)}`).join('\n');
        return {
            text: `**Your cart** (${cart.count} item${cart.count === 1 ? '' : 's'}) — total **₹${cart.total}**:\n${lines}\n\nTap the cart icon to checkout when ready.`,
            extraHtml: `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="if(typeof openCart==='function')openCart(); toggleAIChat();">Open cart</button>`
        };
    }
    if (intent === 'wishlist') {
        const count = getWishlistCountForChat();
        return {
            text: count > 0
                ? `You have **${count} item${count === 1 ? '' : 's'}** in your wishlist. Open the **Wish** tab to view them.`
                : 'Your **wishlist is empty**. Tap the heart on any product to save it for later.',
            extraHtml: `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('wish'); toggleAIChat();">Open Wishlist</button>`
        };
    }
    if (intent === 'payment' || intent === 'how_to_order') {
        const promos = getActivePromoHints();
        const promoTxt = promos.length ? `\n\n**Active promo codes:** ${promos.map(c => `\`${c}\``).join(', ')}` : '\n\nTry code **WELCOME10** or spin the **Discount Wheel** on Home.';
        return {
            text: intent === 'how_to_order'
                ? `**How to order:**\n1. Browse Home & tap a product\n2. Pick size/color → **Add to cart**\n3. Open cart → **Checkout**\n4. Enter address & pay (UPI / card / **COD**)\n\nSigned-in users can track orders in **Profile → My Orders**.${promoTxt}`
                : `**Payment options:** UPI, cards & **COD** (Cash on Delivery). Some COD orders may need a small UPI advance — shown at checkout.${promoTxt}`,
            extraHtml: `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('home'); toggleAIChat();">Start shopping</button>`
        };
    }
    if (intent === 'login') {
        return {
            text: currentUser
                ? `You're **signed in** as ${currentUser.email || 'your account'}. Open **Profile** for orders, wishlist & account settings.`
                : '**Sign in** to track orders, save your wishlist & checkout faster. Guest checkout is also available.',
            extraHtml: currentUser
                ? `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('user'); toggleAIChat();">Open Profile</button>`
                : `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('user'); toggleAIChat();">Sign in</button>`
        };
    }
    if (intent === 'size_guide') {
        const product = findProductByNameQuery(userText);
        if (product) {
            const summary = getProductSizeColorSummary(product);
            return {
                text: `**${product.name}** — ₹${product.price}${summary ? `\n${summary}` : ''}\n\nOpen the product page for the full **Size Guide** and measurements.`,
                products: [product],
                totalCount: 1
            };
        }
        return {
            text: '**Size guide:** Open any product → tap **Size Guide** on the product page for measurements.\n\nTell me a **product name** and I can list available sizes & colors from our catalog.'
        };
    }
    if (intent === 'promo') {
        const promos = getActivePromoHints();
        const promoTxt = promos.length
            ? `**Active promo codes:** ${promos.map(c => `\`${c}\``).join(', ')}`
            : 'Try code **WELCOME10** for 10% off.';
        return {
            text: `${promoTxt}\n\nYou can also spin the **Discount Wheel** on Home for surprise offers. Codes apply at checkout.`,
            extraHtml: `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('home'); toggleAIChat();">Go to Home</button>`
        };
    }
    if (intent === 'delivery') {
        return {
            text: '**Delivery:** Timelines depend on your location and order status.\n\n• Signed-in customers: **Profile → My Orders** for updates\n• Guest orders: sign in with the same email used at checkout\n• Need help? Say **Track my order** or **Talk to admin**'
        };
    }
    if (intent === 'compare') {
        const pair = findProductsForComparison(userText);
        if (pair.length >= 2) {
            const text = buildProductComparisonText(pair);
            return { text, products: pair, totalCount: 2 };
        }
        if (pair.length === 1) {
            const similar = getSimilarProducts(pair[0], 4);
            return {
                text: `I found **${pair[0].name}** (₹${pair[0].price}). Name a **second product** to compare, or browse similar styles:`,
                products: similar.length ? similar : [pair[0]],
                totalCount: similar.length || 1
            };
        }
        return {
            text: '**Compare products:** Ask e.g. *"Compare [product A] and [product B]"* or *"[name] vs [name]"*. I\'ll show price, sizes & colors side by side.'
        };
    }
    if (intent === 'similar') {
        const anchor = findProductByNameQuery(userText.replace(/similar to|like this|alternative to|something like|alternate to|items like/gi, ''));
        if (!anchor) {
            return { text: 'Tell me a **product name** — e.g. *"Similar to Blue Floral Kurta"* — and I\'ll find matching styles.' };
        }
        const similar = getSimilarProducts(anchor);
        return {
            text: similar.length
                ? `Styles **similar to ${anchor.name}** (₹${anchor.price}):`
                : `No close matches yet for **${anchor.name}**. Try browsing the same category on Home.`,
            products: similar.length ? similar : [anchor],
            totalCount: similar.length || 1
        };
    }
    if (intent === 'outfit_bundle') {
        const budget = extractMaxPrice(userText) || 3000;
        const bundle = buildOutfitBundleUnderBudget(budget);
        const lines = bundle.items.map(p => `• ${p.name} — ₹${p.price}`).join('\n');
        return {
            text: bundle.partial
                ? `Couldn't build a full multi-piece look under **₹${budget}** — here are top picks within budget (total ₹${bundle.total}):`
                : `**Complete look under ₹${budget}** (total **₹${bundle.total}**):\n${lines}\n\nMix & match — tap any item for sizes & colors.`,
            products: bundle.items,
            totalCount: bundle.items.length,
            filterMaxPrice: budget
        };
    }
    if (intent === 'gift') {
        const max = extractMaxPrice(userText) || 1500;
        const recipient = getGiftRecipientHint(userText);
        const result = searchProductsAdvanced(`gift festive elegant under ${max}`, CHAT_PRODUCT_DISPLAY_LIMIT);
        const items = result.items.length ? result.items : getBestSellerProducts().filter(p => (Number(p.price) || 0) <= max);
        return {
            text: items.length
                ? `**Gift ideas for ${recipient}** under **₹${max}** — popular picks customers love:`
                : `No gifts under **₹${max}** right now. Try a higher budget or *Best sellers*.`,
            products: items,
            totalCount: items.length,
            filterMaxPrice: max
        };
    }
    if (typeof intent === 'object' && intent.type === 'occasion') {
        const max = extractMaxPrice(userText);
        const occLabel = intent.occasion.charAt(0).toUpperCase() + intent.occasion.slice(1);
        const searchText = `${intent.occasion} wear outfit ${max ? `under ${max}` : ''}`;
        const result = searchProductsAdvanced(searchText, CHAT_PRODUCT_DISPLAY_LIMIT);
        const items = result.items.length ? result.items : searchProducts(searchText, max).items;
        return {
            text: items.length
                ? `**${occLabel} wear** picks${max ? ` under **₹${max}**` : ''}:`
                : `No exact **${occLabel.toLowerCase()}** matches — try a higher budget or browse **Best sellers**.`,
            products: items,
            totalCount: result.total || items.length,
            filterMaxPrice: max
        };
    }
    if (intent === 'styling_advice') {
        return buildStylingAdviceReply(userText);
    }
    if (intent === 'cheapest') {
        const max = extractMaxPrice(userText);
        let items = getCheapestProducts();
        if (max != null) items = items.filter(p => (Number(p.price) || 0) <= max);
        return {
            text: items.length
                ? `**Most affordable** picks${max ? ` under **₹${max}**` : ''} in our catalog:`
                : 'Catalog is loading — try again in a moment.',
            products: items,
            totalCount: items.length,
            filterMaxPrice: max
        };
    }
    if (intent === 'premium') {
        const items = getPremiumProducts();
        return {
            text: items.length ? '**Premium / top-priced** styles in our catalog:' : 'Catalog is loading.',
            products: items,
            totalCount: items.length
        };
    }
    if (intent === 'fabric_care') {
        return searchFabricCareInCatalog(userText);
    }
    if (intent === 'bulk') {
        const contact = getContactInfo();
        return {
            text: `**Bulk / wholesale orders:** For large quantities or corporate gifting, our team can help with pricing & availability.\n\n• **Talk to admin** (Live Support tab)\n• WhatsApp: wa.me/${contact.wa}\n• Email: ${contact.email}`,
            extraHtml: canUseStorefrontLiveSupport()
                ? `<button class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="switchSupportChatTab('admin')">Open Live Support</button>`
                : `<a href="https://wa.me/${contact.wa}" target="_blank" style="font-size:10px;color:var(--gold);">WhatsApp us</a>`
        };
    }
    if (intent === 'advanced_search') {
        const result = searchProductsAdvanced(userText, CHAT_PRODUCT_DISPLAY_LIMIT);
        const { items, total, meta } = result;
        const parts = [];
        if (meta.colors?.length) parts.push(meta.colors.join(', '));
        if (meta.maxPrice != null) parts.push(`under ₹${meta.maxPrice}`);
        if (meta.minPrice != null) parts.push(`above ₹${meta.minPrice}`);
        if (meta.occasion) parts.push(`${meta.occasion} wear`);
        const filterDesc = parts.length ? ` (${parts.join(', ')})` : '';
        return {
            text: items.length
                ? `Found ${formatChatProductListIntro(total, 'match')}${filterDesc}:`
                : `No exact matches${filterDesc}. Try fewer filters or browse **Best sellers**.`,
            products: items,
            totalCount: total,
            filterMaxPrice: meta.maxPrice ?? null,
            extraHtml: chatCatalogOverflowExtra(total, items.length, meta.maxPrice ?? null)
        };
    }
    if (intent === 'full_catalog') {
        const catalogTotal = (window.products || []).length;
        const all = getFullCatalogProducts();
        return {
            text: all.length
                ? `Here is our **full catalog** — ${formatChatProductListIntro(catalogTotal || all.length)}:`
                : 'Products are still loading — try again in a moment, or browse Home.',
            products: all,
            totalCount: catalogTotal || all.length,
            extraHtml: chatCatalogOverflowExtra(catalogTotal, all.length, null)
        };
    }
    if (intent === 'new_arrivals') {
        const matched = getNewArrivalProducts();
        return {
            text: matched.length
                ? `Here are our **latest arrivals** — ${formatChatProductListIntro(matched.length, 'item')}:`
                : 'Products are still loading — try again in a moment, or browse Home.',
            products: matched,
            totalCount: matched.length
        };
    }
    if (intent === 'stock') {
        const inStock = getInStockProducts();
        const oos = (window.products || []).length - inStock.length;
        if (/out of stock|sold out/.test(userText.toLowerCase())) {
            return { text: 'Out-of-stock items are marked on the product page. Try another size/color or ask for **similar styles**.' };
        }
        return {
            text: inStock.length
                ? `${formatChatProductListIntro(inStock.length, 'style')} in stock right now${oos > 0 ? ` (${oos} may be limited)` : ''}:`
                : 'Catalog is loading — check Home in a moment.',
            products: inStock,
            totalCount: inStock.length
        };
    }
    if (intent === 'category') {
        const cats = getCatalogCategoriesForChat();
        const q = userText.replace(/categor|collection|section|show|browse|in/gi, ' ').trim();
        const result = q.length > 2 ? searchProductsByCategory(q) : { items: [], total: 0 };
        if (result.items.length) {
            return {
                text: `${formatChatProductListIntro(result.total, 'product')} in matching categories:`,
                products: result.items,
                totalCount: result.total,
                extraHtml: chatCatalogOverflowExtra(result.total, result.items.length, null)
            };
        }
        return {
            text: cats.length
                ? `**Browse by category:** ${cats.join(' · ')}\n\nTell me a category name (e.g. "kurta sets") for picks.`
                : 'Categories are loading — browse **Home** or ask for *Best sellers*.',
            extraHtml: `<button type="button" class="btn-gold ai-chat-filter-btn" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="navigateTo('home'); toggleAIChat();">Browse Home</button>`
        };
    }
    if (intent === 'human' || intent === 'complaint') {
        if (canUseStorefrontLiveSupport()) {
            return {
                text: "For **live help from our team**, please open the **Live Support** tab above.",
                extraHtml: `<button class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;margin-top:8px;" onclick="switchSupportChatTab('admin')">Open Live Support</button>`
            };
        }
        if (isAdminSupportChatEnabled() && !isLoggedInCustomer()) {
            return {
                text: "For **live support**, please **sign in** so we can link your orders and reply here.\n\nYou can keep using AI for product help, or contact us below:",
                extraHtml: `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
                    <button class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;margin:0;" onclick="navigateTo('user'); toggleAIChat();">Sign In</button>
                    <a href="https://wa.me/${contact.wa}" target="_blank" style="font-size:10px;color:var(--gold);align-self:center;">WhatsApp</a>
                </div>`
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
        return {
            text: matched.length
                ? `Here are our **best-selling picks** — ${formatChatProductListIntro(matched.length, 'pick')}:`
                : 'Products are still loading — try again in a moment, or browse Home.',
            products: matched,
            totalCount: matched.length
        };
    }
    if (intent === 'suggest' || intent === 'price') {
        const max = extractMaxPrice(userText);
        const advanced = searchProductsAdvanced(userText, CHAT_PRODUCT_DISPLAY_LIMIT);
        const result = advanced.items.length ? advanced : searchProducts(userText, max);
        const items = result.items || result;
        const total = result.total ?? items.length;
        const budgetTxt = max != null ? ` under **₹${max}**` : '';
        return {
            text: items.length
                ? `Showing ${formatChatProductListIntro(total, 'style')}${budgetTxt}:`
                : max != null
                    ? `No products under **₹${max}** right now. Try a higher budget or browse Home.`
                    : "I couldn't find an exact match. Try a product name, color, or budget (e.g. under ₹800).",
            products: items,
            totalCount: total,
            filterMaxPrice: max,
            extraHtml: chatCatalogOverflowExtra(total, items.length, max)
        };
    }
    if (typeof intent === 'object' && intent.type === 'price_filter') {
        const result = searchProducts('', intent.max);
        const { items, total } = result;
        return {
            text: items.length
                ? `Showing ${formatChatProductListIntro(total, 'style')} under **₹${intent.max}**:`
                : `No products under **₹${intent.max}** right now. Try a higher budget or browse our full catalog.`,
            products: items,
            totalCount: total,
            filterMaxPrice: intent.max,
            extraHtml: chatCatalogOverflowExtra(total, items.length, intent.max)
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
    if (/^(hi|hello|hey|namaste|help)\b/.test(q.trim())) {
        return {
            text: "Hello! Welcome to **Swag Stree**. Ask for outfit suggestions, prices, orders, cart, or say **Talk to admin** for live support.",
            extraHtml: buildChatHelpMenuHtml()
        };
    }
    if (/all products?|full catalog|products? list|give all|show all products?|list all|entire catalog/.test(q)) {
        const catalogTotal = (window.products || []).length;
        const all = getFullCatalogProducts();
        return {
            text: all.length
                ? `Here is our **full catalog** — ${formatChatProductListIntro(catalogTotal || all.length)}:`
                : 'Products are still loading — try again in a moment.',
            products: all,
            totalCount: catalogTotal || all.length,
            extraHtml: chatCatalogOverflowExtra(catalogTotal, all.length, null)
        };
    }
    const max = extractMaxPrice(userText);
    const advanced = searchProductsAdvanced(userText, CHAT_PRODUCT_DISPLAY_LIMIT);
    if (advanced.items.length) {
        const { items, total, meta } = advanced;
        const parts = [];
        if (meta.colors?.length) parts.push(meta.colors.join(', '));
        if (meta.maxPrice != null) parts.push(`under ₹${meta.maxPrice}`);
        const filterDesc = parts.length ? ` (${parts.join(', ')})` : '';
        return {
            text: `Here are ${formatChatProductListIntro(total, 'item')} that may match${filterDesc}:`,
            products: items,
            totalCount: total,
            filterMaxPrice: meta.maxPrice ?? max,
            extraHtml: chatCatalogOverflowExtra(total, items.length, meta.maxPrice ?? max)
        };
    }
    const result = searchProducts(userText.replace(/help|please|want|need|show|find/gi, ''), max);
    const { items, total } = result;
    if (items.length) {
        return {
            text: `Here are ${formatChatProductListIntro(total, 'item')} that may match${max != null ? ` under ₹${max}` : ''}:`,
            products: items,
            totalCount: total,
            filterMaxPrice: max,
            extraHtml: chatCatalogOverflowExtra(total, items.length, max)
        };
    }
    if (/size|fit|measurement/.test(q)) {
        return { text: "Check the **Size Guide** on any product page. For fit advice, tell me the product name or say **Talk to admin**." };
    }
    if (/discount|coupon|offer|code|wheel/.test(q)) {
        const promos = getActivePromoHints();
        const promoTxt = promos.length ? promos.map(c => `**${c}**`).join(', ') : '**WELCOME10**';
        return { text: `Try promo code ${promoTxt}, or spin the **Discount Wheel** on the homepage for more savings.` };
    }
    if (/delivery|shipping|dispatch/.test(q)) {
        return { text: "Delivery timelines vary by location. For a specific order update, sign in and open **Profile → My Orders**, or say **Track my order**." };
    }
  if (/return|exchange|refund/.test(q)) {
        return { text: "For returns or refunds, open **Live Support** (Talk to admin) with your order ID and our team will help." };
    }
    const cats = getCatalogCategoriesForChat(5);
    const catHint = cats.length ? ` Categories: ${cats.join(', ')}.` : '';
    return {
        text: `I'm here to help with **products**, **prices**, **orders**, and **styling**.${catHint}\n\n**Advanced:** compare products, similar styles, gifts, full outfits, occasion wear, color + budget filters.\n\nTry: *Best sellers*, *red kurta under ₹1500*, *Compare [A] and [B]*, or **Talk to admin**.`,
        extraHtml: buildChatHelpMenuHtml()
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
    if (intent === 'full_catalog') return getFullCatalogProducts();
    if (intent === 'new_arrivals') return getNewArrivalProducts();
    if (intent === 'stock') return getInStockProducts();
    if (intent === 'cheapest') {
        const max = extractMaxPrice(customerText);
        let items = getCheapestProducts();
        if (max != null) items = items.filter(p => (Number(p.price) || 0) <= max);
        return items;
    }
    if (intent === 'premium') return getPremiumProducts();
    if (intent === 'compare') return findProductsForComparison(customerText);
    if (intent === 'similar') {
        const anchor = findProductByNameQuery(customerText.replace(/similar to|like this|alternative to|something like/gi, ''));
        return anchor ? getSimilarProducts(anchor) : [];
    }
    if (intent === 'outfit_bundle') {
        const budget = extractMaxPrice(customerText) || 3000;
        return buildOutfitBundleUnderBudget(budget).items;
    }
    if (intent === 'gift') {
        const max = extractMaxPrice(customerText) || 1500;
        const r = searchProductsAdvanced(`gift under ${max}`, CHAT_PRODUCT_DISPLAY_LIMIT);
        return r.items.length ? r.items : getBestSellerProducts().filter(p => (Number(p.price) || 0) <= max);
    }
    if (typeof intent === 'object' && intent.type === 'occasion') {
        const max = extractMaxPrice(customerText);
        const r = searchProductsAdvanced(`${intent.occasion} wear ${max ? `under ${max}` : ''}`, CHAT_PRODUCT_DISPLAY_LIMIT);
        return r.items.length ? r.items : searchProducts(`${intent.occasion} wear`, max).items;
    }
    if (intent === 'advanced_search') return searchProductsAdvanced(customerText).items;
    if (intent === 'category') {
        const q = customerText.replace(/categor|collection|section|show|browse|in/gi, ' ').trim();
        return (q.length > 2 ? searchProductsByCategory(q) : searchProductsByCategory('')).items;
    }
    if (typeof intent === 'object' && intent.type === 'price_filter') {
        return searchProducts('', intent.max).items;
    }
    if (intent === 'suggest' || intent === 'price') {
        const max = extractMaxPrice(customerText);
        const adv = searchProductsAdvanced(customerText);
        if (adv.items.length) return adv.items;
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
    const trimmed = (text || '').trim();
    if (!trimmed || !canUseStorefrontLiveSupport()) return;

    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();
    await ensureSupportThread(threadId, profile);

    window.supportChatState.loaded = true;
    appendSupportBubble('customer', trimmed, '', SUPPORT_CHANNEL);

    const customerMsg = {
        sender: 'customer',
        text: trimmed,
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

function getAdminPreviewPrefix(threadOrSender) {
    const thread = typeof threadOrSender === 'object' ? threadOrSender : null;
    const sender = thread ? (thread.lastMessageSender || 'customer') : (threadOrSender || 'customer');
    if (sender === 'customer') return 'Customer';
    if (sender === 'admin') {
        const currentEmail = normalizeSupportEmail(currentUser?.email);
        const senderEmail = normalizeSupportEmail(thread?.lastAdminSenderEmail);
        if (currentEmail && senderEmail && currentEmail === senderEmail) return 'You';
        const name = thread?.lastAdminSenderName || (thread?.lastAdminSenderEmail ? thread.lastAdminSenderEmail.split('@')[0] : '');
        return name || 'Support';
    }
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
        if (/best seller|suggest|recommend|outfit|under|styles|show me|price filter|what.?s new|categor|cart|stock|promo|discount|compare|similar|gift|wedding|party|cheapest|premium|red |blue |green |black |white /i.test(text)) {
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
        appendSupportBubble('bot', 'Something went wrong. Please try again' + (canUseStorefrontLiveSupport() ? ' or switch to **Live Support**.' : '.'), '', AI_CHANNEL);
    }
}

async function handleSupportCustomerMessage(text) {
    const q = (text || '').trim().toLowerCase();
    if (window.supportChatState.activeTab === 'ai' && isAdminSupportChatEnabled() && /contact support|talk to admin|live support|speak to support/.test(q)) {
        if (!isLoggedInCustomer()) {
            appendSupportBubble(
                'bot',
                'For **live support**, please **sign in** to your account so we can link your orders.\n\nYou can keep asking me about products, prices, and orders here.',
                `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">
                    <button class="btn-gold" style="width:auto;padding:6px 10px;font-size:10px;margin:0;" onclick="navigateTo('user'); toggleAIChat();">Sign In</button>
                    ${getContactInfoHtml()}
                </div>`,
                AI_CHANNEL
            );
            return;
        }
        switchSupportChatTab('admin');
        return handleAdminSupportMessage(text);
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
                    let welcome = (window.APP_FEATURES_CONTENT?.chatbotWelcome) || "Hi! I'm your Swag Stree stylist. Ask about products, prices, orders, cart, or promos.";
                    if (isAdminSupportChatEnabled() && isLoggedInCustomer()) {
                        welcome += ' Need a person? Open the **Live Support** tab.';
                    }
                    appendSupportBubble('bot', welcome, buildChatHelpMenuHtml(), AI_CHANNEL);
                }
                if (isAdminSupportChatEnabled() && canUseStorefrontLiveSupport() && !split.support.length) {
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
                if (newSupportAdmin.length && canUseStorefrontLiveSupport()) {
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
    box.classList.add('ai-chat-card--open');
    window.supportChatState.adminThreadId = null;
    window.supportChatState.loaded = false;

    applySupportChatTabsVisibility();
    updateSupportChatTabUI(getDefaultSupportChatTab());

    const threadId = getCurrentCustomerThreadId();
    const profile = getCustomerProfile();
    await ensureSupportThread(threadId, profile);
    if (isLoggedInCustomer()) {
        const sync = {};
        if (currentUser.uid) sync.customerUid = currentUser.uid;
        if (currentUser.email) sync.customerEmail = normalizeSupportEmail(currentUser.email);
        if (profile.name) sync.customerName = profile.name;
        if (Object.keys(sync).length) {
            await db.collection('support_threads').doc(threadId).set(sync, { merge: true }).catch(() => {});
        }
    }
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
        box.classList.remove('ai-chat-card--open');
        stopCustomerMessagesListener();
    }
};

function refreshSupportChatChrome() {
    applySupportChatTabsVisibility();
    if (isSupportChatOpen()) {
        updateSupportChatTabUI(window.supportChatState.activeTab || getDefaultSupportChatTab());
    }
}
window.refreshSupportChatChrome = refreshSupportChatChrome;

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

window.openAdminSupportInboxChat = async function(threadId) {
    if (!isAdmin || !hasSupportChatCapability()) return showToast('You do not have permission to manage support chats.');
    if (!threadId) return showToast('Conversation not found.');
    const cached = findSupportThreadInCache({ threadId });
    await openAdminCustomerChat(
        cached?.customerUid || '',
        cached?.customerEmail || '',
        cached?.customerName || 'Guest',
        threadId
    );
};

window.openGuestCustomerSupportChat = async function(email, name) {
    if (!isAdmin || !hasSupportChatCapability()) return showToast('You do not have permission to manage support chats.');
    expandAdminSupportInbox();

    let thread = findSupportThreadInCache({ email });
    if (!thread && email) thread = await fetchSupportThreadByEmail(email);

    if (thread?.id) {
        await openAdminCustomerChat(thread.customerUid || '', thread.customerEmail || email, thread.customerName || name || 'Guest', thread.id);
        return;
    }

    showToast('No chat thread yet. Ask the customer to message via the site chat — it will appear in Support Chats.');
};

window.openAdminCustomerChat = async function(uid, email, name, threadIdOverride) {
    if (!isAdmin || !hasSupportChatCapability()) return showToast('You do not have permission to manage support chats.');

    let threadId = threadIdOverride || null;
    let threadMeta = threadId ? findSupportThreadInCache({ threadId }) : findSupportThreadInCache({ uid, email });

    if (!threadId) {
        threadId = await resolveAdminSupportThreadId(uid, email, null);
        if (!threadMeta && threadId) threadMeta = findSupportThreadInCache({ threadId });
    }

    if (!threadId) {
        if (typeof isGuestCustomerRecord === 'function' && isGuestCustomerRecord({ uid, email })) {
            return openGuestCustomerSupportChat(email, name);
        }
        return showToast('Unable to open this conversation.');
    }

    if (!threadMeta) {
        try {
            const doc = await db.collection('support_threads').doc(threadId).get();
            if (doc.exists) threadMeta = { id: doc.id, ...doc.data() };
        } catch (e) {
            console.warn('Failed to load support thread meta:', e);
        }
    }

    const displayName = threadMeta?.customerName || name || 'Customer';
    const displayEmail = threadMeta?.customerEmail || email || '';
    const visitorLabel = getSupportVisitorLabel(threadMeta || { customerUid: uid, customerEmail: email, id: threadId });

    window.supportChatState.adminThreadId = threadId;

    document.getElementById('admin-customer-chat-name').textContent = displayName;
    const emailEl = document.getElementById('admin-customer-chat-email');
    if (emailEl) {
        emailEl.innerHTML = [
            getSupportVisitorBadgeHtml(threadMeta || { customerUid: uid, customerEmail: email, id: threadId }),
            displayEmail ? `<span style="margin-left:6px;color:#888;">${escHtml(displayEmail)}</span>` : '<span style="margin-left:6px;color:#666;">No email on file</span>'
        ].join('');
    }

    document.getElementById('admin-customer-chat-modal').style.display = 'flex';
    document.getElementById('admin-customer-chat-input').value = '';

    await ensureSupportThread(threadId, {
        uid: threadMeta?.customerUid || uid || null,
        email: displayEmail,
        name: displayName
    });

    if (adminThreadUnsub) adminThreadUnsub();
    const body = document.getElementById('admin-customer-chat-body');
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
            senderName: currentUser?.displayName || (currentUser?.email ? currentUser.email.split('@')[0] : 'Admin')
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

function renderAdminSupportInboxListItem(t) {
    const unread = t.unreadByAdmin || 0;
    const isWaiting = t.status === 'waiting_admin';
    const safeThreadId = (t.id || '').replace(/'/g, "\\'");
    const visitorBadge = getSupportVisitorBadgeHtml(t);
    const previewPrefix = escHtml(getAdminPreviewPrefix(t));
    const previewText = t.lastMessagePreview || 'No messages yet';
    const displayName = getSupportThreadDisplayName(t);
    const displayEmail = getSupportThreadDisplayEmail(t);
    return `
        <div class="admin-support-inbox-item">
            <div class="admin-support-inbox-item-main">
                <div class="admin-support-inbox-item-head">
                    <strong class="admin-support-inbox-item-name">${escHtml(displayName)}</strong>
                    ${visitorBadge}
                    ${displayEmail ? `<span class="admin-support-inbox-item-email">${escHtml(displayEmail)}</span>` : (isRegisteredSupportThread(t) ? `<span class="admin-support-inbox-item-email" style="color:#666;">${escHtml(getSupportThreadAccountHint(t))}</span>` : '')}
                    ${unread ? `<span class="admin-support-inbox-badge admin-support-inbox-badge-new">${unread} new</span>` : ''}
                    ${isWaiting ? `<span class="admin-support-inbox-badge admin-support-inbox-badge-wait">Needs reply</span>` : ''}
                </div>
                <p class="admin-support-inbox-item-preview">
                    <span class="admin-support-inbox-preview-prefix">${previewPrefix}:</span> ${escHtml(previewText)}
                </p>
            </div>
            <button class="btn-gold admin-support-inbox-open-btn" onclick="openAdminSupportInboxChat('${safeThreadId}')"><i class="fa fa-comments"></i> Open Chat</button>
        </div>`;
}

function renderAdminSupportInboxPagination(totalItems, page, pageSize) {
    const pagination = document.getElementById('admin-support-inbox-pagination');
    if (!pagination) return;
    if (!totalItems) {
        pagination.innerHTML = '';
        return;
    }

    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const totalAll = getSupportInboxThreads(false).length;
    const tabLabel = window.adminSupportInboxState.activeTab === 'guests' ? 'guest' : 'registered';
    const extraTotal = totalAll !== totalItems ? ` · ${totalAll} total in inbox` : '';

    pagination.innerHTML = `
        <button type="button" class="admin-support-inbox-page-btn" ${page <= 1 ? 'disabled' : ''} onclick="goAdminSupportInboxPage(${page - 1})" aria-label="Previous page">
            <i class="fa fa-chevron-left"></i> Prev
        </button>
        <span class="admin-support-inbox-page-info">
            Page ${page} of ${totalPages}<br>
            ${totalItems} ${tabLabel} conversation${totalItems === 1 ? '' : 's'}${extraTotal}
        </span>
        <button type="button" class="admin-support-inbox-page-btn" ${page >= totalPages ? 'disabled' : ''} onclick="goAdminSupportInboxPage(${page + 1})" aria-label="Next page">
            Next <i class="fa fa-chevron-right"></i>
        </button>`;
}

function updateAdminSupportInboxTabCounts() {
    const threads = getSupportInboxThreads(false);
    const registeredCount = threads.filter(isRegisteredSupportThread).length;
    const guestCount = threads.filter(isGuestSupportThread).length;
    const registeredEl = document.getElementById('admin-support-tab-registered-count');
    const guestsEl = document.getElementById('admin-support-tab-guests-count');
    if (registeredEl) registeredEl.textContent = String(registeredCount);
    if (guestsEl) guestsEl.textContent = String(guestCount);

    const activeTab = window.adminSupportInboxState.activeTab === 'guests' ? 'guests' : 'registered';
    const registeredBtn = document.getElementById('admin-support-tab-registered');
    const guestsBtn = document.getElementById('admin-support-tab-guests');
    if (registeredBtn) registeredBtn.classList.toggle('active', activeTab === 'registered');
    if (guestsBtn) guestsBtn.classList.toggle('active', activeTab === 'guests');
}

function renderAdminSupportInbox() {
    const container = document.getElementById('admin-support-inbox-list');
    if (!container) return;

    prepareSupportThreadsForInbox();

    const searchEl = document.getElementById('admin-support-inbox-search');
    if (searchEl && document.activeElement !== searchEl) {
        searchEl.value = window.adminSupportInboxState.search || '';
    }

    updateAdminSupportInboxTabCounts();

    const filtered = getFilteredSupportInboxThreads();
    const pageSize = window.adminSupportInboxState.pageSize || 5;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if ((window.adminSupportInboxState.page || 1) > totalPages) {
        window.adminSupportInboxState.page = totalPages;
    }
    const page = window.adminSupportInboxState.page || 1;
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    if (!filtered.length) {
        const tabLabel = window.adminSupportInboxState.activeTab === 'guests' ? 'guest' : 'registered';
        const search = (window.adminSupportInboxState.search || '').trim();
        container.innerHTML = search
            ? '<p class="admin-support-inbox-empty">No conversations match your search.</p>'
            : `<p class="admin-support-inbox-empty">No ${tabLabel} support conversations yet.</p>`;
        renderAdminSupportInboxPagination(0, 1, pageSize);
        return;
    }

    container.innerHTML = pageItems.map(renderAdminSupportInboxListItem).join('');
    renderAdminSupportInboxPagination(filtered.length, page, pageSize);
}

window.loadAdminSupportInbox = function() {
    if (!isAdmin || !hasSupportChatCapability()) return;
    if (adminInboxUnsub) return;
    adminInboxUnsub = db.collection('support_threads').orderBy('lastMessageAt', 'desc').limit(ADMIN_SUPPORT_INBOX_FETCH_LIMIT)
        .onSnapshot(snap => {
            window.supportThreadsCache = [];
            snap.forEach(doc => window.supportThreadsCache.push({ id: doc.id, ...doc.data() }));
            prepareSupportThreadsForInbox();
            renderAdminSupportInbox();
            updateAdminSupportBadge();
            enrichSupportThreadsFromUsers().then(() => {
                renderAdminSupportInbox();
                updateAdminSupportBadge();
            });
        }, () => {
            db.collection('support_threads').limit(ADMIN_SUPPORT_INBOX_FETCH_LIMIT).onSnapshot(snap => {
                window.supportThreadsCache = [];
                snap.forEach(doc => window.supportThreadsCache.push({ id: doc.id, ...doc.data() }));
                window.supportThreadsCache.sort((a, b) => (b.lastMessageAt?.toMillis?.() || 0) - (a.lastMessageAt?.toMillis?.() || 0));
                prepareSupportThreadsForInbox();
                renderAdminSupportInbox();
                enrichSupportThreadsFromUsers().then(() => renderAdminSupportInbox());
            });
        });
};

window.toggleAdminSupportAccordion = function() {
    const content = document.getElementById('admin-support-accordion-content');
    const icon = document.getElementById('admin-support-accordion-icon');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    if (isHidden && typeof adminEnsureParentStoreToolsOpen === 'function') adminEnsureParentStoreToolsOpen('admin-support-inbox-section');
    else if (isHidden && typeof ensureAdminStoreToolsOpen === 'function') ensureAdminStoreToolsOpen();
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
    const total = getSupportInboxThreads(false)
        .reduce((s, t) => s + (t.unreadByAdmin || 0), 0);
    badge.textContent = total;
    badge.style.display = total > 0 ? 'inline-block' : 'none';
}

function updateSupportChatVisibility() {
    if (typeof applyCatalogControlsVisibility === 'function') {
        applyCatalogControlsVisibility();
    }
    applySupportChatTabsVisibility();
    const adminSection = document.getElementById('admin-support-inbox-section');
    if (adminSection) {
        const showInbox = isAdmin && hasSupportChatCapability() && isAdminSupportChatEnabled();
        adminSection.style.display = showInbox ? 'block' : 'none';
    }
    if (typeof renderAdminFavorites === 'function') renderAdminFavorites();
    if (isAnySupportChatEnabled()) startSupportCustomerWatcher();
    else stopSupportCustomerWatcher();

    const activeSection = document.querySelector('.section.active');
    const activeId = activeSection?.id?.replace('-view', '') || '';
    if ((activeId === 'home' || activeId === 'wish') && typeof renderFooter === 'function') {
        requestAnimationFrame(() => renderFooter(activeId));
    }
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
        if (isWish) row.classList.add('catalog-row-wishlist');

        let actionsWidth = isMobile ? 102 : (isTablet ? 116 : 128);
        if (chatEnabled) actionsWidth += isMobile ? 36 : 40;
        if (annEnabled) actionsWidth += isMobile ? 36 : 40;

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
    window.supportUserEmailCache = {};
    window.adminSupportInboxState = { activeTab: 'registered', search: '', page: 1, pageSize: 5 };
    const searchEl = document.getElementById('admin-support-inbox-search');
    if (searchEl) searchEl.value = '';
    window.supportChatState.activeThreadId = null;
    window.supportChatState.adminThreadId = null;
    window.supportChatState.loaded = false;
    const box = document.getElementById('ai-chat-box');
    if (box) {
        box.style.display = 'none';
        box.classList.remove('ai-chat-card--open');
    }
    const adminModal = document.getElementById('admin-customer-chat-modal');
    if (adminModal) adminModal.style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof applyCatalogControlsVisibility === 'function') applyCatalogControlsVisibility();
    updateSupportChatVisibility();
});

let supportChatChromeResizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(supportChatChromeResizeTimer);
    supportChatChromeResizeTimer = setTimeout(() => {
        if (typeof refreshSupportChatChrome === 'function') refreshSupportChatChrome();
    }, 150);
});
