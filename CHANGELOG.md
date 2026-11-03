# Changelog

## Unreleased

- Render `==highlighted text==` in GenUI Markdown with a translucent theme-colored background. Keep nested emphasis and links, inherited text colors, and literal delimiters in code and escaped text.

## 0.3.4-moy.1

- Restore session creation, history reads, and resume with shared OpenCode v2 services in Paseo 0.15 by keeping GenUI thread storage out of provider process environment overrides.
- Supply storage instructions when creating agents and the exact agent directory through `/genui`, without depending on native plugin tool discovery. Preserve both storage aliases for file-backed UI and update shell command examples to use the directory directly.

Based on upstream GenUI 0.3.3.
