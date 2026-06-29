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
 * - CLOUDINARY_ASSET_PREFIX (e.g. swagstree) — also purge orphans under this folder prefix
 */

const SUPER_ADMIN_DEFAULT = 'superadmin@swagstree.com';
const BATCH_SIZE = 100;

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

        if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
            return new Response(null, { status: 204, headers: corsHeaders() });
        }

        if (url.pathname === '/api/cloudinary/purge' && request.method === 'POST') {
            const resp = await purgeCloudinaryAssets(request, env);
            const headers = new Headers(resp.headers);
            Object.entries(corsHeaders()).forEach(([k, v]) => headers.set(k, v));
            return new Response(resp.body, { status: resp.status, headers });
        }

        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not Found', { status: 404 });
    }
};
