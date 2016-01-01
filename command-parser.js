/**
 * Command parser
 * Pokemon Showdown - http://pokemonshowdown.com/
 *
 * This is the command parser. Call it with CommandParser.parse
 * (scroll down to its definition for details)
 *
 * Individual commands are put in:
 *   commands.js - "core" commands that shouldn't be modified
 *   chat-plugins/ - other commands that can be safely modified
 *
 * The command API is (mostly) documented in chat-plugins/COMMANDS.md
 *
 * @license MIT license
 */

/*

To reload chat commands:

/hotpatch chat

*/

'use strict';

const MAX_MESSAGE_LENGTH = 300;

const BROADCAST_COOLDOWN = 20 * 1000;

const MESSAGE_COOLDOWN = 5 * 60 * 1000;

const MAX_PARSE_RECURSION = 10;

const VALID_COMMAND_TOKENS = '/!';

const BROADCAST_TOKEN = '!';

const fs = require('fs');
const path = require('path');

/*********************************************************
 * Load command files
 *********************************************************/

let baseCommands = exports.baseCommands = require('./commands.js').commands;
let commands = exports.commands = Object.clone(baseCommands);

// Install plug-in commands

// info always goes first so other plugins can shadow it
Object.merge(commands, require('./chat-plugins/info.js').commands);

fs.readdirSync(path.resolve(__dirname, 'chat-plugins')).forEach(function (file) {
	if (file.substr(-3) !== '.js' || file === 'info.js') return;
	Object.merge(commands, require('./chat-plugins/' + file).commands);
});

/*********************************************************
 * Modlog
 *********************************************************/

let modlog = exports.modlog = {
	lobby: fs.createWriteStream(path.resolve(__dirname, 'logs/modlog/modlog_lobby.txt'), {flags:'a+'}),
	battle: fs.createWriteStream(path.resolve(__dirname, 'logs/modlog/modlog_battle.txt'), {flags:'a+'})
};

let writeModlog = exports.writeModlog = function (roomid, text) {
	if (!modlog[roomid]) {
		modlog[roomid] = fs.createWriteStream(path.resolve(__dirname, 'logs/modlog/modlog_' + roomid + '.txt'), {flags:'a+'});
	}
	modlog[roomid].write('[' + (new Date().toJSON()) + '] ' + text + '\n');
};

/*********************************************************
 * Parser
 *********************************************************/

/**
 * Can this user talk?
 * Shows an error message if not.
 */
function canTalk(user, room, connection, message, targetUser) {
	if (!user.named) {
		connection.popup("You must choose a name before you can talk.");
		return false;
	}
	if (!user.can('bypassall')) {
		if (room && user.locked) {
			this.errorReply("You are locked from talking in chat.");
			return false;
		}
		if (room && room.isMuted(user)) {
			this.errorReply("You are muted and cannot talk in this room.");
			return false;
		}
		let roomType = room && room.auth ? room.type + 'Room' : 'global';
		if (room && room.modchat) {
			let userGroup = user.group;
			if (room.auth) {
				if (room.auth[user.userid]) {
					userGroup = room.auth[user.userid];
				} else if (room.isPrivate === true) {
					userGroup = Config.groups.default[roomType];
				}
			}
			if (room.modchat === 'autoconfirmed') {
				if (!user.autoconfirmed && userGroup === Config.groups.default[roomType]) {
					this.errorReply("Because moderated chat is set, your account must be at least one week old and you must have won at least one ladder game to speak in this room.");
					return false;
				}
			} else if (Config.groups.bySymbol[userGroup].rank < Config.groups.bySymbol[room.modchat].rank && !user.can('makeroom')) {
				let groupName = Config.groups[room.modchat].name || room.modchat;
				this.errorReply("Because moderated chat is set, you must be of rank " + groupName + " or higher to speak in this room.");
				return false;
			}
		}
		if (room && !(user.userid in room.users)) {
			connection.popup("You can't send a message to this room without being in it.");
			return false;
		}
	}

	if (typeof message === 'string') {
		if (!message) {
			connection.popup("Your message can't be blank.");
			return false;
		}
		if (message.length > MAX_MESSAGE_LENGTH && !user.can('ignorelimits')) {
			this.errorReply("Your message is too long: " + message);
			return false;
		}

		// remove zalgo
		message = message.replace(/[\u0300-\u036f\u0483-\u0489\u064b-\u065f\u0670\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{3,}/g, '');

		if (room && room.id === 'lobby') {
			let normalized = message.trim();
			if ((normalized === user.lastMessage) &&
					((Date.now() - user.lastMessageTime) < MESSAGE_COOLDOWN)) {
				this.errorReply("You can't send the same message again so soon.");
				return false;
			}
			user.lastMessage = message;
			user.lastMessageTime = Date.now();
		}

		if (Config.chatFilter) {
			/*jshint validthis:true */
			return Config.chatFilter.call(this, message, user, room, connection, targetUser);
		}
		return message;
	}

	return true;
}

let Context = exports.Context = (function () {
	function Context(options) {
		this.cmd = options.cmd || '';
		this.cmdToken = options.cmdToken || '';

		this.target = options.target || '';
		this.message = options.message || '';

		this.levelsDeep = options.levelsDeep || 0;
		this.namespaces = options.namespaces || null;

		this.room = options.room || null;
		this.user = options.user || null;
		this.connection = options.connection || null;

		this.targetUserName = '';
		this.targetUser = null;
	}

	Context.prototype.sendReply = function (data) {
		if (this.broadcasting) {
			this.room.add(data);
		} else {
			this.connection.sendTo(this.room, data);
		}
	};
	Context.prototype.errorReply = function (message) {
		if (this.pmTarget) {
			this.connection.send('|pm|' + this.user.getIdentity() + '|' + (this.pmTarget.getIdentity ? this.pmTarget.getIdentity() : ' ' + this.pmTarget) + '|/error ' + message);
		} else {
			this.sendReply('|html|<div class="message-error">' + Tools.escapeHTML(message) + '</div>');
		}
	};
	Context.prototype.sendReplyBox = function (html) {
		this.sendReply('|raw|<div class="infobox">' + html + '</div>');
	};
	Context.prototype.popupReply = function (message) {
		this.connection.popup(message);
	};
	Context.prototype.add = function (data) {
		this.room.add(data);
	};
	Context.prototype.send = function (data) {
		this.room.send(data);
	};
	Context.prototype.privateModCommand = function (data, noLog) {
		this.sendModCommand(data);
		this.logEntry(data);
		this.logModCommand(data);
	};
	Context.prototype.sendModCommand = function (data) {
		let users = this.room.users;

		for (let i in users) {
			let user = users[i];
			if (user.can('staff') || user.can('staff', this.room)) {
				user.sendTo(this.room, data);
			}
		}
	};
	Context.prototype.logEntry = function (data) {
		this.room.logEntry(data);
	};
	Context.prototype.addModCommand = function (text, logOnlyText) {
		this.add(text);
		this.logModCommand(text + (logOnlyText || ""));
	};
	Context.prototype.logModCommand = function (text) {
		let roomid = (this.room.battle ? 'battle' : this.room.id);
		if (this.room.isPersonal) roomid = 'groupchat';
		writeModlog(roomid, '(' + this.room.id + ') ' + text);
	};
	Context.prototype.globalModlog = function (action, user, text) {
		let buf = "(" + this.room.id + ") " + action + ": ";
		if (typeof user === 'string') {
			buf += "[" + toId(user) + "]";
		} else {
			let userid = this.getLastIdOf(user);
			buf += "[" + userid + "]";
			if (user.autoconfirmed && user.autoconfirmed !== userid) buf += " ac:[" + user.autoconfirmed + "]";
		}
		buf += text;
		writeModlog('global', buf);
	};
	Context.prototype.can = function (permission, target, room) {
		if (!this.user.can(permission, target, room)) {
			this.errorReply(this.cmdToken + this.namespaces.concat(this.cmd).join(" ") + " - Access denied.");
			return false;
		}
		return true;
	};
	Context.prototype.canBroadcast = function (suppressMessage) {
		if (!this.broadcasting && this.cmdToken === BROADCAST_TOKEN) {
			let message = this.canTalk(this.message);
			if (!message) return false;
			if (!this.user.can('broadcast', this.room)) {
				this.errorReply("You need to be voiced to broadcast this command's information.");
				this.errorReply("To see it for yourself, use: /" + message.substr(1));
				return false;
			}

			// broadcast cooldown
			let normalized = message.toLowerCase().replace(/[^a-z0-9\s!,]/g, '');
			if (this.room.lastBroadcast === normalized &&
					this.room.lastBroadcastTime >= Date.now() - BROADCAST_COOLDOWN) {
				this.errorReply("You can't broadcast this because it was just broadcast.");
				return false;
			}
			this.add('|c|' + this.user.getIdentity(this.room.id) + '|' + (suppressMessage || message));
			this.room.lastBroadcast = normalized;
			this.room.lastBroadcastTime = Date.now();

			this.broadcasting = true;
		}
		return true;
	};
	Context.prototype.parse = function (message, inNamespace, room) {
		if (inNamespace && this.cmdToken) {
			message = this.cmdToken + this.namespaces.concat(message.slice(1)).join(" ");
		}
		return CommandParser.parse(message, room || this.room, this.user, this.connection, this.levelsDeep + 1);
	};
	Context.prototype.run = function (targetCmd, inNamespace) {
		let commandHandler;
		if (typeof targetCmd === 'function') {
			commandHandler = targetCmd;
		} else if (inNamespace) {
			commandHandler = commands;
			for (let i = 0; i < this.namespaces.length; i++) {
				commandHandler = commandHandler[this.namespaces[i]];
			}
			commandHandler = commandHandler[targetCmd];
		} else {
			commandHandler = commands[targetCmd];
		}

		let result;
		try {
			result = commandHandler.call(this, this.target, this.room, this.user, this.connection, this.cmd, this.message);
		} catch (err) {
			let stack = err.stack + '\n\n' +
					'Additional information:\n' +
					'user = ' + this.user.name + '\n' +
					'room = ' + this.room.id + '\n' +
					'message = ' + this.message;
			let fakeErr = {stack: stack};

			if (!require('./crashlogger.js')(fakeErr, 'A chat command')) {
				let ministack = ("" + err.stack).escapeHTML().split("\n").slice(0, 2).join("<br />");
				if (Rooms.lobby) Rooms.lobby.send('|html|<div class="broadcast-red"><b>POKEMON SHOWDOWN HAS CRASHED:</b> ' + ministack + '</div>');
			} else {
				this.sendReply('|html|<div class="broadcast-red"><b>Pokemon Showdown crashed!</b><br />Don\'t worry, we\'re working on fixing it.</div>');
			}
		}
		if (result === undefined) result = false;

		return result;
	};
	Context.prototype.canTalk = function (message, relevantRoom, targetUser) {
		let innerRoom = (relevantRoom !== undefined) ? relevantRoom : this.room;
		return canTalk.call(this, this.user, innerRoom, this.connection, message, targetUser);
	};
	Context.prototype.canEmbedURI = function (uri, isRelative) {
		if (uri.startsWith('https://')) return uri;
		if (uri.startsWith('//')) return uri;
		if (uri.startsWith('data:')) return uri;
		if (!uri.startsWith('http://')) {
			if (/^[a-z]+\:\/\//.test(uri) || isRelative) {
				return this.errorReply("URIs must begin with 'https://' or 'http://' or 'data:'");
			}
		} else {
			uri = uri.slice(7);
		}
		let slashIndex = uri.indexOf('/');
		let domain = (slashIndex >= 0 ? uri.slice(0, slashIndex) : uri);

		// heuristic that works for all the domains we care about
		let secondLastDotIndex = domain.lastIndexOf('.', domain.length - 5);
		if (secondLastDotIndex >= 0) domain = domain.slice(secondLastDotIndex + 1);

		let approvedDomains = {
			'imgur.com': 1,
			'gyazo.com': 1,
			'puu.sh': 1,
			'rotmgtool.com': 1,
			'pokemonshowdown.com': 1,
			'nocookie.net': 1,
			'blogspot.com': 1,
			'imageshack.us': 1,
			'deviantart.net': 1,
			'd.pr': 1,
			'pokefans.net': 1
		};
		if (domain in approvedDomains) {
			return '//' + uri;
		}
		if (domain === 'bit.ly') {
			return this.errorReply("Please don't use URL shorteners.");
		}
		// unknown URI, allow HTTP to be safe
		return 'http://' + uri;
	};
	Context.prototype.canHTML = function (html) {
		html = '' + (html || '');
		let images = /<img\b[^<>]*/ig;
		let match;
		while ((match = images.exec(html))) {
			if (this.room.isPersonal && !this.user.can('announce')) {
				this.errorReply("Images are not allowed in personal rooms.");
				return false;
			}
			let srcMatch = /src\w*\=\w*"?([^ "]+)(\w*")?/i.exec(match[0]);
			if (srcMatch) {
				let uri = this.canEmbedURI(srcMatch[1], true);
				if (!uri) return false;
				html = html.slice(0, match.index + srcMatch.index) + 'src="' + uri + '"' + html.slice(match.index + srcMatch.index + srcMatch[0].length);
				// lastIndex is inaccurate since html was changed
				images.lastIndex = match.index + 11;
			}
		}
		if (/>here.?</i.test(html) || /click here/i.test(html)) {
			this.errorReply('Do not use "click here"');
			return false;
		}

		// check for mismatched tags
		let tags = html.toLowerCase().match(/<\/?(div|a|button|b|i|u|center|font)\b/g);
		if (tags) {
			let stack = [];
			for (let i = 0; i < tags.length; i++) {
				let tag = tags[i];
				if (tag.charAt(1) === '/') {
					if (!stack.length) {
						this.errorReply("Extraneous </" + tag.substr(2) + "> without an opening tag.");
						return false;
					}
					if (tag.substr(2) !== stack.pop()) {
						this.errorReply("Missing </" + tag.substr(2) + "> or it's in the wrong place.");
						return false;
					}
				} else {
					stack.push(tag.substr(1));
				}
			}
			if (stack.length) {
				this.errorReply("Missing </" + stack.pop() + ">.");
				return false;
			}
		}

		return html;
	};
	Context.prototype.targetUserOrSelf = function (target, exactName) {
		if (!target) {
			this.targetUsername = this.user.name;
			this.inputUsername = this.user.name;
			return this.user;
		}
		this.splitTarget(target, exactName);
		return this.targetUser;
	};
	Context.prototype.getLastIdOf = function (user) {
		return (user.named ? user.userid : (Object.keys(user.prevNames).last() || user.userid));
	};
	Context.prototype.splitTarget = function (target, exactName) {
		let commaIndex = target.indexOf(',');
		if (commaIndex < 0) {
			let targetUser = Users.get(target, exactName);
			this.targetUser = targetUser;
			this.inputUsername = target.trim();
			this.targetUsername = targetUser ? targetUser.name : target;
			return '';
		}
		this.inputUsername = target.substr(0, commaIndex);
		let targetUser = Users.get(this.inputUsername, exactName);
		if (targetUser) {
			this.targetUser = targetUser;
			this.targetUsername = this.inputUsername = targetUser.name;
		} else {
			this.targetUser = null;
			this.targetUsername = this.inputUsername;
		}
		return target.substr(commaIndex + 1).trim();
	};

	return Context;
})();

/**
 * Command parser
 *
 * Usage:
 *   CommandParser.parse(message, room, user, connection)
 *
 * message - the message the user is trying to say
 * room - the room the user is trying to say it in
 * user - the user that sent the message
 * connection - the connection the user sent the message from
 *
 * Returns the message the user should say, or a falsy value which
 * means "don't say anything"
 *
 * Examples:
 *   CommandParser.parse("/join lobby", room, user, connection)
 *     will make the user join the lobby, and return false.
 *
 *   CommandParser.parse("Hi, guys!", room, user, connection)
 *     will return "Hi, guys!" if the user isn't muted, or
 *     if he's muted, will warn him that he's muted, and
 *     return false.
 */
let parse = exports.parse = function (message, room, user, connection, levelsDeep) {
	let cmd = '', target = '', cmdToken = '';
	if (!message || !message.trim().length) return;
	if (!levelsDeep) {
		levelsDeep = 0;
	} else {
		if (levelsDeep > MAX_PARSE_RECURSION) {
			return connection.sendTo(room, "Error: Too much recursion");
		}
	}

	if (message.substr(0, 3) === '>> ') {
		// multiline eval
		message = '/eval ' + message.substr(3);
	} else if (message.substr(0, 4) === '>>> ') {
		// multiline eval
		message = '/evalbattle ' + message.substr(4);
	}

	if (VALID_COMMAND_TOKENS.includes(message.charAt(0)) && message.charAt(1) !== message.charAt(0)) {
		cmdToken = message.charAt(0);
		let spaceIndex = message.indexOf(' ');
		if (spaceIndex > 0) {
			cmd = message.substr(1, spaceIndex - 1).toLowerCase();
			target = message.substr(spaceIndex + 1);
		} else {
			cmd = message.substr(1).toLowerCase();
			target = '';
		}
	}

	let namespaces = [];
	let currentCommands = commands;
	let commandHandler;

	do {
		commandHandler = currentCommands[cmd];
		if (typeof commandHandler === 'string') {
			// in case someone messed up, don't loop
			commandHandler = currentCommands[commandHandler];
		}
		if (commandHandler && typeof commandHandler === 'object') {
			namespaces.push(cmd);

			let spaceIndex = target.indexOf(' ');
			if (spaceIndex > 0) {
				cmd = target.substr(0, spaceIndex).toLowerCase();
				target = target.substr(spaceIndex + 1);
			} else {
				cmd = target.toLowerCase();
				target = '';
			}

			currentCommands = commandHandler;
		}
	} while (commandHandler && typeof commandHandler === 'object');
	if (!commandHandler && currentCommands.default) {
		commandHandler = currentCommands.default;
		if (typeof commandHandler === 'string') {
			commandHandler = currentCommands[commandHandler];
		}
	}
	let fullCmd = namespaces.concat(cmd).join(' ');

	let context = new Context({
		target: target, room: room, user: user, connection: connection, cmd: cmd, message: message,
		namespaces: namespaces, cmdToken: cmdToken, levelsDeep: levelsDeep
	});

	if (commandHandler) {
		return context.run(commandHandler);
	} else {
		// Check for mod/demod/admin/deadmin/etc depending on the group ids
		let isRoom = false;
		let promoteCmd = cmd;
		if (promoteCmd.substr(0, 6) === 'global') {
			promoteCmd = promoteCmd.slice(6);
		} else if (promoteCmd.substr(0, 4) === 'room') {
			isRoom = true;
			promoteCmd = promoteCmd.slice(4);
		}
		for (let g in Config.groups[isRoom ? room.type + 'Room' : 'global']) {
			let groupId = Config.groups.bySymbol[g].id;
			let isDemote = promoteCmd === 'de' + groupId || promoteCmd === 'un' + groupId;
			if (promoteCmd === groupId || isDemote) {
				return parse('/' + (isRoom ? 'room' : '') + (isDemote ? 'demote' : 'promote') + ' ' + toId(target) + (isDemote ? '' : ',' + g), room, user, connection, levelsDeep + 1);
			}
		}

		if (cmdToken && fullCmd) {
			// To guard against command typos, we now emit an error message
			if (cmdToken === BROADCAST_TOKEN) {
				if (/[a-z0-9]/.test(cmd.charAt(0))) {
					return context.errorReply("The command '" + cmdToken + fullCmd + "' was unrecognized.");
				}
			} else {
				return context.errorReply("The command '" + cmdToken + fullCmd + "' was unrecognized. To send a message starting with '" + cmdToken + fullCmd + "', type '" + cmdToken.repeat(2) + fullCmd + "'.");
			}
		} else if (!VALID_COMMAND_TOKENS.includes(message.charAt(0)) && VALID_COMMAND_TOKENS.includes(message.trim().charAt(0))) {
			message = message.trim();
			if (message.charAt(0) !== BROADCAST_TOKEN) {
				message = message.charAt(0) + message;
			}
		}
	}

	message = canTalk.call(context, user, room, connection, message);

	return message || false;
};

exports.package = {};
fs.readFile(path.resolve(__dirname, 'package.json'), function (err, data) {
	if (err) return;
	exports.package = JSON.parse(data);
});

exports.uncacheTree = function (root) {
	let uncache = [require.resolve(root)];
	do {
		let newuncache = [];
		for (let i = 0; i < uncache.length; ++i) {
			if (require.cache[uncache[i]]) {
				newuncache.push.apply(newuncache,
					require.cache[uncache[i]].children.map('id')
				);
				delete require.cache[uncache[i]];
			}
		}
		uncache = newuncache;
	} while (uncache.length > 0);
};