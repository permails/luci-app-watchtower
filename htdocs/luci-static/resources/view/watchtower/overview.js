// Author: permails <logo@permails.com>
'use strict';
'require dom';
'require fs';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';
'require watchtower.common as common';

var callHostHints = rpc.declare({
	object: 'luci-rpc',
	method: 'getHostHints',
	expect: { '': {} }
});

var CHANNEL_LABELS = {
	'/usr/bin/watchtower/api/telegram.json': 'Telegram Bot',
	'/usr/bin/watchtower/api/discord.json': 'Discord',
	'/usr/bin/watchtower/api/ntfy.json': 'ntfy',
	'/usr/bin/watchtower/api/smtp.json': 'Email (SMTP)',
	'/usr/bin/watchtower/api/slack.json': 'Slack',
	'/usr/bin/watchtower/api/mattermost.json': 'Mattermost',
	'/usr/bin/watchtower/api/bark.json': 'Bark',
	'/usr/bin/watchtower/api/dingding.json': 'DingTalk',
	'/usr/bin/watchtower/api/ent_wechat.json': 'WeCom',
	'/usr/bin/watchtower/api/feishu.json': 'Feishu',
	'/usr/bin/watchtower/api/diy.json': 'Custom Push'
};

function getChannelSummary() {
	var jsonpath = uci.get('watchtower', 'watchtower', 'jsonpath') || '/usr/bin/watchtower/api/telegram.json';
	var label = CHANNEL_LABELS[jsonpath] || 'Telegram Bot';
	var credMap = {
		'/usr/bin/watchtower/api/telegram.json': 'tg_token',
		'/usr/bin/watchtower/api/discord.json': 'discord_webhook',
		'/usr/bin/watchtower/api/ntfy.json': 'ntfy_topic',
		'/usr/bin/watchtower/api/smtp.json': 'smtp_to',
		'/usr/bin/watchtower/api/slack.json': 'slack_webhook',
		'/usr/bin/watchtower/api/mattermost.json': 'mattermost_webhook',
		'/usr/bin/watchtower/api/bark.json': 'bark_token',
		'/usr/bin/watchtower/api/dingding.json': 'dd_webhook',
		'/usr/bin/watchtower/api/ent_wechat.json': 'we_webhook',
		'/usr/bin/watchtower/api/feishu.json': 'fs_webhook'
	};
	var key = credMap[jsonpath];
	var configured = key ? !!(uci.get('watchtower', 'watchtower', key)) : true;
	return { label: _(label), configured: configured };
}

function getDndSummary() {
	var sheep = uci.get('watchtower', 'watchtower', 'watchtower_sheep') || '';
	var start = uci.get('watchtower', 'watchtower', 'starttime') || '0';
	var end = uci.get('watchtower', 'watchtower', 'endtime') || '8';
	var cron = uci.get('watchtower', 'watchtower', 'crontab') || '';
	var cronText = _('Schedule: Disabled');

	if (cron === '1') {
		var rt = uci.get('watchtower', 'watchtower', 'regular_time') || '8';
		cronText = _('Daily at %s:00').format(rt);
	} else if (cron === '2') {
		var it = uci.get('watchtower', 'watchtower', 'interval_time') || '6';
		cronText = _('Every %s hours').format(it);
	}

	if (!sheep) {
		return {
			active: false,
			main: _('Disabled'),
			sub: cronText
		};
	}

	var pad = function(v) { return (String(v).length < 2 ? '0' : '') + v + ':00'; };
	return {
		active: true,
		main: pad(start) + ' - ' + pad(end),
		sub: cronText
	};
}

return view.extend({
	load: function() {
		return Promise.all([
			callHostHints(),
			uci.load('watchtower'),
			common.getServiceStatus(),
			common.readFile('/tmp/watchtower/ipAddress')
		]);
	},

	render: function(data) {
		var canWrite = !L.hasViewPermission || L.hasViewPermission();
		var hosts = data[0] || {};
		var latestRunning = !!data[2];
		var latestContent = data[3] || '';
		var filterText = '';

		var pageBadge = E('span', { 'id': 'pb_service_badge', 'class': 'pb-dot pb-dot-muted' });
		var statusPanelNode = E('div', { 'id': 'pb_status_panel', 'class': 'pb-panel' });
		var feedbackText = '';
		var feedbackType = 'info';
		var feedbackTimer = null;
		var missingCredErr = false;
		var shakeNote = false;
		var actionInProgress = false;
		var countPill = E('span', { 'class': 'pb-count-pill' }, '0');
		var tableEl = E('table', { 'class': 'table', 'id': 'watchtower_clients_table' });

		function setFeedback(msg, type) {
			feedbackText = msg || '';
			feedbackType = type || 'info';
			if (feedbackTimer) {
				window.clearTimeout(feedbackTimer);
				feedbackTimer = null;
			}
			if (feedbackText) {
				feedbackTimer = window.setTimeout(function() {
					feedbackText = '';
					if (document.getElementById('pb_status_panel')) {
						renderStatusPanel(latestRunning, latestContent);
					}
				}, 4500);
			}
		}

		var searchInput = E('input', {
			'type': 'text',
			'placeholder': _('Filter by name, MAC, IP, interface...'),
			'input': function(ev) {
				filterText = (ev.target.value || '').trim().toLowerCase();
				renderClientsTable(latestContent);
			}
		});

		var refreshBtn = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-action',
			'click': function(ev) {
				var btn = ev.currentTarget;
				var orig = btn.textContent;
				btn.disabled = true;
				btn.textContent = _('Refreshing...');
				Promise.all([
					common.getServiceStatus(),
					common.readFile('/tmp/watchtower/ipAddress'),
					uci.load('watchtower')
				]).then(function(res) {
					latestRunning = !!res[0];
					latestContent = res[1] || '';
					renderAll(latestRunning, latestContent);
				}).finally(function() {
					btn.disabled = false;
					btn.textContent = orig;
				});
			}
		}, _('Refresh List'));

		function renderStatusPanel(isRunning, ipAddrContent) {
			var enabled = uci.get('watchtower', 'watchtower', 'watchtower_enable') === '1';
			var sleeptime = uci.get('watchtower', 'watchtower', 'sleeptime') || '60';
			var channel = getChannelSummary();
			var dnd = getDndSummary();
			var clients = common.parseClients(ipAddrContent, hosts);

			var ifaces = {};
			for (var i = 0; i < clients.length; i++) {
				if (clients[i].iface) ifaces[clients[i].iface] = true;
			}
			var ifaceList = Object.keys(ifaces);

			pageBadge.className = 'pb-dot ' + (isRunning ? 'pb-dot-ok' : 'pb-dot-err');
			pageBadge.textContent = isRunning ? _('Running') : _('Stopped');

			function formatErr(err) {
				return String((err && err.message) || err || '')
					.split('\n')[0]
					.replace(/\s+handleCallReply@.*$/, '')
					.trim();
			}

			var toggleBtn = E('button', {
				'type': 'button',
				'class': 'cbi-button ' + (isRunning ? 'cbi-button-negative' : 'cbi-button-positive'),
				'disabled': !canWrite ? 'disabled' : null,
				'click': function(ev) {
					var btn = ev.currentTarget;
					var action = isRunning ? 'stop' : 'start';
					var nextEnable = isRunning ? '0' : '1';
					if (action === 'start' && !channel.configured) {
						feedbackText = '';
						missingCredErr = true;
						shakeNote = true;
						renderStatusPanel(latestRunning, latestContent);
						return;
					}
					actionInProgress = true;
					btn.disabled = true;
					btn.textContent = isRunning ? _('Stopping...') : _('Starting...');
					Promise.resolve().then(function() {
						if (uci.get('watchtower', 'watchtower', 'watchtower_enable') !== nextEnable) {
							uci.set('watchtower', 'watchtower', 'watchtower_enable', nextEnable);
							return uci.save().then(function() {
								return uci.apply().catch(function(err) {
									if (!err || !/ubus code 5|No data received/i.test(err.message || ''))
										throw err;
								});
							});
						}
					}).then(function() {
						return fs.exec('/etc/init.d/watchtower', [action]);
					}).then(function() {
						if (action === 'start') {
							return new Promise(function(resolve) {
								window.setTimeout(resolve, 900);
							}).then(function() {
								return common.getServiceStatus();
							}).then(function(firstCheck) {
								if (!firstCheck)
									return false;
								return new Promise(function(resolve) {
									window.setTimeout(resolve, 700);
								}).then(function() {
									return common.getServiceStatus();
								});
							});
						}
						return new Promise(function(resolve) {
							window.setTimeout(resolve, 450);
						}).then(function() {
							return common.getServiceStatus();
						});
					}).then(function(runningCheck) {
						return uci.load('watchtower').then(function() {
							return runningCheck;
						});
					}).then(function(runningCheck) {
						var running = !!runningCheck;
						actionInProgress = false;
						latestRunning = running;
						if (action === 'start' && !running) {
							shakeNote = true;
							setFeedback(_('Service failed to stay running. Please check Settings or Runtime Log.'), 'err');
						} else {
							setFeedback(running ? _('Watchtower service started.') : _('Watchtower service stopped.'), 'info');
						}
						renderAll(latestRunning, latestContent);
					}).catch(function(err) {
						actionInProgress = false;
						shakeNote = true;
						setFeedback(_('Service action failed: ') + formatErr(err), 'err');
						renderStatusPanel(latestRunning, latestContent);
					});
				}
			}, isRunning ? _('Stop Service') : _('Start Service'));

			var restartBtn = E('button', {
				'type': 'button',
				'class': 'cbi-button cbi-button-neutral',
				'style': isRunning ? '' : 'display:none;',
				'disabled': !canWrite ? 'disabled' : null,
				'click': function(ev) {
					var btn = ev.currentTarget;
					btn.disabled = true;
					btn.textContent = _('Restarting...');
					fs.exec('/etc/init.d/watchtower', ['restart']).then(function() {
						return new Promise(function(resolve) {
							window.setTimeout(resolve, 350);
						});
					}).then(function() {
						return common.getServiceStatus();
					}).then(function(running) {
						latestRunning = running;
						setFeedback(running ? _('Watchtower service restarted.') : _('Service failed to stay running. Please check Settings or Runtime Log.'), running ? 'info' : 'err');
						renderAll(latestRunning, latestContent);
					}).catch(function(err) {
						setFeedback(_('Failed to restart service: ') + formatErr(err), 'err');
						renderStatusPanel(latestRunning, latestContent);
					});
				}
			}, _('Restart'));

			var testBtn = E('button', {
				'type': 'button',
				'class': 'cbi-button cbi-button-action',
				'disabled': (!canWrite || !channel.configured) ? 'disabled' : null,
				'click': function(ev) {
					var btn = ev.currentTarget;
					var orig = btn.textContent;
					btn.disabled = true;
					btn.textContent = _('Sending...');
					fs.exec('/usr/bin/watchtower/watchtower', ['test']).then(function() {
						setFeedback(_('Test message triggered. Check log or client for details.'), 'info');
						renderStatusPanel(latestRunning, latestContent);
					}).catch(function(err) {
						setFeedback(_('Failed to trigger test: ') + formatErr(err), 'err');
						renderStatusPanel(latestRunning, latestContent);
					}).finally(function() {
						btn.textContent = orig;
						btn.disabled = false;
					});
				}
			}, _('Send Test'));

			var runningStatusLabel = _('Running Status');
			if (runningStatusLabel === 'Running Status' && /^(zh|zh-cn|zh_cn|zh-hans)/i.test((L.env && L.env.lang) || document.documentElement.lang || ''))
				runningStatusLabel = '运行状态';

			var cards = E('div', { 'class': 'pb-summary-grid pb-grid-3' }, [
				E('div', { 'class': 'pb-card ' + (isRunning ? 'pb-card-ok' : 'pb-card-err') }, [
					E('div', { 'class': 'pb-card-head' }, [
						E('span', { 'class': 'pb-card-title' }, runningStatusLabel),
						E('span', { 'class': 'pb-dot ' + (isRunning ? 'pb-dot-ok' : 'pb-dot-err') }, isRunning ? _('Running') : _('Stopped'))
					]),
					E('div', { 'class': 'pb-card-body' }, [
						E('div', { 'class': 'pb-card-main' }, isRunning ? _('Active') : _('Inactive')),
						E('div', { 'class': 'pb-card-sub' }, _('Interval: %ss').format(sleeptime))
					])
				]),
				E('div', { 'class': 'pb-card ' + (channel.configured ? 'pb-card-info' : 'pb-card-warn') }, [
					E('div', { 'class': 'pb-card-head' }, [
						E('span', { 'class': 'pb-card-title' }, _('Push Channel')),
						E('span', { 'class': 'pb-dot ' + (channel.configured ? 'pb-dot-info' : 'pb-dot-warn') }, channel.configured ? _('Configured') : _('Incomplete'))
					]),
					E('div', { 'class': 'pb-card-body' }, [
						E('div', { 'class': 'pb-card-main' }, channel.label),
						E('div', { 'class': 'pb-card-sub' }, [
							E('a', { 'href': L.url('admin/services/watchtower/setting') }, _('Configure →'))
						])
					])
				]),
				E('div', { 'class': 'pb-card ' + (dnd.active ? 'pb-card-warn' : 'pb-card-muted') }, [
					E('div', { 'class': 'pb-card-head' }, [
						E('span', { 'class': 'pb-card-title' }, _('DND & Schedule')),
						E('span', { 'class': 'pb-dot ' + (dnd.active ? 'pb-dot-warn' : 'pb-dot-muted') }, dnd.active ? _('DND On') : _('Normal'))
					]),
					E('div', { 'class': 'pb-card-body' }, [
						E('div', { 'class': 'pb-card-main' }, dnd.main),
						E('div', { 'class': 'pb-card-sub' }, dnd.sub)
					])
				])
			]);

			if (channel.configured)
				missingCredErr = false;

			var feedbackEl = feedbackText
				? E('div', { 'class': 'pb-note ' + (feedbackType === 'err' ? 'pb-note-err' + (shakeNote ? ' pb-note-shake' : '') : (feedbackType === 'info' ? 'pb-note-info' : '')) }, feedbackText)
				: null;

			var noteEl = (!feedbackEl && !channel.configured)
				? E('div', { 'class': 'pb-note' + (missingCredErr ? ' pb-note-err' : '') + (shakeNote ? ' pb-note-shake' : '') }, _('Selected push channel is missing credentials. Please complete the configuration in Settings.'))
				: null;

			var shouldShake = shakeNote;
			shakeNote = false;

			dom.content(statusPanelNode, [
				E('div', { 'class': 'pb-header-bar' }, [
					E('div', { 'class': 'pb-header-title' }, [
						E('h3', {}, _('Service Status'))
					]),
					E('div', { 'class': 'pb-toolbar' }, [ toggleBtn, restartBtn, testBtn ])
				]),
				cards,
				feedbackEl,
				noteEl
			].filter(Boolean));

			if (shouldShake) {
				var shakeTarget = statusPanelNode.querySelector('.pb-note-shake');
				if (shakeTarget) {
					shakeTarget.classList.remove('pb-note-shake');
					void shakeTarget.offsetWidth;
					shakeTarget.classList.add('pb-note-shake');
				}
			}
		}

		function renderClientsTable(content) {
			var allClients = common.parseClients(content, hosts);
			var filtered = allClients.filter(function(c) {
				if (!filterText) return true;
				return (c.name.toLowerCase().indexOf(filterText) !== -1 ||
					c.mac.toLowerCase().indexOf(filterText) !== -1 ||
					c.ip.toLowerCase().indexOf(filterText) !== -1 ||
					c.iface.toLowerCase().indexOf(filterText) !== -1);
			});

			countPill.textContent = filterText
				? (filtered.length + ' / ' + allClients.length)
				: String(allClients.length);

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

			if (filtered.length === 0) {
				rows.push(E('tr', { 'class': 'tr placeholder' }, [
					E('td', { 'class': 'td pb-muted', 'colspan': 6 },
						filterText
							? _('No matching devices found.')
							: _('No online devices detected currently or Watchtower service is not running.'))
				]));
			} else {
				for (var j = 0; j < filtered.length; j++) {
					var c = filtered[j];
					rows.push(E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'data-title': _('Hostname') }, [ E('strong', {}, c.name) ]),
						E('td', { 'class': 'td pb-nowrap', 'data-title': _('MAC Address') }, [ E('code', {}, c.mac) ]),
						E('td', { 'class': 'td pb-nowrap', 'data-title': _('IP Address') }, c.ip || _('Not detected')),
						E('td', { 'class': 'td pb-nowrap' + (c.iface ? '' : ' pb-muted'), 'data-title': _('Interface') }, c.iface || _('Not detected')),
						E('td', { 'class': 'td pb-nowrap' + (c.duration ? '' : ' pb-muted'), 'data-title': _('Online Time') }, c.duration || _('Not detected')),
						E('td', { 'class': 'td pb-nowrap', 'data-title': _('Status') }, [
							E('span', { 'class': 'pb-tag pb-tag-ok' }, _('Online'))
						])
					]));
				}
			}

			dom.content(tableEl, rows);
		}

		function renderAll(isRunning, content) {
			renderStatusPanel(isRunning, content);
			renderClientsTable(content);
		}

		renderAll(latestRunning, latestContent);

		poll.add(function() {
			if (!document.getElementById('pb_status_panel') || actionInProgress) return;
			return Promise.all([
				common.getServiceStatus(),
				common.readFile('/tmp/watchtower/ipAddress'),
				uci.load('watchtower')
			]).then(function(res) {
				if (actionInProgress) return;
				latestRunning = !!res[0];
				latestContent = res[1] || '';
				if (document.getElementById('pb_status_panel')) {
					renderAll(latestRunning, latestContent);
				}
			});
		}, 5);

		return E('div', { 'class': 'cbi-map' }, [
			common.injectStyles(),
			E('h2', { 'class': 'pb-page-title', 'name': 'content' }, [
				_('Watchtower'),
				pageBadge
			]),
			E('div', { 'class': 'cbi-map-descr' }, _('Watchtower pushes router alerts, device status, and logs to your preferred notification channels.')),
			statusPanelNode,
			E('div', { 'class': 'pb-tables-box' }, [
				E('div', { 'class': 'pb-header-bar' }, [
					E('div', { 'class': 'pb-panel-head', 'style': 'margin-bottom: 0 !important;' }, [
						E('span', {}, _('Online Devices')),
						countPill
					]),
					E('div', { 'class': 'pb-toolbar' }, [ searchInput, refreshBtn ])
				]),
				E('div', { 'class': 'pb-panel-body' }, [ tableEl ])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
