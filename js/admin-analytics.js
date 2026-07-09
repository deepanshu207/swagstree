// ==========================================
// SWAG STREE | ADMIN ANALYTICS DASHBOARD
// ==========================================

Object.assign(window.ADMIN_CAPABILITY_DEFS || {}, {
    viewAnalytics: {
        id: 'viewAnalytics',
        label: 'View Store Analytics',
        icon: 'fa-line-chart',
        description: 'Revenue, visits, funnel, customers, and product performance insights'
    }
});

window.adminAnalyticsState = window.adminAnalyticsState || {
    periodDays: 30,
    tab: 'overview',
    customerSegment: 'all',
    customerSort: 'ltv',
    loaded: false,
    loading: false,
    orders: [],
    users: [],
    storeAnalytics: null,
    supportThreads: 0,
    reviewCount: 0,
    pendingReviews: 0,
    wishlistUsers: 0,
    wishlistItems: 0,
    feedbackCount: 0,
    announcementCount: 0,
    supportEscalations: 0,
    supportWaiting: 0,
    productNameMap: {},
    categoryNameMap: {}
};

const ADMIN_ANALYTICS_EXCLUDED = new Set(['cancelled', 'returned']);
const ADMIN_ANALYTICS_DELIVERED = new Set(['delivered']);
const ADMIN_ANALYTICS_FUNNEL_STEPS = [
    { key: 'visits', label: 'Store visits', event: null },
    { key: 'productViews', label: 'Product views', event: 'product_view' },
    { key: 'add_to_cart', label: 'Add to cart', event: 'add_to_cart' },
    { key: 'view_cart', label: 'View cart', event: 'view_cart' },
    { key: 'begin_checkout', label: 'Begin checkout', event: 'begin_checkout' },
    { key: 'order_placed', label: 'Orders placed', event: 'order_placed' }
];

function analyticsTsToMs(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    return 0;
}

function analyticsFormatCurrency(n) {
    return '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function analyticsFormatShortDate(ms) {
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function analyticsFormatRelative(ms) {
    if (!ms) return 'Never';
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return analyticsFormatShortDate(ms);
}

function analyticsPeriodStartMs(days) {
    if (!days || days <= 0) return 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (days === 1) return d.getTime();
    d.setDate(d.getDate() - (days - 1));
    return d.getTime();
}

function analyticsComparisonRange(periodDays) {
    const startMs = analyticsPeriodStartMs(periodDays);
    if (!periodDays || periodDays <= 0) return { startMs: 0, prevStartMs: 0, prevEndMs: 0 };
    const span = Date.now() - startMs + 86400000;
    const prevEndMs = startMs - 1;
    const prevStartMs = startMs - span;
    return { startMs, prevStartMs, prevEndMs };
}

function analyticsInRange(ts, startMs, endMs) {
    if (!ts) return false;
    if (startMs && ts < startMs) return false;
    if (endMs && ts > endMs) return false;
    return true;
}

function analyticsOrderRevenue(order) {
    if (!order) return 0;
    if (ADMIN_ANALYTICS_EXCLUDED.has((order.status || '').toLowerCase())) return 0;
    return Number(order.total) || 0;
}

function analyticsCustomerKey(order) {
    const email = (order.email || '').toLowerCase().trim();
    if (email && email.includes('@')) return 'e:' + email;
    const phone = (order.phone || '').replace(/\D/g, '');
    if (phone.length >= 10) return 'p:' + phone.slice(-10);
    const uid = (order.uid || '').toLowerCase().trim();
    if (uid) return 'u:' + uid;
    return 'x:guest';
}

function analyticsCountSignups(users, startMs, endMs) {
    let count = 0;
    (users || []).forEach(function(u) {
        const ts = analyticsTsToMs(u.createdAt) || analyticsTsToMs((u.analytics || {}).firstSeenAt);
        if (analyticsInRange(ts, startMs || 0, endMs || 0)) count += 1;
    });
    return count;
}

function analyticsComputeRepurchaseDays(orders) {
    const byCustomer = {};
    orders.forEach(function(o) {
        const key = analyticsCustomerKey(o);
        const ts = analyticsTsToMs(o.timestamp);
        if (!ts || ADMIN_ANALYTICS_EXCLUDED.has((o.status || '').toLowerCase())) return;
        if (!byCustomer[key]) byCustomer[key] = [];
        byCustomer[key].push(ts);
    });
    const gaps = [];
    Object.keys(byCustomer).forEach(function(key) {
        const times = byCustomer[key].sort(function(a, b) { return a - b; });
        if (times.length < 2) return;
        for (let i = 1; i < times.length; i++) {
            gaps.push((times[i] - times[i - 1]) / 86400000);
        }
    });
    if (!gaps.length) return 0;
    return Math.round(gaps.reduce(function(s, v) { return s + v; }, 0) / gaps.length);
}

function analyticsLookupOrderInfo(map, user) {
    const email = (user.email || '').toLowerCase().trim();
    const phone = (user.phone || '').replace(/\D/g, '').slice(-10);
    const uid = (user.uid || '').toLowerCase().trim();
    return map['e:' + email] || map['p:' + phone] || map['u:' + uid] ||
        map[email] || map[uid] || { count: 0, revenue: 0, lastMs: 0, firstMs: 0 };
}

function analyticsDeltaPct(current, previous) {
    if (!previous && !current) return { text: '—', cls: 'neutral' };
    if (!previous) return { text: '+100%', cls: 'up' };
    const pct = ((current - previous) / previous) * 100;
    const sign = pct >= 0 ? '+' : '';
    return {
        text: sign + pct.toFixed(1) + '%',
        cls: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral'
    };
}

function analyticsRenderDelta(delta) {
    if (!delta || delta.text === '—') return '';
    return '<span class="admin-analytics-delta admin-analytics-delta--' + delta.cls + '">' + delta.text + ' vs prev</span>';
}

function analyticsBuildMaps() {
    const nameMap = {};
    (window.products || []).forEach(function(p) {
        if (p && p.id) nameMap[p.id] = p.name || p.title || p.id;
    });
    const catMap = {};
    (window.productCategories || []).forEach(function(c) {
        if (c && c.id) catMap[c.id] = c.name || c.id;
    });
    window.adminAnalyticsState.productNameMap = nameMap;
    window.adminAnalyticsState.categoryNameMap = catMap;
    return { nameMap, catMap };
}

function analyticsResolveCategory(productId, item, catMap) {
    if (item && item.categoryId && catMap[item.categoryId]) return catMap[item.categoryId];
    const prod = (window.products || []).find(function(p) { return p.id === productId; });
    if (!prod) return 'Uncategorized';
    const ids = prod.categoryIds || (prod.categoryId ? [prod.categoryId] : []);
    if (ids.length && catMap[ids[0]]) return catMap[ids[0]];
    if (typeof resolveProductCategoryLabel === 'function') {
        const label = resolveProductCategoryLabel(prod);
        if (label) return label;
    }
    return 'Uncategorized';
}

function analyticsAggregateOrders(orders, startMs, endMs) {
    const filtered = orders.filter(function(o) {
        return analyticsInRange(analyticsTsToMs(o.timestamp), startMs || 0, endMs || 0);
    });

    let revenue = 0;
    let grossRevenue = 0;
    let discountTotal = 0;
    let refundTotal = 0;
    let units = 0;
    let deliveredCount = 0;
    let guestOrders = 0;
    let registeredOrders = 0;
    let codRevenue = 0;
    let onlineRevenue = 0;
    let pendingOrders = 0;
    let cancelledOrders = 0;

    const statusCounts = {};
    const paymentCounts = {};
    const productStats = {};
    const categoryStats = {};
    const promoStats = {};
    const dailyRevenue = {};
    const dailyOrders = {};
    const hourlyOrders = Array(24).fill(0);
    const customerOrderMap = {};
    const catMap = window.adminAnalyticsState.categoryNameMap || {};

    filtered.forEach(function(o) {
        const status = (o.status || 'pending').toLowerCase();
        const rev = analyticsOrderRevenue(o);
        const gross = Number(o.total) || 0;
        grossRevenue += gross;
        revenue += rev;
        discountTotal += Number(o.discount) || 0;
        refundTotal += Number(o.refundAmount) || 0;
        if (ADMIN_ANALYTICS_DELIVERED.has(status)) deliveredCount += 1;
        if (status === 'pending' || status === 'confirmed' || status === 'processing' || status === 'placed') pendingOrders += 1;
        if (status === 'cancelled' || status === 'returned') cancelledOrders += 1;

        statusCounts[status] = (statusCounts[status] || 0) + 1;
        const pay = (o.paymentMethod || 'unknown').toLowerCase();
        paymentCounts[pay] = (paymentCounts[pay] || 0) + 1;
        if (pay === 'cod') codRevenue += rev;
        else onlineRevenue += rev;

        if (o.isGuest) guestOrders += 1;
        else registeredOrders += 1;

        if (o.promoCode) {
            const code = String(o.promoCode).toUpperCase();
            if (!promoStats[code]) promoStats[code] = { code: code, uses: 0, revenue: 0, discount: 0 };
            promoStats[code].uses += 1;
            promoStats[code].revenue += rev;
            promoStats[code].discount += Number(o.discount) || 0;
        }

        const ts = analyticsTsToMs(o.timestamp);
        if (ts) {
            const d = new Date(ts);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            dailyRevenue[key] = (dailyRevenue[key] || 0) + rev;
            dailyOrders[key] = (dailyOrders[key] || 0) + 1;
            hourlyOrders[d.getHours()] += 1;
        }

        const custKey = analyticsCustomerKey(o);
        if (!customerOrderMap[custKey]) customerOrderMap[custKey] = { count: 0, revenue: 0, lastMs: 0, firstMs: 0 };
        customerOrderMap[custKey].count += 1;
        customerOrderMap[custKey].revenue += rev;
        if (ts > customerOrderMap[custKey].lastMs) customerOrderMap[custKey].lastMs = ts;
        if (ts && (!customerOrderMap[custKey].firstMs || ts < customerOrderMap[custKey].firstMs)) {
            customerOrderMap[custKey].firstMs = ts;
        }

        (o.items || []).forEach(function(item) {
            const qty = Number(item.qty) || 1;
            units += qty;
            const pid = item.id || item.productId || 'unknown';
            if (!productStats[pid]) productStats[pid] = { id: pid, name: item.name || pid, units: 0, revenue: 0, orders: 0 };
            productStats[pid].units += qty;
            productStats[pid].revenue += (Number(item.price) || 0) * qty;
            productStats[pid].orders += 1;

            const cat = analyticsResolveCategory(pid, item, catMap);
            if (!categoryStats[cat]) categoryStats[cat] = { name: cat, units: 0, revenue: 0, orders: 0 };
            categoryStats[cat].units += qty;
            categoryStats[cat].revenue += (Number(item.price) || 0) * qty;
            categoryStats[cat].orders += 1;
        });
    });

    const orderCount = filtered.length;
    const repeatCustomers = Object.values(customerOrderMap).filter(function(c) { return c.count >= 2; }).length;
    const uniqueCustomers = Object.keys(customerOrderMap).length;
    const repeatRate = uniqueCustomers ? Math.round((repeatCustomers / uniqueCustomers) * 100) : 0;
    const fulfillmentRate = orderCount ? Math.round((deliveredCount / orderCount) * 100) : 0;
    const aov = orderCount ? Math.round(revenue / orderCount) : 0;
    const itemsPerOrder = orderCount ? (units / orderCount).toFixed(1) : '0';

    const dailyKeys = Object.keys(dailyRevenue).sort();
    const chartDays = dailyKeys.slice(-14);
    const chartMax = chartDays.reduce(function(m, k) { return Math.max(m, dailyRevenue[k] || 0, dailyOrders[k] || 0); }, 1);

    return {
        orderCount, revenue, grossRevenue, discountTotal, refundTotal, aov, units, itemsPerOrder,
        uniqueCustomers, repeatCustomers, repeatRate, deliveredCount, fulfillmentRate,
        guestOrders, registeredOrders, codRevenue, onlineRevenue, pendingOrders, cancelledOrders,
        statusCounts, paymentCounts, productStats, categoryStats, promoStats,
        dailyRevenue, dailyOrders, chartDays, chartMax, hourlyOrders, customerOrderMap,
        topProducts: Object.values(productStats).sort(function(a, b) { return b.revenue - a.revenue; }).slice(0, 15),
        topCategories: Object.values(categoryStats).sort(function(a, b) { return b.revenue - a.revenue; }).slice(0, 10),
        topPromos: Object.values(promoStats).sort(function(a, b) { return b.uses - a.uses; }).slice(0, 10)
    };
}

function analyticsAggregateTraffic(storeData, startMs, endMs) {
    const daily = (storeData && storeData.daily) || {};
    const totals = (storeData && storeData.totals) || {};
    let visits = 0;
    let pageViews = 0;
    let newVisits = 0;
    let returningVisits = 0;
    let productViewCount = 0;
    const pageBreakdown = {};
    const eventBreakdown = {};
    const deviceBreakdown = {};
    const hourlyTraffic = Array(24).fill(0);
    const productViewMap = {};
    const utmBreakdown = {};
    const searchBreakdown = {};
    const eventValueMap = {};
    const eventDimsMap = {};

    Object.keys(daily).forEach(function(dk) {
        const dayMs = analyticsDayKeyToMs(dk);
        if (startMs && dayMs < startMs) return;
        if (endMs && dayMs > endMs) return;
        const row = daily[dk] || {};
        visits += Number(row.visits) || 0;
        pageViews += Number(row.pageViews) || 0;
        newVisits += Number(row.newVisits) || 0;
        returningVisits += Number(row.returningVisits) || 0;

        Object.keys(row.pages || {}).forEach(function(pk) {
            pageBreakdown[pk] = (pageBreakdown[pk] || 0) + (Number(row.pages[pk]) || 0);
        });
        Object.keys(row.events || {}).forEach(function(ek) {
            eventBreakdown[ek] = (eventBreakdown[ek] || 0) + (Number(row.events[ek]) || 0);
        });
        Object.keys(row.devices || {}).forEach(function(dk2) {
            deviceBreakdown[dk2] = (deviceBreakdown[dk2] || 0) + (Number(row.devices[dk2]) || 0);
        });
        Object.keys(row.hours || {}).forEach(function(h) {
            const hi = parseInt(h, 10);
            if (hi >= 0 && hi < 24) hourlyTraffic[hi] += Number(row.hours[h]) || 0;
        });
        Object.keys(row.productViews || {}).forEach(function(pid) {
            const c = Number(row.productViews[pid]) || 0;
            productViewCount += c;
            productViewMap[pid] = (productViewMap[pid] || 0) + c;
        });
        Object.keys(row.utm || {}).forEach(function(uk) {
            utmBreakdown[uk] = (utmBreakdown[uk] || 0) + (Number(row.utm[uk]) || 0);
        });
        Object.keys(row.searches || {}).forEach(function(sk) {
            searchBreakdown[sk] = (searchBreakdown[sk] || 0) + (Number(row.searches[sk]) || 0);
        });
        Object.keys(row.eventValue || {}).forEach(function(ek) {
            eventValueMap[ek] = (eventValueMap[ek] || 0) + (Number(row.eventValue[ek]) || 0);
        });
        Object.keys(row.eventDims || {}).forEach(function(ek) {
            if (!eventDimsMap[ek]) eventDimsMap[ek] = {};
            Object.keys(row.eventDims[ek] || {}).forEach(function(dimK) {
                eventDimsMap[ek][dimK] = (eventDimsMap[ek][dimK] || 0) + (Number(row.eventDims[ek][dimK]) || 0);
            });
        });
    });

    if (!startMs && !endMs) {
        Object.keys(totals.searches || {}).forEach(function(sk) {
            searchBreakdown[sk] = (searchBreakdown[sk] || 0) + (Number(totals.searches[sk]) || 0);
        });
        visits = Number(totals.visits) || visits;
        pageViews = Number(totals.pageViews) || pageViews;
        Object.keys(totals.productViews || {}).forEach(function(pid) {
            productViewMap[pid] = (productViewMap[pid] || 0) + (Number(totals.productViews[pid]) || 0);
            productViewCount += Number(totals.productViews[pid]) || 0;
        });
    }

    return {
        visits, pageViews, newVisits, returningVisits, productViewCount, productViewMap,
        topPages: Object.entries(pageBreakdown).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 10),
        eventBreakdown, deviceBreakdown, hourlyTraffic, eventValueMap, eventDimsMap,
        utmTop: Object.entries(utmBreakdown).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 8),
        topSearches: Object.entries(searchBreakdown).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 12)
    };
}

function analyticsDayKeyToMs(dk) {
    if (!dk || dk.length !== 8) return 0;
    return new Date(parseInt(dk.slice(0, 4), 10), parseInt(dk.slice(4, 6), 10) - 1, parseInt(dk.slice(6, 8), 10)).getTime();
}

function analyticsEventDimsFor(traffic, eventKey, prefix) {
    const dims = (traffic.eventDimsMap && traffic.eventDimsMap[eventKey]) || {};
    const entries = Object.entries(dims)
        .filter(function(pair) { return !prefix || pair[0].indexOf(prefix) === 0; })
        .map(function(pair) {
            const label = pair[0].replace(/^(intent|method|reason|sort|source|variant)_/, '').replace(/_/g, ' ');
            return [label, pair[1]];
        })
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 12);
    return entries;
}

function analyticsBuildCohortRetention(orders, startMs) {
    const firstOrderByCustomer = {};
    const allOrdersByCustomer = {};

    (orders || []).forEach(function(o) {
        const ts = analyticsTsToMs(o.timestamp);
        if (!ts || ADMIN_ANALYTICS_EXCLUDED.has((o.status || '').toLowerCase())) return;
        if (startMs && ts < startMs) return;
        const key = analyticsCustomerKey(o);
        if (!allOrdersByCustomer[key]) allOrdersByCustomer[key] = [];
        allOrdersByCustomer[key].push(ts);
        if (!firstOrderByCustomer[key] || ts < firstOrderByCustomer[key]) {
            firstOrderByCustomer[key] = ts;
        }
    });

    const cohorts = {};
    Object.keys(firstOrderByCustomer).forEach(function(key) {
        const firstTs = firstOrderByCustomer[key];
        const d = new Date(firstTs);
        const cohortKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        if (!cohorts[cohortKey]) cohorts[cohortKey] = { customers: 0, repeat30: 0, repeat60: 0, repeat90: 0 };
        cohorts[cohortKey].customers += 1;
        const later = (allOrdersByCustomer[key] || []).filter(function(t) { return t > firstTs; });
        if (later.some(function(t) { return (t - firstTs) <= 30 * 86400000; })) cohorts[cohortKey].repeat30 += 1;
        if (later.some(function(t) { return (t - firstTs) <= 60 * 86400000; })) cohorts[cohortKey].repeat60 += 1;
        if (later.some(function(t) { return (t - firstTs) <= 90 * 86400000; })) cohorts[cohortKey].repeat90 += 1;
    });

    return Object.keys(cohorts).sort().reverse().slice(0, 6).map(function(key) {
        const c = cohorts[key];
        const pct30 = c.customers ? Math.round((c.repeat30 / c.customers) * 100) : 0;
        const pct60 = c.customers ? Math.round((c.repeat60 / c.customers) * 100) : 0;
        const pct90 = c.customers ? Math.round((c.repeat90 / c.customers) * 100) : 0;
        return { month: key, customers: c.customers, pct30: pct30, pct60: pct60, pct90: pct90 };
    });
}

function analyticsRenderCohortTable(rows) {
    if (!rows.length) return '<p class="admin-analytics-empty">Need more repeat orders to show cohort retention.</p>';
    const body = rows.map(function(r) {
        return '<tr><td>' + r.month + '</td><td>' + r.customers + '</td>' +
            '<td>' + r.pct30 + '%</td><td>' + r.pct60 + '%</td><td>' + r.pct90 + '%</td></tr>';
    }).join('');
    return '<div class="admin-analytics-table-wrap"><table class="admin-analytics-table">' +
        '<thead><tr><th>Cohort</th><th>Customers</th><th>30d repeat</th><th>60d repeat</th><th>90d repeat</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>';
}

function analyticsBuildFunnel(traffic, orderAgg) {
    const events = traffic.eventBreakdown || {};
    const maxVisits = traffic.visits || 0;
    const steps = ADMIN_ANALYTICS_FUNNEL_STEPS.map(function(step) {
        let count = 0;
        if (step.key === 'visits') count = traffic.visits || 0;
        else if (step.key === 'productViews') count = traffic.productViewCount || events.product_view || 0;
        else if (step.event) count = events[step.event] || 0;
        if (step.key === 'order_placed' && orderAgg.orderCount > count) count = orderAgg.orderCount;
        const pct = maxVisits ? Math.round((count / maxVisits) * 100) : 0;
        return { label: step.label, count: count, pct: pct };
    });
    return steps;
}

function analyticsCustomerSegment(row) {
    const now = Date.now();
    const daysSinceOrder = row.lastOrderMs ? (now - row.lastOrderMs) / 86400000 : null;
    const daysSinceSeen = row.lastSeenMs ? (now - row.lastSeenMs) / 86400000 : null;
    if (row.ltv >= 5000 || row.orders >= 3) return 'vip';
    if (row.orders >= 2) return 'repeat';
    if (row.orders === 1 && daysSinceOrder !== null && daysSinceOrder > 90) return 'at_risk';
    if (row.orders === 1) return 'one_time';
    if (row.orders === 0 && daysSinceSeen !== null && daysSinceSeen > 30) return 'dormant';
    if (row.orders === 0 && row.lastSeenMs) return 'browser';
    return 'new';
}

function analyticsBuildCustomerRows(users, orderAgg) {
    const rows = [];
    const seen = new Set();
    const emailToKey = {};

    (users || []).forEach(function(u) {
        const email = (u.email || '').toLowerCase().trim();
        const key = email || (u.uid || '').toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);
        if (email) emailToKey[email] = key;

        const orderInfo = analyticsLookupOrderInfo(orderAgg.customerOrderMap, u);
        const a = u.analytics || {};

        const row = {
            uid: u.uid,
            name: u.displayName || (email ? email.split('@')[0] : 'Customer'),
            email: email || '—',
            phone: u.phone || '—',
            isGuest: !!u.isGuest || !!u.guestCheckout,
            visits: Number(a.visitCount) || 0,
            pageViews: Number(a.pageViewCount) || 0,
            lastSeenMs: analyticsTsToMs(a.lastSeenAt),
            lastPage: a.lastPage || '—',
            lastDevice: a.lastDevice || '—',
            orders: Math.max(Number(a.orderCount) || 0, orderInfo.count),
            lastOrderMs: Math.max(analyticsTsToMs(a.lastOrderAt), orderInfo.lastMs),
            firstOrderMs: orderInfo.firstMs || analyticsTsToMs(a.lastOrderAt),
            ltv: Math.max(Number(a.lifetimeValue) || 0, orderInfo.revenue),
            createdMs: analyticsTsToMs(u.createdAt) || analyticsTsToMs(a.firstSeenAt),
            segment: 'new'
        };
        row.segment = analyticsCustomerSegment(row);
        rows.push(row);
    });

    Object.keys(orderAgg.customerOrderMap).forEach(function(key) {
        const norm = key.includes('@') ? key : key;
        if (seen.has(norm) || (key.includes('@') && emailToKey[key])) return;
        const info = orderAgg.customerOrderMap[key];
        const row = {
            uid: key,
            name: key.includes('@') ? key.split('@')[0] : 'Guest buyer',
            email: key.includes('@') ? key : '—',
            phone: !key.includes('@') && /^\d+$/.test(key) ? key : '—',
            isGuest: true,
            visits: 0, pageViews: 0, lastSeenMs: 0, lastPage: '—', lastDevice: '—',
            orders: info.count, lastOrderMs: info.lastMs, firstOrderMs: info.firstMs,
            ltv: info.revenue, createdMs: 0, segment: 'new'
        };
        row.segment = analyticsCustomerSegment(row);
        rows.push(row);
        seen.add(norm);
    });

    return rows;
}

function analyticsSortCustomers(rows, sortKey) {
    const sorted = rows.slice();
    sorted.sort(function(a, b) {
        if (sortKey === 'orders') return b.orders - a.orders || b.ltv - a.ltv;
        if (sortKey === 'visits') return b.visits - a.visits || b.lastSeenMs - a.lastSeenMs;
        if (sortKey === 'lastSeen') return b.lastSeenMs - a.lastSeenMs;
        if (sortKey === 'lastOrder') return b.lastOrderMs - a.lastOrderMs;
        return b.ltv - a.ltv || b.orders - a.orders;
    });
    return sorted;
}

function analyticsRenderKpi(label, value, sub, accent, delta) {
    return '<div class="admin-analytics-kpi">' +
        '<span class="admin-analytics-kpi__label">' + label + '</span>' +
        '<span class="admin-analytics-kpi__value" style="color:' + (accent || 'var(--gold)') + '">' + value + '</span>' +
        (sub ? '<span class="admin-analytics-kpi__sub">' + sub + '</span>' : '') +
        analyticsRenderDelta(delta) +
        '</div>';
}

function analyticsRenderDualChart(chartDays, dailyRevenue, dailyOrders, chartMax) {
    if (!chartDays.length) return '<p class="admin-analytics-empty">No data in this period.</p>';
    return '<div class="admin-analytics-dual-chart">' + chartDays.map(function(key) {
        const rev = dailyRevenue[key] || 0;
        const ord = dailyOrders[key] || 0;
        const revPct = Math.max(3, Math.round((rev / chartMax) * 100));
        const ordPct = Math.max(3, Math.round((ord / chartMax) * 100));
        return '<div class="admin-analytics-dual-chart__col" title="' + analyticsFormatCurrency(rev) + ' · ' + ord + ' orders">' +
            '<div class="admin-analytics-dual-chart__bars">' +
            '<div class="admin-analytics-dual-chart__bar admin-analytics-dual-chart__bar--rev" style="height:' + revPct + '%"></div>' +
            '<div class="admin-analytics-dual-chart__bar admin-analytics-dual-chart__bar--ord" style="height:' + ordPct + '%"></div>' +
            '</div><span class="admin-analytics-chart__label">' + key.slice(5) + '</span></div>';
    }).join('') + '</div>' +
    '<div class="admin-analytics-legend"><span><i class="admin-analytics-legend__dot admin-analytics-legend__dot--rev"></i> Revenue</span>' +
    '<span><i class="admin-analytics-legend__dot admin-analytics-legend__dot--ord"></i> Orders</span></div>';
}

function analyticsRenderHeatmap(hourly, label) {
    const max = hourly.reduce(function(m, v) { return Math.max(m, v); }, 1);
    return '<div class="admin-analytics-heatmap">' + hourly.map(function(v, h) {
        const pct = Math.max(4, Math.round((v / max) * 100));
        const hr = (h < 10 ? '0' : '') + h + ':00';
        return '<div class="admin-analytics-heatmap__cell" style="opacity:' + (0.25 + (pct / 100) * 0.75) + '" title="' + hr + ': ' + v + ' ' + label + '"><span>' + h + '</span></div>';
    }).join('') + '</div>';
}

function analyticsRenderFunnel(steps) {
    const top = steps[0] && steps[0].count ? steps[0].count : 1;
    return '<div class="admin-analytics-funnel">' + steps.map(function(s, i) {
        const width = Math.max(18, Math.round((s.count / top) * 100));
        const drop = i > 0 && steps[i - 1].count
            ? '<span class="admin-analytics-funnel__drop">-' + Math.max(0, steps[i - 1].count - s.count) + '</span>'
            : '';
        return '<div class="admin-analytics-funnel__step">' +
            '<div class="admin-analytics-funnel__bar" style="width:' + width + '%"><span>' + s.label + '</span><strong>' + s.count.toLocaleString('en-IN') + '</strong></div>' +
            '<span class="admin-analytics-funnel__pct">' + s.pct + '%' + drop + '</span></div>';
    }).join('') + '</div>';
}

function analyticsRenderBreakdown(entries, emptyText) {
    if (!entries.length) return '<p class="admin-analytics-empty">' + (emptyText || 'No data.') + '</p>';
    const total = entries.reduce(function(s, e) { return s + e[1]; }, 0);
    return '<div class="admin-analytics-breakdown">' + entries.map(function(pair) {
        const pct = total ? Math.round((pair[1] / total) * 100) : 0;
        return '<div class="admin-analytics-breakdown__row">' +
            '<span class="admin-analytics-breakdown__label">' + String(pair[0]).replace(/_/g, ' ') + '</span>' +
            '<div class="admin-analytics-breakdown__track"><div class="admin-analytics-breakdown__fill" style="width:' + Math.max(pct, 2) + '%"></div></div>' +
            '<span class="admin-analytics-breakdown__count">' + pair[1] + ' (' + pct + '%)</span></div>';
    }).join('') + '</div>';
}

function analyticsRenderOverview(ctx) {
    const c = ctx.current;
    const p = ctx.previous;
    const t = ctx.traffic;
    const st = ctx.state;
    const events = t.eventBreakdown || {};
    const conv = t.visits > 0 ? ((c.orderCount / t.visits) * 100).toFixed(1) + '%' : '—';
    const rpv = t.visits > 0 ? analyticsFormatCurrency(Math.round(c.revenue / t.visits)) : '—';
    const cartViews = events.view_cart || 0;
    const checkoutStarts = events.begin_checkout || 0;
    const checkoutValue = (t.eventValueMap && t.eventValueMap.begin_checkout) || 0;
    const orderEventValue = (t.eventValueMap && t.eventValueMap.order_placed) || 0;
    const abandonedValue = Math.max(0, checkoutValue - orderEventValue);
    const cartAbandon = cartViews > 0
        ? Math.max(0, 100 - Math.round((c.orderCount / cartViews) * 100)) + '%'
        : '—';
    const cartConv = (events.add_to_cart || 0) > 0
        ? ((c.orderCount / events.add_to_cart) * 100).toFixed(1) + '% cart→order'
        : '';
    const repurchaseDays = ctx.repurchaseDays ? ctx.repurchaseDays + ' days avg' : '—';

    return '<div class="admin-analytics-kpi-grid">' +
        analyticsRenderKpi('Revenue', analyticsFormatCurrency(c.revenue), ctx.periodLabel, 'var(--gold)', analyticsDeltaPct(c.revenue, p.revenue)) +
        analyticsRenderKpi('Orders', String(c.orderCount), c.units + ' units · ' + c.itemsPerOrder + '/order', '#2ecc71', analyticsDeltaPct(c.orderCount, p.orderCount)) +
        analyticsRenderKpi('AOV', analyticsFormatCurrency(c.aov), 'Avg order value', '#3498db', analyticsDeltaPct(c.aov, p.aov)) +
        analyticsRenderKpi('Customers', String(c.uniqueCustomers), c.repeatRate + '% repeat · ' + repurchaseDays, '#9b59b6', analyticsDeltaPct(c.uniqueCustomers, p.uniqueCustomers)) +
        analyticsRenderKpi('Visits', String(t.visits), t.pageViews + ' page views', '#e67e22', analyticsDeltaPct(t.visits, ctx.prevTraffic.visits)) +
        analyticsRenderKpi('Conversion', conv, 'RPV ' + rpv, '#1abc9c', null) +
        '</div>' +
        '<div class="admin-analytics-kpi-grid admin-analytics-kpi-grid--compact">' +
        analyticsRenderKpi('Delivered', c.fulfillmentRate + '%', c.deliveredCount + ' of ' + c.orderCount, '#2ecc71', null) +
        analyticsRenderKpi('Pending', String(c.pendingOrders), c.cancelledOrders + ' cancelled', '#f39c12', null) +
        analyticsRenderKpi('Cart abandon', cartAbandon, cartViews + ' cart views', '#e74c3c', null) +
        analyticsRenderKpi('Abandoned value', analyticsFormatCurrency(abandonedValue), checkoutStarts + ' checkouts started', '#c0392b', null) +
        analyticsRenderKpi('New signups', String(ctx.signups), cartConv || 'Registrations in period', '#3498db', analyticsDeltaPct(ctx.signups, ctx.prevSignups)) +
        analyticsRenderKpi('Discounts', analyticsFormatCurrency(c.discountTotal), 'Promo savings', '#e74c3c', null) +
        analyticsRenderKpi('Engagement', String(st.supportThreads), st.reviewCount + ' reviews · ' + st.pendingReviews + ' pending', '#1abc9c', null) +
        '</div>' +
        '<div class="admin-analytics-split">' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-filter"></i> Purchase funnel</h5>' +
        analyticsRenderFunnel(ctx.funnel) + '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-pie-chart"></i> Order status</h5>' +
        analyticsRenderBreakdown(Object.entries(c.statusCounts).sort(function(a, b) { return b[1] - a[1]; })) + '</div>' +
        '</div>' +
        '<div class="admin-analytics-split">' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-bar-chart"></i> Revenue &amp; orders trend</h5>' +
        analyticsRenderDualChart(c.chartDays, c.dailyRevenue, c.dailyOrders, c.chartMax) + '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-users"></i> Customer segments</h5>' +
        analyticsRenderSegmentSummary(ctx.customerRows) + '</div></div>' +
        analyticsRenderRecentOrders(ctx.recentOrders);
}

function analyticsRenderRecentOrders(orders) {
    if (!orders || !orders.length) return '';
    const rows = orders.slice(0, 8).map(function(o) {
        const status = (o.status || 'pending').toLowerCase();
        const statusCls = status === 'delivered' ? 'delivered' : (status === 'cancelled' ? 'cancelled' : 'pending');
        return '<tr><td><strong>#' + (o.orderId || (o.id ? o.id.slice(-6).toUpperCase() : '—')) + '</strong></td>' +
            '<td>' + (o.recipient || '—') + '</td>' +
            '<td>' + analyticsFormatShortDate(analyticsTsToMs(o.timestamp)) + '</td>' +
            '<td><span class="admin-analytics-status admin-analytics-status--' + statusCls + '">' + status + '</span></td>' +
            '<td>' + (o.paymentMethod || '—').toUpperCase() + '</td>' +
            '<td><strong>' + analyticsFormatCurrency(o.total) + '</strong></td></tr>';
    }).join('');
    return '<div class="admin-analytics-panel" style="margin-top:4px;"><h5 class="admin-analytics-panel__title"><i class="fa fa-shopping-bag"></i> Recent orders</h5>' +
        '<div class="admin-analytics-table-wrap"><table class="admin-analytics-table">' +
        '<thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Status</th><th>Pay</th><th>Total</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div></div>';
}

function analyticsRenderOrdersTab(orders, startMs) {
    const filtered = orders.filter(function(o) {
        return analyticsInRange(analyticsTsToMs(o.timestamp), startMs || 0, 0);
    }).slice(0, 100);

    if (!filtered.length) return '<p class="admin-analytics-empty">No orders in this period.</p>';

    const rows = filtered.map(function(o) {
        const status = (o.status || 'pending').toLowerCase();
        const items = (o.items || []).reduce(function(s, i) { return s + (Number(i.qty) || 1); }, 0);
        return '<tr><td><strong>#' + (o.orderId || (o.id ? o.id.slice(-6).toUpperCase() : '—')) + '</strong></td>' +
            '<td class="admin-analytics-table__name">' + (o.recipient || '—') + '</td>' +
            '<td>' + (o.email || '—') + '</td>' +
            '<td>' + analyticsFormatShortDate(analyticsTsToMs(o.timestamp)) + '</td>' +
            '<td>' + items + '</td>' +
            '<td>' + status + '</td>' +
            '<td>' + (o.paymentMethod || '—').toUpperCase() + '</td>' +
            '<td>' + (o.promoCode || '—') + '</td>' +
            '<td><strong>' + analyticsFormatCurrency(o.total) + '</strong></td></tr>';
    }).join('');

    return '<div class="admin-analytics-customer-toolbar">' +
        '<button type="button" class="btn-gold admin-analytics-export" onclick="exportAdminAnalyticsOrders()"><i class="fa fa-download"></i> Export orders CSV</button>' +
        '<span class="admin-analytics-footnote" style="margin:0;">Showing latest ' + filtered.length + ' orders in selected period</span></div>' +
        '<div class="admin-analytics-table-wrap admin-analytics-table-wrap--tall"><table class="admin-analytics-table">' +
        '<thead><tr><th>Order</th><th>Customer</th><th>Email</th><th>Date</th><th>Items</th><th>Status</th><th>Payment</th><th>Promo</th><th>Total</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
}

function analyticsRenderSegmentSummary(rows) {
    const counts = { vip: 0, repeat: 0, one_time: 0, at_risk: 0, dormant: 0, browser: 0, new: 0 };
    rows.forEach(function(r) { counts[r.segment] = (counts[r.segment] || 0) + 1; });
    const labels = {
        vip: 'VIP (₹5k+ or 3+ orders)',
        repeat: 'Repeat buyers',
        one_time: 'One-time buyers',
        at_risk: 'At-risk (90d+ no reorder)',
        dormant: 'Dormant browsers',
        browser: 'Active browsers',
        new: 'New / other'
    };
    const entries = Object.keys(counts).filter(function(k) { return counts[k] > 0; }).map(function(k) {
        return [labels[k] || k, counts[k]];
    }).sort(function(a, b) { return b[1] - a[1]; });
    return analyticsRenderBreakdown(entries, 'No customer data yet.');
}

function analyticsRenderCustomersTab(rows) {
    const st = window.adminAnalyticsState;
    const seg = st.customerSegment || 'all';
    let filtered = seg === 'all' ? rows : rows.filter(function(r) { return r.segment === seg; });
    const q = (st.customerSearch || '').toLowerCase().trim();
    if (q) {
        filtered = filtered.filter(function(r) {
            return (r.name || '').toLowerCase().includes(q) ||
                (r.email || '').toLowerCase().includes(q) ||
                String(r.phone || '').includes(q);
        });
    }
    filtered = analyticsSortCustomers(filtered, st.customerSort || 'ltv');
    const display = filtered.slice(0, 75);

    const segButtons = [
        ['all', 'All'], ['vip', 'VIP'], ['repeat', 'Repeat'], ['one_time', 'One-time'],
        ['at_risk', 'At-risk'], ['dormant', 'Dormant'], ['browser', 'Browsers']
    ].map(function(pair) {
        const active = seg === pair[0] ? ' active' : '';
        return '<button type="button" class="admin-analytics-seg' + active + '" onclick="setAdminAnalyticsSegment(\'' + pair[0] + '\')">' + pair[1] + '</button>';
    }).join('');

    const sortOpts = [
        ['ltv', 'LTV'], ['orders', 'Orders'], ['visits', 'Visits'], ['lastSeen', 'Last seen'], ['lastOrder', 'Last order']
    ].map(function(pair) {
        const sel = (st.customerSort || 'ltv') === pair[0] ? ' selected' : '';
        return '<option value="' + pair[0] + '"' + sel + '>' + pair[1] + '</option>';
    }).join('');

    if (!display.length) return '<p class="admin-analytics-empty">No customers in this segment.</p>';

    const body = display.map(function(r) {
        const segTag = '<span class="admin-analytics-tag admin-analytics-tag--' + r.segment + '">' + r.segment.replace(/_/g, ' ') + '</span>';
        const typeTag = r.isGuest
            ? '<span class="admin-analytics-tag admin-analytics-tag--guest">guest</span>'
            : '<span class="admin-analytics-tag">registered</span>';
        return '<tr><td class="admin-analytics-table__name">' + (r.name || '—') + ' ' + typeTag + segTag + '</td>' +
            '<td>' + r.email + '</td><td>' + r.visits + '</td><td>' + analyticsFormatRelative(r.lastSeenMs) + '</td>' +
            '<td>' + r.orders + '</td><td>' + analyticsFormatShortDate(r.lastOrderMs) + '</td>' +
            '<td><strong>' + analyticsFormatCurrency(r.ltv) + '</strong></td><td>' + (r.lastDevice || '—') + '</td></tr>';
    }).join('');

    return '<div class="admin-analytics-customer-toolbar">' +
        '<div class="admin-analytics-customer-search"><i class="fa fa-search"></i>' +
        '<input type="search" placeholder="Search customers..." value="' + (st.customerSearch || '').replace(/"/g, '&quot;') + '" oninput="onAdminAnalyticsCustomerSearch(this.value)"></div>' +
        '<select class="admin-analytics-sort" onchange="setAdminAnalyticsCustomerSort(this.value)">' + sortOpts + '</select>' +
        '<button type="button" class="btn-gold admin-analytics-export" onclick="exportAdminAnalyticsCustomers()"><i class="fa fa-download"></i> Export CSV</button>' +
        '</div>' +
        '<div class="admin-analytics-segments">' + segButtons + '</div>' +
        '<div class="admin-analytics-table-wrap admin-analytics-table-wrap--tall"><table class="admin-analytics-table">' +
        '<thead><tr><th>Customer</th><th>Email</th><th>Visits</th><th>Last seen</th><th>Orders</th><th>Last order</th><th>LTV</th><th>Device</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>' +
        (filtered.length > 75 ? '<p class="admin-analytics-footnote">Showing 75 of ' + filtered.length + ' customers.</p>' : '');
}

function analyticsRenderProductsTab(orderAgg, traffic, nameMap) {
    const viewMap = traffic.productViewMap || {};
    let html = '';
    if (orderAgg.topCategories.length) {
        html += '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-tags"></i> Top categories</h5>' +
            analyticsRenderBreakdown(orderAgg.topCategories.map(function(c) { return [c.name, c.revenue]; })) + '</div>';
    }
    if (!orderAgg.topProducts.length) {
        return html + '<p class="admin-analytics-empty">No product sales in this period.</p>';
    }
    const rows = orderAgg.topProducts.map(function(p, i) {
        const name = nameMap[p.id] || p.name || p.id;
        const views = viewMap[p.id] || viewMap[analyticsPageKeySafe(p.id)] || 0;
        const conv = views > 0 ? ((p.orders / views) * 100).toFixed(1) + '%' : '—';
        return '<tr><td>' + (i + 1) + '</td><td class="admin-analytics-table__name">' + name + '</td>' +
            '<td>' + views + '</td><td>' + p.units + '</td><td>' + p.orders + '</td>' +
            '<td>' + conv + '</td><td><strong>' + analyticsFormatCurrency(p.revenue) + '</strong></td></tr>';
    }).join('');
    return html +
        '<div class="admin-analytics-table-wrap"><table class="admin-analytics-table">' +
        '<thead><tr><th>#</th><th>Product</th><th>Views</th><th>Units</th><th>Orders</th><th>View→order</th><th>Revenue</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
}

function analyticsPageKeySafe(id) {
    return String(id || '').replace(/[.#$/\[\]]/g, '_').slice(0, 64);
}

function analyticsRenderFunnelTab(funnel, traffic, orderAgg) {
    const events = traffic.eventBreakdown || {};
    const codStarted = events.cod_checkout_started || 0;
    const codAbandoned = events.cod_checkout_abandoned || 0;
    const deepLinks = events.deep_link_open || 0;
    const oosFriction = events.oos_friction || 0;
    const orderFails = events.order_failed || 0;
    return '<div class="admin-analytics-kpi-grid admin-analytics-kpi-grid--compact">' +
        analyticsRenderKpi('Deep links', String(deepLinks), 'Shared product opens', '#3498db', null) +
        analyticsRenderKpi('COD started', String(codStarted), codAbandoned + ' abandoned', '#f39c12', null) +
        analyticsRenderKpi('OOS friction', String(oosFriction), 'Blocked variant picks', '#e74c3c', null) +
        analyticsRenderKpi('Order failures', String(orderFails), 'Checkout errors', '#c0392b', null) +
        '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-filter"></i> Full conversion funnel</h5>' +
        analyticsRenderFunnel(funnel) + '</div>' +
        '<div class="admin-analytics-split">' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-mobile"></i> Devices</h5>' +
        analyticsRenderBreakdown(Object.entries(traffic.deviceBreakdown || {}).sort(function(a, b) { return b[1] - a[1]; }), 'Device data builds as customers browse.') +
        '</div><div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-mouse-pointer"></i> Shopping events</h5>' +
        analyticsRenderBreakdown(Object.entries(events).sort(function(a, b) { return b[1] - a[1]; }), 'Track add to cart, checkout & more.') +
        '</div></div>' +
        '<div class="admin-analytics-split">' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-eye"></i> Top pages</h5>' +
        analyticsRenderBreakdown(traffic.topPages, 'Page views appear after customers browse.') +
        '</div><div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-bullhorn"></i> Campaign / UTM sources</h5>' +
        analyticsRenderBreakdown((traffic.utmTop || []).map(function(u) { return [u[0].replace(/^utm_/, '').replace(/_/g, ' '), u[1]]; }), 'UTM tags from shared links appear here.') +
        '</div></div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-clock-o"></i> Traffic by hour</h5>' +
        analyticsRenderHeatmap(traffic.hourlyTraffic, 'views') + '</div>';
}

function analyticsRenderGrowthTab(current, previous, traffic, ctx) {
    const payEntries = Object.entries(current.paymentCounts).sort(function(a, b) { return b[1] - a[1]; });
    const cohortRows = analyticsBuildCohortRetention(ctx.state.orders, analyticsComparisonRange(ctx.state.periodDays).startMs);
    let promoHtml = '<p class="admin-analytics-empty">No promo codes used in period.</p>';
    if (current.topPromos.length) {
        promoHtml = '<div class="admin-analytics-table-wrap"><table class="admin-analytics-table"><thead><tr><th>Code</th><th>Uses</th><th>Revenue</th><th>Discount given</th></tr></thead><tbody>' +
            current.topPromos.map(function(p) {
                return '<tr><td><strong>' + p.code + '</strong></td><td>' + p.uses + '</td><td>' + analyticsFormatCurrency(p.revenue) + '</td><td>' + analyticsFormatCurrency(p.discount) + '</td></tr>';
            }).join('') + '</tbody></table></div>';
    }

    return '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-line-chart"></i> Growth — revenue &amp; orders</h5>' +
        analyticsRenderDualChart(current.chartDays, current.dailyRevenue, current.dailyOrders, current.chartMax) + '</div>' +
        '<div class="admin-analytics-split">' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-clock-o"></i> Orders by hour</h5>' +
        analyticsRenderHeatmap(current.hourlyOrders, 'orders') + '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-credit-card"></i> Payment mix</h5>' +
        analyticsRenderBreakdown(payEntries) + '</div></div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-ticket"></i> Promo code performance</h5>' + promoHtml + '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-retweet"></i> Cohort retention (first-order month)</h5>' +
        analyticsRenderCohortTable(cohortRows) + '</div>' +
        '<div class="admin-analytics-kpi-grid admin-analytics-kpi-grid--compact">' +
        analyticsRenderKpi('New visitors', String(traffic.newVisits), 'First-time sessions', '#3498db', null) +
        analyticsRenderKpi('Returning', String(traffic.returningVisits), 'Repeat sessions', '#9b59b6', null) +
        analyticsRenderKpi('Rev vs prev', analyticsDeltaPct(current.revenue, previous.revenue).text, analyticsFormatCurrency(previous.revenue) + ' prior', 'var(--gold)', null) +
        analyticsRenderKpi('COD revenue', analyticsFormatCurrency(current.codRevenue), analyticsFormatCurrency(current.onlineRevenue) + ' online', '#f39c12', null) +
        analyticsRenderKpi('Refunds', analyticsFormatCurrency(current.refundTotal), current.cancelledOrders + ' cancelled', '#e74c3c', null) +
        analyticsRenderKpi('Guest orders', String(current.guestOrders), current.registeredOrders + ' registered', '#95a5a6', null) +
        '</div>';
}

function analyticsTodayDayKey() {
    const d = new Date();
    return '' + d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

function analyticsGetTodaySnapshot(storeData, orders) {
    const dk = analyticsTodayDayKey();
    const daily = (storeData && storeData.daily && storeData.daily[dk]) || {};
    const startMs = analyticsPeriodStartMs(1);
    let todayOrders = 0;
    let todayRevenue = 0;
    (orders || []).forEach(function(o) {
        const ts = analyticsTsToMs(o.timestamp);
        if (ts >= startMs) {
            todayOrders += 1;
            todayRevenue += analyticsOrderRevenue(o);
        }
    });
    return {
        visits: Number(daily.visits) || 0,
        pageViews: Number(daily.pageViews) || 0,
        revenue: todayRevenue || Number(daily.revenue) || 0,
        orders: todayOrders
    };
}

function analyticsRenderTodayPulse(snapshot) {
    return '<div class="admin-analytics-pulse">' +
        '<div class="admin-analytics-pulse__title"><i class="fa fa-bolt"></i> Today live</div>' +
        '<div class="admin-analytics-pulse__grid">' +
        '<div class="admin-analytics-pulse__item"><span>Revenue</span><strong>' + analyticsFormatCurrency(snapshot.revenue) + '</strong></div>' +
        '<div class="admin-analytics-pulse__item"><span>Orders</span><strong>' + snapshot.orders + '</strong></div>' +
        '<div class="admin-analytics-pulse__item"><span>Visits</span><strong>' + snapshot.visits + '</strong></div>' +
        '<div class="admin-analytics-pulse__item"><span>Page views</span><strong>' + snapshot.pageViews + '</strong></div>' +
        '</div></div>';
}

function analyticsEventCount(traffic, key) {
    return (traffic.eventBreakdown && traffic.eventBreakdown[key]) || 0;
}

function analyticsRenderEngagementTab(traffic, st) {
    const events = traffic.eventBreakdown || {};
    const spinOpens = events.spin_wheel_open || 0;
    const spinWins = events.spin_wheel_win || 0;
    const promoFailed = events.promo_failed || 0;
    const promoApplied = events.promo_applied || 0;
    const whatsappClicks = events.whatsapp_click || 0;
    const mediaViews = events.media_viewer_open || 0;
    const chatIntents = analyticsEventDimsFor(traffic, 'chat_intent', 'intent');
    const kpis = '<div class="admin-analytics-kpi-grid admin-analytics-kpi-grid--compact">' +
        analyticsRenderKpi('Logins', String(analyticsEventCount(traffic, 'login')), 'Returning sessions', '#3498db', null) +
        analyticsRenderKpi('Signups', String(analyticsEventCount(traffic, 'signup')), 'New accounts', '#2ecc71', null) +
        analyticsRenderKpi('AI / chat msgs', String(analyticsEventCount(traffic, 'chat_message_sent')), String(st.supportThreads) + ' threads', '#9b59b6', null) +
        analyticsRenderKpi('Chat opens', String(analyticsEventCount(traffic, 'support_chat_open')), 'Support widget', '#1abc9c', null) +
        analyticsRenderKpi('Reviews', String(analyticsEventCount(traffic, 'review_submitted')), st.reviewCount + ' total · ' + st.pendingReviews + ' pending', '#e67e22', null) +
        analyticsRenderKpi('Wishlist', String(analyticsEventCount(traffic, 'add_to_wishlist')), st.wishlistItems + ' saved items', '#f39c12', null) +
        '</div>' +
        '<div class="admin-analytics-kpi-grid admin-analytics-kpi-grid--compact">' +
        analyticsRenderKpi('Spin wheel', String(spinOpens), spinWins + ' wins', '#e91e63', null) +
        analyticsRenderKpi('Promo health', promoApplied + ' applied', promoFailed + ' failed', '#9b59b6', null) +
        analyticsRenderKpi('WhatsApp', String(whatsappClicks), 'Outbound clicks', '#25D366', null) +
        analyticsRenderKpi('360° / media', String(mediaViews), 'Viewer opens', '#00bcd4', null) +
        analyticsRenderKpi('Escalations', String(st.supportEscalations), st.supportWaiting + ' waiting admin', '#673ab7', null) +
        analyticsRenderKpi('Diaries', String(st.feedbackCount), st.announcementCount + ' announcements', '#795548', null) +
        '</div>';

    const topSearches = (traffic.topSearches || []).length
        ? '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-search"></i> Top search terms</h5>' +
            analyticsRenderBreakdown(traffic.topSearches.map(function(s) {
                return [s[0].replace(/_/g, ' '), s[1]];
            }), 'Search terms appear as customers use the search bar.') + '</div>'
        : '';

    const engagementEvents = [
        ['newsletter_subscribe', 'Newsletter signups'],
        ['newsletter_dismiss', 'Newsletter dismissals'],
        ['product_share', 'Product shares'],
        ['category_filter', 'Category filters'],
        ['filter_applied', 'Catalog filters'],
        ['sort_applied', 'Sort changes'],
        ['variant_selected', 'Variant picks'],
        ['oos_friction', 'Out-of-stock friction'],
        ['deep_link_open', 'Deep link opens'],
        ['announcement_viewed', 'Announcement views'],
        ['diary_click', 'Customer diary clicks'],
        ['payment_method_selected', 'Payment selections'],
        ['remove_from_cart', 'Cart removals'],
        ['promo_applied', 'Promos applied'],
        ['promo_failed', 'Promo failures'],
        ['promo_picker_opened', 'Promo picker opens'],
        ['live_support_tab', 'Support escalations'],
        ['order_note_updated', 'Delivery note updates']
    ].map(function(pair) {
        const c = events[pair[0]] || 0;
        return c > 0 ? [pair[1], c] : null;
    }).filter(Boolean);

    return kpis +
        '<div class="admin-analytics-split">' + topSearches +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-heart"></i> Store engagement events</h5>' +
        analyticsRenderBreakdown(engagementEvents, 'Engagement events build as customers interact.') +
        '</div></div>' +
        (chatIntents.length
            ? '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-comments"></i> AI chat intents</h5>' +
                analyticsRenderBreakdown(chatIntents, 'Top customer questions to the AI assistant.') + '</div>'
            : '') +
        '<div class="admin-analytics-kpi-grid admin-analytics-kpi-grid--compact">' +
        analyticsRenderKpi('Wishlist users', String(st.wishlistUsers), 'Customers with saved items', '#e91e63', null) +
        analyticsRenderKpi('Support inbox', String(st.supportThreads), 'Total conversations', '#673ab7', null) +
        analyticsRenderKpi('Product reviews', String(st.reviewCount), st.pendingReviews + ' awaiting approval', '#00bcd4', null) +
        '</div>';
}

function renderAdminAnalyticsDashboard() {
    const root = document.getElementById('admin-analytics-dashboard');
    if (!root) return;
    const st = window.adminAnalyticsState;

    if (st.loading) {
        root.innerHTML = '<div class="admin-analytics-loading"><div class="premium-loader"></div><p>Crunching store analytics…</p></div>';
        return;
    }

    analyticsBuildMaps();
    const range = analyticsComparisonRange(st.periodDays);
    const periodLabel = st.periodDays === 1 ? 'Today' : st.periodDays === 0 ? 'All time' : 'Last ' + st.periodDays + ' days';

    const current = analyticsAggregateOrders(st.orders, range.startMs, 0);
    const previous = st.periodDays > 0
        ? analyticsAggregateOrders(st.orders, range.prevStartMs, range.prevEndMs)
        : { revenue: 0, orderCount: 0, aov: 0, uniqueCustomers: 0 };

    const traffic = analyticsAggregateTraffic(st.storeAnalytics, range.startMs, 0);
    const prevTraffic = st.periodDays > 0
        ? analyticsAggregateTraffic(st.storeAnalytics, range.prevStartMs, range.prevEndMs)
        : { visits: 0 };

    const customerRows = analyticsBuildCustomerRows(st.users, current);
    const funnel = analyticsBuildFunnel(traffic, current);
    const nameMap = st.productNameMap;
    const periodOrders = st.orders.filter(function(o) {
        return analyticsInRange(analyticsTsToMs(o.timestamp), range.startMs, 0);
    });
    const signups = analyticsCountSignups(st.users, range.startMs, 0);
    const prevSignups = st.periodDays > 0 ? analyticsCountSignups(st.users, range.prevStartMs, range.prevEndMs) : 0;
    const repurchaseDays = analyticsComputeRepurchaseDays(periodOrders);
    const todaySnapshot = analyticsGetTodaySnapshot(st.storeAnalytics, st.orders);

    const ctx = {
        current: current, previous: previous, traffic: traffic, prevTraffic: prevTraffic,
        funnel: funnel, customerRows: customerRows, state: st, periodLabel: periodLabel,
        signups: signups, prevSignups: prevSignups, repurchaseDays: repurchaseDays,
        recentOrders: periodOrders
    };

    let tabHtml = '';
    if (st.tab === 'customers') tabHtml = analyticsRenderCustomersTab(customerRows);
    else if (st.tab === 'products') tabHtml = analyticsRenderProductsTab(current, traffic, nameMap);
    else if (st.tab === 'orders') tabHtml = analyticsRenderOrdersTab(st.orders, range.startMs);
    else if (st.tab === 'funnel') tabHtml = analyticsRenderFunnelTab(funnel, traffic, current);
    else if (st.tab === 'engagement') tabHtml = analyticsRenderEngagementTab(traffic, st);
    else if (st.tab === 'growth') tabHtml = analyticsRenderGrowthTab(current, previous, traffic, ctx);
    else tabHtml = analyticsRenderOverview(ctx);

    const updated = st.lastLoadedAt
        ? 'Updated ' + new Date(st.lastLoadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '';

    root.innerHTML =
        analyticsRenderTodayPulse(todaySnapshot) +
        '<div class="admin-analytics-toolbar">' +
        '<div class="admin-analytics-periods">' +
        [1, 7, 30, 90, 0].map(function(d) {
            const label = d === 1 ? 'Today' : d === 0 ? 'All' : d + 'd';
            return '<button type="button" class="admin-analytics-period' + (st.periodDays === d ? ' active' : '') + '" onclick="setAdminAnalyticsPeriod(' + d + ')">' + label + '</button>';
        }).join('') + '</div>' +
        '<div class="admin-analytics-toolbar__right"><span class="admin-analytics-updated">' + updated + '</span>' +
        '<button type="button" class="btn-gold admin-analytics-refresh" onclick="loadAdminAnalytics(true)"><i class="fa fa-refresh"></i> Refresh</button></div></div>' +
        '<div class="admin-analytics-tabs">' +
        [['overview', 'Overview'], ['orders', 'Orders'], ['customers', 'Customers'], ['products', 'Products'], ['funnel', 'Funnel'], ['engagement', 'Engagement'], ['growth', 'Growth']].map(function(t) {
            return '<button type="button" class="admin-analytics-tab' + (st.tab === t[0] ? ' active' : '') + '" onclick="setAdminAnalyticsTab(\'' + t[0] + '\')">' + t[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="admin-analytics-body">' + tabHtml + '</div>';
}

window.setAdminAnalyticsPeriod = function(days) {
    window.adminAnalyticsState.periodDays = days;
    renderAdminAnalyticsDashboard();
};
window.setAdminAnalyticsTab = function(tab) {
    window.adminAnalyticsState.tab = tab || 'overview';
    renderAdminAnalyticsDashboard();
};
window.onAdminAnalyticsCustomerSearch = function(val) {
    window.adminAnalyticsState.customerSearch = val || '';
    renderAdminAnalyticsDashboard();
};
window.setAdminAnalyticsSegment = function(seg) {
    window.adminAnalyticsState.customerSegment = seg || 'all';
    renderAdminAnalyticsDashboard();
};
window.setAdminAnalyticsCustomerSort = function(sortKey) {
    window.adminAnalyticsState.customerSort = sortKey || 'ltv';
    renderAdminAnalyticsDashboard();
};

window.exportAdminAnalyticsCustomers = function() {
    const st = window.adminAnalyticsState;
    const range = analyticsComparisonRange(st.periodDays);
    const orderAgg = analyticsAggregateOrders(st.orders, range.startMs, 0);
    const rows = analyticsBuildCustomerRows(st.users, orderAgg);
    const header = ['Name', 'Email', 'Phone', 'Type', 'Segment', 'Visits', 'Last Seen', 'Orders', 'Last Order', 'LTV', 'Device'];
    const lines = [header.join(',')];
    rows.forEach(function(r) {
        lines.push([
            '"' + (r.name || '').replace(/"/g, '""') + '"',
            '"' + (r.email || '').replace(/"/g, '""') + '"',
            '"' + (r.phone || '').replace(/"/g, '""') + '"',
            r.isGuest ? 'Guest' : 'Registered',
            r.segment,
            r.visits,
            r.lastSeenMs ? new Date(r.lastSeenMs).toISOString() : '',
            r.orders,
            r.lastOrderMs ? new Date(r.lastOrderMs).toISOString() : '',
            r.ltv,
            r.lastDevice || ''
        ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'swagstree-customers-' + analyticsDayKeyExport() + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof showToast === 'function') showToast('Customer analytics exported');
};

window.exportAdminAnalyticsOrders = function() {
    const st = window.adminAnalyticsState;
    const range = analyticsComparisonRange(st.periodDays);
    const orders = st.orders.filter(function(o) {
        return analyticsInRange(analyticsTsToMs(o.timestamp), range.startMs, 0);
    });
    const header = ['Order ID', 'Customer', 'Email', 'Phone', 'Date', 'Status', 'Payment', 'Promo', 'Items', 'Subtotal', 'Discount', 'Total', 'Guest'];
    const lines = [header.join(',')];
    orders.forEach(function(o) {
        const items = (o.items || []).reduce(function(s, i) { return s + (Number(i.qty) || 1); }, 0);
        lines.push([
            '"' + (o.orderId || o.id || '').replace(/"/g, '""') + '"',
            '"' + (o.recipient || '').replace(/"/g, '""') + '"',
            '"' + (o.email || '').replace(/"/g, '""') + '"',
            '"' + (o.phone || '').replace(/"/g, '""') + '"',
            o.timestamp && o.timestamp.toDate ? o.timestamp.toDate().toISOString() : '',
            o.status || '',
            o.paymentMethod || '',
            o.promoCode || '',
            items,
            Number(o.subtotal) || 0,
            Number(o.discount) || 0,
            Number(o.total) || 0,
            o.isGuest ? 'yes' : 'no'
        ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'swagstree-orders-' + analyticsDayKeyExport() + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof showToast === 'function') showToast('Orders exported (' + orders.length + ')');
};

function analyticsDayKeyExport() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

window.toggleAdminAnalyticsAccordion = function() {
    const content = document.getElementById('admin-analytics-accordion-content');
    const icon = document.getElementById('admin-analytics-accordion-icon');
    if (!content) return;
    const open = content.style.display === 'none' || !content.style.display;
    content.style.display = open ? 'flex' : 'none';
    if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (open) loadAdminAnalytics();
};

function updateAdminAnalyticsUIVisibility() {
    const section = document.getElementById('admin-analytics-settings');
    if (!section) return;
    const isAdminUser = typeof isAdmin !== 'undefined' && isAdmin;
    const canView = typeof hasAdminCapability === 'function' ? hasAdminCapability('viewAnalytics') : isAdminUser;
    section.style.display = (isAdminUser && canView) ? 'block' : 'none';
}
window.updateAdminAnalyticsUIVisibility = updateAdminAnalyticsUIVisibility;

window.loadAdminAnalytics = async function(force) {
    const section = document.getElementById('admin-analytics-settings');
    const content = document.getElementById('admin-analytics-accordion-content');
    if (!section || section.style.display === 'none') return;
    if (content && content.style.display === 'none' && !force) return;

    const st = window.adminAnalyticsState;
    if (st.loading) return;
    if (st.loaded && !force) {
        renderAdminAnalyticsDashboard();
        return;
    }

    st.loading = true;
    renderAdminAnalyticsDashboard();

    try {
        const [ordersSnap, usersSnap, analyticsDoc, supportSnap, reviewsSnap, feedbacksSnap, announcementsSnap] = await Promise.all([
            db.collection('orders').orderBy('timestamp', 'desc').limit(3000).get(),
            db.collection('users').limit(4000).get(),
            db.collection('settings').doc('analytics').get(),
            db.collection('support_threads').limit(1500).get(),
            db.collection('product_comments').limit(2000).get(),
            db.collection('feedbacks').limit(500).get(),
            db.collection('announcements').limit(200).get()
        ]);

        st.orders = [];
        ordersSnap.forEach(function(doc) { st.orders.push(Object.assign({ id: doc.id }, doc.data())); });

        st.users = [];
        usersSnap.forEach(function(doc) { st.users.push(Object.assign({ uid: doc.id }, doc.data())); });

        st.storeAnalytics = analyticsDoc.exists ? analyticsDoc.data() : null;
        st.supportThreads = supportSnap.size;
        st.supportEscalations = 0;
        st.supportWaiting = 0;
        supportSnap.forEach(function(doc) {
            const d = doc.data() || {};
            if (d.escalateReason || d.escalatedAt) st.supportEscalations += 1;
            if (d.status === 'waiting_admin') st.supportWaiting += 1;
        });
        st.feedbackCount = feedbacksSnap.size;
        st.announcementCount = announcementsSnap.size;
        st.reviewCount = 0;
        st.pendingReviews = 0;
        st.wishlistUsers = 0;
        st.wishlistItems = 0;
        reviewsSnap.forEach(function(doc) {
            st.reviewCount += 1;
            if ((doc.data().status || '') === 'pending') st.pendingReviews += 1;
        });
        usersSnap.forEach(function(doc) {
            const wish = doc.data().wishlist;
            if (Array.isArray(wish) && wish.length) {
                st.wishlistUsers += 1;
                st.wishlistItems += wish.length;
            }
        });

        st.loaded = true;
        st.lastLoadedAt = Date.now();
    } catch (e) {
        console.error('loadAdminAnalytics error:', e);
        const root = document.getElementById('admin-analytics-dashboard');
        if (root) root.innerHTML = '<p class="admin-analytics-empty" style="color:var(--red);">Failed to load analytics. Try Refresh.</p>';
    } finally {
        st.loading = false;
        renderAdminAnalyticsDashboard();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    updateAdminAnalyticsUIVisibility();
});
