/**
 * Cloudflare Worker — static assets + secured superadmin APIs.
 *
 * Required secrets / vars (set in Cloudflare dashboard):
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 * - FIREBASE_API_KEY
 * - SUPER_ADMIN_EMAIL (default: superadmin@swagstree.com)
 * Optional:
 * - CANONICAL_HOST (e.g. swagstree.com) — 301 redirect www to apex
 * - SEO_INDEXING_FORCE_OFF (true) — emergency block all indexing without Firestore
 * - CLOUDINARY_ASSET_PREFIX (e.g. swagstree) — also purge orphans under this folder prefix
 * - FIREBASE_SERVICE_ACCOUNT — JSON service account for Auth user export
 * - FIREBASE_PROJECT_ID (default: swagstree-web)
 */

const SUPER_ADMIN_DEFAULT = 'superadmin@swagstree.com';
const FIREBASE_PROJECT_DEFAULT = 'swagstree-web';
const BATCH_SIZE = 100;

function isSearchBot(userAgent) {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|discordbot|telegrambot|whatsapp|applebot|semrushbot|ahrefsbot|petalbot|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot/i.test(ua);
}

function parseFirestoreValue(field) {
    if (!field || typeof field !== 'object') return null;
    if ('stringValue' in field) return field.stringValue;
    if ('integerValue' in field) return parseInt(field.integerValue, 10);
    if ('doubleValue' in field) return field.doubleValue;
    if ('booleanValue' in field) return field.booleanValue;
    if ('timestampValue' in field) return field.timestampValue;
    if ('arrayValue' in field) return (field.arrayValue.values || []).map(parseFirestoreValue);
    return null;
}

function parseFirestoreDoc(doc) {
    const out = { id: doc.name ? doc.name.split('/').pop() : '' };
    const fields = doc.fields || {};
    Object.keys(fields).forEach((key) => {
        out[key] = parseFirestoreValue(fields[key]);
    });
    return out;
}

async function fetchFirestoreProduct(productId, env) {
    const apiKey = env.FIREBASE_API_KEY;
    const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_DEFAULT;
    if (!apiKey || !productId) return null;
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/products/${encodeURIComponent(productId)}?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const doc = await resp.json();
    return parseFirestoreDoc(doc);
}

async function fetchAllFirestoreProducts(env) {
    const apiKey = env.FIREBASE_API_KEY;
    const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_DEFAULT;
    if (!apiKey) return [];
    const products = [];
    let pageToken = '';
    let guard = 0;
    do {
        const listUrl = new URL(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/products`);
        listUrl.searchParams.set('key', apiKey);
        listUrl.searchParams.set('pageSize', '300');
        if (pageToken) listUrl.searchParams.set('pageToken', pageToken);
        const resp = await fetch(listUrl.toString());
        if (!resp.ok) break;
        const data = await resp.json();
        (data.documents || []).forEach((doc) => {
            const parsed = parseFirestoreDoc(doc);
            if (parsed.id && parsed.name) products.push(parsed);
        });
        pageToken = data.nextPageToken || '';
        guard += 1;
    } while (pageToken && guard < 10);
    return products;
}

function escXml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function fetchAllFirestoreCategories(env) {
    const apiKey = env.FIREBASE_API_KEY;
    const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_DEFAULT;
    if (!apiKey) return [];
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/categories?key=${encodeURIComponent(apiKey)}&pageSize=100`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.documents || []).map(parseFirestoreDoc).filter((c) => c.id && c.name && c.active !== false);
}

let seoIndexingCache = { value: true, ts: 0 };

async function fetchSeoIndexingFlag(env) {
    if (env.SEO_INDEXING_FORCE_OFF === 'true' || env.SEO_INDEXING_FORCE_OFF === '1') return false;
    const apiKey = env.FIREBASE_API_KEY;
    const projectId = env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_DEFAULT;
    if (!apiKey) return true;
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/settings/features_config?key=${encodeURIComponent(apiKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) return true;
    const doc = await resp.json();
    const field = doc.fields && doc.fields.seoIndexing;
    if (!field) return true;
    const val = parseFirestoreValue(field);
    return val !== false;
}

async function isSeoIndexingEnabledWorker(env) {
    const now = Date.now();
    if (now - seoIndexingCache.ts < 60000) return seoIndexingCache.value;
    const enabled = await fetchSeoIndexingFlag(env);
    seoIndexingCache = { value: enabled, ts: now };
    return enabled;
}

function buildRobotsDisallowAll() {
    return `# Swag Stree — public indexing disabled by superadmin
User-agent: *
Disallow: /
`;
}

function buildRobotsAllowAll(origin) {
    return `# Swag Stree — allow public storefront indexing
User-agent: *
Allow: /
Disallow: /api/

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

Sitemap: ${origin}/sitemap.xml
`;
}

function injectNoindexSeo(html, origin) {
    return injectGenericSeo(html, {
        title: 'Swag Stree — Online Fashion Store',
        description: 'Swag Stree online fashion store.',
        keywords: '',
        canonical: origin + '/',
        type: 'website',
        origin,
        jsonLd: null
    }).replace(
        '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
        '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">'
    );
}

function buildSitemapIndex(origin) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${escXml(origin + '/sitemap-pages.xml')}</loc></sitemap>
  <sitemap><loc>${escXml(origin + '/sitemap-products.xml')}</loc></sitemap>
</sitemapindex>`;
}

function buildPagesSitemap(origin, categories) {
    const urls = [
        `<url><loc>${escXml(origin + '/')}</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`
    ];
    (categories || []).forEach((cat) => {
        const slug = cat.slug || String(cat.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        if (!slug) return;
        urls.push(`<url><loc>${escXml(origin + '/?category=' + encodeURIComponent(slug))}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
    });
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${urls.join('')}
</urlset>`;
}

function buildProductsSitemapXml(origin, products) {
    const urls = (products || []).map((product) => {
        const loc = `${origin}/?id=${encodeURIComponent(product.id)}`;
        const imgs = Array.isArray(product.images) ? product.images.filter(Boolean).slice(0, 3) : [];
        const imageTags = imgs.map((img) => `<image:image><image:loc>${escXml(img)}</image:loc><image:title>${escXml(product.name || '')}</image:title></image:image>`).join('');
        const lastmod = product.updatedAt ? String(product.updatedAt).slice(0, 10) : '';
        const lastmodTag = lastmod ? `<lastmod>${escXml(lastmod)}</lastmod>` : '';
        return `<url><loc>${escXml(loc)}</loc>${lastmodTag}<changefreq>weekly</changefreq><priority>0.8</priority>${imageTags}</url>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls}</urlset>`;
}

function buildProductKeywords(product) {
    const bits = [product.name, 'Swag Stree', 'buy online India', 'COD', 'UPI'];
    if (product.categoryName) bits.push(product.categoryName);
    return bits.filter(Boolean).join(', ');
}

function injectProductSeo(html, product, origin) {
    const name = product.name || 'Product';
    const description = String(product.description || `Shop ${name} at Swag Stree — premium fashion with COD, UPI & fast India delivery.`).slice(0, 160);
    const images = (Array.isArray(product.images) ? product.images.filter(Boolean) : []).slice(0, 5);
    const image = images[0] || `${origin}/assets/logo.png`;
    const canonical = `${origin}/?id=${encodeURIComponent(product.id)}`;
    const title = `${name} — Buy Online at ₹${Number(product.price) || 0} | Swag Stree`;
    const keywords = buildProductKeywords(product);
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name,
        description,
        image: images.length ? images : [image],
        sku: product.id,
        mpn: product.id,
        url: canonical,
        brand: { '@type': 'Brand', name: 'Swag Stree' },
        offers: {
            '@type': 'Offer',
            priceCurrency: 'INR',
            price: Number(product.price) || 0,
            availability: 'https://schema.org/InStock',
            itemCondition: 'https://schema.org/NewCondition',
            url: canonical,
            seller: { '@type': 'Organization', name: 'Swag Stree' }
        }
    };
    if (product.categoryName) jsonLd.category = product.categoryName;

    let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escHtml(title)}</title>`);
    const headInject = `
<meta name="description" content="${escHtml(description)}">
<meta name="keywords" content="${escHtml(keywords)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${escHtml(canonical)}">
<meta property="og:site_name" content="Swag Stree">
<meta property="og:type" content="product">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:url" content="${escHtml(canonical)}">
<meta property="og:image" content="${escHtml(image)}">
<meta property="og:image:alt" content="${escHtml(name)}">
<meta property="og:locale" content="en-IN">
<meta property="product:price:amount" content="${Number(product.price) || 0}">
<meta property="product:price:currency" content="INR">
<meta property="product:brand" content="Swag Stree">
<meta property="product:availability" content="in stock">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@swag_stree">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${escHtml(image)}">
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
    out = out.replace('</head>', `${headInject}\n</head>`);
    return out;
}

function injectGenericSeo(html, { title, description, keywords, canonical, type, origin, jsonLd }) {
    const image = `${origin}/assets/logo.png`;
    let out = html.replace(/<title>[^<]*<\/title>/i, `<title>${escHtml(title)}</title>`);
    const headInject = `
<meta name="description" content="${escHtml(description)}">
<meta name="keywords" content="${escHtml(keywords || '')}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${escHtml(canonical)}">
<meta property="og:site_name" content="Swag Stree">
<meta property="og:type" content="${escHtml(type || 'website')}">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(description)}">
<meta property="og:url" content="${escHtml(canonical)}">
<meta property="og:image" content="${escHtml(image)}">
<meta property="og:locale" content="en-IN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@swag_stree">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(description)}">
<meta name="twitter:image" content="${escHtml(image)}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}`;
    out = out.replace('</head>', `${headInject}\n</head>`);
    return out;
}

function injectCategorySeo(html, category, origin) {
    const slug = category.slug || String(category.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const canonical = `${origin}/?category=${encodeURIComponent(slug)}`;
    const title = `${category.name} — Shop Online India | Swag Stree`;
    const description = `Browse premium ${category.name} at Swag Stree. COD, UPI, Paytm & fast pan-India delivery.`;
    const keywords = [category.name, 'buy online India', 'Swag Stree', 'COD', 'UPI'].join(', ');
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url: canonical
    };
    return injectGenericSeo(html, { title, description, keywords, canonical, type: 'website', origin, jsonLd });
}

function injectSearchSeo(html, query, origin) {
    const canonical = `${origin}/?q=${encodeURIComponent(query)}`;
    const title = `${query} — Fashion Search | Swag Stree`;
    const description = `Shop ${query} and more premium fashion at Swag Stree with COD, UPI & India-wide delivery.`;
    const keywords = [query, query + ' online India', 'Swag Stree fashion'].join(', ');
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        name: title,
        url: canonical
    };
    return injectGenericSeo(html, { title, description, keywords, canonical, type: 'website', origin, jsonLd });
}

function buildRssFeed(origin, products) {
    const items = (products || []).slice(0, 100).map((product) => {
        const link = `${origin}/?id=${encodeURIComponent(product.id)}`;
        const desc = escXml(String(product.description || product.name || '').slice(0, 500));
        const img = Array.isArray(product.images) && product.images[0] ? `<enclosure url="${escXml(product.images[0])}" type="image/jpeg"/>` : '';
        return `<item>
  <title>${escXml(product.name || 'Product')}</title>
  <link>${escXml(link)}</link>
  <guid isPermaLink="true">${escXml(link)}</guid>
  <description>${desc}</description>
  <category>Fashion</category>
  ${img}
</item>`;
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>Swag Stree — New Products</title>
  <link>${escXml(origin + '/')}</link>
  <description>Premium fashion catalog — kurtas, coord sets, sarees &amp; more. COD &amp; UPI across India.</description>
  <language>en-in</language>
  <atom:link href="${escXml(origin + '/feed.xml')}" rel="self" type="application/rss+xml"/>
  ${items}
</channel>
</rss>`;
}

function buildCatalogJson(origin, products, categories) {
    return {
        '@context': 'https://schema.org',
        '@type': 'DataFeed',
        name: 'Swag Stree Product Catalog',
        dateModified: new Date().toISOString(),
        dataFeedElement: (products || []).slice(0, 500).map((product) => ({
            '@type': 'Product',
            name: product.name,
            sku: product.id,
            url: `${origin}/?id=${encodeURIComponent(product.id)}`,
            image: Array.isArray(product.images) ? product.images[0] : null,
            offers: {
                '@type': 'Offer',
                priceCurrency: 'INR',
                price: Number(product.price) || 0
            }
        })),
        categories: (categories || []).map((cat) => ({
            name: cat.name,
            slug: cat.slug || String(cat.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            url: `${origin}/?category=${encodeURIComponent(cat.slug || cat.name)}`
        }))
    };
}

function maybeCanonicalRedirect(request, env) {
    const canonical = (env.CANONICAL_HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!canonical) return null;
    const url = new URL(request.url);
    if (url.hostname === 'www.' + canonical) {
        url.hostname = canonical;
        url.protocol = 'https:';
        return Response.redirect(url.toString(), 301);
    }
    return null;
}

function seoHtmlResponse(html, extraHeaders) {
    const headers = new Headers({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'index, follow, max-image-preview:large',
        'Link': '</sitemap.xml>; rel="sitemap"'
    });
    if (extraHeaders) Object.entries(extraHeaders).forEach(([k, v]) => headers.set(k, v));
    return new Response(html, { headers });
}

function textResponse(body, contentType, cacheSeconds) {
    return new Response(body, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': `public, max-age=${cacheSeconds || 3600}`
        }
    });
}

function xmlResponse(body) {
    return new Response(body, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
        }
    });
}

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    };
}

async function verifySuperAdminToken(idToken, env) {
    if (!idToken || !env.FIREBASE_API_KEY) return null;
    const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.FIREBASE_API_KEY)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        }
    );
    const data = await resp.json();
    if (!resp.ok || data.error || !Array.isArray(data.users) || !data.users.length) return null;

    const email = (data.users[0].email || '').toLowerCase();
    const allowed = (env.SUPER_ADMIN_EMAIL || SUPER_ADMIN_DEFAULT).toLowerCase();
    return email === allowed ? email : null;
}

function cloudinaryAuthHeader(env) {
    const key = env.CLOUDINARY_API_KEY;
    const secret = env.CLOUDINARY_API_SECRET;
    if (!key || !secret) return null;
    return 'Basic ' + btoa(`${key}:${secret}`);
}

async function cloudinaryDestroyBatch(cloudName, authHeader, resourceType, publicIds) {
    if (!publicIds.length) return { deleted: {}, failed: {} };

    const body = new URLSearchParams();
    publicIds.forEach((id) => body.append('public_ids[]', id));

    const resp = await fetch(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${resourceType}/destroy`,
        {
            method: 'POST',
            headers: {
                Authorization: authHeader,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body
        }
    );

    const data = await resp.json();
    if (!resp.ok) {
        throw new Error(data.error?.message || `Cloudinary destroy failed (${resp.status})`);
    }
    return data;
}

async function cloudinaryDeleteByPrefix(cloudName, authHeader, resourceType, prefix) {
    let totalDeleted = 0;
    let cursor = null;
    let guard = 0;

    while (guard < 200) {
        guard += 1;
        const params = new URLSearchParams({
            prefix,
            max_results: '500',
            type: 'upload'
        });
        if (cursor) params.set('next_cursor', cursor);

        const listResp = await fetch(
            `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/resources/${resourceType}/upload?${params}`,
            { headers: { Authorization: authHeader } }
        );
        const listData = await listResp.json();
        if (!listResp.ok) {
            throw new Error(listData.error?.message || `Cloudinary list failed (${listResp.status})`);
        }

        const publicIds = (listData.resources || []).map((r) => r.public_id).filter(Boolean);
        if (publicIds.length) {
            for (let i = 0; i < publicIds.length; i += BATCH_SIZE) {
                const chunk = publicIds.slice(i, i + BATCH_SIZE);
                const result = await cloudinaryDestroyBatch(cloudName, authHeader, resourceType, chunk);
                totalDeleted += Object.keys(result.deleted || {}).length;
            }
        }

        cursor = listData.next_cursor;
        if (!cursor || !publicIds.length) break;
    }

    return totalDeleted;
}

function base64urlFromString(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlFromBuffer(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((b) => { binary += String.fromCharCode(b); });
    return base64urlFromString(binary);
}

async function importServiceAccountPrivateKey(pem) {
    const pemContents = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '');
    const binary = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey(
        'pkcs8',
        binary.buffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

async function getGoogleAccessToken(serviceAccount) {
    const iat = Math.floor(Date.now() / 1000);
    const header = base64urlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64urlFromString(JSON.stringify({
        iss: serviceAccount.client_email,
        sub: serviceAccount.client_email,
        aud: 'https://oauth2.googleapis.com/token',
        iat,
        exp: iat + 3600,
        scope: 'https://www.googleapis.com/auth/identitytoolkit'
    }));
    const key = await importServiceAccountPrivateKey(serviceAccount.private_key);
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        key,
        new TextEncoder().encode(`${header}.${payload}`)
    );
    const jwt = `${header}.${payload}.${base64urlFromBuffer(signature)}`;
    const resp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });
    const data = await resp.json();
    if (!data.access_token) {
        throw new Error(data.error_description || data.error || 'Google token exchange failed');
    }
    return data.access_token;
}

function sanitizeAuthUserRecord(user) {
    if (!user) return null;
    return {
        uid: user.localId || user.uid || '',
        email: user.email || '',
        emailVerified: !!user.emailVerified,
        displayName: user.displayName || '',
        phoneNumber: user.phoneNumber || '',
        disabled: !!user.disabled,
        createdAt: user.createdAt || null,
        lastLoginAt: user.lastLoginAt || null,
        providerData: (user.providerUserInfo || []).map((p) => ({
            providerId: p.providerId || '',
            email: p.email || '',
            displayName: p.displayName || '',
            photoUrl: p.photoUrl || '',
            federatedId: p.federatedId || '',
            rawId: p.rawId || ''
        }))
    };
}

async function exportFirebaseAuthUsers(env) {
    if (!env.FIREBASE_SERVICE_ACCOUNT) {
        throw new Error('Firebase Auth export is not configured. Set FIREBASE_SERVICE_ACCOUNT in Worker secrets.');
    }

    let serviceAccount;
    try {
        serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    } catch (_) {
        throw new Error('FIREBASE_SERVICE_ACCOUNT secret is not valid JSON.');
    }

    const projectId = env.FIREBASE_PROJECT_ID || serviceAccount.project_id || 'swagstree-web';
    const accessToken = await getGoogleAccessToken(serviceAccount);
    const users = [];
    let pageToken = undefined;
    let guard = 0;

    while (guard < 200) {
        guard += 1;
        const body = { limit: 1000, returnUserInfo: true };
        if (pageToken) body.pageToken = pageToken;

        const resp = await fetch(
            `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/accounts:query`,
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            }
        );
        const data = await resp.json();
        if (!resp.ok) {
            throw new Error(data.error?.message || `Auth accounts query failed (${resp.status})`);
        }

        (data.userInfo || []).forEach((user) => {
            const sanitized = sanitizeAuthUserRecord(user);
            if (sanitized && sanitized.uid) users.push(sanitized);
        });

        pageToken = data.nextPageToken;
        if (!pageToken) break;
    }

    return users;
}

async function exportAuthUsers(request, env) {
    const authHeader = request.headers.get('Authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const idToken = tokenMatch ? tokenMatch[1].trim() : '';
    const superEmail = await verifySuperAdminToken(idToken, env);
    if (!superEmail) {
        return jsonResponse({ ok: false, error: 'Unauthorized — superadmin login required.' }, 401);
    }

    try {
        const users = await exportFirebaseAuthUsers(env);
        return jsonResponse({
            ok: true,
            exportedAt: new Date().toISOString(),
            count: users.length,
            users,
            note: 'Auth metadata export only. Password hashes are not included. Import via Firebase Console if needed.'
        });
    } catch (e) {
        return jsonResponse({ ok: false, error: e.message || 'Auth export failed.' }, 503);
    }
}

async function purgeCloudinaryAssets(request, env) {
    const authHeader = request.headers.get('Authorization') || '';
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    const idToken = tokenMatch ? tokenMatch[1].trim() : '';
    const superEmail = await verifySuperAdminToken(idToken, env);
    if (!superEmail) {
        return jsonResponse({ ok: false, error: 'Unauthorized — superadmin login required.' }, 401);
    }

    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    const cAuth = cloudinaryAuthHeader(env);
    if (!cloudName || !cAuth) {
        return jsonResponse({
            ok: false,
            error: 'Cloudinary Admin API is not configured on the server. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in Cloudflare Worker secrets.'
        }, 503);
    }

    let payload = {};
    try {
        payload = await request.json();
    } catch (_) {
        return jsonResponse({ ok: false, error: 'Invalid JSON body.' }, 400);
    }

    const imageIds = Array.isArray(payload.imagePublicIds) ? [...new Set(payload.imagePublicIds.filter(Boolean))] : [];
    const rawIds = Array.isArray(payload.rawPublicIds) ? [...new Set(payload.rawPublicIds.filter(Boolean))] : [];
    const includePrefixOrphans = payload.includePrefixOrphans !== false;
    const prefix = (env.CLOUDINARY_ASSET_PREFIX || 'swagstree').trim();

    let deletedImages = 0;
    let deletedRaw = 0;
    let prefixImages = 0;
    let prefixRaw = 0;
    const errors = [];

    try {
        for (let i = 0; i < imageIds.length; i += BATCH_SIZE) {
            const chunk = imageIds.slice(i, i + BATCH_SIZE);
            const result = await cloudinaryDestroyBatch(cloudName, cAuth, 'image', chunk);
            deletedImages += Object.keys(result.deleted || {}).length;
            if (result.failed && Object.keys(result.failed).length) {
                errors.push(`Some image deletes failed: ${Object.keys(result.failed).length}`);
            }
        }

        for (let i = 0; i < rawIds.length; i += BATCH_SIZE) {
            const chunk = rawIds.slice(i, i + BATCH_SIZE);
            const result = await cloudinaryDestroyBatch(cloudName, cAuth, 'raw', chunk);
            deletedRaw += Object.keys(result.deleted || {}).length;
            if (result.failed && Object.keys(result.failed).length) {
                errors.push(`Some raw file deletes failed: ${Object.keys(result.failed).length}`);
            }
        }

        if (includePrefixOrphans && prefix) {
            try {
                prefixImages = await cloudinaryDeleteByPrefix(cloudName, cAuth, 'image', prefix);
            } catch (e) {
                errors.push(`Prefix image cleanup (${prefix}): ${e.message}`);
            }
            try {
                prefixRaw = await cloudinaryDeleteByPrefix(cloudName, cAuth, 'raw', prefix);
            } catch (e) {
                errors.push(`Prefix raw cleanup (${prefix}): ${e.message}`);
            }
        }
    } catch (e) {
        return jsonResponse({ ok: false, error: e.message || 'Cloudinary purge failed.' }, 500);
    }

    return jsonResponse({
        ok: true,
        deleted: {
            referencedImages: deletedImages,
            referencedRaw: deletedRaw,
            prefixImages,
            prefixRaw,
            total: deletedImages + deletedRaw + prefixImages + prefixRaw
        },
        prefixUsed: includePrefixOrphans ? prefix : null,
        warnings: errors
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        const canonicalRedirect = maybeCanonicalRedirect(request, env);
        if (canonicalRedirect) return canonicalRedirect;

        if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        if (url.pathname === '/api/cloudinary/purge' && request.method === 'POST') {
            const resp = await purgeCloudinaryAssets(request, env);
            const headers = new Headers(resp.headers);
            Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
            return new Response(resp.body, { status: resp.status, headers });
        }

        if (url.pathname === '/api/auth/export' && request.method === 'GET') {
            const resp = await exportAuthUsers(request, env);
            const headers = new Headers(resp.headers);
            Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
            headers.set('X-Robots-Tag', 'noindex, nofollow');
            return new Response(resp.body, { status: resp.status, headers });
        }

        const seoIndexingOn = await isSeoIndexingEnabledWorker(env);

        if (url.pathname === '/robots.txt') {
            const body = seoIndexingOn ? buildRobotsAllowAll(url.origin) : buildRobotsDisallowAll();
            return textResponse(body, 'text/plain; charset=utf-8', seoIndexingOn ? 3600 : 300);
        }

        const seoDiscoveryPaths = new Set([
            '/sitemap.xml', '/sitemap-pages.xml', '/sitemap-products.xml',
            '/feed.xml', '/catalog.json', '/llms.txt', '/ai.txt', '/opensearch.xml'
        ]);
        if (!seoIndexingOn && seoDiscoveryPaths.has(url.pathname)) {
            return new Response('Indexing disabled', {
                status: 404,
                headers: { 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store' }
            });
        }

        if (url.pathname === '/sitemap.xml') {
            return xmlResponse(buildSitemapIndex(url.origin));
        }
        if (url.pathname === '/sitemap-pages.xml') {
            const categories = await fetchAllFirestoreCategories(env);
            return xmlResponse(buildPagesSitemap(url.origin, categories));
        }
        if (url.pathname === '/sitemap-products.xml') {
            const products = await fetchAllFirestoreProducts(env);
            return xmlResponse(buildProductsSitemapXml(url.origin, products));
        }
        if (url.pathname === '/feed.xml') {
            const products = await fetchAllFirestoreProducts(env);
            return xmlResponse(buildRssFeed(url.origin, products));
        }
        if (url.pathname === '/catalog.json') {
            const [products, categories] = await Promise.all([
                fetchAllFirestoreProducts(env),
                fetchAllFirestoreCategories(env)
            ]);
            return new Response(JSON.stringify(buildCatalogJson(url.origin, products, categories)), {
                headers: {
                    'Content-Type': 'application/ld+json; charset=utf-8',
                    'Cache-Control': 'public, max-age=1800',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        if (url.pathname === '/.well-known/security.txt') {
            return textResponse(
                'Contact: mailto:support@swagstree.com\nExpires: 2027-12-31T23:59:59.000Z\nPreferred-Languages: en\nCanonical: https://swagstree.com/.well-known/security.txt\n',
                'text/plain; charset=utf-8',
                86400
            );
        }

        const ua = request.headers.get('user-agent') || '';
        const isBot = isSearchBot(ua);
        const productId = url.searchParams.get('id');
        const categorySlug = url.searchParams.get('category');
        const searchQ = (url.searchParams.get('q') || '').trim();

        if (url.pathname === '/' && isBot && env.ASSETS) {
            const assetResp = await env.ASSETS.fetch(new Request(new URL('/', url.origin).toString(), request));
            if (assetResp.ok) {
                const baseHtml = await assetResp.text();
                if (!seoIndexingOn) {
                    return seoHtmlResponse(injectNoindexSeo(baseHtml, url.origin), { 'X-Robots-Tag': 'noindex, nofollow' });
                }
                if (productId) {
                    const product = await fetchFirestoreProduct(productId, env);
                    if (product && product.name) {
                        return seoHtmlResponse(injectProductSeo(baseHtml, product, url.origin));
                    }
                }
                if (categorySlug) {
                    const categories = await fetchAllFirestoreCategories(env);
                    const match = categories.find((c) => {
                        const slug = (c.slug || String(c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')).toLowerCase();
                        return slug === categorySlug.toLowerCase();
                    });
                    if (match) {
                        return seoHtmlResponse(injectCategorySeo(baseHtml, match, url.origin));
                    }
                }
                if (searchQ) {
                    return seoHtmlResponse(injectSearchSeo(baseHtml, searchQ, url.origin));
                }
            }
        }

        if (env.ASSETS) {
            const assetResp = await env.ASSETS.fetch(request);
            if (url.pathname.startsWith('/api/') && assetResp.status !== 404) {
                const headers = new Headers(assetResp.headers);
                headers.set('X-Robots-Tag', 'noindex, nofollow');
                return new Response(assetResp.body, { status: assetResp.status, headers });
            }
            if (assetResp.ok && (url.pathname === '/' || url.pathname.endsWith('.html')) && !url.pathname.startsWith('/api/')) {
                const headers = new Headers(assetResp.headers);
                if (seoIndexingOn) {
                    headers.set('Link', '</sitemap.xml>; rel="sitemap"');
                } else {
                    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
                }
                return new Response(assetResp.body, { status: assetResp.status, headers });
            }
            return assetResp;
        }

        return new Response('Not Found', { status: 404 });
    }
};
