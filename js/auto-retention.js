// Superadmin auto-retention: purge aged chat logs, mail records, comments, etc.
// Settings doc: settings/auto_retention

const AUTO_RETENTION_DOC = 'auto_retention';
const AUTO_RETENTION_RUN_MIN_MS = 60 * 60 * 1000; // throttle automatic runs to once per hour

const RETENTION_POLICY_DEFS = [
    {
        id: 'ai_chat_messages',
        label: 'AI Help Chat Messages',
        description: 'Old AI bot conversation messages in customer threads',
        defaultInterval: 'month'
    },
    {
        id: 'admin_support_messages',
        label: 'Live Support Chat Messages',
        description: 'Old human admin ↔ customer support messages',
        defaultInterval: 'year'
    },
    {
        id: 'empty_support_threads',
        label: 'Empty Support Threads',
        description: 'Thread shells with no messages left after cleanup',
        defaultInterval: 'month'
    },
    {
        id: 'backup_mail_logs',
        label: 'Backup Email Queue Logs',
        description: 'Firestore mail records sent to backup@swagstree.com',
        defaultInterval: 'month'
    },
    {
        id: 'rejected_comments',
        label: 'Rejected Product Reviews',
        description: 'Moderation rejects no longer needed for storefront',
        defaultInterval: 'year'
    },
    {
        id: 'old_announcements',
        label: 'Expired Announcements',
        description: 'Published announcement banners past retention age',
        defaultInterval: 'never'
    }
];

function retentionIntervalToMs(interval) {
    if (!interval || interval === 'never') return 0;
    if (interval === 'hour') return 60 * 60 * 1000;
    if (interval === 'day') return 24 * 60 * 60 * 1000;
    if (interval === 'week') return 7 * 24 * 60 * 60 * 1000;
    if (interval === 'month') return 30 * 24 * 60 * 60 * 1000;
    if (interval === 'year') return 365 * 24 * 60 * 60 * 1000;
    return 0;
}

function getDefaultRetentionPolicies() {
    const policies = {};
    RETENTION_POLICY_DEFS.forEach(def => {
        policies[def.id] = def.defaultInterval;
    });
    return policies;
}

function mergeRetentionPolicies(stored) {
    const merged = getDefaultRetentionPolicies();
    if (stored && typeof stored === 'object') {
        RETENTION_POLICY_DEFS.forEach(def => {
            if (typeof stored[def.id] === 'string') merged[def.id] = stored[def.id];
        });
    }
    return merged;
}

async function fetchRetentionSettingsDoc() {
    const snap = await db.collection('settings').doc(AUTO_RETENTION_DOC).get();
    if (!snap.exists) {
        return {
            policies: getDefaultRetentionPolicies(),
            lastRunTime: null,
            lastRunSummary: null
        };
    }
    const data = snap.data() || {};
    return {
        policies: mergeRetentionPolicies(data.policies),
        lastRunTime: data.lastRunTime || null,
        lastRunSummary: data.lastRunSummary || null
    };
}

function populateRetentionPolicySelects(policies) {
    RETENTION_POLICY_DEFS.forEach(def => {
        const el = document.getElementById(`auto-retention-${def.id}`);
        if (el) el.value = policies[def.id] || def.defaultInterval;
    });
}

function renderRetentionStatus(lastRunTime, lastRunSummary) {
    const statusEl = document.getElementById('auto-retention-status-text');
    if (!statusEl) return;

    if (!lastRunTime) {
        statusEl.innerHTML = '<i class="fa fa-clock-rotate-left"></i><div>Last cleanup: <b>Never</b><span class="retention-status-detail">No automatic cleanup has run yet.</span></div>';
        return;
    }

    const when = new Date(lastRunTime).toLocaleString();
    let detail = 'Database is up to date — nothing old enough to remove.';
    if (lastRunSummary && typeof lastRunSummary === 'object') {
        const parts = Object.entries(lastRunSummary)
            .filter(([, count]) => count > 0)
            .map(([key, count]) => `${count} ${key}`);
        if (parts.length) detail = `Removed: ${parts.join(', ')}.`;
    }
    statusEl.innerHTML = `<i class="fa fa-clock-rotate-left"></i><div>Last cleanup: <b>${when}</b><span class="retention-status-detail">${detail}</span></div>`;
}

async function purgeBackupMailLogsOlderThan(maxAgeMs) {
    if (!maxAgeMs || maxAgeMs <= 0) return 0;
    const cutoffMs = Date.now() - maxAgeMs;
    const snap = await db.collection('mail').where('to', '==', 'backup@swagstree.com').get();
    if (snap.empty) return 0;

    const refs = [];
    snap.forEach(doc => {
        const data = doc.data();
        const ts = data.createdAt?.toMillis?.() || data.delivery?.startTime?.toMillis?.() || 0;
        if (ts > 0 && ts < cutoffMs) refs.push(doc.ref);
    });
    if (!refs.length) return 0;

    let deleted = 0;
    let batchRefs = refs.slice();
    while (batchRefs.length) {
        const chunk = batchRefs.splice(0, 400);
        const batch = db.batch();
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
        deleted += chunk.length;
    }
    return deleted;
}

async function purgeRejectedCommentsOlderThan(maxAgeMs) {
    if (!maxAgeMs || maxAgeMs <= 0) return 0;
    const cutoffMs = Date.now() - maxAgeMs;
    const snap = await db.collection('product_comments').where('status', '==', 'rejected').get();
    if (snap.empty) return 0;

    const refs = [];
    snap.forEach(doc => {
        const ts = doc.data().createdAt?.toMillis?.() || 0;
        if (ts > 0 && ts < cutoffMs) refs.push(doc.ref);
    });
    if (!refs.length) return 0;

    let deleted = 0;
    let batchRefs = refs.slice();
    while (batchRefs.length) {
        const chunk = batchRefs.splice(0, 400);
        const batch = db.batch();
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
        deleted += chunk.length;
    }
    return deleted;
}

async function purgeOldAnnouncementsOlderThan(maxAgeMs) {
    if (!maxAgeMs || maxAgeMs <= 0) return 0;
    const cutoffMs = Date.now() - maxAgeMs;
    const snap = await db.collection('announcements').get();
    if (snap.empty) return 0;

    let deleted = 0;
    for (const doc of snap.docs) {
        const ts = doc.data().timestamp?.toMillis?.() || doc.data().lastUpdated?.toMillis?.() || 0;
        if (ts > 0 && ts < cutoffMs) {
            await doc.ref.delete();
            deleted++;
        }
    }
    return deleted;
}

async function runRetentionPolicy(policyId, interval) {
    const maxAgeMs = retentionIntervalToMs(interval);
    if (!maxAgeMs) return 0;

    if (policyId === 'ai_chat_messages') {
        return typeof purgeSupportMessagesOlderThan === 'function'
            ? await purgeSupportMessagesOlderThan(window.AI_CHANNEL || 'ai', maxAgeMs)
            : 0;
    }
    if (policyId === 'admin_support_messages') {
        return typeof purgeSupportMessagesOlderThan === 'function'
            ? await purgeSupportMessagesOlderThan(window.SUPPORT_CHANNEL || 'support', maxAgeMs)
            : 0;
    }
    if (policyId === 'empty_support_threads') {
        return typeof purgeEmptySupportThreadsOlderThan === 'function'
            ? await purgeEmptySupportThreadsOlderThan(maxAgeMs)
            : 0;
    }
    if (policyId === 'backup_mail_logs') return purgeBackupMailLogsOlderThan(maxAgeMs);
    if (policyId === 'rejected_comments') return purgeRejectedCommentsOlderThan(maxAgeMs);
    if (policyId === 'old_announcements') return purgeOldAnnouncementsOlderThan(maxAgeMs);
    return 0;
}

async function runAutoRetentionPurge(manual) {
    if (!isSuperAdmin) return null;

    const settings = await fetchRetentionSettingsDoc();
    const summary = {};
    let totalRemoved = 0;

    for (const def of RETENTION_POLICY_DEFS) {
        const interval = settings.policies[def.id] || def.defaultInterval;
        if (interval === 'never') continue;
        try {
            const count = await runRetentionPolicy(def.id, interval);
            summary[def.label] = count;
            totalRemoved += count;
        } catch (err) {
            console.error(`Auto-retention failed for ${def.id}:`, err);
            summary[def.label] = -1;
        }
    }

    const nowMs = Date.now();
    await db.collection('settings').doc(AUTO_RETENTION_DOC).set({
        policies: settings.policies,
        lastRunTime: nowMs,
        lastRunSummary: summary
    }, { merge: true });

    renderRetentionStatus(nowMs, summary);

    if (manual) {
        showToast(totalRemoved
            ? `Cleanup complete — ${totalRemoved} old record${totalRemoved === 1 ? '' : 's'} removed`
            : 'Cleanup complete — nothing was old enough to remove');
    } else if (totalRemoved > 0) {
        showToast(`🧹 Auto-cleanup removed ${totalRemoved} old record${totalRemoved === 1 ? '' : 's'}`);
    }

    return { totalRemoved, summary };
}

async function checkAndRunAutoRetention() {
    if (!isSuperAdmin) return;
    try {
        const settings = await fetchRetentionSettingsDoc();
        const hasActivePolicy = RETENTION_POLICY_DEFS.some(def => {
            const interval = settings.policies[def.id] || def.defaultInterval;
            return interval !== 'never';
        });
        if (!hasActivePolicy) {
            renderRetentionStatus(settings.lastRunTime, settings.lastRunSummary);
            return;
        }

        const now = Date.now();
        if (settings.lastRunTime && (now - settings.lastRunTime) < AUTO_RETENTION_RUN_MIN_MS) {
            renderRetentionStatus(settings.lastRunTime, settings.lastRunSummary);
            return;
        }

        await runAutoRetentionPurge(false);
    } catch (err) {
        console.error('checkAndRunAutoRetention error:', err);
    }
}

async function loadAutoRetentionSettings() {
    if (!isSuperAdmin) return;
    try {
        const settings = await fetchRetentionSettingsDoc();
        populateRetentionPolicySelects(settings.policies);
        renderRetentionStatus(settings.lastRunTime, settings.lastRunSummary);
        await checkAndRunAutoRetention();
    } catch (err) {
        console.error('loadAutoRetentionSettings error:', err);
    }
}

async function saveAutoRetentionSettings() {
    if (!isSuperAdmin) return showToast('Only superadmin can save retention settings.');
    const policies = {};
    RETENTION_POLICY_DEFS.forEach(def => {
        const el = document.getElementById(`auto-retention-${def.id}`);
        policies[def.id] = el ? el.value : def.defaultInterval;
    });

    try {
        await db.collection('settings').doc(AUTO_RETENTION_DOC).set({ policies }, { merge: true });
        showToast('Retention settings saved.');
        await loadAutoRetentionSettings();
    } catch (err) {
        console.error('saveAutoRetentionSettings error:', err);
        showToast('Failed to save retention settings.');
    }
}

async function triggerManualAutoRetention() {
    if (!isSuperAdmin) return showToast('Only superadmin can run cleanup.');
    if (!confirm(
        'Clean up old data now?\n\n' +
        'This permanently deletes records OLDER than each rule below.\n' +
        'Recent chats, orders, products & customers are NOT affected.\n\n' +
        'Continue?'
    )) {
        return;
    }

    const policies = {};
    RETENTION_POLICY_DEFS.forEach(def => {
        const el = document.getElementById(`auto-retention-${def.id}`);
        policies[def.id] = el ? el.value : def.defaultInterval;
    });

    showToast('Running cleanup…');
    try {
        await db.collection('settings').doc(AUTO_RETENTION_DOC).set({ policies }, { merge: true });
        await runAutoRetentionPurge(true);
    } catch (err) {
        console.error('triggerManualAutoRetention error:', err);
        showToast('Cleanup failed.');
    }
}

window.loadAutoRetentionSettings = loadAutoRetentionSettings;
window.saveAutoRetentionSettings = saveAutoRetentionSettings;
window.triggerManualAutoRetention = triggerManualAutoRetention;
window.checkAndRunAutoRetention = checkAndRunAutoRetention;
