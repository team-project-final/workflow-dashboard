#!/usr/bin/env node
/**
 * Parser registry — maps source type strings to parser modules.
 * Each parser must export: { name, validate, fetch, transform }
 */

const registry = new Map()

export function registerParser(name, parser) {
  if (!parser.validate || !parser.fetch || !parser.transform) {
    throw new Error(`Parser "${name}" must export validate, fetch, and transform functions`)
  }
  registry.set(name, parser)
}

export function getParser(sourceType) {
  const parser = registry.get(sourceType)
  if (!parser) {
    const available = [...registry.keys()].join(', ')
    throw new Error(`Unknown source type: "${sourceType}". Available: ${available}`)
  }
  return parser
}

export function listParsers() {
  return [...registry.keys()]
}

// Auto-register built-in parsers
async function loadBuiltins() {
  const builtins = [
    ['github-markdown', './github-markdown.mjs'],
    ['notion', './notion.mjs'],
    ['linear', './linear.mjs'],
  ]

  for (const [name, path] of builtins) {
    try {
      const mod = await import(path)
      registerParser(name, mod.default || mod)
    } catch (e) {
      // Parser not available — skip silently
    }
  }
}

await loadBuiltins()
