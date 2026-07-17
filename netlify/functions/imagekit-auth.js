const crypto = require('crypto');

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAKXSFKuhQXMGvmtjh0CHnz48vbYz9a_4A';
const IMAGEKIT_DEFAULT_PUBLIC_KEY = 'public_3H/K75xEHd17m+AitdItZIZQuNo=';
const IMAGEKIT_DEFAULT_URL_ENDPOINT = 'https://ik.imagekit.io/fenbexha5';

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400'
    };
}

async function verifyFirebaseToken(idToken) {
    if (!idToken || !FIREBASE_API_KEY) return false;
    const resp = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        }
    );
    const data = await resp.json();
    return resp.ok && Array.isArray(data.users) && data.users.length > 0;
}

exports.handler = async function imagekitAuthHandler(event) {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
            body: JSON.stringify({ ok: false, error: 'Method not allowed' })
        };
    }

    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const idToken = match ? match[1].trim() : '';
    if (!(await verifyFirebaseToken(idToken))) {
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
            body: JSON.stringify({ ok: false, error: 'Unauthorized — login required.' })
        };
    }

    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    if (!privateKey) {
        return {
            statusCode: 503,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
            body: JSON.stringify({
                ok: false,
                error: 'IMAGEKIT_PRIVATE_KEY is not set. Add it in Netlify → Site configuration → Environment variables (private_… from ImageKit dashboard → API keys).'
            })
        };
    }

    const token = crypto.randomBytes(16).toString('hex');
    const expire = Math.floor(Date.now() / 1000) + 3600;
    const signature = crypto.createHmac('sha1', privateKey).update(token + String(expire)).digest('hex');
    const publicKey = (process.env.IMAGEKIT_PUBLIC_KEY || IMAGEKIT_DEFAULT_PUBLIC_KEY).trim();
    const folder = (process.env.IMAGEKIT_FOLDER || '/swagstree').trim();
    const urlEndpoint = (process.env.IMAGEKIT_URL_ENDPOINT || IMAGEKIT_DEFAULT_URL_ENDPOINT).trim().replace(/\/$/, '');

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders() },
        body: JSON.stringify({ ok: true, token, expire, signature, publicKey, folder, urlEndpoint })
    };
};
