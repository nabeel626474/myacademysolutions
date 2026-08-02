import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.myacademysolutions",
  appName: "My Academy Solutions",
  webDir: "dist",
  server: {
    // The app is server-rendered (it fetches results server-side),
    // so the Android shell loads the live published site.
    url: "https://myacademysolutions.lovable.app",
    cleartext: false,
  },
  android: {
    backgroundColor: "#0b1a14",
  },
};

export default config;
