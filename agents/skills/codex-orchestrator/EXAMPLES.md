# Codex Orchestrator - 测试示例

## 示例 1：简单功能实现

### 用户请求
```
使用 codex 实现一个简单的日志函数，用于记录 PCL6 的调试信息
```

### Claude 的响应流程

#### Phase 1: 规划
```
我将为 PCL6 实现一个日志函数。让我先分析需求：

1. 读取现有架构文档
2. 确定日志函数的位置（可能在 lib/tinybase/ 或新建 utils/）
3. 设计接口：log_debug(const char* format, ...)
4. 验收标准：
   - 编译通过
   - 可以在其他模块中调用
   - 支持格式化输出
```

#### Phase 2: 调用 Codex
```bash
/home/xmg/.local/bin/codex-quiet "
实现一个日志函数用于 PCL6 调试信息记录。

要创建/修改的文件：
- PCL6/src/lib/tinybase/log.c (新建)
- PCL6/src/lib/tinybase/log.h (新建)
- PCL6/src/lib/tinybase/Makefile (修改，添加 log.c)

功能需求：
1. 实现 log_debug(const char* format, ...) 函数
2. 支持可变参数，类似 printf
3. 输出格式：[DEBUG] [时间戳] 消息内容
4. 可以通过环境变量 PCL6_DEBUG 控制是否输出

架构约束：
- 放在 lib/tinybase/ 目录下（底层通用工具）
- 不依赖其他 PCL6 模块
- 使用标准 C 库函数

代码规范：
- 函数必须有 Doxygen 格式的中文注释
- 添加必要的错误处理
- 保持代码简洁

验收标准：
- 编译通过，无警告
- 可以在其他模块中 #include \"log.h\" 并调用
- 环境变量控制生效
"
```

#### Phase 3: 验收

##### 3.1 代码审查
```
✅ 代码质量良好
✅ 有 Doxygen 中文注释
✅ 错误处理完善
✅ 风格一致
```

##### 3.2 构建测试
```bash
cd PCL6 && make clean && make -j$(nproc)
# 输出：编译成功，无警告
```

##### 3.3 功能测试
```c
// 创建测试文件 test_log.c
#include "lib/tinybase/log.h"

int main() {
    log_debug("Test message: %d", 42);
    return 0;
}
```

```bash
gcc -o test_log test_log.c PCL6/src/lib/tinybase/log.c
PCL6_DEBUG=1 ./test_log
# 输出：[DEBUG] [2026-03-20 10:30:45] Test message: 42
```

##### 3.4 性能检查
```
✅ 日志函数性能开销可忽略
✅ 无内存泄漏
```

##### 3.5 架构合规性
```
✅ 放在正确的目录（lib/tinybase/）
✅ 无不必要的依赖
✅ 遵循现有代码结构
```

#### Phase 4: 完成
```
验收全部通过！使用 git-master 提交代码。

提交信息：
feat(PCL6): 添加调试日志功能

- 新增 log_debug() 函数用于调试信息输出
- 支持可变参数和格式化输出
- 可通过 PCL6_DEBUG 环境变量控制
- 位于 lib/tinybase/ 目录

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>
```

---

## 示例 2：性能优化（带迭代）

### 用户请求
```
使用 codex 优化 ReadImage 函数的性能，目标提升 20%
```

### Claude 的响应流程

#### Phase 1: 规划
```
我将优化 ReadImage 函数的性能。让我先分析：

1. 读取 ReadImage 函数的当前实现
2. 分析性能瓶颈（可能是循环、内存分配、解码算法）
3. 设计优化方案：
   - 使用 SIMD 指令加速像素处理
   - 优化内存分配策略
   - 减少不必要的拷贝
4. 验收标准：
   - 性能提升 20% 以上
   - 输出结果与原实现一致
   - 编译通过，无新增警告
```

#### Phase 2: 调用 Codex（第 1 次）
```bash
/home/xmg/.local/bin/codex-quiet "
优化 ReadImage 函数的性能，目标提升 20%。

要修改的文件：
- PCL6/src/imaging/read_image.c

优化方向：
1. 使用 SIMD 指令（SSE/AVX）加速像素处理循环
2. 优化内存分配，减少 malloc/free 次数
3. 减少不必要的内存拷贝

架构约束：
- 保持函数接口不变
- 不改变输出结果
- 遵循 PCL6 架构指南

代码规范：
- 添加 Doxygen 中文注释说明优化点
- 保持代码可读性
- 添加必要的注释

验收标准：
- 性能提升 20% 以上（使用 large_image.prn 测试）
- 输出与原实现一致
- 编译通过，无警告
"
```

#### Phase 3: 验收（第 1 次）

##### 3.1 代码审查
```
✅ 代码质量良好
✅ SIMD 指令使用正确
⚠️  缺少 SIMD 可用性检测（在不支持 SSE 的平台会崩溃）
```

##### 3.2 构建测试
```bash
cd PCL6 && make clean && make -j$(nproc)
# 输出：编译成功，但有 1 个警告
# warning: implicit declaration of function '_mm_loadu_si128'
```

##### 3.3 功能测试
```bash
./pcl6 test_cases/large_image.prn
# 输出：Segmentation fault (在不支持 SSE 的 VM 上)
```

##### 验收结果
```
❌ 验收失败

问题：
1. 缺少 SIMD 可用性检测
2. 编译警告（缺少头文件）
3. 在不支持 SSE 的平台上崩溃
```

#### Phase 4: 询问用户
```
验收失败，发现以下问题：
1. 缺少 SIMD 可用性检测（在不支持 SSE 的平台会崩溃）
2. 编译警告：缺少 <emmintrin.h> 头文件
3. 功能测试在不支持 SSE 的平台上失败

如何处理？
a) 让 Codex 自动修复这些问题
b) 我会提供具体的修复指导
c) 让 Claude 直接修复这些问题
d) 中止并手动审查

用户选择：a
```

#### Phase 5: 调用 Codex（第 2 次）
```bash
/home/xmg/.local/bin/codex-quiet "
修复 ReadImage 优化中的问题：

问题列表：
1. 缺少 SIMD 可用性检测（在不支持 SSE 的平台会崩溃）
2. 编译警告：缺少 <emmintrin.h> 头文件
3. 功能测试在不支持 SSE 的平台上失败

修复要求：
1. 添加 #include <emmintrin.h>
2. 添加运行时 SIMD 可用性检测（使用 __builtin_cpu_supports(\"sse2\")）
3. 如果不支持 SIMD，回退到标量实现
4. 确保在所有平台上都能正常工作

要修改的文件：
- PCL6/src/imaging/read_image.c

验收标准：
- 编译通过，无警告
- 在支持 SSE 的平台上使用 SIMD 加速
- 在不支持 SSE 的平台上使用标量实现
- 所有平台上输出一致
"
```

#### Phase 6: 验收（第 2 次）

##### 3.1 代码审查
```
✅ 添加了头文件
✅ 添加了 SIMD 可用性检测
✅ 有回退实现
✅ 代码质量良好
```

##### 3.2 构建测试
```bash
cd PCL6 && make clean && make -j$(nproc)
# 输出：编译成功，无警告
```

##### 3.3 功能测试
```bash
# 在支持 SSE 的平台
./pcl6 test_cases/large_image.prn
# 输出：成功，使用 SIMD 加速

# 在不支持 SSE 的平台
./pcl6 test_cases/large_image.prn
# 输出：成功，使用标量实现
```

##### 3.4 性能检查
```bash
# 修改前
time ./pcl6 test_cases/large_image.prn
# real: 2.50s

# 修改后（SSE 平台）
time ./pcl6 test_cases/large_image.prn
# real: 1.95s

# 性能提升：(2.50 - 1.95) / 2.50 = 22%
✅ 达到 20% 的目标
```

##### 3.5 架构合规性
```
✅ 保持函数接口不变
✅ 无并行实现
✅ 遵循现有架构
```

##### 验收结果
```
✅ 验收全部通过！
```

#### Phase 7: 完成
```
验收全部通过！使用 git-master 提交代码。

提交信息：
perf(PCL6): 优化 ReadImage 函数性能

- 使用 SIMD 指令（SSE2）加速像素处理循环
- 添加运行时 SIMD 可用性检测
- 不支持 SIMD 的平台自动回退到标量实现
- 性能提升 22%（在支持 SSE2 的平台上）
- 所有平台输出一致

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>
```

---

## 示例 3：验收失败 3 次后上报

### 场景
Codex 连续 3 次都无法通过验收，Claude 上报用户。

```
验收失败（第 3 次）

问题历史：
- 第 1 次：缺少错误处理，导致崩溃
- 第 2 次：修复了崩溃，但性能退化 30%
- 第 3 次：修复了性能，但引入了内存泄漏

已达到最大迭代次数（3 次），建议：

1. 切换到手动模式（选项 c）：让我直接修复这些问题
2. 重新规划（选项 d）：可能需要调整优化方案
3. 提供更详细的指导（选项 b）：你可以提供具体的实现建议

请选择如何继续。
```

---

## 总结

这些示例展示了 Codex Orchestrator 的完整工作流程：

1. **示例 1**：简单功能实现，一次通过验收
2. **示例 2**：复杂优化，需要迭代修复
3. **示例 3**：多次失败后的上报机制

关键点：
- Claude 负责规划和验收
- Codex 负责执行
- 验收失败时询问用户
- 最多迭代 3 次
- 全程透明，用户可控
