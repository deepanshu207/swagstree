// ==========================================
// SWAG STREE | SEO & INDEXING
// ==========================================

(function() {
    const DEFAULT_SEO = {
        siteName: 'Swag Stree',
        brand: 'Swag Stree',
        title: 'Swag Stree — Premium Fashion & Trendsetting Apparel Online | COD & UPI India',
        description: 'Shop premium fashion at Swag Stree — India\'s trendsetting online boutique for kurtas, coord sets, sarees, ethnic & streetwear. COD, UPI, Paytm, fast pan-India delivery & easy returns.',
        keywords: [
            'Swag Stree', 'Swagstree', 'swag stree fashion', 'swagstree.com', 'swag stree online shop',
            'buy clothes online India', 'online fashion store India', 'women fashion online India',
            'men fashion online India', 'premium kurtas online', 'designer coord sets', 'sarees online shopping',
            'ethnic wear India', 'western wear online', 'streetwear India', 'party wear dresses online',
            'casual outfits India', 'trendy apparel India', 'affordable premium fashion India',
            'COD clothes shopping', 'cash on delivery fashion', 'UPI fashion store', 'Paytm shopping clothes',
            'Google Pay fashion', 'free shipping fashion India', 'fast delivery clothes India',
            'Delhi fashion online', 'Mumbai fashion store', 'Bangalore online boutique', 'India fashion e-commerce',
            'kurta set online', 'anarkali suits online', 'co-ord set women', 'office wear women India',
            'wedding guest outfits', 'festive collection India', 'summer fashion collection', 'winter wear online',
            'cotton kurtas online', 'linen outfits India', 'plus size fashion India', 'instagram fashion brand India',
            'best online clothing store India', 'shop swag stree', 'swag stree new arrivals', 'swag stree sale',
            'ladies wear online', 'girls fashion India', 'boutique clothing online', 'designer wear India',
            'Indian fashion brand', 'modest fashion India', 'daily wear kurtas', 'indo western dresses'
        ].join(', '),
        extraKeywords: [
            'swag stree reviews', 'swag stree delivery', 'swag stree contact', 'swag stree whatsapp order',
            'order tracking swag stree', 'fashion with COD India', 'UPI checkout fashion', 'ethnic boutique online',
            'coord set with dupatta', 'printed kurtas', 'embroidered sarees', 'party coord sets',
            'minimalist fashion India', 'aesthetic outfits India', 'OOTD India fashion', 'style inspiration India'
        ].join(', '),
        locale: 'en_IN',
        twitterHandle: '@swag_stree',
        instagram: 'https://instagram.com/swag_stree',
        phone: '+918800467686',
        email: 'support@swagstree.com',
        priceCurrency: 'INR',
        country: 'IN',
        areaServed: 'IN',
        googleSiteVerification: '',
        bingSiteVerification: '',
        canonicalDomain: 'swagstree.com',
        facebookAppId: '',
        pinterestDomainVerify: ''
    };

    const DEFAULT_FAQ = [
        { q: 'Does Swag Stree offer Cash on Delivery (COD)?', a: 'Yes. Swag Stree supports COD across India along with UPI, Paytm, and Google Pay for prepaid orders.' },
        { q: 'How fast is delivery at Swag Stree?', a: 'Orders are dispatched quickly with pan-India shipping. Tracking is shared once your order is shipped.' },
        { q: 'Can I return or exchange items?', a: 'Swag Stree offers customer-friendly returns and exchanges as per store policy shown at checkout.' },
        { q: 'How do I track my Swag Stree order?', a: 'Sign in with your account email or phone to view order status, tracking, and delivery updates in My Orders.' },
        { q: 'Can I add delivery instructions?', a: 'Yes. Add a delivery note at checkout and edit it from My Orders until your order ships.' },
        { q: 'What payment methods does Swag Stree accept?', a: 'Cash on Delivery (COD), UPI, Paytm, Google Pay and other popular Indian prepaid options at checkout.' },
        { q: 'Does Swag Stree ship across India?', a: 'Yes. Swag Stree delivers premium fashion nationwide with reliable courier partners.' },
        { q: 'How do I contact Swag Stree support?', a: 'WhatsApp +91 8800467686, email support@swagstree.com, or Instagram @swag_stree.' },
        { q: 'Are Swag Stree product reviews genuine?', a: 'Yes. Public reviews are from verified purchases and moderated before appearing on product pages.' },
        { q: 'How do I find kurtas, coord sets or sarees on Swag Stree?', a: 'Browse categories on the homepage, use search, or open category links like /?category=kurtas from our sitemap.' }
    ];

    window.SEO_DEFAULTS = DEFAULT_SEO;
    window.seoSettings = Object.assign({}, DEFAULT_SEO);

    function getSiteOrigin() {
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
            return String(window.location.origin).replace(/\/$/, '');
        }
        return 'https://swagstree.com';
    }
    window.getSiteOrigin = getSiteOrigin;

    function getCanonicalOrigin() {
        const s = window.seoSettings || DEFAULT_SEO;
        if (s.canonicalDomain) {
            return 'https://' + String(s.canonicalDomain).replace(/^https?:\/\//, '').replace(/\/$/, '');
        }
        return getSiteOrigin();
    }
    window.getCanonicalOrigin = getCanonicalOrigin;

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
        if (!pathOrUrl) return getCanonicalOrigin() + '/';
        if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
        const path = pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl;
        return getCanonicalOrigin() + path;
    }

    function productUrl(productId) {
        return getCanonicalOrigin() + '/?id=' + encodeURIComponent(productId);
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
        const category = product && typeof resolveProductCategoryLabel === 'function'
            ? resolveProductCategoryLabel(product) : (product && product.categoryName) || '';
        const catPart = category ? ' — ' + category : '';
        return truncate('Buy ' + name + catPart + (price ? ' at ' + price : '') + ' on Swag Stree. Premium fashion with COD, UPI & fast India delivery.', 160);
    }

    function mergeKeywords() {
        const s = window.seoSettings || DEFAULT_SEO;
        const parts = [s.keywords, s.extraKeywords, s.brand, s.siteName, 'India fashion', 'COD', 'UPI'].filter(Boolean);
        return [...new Set(parts.join(',').split(',').map(function(k) { return k.trim(); }).filter(Boolean))].join(', ');
    }

    function buildProductKeywords(product) {
        const s = window.seoSettings || DEFAULT_SEO;
        const base = mergeKeywords();
        if (!product) return base;
        const bits = [product.name, s.brand, s.siteName];
        if (typeof resolveProductCategoryLabel === 'function') {
            const cat = resolveProductCategoryLabel(product);
            if (cat) bits.push(cat, 'buy ' + cat + ' online India');
        } else if (product.categoryName) {
            bits.push(product.categoryName);
        }
        if (product.price != null) bits.push('₹' + product.price, 'price in India');
        (product.colors || []).slice(0, 4).forEach(function(c) { bits.push(String(c)); });
        (product.patterns || []).slice(0, 2).forEach(function(p) { bits.push(String(p)); });
        bits.push('COD', 'UPI', 'online shopping India', 'Swag Stree');
        return [...new Set(bits.concat(base.split(',').map(function(k) { return k.trim(); })).filter(Boolean))].join(', ');
    }

    function buildCategoryKeywords(category) {
        const s = window.seoSettings || DEFAULT_SEO;
        const name = category && category.name ? category.name : 'Fashion';
        const slug = category && category.slug ? category.slug : name.toLowerCase();
        const bits = [
            name, slug, s.brand, s.siteName,
            'buy ' + name + ' online India',
            name + ' collection India',
            name + ' COD shopping',
            name + ' UPI payment',
            'premium ' + name + ' India',
            'Swag Stree ' + name
        ];
        return [...new Set(bits.concat(mergeKeywords().split(',').map(function(k) { return k.trim(); })).filter(Boolean))].join(', ');
    }

    function collectProductImages(product) {
        if (!product) return [absoluteUrl('/assets/logo.png')];
        const imgs = [];
        (product.images || []).forEach(function(img) { if (img) imgs.push(absoluteUrl(img)); });
        (product.normalizedVariants || []).forEach(function(v) {
            if (v && v.image) imgs.push(absoluteUrl(v.image));
        });
        if (product.image) imgs.push(absoluteUrl(product.image));
        const unique = [...new Set(imgs)];
        return unique.length ? unique.slice(0, 8) : [absoluteUrl('/assets/logo.png')];
    }

    function getProductReviewStatsForSeo(productId) {
        const cache = window.productCommentsCache || [];
        const approved = cache.filter(function(c) {
            return c && c.productId === productId && c.rating && c.status === 'approved' && c.verifiedPurchase !== false;
        });
        if (!approved.length) return null;
        const avg = approved.reduce(function(s, c) { return s + (Number(c.rating) || 0); }, 0) / approved.length;
        return {
            ratingValue: Math.round(avg * 10) / 10,
            reviewCount: approved.length,
            bestRating: 5,
            worstRating: 1
        };
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

    function ensureLinkHreflang(hreflang, href) {
        let el = document.querySelector('link[hreflang="' + hreflang + '"]');
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', 'alternate');
            el.setAttribute('hreflang', hreflang);
            document.head.appendChild(el);
        }
        if (href) el.setAttribute('href', href);
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
            alternateName: ['Swagstree', 'Swag Stree Fashion', 'swagstree.com'],
            url: getCanonicalOrigin() + '/',
            logo: absoluteUrl('/assets/logo.png'),
            email: s.email,
            telephone: s.phone,
            areaServed: { '@type': 'Country', name: 'India' },
            knowsAbout: ['Fashion', 'Clothing', 'Ethnic Wear', 'Streetwear', 'Online Shopping', 'Cash on Delivery'],
            sameAs: [s.instagram, 'https://wa.me/918800467686', 'https://www.facebook.com/share/1CRwnQckvY/'].filter(Boolean)
        };
    }

    function buildWebsiteSchema() {
        const s = window.seoSettings || DEFAULT_SEO;
        return {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: s.siteName,
            url: getCanonicalOrigin() + '/',
            inLanguage: s.locale || 'en-IN',
            potentialAction: {
                '@type': 'SearchAction',
                target: {
                    '@type': 'EntryPoint',
                    urlTemplate: getCanonicalOrigin() + '/?q={search_term_string}'
                },
                'query-input': 'required name=search_term_string'
            }
        };
    }

    function buildOnlineStoreSchema() {
        const s = window.seoSettings || DEFAULT_SEO;
        return {
            '@context': 'https://schema.org',
            '@type': 'OnlineStore',
            name: s.siteName,
            url: getCanonicalOrigin() + '/',
            image: absoluteUrl('/assets/logo.png'),
            telephone: s.phone,
            email: s.email,
            currenciesAccepted: 'INR',
            paymentAccepted: 'Cash, Credit Card, UPI, Paytm, Google Pay',
            areaServed: { '@type': 'Country', name: 'India' },
            hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: 'Swag Stree Fashion Catalog',
                itemListElement: (window.products || []).slice(0, 12).map(function(p, i) {
                    return {
                        '@type': 'OfferCatalog',
                        position: i + 1,
                        itemOffered: {
                            '@type': 'Product',
                            name: p.name,
                            url: productUrl(p.id)
                        }
                    };
                })
            }
        };
    }

    function buildSiteNavigationSchema() {
        const links = [{ name: 'Home', url: getCanonicalOrigin() + '/' }];
        if (typeof getActiveCategories === 'function') {
            getActiveCategories().slice(0, 12).forEach(function(c) {
                const slug = c.slug || (typeof slugifyCategoryName === 'function' ? slugifyCategoryName(c.name) : c.name);
                links.push({ name: c.name, url: getCanonicalOrigin() + '/?category=' + encodeURIComponent(slug) });
            });
        }
        return {
            '@context': 'https://schema.org',
            '@type': 'SiteNavigationElement',
            name: 'Swag Stree Store Navigation',
            hasPart: links.map(function(l) {
                return { '@type': 'WebPage', name: l.name, url: l.url };
            })
        };
    }

    function getProductVideoUrl(product) {
        if (!product) return null;
        const fromList = Array.isArray(product.videos) && product.videos.length
            ? (typeof product.videos[0] === 'string' ? product.videos[0] : product.videos[0].url)
            : null;
        if (fromList) return absoluteUrl(fromList);
        const variant = (product.normalizedVariants || []).find(function(v) {
            return v && Array.isArray(v.videos) && v.videos.length;
        });
        if (variant && variant.videos[0]) {
            const v = variant.videos[0];
            return absoluteUrl(typeof v === 'string' ? v : v.url);
        }
        return null;
    }

    function buildFaqSchema() {
        const s = window.seoSettings || DEFAULT_SEO;
        const faqs = (s.faq && Array.isArray(s.faq) && s.faq.length) ? s.faq : DEFAULT_FAQ;
        return {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map(function(item) {
                return {
                    '@type': 'Question',
                    name: item.q,
                    acceptedAnswer: { '@type': 'Answer', text: item.a }
                };
            })
        };
    }

    function buildProductSchema(product) {
        if (!product) return null;
        const s = window.seoSettings || DEFAULT_SEO;
        const inStock = typeof isProductOutOfStock === 'function' ? !isProductOutOfStock(product) : true;
        const images = collectProductImages(product);
        const schema = {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name || 'Product',
            description: productDescription(product),
            image: images,
            sku: product.id,
            mpn: product.id,
            url: productUrl(product.id),
            brand: { '@type': 'Brand', name: s.brand || s.siteName },
            offers: {
                '@type': 'Offer',
                url: productUrl(product.id),
                priceCurrency: s.priceCurrency || 'INR',
                price: Number(product.price) || 0,
                availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                itemCondition: 'https://schema.org/NewCondition',
                seller: { '@type': 'Organization', name: s.siteName },
                shippingDetails: {
                    '@type': 'OfferShippingDetails',
                    shippingDestination: { '@type': 'DefinedRegion', addressCountry: s.country || 'IN' }
                }
            }
        };
        const categoryLabel = product.categoryName || (typeof resolveProductCategoryLabel === 'function' ? resolveProductCategoryLabel(product) : '');
        if (categoryLabel) schema.category = categoryLabel;
        const colors = (product.colors || []).slice(0, 6);
        if (colors.length === 1) schema.color = colors[0];
        else if (colors.length > 1) schema.color = colors;
        const stats = getProductReviewStatsForSeo(product.id);
        if (stats && stats.reviewCount > 0) {
            schema.aggregateRating = {
                '@type': 'AggregateRating',
                ratingValue: stats.ratingValue,
                reviewCount: stats.reviewCount,
                bestRating: stats.bestRating,
                worstRating: stats.worstRating
            };
        }
        const videoUrl = getProductVideoUrl(product);
        if (videoUrl) {
            schema.subjectOf = {
                '@type': 'VideoObject',
                name: (product.name || 'Product') + ' video — ' + (window.seoSettings || DEFAULT_SEO).siteName,
                contentUrl: videoUrl,
                thumbnailUrl: images[0]
            };
        }
        return schema;
    }

    function buildLocalBusinessSchema() {
        const s = window.seoSettings || DEFAULT_SEO;
        return {
            '@context': 'https://schema.org',
            '@type': 'ClothingStore',
            name: s.siteName,
            url: getCanonicalOrigin() + '/',
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

    function buildCollectionPageSchema(category, products) {
        const s = window.seoSettings || DEFAULT_SEO;
        const slug = category.slug || (typeof slugifyCategoryName === 'function' ? slugifyCategoryName(category.name) : category.name);
        const url = getCanonicalOrigin() + '/?category=' + encodeURIComponent(slug);
        const list = (products || []).slice(0, 30);
        return {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: (category.name || 'Collection') + ' — ' + s.siteName,
            description: 'Shop ' + (category.name || 'fashion') + ' at ' + s.siteName + '. COD, UPI & fast delivery across India.',
            url: url,
            isPartOf: { '@type': 'WebSite', name: s.siteName, url: getCanonicalOrigin() + '/' },
            mainEntity: {
                '@type': 'ItemList',
                numberOfItems: list.length,
                itemListElement: list.map(function(p, i) {
                    return {
                        '@type': 'ListItem',
                        position: i + 1,
                        url: productUrl(p.id),
                        name: p.name
                    };
                })
            }
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
        const canonical = bundle.canonical || getCanonicalOrigin() + '/';
        const image = bundle.image || absoluteUrl('/assets/logo.png');
        const type = bundle.type || 'website';
        const keywords = bundle.keywords || mergeKeywords();

        document.title = title;
        ensureMetaByName('description', description);
        ensureMetaByName('keywords', keywords);
        ensureMetaByName('news_keywords', keywords);
        ensureMetaByName('subject', bundle.subject || s.brand);
        ensureMetaByName('classification', bundle.classification || 'Shopping, Fashion, Apparel, E-commerce');
        ensureMetaByName('author', s.brand);
        ensureMetaByName('publisher', s.siteName);
        ensureMetaByName('copyright', '© ' + new Date().getFullYear() + ' ' + s.siteName);
        ensureMetaByName('application-name', s.siteName);
        ensureMetaByName('rating', 'general');
        ensureMetaByName('referrer', 'origin-when-cross-origin');
        ensureMetaByName('geo.region', s.country || 'IN');
        ensureMetaByName('geo.placename', 'India');
        ensureMetaByName('content-language', (s.locale || 'en_IN').replace('_', '-'));
        ensureMetaByName('target', 'all');
        ensureMetaByName('audience', 'all');
        ensureMetaByName('coverage', 'India');
        ensureMetaByName('distribution', 'global');
        ensureMetaByName('pagename', title);
        if (s.googleSiteVerification) ensureMetaByName('google-site-verification', s.googleSiteVerification);
        if (s.bingSiteVerification) ensureMetaByName('msvalidate.01', s.bingSiteVerification);
        ensureLinkRel('canonical', canonical);
        ensureLinkHreflang('en-in', canonical);
        ensureLinkHreflang('x-default', canonical);
        ensureLinkRel('search', getCanonicalOrigin() + '/opensearch.xml', { type: 'application/opensearchdescription+xml', id: 'seo-opensearch' });
        ensureLinkRel('alternate', getCanonicalOrigin() + '/feed.xml', { type: 'application/rss+xml', id: 'seo-rss' });
        ensureLinkRel('alternate', getCanonicalOrigin() + '/catalog.json', { type: 'application/ld+json', id: 'seo-catalog' });

        ensureMetaByProperty('og:site_name', s.siteName);
        ensureMetaByProperty('og:title', title);
        ensureMetaByProperty('og:description', description);
        ensureMetaByProperty('og:type', type);
        ensureMetaByProperty('og:url', canonical);
        ensureMetaByProperty('og:image', image);
        ensureMetaByProperty('og:image:secure_url', image);
        ensureMetaByProperty('og:image:alt', bundle.imageAlt || title);
        ensureMetaByProperty('og:image:width', '512');
        ensureMetaByProperty('og:image:height', '512');
        ensureMetaByProperty('og:locale', (s.locale || 'en_IN').replace('_', '-'));
        ensureMetaByProperty('og:locale:alternate', 'en_US');
        if (type === 'product' && bundle.price != null) {
            ensureMetaByProperty('product:price:amount', String(bundle.price));
            ensureMetaByProperty('product:price:currency', s.priceCurrency || 'INR');
            ensureMetaByProperty('product:availability', bundle.inStock === false ? 'out of stock' : 'in stock');
            ensureMetaByProperty('product:brand', s.brand || s.siteName);
            ensureMetaByProperty('product:condition', 'new');
        }

        ensureMetaByName('twitter:card', 'summary_large_image');
        ensureMetaByName('twitter:title', title);
        ensureMetaByName('twitter:description', description);
        ensureMetaByName('twitter:image', image);
        ensureMetaByName('twitter:image:alt', bundle.imageAlt || title);
        if (s.twitterHandle) {
            ensureMetaByName('twitter:site', s.twitterHandle);
            ensureMetaByName('twitter:creator', s.twitterHandle);
        }
        if (s.facebookAppId) ensureMetaByProperty('fb:app_id', s.facebookAppId);
        if (s.pinterestDomainVerify) ensureMetaByName('p:domain_verify', s.pinterestDomainVerify);

        setRobotsIndexable(bundle.indexable !== false);
        ensureMetaByName('bingbot', bundle.indexable !== false ? 'index, follow' : 'noindex, nofollow');
        ensureMetaByName('slurp', bundle.indexable !== false ? 'index, follow' : 'noindex, nofollow');
        ensureMetaByName('duckduckbot', bundle.indexable !== false ? 'index, follow' : 'noindex, nofollow');

        if (bundle.jsonLd) setJsonLd(bundle.jsonLd);
    }

    window.syncSeoForView = function(viewId) {
        const s = window.seoSettings || DEFAULT_SEO;
        const privateViews = { admin: true, super: true, promo: true };
        if (privateViews[viewId]) {
            applySeoBundle({
                title: s.siteName + ' — Admin',
                description: 'Private admin area.',
                canonical: getCanonicalOrigin() + '/',
                indexable: false,
                jsonLd: { '@context': 'https://schema.org', '@graph': [buildOrganizationSchema()] }
            });
            return;
        }

        if (viewId === 'wish') {
            applySeoBundle({
                title: 'Wishlist — ' + s.siteName,
                description: 'Your saved fashion picks at ' + s.siteName + '.',
                canonical: getCanonicalOrigin() + '/',
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
                canonical: getCanonicalOrigin() + '/',
                indexable: false,
                jsonLd: { '@context': 'https://schema.org', '@graph': [buildOrganizationSchema()] }
            });
            return;
        }

        const itemList = buildItemListSchema(window.products || []);
        const faqSchema = buildFaqSchema();
        applySeoBundle({
            title: s.title,
            description: s.description,
            keywords: mergeKeywords(),
            subject: 'Premium fashion shopping India',
            classification: 'Fashion, Clothing, E-commerce, Online Shopping, India',
            canonical: getCanonicalOrigin() + '/',
            image: absoluteUrl('/assets/logo.png'),
            imageAlt: s.siteName + ' — Premium fashion online India',
            type: 'website',
            jsonLd: {
                '@context': 'https://schema.org',
                '@graph': [
                    buildOrganizationSchema(),
                    buildWebsiteSchema(),
                    buildLocalBusinessSchema(),
                    buildOnlineStoreSchema(),
                    buildSiteNavigationSchema(),
                    faqSchema
                ].concat(itemList ? [itemList] : [])
            }
        });
        refreshSeoProductIndex(window.products || []);
        refreshSeoCategoryIndex();
    };

    window.syncSeoForProduct = function(product) {
        if (!product || !product.id) {
            syncSeoForView('home');
            return;
        }
        const s = window.seoSettings || DEFAULT_SEO;
        const title = (product.name || 'Product') + ' — Buy Online at ₹' + (Number(product.price) || 0) + ' | ' + s.siteName;
        const description = productDescription(product);
        const url = productUrl(product.id);
        const image = productImage(product);
        const inStock = typeof isProductOutOfStock === 'function' ? !isProductOutOfStock(product) : true;
        const categoryLabel = typeof resolveProductCategoryLabel === 'function'
            ? resolveProductCategoryLabel(product) : (product.categoryName || '');
        const breadcrumbs = buildBreadcrumbSchema([
            { name: 'Home', url: getCanonicalOrigin() + '/' }
        ].concat(categoryLabel ? [{ name: categoryLabel, url: getCanonicalOrigin() + '/?q=' + encodeURIComponent(categoryLabel) }] : []).concat([
            { name: product.name, url: url }
        ]));
        const productSchema = buildProductSchema(product);
        const graph = [buildOrganizationSchema(), breadcrumbs];
        if (productSchema) graph.push(productSchema);

        applySeoBundle({
            title: title,
            description: description,
            keywords: buildProductKeywords(product),
            subject: product.name + ' — ' + s.brand,
            classification: [categoryLabel, 'Fashion', 'Shopping', 'India'].filter(Boolean).join(', '),
            canonical: url,
            image: image,
            imageAlt: (product.name || 'Product') + ' — ' + s.siteName,
            type: 'product',
            price: Number(product.price) || 0,
            inStock: inStock,
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
                const slug = categorySlug;
                const url = getCanonicalOrigin() + '/?category=' + encodeURIComponent(slug);
                const catProducts = (window.products || []).filter(function(p) {
                    if (typeof productMatchesCategoryFilters === 'function') {
                        return productMatchesCategoryFilters(p, [match.id]);
                    }
                    return (p.categoryId || '') === match.id;
                });
                applySeoBundle({
                    title: (match.name || 'Category') + ' — Shop Online India | ' + s.siteName,
                    description: 'Browse premium ' + (match.name || 'fashion') + ' at ' + s.siteName + '. ' + catProducts.length + '+ styles with COD, UPI, Paytm & fast pan-India delivery.',
                    keywords: buildCategoryKeywords(match),
                    subject: match.name + ' fashion collection India',
                    classification: match.name + ', Fashion, Shopping, India',
                    canonical: url,
                    image: absoluteUrl('/assets/logo.png'),
                    type: 'website',
                    jsonLd: {
                        '@context': 'https://schema.org',
                        '@graph': [
                            buildOrganizationSchema(),
                            buildBreadcrumbSchema([
                                { name: 'Home', url: getCanonicalOrigin() + '/' },
                                { name: match.name, url: url }
                            ]),
                            buildCollectionPageSchema(match, catProducts)
                        ]
                    }
                });
                return;
            }
        }
        const searchQ = (params.get('q') || '').trim();
        if (searchQ) {
            const s = window.seoSettings || DEFAULT_SEO;
            const url = getCanonicalOrigin() + '/?q=' + encodeURIComponent(searchQ);
            const results = (window.products || []).filter(function(p) {
                const cat = typeof resolveProductCategoryLabel === 'function' ? resolveProductCategoryLabel(p) : '';
                const hay = [p.name, p.description, cat].filter(Boolean).join(' ').toLowerCase();
                return hay.includes(searchQ.toLowerCase());
            });
            applySeoBundle({
                title: searchQ + ' — Fashion Search Results | ' + s.siteName,
                description: 'Shop ' + searchQ + ' and ' + results.length + ' matching styles at ' + s.siteName + '. Premium fashion with COD, UPI & India-wide delivery.',
                keywords: [searchQ, searchQ + ' online India', searchQ + ' COD', s.brand, mergeKeywords()].join(', '),
                subject: searchQ + ' fashion search',
                canonical: url,
                type: 'website',
                jsonLd: {
                    '@context': 'https://schema.org',
                    '@graph': [
                        buildOrganizationSchema(),
                        buildWebsiteSchema(),
                        {
                            '@context': 'https://schema.org',
                            '@type': 'SearchResultsPage',
                            name: 'Search: ' + searchQ,
                            url: url,
                            mainEntity: buildItemListSchema(results)
                        }
                    ].filter(Boolean)
                }
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
        }).slice(0, 150);
        if (!list.length) {
            root.innerHTML = '';
            return;
        }
        const categoryBits = typeof getActiveCategories === 'function'
            ? getActiveCategories().slice(0, 20).map(function(c) {
                const slug = c.slug || (typeof slugifyCategoryName === 'function' ? slugifyCategoryName(c.name) : c.name);
                return '<li><a href="/?category=' + encodeURIComponent(slug) + '">' + escMeta(c.name) + ' collection</a></li>';
            }).join('')
            : '';
        root.innerHTML =
            '<h2 class="seo-crawl-links__title">Shop premium fashion at Swag Stree — India online boutique</h2>' +
            (categoryBits ? '<h3 class="seo-crawl-links__subtitle">Categories</h3><ul class="seo-crawl-links__categories">' + categoryBits + '</ul>' : '') +
            '<h3 class="seo-crawl-links__subtitle">Products</h3><ul class="seo-crawl-links__products">' +
            list.map(function(p) {
                const cat = typeof resolveProductCategoryLabel === 'function' ? resolveProductCategoryLabel(p) : '';
                return '<li><a href="/?id=' + encodeURIComponent(p.id) + '" title="' + escMeta(p.name) + '">' +
                    escMeta(p.name) + (cat ? ' — ' + escMeta(cat) : '') + ' — ₹' + (Number(p.price) || 0) + '</a></li>';
            }).join('') +
            '</ul>';
    };

    window.refreshSeoCategoryIndex = function() {
        const nav = document.getElementById('seo-primary-nav');
        if (!nav || typeof getActiveCategories !== 'function') return;
        const cats = getActiveCategories().slice(0, 24);
        const catLinks = cats.map(function(c) {
            const slug = c.slug || (typeof slugifyCategoryName === 'function' ? slugifyCategoryName(c.name) : c.name);
            return '<a href="/?category=' + encodeURIComponent(slug) + '">' + escMeta(c.name) + '</a>';
        }).join('');
        const staticLinks = '<a href="/">Swag Stree Home</a><a href="/?q=kurtas">Kurtas</a><a href="/?q=coord+sets">Coord Sets</a><a href="/?q=sarees">Sarees</a>';
        nav.innerHTML = staticLinks + catLinks +
            '<a href="https://instagram.com/swag_stree" rel="noopener noreferrer">Instagram</a>' +
            '<a href="https://wa.me/918800467686" rel="noopener noreferrer">WhatsApp Support</a>';
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
                'admin-seo-extra-keywords': s.extraKeywords,
                'admin-seo-site-name': s.siteName,
                'admin-seo-brand': s.brand,
                'admin-seo-twitter': s.twitterHandle,
                'admin-seo-instagram': s.instagram,
                'admin-seo-phone': s.phone,
                'admin-seo-email': s.email,
                'admin-seo-google-verify': s.googleSiteVerification,
                'admin-seo-bing-verify': s.bingSiteVerification,
                'admin-seo-canonical-domain': s.canonicalDomain,
                'admin-seo-facebook-app': s.facebookAppId,
                'admin-seo-pinterest-verify': s.pinterestDomainVerify
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
            extraKeywords: (document.getElementById('admin-seo-extra-keywords') || {}).value || DEFAULT_SEO.extraKeywords,
            siteName: (document.getElementById('admin-seo-site-name') || {}).value || DEFAULT_SEO.siteName,
            brand: (document.getElementById('admin-seo-brand') || {}).value || DEFAULT_SEO.brand,
            twitterHandle: (document.getElementById('admin-seo-twitter') || {}).value || DEFAULT_SEO.twitterHandle,
            instagram: (document.getElementById('admin-seo-instagram') || {}).value || DEFAULT_SEO.instagram,
            phone: (document.getElementById('admin-seo-phone') || {}).value || DEFAULT_SEO.phone,
            email: (document.getElementById('admin-seo-email') || {}).value || DEFAULT_SEO.email,
            googleSiteVerification: (document.getElementById('admin-seo-google-verify') || {}).value || '',
            bingSiteVerification: (document.getElementById('admin-seo-bing-verify') || {}).value || '',
            canonicalDomain: (document.getElementById('admin-seo-canonical-domain') || {}).value || DEFAULT_SEO.canonicalDomain,
            facebookAppId: (document.getElementById('admin-seo-facebook-app') || {}).value || '',
            pinterestDomainVerify: (document.getElementById('admin-seo-pinterest-verify') || {}).value || '',
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
