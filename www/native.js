/* Lumi Fly – native layer (only active inside the Android/iOS app).
   Ads: Google AdMob (@capacitor-community/admob)
   Purchases: Google Play Billing / Apple StoreKit (cordova-plugin-purchase)
   Vibration: @capacitor/haptics
   In a normal browser this file does nothing and the game keeps its demo behaviour. */
(function () {
  var CX = window.capacitorExports;
  if (!CX || !CX.Capacitor || !CX.Capacitor.isNativePlatform()) return;
  var reg = CX.registerPlugin, IOS = CX.Capacitor.getPlatform() === 'ios';

  /* ===== SETTINGS – change before the store release ===== */
  var CFG = {
    // true = Google test ads (for test builds). Set false only with your own AdMob IDs.
    testAds: true,
    // Your own AdMob ad unit IDs (from admob.google.com). Leave empty while testAds is true.
    android: { inter: '', reward: '' },
    ios: { inter: '', reward: '' },
    privacyUrl: 'https://black-34.github.io/gfe-privacy/lumifly/',
    imprintUrl: 'https://black-34.github.io/gfe-privacy/lumifly/#contact',
    termsUrl: 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'
  };
  var TEST = IOS
    ? { inter: 'ca-app-pub-3940256099942544/4411468910', reward: 'ca-app-pub-3940256099942544/1712485313' }
    : { inter: 'ca-app-pub-3940256099942544/1033173712', reward: 'ca-app-pub-3940256099942544/5224354917' };
  var IDS = CFG.testAds ? TEST : (IOS ? CFG.ios : CFG.android);

  var AdMob = reg('AdMob'), Haptics = reg('Haptics'), App = reg('App'), SystemBars = reg('SystemBars');
  var L = function (en, de, tr) { var l = 'en'; try { l = LANG } catch (e) {} return l === 'de' ? de : l === 'tr' ? tr : en; };
  function say(s) { try { toast(s, true) } catch (e) {} }

  /* ---------- Full screen ---------- */
  try { SystemBars.hide({}) } catch (e) {}

  /* ---------- Vibration ---------- */
  function buzz(ms) { Haptics.vibrate({ duration: Math.max(10, ms | 0) }).catch(function () {}) }

  /* ---------- Ads ---------- */
  var adsReady = false, interLoaded = false, rewardLoaded = false, busy = false;
  function loadInter() { if (!adsReady || interLoaded) return; AdMob.prepareInterstitial({ adId: IDS.inter, isTesting: CFG.testAds, immersiveMode: true }).then(function () { interLoaded = true }).catch(function () { setTimeout(loadInter, 30000) }) }
  function loadReward() { if (!adsReady || rewardLoaded) return; AdMob.prepareRewardVideoAd({ adId: IDS.reward, isTesting: CFG.testAds, immersiveMode: true }).then(function () { rewardLoaded = true }).catch(function () { setTimeout(loadReward, 30000) }) }
  async function initAds() {
    try {
      await AdMob.initialize({
        initializeForTesting: CFG.testAds,
        maxAdContentRating: 'General',          // only ads suitable for everyone (G)
        tagForChildDirectedTreatment: false,    // app is set to "13+" in the store
        tagForUnderAgeOfConsent: false
      });
      if (IOS) { try { await AdMob.requestTrackingAuthorization() } catch (e) {} }
      var info = await AdMob.requestConsentInfo();
      if (info.isConsentFormAvailable && info.status === 'REQUIRED') info = await AdMob.showConsentForm();
      privacyNeeded = info.privacyOptionsRequirementStatus === 'REQUIRED';
      adsReady = info.canRequestAds !== false;
      loadInter(); loadReward();
    } catch (e) { adsReady = true; loadInter(); loadReward() }
  }
  var privacyNeeded = false;
  var onInterEnd = null, onRewardEnd = null, earned = false;
  AdMob.addListener('interstitialAdDismissed', function () { interLoaded = false; busy = false; var f = onInterEnd; onInterEnd = null; if (f) f(); loadInter() });
  AdMob.addListener('interstitialAdFailedToShow', function () { interLoaded = false; busy = false; var f = onInterEnd; onInterEnd = null; if (f) f(); loadInter() });
  AdMob.addListener('onRewardedVideoAdReward', function () { earned = true });
  AdMob.addListener('onRewardedVideoAdDismissed', function () { rewardLoaded = false; busy = false; var f = onRewardEnd; onRewardEnd = null; if (f) f(earned); loadReward() });
  AdMob.addListener('onRewardedVideoAdFailedToShow', function () { rewardLoaded = false; busy = false; var f = onRewardEnd; onRewardEnd = null; if (f) f(false); loadReward() });

  // inter=true: full-screen ad, game continues afterwards in any case.
  // inter=false: rewarded ad, cb only runs when the player watched it to the end.
  function ad(cb, inter) {
    if (busy) return;
    if (inter) {
      if (!interLoaded) {                                   // ad still loading: wait up to 4 s, then show it
        loadInter(); busy = true; var waited = 0;
        var iv = setInterval(function () {
          waited += 200;
          if (interLoaded) { clearInterval(iv); onInterEnd = cb; AdMob.showInterstitial().catch(function () { busy = false; onInterEnd = null; cb() }) }
          else if (waited >= 4000) { clearInterval(iv); busy = false; cb() }
        }, 200);
        return;
      }
      busy = true; onInterEnd = cb; AdMob.showInterstitial().catch(function () { busy = false; onInterEnd = null; cb() });
    } else {
      if (!rewardLoaded) { loadReward(); say(L('No video available right now. Try again in a moment.', 'Gerade kein Video verfügbar. Versuch es gleich nochmal.', 'Şu an video yok. Birazdan tekrar dene.')); return }
      busy = true; earned = false; onRewardEnd = function (ok) { if (ok) cb() };
      AdMob.showRewardVideoAd().catch(function () { busy = false; onRewardEnd = null });
    }
  }

  /* ---------- Purchases ---------- */
  // game key -> store product id and type
  var P = {
    pass:   { id: 'lumi_pass_monthly', t: 'PAID_SUBSCRIPTION' },
    noads:  { id: 'remove_ads',        t: 'NON_CONSUMABLE' },
    s1:     { id: 'stars_300',         t: 'CONSUMABLE' },
    s2:     { id: 'stars_500',         t: 'CONSUMABLE' },
    s3:     { id: 'stars_800',         t: 'CONSUMABLE' },
    silver: { id: 'bird_silver',       t: 'NON_CONSUMABLE' },
    gold:   { id: 'bird_gold',         t: 'NON_CONSUMABLE' }
  };
  var store = null, pending = {}, PLAT = null;
  function keyOf(item) { return item.prod || item.skin || null }
  function applyOwned() {
    if (!store) return;
    try {
      ent.pass = store.owned(P.pass.id) ? Date.now() + 2 * 864e5 : 0;   // refreshed on every app start
      if (store.owned(P.noads.id)) ent.noads = 1;
      saveEnt();
      ['silver', 'gold'].forEach(function (k) {
        if (store.owned(P[k].id) && unl.indexOf(k) < 0) { unl.push(k); localStorage.setItem('sf3-unl', JSON.stringify(unl)) }
      });
      if (typeof passHeart === 'function') passHeart();
      if (typeof coinUI === 'function') coinUI();
    } catch (e) {}
  }
  function initStore() {
    var C = window.CdvPurchase; if (!C) return;
    store = C.store; PLAT = IOS ? C.Platform.APPLE_APPSTORE : C.Platform.GOOGLE_PLAY;
    store.register(Object.keys(P).map(function (k) { return { id: P[k].id, type: C.ProductType[P[k].t], platform: PLAT } }));
    store.when()
      .approved(function (tr) { tr.verify() })
      .verified(function (rc) { rc.finish() })
      .finished(function (tr) {
        (tr.products || []).forEach(function (pr) {
          var k = Object.keys(P).filter(function (x) { return P[x].id === pr.id })[0];
          var cb = pending[k]; delete pending[k];
          if (cb) cb();                                       // grants stars / item exactly like the game expects
          else if (k && P[k].t === 'CONSUMABLE') {            // purchase finished after an app restart: still give the stars
            try { coins += PRODUCTS[k].n; saveFit(); coinUI(); toast('+' + PRODUCTS[k].n + ' ★') } catch (e) {}
          }
        });
        applyOwned();
      })
      .receiptUpdated(applyOwned)
      .productUpdated(function () { });
    store.error(function (e) { if (e && e.code !== C.ErrorCode.PAYMENT_CANCELLED) say(L('Store error. Please try again later.', 'Store-Fehler. Bitte später nochmal versuchen.', 'Mağaza hatası. Lütfen sonra tekrar dene.')) });
    store.initialize([PLAT]).then(applyOwned);
  }
  var nstore = {
    purchase: function (item, ok) {
      var k = keyOf(item); if (!store || !P[k]) { say(L('Store not available.', 'Store nicht verfügbar.', 'Mağaza kullanılamıyor.')); return }
      var pr = store.get(P[k].id, PLAT), off = pr && pr.getOffer();
      if (!off) { say(L('Product not available yet.', 'Produkt noch nicht verfügbar.', 'Ürün henüz mevcut değil.')); return }
      pending[k] = ok; off.order().then(function (err) { if (err) delete pending[k] });
    },
    restore: function () {
      if (!store) return;
      store.restorePurchases().then(function () { applyOwned(); try { toast(T('restored')) } catch (e) {} });
    }
  };
  // localized store price (e.g. "₺34,99") – falls back to the € price in the game
  function price(k) {
    try { var pr = store && P[k] && store.get(P[k].id, PLAT); return pr && pr.pricing && pr.pricing.price || '' } catch (e) { return '' }
  }

  /* ---------- Privacy / imprint ---------- */
  function privacy() {
    dlg.hidden = false;
    var b = function (id, t) { return '<button class="srow" type="button" id="' + id + '" style="width:100%;margin:6px 0">' + t + '</button>' };
    dbody.innerHTML = '<button class="dx" id="dX" type="button" aria-label="Close">' + IC.x + '</button>' +
      '<p class="big">' + T('privacy') + '</p>' +
      b('nPriv', L('Privacy policy', 'Datenschutzerklärung', 'Gizlilik politikası')) +
      b('nImp', L('Imprint', 'Impressum', 'Künye')) +
      (privacyNeeded ? b('nAds', L('Ad privacy choices', 'Werbe-Einstellungen', 'Reklam tercihleri')) : '') +
      (IOS ? b('nTerms', L('Terms of use', 'Nutzungsbedingungen', 'Kullanım koşulları')) : '');
    dbody.onclick = function (e) {
      var t = e.target.closest('button'); if (!t) return;
      if (t.id === 'dX') closeDlg();
      if (t.id === 'nPriv') window.open(CFG.privacyUrl, '_system');
      if (t.id === 'nImp') window.open(CFG.imprintUrl, '_system');
      if (t.id === 'nTerms') window.open(CFG.termsUrl, '_system');
      if (t.id === 'nAds') AdMob.showPrivacyOptionsForm().catch(function () {});
    };
  }

  /* ---------- Android back button & app in background ---------- */
  App.addListener('backButton', function () {
    try {
      if (!dlg.hidden) { var x = document.getElementById('dX'); if (x) x.click(); else closeDlg(); return }
      var closers = ['stClose', 'shClose', 'pClose', 'dClose', 'cClose', 'setClose'];
      for (var i = 0; i < closers.length; i++) { var el = document.getElementById(closers[i]); if (el && el.offsetParent !== null) { el.click(); return } }
      if (st === 'play') { pauseGame(); return }
      if (st !== 'menu') { document.getElementById('menuBtn').click(); return }
      App.exitApp();
    } catch (e) { App.exitApp() }
  });
  App.addListener('pause', function () { try { if (st === 'play') pauseGame() } catch (e) {} });

  window.Native = { buzz: buzz, ad: ad, store: nstore, price: price, privacy: privacy, terms: CFG.termsUrl, privacyUrl: CFG.privacyUrl };
  document.addEventListener('deviceready', initStore, false);
  window.addEventListener('load', function () { setTimeout(initAds, 600) });
})();
