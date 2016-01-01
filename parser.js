﻿/**
 * This is the file where commands get parsed
 *
 * Some parts of this code are taken from the Pokémon Showdown server code, so
 * credits also go to Guangcong Luo and other Pokémon Showdown contributors.
 * https://github.com/Zarel/Pokemon-Showdown
 *
 * @license MIT license
 */

var sys = require('sys');
var https = require('https');
var url = require('url');

exports.parse = {
	actionUrl: url.parse('https://play.pokemonshowdown.com/~~' + config.serverid + '/action.php'),
	room: 'lobby',

	data: function(data, connection) {
		if (data.substr(0, 1) === 'a') {
			this.room = 'lobby';

			data = JSON.parse(data.substr(1));
			if (data instanceof Array) {
				for (var i = 0; i < data.length; i++) {
					this.message(data[i], connection);
				}
			} else {
				this.message(data, connection);
			}
		}
	},
	message: function(message, connection) {
		if (!message) return;

		if (message.indexOf('\n') > -1) {
			var spl = message.split('\n');
			for (var i = 0; i < spl.length; i++) {
				this.message(spl[i], connection);
			}
		}

		var spl = message.split('|');
		if (!spl[1]) {
			spl = message.split('>');
			if (!spl[1])
				return;
			this.channel = spl[1];
		}

		switch (spl[1]) {
			case 'challstr':
				info('received challstr, logging in...');
				var id = spl[2];
				var str = spl[3];

				var requestOptions = {
					hostname: this.actionUrl.hostname,
					port: this.actionUrl.port,
					path: this.actionUrl.pathname,
					agent: false
				};

				if (!config.pass) {
					requestOptions.method = 'GET';
					requestOptions.path += '?act=getassertion&userid=' + toId(config.nick) + '&challengekeyid=' + id + '&challenge=' + str;
				} else {
					requestOptions.method = 'POST';
					var data = 'act=login&name=' + config.nick + '&pass=' + config.pass + '&challengekeyid=' + id + '&challenge=' + str;
				}

				var req = https.request(requestOptions, function(res) {
					res.setEncoding('utf8');
					res.on('data', function(chunk) {
						if (chunk === ';') {
							error('failed to log in; nick is registered - invalid or no password given');
							process.exit(-1);
						}
						if (chunk.length < 50) {
							error('failed to log in: ' + chunk);
							process.exit(-1);
						}
						send(connection, '|/trn ' + config.nick + ',0,' + chunk);
					});
				});
				
				req.on('error', function(err) {
					error('login error: ' + sys.inspect(err));
				});
				
				if (data) {
					req.write(data);
				}
				req.end();
				break;
			case 'updateuser':
				if (spl[2] !== config.nick) {
					return;
				}

				if (spl[3] !== '1') {
					error('failed to log in, still guest');
					process.exit(-1);
				}

				ok('logged in as ' + spl[2]);

				// Now join the rooms
				var cmds = [];
				for (var i in config.rooms) {
					var room = config.rooms[i].toLowerCase();
					if (room === 'lobby' && config.serverid === 'showdown') {
						continue;
					}
					cmds.push('|/join ' + room);
				}
				send(connection, cmds);
				break;
			case 'title':
				ok('joined ' + spl[2]);
				break;
			case 'c':
				var by = spl[2];
				spl.splice(0, 3);
				this.chatMessage(spl.join('|'), by, this.room, connection);
				break;
			case 'pm':
				var by = spl[2].substr(1);
				if (by.substr(1) === config.nick) return;
				spl.splice(0, 4);
				this.chatMessage(spl.join('|'), by, ',' + by, connection);
				break;
		}
	},
	chatMessage: function(message, by, room, connection) {
		message = message.trim();
		if (message.substr(0, config.commandcharacter.length) !== config.commandcharacter) {
			return;
		}

		message = message.substr(config.commandcharacter.length);
		var index = message.indexOf(' ');
		var arg = '';
		if (index > -1) {
			var cmd = message.substr(0, index);
			arg = message.substr(index + 1);
		} else {
			var cmd = message;
		}

		if (Commands[cmd]) {
			var failsafe = 0;
			while (typeof Commands[cmd] !== "function" && failsafe++ < 10) {
				cmd = Commands[cmd];
			}
			if (typeof Commands[cmd] === "function") {
				Commands[cmd].call(this, arg, by, room, connection);
			} else {
				error("invalid command type for " + cmd + ": " + (typeof Commands[cmd]));
			}
		}
	},
	say: function(connection, room, text) {
		if (room.substr(0, 1) !== ',') {
			var str = (room !== 'lobby' ? room : '') + '|' + text;
			send(connection, str);
		} else {
			room = room.substr(1);
			var str = '|/pm ' + room + ', ' + text;
			send(connection, str);
		}
	},
	hasRank: function(user, rank) {
		var ranks = rank.split('');
		for (var i = 0; i < ranks.length; i++) {
			if (ranks[i] === user.substr(0, 1)) return true;
		}

		return false;
	},
	uncacheTree: function(root) {
		var uncache = [require.resolve(root)];
		do {
			var newuncache = [];
			for (var i = 0; i < uncache.length; ++i) {
				if (require.cache[uncache[i]]) {
					newuncache.push.apply(newuncache,
						require.cache[uncache[i]].children.map(function(module) {
							return module.filename;
						})
					);
					delete require.cache[uncache[i]];
				}
			}
			uncache = newuncache;
		} while (uncache.length > 0);
	}
};