'use strict';
'require form';
'require fs';
'require network';
'require poll';
'require rpc';
'require ui';
'require uci';
'require view';

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

function readFile(path) {
	return fs.read_direct(path).catch(function() {
		return fs.read(path).then(function(res) {
			return (res && typeof res.data === 'string') ? res.data : '';
		});
	}).catch(function() {
		return '';
	});
}

function getServiceStatus() {
	return fs.exec_direct('/bin/busybox', ['ps']).then(function(res) {
		if (res && res.indexOf('/usr/bin/pushbot/pushbot') !== -1) {
			return true;
		}
		return false;
	}).catch(function() {
		return false;
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			callHostHints(),
			callNetworkDevices(),
			network.getNetworks(),
			readFile('/usr/bin/pushbot/api/diy.json'),
			readFile('/usr/bin/pushbot/api/ipv4.list'),
			readFile('/usr/bin/pushbot/api/ipv6.list'),
			readFile('/usr/bin/pushbot/api/ip_blacklist')
		]);
	},

	render: function(data) {
		var hosts = data[0] || {};
		var devices = data[1] || {};
		var networks = data[2] || [];
		var diyJsonContent = data[3] || '';
		var ipv4ListContent = data[4] || '';
		var ipv6ListContent = data[5] || '';
		var ipBlacklistContent = data[6] || '';

		var m, s, o;

		m = new form.Map('pushbot', _('PushBot'),
			_('PushBot pushes alerts and logs to various platforms.<br>Supports DingTalk, WeCom, PushPlus.'));

		/* 状态显示 Section */
		s = m.section(form.NamedSection, 'global_status', 'status');
		s.anonymous = true;
		s.render = function() {
			var statusNode = E('div', { 'class': 'cbi-section' }, [
				E('p', { 'id': 'pushbot_status' }, [
					E('em', {}, _('Collecting data...'))
				])
			]);

			poll.add(function() {
				return getServiceStatus().then(function(isRunning) {
					var node = document.getElementById('pushbot_status');
					if (!node) return;
					if (isRunning) {
						node.innerHTML = '<em><b style="color:green">pushbot ' + _('RUNNING') + '</b></em>';
					} else {
						node.innerHTML = '<em><b style="color:red">pushbot ' + _('NOT RUNNING') + '</b></em>';
					}
				});
			}, 3);

			return statusNode;
		};

		s = m.section(form.NamedSection, 'pushbot', 'pushbot');
		s.anonymous = true;
		s.addremove = false;

		s.tab('basic', _('Basic Settings'));
		s.tab('content', _('Push Content'));
		s.tab('crontab', _('Scheduled Push'));
		s.tab('disturb', _('Do Not Disturb (DND)'));

		/* ================= 基本设置 Tab ================= */
		o = s.taboption('basic', form.Flag, 'pushbot_enable', _('Enable'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('basic', form.MultiValue, 'lite_enable', _('Lite Mode'));
		o.value('device', _('Lite Current Device List'));
		o.value('nowtime', _('Lite Current Time'));
		o.value('content', _('Push Title Only'));
		o.renderWidget = function(section_id, option_index, cfgvalue) {
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
				var isChecked = curValues.indexOf(c.key) !== -1;
				var chk = E('input', {
					'type': 'checkbox',
					'name': cbid,
					'value': c.key,
					'id': cbid + '_' + c.key,
					'style': 'vertical-align: middle; margin: 0 4px 0 0;'
				});
				if (isChecked) {
					chk.checked = true;
				}

				var lbl = E('label', {
					'for': cbid + '_' + c.key,
					'style': 'display: inline-flex; align-items: center; margin: 0 20px 0 0; cursor: pointer; user-select: none; font-weight: normal;'
				}, [ chk, c.label ]);

				nodes.push(lbl);
			}

			return E('div', { 'style': 'display: inline-flex; align-items: center; flex-wrap: wrap; margin: 0; padding: 0;' }, nodes);
		};
		o.formvalue = function(section_id) {
			var cbid = this.cbid(section_id);
			var nodes = document.querySelectorAll('input[name="' + cbid + '"]:checked');
			var vals = [];
			for (var i = 0; i < nodes.length; i++) {
				vals.push(nodes[i].value);
			}
			return vals;
		};
		o.write = function(section_id, formvalue) {
			var vals = L.toArray(formvalue);
			if (vals.length > 0) {
				return uci.set('pushbot', section_id, 'lite_enable', vals.join(' '));
			} else {
				return uci.unset('pushbot', section_id, 'lite_enable');
			}
		};

		o = s.taboption('basic', form.ListValue, 'jsonpath', _('Push Mode'));
		o.default = '/usr/bin/pushbot/api/dingding.json';
		o.rmempty = false;
		o.value('/usr/bin/pushbot/api/telegram.json', _('Telegram Bot'));
		o.value('/usr/bin/pushbot/api/slack.json', _('Slack'));
		o.value('/usr/bin/pushbot/api/mattermost.json', _('Mattermost'));
		o.value('/usr/bin/pushbot/api/dingding.json', _('DingTalk'));
		o.value('/usr/bin/pushbot/api/ent_wechat.json', _('WeCom'));
		o.value('/usr/bin/pushbot/api/feishu.json', _('Feishu'));
		o.value('/usr/bin/pushbot/api/bark.json', _('Bark'));
		o.value('/usr/bin/pushbot/api/pushplus.json', _('PushPlus'));
		o.value('/usr/bin/pushbot/api/pushdeer.json', _('PushDeer'));
		o.value('/usr/bin/pushbot/api/diy.json', _('Custom Push'));

		/* Telegram */
		o = s.taboption('basic', form.Value, 'tg_token', _('Telegram Bot Token'),
			_('Telegram Bot Token<br>Created via @BotFather<br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/telegram.json');

		o = s.taboption('basic', form.Value, 'tg_chatid', _('Telegram Chat ID'),
			_('Telegram Chat ID<br>Can be user id or group id<br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/telegram.json');

		/* Slack */
		o = s.taboption('basic', form.Value, 'slack_webhook', _('Slack Webhook URL'),
			_('Slack Incoming Webhook URL<br>Starts with https://hooks.slack.com/services/<br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/slack.json');

		/* Mattermost */
		o = s.taboption('basic', form.Value, 'mattermost_webhook', _('Mattermost Webhook URL'),
			_('Mattermost Incoming Webhook URL<br>Starts with https://your-mattermost/hooks/<br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/mattermost.json');

		/* DingTalk */
		o = s.taboption('basic', form.Value, 'dd_webhook', _('Webhook'),
			_('DingTalk Bot Webhook, enter only the part after access_token=<br>Get call code <a href="https://open.dingtalk.com/document/robots/custom-robot-access" target="_blank">Click Here</a><br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/dingding.json');

		/* WeCom */
		o = s.taboption('basic', form.Value, 'we_webhook', _('Webhook'),
			_('WeCom Bot Webhook, enter only the part after key=<br>Get call code <a href="https://developer.work.weixin.qq.com/document/path/91770" target="_blank">Click Here</a><br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/ent_wechat.json');

		/* PushPlus */
		o = s.taboption('basic', form.Value, 'pp_token', _('PushPlus Token'),
			_('PushPlus Token<br>Get call code <a href="http://pushplus.plus" target="_blank">Click Here</a><br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/pushplus.json');

		o = s.taboption('basic', form.ListValue, 'pp_channel', _('PushPlus Channel'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/pushplus.json');
		o.value('wechat', _('wechat: PushPlus WeChat Official Account'));
		o.value('cp', _('cp: WeCom App'));
		o.value('webhook', _('webhook: Third-party Webhook'));
		o.value('sms', _('sms: SMS'));
		o.value('mail', _('mail: Email'));
		o.description = _("Third-party webhook: WeCom, DingTalk, Feishu, ServerChan<br>SMS/Email: PushPlus not yet open<br>Channel settings: <a href='http://pushplus.plus/doc/extend/webhook.html' target='_blank'>Click Here</a>");

		o = s.taboption('basic', form.Value, 'pp_webhook', _('PushPlus Custom Webhook'),
			_('PushPlus Custom Webhook<br>For third-party or WeCom calls<br>See here for Custom Webhook setup<br><br>'));
		o.rmempty = true;
		o.depends('pp_channel', 'cp');
		o.depends('pp_channel', 'webhook');

		o = s.taboption('basic', form.Flag, 'pp_topic_enable', _('PushPlus One-to-Many Push'));
		o.default = '0';
		o.rmempty = true;
		o.depends('pp_channel', 'wechat');

		o = s.taboption('basic', form.Value, 'pp_topic', _('PushPlus Topic'),
			_('PushPlus Group Code<br>Group code for one-to-many push<br>See here for Topic setup<br><br>'));
		o.rmempty = true;
		o.depends('pp_topic_enable', '1');

		/* PushDeer */
		o = s.taboption('basic', form.Value, 'pushdeer_key', _('PushDeer Key'),
			_('PushDeer Key<br>Get call code <a href="https://www.pushdeer.com" target="_blank">Click Here</a><br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/pushdeer.json');

		o = s.taboption('basic', form.Flag, 'pushdeer_srv_enable', _('Self-hosted PushDeer Server'));
		o.default = '0';
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/pushdeer.json');

		o = s.taboption('basic', form.Value, 'pushdeer_srv', _('PushDeer Server'),
			_('PushDeer Self-hosted Server Address<br>e.g. https://your.domain:port<br>See here for self-hosted setup<br><br>'));
		o.rmempty = true;
		o.depends('pushdeer_srv_enable', '1');

		/* Feishu */
		o = s.taboption('basic', form.Value, 'fs_webhook', _('WebHook'),
			_('Feishu WebHook<br>Get call code <a href="https://open.feishu.cn/document/ukTMukTMukTM/ucTM5YjL3ETO24yNx0jN" target="_blank">Click Here</a><br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/feishu.json');

		/* Bark */
		o = s.taboption('basic', form.Value, 'bark_token', _('Bark Token'),
			_('Bark Token<br>Get call code <a href="https://github.com/Finb/Bark" target="_blank">Click Here</a><br><br>'));
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/bark.json');

		o = s.taboption('basic', form.Flag, 'bark_srv_enable', _('Self-hosted Bark Server'));
		o.default = '0';
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/bark.json');

		o = s.taboption('basic', form.Value, 'bark_srv', _('Bark Server'),
			_('Bark Self-hosted Server Address<br>e.g. https://your.domain:port<br>See here for self-hosted setup<br><br>'));
		o.rmempty = true;
		o.depends('bark_srv_enable', '1');

		o = s.taboption('basic', form.Value, 'bark_sound', _('Bark Sound'),
			_('Bark Notification Sound<br>e.g. silence.caf<br>See here for setup<br><br>'));
		o.rmempty = true;
		o.default = 'silence.caf';
		o.depends('jsonpath', '/usr/bin/pushbot/api/bark.json');

		o = s.taboption('basic', form.Flag, 'bark_icon_enable', _('Bark Notification Icon'));
		o.default = '0';
		o.rmempty = true;
		o.depends('jsonpath', '/usr/bin/pushbot/api/bark.json');

		o = s.taboption('basic', form.Value, 'bark_icon', _('Bark Icon'),
			_('Bark Notification Icon (iOS15+ only)<br>e.g. http://day.app/assets/images/avatar.jpg<br>See here for setup<br><br>'));
		o.rmempty = true;
		o.default = 'http://day.app/assets/images/avatar.jpg';
		o.depends('bark_icon_enable', '1');

		o = s.taboption('basic', form.Value, 'bark_level', _('Bark Level'),
			_('Bark Time-Sensitive Notification<br>active: Default, screen lights up immediately.<br/>timeSensitive: Shows even in Focus mode.<br/>passive: Adds to list quietly without lighting up.'));
		o.rmempty = true;
		o.default = 'active';
		o.depends('jsonpath', '/usr/bin/pushbot/api/bark.json');

		/* DIY Custom JSON */
		o = s.taboption('basic', form.TextValue, 'diy_json', _('Custom Push'));
		o.rows = 20;
		o.wrap = 'off';
		o.depends('jsonpath', '/usr/bin/pushbot/api/diy.json');
		o.cfgvalue = function() {
			return diyJsonContent;
		};
		o.write = function(section_id, formvalue) {
			return fs.write('/usr/bin/pushbot/api/diy.json', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		/* Send Test Button */
		o = s.taboption('basic', form.Button, '_test_send', _('Send Test'));
		o.inputtitle = _('Send');
		o.inputstyle = 'apply';
		o.onclick = function(ev) {
			return m.save().then(function() {
				ui.showModal(_('Sending Test Message'), [
					E('p', { 'class': 'spinning' }, _('Push test message is being sent...'))
				]);
				return fs.exec('/usr/bin/pushbot/pushbot', ['test']).then(function(res) {
					ui.addNotification(null, E('p', {}, _('Test message triggered. Check log or client for details.')), 'info');
				}).catch(function(err) {
					ui.addNotification(null, E('p', {}, _('Failed to trigger test: ') + err.message), 'error');
				}).finally(function() {
					ui.hideModal();
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
		o.rmempty = true;

		o = s.taboption('basic', form.DynamicList, 'device_aliases', _('Device Alias'));
		o.rmempty = true;
		o.description = _('<br/>Enter MAC and alias separated by \'-\', e.g.:<br/>XX:XX:XX:XX:XX:XX-MyPhone');


		/* ================= 推送内容 Tab ================= */
		o = s.taboption('content', form.ListValue, 'pushbot_ipv4', _('IPv4 Change Notification'));
		o.rmempty = true;
		o.default = '';
		o.value('', _('Disable'));
		o.value('1', _('Get via Interface'));
		o.value('2', _('Get via URL'));

		o = s.taboption('content', form.ListValue, 'ipv4_interface', _('Interface Name'));
		o.rmempty = true;
		o.depends('pushbot_ipv4', '1');
		o.description = _('<br/>Generally select wan. Choose manually for multi-wan.');
		for (var dev in devices) {
			if (dev !== 'lo' && !dev.match(/^ifb.*/)) {
				o.value(dev, dev);
			}
		}

		o = s.taboption('content', form.TextValue, 'ipv4_list', _('IPv4 API List'));
		o.rows = 8;
		o.wrap = 'soft';
		o.depends('pushbot_ipv4', '2');
		o.description = _('<br/>May fail due to server stability or frequent connections.<br/>Not recommended if IP can be obtained via interface.<br/>Access randomly from the above list.');
		o.cfgvalue = function() {
			return ipv4ListContent;
		};
		o.write = function(section_id, formvalue) {
			return fs.write('/usr/bin/pushbot/api/ipv4.list', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		o = s.taboption('content', form.ListValue, 'pushbot_ipv6', _('IPv6 Change Notification'));
		o.rmempty = true;
		o.default = '0';
		o.value('0', _('Disable'));
		o.value('1', _('Get via Interface'));
		o.value('2', _('Get via URL'));

		o = s.taboption('content', form.ListValue, 'ipv6_interface', _('Interface Name'));
		o.rmempty = true;
		o.depends('pushbot_ipv6', '1');
		o.description = _('<br/>Generally select wan. Choose manually for multi-wan.');
		for (var dev in devices) {
			if (dev !== 'lo' && !dev.match(/^ifb.*/)) {
				o.value(dev, dev);
			}
		}

		o = s.taboption('content', form.TextValue, 'ipv6_list', _('IPv6 API List'));
		o.rows = 8;
		o.wrap = 'soft';
		o.depends('pushbot_ipv6', '2');
		o.description = _('<br/>May fail due to server stability or frequent connections.<br/>Not recommended if IP can be obtained via interface.<br/>Access randomly from the above list.');
		o.cfgvalue = function() {
			return ipv6ListContent;
		};
		o.write = function(section_id, formvalue) {
			return fs.write('/usr/bin/pushbot/api/ipv6.list', (formvalue || '').replace(/\r\n/g, '\n'));
		};

		o = s.taboption('content', form.Flag, 'pushbot_up', _('Device Online Notification'));
		o.default = '1';
		o.rmempty = true;

		o = s.taboption('content', form.Flag, 'pushbot_down', _('Device Offline Notification'));
		o.default = '1';
		o.rmempty = true;

		o = s.taboption('content', form.Flag, 'cpuload_enable', _('CPU Load Alert'));
		o.default = '1';
		o.rmempty = true;

		o = s.taboption('content', form.Value, 'cpuload', _('CPU Load Alarm Threshold'));
		o.default = '2';
		o.rmempty = true;
		o.depends('cpuload_enable', '1');

		o = s.taboption('content', form.Flag, 'temperature_enable', _('CPU Temperature Alert'));
		o.default = '1';
		o.rmempty = true;
		o.description = _('Ensure device can read temperature. Change command in Advanced Settings.');

		o = s.taboption('content', form.Value, 'temperature', _('Temperature Alarm Threshold'));
		o.rmempty = true;
		o.default = '80';
		o.datatype = 'uinteger';
		o.depends('temperature_enable', '1');
		o.description = _('<br/>Device alerts pushed only after 5 mins continuous exceedance.<br/>Max once per hour.');

		o = s.taboption('content', form.Flag, 'client_usage', _('Device Abnormal Traffic'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('content', form.Value, 'client_usage_max', _('Bandwidth Limit Per Minute'));
		o.default = '10M';
		o.rmempty = true;
		o.depends('client_usage', '1');
		o.description = _('Device Abnormal Traffic Alert (bytes), can append K or M');

		o = s.taboption('content', form.Flag, 'client_usage_disturb', _('Abnormal Traffic DND'));
		o.default = '1';
		o.rmempty = true;
		o.depends('client_usage', '1');

		o = s.taboption('content', form.DynamicList, 'client_usage_whitelist', _('Abnormal Traffic Watchlist'));
		o.rmempty = true;
		o.depends('client_usage_disturb', '1');
		o.description = _('Enter Device MAC');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('content', form.Flag, 'web_logged', _('Web Login Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('content', form.Flag, 'ssh_logged', _('SSH Login Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('content', form.Flag, 'web_login_failed', _('Web Error Attempt Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('content', form.Flag, 'ssh_login_failed', _('SSH Error Attempt Alert'));
		o.default = '0';
		o.rmempty = true;

		o = s.taboption('content', form.Value, 'login_max_num', _('Max Failed Login Attempts'));
		o.default = '3';
		o.datatype = 'and(uinteger,min(1))';
		o.depends('web_login_failed', '1');
		o.depends('ssh_login_failed', '1');
		o.description = _('Push Alert After Exceeding Limit');

		o = s.taboption('content', form.Flag, 'web_login_black', _('Auto Block'));
		o.default = '0';
		o.rmempty = true;
		o.depends('web_login_failed', '1');
		o.depends('ssh_login_failed', '1');
		o.description = _('Count won\'t reset until reboot. Please add whitelist first.');

		o = s.taboption('content', form.Value, 'ip_black_timeout', _('Blacklist Duration (s)'));
		o.default = '86400';
		o.datatype = 'and(uinteger,min(0))';
		o.depends('web_login_black', '1');
		o.description = _('0 is permanent block. Use with caution.<br>If locked out, change your IP to enter LUCI and clear rules.');

		o = s.taboption('content', form.DynamicList, 'ip_white_list', _('IP Whitelist'));
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

		o = s.taboption('content', form.TextValue, 'ip_black_list', _('IP Blacklist'));
		o.rows = 8;
		o.wrap = 'soft';
		o.depends('web_login_black', '1');
		o.cfgvalue = function() {
			return ipBlacklistContent;
		};
		o.write = function(section_id, formvalue) {
			return fs.write('/usr/bin/pushbot/api/ip_blacklist', (formvalue || '').replace(/\r\n/g, '\n'));
		};


		/* ================= 定时推送 Tab ================= */
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
		o.onclick = function(ev) {
			return m.save().then(function() {
				ui.showModal(_('Sending Scheduled Report'), [
					E('p', { 'class': 'spinning' }, _('Manual status report is being sent...'))
				]);
				return fs.exec('/usr/bin/pushbot/pushbot', ['send']).then(function(res) {
					ui.addNotification(null, E('p', {}, _('Status report triggered. Check log or client for details.')), 'info');
				}).catch(function(err) {
					ui.addNotification(null, E('p', {}, _('Failed to send status report: ') + err.message), 'error');
				}).finally(function() {
					ui.hideModal();
				});
			});
		};


		/* ================= 免打扰 Tab ================= */
		o = s.taboption('disturb', form.ListValue, 'pushbot_sheep', _('DND Time Settings'),
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
		o.depends('pushbot_sheep', '1');
		o.depends('pushbot_sheep', '2');

		o = s.taboption('disturb', form.ListValue, 'endtime', _('DND End Time'));
		o.rmempty = true;
		for (var t = 0; t <= 23; t++) {
			o.value(t, _('Every day at %s o\'clock').format(t));
		}
		o.default = '8';
		o.datatype = 'uinteger';
		o.depends('pushbot_sheep', '1');
		o.depends('pushbot_sheep', '2');

		o = s.taboption('disturb', form.ListValue, 'macmechanism', _('MAC Filter'));
		o.value('', _('Disable'));
		o.value('allow', _('Ignore Listed Devices'));
		o.value('block', _('Notify only listed devices'));
		o.value('interface', _('Notify only this interface\'s devices'));
		o.rmempty = true;

		o = s.taboption('disturb', form.DynamicList, 'pushbot_whitelist', _('Ignore List'));
		o.rmempty = true;
		o.depends('macmechanism', 'allow');
		o.description = _('Format: AA:AA:AA:AA:AA:AA|BB:BB... Treats multiple MACs as one user.<br/>Pushes only when all devices are offline to avoid dual-wifi spam.');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('disturb', form.DynamicList, 'pushbot_blacklist', _('Watchlist'));
		o.rmempty = true;
		o.depends('macmechanism', 'block');
		o.description = _('Format: AA:AA:AA:AA:AA:AA|BB:BB... Treats multiple MACs as one user.<br/>Pushes only when all devices are offline to avoid dual-wifi spam.');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.taboption('disturb', form.ListValue, 'pushbot_interface', _('Interface Name'));
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

		return m.render();
	}
});
