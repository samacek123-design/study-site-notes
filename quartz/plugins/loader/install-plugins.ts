#!/usr/bin/env node
// Reads quartz.config.yaml directly and installs plugins via gitLoader.
// Deliberately does NOT import the Quartz config/app: that chain pulls in
// .scss imports and components (Head.tsx) that import .quartz/plugins/index.ts —
// the very file this script generates. Importing it here crashes on any
// fresh checkout (e.g. Vercel), which is exactly where this script runs.
import fs from "fs"
import path from "path"
import YAML from "yaml"
import { styleText } from "util"
import {
  installPlugin,
  installNativeDeps,
  parsePluginSource,
  regeneratePluginIndex,
} from "./gitLoader.js"

async function main() {
  const configPath = path.resolve(process.cwd(), "quartz.config.yaml")
  if (!fs.existsSync(configPath)) {
    console.log("No quartz.config.yaml found, nothing to install.")
    return
  }

  const config: any = YAML.parse(fs.readFileSync(configPath, "utf-8"))
  const sources: string[] = [
    ...(config.plugins ?? [])
      .filter((e: any) => e?.enabled && e?.source)
      .map((e: any) => e.source as string),
    ...(config.externalPlugins ?? []),
  ]

  if (sources.length === 0) {
    console.log("No external plugins to install.")
    return
  }

  console.log(`Installing ${sources.length} plugin(s) from Git...`)

  const allNativeDeps = new Map<string, Map<string, string>>()
  let installed = 0
  for (const source of sources) {
    try {
      const spec = parsePluginSource(source)
      const result = await installPlugin(spec, { verbose: true })
      installed++
      if (result.nativeDeps.size > 0) {
        allNativeDeps.set(spec.name, result.nativeDeps)
      }
    } catch (err) {
      console.error(
        styleText("red", `✗`),
        `Failed to install plugin ${styleText("yellow", source)}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  if (allNativeDeps.size > 0) {
    installNativeDeps(allNativeDeps, { verbose: true })
  }

  await regeneratePluginIndex({ verbose: true })

  if (installed !== sources.length) {
    console.error(`✗ Only ${installed}/${sources.length} plugins installed`)
    process.exit(1)
  }
  console.log("✓ All plugins installed successfully")
}

main().catch((err) => {
  console.error("Failed to install plugins:", err)
  process.exit(1)
})
