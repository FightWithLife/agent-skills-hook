# AGENTS.md

This file provides guidance to Qoder (qoder.com) when working with code in this repository.

## Project Overview

MediaCrawler is a multi-platform social media data crawling tool supporting platforms like Xiaohongshu (Little Red Book), Douyin (TikTok), Kuaishou, Bilibili, Weibo, Baidu Tieba, and Zhihu. The project uses Playwright for browser automation to maintain login sessions and extract public data from these platforms.

## Architecture

### Core Components
- **AbstractCrawler** (`base/base_crawler.py`): Defines the abstract base class for all crawlers with methods for `start()`, `search()`, `launch_browser()` and CDP mode support
- **Platform-specific crawlers** (`media_platform/*/core.py`): Concrete implementations inheriting from AbstractCrawler, each containing platform-specific logic for content extraction
- **Configuration system** (`config/`): Centralized configuration management with `base_config.py` and platform-specific configs
- **Data storage layer** (`store/`): Handles saving crawled data in various formats (JSON, CSV, Excel, SQLite, PostgreSQL, MongoDB)
- **API layer** (`api/`): FastAPI-based web interface for controlling crawlers through REST endpoints
- **Database layer** (`database/`): Database connection management and initialization for persistent storage
- **Proxy system** (`proxy/`): IP proxy pool management for large-scale crawling operations

### Key Directories
- `api/`: FastAPI web interface with routers, schemas, and web UI components
- `base/`: Abstract base classes and shared interfaces
- `cache/`: Cache management for performance optimization
- `cmd_arg/`: Command-line argument parsing and validation
- `config/`: Configuration files for all platforms and base settings
- `constant/`: Shared constants and enumerations
- `database/`: Database connection and initialization logic
- `docs/`: Documentation and static assets
- `media_platform/`: Platform-specific crawler implementations (core logic, API clients, login handlers)
- `model/`: Data models and schemas
- `proxy/`: Proxy IP pool providers and management
- `store/`: Data storage implementations organized by platform
- `tests/`: Unit and integration tests
- `tools/`: Utility functions, async file writers, and helper modules

### Platform Support
- `xhs` (Xiaohongshu/Little Red Book) - Full feature support
- `dy` (Douyin/TikTok) - Full feature support  
- `ks` (Kuaishou) - Full feature support
- `bili` (Bilibili) - Full feature support
- `wb` (Weibo) - Full feature support
- `tieba` (Baidu Tieba) - Full feature support
- `zhihu` (Zhihu) - Full feature support

## Development Commands

### Environment Setup
```bash
# Install dependencies using uv (recommended)
uv sync

# Install Playwright browsers
uv run playwright install

# Install with dev dependencies
uv sync --dev
```

### Running the Crawler
```bash
# Search mode - crawl posts by keywords
uv run main.py --platform xhs --lt qrcode --type search

# Detail mode - crawl specific post by ID
uv run main.py --platform xhs --lt qrcode --type detail

# Creator mode - crawl creator's homepage
uv run main.py --platform xhs --lt qrcode --type creator

# Using cookie login
uv run main.py --platform xhs --lt cookie --type search

# Using phone login
uv run main.py --platform xhs --lt phone --type search

# See all options
uv run main.py --help
```

### Web Interface
```bash
# Start API server with web interface
uv run uvicorn api.main:app --port 8080 --reload

# Or using module method
uv run python -m api.main

# Access web UI at http://localhost:8080
```

### Testing
```bash
# Run all tests
uv run pytest

# Run specific test file
uv run pytest tests/test_excel_store.py

# Run tests with verbose output
uv run pytest -v

# Run tests with coverage
uv run pytest --cov=.

# Run specific test function
uv run pytest tests/test_xhs_crawler.py::test_search_function
```

### Linting and Type Checking
```bash
# Check for Python syntax issues
uv run python -m py_compile $(find . -name "*.py" -not -path "./venv/*")

# Run mypy for type checking (if configured)
uv run mypy .

# Format code with black (if configured)
uv run black .

# Lint with flake8 (if configured)
uv run flake8 .
```

### Database Operations
```bash
# Initialize database
uv run main.py --init-db mysql  # or sqlite, postgres

# Run database migrations (if alembic is configured)
uv run alembic upgrade head
```

## Configuration

### Main Configuration File
- `config/base_config.py`: Primary configuration file with settings for:
  - Platform selection (`PLATFORM`)
  - Keywords for search (`KEYWORDS`)
  - Login type (`LOGIN_TYPE`: qrcode, phone, cookie)
  - Save options (`SAVE_DATA_OPTION`: json, csv, db, sqlite, excel, postgres)
  - Browser settings (`HEADLESS`, `SAVE_LOGIN_STATE`)
  - CDP mode settings (`ENABLE_CDP_MODE`, `CDP_DEBUG_PORT`)
  - Concurrency limits (`MAX_CONCURRENCY_NUM`)
  - Crawl limits (`CRAWLER_MAX_NOTES_COUNT`, `CRAWLER_MAX_COMMENTS_COUNT_SINGLENOTES`)
  - Proxy settings (`ENABLE_IP_PROXY`, `IP_PROXY_POOL_COUNT`)

### Platform-Specific Configurations
Each platform has its own configuration file:
- `config/xhs_config.py`
- `config/dy_config.py`
- `config/ks_config.py`
- `config/bilibili_config.py`
- `config/weibo_config.py`
- `config/tieba_config.py`
- `config/zhihu_config.py`

## Architecture Patterns

### Crawler Factory Pattern
The `CrawlerFactory` in `main.py` creates platform-specific crawler instances based on the configured platform, enabling easy extension for new platforms.

### Abstract Base Classes
Core functionality is defined in abstract base classes:
- `AbstractCrawler`: Core crawling logic and browser management
- `AbstractLogin`: Authentication methods (QR code, mobile, cookies)
- `AbstractStore`: Data storage interfaces
- `AbstractApiClient`: HTTP client interfaces for API calls

### Storage Strategy Pattern
Multiple storage backends are supported through the store system, allowing data to be saved in various formats while maintaining consistent interfaces.

### CDP (Chrome DevTools Protocol) Mode
Enhanced anti-detection capabilities using real browser environments with user profiles and extensions, controlled through CDP for better stealth.

## Important Notes

- The project uses the NON-COMMERCIAL LEARNING LICENSE 1.1
- CDP mode is enabled by default for better anti-detection capabilities
- Data can be saved in multiple formats: JSON, CSV, Excel, SQLite, PostgreSQL, MongoDB
- The project supports proxy IP pools for large-scale crawling operations
- Word cloud generation is available for comment analysis and sentiment visualization
- Browser state persistence allows for resumed sessions and reduced login frequency
- Asynchronous processing enables concurrent crawling operations for improved performance