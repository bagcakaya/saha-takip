// OneSignal Configuration
const _k = 'b3NfdjJfYXBwX2Fwc3FtbW1uaGJkem5raXB2emplM2szajd4YmV5amhtNGsydXdtZm5jZWhxbXJybWY1YmxreXpjcG00NHRtcGp0ZmdlcTR5NzZkYXlqczQ1dHR1a2Fiam1oYXdsZ3JnZ3lzbGVkeHE=';

export const ONESIGNAL_CONFIG = {
  APP_ID: '03e50631-8d38-4796-a90f-ae524dab69fd',
  REST_API_KEY: typeof atob !== 'undefined' ? atob(_k) : '',
  ALLOW_LOCAL_HOST: true,
};
