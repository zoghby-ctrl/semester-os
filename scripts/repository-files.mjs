// This allowlist is independent from .gitignore: force-added private files fail audit.
export const rootFiles = new Set([
  ".gitignore", ".env.example", ".node-version", "package.json", "package-lock.json", "tsconfig.json",
  "vite.config.ts", "eslint.config.mjs", "index.html", "serve.mjs", "Start Semester OS.cmd",
  "README.md", "CONTRIBUTING.md", "SECURITY.md", "VALIDATION.md",
]);
export const reviewedScreenshots = {
  "01-today-prism.png": "82486ac09137a37cc2067018b0bf841d63c1f1ee230b3e3a92d1f6e82adb6f88",
  "02-weekly-schedule-campus.png": "80cb02242dc8a499ff7f147d75ade49567781ac11126aac642d7ace633afdf68",
  "03-setup-university-importer.png": "fa38340556f506ab4d64bbfc6607bda5e1449524ef691eed060e50ddd1c80423",
  "04-attendance-arrival-lateness.png": "ebd1ea3ea363ccc97fc9c63539f7eecc8cb7dbf9a61bbc6c3ebe75a8b7296937",
  "05-course-workspace-tasks.png": "312f81339ac2a92455e7b345bee3b9407fce339ac172981ad9cf9e4425d6c25e",
  "06-appearance-prism-themes.png": "13b7aafdaf0b31cfc7a0b65b75a459bed3c1b437125815b3bdfe2e009ea7814b",
  "appearance-desktop.png": "7c89c954c8bd24fa0004213deff44afc6848b8b366c5cffa36e568bda475153f",
  "appearance-light-mobile.png": "b7ea6e3ec9a31c8ab769c2dcb91a429da34b175d3d068c5b298ae1dd8f8c05eb",
  "privacy-desktop.png": "86e74e241a4f99a9209a82a6dff5b492134dd13eadfea5e653c8b191c4a7c9d3",
  "schedule-desktop.png": "e3a687e6f660e31bc5cef801d811f81a100db003112f5ff67cbd655c1d15c659",
  "today-desktop.png": "d94267e2a5f5801455abded408784580e9e08e49f40d2c85436d8e77c02fdc71",
  "today-mobile.png": "65109a6fcede8ec2fb4a190d8adefbf286242b27a4114acd1c61e0e01447f0f1",
  "welcome-desktop.png": "65692076acf0a9ae5fca03e442ea6ed3288e9f537d5120902f317272292121bb",
};
export const isRepositoryFile = (file) => rootFiles.has(file)
  || /^src\/(?:[\w.-]+\/)*[\w.-]+\.(?:tsx?|css)$/.test(file)
  || /^scripts\/[\w.-]+\.mjs$/.test(file)
  || /^\.github\/(?:[\w.-]+\/)*[\w.-]+\.(?:ya?ml|md)$/.test(file)
  || /^docs\/(?:[\w.-]+\/)*[\w.-]+\.md$/.test(file)
  || /^public\/icon(?:-192|-512|-maskable)?\.(?:png|svg)$/.test(file)
  || Object.hasOwn(reviewedScreenshots, file.replace(/^docs\/screenshots\//, "")) && file.startsWith("docs/screenshots/");
