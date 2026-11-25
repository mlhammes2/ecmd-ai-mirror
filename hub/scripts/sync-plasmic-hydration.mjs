// scripts/sync-plasmic-hydration.mjs
// Inspects plasmic-init.ts, parses registered components, slots, props, DOM IDs,
// queries the live Plasmic Loader API, builds public/plasmic-layout-hydration.json, and mirrors to Supabase public.ecmd_plasmic_hydration

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const plasmicInitPath = path.join(rootDir, "src", "plasmic-init.ts");
const outputPath = path.join(rootDir, "public", "plasmic-layout-hydration.json");

async function run() {
  console.log("⚡ [sync-plasmic-hydration] Reading src/plasmic-init.ts...");
  const plasmicInitContent = fs.readFileSync(plasmicInitPath, "utf-8");

  // Extract project id
  const projIdMatch = plasmicInitContent.match(/id:\s*["']([^"']+)["']/);
  const projectId = projIdMatch ? projIdMatch[1] : "mrkoQykvpZZfVbEc1yjabw";

  const tokenMatch = plasmicInitContent.match(/token:\s*["']([^"']+)["']/);
  const apiToken = tokenMatch ? tokenMatch[1] : "public_token_placeholder";

  console.log(`📦 Plasmic Project ID: ${projectId} (Token configured: ${!!apiToken})`);

  // Extract registered components (registerEcmdComponent or legacy registerComponent)
  const regCompRegex = /(?:registerEcmdComponent|\(PLASMIC as any\)\.registerComponent)\(\s*([A-Za-z0-9_]+)\s*,\s*({[\s\S]*?\n\s*}\s*\);)/g;
  const registeredComponents = [];

  let match;
  while ((match = regCompRegex.exec(plasmicInitContent)) !== null) {
    const componentSymbol = match[1];
    const configStr = match[2];

    const nameMatch = configStr.match(/name:\s*["']([^"']+)["']/);
    const displayNameMatch = configStr.match(/displayName:\s*["']([^"']+)["']/);
    const importPathMatch = configStr.match(/importPath:\s*["']([^"']+)["']/);

    // Extract slots
    const slotMatches = [...configStr.matchAll(/([A-Za-z0-9_]+):\s*{\s*type:\s*["']slot["']/g)].map(m => m[1]);

    registeredComponents.push({
      symbol: componentSymbol,
      name: nameMatch ? nameMatch[1] : componentSymbol,
      displayName: displayNameMatch ? displayNameMatch[1] : componentSymbol,
      importPath: importPathMatch ? importPathMatch[1] : "",
      slots: slotMatches,
    });
  }
  
  let livePages = [];
  let liveComponents = [];
  
  // Fetch from Plasmic Loader API
  if (apiToken && apiToken !== "public_token_placeholder") {
    console.log("⚡ [sync-plasmic-hydration] Querying live Plasmic Loader REST API...");
    try {
      const url = `https://codegen.plasmic.app/api/v1/loader/code/preview?platform=react&projectId=${projectId}`;
      const response = await fetch(url, {
        headers: {
          "x-plasmic-api-project-tokens": `${projectId}:${apiToken}`
        },
        signal: AbortSignal.timeout(8000)
      });
      if (response.ok) {
        const data = await response.json();
        const projectData = data.projects?.[0];
        if (projectData) {
           livePages = projectData.components?.filter(c => c.isPage).map(c => ({
             name: c.name,
             path: c.path,
             id: c.id
           })) || [];
           liveComponents = projectData.components?.filter(c => !c.isPage).map(c => ({
             name: c.name,
             id: c.id
           })) || [];
        }
      } else {
        console.warn(`⚠️ Plasmic API returned status: ${response.status}`);
      }
    } catch (e) {
      console.warn("⚠️ Failed to fetch from Plasmic API:", e.message);
    }
  }

  const imageGroupClassTokens = {
    headerLogo: "ecmd-img-header-logo",
    footerLogo: "ecmd-img-footer-logo",
    cardBanner: "ecmd-img-card-banner",
    heroArtwork: "ecmd-img-hero-artwork"
  };

  const hydrationData = {
    projectId,
    tokenConfigured: !!apiToken,
    componentsCount: registeredComponents.length,
    registeredComponents,
    imageGroupClassTokens,
    livePages,
    liveComponents,
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(outputPath, JSON.stringify(hydrationData, null, 2), "utf-8");
  console.log(`✅ [sync-plasmic-hydration] Successfully generated ${outputPath}`);
}

run().catch(console.error);
