// ==========================================
// SWAG STREE | STORE ANALYTICS (tracking)
// ==========================================

(function() {
    const SESSION_KEY = 'swagstree_analytics_session';
    const LAST_VISIT_KEY = 'swagstree_analytics_last_visit';
    const RETURNING_KEY = 'swagstree_analytics_returning';
    const UTM_CAPTURED_KEY = 'swagstree_analytics_utm_captured';
    const VISIT_THROTTLE_MS = 30 * 60 * 1000;

    function analyticsDayKey(d) {
        const date = d || new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return y + m + day;
    }

    function analyticsPageKey(page) {
        return String(page || 'unknown').replace(/[.#$/\[\]]/g, '_').slice(0, 64);
    }

    function getAnalyticsDeviceType() {
        const w = window.innerWidth || 1024;
        const ua = navigator.userAgent || '';
        if (/tablet|ipad/i.test(ua) || (w >= 768 && w < 1024)) return 'tablet';
        if (w < 768 || /mobile|android|iphone|ipod/i.test(ua)) return 'mobile';
        return 'desktop';
    }

    function getAnalyticsSessionId() {
        try {
            let sid = sessionStorage.getItem(SESSION_KEY);
            if (!sid) {
                sid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
                sessionStorage.setItem(SESSION_KEY, sid);
            }
            return sid;
        } catch (e) {
            return 's_fallback';
        }
    }

    function shouldCountNewVisit() {
        try {
            const now = Date.now();
            const last = parseInt(sessionStorage.getItem(LAST_VISIT_KEY) || '0', 10);
            if (!last || (now - last) > VISIT_THROTTLE_MS) {
                sessionStorage.setItem(LAST_VISIT_KEY, String(now));
                return true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function isReturningStoreVisitor() {
        try {
            return !!localStorage.getItem(RETURNING_KEY);
        } catch (e) {
            return false;
        }
    }

    function markStoreVisitorReturning() {
        try {
            localStorage.setItem(RETURNING_KEY, '1');
        } catch (e) { /* ignore */ }
    }

    function readCapturedUtm() {
        try {
            const raw = sessionStorage.getItem('swagstree_utm_data');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function captureAnalyticsUtm() {
        if (typeof db === 'undefined' || !db) return;
        try {
            if (sessionStorage.getItem(UTM_CAPTURED_KEY)) return;
            const params = new URLSearchParams(window.location.search);
            const utm = {};
            ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(function(key) {
                const val = params.get(key);
                if (val) utm[key.replace('utm_', '')] = String(val).slice(0, 80);
            });
            if (!Object.keys(utm).length) return;

            sessionStorage.setItem(UTM_CAPTURED_KEY, '1');
            sessionStorage.setItem('swagstree_utm_data', JSON.stringify(utm));

            const dk = analyticsDayKey();
            const storeRef = db.collection('settings').doc('analytics');
            const updates = {
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            Object.keys(utm).forEach(function(k) {
                const uk = analyticsPageKey('utm_' + k + '_' + utm[k]);
                updates['daily.' + dk + '.utm.' + uk] = firebase.firestore.FieldValue.increment(1);
                updates['totals.utm.' + uk] = firebase.firestore.FieldValue.increment(1);
            });
            storeRef.set(updates, { merge: true }).catch(function() {});
        } catch (e) { /* ignore */ }
    }
    window.captureAnalyticsUtm = captureAnalyticsUtm;

    function trackAnalyticsPageView(page, meta) {
        if (!page || typeof db === 'undefined' || !db) return;

        const sessionId = getAnalyticsSessionId();
        const isNewVisit = shouldCountNewVisit();
        const isReturning = isNewVisit ? isReturningStoreVisitor() : false;
        if (isNewVisit && !isReturning) markStoreVisitorReturning();
        const dk = analyticsDayKey();
        const hour = String(new Date().getHours()).padStart(2, '0');
        const pageKey = analyticsPageKey(page);
        const device = getAnalyticsDeviceType();
        const extra = meta && typeof meta === 'object' ? meta : {};

        const storeRef = db.collection('settings').doc('analytics');
        const storeUpdates = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ['daily.' + dk + '.pageViews']: firebase.firestore.FieldValue.increment(1),
            ['daily.' + dk + '.pages.' + pageKey]: firebase.firestore.FieldValue.increment(1),
            ['daily.' + dk + '.hours.' + hour]: firebase.firestore.FieldValue.increment(1),
            ['daily.' + dk + '.devices.' + device]: firebase.firestore.FieldValue.increment(1),
            'totals.pageViews': firebase.firestore.FieldValue.increment(1)
        };
        if (isNewVisit) {
            storeUpdates['daily.' + dk + '.visits'] = firebase.firestore.FieldValue.increment(1);
            storeUpdates['totals.visits'] = firebase.firestore.FieldValue.increment(1);
            storeUpdates[isReturning ? 'daily.' + dk + '.returningVisits' : 'daily.' + dk + '.newVisits'] =
                firebase.firestore.FieldValue.increment(1);
        }
        if (extra.productId) {
            const pid = analyticsPageKey(String(extra.productId));
            storeUpdates['daily.' + dk + '.productViews.' + pid] = firebase.firestore.FieldValue.increment(1);
            storeUpdates['totals.productViews.' + pid] = firebase.firestore.FieldValue.increment(1);
        }
        storeRef.set(storeUpdates, { merge: true }).catch(function() {});

        if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
            const userRef = db.collection('users').doc(currentUser.uid);
            const userUpdates = {
                'analytics.lastSeenAt': firebase.firestore.FieldValue.serverTimestamp(),
                'analytics.lastPage': String(page),
                'analytics.lastDevice': device,
                'analytics.pageViewCount': firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (isNewVisit) {
                userUpdates['analytics.visitCount'] = firebase.firestore.FieldValue.increment(1);
                userUpdates['analytics.lastSessionId'] = sessionId;
                userUpdates['analytics.isReturning'] = isReturning;
            }
            if (extra.productId) {
                userUpdates['analytics.lastProductId'] = String(extra.productId);
            }
            const utm = readCapturedUtm();
            if (utm && isNewVisit) {
                userUpdates['analytics.lastUtm'] = utm;
            }
            userRef.set(userUpdates, { merge: true }).catch(function() {});

            if (isNewVisit && !isReturning) {
                userRef.set({
                    'analytics.firstSeenAt': firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true }).catch(function() {});
            }
        }
    }
    window.trackAnalyticsPageView = trackAnalyticsPageView;

    function trackAnalyticsEvent(eventName, payload) {
        if (!eventName || typeof db === 'undefined' || !db) return;
        const dk = analyticsDayKey();
        const hour = String(new Date().getHours()).padStart(2, '0');
        const eventKey = analyticsPageKey(eventName);
        const extra = payload && typeof payload === 'object' ? payload : {};
        const device = getAnalyticsDeviceType();

        const storeRef = db.collection('settings').doc('analytics');
        const updates = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            ['daily.' + dk + '.events.' + eventKey]: firebase.firestore.FieldValue.increment(1),
            ['daily.' + dk + '.eventHours.' + eventKey + '.' + hour]: firebase.firestore.FieldValue.increment(1),
            ['totals.events.' + eventKey]: firebase.firestore.FieldValue.increment(1)
        };
        if (extra.productId) {
            const pk = analyticsPageKey(String(extra.productId));
            updates['daily.' + dk + '.eventProducts.' + eventKey + '.' + pk] =
                firebase.firestore.FieldValue.increment(1);
        }
        const eventValue = Number(extra.value != null ? extra.value : extra.total) || 0;
        if (eventValue > 0) {
            updates['daily.' + dk + '.eventValue.' + eventKey] =
                firebase.firestore.FieldValue.increment(eventValue);
            if (eventKey === 'order_placed') {
                updates['daily.' + dk + '.revenue'] = firebase.firestore.FieldValue.increment(eventValue);
                updates['totals.revenue'] = firebase.firestore.FieldValue.increment(eventValue);
            }
        }
        storeRef.set(updates, { merge: true }).catch(function() {});

        if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
            const userPatch = {
                ['analytics.events.' + eventKey]: firebase.firestore.FieldValue.increment(1),
                'analytics.lastEvent': String(eventName),
                'analytics.lastEventAt': firebase.firestore.FieldValue.serverTimestamp(),
                'analytics.lastDevice': device,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            db.collection('users').doc(currentUser.uid).set(userPatch, { merge: true }).catch(function() {});
        }
    }
    window.trackAnalyticsEvent = trackAnalyticsEvent;

    function updateUserOrderAnalytics(uid, orderTotal, orderId, extra) {
        if (!uid || typeof db === 'undefined' || !db) return;
        const total = Number(orderTotal) || 0;
        const meta = extra && typeof extra === 'object' ? extra : {};
        const patch = {
            'analytics.lastOrderAt': firebase.firestore.FieldValue.serverTimestamp(),
            'analytics.lastOrderId': orderId || null,
            'analytics.orderCount': firebase.firestore.FieldValue.increment(1),
            'analytics.lifetimeValue': firebase.firestore.FieldValue.increment(total),
            lastOrderId: orderId || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (meta.paymentMethod) patch['analytics.lastPaymentMethod'] = String(meta.paymentMethod);
        if (meta.promoCode) patch['analytics.lastPromoCode'] = String(meta.promoCode);
        if (meta.email) patch.email = String(meta.email).toLowerCase();
        if (meta.displayName) patch.displayName = String(meta.displayName);
        if (meta.phone) patch.phone = String(meta.phone);
        db.collection('users').doc(uid).set(patch, { merge: true }).catch(function() {});
    }
    window.updateUserOrderAnalytics = updateUserOrderAnalytics;

    function trackAnalyticsSignup(method) {
        trackAnalyticsEvent('signup', { method: method || 'email' });
    }
    window.trackAnalyticsSignup = trackAnalyticsSignup;
})();
