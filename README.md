# luci-app-watchtower

`luci-app-watchtower` (v0.26.11) is an automated notification, telemetry, and monitoring suite designed for OpenWrt. It combines a lightweight POSIX shell daemon and real-time event watcher with a modern LuCI JavaScript interface, delivering real-time network state changes, client lifecycle events, system health alerts, and security audit logs to multiple notification providers.

- **Repository**: https://github.com/permails/luci-app-watchtower
- **Author / Maintainer**: permails `<logo@permails.com>`

---

## Architecture

- **Web Interface**: Modern LuCI JavaScript (LuCI JS) client-side views (`overview.js`, `setting.js`, `log.js`) with shared helpers and Light/Dark adaptive styling (`htdocs/luci-static/resources/watchtower/common.js`), compatible with OpenWrt 21.02, 22.03, 23.05, 24.10, and 25.x / snapshot builds.
- **Backend Daemon & Real-Time Watcher**:
  - Main daemon: `/usr/bin/watchtower/watchtower` managed by `/etc/init.d/watchtower`.
  - Real-time event listener: `/usr/bin/watchtower/rt_watch.sh` (logread / DHCP) and `/etc/hotplug.d/iface/99-watchtower` (WAN interface events) for sub-2-second instant alerts.
- **Configuration Management**: Unified Configuration Interface (`/etc/config/watchtower`) with `ucitrack` integration (`/etc/uci-defaults/luci-watchtower`).
- **Access Control**: Least-privilege `rpcd` ACL (`/usr/share/rpcd/acl.d/luci-app-watchtower.json`) with read/write separation and LuCI view permission checks.
- **Menu Hierarchy**: Declarative JSON menu registration (`/usr/share/luci/menu.d/luci-app-watchtower.json`).
- **Internationalization**: Standard GNU gettext catalog (`po/templates/watchtower.pot`, `po/zh_Hans/watchtower.po`, `po/zh-cn/watchtower.po`).

---

## Supported Notification Providers

`luci-app-watchtower` includes built-in integrations for:

- **Telegram Bot** (Native Telegram Bot API)
- **Discord** (Webhook)
- **Slack** (Incoming Webhooks)
- **Mattermost** (Incoming Webhooks)
- **DingTalk** (Custom Robot Webhook)
- **WeCom / WeChat Work** (Bot Webhook and Enterprise Application)
- **Feishu / Lark** (Custom Robot Webhook)
- **Bark** (iOS Push Notification Service and Self-Hosted Servers)
- **PushPlus** (WeChat Official Account & Topic Broadcast)
- **PushDeer** (Cloud and Self-Hosted Servers)
- **ntfy** (Topic-based Push Notifications & Self-Hosted Servers)
- **Email (SMTP)** (Native TLS/STARTTLS SMTP dispatch via `openssl`)
- **Custom JSON Webhook** (Configurable request payload template via `/usr/bin/watchtower/api/diy.json`)

---

## Functional Capabilities

### 1. Client Presence and Lifecycle Tracking
- Active ARP probing (`iputils-arping`) to track device connect/disconnect events without false positives caused by 802.11 power-save sleep states.
- Configurable online/offline debounce timers and retry limits.
- Real-time client status viewer with hostname resolution, MAC vendor matching, physical interface mapping, and connection uptime counters.
- Device alias mapping (`XX:XX:XX:XX:XX:XX-AliasName`).

### 2. Instant Event Push & WAN Monitoring
- Optional **Instant Push** master switch (`realtime_enable`) delivering WAN IP changes, Web/SSH logins, and new device arrivals within 2 seconds via system events instead of polling.
- Public and interface-bound IPv4/IPv6 change tracking (`ubus` / `ip addr` or external HTTP endpoint querying), with CGNAT mismatch warnings.

### 3. System Health and Telemetry
- CPU load average monitoring against configurable thresholds.
- SoC temperature monitoring (auto-detecting `/sys/class/thermal` & `/sys/class/hwmon`, custom command, or remote Proxmox VE sensors over SSH key authentication) with live sensor testing in LuCI.

### 4. Traffic Accounting and Anomaly Alerts
- Per-device bandwidth throughput monitoring via `wrtbwmon` / `nlbwmon`.
- Threshold-based abnormal traffic detection with device-specific watchlists and automated midnight counter reset.

### 5. Security and Intrusion Auditing
- Real-time log monitoring for unauthorized Web (LuCI) and SSH (Dropbear) authentication attempts.
- Threshold-based brute-force detection with automated temporary or permanent IP blocking via `ipset` / `iptables` and whitelist protection.

### 6. Scheduled Reporting, DND & Unattended Watchdog
- Configurable cron-based status reports and dual-mode Do Not Disturb (suspended or silent queue) with MAC presence/absence triggers.
- Automatic network connectivity detection and recovery routines (interface reset, PPPoE redial, firewall restart, or scheduled reboot).

---

## Dependencies

### Mandatory Dependencies
- `iputils-arping` (Active layer-2 client probing)
- `curl` (HTTP/HTTPS payload dispatch)
- `jq` (JSON payload parsing and construction)
- `openssl-util` (SMTP TLS/STARTTLS email dispatch)

### Optional Dependencies
- `wrtbwmon` or `nlbwmon` (Per-client traffic measurement)
- `ipset` and `iptables` (Automated login attack mitigation)
- `openssh-client` (Remote PVE hardware telemetry polling)

---

## Build and Installation

### Building via OpenWrt SDK / Buildroot

1. Clone this repository into your OpenWrt buildroot `package/` directory:
   ```sh
   git clone https://github.com/permails/luci-app-watchtower.git package/luci-app-watchtower
   ```

2. Update feeds and enable the package:
   ```sh
   make menuconfig
   ```
   Navigate to:
   ```
   LuCI -> 3. Applications -> luci-app-watchtower
   ```

3. Compile the package:
   ```sh
   make package/luci-app-watchtower/compile V=s
   ```

### Manual Installation on Running Target

1. Copy the repository contents to the corresponding paths on the target router:
   - `htdocs/luci-static/resources/view/watchtower/` -> `/www/luci-static/resources/view/watchtower/`
   - `htdocs/luci-static/resources/watchtower/` -> `/www/luci-static/resources/watchtower/`
   - `root/usr/share/luci/menu.d/luci-app-watchtower.json` -> `/usr/share/luci/menu.d/`
   - `root/usr/share/rpcd/acl.d/luci-app-watchtower.json` -> `/usr/share/rpcd/acl.d/`
   - `root/usr/bin/watchtower/` -> `/usr/bin/watchtower/`
   - `root/etc/config/watchtower` -> `/etc/config/watchtower`
   - `root/etc/init.d/watchtower` -> `/etc/init.d/watchtower`
   - `root/etc/hotplug.d/iface/99-watchtower` -> `/etc/hotplug.d/iface/99-watchtower`

2. Set appropriate permissions:
   ```sh
   chmod 755 /usr/bin/watchtower/watchtower /usr/bin/watchtower/rt_watch.sh /usr/bin/watchtower/i18n.sh /etc/init.d/watchtower
   chmod 644 /www/luci-static/resources/view/watchtower/*.js /www/luci-static/resources/watchtower/*.js
   chmod 644 /usr/share/luci/menu.d/luci-app-watchtower.json /usr/share/rpcd/acl.d/luci-app-watchtower.json
   ```

3. Clear LuCI cache and reload services:
   ```sh
   rm -rf /tmp/luci-modulecache/* /tmp/luci-indexcache*
   /etc/init.d/rpcd restart
   /etc/init.d/uhttpd restart
   /etc/init.d/watchtower enable
   /etc/init.d/watchtower start
   ```

---

## Configuration Reference

Primary configuration parameters are stored in `/etc/config/watchtower`:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `watchtower_enable` | boolean | `0` | Master switch for the Watchtower background daemon. |
| `realtime_enable` | boolean | `0` | Master switch for sub-2s event-driven Instant Push. |
| `sleeptime` | integer | `60` | Detection cycle polling interval in seconds (minimum `10`). |
| `jsonpath` | string | - | Path to the active provider API descriptor JSON. |
| `watchtower_ipv4` | string | `0` | IPv4 monitoring: `0` (disabled), `1` (interface), `2` (HTTP URL). |
| `watchtower_ipv6` | string | `0` | IPv6 monitoring: `0` (disabled), `1` (interface), `2` (HTTP URL). |
| `watchtower_up` | boolean | `1` | Enable client online event notifications. |
| `watchtower_down` | boolean | `1` | Enable client offline event notifications. |
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
