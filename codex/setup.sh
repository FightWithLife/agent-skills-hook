#!/usr/bin/env bash
set -euo pipefail

# Codex Integration Setup Script
# 为 Claude Code 配置 Codex 静默调用包装器

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${HOME}/.local/bin"
CODEX_CONFIG="${HOME}/.codex/config.toml"

echo "=== Codex Integration Setup ==="
echo

# 1. 检查 codex 是否安装
echo "1. 检查 Codex CLI..."
if ! command -v codex &> /dev/null; then
    echo "   ❌ Codex CLI 未安装"
    echo "   请先安装 Codex CLI: https://codex.anthropic.com"
    exit 1
fi
echo "   ✅ Codex CLI 已安装: $(which codex)"
echo

# 2. 创建 bin 目录
echo "2. 创建 bin 目录..."
mkdir -p "$BIN_DIR"
echo "   ✅ $BIN_DIR"
echo

# 3. 安装 codex-quiet 脚本
echo "3. 安装 codex-quiet 包装器..."
cp "$SCRIPT_DIR/bin/codex-quiet" "$BIN_DIR/codex-quiet"
chmod +x "$BIN_DIR/codex-quiet"
echo "   ✅ 已安装到: $BIN_DIR/codex-quiet"
echo

# 4. 配置 codex profile
echo "4. 配置 Codex profile..."
if [ ! -f "$CODEX_CONFIG" ]; then
    echo "   ⚠️  Codex 配置文件不存在，创建新配置"
    mkdir -p "$(dirname "$CODEX_CONFIG")"
    cat > "$CODEX_CONFIG" << 'EOF'
# Codex Configuration

[profiles.claude_quiet]
approval_policy = "never"
sandbox_mode = "danger-full-access"
model = "gpt-5.4"
model_reasoning_summary = "none"
model_verbosity = "low"
hide_agent_reasoning = true
EOF
    echo "   ✅ 已创建配置文件: $CODEX_CONFIG"
else
    # 检查是否已有 claude_quiet profile
    if grep -q "\[profiles.claude_quiet\]" "$CODEX_CONFIG"; then
        echo "   ✅ claude_quiet profile 已存在"
    else
        echo "   ⚠️  添加 claude_quiet profile 到配置文件"
        cat >> "$CODEX_CONFIG" << 'EOF'

[profiles.claude_quiet]
approval_policy = "never"
sandbox_mode = "danger-full-access"
model = "gpt-5.4"
model_reasoning_summary = "none"
model_verbosity = "low"
hide_agent_reasoning = true
EOF
        echo "   ✅ 已添加 claude_quiet profile"
    fi
fi
echo

# 5. 验证安装
echo "5. 验证安装..."
if [ -x "$BIN_DIR/codex-quiet" ]; then
    echo "   ✅ codex-quiet 可执行"
else
    echo "   ❌ codex-quiet 不可执行"
    exit 1
fi

if grep -q "\[profiles.claude_quiet\]" "$CODEX_CONFIG"; then
    echo "   ✅ claude_quiet profile 已配置"
else
    echo "   ❌ claude_quiet profile 未配置"
    exit 1
fi
echo

# 6. 更新全局 Claude 配置
echo "6. 更新全局 Claude 配置..."
CLAUDE_GLOBAL_CONFIG="${HOME}/.claude/CLAUDE.md"
if [ -f "$CLAUDE_GLOBAL_CONFIG" ]; then
    if grep -q "codex-quiet" "$CLAUDE_GLOBAL_CONFIG"; then
        echo "   ✅ 全局配置已包含 codex-quiet"
    else
        echo "   ⚠️  添加 Codex Integration 到全局配置"
        cat >> "$CLAUDE_GLOBAL_CONFIG" << 'EOF'

## Codex Integration
- When delegating tasks to Codex CLI, ALWAYS use the quiet wrapper:
  ```bash
  ~/.local/bin/codex-quiet "<task description>"
  ```
- This wrapper suppresses verbose thinking output and returns only final results
- Do NOT use `codex` or `codex exec` directly unless explicitly requested by user
- The quiet wrapper is optimized for Claude-to-Codex delegation workflow
EOF
        echo "   ✅ 已更新全局配置"
    fi
else
    echo "   ⚠️  全局配置文件不存在，跳过"
fi
echo

# 完成
echo "=== 安装完成 ==="
echo
echo "✅ Codex 静默包装器已安装！"
echo
echo "使用方式："
echo "  ~/.local/bin/codex-quiet \"<任务描述>\""
echo
echo "在 Claude Code 中："
echo "  当你说 '使用 codex 实现 XXX' 时，Claude 会自动使用 codex-quiet"
echo
echo "配置文件："
echo "  - 包装器: $BIN_DIR/codex-quiet"
echo "  - Codex 配置: $CODEX_CONFIG"
echo "  - Claude 全局配置: $CLAUDE_GLOBAL_CONFIG"
echo
