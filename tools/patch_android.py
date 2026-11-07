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

# ---- Leaderboards: Google Play Games Services v2 ----
# Fill in after setting up Play Games Services in the Play Console (Grow > Play Games Services > Setup):
PLAY_GAMES_APP_ID = os.environ.get('PLAY_GAMES_APP_ID') or ''   # e.g. '123456789012' (only digits)
import glob
pkg_dir = os.path.dirname(glob.glob(f'{A}/src/main/java/**/MainActivity.java', recursive=True)[0])
shutil.copy('native-src/android/LeaderboardPlugin.java', pkg_dir)
edit(glob.glob(f'{A}/src/main/java/**/MainActivity.java', recursive=True)[0], lambda s: s.replace(
    'public class MainActivity extends BridgeActivity {}',
    'public class MainActivity extends BridgeActivity {\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(LeaderboardPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n}'))
edit(f'{A}/build.gradle', lambda s: s.replace("    implementation project(':capacitor-android')",
    "    implementation project(':capacitor-android')\n    implementation 'com.google.android.gms:play-services-games-v2:20.1.2'", 1))
if PLAY_GAMES_APP_ID:
    edit(f'{A}/src/main/res/values/strings.xml', lambda s: s.replace('</resources>', f'    <string name="game_services_project_id" translatable="false">{PLAY_GAMES_APP_ID}</string>\n</resources>'))
    edit(f'{A}/src/main/AndroidManifest.xml', lambda s: re.sub(r'(<application\b[^>]*>)', r'\1\n        <meta-data android:name="com.google.android.gms.games.APP_ID" android:value="@string/game_services_project_id" />', s, count=1))
print('Play Games leaderboards:', 'ON (' + PLAY_GAMES_APP_ID + ')' if PLAY_GAMES_APP_ID else 'off (no app id yet)')

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
