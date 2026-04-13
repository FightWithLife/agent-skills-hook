# agent-skills-hook Windows 部署脚本
# 使用复制方式部署配置

param(
    [string]$Target = "both",
    [string]$RepoRoot = ""
)

if ($RepoRoot -eq "") {
    $RepoRoot = Split-Path $PSScriptRoot -Parent
}

$ErrorActionPreference = "Stop"

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RepoSkills = Join-Path $RepoRoot "agents\skills"
$WindowsRoot = Join-Path $RepoRoot "windows"

# 验证 skills 目录存在
if (-not (Test-Path $RepoSkills)) {
    Write-Error "ERROR: $RepoSkills missing. Run 'git submodule update --init --recursive agents/skills' first."
    exit 1
}

function Merge-MissingSkills {
    param([string]$Src)
    
    if (-not (Test-Path $Src)) { return }
    
    $RealPath = $Src
    if (Test-Path $Src -PathType Container) {
        $RealPath = $Src
    }
    
    if (-not (Test-Path $RealPath -PathType Container)) { return }
    
    Get-ChildItem $RealPath -Directory | ForEach-Object {
        $Name = $_.Name
        $DestPath = Join-Path $RepoSkills $Name
        if (-not (Test-Path $DestPath)) {
            Copy-Item $_.FullName $DestPath -Recurse
        }
    }
}

function Safe-Copy {
    param(
        [string]$Src,
        [string]$Dest,
        [bool]$Force = $true
    )
    
    $DestDir = Split-Path $Dest -Parent
    if ($DestDir -and -not (Test-Path $DestDir)) {
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }
    
    if (Test-Path $Dest) {
        if ($Force) {
            Remove-Item $Dest -Recurse -Force
        } else {
            return
        }
    }
    
    Copy-Item $Src $Dest -Recurse -Force
}

# Codex 部署
if ($Target -eq "codex" -or $Target -eq "both" -or $Target -eq "all") {
    $BackupC = Join-Path $env:USERPROFILE ".codex-backups\agent-skills-hook-$Stamp"
    New-Item -ItemType Directory -Path "$BackupC\codex", "$BackupC\agents", "$BackupC\repo" -Force | Out-Null
    
    # 备份现有配置
    $CodexDir = Join-Path $env:USERPROFILE ".codex"
    if (Test-Path "$CodexDir\AGENTS.md") { Copy-Item "$CodexDir\AGENTS.md" "$BackupC\codex\AGENTS.md" -Force }
    if (Test-Path "$CodexDir\config.toml") { Copy-Item "$CodexDir\config.toml" "$BackupC\codex\config.toml" -Force }
    if (Test-Path "$CodexDir\agents") { Copy-Item "$CodexDir\agents" "$BackupC\codex\agents" -Recurse -Force }
    if (Test-Path "$CodexDir\rules") { Copy-Item "$CodexDir\rules" "$BackupC\codex\rules" -Recurse -Force }
    if (Test-Path "$CodexDir\skills") { Copy-Item "$CodexDir\skills" "$BackupC\codex\skills" -Recurse -Force }
    if (Test-Path "$env:USERPROFILE\.agents\skills") { Copy-Item "$env:USERPROFILE\.agents\skills" "$BackupC\agents\skills" -Recurse -Force }
    Copy-Item $RepoSkills "$BackupC\repo\skills" -Recurse -Force
    
    # 创建目录
    New-Item -ItemType Directory -Path "$CodexDir\rules" -Force | Out-Null
    
    # 部署配置（复制而非链接）
    Safe-Copy "$WindowsRoot\codex\AGENTS.md" "$CodexDir\AGENTS.md"
    if (Test-Path "$WindowsRoot\codex\rules") {
        Safe-Copy "$WindowsRoot\codex\rules" "$CodexDir\rules"
    }
    if (Test-Path "$WindowsRoot\codex\agents") {
        Safe-Copy "$WindowsRoot\codex\agents" "$CodexDir\agents"
    }
    
    # 复制 skills（创建副本，Windows 不使用软链接）
    Safe-Copy $RepoSkills "$CodexDir\skills"
    Safe-Copy $RepoSkills "$env:USERPROFILE\.agents\skills"
    
    Write-Host "Codex deployed. Backup: $BackupC"
}

# OpenCode 部署
if ($Target -eq "opencode" -or $Target -eq "both" -or $Target -eq "all") {
    $BackupO = Join-Path $env:USERPROFILE ".opencode-backups\agent-skills-hook-$Stamp"
    New-Item -ItemType Directory -Path "$BackupO\opencode", "$BackupO\agents", "$BackupO\claude", "$BackupO\repo" -Force | Out-Null
    
    # 备份现有配置
    $OpenCodeDir = Join-Path $env:USERPROFILE ".config\opencode"
    if (Test-Path "$OpenCodeDir\AGENTS.md") { Copy-Item "$OpenCodeDir\AGENTS.md" "$BackupO\opencode\AGENTS.md" -Force }
    if (Test-Path "$OpenCodeDir\agents") { Copy-Item "$OpenCodeDir\agents" "$BackupO\opencode\agents" -Recurse -Force }
    if (Test-Path "$OpenCodeDir\skills") { Copy-Item "$OpenCodeDir\skills" "$BackupO\opencode\skills" -Recurse -Force }
    if (Test-Path "$env:USERPROFILE\.agents\skills") { Copy-Item "$env:USERPROFILE\.agents\skills" "$BackupO\agents\skills" -Recurse -Force }
    if (Test-Path "$env:USERPROFILE\.claude\skills") { Copy-Item "$env:USERPROFILE\.claude\skills" "$BackupO\claude\skills" -Recurse -Force }
    Copy-Item $RepoSkills "$BackupO\repo\skills" -Recurse -Force
    
    # 创建目录
    New-Item -ItemType Directory -Path "$OpenCodeDir", "$OpenCodeDir\agents" -Force | Out-Null
    
    # 部署配置
    Safe-Copy "$WindowsRoot\opencode\AGENTS.md" "$OpenCodeDir\AGENTS.md"
    if (Test-Path "$WindowsRoot\opencode\agents") {
        Safe-Copy "$WindowsRoot\opencode\agents" "$OpenCodeDir\agents"
    }
    
    # 复制 skills
    Safe-Copy $RepoSkills "$OpenCodeDir\skills"
    Safe-Copy $RepoSkills "$env:USERPROFILE\.agents\skills"
    Safe-Copy $RepoSkills "$env:USERPROFILE\.claude\skills"
    
    Write-Host "OpenCode deployed. Backup: $BackupO"
}

# Claude Code 部署
if ($Target -eq "claude" -or $Target -eq "all") {
    $BackupCL = Join-Path $env:USERPROFILE ".claude-backups\agent-skills-hook-$Stamp"
    New-Item -ItemType Directory -Path "$BackupCL\claude", "$BackupCL\agents", "$BackupCL\repo" -Force | Out-Null
    
    # 备份现有配置
    $ClaudeDir = Join-Path $env:USERPROFILE ".claude"
    if (Test-Path "$ClaudeDir\AGENTS.md") { Copy-Item "$ClaudeDir\AGENTS.md" "$BackupCL\claude\AGENTS.md" -Force }
    if (Test-Path "$ClaudeDir\CLAUDE.md") { Copy-Item "$ClaudeDir\CLAUDE.md" "$BackupCL\claude\CLAUDE.md" -Force }
    if (Test-Path "$ClaudeDir\settings.json") { Copy-Item "$ClaudeDir\settings.json" "$BackupCL\claude\settings.json" -Force }
    if (Test-Path "$ClaudeDir\hooks") { Copy-Item "$ClaudeDir\hooks" "$BackupCL\claude\hooks" -Recurse -Force }
    if (Test-Path "$ClaudeDir\agents") { Copy-Item "$ClaudeDir\agents" "$BackupCL\claude\agents" -Recurse -Force }
    if (Test-Path "$ClaudeDir\skills") { Copy-Item "$ClaudeDir\skills" "$BackupCL\claude\skills" -Recurse -Force }
    if (Test-Path "$env:USERPROFILE\.agents\skills") { Copy-Item "$env:USERPROFILE\.agents\skills" "$BackupCL\agents\skills" -Recurse -Force }
    Copy-Item $RepoSkills "$BackupCL\repo\skills" -Recurse -Force
    
    # 创建目录
    New-Item -ItemType Directory -Path "$ClaudeDir", "$ClaudeDir\hooks", "$ClaudeDir\agents" -Force | Out-Null
    
    # 部署配置
    Safe-Copy "$WindowsRoot\claude\CLAUDE.md" "$ClaudeDir\CLAUDE.md"
    if (Test-Path "$WindowsRoot\claude\hooks") {
        Safe-Copy "$WindowsRoot\claude\hooks" "$ClaudeDir\hooks"
    }
    if (Test-Path "$WindowsRoot\claude\agents") {
        Safe-Copy "$WindowsRoot\claude\agents" "$ClaudeDir\agents"
    }
    if (Test-Path "$WindowsRoot\claude\settings.json") {
        Safe-Copy "$WindowsRoot\claude\settings.json" "$ClaudeDir\settings.json"
    }
    
    # 复制 skills
    Safe-Copy $RepoSkills "$ClaudeDir\skills"
    Safe-Copy $RepoSkills "$env:USERPROFILE\.agents\skills"
    
    Write-Host "Claude Code deployed. Backup: $BackupCL"
}

Write-Host "Deployment complete."