# 🚀 Deployment Guide — ShadowQuant Fintech

This guide outlines how to deploy your ShadowQuant Fintech Loan Management platform from local development to production.

We will use a modern, robust, and cost-effective stack:
1. **Frontend (Static HTML/CSS/JS):** Vercel or Netlify (Blazing fast, completely free).
2. **Backend (Node.js/Express):** Render or Railway (Easy, automated git-based deployments).
3. **Database (MySQL):** Aiven, Railway, or Clever Cloud (Reliable, managed MySQL).

---

## 🛠️ Phase 1: Prepare the Code for Production

### 1. Update the Frontend API URL
Currently, `index.html` and `admin.html` connect to the local server `http://localhost:3000/api`. 
Before deploying the frontend, update this line in both files:

* Open `index.html` and `admin.html` and locate the config block around the top of the `<script>`:
  ```javascript
  // Change this:
  const API = 'http://localhost:3000/api';

  // To your deployed backend URL:
  const API = 'https://shadowquant-backend.onrender.com/api';
  ```

### 2. Prepare Environment Variables
Create a list of environment variables you will need to input in your production server dashboard:
```env
PORT=3000
DB_HOST=your-production-db-host
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_NAME=your-production-db-name
DB_PORT=3306
JWT_SECRET=your-secure-production-jwt-random-string
```

---

## 📦 Phase 2: Deploy the MySQL Database (Choose 1)

### Option A: Aiven.io (Recommended — Free 1GB Managed MySQL)
1. Go to [aiven.io](https://aiven.io/) and create a free account.
2. Click **Create Service** and select **MySQL**.
3. Choose the **Free Trial / Free Plan** and click **Create Service**.
4. Once the service is running, copy the **Connection details**:
   * Host name
   * Port
   * User name (`avnadmin`)
   * Password
5. Use a GUI tool like DBeaver, TablePlus, or command line to connect to this database and run the queries inside your `schema.sql` to initialize the tables!

### Option B: Railway.app (Paid, but very fast setup)
1. Sign up on [Railway.app](https://railway.app/).
2. Click **New Project** → **Provision MySQL**.
3. Railway will provision a database instantly. Click on the MySQL service, open the **Variables** tab, and copy the connection details.
4. Click on the **Database** tab and upload your `schema.sql` or connect to it externally and run the script.

---

## 🌐 Phase 3: Deploy the Backend API (Render)

Render is the easiest and most popular choice to host Node.js web services.

1. Create a free account on [Render.com](https://render.com/).
2. Push your project to a GitHub or GitLab repository.
3. On Render, click **New** → **Web Service**.
4. Connect your GitHub account and select your `loan-engine-fresh` repository.
5. Configure the service:
   * **Name:** `shadowquant-backend`
   * **Region:** Choose the region closest to your target audience.
   * **Branch:** `main`
   * **Root Directory:** (leave blank for root)
   * **Runtime:** `Node`
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
6. Click **Advanced** and add your **Environment Variables**:
   * Add all variables listed in Phase 1 (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, etc.).
7. Click **Create Web Service**.
8. Once built, Render will give you a public URL (e.g., `https://shadowquant-backend.onrender.com`). Copy this!

---

## 🎨 Phase 4: Deploy the Frontend (Vercel)

Vercel is the ultimate hosting platform for static frontends.

1. Ensure you have updated the `API` constant in `index.html` and `admin.html` with your new Render backend URL!
2. Create a free account on [Vercel.com](https://vercel.com/).
3. Install the Vercel CLI (optional) or deploy directly from GitHub:
   * **GitHub Method:** Click **New Project**, connect your GitHub repo, and import it.
   * **CLI Method (Blazing Fast!):**
     * Open terminal in your project directory and run:
       ```bash
       npm install -g vercel
       vercel login
       vercel
       ```
     * Vercel will ask a few simple setup questions:
       * Set up and deploy? **Yes**
       * Which scope? **Select your personal account**
       * Link to existing project? **No**
       * What's your project's name? **shadowquant-fintech**
       * In which directory is your code located? **./**
       * Want to modify settings? **No**
     * Vercel will upload and deploy your static files in seconds!
4. Once deployed, Vercel will give you a public production URL (e.g., `https://shadowquant-fintech.vercel.app`).
5. Open that URL, register an account, and experience your premium Loan Management platform running live in production! 🎉
