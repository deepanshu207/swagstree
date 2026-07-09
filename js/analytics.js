// ==========================================
// SWAG STREE | STORE ANALYTICS (tracking)
// ==========================================

(function() {
    const SESSION_KEY = 'swagstree_analytics_session';
    const LAST_VISIT_KEY = 'swagstree_analytics_last_visit';
    const VISIT_THROTTLE_MS = 30 * 60 * 1000;

    function analyticsDayKey(d) {
        const date = d || new Date();
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${y}${m}${day}`;
    }

    function analyticsPageKey(page) {
        return String(page || 'unknown').replace(/[.#$/\[\]]/g, '_').slice(0, 64);
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

    function trackAnalyticsPageView(page, meta) {
        if (!page || typeof db === 'undefined' || !db) return;

        const sessionId = getAnalyticsSessionId();
        const isNewVisit = shouldCountNewVisit();
        const dk = analyticsDayKey();
        const pageKey = analyticsPageKey(page);
        const extra = meta && typeof meta === 'object' ? meta : {};

        const storeRef = db.collection('settings').doc('analytics');
        const storeUpdates = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            [`daily.${dk}.pageViews`]: firebase.firestore.FieldValue.increment(1),
            [`daily.${dk}.pages.${pageKey}`]: firebase.firestore.FieldValue.increment(1),
            'totals.pageViews': firebase.firestore.FieldValue.increment(1)
        };
        if (isNewVisit) {
            storeUpdates[`daily.${dk}.visits`] = firebase.firestore.FieldValue.increment(1);
            storeUpdates['totals.visits'] = firebase.firestore.FieldValue.increment(1);
        }
        if (extra.productId) {
            const pid = analyticsPageKey('product_' + extra.productId);
            storeUpdates[`daily.${dk}.productViews.${pid}`] = firebase.firestore.FieldValue.increment(1);
        }
        storeRef.set(storeUpdates, { merge: true }).catch(function() {});

        if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
            const userRef = db.collection('users').doc(currentUser.uid);
            const userUpdates = {
                'analytics.lastSeenAt': firebase.firestore.FieldValue.serverTimestamp(),
                'analytics.lastPage': String(page),
                'analytics.pageViewCount': firebase.firestore.FieldValue.increment(1),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (isNewVisit) {
                userUpdates['analytics.visitCount'] = firebase.firestore.FieldValue.increment(1);
                userUpdates['analytics.lastSessionId'] = sessionId;
            }
            if (extra.productId) {
                userUpdates['analytics.lastProductId'] = String(extra.productId);
            }
            userRef.set(userUpdates, { merge: true }).catch(function() {});
        }
    }
    window.trackAnalyticsPageView = trackAnalyticsPageView;

    function trackAnalyticsEvent(eventName, payload) {
        if (!eventName || typeof db === 'undefined' || !db) return;
        const dk = analyticsDayKey();
        const eventKey = analyticsPageKey(eventName);
        const storeRef = db.collection('settings').doc('analytics');
        const updates = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            [`daily.${dk}.events.${eventKey}`]: firebase.firestore.FieldValue.increment(1),
            [`totals.events.${eventKey}`]: firebase.firestore.FieldValue.increment(1)
        };
        storeRef.set(updates, { merge: true }).catch(function() {});

        if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) {
            db.collection('users').doc(currentUser.uid).set({
                [`analytics.events.${eventKey}`]: firebase.firestore.FieldValue.increment(1),
                'analytics.lastEvent': String(eventName),
                'analytics.lastEventAt': firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true }).catch(function() {});
        }
    }
    window.trackAnalyticsEvent = trackAnalyticsEvent;

    function updateUserOrderAnalytics(uid, orderTotal, orderId) {
        if (!uid || typeof db === 'undefined' || !db) return;
        const total = Number(orderTotal) || 0;
        db.collection('users').doc(uid).set({
            analytics: {
                lastOrderAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastOrderId: orderId || null,
                orderCount: firebase.firestore.FieldValue.increment(1),
                lifetimeValue: firebase.firestore.FieldValue.increment(total)
            },
            lastOrderId: orderId || null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(function() {});
    }
    window.updateUserOrderAnalytics = updateUserOrderAnalytics;
})();
