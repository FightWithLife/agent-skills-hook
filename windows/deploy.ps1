# agent-skills-hook Windows 部署脚本
# 使用复制方式部署配置

param(
    [string]$Target = "all",
    [string]$RepoRoot = ""
)

if ($RepoRoot -eq "") {
    $RepoRoot = Split-Path $PSScriptRoot -Parent
}

$ErrorActionPreference = "Stop"

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RepoSkills = Join-Path $RepoRoot "agents\skills"
$ConfigRoot = Join-Path $RepoRoot "config"
$CodexAgents = Join-Path $ConfigRoot "codex\agents"
$OpenCodeConfig = Join-Path $ConfigRoot "opencode"
$OmoConfigDir = Join-Path $OpenCodeConfig "oh-my-openagent"
$OmoConfigFile = Join-Path $OmoConfigDir "oh-my-openagent.json"

# 验证 skills 目录存在
if (-not (Test-Path $RepoSkills)) {
    Write-Error "ERROR: $RepoSkills missing. Run 'git submodule update --init --recursive agents/skills' first."
    exit 1
}

if (-not (Test-Path $CodexAgents)) {
    Write-Error "ERROR: $CodexAgents missing."
    exit 1
}

if (-not (Test-Path "$OpenCodeConfig\opencode.json")) {
    Write-Error "ERROR: $OpenCodeConfig\opencode.json missing."
    exit 1
}

if (-not (Test-Path $OmoConfigFile)) {
    Write-Error "ERROR: $OmoConfigFile missing."
    exit 1
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

function Merge-JsonConfig {
    param(
        [string]$Src,
        [string]$Dest
    )

    $DestDir = Split-Path $Dest -Parent
    if ($DestDir -and -not (Test-Path $DestDir)) {
        New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    }

    $Merged = @{}
    if (Test-Path $Dest) {
        $Merged = Get-Content $Dest -Raw | ConvertFrom-Json -AsHashtable
    }

    function Merge-Hashtable {
        param(
            [hashtable]$Base,
            [hashtable]$Overlay
        )

        foreach ($Key in $Overlay.Keys) {
            if ($Base.ContainsKey($Key) -and $Base[$Key] -is [hashtable] -and $Overlay[$Key] -is [hashtable]) {
                $Base[$Key] = Merge-Hashtable $Base[$Key] $Overlay[$Key]
                continue
            }

            if ($Base.ContainsKey($Key) -and $Base[$Key] -is [System.Collections.IList] -and $Overlay[$Key] -is [System.Collections.IList]) {
                $Items = @()
                $Seen = @{}
                foreach ($Item in @($Base[$Key]) + @($Overlay[$Key])) {
                    $Identity = ConvertTo-Json $Item -Depth 100 -Compress
                    if (-not $Seen.ContainsKey($Identity)) {
                        $Seen[$Identity] = $true
                        $Items += $Item
                    }
                }
                $Base[$Key] = $Items
                continue
            }

            $Base[$Key] = $Overlay[$Key]
        }

        return $Base
    }

    $Overlay = Get-Content $Src -Raw | ConvertFrom-Json -AsHashtable
    $Merged = Merge-Hashtable $Merged $Overlay

    $Merged | ConvertTo-Json -Depth 100 | Set-Content $Dest -Encoding UTF8
}

# Codex 部署
if ($Target -eq "codex" -or $Target -eq "all") {
    $BackupC = Join-Path $env:USERPROFILE ".codex-backups\agent-skills-hook-$Stamp"
    New-Item -ItemType Directory -Path "$BackupC\codex", "$BackupC\repo" -Force | Out-Null
    
    # 备份现有配置
    $CodexDir = Join-Path $env:USERPROFILE ".codex"
    if (Test-Path "$CodexDir\AGENTS.md") { Copy-Item "$CodexDir\AGENTS.md" "$BackupC\codex\AGENTS.md" -Force }
    if (Test-Path "$CodexDir\agents") { Copy-Item "$CodexDir\agents" "$BackupC\codex\agents" -Recurse -Force }
    if (Test-Path "$CodexDir\skills") { Copy-Item "$CodexDir\skills" "$BackupC\codex\skills" -Recurse -Force }
    Copy-Item $RepoSkills "$BackupC\repo\skills" -Recurse -Force
    
    # 部署配置（从 config/ 复制）
    Safe-Copy "$ConfigRoot\codex\AGENTS.md" "$CodexDir\AGENTS.md"
    Safe-Copy $CodexAgents "$CodexDir\agents"
    Safe-Copy $RepoSkills "$CodexDir\skills"
    if (Test-Path "$env:USERPROFILE\.agents\skills") {
        Write-Host "Legacy Codex skill root detected at $env:USERPROFILE\.agents\skills. Archive or remove it to avoid duplicate skill scanning."
    }
    
    Write-Host "Codex deployed. Backup: $BackupC"
}

# OpenCode 部署
if ($Target -eq "opencode" -or $Target -eq "all") {
    $BackupO = Join-Path $env:USERPROFILE ".opencode-backups\agent-skills-hook-$Stamp"
    New-Item -ItemType Directory -Path "$BackupO\opencode", "$BackupO\claude", "$BackupO\repo" -Force | Out-Null
    
    # 备份现有配置
    $OpenCodeDir = Join-Path $env:USERPROFILE ".config\opencode"
    if (Test-Path "$OpenCodeDir\AGENTS.md") { Copy-Item "$OpenCodeDir\AGENTS.md" "$BackupO\opencode\AGENTS.md" -Force }
    if (Test-Path "$OpenCodeDir\opencode.json") { Copy-Item "$OpenCodeDir\opencode.json" "$BackupO\opencode\opencode.json" -Force }
    if (Test-Path "$OpenCodeDir\oh-my-openagent.json") { Copy-Item "$OpenCodeDir\oh-my-openagent.json" "$BackupO\opencode\oh-my-openagent.json" -Force }
    if (Test-Path "$OpenCodeDir\oh-my-openagent") { Copy-Item "$OpenCodeDir\oh-my-openagent" "$BackupO\opencode\oh-my-openagent" -Recurse -Force }
    if (Test-Path "$OpenCodeDir\agents") { Copy-Item "$OpenCodeDir\agents" "$BackupO\opencode\agents" -Recurse -Force }
    if (Test-Path "$OpenCodeDir\prompts") { Copy-Item "$OpenCodeDir\prompts" "$BackupO\opencode\prompts" -Recurse -Force }
    if (Test-Path "$OpenCodeDir\skills") { Copy-Item "$OpenCodeDir\skills" "$BackupO\opencode\skills" -Recurse -Force }
    if (Test-Path "$env:USERPROFILE\.claude\skills") { Copy-Item "$env:USERPROFILE\.claude\skills" "$BackupO\claude\skills" -Recurse -Force }
    Copy-Item $RepoSkills "$BackupO\repo\skills" -Recurse -Force
    
    # 部署配置（从 config/ 复制）
    New-Item -ItemType Directory -Path "$OpenCodeDir" -Force | Out-Null
    Safe-Copy "$ConfigRoot\opencode\AGENTS.md" "$OpenCodeDir\AGENTS.md"
    Merge-JsonConfig "$OpenCodeConfig\opencode.json" "$OpenCodeDir\opencode.json"
    Merge-JsonConfig $OmoConfigFile "$OpenCodeDir\oh-my-openagent.json"
    Safe-Copy $OmoConfigDir "$OpenCodeDir\oh-my-openagent"
    Safe-Copy "$OpenCodeConfig\agents" "$OpenCodeDir\agents"
    Safe-Copy "$OpenCodeConfig\prompts" "$OpenCodeDir\prompts"
    Safe-Copy $RepoSkills "$OpenCodeDir\skills"
    Safe-Copy $RepoSkills "$env:USERPROFILE\.claude\skills"
    if (Test-Path "$env:USERPROFILE\.agents\skills") {
        Write-Host "Legacy shared skill root detected at $env:USERPROFILE\.agents\skills. OpenCode now uses $OpenCodeDir\skills as the primary user skill root."
    }
    
    Write-Host "OpenCode deployed. Backup: $BackupO"
}

# Claude Code 部署
if ($Target -eq "claude" -or $Target -eq "all") {
    $BackupCL = Join-Path $env:USERPROFILE ".claude-backups\agent-skills-hook-$Stamp"
    New-Item -ItemType Directory -Path "$BackupCL\claude", "$BackupCL\repo" -Force | Out-Null
    
    # 备份现有配置
    $ClaudeDir = Join-Path $env:USERPROFILE ".claude"
    if (Test-Path "$ClaudeDir\AGENTS.md") { Copy-Item "$ClaudeDir\AGENTS.md" "$BackupCL\claude\AGENTS.md" -Force }
    if (Test-Path "$ClaudeDir\CLAUDE.md") { Copy-Item "$ClaudeDir\CLAUDE.md" "$BackupCL\claude\CLAUDE.md" -Force }
    if (Test-Path "$ClaudeDir\skills") { Copy-Item "$ClaudeDir\skills" "$BackupCL\claude\skills" -Recurse -Force }
    Copy-Item $RepoSkills "$BackupCL\repo\skills" -Recurse -Force
    
    # 部署配置（从 config/ 复制）
    New-Item -ItemType Directory -Path "$ClaudeDir" -Force | Out-Null
    Safe-Copy "$ConfigRoot\AGENTS.md" "$ClaudeDir\AGENTS.md"
    Safe-Copy "$ConfigRoot\claude\CLAUDE.md" "$ClaudeDir\CLAUDE.md"
    Safe-Copy $RepoSkills "$ClaudeDir\skills"
    
    Write-Host "Claude Code deployed. Backup: $BackupCL"
}

# Qoder 部署（默认行为，每次运行无条件执行）
$BackupQ = Join-Path $env:USERPROFILE ".qoder-backups\agent-skills-hook-$Stamp"
New-Item -ItemType Directory -Path "$BackupQ\qoder", "$BackupQ\repo" -Force | Out-Null

# 备份现有配置
$QoderDir = Join-Path $env:USERPROFILE ".qoder"
if (Test-Path "$QoderDir\AGENTS.md") { Copy-Item "$QoderDir\AGENTS.md" "$BackupQ\qoder\AGENTS.md" -Force }
if (Test-Path "$QoderDir\skills") { Copy-Item "$QoderDir\skills" "$BackupQ\qoder\skills" -Recurse -Force }
Copy-Item $RepoSkills "$BackupQ\repo\skills" -Recurse -Force

# 部署配置（从 config/qoder/ 复制）
New-Item -ItemType Directory -Path "$QoderDir" -Force | Out-Null
Safe-Copy "$ConfigRoot\qoder\AGENTS.md" "$QoderDir\AGENTS.md"
Safe-Copy $RepoSkills "$QoderDir\skills"

Write-Host "Qoder deployed. Backup: $BackupQ"

Write-Host "Deployment complete."
