const { spawn } = require("child_process");
console.log("🚀 Starting Wix CLI non-interactive publish from origin/main...");
const child = spawn("npx", ["wix", "publish", "--from", "repo", "--approve-all", "-y"], {
    stdio: ["pipe", "inherit", "inherit"],
    shell: true
});
// Also press Enter automatically in case older Wix CLI prompts interactively
const timer = setInterval(() => {
    try { child.stdin.write("\n"); } catch (e) {}
}, 1500);
child.on("exit", (code) => {
    clearInterval(timer);
    console.log("✅ Wix CLI publish finished with exit code:", code);
    process.exit(code || 0);
});
