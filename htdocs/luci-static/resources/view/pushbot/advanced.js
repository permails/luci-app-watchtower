'use strict';
'require form';
'require fs';
'require rpc';
'require ui';
'require view';

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
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

return view.extend({
	load: function() {
		return Promise.all([
			callHostHints(),
			readFile('/tmp/pushbot/soc_tmp')
		]);
	},

	render: function(data) {
		var hosts = data[0] || {};
		var socTmp = (data[1] || '').trim();

		var m, s, o;

		m = new form.Map('pushbot', _('Hint'),
			_("Do not modify if you don't understand these options."));

		s = m.section(form.NamedSection, 'pushbot', 'pushbot', _('Advanced Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Value, 'up_timeout', _('Device Online Timeout (s)'));
		o.default = '2';
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'down_timeout', _('Device Offline Timeout (s)'));
		o.default = '20';
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'timeout_retry_count', _('Offline Detection Count'));
		o.default = '2';
		o.datatype = 'uinteger';
		o.description = _('If there is no secondary router and the signal is good, these values can be reduced.<br/>Adjust parameters if devices frequently disconnect due to WiFi sleep mode.');

		o = s.option(form.Value, 'thread_num', _('Max Concurrent Threads'));
		o.default = '3';
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'soc_code', _('Custom Temperature Command'));
		o.rmempty = true;
		o.value('', _('Default'));
		o.value('pve', _('PVE Virtual Machine'));
		o.description = _('Avoid special characters. The command output must return a numeric value for temperature comparison.');

		o = s.option(form.Value, 'pve_host', _('Host Address'));
		o.rmempty = true;
		o.default = '10.0.0.2';
		o.description = _('Ensure SSH key-based authentication is configured on the PVE host.<br/>Example configuration:<br/>opkg update && opkg install openssh-client openssh-keygen<br/>ssh-keygen -t rsa<br/>ssh root@10.0.0.2 "cat >> ~/.ssh/authorized_keys" < ~/.ssh/id_rsa.pub<br/>ssh -i ~/.ssh/id_rsa root@10.0.0.2 sensors');
		o.depends('soc_code', 'pve');

		o = s.option(form.Value, 'pve_port', _('SSH Port'));
		o.rmempty = true;
		o.default = '22';
		o.description = _('Default is 22. Enter custom SSH port if any.');
		o.depends('soc_code', 'pve');

		o = s.option(form.Button, '_soc_test', _('Test Temperature Command'));
		o.inputtitle = _('Output Info');
		o.inputstyle = 'apply';
		o.onclick = function(ev) {
			return m.save().then(function() {
				ui.showModal(_('Testing Temperature Command'), [
					E('p', { 'class': 'spinning' }, _('Reading device temperature sensors...'))
				]);
				return fs.exec('/usr/bin/pushbot/pushbot', ['soc']).then(function() {
					return readFile('/tmp/pushbot/soc_tmp').then(function(res) {
						var output = (res || '').trim();
						ui.showModal(_('Temperature Sensor Output'), [
							E('p', {}, output ? _('Sensor Value: ') + output + ' ℃' : _('No temperature output returned. Please check sensor command.'))
						]);
					});
				}).catch(function(err) {
					ui.showModal(_('Error'), [
						E('p', {}, _('Failed to test temperature command: ') + err.message)
					]);
				});
			});
		};

		o = s.option(form.Flag, 'err_enable', _('Unattended Tasks'));
		o.default = '0';
		o.rmempty = true;
		o.description = _('Please ensure configurations are correct to avoid unexpected reboots.');

		o = s.option(form.Flag, 'err_sheep_enable', _('Redial only during DND'));
		o.default = '0';
		o.rmempty = true;
		o.description = _('Executes redials only during DND hours to minimize impact on daytime network usage.');
		o.depends('err_enable', '1');

		o = s.option(form.DynamicList, 'err_device_aliases', _('Watchlist'));
		o.rmempty = true;
		o.description = _('Executes only when all listed devices are offline.<br/>After 1 hour of DND, watched devices with low traffic (< 100KB/min) for 5 minutes are considered offline.');
		o.depends('err_enable', '1');
		for (var mac in hosts) {
			var hname = hosts[mac].name || hosts[mac].ipv4 || '';
			o.value(mac, hname ? mac + ' (' + hname + ')' : mac);
		}

		o = s.option(form.ListValue, 'network_err_event', _('When Network Disconnected'));
		o.default = '';
		o.depends('err_enable', '1');
		o.value('', _('No Action'));
		o.value('1', _('Reboot Router'));
		o.value('2', _('Redial'));
		o.value('3', _('Modify settings to auto-repair network'));
		o.description = _('Options 1 and 2 will not alter configurations (max 2 retries).<br/>Option 3 creates a backup before attempting automatic repair.<br/>Please use with caution.');

		o = s.option(form.ListValue, 'system_time_event', _('Scheduled Reboot'));
		o.default = '';
		o.depends('err_enable', '1');
		o.value('', _('No Action'));
		o.value('1', _('Reboot Router'));
		o.value('2', _('Redial'));

		o = s.option(form.Value, 'autoreboot_time', _('System Uptime Greater Than'));
		o.rmempty = true;
		o.default = '24';
		o.datatype = 'uinteger';
		o.depends('system_time_event', '1');
		o.description = _('Unit is hours');

		o = s.option(form.Value, 'network_restart_time', _('Network Uptime Greater Than'));
		o.rmempty = true;
		o.default = '24';
		o.datatype = 'uinteger';
		o.depends('system_time_event', '2');
		o.description = _('Unit is hours');

		o = s.option(form.Flag, 'public_ip_event', _('Redial to get Public IP'));
		o.default = '0';
		o.rmempty = true;
		o.depends('err_enable', '1');
		o.description = _('Ensure public IP is obtainable via redial, otherwise redial will cause network interruption.<br/>Not applicable for carrier-grade NAT (CGNAT) environments.');

		o = s.option(form.Value, 'public_ip_retry_count', _('Max Daily Retries'));
		o.rmempty = true;
		o.default = '10';
		o.datatype = 'uinteger';
		o.depends('public_ip_event', '1');

		return m.render();
	}
});
