# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

This is an AI skill for automatically creating Xiaohongshu (Little Red Book) notes, including content generation, image card rendering, and automated publishing.

Key components:
- Content creation following Xiaohongshu style guidelines
- Image card generation from Markdown using HTML templates
- Automated publishing to Xiaohongshu platform

## Common Development Commands

### Setup and Dependencies

**Python setup:**
```bash
pip install -r requirements.txt
playwright install chromium
```

**Node.js setup:**
```bash
npm install
npx playwright install chromium
```

### Testing Rendering

**Render with Python:**
```bash
python scripts/render_xhs.py assets/example.md --output-dir ./output
```

**Render with Node.js:**
```bash
node scripts/render_xhs.js assets/example.md --output-dir ./output
```

### Publishing to Xiaohongshu

First configure `.env` with your Xiaohongshu cookie:
```bash
cp env.example.txt .env
# Edit .env to add your XHS_COOKIE
```

Then publish:
```bash
python scripts/publish_xhs.py --title "Note Title" --desc "Description" --images cover.png card_1.png card_2.png
```

## Architecture Overview

### Core Components

1. **Content Processing Layer**
   - `parse_markdown_file()` - Extracts YAML metadata and content from Markdown
   - `split_content_by_separator()` - Divides content into individual cards using `---` separators
   - Located in both Python (`scripts/render_xhs.py`) and Node.js (`scripts/render_xhs.js`) versions

2. **HTML Template System**
   - `assets/cover.html` - Cover card template with emoji, title, subtitle
   - `assets/card.html` - Content card template for body sections
   - `assets/styles.css` - Shared styling with responsive typography and gradient backgrounds
   - Templates use placeholder variables like `{{CONTENT}}` and `{{PAGE_NUMBER}}`

3. **Rendering Engine**
   - Uses Playwright to render HTML to PNG images
   - Maintains 3:4 aspect ratio (1080×1440px) for Xiaohongshu
   - Handles dynamic height adjustment based on content length
   - Supports Markdown conversion with tag processing

4. **Publishing System**
   - `scripts/publish_xhs.py` - Uses `xhs` library to publish to Xiaohongshu
   - Cookie-based authentication loaded from `.env` file
   - Supports scheduled posting and privacy settings

### Data Flow

```
User Input/Markdown File
        ↓
[YAML Metadata + Content Body]
        ↓
[Split by --- separators]
        ↓
[Convert Markdown → HTML]
        ↓
[Apply HTML Templates]
        ↓
[Render with Playwright]
        ↓
[PNG Images (cover + cards)]
        ↓
[Publish to Xiaohongshu]
```

### Key Technical Details

- **File Structure**: Scripts in `scripts/`, templates in `assets/`, user data in working directory
- **Image Format**: PNG at 1080×1440px (3:4 ratio) with transparent backgrounds
- **Styling**: Gradient backgrounds with glass-morphism effect, responsive typography
- **Content Limits**: Titles ≤20 chars, cover text ≤15 chars each
- **Tag Support**: Automatic processing of `#hashtag` format at end of content

### Important Configuration Files

- `.env` - Contains `XHS_COOKIE` for publishing (created from `env.example.txt`)
- `requirements.txt` - Python dependencies
- `package.json` - Node.js dependencies
- Markdown files - Input format with YAML header and `---` separators for card division