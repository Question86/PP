# Deployment Guide - PromptPage

## Overview
This guide covers deploying PromptPage to production environments (Vercel, self-hosted, etc.)

## Pre-Deployment Checklist

### Code Review
- [ ] All TypeScript errors resolved (`npm run build`)
- [ ] Environment variables documented
- [ ] Database migrations tested
- [ ] Error handling implemented
- [ ] Security audit completed

### Configuration
- [ ] `.env` for production environment created
- [ ] `ERGO_NETWORK` set to desired network (testnet/mainnet)
- [ ] `PLATFORM_ERGO_ADDRESS` verified for correct network
- [ ] `SERVICE_FEE_ERG` set appropriately
- [ ] `DATABASE_URL` points to production MySQL instance
- [ ] `NEXT_PUBLIC_*` variables set correctly

### Database
- [ ] Production MySQL instance provisioned
- [ ] Database created: `promptpage`
- [ ] Migration script executed successfully
- [ ] Database backups configured
- [ ] Connection limits set appropriately

### Testing
- [ ] Full end-to-end flow tested on testnet
- [ ] Multiple minting transactions successful
- [ ] Error scenarios handled gracefully
- [ ] Mobile responsive design verified
- [ ] Browser compatibility checked

## Deployment Options

### Option 1: Vercel (Recommended for MVP)

Vercel provides zero-config deployment for Next.js applications.

#### Steps:

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy to Production**
   ```bash
   vercel --prod
   ```

4. **Configure Environment Variables**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Add all variables from `.env`:
     ```
     DATABASE_URL
     ERGO_NETWORK
     PLATFORM_ERGO_ADDRESS
     SERVICE_FEE_ERG
     APP_BASE_URL
     NEXT_PUBLIC_APP_BASE_URL
     NEXT_PUBLIC_ERGO_EXPLORER_API
     ```

5. **Redeploy After Configuration**
   ```bash
   vercel --prod
   ```

#### Vercel-Specific Configuration

**vercel.json** (optional):
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

#### Database Connection Pooling

For Vercel (serverless), consider using PlanetScale or a connection pooler:

```bash
# Use PlanetScale (MySQL-compatible)
DATABASE_URL=mysql://...@...planetscale.app/promptpage?sslaccept=strict

# Or use a connection pooler like ProxySQL
```

### Option 2: Self-Hosted (VPS/Cloud)

For more control, deploy to a VPS (DigitalOcean, AWS EC2, etc.)

#### Prerequisites:
- Ubuntu 22.04 LTS server
- Node.js 18+ installed
- MySQL 8.0+ installed
- Nginx for reverse proxy
- SSL certificate (Let's Encrypt)

#### Steps:

1. **Setup Server**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js 18
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs
   
   # Install MySQL
   sudo apt install -y mysql-server
   sudo mysql_secure_installation
   
   # Install Nginx
   sudo apt install -y nginx
   
   # Install PM2 for process management
   sudo npm install -g pm2
   ```

2. **Setup MySQL Database**
   ```bash
   sudo mysql -u root -p
   ```
   ```sql
   CREATE DATABASE promptpage;
   CREATE USER 'promptpage'@'localhost' IDENTIFIED BY 'secure_password';
   GRANT ALL PRIVILEGES ON promptpage.* TO 'promptpage'@'localhost';
   FLUSH PRIVILEGES;
   EXIT;
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   cd /var/www
   git clone <repository-url> promptpage
   cd promptpage
   
   # Install dependencies
   npm install
   
   # Create .env file
   nano .env
   # (paste your production environment variables)
   
   # Run database migration
   npm run db:migrate
   
   # Build application
   npm run build
   
   # Start with PM2
   pm2 start npm --name "promptpage" -- start
   pm2 save
   pm2 startup
   ```

4. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/promptpage
   ```
   
   ```nginx
   server {
       listen 80;
       server_name promptpage.com www.promptpage.com;
   
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   
   ```bash
   # Enable site
   sudo ln -s /etc/nginx/sites-available/promptpage /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

5. **Setup SSL with Let's Encrypt**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d promptpage.com -d www.promptpage.com
   ```

### Option 3: Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - ERGO_NETWORK=${ERGO_NETWORK}
      - PLATFORM_ERGO_ADDRESS=${PLATFORM_ERGO_ADDRESS}
      - SERVICE_FEE_ERG=${SERVICE_FEE_ERG}
      - APP_BASE_URL=${APP_BASE_URL}
      - NEXT_PUBLIC_APP_BASE_URL=${NEXT_PUBLIC_APP_BASE_URL}
      - NEXT_PUBLIC_ERGO_EXPLORER_API=${NEXT_PUBLIC_ERGO_EXPLORER_API}
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      - MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
      - MYSQL_DATABASE=promptpage
    volumes:
      - mysql_data:/var/lib/mysql
      - ./db/schema.sql:/docker-entrypoint-initdb.d/schema.sql
    restart: unless-stopped

volumes:
  mysql_data:
```

#### Deploy with Docker
```bash
docker-compose up -d
```

## Post-Deployment

### 1. Verify Deployment
- [ ] Visit health check endpoint: `https://yourdomain.com/api/health`
- [ ] Should return: `{"status":"ok","checks":{...}}`
- [ ] Test wallet connection
- [ ] Create a test prompt
- [ ] Mint a test NFT

### 2. Monitor Application

#### PM2 Monitoring (Self-Hosted)
```bash
pm2 monit
pm2 logs promptpage
pm2 status
```

#### Vercel Monitoring
- Check Vercel Dashboard for:
  - Build logs
  - Runtime logs
  - Performance metrics
  - Error tracking

### 3. Setup Error Tracking

**Sentry Integration** (recommended):

```bash
npm install @sentry/nextjs
```

**next.config.js:**
```javascript
const { withSentryConfig } = require('@sentry/nextjs');

module.exports = withSentryConfig(
  {
    // existing config
  },
  {
    silent: true,
    org: 'your-org',
    project: 'promptpage',
  }
);
```

### 4. Database Backups

**Automated MySQL Backups:**
```bash
# Create backup script
sudo nano /usr/local/bin/backup-promptpage.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u promptpage -p'password' promptpage > /backups/promptpage_$DATE.sql
find /backups -name "promptpage_*.sql" -mtime +7 -delete
```

```bash
sudo chmod +x /usr/local/bin/backup-promptpage.sh

# Add to crontab (daily at 2 AM)
sudo crontab -e
0 2 * * * /usr/local/bin/backup-promptpage.sh
```

### 5. Security Hardening

- [ ] Enable firewall (UFW on Ubuntu)
- [ ] Configure fail2ban for SSH
- [ ] Use strong database passwords
- [ ] Enable MySQL SSL connections
- [ ] Set up intrusion detection (AIDE)
- [ ] Configure log rotation
- [ ] Implement rate limiting (see next section)

### 6. Rate Limiting

**API Route Rate Limiting:**

```bash
npm install express-rate-limit
```

Create middleware: `src/middleware/rateLimit.ts`
```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
});

export const createPromptLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit to 10 prompts per hour per IP
  message: 'Too many prompts created, please try again later.',
});
```

### 7. Performance Optimization

**Enable Compression:**
```javascript
// next.config.js
module.exports = {
  compress: true,
  // ... other config
};
```

**Configure Caching Headers:**
```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, must-revalidate' }
      ],
    },
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ];
},
```

### 8. Monitoring & Alerting

**Setup Uptime Monitoring:**
- Use services like UptimeRobot, Pingdom, or StatusCake
- Monitor: `/api/health` endpoint
- Alert on: downtime, slow response times

**Custom Alerts:**
```bash
# Simple email alert on service down
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
```

## Rollback Plan

If deployment fails:

1. **Vercel:** Revert to previous deployment
   ```bash
   vercel rollback
   ```

2. **Self-Hosted:** Keep previous version
   ```bash
   cd /var/www
   mv promptpage promptpage-backup
   git clone <repository-url> promptpage
   # If issues, restore:
   rm -rf promptpage
   mv promptpage-backup promptpage
   pm2 restart promptpage
   ```

3. **Database:** Restore from backup
   ```bash
   mysql -u promptpage -p promptpage < /backups/promptpage_YYYYMMDD.sql
   ```

## Maintenance

### Regular Tasks
- **Daily:** Check error logs
- **Weekly:** Review database growth, optimize queries
- **Monthly:** Update dependencies (`npm audit`, `npm update`)
- **Quarterly:** Security audit, performance review

### Update Procedure
```bash
# 1. Backup database
# 2. Pull latest code
git pull origin main

# 3. Install dependencies
npm install

# 4. Run migrations (if any)
npm run db:migrate

# 5. Build
npm run build

# 6. Restart
pm2 restart promptpage

# 7. Verify
curl https://yourdomain.com/api/health
```

## Scaling Considerations

### Database Scaling
- Add read replicas for high read loads
- Implement connection pooling (PgBouncer/ProxySQL)
- Consider sharding for very large datasets

### Application Scaling
- Horizontal scaling with load balancer (Nginx/HAProxy)
- Use CDN for static assets (Cloudflare/AWS CloudFront)
- Implement Redis for caching

### Ergo Node Considerations
- For high volume, run your own Ergo node
- Configure local node as data source
- Reduces dependency on public APIs

## Support & Troubleshooting

### Common Issues

**"Cannot connect to database"**
- Check DATABASE_URL is correct
- Verify MySQL is running: `sudo systemctl status mysql`
- Check firewall rules: `sudo ufw status`

**"Nautilus connection failed"**
- Verify HTTPS is enabled (required for wallet API)
- Check browser console for errors
- Ensure no CORS issues

**"Transaction submission failed"**
- Check ERGO_NETWORK matches Nautilus network
- Verify explorer API is accessible
- Check user has sufficient funds

## Production Checklist

Before going live on mainnet:

- [ ] All features tested thoroughly on testnet
- [ ] Security audit completed
- [ ] Rate limiting implemented
- [ ] Error tracking configured (Sentry)
- [ ] Database backups automated
- [ ] Monitoring and alerting set up
- [ ] SSL certificate valid
- [ ] Terms of Service page added
- [ ] Privacy Policy page added
- [ ] Contact/Support page added
- [ ] Documentation updated
- [ ] Team trained on support procedures
- [ ] Emergency rollback plan tested
- [ ] Legal review completed (if applicable)

---

**Last Updated:** 2026-01-02
**Deployment Status:** Ready for Testnet
