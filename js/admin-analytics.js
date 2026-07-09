// ==========================================
// SWAG STREE | ADMIN ANALYTICS DASHBOARD
// ==========================================

Object.assign(window.ADMIN_CAPABILITY_DEFS || {}, {
    viewAnalytics: {
        id: 'viewAnalytics',
        label: 'View Store Analytics',
        icon: 'fa-line-chart',
        description: 'Revenue, visits, customers, and product performance insights'
    }
});

window.adminAnalyticsState = window.adminAnalyticsState || {
    periodDays: 30,
    tab: 'overview',
    loaded: false,
    loading: false,
    orders: [],
    users: [],
    storeAnalytics: null,
    productNameMap: {}
};

const ADMIN_ANALYTICS_EXCLUDED_STATUSES = new Set(['cancelled', 'returned']);

function analyticsTsToMs(ts) {
    if (!ts) return 0;
    if (typeof ts.toMillis === 'function') return ts.toMillis();
    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
    if (ts instanceof Date) return ts.getTime();
    if (typeof ts === 'number') return ts;
    return 0;
}

function analyticsFormatCurrency(n) {
    const val = Number(n) || 0;
    return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 0 });
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

function analyticsOrderRevenue(order) {
    if (!order) return 0;
    const status = (order.status || '').toLowerCase();
    if (ADMIN_ANALYTICS_EXCLUDED_STATUSES.has(status)) return 0;
    return Number(order.total) || 0;
}

function analyticsIsOrderInPeriod(order, startMs) {
    const ts = analyticsTsToMs(order.timestamp);
    return !startMs || ts >= startMs;
}

function analyticsBuildProductNameMap() {
    const map = {};
    const products = window.products || [];
    products.forEach(function(p) {
        if (p && p.id) map[p.id] = p.name || p.title || p.id;
    });
    window.adminAnalyticsState.productNameMap = map;
    return map;
}

function analyticsAggregateOrders(orders, startMs) {
    const filtered = orders.filter(function(o) { return analyticsIsOrderInPeriod(o, startMs); });
    let revenue = 0;
    let units = 0;
    const statusCounts = {};
    const paymentCounts = {};
    const productStats = {};
    const dailyRevenue = {};
    const customerOrderMap = {};

    filtered.forEach(function(o) {
        const rev = analyticsOrderRevenue(o);
        revenue += rev;
        const status = (o.status || 'pending').toLowerCase();
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        const pay = (o.paymentMethod || 'unknown').toLowerCase();
        paymentCounts[pay] = (paymentCounts[pay] || 0) + 1;

        const ts = analyticsTsToMs(o.timestamp);
        if (ts) {
            const dk = new Date(ts);
            const key = dk.getFullYear() + '-' + String(dk.getMonth() + 1).padStart(2, '0') + '-' + String(dk.getDate()).padStart(2, '0');
            dailyRevenue[key] = (dailyRevenue[key] || 0) + rev;
        }

        const custKey = (o.uid || o.email || o.phone || 'guest').toLowerCase();
        if (!customerOrderMap[custKey]) {
            customerOrderMap[custKey] = { count: 0, revenue: 0, lastMs: 0 };
        }
        customerOrderMap[custKey].count += 1;
        customerOrderMap[custKey].revenue += rev;
        if (ts > customerOrderMap[custKey].lastMs) customerOrderMap[custKey].lastMs = ts;

        (o.items || []).forEach(function(item) {
            const qty = Number(item.qty) || 1;
            units += qty;
            const pid = item.id || item.productId || 'unknown';
            if (!productStats[pid]) {
                productStats[pid] = { id: pid, name: item.name || pid, units: 0, revenue: 0, orders: 0 };
            }
            productStats[pid].units += qty;
            productStats[pid].revenue += (Number(item.price) || 0) * qty;
            productStats[pid].orders += 1;
        });
    });

    const orderCount = filtered.length;
    const aov = orderCount ? Math.round(revenue / orderCount) : 0;
    const uniqueCustomers = Object.keys(customerOrderMap).length;

    const topProducts = Object.values(productStats)
        .sort(function(a, b) { return b.revenue - a.revenue; })
        .slice(0, 10);

    const dailyKeys = Object.keys(dailyRevenue).sort();
    const chartDays = dailyKeys.slice(-14);
    const chartMax = chartDays.reduce(function(m, k) { return Math.max(m, dailyRevenue[k] || 0); }, 1);

    return {
        orderCount,
        revenue,
        aov,
        units,
        uniqueCustomers,
        statusCounts,
        paymentCounts,
        topProducts,
        dailyRevenue,
        chartDays,
        chartMax,
        customerOrderMap
    };
}

function analyticsAggregateTraffic(storeData, startMs) {
    const daily = (storeData && storeData.daily) || {};
    const totals = (storeData && storeData.totals) || {};
    let visits = 0;
    let pageViews = 0;
    const pageBreakdown = {};
    const eventBreakdown = {};

    Object.keys(daily).forEach(function(dk) {
        const dayMs = analyticsDayKeyToMs(dk);
        if (startMs && dayMs < startMs) return;
        const row = daily[dk] || {};
        visits += Number(row.visits) || 0;
        pageViews += Number(row.pageViews) || 0;
        const pages = row.pages || {};
        Object.keys(pages).forEach(function(pk) {
            pageBreakdown[pk] = (pageBreakdown[pk] || 0) + (Number(pages[pk]) || 0);
        });
        const events = row.events || {};
        Object.keys(events).forEach(function(ek) {
            eventBreakdown[ek] = (eventBreakdown[ek] || 0) + (Number(events[ek]) || 0);
        });
    });

    if (!startMs) {
        visits = Number(totals.visits) || visits;
        pageViews = Number(totals.pageViews) || pageViews;
    }

    const topPages = Object.entries(pageBreakdown)
        .sort(function(a, b) { return b[1] - a[1]; })
        .slice(0, 8);

    return { visits, pageViews, topPages, eventBreakdown };
}

function analyticsDayKeyToMs(dk) {
    if (!dk || dk.length !== 8) return 0;
    const y = parseInt(dk.slice(0, 4), 10);
    const m = parseInt(dk.slice(4, 6), 10) - 1;
    const d = parseInt(dk.slice(6, 8), 10);
    return new Date(y, m, d).getTime();
}

function analyticsBuildCustomerRows(users, orderAgg, nameMap) {
    const rows = [];
    const seen = new Set();

    (users || []).forEach(function(u) {
        const email = (u.email || '').toLowerCase();
        const key = (u.uid || email || '').toLowerCase();
        if (!key || seen.has(key)) return;
        seen.add(key);

        const orderInfo = orderAgg.customerOrderMap[key] ||
            (email ? orderAgg.customerOrderMap[email] : null) || { count: 0, revenue: 0, lastMs: 0 };
        const a = u.analytics || {};

        rows.push({
            uid: u.uid,
            name: u.displayName || (email ? email.split('@')[0] : 'Customer'),
            email: email || '—',
            phone: u.phone || '—',
            isGuest: !!u.isGuest || !!u.guestCheckout,
            visits: Number(a.visitCount) || 0,
            pageViews: Number(a.pageViewCount) || 0,
            lastSeenMs: analyticsTsToMs(a.lastSeenAt),
            lastPage: a.lastPage || '—',
            orders: Math.max(Number(a.orderCount) || 0, orderInfo.count),
            lastOrderMs: Math.max(analyticsTsToMs(a.lastOrderAt), orderInfo.lastMs),
            ltv: Math.max(Number(a.lifetimeValue) || 0, orderInfo.revenue),
            createdMs: analyticsTsToMs(u.createdAt)
        });
    });

    Object.keys(orderAgg.customerOrderMap).forEach(function(key) {
        if (seen.has(key)) return;
        const info = orderAgg.customerOrderMap[key];
        rows.push({
            uid: key,
            name: key.includes('@') ? key.split('@')[0] : 'Guest',
            email: key.includes('@') ? key : '—',
            phone: !key.includes('@') ? key : '—',
            isGuest: true,
            visits: 0,
            pageViews: 0,
            lastSeenMs: 0,
            lastPage: '—',
            orders: info.count,
            lastOrderMs: info.lastMs,
            ltv: info.revenue,
            createdMs: 0
        });
        seen.add(key);
    });

    rows.sort(function(a, b) {
        if (b.ltv !== a.ltv) return b.ltv - a.ltv;
        return b.lastSeenMs - a.lastSeenMs;
    });
    return rows;
}

function analyticsRenderKpiCard(label, value, sub, accent) {
    return '<div class="admin-analytics-kpi">' +
        '<span class="admin-analytics-kpi__label">' + label + '</span>' +
        '<span class="admin-analytics-kpi__value" style="color:' + (accent || 'var(--gold)') + '">' + value + '</span>' +
        (sub ? '<span class="admin-analytics-kpi__sub">' + sub + '</span>' : '') +
        '</div>';
}

function analyticsRenderBarChart(chartDays, dailyRevenue, chartMax) {
    if (!chartDays.length) {
        return '<p class="admin-analytics-empty">No revenue in this period yet.</p>';
    }
    return '<div class="admin-analytics-chart">' + chartDays.map(function(key) {
        const val = dailyRevenue[key] || 0;
        const pct = Math.max(4, Math.round((val / chartMax) * 100));
        const label = key.slice(5);
        return '<div class="admin-analytics-chart__col" title="' + analyticsFormatCurrency(val) + ' on ' + key + '">' +
            '<div class="admin-analytics-chart__bar" style="height:' + pct + '%"></div>' +
            '<span class="admin-analytics-chart__label">' + label + '</span>' +
            '</div>';
    }).join('') + '</div>';
}

function analyticsRenderStatusBreakdown(statusCounts) {
    const entries = Object.entries(statusCounts).sort(function(a, b) { return b[1] - a[1]; });
    if (!entries.length) return '<p class="admin-analytics-empty">No orders in period.</p>';
    const total = entries.reduce(function(s, e) { return s + e[1]; }, 0);
    return '<div class="admin-analytics-breakdown">' + entries.map(function(pair) {
        const pct = total ? Math.round((pair[1] / total) * 100) : 0;
        return '<div class="admin-analytics-breakdown__row">' +
            '<span class="admin-analytics-breakdown__label">' + pair[0].replace(/_/g, ' ') + '</span>' +
            '<div class="admin-analytics-breakdown__track"><div class="admin-analytics-breakdown__fill" style="width:' + pct + '%"></div></div>' +
            '<span class="admin-analytics-breakdown__count">' + pair[1] + ' (' + pct + '%)</span>' +
            '</div>';
    }).join('') + '</div>';
}

function analyticsRenderOverviewTab(orderAgg, traffic, periodLabel) {
    const conversion = traffic.visits > 0
        ? ((orderAgg.orderCount / traffic.visits) * 100).toFixed(1) + '%'
        : '—';

    const kpis = '<div class="admin-analytics-kpi-grid">' +
        analyticsRenderKpiCard('Revenue', analyticsFormatCurrency(orderAgg.revenue), periodLabel) +
        analyticsRenderKpiCard('Orders', String(orderAgg.orderCount), orderAgg.units + ' items sold', '#2ecc71') +
        analyticsRenderKpiCard('Avg order', analyticsFormatCurrency(orderAgg.aov), 'AOV', '#3498db') +
        analyticsRenderKpiCard('Customers', String(orderAgg.uniqueCustomers), 'with orders', '#9b59b6') +
        analyticsRenderKpiCard('Visits', String(traffic.visits), traffic.pageViews + ' page views', '#e67e22') +
        analyticsRenderKpiCard('Conversion', conversion, 'orders / visits', '#1abc9c') +
        '</div>';

    const chart = '<div class="admin-analytics-panel">' +
        '<h5 class="admin-analytics-panel__title"><i class="fa fa-bar-chart"></i> Revenue trend (last 14 days in range)</h5>' +
        analyticsRenderBarChart(orderAgg.chartDays, orderAgg.dailyRevenue, orderAgg.chartMax) +
        '</div>';

    const statusPanel = '<div class="admin-analytics-panel">' +
        '<h5 class="admin-analytics-panel__title"><i class="fa fa-pie-chart"></i> Order status</h5>' +
        analyticsRenderStatusBreakdown(orderAgg.statusCounts) +
        '</div>';

    const payEntries = Object.entries(orderAgg.paymentCounts).sort(function(a, b) { return b[1] - a[1]; });
    const payHtml = payEntries.length
        ? '<div class="admin-analytics-pills">' + payEntries.map(function(p) {
            return '<span class="admin-analytics-pill">' + p[0].toUpperCase() + ': <strong>' + p[1] + '</strong></span>';
        }).join('') + '</div>'
        : '<p class="admin-analytics-empty">No payment data.</p>';

    const trafficPages = traffic.topPages.length
        ? '<div class="admin-analytics-pills">' + traffic.topPages.map(function(p) {
            return '<span class="admin-analytics-pill">' + p[0].replace(/_/g, ' ') + ': <strong>' + p[1] + '</strong></span>';
        }).join('') + '</div>'
        : '<p class="admin-analytics-empty">No page views tracked yet. Traffic builds as customers browse.</p>';

    return kpis +
        '<div class="admin-analytics-split">' + chart + statusPanel + '</div>' +
        '<div class="admin-analytics-split">' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-credit-card"></i> Payment methods</h5>' + payHtml + '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-eye"></i> Top pages</h5>' + trafficPages + '</div>' +
        '</div>';
}

function analyticsRenderProductsTab(orderAgg, nameMap) {
    if (!orderAgg.topProducts.length) {
        return '<p class="admin-analytics-empty">No product sales in this period.</p>';
    }
    const rows = orderAgg.topProducts.map(function(p, i) {
        const name = nameMap[p.id] || p.name || p.id;
        return '<tr>' +
            '<td>' + (i + 1) + '</td>' +
            '<td class="admin-analytics-table__name">' + name + '</td>' +
            '<td>' + p.units + '</td>' +
            '<td>' + p.orders + '</td>' +
            '<td><strong>' + analyticsFormatCurrency(p.revenue) + '</strong></td>' +
            '</tr>';
    }).join('');
    return '<div class="admin-analytics-table-wrap"><table class="admin-analytics-table">' +
        '<thead><tr><th>#</th><th>Product</th><th>Units</th><th>Line items</th><th>Revenue</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table></div>';
}

function analyticsRenderCustomersTab(rows) {
    const q = (window.adminAnalyticsState.customerSearch || '').toLowerCase().trim();
    const filtered = q ? rows.filter(function(r) {
        return (r.name || '').toLowerCase().includes(q) ||
            (r.email || '').toLowerCase().includes(q) ||
            (r.phone || '').includes(q);
    }) : rows;

    const display = filtered.slice(0, 50);
    if (!display.length) {
        return '<p class="admin-analytics-empty">No customers match your search.</p>';
    }

    const body = display.map(function(r) {
        const tag = r.isGuest
            ? '<span class="admin-analytics-tag admin-analytics-tag--guest">Guest</span>'
            : '<span class="admin-analytics-tag">Registered</span>';
        return '<tr>' +
            '<td class="admin-analytics-table__name">' + (r.name || '—') + ' ' + tag + '</td>' +
            '<td>' + r.email + '</td>' +
            '<td>' + r.visits + '</td>' +
            '<td>' + analyticsFormatRelative(r.lastSeenMs) + '</td>' +
            '<td>' + r.orders + '</td>' +
            '<td>' + analyticsFormatShortDate(r.lastOrderMs) + '</td>' +
            '<td><strong>' + analyticsFormatCurrency(r.ltv) + '</strong></td>' +
            '</tr>';
    }).join('');

    return '<div class="admin-analytics-customer-search">' +
        '<i class="fa fa-search"></i>' +
        '<input type="search" placeholder="Search name, email, phone..." value="' + (window.adminAnalyticsState.customerSearch || '').replace(/"/g, '&quot;') + '" oninput="onAdminAnalyticsCustomerSearch(this.value)">' +
        '</div>' +
        '<div class="admin-analytics-table-wrap admin-analytics-table-wrap--tall"><table class="admin-analytics-table">' +
        '<thead><tr><th>Customer</th><th>Email</th><th>Visits</th><th>Last seen</th><th>Orders</th><th>Last order</th><th>LTV</th></tr></thead>' +
        '<tbody>' + body + '</tbody></table></div>' +
        (filtered.length > 50 ? '<p class="admin-analytics-footnote">Showing top 50 of ' + filtered.length + ' customers by lifetime value.</p>' : '');
}

function analyticsRenderTrafficTab(traffic, orderAgg) {
    const events = Object.entries(traffic.eventBreakdown || {}).sort(function(a, b) { return b[1] - a[1]; });
    const eventsHtml = events.length
        ? '<div class="admin-analytics-pills">' + events.map(function(e) {
            return '<span class="admin-analytics-pill">' + e[0].replace(/_/g, ' ') + ': <strong>' + e[1] + '</strong></span>';
        }).join('') + '</div>'
        : '<p class="admin-analytics-empty">Events like add_to_cart and checkout will appear here as customers shop.</p>';

    return '<div class="admin-analytics-kpi-grid admin-analytics-kpi-grid--compact">' +
        analyticsRenderKpiCard('Store visits', String(traffic.visits), 'Unique sessions (30 min)', '#e67e22') +
        analyticsRenderKpiCard('Page views', String(traffic.pageViews), 'All screens', '#3498db') +
        analyticsRenderKpiCard('Orders placed', String(orderAgg.orderCount), analyticsFormatCurrency(orderAgg.revenue), '#2ecc71') +
        '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-mouse-pointer"></i> Shopping events</h5>' + eventsHtml + '</div>' +
        '<div class="admin-analytics-panel"><h5 class="admin-analytics-panel__title"><i class="fa fa-sitemap"></i> Page popularity</h5>' +
        (traffic.topPages.length
            ? '<div class="admin-analytics-breakdown">' + traffic.topPages.map(function(p) {
                const pct = traffic.pageViews ? Math.round((p[1] / traffic.pageViews) * 100) : 0;
                return '<div class="admin-analytics-breakdown__row">' +
                    '<span class="admin-analytics-breakdown__label">' + p[0].replace(/_/g, ' ') + '</span>' +
                    '<div class="admin-analytics-breakdown__track"><div class="admin-analytics-breakdown__fill admin-analytics-breakdown__fill--blue" style="width:' + Math.max(pct, 2) + '%"></div></div>' +
                    '<span class="admin-analytics-breakdown__count">' + p[1] + '</span></div>';
            }).join('') + '</div>'
            : '<p class="admin-analytics-empty">Browse tracking starts after this update is live.</p>') +
        '</div>';
}

function renderAdminAnalyticsDashboard() {
    const root = document.getElementById('admin-analytics-dashboard');
    if (!root) return;

    const st = window.adminAnalyticsState;
    const startMs = analyticsPeriodStartMs(st.periodDays);
    const periodLabel = st.periodDays === 1 ? 'Today' : st.periodDays === 0 ? 'All time' : 'Last ' + st.periodDays + ' days';

    if (st.loading) {
        root.innerHTML = '<div class="admin-analytics-loading"><div class="premium-loader"></div><p>Loading analytics…</p></div>';
        return;
    }

    const nameMap = analyticsBuildProductNameMap();
    const orderAgg = analyticsAggregateOrders(st.orders, startMs);
    const traffic = analyticsAggregateTraffic(st.storeAnalytics, startMs);
    const customerRows = analyticsBuildCustomerRows(st.users, orderAgg, nameMap);

    let tabHtml = '';
    if (st.tab === 'products') tabHtml = analyticsRenderProductsTab(orderAgg, nameMap);
    else if (st.tab === 'customers') tabHtml = analyticsRenderCustomersTab(customerRows);
    else if (st.tab === 'traffic') tabHtml = analyticsRenderTrafficTab(traffic, orderAgg);
    else tabHtml = analyticsRenderOverviewTab(orderAgg, traffic, periodLabel);

    const updated = st.lastLoadedAt
        ? 'Updated ' + new Date(st.lastLoadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
        : '';

    root.innerHTML =
        '<div class="admin-analytics-toolbar">' +
        '<div class="admin-analytics-periods">' +
        [1, 7, 30, 90, 0].map(function(d) {
            const label = d === 1 ? 'Today' : d === 0 ? 'All' : d + 'd';
            const active = st.periodDays === d ? ' active' : '';
            return '<button type="button" class="admin-analytics-period' + active + '" onclick="setAdminAnalyticsPeriod(' + d + ')">' + label + '</button>';
        }).join('') +
        '</div>' +
        '<div class="admin-analytics-toolbar__right">' +
        '<span class="admin-analytics-updated">' + updated + '</span>' +
        '<button type="button" class="btn-gold admin-analytics-refresh" onclick="loadAdminAnalytics(true)"><i class="fa fa-refresh"></i> Refresh</button>' +
        '</div></div>' +
        '<div class="admin-analytics-tabs">' +
        ['overview', 'customers', 'products', 'traffic'].map(function(t) {
            const labels = { overview: 'Overview', customers: 'Customers', products: 'Products', traffic: 'Traffic' };
            const active = st.tab === t ? ' active' : '';
            return '<button type="button" class="admin-analytics-tab' + active + '" onclick="setAdminAnalyticsTab(\'' + t + '\')">' + labels[t] + '</button>';
        }).join('') +
        '</div>' +
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

window.toggleAdminAnalyticsAccordion = function() {
    const content = document.getElementById('admin-analytics-accordion-content');
    const icon = document.getElementById('admin-analytics-accordion-icon');
    if (!content) return;
    const open = content.style.display === 'none' || !content.style.display;
    content.style.display = open ? 'flex' : 'none';
    if (icon) icon.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';
    if (open && typeof loadAdminAnalytics === 'function') loadAdminAnalytics();
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
        const ordersSnap = await db.collection('orders').orderBy('timestamp', 'desc').limit(2500).get();
        st.orders = [];
        ordersSnap.forEach(function(doc) {
            st.orders.push(Object.assign({ id: doc.id }, doc.data()));
        });

        const usersSnap = await db.collection('users').limit(3000).get();
        st.users = [];
        usersSnap.forEach(function(doc) {
            st.users.push(Object.assign({ uid: doc.id }, doc.data()));
        });

        const analyticsDoc = await db.collection('settings').doc('analytics').get();
        st.storeAnalytics = analyticsDoc.exists ? analyticsDoc.data() : null;

        st.loaded = true;
        st.lastLoadedAt = Date.now();
    } catch (e) {
        console.error('loadAdminAnalytics error:', e);
        const root = document.getElementById('admin-analytics-dashboard');
        if (root) {
            root.innerHTML = '<p class="admin-analytics-empty" style="color:var(--red);">Failed to load analytics. Check connection and try Refresh.</p>';
        }
    } finally {
        st.loading = false;
        renderAdminAnalyticsDashboard();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    updateAdminAnalyticsUIVisibility();
});
