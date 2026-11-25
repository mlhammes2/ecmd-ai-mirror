import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const plasmicInitPath = path.resolve(__dirname, "../src/plasmic-init.ts");

let code = fs.readFileSync(plasmicInitPath, "utf-8");

// 1. padding with spaces
code = code.replace(/padding:\s*"([^"]+)\s+([^"]+)"/g, 'paddingTop: "$1", paddingBottom: "$1", paddingLeft: "$2", paddingRight: "$2"');
code = code.replace(/padding:\s*"([^"]+)\s+([^"]+)\s+([^"]+)"/g, 'paddingTop: "$1", paddingRight: "$2", paddingBottom: "$3", paddingLeft: "$2"');
code = code.replace(/padding:\s*"([^"]+)\s+([^"]+)\s+([^"]+)\s+([^"]+)"/g, 'paddingTop: "$1", paddingRight: "$2", paddingBottom: "$3", paddingLeft: "$4"');

// 2. margin with spaces
code = code.replace(/margin:\s*"([^"]+)\s+([^"]+)"/g, 'marginTop: "$1", marginBottom: "$1", marginLeft: "$2", marginRight: "$2"');
code = code.replace(/margin:\s*"([^"]+)\s+([^"]+)\s+([^"]+)"/g, 'marginTop: "$1", marginRight: "$2", marginBottom: "$3", marginLeft: "$2"');
code = code.replace(/margin:\s*"([^"]+)\s+([^"]+)\s+([^"]+)\s+([^"]+)"/g, 'marginTop: "$1", marginRight: "$2", marginBottom: "$3", marginLeft: "$4"');

// 3. background -> backgroundColor (when it's a solid color or rgba)
code = code.replace(/background:\s*"([^"]+)"/g, (match, p1) => {
  // if it's url() we might need backgroundImage, but these are mostly colors
  if (p1.includes("url(")) return `backgroundImage: "${p1}"`;
  return `backgroundColor: "${p1}"`;
});

// 4. border: "1px solid #E2E8F0"
code = code.replace(/border:\s*"([^"]+)\s+([^"]+)\s+([^"]+)"/g, 'borderWidth: "$1", borderStyle: "$2", borderColor: "$3"');
code = code.replace(/border:\s*"none"/g, 'borderWidth: "0px", borderStyle: "none"');

// 5. flex: 1
code = code.replace(/flex:\s*1/g, 'flexGrow: 1, flexShrink: 1, flexBasis: "0%"');

// 6. gap
code = code.replace(/gap:\s*"([^"]+)"/g, 'rowGap: "$1", columnGap: "$1"');

fs.writeFileSync(plasmicInitPath, code, "utf-8");
console.log("Fixed shorthands in src/plasmic-init.ts");
