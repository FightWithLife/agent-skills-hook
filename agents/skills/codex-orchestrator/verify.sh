#!/bin/bash
# Codex Orchestrator 配置验证脚本

set -e

echo "=== Codex Orchestrator 配置验证 ==="
echo

# 1. 检查 codex CLI
echo "1. 检查 Codex CLI..."
if command -v codex &> /dev/null; then
    echo "   ✅ Codex CLI 已安装: $(which codex)"
    codex --version
else
    echo "   ❌ Codex CLI 未安装"
    exit 1
fi
echo

# 2. 检查 skill 文件
echo "2. 检查 Skill 配置..."
SKILL_FILE="$HOME/.claude/skills/codex-orchestrator/skill.yaml"
if [ -f "$SKILL_FILE" ]; then
    echo "   ✅ Skill 文件存在: $SKILL_FILE"
    echo "   文件大小: $(wc -c < "$SKILL_FILE") bytes"
else
    echo "   ❌ Skill 文件不存在: $SKILL_FILE"
    exit 1
fi
echo

# 3. 检查 README
echo "3. 检查使用文档..."
README_FILE="$HOME/.claude/skills/codex-orchestrator/README.md"
if [ -f "$README_FILE" ]; then
    echo "   ✅ README 存在: $README_FILE"
    echo "   文件大小: $(wc -c < "$README_FILE") bytes"
else
    echo "   ⚠️  README 不存在（可选）"
fi
echo

# 4. 检查 CLAUDE.md
echo "4. 检查项目配置..."
CLAUDE_MD="/home/xmg/code/PCL/CLAUDE.md"
if [ -f "$CLAUDE_MD" ]; then
    echo "   ✅ CLAUDE.md 存在: $CLAUDE_MD"
    if grep -q "Codex 协作模式" "$CLAUDE_MD"; then
        echo "   ✅ 包含 Codex 协作模式配置"
    else
        echo "   ❌ 未找到 Codex 协作模式配置"
        exit 1
    fi
else
    echo "   ❌ CLAUDE.md 不存在"
    exit 1
fi
echo

# 5. 检查工作目录
echo "5. 检查工作目录..."
PCL_DIR="/home/xmg/code/PCL"
if [ -d "$PCL_DIR" ]; then
    echo "   ✅ PCL 目录存在: $PCL_DIR"
    if [ -d "$PCL_DIR/PCL6" ]; then
        echo "   ✅ PCL6 子目录存在"
    else
        echo "   ⚠️  PCL6 子目录不存在"
    fi
else
    echo "   ❌ PCL 目录不存在"
    exit 1
fi
echo

# 6. 测试 Codex 基本功能
echo "6. 测试 Codex 基本功能..."
if codex exec --help &> /dev/null; then
    echo "   ✅ codex exec 命令可用"
else
    echo "   ❌ codex exec 命令不可用"
    exit 1
fi
echo

# 7. 检查架构文档
echo "7. 检查架构文档..."
ARCH_DIR="$PCL_DIR/PCL6/docs/architecture_zh"
if [ -d "$ARCH_DIR" ]; then
    echo "   ✅ 架构文档目录存在: $ARCH_DIR"
    for doc in README.md 01_system_overview.md 02_module_map.md 03_runtime_pipeline.md 04_change_guidelines.md; do
        if [ -f "$ARCH_DIR/$doc" ]; then
            echo "   ✅ $doc"
        else
            echo "   ⚠️  $doc 不存在"
        fi
    done
else
    echo "   ⚠️  架构文档目录不存在（可选）"
fi
echo

# 总结
echo "=== 验证完成 ==="
echo
echo "✅ 所有必需组件已就绪！"
echo
echo "使用方式："
echo "  1. 在 Claude Code 中说：'使用 codex 实现 XXX 功能'"
echo "  2. 或者直接调用：'/codex-orchestrator 实现 XXX'"
echo
echo "详细文档："
echo "  - Skill 配置: $SKILL_FILE"
echo "  - 使用指南: $README_FILE"
echo "  - 项目配置: $CLAUDE_MD"
echo
