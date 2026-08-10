// ============================================
// Firebase Google Auth for Chrome extension
// Uses chrome.identity + Identity Toolkit REST (no SDK — MV3 CSP safe)
// ============================================

const FirebaseAuth = {
  STORAGE_KEY: "firebaseAuthSession",
  OAUTH_DEBUG_KEY: "oauthDebugInfo",
  OAUTH_CONSENT_KEY: "googleOAuthConsent",

  get firebase() {
    return typeof CONFIG !== "undefined" ? CONFIG.FIREBASE : null;
  },

  isEnabled() {
    return !!(
      this.firebase?.apiKey &&
      this.firebase?.authDomain &&
      CONFIG?.USE_FIREBASE_LICENSE !== false
    );
  },

  getExtensionId() {
    return typeof chrome !== "undefined" ? chrome.runtime?.id || "" : "";
  },

  getManifestOAuthClientId() {
    try {
      return chrome.runtime?.getManifest?.()?.oauth2?.client_id || "";
    } catch (_) {
      return "";
    }
  },

  /** All redirect URIs this build may use — register every one in Google Cloud (Web client). */
  async getRedirectUriCandidates() {
    const candidates = [];
    if (typeof chrome !== "undefined" && chrome.identity?.getRedirectURL) {
      const fromChrome = chrome.identity.getRedirectURL();
      if (fromChrome) {
        candidates.push(fromChrome);
        if (fromChrome.endsWith("/")) {
          candidates.push(fromChrome.slice(0, -1));
        } else {
          candidates.push(`${fromChrome}/`);
        }
      }
    }
    const runtimeId = this.getExtensionId();
    if (runtimeId) {
      candidates.push(`https://${runtimeId}.chromiumapp.org/`);
      candidates.push(`https://${runtimeId}.chromiumapp.org`);
    }
    let configuredId = String(CONFIG?.CHROME_EXTENSION_ID || "").trim();
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.getGoogleTrialPublicConfig
    ) {
      try {
        const cfg = await FirebaseLicense.getGoogleTrialPublicConfig(true);
        configuredId =
          String(cfg.chrome_extension_id || cfg.chromeExtensionId || configuredId).trim();
      } catch (_) {}
    }
    if (configuredId && configuredId !== runtimeId) {
      candidates.push(`https://${configuredId}.chromiumapp.org/`);
      candidates.push(`https://${configuredId}.chromiumapp.org`);
    }
    return [...new Set(candidates.filter(Boolean))];
  },

  async getRedirectUri() {
    const list = await this.getRedirectUriCandidates();
    if (list.length) return list[0];
    return `https://${this.firebase?.authDomain || "localhost"}/__/auth/handler`;
  },

  async getOAuthSetupHint() {
    const redirectUris = await this.getRedirectUriCandidates();
    const extId = this.getExtensionId();
    let configuredId = String(CONFIG?.CHROME_EXTENSION_ID || "").trim();
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.getGoogleTrialPublicConfig
    ) {
      try {
        const cfg = await FirebaseLicense.getGoogleTrialPublicConfig(true);
        configuredId =
          String(cfg.chrome_extension_id || cfg.chromeExtensionId || configuredId).trim();
      } catch (_) {}
    }
    return {
      redirectUri: redirectUris[0] || "",
      redirectNoSlash: (redirectUris[0] || "").replace(/\/$/, ""),
      redirectUris,
      extensionId: extId || null,
      configuredExtensionId: configuredId || null,
      manifestClientId: this.getManifestOAuthClientId(),
      instruction:
        "Kiwi/mobile: use Web application OAuth client (oauth_web_client_id) with launchWebAuthFlow. " +
        "Add every redirect URI listed below to Web client 1 in Google Cloud. " +
        "Use trailing-slash URI first: https://YOUR_EXTENSION_ID.chromiumapp.org/",
    };
  },

  async saveOAuthDebug(extra = {}) {
    try {
      const chromeClientId = this.getOAuthChromeClientId();
      const webClientId = await this.getOAuthWebClientId();
      const hint = await this.getOAuthSetupHint();
      await chrome.storage.local.set({
        [this.OAUTH_DEBUG_KEY]: {
          ...hint,
          clientId: chromeClientId,
          chromeClientId,
          webClientId,
          clientSource: this._lastClientSource || "",
          webClientSource: this._lastWebClientSource || "",
          ...extra,
          timestamp: Date.now(),
        },
      });
    } catch (_) {}
  },

  async getOAuthDiagnostics() {
    const chromeClientId = this.getOAuthChromeClientId();
    const webClientId = await this.getOAuthWebClientId();
    const hint = await this.getOAuthSetupHint();
    const stored = await chrome.storage.local.get([this.OAUTH_DEBUG_KEY]);
    return {
      clientId: chromeClientId,
      chromeClientId,
      webClientId,
      clientSource: this._lastClientSource || "",
      webClientSource: this._lastWebClientSource || "",
      lastAttempt: stored[this.OAUTH_DEBUG_KEY] || null,
      ...hint,
    };
  },

  formatRedirectMismatchHelp(err, diagnostics) {
    const hint = diagnostics || {};
    const msg = String(err?.message || err || "");
    if (!/redirect_uri_mismatch/i.test(msg)) return msg;
    const uris = (hint.redirectUris || []).filter(Boolean).join("\n");
    const webClient = hint.webClientId || "";
    const clientLine = webClient
      ? `Web OAuth client (oauth_web_client_id — Kiwi uses this):\n${webClient}\n\n`
      : hint.clientId
        ? `OAuth client in use:\n${hint.clientId}\n\n`
        : "";
    const extId = hint.extensionId || "unknown";
    const cfgId = hint.configuredExtensionId || "";
    return (
      `Google OAuth redirect mismatch (Error 400).\n\n` +
      clientLine +
      `Add these redirect URIs to your Web application OAuth client in Google Cloud:\n${uris}\n\n` +
      `Runtime extension ID: ${extId}\n` +
      (cfgId && cfgId !== extId ? `Configured Kiwi ID (admin): ${cfgId}\n` : "") +
      `\nTip: register the URI with trailing slash first.\n` +
      `Who created the Google Cloud project does not matter — the Gmail you sign in with must be ` +
      `listed under OAuth consent screen → Test users (if app is in Testing).\n\n` +
      `Do NOT use the Chrome Extension client ID with redirect URIs — that causes invalid_client.`
    );
  },

  formatInvalidClientHelp(err, diagnostics) {
    const hint = diagnostics || this.getOAuthSetupHint();
    const extId = hint.extensionId || "unknown";
    const chromeClient = hint.chromeClientId || hint.clientId || "";
    const webClient = hint.webClientId || "";
    return (
      `Google OAuth client not found (invalid_client).\n\n` +
      `Kiwi/mobile uses launchWebAuthFlow, which needs a Web application client — not the Chrome Extension client.\n\n` +
      `Chrome Extension client (getAuthToken only):\n${chromeClient || "(manifest oauth2)"}\n\n` +
      `Web client (launchWebAuthFlow — set oauth_web_client_id in Firebase):\n${webClient || "(missing — add to config)"}\n\n` +
      `1. Google Cloud → Credentials → Web application client\n` +
      `2. Add redirect URI: https://${extId}.chromiumapp.org/\n` +
      `3. Set google_trial.oauth_web_client_id to that Web client ID\n` +
      `4. Ensure extension ID matches Chrome Extension client Item ID: ${extId}\n` +
      `5. OAuth consent screen → add your Gmail as a Test user (app in Testing mode)\n` +
      `6. oauth_client_id must match the Chrome Extension client in Google Cloud (not the Web client)`
    );
  },

  /** True on Kiwi / Android — must use Web client + launchWebAuthFlow, not getAuthToken. */
  needsWebOAuthFlow() {
    try {
      const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
      if (/kiwi/i.test(ua)) return true;
      if (/android/i.test(ua)) return true;
    } catch (_) {}
    return false;
  },

  getOAuthChromeClientId() {
    if (this.firebase?.oauthClientId) {
      this._lastChromeClientSource = "config.js";
      return this.firebase.oauthClientId;
    }
    const manifestId = this.getManifestOAuthClientId();
    if (manifestId) {
      this._lastChromeClientSource = "manifest.oauth2";
      return manifestId;
    }
    this._lastChromeClientSource = "";
    return "";
  },

  async getOAuthChromeClientIdAsync() {
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.getGoogleTrialPublicConfig
    ) {
      try {
        const cfg = await FirebaseLicense.getGoogleTrialPublicConfig(true);
        const fbId = cfg?.oauth_client_id || cfg?.oauthClientId;
        if (fbId) {
          this._lastChromeClientSource = "firebase";
          return fbId;
        }
      } catch (_) {}
    }
    return this.getOAuthChromeClientId();
  },

  async getOAuthWebClientId() {
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.getGoogleTrialPublicConfig
    ) {
      try {
        const cfg = await FirebaseLicense.getGoogleTrialPublicConfig(true);
        if (cfg?.oauth_web_client_id || cfg?.oauthWebClientId) {
          this._lastWebClientSource = "firebase";
          return cfg.oauth_web_client_id || cfg.oauthWebClientId;
        }
      } catch (_) {}
    }
    if (this.firebase?.oauthWebClientId) {
      this._lastWebClientSource = "config.js";
      return this.firebase.oauthWebClientId;
    }
    this._lastWebClientSource = "";
    return "";
  },

  async getOAuthClientId() {
    const chromeId = this.getOAuthChromeClientId();
    if (chromeId) {
      this._lastClientSource = this._lastChromeClientSource || "manifest.oauth2";
      return chromeId;
    }
    if (
      typeof FirebaseLicense !== "undefined" &&
      FirebaseLicense.getGoogleTrialPublicConfig
    ) {
      try {
        const cfg = await FirebaseLicense.getGoogleTrialPublicConfig(true);
        if (cfg?.oauth_client_id || cfg?.oauthClientId) {
          this._lastClientSource = "firebase";
          return cfg.oauth_client_id || cfg.oauthClientId;
        }
      } catch (_) {}
    }
    this._lastClientSource = "";
    return "";
  },

  parseFragmentParams(url) {
    const hash = (url || "").split("#")[1] || "";
    const params = new URLSearchParams(hash);
    const out = {};
    params.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  },

  async hasGoogleOAuthConsent() {
    try {
      const stored = await chrome.storage.local.get([this.OAUTH_CONSENT_KEY]);
      return !!stored[this.OAUTH_CONSENT_KEY];
    } catch (_) {
      return false;
    }
  },

  async markGoogleOAuthConsent() {
    try {
      await chrome.storage.local.set({ [this.OAUTH_CONSENT_KEY]: true });
    } catch (_) {}
  },

  async getGoogleAccessTokenViaAuthToken(interactive = true) {
    if (!chrome?.identity?.getAuthToken) {
      throw new Error("getAuthToken unavailable");
    }
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive }, (token) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!token) {
          reject(new Error("Google did not return an access token."));
          return;
        }
        resolve(token);
      });
    });
  },

  async removeCachedGoogleToken() {
    if (!chrome?.identity?.getAuthToken || !chrome?.identity?.removeCachedAuthToken) {
      return;
    }
    try {
      const token = await new Promise((resolve) => {
        chrome.identity.getAuthToken({ interactive: false }, (t) => resolve(t || null));
      });
      if (token) {
        await new Promise((resolve) => {
          chrome.identity.removeCachedAuthToken({ token }, () => resolve());
        });
      }
    } catch (_) {}
  },

  async launchGoogleOAuthWithRedirect(clientId, redirectUri, options = {}) {
    const silent = options.silent === true;
    const selectAccount = options.selectAccount === true;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "token");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", "openid email profile");
    if (silent) {
      authUrl.searchParams.set("prompt", "none");
    } else if (selectAccount) {
      authUrl.searchParams.set("prompt", "select_account");
    }

    await this.saveOAuthDebug({
      method: silent ? "launchWebAuthFlow(silent)" : "launchWebAuthFlow",
      authUrl: authUrl.toString(),
      redirectUri,
      clientId,
    });

    console.info("[Shipping Optimizer] Google OAuth attempt", {
      clientId,
      redirectUri,
      extensionId: this.getExtensionId(),
      silent,
      selectAccount,
    });

    const responseUrl = await new Promise((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        { url: authUrl.toString(), interactive: !silent },
        (callbackUrl) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          if (!callbackUrl) {
            reject(new Error("Google sign-in was cancelled."));
            return;
          }
          resolve(callbackUrl);
        },
      );
    });

    const params = this.parseFragmentParams(responseUrl);
    if (params.error) {
      const err = new Error(params.error_description || params.error);
      err.oauthError = params.error;
      throw err;
    }
    const accessToken = params.access_token;
    if (!accessToken) {
      throw new Error("Google did not return an access token.");
    }
    return { accessToken, redirectUri, method: "launchWebAuthFlow" };
  },

  isSilentOAuthRetryable(err) {
    const msg = String(err?.message || err?.oauthError || err || "").toLowerCase();
    return /login_required|interaction_required|consent_required|account_selection_required/.test(
      msg,
    );
  },

  async launchGoogleOAuthWeb(clientId, redirects, options = {}) {
    let lastError = null;
    const trySilent = options.trySilent !== false;
    const selectAccount = options.selectAccount === true;

    if (trySilent) {
      for (const uri of redirects) {
        try {
          return await this.launchGoogleOAuthWithRedirect(clientId, uri, {
            silent: true,
          });
        } catch (e) {
          lastError = e;
          if (!this.isSilentOAuthRetryable(e)) {
            throw e;
          }
        }
      }
    }

    for (const uri of redirects) {
      try {
        return await this.launchGoogleOAuthWithRedirect(clientId, uri, {
          silent: false,
          selectAccount,
        });
      } catch (e) {
        lastError = e;
        const msg = String(e?.message || e || "");
        if (/invalid_client/i.test(msg)) {
          throw e;
        }
        if (!/redirect_uri_mismatch/i.test(msg)) {
          throw e;
        }
      }
    }

    throw lastError || new Error("Google sign-in failed.");
  },

  async launchGoogleOAuth() {
    const chromeClientId = await this.getOAuthChromeClientIdAsync();
    const webClientId = await this.getOAuthWebClientId();
    const diagnostics = await this.getOAuthDiagnostics();
    const redirectUri = await this.getRedirectUri();
    const useWebFlowFirst = this.needsWebOAuthFlow();
    const hadConsent = await this.hasGoogleOAuthConsent();
    const selectAccount = !hadConsent;

    // Desktop Chrome only — Kiwi/Android must use Web client (Chrome Extension client → 401 invalid_client).
    if (
      !useWebFlowFirst &&
      chrome?.identity?.getAuthToken &&
      chromeClientId
    ) {
      try {
        await this.saveOAuthDebug({
          method: "getAuthToken(silent)",
          clientId: chromeClientId,
          redirectUri,
        });
        const accessToken = await this.getGoogleAccessTokenViaAuthToken(false);
        return { accessToken, redirectUri, method: "getAuthToken" };
      } catch (e) {
        console.info("[Shipping Optimizer] Silent getAuthToken unavailable:", e.message);
      }
      try {
        await this.saveOAuthDebug({
          method: "getAuthToken",
          clientId: chromeClientId,
          redirectUri,
        });
        const accessToken = await this.getGoogleAccessTokenViaAuthToken(true);
        return { accessToken, redirectUri, method: "getAuthToken" };
      } catch (e) {
        console.warn("[Shipping Optimizer] getAuthToken failed:", e.message);
        const msg = String(e.message || "");
        if (/invalid_client|bad client id/i.test(msg)) {
          console.warn(
            "[Shipping Optimizer] Chrome Extension client rejected — trying Web client flow",
          );
        }
      }
    }

    if (!chrome?.identity?.launchWebAuthFlow) {
      throw new Error(
        "Google sign-in needs Chrome or Kiwi with identity support. Use a license key instead.",
      );
    }

    if (!webClientId) {
      throw new Error(
        "Google sign-in fallback needs oauth_web_client_id (Web application client). " +
          "See FIREBASE_SETUP.md — Chrome Extension client cannot be used with redirect flow.",
      );
    }

    const redirects = await this.getRedirectUriCandidates();
    try {
      return await this.launchGoogleOAuthWeb(webClientId, redirects, {
        trySilent: true,
        selectAccount,
      });
    } catch (e) {
      const msg = String(e?.message || e || "");
      if (/invalid_client/i.test(msg)) {
        throw new Error(this.formatInvalidClientHelp(e, diagnostics));
      }
      if (/redirect_uri_mismatch/i.test(msg)) {
        throw new Error(this.formatRedirectMismatchHelp(e, diagnostics));
      }
      throw e;
    }
  },

  async signInWithGoogleAccessToken(accessToken, requestUri) {
    const apiKey = this.firebase.apiKey;
    const uri = requestUri || this.getRedirectUri();
    const postBody = `access_token=${encodeURIComponent(accessToken)}&providerId=google.com`;
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postBody,
          requestUri: uri,
          returnIdpCredential: true,
          returnSecureToken: true,
        }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        data?.error?.message || "Firebase Google sign-in failed.",
      );
    }
    return this.normalizeSession(data);
  },

  normalizeSession(data) {
    const expiresIn = Number(data.expiresIn) || 3600;
    return {
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      localId: data.localId,
      email: data.email || "",
      displayName: data.displayName || "",
      photoUrl: data.photoUrl || "",
      provider: "google.com",
      obtainedAt: Date.now(),
      expiresAt: Date.now() + expiresIn * 1000,
    };
  },

  async saveSession(session) {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: session });
    return session;
  },

  async getSession() {
    const stored = await chrome.storage.local.get([this.STORAGE_KEY]);
    return stored[this.STORAGE_KEY] || null;
  },

  async clearSession() {
    await this.removeCachedGoogleToken();
    await chrome.storage.local.remove([this.STORAGE_KEY]);
  },

  async refreshIdToken(refreshToken) {
    const apiKey = this.firebase.apiKey;
    const res = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }).toString(),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error?.message || "Token refresh failed.");
    }
    const prev = (await this.getSession()) || {};
    const session = {
      ...prev,
      idToken: data.id_token,
      refreshToken: data.refresh_token || prev.refreshToken,
      obtainedAt: Date.now(),
      expiresAt: Date.now() + (Number(data.expires_in) || 3600) * 1000,
    };
    await this.saveSession(session);
    return session;
  },

  async getIdToken(forceRefresh) {
    let session = await this.getSession();
    if (!session?.idToken) return null;
    const stale =
      forceRefresh ||
      !session.expiresAt ||
      Date.now() > session.expiresAt - 60 * 1000;
    if (stale && session.refreshToken) {
      try {
        session = await this.refreshIdToken(session.refreshToken);
      } catch (e) {
        await this.clearSession();
        return null;
      }
    }
    return session.idToken;
  },

  async getCurrentUser() {
    const session = await this.getSession();
    if (!session?.localId) return null;
    return {
      uid: session.localId,
      email: session.email || "",
      displayName: session.displayName || "",
      photoUrl: session.photoUrl || "",
    };
  },

  async ensureSignedIn() {
    if (!this.isEnabled()) {
      throw new Error("Firebase auth is not enabled.");
    }

    const existing = await this.getCurrentUser();
    if (existing?.uid) {
      const idToken = await this.getIdToken(false);
      if (idToken) {
        return {
          ...existing,
          idToken,
        };
      }
    }

    const chromeClientId = await this.getOAuthChromeClientIdAsync();
    const webClientId = await this.getOAuthWebClientId();
    if (!chromeClientId && !webClientId) {
      throw new Error(
        "Google sign-in is not configured yet. Ask admin to set google_trial.oauth_client_id and oauth_web_client_id in Firebase.",
      );
    }

    const { accessToken, redirectUri } = await this.launchGoogleOAuth();
    const session = await this.signInWithGoogleAccessToken(
      accessToken,
      redirectUri || (await this.getRedirectUri()),
    );
    await this.saveSession(session);
    await this.markGoogleOAuthConsent();
    return {
      uid: session.localId,
      email: session.email,
      displayName: session.displayName,
      photoUrl: session.photoUrl,
      idToken: session.idToken,
    };
  },

  async signInWithGoogle() {
    return this.ensureSignedIn();
  },

  async signOut() {
    await this.clearSession();
  },
};

if (typeof globalThis !== "undefined") {
  globalThis.FirebaseAuth = FirebaseAuth;
}
