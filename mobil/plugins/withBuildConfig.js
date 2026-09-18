const {
  withAppBuildGradle,
  withGradleProperties,
  withMainActivity,
  withMainApplication,
} = require('@expo/config-plugins');

function withBuildConfig(config) {
  // 1. Enable buildConfig in android/app/build.gradle and ensure buildConfigField
  config = withAppBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;

    // Ensure buildFeatures { buildConfig = true }
    if (contents.includes('buildFeatures {')) {
      if (!contents.includes('buildConfig = true') && !contents.includes('buildConfig true')) {
        contents = contents.replace(
          /buildFeatures\s*\{/,
          'buildFeatures {\n        buildConfig = true'
        );
      }
    } else {
      contents = contents.replace(
        'android {',
        'android {\n    buildFeatures {\n        buildConfig = true\n    }'
      );
    }

    // Ensure IS_NEW_ARCHITECTURE_ENABLED is in defaultConfig
    if (!contents.includes('IS_NEW_ARCHITECTURE_ENABLED')) {
      contents = contents.replace(
        /defaultConfig\s*\{/,
        'defaultConfig {\n        buildConfigField "boolean", "IS_NEW_ARCHITECTURE_ENABLED", "true"'
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 2. Add to gradle.properties for extra safety
  config = withGradleProperties(config, (modConfig) => {
    modConfig.modResults.push({
      type: 'property',
      key: 'android.defaults.buildfeatures.buildconfig',
      value: 'true',
    });
    return modConfig;
  });

  // 3. Fix MainActivity.kt:
  // - Add explicit import of BuildConfig
  // - Keep BuildConfig.IS_NEW_ARCHITECTURE_ENABLED intact so New Architecture / Fabric is enabled
  config = withMainActivity(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const packageName = config.android?.package || 'com.sahatakip.app';

    if (!contents.includes(`import ${packageName}.BuildConfig`)) {
      contents = contents.replace(
        /package\s+[\w\.]+/,
        `$&\n\nimport ${packageName}.BuildConfig`
      );
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  // 4. Fix MainApplication.kt:
  // - Add explicit import of BuildConfig
  // - Replace BuildConfig.REACT_NATIVE_RELEASE_LEVEL with ReleaseLevel.STABLE
  config = withMainApplication(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    const packageName = config.android?.package || 'com.sahatakip.app';

    if (!contents.includes(`import ${packageName}.BuildConfig`)) {
      contents = contents.replace(
        /package\s+[\w\.]+/,
        `$&\n\nimport ${packageName}.BuildConfig`
      );
    }

    if (contents.includes('BuildConfig.REACT_NATIVE_RELEASE_LEVEL')) {
      contents = contents.replace(
        /DefaultNewArchitectureEntryPoint\.releaseLevel\s*=\s*try\s*\{[\s\S]*?\}\s*catch\s*\([\s\S]*?\)\s*\{[\s\S]*?\}/,
        'DefaultNewArchitectureEntryPoint.releaseLevel = ReleaseLevel.STABLE'
      );
      if (contents.includes('BuildConfig.REACT_NATIVE_RELEASE_LEVEL')) {
        contents = contents.replace(
          'BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase()',
          '"STABLE"'
        );
      }
    }

    modConfig.modResults.contents = contents;
    return modConfig;
  });

  return config;
}

module.exports = withBuildConfig;
