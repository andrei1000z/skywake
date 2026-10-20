# Deployment

All of this runs on free tiers, and nothing needs a credit card.

## 1. API Worker (Cloudflare)

One-time setup by the repo owner:

1. Create a Cloudflare account. In *My Profile → API Tokens*, create a token from the **"Edit Cloudflare Workers"** template.
2. In GitHub, open *Settings → Secrets and variables → Actions → Secrets* and add:
   - `CLOUDFLARE_API_TOKEN`: the token,
   - `CLOUDFLARE_ACCOUNT_ID`: shown in the Workers dashboard sidebar.
3. Run the **Deploy API worker** workflow, or push a change under `apps/worker`.
4. Put the deployed URL (`https://skywake-api.<subdomain>.workers.dev`) in the repository **variable**
   `SKYWAKE_API_BASE`. Use the *Variables* tab, not *Secrets*: the URL is public anyway.

To deploy from your own machine instead: `cd apps/worker && npx wrangler login && npx wrangler deploy`.

If your site is not served from `https://<user>.github.io`, add its origin to `ALLOWED_ORIGINS` in `apps/worker/wrangler.jsonc`.

## 2. Website (GitHub Pages)

1. Open *Settings → Pages → Build and deployment* and set *Source* to **GitHub Actions**.
2. Push to `main`, or run **Deploy web to GitHub Pages**. The site is built with `BASE_PATH=/<repo>/` and
   `VITE_API_BASE=$SKYWAKE_API_BASE`.

If `SKYWAKE_API_BASE` is not set, the site still deploys and tells visitors that no live-data API is configured.

## 3. Android APK

The **Android APK** workflow runs on every push to `main` and uploads the APK as a workflow artifact.
Pushing a tag `vX.Y.Z` also creates a GitHub pre-release containing the APK and `SHA256SUMS.txt`.

Release signing is optional, but strongly recommended for anything users install:

```sh
keytool -genkeypair -v -keystore skywake-release.jks -alias skywake -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 skywake-release.jks   # paste the output into the ANDROID_KEYSTORE_BASE64 secret
```

Set these secrets: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
**Keep an offline backup of the keystore.** If it is lost, existing installs can never be updated.
Without these secrets, CI builds a debug-signed APK and adds `-debug` to its name.

## Capacity

By design, one deployment makes at most about 50 upstream requests per minute. Contact the data provider before
promoting a public instance (see [SUSTAINABILITY.md](SUSTAINABILITY.md)).
