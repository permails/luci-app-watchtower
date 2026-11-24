// Author: permails <logo@permails.com>
'use strict';
'require form';
'require fs';
'require rpc';
'require ui';
'require uci';
'require view';
'require watchtower.common as common';

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

var callNetworkDevices = rpc.declare({
	object: 'luci-rpc',
	method: 'getNetworkDevices',
	expect: { '': {} }
});

return view.extend({
	load: function () {
		return Promise.all([
			callHostHints(),
			callNetworkDevices(),
			common.readFile('/usr/bin/watchtower/api/diy.json'),
			common.readFile('/usr/bin/watchtower/api/ipv4.list'),
			common.readFile('/usr/bin/watchtower/api/ipv6.list'),
			common.readFile('/usr/bin/watchtower/api/ip_blacklist'),
			common.readFile('/usr/bin/watchtower/api/known_macs'),
			uci.load('watchtower')
		]);
	},

	render: function (data) {
		var hosts = data[0] || {};
		var devices = data[1] || {};
		var diyJsonContent = data[2] || '';
		var ipv4ListContent = data[3] || '';
		var ipv6ListContent = data[4] || '';
		var ipBlacklistContent = data[5] || '';
		var knownMacsContent = data[6] || '';

		var m, s, o;

		m = new form.Map('watchtower', _('Settings'),
			_('Configure push channels, notification triggers, schedules, Do Not Disturb rules, and advanced options.'));

		s = m.section(form.NamedSection, 'watchtower', 'watchtower');
		s.anonymous = true;
		s.addremove = false;

		s.tab('basic', _('Basic Settings'));
		s.tab('realtime', _('Instant Push'));
		s.tab('crontab', _('Scheduled Push'));
		s.tab('disturb', _('Do Not Disturb (DND)'));
		s.tab('advanced', _('Advanced Settings'));

		/* ================= Basic Settings Tab ================= */
		o = s.taboption('basic', form.MultiValue, 'lite_enable', _('Lite Mode'));
		o.value('device', _('Lite Current Device List'));
		o.value('nowtime', _('Lite Current Time'));
		o.value('content', _('Push Title Only'));
		o.renderWidget = function (section_id, option_index, cfgvalue) {
			var curValues = L.toArray(cfgvalue != null ? cfgvalue : this.default);
			var cbid = this.cbid(section_id);
			var choices = [
				{ key: 'device', label: _('Lite Current Device List') },
				{ key: 'nowtime', label: _('Lite Current Time') },
				{ key: 'content', label: _('Push Title Only') }
			];

			var nodes = [];
			for (var i = 0; i < choices.length; i++) {
				var c = choices[i];
				var chk = E('input', {
					'type': 'checkbox',
					'name': cbid,
					'value': c.key,
					'id': cbid + '_' + c.key
				});
				if (curValues.indexOf(c.key) !== -1) {
					chk.checked = true;
				}
				nodes.push(E('label', {
					'for': cbid + '_' + c.key,
					'style': 'display: inline-flex; align-items: center; gap: 6px; margin: 0 18px 4px 0; cursor: pointer; user-select: none; font-weight: normal;'
				}, [chk, c.label]));
			}

			return E('div', { 'style': 'display: inline-flex; align-items: center; flex-wrap: wrap;' }, nodes);
		};
		o.formvalue = function (section_id) {
			var cbid = this.cbid(section_id);
			var nodes = document.querySelectorAll('input[name="' + cbid + '"]:checked');
			var vals = [];
			for (var i = 0; i < nodes.length; i++) {
				vals.push(nodes[i].value);
			}
			return vals;
		};
		o.write = function (section_id, formvalue) {
			var vals = L.toArray(formvalue);
			if (vals.length > 0) {
				return uci.set('watchtower', section_id, 'lite_enable', vals.join(' '));
			} else {
				return uci.unset('watchtower', section_id, 'lite_enable');
			}
		};

		o = s.taboption('basic', form.ListValue, 'jsonpath', _('Push Mode'));
		o.default = '/usr/bin/watchtower/api/telegram.json';
		o.rmempty = false;
		o.value('/usr/bin/watchtower/api/telegram.json', _('Telegram Bot'));
		o.value('/usr/bin/watchtower/api/discord.json', _('Discord'));
		o.value('/usr/bin/watchtower/api/ntfy.json', _('ntfy'));
		o.value('/usr/bin/watchtower/api/smtp.json', _('Email (SMTP)'));
		o.value('/usr/bin/watchtower/api/slack.json', _('Slack'));
		o.value('/usr/bin/watchtower/api/mattermost.json', _('Mattermost'));
		o.value('/usr/bin/watchtower/api/bark.json', _('Bark'));
		o.value('/usr/bin/watchtower/api/dingding.json', _('DingTalk'));
		o.value('/usr/bin/watchtower/api/ent_wechat.json', _('WeCom'));
		o.value('/usr/bin/watchtower/api/feishu.json', _('Feishu'));
		o.value('/usr/bin/watchtower/api/diy.json', _('Custom Push'));

		/* Discord */
		o = s.taboption('basic', form.Value, 'discord_webhook', _('Discord Webhook URL'),
			_('Discord Channel Webhook URL<br>Starts with https://discord.com/api/webhooks/'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/discord.json');

		/* ntfy */
		o = s.taboption('basic', form.Value, 'ntfy_server', _('ntfy Server URL'),
			_('ntfy server address, defaults to https://ntfy.sh or your self-hosted URL.'));
		o.default = 'https://ntfy.sh';
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/ntfy.json');

		o = s.taboption('basic', form.Value, 'ntfy_topic', _('ntfy Topic'),
			_('Topic name to publish notifications to.'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/ntfy.json');

		/* Email (SMTP) */
		o = s.taboption('basic', form.Value, 'smtp_server', _('SMTP Server'),
			_('SMTP server hostname, e.g. smtp.gmail.com or smtp.qq.com'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/smtp.json');

		o = s.taboption('basic', form.Value, 'smtp_port', _('SMTP Port'));
		o.default = '465';
		o.datatype = 'port';
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/smtp.json');

		o = s.taboption('basic', form.ListValue, 'smtp_tls', _('Encryption'));
		o.default = 'ssl';
		o.value('ssl', _('SSL/TLS (Port 465)'));
		o.value('starttls', _('STARTTLS (Port 587)'));
		o.value('none', _('None (Port 25)'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/smtp.json');

		o = s.taboption('basic', form.Value, 'smtp_user', _('SMTP Username'),
			_('Email account username used for SMTP authentication.'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/smtp.json');

		o = s.taboption('basic', form.Value, 'smtp_pass', _('SMTP Password / App Password'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/smtp.json');

		o = s.taboption('basic', form.Value, 'smtp_from', _('Sender Address'),
			_('Optional, defaults to SMTP Username if left blank.'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/smtp.json');

		o = s.taboption('basic', form.Value, 'smtp_to', _('Recipient Address'),
			_('Destination email address to receive alerts.'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/smtp.json');

		/* Telegram */
		o = s.taboption('basic', form.Value, 'tg_token', _('Telegram Bot Token'),
			_('Telegram Bot Token<br>Created via @BotFather<br><br>'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/telegram.json');

		o = s.taboption('basic', form.Value, 'tg_chatid', _('Telegram Chat ID'),
			_('Telegram Chat ID<br>Can be user id or group id<br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/telegram.json');

		/* Slack */
		o = s.taboption('basic', form.Value, 'slack_webhook', _('Slack Webhook URL'),
			_('Slack Incoming Webhook URL<br>Starts with https://hooks.slack.com/services/<br><br>'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/slack.json');

		/* Mattermost */
		o = s.taboption('basic', form.Value, 'mattermost_webhook', _('Mattermost Webhook URL'),
			_('Mattermost Incoming Webhook URL<br>Starts with https://your-mattermost/hooks/<br><br>'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/mattermost.json');

		/* DingTalk */
		o = s.taboption('basic', form.Value, 'dd_webhook', _('Webhook'),
			_('DingTalk Bot Webhook, enter only the part after access_token=<br>Get call code <a href="https://open.dingtalk.com/document/robots/custom-robot-access" target="_blank">Click Here</a><br><br>'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/dingding.json');

		/* WeCom */
		o = s.taboption('basic', form.Value, 'we_webhook', _('Webhook'),
			_('WeCom Bot Webhook, enter only the part after key=<br>Get call code <a href="https://developer.work.weixin.qq.com/document/path/91770" target="_blank">Click Here</a><br><br>'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/ent_wechat.json');

		/* Feishu */
		o = s.taboption('basic', form.Value, 'fs_webhook', _('WebHook'),
			_('Feishu WebHook<br>Get call code <a href="https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNx0jN" target="_blank">Click Here</a><br><br>'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/feishu.json');

		/* Bark */
		o = s.taboption('basic', form.Value, 'bark_token', _('Bark Token'),
			_('Bark Token<br>Get call code <a href="https://github.com/Finb/Bark" target="_blank">Click Here</a><br><br>'));
		o.password = true;
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/bark.json');

		o = s.taboption('basic', form.Flag, 'bark_srv_enable', _('Self-hosted Bark Server'));
		o.default = '0';
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/bark.json');

		o = s.taboption('basic', form.Value, 'bark_srv', _('Bark Server'),
			_('Bark Self-hosted Server Address<br>e.g. https://your.domain:port<br>See here for self-hosted setup<br><br>'));
		o.rmempty = true;
		o.depends('bark_srv_enable', '1');

		o = s.taboption('basic', form.Value, 'bark_sound', _('Bark Sound'),
			_('Bark Notification Sound<br>e.g. silence.caf<br>See here for setup<br><br>'));
		o.rmempty = true;
		o.default = 'silence.caf';
		o.depends('jsonpath', '/usr/bin/watchtower/api/bark.json');

		o = s.taboption('basic', form.Flag, 'bark_icon_enable', _('Bark Notification Icon'));
		o.default = '0';
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/watchtower/api/bark.json');

		o = s.taboption('basic', form.Value, 'bark_icon', _('Bark Icon'),
			_('Bark Notification Icon (iOS15+ only)<br>e.g. http://day.app/assets/images/avatar.jpg<br>See here for setup<br><br>'));
		o.rmempty = true;
		o.default = 'http://day.app/assets/images/avatar.jpg';
		o.depends('bark_icon_enable', '1');

		o = s.taboption('basic', form.Value, 'bark_level', _('Bark Level'),
			_('Bark Time-Sensitive Notification<br>active: Default, screen lights up immediately.<br/>timeSensitive: Shows even in Focus mode.<br/>passive: Adds to list quietly without lighting up.'));
		o.rmempty = true;
		o.default = 'active';
		o.depends('jsonpath', '/usr/bin/watchtower/api/bark.json');

		/* DIY Custom JSON */
		o = s.taboption('basic', form.TextValue, 'diy_json', _('Custom Push'));
		o.rows = 18;
		o.wrap = 'off';
		o.depends('jsonpath', '/usr/bin/watchtower/api/diy.json');
		o.cfgvalue = function () {
			return diyJsonContent;
		};
		o.write = function (section_id, formvalue) {
			return fs.write('/usr/bin/watchtower/api/diy.json', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		/* Send Test Button */
		o = s.taboption('basic', form.Button, '_test_send', _('Send Test'));
		o.inputtitle = _('Send');
		o.inputstyle = 'apply';
		o.onclick = function (ev) {
			var btn = ev.currentTarget;
			if (btn) btn.disabled = true;
			return m.save().then(function () {
				ui.showModal(_('Sending Test Message'), [
					E('p', { 'class': 'spinning' }, _('Push test message is being sent...'))
				]);
				return fs.exec('/usr/bin/watchtower/watchtower', ['test']).catch(function () {
				}).finally(function () {
					ui.hideModal();
					if (btn) btn.disabled = false;
				});
			});
		};

		o = s.taboption('basic', form.Value, 'device_name', _('Local Device Name'));
		o.rmempty = true;
		o.description = _('Device name added to push title to identify source.');

		o = s.taboption('basic', form.Value, 'sleeptime', _('Detection Interval'));
		o.rmempty = true;
		o.default = '60';
		o.datatype = 'and(uinteger,min(10))';
		o.description = _('Shorter times give faster responses but use more resources.');

		o = s.taboption('basic', form.ListValue, 'oui_data', _('MAC Device Info Database'));
		o.rmempty = true;
		o.default = '';
		o.value('', _('Disable'));
		o.value('1', _('Simplified Version'));
		o.value('2', _('Full Version'));
		o.value('3', _('Network Query'));
		o.description = _('Requires 4.36M raw data. Full ~1.2M, Lite ~250kb.<br/>Do not use network query without proxy.');

		o = s.taboption('basic', form.Flag, 'oui_dir', _('Download to RAM'));
		o.rmempty = true;
		o.depends('oui_data', '1');
		o.depends('oui_data', '2');
		o.description = _('Downloads to RAM, re-downloads on reboot.<br/>Download to flash if no proxy.');

		o = s.taboption('basic', form.Flag, 'reset_regularly', _('Reset traffic data daily at midnight'));
		o.rmempty = true;

		o = s.taboption('basic', form.Flag, 'debuglevel', _('Enable Logging'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('basic', form.DynamicList, 'device_aliases', _('Device Alias'));
		o.rmempty = true;
		o.description = _('<br/>Enter MAC and alias separated by \'-\', e.g.:<br/>XX:XX:XX:XX:XX:XX-MyPhone');

		/* ================= Instant Push Tab ================= */
		var rtEnabled = uci.get('watchtower', 'watchtower', 'realtime_enable') === '1';
		var rtCards = [];

		function syncRtCards(enabled) {
			for (var i = 0; i < rtCards.length; i++) {
				var c = rtCards[i];
				if (enabled) {
					c.classList.remove('pb-rt-disabled');
				} else {
					c.classList.add('pb-rt-disabled');
				}
				var inputs = c.querySelectorAll('input, select, textarea, button');
				for (var j = 0; j < inputs.length; j++) {
					inputs[j].disabled = !enabled;
				}
			}
		}

		o = s.taboption('realtime', form.Flag, 'realtime_enable', _('Instant Event Push'));
		o.default = '0';
		o.rmempty = false;
		o.renderWidget = function (section_id, option_index, cfgvalue) {
			var isChecked = (cfgvalue != null ? cfgvalue : this.default) === '1';
			rtEnabled = isChecked;
			var cbid = this.cbid(section_id);
			var badge = E('span', {
				'class': 'pb-dot ' + (isChecked ? 'pb-dot-ok' : 'pb-dot-muted')
			}, isChecked ? _('Enabled') : _('Disabled'));

			var chk = E('input', {
				'type': 'checkbox',
				'id': cbid,
				'name': cbid,
				'value': '1',
				'style': 'width: 18px; height: 18px; margin: 0; accent-color: var(--primary-color-high); cursor: pointer;',
				'change': function () {
					var on = !!chk.checked;
					rtEnabled = on;
					badge.className = 'pb-dot ' + (on ? 'pb-dot-ok' : 'pb-dot-muted');
					badge.textContent = on ? _('Enabled') : _('Disabled');
					syncRtCards(on);
				}
			});
			if (isChecked) chk.checked = true;

			return E('div', { 'class': 'pb-rt-master' }, [
				E('div', { 'class': 'pb-rt-master-info' }, [
					E('div', { 'class': 'pb-rt-master-title' }, [
						E('span', {}, _('Instant Event Push')),
						badge
					]),
					E('div', { 'class': 'pb-rt-master-desc' }, _('Global switch for both sections below: when enabled, IP/login events and device online alerts are delivered within 2 seconds via system events instead of polling.'))
				]),
				E('label', {
					'for': cbid,
					'style': 'display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 13px; font-weight: 600; color: var(--text-color-high); margin: 0;'
				}, [ chk, _('Enable') ])
			]);
		};
		o.formvalue = function (section_id) {
			var el = document.getElementById(this.cbid(section_id));
			return (el && el.checked) ? '1' : '0';
		};

		o = s.taboption('realtime', form.ListValue, 'watchtower_ipv4', _('IPv4 Change Notification'));
		o.rmempty = true;
		o.default = '';
		o.value('', _('Disable'));
		o.value('1', _('Get via Interface'));
		o.value('2', _('Get via URL'));

		o = s.taboption('realtime', form.ListValue, 'ipv4_interface', _('Interface Name'));
		o.rmempty = true;
		o.depends('watchtower_ipv4', '1');
		o.description = _('<br/>Generally select wan. Choose manually for multi-wan.');
		for (var dev in devices) {
			if (dev !== 'lo' && !dev.match(/^ifb.*/)) {
				o.value(dev, dev);
			}
		}

		o = s.taboption('realtime', form.TextValue, 'ipv4_list', _('IPv4 API List'));
		o.rows = 8;
		o.wrap = 'soft';
		o.depends('watchtower_ipv4', '2');
		o.description = _('<br/>May fail due to server stability or frequent connections.<br/>Not recommended if IP can be obtained via interface.<br/>Access randomly from the above list.');
		o.cfgvalue = function () {
			return ipv4ListContent;
		};
		o.write = function (section_id, formvalue) {
			return fs.write('/usr/bin/watchtower/api/ipv4.list', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		o = s.taboption('realtime', form.ListValue, 'watchtower_ipv6', _('IPv6 Change Notification'));
		o.rmempty = true;
		o.default = '0';
		o.value('0', _('Disable'));
		o.value('1', _('Get via Interface'));
		o.value('2', _('Get via URL'));

		o = s.taboption('realtime', form.ListValue, 'ipv6_interface', _('Interface Name'));
		o.rmempty = true;
		o.depends('watchtower_ipv6', '1');
		o.description = _('<br/>Generally select wan. Choose manually for multi-wan.');
		for (var dev in devices) {
			if (dev !== 'lo' && !dev.match(/^ifb.*/)) {
				o.value(dev, dev);
			}
		}

		o = s.taboption('realtime', form.TextValue, 'ipv6_list', _('IPv6 API List'));
		o.rows = 8;
		o.wrap = 'soft';
		o.depends('watchtower_ipv6', '2');
		o.description = _('<br/>May fail due to server stability or frequent connections.<br/>Not recommended if IP can be obtained via interface.<br/>Access randomly from the above list.');
		o.cfgvalue = function () {
			return ipv6ListContent;
		};
		o.write = function (section_id, formvalue) {
			return fs.write('/usr/bin/watchtower/api/ipv6.list', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		o = s.taboption('realtime', form.Flag, 'web_logged', _('Web Login Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('realtime', form.Flag, 'ssh_logged', _('SSH Login Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('realtime', form.Flag, 'web_login_failed', _('Web Error Attempt Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('realtime', form.Flag, 'ssh_login_failed', _('SSH Error Attempt Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('realtime', form.Value, 'login_max_num', _('Max Failed Login Attempts'));
		o.default = '3';
		o.datatype = 'and(uinteger,min(1))';
		o.depends('web_login_failed', '1');
		o.depends('ssh_login_failed', '1');
		o.description = _('Push Alert After Exceeding Limit');

		o = s.taboption('realtime', form.Flag, 'web_login_black', _('Auto Block'));
		o.default = '0';
		o.rmempty = true;
		o.depends('web_login_failed', '1');
		o.depends('ssh_login_failed', '1');
		o.description = _('Count won\'t reset until reboot. Please add whitelist first.');

		o = s.taboption('realtime', form.Value, 'ip_black_timeout', _('Blacklist Duration (s)'));
		o.default = '86400';
		o.datatype = 'and(uinteger,min(0))';
		o.depends('web_login_black', '1');
		o.description = _('0 is permanent block. Use with caution.<br>If locked out, change your IP to enter LUCI and clear rules.');

		o = s.taboption('realtime', form.DynamicList, 'ip_white_list', _('IP Whitelist'));
		o.datatype = 'ipaddr';
		o.rmempty = true;
		o.depends('web_logged', '1');
		o.depends('ssh_logged', '1');
		o.depends('web_login_failed', '1');
		o.depends('ssh_login_failed', '1');
		o.description = _('Ignore whitelist login alerts and block actions. Mask notation not supported.');
		for (var mac in hosts) {
			if (hosts[mac].ipv4) {
				o.value(hosts[mac].ipv4, hosts[mac].ipv4 + (hosts[mac].name ? ' (' + hosts[mac].name + ')' : ''));
			}
		}

		o = s.taboption('realtime', form.TextValue, 'ip_black_list', _('IP Blacklist'));
		o.rows = 8;
		o.wrap = 'soft';
		o.depends('web_login_black', '1');
		o.cfgvalue = function () {
			return ipBlacklistContent;
		};
		o.write = function (section_id, formvalue) {
			return fs.write('/usr/bin/watchtower/api/ip_blacklist', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		o = s.taboption('realtime', form.Flag, 'watchtower_up', _('Device Online Notification'));
		o.default = '1';
		o.rmempty = true;

		o = s.taboption('realtime', form.DynamicList, 'new_device_blacklist', _('1. Device Blacklist (Always Notify)'));
		o.rmempty = true;
		o.depends('watchtower_up', '1');
		o.description = _('Highest priority: devices in this list always trigger online notifications regardless of the mode below.');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('realtime', form.DynamicList, 'new_device_whitelist', _('2. Device Whitelist (Always Ignore)'));
		o.rmempty = true;
		o.depends('watchtower_up', '1');
		o.description = _('Second priority: trusted devices in this list never trigger online notifications.');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('realtime', form.ListValue, 'new_device_filter', _('3. Other Devices Policy'));
		o.default = '';
		o.rmempty = true;
		o.depends('watchtower_up', '1');
		o.value('', _('Notify All Other Devices'));
		o.value('unknown', _('Notify Unknown (First-Seen) Devices Only'));
		o.value('blacklist', _('Do Not Notify Other Devices (Blacklist Only)'));
		o.description = _('Applies to devices not matched by Rules 1 & 2 above.');

		o = s.taboption('realtime', form.TextValue, 'known_macs', _('Known Devices Record'));
		o.rows = 6;
		o.wrap = 'soft';
		o.depends('new_device_filter', 'unknown');
		o.description = _('MAC addresses already seen by "Unknown / First-Seen" mode (one per line). Remove a MAC to re-trigger its first-seen alert, or clear all to reset.');
		o.cfgvalue = function () {
			return knownMacsContent;
		};
		o.write = function (section_id, formvalue) {
			return fs.write('/usr/bin/watchtower/api/known_macs', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		o = s.taboption('realtime', form.Flag, 'watchtower_down', _('Device Offline Notification'));
		o.default = '1';
		o.rmempty = true;

		/* ================= Scheduled Push Tab ================= */
		o = s.taboption('crontab', form.Flag, 'cpuload_enable', _('CPU Load Alert'));
		o.default = '1';
		o.rmempty = true;

		o = s.taboption('crontab', form.Value, 'cpuload', _('CPU Load Alarm Threshold'));
		o.default = '2';
		o.rmempty = true;
		o.depends('cpuload_enable', '1');

		o = s.taboption('crontab', form.Flag, 'temperature_enable', _('CPU Temperature Alert'));
		o.default = '1';
		o.rmempty = true;
		o.description = _('Ensure device can read temperature. Change command in Advanced Settings.');

		o = s.taboption('crontab', form.Value, 'temperature', _('Temperature Alarm Threshold'));
		o.rmempty = true;
		o.default = '80';
		o.datatype = 'uinteger';
		o.depends('temperature_enable', '1');
		o.description = _('<br/>Device alerts pushed only after 5 mins continuous exceedance.<br/>Max once per hour.');

		o = s.taboption('crontab', form.Flag, 'client_usage', _('Device Abnormal Traffic'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('crontab', form.Value, 'client_usage_max', _('Bandwidth Limit Per Minute'));
		o.default = '10M';
		o.rmempty = true;
		o.depends('client_usage', '1');
		o.description = _('Device Abnormal Traffic Alert (bytes), can append K or M');

		o = s.taboption('crontab', form.Flag, 'client_usage_disturb', _('Abnormal Traffic DND'));
		o.default = '1';
		o.rmempty = true;
		o.depends('client_usage', '1');

		o = s.taboption('crontab', form.DynamicList, 'client_usage_whitelist', _('Abnormal Traffic Watchlist'));
		o.rmempty = true;
		o.depends('client_usage_disturb', '1');
		o.description = _('Enter Device MAC');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('crontab', form.ListValue, 'crontab', _('Cron Settings'));
		o.rmempty = true;
		o.default = '';
		o.value('', _('Disable'));
		o.value('1', _('Scheduled Sending'));
		o.value('2', _('Interval Sending'));

		o = s.taboption('crontab', form.ListValue, 'regular_time', _('Send Time'));
		o.rmempty = true;
		for (var t = 0; t <= 23; t++) {
			o.value(t, _('Every day at %s o\'clock').format(t));
		}
		o.default = '8';
		o.datatype = 'uinteger';
		o.depends('crontab', '1');

		o = s.taboption('crontab', form.ListValue, 'regular_time_2', _('Send Time'));
		o.rmempty = true;
		o.value('', _('Disable'));
		for (var t = 0; t <= 23; t++) {
			o.value(t, _('Every day at %s o\'clock').format(t));
		}
		o.default = '';
		o.datatype = 'uinteger';
		o.depends('crontab', '1');

		o = s.taboption('crontab', form.ListValue, 'regular_time_3', _('Send Time'));
		o.rmempty = true;
		o.value('', _('Disable'));
		for (var t = 0; t <= 23; t++) {
			o.value(t, _('Every day at %s o\'clock').format(t));
		}
		o.default = '';
		o.datatype = 'uinteger';
		o.depends('crontab', '1');

		o = s.taboption('crontab', form.ListValue, 'interval_time', _('Send Interval'));
		o.rmempty = true;
		for (var t = 1; t <= 23; t++) {
			o.value(t, _('%s Hours').format(t));
		}
		o.default = '6';
		o.datatype = 'uinteger';
		o.depends('crontab', '2');
		o.description = _('<br/>Sends every * hours starting from 00:00');

		o = s.taboption('crontab', form.Value, 'send_title', _('Push Title'));
		o.depends('crontab', '1');
		o.depends('crontab', '2');
		o.placeholder = _('OpenWrt Router Status:');
		o.description = _('<br/>Special characters may cause sending failure');

		o = s.taboption('crontab', form.Flag, 'router_status', _('System Status'));
		o.default = '1';
		o.depends('crontab', '1');
		o.depends('crontab', '2');

		o = s.taboption('crontab', form.Flag, 'router_temp', _('Device Temperature'));
		o.default = '1';
		o.depends('crontab', '1');
		o.depends('crontab', '2');

		o = s.taboption('crontab', form.Flag, 'router_wan', _('WAN Info'));
		o.default = '1';
		o.depends('crontab', '1');
		o.depends('crontab', '2');

		o = s.taboption('crontab', form.Flag, 'client_list', _('Client List'));
		o.default = '1';
		o.depends('crontab', '1');
		o.depends('crontab', '2');

		o = s.taboption('crontab', form.Value, 'google_check_timeout', _('Global Internet Detection Timeout'));
		o.rmempty = true;
		o.default = '10';
		o.datatype = 'and(uinteger,min(3))';
		o.description = _('Too short time may cause inaccurate detection');

		o = s.taboption('crontab', form.Button, '_send_manual', _('Send Manually'));
		o.inputtitle = _('Send');
		o.inputstyle = 'apply';
		o.depends('crontab', '1');
		o.depends('crontab', '2');
		o.onclick = function (ev) {
			var btn = ev.currentTarget;
			if (btn) btn.disabled = true;
			return m.save().then(function () {
				ui.showModal(_('Sending Scheduled Report'), [
					E('p', { 'class': 'spinning' }, _('Manual status report is being sent...'))
				]);
				return fs.exec('/usr/bin/watchtower/watchtower', ['send']).catch(function () {
				}).finally(function () {
					ui.hideModal();
					if (btn) btn.disabled = false;
				});
			});
		};

		/* ================= DND Tab ================= */
		o = s.taboption('disturb', form.ListValue, 'watchtower_sheep', _('DND Time Settings'),
			_('Pause pushes during specified hours.<br/>Scheduled pushes are also blocked during DND.'));
		o.rmempty = true;
		o.value('', _('Disable'));
		o.value('1', _('Mode 1: Script Suspended'));
		o.value('2', _('Mode 2: Silent Mode'));
		o.description = _('Mode 1 stops all detection, including unattended tasks.');

		o = s.taboption('disturb', form.ListValue, 'starttime', _('DND Start Time'));
		o.rmempty = true;
		for (var t = 0; t <= 23; t++) {
			o.value(t, _('Every day at %s o\'clock').format(t));
		}
		o.default = '0';
		o.datatype = 'uinteger';
		o.depends('watchtower_sheep', '1');
		o.depends('watchtower_sheep', '2');

		o = s.taboption('disturb', form.ListValue, 'endtime', _('DND End Time'));
		o.rmempty = true;
		for (var t = 0; t <= 23; t++) {
			o.value(t, _('Every day at %s o\'clock').format(t));
		}
		o.default = '8';
		o.datatype = 'uinteger';
		o.depends('watchtower_sheep', '1');
		o.depends('watchtower_sheep', '2');

		o = s.taboption('disturb', form.ListValue, 'macmechanism', _('MAC Filter'));
		o.value('', _('Disable'));
		o.value('allow', _('Ignore Listed Devices'));
		o.value('block', _('Notify only listed devices'));
		o.value('interface', _('Notify only this interface\'s devices'));
		o.rmempty = true;

		o = s.taboption('disturb', form.DynamicList, 'watchtower_whitelist', _('Ignore List'));
		o.rmempty = true;
		o.depends('macmechanism', 'allow');
		o.description = _('Format: AA:AA:AA:AA:AA:AA|BB:BB... Treats multiple MACs as one user.<br/>Pushes only when all devices are offline to avoid dual-wifi spam.');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('disturb', form.DynamicList, 'watchtower_blacklist', _('Watchlist'));
		o.rmempty = true;
		o.depends('macmechanism', 'block');
		o.description = _('Format: AA:AA:AA:AA:AA:AA|BB:BB... Treats multiple MACs as one user.<br/>Pushes only when all devices are offline to avoid dual-wifi spam.');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('disturb', form.ListValue, 'watchtower_interface', _('Interface Name'));
		o.depends('macmechanism', 'interface');
		o.rmempty = true;
		for (var dev in devices) {
			if (dev !== 'lo' && !dev.match(/^ifb.*/)) {
				o.value(dev, dev);
			}
		}

		o = s.taboption('disturb', form.ListValue, 'macmechanism2', _('MAC Filter 2'));
		o.value('', _('Disable'));
		o.value('MAC_online', _('DND when any listed device is online'));
		o.value('MAC_offline', _('DND after all listed devices are offline'));
		o.rmempty = true;

		o = s.taboption('disturb', form.DynamicList, 'MAC_online_list', _('Online DND List'));
		o.rmempty = true;
		o.depends('macmechanism2', 'MAC_online');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('disturb', form.DynamicList, 'MAC_offline_list', _('DND List for Any Offline'));
		o.rmempty = true;
		o.depends('macmechanism2', 'MAC_offline');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		/* ================= Advanced Settings Tab ================= */
		o = s.taboption('advanced', form.DummyValue, '_hint_note');
		o.renderWidget = function () {
			return E('div', { 'class': 'pb-note' }, _("Do not modify if you don't understand these options."));
		};

		o = s.taboption('advanced', form.Value, 'up_timeout', _('Device Online Timeout (s)'));
		o.default = '2';
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'down_timeout', _('Device Offline Timeout (s)'));
		o.default = '20';
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'timeout_retry_count', _('Offline Detection Count'));
		o.default = '2';
		o.datatype = 'uinteger';
		o.description = _('If there is no secondary router and the signal is good, these values can be reduced.<br/>Adjust parameters if devices frequently disconnect due to WiFi sleep mode.');

		o = s.taboption('advanced', form.Value, 'thread_num', _('Max Concurrent Threads'));
		o.default = '3';
		o.datatype = 'uinteger';

		o = s.taboption('advanced', form.Value, 'soc_code', _('Temperature Sensor Mode'));
		o.rmempty = true;
		o.value('', _('Auto (CPU / SoC Priority)'));
		o.value('max', _('Auto (Highest Chip Temperature)'));
		o.value('pve', _('PVE Virtual Machine'));
		o.description = _('Auto-detects /sys/class/thermal and /sys/class/hwmon across ARM, x86, and MIPS. You may also enter a custom command returning a numeric value.');

		o = s.taboption('advanced', form.Value, 'pve_host', _('Host Address'));
		o.rmempty = true;
		o.default = '10.0.0.2';
		o.description = _('Ensure SSH key-based authentication is configured on the PVE host.<br/>Example configuration:<br/>opkg update && opkg install openssh-client openssh-keygen<br/>ssh-keygen -t rsa<br/>ssh root@10.0.0.2 "cat >> ~/.ssh/authorized_keys" < ~/.ssh/id_rsa.pub<br/>ssh -i ~/.ssh/id_rsa root@10.0.0.2 sensors');
		o.depends('soc_code', 'pve');

		o = s.taboption('advanced', form.Value, 'pve_port', _('SSH Port'));
		o.rmempty = true;
		o.default = '22';
		o.description = _('Default is 22. Enter custom SSH port if any.');
		o.depends('soc_code', 'pve');

		o = s.taboption('advanced', form.Button, '_soc_test', _('Test Temperature Command'));
		o.inputtitle = _('Output Info');
		o.inputstyle = 'apply';
		o.onclick = function (ev) {
			var btn = ev.currentTarget;
			if (btn) btn.disabled = true;
			return m.save().then(function () {
				ui.showModal(_('Testing Temperature Command'), [
					E('p', { 'class': 'spinning' }, _('Reading device temperature sensors...'))
				]);
				return fs.exec('/usr/bin/watchtower/watchtower', ['soc']).then(function () {
					return Promise.all([
						common.readFile('/tmp/watchtower/soc_tmp'),
						common.readFile('/tmp/watchtower/soc_detail')
					]).then(function (res) {
						var output = (res[0] || '').trim();
						var detail = (res[1] || '').trim();
						var nodes = [
							E('div', { 'class': 'pb-note ' + (output ? 'pb-note-info' : '') },
								output ? (_('Primary Sensor Value: ') + output + ' ℃') : _('No temperature output returned. Please check sensor command.'))
						];
						if (detail) {
							nodes.push(E('pre', {
								'style': 'margin: 10px 0 0 0; padding: 10px 12px; border-radius: 6px; font-size: 12px; line-height: 1.5; border: 1px solid var(--border-color-low); background: var(--background-color-medium); overflow: auto;'
							}, detail));
						}
						nodes.push(E('div', { 'class': 'button-row right' }, [
							E('button', {
								'class': 'cbi-button cbi-button-neutral',
								'click': ui.hideModal
							}, _('Close'))
						]));
						ui.showModal(_('Temperature Sensor Output'), nodes);
					});
				}).catch(function (err) {
					ui.showModal(_('Error'), [
						E('div', { 'class': 'pb-note pb-note-err' }, _('Failed to test temperature command: ') + err.message),
						E('div', { 'class': 'button-row right' }, [
							E('button', {
								'class': 'cbi-button cbi-button-neutral',
								'click': ui.hideModal
							}, _('Close'))
						])
					]);
				}).finally(function () {
					if (btn) btn.disabled = false;
				});
			});
		};

		o = s.taboption('advanced', form.Flag, 'err_enable', _('Unattended Tasks'));
		o.default = '0';
		o.rmempty = true;
		o.description = _('Please ensure configurations are correct to avoid unexpected reboots.');

		o = s.taboption('advanced', form.Flag, 'err_sheep_enable', _('Redial only during DND'));
		o.default = '0';
		o.rmempty = true;
		o.description = _('Executes redials only during DND hours to minimize impact on daytime network usage.');
		o.depends('err_enable', '1');

		o = s.taboption('advanced', form.DynamicList, 'err_device_aliases', _('Watchlist'));
		o.rmempty = true;
		o.description = _('Executes only when all listed devices are offline.<br/>After 1 hour of DND, watched devices with low traffic (< 100KB/min) for 5 minutes are considered offline.');
		o.depends('err_enable', '1');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('advanced', form.ListValue, 'network_err_event', _('When Network Disconnected'));
		o.default = '';
		o.depends('err_enable', '1');
		o.value('', _('No Action'));
		o.value('1', _('Reboot Router'));
		o.value('2', _('Redial'));
		o.value('3', _('Modify settings to auto-repair network'));
		o.description = _('Options 1 and 2 will not alter configurations (max 2 retries).<br/>Option 3 creates a backup before attempting automatic repair.<br/>Please use with caution.');

		o = s.taboption('advanced', form.ListValue, 'system_time_event', _('Scheduled Reboot'));
		o.default = '';
		o.depends('err_enable', '1');
		o.value('', _('No Action'));
		o.value('1', _('Reboot Router'));
		o.value('2', _('Redial'));

		o = s.taboption('advanced', form.Value, 'autoreboot_time', _('System Uptime Greater Than'));
		o.rmempty = true;
		o.default = '24';
		o.datatype = 'uinteger';
		o.depends('system_time_event', '1');
		o.description = _('Unit is hours');

		o = s.taboption('advanced', form.Value, 'network_restart_time', _('Network Uptime Greater Than'));
		o.rmempty = true;
		o.default = '24';
		o.datatype = 'uinteger';
		o.depends('system_time_event', '2');
		o.description = _('Unit is hours');

		o = s.taboption('advanced', form.Flag, 'public_ip_event', _('Redial to get Public IP'));
		o.default = '0';
		o.rmempty = true;
		o.depends('err_enable', '1');
		o.description = _('Ensure public IP is obtainable via redial, otherwise redial will cause network interruption.<br/>Not applicable for carrier-grade NAT (CGNAT) environments.');

		o = s.taboption('advanced', form.Value, 'public_ip_retry_count', _('Max Daily Retries'));
		o.rmempty = true;
		o.default = '10';
		o.datatype = 'uinteger';
		o.depends('public_ip_event', '1');

		function enhanceMap(mapNode) {
			common.injectStyles();
			var rtTab = mapNode.querySelector('div[data-tab="realtime"]');
			if (rtTab && !rtTab.classList.contains('pb-tab-grouped')) {
				var children = Array.prototype.slice.call(rtTab.children);
				var blocks = [[], [], []];
				var idx = 0;
				for (var i = 0; i < children.length; i++) {
					var el = children[i];
					var id = el.id || '';
					var df = el.getAttribute ? (el.getAttribute('data-field') || '') : '';
					if (id.indexOf('watchtower_ipv4') !== -1 || df.indexOf('watchtower_ipv4') !== -1) idx = 1;
					else if (id.indexOf('watchtower_up') !== -1 || df.indexOf('watchtower_up') !== -1) idx = 2;
					blocks[idx].push(el);
				}
				rtTab.classList.add('pb-tab-grouped');
				rtCards = [];
				for (var b = 0; b < blocks.length; b++) {
					if (blocks[b].length > 0) {
						var card = E('div', { 'class': 'pb-form-card' + (b === 0 ? ' pb-master-card' : '') }, blocks[b]);
						if (b > 0) rtCards.push(card);
						rtTab.appendChild(card);
					}
				}
				syncRtCards(rtEnabled);
			}
			return mapNode;
		}

		var origRender = m.render.bind(m);
		m.render = function () {
			return origRender().then(enhanceMap);
		};

		return m.render();
	}
});
