# 缓存布局

本 skill 负责初始化项目内 `.agents/cache/` 下的最小缓存集合，供后续 embedded workflow、firmware flasher、KingstVIS skill 复用。

## 目录

```text
.agents/
  cache/
    <target-name>_download.cfg
    logic_timing_windows.csv
    kingstvis_channel_maps.json
```

## 1. 固件刷写配置

文件名：

```text
.agents/cache/<target-name>_download.cfg
```

格式：INI

最小字段：

- `[device]`
  - `target_name`
  - `vid`
  - `pid`
  - `transport`
- `[firmware]`
  - `artifact_path`
  - `artifact_type`
  - `allow_raw`
- `[protocol]`
  - `chunk_size`
  - `command_prefix_hex`
  - `pack_length_command`
  - `ota_command`
  - `ack_prefix_hex`
  - `ack_length`
  - `ack_offset_pos`
  - `ack_status_pos`
  - `query_pack_length`
  - `query_response_length`
  - `crc_type`

规则：

- 未知字段允许为空字符串。
- `target_name` 必须落盘，其他字段只在用户提供或仓库已确认时写入。

## 2. 逻辑分析窗口经验表

文件名：

```text
.agents/cache/logic_timing_windows.csv
```

表头固定为：

```text
test_method,test_file,test_case,trigger_mode,io_mapping,expected_window_sec,actual_window_sec,captured_complete,too_short,too_long,recommended_next_window_sec,notes
```

初始化规则：

- 文件不存在时创建，只写表头。
- 只有用户给出测试方法、测试文件、测试用例、触发方式或建议窗口时，才追加首条记录。
- `io_mapping` 建议写 JSON 字符串，便于单列保存。

## 3. KingstVIS 通道映射

文件名：

```text
.agents/cache/kingstvis_channel_maps.json
```

建议结构：

```json
{
  "targets": {
    "demo-target": {
      "channels": {
        "0": "BOOT_MARK",
        "1": "USB_IRQ"
      },
      "pins": {
        "PA1": "BOOT_MARK",
        "PB3": "USB_IRQ"
      },
      "test_methods": [
        "usb_cmd",
        "power_on"
      ],
      "notes": "optional notes"
    }
  }
}
```

规则：

- `channels` 保存逻辑分析仪通道号到语义名的映射。
- `pins` 保存 MCU 引脚到语义名的映射；未知时可省略。
- `test_methods` 保存该映射适用的测试方式列表。

## 推荐调用

只初始化固件缓存：

```powershell
python agents\skills\embedded-workflow-cache-init\scripts\init_embedded_workflow_cache.py --project-root . --target app
```

同时初始化 KingstVIS 相关缓存：

```powershell
python agents\skills\embedded-workflow-cache-init\scripts\init_embedded_workflow_cache.py --project-root . --target app --test-method usb_cmd --test-case boot-time --trigger-mode usb --expected-window-sec 1.5 --channel-map "{\"0\":\"BOOT_MARK\",\"1\":\"USB_IRQ\"}" --pin-map "{\"PA1\":\"BOOT_MARK\",\"PB3\":\"USB_IRQ\"}"
```
