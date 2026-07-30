const { chromium } = require('playwright');
const BASE = 'https://agriqcap.vercel.app';

const VPS = [
  { name: '320', w: 320, h: 568 },
  { name: '375', w: 375, h: 667 },
  { name: '768', w: 768, h: 1024 },
  { name: '1280', w: 1280, h: 800 },
];

const PAGES = [
  { path: '/login', name: 'Login', crit: true },
  { path: '/signup', name: 'Signup', crit: true },
  { path: '/forgot-password', name: 'Forgot', crit: true },
  { path: '/reset-password', name: 'Reset', crit: true },
  { path: '/verify-phone', name: 'VerifyPhone', crit: true },
  { path: '/verify-email', name: 'VerifyEmail', crit: false },
  { path: '/welcome', name: 'Welcome', crit: false },
  { path: '/onboarding', name: 'Onboarding', crit: true },
  { path: '/', name: 'Landing', crit: false },
  { path: '/about', name: 'About', crit: false },
  { path: '/features', name: 'Features', crit: false },
  { path: '/faqs', name: 'FAQs', crit: false },
  { path: '/contact', name: 'Contact', crit: false },
  { path: '/help', name: 'Help', crit: false },
  { path: '/privacy', name: 'Privacy', crit: false },
  { path: '/terms', name: 'Terms', crit: false },
  { path: '/dashboard', name: 'Dashboard', crit: true },
  { path: '/savings', name: 'Savings', crit: true },
  { path: '/loans', name: 'Loans', crit: true },
  { path: '/investments', name: 'Investments', crit: true },
  { path: '/cooperative', name: 'Coop', crit: true },
  { path: '/wallet', name: 'Wallet', crit: true },
  { path: '/wallet/deposit', name: 'WalletDep', crit: false },
  { path: '/wallet/transfer', name: 'WalletXfer', crit: false },
  { path: '/wallet/withdraw', name: 'WalletWd', crit: false },
  { path: '/profile', name: 'Profile', crit: false },
  { path: '/settings', name: 'Settings', crit: false },
  { path: '/statements', name: 'Statements', crit: false },
  { path: '/notifications', name: 'Notifs', crit: false },
  { path: '/admin/dashboard', name: 'AdminDash', crit: true },
  { path: '/admin/products', name: 'AdminProd', crit: true },
  { path: '/admin/loans', name: 'AdminLoans', crit: true },
  { path: '/admin/audit', name: 'AdminAudit', crit: true },
  { path: '/admin/staff', name: 'AdminStaff', crit: true },
  { path: '/admin/reports', name: 'AdminRep', crit: true },
  { path: '/admin/cooperatives', name: 'AdminCoop', crit: true },
  { path: '/admin/investments', name: 'AdminInv', crit: true },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  require('fs').mkdirSync('/tmp/qa_shots', { recursive: true });
  const results = [];
  const issues = [];
  console.log('Testing ' + PAGES.length + ' pages x ' + VPS.length + ' viewports = ' + (PAGES.length * VPS.length) + ' tests');
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text().substring(0,150)); });
      try {
        const resp = await page.goto(BASE + p.path, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(800);
        const status = resp ? resp.status() : 0;
        const m = await page.evaluate(() => ({
          sw: Math.max(document.body.scrollWidth, document.documentElement.scrollWidth),
          cw: document.documentElement.clientWidth,
        }));
        const overflow = m.sw - m.cw;
        const hasOverflow = overflow > 2;
        
        // Check touch targets
        const touchInfo = await page.evaluate(() => {
          const els = document.body.querySelectorAll('button, a, [role=button]');
          let small = 0;
          for (let i = 0; i < Math.min(els.length, 50); i++) {
            const r = els[i].getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) small++;
          }
          return small;
        });
        
        // Check for overflowing elements
        const overflowEls = await page.evaluate(() => {
          const els = document.body.querySelectorAll('*');
          let count = 0;
          let first = '';
          for (let i = 0; i < Math.min(els.length, 300); i++) {
            const r = els[i].getBoundingClientRect();
            if (r.right > window.innerWidth + 2 && r.width > 10) {
              count++;
              if (!first) first = els[i].tagName + '.' + els[i].className.toString().substring(0,30);
            }
          }
          return { count, first };
        });
        
        const r = { page: p.name, vp: vp.name, status, overflow, hasOverflow, overflowEls: overflowEls.count, touchSmall: touchInfo, consoleErrors: errors.length };
        results.push(r);
        
        if (hasOverflow || errors.length > 0) {
          issues.push({ page: p.name, vp: vp.name, overflow, status, consoleErrors: errors, overflowEl: overflowEls.first });
        }
        
        // Screenshot critical pages
        if (p.crit && (vp.name === '320' || vp.name === '1280')) {
          await page.screenshot({ path: '/tmp/qa_shots/' + p.name + '_' + vp.name + '.png' });
        }
        
        process.stdout.write(hasOverflow ? 'X' : errors.length > 0 ? '!' : '.');
      } catch(e) {
        results.push({ page: p.name, vp: vp.name, status: 'ERR', overflow: 0, hasOverflow: false, consoleErrors: 0 });
        process.stdout.write('?');
      }
      await page.close();
    }
    process.stdout.write(' [' + vp.name + ']\n');
    await ctx.close();
  }
  await browser.close();

  // Report
  console.log('\n=== RESULTS ===');
  const overflow = results.filter(r => r.hasOverflow);
  const errs = results.filter(r => r.consoleErrors > 0);
  const passed = results.length - issues.length;
  console.log('Tests: ' + results.length + ' | Pass: ' + passed + ' (' + (passed/results.length*100).toFixed(1) + '%) | Overflow: ' + overflow.length + ' | Console errs: ' + errs.length);
  
  if (issues.length > 0) {
    console.log('\n--- ISSUES FOUND ---');
    issues.forEach(i => {
      console.log('  ' + i.page + ' @ ' + i.vp + ' | overflow=' + i.overflow + 'px | status=' + i.status + (i.consoleErrors.length > 0 ? ' | console: ' + i.consoleErrors[0].substring(0,80) : '') + (i.overflowEl ? ' | el: ' + i.overflowEl : ''));
    });
  }

  // Score table
  console.log('\n=== SCORES ===');
  console.log('Page                 | 320  | 375  | 768  | 1280 | Overall');
  const byPage = {};
  results.forEach(r => {
    if (!byPage[r.page]) byPage[r.page] = {};
    let score = 10;
    if (r.hasOverflow) score -= 4;
    if (r.consoleErrors > 0) score -= 1;
    byPage[r.page][r.vp] = score;
  });
  Object.entries(byPage).forEach(([name, scores]) => {
    const s320 = scores['320'] ?? '-';
    const s375 = scores['375'] ?? '-';
    const s768 = scores['768'] ?? '-';
    const s1280 = scores['1280'] ?? '-';
    const avg = ((s320 + s375 + s768 + s1280) / 4).toFixed(1);
    console.log(name.padEnd(20) + ' | ' + String(s320).padEnd(4) + ' | ' + String(s375).padEnd(4) + ' | ' + String(s768).padEnd(4) + ' | ' + String(s1280).padEnd(4) + ' | ' + avg);
  });
})();
