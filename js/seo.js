// ==========================================
// SWAG STREE | SEO & INDEXING
// ==========================================

(function() {
    const DEFAULT_SEO = {
        siteName: 'Swag Stree',
        brand: 'Swag Stree',
        title: 'Swag Stree — Premium Fashion & Trendsetting Apparel Online',
        description: 'Shop premium fashion at Swag Stree. Trendsetting kurtas, coord sets, sarees & everyday swag with COD, UPI, fast delivery across India.',
        keywords: 'Swag Stree, Swagstree, online fashion India, premium apparel, kurtas, coord sets, sarees, ethnic wear, streetwear, COD shopping, UPI fashion store',
        locale: 'en_IN',
        twitterHandle: '@swag_stree',
        instagram: 'https://instagram.com/swag_stree',
        phone: '+918800467686',
        email: 'support@swagstree.com',
        priceCurrency: 'INR',
        country: 'IN'
    };

    window.SEO_DEFAULTS = DEFAULT_SEO;
    window.seoSettings = Object.assign({}, DEFAULT_SEO);

    function getSiteOrigin() {
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            return String(window.location.origin).replace(/\/$/, '');
        }
        return 'https://swagstree.com';
    }
    window.getSiteOrigin = getSiteOrigin;

    function escMeta(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function truncate(str, max) {
        const s = String(str || '').replace(/\s+/g, ' ').trim();
        if (!max || s.length <= max) return s;
        return s.slice(0, Math.max(0, max - 1)).trim() + '…';
    }

    function absoluteUrl(pathOrUrl) {
        if (!pathOrUrl) return getSiteOrigin() + '/';
        if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
        const path = pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl;
        return getSiteOrigin() + path;
    }

    function productUrl(productId) {
        return getSiteOrigin() + '/?id=' + encodeURIComponent(productId);
    }

    function productImage(product) {
        if (!product) return absoluteUrl('/assets/logo.png');
        const imgs = product.images || [];
        const variantImg = product.normalizedVariants && product.normalizedVariants[0] && product.normalizedVariants[0].image;
        return absoluteUrl(imgs[0] || variantImg || product.image || '/assets/logo.png');
    }

    function productDescription(product) {
        const desc = (product && product.description) ? String(product.description).trim() : '';
        if (desc) return truncate(desc, 160);
        const name = product && product.name ? product.name : 'Product';
        const price = product && product.price != null ? '₹' + product.price : '';
        return truncate('Buy ' + name + (price ? ' at ' + price : '') + ' on Swag Stree. Premium quality fashion with COD & UPI.', 160);
    }

    function ensureMetaByName(name, content) {
        if (!name) return;
        let el = document.querySelector('meta[name="' + name + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', name);
            document.head.appendChild(el);
        }
        el.setAttribute('content', content || '');
    }

    function ensureMetaByProperty(prop, content) {
        if (!prop) return;
        let el = document.querySelector('meta[property="' + prop + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute('property', prop);
            document.head.appendChild(el);
        }
        el.setAttribute('content', content || '');
    }

    function ensureLinkRel(rel, href, extra) {
        const selector = 'link[rel="' + rel + '"]' + (extra && extra.id ? '#' + extra.id : '');
        let el = document.querySelector(selector) || document.querySelector('link[rel="' + rel + '"]');
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            if (extra && extra.id) el.id = extra.id;
            document.head.appendChild(el);
        }
        if (href) el.setAttribute('href', href);
        if (extra && extra.type) el.setAttribute('type', extra.type);
    }

    function setJsonLd(data) {
        let el = document.getElementById('seo-jsonld');
        if (!el) {
            el = document.createElement('script');
            el.type = 'application/ld+json';
            el.id = 'seo-jsonld';
            document.head.appendChild(el);
        }
        el.textContent = JSON.stringify(data);
    }

    function setRobotsIndexable(indexable) {
        ensureMetaByName('robots', indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow');
        ensureMetaByName('googlebot', indexable ? 'index, follow' : 'noindex, nofollow');
    }

    function buildOrganizationSchema() {
        const s = window.seoSettings || DEFAULT_SEO;
        return {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: s.brand || s.siteName,
            url: getSiteOrigin() + '/',
            logo: absoluteUrl('/assets/logo.png'),
            email: s.email,
            telephone: s.phone,
            sameAs: [s.instagram, 'https://wa.me/918800467686', 'https://www.facebook.com/share/1CRwnQckvY/'].filter(Boolean)
        };
    }

    function buildWebsiteSchema() {
        const s = window.seoSettings || DEFAULT_SEO;
        return {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: s.siteName,
            url: getSiteOrigin() + '/',
            inLanguage: s.locale || 'en-IN',
            potentialAction: {
                '@type': 'SearchAction',
                target: getSiteOrigin() + '/?q={search_term_string}',
                'query-input': 'required name=search_term_string'
            }
        };
    }

    function buildProductSchema(product) {
        if (!product) return null;
        const s = window.seoSettings || DEFAULT_SEO;
        const inStock = typeof isProductOutOfStock === 'function' ? !isProductOutOfStock(product) : true;
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name || 'Product',
            description: productDescription(product),
            image: [productImage(product)],
            sku: product.id,
            brand: { '@type': 'Brand', name: s.brand || s.siteName },
            offers: {
                '@type': 'Offer',
                url: productUrl(product.id),
                priceCurrency: s.priceCurrency || 'INR',
                price: Number(product.price) || 0,
                availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                seller: { '@type': 'Organization', name: s.siteName }
            }
        };
        if (product.categoryName || (typeof resolveProductCategoryLabel === 'function' && resolveProductCategoryLabel(product))) {
            schema.category = product.categoryName || resolveProductCategoryLabel(product);
        }
        return schema;
    }

    function buildLocalBusinessSchema() {
        const s = window.seoSettings || DEFAULT_SEO;
        return {
            '@context': 'https://schema.org',
            '@type': 'ClothingStore',
            name: s.siteName,
            url: getSiteOrigin() + '/',
            image: absoluteUrl('/assets/logo.png'),
            telephone: s.phone,
            email: s.email,
            priceRange: '₹₹',
            address: {
                '@type': 'PostalAddress',
                addressCountry: s.country || 'IN'
            },
            sameAs: [s.instagram, 'https://wa.me/918800467686'].filter(Boolean)
        };
    }

    function buildItemListSchema(products) {
        const list = (products || []).filter(function(p) {
            return p && p.id && p.name;
        }).slice(0, 24);
        if (!list.length) return null;
        return {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Swag Stree Fashion Catalog',
            itemListElement: list.map(function(p, i) {
                return {
                    '@type': 'ListItem',
                    position: i + 1,
                    url: productUrl(p.id),
                    name: p.name
                };
            })
        };
    }

    function buildBreadcrumbSchema(items) {
        return {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: (items || []).map(function(item, i) {
                return {
                    '@type': 'ListItem',
                    position: i + 1,
                    name: item.name,
                    item: item.url
                };
            })
        };
    }

    function applySeoBundle(bundle) {
        if (!bundle) return;
        const s = window.seoSettings || DEFAULT_SEO;
        const title = bundle.title || s.title;
        const description = bundle.description || s.description;
        const canonical = bundle.canonical || getSiteOrigin() + '/';
        const image = bundle.image || absoluteUrl('/assets/logo.png');
        const type = bundle.type || 'website';

        document.title = title;
        ensureMetaByName('description', description);
        ensureMetaByName('keywords', bundle.keywords || s.keywords);
        ensureMetaByName('author', s.brand);
        ensureMetaByName('application-name', s.siteName);
        ensureLinkRel('canonical', canonical);

        ensureMetaByProperty('og:site_name', s.siteName);
        ensureMetaByProperty('og:title', title);
        ensureMetaByProperty('og:description', description);
        ensureMetaByProperty('og:type', type);
        ensureMetaByProperty('og:url', canonical);
        ensureMetaByProperty('og:image', image);
        ensureMetaByProperty('og:locale', (s.locale || 'en_IN').replace('_', '-'));

        ensureMetaByName('twitter:card', 'summary_large_image');
        ensureMetaByName('twitter:title', title);
        ensureMetaByName('twitter:description', description);
        ensureMetaByName('twitter:image', image);
        if (s.twitterHandle) ensureMetaByName('twitter:site', s.twitterHandle);

        setRobotsIndexable(bundle.indexable !== false);
        if (bundle.jsonLd) setJsonLd(bundle.jsonLd);
    }

    window.syncSeoForView = function(viewId) {
        const s = window.seoSettings || DEFAULT_SEO;
        const privateViews = { admin: true, super: true, promo: true };
        if (privateViews[viewId]) {
            applySeoBundle({
                title: s.siteName + ' — Admin',
                description: 'Private admin area.',
                canonical: getSiteOrigin() + '/',
                indexable: false,
                jsonLd: { '@context': 'https://schema.org', '@graph': [buildOrganizationSchema()] }
            });
            return;
        }

        if (viewId === 'wish') {
            applySeoBundle({
                title: 'Wishlist — ' + s.siteName,
                description: 'Your saved fashion picks at ' + s.siteName + '.',
                canonical: getSiteOrigin() + '/',
                type: 'website',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@graph': [buildOrganizationSchema(), buildWebsiteSchema()]
                }
            });
            return;
        }

        if (viewId === 'user') {
            applySeoBundle({
                title: 'My Account & Orders — ' + s.siteName,
                description: 'Manage your Swag Stree profile, orders, and delivery notes.',
                canonical: getSiteOrigin() + '/',
                indexable: false,
                jsonLd: { '@context': 'https://schema.org', '@graph': [buildOrganizationSchema()] }
            });
            return;
        }

        const itemList = buildItemListSchema(window.products || []);
        applySeoBundle({
            title: s.title,
            description: s.description,
            keywords: s.keywords,
            canonical: getSiteOrigin() + '/',
            image: absoluteUrl('/assets/logo.png'),
            type: 'website',
            jsonLd: {
                '@context': 'https://schema.org',
                '@graph': [
                    buildOrganizationSchema(),
                    buildWebsiteSchema(),
                    buildLocalBusinessSchema()
                ].concat(itemList ? [itemList] : [])
            }
        });
        refreshSeoProductIndex(window.products || []);
    };

    window.syncSeoForProduct = function(product) {
        if (!product || !product.id) {
            syncSeoForView('home');
            return;
        }
        const s = window.seoSettings || DEFAULT_SEO;
        const title = (product.name || 'Product') + ' — Buy Online | ' + s.siteName;
        const description = productDescription(product);
        const url = productUrl(product.id);
        const image = productImage(product);
        const breadcrumbs = buildBreadcrumbSchema([
            { name: 'Home', url: getSiteOrigin() + '/' },
            { name: product.name, url: url }
        ]);
        const productSchema = buildProductSchema(product);
        const graph = [buildOrganizationSchema(), breadcrumbs];
        if (productSchema) graph.push(productSchema);

        applySeoBundle({
            title: title,
            description: description,
            canonical: url,
            image: image,
            type: 'product',
            jsonLd: { '@context': 'https://schema.org', '@graph': graph }
        });
    };

    window.syncSeoFromUrl = function() {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (id && Array.isArray(window.products)) {
            const p = window.products.find(function(x) { return x.id === id; });
            if (p) {
                syncSeoForProduct(p);
                return;
            }
        }
        const categorySlug = (params.get('category') || '').trim().toLowerCase();
        if (categorySlug && typeof getActiveCategories === 'function') {
            const match = getActiveCategories().find(function(c) {
                const slug = (c.slug || (typeof slugifyCategoryName === 'function' ? slugifyCategoryName(c.name) : '')).toLowerCase();
                return slug === categorySlug;
            });
            if (match) {
                const s = window.seoSettings || DEFAULT_SEO;
                const url = getSiteOrigin() + '/?category=' + encodeURIComponent(categorySlug);
                applySeoBundle({
                    title: (match.name || 'Category') + ' — Shop Online | ' + s.siteName,
                    description: 'Browse ' + (match.name || 'fashion') + ' at ' + s.siteName + '. Premium quality with COD, UPI & fast delivery across India.',
                    canonical: url,
                    type: 'website',
                    jsonLd: {
                        '@context': 'https://schema.org',
                        '@graph': [
                            buildOrganizationSchema(),
                            buildBreadcrumbSchema([
                                { name: 'Home', url: getSiteOrigin() + '/' },
                                { name: match.name, url: url }
                            ])
                        ]
                    }
                });
                return;
            }
        }
        const searchQ = (params.get('q') || '').trim();
        if (searchQ) {
            const s = window.seoSettings || DEFAULT_SEO;
            const url = getSiteOrigin() + '/?q=' + encodeURIComponent(searchQ);
            applySeoBundle({
                title: 'Search: ' + searchQ + ' — ' + s.siteName,
                description: 'Find ' + searchQ + ' and more premium fashion at ' + s.siteName + '.',
                canonical: url,
                type: 'website',
                jsonLd: { '@context': 'https://schema.org', '@graph': [buildOrganizationSchema(), buildWebsiteSchema()] }
            });
            return;
        }
        const active = document.querySelector('.section.active');
        const viewId = active && active.id ? active.id.replace('-view', '') : 'home';
        syncSeoForView(viewId);
    };

    window.refreshSeoProductIndex = function(products) {
        const root = document.getElementById('seo-crawl-links');
        if (!root) return;
        const list = (products || []).filter(function(p) {
            return p && p.id && p.name && (typeof isProductOutOfStock !== 'function' || !isProductOutOfStock(p));
        }).slice(0, 120);
        if (!list.length) {
            root.innerHTML = '';
            return;
        }
        root.innerHTML = '<h2 class="seo-crawl-links__title">Shop fashion at Swag Stree</h2><ul>' +
            list.map(function(p) {
                return '<li><a href="/?id=' + encodeURIComponent(p.id) + '">' + escMeta(p.name) + ' — ₹' + (Number(p.price) || 0) + '</a></li>';
            }).join('') +
            '</ul>';
    };

    window.loadSeoSettings = function() {
        if (typeof db === 'undefined' || !db) return Promise.resolve();
        return db.collection('settings').doc('seo').get().then(function(doc) {
            if (!doc.exists) return;
            const data = doc.data() || {};
            window.seoSettings = Object.assign({}, DEFAULT_SEO, data);
            syncSeoFromUrl();
        }).catch(function() {});
    };

    window.loadAdminSeoSettings = async function() {
        try {
            const snap = await db.collection('settings').doc('seo').get();
            const s = snap.exists ? Object.assign({}, DEFAULT_SEO, snap.data()) : Object.assign({}, DEFAULT_SEO);
            const fields = {
                'admin-seo-title': s.title,
                'admin-seo-description': s.description,
                'admin-seo-keywords': s.keywords,
                'admin-seo-site-name': s.siteName,
                'admin-seo-brand': s.brand,
                'admin-seo-twitter': s.twitterHandle,
                'admin-seo-instagram': s.instagram,
                'admin-seo-phone': s.phone,
                'admin-seo-email': s.email
            };
            Object.keys(fields).forEach(function(id) {
                const el = document.getElementById(id);
                if (el) el.value = fields[id] || '';
            });
        } catch (e) {
            if (typeof showToast === 'function') showToast('Failed to load SEO settings');
        }
    };

    window.saveAdminSeoSettings = async function() {
        const payload = {
            title: (document.getElementById('admin-seo-title') || {}).value || DEFAULT_SEO.title,
            description: (document.getElementById('admin-seo-description') || {}).value || DEFAULT_SEO.description,
            keywords: (document.getElementById('admin-seo-keywords') || {}).value || DEFAULT_SEO.keywords,
            siteName: (document.getElementById('admin-seo-site-name') || {}).value || DEFAULT_SEO.siteName,
            brand: (document.getElementById('admin-seo-brand') || {}).value || DEFAULT_SEO.brand,
            twitterHandle: (document.getElementById('admin-seo-twitter') || {}).value || DEFAULT_SEO.twitterHandle,
            instagram: (document.getElementById('admin-seo-instagram') || {}).value || DEFAULT_SEO.instagram,
            phone: (document.getElementById('admin-seo-phone') || {}).value || DEFAULT_SEO.phone,
            email: (document.getElementById('admin-seo-email') || {}).value || DEFAULT_SEO.email,
            updatedAt: typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore.FieldValue.serverTimestamp() : new Date()
        };
        try {
            await db.collection('settings').doc('seo').set(payload, { merge: true });
            window.seoSettings = Object.assign({}, DEFAULT_SEO, payload);
            syncSeoFromUrl();
            if (typeof showToast === 'function') showToast('SEO settings saved');
        } catch (e) {
            if (typeof showToast === 'function') showToast('Failed to save SEO settings');
        }
    };

    window.toggleAdminSeoAccordion = function() {
        const content = document.getElementById('admin-seo-accordion-content');
        const icon = document.getElementById('admin-seo-accordion-icon');
        if (!content) return;
        const open = content.style.display === 'none' || !content.style.display;
        content.style.display = open ? 'flex' : 'none';
        if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
        if (open && typeof loadAdminSeoSettings === 'function') loadAdminSeoSettings();
    };

    document.addEventListener('DOMContentLoaded', function() {
        syncSeoForView('home');
        if (typeof db !== 'undefined' && db) loadSeoSettings();
    });

    window.addEventListener('popstate', function() {
        if (typeof syncSeoFromUrl === 'function') syncSeoFromUrl();
    });
})();
