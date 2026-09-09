<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6f8e9565-38c4-4763-a89f-bb8a647e1607

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Direct Receipt Printing

Direct thermal printing uses QZ Tray on the administrator's computer.

1. Install QZ Tray from https://qz.io/download/.
2. Keep QZ Tray running while printing.
3. Configure the receipt printer in Admin Panel Settings by detecting and saving the local printer.
4. Configure `QZ_CERTIFICATE` and `QZ_PRIVATE_KEY` as server-only environment variables for signed production requests.

The private QZ signing key must never be placed in frontend code or any `VITE_` environment variable. The browser communicates with QZ Tray locally; the hosted server only provides the certificate and signs requests.
