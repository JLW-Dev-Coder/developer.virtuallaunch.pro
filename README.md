# VirtualLaunchPro Developer Funnel (Cloudflare Worker + D1)

## Overview

This project implements a production-ready onboarding funnel for VirtualLaunchPro using:

* **Frontend (Canva HTML)** deployed via Cloudflare Pages
* **Cloudflare Worker API** for reference generation and lookup
* **Cloudflare D1 Database** for persistent storage

This replaces fragile client-only solutions with a system capable of generating and retrieving real client reference data.

---

## Architecture

```
Landing → Stripe → Success Page
              ↓
        Worker creates reference
              ↓
        Stored in D1
              ↓
Support page → Worker lookup → status returned
```

---

## Project Structure

```
/
  /contracts
    onboarding.json
    registry.json  
    support.json 
  /public
    index.html
    onboarding.html
    success.html
    support.html
  /worker
    index.js
  README
  wrangler.toml
```

---

## Setup Instructions

### 1. Create Repository

Create a new repository:

```
developers.virtuallaunch.pro
```

---

### 2. Install Cloudflare Wrangler

```
npm install -g wrangler
wrangler login
```

---

### 3. Create D1 Database

```
wrangler d1 create vlp_developers
```

Save the returned:

```
database_id = "YOUR_DB_ID"
```

---

### 4. Create Database Table

```
wrangler d1 execute vlp_developers --command "
CREATE TABLE clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT,
  client_reference TEXT,
  status TEXT DEFAULT 'In Progress',
  created_at TEXT
);
"
```

---

### 5. Configure Wrangler

`wrangler.toml`

```
name = "vlp-developer-worker"
main = "worker/index.ts"
compatibility_date = "2026-03-20"

[[d1_databases]]
binding = "DB"
database_name = "vlp_developers"
database_id = "YOUR_DB_ID"
```

---

## Worker Implementation

`/worker/index.ts`

```ts
export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    // Create reference
    if (url.pathname === "/create-reference" && request.method === "POST") {
      const body = await request.json();
      const session_id = body.session_id || "";

      const client_reference =
        "VLP-" +
        Math.random().toString(36).substring(2, 8).toUpperCase();

      await env.DB.prepare(
        `INSERT INTO clients (session_id, client_reference, created_at)
         VALUES (?, ?, ?)`
      )
        .bind(session_id, client_reference, new Date().toISOString())
        .run();

      return new Response(
        JSON.stringify({ client_reference }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Lookup reference
    if (url.pathname === "/lookup") {
      const ref = url.searchParams.get("ref");

      const result = await env.DB.prepare(
        `SELECT status FROM clients WHERE client_reference = ?`
      )
        .bind(ref)
        .first();

      return new Response(
        JSON.stringify(result || { status: "Not Found" }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
```

---

## Deploy Worker

```
wrangler deploy
```

Example output:

```
https://vlp-developer-worker.your-subdomain.workers.dev
```

---

## Frontend Deployment (Cloudflare Pages)

1. Go to Cloudflare Dashboard
2. Navigate to **Pages → Create Project**
3. Connect GitHub repository
4. Configure build:

   * Framework: None
   * Output directory: `/public`

Deploy.

---

## Domain Configuration

In Cloudflare DNS:

```
developer → your-pages-project.pages.dev
```

---

## Frontend Integration

### Success Page

```javascript
const params = new URLSearchParams(window.location.search);
const sessionId = params.get("session_id");

if (sessionId) {
  fetch("https://vlp-developer-worker.YOUR.workers.dev/create-reference", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById("ref").textContent = data.client_reference;
    });
}
```

---

### Support Page

```javascript
document.getElementById("checkBtn").onclick = async () => {
  const ref = document.getElementById("refInput").value;

  const res = await fetch(
    `https://vlp-developer-worker.YOUR.workers.dev/lookup?ref=${ref}`
  );

  const data = await res.json();

  document.getElementById("status").textContent = data.status;
};
```

---

## Stripe Configuration

Set success URL in Stripe:

```
https://developers.virtuallaunch.pro/success.html?session_id={CHECKOUT_SESSION_ID}
```

---

## Capabilities

### Included

* Unique client reference generation
* Persistent storage in D1
* Secure lookup via Worker API
* Fully static frontend deployment

### Not Included (Yet)

* Payment verification via Stripe webhook
* Status updates based on payment events

---

## Recommended Next Step

Add a Stripe webhook to:

* Verify completed payments
* Update `status` field to "Paid"
* Ensure references are tied to real transactions

---

## Summary

This system provides a clean separation:

* Frontend handles user interaction and UX
* Worker handles logic and data
* D1 handles persistence

It replaces fragile client-side-only approaches with a scalable, maintainable architecture suitable for production use.
