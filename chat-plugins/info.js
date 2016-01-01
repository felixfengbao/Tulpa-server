/**
 * Informational Commands
 * Pokemon Showdown - https://pokemonshowdown.com/
 *
 * These are informational commands. For instance, you can define the command
 * 'whois' here, then use it by typing /whois into Pokemon Showdown.
 *
 * For the API, see chat-plugins/COMMANDS.md
 *
 * @license MIT license
 */

'use strict';

const RESULTS_MAX_LENGTH = 10;

exports.commands = {

	ip: 'whois',
	rooms: 'whois',
	alt: 'whois',
	alts: 'whois',
	whoare: 'whois',
	whois: function (target, room, user, connection, cmd) {
		if (room.id === 'staff' && !this.canBroadcast()) return;
		let targetUser = this.targetUserOrSelf(target, user.group === Config.groups.default.global);
		if (!targetUser) {
			return this.errorReply("User " + this.targetUsername + " not found.");
		}
		let showAll = (cmd === 'ip' || cmd === 'whoare' || cmd === 'alt' || cmd === 'alts');
		if (showAll && !user.confirmed && targetUser !== user) {
			return this.errorReply("/alts - Access denied.");
		}

		let buf = '<strong class="username"><small style="display:none">' + targetUser.group + '</small>' + Tools.escapeHTML(targetUser.name) + '</strong> ' + (!targetUser.connected ? ' <em style="color:gray">(offline)</em>' : '');
		if (Config.groups.bySymbol[targetUser.group] && Config.groups.bySymbol[targetUser.group].name) {
			buf += "<br />" + Config.groups.bySymbol[targetUser.group].name + " (" + targetUser.group + ")";
		}
		if (targetUser.isSysop) {
			buf += "<br />(Pok&eacute;mon Showdown System Operator)";
		}
		if (!targetUser.registered) {
			buf += "<br />(Unregistered)";
		}
		let publicrooms = "";
		let hiddenrooms = "";
		let privaterooms = "";
		for (let i in targetUser.roomCount) {
			if (i === 'global') continue;
			let targetRoom = Rooms.get(i);

			let output = (targetRoom.auth && targetRoom.auth[targetUser.userid] ? targetRoom.auth[targetUser.userid] : '') + '<a href="/' + i + '">' + i + '</a>';
			if (targetRoom.isPrivate === true) {
				if (privaterooms) privaterooms += " | ";
				privaterooms += output;
			} else if (targetRoom.isPrivate) {
				if (hiddenrooms) hiddenrooms += " | ";
				hiddenrooms += output;
			} else {
				if (publicrooms) publicrooms += " | ";
				publicrooms += output;
			}
		}
		buf += '<br />Rooms: ' + (publicrooms || '<em>(no public rooms)</em>');

		if (!showAll) {
			return this.sendReplyBox(buf);
		}
		buf += '<br />';
		if (user.can('alts', targetUser) || user.can('alts') && user === targetUser) {
			let alts = targetUser.getAlts(true);
			let output = Object.keys(targetUser.prevNames).join(", ");
			if (output) buf += "<br />Previous names: " + Tools.escapeHTML(output);

			for (let j = 0; j < alts.length; ++j) {
				let targetAlt = Users.get(alts[j]);
				if (!targetAlt.named && !targetAlt.connected) continue;
				if (Config.groups.bySymbol[targetAlt.group] && Config.groups.bySymbol[user.group] &&
					Config.groups.bySymbol[targetAlt.group].rank > Config.groups.bySymbol[user.group].rank) continue;

				buf += '<br />Alt: <span class="username">' + Tools.escapeHTML(targetAlt.name) + '</span>' + (!targetAlt.connected ? " <em style=\"color:gray\">(offline)</em>" : "");
				output = Object.keys(targetAlt.prevNames).join(", ");
				if (output) buf += "<br />Previous names: " + output;
			}
			if (targetUser.locked) {
				buf += '<br />Locked: ' + targetUser.locked;
				switch (targetUser.locked) {
				case '#dnsbl':
					buf += " - IP is in a DNS-based blacklist";
					break;
				case '#range':
					buf += " - IP or host is in a temporary range-lock";
					break;
				case '#hostfilter':
					buf += " - host is permanently locked for being a proxy";
					break;
				}
			}
			if (targetUser.semilocked) {
				buf += '<br />Semilocked: ' + targetUser.semilocked;
			}
		}
		if ((user.can('ip', targetUser) || user === targetUser)) {
			let ips = Object.keys(targetUser.ips);
			buf += "<br /> IP" + ((ips.length > 1) ? "s" : "") + ": " + ips.join(", ");
			buf += "<br />Host: " + targetUser.latestHost;
		}
		if ((user === targetUser || user.can('alts', targetUser)) && hiddenrooms) {
			buf += '<br />Hidden rooms: ' + hiddenrooms;
		}
		if ((user === targetUser || user.can('makeroom')) && privaterooms) {
			buf += '<br />Private rooms: ' + privaterooms;
		}

		if (user.can('alts', targetUser) || (room.isPrivate !== true && user.can('mute', targetUser, room) && targetUser.userid in room.users)) {
			let bannedFrom = "";
			for (let i = 0; i < Rooms.global.chatRooms.length; i++) {
				let thisRoom = Rooms.global.chatRooms[i];
				if (!thisRoom || thisRoom.isPrivate === true) continue;
				if (thisRoom.bannedIps && (targetUser.latestIp in thisRoom.bannedIps || targetUser.userid in thisRoom.bannedUsers)) {
					if (bannedFrom) bannedFrom += ", ";
					bannedFrom += '<a href="/' + thisRoom + '">' + thisRoom + '</a>';
				}
			}
			if (bannedFrom) buf += '<br />Banned from: ' + bannedFrom;
		}
		this.sendReplyBox(buf);
	},
	whoishelp: ["/whois - Get details on yourself: alts, group, IP address, and rooms.",
		"/whois [username] - Get details on a username: alts (Requires: " + Users.getGroupsThatCan('alts').join(" ") + "), group, IP address (Requires: " + Users.getGroupsThatCan('ip').join(" ") + "), and rooms."],

	host: function (target, room, user, connection, cmd) {
		if (!target) return this.parse('/help host');
		if (!this.can('rangeban')) return;
		if (!/[0-9.]+/.test(target)) return this.errorReply('You must pass a valid IPv4 IP to /host.');
		let self = this;
		Dnsbl.reverse(target, function (err, hosts) {
			self.sendReply('IP ' + target + ': ' + (hosts ? hosts[0] : 'NULL'));
		});
	},
	hosthelp: ["/host [ip] - Gets the host for a given IP. Requires: " + Users.getGroupsThatCan('rangeban').join(" ")],

	searchip: 'ipsearch',
	ipsearchall: 'ipsearch',
	hostsearch: 'ipsearch',
	ipsearch: function (target, room, user, connection, cmd) {
		if (!target.trim()) return this.parse('/help ipsearch');
		if (!this.can('rangeban')) return;
		let results = [];

		let isAll = (cmd === 'ipsearchall');

		if (/[a-z]/.test(target)) {
			// host
			this.sendReply("Users with host " + target + ":");
			Users.users.forEach(function (curUser) {
				if (results.length > 100 && !isAll) return;
				if (!curUser.latestHost || !curUser.latestHost.endsWith(target)) return;
				results.push((curUser.connected ? " \u25C9 " : " \u25CC ") + " " + curUser.name);
			});
			if (results.length > 100 && !isAll) {
				return this.sendReply("More than 100 users match the specified IP range. Use /ipsearchall to retrieve the full list.");
			}
		} else if (target.slice(-1) === '*') {
			// IP range
			this.sendReply("Users in IP range " + target + ":");
			target = target.slice(0, -1);
			Users.users.forEach(function (curUser) {
				if (results.length > 100 && !isAll) return;
				if (!curUser.latestIp.startsWith(target)) return;
				results.push((curUser.connected ? " \u25C9 " : " \u25CC ") + " " + curUser.name);
			});
			if (results.length > 100 && !isAll) {
				return this.sendReply("More than 100 users match the specified IP range. Use /ipsearchall to retrieve the full list.");
			}
		} else {
			this.sendReply("Users with IP " + target + ":");
			Users.users.forEach(function (curUser) {
				if (curUser.latestIp === target) {
					results.push((curUser.connected ? " \u25C9 " : " \u25CC ") + " " + curUser.name);
				}
			});
		}
		if (!results.length) return this.errorReply("No results found.");
		return this.sendReply(results.join('; '));
	},
	ipsearchhelp: ["/ipsearch [ip|range|host] - Find all users with specified IP, IP range, or host. Requires: " + Users.getGroupsThatCan('rangeban').join(" ")],

	/*********************************************************
	 * Shortcuts
	 *********************************************************/

	inv: 'invite',
	invite: function (target, room, user) {
		if (!target) return this.parse('/help invite');
		target = this.splitTarget(target);
		if (!this.targetUser) {
			return this.errorReply("User " + this.targetUsername + " not found.");
		}
		let targetRoom = (target ? Rooms.search(target) : room);
		if (!targetRoom) {
			return this.errorReply("Room " + target + " not found.");
		}
		return this.parse('/msg ' + this.targetUsername + ', /invite ' + targetRoom.id);
	},
	invitehelp: ["/invite [username], [roomname] - Invites the player [username] to join the room [roomname]."],

	/*********************************************************
	 * Data Search Tools
	 *********************************************************/

	pstats: 'data',
	stats: 'data',
	dex: 'data',
	pokedex: 'data',
	data: function (target, room, user, connection, cmd) {
		if (!this.canBroadcast()) return;

		let buffer = '';
		let targetId = toId(target);
		if (!targetId) return this.parse('/help data');
		let targetNum = parseInt(targetId, 10);
		if (!isNaN(targetNum)) {
			for (let p in Tools.data.Pokedex) {
				let pokemon = Tools.getTemplate(p);
				if (pokemon.num === targetNum) {
					target = pokemon.species;
					targetId = pokemon.id;
					break;
				}
			}
		}
		let newTargets = Tools.dataSearch(target);
		let showDetails = (cmd === 'dt' || cmd === 'details');
		if (newTargets && newTargets.length) {
			for (let i = 0; i < newTargets.length; ++i) {
				if (!newTargets[i].exactMatch && !i) {
					buffer = "No Pok\u00e9mon, item, move, ability or nature named '" + target + "' was found. Showing the data of '" + newTargets[0].name + "' instead.\n";
				}
				if (newTargets[i].searchType === 'nature') {
					let nature = Tools.getNature(newTargets[i].name);
					buffer += "" + nature.name + " nature: ";
					if (nature.plus) {
						let statNames = {'atk': "Attack", 'def': "Defense", 'spa': "Special Attack", 'spd': "Special Defense", 'spe': "Speed"};
						buffer += "+10% " + statNames[nature.plus] + ", -10% " + statNames[nature.minus] + ".";
					} else {
						buffer += "No effect.";
					}
					return this.sendReply(buffer);
				} else {
					buffer += '|c|~|/data-' + newTargets[i].searchType + ' ' + newTargets[i].name + '\n';
				}
			}
		} else {
			return this.errorReply("No Pok\u00e9mon, item, move, ability or nature named '" + target + "' was found. (Check your spelling?)");
		}

		if (showDetails) {
			let details;
			let isSnatch = false;
			let isMirrorMove = false;
			if (newTargets[0].searchType === 'pokemon') {
				let pokemon = Tools.getTemplate(newTargets[0].name);
				let weighthit = 20;
				if (pokemon.weightkg >= 200) {
					weighthit = 120;
				} else if (pokemon.weightkg >= 100) {
					weighthit = 100;
				} else if (pokemon.weightkg >= 50) {
					weighthit = 80;
				} else if (pokemon.weightkg >= 25) {
					weighthit = 60;
				} else if (pokemon.weightkg >= 10) {
					weighthit = 40;
				}
				details = {
					"Dex#": pokemon.num,
					"Gen": pokemon.gen,
					"Height": pokemon.heightm + " m",
					"Weight": pokemon.weightkg + " kg <em>(" + weighthit + " BP)</em>",
					"Dex Colour": pokemon.color,
					"Egg Group(s)": pokemon.eggGroups.join(", ")
				};
				if (!pokemon.evos.length) {
					details["<font color=#585858>Does Not Evolve</font>"] = "";
				} else {
					details["Evolution"] = pokemon.evos.map(function (evo) {
						evo = Tools.getTemplate(evo);
						return evo.name + " (" + evo.evoLevel + ")";
					}).join(", ");
				}
			} else if (newTargets[0].searchType === 'move') {
				let move = Tools.getMove(newTargets[0].name);
				details = {
					"Priority": move.priority,
					"Gen": move.gen
				};

				if (move.secondary || move.secondaries) details["<font color=black>&#10003; Secondary effect</font>"] = "";
				if (move.flags['contact']) details["<font color=black>&#10003; Contact</font>"] = "";
				if (move.flags['sound']) details["<font color=black>&#10003; Sound</font>"] = "";
				if (move.flags['bullet']) details["<font color=black>&#10003; Bullet</font>"] = "";
				if (move.flags['pulse']) details["<font color=black>&#10003; Pulse</font>"] = "";
				if (!move.flags['protect'] && !/(ally|self)/i.test(move.target)) details["<font color=black>&#10003; Bypasses Protect</font>"] = "";
				if (move.flags['authentic']) details["<font color=black>&#10003; Bypasses Substitutes</font>"] = "";
				if (move.flags['defrost']) details["<font color=black>&#10003; Thaws user</font>"] = "";
				if (move.flags['bite']) details["<font color=black>&#10003; Bite</font>"] = "";
				if (move.flags['punch']) details["<font color=black>&#10003; Punch</font>"] = "";
				if (move.flags['powder']) details["<font color=black>&#10003; Powder</font>"] = "";
				if (move.flags['reflectable']) details["<font color=black>&#10003; Bounceable</font>"] = "";
				if (move.flags['gravity']) details["<font color=black>&#10007; Suppressed by Gravity</font>"] = "";

				if (move.id === 'snatch') isSnatch = true;
				if (move.id === 'mirrormove') isMirrorMove = true;

				details["Target"] = {
					'normal': "One Adjacent Pok\u00e9mon",
					'self': "User",
					'adjacentAlly': "One Ally",
					'adjacentAllyOrSelf': "User or Ally",
					'adjacentFoe': "One Adjacent Opposing Pok\u00e9mon",
					'allAdjacentFoes': "All Adjacent Opponents",
					'foeSide': "Opposing Side",
					'allySide': "User's Side",
					'allyTeam': "User's Side",
					'allAdjacent': "All Adjacent Pok\u00e9mon",
					'any': "Any Pok\u00e9mon",
					'all': "All Pok\u00e9mon"
				}[move.target] || "Unknown";
			} else if (newTargets[0].searchType === 'item') {
				let item = Tools.getItem(newTargets[0].name);
				details = {
					"Gen": item.gen
				};

				if (item.fling) {
					details["Fling Base Power"] = item.fling.basePower;
					if (item.fling.status) details["Fling Effect"] = item.fling.status;
					if (item.fling.volatileStatus) details["Fling Effect"] = item.fling.volatileStatus;
					if (item.isBerry) details["Fling Effect"] = "Activates the Berry's effect on the target.";
					if (item.id === 'whiteherb') details["Fling Effect"] = "Restores the target's negative stat stages to 0.";
					if (item.id === 'mentalherb') details["Fling Effect"] = "Removes the effects of Attract, Disable, Encore, Heal Block, Taunt, and Torment from the target.";
				} else {
					details["Fling"] = "This item cannot be used with Fling.";
				}
				if (item.naturalGift) {
					details["Natural Gift Type"] = item.naturalGift.type;
					details["Natural Gift Base Power"] = item.naturalGift.basePower;
				}
			} else {
				details = {};
			}

			buffer += '|raw|<font size="1">' + Object.keys(details).map(function (detail) {
				return '<font color=#585858>' + detail + (details[detail] !== '' ? ':</font> ' + details[detail] : '</font>');
			}).join("&nbsp;|&ThickSpace;") + '</font>';

			if (isSnatch) buffer += '&nbsp;|&ThickSpace;<a href="https://pokemonshowdown.com/dex/moves/snatch"><font size="1">Snatchable Moves</font></a>';
			if (isMirrorMove) buffer += '&nbsp;|&ThickSpace;<a href="https://pokemonshowdown.com/dex/moves/mirrormove"><font size="1">Mirrorable Moves</font></a>';
		}
		this.sendReply(buffer);
	},
	datahelp: ["/data [pokemon/item/move/ability] - Get details on this pokemon/item/move/ability/nature.",
		"!data [pokemon/item/move/ability] - Show everyone these details. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	dt: 'details',
	details: function (target) {
		if (!target) return this.parse('/help details');
		this.run('data');
	},
	detailshelp: ["/details [pokemon] - Get additional details on this pokemon/item/move/ability/nature.",
		"!details [pokemon] - Show everyone these details. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	ds: 'dexsearch',
	dsearch: 'dexsearch',
	dexsearch: function (target, room, user, connection, cmd, message) {
		if (!this.canBroadcast()) return;

		if (!target) return this.parse('/help dexsearch');
		let searches = [];
		let allTiers = {'uber':1, 'ou':1, 'bl':1, 'uu':1, 'bl2':1, 'ru':1, 'bl3':1, 'nu':1, 'bl4':1, 'pu':1, 'nfe':1, 'lc uber':1, 'lc':1, 'cap':1};
		let allColours = {'green':1, 'red':1, 'blue':1, 'white':1, 'brown':1, 'yellow':1, 'purple':1, 'pink':1, 'gray':1, 'black':1};
		let allStats = {'hp':1, 'atk':1, 'def':1, 'spa':1, 'spd':1, 'spe':1, 'bst':1};
		let showAll = false;
		let megaSearch = null;
		let capSearch = null;
		let randomOutput = 0;

		let self = this;
		let validParameter = function (cat, param, isNotSearch) {
			for (let h = 0; h < searches.length; h++) {
				let group = searches[h];
				if (group[cat] === undefined) continue;
				if (group[cat][param] === undefined) continue;
				if (group[cat][param] === isNotSearch) {
					self.sendReplyBox("A search cannot both include and exclude '" + param + "'.");
				} else {
					self.sendReplyBox("The search included '" + (isNotSearch ? "!" : "") + param + "' more than once.");
				}
				return false;
			}
			return true;
		};

		let andGroups = target.split(',');
		for (let i = 0; i < andGroups.length; i++) {
			let orGroup = {abilities: {}, tiers: {}, colors: {}, gens: {}, moves: {}, types: {}, stats: {}, skip: false};
			let parameters = andGroups[i].split("|");
			if (parameters.length > 4) return this.sendReply("No more than 3 alternatives for each parameter may be used.");
			for (let j = 0; j < parameters.length; j++) {
				let isNotSearch = false;
				target = parameters[j].trim().toLowerCase();
				if (target.charAt(0) === '!') {
					isNotSearch = true;
					target = target.substr(1);
				}

				let targetAbility = Tools.getAbility(target);
				if (targetAbility.exists) {
					if (!validParameter("abilities", targetAbility, isNotSearch)) return;
					orGroup.abilities[targetAbility] = !isNotSearch;
					continue;
				}

				if (target in allTiers) {
					if (target === "cap") {
						if (parameters.length > 1) return this.sendReplyBox("The parameter 'cap' cannot have alternative parameters");
						capSearch = !isNotSearch;
					}
					if (!validParameter("tiers", target, isNotSearch)) return;
					orGroup.tiers[target] = !isNotSearch;
					continue;
				}

				if (target in allColours) {
					target = target.capitalize();
					if (!validParameter("colors", target, isNotSearch)) return;
					orGroup.colors[target] = !isNotSearch;
					continue;
				}

				if (target.substr(0, 3) === 'gen' && Number.isInteger(parseFloat(target.substr(3)))) target = target.substr(3).trim();
				let targetInt = parseInt(target, 10);
				if (0 < targetInt && targetInt < 7) {
					if (!validParameter("gens", target, isNotSearch)) return;
					orGroup.gens[target] = !isNotSearch;
					continue;
				}

				if (target === 'all') {
					if (this.broadcasting && !room.isPersonal) return this.sendReplyBox("A search with the parameter 'all' cannot be broadcast.");
					if (parameters.length > 1) return this.sendReplyBox("The parameter 'all' cannot have alternative parameters");
					showAll = true;
					orGroup.skip = true;
					break;
				}

				if (target.substr(0, 6) === 'random' && cmd === 'randpoke') {
					//validation for this is in the /randpoke command
					randomOutput = parseInt(target.substr(6), 10);
					orGroup.skip = true;
					continue;
				}

				if (target === 'megas' || target === 'mega') {
					if (parameters.length > 1) return this.sendReplyBox("The parameter 'mega' cannot have alternative parameters");
					megaSearch = !isNotSearch;
					orGroup.skip = true;
					break;
				}

				if (target === 'recovery') {
					if (parameters.length > 1) return this.sendReplyBox("The parameter 'recovery' cannot have alternative parameters");
					let recoveryMoves = ["recover", "roost", "moonlight", "morningsun", "synthesis", "milkdrink", "slackoff", "softboiled", "wish", "healorder"];
					for (let k = 0; k < recoveryMoves.length; k++) {
						if (!validParameter("moves", recoveryMoves[k], isNotSearch)) return;
						if (isNotSearch) {
							let bufferObj = {moves: {}};
							bufferObj.moves[recoveryMoves[k]] = false;
							searches.push(bufferObj);
						} else {
							orGroup.moves[recoveryMoves[k]] = true;
						}
					}
					if (isNotSearch) orGroup.skip = true;
					break;
				}

				if (target === 'priority') {
					if (parameters.length > 1) return this.sendReplyBox("The parameter 'priority' cannot have alternative parameters");
					for (let move in Tools.data.Movedex) {
						let moveData = Tools.getMove(move);
						if (moveData.category === "Status" || moveData.id === "bide") continue;
						if (moveData.priority > 0) {
							if (!validParameter("moves", move, isNotSearch)) return;
							if (isNotSearch) {
								let bufferObj = {moves: {}};
								bufferObj.moves[move] = false;
								searches.push(bufferObj);
							} else {
								orGroup.moves[move] = true;
							}
						}
					}
					if (isNotSearch) orGroup.skip = true;
					break;
				}

				let targetMove = Tools.getMove(target);
				if (targetMove.exists) {
					if (!validParameter("moves", targetMove.id, isNotSearch)) return;
					orGroup.moves[targetMove.id] = !isNotSearch;
					continue;
				}

				let typeIndex = target.indexOf(' type');
				if (typeIndex >= 0) {
					target = target.charAt(0).toUpperCase() + target.substring(1, typeIndex);
					if (target in Tools.data.TypeChart) {
						if (!validParameter("types", target, isNotSearch)) return;
						orGroup.types[target] = !isNotSearch;
						continue;
					}
				}

				let inequality = target.search(/>|<|=/);
				if (inequality >= 0) {
					if (isNotSearch) return this.sendReplyBox("You cannot use the negation symbol '!' in stat ranges.");
					if (target.charAt(inequality + 1) === '=') {
						inequality = target.substr(inequality, 2);
					} else {
						inequality = target.charAt(inequality);
					}
					let inequalityOffset = (inequality.charAt(1) === '=' ? 0 : -1);
					let targetParts = target.replace(/\s/g, '').split(inequality);
					let num, stat, direction;
					if (!isNaN(targetParts[0])) {
						// e.g. 100 < spe
						num = parseFloat(targetParts[0]);
						stat = targetParts[1];
						switch (inequality.charAt(0)) {
						case '>': direction = 'less'; num += inequalityOffset; break;
						case '<': direction = 'greater'; num -= inequalityOffset; break;
						case '=': direction = 'equal'; break;
						}
					} else if (!isNaN(targetParts[1])) {
						// e.g. spe > 100
						num = parseFloat(targetParts[1]);
						stat = targetParts[0];
						switch (inequality.charAt(0)) {
						case '<': direction = 'less'; num += inequalityOffset; break;
						case '>': direction = 'greater'; num -= inequalityOffset; break;
						case '=': direction = 'equal'; break;
						}
					} else {
						return this.sendReplyBox("No value given to compare with '" + Tools.escapeHTML(target) + "'.");
					}
					switch (toId(stat)) {
					case 'attack': stat = 'atk'; break;
					case 'defense': stat = 'def'; break;
					case 'specialattack': stat = 'spa'; break;
					case 'spatk': stat = 'spa'; break;
					case 'specialdefense': stat = 'spd'; break;
					case 'spdef': stat = 'spd'; break;
					case 'speed': stat = 'spe'; break;
					}
					if (!(stat in allStats)) return this.sendReplyBox("'" + Tools.escapeHTML(target) + "' did not contain a valid stat.");
					if (!orGroup.stats[stat]) orGroup.stats[stat] = {};
					if (orGroup.stats[stat][direction]) return this.sendReplyBox("Invalid stat range for " + stat + ".");
					orGroup.stats[stat][direction] = num;
					continue;
				}
				return this.sendReplyBox("'" + Tools.escapeHTML(target) + "' could not be found in any of the search categories.");
			}
			searches.push(orGroup);
		}

		if (showAll && searches.length === 0 && megaSearch === null) return this.sendReplyBox("No search parameters other than 'all' were found. Try '/help dexsearch' for more information on this command.");

		let dex = {};
		for (let pokemon in Tools.data.Pokedex) {
			let template = Tools.getTemplate(pokemon);
			let megaSearchResult = (megaSearch === null || (megaSearch === true && template.isMega) || (megaSearch === false && !template.isMega));
			if (template.tier !== 'Unreleased' && template.tier !== 'Illegal' && (template.tier !== 'CAP' || capSearch) && megaSearchResult) {
				dex[pokemon] = template;
			}
		}

		let learnSetsCompiled = false;
		//ensure searches with the least alternatives are run first
		searches.sort(function (a, b) {
			let aCount = 0, bCount = 0;
			for (let cat in a) {
				if (typeof a[cat] === "object") aCount += Object.size(a[cat]);
			}
			for (let cat in b) {
				if (typeof b[cat] === "object") bCount += Object.size(b[cat]);
			}
			return aCount - bCount;
		});

		for (let group = 0; group < searches.length; group++) {
			let alts = searches[group];
			if (alts.skip) continue;
			for (let mon in dex) {
				let matched = false;
				if (Object.size(alts.gens) > 0) {
					if (alts.gens[dex[mon].gen] || (Object.count(alts.gens, false) > 0 &&
						alts.gens[dex[mon].gen] !== false)) continue;
				}

				if (Object.size(alts.colors) > 0) {
					if (alts.colors[dex[mon].color] || (Object.count(alts.colors, false) > 0 &&
						alts.colors[dex[mon].color] !== false)) continue;
				}

				if (Object.size(alts.tiers) > 0) {
					if (alts.tiers[dex[mon].tier.toLowerCase()] || (Object.count(alts.tiers, false) > 0 &&
						alts.tiers[dex[mon].tier.toLowerCase()] !== false)) continue;
				}

				for (let type in alts.types) {
					if (dex[mon].types.indexOf(type) >= 0 === alts.types[type]) {
						matched = true;
						break;
					}
				}
				if (matched) continue;

				for (let ability in alts.abilities) {
					if (alts.abilities[ability] === (Object.count(dex[mon].abilities, ability) > 0)) {
						matched = true;
						break;
					}
				}
				if (matched) continue;

				for (let stat in alts.stats) {
					let monStat = 0;
					if (stat === 'bst') {
						for (let monStats in dex[mon].baseStats) {
							monStat += dex[mon].baseStats[monStats];
						}
					} else {
						monStat = dex[mon].baseStats[stat];
					}
					if (typeof alts.stats[stat].less === 'number') {
						if (monStat <= alts.stats[stat].less) {
							matched = true;
							break;
						}
					}
					if (typeof alts.stats[stat].greater === 'number') {
						if (monStat >= alts.stats[stat].greater) {
							matched = true;
							break;
						}
					}
					if (typeof alts.stats[stat].equal === 'number') {
						if (monStat === alts.stats[stat].equal) {
							matched = true;
							break;
						}
					}
				}
				if (matched) continue;

				if (!learnSetsCompiled) {
					for (let mon2 in dex) {
						let template = dex[mon2];
						if (!template.learnset) template = Tools.getTemplate(template.baseSpecies);
						if (!template.learnset) continue;
						let fullLearnset = template.learnset;
						while (template.prevo) {
							template = Tools.getTemplate(template.prevo);
							for (let move in template.learnset) {
								if (!fullLearnset[move]) fullLearnset[move] = template.learnset[move];
							}
						}
						dex[mon2].learnset = fullLearnset;
					}
					learnSetsCompiled = true;
				}

				for (let move in alts.moves) {
					let canLearn = (dex[mon].learnset.sketch && ['chatter', 'struggle', 'magikarpsrevenge'].indexOf(move) < 0) || dex[mon].learnset[move];
					if ((canLearn && alts.moves[move]) || (alts.moves[move] === false && !canLearn)) {
						matched = true;
						break;
					}
				}
				if (matched) continue;

				delete dex[mon];
			}
		}

		let results = [];
		for (let mon in dex) {
			if (dex[mon].baseSpecies && results.indexOf(dex[mon].baseSpecies) >= 0) continue;
			results.push(dex[mon].species);
		}

		if (randomOutput && randomOutput < results.length) {
			results = results.randomize().slice(0, randomOutput);
		}

		let resultsStr = this.broadcasting ? "" : ("<font color=#999999>" + Tools.escapeHTML(message) + ":</font><br>");
		if (results.length > 1) {
			if (showAll || results.length <= RESULTS_MAX_LENGTH + 5) {
				results.sort();
				resultsStr += results.join(", ");
			} else {
				resultsStr += results.slice(0, RESULTS_MAX_LENGTH).join(", ") + ", and " + (results.length - RESULTS_MAX_LENGTH) + " more. <font color=#999999>Redo the search with 'all' as a search parameter to show all results.</font>";
			}
		} else if (results.length === 1) {
			return CommandParser.commands.data.call(this, results[0], room, user, connection, 'dt');
		} else {
			resultsStr += "No Pok&eacute;mon found.";
		}
		return this.sendReplyBox(resultsStr);
	},
	dexsearchhelp: ["/dexsearch [parameter], [parameter], [parameter], ... - Searches for Pok\u00e9mon that fulfill the selected criteria",
		"Search categories are: type, tier, color, moves, ability, gen, recovery, priority, stat.",
		"Valid colors are: green, red, blue, white, brown, yellow, purple, pink, gray and black.",
		"Valid tiers are: Uber/OU/BL/UU/BL2/RU/BL3/NU/BL4/PU/NFE/LC/CAP.",
		"Types must be followed by ' type', e.g., 'dragon type'.",
		"Inequality ranges use the characters '>=' for '≥' and '<=' for '≤', e.g., 'hp <= 95' searches all Pok\u00e9mon with HP less than or equal to 95.",
		"Parameters can be excluded through the use of '!', e.g., '!water type' excludes all water types.",
		"The parameter 'mega' can be added to search for Mega Evolutions only, and the parameter 'NFE' can be added to search not-fully evolved Pok\u00e9mon only.",
		"Parameters separated with '|' will be searched as alternatives for each other, e.g., 'trick | switcheroo' searches for all Pok\u00e9mon that learn either Trick or Switcheroo.",
		"The order of the parameters does not matter."],

	rollpokemon: 'randompokemon',
	randpoke: 'randompokemon',
	randompokemon: function (target, room, user, connection, cmd, message) {
		let targets = target.split(",");
		let targetsBuffer = [];
		let qty;
		for (let i = 0; i < targets.length; i++) {
			if (!targets[i]) continue;
			let num = Number(targets[i]);
			if (Number.isInteger(num)) {
				if (qty) return this.errorReply("Only specify the number of Pok\u00e9mon once.");
				qty = num;
				if (qty < 1 || 15 < qty) return this.errorReply("Number of random Pok\u00e9mon must be between 1 and 15.");
				targetsBuffer.push("random" + qty);
			} else {
				targetsBuffer.push(targets[i]);
			}
		}
		if (!qty) targetsBuffer.push("random1");

		CommandParser.commands.dexsearch.call(this, targetsBuffer.join(","), room, user, connection, "randpoke", message);
	},
	randompokemonhelp: ["/randompokemon - Generates random Pok\u00e9mon based on given search conditions.",
		"/randompokemon uses the same parameters as /dexsearch (see '/help ds').",
		"Adding a number as a parameter returns that many random Pok\u00e9mon, e.g., '/randpoke 6' returns 6 random Pok\u00e9mon."],

	ms: 'movesearch',
	msearch: 'movesearch',
	movesearch: function (target, room, user, connection, cmd, message) {
		if (!this.canBroadcast()) return;

		if (!target) return this.parse('/help movesearch');
		let targets = target.split(',');
		let searches = {};
		let allCategories = {'physical':1, 'special':1, 'status':1};
		let allProperties = {'basePower':1, 'accuracy':1, 'priority':1, 'pp':1};
		let allFlags = {'authentic':1, 'bite':1, 'bullet':1, 'contact':1, 'defrost':1, 'powder':1, 'pulse':1, 'punch':1, 'secondary':1, 'snatch':1, 'sound':1};
		let allStatus = {'psn':1, 'tox':1, 'brn':1, 'par':1, 'frz':1, 'slp':1};
		let allVolatileStatus = {'flinch':1, 'confusion':1, 'partiallytrapped':1};
		let allBoosts = {'hp':1, 'atk':1, 'def':1, 'spa':1, 'spd':1, 'spe':1, 'accuracy':1, 'evasion':1};
		let showAll = false;
		let lsetData = {};
		let targetMon = '';

		for (let i = 0; i < targets.length; i++) {
			let isNotSearch = false;
			target = targets[i].toLowerCase().trim();
			if (target.charAt(0) === '!') {
				isNotSearch = true;
				target = target.substr(1);
			}

			let typeIndex = target.indexOf(' type');
			if (typeIndex >= 0) {
				target = target.charAt(0).toUpperCase() + target.substring(1, typeIndex);
				if (!(target in Tools.data.TypeChart)) return this.sendReplyBox("Type '" + Tools.escapeHTML(target) + "' not found.");
				if (!searches['type']) searches['type'] = {};
				if ((searches['type'][target] && isNotSearch) || (searches['type'][target] === false && !isNotSearch)) return this.sendReplyBox('A search cannot both exclude and include a type.');
				searches['type'][target] = !isNotSearch;
				continue;
			}

			if (target in allCategories) {
				target = target.charAt(0).toUpperCase() + target.substr(1);
				if (!searches['category']) searches['category'] = {};
				if ((searches['category'][target] && isNotSearch) || (searches['category'][target] === false && !isNotSearch)) return this.sendReplyBox('A search cannot both exclude and include a category.');
				searches['category'][target] = !isNotSearch;
				continue;
			}

			if (target === 'bypassessubstitute') target = 'authentic';
			if (target in allFlags) {
				if (!searches['flags']) searches['flags'] = {};
				if ((searches['flags'][target] && isNotSearch) || (searches['flags'][target] === false && !isNotSearch)) return this.sendReplyBox('A search cannot both exclude and include \'' + target + '\'.');
				searches['flags'][target] = !isNotSearch;
				continue;
			}

			if (target === 'all') {
				if (this.broadcasting && !room.isPersonal) return this.sendReplyBox("A search with the parameter 'all' cannot be broadcast.");
				showAll = true;
				continue;
			}

			if (target === 'recovery') {
				if (!searches['recovery']) {
					searches['recovery'] = !isNotSearch;
				} else if ((searches['recovery'] && isNotSearch) || (searches['recovery'] === false && !isNotSearch)) {
					return this.sendReplyBox('A search cannot both exclude and include recovery moves.');
				}
				continue;
			}

			let template = Tools.getTemplate(target);
			if (template.exists) {
				if (Object.size(lsetData) !== 0) return this.sendReplyBox("A search can only include one Pok\u00e9mon learnset.");
				if (!template.learnset) template = Tools.getTemplate(template.baseSpecies);
				lsetData = template.learnset;
				targetMon = template.name;
				while (template.prevo) {
					template = Tools.getTemplate(template.prevo);
					for (let move in template.learnset) {
						if (!lsetData[move]) lsetData[move] = template.learnset[move];
					}
				}
				continue;
			}

			let inequality = target.search(/>|<|=/);
			if (inequality >= 0) {
				if (isNotSearch) return this.sendReplyBox("You cannot use the negation symbol '!' in quality ranges.");
				inequality = target.charAt(inequality);
				let targetParts = target.replace(/\s/g, '').split(inequality);
				let numSide, propSide, direction;
				if (!isNaN(targetParts[0])) {
					numSide = 0;
					propSide = 1;
					switch (inequality) {
					case '>': direction = 'less'; break;
					case '<': direction = 'greater'; break;
					case '=': direction = 'equal'; break;
					}
				} else if (!isNaN(targetParts[1])) {
					numSide = 1;
					propSide = 0;
					switch (inequality) {
					case '<': direction = 'less'; break;
					case '>': direction = 'greater'; break;
					case '=': direction = 'equal'; break;
					}
				} else {
					return this.sendReplyBox("No value given to compare with '" + Tools.escapeHTML(target) + "'.");
				}
				let prop = targetParts[propSide];
				switch (toId(targetParts[propSide])) {
				case 'basepower': prop = 'basePower'; break;
				case 'bp': prop = 'basePower'; break;
				case 'acc': prop = 'accuracy'; break;
				}
				if (!(prop in allProperties)) return this.sendReplyBox("'" + Tools.escapeHTML(target) + "' did not contain a valid property.");
				if (!searches['property']) searches['property'] = {};
				if (direction === 'equal') {
					if (searches['property'][prop]) return this.sendReplyBox("Invalid property range for " + prop + ".");
					searches['property'][prop] = {};
					searches['property'][prop]['less'] = parseFloat(targetParts[numSide]);
					searches['property'][prop]['greater'] = parseFloat(targetParts[numSide]);
				} else {
					if (!searches['property'][prop]) searches['property'][prop] = {};
					if (searches['property'][prop][direction]) {
						return this.sendReplyBox("Invalid property range for " + prop + ".");
					} else {
						searches['property'][prop][direction] = parseFloat(targetParts[numSide]);
					}
				}
				continue;
			}

			if (target.substr(0, 8) === 'priority') {
				let sign = '';
				target = target.substr(8).trim();
				if (target === "+") {
					sign = 'greater';
				} else if (target === "-") {
					sign = 'less';
				} else {
					return this.sendReplyBox("Priority type '" + target + "' not recognized.");
				}
				if (!searches['property']) searches['property'] = {};
				if (searches['property']['priority']) {
					return this.sendReplyBox("Priority cannot be set with both shorthand and inequality range.");
				} else {
					searches['property']['priority'] = {};
					searches['property']['priority'][sign] = (sign === 'less' ? -1 : 1);
				}
				continue;
			}

			if (target.substr(0, 7) === 'boosts ') {
				switch (target.substr(7)) {
				case 'attack': target = 'atk'; break;
				case 'defense': target = 'def'; break;
				case 'specialattack': target = 'spa'; break;
				case 'spatk': target = 'spa'; break;
				case 'specialdefense': target = 'spd'; break;
				case 'spdef': target = 'spd'; break;
				case 'speed': target = 'spe'; break;
				case 'acc': target = 'accuracy'; break;
				case 'evasiveness': target = 'evasion'; break;
				default: target = target.substr(7);
				}
				if (!(target in allBoosts)) return this.sendReplyBox("'" + Tools.escapeHTML(target.substr(7)) + "' is not a recognized stat.");
				if (!searches['boost']) searches['boost'] = {};
				if ((searches['boost'][target] && isNotSearch) || (searches['boost'][target] === false && !isNotSearch)) return this.sendReplyBox('A search cannot both exclude and include a stat boost.');
				searches['boost'][target] = !isNotSearch;
				continue;
			}

			let oldTarget = target;
			if (target.charAt(target.length - 1) === 's') target = target.substr(0, target.length - 1);
			switch (target) {
			case 'toxic': target = 'tox'; break;
			case 'poison': target = 'psn'; break;
			case 'burn': target = 'brn'; break;
			case 'paralyze': target = 'par'; break;
			case 'freeze': target = 'frz'; break;
			case 'sleep': target = 'slp'; break;
			case 'confuse': target = 'confusion'; break;
			case 'trap': target = 'partiallytrapped'; break;
			case 'flinche': target = 'flinch'; break;
			}

			if (target in allStatus) {
				if (!searches['status']) searches['status'] = {};
				if ((searches['status'][target] && isNotSearch) || (searches['status'][target] === false && !isNotSearch)) return this.sendReplyBox('A search cannot both exclude and include a status.');
				searches['status'][target] = !isNotSearch;
				continue;
			}

			if (target in allVolatileStatus) {
				if (!searches['volatileStatus']) searches['volatileStatus'] = {};
				if ((searches['volatileStatus'][target] && isNotSearch) || (searches['volatileStatus'][target] === false && !isNotSearch)) return this.sendReplyBox('A search cannot both exclude and include a volitile status.');
				searches['volatileStatus'][target] = !isNotSearch;
				continue;
			}

			return this.sendReplyBox("'" + Tools.escapeHTML(oldTarget) + "' could not be found in any of the search categories.");
		}

		if (showAll && Object.size(searches) === 0 && !targetMon) return this.sendReplyBox("No search parameters other than 'all' were found. Try '/help movesearch' for more information on this command.");

		let dex = {};
		if (targetMon) {
			for (let move in lsetData) {
				dex[move] = Tools.getMove(move);
			}
		} else {
			for (let move in Tools.data.Movedex) {
				dex[move] = Tools.getMove(move);
			}
			delete dex.magikarpsrevenge;
		}

		for (let search in searches) {
			switch (search) {
			case 'type':
			case 'category':
				for (let move in dex) {
					if (searches[search][String(dex[move][search])] === false ||
						Object.count(searches[search], true) > 0 && !searches[search][String(dex[move][search])]) {
						delete dex[move];
					}
				}
				break;

			case 'flags':
				for (let flag in searches[search]) {
					for (let move in dex) {
						if (flag !== 'secondary') {
							if ((!dex[move].flags[flag] && searches[search][flag]) || (dex[move].flags[flag] && !searches[search][flag])) delete dex[move];
						} else {
							if (searches[search][flag]) {
								if (!dex[move].secondary && !dex[move].secondaries) delete dex[move];
							} else {
								if (dex[move].secondary && dex[move].secondaries) delete dex[move];
							}
						}
					}
				}
				break;

			case 'recovery':
				for (let move in dex) {
					let hasRecovery = (dex[move].drain || dex[move].flags.heal);
					if ((!hasRecovery && searches[search]) || (hasRecovery && !searches[search])) delete dex[move];
				}
				break;

			case 'property':
				for (let prop in searches[search]) {
					for (let move in dex) {
						if (typeof searches[search][prop].less === "number") {
							if (dex[move][prop] === true) {
								delete dex[move];
								continue;
							}
							if (dex[move][prop] > searches[search][prop].less) {
								delete dex[move];
								continue;
							}
						}
						if (typeof searches[search][prop].greater === "number") {
							if (dex[move][prop] === true) {
								if (dex[move].category === "Status") delete dex[move];
								continue;
							}
							if (dex[move][prop] < searches[search][prop].greater) {
								delete dex[move];
								continue;
							}
						}
					}
				}
				break;

			case 'boost':
				for (let boost in searches[search]) {
					for (let move in dex) {
						if (dex[move].boosts) {
							if ((dex[move].boosts[boost] > 0 && searches[search][boost]) ||
								(dex[move].boosts[boost] < 1 && !searches[search][boost])) continue;
						} else if (dex[move].secondary && dex[move].secondary.self && dex[move].secondary.self.boosts) {
							if ((dex[move].secondary.self.boosts[boost] > 0 && searches[search][boost]) ||
								(dex[move].secondary.self.boosts[boost] < 1 && !searches[search][boost])) continue;
						}
						delete dex[move];
					}
				}
				break;

			case 'status':
			case 'volatileStatus':
				for (let searchStatus in searches[search]) {
					for (let move in dex) {
						if (dex[move][search] !== searchStatus) {
							if (!dex[move].secondaries) {
								if (!dex[move].secondary) {
									if (searches[search][searchStatus]) delete dex[move];
								} else {
									if ((dex[move].secondary[search] !== searchStatus && searches[search][searchStatus]) ||
										(dex[move].secondary[search] === searchStatus && !searches[search][searchStatus])) delete dex[move];
								}
							} else {
								let hasSecondary = false;
								for (let i = 0; i < dex[move].secondaries.length; i++) {
									if (dex[move].secondaries[i][search] === searchStatus) hasSecondary = true;
								}
								if ((!hasSecondary && searches[search][searchStatus]) || (hasSecondary && !searches[search][searchStatus])) delete dex[move];
							}
						} else {
							if (!searches[search][searchStatus]) delete dex[move];
						}
					}
				}
				break;

			default:
				throw new Error("/movesearch search category '" + search + "' was unrecognised.");
			}
		}

		let results = [];
		for (let move in dex) {
			results.push(dex[move].name);
		}

		let resultsStr = "";
		if (targetMon) {
			resultsStr += "<font color=#999999>Matching moves found in learnset for</font> " + targetMon + ":<br>";
		} else {
			resultsStr += this.broadcasting ? "" : ("<font color=#999999>" + Tools.escapeHTML(message) + ":</font><br>");
		}
		if (results.length > 0) {
			if (showAll || results.length <= RESULTS_MAX_LENGTH + 5) {
				results.sort();
				resultsStr += results.join(", ");
			} else {
				resultsStr += results.slice(0, RESULTS_MAX_LENGTH).join(", ") + ", and " + (results.length - RESULTS_MAX_LENGTH) + " more. <font color=#999999>Redo the search with 'all' as a search parameter to show all results.</font>";
			}
		} else {
			resultsStr += "No moves found.";
		}
		return this.sendReplyBox(resultsStr);
	},
	movesearchhelp: ["/movesearch [parameter], [parameter], [parameter], ... - Searches for moves that fulfill the selected criteria.",
		"Search categories are: type, category, flag, status inflicted, type boosted, and numeric range for base power, pp, and accuracy.",
		"Types must be followed by ' type', e.g., 'dragon type'.",
		"Stat boosts must be preceded with 'boosts ', e.g., 'boosts attack' searches for moves that boost the attack stat.",
		"Inequality ranges use the characters '>' and '<' though they behave as '≥' and '≤', e.g., 'bp > 100' searches for all moves equal to and greater than 100 base power.",
		"Parameters can be excluded through the use of '!', e.g., !water type' excludes all water type moves.",
		"Valid flags are: authentic (bypasses substitute), bite, bullet, contact, defrost, powder, pulse, punch, secondary, snatch, sound",
		"If a Pok\u00e9mon is included as a parameter, moves will be searched from it's movepool.",
		"The order of the parameters does not matter."],

	isearch: 'itemsearch',
	itemsearch: function (target, room, user, connection, cmd, message) {
		if (!target) return this.parse('/help itemsearch');
		if (!this.canBroadcast()) return;

		let showAll = false;

		target = target.trim();
		if (target.substr(target.length - 5) === ', all' || target.substr(target.length - 4) === ',all') {
			showAll = true;
			target = target.substr(0, target.length - 5);
		}

		target = target.toLowerCase().replace('-', ' ').replace(/[^a-z0-9.\s\/]/g, '');
		let rawSearch = target.split(' ');
		let searchedWords = [];
		let foundItems = [];

		//refine searched words
		for (let i = 0; i < rawSearch.length; i++) {
			let newWord = rawSearch[i].trim();
			if (isNaN(newWord)) newWord = newWord.replace('.', '');
			switch (newWord) {
			// words that don't really help identify item removed to speed up search
			case 'a':
			case 'an':
			case 'is':
			case 'it':
			case 'its':
			case 'the':
			case 'that':
			case 'which':
			case 'user':
			case 'holder':
			case 'holders':
				newWord = '';
				break;
			// replace variations of common words with standardized versions
			case 'opponent': newWord = 'attacker'; break;
			case 'flung': newWord = 'fling'; break;
			case 'heal': case 'heals':
			case 'recovers': newWord = 'restores'; break;
			case 'boost':
			case 'boosts': newWord = 'raises'; break;
			case 'weakens': newWord = 'halves'; break;
			case 'more': newWord = 'increases'; break;
			case 'super':
				if (rawSearch[i + 1] === 'effective') {
					newWord = 'supereffective';
				}
				break;
			case 'special': newWord = 'sp'; break;
			case 'spa':
				newWord = 'sp';
				break;
			case 'atk':
			case 'attack':
				if (rawSearch[i - 1] === 'sp') {
					newWord = 'atk';
				} else {
					newWord = 'attack';
				}
				break;
			case 'spd':
				newWord = 'sp';
				break;
			case 'def':
			case 'defense':
				if (rawSearch[i - 1] === 'sp') {
					newWord = 'def';
				} else {
					newWord = 'defense';
				}
				break;
			case 'burns': newWord = 'burn'; break;
			case 'poisons': newWord = 'poison'; break;
			default:
				if (/x[\d\.]+/.test(newWord)) {
					newWord = newWord.substr(1) + 'x';
				}
			}
			if (!newWord || searchedWords.indexOf(newWord) >= 0) continue;
			searchedWords.push(newWord);
		}

		if (searchedWords.length === 0) return this.sendReplyBox("No distinguishing words were used. Try a more specific search.");
		if (searchedWords.indexOf('fling') >= 0) {
			let basePower = 0;
			let effect;

			for (let k = 0; k < searchedWords.length; k++) {
				let wordEff = "";
				switch (searchedWords[k]) {
				case 'burn': case 'burns':
				case 'brn': wordEff = 'brn'; break;
				case 'paralyze': case 'paralyzes':
				case 'par': wordEff = 'par'; break;
				case 'poison': case 'poisons':
				case 'psn': wordEff = 'psn'; break;
				case 'toxic':
				case 'tox': wordEff = 'tox'; break;
				case 'flinches':
				case 'flinch': wordEff = 'flinch'; break;
				case 'badly': wordEff = 'tox'; break;
				}
				if (wordEff && effect) {
					if (!(wordEff === 'psn' && effect === 'tox')) return this.sendReplyBox("Only specify fling effect once.");
				} else if (wordEff) {
					effect = wordEff;
				} else {
					if (searchedWords[k].substr(searchedWords[k].length - 2) === 'bp' && searchedWords[k].length > 2) searchedWords[k] = searchedWords[k].substr(0, searchedWords[k].length - 2);
					if (Number.isInteger(Number(searchedWords[k]))) {
						if (basePower) return this.sendReplyBox("Only specify a number for base power once.");
						basePower = parseInt(searchedWords[k], 10);
					}
				}
			}

			for (let n in Tools.data.Items) {
				let item = Tools.getItem(n);
				if (!item.fling) continue;

				if (basePower && effect) {
					if (item.fling.basePower === basePower &&
					(item.fling.status === effect || item.fling.volatileStatus === effect)) foundItems.push(item.name);
				} else if (basePower) {
					if (item.fling.basePower === basePower) foundItems.push(item.name);
				} else {
					if (item.fling.status === effect || item.fling.volatileStatus === effect) foundItems.push(item.name);
				}
			}
			if (foundItems.length === 0) return this.sendReplyBox('No items inflict ' + basePower + 'bp damage when used with Fling.');
		} else if (target.search(/natural ?gift/i) >= 0) {
			let basePower = 0;
			let type = "";

			for (let k = 0; k < searchedWords.length; k++) {
				searchedWords[k] = searchedWords[k].capitalize();
				if (searchedWords[k] in Tools.data.TypeChart) {
					if (type) return this.sendReplyBox("Only specify natural gift type once.");
					type = searchedWords[k];
				} else {
					if (searchedWords[k].substr(searchedWords[k].length - 2) === 'bp' && searchedWords[k].length > 2) searchedWords[k] = searchedWords[k].substr(0, searchedWords[k].length - 2);
					if (Number.isInteger(Number(searchedWords[k]))) {
						if (basePower) return this.sendReplyBox("Only specify a number for base power once.");
						basePower = parseInt(searchedWords[k], 10);
					}
				}
			}

			for (let n in Tools.data.Items) {
				let item = Tools.getItem(n);
				if (!item.isBerry) continue;

				if (basePower && type) {
					if (item.naturalGift.basePower === basePower && item.naturalGift.type === type) foundItems.push(item.name);
				} else if (basePower) {
					if (item.naturalGift.basePower === basePower) foundItems.push(item.name);
				} else {
					if (item.naturalGift.type === type) foundItems.push(item.name);
				}
			}
			if (foundItems.length === 0) return this.sendReplyBox('No berries inflict ' + basePower + 'bp damage when used with Natural Gift.');
		} else {
			let bestMatched = 0;
			for (let n in Tools.data.Items) {
				let item = Tools.getItem(n);
				let matched = 0;
				// splits words in the description into a toId()-esk format except retaining / and . in numbers
				let descWords = item.desc;
				// add more general quantifier words to descriptions
				if (/[1-9\.]+x/.test(descWords)) descWords += ' increases';
				if (item.isBerry) descWords += ' berry';
				descWords = descWords.replace(/super[\-\s]effective/g, 'supereffective');
				descWords = descWords.toLowerCase().replace('-', ' ').replace(/[^a-z0-9\s\/]/g, '').replace(/(\D)\./, function (p0, p1) { return p1; }).split(' ');

				for (let k = 0; k < searchedWords.length; k++) {
					if (descWords.indexOf(searchedWords[k]) >= 0) matched++;
				}

				if (matched >= bestMatched && matched >= (searchedWords.length * 3 / 5)) foundItems.push(item.name);
				if (matched > bestMatched) bestMatched = matched;
			}

			// iterate over found items again to make sure they all are the best match
			for (let l = 0; l < foundItems.length; l++) {
				let item = Tools.getItem(foundItems[l]);
				let matched = 0;
				let descWords = item.desc;
				if (/[1-9\.]+x/.test(descWords)) descWords += ' increases';
				if (item.isBerry) descWords += ' berry';
				descWords = descWords.replace(/super[\-\s]effective/g, 'supereffective');
				descWords = descWords.toLowerCase().replace('-', ' ').replace(/[^a-z0-9\s\/]/g, '').replace(/(\D)\./, function (p0, p1) { return p1; }).split(' ');

				for (let k = 0; k < searchedWords.length; k++) {
					if (descWords.indexOf(searchedWords[k]) >= 0) matched++;
				}

				if (matched !== bestMatched) {
					foundItems.splice(l, 1);
					l--;
				}
			}
		}

		let resultsStr = this.broadcasting ? "" : ("<font color=#999999>" + Tools.escapeHTML(message) + ":</font><br>");
		if (foundItems.length > 0) {
			if (showAll || foundItems.length <= RESULTS_MAX_LENGTH + 5) {
				foundItems.sort();
				resultsStr += foundItems.join(", ");
			} else {
				resultsStr += foundItems.slice(0, RESULTS_MAX_LENGTH).join(", ") + ", and " + (foundItems.length - RESULTS_MAX_LENGTH) + " more. <font color=#999999>Redo the search with ', all' at the end to show all results.</font>";
			}
		} else {
			resultsStr += "No items found. Try a more general search";
		}
		return this.sendReplyBox(resultsStr);
	},
	itemsearchhelp: ["/itemsearch [move description] - finds items that match the given key words.",
	"Command accepts natural language. (tip: fewer words tend to work better)",
	"Searches with \"fling\" in them will find items with the specified Fling behavior.",
	"Searches with \"natural gift\" in them will find items with the specified Natural Gift behavior."],

	learnset: 'learn',
	learnall: 'learn',
	learn5: 'learn',
	g6learn: 'learn',
	rbylearn: 'learn',
	gsclearn: 'learn',
	advlearn: 'learn',
	dpplearn: 'learn',
	bw2learn: 'learn',
	learn: function (target, room, user, connection, cmd) {
		if (!target) return this.parse('/help learn');

		if (!this.canBroadcast()) return;

		let lsetData = {set:{}};
		let targets = target.split(',');
		let template = Tools.getTemplate(targets[0]);
		let move = {};
		let problem;
		let format = {rby:'gen1ou', gsc:'gen2ou', adv:'gen3ou', dpp:'gen4ou', bw2:'gen5ou'}[cmd.substring(0, 3)];
		let all = (cmd === 'learnall');
		if (cmd === 'learn5') lsetData.set.level = 5;
		if (cmd === 'g6learn') lsetData.format = {noPokebank: true};

		if (!template.exists) {
			return this.errorReply("Pok\u00e9mon '" + template.id + "' not found.");
		}

		if (targets.length < 2) {
			return this.errorReply("You must specify at least one move.");
		}

		for (let i = 1, len = targets.length; i < len; ++i) {
			move = Tools.getMove(targets[i]);
			if (!move.exists) {
				return this.errorReply("Move '" + move.id + "' not found.");
			}
			problem = TeamValidator.checkLearnsetSync(format, move, template.species, lsetData);
			if (problem) break;
		}
		let buffer = template.name + (problem ? " <span class=\"message-learn-cannotlearn\">can't</span> learn " : " <span class=\"message-learn-canlearn\">can</span> learn ") + (targets.length > 2 ? "these moves" : move.name);
		if (format) buffer += ' on ' + cmd.substring(0, 3).toUpperCase();
		if (!problem) {
			let sourceNames = {E:"egg", S:"event", D:"dream world"};
			if (lsetData.sources || lsetData.sourcesBefore) buffer += " only when obtained from:<ul class=\"message-learn-list\">";
			if (lsetData.sources) {
				let sources = lsetData.sources.sort();
				let prevSourceType;
				let prevSourceCount = 0;
				for (let i = 0, len = sources.length; i < len; ++i) {
					let source = sources[i];
					if (source.substr(0, 2) === prevSourceType) {
						if (prevSourceCount < 0) {
							buffer += ": " + source.substr(2);
						} else if (all || prevSourceCount < 3) {
							buffer += ", " + source.substr(2);
						} else if (prevSourceCount === 3) {
							buffer += ", ...";
						}
						++prevSourceCount;
						continue;
					}
					prevSourceType = source.substr(0, 2);
					prevSourceCount = source.substr(2) ? 0 : -1;
					buffer += "<li>gen " + source.charAt(0) + " " + sourceNames[source.charAt(1)];
					if (prevSourceType === '5E' && template.maleOnlyHidden) buffer += " (cannot have hidden ability)";
					if (source.substr(2)) buffer += ": " + source.substr(2);
				}
			}
			if (lsetData.sourcesBefore) {
				if (!(cmd.substring(0, 3) in {'rby':1, 'gsc':1})) {
					buffer += "<li>any generation before " + (lsetData.sourcesBefore + 1);
				} else if (!lsetData.sources) {
					buffer += "<li>gen " + lsetData.sourcesBefore;
				}
			}
			buffer += "</ul>";
		}
		this.sendReplyBox(buffer);
	},
	learnhelp: ["/learn [pokemon], [move, move, ...] - Displays how a Pok\u00e9mon can learn the given moves, if it can at all.",
		"!learn [pokemon], [move, move, ...] - Show everyone that information. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	weaknesses: 'weakness',
	weak: 'weakness',
	resist: 'weakness',
	weakness: function (target, room, user) {
		if (!target) return this.parse('/help weakness');
		if (!this.canBroadcast()) return;
		target = target.trim();
		let targets = target.split(/ ?[,\/ ] ?/);

		let pokemon = Tools.getTemplate(target);
		let type1 = Tools.getType(targets[0]);
		let type2 = Tools.getType(targets[1]);

		if (pokemon.exists) {
			target = pokemon.species;
		} else if (type1.exists && type2.exists && type1 !== type2) {
			pokemon = {types: [type1.id, type2.id]};
			target = type1.id + "/" + type2.id;
		} else if (type1.exists) {
			pokemon = {types: [type1.id]};
			target = type1.id;
		} else {
			return this.sendReplyBox("" + Tools.escapeHTML(target) + " isn't a recognized type or pokemon.");
		}

		let weaknesses = [];
		let resistances = [];
		let immunities = [];
		Object.keys(Tools.data.TypeChart).forEach(function (type) {
			let notImmune = Tools.getImmunity(type, pokemon);
			if (notImmune) {
				let typeMod = Tools.getEffectiveness(type, pokemon);
				switch (typeMod) {
				case 1:
					weaknesses.push(type);
					break;
				case 2:
					weaknesses.push("<b>" + type + "</b>");
					break;
				case -1:
					resistances.push(type);
					break;
				case -2:
					resistances.push("<b>" + type + "</b>");
					break;
				}
			} else {
				immunities.push(type);
			}
		});

		let buffer = [];
		buffer.push(pokemon.exists ? "" + target + ' (ignoring abilities):' : '' + target + ':');
		buffer.push('<span class="message-effect-weak">Weaknesses</span>: ' + (weaknesses.join(', ') || '<font color=#999999>None</font>'));
		buffer.push('<span class="message-effect-resist">Resistances</span>: ' + (resistances.join(', ') || '<font color=#999999>None</font>'));
		buffer.push('<span class="message-effect-immune">Immunities</span>: ' + (immunities.join(', ') || '<font color=#999999>None</font>'));
		this.sendReplyBox(buffer.join('<br>'));
	},
	weaknesshelp: ["/weakness [pokemon] - Provides a Pok\u00e9mon's resistances, weaknesses, and immunities, ignoring abilities.",
		"/weakness [type 1]/[type 2] - Provides a type or type combination's resistances, weaknesses, and immunities, ignoring abilities.",
		"!weakness [pokemon] - Shows everyone a Pok\u00e9mon's resistances, weaknesses, and immunities, ignoring abilities. Requires: " + Users.getGroupsThatCan('broadcast').join(" "),
		"!weakness [type 1]/[type 2] - Shows everyone a type or type combination's resistances, weaknesses, and immunities, ignoring abilities. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	eff: 'effectiveness',
	type: 'effectiveness',
	matchup: 'effectiveness',
	effectiveness: function (target, room, user) {
		let targets = target.split(/[,/]/).slice(0, 2);
		if (targets.length !== 2) return this.errorReply("Attacker and defender must be separated with a comma.");

		let searchMethods = {'getType':1, 'getMove':1, 'getTemplate':1};
		let sourceMethods = {'getType':1, 'getMove':1};
		let targetMethods = {'getType':1, 'getTemplate':1};
		let source, defender, foundData, atkName, defName;

		for (let i = 0; i < 2; ++i) {
			let method;
			for (method in searchMethods) {
				foundData = Tools[method](targets[i]);
				if (foundData.exists) break;
			}
			if (!foundData.exists) return this.parse('/help effectiveness');
			if (!source && method in sourceMethods) {
				if (foundData.type) {
					source = foundData;
					atkName = foundData.name;
				} else {
					source = foundData.id;
					atkName = foundData.id;
				}
				searchMethods = targetMethods;
			} else if (!defender && method in targetMethods) {
				if (foundData.types) {
					defender = foundData;
					defName = foundData.species + " (not counting abilities)";
				} else {
					defender = {types: [foundData.id]};
					defName = foundData.id;
				}
				searchMethods = sourceMethods;
			}
		}

		if (!this.canBroadcast()) return;

		let factor = 0;
		if (Tools.getImmunity(source, defender) || source.ignoreImmunity && (source.ignoreImmunity === true || source.ignoreImmunity[source.type])) {
			let totalTypeMod = 0;
			if (source.effectType !== 'Move' || source.category !== 'Status' && (source.basePower || source.basePowerCallback)) {
				for (let i = 0; i < defender.types.length; i++) {
					let baseMod = Tools.getEffectiveness(source, defender.types[i]);
					let moveMod = source.onEffectiveness && source.onEffectiveness.call(Tools, baseMod, defender.types[i], source);
					totalTypeMod += typeof moveMod === 'number' ? moveMod : baseMod;
				}
			}
			factor = Math.pow(2, totalTypeMod);
		}

		let hasThousandArrows = source.id === 'thousandarrows' && defender.types.indexOf('Flying') >= 0;
		let additionalInfo = hasThousandArrows ? "<br>However, Thousand Arrows will be 1x effective on the first hit." : "";

		this.sendReplyBox("" + atkName + " is " + factor + "x effective against " + defName + "." + additionalInfo);
	},
	effectivenesshelp: ["/effectiveness [attack], [defender] - Provides the effectiveness of a move or type on another type or a Pok\u00e9mon.",
		"!effectiveness [attack], [defender] - Shows everyone the effectiveness of a move or type on another type or a Pok\u00e9mon."],

	cover: 'coverage',
	coverage: function (target, room, user) {
		if (!this.canBroadcast()) return;
		if (!target) return this.parse("/help coverage");

		let targets = target.split(/[,+]/);
		let sources = [];

		let dispTable = false;
		let bestCoverage = {};
		let hasThousandArrows = false;

		for (let type in Tools.data.TypeChart) {
			// This command uses -5 to designate immunity
			bestCoverage[type] = -5;
		}

		for (let i = 0; i < targets.length; i++) {
			let move = targets[i].trim().capitalize();
			if (move === 'Table' || move === 'All') {
				if (this.broadcasting) return this.sendReplyBox("The full table cannot be broadcast.");
				dispTable = true;
				continue;
			}

			let eff;
			if (move in Tools.data.TypeChart) {
				sources.push(move);
				for (let type in bestCoverage) {
					if (!Tools.getImmunity(move, type) && !move.ignoreImmunity) continue;
					eff = Tools.getEffectiveness(move, type);
					if (eff > bestCoverage[type]) bestCoverage[type] = eff;
				}
				continue;
			}
			move = Tools.getMove(move);
			if (move.exists) {
				if (!move.basePower && !move.basePowerCallback) continue;
				if (move.id === 'thousandarrows') hasThousandArrows = true;
				sources.push(move);
				for (let type in bestCoverage) {
					if (move.id === "struggle") {
						eff = 0;
					} else {
						if (!Tools.getImmunity(move.type, type) && !move.ignoreImmunity) continue;
						let baseMod = Tools.getEffectiveness(move, type);
						let moveMod = move.onEffectiveness && move.onEffectiveness.call(Tools, baseMod, type, move);
						eff = typeof moveMod === 'number' ? moveMod : baseMod;
					}
					if (eff > bestCoverage[type]) bestCoverage[type] = eff;
				}
				continue;
			}

			return this.sendReply("No type or move '" + targets[i] + "' found.");
		}
		if (sources.length === 0) return this.errorReply("No moves using a type table for determining damage were specified.");
		if (sources.length > 4) return this.errorReply("Specify a maximum of 4 moves or types.");

		// converts to fractional effectiveness, 0 for immune
		for (let type in bestCoverage) {
			if (bestCoverage[type] === -5) {
				bestCoverage[type] = 0;
				continue;
			}
			bestCoverage[type] = Math.pow(2, bestCoverage[type]);
		}

		if (!dispTable) {
			let buffer = [];
			let superEff = [];
			let neutral = [];
			let resists = [];
			let immune = [];

			for (let type in bestCoverage) {
				switch (bestCoverage[type]) {
				case 0:
					immune.push(type);
					break;
				case 0.25:
				case 0.5:
					resists.push(type);
					break;
				case 1:
					neutral.push(type);
					break;
				case 2:
				case 4:
					superEff.push(type);
					break;
				default:
					throw new Error("/coverage effectiveness of " + bestCoverage[type] + " from parameters: " + target);
				}
			}
			buffer.push('Coverage for ' + sources.join(' + ') + ':');
			buffer.push('<b><font color=#559955>Super Effective</font></b>: ' + (superEff.join(', ') || '<font color=#999999>None</font>'));
			buffer.push('<span class="message-effect-resist">Neutral</span>: ' + (neutral.join(', ') || '<font color=#999999>None</font>'));
			buffer.push('<span class="message-effect-weak">Resists</span>: ' + (resists.join(', ') || '<font color=#999999>None</font>'));
			buffer.push('<span class="message-effect-immune">Immunities</span>: ' + (immune.join(', ') || '<font color=#999999>None</font>'));
			return this.sendReplyBox(buffer.join('<br>'));
		} else {
			let buffer = '<div class="scrollable"><table cellpadding="1" width="100%"><tr><th></th>';
			let icon = {};
			for (let type in Tools.data.TypeChart) {
				icon[type] = '<img src="https://play.pokemonshowdown.com/sprites/types/' + type + '.png" width="32" height="14">';
				// row of icons at top
				buffer += '<th>' + icon[type] + '</th>';
			}
			buffer += '</tr>';
			for (let type1 in Tools.data.TypeChart) {
				// assembles the rest of the rows
				buffer += '<tr><th>' + icon[type1] + '</th>';
				for (let type2 in Tools.data.TypeChart) {
					let typing;
					let cell = '<th ';
					let bestEff = -5;
					if (type1 === type2) {
						// when types are the same it's considered pure type
						typing = type1;
						bestEff = bestCoverage[type1];
					} else {
						typing = type1 + "/" + type2;
						for (let i = 0; i < sources.length; i++) {
							let move = sources[i];

							let curEff = 0;
							if ((!Tools.getImmunity((move.type || move), type1) || !Tools.getImmunity((move.type || move), type2)) && !move.ignoreImmunity) continue;
							let baseMod = Tools.getEffectiveness(move, type1);
							let moveMod = move.onEffectiveness && move.onEffectiveness.call(Tools, baseMod, type1, move);
							curEff += typeof moveMod === 'number' ? moveMod : baseMod;
							baseMod = Tools.getEffectiveness(move, type2);
							moveMod = move.onEffectiveness && move.onEffectiveness.call(Tools, baseMod, type2, move);
							curEff += typeof moveMod === 'number' ? moveMod : baseMod;

							if (curEff > bestEff) bestEff = curEff;
						}
						if (bestEff === -5) {
							bestEff = 0;
						} else {
							bestEff = Math.pow(2, bestEff);
						}
					}
					switch (bestEff) {
					case 0:
						cell += 'bgcolor=#666666 title="' + typing + '"><font color=#000000>' + bestEff + '</font>';
						break;
					case 0.25:
					case 0.5:
						cell += 'bgcolor=#AA5544 title="' + typing + '"><font color=#660000>' + bestEff + '</font>';
						break;
					case 1:
						cell += 'bgcolor=#6688AA title="' + typing + '"><font color=#000066>' + bestEff + '</font>';
						break;
					case 2:
					case 4:
						cell += 'bgcolor=#559955 title="' + typing + '"><font color=#003300>' + bestEff + '</font>';
						break;
					default:
						throw new Error("/coverage effectiveness of " + bestEff + " from parameters: " + target);
					}
					cell += '</th>';
					buffer += cell;
				}
			}
			buffer += '</table></div>';

			if (hasThousandArrows) {
				buffer += "<br><b>Thousand Arrows has neutral type effectiveness on Flying-type Pok\u00e9mon if not already smacked down.";
			}

			this.sendReplyBox('Coverage for ' + sources.join(' + ') + ':<br>' + buffer);
		}
	},
	coveragehelp: ["/coverage [move 1], [move 2] ... - Provides the best effectiveness match-up against all defending types for given moves or attacking types",
		"!coverage [move 1], [move 2] ... - Shows this information to everyone.",
		"Adding the parameter 'all' or 'table' will display the information with a table of all type combinations."],

	statcalc: function (target, room, user) {
		if (!this.canBroadcast()) return;
		if (!target) return this.parse("/help statcalc");

		let targets = target.split(' ');

		let lvlSet, natureSet, ivSet, evSet, baseSet, modSet = false;

		let pokemon;
		let useStat = '';

		let level = 100;
		let calcHP = false;
		let nature = 1.0;
		let iv = 31;
		let ev = 252;
		let statValue = -1;
		let modifier = 0;
		let positiveMod = true;

		for (let i = 0; i < targets.length; i++) {
			let lowercase = targets[i].toLowerCase();

			if (!lvlSet) {
				if (lowercase === 'lc') {
					level = 5;
					lvlSet = true;
					continue;
				} else if (lowercase === 'vgc') {
					level = 50;
					lvlSet = true;
					continue;
				} else if (lowercase.startsWith('lv') || lowercase.startsWith('level')) {
					level = parseInt(targets[i].replace(/\D/g, ''), 10);
					lvlSet = true;
					if (level < 1 || level > 9999) {
						return this.sendReplyBox('Invalid value for level: ' + level);
					}
					continue;
				}
			}

			if (!useStat) {
				switch (lowercase) {
				case 'hp':
				case 'hitpoints':
					calcHP = true;
					useStat = 'hp';
					continue;
				case 'atk':
				case 'attack':
					useStat = 'atk';
					continue;
				case 'def':
				case 'defense':
					useStat = 'def';
					continue;
				case 'spa':
					useStat = 'spa';
					continue;
				case 'spd':
				case 'sdef':
					useStat = 'spd';
					continue;
				case 'spe':
				case 'speed':
					useStat = 'spe';
					continue;
				}
			}

			if (!natureSet) {
				if (lowercase === 'boosting' || lowercase === 'positive') {
					nature = 1.1;
					natureSet = true;
					continue;
				} else if (lowercase === 'negative' || lowercase === 'inhibiting') {
					nature = 0.9;
					natureSet = true;
					continue;
				} else if (lowercase === 'neutral') {
					continue;
				}
			}

			if (!ivSet) {
				if (lowercase.endsWith('iv') || lowercase.endsWith('ivs')) {
					iv = parseInt(targets[i], 10);
					ivSet = true;

					if (isNaN(iv)) {
						return this.sendReplyBox('Invalid value for IVs: ' + Tools.escapeHTML(targets[i]));
					}

					continue;
				}
			}

			if (!evSet) {
				if (lowercase === 'invested' || lowercase === 'max') {
					evSet = true;
				} else if (lowercase === 'uninvested') {
					ev = 0;
					evSet = true;
				} else if (lowercase.endsWith('ev') || lowercase.endsWith('evs')) {
					ev = parseInt(targets[i], 10);
					evSet = true;

					if (isNaN(ev)) {
						return this.sendReplyBox('Invalid value for EVs: ' + Tools.escapeHTML(targets[i]));
					}
					if (ev > 255 || ev < 0) {
						return this.sendReplyBox('The amount of EVs should be between 0 and 255.');
					}

					if (!natureSet) {
						if (targets[i].indexOf('+') > -1) {
							nature = 1.1;
							natureSet = true;
						} else if (targets[i].indexOf('-') > -1) {
							nature = 0.9;
							natureSet = true;
						}
					}

					continue;
				}
			}

			if (!modSet) {
				if (targets[i] === 'scarf' || targets[i] === 'specs' || targets[i] === 'band') {
					modifier = 1;
					modSet = true;
				} else if (targets[i].charAt(0) === '+') {
					modifier = parseInt(targets[i].charAt(1), 10);
					modSet = true;
				} else if (targets[i].charAt(0) === '-') {
					positiveMod = false;
					modifier = parseInt(targets[i].charAt(1), 10);
					modSet = true;
				}
				if (isNaN(modifier)) {
					return this.sendReplyBox('Invalid value for modifier: ' + Tools.escapeHTML(modifier));
				}
				if (modifier > 6) {
					return this.sendReplyBox('Modifier should be a number between -6 and +6');
				}
			}

			if (!pokemon) {
				let testPoke = Tools.getTemplate(targets[i]);
				if (testPoke.baseStats) {
					pokemon = testPoke.baseStats;
					baseSet = true;
					continue;
				}
			}

			let tempStat = parseInt(targets[i], 10);

			if (!isNaN(tempStat) && !baseSet && tempStat > 0 && tempStat < 256) {
				statValue = tempStat;
				baseSet = true;
			}
		}

		if (pokemon) {
			if (useStat) {
				statValue = pokemon[useStat];
			} else {
				return this.sendReplyBox('No stat found.');
			}
		}

		if (statValue < 0) {
			return this.sendReplyBox('No valid value for base stat found.');
		}

		let output;

		if (calcHP) {
			output = (((iv + (2 * statValue) + (ev / 4) + 100) * level) / 100) + 10;
		} else {
			output = Math.floor((((iv + (2 * statValue) + (ev / 4)) * level) / 100) + 5) * nature;
			if (positiveMod) {
				output *= (2 + modifier) / 2;
			} else {
				output *= 2 / (2 + modifier);
			}
		}
		return this.sendReplyBox('Base ' + statValue + (calcHP ? ' HP ' : ' ') + 'at level ' + level + ' with ' + iv + ' IVs, ' + ev + (nature === 1.1 ? '+' : (nature === 0.9 ? '-' : '')) + ' EVs' + (modifier > 0 && !calcHP ? ' at ' + (positiveMod ? '+' : '-') + modifier : '') + ': <b>' + Math.floor(output) + '</b>.');
	},

	statcalchelp: ["/statcalc [level] [base stat] [IVs] [nature] [EVs] [modifier] (only base stat is required) - Calculates what the actual stat of a Pokémon is with the given parameters. For example, '/statcalc lv50 100 30iv positive 252 scarf' calculates the speed of a base 100 scarfer with HP Ice in Battle Spot, and '/statcalc uninvested 90 neutral' calculates the attack of an uninvested Crobat.",
		"!statcalc [level] [base stat] [IVs] [nature] [EVs] [modifier] (only base stat is required) - Shows this information to everyone.",
		"Inputing 'hp' as an argument makes it use the formula for HP. Instead of giving nature, '+' and '-' can be appended to the EV amount to signify a boosting or inihibting nature."],

	/*********************************************************
	 * Informational commands
	 *********************************************************/

	uptime: function (target, room, user) {
		if (!this.canBroadcast()) return;
		let uptime = process.uptime();
		let uptimeText;
		if (uptime > 24 * 60 * 60) {
			let uptimeDays = Math.floor(uptime / (24 * 60 * 60));
			uptimeText = uptimeDays + " " + (uptimeDays === 1 ? "day" : "days");
			let uptimeHours = Math.floor(uptime / (60 * 60)) - uptimeDays * 24;
			if (uptimeHours) uptimeText += ", " + uptimeHours + " " + (uptimeHours === 1 ? "hour" : "hours");
		} else {
			uptimeText = uptime.seconds().duration();
		}
		this.sendReplyBox("Uptime: <b>" + uptimeText + "</b>");
	},

	groups: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox(Config.groups.byRank.reduce(function (info, group) {
			if (!Config.groups.bySymbol[group].name || !Config.groups.bySymbol[group].description) {
				return info;
			}
			return info + (info ? "<br />" : "") + Tools.escapeHTML(group) + " <strong>" + Tools.escapeHTML(Config.groups.bySymbol[group].name) + "</strong> - " + Tools.escapeHTML(Config.groups.bySymbol[group].description);
		}, ""));
	},
	groupshelp: ["/groups - Explains what the " + Users.getGroupsThatCan('description').join(" ") + " next to people's names mean.",
		"!groups - Shows everyone that information. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	repo: 'opensource',
	repository: 'opensource',
	git: 'opensource',
	opensource: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"Pok&eacute;mon Showdown is open source:<br />" +
			"- Language: JavaScript (Node.js or io.js)<br />" +
			"- <a href=\"https://github.com/Zarel/Pokemon-Showdown/commits/master\">What's new?</a><br />" +
			"- <a href=\"https://github.com/Zarel/Pokemon-Showdown\">Server source code</a><br />" +
			"- <a href=\"https://github.com/Zarel/Pokemon-Showdown-Client\">Client source code</a>"
		);
	},
	opensourcehelp: ["/opensource - Links to PS's source code repository.",
		"!opensource - Show everyone that information. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	staff: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("<a href=\"https://www.smogon.com/sim/staff_list\">Pok&eacute;mon Showdown Staff List</a>");
	},

	forums: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("<a href=\"https://www.smogon.com/forums/forums/pok%C3%A9mon-showdown.209\">Pok&eacute;mon Showdown Forums</a>");
	},

	suggestions: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("<a href=\"https://www.smogon.com/forums/threads/3534365/\">Make a suggestion for Pok&eacute;mon Showdown</a>");
	},

	bugreport: 'bugs',
	bugs: function (target, room, user) {
		if (!this.canBroadcast()) return;
		if (room.battle) {
			this.sendReplyBox("<center><button name=\"saveReplay\"><i class=\"fa fa-upload\"></i> Save Replay</button> &mdash; <a href=\"https://www.smogon.com/forums/threads/3520646/\">Questions</a> &mdash; <a href=\"https://www.smogon.com/forums/threads/3469932/\">Bug Reports</a></center>");
		} else {
			this.sendReplyBox(
				"Have a replay showcasing a bug on Pok&eacute;mon Showdown?<br />" +
				"- <a href=\"https://www.smogon.com/forums/threads/3520646/\">Questions</a><br />" +
				"- <a href=\"https://www.smogon.com/forums/threads/3469932/\">Bug Reports</a>"
			);
		}
	},

	avatars: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("You can <button name=\"avatars\">change your avatar</button> by clicking on it in the <button name=\"openOptions\"><i class=\"fa fa-cog\"></i> Options</button> menu in the upper right. Custom avatars are only obtainable by staff.");
	},
	avatarshelp: ["/avatars - Explains how to change avatars.",
		"!avatars - Show everyone that information. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	introduction: 'intro',
	intro: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"New to competitive Pok&eacute;mon?<br />" +
			"- <a href=\"https://www.smogon.com/sim/ps_guide\">Beginner's Guide to Pok&eacute;mon Showdown</a><br />" +
			"- <a href=\"https://www.smogon.com/dp/articles/intro_comp_pokemon\">An introduction to competitive Pok&eacute;mon</a><br />" +
			"- <a href=\"https://www.smogon.com/bw/articles/bw_tiers\">What do 'OU', 'UU', etc mean?</a><br />" +
			"- <a href=\"https://www.smogon.com/xyhub/tiers\">What are the rules for each format? What is 'Sleep Clause'?</a>"
		);
	},
	introhelp: ["/intro - Provides an introduction to competitive Pok\u00e9mon.",
		"!intro - Show everyone that information. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	mentoring: 'smogintro',
	smogonintro: 'smogintro',
	smogintro: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"Welcome to Smogon's official simulator! The <a href=\"https://www.smogon.com/forums/forums/264\">Smogon Info / Intro Hub</a> can help you get integrated into the community.<br />" +
			"- <a href=\"https://www.smogon.com/forums/threads/3526346\">Useful Smogon Info</a><br />" +
			"- <a href=\"https://www.smogon.com/forums/threads/3498332\">Tiering FAQ</a><br />"
		);
	},

	calculator: 'calc',
	calc: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"Pok&eacute;mon Showdown! damage calculator. (Courtesy of Honko)<br />" +
			"- <a href=\"https://pokemonshowdown.com/damagecalc/\">Damage Calculator</a>"
		);
	},
	calchelp: ["/calc - Provides a link to a damage calculator",
		"!calc - Shows everyone a link to a damage calculator. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	capintro: 'cap',
	cap: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"An introduction to the Create-A-Pok&eacute;mon project:<br />" +
			"- <a href=\"https://www.smogon.com/cap/\">CAP project website and description</a><br />" +
			"- <a href=\"https://www.smogon.com/forums/threads/48782/\">What Pok&eacute;mon have been made?</a><br />" +
			"- <a href=\"https://www.smogon.com/forums/forums/311\">Talk about the metagame here</a><br />" +
			"- <a href=\"https://www.smogon.com/forums/threads/3512318/\">Sample XY CAP teams</a>"
		);
	},
	caphelp: ["/cap - Provides an introduction to the Create-A-Pok&eacute;mon project.",
		"!cap - Show everyone that information. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	gennext: function (target, room, user) {
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"NEXT (also called Gen-NEXT) is a mod that makes changes to the game:<br />" +
			"- <a href=\"https://github.com/Zarel/Pokemon-Showdown/blob/master/mods/gennext/README.md\">README: overview of NEXT</a><br />" +
			"Example replays:<br />" +
			"- <a href=\"https://replay.pokemonshowdown.com/gennextou-120689854\">Zergo vs Mr Weegle Snarf</a><br />" +
			"- <a href=\"https://replay.pokemonshowdown.com/gennextou-130756055\">NickMP vs Khalogie</a>"
		);
	},

	om: 'othermetas',
	othermetas: function (target, room, user) {
		if (!this.canBroadcast()) return;
		target = toId(target);
		let buffer = "";

		if (target === 'all' && this.broadcasting) {
			return this.sendReplyBox("You cannot broadcast information about all Other Metagames at once.");
		}

		if (!target || target === 'all') {
			buffer += "- <a href=\"https://www.smogon.com/forums/forums/other-metagames.206/\">Other Metagames Forum</a><br />";
			buffer += "- <a href=\"https://www.smogon.com/forums/forums/other-metagames-analyses.310/\">Other Metagames Analyses</a><br />";
			if (!target) return this.sendReplyBox(buffer);
		}
		let showMonthly = (target === 'all' || target === 'omofthemonth' || target === 'omotm' || target === 'month');
		let monthBuffer = "- <a href=\"https://www.smogon.com/forums/threads/3541792/\">Other Metagame of the Month</a>";

		if (target === 'all') {
			// Display OMotM formats, with forum thread links as caption
			this.parse('/formathelp omofthemonth');
			if (showMonthly) this.sendReply('|raw|<center>' + monthBuffer + '</center>');

			// Display the rest of OM formats, with OM hub/index forum links as caption
			this.parse('/formathelp othermetagames');
			return this.sendReply('|raw|<center>' + buffer + '</center>');
		}
		if (showMonthly) {
			this.target = 'omofthemonth';
			this.run('formathelp');
			this.sendReply('|raw|<center>' + monthBuffer + '</center>');
		} else {
			this.run('formathelp');
		}
	},
	othermetashelp: ["/om - Provides links to information on the Other Metagames.",
		"!om - Show everyone that information. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	banlists: 'formathelp',
	tier: 'formathelp',
	tiers: 'formathelp',
	formats: 'formathelp',
	tiershelp: 'formathelp',
	formatshelp: 'formathelp',
	formathelp: function (target, room, user, connection, cmd) {
		if (!this.canBroadcast()) return;
		if (!target) {
			return this.sendReplyBox(
				"- <a href=\"https://www.smogon.com/tiers/\">Smogon Tiers</a><br />" +
				"- <a href=\"https://www.smogon.com/forums/threads/3498332/\">Tiering FAQ</a><br />" +
				"- <a href=\"https://www.smogon.com/xyhub/tiers\">The banlists for each tier</a><br />" +
				"<br /><em>Type /formatshelp <strong>[format|section]</strong> to get details about an available format or group of formats.</em>"
			);
		}
		let targetId = toId(target);
		if (targetId === 'ladder') targetId = 'search';
		if (targetId === 'all') targetId = '';

		let formatList;
		let format = Tools.getFormat(targetId);
		if (format.effectType === 'Format') formatList = [targetId];
		if (!formatList) {
			if (this.broadcasting && (cmd !== 'om' && cmd !== 'othermetas')) return this.sendReply("'" + target + "' is not a format. This command's search mode is too spammy to broadcast.");
			formatList = Object.keys(Tools.data.Formats).filter(function (formatid) {return Tools.data.Formats[formatid].effectType === 'Format';});
		}

		// Filter formats and group by section
		let exactMatch = '';
		let sections = {};
		let totalMatches = 0;
		for (let i = 0; i < formatList.length; i++) {
			let format = Tools.getFormat(formatList[i]);
			let sectionId = toId(format.section);
			if (targetId && !format[targetId + 'Show'] && sectionId !== targetId && format.id === formatList[i] && !format.id.startsWith(targetId)) continue;
			totalMatches++;
			if (!sections[sectionId]) sections[sectionId] = {name: format.section, formats: []};
			sections[sectionId].formats.push(format.id);
			if (format.id !== targetId) continue;
			exactMatch = sectionId;
			break;
		}

		if (!totalMatches) return this.sendReply("No " + (target ? "matched " : "") + "formats found.");
		if (totalMatches === 1) {
			let format = Tools.getFormat(Object.values(sections)[0].formats[0]);
			if (!format.desc) return this.sendReplyBox("No description found for this " + (format.gameType || "singles").capitalize() + " " + format.section + " format.");
			return this.sendReplyBox(format.desc.join("<br />"));
		}

		// Build tables
		let buf = [];
		for (let sectionId in sections) {
			if (exactMatch && sectionId !== exactMatch) continue;
			buf.push("<h3>" + Tools.escapeHTML(sections[sectionId].name) + "</h3>");
			buf.push("<table class=\"scrollable\" style=\"display:inline-block; max-height:200px; border:1px solid gray; border-collapse:collapse\" cellspacing=\"0\" cellpadding=\"5\"><thead><th style=\"border:1px solid gray\" >Name</th><th style=\"border:1px solid gray\" >Description</th></thead><tbody>");
			for (let i = 0; i < sections[sectionId].formats.length; i++) {
				let format = Tools.getFormat(sections[sectionId].formats[i]);
				buf.push("<tr><td style=\"border:1px solid gray\">" + Tools.escapeHTML(format.name) + "</td><td style=\"border: 1px solid gray; margin-left:10px\">" + (format.desc ? format.desc.join("<br />") : "&mdash;") + "</td></tr>");
			}
			buf.push("</tbody></table>");
		}
		return this.sendReply("|raw|<center>" + buf.join("") + "</center>");
	},

	roomhelp: function (target, room, user) {
		if (room.id === 'lobby' || room.battle) return this.sendReply("This command is too spammy for lobby/battles.");
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"Room drivers (%) can use:<br />" +
			"- /warn OR /k <em>username</em>: warn a user and show the Pok&eacute;mon Showdown rules<br />" +
			"- /mute OR /m <em>username</em>: 7 minute mute<br />" +
			"- /hourmute OR /hm <em>username</em>: 60 minute mute<br />" +
			"- /unmute <em>username</em>: unmute<br />" +
			"- /announce OR /wall <em>message</em>: make an announcement<br />" +
			"- /modlog <em>username</em>: search the moderator log of the room<br />" +
			"- /modnote <em>note</em>: adds a moderator note that can be read through modlog<br />" +
			"<br />" +
			"Room moderators (@) can also use:<br />" +
			"- /roomban OR /rb <em>username</em>: bans user from the room<br />" +
			"- /roomunban <em>username</em>: unbans user from the room<br />" +
			"- /roomvoice <em>username</em>: appoint a room voice<br />" +
			"- /roomdevoice <em>username</em>: remove a room voice<br />" +
			"- /modchat <em>[off/autoconfirmed/+]</em>: set modchat level<br />" +
			"- /staffintro <em>intro</em>: sets the staff introduction that will be displayed for all staff joining the room<br />" +
			"<br />" +
			"Room owners (#) can also use:<br />" +
			"- /roomintro <em>intro</em>: sets the room introduction that will be displayed for all users joining the room<br />" +
			"- /rules <em>rules link</em>: set the room rules link seen when using /rules<br />" +
			"- /roommod, /roomdriver <em>username</em>: appoint a room moderator/driver<br />" +
			"- /roomdemod, /roomdedriver <em>username</em>: remove a room moderator/driver<br />" +
			"- /roomdeauth <em>username</em>: remove all room auth from a user<br />" +
			"- /modchat <em>[%/@/#]</em>: set modchat level<br />" +
			"- /declare <em>message</em>: make a large blue declaration to the room<br />" +
			"- !htmlbox <em>HTML code</em>: broadcasts a box of HTML code to the room<br />" +
			"- !showimage <em>[url], [width], [height]</em>: shows an image to the room<br />" +
			"<br />" +
			"More detailed help can be found in the <a href=\"https://www.smogon.com/sim/roomauth_guide\">roomauth guide</a><br />" +
			"<br />" +
			"Tournament Help:<br />" +
			"- /tour create <em>format</em>, elimination: Creates a new single elimination tournament in the current room.<br />" +
			"- /tour create <em>format</em>, roundrobin: Creates a new round robin tournament in the current room.<br />" +
			"- /tour end: Forcibly ends the tournament in the current room<br />" +
			"- /tour start: Starts the tournament in the current room<br />" +
			"<br />" +
			"More detailed help can be found <a href=\"https://gist.github.com/verbiage/0846a552595349032fbe\">here</a><br />" +
			"</div>"
		);
	},

	restarthelp: function (target, room, user) {
		if (room.id === 'lobby' && !this.can('lockdown')) return false;
		if (!this.canBroadcast()) return;
		this.sendReplyBox(
			"The server is restarting. Things to know:<br />" +
			"- We wait a few minutes before restarting so people can finish up their battles<br />" +
			"- The restart itself will take around 0.6 seconds<br />" +
			"- Your ladder ranking and teams will not change<br />" +
			"- We are restarting to update Pok&eacute;mon Showdown to a newer version"
		);
	},

	rule: 'rules',
	rules: function (target, room, user) {
		if (!target) {
			if (!this.canBroadcast()) return;
			this.sendReplyBox("Please follow the rules:<br />" +
				(room.rulesLink ? "- <a href=\"" + Tools.escapeHTML(room.rulesLink) + "\">" + Tools.escapeHTML(room.title) + " room rules</a><br />" : "") +
				"- <a href=\"https://pokemonshowdown.com/rules\">" + (room.rulesLink ? "Global rules" : "Rules") + "</a>");
			return;
		}
		if (!this.can('declare', room)) return;
		if (target.length > 100) {
			return this.errorReply("Error: Room rules link is too long (must be under 100 characters). You can use a URL shortener to shorten the link.");
		}

		room.rulesLink = target.trim();
		this.sendReply("(The room rules link is now: " + target + ")");

		if (room.chatRoomData) {
			room.chatRoomData.rulesLink = room.rulesLink;
			Rooms.global.writeChatRoomData();
		}
	},

	faq: function (target, room, user) {
		if (!this.canBroadcast()) return;
		target = target.toLowerCase();
		let buffer = "";
		let matched = false;

		if (target === 'all' && this.broadcasting) {
			return this.sendReplyBox("You cannot broadcast all FAQs at once.");
		}

		if (!target || target === 'all') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq\">Frequently Asked Questions</a><br />";
		}
		if (target === 'all' || target === 'elo') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq#elo\">Why did this user gain or lose so many points?</a><br />";
		}
		if (target === 'all' || target === 'doubles' || target === 'triples' || target === 'rotation') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq#doubles\">Can I play doubles/triples/rotation battles here?</a><br />";
		}
		if (target === 'all' || target === 'restarts') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq#restarts\">Why is the server restarting?</a><br />";
		}
		if (target === 'all' || target === 'star' || target === 'player') {
			matched = true;
			buffer += '<a href="https://www.smogon.com/sim/faq#star">Why is there this star (&starf;) in front of my username?</a><br />';
		}
		if (target === 'all' || target === 'staff') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/staff_faq\">Staff FAQ</a><br />";
		}
		if (target === 'all' || target === 'autoconfirmed' || target === 'ac') {
			matched = true;
			buffer += "A user is autoconfirmed when they have won at least one rated battle and have been registered for a week or longer.<br />";
		}
		if (target === 'all' || target === 'customavatar' || target === 'ca') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq#customavatar\">How can I get a custom avatar?</a><br />";
		}
		if (target === 'all' || target === 'pm' || target === 'msg' || target === 'w') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq#pm\">How can I send a user a private message?</a><br />";
		}
		if (target === 'all' || target === 'challenge' || target === 'chall') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq#challenge\">How can I battle a specific user?</a><br />";
		}
		if (target === 'all' || target === 'gxe') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/sim/faq#gxe\">What does GXE mean?</a><br />";
		}
		if (target === 'all' || target === 'coil') {
			matched = true;
			buffer += "<a href=\"http://www.smogon.com/forums/threads/coil-explained.3508013\">What is COIL?</a><br />";
		}
		if (target === 'all' || target === 'tiering' || target === 'tiers' || target === 'tier') {
			matched = true;
			buffer += "<a href=\"https://www.smogon.com/ingame/battle/tiering-faq\">Tiering FAQ</a><br />";
		}
		if (!matched) {
			return this.sendReply("The FAQ entry '" + target + "' was not found. Try /faq for general help.");
		}
		this.sendReplyBox(buffer);
	},
	faqhelp: ["/faq [theme] - Provides a link to the FAQ. Add deviation, doubles, randomcap, restart, or staff for a link to these questions. Add all for all of them.",
		"!faq [theme] - Shows everyone a link to the FAQ. Add deviation, doubles, randomcap, restart, or staff for a link to these questions. Add all for all of them. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	analysis: 'smogdex',
	strategy: 'smogdex',
	smogdex: function (target, room, user) {
		if (!this.canBroadcast()) return;

		let targets = target.split(',');
		let pokemon = Tools.getTemplate(targets[0]);
		let item = Tools.getItem(targets[0]);
		let move = Tools.getMove(targets[0]);
		let ability = Tools.getAbility(targets[0]);
		let format = Tools.getFormat(targets[0]);
		let atLeastOne = false;
		let generation = (targets[1] || 'xy').trim().toLowerCase();
		let genNumber = 6;
		let extraFormat = Tools.getFormat(targets[2]);

		if (generation === 'xy' || generation === 'oras' || generation === '6' || generation === 'six') {
			generation = 'xy';
		} else if (generation === 'bw' || generation === 'bw2' || generation === '5' || generation === 'five') {
			generation = 'bw';
			genNumber = 5;
		} else if (generation === 'dp' || generation === 'dpp' || generation === '4' || generation === 'four') {
			generation = 'dp';
			genNumber = 4;
		} else if (generation === 'adv' || generation === 'rse' || generation === 'rs' || generation === '3' || generation === 'three') {
			generation = 'rs';
			genNumber = 3;
		} else if (generation === 'gsc' || generation === 'gs' || generation === '2' || generation === 'two') {
			generation = 'gs';
			genNumber = 2;
		} else if (generation === 'rby' || generation === 'rb' || generation === '1' || generation === 'one') {
			generation = 'rb';
			genNumber = 1;
		} else {
			generation = 'xy';
		}

		// Pokemon
		if (pokemon.exists) {
			atLeastOne = true;
			if (genNumber < pokemon.gen) {
				return this.sendReplyBox("" + pokemon.name + " did not exist in " + generation.toUpperCase() + "!");
			}
			if (pokemon.tier === 'CAP') {
				generation = 'cap';
				this.errorReply("CAP is not currently supported by Smogon Strategic Pokedex.");
			}

			if (pokemon.battleOnly || pokemon.baseSpecies === 'Keldeo' || pokemon.baseSpecies === 'Genesect') {
				pokemon = Tools.getTemplate(pokemon.baseSpecies);
			}

			let formatName = extraFormat.name;
			let formatId = extraFormat.id;
			if (formatId === 'doublesou') {
				formatId = 'doubles';
			} else if (formatId.includes('vgc')) {
				formatId = 'vgc' + formatId.slice(-2);
				formatName = 'VGC20' + formatId.slice(-2);
			} else if (extraFormat.effectType !== 'Format') {
				formatName = formatId = '';
			}
			let speciesid = pokemon.speciesid;
			// Special case for Meowstic-M and Hoopa-Unbound
			if (speciesid === 'meowstic') speciesid = 'meowsticm';
			if (speciesid === 'hoopaunbound') speciesid = 'hoopa-alt';
			if (pokemon.tier === 'CAP') {
				this.sendReplyBox("<a href=\"https://www.smogon.com/cap/pokemon/strategies/" + speciesid + "\">" + generation.toUpperCase() + " " + Tools.escapeHTML(formatName) + " " + pokemon.name + " analysis preview</a>, brought to you by <a href=\"https://www.smogon.com\">Smogon University</a> <a href=\"https://smogon.com/cap/\">CAP Project</a>");
			} else {
				this.sendReplyBox("<a href=\"https://www.smogon.com/dex/" + generation + "/pokemon/" + speciesid + (formatId ? '/' + formatId : '') + "\">" + generation.toUpperCase() + " " + Tools.escapeHTML(formatName) + " " + pokemon.name + " analysis</a>, brought to you by <a href=\"https://www.smogon.com\">Smogon University</a>");
			}
		}

		// Item
		if (item.exists && genNumber > 1 && item.gen <= genNumber) {
			atLeastOne = true;
			this.sendReplyBox("<a href=\"https://www.smogon.com/dex/" + generation + "/items/" + item.id + "\">" + generation.toUpperCase() + " " + item.name + " item analysis</a>, brought to you by <a href=\"https://www.smogon.com\">Smogon University</a>");
		}

		// Ability
		if (ability.exists && genNumber > 2 && ability.gen <= genNumber) {
			atLeastOne = true;
			this.sendReplyBox("<a href=\"https://www.smogon.com/dex/" + generation + "/abilities/" + ability.id + "\">" + generation.toUpperCase() + " " + ability.name + " ability analysis</a>, brought to you by <a href=\"https://www.smogon.com\">Smogon University</a>");
		}

		// Move
		if (move.exists && move.gen <= genNumber) {
			atLeastOne = true;
			this.sendReplyBox("<a href=\"https://www.smogon.com/dex/" + generation + "/moves/" + toId(move.name) + "\">" + generation.toUpperCase() + " " + move.name + " move analysis</a>, brought to you by <a href=\"https://www.smogon.com\">Smogon University</a>");
		}

		// Format
		if (format.id) {
			let formatName = format.name;
			let formatId = format.id;
			if (formatId === 'doublesou') {
				formatId = 'doubles';
			} else if (formatId.includes('vgc')) {
				formatId = 'vgc' + formatId.slice(-2);
				formatName = 'VGC20' + formatId.slice(-2);
			} else if (format.effectType !== 'Format') {
				formatName = formatId = '';
			}
			if (formatName) {
				atLeastOne = true;
				this.sendReplyBox("<a href=\"https://www.smogon.com/dex/" + generation + "/formats/" + formatId + "\">" + generation.toUpperCase() + " " + Tools.escapeHTML(formatName) + " format analysis</a>, brought to you by <a href=\"https://www.smogon.com\">Smogon University</a>");
			}
		}

		if (!atLeastOne) {
			return this.sendReplyBox("Pok&eacute;mon, item, move, ability, or format not found for generation " + generation.toUpperCase() + ".");
		}
	},
	smogdexhelp: ["/analysis [pokemon], [generation] - Links to the Smogon University analysis for this Pok\u00e9mon in the given generation.",
		"!analysis [pokemon], [generation] - Shows everyone this link. Requires: " + Users.getGroupsThatCan('broadcast').join(" ")],

	veekun: function (target, broadcast, user) {
		if (!this.canBroadcast()) return;

		let baseLink = 'http://veekun.com/dex/';

		let pokemon = Tools.getTemplate(target);
		let item = Tools.getItem(target);
		let move = Tools.getMove(target);
		let ability = Tools.getAbility(target);
		let nature = Tools.getNature(target);
		let atLeastOne = false;

		// Pokemon
		if (pokemon.exists) {
			atLeastOne = true;
			if (pokemon.isNonstandard) return this.sendReply(pokemon.species + ' is not a real Pok\u00e9mon.');

			let baseSpecies = pokemon.baseSpecies || pokemon.species;
			let forme = pokemon.forme;

			// Showdown and Veekun have different naming for this gender difference forme of Meowstic.
			if (baseSpecies === 'Meowstic' && forme === 'F') {
				forme = 'Female';
			}

			let link = baseLink + 'pokemon/' + baseSpecies.toLowerCase();
			if (forme) {
				link += '?form=' + forme.toLowerCase();
			}

			this.sendReplyBox("<a href=\"" + link + "\">" + pokemon.species + " description</a> by Veekun");
		}

		// Item
		if (item.exists) {
			atLeastOne = true;
			let link = baseLink + 'items/' + item.name.toLowerCase();
			this.sendReplyBox("<a href=\"" + link + "\">" + item.name + " item description</a> by Veekun");
		}

		// Ability
		if (ability.exists) {
			atLeastOne = true;
			if (ability.isNonstandard) return this.sendReply(ability.name + ' is not a real ability.');
			let link = baseLink + 'abilities/' + ability.name.toLowerCase();
			this.sendReplyBox("<a href=\"" + link + "\">" + ability.name + " ability description</a> by Veekun");
		}

		// Move
		if (move.exists) {
			atLeastOne = true;
			if (move.isNonstandard) return this.sendReply(move.name + ' is not a real move.');
			let link = baseLink + 'moves/' + move.name.toLowerCase();
			this.sendReplyBox("<a href=\"" + link + "\">" + move.name + " move description</a> by Veekun");
		}

		// Nature
		if (nature.exists) {
			atLeastOne = true;
			let link = baseLink + 'natures/' + nature.name.toLowerCase();
			this.sendReplyBox("<a href=\"" + link + "\">" + nature.name + " nature description</a> by Veekun");
		}

		if (!atLeastOne) {
			return this.sendReplyBox("Pok&eacute;mon, item, move, ability, or nature not found.");
		}
	},
	veekunhelp: ["/veekun [pokemon] - Links to Veekun website for this pokemon/item/move/ability/nature.",
		"!veekun [pokemon] - Shows everyone this link. Requires: + % @ # & ~"],

	register: function () {
		if (!this.canBroadcast()) return;
		this.sendReplyBox('You will be prompted to register upon winning a rated battle. Alternatively, there is a register button in the <button name="openOptions"><i class="fa fa-cog"></i> Options</button> menu in the upper right.');
	},

	/*********************************************************
	 * Miscellaneous commands
	 *********************************************************/

	potd: function (target, room, user) {
		if (!this.can('potd')) return false;

		Config.potd = target;
		Simulator.SimulatorProcess.eval('Config.potd = \'' + toId(target) + '\'');
		if (target) {
			if (Rooms.lobby) Rooms.lobby.addRaw("<div class=\"broadcast-blue\"><b>The Pok&eacute;mon of the Day is now " + target + "!</b><br />This Pokemon will be guaranteed to show up in random battles.</div>");
			this.logModCommand("The Pok\u00e9mon of the Day was changed to " + target + " by " + user.name + ".");
		} else {
			if (Rooms.lobby) Rooms.lobby.addRaw("<div class=\"broadcast-blue\"><b>The Pok&eacute;mon of the Day was removed!</b><br />No pokemon will be guaranteed in random battles.</div>");
			this.logModCommand("The Pok\u00e9mon of the Day was removed by " + user.name + ".");
		}
	},

	roll: 'dice',
	dice: function (target, room, user) {
		if (!target || target.match(/[^d\d\s\-\+HL]/i)) return this.parse('/help dice');
		if (!this.canBroadcast()) return;

		// ~30 is widely regarded as the sample size required for sum to be a Gaussian distribution.
		// This also sets a computation time constraint for safety.
		let maxDice = 40;

		let diceQuantity = 1;
		let diceDataStart = target.indexOf('d');
		if (diceDataStart >= 0) {
			if (diceDataStart) diceQuantity = Number(target.slice(0, diceDataStart));
			target = target.slice(diceDataStart + 1);
			if (!Number.isInteger(diceQuantity) || diceQuantity <= 0 || diceQuantity > maxDice) return this.sendReply("The amount of dice rolled should be a natural number up to " + maxDice + ".");
		}
		let offset = 0;
		let removeOutlier = 0;

		let modifierData = target.match(/[\-\+]/);
		if (modifierData) {
			switch (target.slice(modifierData.index).trim().toLowerCase()) {
			case '-l':
				removeOutlier = -1;
				break;
			case '-h':
				removeOutlier = +1;
				break;
			default:
				offset = Number(target.slice(modifierData.index));
				if (isNaN(offset)) return this.parse('/help dice');
				if (!Number.isSafeInteger(offset)) return this.errorReply("The specified offset must be an integer up to " + Number.MAX_SAFE_INTEGER + ".");
			}
			if (removeOutlier && diceQuantity <= 1) return this.errorReply("More than one dice should be rolled before removing outliers.");
			target = target.slice(0, modifierData.index);
		}

		let diceFaces = 6;
		if (target.length) {
			diceFaces = Number(target);
			if (!Number.isSafeInteger(diceFaces) || diceFaces <= 0) {
				return this.errorReply("Rolled dice must have a natural amount of faces up to " + Number.MAX_SAFE_INTEGER + ".");
			}
		}

		if (diceQuantity > 1) {
			// Make sure that we can deal with high rolls
			if (!Number.isSafeInteger(offset < 0 ? diceQuantity * diceFaces : diceQuantity * diceFaces + offset)) {
				return this.errorReply("The maximum sum of rolled dice must be lower or equal than " + Number.MAX_SAFE_INTEGER + ".");
			}
		}

		let maxRoll = 0;
		let minRoll = Number.MAX_SAFE_INTEGER;

		let trackRolls = diceQuantity * (('' + diceFaces).length + 1) <= 60;
		let rolls = [];
		let rollSum = 0;

		for (let i = 0; i < diceQuantity; ++i) {
			let curRoll = Math.floor(Math.random() * diceFaces) + 1;
			rollSum += curRoll;
			if (curRoll > maxRoll) maxRoll = curRoll;
			if (curRoll < minRoll) minRoll = curRoll;
			if (trackRolls) rolls.push(curRoll);
		}

		// Apply modifiers

		if (removeOutlier > 0) {
			rollSum -= maxRoll;
		} else if (removeOutlier < 0) {
			rollSum -= minRoll;
		}
		if (offset) rollSum += offset;

		// Reply with relevant information

		let offsetFragment = "";
		if (offset) offsetFragment += (offset > 0 ? "+" + offset : offset);

		if (diceQuantity === 1) return this.sendReplyBox("Roll (1 - " + diceFaces + ")" + offsetFragment + ": " + rollSum);

		let sumFragment = "<br />Sum" + offsetFragment + (removeOutlier ? " except " + (removeOutlier > 0 ? "highest" : "lowest") : "");
		return this.sendReplyBox("" + diceQuantity + " rolls (1 - " + diceFaces + ")" + (trackRolls ? ": " + rolls.join(", ") : "") + sumFragment + ": " + rollSum);
	},
	dicehelp: ["/dice [max number] - Randomly picks a number between 1 and the number you choose.",
		"/dice [number of dice]d[number of sides] - Simulates rolling a number of dice, e.g., /dice 2d4 simulates rolling two 4-sided dice.",
		"/dice [number of dice]d[number of sides][+/-][offset] - Simulates rolling a number of dice and adding an offset to the sum, e.g., /dice 2d6+10: two standard dice are rolled; the result lies between 12 and 22.",
		"/dice [number of dice]d[number of sides]-[H/L] - Simulates rolling a number of dice with removal of extreme values, e.g., /dice 3d8-L: rolls three 8-sided dice; the result ignores the lowest value."],

	pr: 'pickrandom',
	pick: 'pickrandom',
	pickrandom: function (target, room, user) {
		let options = target.split(',');
		if (options.length < 2) return this.parse('/help pick');
		if (!this.canBroadcast()) return false;
		return this.sendReplyBox('<em>We randomly picked:</em> ' + Tools.escapeHTML(options.sample().trim()));
	},
	pickrandomhelp: ["/pick [option], [option], ... - Randomly selects an item from a list containing 2 or more elements."],

	showimage: 'image',
	postimage: 'image',
	image: function (target, room, user) {
		if (!target) return this.sendReply('Usage: /image link, size');
		if (!this.can('ban', room)) return false;
		if (!this.canBroadcast()) return;
		if (this.room.isPersonal && !this.user.can('announce')) {
			return this.errorReply("Images are not allowed in personal rooms.");
		}

		let targets = target.split(',');

		let image = targets[0].trim();
		if (!image) return this.errorReply('No image URL was provided!');
		image = this.canEmbedURI(image);

		if (!image) return false;

		let unitRegex = /^\d+(?:p[xtc]|%|[ecm]m|ex|in)$/;
		let width = (targets[1] || '').trim();
		if (width) {
			if (!isNaN(width)) width += 'px';
			if (!unitRegex.test(width)) {
				return this.errorReply('"' + width + '" is not a valid width value!');
			}
			width = 'width: ' + width;
		}

		let height = (targets[2] || '').trim();
		if (height) {
			if (!isNaN(height)) height += 'px';
			if (!unitRegex.test(height)) {
				return this.errorReply('"' + height + '" is not a valid height value!');
			}
			height = 'height: ' + height;
		}

		let style = '';
		if (width || height) {
			style = [];
			if (width) style.push(width);
			if (height) style.push(height);
			style = ' style="' + style.join('; ') + '"';
		}

		this.sendReply('|raw|<img src="' + Tools.escapeHTML(image) + '"' + style + ' />');
	},
	showimagehelp: ["/showimage [url], [width], [height] - Show an image. " +
		"Any CSS units may be used for the width or height (default: px)." +
		"Requires: " + Users.getGroupsThatCan('declare').join(" ")],

	htmlbox: function (target, room, user) {
		if (!target) return this.parse('/help htmlbox');
		if (!this.can('declare', room)) return;
		target = this.canHTML(target);
		if (!target) return;
		if (!this.canBroadcast('!htmlbox')) return;

		this.sendReplyBox(target);
	},
	htmlboxhelp: ["/htmlbox [message] - Displays a message, parsing HTML code contained. Requires: " + Users.getGroupsThatCan('declare').join(" ") + " with global authority"],

	/*********************************************************
	 * Clan commands
	 *********************************************************/

	ayudaclan: 'clanshelp',
	clanhelp: 'clanshelp',
	clanshelp: function () {
		if (!this.canBroadcast()) return false;
		this.sendReplyBox(
			"<big><b>Comandos Básicos:</b></big><br /><br />" +
			"/clanes - Lista los clanes.<br />" +
			"/clan (clan/miembro) - Muestra la ficha/perfil de un clan.<br />" +
			"/miembrosclan (clan/miembro) - muestra los miembros con los que cuenta un clan.<br />" +
			"/clanauth (clan/miembro) - muestra la jerarquía de miembros de un clan.<br />" +
			"/warlog (clan/miembro) - muestra las 10 últimas wars de un clan.<br />" +
			"/invitarclan - Invita a un usuario a unirse al clan. Requiere ser Oficial del clan.<br />" +
			"/expulsarclan (miembro) - Expulsa a un miembro del clan. Requiere ser sub-lider del clan.<br />" +
			"/aceptarclan (clan) - Acepta una invitación al clan.<br />" +
			"/invitacionesclan (clan/miembro) - Lista a los usuarios invitados a un clan.<br />" +
			"/borrarinvitaciones - Borra las invitaciones pendientes al Clan. Requiere ser líder del clan.<br />" +
			"/abandonarclan - Abandona el clan.<br />" +
			"<br />" +
			"<big><b>Comandos de Clan-Auth:</b></big><br /><br />" +
			"/liderclan (miembro) - Nombra a un miembro líder del clan. Requiere ~<br />" +
			"/subliderclan (miembro) - Nombra a un miembro sub-líder del clan. Requiere ser Líder del clan.<br />" +
			"/oficialclan (miembro) - Nombra a un miembro oficial del clan. Requiere ser sub-lider del clan.<br />" +
			"/demoteclan (miembro) - Borra a un miembro del staff del clan. Requiere ser Líder del clan y ~ para demotear a un Líder.<br />" +
			"/lemaclan (lema) - Establece el Lema del clan. Requiere ser líder del clan.<br />" +
			"/logoclan (logo) - Establece el Logotipo del clan. Requiere ser líder del clan.<br />" +
			"/closeclanroom - Bloquea una sala de clan a todos los que no sean miembros de dicho clan, salvo administradores.<br />" +
			"/openclanroom - Elimina el bloqueo del comando /closeclanroom.<br />" +
			"/llamarmiembros o /fjg - Llama a los miembros de un clan a su sala.<br />" +
			"/rk o /roomkick - Expulsa a un usuario de una sala. Requiere @ o superior.<br />" +
			"<br />" +
			"<big><b>Comandos de Administración:</b></big><br /><br />" +
			"/createclan &lt;name> - Crea un clan.<br />" +
			"/deleteclan &lt;name> - Elimina un clan.<br />" +
			"/addclanmember &lt;clan>, &lt;user> - Fuerza a un usuario a unirse a un clan.<br />" +
			"/removeclanmember &lt;clan>, &lt;user> - Expulsa a un usuario del clan.<br />" +
			"/setlemaclan &lt;clan>,&lt;lema> - Establece un lema para un clan.<br />" +
			"/setlogoclan &lt;clan>,&lt;logo> - Establece un logotipo para un clan.<br />" +
			"/setsalaclan &lt;clan>,&lt;sala> - Establece una sala para un clan.<br />" +
			"/setgxeclan &lt;clan>,&lt;wins>,&lt;losses>,&lt;draws> - Establece la puntuación de un clan.<br />" +
			"/serankclan &lt;clan>,&lt;puntos> - Establece la puntuación de un clan.<br />" +
			"/settitleclan &lt;clan>&lt;puntos> - Estable un título para el clan.<br />"
		);
	},

	createclan: function (target) {
		if (!this.can('clans')) return false;
		if (target.length < 2)
			this.sendReply("El nombre del clan es demasiado corto");
		else if (!Clans.createClan(target))
			this.sendReply("No se pudo crear el clan. Es posible que ya exista otro con el mismo nombre.");
		else
			this.sendReply("Clan: " + target + " creado con éxito.");

	},

	deleteclan: function (target) {
		if (!this.can('clans')) return false;
		if (!Clans.deleteClan(target))
			this.sendReply("No se pudo eliminar el clan. Es posble que no exista o que se encuentre en war.");
		else
			this.sendReply("Clan: " + target + " eliminado con éxito.");
	},

	getclans: 'clans',
	clanes: 'clans',
	clans: function (target, room, user) {
		if (!this.canBroadcast()) return false;
		var clansTableTitle = "Lista de Clanes";
		if (toId(target) === 'rank' || toId(target) === 'puntos' || toId(target) === 'prestigio' || toId(target) === 'puntuacion') {
			target = "rank";
			clansTableTitle = "Lista de Clanes por Puntuaci&oacute;n";
		}
		if (toId(target) === 'miembros' || toId(target) === 'members') {
			target = "members";
			clansTableTitle = "Lista de Clanes por Miembros";
		}
		var clansTable = '<center><big><big><strong>' + clansTableTitle + '</strong></big></big><center><br /><table class="clanstable" width="100%" border="1" cellspacing="0" cellpadding="3" target="_blank"><tr><td><center><strong>Clan</strong></center></td><td><center><strong>Nombre Completo</strong></center></td><td><center><strong>Miembros</strong></center></td><td><center><strong>Sala</strong></center></td><td><center><strong>Wars</strong></center></td><td><center><strong>Puntuaci&oacute;n</strong></center></td></tr>';
		var clansList = Clans.getClansList(toId(target));
		var auxRating = {};
		var nMembers = 0;
		var membersClan = {};
		var auxGxe = 0;
		for (var m in clansList) {
			auxRating = Clans.getElementalData(m);
			membersClan = Clans.getMembers(m);
			if (!membersClan) {
				nMembers = 0;
			} else {
				nMembers = membersClan.length;
			}
			clansTable += '<tr><td><center>' + Tools.escapeHTML(Clans.getClanName(m)) + '</center></td><td><center>' +Tools.escapeHTML(auxRating.compname) + '</center></td><td><center>' + nMembers + '</center></td><td><center>' + '<button name="send" value="/join ' + Tools.escapeHTML(auxRating.sala) + '" target="_blank">' + Tools.escapeHTML(auxRating.sala) + '</button>' + '</center></td><td><center>' + (auxRating.wins + auxRating.losses + auxRating.draws) + '</center></td><td><center>' + auxRating.rating + '</center></td></tr>';
		}
		clansTable += '</table>';
		this.sendReply("|raw| " + clansTable);
	},

	clanauth: function (target, room, user) {
		var autoclan = false;
		if (!target) autoclan = true;
		if (!this.canBroadcast()) return false;
		var clan = Clans.getRating(target);
		if (!clan) {
			target = Clans.findClanFromMember(target);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan && autoclan) {
			target = Clans.findClanFromMember(user.name);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan) {
			this.sendReply("El clan especificado no existe o no está disponible.");
			return;
		}
		//html codes for clan ranks
		var leaderClanSource = Clans.getAuthMembers(target, 3);
		if (leaderClanSource !== "") {
			leaderClanSource = "<big><b>Líderes</b></big><br /><br />" + leaderClanSource + "</b></big></big><br /><br />";
		}
		var subLeaderClanSource = Clans.getAuthMembers(target, 2);
		if (subLeaderClanSource !== "") {
			subLeaderClanSource = "<big><b>Sub-Líderes</b></big><br /><br />" + subLeaderClanSource + "</b></big></big><br /><br />";
		}
		var oficialClanSource = Clans.getAuthMembers(target, 1);
		if (oficialClanSource !== "") {
			oficialClanSource = "<big><b>Oficiales</b></big><br /><br />" + oficialClanSource + "</b></big></big><br /><br />";
		}
		var memberClanSource = Clans.getAuthMembers(target, 0);
		if (memberClanSource !== "") {
			memberClanSource = "<big><b>Resto de Miembros</b></big><br /><br />" + memberClanSource + "</b></big></big><br /><br />";
		}

		this.sendReplyBox(
			"<center><big><big><b>Jerarquía del clan " + Tools.escapeHTML(Clans.getClanName(target)) + "</b></big></big> <br /><br />" + leaderClanSource + subLeaderClanSource + oficialClanSource + memberClanSource + '</center>'
		);
	},

	clanmembers: 'miembrosclan',
	miembrosclan: function (target, room, user) {
		var autoclan = false;
		if (!target) autoclan = true;
		if (!this.canBroadcast()) return false;
		var clan = Clans.getRating(target);
		if (!clan) {
			target = Clans.findClanFromMember(target);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan && autoclan) {
			target = Clans.findClanFromMember(user.name);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan) {
			this.sendReply("El clan especificado no existe o no está disponible.");
			return;
		}
		var nMembers = 0;
		var membersClan = Clans.getMembers(target);
		if (!membersClan) {
			nMembers = 0;
		} else {
			nMembers = membersClan.length;
		}
		this.sendReplyBox(
			"<strong>Miembros del clan " + Tools.escapeHTML(Clans.getClanName(target)) + ":</strong> " + Clans.getAuthMembers(target, "all") + '<br /><br /><strong>Número de miembros: ' + nMembers + '</strong>'
		);
	},
	invitacionesclan: function (target, room, user) {
		var autoclan = false;
		if (!target) autoclan = true;
		if (!this.canBroadcast()) return false;
		var clan = Clans.getRating(target);
		if (!clan) {
			target = Clans.findClanFromMember(target);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan && autoclan) {
			target = Clans.findClanFromMember(user.name);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan) {
			this.sendReply("El clan especificado no existe o no está disponible.");
			return;
		}
		this.sendReplyBox(
			"<strong>Invitaciones pendientes del clan " + Tools.escapeHTML(Clans.getClanName(target)) + ":</strong> " + Tools.escapeHTML(Clans.getInvitations(target).sort().join(", "))
		);
	},
	clan: 'getclan',
	getclan: function (target, room, user) {
		var autoClan = false;
		var memberClanProfile = false;
		var clanMember = "";
		if (!target) autoClan = true;
		if (!this.canBroadcast()) return false;
		var clan = Clans.getProfile(target);
		if (!clan) {
			clanMember = target;
			target = Clans.findClanFromMember(target);
			memberClanProfile = true;
			if (target)
				clan = Clans.getProfile(target);
		}
		if (!clan && autoClan) {
			target = Clans.findClanFromMember(user.name);
			if (target)
				clan = Clans.getProfile(target);
			memberClanProfile = true;
			clanMember = user.name;
		}
		if (!clan) {
			this.sendReply("El clan especificado no existe o no está disponible.");
			return;
		}
		var salaClanSource = "";
		if (clan.sala === "none") {
			salaClanSource = 'Aún no establecida.';
		} else {
			salaClanSource = '<button name="send" value="/join ' + Tools.escapeHTML(clan.sala) + '" target="_blank">' + Tools.escapeHTML(clan.sala) + '</button>';
		}
		var clanTitle = "";
		if (memberClanProfile) {
			var authValue = Clans.authMember(target, clanMember);
			if (authValue === 3) {
				clanTitle = clanMember + " - Líder del clan " + clan.compname;
			} else if (authValue === 2) {
				clanTitle = clanMember + " - Sub-Líder del clan " + clan.compname;
			} else if (authValue === 1) {
				clanTitle = clanMember + " - Oficial del clan " + clan.compname;
			} else {
				clanTitle = clanMember + " - Miembro del clan " + clan.compname;
			}
		} else {
			clanTitle = clan.compname;
		}
		var medalsClan = '';
		if (clan.medals) {
			for (var u in clan.medals) {
				medalsClan += '<img id="' + u + '" src="' + encodeURI(clan.medals[u].logo) + '" width="32" title="' + Tools.escapeHTML(clan.medals[u].desc) + '" />&nbsp;&nbsp;';
			}
		}
		this.sendReplyBox(
			'<div class="fichaclan">' +
			'<h4><center><p> <br />' + Tools.escapeHTML(clanTitle) + '</center></h4><hr width="90%" />' +
			'<table width="90%" border="0" align="center"><tr><td width="180" rowspan="2"><div align="center"><img src="' + encodeURI(clan.logo) +
			'" width="160" height="160" /></div></td><td height="64" align="left" valign="middle"><span class="lemaclan">'+ Tools.escapeHTML(clan.lema) +
			'</span></td> </tr>  <tr>    <td align="left" valign="middle"><strong>Sala Propia</strong>: ' + salaClanSource +
			' <p style="font-style: normal;font-size: 16px;"><strong>Puntuación</strong>:&nbsp;' + clan.rating +
			' (' + clan.wins + ' Victorias, ' + clan.losses + ' Derrotas, ' + clan.draws + ' Empates)<br />' +
			' </p> <p style="font-style: normal;font-size: 16px;">&nbsp;' + medalsClan +
			'</p></td>  </tr></table></div>'
		);
	},

	setlemaclan: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /setlemaclan clan, lema");

		if (!Clans.setLema(params[0], params[1]))
			this.sendReply("El clan no existe o el lema es mayor de 80 caracteres.");
		else {
			this.sendReply("El nuevo lema del clan " + params[0] + " ha sido establecido con éxito.");
		}
	},

	setlogoclan: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /setlogoclan clan, logo");

		if (!Clans.setLogo(params[0], params[1]))
			this.sendReply("El clan no existe o el link del logo es mayor de 120 caracteres.");
		else {
			this.sendReply("El nuevo logo del clan " + params[0] + " ha sido establecido con éxito.");
		}
	},

	settitleclan: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /settitleclan clan, titulo");

		if (!Clans.setCompname(params[0], params[1]))
			this.sendReply("El clan no existe o el título es mayor de 80 caracteres.");
		else {
			this.sendReply("El nuevo titulo del clan " + params[0] + " ha sido establecido con éxito.");
		}
	},

	setrankclan: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /setrankclan clan, valor");

		if (!Clans.setRanking(params[0], params[1]))
			this.sendReply("El clan no existe o el valor no es válido.");
		else {
			this.sendReply("El nuevo rank para el clan " + params[0] + " ha sido establecido con éxito.");
		}
	},

	setgxeclan: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 4) return this.sendReply("Usage: /setgxeclan clan, wins, losses, ties");

		if (!Clans.setGxe(params[0], params[1], params[2], params[3]))
			this.sendReply("El clan no existe o el valor no es válido.");
		else {
			this.sendReply("El nuevo GXE para el clan " + params[0] + " ha sido establecido con éxito.");
		}
	},

	setsalaclan: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /setsalaclan clan, sala");

		if (!Clans.setSala(params[0], params[1]))
			this.sendReply("El clan no existe o el nombre de la sala es mayor de 80 caracteres.");
		else {
			this.sendReply("La nueva sala del clan " + params[0] + " ha sido establecida con éxito.");
		}
	},

	giveclanmedal: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 4) return this.sendReply("Usage: /giveclanmedal clan, medallaId, imagen, desc");

		if (!Clans.addMedal(params[0], params[1], params[2], params[3]))
			this.sendReply("El clan no existe o alguno de los datos no es correcto");
		else {
			this.sendReply("Has entegado una medalla al clan " + params[0]);
		}
	},

	removeclanmedal: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /removeclanmedal clan, medallaId");

		if (!Clans.deleteMedal(params[0], params[1]))
			this.sendReply("El clan no existe o no podeía dicha medalla");
		else {
			this.sendReply("Has quitado una medalla al clan " + params[0]);
		}
	},

	lemaclan: function (target, room, user) {
		var permisionClan = false;
		if (!target) return this.sendReply("Debe especificar un lema.");
		var clanUser = Clans.findClanFromMember(user.name);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var iduserwrit = toId(user.name);
			var perminsionvalue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionvalue === 3) permisionClan = true;
			if (!permisionClan && !this.can('clans')) return false;
		} else {
			return false;
		}
		var claninfo = Clans.getElementalData (clanUser);
		if (room && room.id === toId(claninfo.sala)) {
			if (!Clans.setLema(clanUser, target))
				this.sendReply("El lema es mayor de 80 caracteres.");
			else {
				this.addModCommand("Un nuevo lema para el clan " + clanUser + " ha sido establecido por " + user.name);
			}
		} else {
			this.sendReply("Este comando solo puede ser usado en la sala del clan.");
		}
	},

	logoclan: function (target, room, user) {
		var permisionClan = false;
		if (!target) return this.sendReply("Debe especificar un logo.");
		var clanUser = Clans.findClanFromMember(user.name);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var iduserwrit = toId(user.name);
			var perminsionvalue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionvalue === 3) permisionClan = true;
			if (!permisionClan && !this.can('clans')) return false;
		} else {
			return false;
		}
		var claninfo = Clans.getElementalData (clanUser);
		if (room && room.id === toId(claninfo.sala)) {
			if (!Clans.setLogo(clanUser, target))
				this.sendReply("El logo es mayor de 120 caracteres.");
			else {
				this.addModCommand("Un nuevo logotipo para el clan " + clanUser + " ha sido establecido por " + user.name);
			}
		} else {
			this.sendReply("Este comando solo puede ser usado en la sala del clan.");
		}
	},

	llamarmiembros: 'fjg',
	fjg: function (target, room, user) {
		var permisionClan = false;
		var clanUser = Clans.findClanFromMember(user.name);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var iduserwrit = toId(user.name);
			var perminsionvalue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionvalue === 2 || perminsionvalue === 3) permisionClan = true;
			if (!permisionClan && !this.can('clans')) return false;
		} else {
			return false;
		}
		var claninfo = Clans.getElementalData (clanUser);
		if (room && room.id === toId(claninfo.sala)) {
			var clanMembers = Clans.getMembers(clanUser);
			var targetUser;
			for (var i = 0; i < clanMembers.length; ++i) {
				if (!room.users[toId(clanMembers[i])]) {
					targetUser = Users.get(clanMembers[i])
					if (targetUser && targetUser.connected) {
						targetUser.joinRoom(room.id);
						targetUser.popup('Has sido llamado a la sala ' + claninfo.sala.trim() + ' por ' + user.name + '.');
					}
				}
			}
			this.addModCommand("Los miembros del clan " + clanUser + " han sido llamados a la sala " + toId(claninfo.sala) + ' por ' + user.name + '.');
		} else {
			this.sendReply("Este comando solo puede ser usado en la sala del clan.");
		}
	},

	addclanmember: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Usage: /addclanmember clan, member");

		var user = Users.getExact(params[1]);
		if (!user || !user.connected) return this.sendReply("User: " + params[1] + " is not online.");

		if (!Clans.addMember(params[0], params[1]))
			this.sendReply("Could not add the user to the clan. Does the clan exist or is the user already in another clan?");
		else {
			this.sendReply("User: " + user.name + " successfully added to the clan.");
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(user.name) + " se ha unido al clan: " + Tools.escapeHTML(Clans.getClanName(params[0])) + '</div>');
		}
	},

	clanleader: 'liderclan',
	liderclan: function (target, room, user) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (!params) return this.sendReply("Usage: /liderclan member");

		var userk = Users.getExact(params[0]);
		if (!userk || !userk.connected) return this.sendReply("Usuario: " + params[0] + " no existe o no está disponible.");

		if (!Clans.addLeader(params[0]))
			this.sendReply("El usuario no existe, no pertenece a ningún clan o ya era líder de su clan.");
		else {
			var clanUser = Clans.findClanFromMember(params[0]);
			this.sendReply("Usuario: " + userk.name + " nombrado correctamente líder del clan " + clanUser + ".");
			userk.popup(user.name + " te ha nombrado Líder del clan " + clanUser + ".\nUtiliza el comando /clanhelp para más información.");
		}
	},

	clanoficial: 'oficialclan',
	oficialclan: function (target, room, user) {
		var permisionClan = false;
		var params = target.split(',');
		if (!params) {
				return this.sendReply("Usage: /oficialclan member");
		}
		var clanUser = Clans.findClanFromMember(user.name);
		var clanTarget = Clans.findClanFromMember(params[0]);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var userb = toId(params[0]);
			var iduserwrit = toId(user.name);
			var perminsionValue = Clans.authMember(clanUserid, iduserwrit);
			if ((perminsionValue === 2 || perminsionValue === 3) && clanTarget === clanUser) permisionClan = true;
		}
		if (!permisionClan && !this.can('clans')) return;
		var userk = Users.getExact(params[0]);
		if (!userk || !userk.connected) return this.sendReply("Usuario: " + params[0] + " no existe o no está disponible.");
		if (clanTarget) {
			var clanId = toId(clanTarget);
			var userId = toId(params[0]);
			if ((Clans.authMember(clanId, userId) > 2 && !this.can('clans')) || (Clans.authMember(clanId, userId) === 2 && perminsionValue < 3 && !this.can('clans'))) return false;
		}
		if (!Clans.addOficial(params[0]))
			this.sendReply("El usuario no existe, no pertenece a ningún clan o ya era oficial de su clan.");
		else {
			this.sendReply("Usuario: " + userk.name + " nombrado correctamente oficial del clan " + clanTarget + ".");
			userk.popup(user.name + " te ha nombrado Oficial del clan " + clanTarget + ".\nUtiliza el comando /clanhelp para más información.");
		}
	},

	clansubleader: 'subliderclan',
	subliderclan: function (target, room, user) {
		var permisionClan = false;
		var params = target.split(',');
		if (!params) {
				return this.sendReply("Usage: /subliderclan member");
		}
		var clanUser = Clans.findClanFromMember(user.name);
		var clanTarget = Clans.findClanFromMember(params[0]);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var userb = toId(params[0]);
			var iduserwrit = toId(user.name);
			var perminsionValue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionValue === 3 && clanTarget === clanUser) permisionClan = true;
		}
		if (!permisionClan && !this.can('clans')) return;
		var userk = Users.getExact(params[0]);
		if (!userk || !userk.connected) return this.sendReply("Usuario: " + params[0] + " no existe o no está disponible.");
		if (clanTarget) {
			var clanId = toId(clanTarget);
			var userId = toId(params[0]);
			if ((Clans.authMember(clanId, userId) > 2 && !this.can('clans')) || (Clans.authMember(clanId, userId) === 2 && perminsionValue < 3 && !this.can('clans'))) return false;
		}
		if (!Clans.addSubLeader(params[0]))
			this.sendReply("El usuario no existe, no pertenece a ningún clan o ya era sub-lider de su clan.");
		else {
			this.sendReply("Usuario: " + userk.name + " nombrado correctamente sub-lider del clan " + clanTarget + ".");
			userk.popup(user.name + " te ha nombrado Sub-Lider del clan " + clanTarget + ".\nUtiliza el comando /clanhelp para más información.");
		}
	},

	degradarclan: 'declanauth',
	demoteclan: 'declanauth',
	declanauth: function (target, room, user) {
		var permisionClan = false;
		var params = target.split(',');
		if (!params) {
			return this.sendReply("Usage: /demoteclan member");
		}
		var clanUser = Clans.findClanFromMember(user.name);
		var clanTarget = Clans.findClanFromMember(params[0]);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var userb = toId(params[0]);
			var iduserwrit = toId(user.name);
			var perminsionValue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionValue >= 2 && clanTarget === clanUser) permisionClan = true;
		}
		if (!permisionClan && !this.can('clans')) return;
		var userk = Users.getExact(params[0]);
		if (!clanTarget) {
			return this.sendReply("El usuario no existe o no pertenece a ningún clan.");
		} else {
			var clanId = toId(clanTarget);
			var userId = toId(params[0]);
			if ((Clans.authMember(clanId, userId) > 2 && !this.can('clans')) || (Clans.authMember(clanId, userId) === 2 && perminsionValue < 3 && !this.can('clans'))) return false;
		}
		if (!Clans.deleteLeader(params[0])) {
			if (!Clans.deleteOficial(params[0])) {
				this.sendReply("El usuario no poseía ninguna autoridad dentro del clan.");
			} else {
				if (!userk || !userk.connected) {
					this.addModCommand(params[0] + " ha sido degradado de rango en " + clanTarget + " por " + user.name);
				} else {
					this.addModCommand(userk.name + " ha sido degradado de rango en " + clanTarget + " por " + user.name);
				}
			}
		} else {
			var oficialDemote = Clans.deleteOficial(params[0]);
			if (!userk || !userk.connected) {
				this.addModCommand(params[0] + " ha sido degradado de rango en " + clanTarget + " por " + user.name);
			} else {
				this.addModCommand(userk.name + " ha sido degradado de rango en " + clanTarget + " por " + user.name);
			}
		}
	},

	invitarclan: function (target, room, user) {
		var permisionClan = false;
		var clanUser = Clans.findClanFromMember(user.name);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var iduserwrit = toId(user.name);
			var permisionValue = Clans.authMember(clanUserid, iduserwrit);
			if (permisionValue > 0) permisionClan = true;
		}
		if (!permisionClan) return this.sendReply("/invitarclan - Acceso denegado");
		var params = target.split(',');
		if (!params) return this.sendReply("Usage: /invitarclan user");
		var userk = Users.getExact(params[0]);
		if (!userk || !userk.connected) return this.sendReply("Usuario: " + params[0] + " no existe o no está disponible.");
		if (!Clans.addInvite(clanUser, params[0]))
			this.sendReply("No se pudo invitar al usuario. ¿No existe, ya está invitado o está en otro clan?");
		else {
			clanUser = Clans.findClanFromMember(user.name);
			userk.popup(user.name + " te ha invitado a unirte al clan " + clanUser + ".\nPara unirte al clan escribe en el chat /aceptarclan " + clanUser);
			this.addModCommand(userk.name + " ha sido invitado a unirse al clan " + clanUser + " por " + user.name);
		}
	},
	aceptarclan: function (target, room, user) {
		var clanUser = Clans.findClanFromMember(user.name);
		if (clanUser) {
			return this.sendReply("Ya perteneces a un clan. No te puedes unir a otro.");
		}
		var params = target.split(',');
		if (!params) return this.sendReply("Usage: /aceptarclan clan");
		var clanpropio = Clans.getClanName(params[0]);
		if (!clanpropio) return this.sendReply("El clan no existe o no está disponible.");

		if (!Clans.aceptInvite(params[0], user.name))
			this.sendReply("El clan no existe o no has sido invitado a este.");
		else {
			this.sendReply("Te has unido correctamente al clan" + clanpropio);
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(user.name) + " se ha unido al clan: " + Tools.escapeHTML(Clans.getClanName(params[0])) + '</div>');
		}
	},
	inviteclear: 'borrarinvitaciones',
	borrarinvitaciones: function (target, room, user) {
		var permisionClan = false;
		var clanUser = Clans.findClanFromMember(user.name);
		if (!target) {
			if (clanUser) {
				var clanUserid = toId(clanUser);
				var iduserwrit = toId(user.name);
				var perminsionvalue = Clans.authMember(clanUserid, iduserwrit);
				if (perminsionvalue === 3) permisionClan = true;
			}
			if (!permisionClan) return false;
		} else {
			if (!this.can('clans')) return;
			clanUser = target;
		}
		if (!Clans.clearInvitations(clanUser))
			this.sendReply("El clan no existe o no está disponible.");
		else {
			this.sendReply("Lista de Invitaciones pendientes del clan " + clanUser + " borrada correctamente.");
		}
	},

	removeclanmember: function (target) {
		if (!this.can('clans')) return false;
		var params = target.split(',');
		if (params.length !== 2) return this.sendReply("Usage: /removeclanmember clan, member");
		if (!Clans.removeMember(params[0], params[1]))
			this.sendReply("Could not remove the user from the clan. Does the clan exist or has the user already been removed from it?");
		else {
			this.sendReply("User: " + params[1] + " successfully removed from the clan.");
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(params[1]) + " ha abandonado el clan: " + Tools.escapeHTML(Clans.getClanName(params[0])) + '</div>');
		}
	},

	expulsarclan: function (target, room, user) {
		var permisionClan = false;
		var params = target.split(',');
		if (!params) {
				return this.sendReply("Usage: /expulsarclan member");
		}
		var clanUser = Clans.findClanFromMember(user.name);
		var clanTarget = Clans.findClanFromMember(params[0]);
		if (clanUser) {
			var clanUserid = toId(clanUser);
			var userb = toId(params[0]);
			var iduserwrit = toId(user.name);
			var perminsionValue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionValue >= 2 && clanTarget === clanUser) permisionClan = true;
		}
		if (!permisionClan && !this.can('clans')) return;
		var currentWar = War.findClan(clanTarget);
		if (currentWar) {
			var currentWarParticipants = War.getTourData(currentWar);
			if (currentWarParticipants.teamAMembers[toId(params[0])] || currentWarParticipants.teamBMembers[toId(params[0])]) return this.sendReply("No puedes expulsar del clan si el miembro estaba participando en una war.");
		}
		var userk = Users.getExact(params[0]);
		if (!clanTarget) {
			return this.sendReply("El usuario no existe o no pertenece a ningún clan.");
		} else {
			var clanId = toId(clanTarget);
			var userId = toId(params[0]);
			if ((Clans.authMember(clanId, userId) > 2 && !this.can('clans')) || (Clans.authMember(clanId, userId) === 2 && perminsionValue < 3 && !this.can('clans'))) return false;
		}
		if (!Clans.removeMember(clanTarget, params[0])) {
			this.sendReply("El usuario no pudo ser expulsado del clan.");
		} else {
			if (!userk || !userk.connected) {
				this.addModCommand(params[0] + " ha sido expulsado del clan " + clanTarget + " por " + user.name);
			} else {
				this.addModCommand(userk.name + " ha sido expulsado del clan " + clanTarget + " por " + user.name);
			}
		}
	},

	 salirdelclan: 'abandonarclan',
	 clanleave: 'abandonarclan',
	 abandonarclan: function (target, room, user) {
		var clanUser = Clans.findClanFromMember(user.name);
		if (!clanUser) {
			return this.sendReply("No perteneces a ningún clan.");
		}
		var currentWar = War.findClan(clanUser);
		if (currentWar) {
			var currentWarParticipants = War.getTourData(currentWar);
			if (currentWarParticipants.teamAMembers[toId(user.name)] || currentWarParticipants.teamBMembers[toId(user.name)]) return this.sendReply("No puedes salir del clan si estabas participando en una war.");
		}
		if (!Clans.removeMember(clanUser, user.name)) {
			 this.sendReply("Error al intentar salir del clan.");
		} else {
			this.sendReply("Has salido del clan" + clanUser);
			Rooms.rooms.lobby.add('|raw|<div class="clans-user-join">' + Tools.escapeHTML(user.name) + " ha abandonado el clan: " + Tools.escapeHTML(Clans.getClanName(clanUser)) + '</div>');
		}
	},


	//new war system
	resetclanranking: function (target, room, user) {
		if (!this.can('clans')) return false;
		if (room.id !== 'staff') return this.sendReply("Este comando solo puede ser usado en la sala Staff");
		Clans.resetClansRank();
		this.addModCommand(user.name + " ha reiniciado el ranking de clanes.");
	},

	resetwarlog: function (target, room, user) {
		if (!this.can('clans')) return false;
		if (room.id !== 'staff') return this.sendReply("Este comando solo puede ser usado en la sala Staff");
		Clans.resetWarLog();
		this.addModCommand(user.name + " ha borrado todos los warlogs.");
	},

	pendingwars: 'wars',
	wars: function (target, room, user) {
		this.parse("/war search");
	},

	viewwar: 'vw',
	warstatus: 'vw',
	vw: function (target, room, user) {
		this.parse("/war round");
	},

	endwar: function (target, room, user) {
		this.parse("/war end");
	},

	warlog: function (target, room, user) {
		var autoclan = false;
		if (!target) autoclan = true;
		if (!this.canBroadcast()) return false;
		var clan = Clans.getRating(target);
		if (!clan) {
			target = Clans.findClanFromMember(target);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan && autoclan) {
			target = Clans.findClanFromMember(user.name);
			if (target)
				clan = Clans.getRating(target);
		}
		if (!clan) {
			this.sendReply("El clan especificado no existe o no está disponible.");
			return;
		}
		var f = new Date();
		var dateWar = f.getDate() + '-' + f.getMonth() + ' ' + f.getHours() + 'h';
		this.sendReply(
			"|raw| <center><big><big><b>Ultimas Wars del clan " + Tools.escapeHTML(Clans.getClanName(target)) + "</b></big></big> <br /><br />" + Clans.getWarLogTable(target) + '<br /> Fecha del servidor: ' + dateWar + '</center>'
		);
	},

	cerrarsalaclan: 'closeclanroom',
	closeclanroom: function (target, room, user) {
		var permisionClan = false;
		var clanRoom = Clans.findClanFromRoom(room.id);
		if (!clanRoom) return this.sendReply("Esta no es una sala de Clan.");
		var clanUser = Clans.findClanFromMember(user.name);
		if (clanUser && toId(clanRoom) === toId(clanUser)) {
			var clanUserid = toId(clanUser);
			var iduserwrit = toId(user.name);
			var perminsionvalue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionvalue >= 2) permisionClan = true;

		}
		if (!permisionClan && !this.can('clans')) return false;
		if (!Clans.closeRoom(room.id, clanRoom))
			this.sendReply("Error al intentar cerrar la sala. Es posible que ya esté cerrada.");
		else {
			this.addModCommand("Esta sala ha sido cerrada a quienes no sean miembros de " + clanRoom + " por " + user.name);
		}
	},

	abrirsalaclan: 'openclanroom',
	openclanroom: function (target, room, user) {
		var permisionClan = false;
		var clanRoom = Clans.findClanFromRoom(room.id);
		if (!clanRoom) return this.sendReply("Esta no es una sala de Clan.");
		var clanUser = Clans.findClanFromMember(user.name);
		if (clanUser && toId(clanRoom) === toId(clanUser)) {
			var clanUserid = toId(clanUser);
			var iduserwrit = toId(user.name);
			var perminsionvalue = Clans.authMember(clanUserid, iduserwrit);
			if (perminsionvalue >= 2) permisionClan = true;

		}
		if (!permisionClan && !this.can('clans')) return false;
		if (!Clans.openRoom(room.id, clanRoom))
			this.sendReply("Error al intentar abrir la sala. Es posible que ya esté abierta.");
		else {
			this.addModCommand("Esta sala ha sido abierta a todos los usuarios por " + user.name);
		}
	},

	kickall: function (target, room, user, connection) {
		if (user.locked || user.mutedRooms[room.id]) return this.sendReply("You cannot do this while unable to talk.");
		if (!this.can('makeroom')) return false;
		var targetUser;
		for (var f in room.users) {
			targetUser = Users.getExact(room.users[f]);
			if (!targetUser) {
				delete room.users[f];
			} else {
				targetUser.leaveRoom(room.id);
			}
		}
		room.userCount = 0;
		this.addModCommand("" + user.name + " has kicked all users from room " + room.id + '.');
		setTimeout(function () {user.joinRoom(room.id);}, 2000);
	},

	/*********************************************************
	 * Shop commands
	 *********************************************************/

	tienda: 'shop',
	shop: function (target, room, user) {
		if (!this.canBroadcast()) return false;
		this.sendReplyBox(
			'<center><h3><b><u>Tienda del servidor de Pokespain</u></b></h3><table border="1" cellspacing="0" cellpadding="3" target="_blank"><tbody>' +
			'<tr><th>Art&iacute;culo</th><th>Descripci&oacute;n</th><th>Coste</th></tr>' +
			'<tr><td>Chatroom</td><td>Compra una Sala de chat. Será pública o privada en función del motivo de su compra. Si se detecta spam de comandos / saturación del modlog será borrada.</td><td>10000</td></tr>' +
			'<tr><td>CustomTC</td><td>Compra una Tarjeta de Entrenador personalizada (a partir de código html). Contactar con un administrador si el código es muy largo para un solo mensaje.</td><td>8000</td></tr>' +
			'<tr><td>CustomAvatar</td><td>Compra un avatar personalizado. Preferiblemente debe ser una imagen de pequeñas dimensiones y acorde a las reglas del servidor. Contactar con un Admin para obtener este art&iacute;culo.</td><td>6000</td></tr>' +
			'<tr><td>Symbol</td><td>Compra el acceso al comado /customsymbol que permite elegir un símbolo (excepto staff) para aparecer en lo alto de la lista de usuarios.</td><td>4000</td></tr>' +
			'<tr><td>TC</td><td>Compra una Tarjeta de entrenador básica. Con una Imagen modificable con /tcimage y una frase de entrenador modificable con /tcphrase</td><td>3000</td></tr>' +
			'<tr><td>BotPhrase</td><td>Puedes establecer una frase personalizada para el comando .whois del Bot.</td><td>1500</td></tr>' +
			'<tr><td>Avatar</td><td>Si ya tienes un avatar personalizado. Puedes cambiarlo por otro diferente.</td><td>1000</td></tr>' +
			'<tr><td>Sprite</td><td>Añade la imagen de un Pokemon a tu TC Básica. Máximo 6. Se pueden cambiar los pokemon con el comando /tcpokemon</td><td>100</td></tr>' +
			'</tbody></table><br /> Para comprar un artículo usa el comando /buy (artículo)' +
			'<br /> Algunos artículos solo se pueden comprar contactando con un Administrador. Para más información usa /shophelp' +
			'</center>'
		);
	},

	ayudatienda: 'shophelp',
	shophelp: function () {
		if (!this.canBroadcast()) return false;
		this.sendReplyBox(
			"<center><h3><b><u>Tienda del servidor de Pokespain</u></b></h3></center>" +
			"<b>Comandos Básicos:</b><br /><br />" +
			"/shop - Muestra los artículos de la tienda.<br />" +
			"/buy (artículo) - Compra un artículo de la tienda.<br />" +
			"/pd (user) - muestra los ahorros de un usuario.<br />" +
			"/donate (user), (money) - Dona una cantidad determinada a otro usuario.<br />" +
			"<br />" +
			"<b>Comandos Específicos:</b><br /><br />" +
			"/tc (user) - Muestra la tarjeta de entrenador de un usuario.<br />" +
			"/tcimage (link) - Cambia la imagen de la Tc.<br />" +
			"/tcphrase (text) - Cambia la frase de la Tc.<br />" +
			"/tcpokemon (pokemon1),(pokemon2)... - Cambia Los sprites de los pokemon de la Tc.<br />" +
			"/tchtml (html) - Modifica la Tarjeta de entrenador personalizada.<br />" +
			"/customsymbol (symbol) - Cambia el símbolo a uno personalizado, pero sin cambiar por ello el rango.<br />" +
			"/resetsymbol - Reestablece el símbolo por omisión.<br />" +
			"/botphrase (texto) - Establece la frase del Bot para el comando .whois.<br />" +
			"<br />" +
			"<b>Comandos Administrativos:</b><br /><br />" +
			"/givemoney (user), (pds) - Da una cantidad de Pds a un usuario.<br />" +
			"/removemoney (user), (pds) - Quita una cantidad de Pds a un usuario.<br />" +
			"/symbolpermision (user), (on/off) - Da o Quita el permiso para usar Custom Symbols.<br />" +
			"/pendigavatars - Muestra la lista de avtares personalizados pendientes por incluir.<br />" +
			"/deavatarreq (user) - Eimina una solicitud de avatar de la lista.<br />" +
			"/removetc (user) - Elimina una tarjeta de entrenador.<br />" +
			"/setbotphrase (user), (text) - Modifica la frase del comando del Bot whois para un usuario.<br />" +
			"/setcustomtc (user), (on/off) - Establece el permiso para usar una Tc personalizada.<br />" +
			"/sethtmltc (user), (html) - Modifica la Tc personalizada de un usuario.<br />"
		);
	},

	comprar: 'buy',
	buy: function (target, room, user) {
		var params = target.split(',');
		var prize = 0;
		if (!params) return this.sendReply("Usage: /buy object");
		var article = toId(params[0]);
		switch (article) {
			case 'customtc':
				prize = 8000;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				var tcUser = Shop.getTrainerCard(user.name);
				if (!tcUser) {
					Shop.giveTrainerCard(user.name);
					tcUser = Shop.getTrainerCard(user.name);
				}
				if (tcUser.customTC) return this.sendReply("Ya poseías este artículo.");
				Shop.setCustomTrainerCard(user.name, true);
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has comprado una Tarjeta de entreador personalizada. Consulta /shophelp para más información.");
				break;
			case 'tc':
				prize = 3000;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				var tcUser = Shop.getTrainerCard(user.name);
				if (tcUser) return this.sendReply("Ya poseías este artículo.");
				Shop.giveTrainerCard(user.name);
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has comprado una Tarjeta de Entrenador. Revisa /shophelp para saber como editarla.");
				break;
			case 'sprite':
				prize = 100;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				var tcUser = Shop.getTrainerCard(user.name);
				if (!tcUser) return this.sendReply("Necesitas comprar primero una Tarjeta de entrenador.");
				if (tcUser.nPokemon > 5) return this.sendReply("Ya tienes 6 Pokemon para tu tarjeta de entrenador.");
				if (tcUser.customTC) return this.sendReply("Tu tarjeta es Personalizada. Usa /tchtml pata modificarla.");
				Shop.nPokemonTrainerCard(user.name, tcUser.nPokemon + 1);
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has comprado un Sprite de un pokemon para tu TC. Revisa /shophelp para más información.");
				break;
			case 'chatroom':
				prize = 10000;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				if (params.length !== 2) return this.sendReply("Usa el comando así: /buy chatroom,[nombre]");
				var id = toId(params[1]);
				if (Rooms.rooms[id]) return this.sendReply("La sala '" + params[1] + "' ya exsiste. Usa otro nombre.");
				if (Rooms.global.addChatRoom(params[1])) {
					if (!Rooms.rooms[id].auth) Rooms.rooms[id].auth = Rooms.rooms[id].chatRoomData.auth = {};
					Rooms.rooms[id].auth[toId(user.name)] = '#';
					if (Rooms.rooms[id].chatRoomData) Rooms.global.writeChatRoomData();
					Shop.removeMoney(user.name, prize);
					return this.sendReply("La sala '" + params[1] + "' fue creada con éxito. Únete usando /join " + id);
				}
				return this.sendReply("No se pudo realizar la compra debido a un error al crear la sala '" + params[1] + "'.");
				break;
			case 'symbol':
				prize = 4000;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				if (Shop.symbolPermision(user.name)) return this.sendReply("Ya posees este artículo.");
				Shop.setSymbolPermision(user.name, true);
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has comprado el permiso para usar los comandos /customsymbol y /resetsymbol. Para más información consulta /shophelp.");
				break;
			case 'avatar':
				prize = 1000;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				if (!Config.customAvatars[user.userid]) return this.sendReply("No tenías un avatar personalizado.");
				if (params.length !== 2) return this.sendReply("Usa el comando así: /buy avatar,[imagen]");
				var err = Shop.addPendingAvatar(user.userid, params[1]);
				if (err) return this.sendReply(err);
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has solicitado un cambio de tu avatar personalizado. Espera a que un admin revise tu compra.");
				break;
			case 'customavatar':
				prize = 6000;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				if (Config.customAvatars[user.userid]) return this.sendReply("Ya habías comprado este artículo. Para cambiar tu avatar compra la opcion Avatar");
				if (params.length !== 2) return this.sendReply("Usa el comando así: /buy avatar,[imagen]");
				var err = Shop.addPendingAvatar(user.userid, params[1]);
				if (err) return this.sendReply(err);
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has solicitado un avatar personalizado. Espera a que un admin revise tu compra.");
				break;
			case 'botphrase':
				prize = 1500;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				if (Shop.getBotPhrase(user.name)) return this.sendReply("Ya posees este articulo.");
				if (params.length < 2) return this.sendReply("Usa el comando así: /buy botphrase, [texto]");
				if (toId(params[1]) === 'off') return this.sendReply("Usa el comando así: /buy botphrase, [texto]");
				if (params[1].length > 150) return this.sendReply("La frase es demasiado larga. Debe ser menor a 150 caracteres.");
				Shop.changeBotPhrase(user.name, Tools.escapeHTML(target.substr(params[0].length + 1)));
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has comprado una frase personalizada para el comando .whois del Bot. Puedes cambiarla tantas veces como quieras con /botphrase.");
				break;
			default:
				return this.sendReply("No has especificado ningún artículo válido.");
		}
	},

	money: 'pd',
	pd: function (target, room, user) {
		var autoData = false;
		if (!target) autoData = true;
		if (!this.canBroadcast()) return false;

		var pds = 0;
		var userName = user.name;
		if (autoData) {
			pds = Shop.getUserMoney(user.name);
		} else {
			pds = Shop.getUserMoney(target);
			userName = toId(target);
			var userh = Users.getExact(target);
			if (userh) userName = userh.name;
		}
		this.sendReplyBox('Ahorros de <b>' + userName + '</b>: ' + pds + ' pd');
	},

	trainercard: 'tc',
	tc: function (target, room, user) {
		var autoData = false;
		if (!target) autoData = true;
		if (!this.canBroadcast()) return false;

		var pds = 0;
		var userName = user.name;
		var tcData = {};
		if (autoData) {
			tcData = Shop.getTrainerCard(user.name);
		} else {
			tcData = Shop.getTrainerCard(target);
			userName = toId(target);
			var userh = Users.getExact(target);
			if (userh) userName = userh.name;
		}
		if (!tcData) return this.sendReply(userName + " no tenía ninguna tarjeta de entrenador.");
		if (tcData.customTC) return this.sendReplyBox(tcData.customHtml);
		var pokeData = '<hr />';
		for (var t in tcData.pokemon) {
			pokeData += '<img src="http://play.pokemonshowdown.com/sprites/xyani/' + Tools.escapeHTML(Shop.getPokemonId(tcData.pokemon[t])) + '.gif" width="auto" /> &nbsp;';
		}
		if (tcData.nPokemon === 0) pokeData = '';
		this.sendReplyBox('<center><h2>' + userName + '</h2><img src="' + encodeURI(tcData.image) + '" width="80" height="80" title="' + userName + '" /><br /><br /><b>"' + Tools.escapeHTML(tcData.phrase) + '"</b>' + pokeData + '</center>');
	},

	givemoney: function (target, room, user) {
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /givemoney usuario, pds");
		if (!this.can('givemoney')) return false;

		var pds = parseInt(params[1]);
		if (pds <= 0) return this.sendReply("La cantidad no es valida.");
		var userh = Users.getExact(params[0]);
		if (!userh || !userh.connected) return this.sendReply("El usuario no existe o no está disponible");
		var userName = userh.name;
		if (!Shop.giveMoney(params[0], pds)) {
			this.sendReply("Error desconocido.");
		} else {
			this.sendReply(userName + ' ha recibido ' + pds + ' pd');
		}
	},

	removemoney: function (target, room, user) {
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /removemoney usuario, pds");
		if (!this.can('givemoney')) return false;

		var pds = parseInt(params[1]);
		if (pds <= 0) return this.sendReply("La cantidad no es valida.");
		var userh = Users.getExact(params[0]);
		var userName = toId(params[0]);
		if (userh) userName = userh.name;
		if (!Shop.removeMoney(params[0], pds)) {
			this.sendReply("El usuario no tenía suficientes Pds.");
		} else {
			this.sendReply(userName + ' ha perdido ' + pds + ' pd');
		}
	},

	donar: 'donate',
	donate: function (target, room, user) {
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /donate usuario, pds");

		var pds = parseInt(params[1]);
		if (!pds || pds <= 0) return this.sendReply("La cantidad no es valida.");
		var userh = Users.getExact(params[0]);
		if (!userh || !userh.connected) return this.sendReply("El usuario no existe o no está disponible");
		var userName = userh.name;
		if (!Shop.transferMoney(user.name, params[0], pds)) {
			this.sendReply("No tienes suficientes pds.");
		} else {
			this.sendReply('Has donado ' + pds + ' pd al usuario ' + userName + '.');
		}
	},

	setbotphrase: function (target, room, user) {
		if (!this.can('givemoney')) return false;
		if (!target) return this.sendReply("Usage: /setbotphrase [user], [phrase]");
		var params = target.split(',');
		if (!params || params.length < 2) return this.sendReply("Usage: /setbotphrase [user], [phrase]");
		var targetUser = Users.get(params[0]);
		if (!targetUser && toId(params[0]) !== 'off') return this.sendReply("El usuario " + toId(params[0]) + 'no está disponible en este momento.');
		Shop.changeBotPhrase(params[0], target.substr(params[0].length + 1));
		return this.sendReply("La frase descriptiva del usuario " + toId(params[0]) + ' ha sido modificada con exito.');
	},

	botphrase: function (target, room, user) {
		if (!Shop.getBotPhrase(user.name)) return this.sendReply("Debes comprar este articulo en la tienda antes de poder usarlo.");
		if (!target) return this.sendReply("Usage: /botphrase texto");
		if (toId(target) === 'off') return this.sendReply("Usage: /botphrase texto");
		if (target.length > 150) return this.sendReply("La frase es demasiado larga. Debe ser menor a 150 caracteres.");
		Shop.changeBotPhrase(user.name, Tools.escapeHTML(target));
		return this.sendReply("Frase modificada con exito.");
	},

	removetc: function (target, room, user) {
		if (!this.can('givemoney')) return false;
		if (!target) return this.sendReply("Usage: /removetc usuario");
		if (Shop.removeTrainerCard(target)) {
			return this.sendReply("Tarjeta de entrenador del usuario " + toId(target) + ' eliminada.');
		} else {
			return this.sendReply("El usuario no poseía Tc.");
		}
	},

	setcustomtc: function (target, room, user) {
		if (!this.can('givemoney')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /setcustomtc usuario, [on/off]");
		var permision = false;
		if (toId(params[1]) !== 'on' && toId(params[1]) !== 'off') return this.sendReply("Usage: /setcustomtc usuario, [on/off]");
		if (toId(params[1]) === 'on') permision = true;
		if (permision) {
			var userh = Users.getExact(params[0]);
			if (!userh || !userh.connected) return this.sendReply("El usuario no existe o no está disponible");
			if (Shop.setCustomTrainerCard(params[0], permision)) return this.sendReply("Permiso para customtrainercards concedido a " + userh.name);
			return this.sendReply("El usuario no poseía Tc o ya tenía el permiso para customtrainercards.");
		} else {
			if (Shop.setCustomTrainerCard(params[0], permision)) return this.sendReply("Permiso para customtrainercards retirado a " + params[0]);
			return this.sendReply("El usuario no poseía Tc o no tenía el permiso para customtrainercards.");
		}
	},

	tcimage: function (target, room, user) {
		if (!target) return this.sendReply("Usage: /tcimage link");
		var tcData = Shop.getTrainerCard(user.name);
		if (!tcData) return this.sendReply("No posees ninguna tarjeta de entrenador.");
		if (tcData.customTC) return this.sendReply("Tu tarjeta es personalizada. usa /tchtml para cambiarla.");
		if (target.length > 120) return this.sendReply("El enlace es demasiado largo.");
		if (Shop.imageTrainerCard(user.name, target)) {
			return this.sendReply("Imagen de la TC cambiada con éxito.");
		} else {
			return this.sendReply("Error al cambiar la imagen de la TC.");
		}
	},

	tcphrase: function (target, room, user) {
		if (!target) return this.sendReply("Usage: /tcphrase text");
		var tcData = Shop.getTrainerCard(user.name);
		if (!tcData) return this.sendReply("No posees ninguna tarjeta de entrenador.");
		if (tcData.customTC) return this.sendReply("Tu tarjeta es personalizada. usa /tchtml para cambiarla.");
		if (target.length > 120) return this.sendReply("La frase es muy larga.");
		if (Shop.phraseTrainerCard(user.name, target)) {
			return this.sendReply("Frase de la TC cambiada con éxito.");
		} else {
			return this.sendReply("Error al cambiar la frase de la TC.");
		}
	},

	tcpokemon: function (target, room, user) {
		if (!target) return this.sendReply("Usage: /tcpokemon [Pokemon1], [Pokemon2]...");
		var params = target.split(',');
		var tcData = Shop.getTrainerCard(user.name);
		if (!tcData) return this.sendReply("No posees ninguna tarjeta de entrenador.");
		if (tcData.customTC) return this.sendReply("Tu tarjeta es personalizada. usa /tchtml para cambiarla.");
		if (params.length > tcData.nPokemon) return this.sendReply("Has especificado más Pokemon de los que has comprado.");
		var pokemonList = {};
		var pokemonId = '';
		for (var h in params) {
			pokemonId = Tools.escapeHTML(params[h]);
			if (pokemonId.length > 20) return this.sendReply("Alguno de los nombres de los Pokemon era muy largo.");
			pokemonList[h] = pokemonId;
		}
		if (Shop.pokemonTrainerCard(user.name, pokemonList)) {
			return this.sendReply("Los pokemon de la Tc han sido modificados.");
		} else {
			return this.sendReply("Error al cambiar los pokemon de la TC.");
		}
	},

	tchtml: 'tccustom',
	tccustom: function (target, room, user) {
		var tcData = Shop.getTrainerCard(user.name);
		if (!tcData) return this.sendReply("No posees ninguna tarjeta de entrenador.");
		if (!tcData.customTC) return this.sendReply("Tu tarjeta no es personalizada.");
		if (!target) {
			this.sendReply('Html de tu Tarjeta de entrenador:');
			this.sendReplyBox(Tools.escapeHTML(tcData.customHtml));
			return;
		}
		if (target.length > 1000) return this.sendReply("Tu código es demasiado largo. Contacta con un administrador para modificar la TC custom.");
		var targetABS = Shop.deleteValues(target);
		if (Shop.htmlTrainerCard(user.name, targetABS)) {
			return this.sendReply("La tarjeta de entrenador personalizada ha sido modificada.");
		} else {
			return this.sendReply("Error al cambiar los datos.");
		}
	},

	sethtmltc: function (target, room, user) {
		if (!this.can('givemoney')) return false;
		var params = target.split(',');
		if (!params || params.length < 2) return this.sendReply("Usage: /sethtmltc usuario, html");
		var tcData = Shop.getTrainerCard(params[0]);
		if (!tcData) return this.sendReply("El usuario no posee ninguna tarjeta de entrenador.");
		if (!tcData.customTC) return this.sendReply("La tarjeta no es personalizada.");
		var targetABS = Shop.deleteValues(target.substr(params[0].length + 1));
		if (Shop.htmlTrainerCard(params[0], targetABS)) {
			return this.sendReply("La tarjeta de entrenador personalizada ha sido modificada.");
		} else {
			return this.sendReply("Error al cambiar los datos.");
		}
	},

	avatarespendientes: 'pendingavatars',
	pendingavatars: function (target, room, user) {
		if (!this.canBroadcast()) return false;
		this.sendReplyBox(Shop.getPendingAvatars());
	},

	deavatarreq: 'deleteavatarrequest',
	deleteavatarrequest: function (target, room, user) {
		if (!this.can('givemoney')) return false;
		if (!target) return this.sendReply("No has especificado ningun usuario.");
		var err = Shop.deletePendingAvatar(target);
		if (err) return this.sendReply(err);
		this.sendReply("Solicitud de avatar eliminada");
	},

	/*********************************************************
	 * League commands
	 *********************************************************/

	ayudaliga: 'leaguehelp',
	leaguehelp: function (target, room, user) {
		return this.sendReplyBox(
			"<center><h3><b><u>Lista de Comandos para las Ligas</u></b></h3></center>" +
			"<br /><b>Comandos Usuales</b><br />" +
			"/medallas [user] - Muestra las medallas con las que cuenta un usuario.<br />" +
			"/liga [name] - Comando para mostrar la informacion más general de una liga (miembros y sala).<br />" +
			"/darmedalla [user] - Entrega una medalla como miembro de una liga.<br />"  +
			"/quitarmedalla [user] - Retira una medalla como miembro de una liga.<br />" +
			"<br /><b>Comandos Administrativos</b><br />" +
			"/medallist - Muestra la lista de Ids de la base de datos de medallas.<br />" +
			"/medaldata [id] - Muestra una de las medallas por su ID.<br />" +
			"/addmedal [id], [name], [width], [height], [image] - Agrega una medalla al server.<br />" +
			"/deletemedal [id] - Elimina una medalla.<br />" +
			"/editmedal [id], [name/image/width/height], [data] - Modifica las propiedades de una medalla.<br />" +
			"/leguelist - Muestra la lista de Ids de la base de datos de ligas.<br />"  +
			"/addleague [id], [name], [room] - Comando para registrar una liga.<br />"  +
			"/deleteleague [id] - Comando para eliminar una liga.<br />"  +
			"/editleague [id], [name/room], [data] - Edita la informacion de la liga.<br />"  +
			"/setgymleader [id-league], [user], [id-medal] - Establece un usuario como miembro de la liga.<br />"  +
			"/setgymleader [id-league], [user], [id-medal] - Establece un usuario como elite de la liga.<br />"  +
			"/removegymleader [id-league], [id-medal] - Elimina un puesto de una liga.<br />"  +
			"/darmedalla [user], (id) - Entrega una medalla.<br />"  +
			"/quitarmedalla [user], (id) - Retira una medalla.<br />"
		);
	},

	medallist: function (target, room, user) {
		if (!this.can("league")) return false;
		return this.sendReplyBox("Medallas (ID): " + League.getAllMedals());
	},

	medaldata: function (target, room, user) {
		if (!this.can("league")) return false;
		if (!target) return this.sendReply("No has especificado ninguna medalla.");
		var medalData = League.getMedalData(target);
		if (!medalData) return this.sendReply("La medalla especificada no existe.");
		return this.sendReplyBox('<b>' + Tools.escapeHTML(medalData.name) + ':</b><br /><img src="' + encodeURI(medalData.image) + '" title="' + Tools.escapeHTML(medalData.name) + '" width="' + Tools.escapeHTML(medalData.width) + '" height="' + Tools.escapeHTML(medalData.height) + '" />&nbsp;');
	},

	newmedal: 'addmedal',
	addmedal: function (target, room, user) {
		if (!this.can("league")) return false;
		if (!target) return this.sendReply("No has especificado ninguna medalla.");
		var params = target.split(',');
		if (!params || params.length < 5) return this.sendReply("Usage: /addmedal [id], [name], [width], [height], [image]");
		if (League.newMedal(params[0], params[1], params[4], params[2], params[3])) return this.sendReply("Medalla: " + toId(params[0]) + " creada con exito.");
		this.sendReply("La medalla especificada ya existía.");
	},

	deletemedal: function (target, room, user) {
		if (!this.can("league")) return false;
		if (!target) return this.sendReply("No has especificado ninguna medalla.");
		if (League.deleteMedal(target)) return this.sendReply("Medalla: " + toId(target) + " eliminada con exito.");
		this.sendReply("La medalla especificada no existe.");
	},

	medaledit: 'editmedal',
	editmedal: function (target, room, user) {
		if (!this.can("league")) return false;
		if (!target) return this.sendReply("No has especificado ninguna medalla.");
		var params = target.split(',');
		if (!params || params.length < 3) return this.sendReply("Usage: /editmedal [id], [name/image/width/height], [data]");
		var opc = toId(params[1]).substr(0,1);
		if (League.editMedal(params[0], opc, params[2])) return this.parse("/medaldata " + params[0]);
		this.sendReply("Alguno de los datos no es correcto.");
	},

	medals: 'medallas',
	vermedallas: 'medallas',
	medallas: function (target, room, user) {
		if (!this.canBroadcast()) return false;
		var autoData = false;
		var targetUser = toId(user.name);
		if (target) targetUser = toId(target);
		var userT = Users.get(targetUser);
		if (userT) {
			userT = userT.name;
		} else {
			userT = targetUser;
		}
		var html = '<center><h2>Medallas de ' + userT + '</h2><center>';
		html += League.getMedalRaw(userT);
		return this.sendReplyBox(html);
	},

	leaguemedal: 'medallaliga',
	medallaliga: function (target, room, user) {
		if (!this.canBroadcast()) return false;
		var autoData = false;
		var targetUser = toId(user.name);
		if (target) targetUser = toId(target);
		var userT = Users.get(targetUser);
		if (userT) {
			userT = userT.name;
		} else {
			userT = targetUser;
		}
		var medalId = League.findMedal(userT);
		if (medalId) return this.sendReply(userT + " no es miembro de ninguna liga del servidor.");
		var medalData = League.getMedalData(medalId);
		if (!medalData) return this.sendReply("La medalla especificada no existe.");
		return this.sendReplyBox(userT + ' puede hacer entrega de: <b>' + Tools.escapeHTML(medalData.name) + ':</b><br /><br /><img src="' + encodeURI(medalData.image) + '" title="' + Tools.escapeHTML(medalData.name) + '" width="' + Tools.escapeHTML(medalData.width) + '" height="' + Tools.escapeHTML(medalData.height) + '" />&nbsp;');
	},

	qmedals: function (target, room, user, connection) {
		//low level commmand
		if (Config.emergency && ResourceMonitor.countCmd(connection.ip, user.name)) return false;
		connection.send('|queryresponse|userdetails|' + JSON.stringify({
			medals: League.getMedalQuery(user.name),
		}));
		return false;
	},

	league: 'liga',
	lideres: 'liga',
	liga: function (target, room, user) {
		if (!this.canBroadcast()) return false;
		var leagueId = League.findLeague(target, room.id);
		if (!leagueId) return this.sendReply("La liga especificada no está registrada en el servidor.");
		return this.sendReplyBox(League.getLeagueTable(leagueId));
	},

	leaguelist: function (target, room, user) {
		if (!this.can("league")) return false;
		return this.sendReplyBox("Ligas (ID): " + League.getAllLeagues());
	},

	newleague: 'addleague',
	addleague: function (target, room, user) {
		if (!this.can("league")) return false;
		if (!target) return this.sendReply("No has especificado ninguna liga.");
		var params = target.split(',');
		if (!params || params.length < 3) return this.sendReply("Usage: /addleague [id], [name], [room]");
		if (League.newLeague(params[0], params[1], params[2])) return this.sendReply("Liga: " + toId(params[0]) + " creada con exito.");
		this.sendReply("La liga especificada ya existía.");
	},

	deleteleague: function (target, room, user) {
		if (!this.can("league")) return false;
		if (!target) return this.sendReply("No has especificado ninguna liga.");
		if (League.deleteLeague(target)) return this.sendReply("Liga: " + toId(target) + " eliminada con exito.");
		this.sendReply("La liga especificada no existe.");
	},

	eleague: 'editleague',
	editleague: function (target, room, user) {
		if (!this.can("league")) return false;
		if (!target) return this.sendReply("No has especificado ninguna liga.");
		var params = target.split(',');
		if (!params || params.length < 3) return this.sendReply("Usage: /editleague [id], [name/room], [data]");
		var opc = toId(params[1]).substr(0,1);
		if (League.editLeague(params[0], opc, params[2])) return this.parse("/liga " + params[0]);
		this.sendReply("Alguno de los datos no es correcto.");
	},

	setgymleader: function (target, room, user) {
		if (!this.can('league')) return false;
		if (!target) return this.sendReply('Usage: /setgymleader [id-league], [user], [id-medal]');
		var params = target.split(',');
		if (!params || params.length < 3) return this.sendReply("Usage: /setgymleader [id-league], [user], [id-medal]");
		if (!Users.get(params[1])) this.sendReply('Warning: ' + toId(params[1]) + ' is offline.');
		if (League.addLeader(params[0], params[1], 'g', params[2])) return this.sendReply('Usuario ' + toId(params[1]) + ' asignado en el puesto correspondiente.');
		this.sendReply("Alguno de los datos no es correcto.");
	},

	setelite: function (target, room, user) {
		if (!this.can('league')) return false;
		if (!target) return this.sendReply('Usage: /setelite [id-league], [user], [id-medal]');
		var params = target.split(',');
		if (!params || params.length < 3) return this.sendReply("Usage: /setelite [id-league], [user], [id-medal]");
		if (!Users.get(params[1])) this.sendReply('Warning: ' + toId(params[1]) + ' is offline.');
		if (League.addLeader(params[0], params[1], 'e', params[2])) return this.sendReply('Usuario ' + toId(params[1]) + ' asignado en el puesto correspondiente.');
		this.sendReply("Alguno de los datos no es correcto.");
	},

	removegymleader: function (target, room, user) {
		if (!this.can('league')) return false;
		if (!target) return this.sendReply('Usage: /removegymleader [id-league], [id-medal]');
		var params = target.split(',');
		if (!params || params.length < 2) return this.sendReply("Usage: /removegymleader [id-league], [id-medal]");
		if (League.removeLeader(params[0], params[1])) return this.sendReply('Puesto de la liga especificada borrado con exito.');
		this.sendReply("Alguno de los datos no es correcto.");
	},

	givemedal: 'darmedalla',
	concedemedal: 'darmedalla',
	darmedalla: function (target, room, user) {
		if (!target) return this.sendReply('Usage: /darmedalla [user], (id)');
		var params = target.split(',');
		if (params.length === 1) {
			var userT = Users.get(params[0]);
			if (!userT) return this.sendReply('El usuario ' + toId(target) + ' no existe o no está disponible.');
			var medalId = League.findMedal(user.name);
			if (!medalId) return this.sendReply('No estas registrado como miembro de ninguna liga.');
			if (League.findLeagueFromRoom(room.id) !== League.findLeagueFromLeader(user.userid)) return this.sendReply('Este comando solo puede ser usado en la Sala correspondiente a la liga.');
			var medalData = League.getMedalData(medalId);
			if (!League.giveMedal(medalId, params[0])) return this.sendReply('El usuario ya poseía la medalla que intentas entregar.');
			userT.popup(user.name + " te ha entregado la siguiente medalla: " + medalData.name + "\nRecuerda que puedes comproar tus medallas con el comando /medallas");
			this.addModCommand(user.name + " ha entregado su medalla (" + medalData.name + ") a " + toId(target) + '.');
			return;
		} else if(params.length > 1){
			if (!this.can('league')) return false;
			var userT = Users.get(params[0]);
			if (!userT) return this.sendReply('El usuario ' + toId(params[0]) + ' no existe o no está disponible.');
			if (!League.giveMedal(params[1], params[0])) return this.sendReply('El usuario ya poseía dicha medalla o el Id es incorrecto.');
			return this.sendReply('Medalla (' + League.getMedalData(params[1]).name + ') entregada a ' + toId(params[0]) + '.');
		}
		return this.sendReply('Usage: /darmedalla [user], (id)');
	},

	removemedal: 'quitarmedalla',
	quitarmedalla: function (target, room, user) {
	if (!target) return this.sendReply('Usage: /quitarmedalla [user], (id)');
		var params = target.split(',');
		if (params.length === 1) {
			var medalId = League.findMedal(user.name);
			if (!medalId) return this.sendReply('No estas registrado como miembro de ninguna liga.');
			if (League.findLeagueFromRoom(room.id) !== League.findLeagueFromLeader(user.userid)) return this.sendReply('Este comando solo puede ser usado en la Sala correspondiente a la liga.');
			if (!League.removeMedal(medalId, params[0])) return this.sendReply('El usuario ya poseía la medalla que intentas entregar.');
			this.addModCommand(user.name + " ha retirado su medalla a " + toId(target) + '.');
			return;
		} else if(params.length > 1){
			if (!this.can('league')) return false;
			if (!League.removeMedal(params[1], params[0])) return this.sendReply('El usuario no poseía dicha medalla o el Id es incorrecto.');
			return this.sendReply('Medalla (' + League.getMedalData(params[1]).name + ') retirada a ' + toId(params[0]) + '.');
		}
		return this.sendReply('Usage: /quitarmedalla [user], (id)');
	}
};

process.nextTick(function () {
	// This slow operation is done *after* we start listening for connections
	// to the server. Anybody who connects while data is loading will
	// have to wait a couple seconds before they are able to join the server, but
	// at least they probably won't receive a connection error message.

	Tools.includeData();
});
