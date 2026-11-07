"""Applies the Lumi Fly settings to the generated Android project (run after `npx cap add android`).
Checks the Play Console requirements and stops the build if one is not met."""
import os, re, shutil, sys

A = 'android/app'
run = int(os.environ.get('GITHUB_RUN_NUMBER', '1'))
VERSION_CODE = 100 + run                     # always higher than the last upload
VERSION_NAME = f'1.0.{run}'
ADMOB_APP_ID = os.environ.get('ADMOB_APP_ID') or 'ca-app-pub-3940256099942544~3347511713'  # Google test ID until your own exists

def edit(path, fn):
    s = open(path, encoding='utf-8').read(); n = fn(s)
    if n == s: sys.exit('PATCH FAILED: ' + path)
    open(path, 'w', encoding='utf-8').write(n)

# icons + splash
shutil.copytree('native-res/android', f'{A}/src/main/res', dirs_exist_ok=True)

# AdMob app id
edit(f'{A}/src/main/res/values/strings.xml',
     lambda s: s.replace('</resources>', f'    <string name="admob_app_id">{ADMOB_APP_ID}</string>\n</resources>'))

# manifest: AdMob id, portrait, no backup of game data to strangers' devices
def man(s):
    s = re.sub(r'(<application\b[^>]*>)', r'\1\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="@string/admob_app_id" />', s, count=1)
    s = s.replace('android:name=".MainActivity"', 'android:name=".MainActivity"\n            android:screenOrientation="portrait"', 1)
    return s
edit(f'{A}/src/main/AndroidManifest.xml', man)

# version + release signing (key comes from GitHub secrets, never stored in the code)
def gradle(s):
    s = re.sub(r'versionCode \d+', f'versionCode {VERSION_CODE}', s)
    s = re.sub(r'versionName "[^"]*"', f'versionName "{VERSION_NAME}"', s)
    sign = '''    signingConfigs {
        release {
            if (System.getenv("LF_KEYSTORE")) {
                storeFile file(System.getenv("LF_KEYSTORE"))
                storePassword System.getenv("LF_KS_PASS")
                keyAlias System.getenv("LF_KEY_ALIAS")
                keyPassword System.getenv("LF_KEY_PASS")
            }
        }
    }
    buildTypes {'''
    s = s.replace('    buildTypes {', sign, 1)
    s = re.sub(r'(buildTypes \{\s*release \{)', r'\1\n            if (System.getenv("LF_KEYSTORE")) { signingConfig signingConfigs.release }', s, count=1)
    return s
edit(f'{A}/build.gradle', gradle)

# ---- Play Console checks ----
v = open('android/variables.gradle').read()
target = int(re.search(r'targetSdkVersion\s*=\s*(\d+)', v).group(1))
minsdk = int(re.search(r'minSdkVersion\s*=\s*(\d+)', v).group(1))
appid = re.search(r'applicationId "([^"]+)"', open(f'{A}/build.gradle').read()).group(1)
errors = []
if target < 36: errors.append(f'targetSdk {target} < 36 (Play requires Android 16 / API 36)')
if appid != 'com.lumifly.game': errors.append(f'wrong applicationId {appid}')
print(f'applicationId={appid} versionCode={VERSION_CODE} versionName={VERSION_NAME} minSdk={minsdk} targetSdk={target}')
if errors: sys.exit('PLAY CHECK FAILED: ' + '; '.join(errors))
print('Play Console checks OK')
