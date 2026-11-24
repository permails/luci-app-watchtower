// Author: permails <logo@permails.com>
'use strict';
'require fs';
'require poll';
'require ui';
'require view';
'require watchtower.common as common';

return view.extend({
	load: function () {
		return common.readFile('/tmp/watchtower/watchtower.log');
	},

	render: function (logdata) {
		var canWrite = !L.hasViewPermission || L.hasViewPermission();
		var rawLog = logdata || '';
		var filterText = '';

		var countPill = E('span', { 'class': 'pb-count-pill' }, '0');
		var logTextarea = E('textarea', {
			'id': 'watchtower_log_textarea',
			'class': 'pb-log-textarea',
			'wrap': 'off',
			'readonly': 'readonly'
		});

		var autoRefreshCheckbox = E('input', {
			'type': 'checkbox',
			'id': 'watchtower_auto_refresh',
			'checked': 'checked'
		});

		var filterInput = E('input', {
			'type': 'text',
			'placeholder': _('Filter log lines...'),
			'input': function (ev) {
				filterText = (ev.target.value || '').trim().toLowerCase();
				renderLog(false);
			}
		});

		function isNearBottom() {
			return (logTextarea.scrollHeight - logTextarea.scrollTop - logTextarea.clientHeight) < 24;
		}

		function scrollBottom() {
			logTextarea.scrollTop = logTextarea.scrollHeight;
		}

		function renderLog(forceScroll) {
			var wasAtBottom = forceScroll || isNearBottom();
			var lines = rawLog ? rawLog.replace(/\r\n/g, '\n').split('\n') : [];
			if (lines.length && lines[lines.length - 1] === '') {
				lines.pop();
			}

			var matched = filterText
				? lines.filter(function (line) { return line.toLowerCase().indexOf(filterText) !== -1; })
				: lines;

			countPill.textContent = filterText
				? (matched.length + ' / ' + lines.length)
				: String(lines.length);

			if (!rawLog) {
				logTextarea.value = _('Log is empty.');
			} else if (matched.length === 0) {
				logTextarea.value = _('No matching log entries.');
			} else {
				logTextarea.value = matched.join('\n');
			}

			if (wasAtBottom) {
				scrollBottom();
			}
		}

		var refreshBtn = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-action',
			'click': function (ev) {
				var btn = ev.currentTarget;
				var orig = btn.textContent;
				btn.disabled = true;
				btn.textContent = _('Refreshing...');
				common.readFile('/tmp/watchtower/watchtower.log').then(function (content) {
					rawLog = content || '';
					renderLog(false);
				}).finally(function () {
					btn.disabled = false;
					btn.textContent = orig;
				});
			}
		}, _('Refresh'));

		var clearBtn = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-negative',
			'disabled': !canWrite ? 'disabled' : null,
			'click': function (ev) {
				var btn = ev.currentTarget;
				var orig = btn.textContent;
				btn.disabled = true;
				btn.textContent = _('Clearing...');
				fs.write('/tmp/watchtower/watchtower.log', '').then(function () {
					rawLog = '';
					renderLog(true);
				}).finally(function () {
					btn.disabled = false;
					btn.textContent = orig;
				});
			}
		}, _('Clear Log'));

		var topBtn = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-neutral',
			'click': function () {
				logTextarea.scrollTop = 0;
			}
		}, _('Top'));

		var bottomBtn = E('button', {
			'type': 'button',
			'class': 'cbi-button cbi-button-neutral',
			'click': scrollBottom
		}, _('Bottom'));

		renderLog(true);
		window.setTimeout(scrollBottom, 80);

		poll.add(function () {
			if (autoRefreshCheckbox.checked && document.getElementById('watchtower_log_textarea')) {
				return common.readFile('/tmp/watchtower/watchtower.log').then(function (content) {
					rawLog = content || '';
					renderLog(false);
				});
			}
		}, 5);

		return E('div', { 'class': 'cbi-map' }, [
			common.injectStyles(),
			E('h2', { 'class': 'pb-page-title', 'name': 'content' }, _('Watchtower Log')),
			E('div', { 'class': 'cbi-map-descr' }, _('Displays real-time logs and status records produced by Watchtower.')),
			E('div', { 'class': 'pb-panel' }, [
				E('div', { 'class': 'pb-log-card' }, [
					E('div', { 'class': 'pb-log-head' }, [
						E('div', { 'class': 'pb-header-title' }, [
							E('h3', {}, _('Runtime Log')),
							countPill
						]),
						E('div', { 'class': 'pb-toolbar' }, [
							filterInput,
							E('label', { 'class': 'pb-log-check', 'for': 'watchtower_auto_refresh' }, [
								autoRefreshCheckbox,
								_('Auto Refresh')
							]),
							topBtn,
							bottomBtn,
							refreshBtn,
							clearBtn
						])
					]),
					E('div', { 'class': 'pb-log-body' }, [logTextarea])
				])
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
