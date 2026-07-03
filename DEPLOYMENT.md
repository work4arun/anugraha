# Deploying rathinam-mydayone to an existing EC2 instance (Amazon Linux 2023)

Stack: Node.js + PM2 (process manager) + Nginx (reverse proxy). Database: Neon Postgres (already configured in `.env`). Repo: `git@github.com:work4arun/anugraha.git`. Domain/SSL: added later — for now the app is exposed on the instance's public IP over port 80.

Run every command below over SSH on the EC2 instance unless noted otherwise.

---

## 0. Connect to the instance

```bash
ssh -i /path/to/your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

`ec2-user` is the default login for Amazon Linux 2023 AMIs. If you used a different AMI/user, adjust accordingly.

---

## 1. Update the system and install base tools

```bash
sudo dnf update -y
sudo dnf install -y git
```

---

## 2. Install Node.js 20

Amazon Linux 2023's default `dnf` Node package can lag behind what Next.js 14 needs. Use NodeSource:

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
node -v   # should print v20.x
npm -v
```

---

## 3. Install PM2 and Nginx

```bash
sudo npm install -g pm2
sudo dnf install -y nginx
sudo systemctl enable --now nginx
```

Check it's up: `curl -I http://localhost` should return `HTTP/1.1 200 OK` (Nginx's default page).

---

## 4. GitHub access

Already done — you've confirmed SSH access to `git@github.com:work4arun/anugraha.git`. Just double-check from the instance itself before cloning:

```bash
ssh -T git@github.com
```

You should see `Hi work4arun! You've successfully authenticated...`. If that fails on the EC2 box specifically, it means the SSH key set up for GitHub is on your local machine, not the server — you'd need a separate deploy key added on the instance (Settings → Deploy keys on the repo).

---

## 5. Clone the app

```bash
sudo mkdir -p /var/www
sudo chown ec2-user:ec2-user /var/www
cd /var/www
git clone git@github.com:work4arun/anugraha.git
cd anugraha
```

---

## 6. Install dependencies

```bash
npm install
```

---

## 7. Create `.env` on the server

`.env` is gitignored, so it won't come across with `git clone` — create it directly on the instance:

```bash
nano .env
```

Paste in your production values (adjust `NEXTAUTH_URL` and `APP_URL` to the instance's public IP for now — you'll switch these to your domain once it's set up):

```bash
DATABASE_URL="postgresql://neondb_owner:npg_nzyKj9ENox7I@ep-frosty-firefly-ao0us2at-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://neondb_owner:npg_nzyKj9ENox7I@ep-frosty-firefly-ao0us2at.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

NEXTAUTH_SECRET="<generate with: openssl rand -base64 32>"
NEXTAUTH_URL="http://<EC2_PUBLIC_IP>"
APP_URL="http://<EC2_PUBLIC_IP>"

STORAGE_PROVIDER="local"
LOCAL_UPLOAD_DIR="./uploads"

NODE_ENV="production"

SEED_ADMIN_EMAIL="admin@rathinam.in"
SEED_ADMIN_PASSWORD="<choose a real password, not the dev default>"
```

Generate the secret in a separate terminal: `openssl rand -base64 32`.

> Rotate the Neon password shown above in the Neon dashboard before going live — it's been shared in plaintext during setup.

---

## 8. Install Chromium's system dependencies (for Puppeteer/PDF generation)

The app uses Puppeteer to render PDFs. Puppeteer's bundled Chromium needs shared libraries that aren't on a minimal Amazon Linux 2023 box:

```bash
sudo dnf install -y \
  alsa-lib atk cups-libs gtk3 libXcomposite libXcursor libXdamage \
  libXext libXi libXrandr libXScrnSaver libXtst pango nss mesa-libgbm \
  liberation-fonts
```

If PDF generation still fails later with a Chromium launch error, run `npm run dev`-style with `DEBUG=puppeteer:*` or check `pm2 logs` for the exact missing `.so` file and `dnf provides` it.

---

## 9. Generate Prisma client and push the schema to Neon

```bash
npx prisma generate
npx prisma db push
```

(If you already ran `db push` earlier from your own machine, this is a no-op — Prisma will just confirm the schema is in sync.)

Seed the admin account (only if not already seeded):

```bash
npm run db:seed
```

---

## 10. Build the app

```bash
npm run build
```

---

## 11. Start the app with PM2

```bash
pm2 start npm --name anugraha -- start
pm2 save
pm2 startup
```

`pm2 startup` prints a `sudo env PATH=... pm2 startup ...` command — copy and run that exact line so PM2 (and your app) survives an instance reboot.

Verify it's listening locally:

```bash
curl -I http://localhost:3000
```

Useful commands going forward: `pm2 logs anugraha`, `pm2 restart anugraha`, `pm2 status`.

---

## 12. Configure Nginx as a reverse proxy

```bash
sudo tee /etc/nginx/conf.d/anugraha.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo nginx -t
sudo systemctl reload nginx
```

`client_max_body_size 20M` matters here since students upload documents — raise it if you hit 413 errors on larger files.

---

## 13. Open the right ports in the EC2 Security Group

In the AWS Console → EC2 → your instance → Security → security group → Edit inbound rules, make sure you have:

| Type  | Port | Source            |
|-------|------|--------------------|
| SSH   | 22   | Your IP only (not 0.0.0.0/0) |
| HTTP  | 80   | 0.0.0.0/0          |

Do **not** open port 3000 to the internet — only Nginx (port 80) should be public; it proxies internally to 3000.

---

## 14. Verify

From your own machine:

```bash
curl -I http://<EC2_PUBLIC_IP>
```

Then open `http://<EC2_PUBLIC_IP>` in a browser — you should see the app. Log in with the seeded admin credentials and confirm a PDF/document action works (this exercises Puppeteer + Neon in one shot).

---

## 15. Deploying updates later

A `deploy.sh` script is checked into the repo root. After pushing new commits to GitHub, SSH into the instance and run:

```bash
cd /var/www/anugraha
git pull            # picks up deploy.sh itself the first time
chmod +x deploy.sh  # only needed once
./deploy.sh
```

It pulls the latest code, installs dependencies, regenerates the Prisma client, syncs the schema, rebuilds, and restarts PM2 — same steps as before, just one command.

---

## Later: domain + HTTPS

When you're ready to point a domain at this instance:

1. Create an A record for your domain → EC2 public IP (or use an Elastic IP first so it doesn't change on stop/start).
2. `sudo dnf install -y certbot python3-certbot-nginx`
3. `sudo certbot --nginx -d yourdomain.com`
4. Update `NEXTAUTH_URL` and `APP_URL` in `.env` to `https://yourdomain.com`, then `pm2 restart mydayone`.

Happy to walk through this part when you get there.
