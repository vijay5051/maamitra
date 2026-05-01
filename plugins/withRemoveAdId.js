// Removes com.google.android.gms.permission.AD_ID from the merged
// AndroidManifest. Some Google/Firebase SDKs (Play Services, older
// FCM versions) auto-merge this permission even though MaaMitra has
// no ads / Analytics for Android. Without this override, Play Console
// flags the app for Advertising ID usage we don't actually need.
const { withAndroidManifest } = require('@expo/config-plugins');

const AD_ID_NAME = 'com.google.android.gms.permission.AD_ID';

function removeAdIdPermission(androidManifest) {
  const manifest = androidManifest.manifest;
  if (!manifest) return androidManifest;

  // Make sure the manifest declares the `tools:` namespace so the
  // node="remove" attribute is recognised.
  manifest.$ = manifest.$ ?? {};
  if (!manifest.$['xmlns:tools']) {
    manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }

  manifest['uses-permission'] = manifest['uses-permission'] ?? [];

  // Drop any existing AD_ID permission entries first so we don't end
  // up with duplicate nodes when Expo regenerates the prebuild.
  manifest['uses-permission'] = manifest['uses-permission'].filter(
    (p) => p?.$?.['android:name'] !== AD_ID_NAME,
  );

  // Add a single AD_ID entry with tools:node="remove" so the manifest
  // merger drops anything an SDK tries to inject.
  manifest['uses-permission'].push({
    $: {
      'android:name': AD_ID_NAME,
      'tools:node': 'remove',
    },
  });

  return androidManifest;
}

module.exports = function withRemoveAdId(config) {
  return withAndroidManifest(config, (cfg) => {
    cfg.modResults = removeAdIdPermission(cfg.modResults);
    return cfg;
  });
};
