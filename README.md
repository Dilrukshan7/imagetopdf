# Private WhatsApp Image-to-PDF Bot

This is a private Node.js bot for personal/educational use. It links to your normal WhatsApp account through WhatsApp Web, listens only to numbers you allow, collects images from an allowed user, converts them into one PDF, sends the PDF back to that same user, then clears the images from memory.

It does not use the official WhatsApp Business Cloud API. It uses `whatsapp-web.js`, which automates WhatsApp Web through Chromium. This method is unofficial, can break when WhatsApp changes Web behavior, and can put your account at risk if misused. Do not use this for spam, marketing, scraping, broadcasts, public bots, or bulk messaging.

## What It Does

Allowed user flow:

1. Send `/start`.
2. Send image 1.
3. Send image 2.
4. Send `/done`.
5. The bot creates a 2-page PDF.
6. The bot sends the PDF back as a document.
7. The bot clears that user's temporary image batch and stops processing images.
8. The same user can send `/start` again for a new batch.

Unauthorized user flow:

1. Unauthorized user sends a message or image.
2. The bot silently ignores it.
3. The bot sends no reply.
4. The message remains normal in your WhatsApp chat, so you can manually reply from your phone.

Groups are ignored by default.

## Official Cloud API vs This Method

The official WhatsApp Business Cloud API is the supported Meta API for business integrations. It uses a WhatsApp Business account, API tokens, webhooks, templates, and Meta's platform rules.

This project uses WhatsApp Web/Desktop style automation through `whatsapp-web.js`. It logs in by QR code, like WhatsApp Web. It is easier for private experiments, but it is unofficial and less reliable. It is not recommended for commercial or public bots.

## Requirements

- Node.js 18.18 or newer
- npm
- A WhatsApp account
- A phone with WhatsApp installed
- A terminal where you can scan the QR code on first run

## Install

```bash
npm install
```

Create your environment file:

```bash
copy .env.example .env
```

On macOS/Linux:

```bash
cp .env.example .env
```

Edit `.env` and set your allowed WhatsApp numbers.

## Configure Allowed Numbers

Use international format digits only, without `+`, spaces, or dashes.

Example:

```env
ALLOWED_NUMBERS=94771234567,94779876543
```

The bot normalizes WhatsApp IDs such as `94771234567@c.us` and compares them with your configured numbers.

## Environment Variables

```env
PORT=3000
ALLOWED_NUMBERS=94771234567,94779876543
ALLOWED_CHAT_IDS=
MAX_IMAGES_PER_PDF=30
MAX_IMAGE_SIZE_MB=10
SESSION_TIMEOUT_SECONDS=900
PDF_AUTO_GENERATE=false
PDF_AUTO_TIMEOUT_SECONDS=10
BOT_NAME=Private PDF Bot
NODE_ENV=development
PROCESS_GROUPS=false
PROCESS_OWN_MESSAGES=false
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_MESSAGES=30
```

Important settings:

- `ALLOWED_NUMBERS`: only these numbers can use the bot.
- `ALLOWED_CHAT_IDS`: fallback for WhatsApp `@lid` IDs when WhatsApp Web hides the sender phone number. Leave empty unless the terminal tells you to add one.
- `MAX_IMAGES_PER_PDF`: maximum images in one PDF batch.
- `MAX_IMAGE_SIZE_MB`: maximum size for each received image.
- `SESSION_TIMEOUT_SECONDS`: inactive image batches are cleared after this many seconds.
- `PDF_AUTO_GENERATE`: keep this `false` unless you really want timeout-based generation.
- `PDF_AUTO_TIMEOUT_SECONDS`: if auto-generate is enabled, generate after this many inactive seconds.
- `PROCESS_GROUPS`: default is `false`; private one-to-one chats only.
- `PROCESS_OWN_MESSAGES`: default is `false`; set to `true` only for testing messages you send from the same linked WhatsApp account.

## Run Locally

```bash
npm start
```

For development with auto-restart:

```bash
npm run dev
```

On first run, the terminal shows a QR code.

1. Open WhatsApp on your phone.
2. Go to Linked devices.
3. Link a device.
4. Scan the terminal QR code.

After login, the bot listens for incoming messages.

Health check:

```text
http://localhost:3000/health
```

It returns:

```json
{
  "status": "ok",
  "bot": "running"
}
```

No private data is exposed in the health check.

## How To Use

From an allowed WhatsApp number:

- Send `/start` or `start` to begin a PDF batch.
- Send images one by one.
- Send `/done` or `done` to create and receive the PDF.
- Send `/status` or `status` to see how many images are collected.
- Send `/cancel`, `cancel`, `/clear`, or `clear` to clear the current image batch.
- Send `/help` or `help` for a short command guide.

Outside an active `/start` to `/done` or `/cancel` batch, the bot ignores normal chat messages and images. This lets the WhatsApp chat behave normally until an allowed user explicitly starts PDF mode.

If `/done` is sent with no collected images, the bot ends PDF mode and does not create a PDF.

Supported image types:

- JPEG
- PNG
- WebP

Each image becomes one centered A4 PDF page with a white background.

## Privacy

Images and generated PDFs are held in memory only. They are not saved to a database, cloud storage, or a permanent folder.

The bot clears image memory:

- after sending the PDF,
- when `/cancel` is used,
- when the session times out,
- when the process shuts down.

The bot avoids logging:

- full phone numbers,
- message contents,
- image data,
- PDF data.

Logs mask phone numbers and only show operational events.

## What Is Stored

Stored locally:

- WhatsApp Web auth/session data in `.wwebjs_auth/`
- WhatsApp Web cache in `.wwebjs_cache/`, if created by the library
- installed dependencies in `node_modules/`

Not stored by this bot:

- received images,
- generated PDFs,
- message contents,
- unauthorized user data.

## About `.wwebjs_auth/`

`.wwebjs_auth/` lets WhatsApp Web remember your linked session so you do not need to scan the QR code every time.

This folder is sensitive. Treat it like a login session. Anyone with this folder may be able to reuse your WhatsApp Web session. Never upload it to GitHub, never share it, and never commit it.

This project includes `.wwebjs_auth/` in `.gitignore`.

To delete all local WhatsApp session data:

```bash
rmdir /s /q .wwebjs_auth
```

PowerShell:

```powershell
Remove-Item -Recurse -Force .wwebjs_auth
```

macOS/Linux:

```bash
rm -rf .wwebjs_auth
```

After deleting it, run the bot again and scan a new QR code.

## Render Free Plan Deployment

Render Free Plan can run this project, but it is not ideal for WhatsApp Web automation.

Limitations:

- Free instances may sleep.
- Restarts, deploys, or sleep/wake cycles may disconnect WhatsApp Web.
- The local filesystem may not preserve `.wwebjs_auth/`, so you may need to scan QR again.
- QR scanning must be done from Render logs.
- Headless Chromium may need extra setup.
- WhatsApp Web sessions may disconnect.
- `whatsapp-web.js` is unofficial and may break.
- Misuse can risk WhatsApp account restrictions.

This is not recommended for commercial or public bots.

### Render Settings

Use a Web Service.

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

Required environment variables:

```env
PORT=3000
ALLOWED_NUMBERS=94771234567
MAX_IMAGES_PER_PDF=30
MAX_IMAGE_SIZE_MB=10
SESSION_TIMEOUT_SECONDS=900
PDF_AUTO_GENERATE=false
PDF_AUTO_TIMEOUT_SECONDS=10
BOT_NAME=Private PDF Bot
NODE_ENV=production
PROCESS_GROUPS=false
RATE_LIMIT_WINDOW_SECONDS=60
RATE_LIMIT_MAX_MESSAGES=30
```

### Chromium Notes For Render

`whatsapp-web.js` uses Puppeteer/Chromium. The app passes common headless flags such as `--no-sandbox`.

If Chromium is not found on Render, use a Render environment that supports Puppeteer or install Chromium during build. If you provide a custom Chromium path, set:

```env
PUPPETEER_EXECUTABLE_PATH=/path/to/chromium
```

Check Render logs for the QR code. If auth is lost after restart, scan the QR again.

For persistent auth, the safer option is a host with a persistent private disk. Store only WhatsApp auth/session data there. Do not store user images or generated PDFs persistently.

## Common Errors And Fixes

`ALLOWED_NUMBERS must contain at least one WhatsApp number.`

- Create `.env`.
- Set `ALLOWED_NUMBERS` to at least one number.
- Use digits only, for example `94771234567`.

QR code appears every restart:

- `.wwebjs_auth/` is missing or not persistent.
- On Render Free Plan this can happen after restart/deploy/sleep.

Chromium or Puppeteer error:

- Make sure dependencies installed successfully.
- On a server, configure Chromium or set `PUPPETEER_EXECUTABLE_PATH`.

PDF generation failed:

- Try fewer images.
- Reduce image size.
- Use JPEG, PNG, or WebP.
- Send `/cancel` and start again.

Bot does not respond:

- Check that the sender number is in `ALLOWED_NUMBERS`.
- Use international digits only.
- Make sure you are sending from a private one-to-one chat.
- Confirm the terminal says the WhatsApp client is ready.
- If the terminal says WhatsApp did not expose a phone number, copy the shown `@lid` value into `ALLOWED_CHAT_IDS`, then restart.

Unauthorized user receives no reply:

- This is expected. Unauthorized users are silently ignored.

Messages sent from the linked phone do not work:

- By default, the bot processes incoming messages only.
- If you test by sending green outgoing messages from the same WhatsApp account that is linked to the bot, set `PROCESS_OWN_MESSAGES=true`.
- Your own linked WhatsApp number must be in `ALLOWED_NUMBERS`.
- Restart the bot after changing `.env`.

## Security Checklist

- Keep `ALLOWED_NUMBERS` strict.
- Keep `PROCESS_GROUPS=false` unless you understand the risk.
- Keep `PROCESS_OWN_MESSAGES=false` except while testing from your own linked account.
- Do not commit `.env`.
- Do not commit `.wwebjs_auth/`.
- Do not share `.wwebjs_auth/`.
- Do not log message contents or media.
- Do not add broadcast or bulk messaging features.
- Stop the bot when not needed.
- Delete `.wwebjs_auth/` if you suspect it was exposed.

## Stop The Bot Safely

Press `Ctrl+C` in the terminal. The bot clears in-memory image sessions and closes the WhatsApp Web client.

## Change Allowed Numbers

1. Stop the bot.
2. Edit `.env`.
3. Update `ALLOWED_NUMBERS`.
4. Start the bot again with `npm start`.

## Change Max Images

Edit `.env`:

```env
MAX_IMAGES_PER_PDF=10
```

Restart the bot.

## Assumptions

- This is for personal/private educational use.
- Unauthorized users must receive no response.
- Images/PDFs must stay in memory only.
- WhatsApp auth/session data may be stored locally in `.wwebjs_auth/`.
- Private one-to-one chats are processed by default; groups are ignored.
