# luci-app-pushbot

`luci-app-pushbot` is an automated notification, telemetry, and monitoring suite designed for OpenWrt. It operates as a background daemon coupled with a modern LuCI JavaScript interface, delivering real-time network state changes, client lifecycle events, system health alerts, and security audit logs to multiple notification providers.

---

## Architecture

- **Web Interface**: Modern LuCI JavaScript (LuCI JS) client-side rendering architecture, fully compatible with OpenWrt 21.02, 22.03, 23.05, and 24.x / snapshot builds.
- **Backend Service**: POSIX-compliant shell daemon (`/usr/bin/pushbot/pushbot`) managed by OpenWrt `init.d` (`/etc/init.d/pushbot`).
- **Configuration Management**: Unified Configuration Interface (`/etc/config/pushbot`).
- **Access Control**: Declarative JSON-based access control list for rpcd (`/usr/share/rpcd/acl.d/luci-app-pushbot.json`).
- **Menu Hierarchy**: Declarative JSON menu registration (`/usr/share/luci/menu.d/luci-app-pushbot.json`).
- **Internationalization**: Standard GNU gettext catalog structure with runtime language detection.

---

## Supported Notification Providers

`luci-app-pushbot` supports standard webhook and API integrations for the following platforms:

- **Telegram Bot** (Native Telegram Bot API)
- **Slack** (Incoming Webhooks)
- **Mattermost** (Incoming Webhooks)
- **DingTalk** (Custom Robot Webhook)
- **WeCom / WeChat Work** (Bot Webhook and Enterprise Application)
- **Feishu / Lark** (Custom Robot Webhook)
- **Bark** (iOS Push Notification Service and Self-Hosted Servers)
- **PushPlus** (WeChat Official Account push, one-to-many topic broadcast)
- **PushDeer** (Cloud and Self-Hosted PushDeer instances)
- **Custom JSON Webhook** (Configurable request payload template via `/usr/bin/pushbot/api/diy.json`)

---

## Functional Capabilities

### 1. Client Presence and Lifecycle Tracking
- Active ARP probing (`iputils-arping`) to track device connect/disconnect events without false positives caused by 802.11 power-save sleep states.
- Configurable online/offline debounce timers and retry limits.
- Real-time client status viewer with hostname resolution, MAC vendor matching, physical interface mapping, and connection uptime counters.
- Device alias mapping (`XX:XX:XX:XX:XX:XX-AliasName`).

### 2. WAN and IP Address Monitoring
- Public and interface-bound IPv4 and IPv6 change tracking.
- Dual-mode address resolution: local interface inspection (`ubus` / `ip addr`) or external HTTP endpoint querying.
- Warning generation for carrier-grade NAT (CGNAT) address mismatch conditions.

### 3. System Health and Telemetry
- CPU load average monitoring against configurable thresholds.
- SoC temperature monitoring with local sensor reading or remote Proxmox VE (PVE) sensor polling over SSH key authentication.
- Real-time sensor verification tools within the LuCI administration panel.

### 4. Traffic Accounting and Anomaly Alerts
- Per-device bandwidth throughput monitoring via `wrtbwmon` / `nlbwmon`.
- Threshold-based abnormal traffic detection with device-specific watchlists.
- Automated daily midnight traffic counter reset.

### 5. Security and Intrusion Auditing
- Real-time log monitoring for unauthorized Web (LuCI) and SSH (Dropbear) authentication attempts.
- Threshold-based brute-force detection.
- Automated temporary or permanent IP blocking via dynamic `ipset` hash tables and `iptables` drop rules.
- Whitelist protection to prevent administrative lockout.

### 6. Scheduled Reporting and Do Not Disturb (DND)
- Configurable cron-based status reports (system load, memory utilization, uptime, WAN addresses, connected client table).
- Dual-mode Do Not Disturb: complete daemon execution suspension or silent queued collection.
- Conditional DND triggers based on designated MAC addresses (presence or absence).

### 7. Unattended Watchdog and Recovery
- Automatic network connectivity detection and auto-recovery routines (interface reset, PPPoE redial, firewall restart, or scheduled reboot).
- Dynamic public IP re-acquisition routines for dynamic DNS environments.

---

## Dependencies

### Mandatory Dependencies
- `curl` (HTTP/HTTPS payload dispatch)
- `jq` (JSON payload parsing and construction)
- `iputils-arping` (Active layer-2 client probing)

### Optional Dependencies
- `wrtbwmon` or `nlbwmon` (Per-client traffic measurement)
- `ipset` and `iptables` (Automated login attack mitigation)
- `openssh-client` (Remote PVE hardware telemetry polling)

---

## Build and Installation

### Building via OpenWrt SDK / Buildroot

1. Clone this repository into your OpenWrt buildroot or feeds directory:
   ```sh
   git clone https://github.com/permails/luci-app-pushbot.git package/luci-app-pushbot
   ```

2. Update feeds and enable the package in your build configuration:
   ```sh
   make menuconfig
   ```
   Navigate to:
   ```
   LuCI -> 3. Applications -> luci-app-pushbot
   ```

3. Compile the package:
   ```sh
   make package/luci-app-pushbot/compile V=s
   ```

### Manual Installation on Running Target

1. Copy the repository contents to the corresponding system paths on the target router:
   - `htdocs/luci-static/resources/view/pushbot/` -> `/www/luci-static/resources/view/pushbot/`
   - `root/usr/share/luci/menu.d/` -> `/usr/share/luci/menu.d/`
   - `root/usr/share/rpcd/acl.d/` -> `/usr/share/rpcd/acl.d/`
   - `root/usr/bin/pushbot/` -> `/usr/bin/pushbot/`
   - `root/etc/config/pushbot` -> `/etc/config/pushbot`
   - `root/etc/init.d/pushbot` -> `/etc/init.d/pushbot`

2. Set appropriate execution permissions:
   ```sh
   chmod 755 /usr/bin/pushbot/pushbot /usr/bin/pushbot/i18n.sh /etc/init.d/pushbot
   chmod 644 /www/luci-static/resources/view/pushbot/*.js
   chmod 644 /usr/share/luci/menu.d/*.json /usr/share/rpcd/acl.d/*.json
   ```

3. Clear LuCI index cache and reload services:
   ```sh
   rm -rf /tmp/luci-* /var/luci-*
   /etc/init.d/rpcd restart
   /etc/init.d/uhttpd restart
   /etc/init.d/pushbot enable
   /etc/init.d/pushbot start
   ```

---

## Configuration Reference

Primary configuration parameters are stored in `/etc/config/pushbot`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `pushbot_enable` | boolean | `0` | Master switch for the PushBot background daemon. |
| `sleeptime` | integer | `60` | Detection cycle polling interval in seconds (minimum `10`). |
| `jsonpath` | string | - | Path to the active provider API descriptor JSON. |
| `pushbot_ipv4` | string | `0` | IPv4 monitoring: `0` (disabled), `1` (interface), `2` (HTTP URL). |
| `pushbot_ipv6` | string | `0` | IPv6 monitoring: `0` (disabled), `1` (interface), `2` (HTTP URL). |
| `pushbot_up` | boolean | `1` | Enable client online event notifications. |
| `pushbot_down` | boolean | `1` | Enable client offline event notifications. |
| `cpuload_enable` | boolean | `1` | Enable CPU load average monitoring alerts. |
| `cpuload` | string | `2` | 1-minute CPU load average alert threshold. |
| `temperature_enable` | boolean | `0` | Enable SoC hardware temperature alerts. |
| `temperature` | integer | `80` | Temperature threshold in degrees Celsius. |
| `up_timeout` | integer | `2` | ARP probe timeout for device arrival detection (seconds). |
| `down_timeout` | integer | `20` | ARP probe timeout for device departure detection (seconds). |
| `timeout_retry_count` | integer | `2` | Consecutive probe failure limit before marking offline. |
| `thread_num` | integer | `3` | Maximum concurrent background scanning threads. |

---

## Contributing and Maintenance

Pull requests, bug reports, and provider additions are welcome via GitHub Issues and Pull Requests. Ensure all contributions maintain POSIX compliance for shell scripts and adhere to standard LuCI JavaScript guidelines.
