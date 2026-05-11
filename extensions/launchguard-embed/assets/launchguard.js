(function () {
  'use strict';

  var shop = window.__launchguardShop;
  var customerTags = window.__launchguardCustomerTags || [];
  var loggedIn = window.__launchguardLoggedIn || false;

  function getProductHandle() {
    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) return null;
    var match = canonical.href.match(/\/products\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  function fetchCampaignConfig(handle) {
    return fetch('/apps/launchguard/campaign-config?shop=' + encodeURIComponent(shop) + '&product=' + encodeURIComponent(handle))
      .then(function (r) { return r.json(); })
      .catch(function () { return { campaign: null }; });
  }

  function customerHasVipTag(vipTags) {
    if (!vipTags || !vipTags.length) return false;
    return vipTags.some(function (tag) { return customerTags.includes(tag); });
  }

  function renderCountdown(targetEl, campaign) {
    var launchDate = new Date(campaign.publicLaunchAt);

    function tick() {
      var now = new Date();
      var diff = launchDate - now;

      if (diff <= 0) {
        targetEl.querySelector('.lg-countdown-timer').textContent = 'Launching now...';
        setTimeout(function () { location.reload(); }, 3000);
        return;
      }

      var days = Math.floor(diff / 86400000);
      var hours = Math.floor((diff % 86400000) / 3600000);
      var mins = Math.floor((diff % 3600000) / 60000);
      var secs = Math.floor((diff % 60000) / 1000);

      targetEl.querySelector('.lg-countdown-timer').textContent =
        (days > 0 ? days + 'd ' : '') + pad(hours) + 'h ' + pad(mins) + 'm ' + pad(secs) + 's';
    }

    setInterval(tick, 1000);
    tick();
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function buildLockedEl(campaign, state) {
    var el = document.createElement('div');
    el.className = 'lg-lock-overlay';
    el.style.cssText = 'background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:2rem;text-align:center;margin:1rem 0;';

    var title = document.createElement('h2');
    title.style.cssText = 'font-size:1.25rem;font-weight:700;margin-bottom:0.5rem;';
    title.textContent = campaign.countdownTitle;

    var body = document.createElement('p');
    body.style.cssText = 'color:#555;margin-bottom:1rem;';
    body.textContent = state === 'vip' ? campaign.vipMessage : campaign.lockedMessage;

    var timer = document.createElement('div');
    timer.className = 'lg-countdown-timer';
    timer.style.cssText = 'font-size:1.5rem;font-weight:700;letter-spacing:0.05em;margin-bottom:1rem;color:#1A1A2E;';

    el.appendChild(title);
    el.appendChild(body);
    el.appendChild(timer);

    if (campaign.brandingEnabled) {
      var brand = document.createElement('p');
      brand.style.cssText = 'font-size:0.7rem;color:#bbb;margin-top:1rem;';
      brand.textContent = 'Powered by LaunchGuard';
      el.appendChild(brand);
    }

    return el;
  }

  function hideAddToCartButtons() {
    var selectors = [
      'form[action="/cart/add"] button[type="submit"]',
      '.product-form__submit',
      '.btn--add-to-cart',
      '[data-add-to-cart]'
    ];
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (btn) {
        btn.style.display = 'none';
      });
    });
  }

  function applyLockExperience(campaign) {
    var now = new Date();
    var vipStart = campaign.vipAccessStartsAt ? new Date(campaign.vipAccessStartsAt) : null;
    var launchAt = new Date(campaign.publicLaunchAt);
    var isVipWindow = vipStart && now >= vipStart && now < launchAt;
    var hasVip = customerHasVipTag(campaign.vipTags);

    if (campaign.status === 'LIVE') return;

    if (isVipWindow && hasVip && loggedIn) {
      // VIP customer in early access — show VIP message, allow purchase
      var productForm = document.querySelector('form[action="/cart/add"]');
      if (productForm) {
        var vipEl = document.createElement('div');
        vipEl.style.cssText = 'background:#fff8e1;border-radius:6px;padding:0.75rem 1rem;margin-bottom:1rem;font-size:0.875rem;color:#5d4037;';
        vipEl.textContent = campaign.vipMessage;
        productForm.insertAdjacentElement('beforebegin', vipEl);
      }
      return;
    }

    // All other cases: lock the product
    hideAddToCartButtons();

    var insertTarget = document.querySelector('.product-form, form[action="/cart/add"], .product__info-container');
    if (!insertTarget) {
      insertTarget = document.querySelector('main, #main-content, .main-content');
    }
    if (!insertTarget) return;

    var state = (isVipWindow && !hasVip) ? 'locked' : 'countdown';
    var lockEl = buildLockedEl(campaign, state);
    insertTarget.insertAdjacentElement('beforebegin', lockEl);
    renderCountdown(lockEl, campaign);
  }

  function init() {
    var handle = getProductHandle();
    if (!handle || !shop) return;

    fetchCampaignConfig(handle).then(function (data) {
      if (!data.campaign) return;
      applyLockExperience(data.campaign);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
