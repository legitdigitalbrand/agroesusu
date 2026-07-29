const { chromium } = require('playwright');

const BASE_URL = 'https://agroesusu-repo.vercel.app';

const VIEWPORTS = [
  { name: '320px', width: 320, height: 568 },
  { name: '375px', width: 375, height: 667 },
  { name: '390px', width: 390, height: 844 },
  { name: '430px', width: 430, height: 932 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1024px', width: 1024, height: 768 },
  { name: '1280px', width: 1280, height: 800 },
  { name: '1440px', width: 1440, height: 900 },
];

const PUBLIC_PAGES = [
  { path: '/login', name: 'Login', critical: true },
  { path: '/signup', name: 'Signup', critical: true },
  { path: '/forgot-password', name: 'Forgot Password', critical: true },
  { path: '/reset-password', name: 'Reset Password', critical: true },
  { path: '/verify-phone', name: 'Verify Phone', critical: true },
  { path: '/verify-email', name: 'Verify Email', critical: false },
  { path: '/welcome', name: 'Welcome', critical: false },
  { path: '/', name: 'Landing', critical: false },
  { path: '/about', name: 'About', critical: false },
  { path: '/features', name: 'Features', critical: false },
  { path: '/faqs', name: 'FAQs', critical: false },
  { path: '/contact', name: 'Contact', critical: false },
  { path: '/help', name: 'Help', critical: false },
  { path: '/privacy', name: 'Privacy', critical: false },
  { path: '/terms', name: 'Terms', critical: false },
];

const PROTECTED_PAGES = [
  { path: '/dashboard', name: 'Dashboard', critical: true },
  { path: '/savings', name: 'Savings', critical: true },
  { path: '/loans', name: 'Loans', critical: true },
  { path: '/investments', name: 'Investments', critical: true },
  { path: '/cooperative', name: 'Cooperative', critical: true },
  { path: '/wallet', name: 'Wallet', critical: true },
  { path: '/wallet/deposit', name: 'Wallet Deposit', critical: false },
  { path: '/wallet/transfer', name: 'Wallet Transfer', critical: false },
  { path: '/wallet/withdraw', name: 'Wallet Withdraw', critical: false },
  { path: '/profile', name: 'Profile', critical: false },
  { path: '/settings', name: 'Settings', critical: false },
  { path: '/statements', name: 'Statements', critical: false },
  { path: '/notifications', name: 'Notifications', critical: false },
  { path: '/admin/dashboard', name: 'Admin Dashboard', critical: true },
  { path: '/admin/products', name: 'Admin Products', critical: true },
  { path: '/admin/loans', name: 'Admin Loans', critical: true },
  { path: '/admin/audit', name: 'Admin Audit', critical: true },
  { path: '/admin/staff', name: 'Admin Staff', critical: true },
  { path: '/admin/reports', name: 'Admin Reports', critical: true },
  { path: '/admin/cooperatives', name: 'Admin Coops', critical: true },
  { path: '/admin/investments', name: 'Admin Invest', critical: true },
];

async function testPage(page, viewport, pageInfo) {
  const result = {
    page: pageInfo.name, path: pageInfo.path, viewport: viewport.name,
    status: null, horizontalScroll: false, scrollWidth: 0, clientWidth: 0,
    overflowPx: 0, consoleErrors: [], issues: [], screenshotPath: null,
  };
  const consoleHandler = (msg) => {
    if (msg.type() === 'error') result.consoleErrors.push(msg.text().substring(0, 200));
  };
  page.on('console', consoleHandler);
  try {
    const response = await page.goto(BASE_URL + pageInfo.path, { waitUntil: 'networkidle', timeout: 30000 });
    result.status = response ? response.status() : null;
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => {
      const sw = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth, document.documentElement.offsetWidth);
      const cw = document.documentElement.clientWidth;
      return { sw, cw, overflow: sw - cw };
    });
    result.scrollWidth = m.sw; result.clientWidth = m.cw; result.overflowPx = m.overflow;
    result.horizontalScroll = m.overflow > 2;
    const issues = await page.evaluate(() => {
      const issues = [];
      const els = document.body.querySelectorAll('*');
      let overflow = 0;
      for (let i = 0; i < Math.min(els.length, 500); i++) {
        const r = els[i].getBoundingClientRect();
        if (r.right > window.innerWidth + 2 && r.width > 10) {
          overflow++;
          if (overflow <= 3) issues.push('Overflow: ' + els[i].tagName + '.' + els[i].className.toString().substring(0, 40) + ' right=' + Math.round(r.right) + 'px');
        }
      }
      if (overflow > 3) issues.push('... +' + (overflow - 3) + ' more');
      // Touch targets
      const small = [];
      const interactives = document.body.querySelectorAll('button, a, input, [role=button]');
      for (let i = 0; i < Math.min(interactives.length, 100); i++) {
        const r = interactives[i].getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 40 || r.height < 40)) {
          small.push(interactives[i].tagName + ' (' + Math.round(r.width) + 'x' + Math.round(r.height) + ')');
        }
      }
      if (small.length > 0) issues.push('Small touch: ' + small.slice(0, 4).join('; ') + (small.length > 4 ? ' +' + (small.length-4) : ''));
      return issues;
    });
    result.issues = issues;
    if (pageInfo.critical && (viewport.name === '320px' || viewport.name === '768px' || viewport.name === '1280px')) {
      const name = pageInfo.name.replace(/[^a-zA-Z0-9]/g, '_') + '_' + viewport.name + '.png';
      await page.screenshot({ path: '/tmp/qa_screenshots/' + name, fullPage: false });
      result.screenshotPath = '/tmp/qa_screenshots/' + name;
    }
  } catch (e) {
    result.status = 'ERROR';
    result.issues.push('Nav error: ' + e.message.substring(0, 100));
  }
  page.off('console', consoleHandler);
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  require('fs').mkdirSync('/tmp/qa_screenshots', { recursive: true });
  const allResults = [];
  const issueTracker = [];
  const pageScores = {};
  console.log('='.repeat(80));
  console.log('  COMPREHENSIVE RESPONSIVE QA - AgroEsusu');
  console.log('  ' + (PUBLIC_PAGES.length + PROTECTED_PAGES.length) + ' pages x ' + VIEWPORTS.length + ' viewports = ' + ((PUBLIC_PAGES.length + PROTECTED_PAGES.length) * VIEWPORTS.length) + ' tests');
  console.log('='.repeat(80));
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    for (const pi of [...PUBLIC_PAGES, ...PROTECTED_PAGES]) {
      const page = await ctx.newPage();
      const r = await testPage(page, vp, pi);
      allResults.push(r);
      if (r.horizontalScroll || r.issues.length > 0 || r.consoleErrors.length > 0) {
        issueTracker.push({ severity: r.horizontalScroll ? 'Critical' : r.consoleErrors.length > 0 ? 'High' : 'Medium', page: pi.name, viewport: vp.name, issues: [...r.issues, ...r.consoleErrors.map(e => 'Console: ' + e)] });
      }
      const key = pi.name;
      if (!pageScores[key]) pageScores[key] = { desktop: 10, tablet: 10, mobile: 10, count: 0 };
      pageScores[key].count++;
      const m = vp.width < 768, t = vp.width >= 768 && vp.width < 1024, d = vp.width >= 1024;
      if (r.horizontalScroll) { if (m) pageScores[key].mobile -= 3; if (t) pageScores[key].tablet -= 3; if (d) pageScores[key].desktop -= 3; }
      if (r.issues.length > 0) { if (m) pageScores[key].mobile -= 0.3 * r.issues.length; if (t) pageScores[key].tablet -= 0.3 * r.issues.length; if (d) pageScores[key].desktop -= 0.3 * r.issues.length; }
      const status = r.horizontalScroll ? 'OVERFLOW' : r.issues.length > 0 ? 'ISSUES' : 'OK';
      process.stdout.write(status === 'OK' ? '.' : (status === 'OVERFLOW' ? 'X' : '!'));
      await page.close();
    }
    process.stdout.write('  [' + vp.name + ']\n');
    await ctx.close();
  }
  await browser.close();

  // REPORT
  console.log('\n' + '='.repeat(80));
  console.log('  RESULTS SUMMARY');
  console.log('='.repeat(80));
  const overflow = allResults.filter(r => r.horizontalScroll);
  const errors = allResults.filter(r => r.consoleErrors.length > 0);
  const issues = allResults.filter(r => r.issues.length > 0 && !r.horizontalScroll);
  const passed = allResults.length - issueTracker.length;
  console.log('Total tests: ' + allResults.length);
  console.log('Overflow (Critical): ' + overflow.length);
  console.log('Console errors (High): ' + errors.length);
  console.log('Other issues (Medium/Low): ' + issues.length);
  console.log('Passed: ' + passed + ' (' + (passed/allResults.length*100).toFixed(1) + '%)');

  if (overflow.length > 0) {
    console.log('\n--- OVERFLOW DETAILS ---');
    overflow.forEach(r => {
      console.log('  ' + r.page + ' @ ' + r.viewport + ': ' + r.overflowPx + 'px');
      r.issues.slice(0, 2).forEach(i => console.log('    -> ' + i));
    });
  }
  if (errors.length > 0) {
    console.log('\n--- CONSOLE ERRORS ---');
    errors.forEach(r => r.consoleErrors.forEach(e => console.log('  ' + r.page + ' @ ' + r.viewport + ': ' + e.substring(0, 120))));
  }
  if (issues.length > 0) {
    console.log('\n--- OTHER ISSUES ---');
    issues.forEach(r => {
      console.log('  ' + r.page + ' @ ' + r.viewport + ':');
      r.issues.slice(0, 2).forEach(i => console.log('    -> ' + i));
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('  RESPONSIVE SCORES');
  console.log('='.repeat(80));
  console.log('Page'.padEnd(25) + 'Desktop'.padStart(10) + 'Tablet'.padStart(10) + 'Mobile'.padStart(10) + 'Overall'.padStart(10));
  console.log('-'.repeat(65));
  Object.entries(pageScores).sort((a,b) => {
    return ((b[1].desktop+b[1].tablet+b[1].mobile)/3) - ((a[1].desktop+a[1].tablet+a[1].mobile)/3);
  }).forEach(([name, s]) => {
    const overall = ((s.desktop + s.tablet + s.mobile) / 3).toFixed(1);
    const cl = v => Math.max(0, Math.min(10, v)).toFixed(1);
    console.log(name.padEnd(25) + cl(s.desktop).padStart(10) + cl(s.tablet).padStart(10) + cl(s.mobile).padStart(10) + overall.padStart(10));
  });

  if (issueTracker.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('  ISSUE TRACKER');
    console.log('='.repeat(80));
    console.log('Severity'.padEnd(12) + 'Page'.padEnd(25) + 'Viewport'.padEnd(10) + 'Issue');
    console.log('-'.repeat(80));
    issueTracker.forEach(i => i.issues.forEach(issue => console.log(i.severity.padEnd(12) + i.page.padEnd(25) + i.viewport.padEnd(10) + issue.substring(0, 60))));
  }

  const shots = allResults.filter(r => r.screenshotPath).map(r => r.screenshotPath);
  console.log('\nScreenshots: ' + shots.length);
  shots.forEach(s => console.log('  ' + s));
})();
