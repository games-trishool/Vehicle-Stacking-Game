#!/usr/bin/env python3
"""Build Android through the cloud proxy, preserving TLS and wrapper checksums."""
from pathlib import Path
import os, shutil, subprocess, sys, urllib.parse

repo=Path(__file__).resolve().parent.parent
cache=Path('/workspace/.stackline-cache')
gradle=cache/'gradle'
gradle.mkdir(parents=True,exist_ok=True)
properties=['org.gradle.jvmargs=-Xmx2048m','org.gradle.workers.max=2','org.gradle.java.installations.paths=/workspace/.stackline-cache/temurin21']
proxy=urllib.parse.urlsplit(os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy') or '')
if proxy.hostname:
    port=proxy.port or (443 if proxy.scheme=='https' else 80)
    for scheme in ('http','https'):
        properties.extend([f'systemProp.{scheme}.proxyHost={proxy.hostname}',f'systemProp.{scheme}.proxyPort={port}'])
    properties.append('systemProp.http.nonProxyHosts=localhost|127.*|[::1]')
    cert=None
    for name in ('CODEX_PROXY_CERT','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE'):
        value=os.environ.get(name,'')
        if value and len(value)<4096 and Path(value).is_file():
            cert=Path(value);break
    if cert:
        java=Path(os.environ.get('JAVA_HOME') or Path(shutil.which('java')).resolve().parent.parent)
        trust=cache/'java'/'cacerts'
        trust.parent.mkdir(parents=True,exist_ok=True)
        if not trust.exists():shutil.copyfile(java/'lib/security/cacerts',trust)
        common=['keytool','-keystore',str(trust),'-storepass','changeit']
        exists=subprocess.run(common+['-list','-alias','stackline-platform-ca'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
        if exists:subprocess.run(common+['-delete','-alias','stackline-platform-ca'],check=True,stdout=subprocess.DEVNULL)
        subprocess.run(common+['-importcert','-noprompt','-trustcacerts','-alias','stackline-platform-ca','-file',str(cert)],check=True)
        properties.extend([f'systemProp.javax.net.ssl.trustStore={trust}','systemProp.javax.net.ssl.trustStorePassword=changeit'])
# This file is owned by this helper and contains routing and public trust settings only.
(gradle/'gradle.properties').write_text('\n'.join(properties)+'\n')
build_env=os.environ.copy()
build_env.pop('ANDROID_PREFS_ROOT',None)
build_env.update(JAVA_HOME='/workspace/.stackline-cache/temurin21',ANDROID_HOME='/workspace/.android-sdk',ANDROID_SDK_ROOT='/workspace/.android-sdk',ANDROID_USER_HOME='/workspace/.android-user-home',GRADLE_USER_HOME=str(gradle))
result=subprocess.run([str(repo/'android/gradlew'),'--no-daemon','--max-workers=2',*(sys.argv[1:] or ['assembleDebug'])],cwd=repo/'android',env=build_env)
raise SystemExit(result.returncode)
