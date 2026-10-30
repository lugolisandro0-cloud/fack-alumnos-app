const { packager } = require("@electron/packager");
(async () => {
  const comunes = { dir: "/home/claude/escritorio", out: "/tmp/claude-0/eb/out", overwrite: true, electronVersion: "33.4.11", name: "Alumnos y Cuotas", executableName: "Alumnos y Cuotas", appVersion: "1.6.0", asar: true, prune: false };
  for (const [platform, arch] of [["darwin", "arm64"], ["darwin", "x64"], ["win32", "x64"]]) {
    const extra = platform === "darwin" ? { icon: "/home/claude/escritorio/icono.icns", appBundleId: "ar.fackmusic.alumnos", appCategoryType: "public.app-category.business", extendInfo: { NSCameraUsageDescription: "Para escanear el QR que vincula este dispositivo con tu cuenta." } } : {};
    const p = await packager({ ...comunes, ...extra, platform, arch });
    console.log("ok", platform, arch, p);
  }
})().catch(e => { console.error(e); process.exit(1); });
