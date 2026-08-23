'use strict';
'require dom';
'require fs';
'require poll';
'require rpc';
'require ui';
'require view';

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

function formatDuration(seconds) {
	if (isNaN(seconds) || seconds < 0) return '-';
	var days = Math.floor(seconds / 86400);
	var hours = Math.floor((seconds % 86400) / 3600);
	var minutes = Math.floor((seconds % 3600) / 60);
	var secs = Math.floor(seconds % 60);

	var res = '';
	if (days > 0) res += days + _('d ');
	if (hours > 0 || days > 0) res += hours + _('h ');
	if (minutes > 0 || hours > 0 || days > 0) res += minutes + _('m ');
	res += secs + _('s');
	return res;
}

function parseClients(ipAddressContent, hosts) {
	var lines = (ipAddressContent || '').trim().split('\n');
	var clients = [];
	var now = Math.floor(Date.now() / 1000);

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();
		if (!line) continue;
		var parts = line.split(/\s+/);
		if (parts.length >= 2) {
			var ip = parts[0] || '';
			var mac = (parts[1] || '').toUpperCase();
			var name = parts[2] || '';
			var upTime = parseInt(parts[3] || '0', 10);
			var iface = parts[4] || '-';

			if ((!name || name === 'Unknown' || name === '-') && hosts && hosts[mac.toLowerCase()]) {
				name = hosts[mac.toLowerCase()].name || hosts[mac.toLowerCase()].ipv4 || name;
			}

			var durationStr = upTime > 0 ? formatDuration(now - upTime) : '-';

			clients.push({
				ip: ip,
				mac: mac,
				name: name || _('Unknown Device'),
				iface: iface,
				duration: durationStr
			});
		}
	}
	return clients;
}

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
			readFile('/tmp/pushbot/ipAddress')
		]);
	},

	render: function(data) {
		var hosts = data[0] || {};
		var ipAddressContent = data[1] || '';

		var table = E('table', { 'class': 'table', 'id': 'pushbot_clients_table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('Hostname')),
				E('th', { 'class': 'th' }, _('MAC Address')),
				E('th', { 'class': 'th' }, _('IP Address')),
				E('th', { 'class': 'th' }, _('Interface')),
				E('th', { 'class': 'th' }, _('Online Time')),
				E('th', { 'class': 'th' }, _('Status'))
			])
		]);

		function updateTable(content) {
			var clients = parseClients(content, hosts);
			var rows = [
				E('tr', { 'class': 'tr table-titles' }, [
					E('th', { 'class': 'th' }, _('Hostname')),
					E('th', { 'class': 'th' }, _('MAC Address')),
					E('th', { 'class': 'th' }, _('IP Address')),
					E('th', { 'class': 'th' }, _('Interface')),
					E('th', { 'class': 'th' }, _('Online Time')),
					E('th', { 'class': 'th' }, _('Status'))
				])
			];

			if (clients.length === 0) {
				rows.push(E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td', 'colspan': 6 }, [
						E('em', {}, _('No online devices detected currently or PushBot service is not running.'))
					])
				]));
			} else {
				for (var i = 0; i < clients.length; i++) {
					var c = clients[i];
					rows.push(E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, [ E('strong', {}, c.name) ]),
						E('td', { 'class': 'td' }, [ E('code', {}, c.mac) ]),
						E('td', { 'class': 'td' }, [ c.ip ]),
						E('td', { 'class': 'td' }, [ c.iface ]),
						E('td', { 'class': 'td' }, [ c.duration ]),
						E('td', { 'class': 'td' }, [
							E('span', { 'class': 'badge', 'style': 'background-color:#52c41a;color:#fff;padding:2px 8px;border-radius:4px;' }, _('Online'))
						])
					]));
				}
			}

			dom.content(table, rows);
		}

		updateTable(ipAddressContent);

		poll.add(function() {
			return readFile('/tmp/pushbot/ipAddress').then(function(res) {
				updateTable(res || '');
			}).catch(function() {
				updateTable('');
			});
		}, 3);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', { 'name': 'content' }, _('Online Devices')),
			E('div', { 'class': 'cbi-map-descr' }, _('Displays devices currently monitored and recorded by PushBot.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'margin-bottom:10px;text-align:right;' }, [
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': function() {
							return readFile('/tmp/pushbot/ipAddress').then(function(res) {
								updateTable(res || '');
								ui.addNotification(null, E('p', {}, _('Client list refreshed.')), 'info');
							});
						}
					}, _('Refresh List'))
				]),
				table
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
