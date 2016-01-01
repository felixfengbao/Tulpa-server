exports.commands = {
	foro: function () {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("<a href=\"http://ultimatepsim.proboards.com\">Foro de Ultimate Server!</a>");
	},
	plugdj: function () {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("<a href=\"http://plug.dj/ultimateps/\">Plug DJ de Ultimate!</a>");
	},
	afkhelp: function () {
		if (!this.canBroadcast()) return;
		this.sendReplyBox("<strong> Comandos de Afk : </strong><br />" +
			  "/ausente <br />" +
                          "/ocupado <br />" +
			  "/comiendo <br />" +
			  "/aburrido <br />" +
                          "/durmiendo <br />" +
                          "/grabando (Especialmente para los youtubers)<br />" +
                          "/programando (Especialmente para los programadores del servidor).<br />" +
                          "<br />" );
	},
        stafflist: 'authlist',
	authlist: function (target, room, user, connection) {
		var rankLists = {};
		for (var u in Users.usergroups) {
			var rank = Users.usergroups[u][0];
			var name = Users.usergroups[u].slice(1);
			if (!rankLists[rank]) rankLists[rank] = [];
			if (name) name = name.replace("\n", "").replace("\r", "");
			rankLists[rank].push(name);
		}
		var buffer = [];
		Object.keys(rankLists).sort(function (a, b) {
			return Config.groups[b].rank - Config.groups[a].rank;
		}).forEach(function (r) {
			buffer.push(Config.groups[r].name + "s (" + r + "):\n" + rankLists[r].sort().join(", "));
		});

		if (!buffer.length) {
			buffer = "This server has no auth.";
		}
		connection.popup(buffer.join("\n\n"));
	},

	clearall: function (target, room, user) {
		if (!this.can('makeroom')) return this.sendReply('/clearall - Access denied.');
		var len = room.log.length,
			users = [];
		while (len--) {
			room.log[len] = '';
		}
		for (var user in room.users) {
			users.push(user);
			Users.get(user).leaveRoom(room, Users.get(user).connections[0]);
		}
		len = users.length;
		setTimeout(function() {
			while (len--) {
				Users.get(users[len]).joinRoom(room, Users.get(users[len]).connections[0]);
			}
		}, 1000);
	},
	
	destroymodlog: function (target, room, user, connection) {
		if (!user.hasConsoleAccess(connection)) {return this.sendReply("/destroymodlog - Access denied.");}
		var fsscript = require('fs');
		var logPath = LOGS_DIR + 'modlog/';
		if (CommandParser.modlog && CommandParser.modlog[room.id])  {
			CommandParser.modlog[room.id].close();
			delete CommandParser.modlog[room.id];
		}
		try {
			fsscript.unlinkSync(logPath + "modlog_" + room.id + ".txt");
			this.addModCommand(user.name + " ha destruido el modlog de esta sala." + (target ? ('(' + target + ')') : ''));
		} catch (e) {
			this.sendReply("No se puede destruir el modlog de esta sala.");
		}
	},

	roomlist: function (target, room, user) {
		if (!this.can('roomlist')) return;
		var rooms = Object.keys(Rooms.rooms);
		var len = rooms.length;
		var official = ['<b><font color="#1a5e00" size="2">Salas oficiales:</font></b><br><br>'];
		var nonOfficial = ['<hr><b><font color="#000b5e" size="2">Salas no-oficiales:</font></b><br><br>'];
		var privateRoom = ['<hr><b><font color="#5e0019" size="2">Salas privadas:</font></b><br><br>'];
		while (len--) {
			var _room = Rooms.rooms[rooms[(rooms.length - len) - 1]];
			if (_room.type === 'chat') {
				if (_room.isOfficial) {
					official.push(('<a href="/' + _room.title + '" class="ilink">' + _room.title + '</a> |'));
				} else if (_room.isPrivate) {
					privateRoom.push(('<a href="/' + _room.title + '" class="ilink">' + _room.title + '</a> |'));
				} else {
					nonOfficial.push(('<a href="/' + _room.title + '" class="ilink">' + _room.title + '</a> |'));
				}
			}
		}
		this.sendReplyBox(official.join(' ') + nonOfficial.join(' ') + privateRoom.join(' '));
	},

    staffpm: 'pmallstaff',
    pmstaff: 'pmallstaff',
    pmallstaff: function (target, room, user) {
        if (!this.can('pmstaff')) return this.sendReply('/pmstaff - Access denied.');
        if (!target) return this.sendReply('/pmallstaff [message] - Sends a PM to every staff member online.');

        var pmName = '~Staff PM [Do not reply]';

        for (var i in Users.users) {
            if (Users.users[i].isStaff) {
                Users.users[i].send('|pm|' + pmName + '|' + Users.users[i].group + Users.users[i].name + '|' + target);
            }
        }
    },

    pmroom: 'rmall',
    rmall: function (target, room, user) {
        if(!this.can('ban')) return this.sendReply('/rmall - Access denied.');
        if (!target) return this.sendReply('/rmall [message] - Sends a pm to all users in the room.');

        var pmName = '~Room PM [Do not reply]';

        for (var i in room.users) {
            var message = '|pm|' + pmName + '|' + room.users[i].getIdentity() + '|' + target;
            room.users[i].send(message);
        }
    },

    seen: function(target, room) {
        if (!this.canBroadcast()) return;
        if (!target) return this.sendReply('/seen [username] - Shows when the user last connected on the server.');
        var user = Users.get(target);
        if (user && user.connected) return this.sendReplyBox(target + ' is <b>currently online</b>.');
        var self = this;
        User.findOne({name: toId(target)}, function(err, user) {
            if (err) throw err;
            if (!user || !user.seen) {
                self.sendReplyBox(target + ' has never been online on this server.');
                return room.update();
            }
            self.sendReplyBox(target + ' was last seen <b>' + moment(user.seen).fromNow() + '</b>.');
            room.update();
        });
    },
	
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
			'<center><h3><b><u>Tienda de <font color="blue">Ultimate</font></u></b></h3><table border="1" cellspacing="0" cellpadding="3" target="_blank"><tbody>' +
			'<tr><th>Art&iacute;culo</th><th>Descripci&oacute;n</th><th>Coste</th></tr>' +
			'<tr><td>CustomAvatar</td><td>Compra un avatar personalizado. Preferiblemente debe ser una imagen de pequeñas dimensiones y acorde a las reglas del servidor. (Contacta un Administrador)</td><td>4000</td></tr>' +
			'<tr><td>Kick</td><td>Compra un kick del Lobby, puedes elegir a cualquier usuario incluso staff. (Contacta un Administrador)</td><td>900</td></tr>' +
			'<tr><td>Global Voice</td><td>Compra global voice por 1 día. (Contacta un Administrador)</td><td>1000</td></tr>' +
			'<tr><td>Room Voice</td><td>Compra room voice en el Lobby por una semana. (Contacta un Administrador)</td><td>1000</td></tr>' +
			'<tr><td>Declare</td><td>Compra un declare en el Lobby, algunos puede ser rechazados. (Contacta un Administrador)</td><td>1000</td></tr>' +
			'<tr><td>Symbol</td><td>Compra el acceso al comado /customsymbol que permite elegir un símbolo (excepto staff) para aparecer en lo alto de la lista de usuarios.</td><td>4000</td></tr>' +
			'<tr><td>Tarjeta de Entrenador</td><td>Compra una Tarjeta de entrenador básica. (Contacta un Administrador)</td><td>3000</td></tr>' +
			'<tr><td>Cambio de Avatar</td><td>Si ya tienes un avatar personalizado. Puedes cambiarlo por otro diferente. (Contacta un Administrador)</td><td>200</td></tr>' +
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
		if (!params) return this.sendReply("Uso: /buy object");
		var article = toId(params[0]);
		switch (article) {
			case 'symbol':
				prize = 4000;
				if (Shop.getUserMoney(user.name) < prize) return this.sendReply("No tienes suficiente dinero.");
				if (Shop.symbolPermision(user.name)) return this.sendReply("Ya posees este artículo.");
				Shop.setSymbolPermision(user.name, true);
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Has comprado el permiso para usar los comandos /customsymbol y /resetsymbol. Para más información consulta /shophelp.");
				break;
			case 'cambiodeavatar':
				prize = 0;
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Si quieres comprar este articulo, contacta un Administrador (~).");
				break;
			case 'globalvoice':
				prize = 0;
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Si quieres comprar este articulo, contacta un Administrador (~).");
				break;
			case 'roomvoice':
				prize = 0;
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Si quieres comprar este articulo, contacta un Administrador (~).");
				break;
			case 'tarjetadeentrenador':
				prize = 0;
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Si quieres comprar este articulo, contacta un Administrador (~).");
				break;
			case 'declare':
				prize = 0;
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Si quieres comprar este articulo, contacta un Administrador (~).");
				break;
			case 'kick':
				prize = 0;
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Si quieres comprar este articulo, contacta un Administrador (~).");
				break;
			case 'customavatar':
				prize = 0;
				Shop.removeMoney(user.name, prize);
				return this.sendReply("Si quieres comprar este articulo, contacta un Administrador (~).");
				break;
			default:
				return this.sendReply("No has especificado ningún artículo válido.");
		}
	},
	
	moneyhelp: 'pdhelp',
	pdhelp: function () {
		if (!this.canBroadcast()) return false;
		this.sendReplyBox(
			"<b><u>Comandos referentes a los PDs</u></b><br /><br />" +
			"/pd (user) - muestra los ahorros de un usuario.<br />" +
			"/donate (user), (money) - Dona una cantidad determinada a otro usuario.<br />" +
			"/givemoney (user), (pds) - Da una cantidad de Pds a un usuario.<br />" +
			"/removemoney (user), (pds) - Quita una cantidad de Pds a un usuario.<br />"
		);
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
	
	symbolpermision: function (target, room, user) {
		if (!this.can('givemoney')) return false;
		var params = target.split(',');
		if (!params || params.length !== 2) return this.sendReply("Usage: /symbolpermision usuario, [on/off]");
		var permision = false;
		if (toId(params[1]) !== 'on' && toId(params[1]) !== 'off') return this.sendReply("Usage: /symbolpermision usuario, [on/off]");
		if (toId(params[1]) === 'on') permision = true;
		if (permision) {
			var userh = Users.getExact(params[0]);
			if (!userh || !userh.connected) return this.sendReply("El usuario no existe o no está disponible");
			if (Shop.setSymbolPermision(params[0], permision)) return this.sendReply("Permiso para customsymbols concedido a " + userh.name);
			return this.sendReply("El usuario ya poseía permiso para usar los customsymbols.");
		} else {
			if (Shop.setSymbolPermision(params[0], permision)) return this.sendReply("Permiso para customsymbols retirado a " + params[0]);
			return this.sendReply("El usuario no tenía ningún permiso que quitar.");
		}
	},

	hideauth: 'customsymbol',
	symbol: 'customsymbol',
	simbolo: 'customsymbol',
	customsymbol: function (target, room, user, connection, cmd) {
		if (!user.can('customsymbol') && !Shop.symbolPermision(user.name)) return  this.sendReply('Debes comprar este comando en la tienda para usarlo.');
		if (!target && cmd === 'hideauth') target = ' ';
		if (!target || target.length > 1) return this.sendReply('Debes especificar un caracter como simbolo.');
		if (target.match(/[A-Za-z0-9\d]+/g)) return this.sendReply('Tu simbolo no puede ser un caracter alfanumerico.');
		if (!user.can('customsymbol')) {
			if ('?!$+\u2605%@\u2295&~#'.indexOf(target) >= 0) return this.sendReply('No tienes permiso para elegir un rango como simbolo');
		}
		user.getIdentity = function (roomid) {
			if (this.locked) {
				return '‽' + this.name;
			}
			if (roomid) {
				var room = Rooms.rooms[roomid];
				if (room.isMuted(this)) {
					return '!' + this.name;
				}
				if (room && room.auth) {
					if (room.auth[this.userid]) {
						return room.auth[this.userid] + this.name;
					}
					if (room.isPrivate === true) return ' ' + this.name;
				}
			}
			return target + this.name;
		};
		user.updateIdentity();
		user.hasCustomSymbol = true;
		this.sendReply('Tu simbolo ha cambiado a "' + target + '"');
	},
	showauth: 'resetsymbol',
	resetsymbol: function (target, room, user) {
		if (!user.hasCustomSymbol) return this.sendReply('No tienes nigún simbolo personalizado.');
		user.getIdentity = function (roomid) {
			if (this.locked) {
				return '‽' + this.name;
			}
			if (roomid) {
				var room = Rooms.rooms[roomid];
				if (room.isMuted(this)) {
					return '!' + this.name;
				}
				if (room && room.auth) {
					if (room.auth[this.userid]) {
						return room.auth[this.userid] + this.name;
					}
					if (room.isPrivate === true) return ' ' + this.name;
				}
			}
			return this.group + this.name;
		};
		user.hasCustomSymbol = false;
		user.updateIdentity();
		this.sendReply('Tu simbolo se ha restablecido.');
	},
	
	jugando: 'afk',
	ocupado: 'afk',  
	comiendo: 'afk', 
	durmiendo: 'afk', 
	grabando: 'afk',	
	programando: 'afk',
	ausente: 'afk',
	away: 'afk',
	afk: function(target, room, user, connection, cmd) {
		if (!this.canTalk) return false;
		var t = 'Away';
		switch (cmd) {
			case 'jugando':
			t = 'ⒿⓊⒼⒶⓃⒹⓄ';  
			s = 'Jugando'
			break;  
                        case 'comiendo':
			t = 'ⒸⓄⓂⒾⒺⓃⒹⓄ';
			s = 'Comiendo'
			break;  
                        case 'grabando':
			t = 'ⒼⓇⒶⒷⒶⓃⒹⓄ';
			s = 'Grabando'
			break;			
			case 'durmiendo':
			t = 'ⒹⓊⓇⓂⒾⒺⓃⒹⓄ';
			s = 'Durmiendo'
			break; 
			case 'programando':
			t = 'ⓅⓇⓄⒼⓇⒶⓂⒶⓃⒹⓄ';
			s = 'Programando'
			break;
			case 'ocupado':
			t = 'ⓄⒸⓊⓅⒶⒹⓄ';
			s = 'Ocupado'
			break;
			default:
			t = 'ⒶⓊⓈⒺⓃⓉⒺ'
			s = 'Ausente'
			break;
		}

		if (!user.isAway) {
			user.originalName = user.name;
			var awayName = user.name + ' - '+t;
			//delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
			delete Users.get(awayName);
			user.forceRename(awayName, undefined, true);

			if (user.isStaff) this.add('|raw|<b> <font color="#2EFEF7">' + Tools.escapeHTML(user.originalName) +'</font color></b> esta '+s.toLowerCase()+'. '+ (target ? " (" + escapeHTML(target) + ")" : ""));

			user.isAway = true;
			user.blockChallenges = true;
		}
		else {
			return this.sendReply('Tu estas como ausente, digita /back.');
		}

		user.updateIdentity();
	},

	back: 'unafk',
	regresar: 'unafk',
	unafk: function(target, room, user, connection) {
		if (!this.canTalk) return false;

		if (user.isAway) {
			if (user.name === user.originalName) {
				user.isAway = false;
				return this.sendReply('Tu nombre no ha cambiado y ya no estas ausente.');
			}

			var newName = user.originalName;

			//delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
			delete Users.get(newName);

			user.forceRename(newName, undefined, true);

			//user will be authenticated
			user.authenticated = true;

			if (user.isStaff) this.add('|raw|<b> <font color="#2EFEF7">' + Tools.escapeHTML(newName) + '</font color></b> regreso.');

			user.originalName = '';
			user.isAway = false;
			user.blockChallenges = false;
		}
		else {
			return this.sendReply('Tu no estas ausente.');
		}

		user.updateIdentity();
	}, 
	
	img: 'image',
        image: function(target, room, user) {
                if (!user.can('wall', null, room)) return false;
                if (!target) return this.sendReply('/image [url], [tamaño]');
                var targets = target.split(',');
                var url = targets[0];
                var width = targets[1];
                if (!url || !width) return this.sendReply('/image [url], [width percentile]');
                if (url.indexOf('.png') === -1 && url.indexOf('.jpg') === -1 && url.indexOf('.gif') === -1) {
                        return this.sendReply('La url debe terminar en .png, .jpg o .gif');
                }
                if (isNaN(width)) return this.sendReply('El tamaño debe ser un numero.');
                if (width < 1 || width > 100) return this.sendReply('El tamaño debe ser mayor que 0 y menor que 100.');
                this.add('|raw|<center><img width="'+width+'%" src="'+url+'"></center>');
        }, 
		
	masspm: 'pmall',
    pmall: function (target, room, user) {
        if (!this.can('pmall')) return;
        if (!target) return this.parse('/help pmall');

        var pmName = '~Ultimate PM[No Respondas]';

        for (var i in Users.users) {
            var message = '|pm|' + pmName + '|' + Users.users[i].getIdentity() + '|' + target;
            Users.users[i].send(message);
        }
    },  
	
	show: function (target, room, user) {
        if (!this.can('lock')) return;
        delete user.getIdentity
        user.hiding = false;
        user.updateIdentity();
        this.sendReply('Has revelado tu símbolo de staff.');
        return false;
    },

    hide: function (target, room, user) {
        // add support for away
        if (!this.can('lock')) return;
        user.getIdentity = function () {
            var name = this.name + (this.away ? " - ????" : "");
            if (this.locked) return '?' + name;
            if (this.muted) return '!' + name;
            return ' ' + name;
        };
        user.hiding = true;
        user.updateIdentity();
        this.sendReply('Has escondido tu símbolo de staff.');
    }
};
