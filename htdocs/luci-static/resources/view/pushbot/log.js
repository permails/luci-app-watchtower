'use strict';
'require dom';
'require fs';
'require poll';
'require ui';
'require view';

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
		return readFile('/tmp/pushbot/pushbot.log');
	},

	render: function(logdata) {
		var logTextarea = E('textarea', {
			'id': 'pushbot_log_textarea',
			'class': 'cbi-input-textarea',
			'style': 'width: 100%; margin-top: 10px; font-family: monospace; font-size: 12px; white-space: pre; resize: vertical;',
			'rows': 28,
			'wrap': 'off',
			'readonly': 'readonly'
		}, [ logdata || _('No log data available.') ]);

		var autoRefreshCheckbox = E('input', {
			'type': 'checkbox',
			'id': 'pushbot_auto_refresh',
			'style': 'vertical-align: middle; margin-right: 5px;',
			'checked': 'checked'
		});

		function scrollBottom() {
			logTextarea.scrollTop = logTextarea.scrollHeight;
		}

		function updateLog() {
			return readFile('/tmp/pushbot/pushbot.log').then(function(content) {
				logTextarea.value = content || _('Log is empty.');
				scrollBottom();
			}).catch(function() {
				logTextarea.value = _('Failed to read log file.');
			});
		}

		poll.add(function() {
			if (autoRefreshCheckbox.checked) {
				return readFile('/tmp/pushbot/pushbot.log').then(function(content) {
					logTextarea.value = content || _('Log is empty.');
					scrollBottom();
				}).catch(function() {
					logTextarea.value = _('Log is empty.');
				});
			}
		}, 2);

		window.setTimeout(scrollBottom, 100);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', { 'name': 'content' }, _('PushBot Log')),
			E('div', { 'class': 'cbi-map-descr' }, _('Displays real-time logs and status records produced by PushBot.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'style': 'display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;' }, [
					E('label', { 'style': 'cursor: pointer; user-select: none;' }, [
						autoRefreshCheckbox,
						_('Auto Refresh')
					]),
					E('div', {}, [
						E('button', {
							'class': 'cbi-button cbi-button-action',
							'style': 'margin-right: 8px;',
							'click': function() {
								return updateLog().then(function() {
									ui.addNotification(null, E('p', {}, _('Log refreshed.')), 'info');
								});
							}
						}, _('Refresh')),
						E('button', {
							'class': 'cbi-button cbi-button-remove',
							'click': function() {
								return fs.write('/tmp/pushbot/pushbot.log', '').then(function() {
									logTextarea.value = '';
									ui.addNotification(null, E('p', {}, _('Log cleared successfully.')), 'info');
								}).catch(function(err) {
									ui.addNotification(null, E('p', {}, _('Failed to clear log: ') + err.message), 'error');
								});
							}
						}, _('Clear Log'))
					])
				]),
				logTextarea
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
