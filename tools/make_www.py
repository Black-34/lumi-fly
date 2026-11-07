"""Turns the browser version of Lumi Fly (lumi-fly.html) into the app version (www/index.html).
Usage: python3 tools/make_www.py lumi-fly.html www/index.html
Every change is checked; if the game code changed so a patch no longer fits, the script stops with an error."""
import sys
src, dst = sys.argv[1], sys.argv[2]
s = open(src, encoding='utf-8').read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    if n != count:
        sys.exit(f'PATCH FAILED ({n}x found, expected {count}): {old[:80]}')
    s = s.replace(old, new)

# 1) store version: test mode off
rep('const SHOW_DEV=true;', 'const SHOW_DEV=false;')
# 2) fonts bundled in the app (works offline, no Google Fonts request)
import re
m = re.search(r'<link[^>]+fonts\.googleapis\.com[^>]*>', s)
if not m: sys.exit('PATCH FAILED: Google Fonts link')
s = s.replace(m.group(0), '<link rel="stylesheet" href="fonts/fonts.css">')
s = re.sub(r'<link[^>]+(fonts\.gstatic\.com|fonts\.googleapis\.com)[^>]*>\s*', '', s)
# 3) native layer before the game script
rep('<script>', '<script src="capacitor.js"></script><script src="native.js"></script>\n<script>')
# 4) vibration via the phone's vibration motor
rep('function buzz(ms){try{if(vib&&navigator.vibrate)navigator.vibrate(ms)}catch(e){}}',
    'function buzz(ms){try{if(!vib)return;if(window.Native)Native.buzz(ms);else if(navigator.vibrate)navigator.vibrate(ms)}catch(e){}}')
# 5) real ads (AdMob)
rep('function adDlg(cb,inter){', 'function adDlg(cb,inter){if(window.Native){Native.ad(cb,inter);return}')
rep('cAd.addEventListener("click",()=>{', 'cAd.addEventListener("click",()=>{if(window.Native){Native.ad(()=>{rv.ad=true;revive()},false);return}')
# 6) real purchases
rep('const Store={purchase(item,ok){ok()},restore(){toast(T("restored"))}};',
    'const Store=window.Native?Native.store:{purchase(item,ok){ok()},restore(){toast(T("restored"))}};')
rep("(stars?'':'<small>'+T(\"demoBuy\")+'</small>')", "(stars||window.Native?'':'<small>'+T(\"demoBuy\")+'</small>')")
# 7) prices from the store in the player's currency (falls back to €)
rep('EUR(PRODUCTS.pass.p)', '(window.Native&&Native.price("pass")||EUR(PRODUCTS.pass.p))')
rep('EUR(PRODUCTS.noads.p)', '(window.Native&&Native.price("noads")||EUR(PRODUCTS.noads.p))')
rep('EUR(PRODUCTS[k].p)', '(window.Native&&Native.price(k)||EUR(PRODUCTS[k].p))', 2)
rep('PR[k]', '(window.Native&&Native.price(k)||PR[k])', 2)
# 8) privacy: links to policy, imprint, ad consent
rep('if(b.id==="sPriv")infoDlg(T("privacy"));', 'if(b.id==="sPriv"){if(window.Native)Native.privacy();else infoDlg(T("privacy"))}')

open(dst, 'w', encoding='utf-8').write(s)
print('OK ->', dst)
