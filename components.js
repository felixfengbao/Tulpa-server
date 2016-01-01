/**
 * Components
 * Created by CreaturePhil - https://github.com/CreaturePhil
 *
 * These are custom commands for the server. This is put in a seperate file
 * from commands.js and config/commands.js to not interfere with them.
 * In addition, it is easier to manage when put in a seperate file.
 * Most of these commands depend on core.js.
 *
 * Command categories: General, Staff, Server Management
 *
 * @license MIT license
 */

var fs = require("fs");
    path = require("path"),
    http = require("http"),
    request = require('request');

var components = exports.components = {

	/********************************************************************
	* Shop Commands
	********************************************************************/

	money: 'atm',
    pd: 'atm',
    atm: function (target, room, user, connection) {
        if (!this.canBroadcast()) return;
        if (target.length >= 19) return this.sendReply('Los nombres de usuario tienen que tener menos de 19 caracteres de largo.');

        var targetUser = this.targetUserOrSelf(target);

        if (!targetUser) {
            var userId = toId(target);
            var money = Core.atm.money(userId);

            return this.sendReplyBox(Core.atm.name(false, target) + Core.atm.display('money', money) + '<br clear="all">');
        }

        var money = Core.atm.money(targetUser.userid);

        return this.sendReplyBox(Core.atm.name(true, targetUser) + Core.atm.display('money', money) + '<br clear="all">');
    },

	tienda: 'shop',
    shop: function (target, room, user) {
        if (!this.canBroadcast()) return;
        return this.sendReply('|html|' + Core.shop(true));
    },

    ayudatienda: function () {
        if (!this.canBroadcast()) return;
        this.sendReplyBox(
            "<ul>" +
                "<li>/pd: consulta tus PokeDolares.</li>" +
                "<li>/tienda: revisa los artículos de la tienda.</li>" +
                "<li>/buy: compra un artículo de la tienda.</li>" +
                "<li>/transferbuck [usuario], [dinero]: regala PD a alguien.</li>" +
                "<li>/tc: revisa tu tarjeta de entrenador o la de alguien mas.</li>" +
            "</ul>"
        );
    },

    buy: function (target, room, user) {
        if (!target) this.parse('/help buy');
        var userMoney = Number(Core.stdin('money', user.userid));
        var shop = Core.shop(false);
        var len = shop.length;
        while (len--) {
            if (target.toLowerCase() === shop[len][0].toLowerCase()) {
                var price = shop[len][2];
                if (price > userMoney) return this.sendReply('No tienes suficiente PD para comprar esto. Necesitas ' + (price - userMoney) + 'para comprar ' + target + '.');
                Core.stdout('money', user.userid, (userMoney - price));
                if (target.toLowerCase() === 'simbolo') {
                    user.canCustomSymbol = true;
                    this.sendReply('Has comprado un simbolo personalizado. Vas a tener tu simbolo tras haber cerrado sesión por mas de una hora. Ahora puedes usar /customsymbol.');
                    this.sendReply('Si ya no quieres tu simbolo, puedes usar /resetsymbol para volver a tu viejo simbolo.');
                } else {
                    this.sendReply('Has comprado ' + target + '. Contacta a un Administrador para obtener ' + target + '.');
                }
                room.add(user.name + ' Ha comprado un ' + target + ' de la tienda.');
            }
        }
    },

	transferbuck: 'transfermoney',
    transferbucks: 'transfermoney',
    transfermoney: function (target, room, user) {
        if (!target) return this.parse('/help transfermoney');
        if (!this.canTalk()) return;

        if (target.indexOf(',') >= 0) {
            var parts = target.split(',');
            parts[0] = this.splitTarget(parts[0]);
            var targetUser = this.targetUser;
        }

        if (!targetUser) return this.sendReply('El nombre de usuario ' + this.targetUsername + ' es desconocido.');
        if (targetUser.userid === user.userid) return this.sendReply('No puedes transferirte dinero a ti mismo.');
        if (isNaN(parts[1])) return this.sendReply('Usa un numero real.');
        if (parts[1] < 1) return this.sendReply('No puedes transferir menos de un PD a la vez.');
        if (String(parts[1]).indexOf('.') >= 0) return this.sendReply('No puedes transferir PD con decimales.');

        var userMoney = Core.stdin('money', user.userid);
        var targetMoney = Core.stdin('money', targetUser.userid);

        if (parts[1] > Number(userMoney)) return this.sendReply('No puedes transferir mas PD de los que tienes.');

        var b = 'PokeDolares';
        var cleanedUp = parts[1].trim();
        var transferMoney = Number(cleanedUp);
        if (transferMoney === 1) b = 'PokeDolar';

        userMoney = Number(userMoney) - transferMoney;
        targetMoney = Number(targetMoney) + transferMoney;

        Core.stdout('money', user.userid, userMoney, function () {
            Core.stdout('money', targetUser.userid, targetMoney);
        });

        this.sendReply('Has transferido con éxito ' + transferMoney + ' ' + b + ' a ' + targetUser.name + '. Ahora tienes ' + userMoney + ' PD.');
        targetUser.send(user.name + ' ha transferido ' + transferMoney + ' ' + b + ' a tu cuenta. Ahora tienes ' + targetMoney + ' PD.');

		fs.appendFile('logs/transactions.log','\n'+Date()+': '+user.name+' transfirio '+transferMoney+' '+b+' para ' + targetUser.name + '. ' +  user.name +' ahora tiene ' + userMoney + ' ' + b + ' y ' + targetUser.name + '  ahora tiene ' + targetMoney + ' ' + b +'.');
    },

	givebuck: 'givemoney',
    givebucks: 'givemoney',
    givemoney: function (target, room, user) {
        if (!user.can('givemoney')) return;
        if (!target) return this.parse('/help givemoney');

        if (target.indexOf(',') >= 0) {
            var parts = target.split(',');
            parts[0] = this.splitTarget(parts[0]);
            var targetUser = this.targetUser;
        }

        if (!targetUser) return this.sendReply('El nombre de usuario ' + this.targetUsername + ' es desconocido.');
        if (isNaN(parts[1])) return this.sendReply('Usa un numero real.');
        if (parts[1] < 1) return this.sendReply('No puedes dar menos de un PD a la vez.');
        if (String(parts[1]).indexOf('.') >= 0) return this.sendReply('No puedes dar PD con decimales.');

        var b = 'PokeDolares';
        var cleanedUp = parts[1].trim();
        var giveMoney = Number(cleanedUp);
        if (giveMoney === 1) b = 'PokeDolar';

        var money = Core.stdin('money', targetUser.userid);
        var total = Number(money) + Number(giveMoney);

        Core.stdout('money', targetUser.userid, total);

        this.sendReply(targetUser.name + ' Ha obtenido ' + giveMoney + ' ' + b + '. Ahora este usuario tiene ' + total + ' PD.');
        targetUser.send(user.name + ' Te ha dado ' + giveMoney + ' ' + b + '. Ahora tienes ' + total + ' PD.');

                fs.appendFile('logs/transactions.log', '\n' + Date() + ': ' + targetUser.name + ' gano ' + giveMoney + ' ' + b + ' de ' + user.name + '. ' + 'Ahora el tiene ' + total + ' ' + b + '.');
    },

    takebuck: 'takemoney',
    takebucks: 'takemoney',
    takemoney: function (target, room, user) {
        if (!user.can('takemoney')) return;
        if (!target) return this.parse('/help takemoney');

        if (target.indexOf(',') >= 0) {
            var parts = target.split(',');
            parts[0] = this.splitTarget(parts[0]);
            var targetUser = this.targetUser;
        }

        if (!targetUser) return this.sendReply('El nombre de usuario ' + this.targetUsername + ' es desconocido.');
        if (isNaN(parts[1])) return this.sendReply('Usa un numero real.');
        if (parts[1] < 1) return this.sendReply('No puedes tomar menos de un PD a la vez.');
        if (String(parts[1]).indexOf('.') >= 0) return this.sendReply('No puedes tomar dinero con decimales.');

        var b = 'PokeDolares';
        var cleanedUp = parts[1].trim();
        var takeMoney = Number(cleanedUp);
        if (takeMoney === 1) b = 'PokeDolar';

        var money = Core.stdin('money', targetUser.userid);
        var total = Number(money) - Number(takeMoney);

        Core.stdout('money', targetUser.userid, total);

        this.sendReply(targetUser.name + ' Ha perdido ' + takeMoney + ' ' + b + '. Ahora este usuario tiene ' + total + ' PD.');
        targetUser.send(user.name + ' Ha tomado ' + takeMoney + ' ' + b + ' de tu cuenta. Ahora tienes ' + total + ' PD.');

		fs.appendFile('logs/transactions.log', '\n' + Date() + ': ' + user.name + ' Quito ' + takeMoney + ' ' + b + ' de ' + targetUser.name + '. ' + 'Ahora el tiene ' + total + ' ' + b + '.');
    },

	pdlog: 'moneylog',
	moneylog: function(target, room, user, connection) {
		if (!this.can('lock')) return false;
		try {
			var log = fs.readFileSync('logs/transactions.log','utf8');
            return user.send('|popup|'+log);
		} catch (e) {
			return user.send('|popup|You have not set made a transactions.log in the logs folder yet.\n\n ' + e.stack);
		}
	},

	simbolo: 'customsymbol',
	customsymbol: function (target, room, user) {
        if (!user.canCustomSymbol) return this.sendReply('Es necesario que compres este comando en la Tienda para usarlo.');
        if (!target || target.length > 1) return this.parse('/help customsymbol');
        if (target.match(/[A-Za-z\d]+/g) || '‽!+%@\u2605&~#'.indexOf(target) >= 0) return this.sendReply('Lo sentimos, pero no puedes cambiar el símbolo al que has escogido por razones de seguridad/estabilidad.');
        user.getIdentity = function (roomid) {
            if (!roomid) roomid = 'lobby';
            var name = this.name;
            if (this.locked) {
                return '‽' + name;
            }
            if (this.mutedRooms[roomid]) {
                return '!' + name;
            }
            var room = Rooms.rooms[roomid];
            if (room.auth) {
                if (room.auth[this.userid]) {
                    return room.auth[this.userid] + name;
                }
                if (room.isPrivate) return ' ' + name;
            }
            return target + name;
        };
        user.updateIdentity();
        user.canCustomSymbol = false;
        user.hasCustomSymbol = true;
    },

    resetsymbol: function (target, room, user) {
        if (!user.hasCustomSymbol) return this.sendReply('Tu no tienes un simbolo personalizado.');
        user.getIdentity = function (roomid) {
            if (!roomid) roomid = 'lobby';
            var name = this.name;
            if (this.locked) {
                return '‽' + name;
            }
            if (this.mutedRooms[roomid]) {
                return '!' + name;
            }
            var room = Rooms.rooms[roomid];
            if (room.auth) {
                if (room.auth[this.userid]) {
                    return room.auth[this.userid] + name;
                }
                if (room.isPrivate) return ' ' + name;
            }
            return this.group + name;
        };
        user.hasCustomSymbol = false;
        user.updateIdentity();
        this.sendReply('Tu simbolo se ha restablecido.');
    },

	/********************************************************************
	* Other Commands
	********************************************************************/

	jugando: 'afk',
    ocupado: 'afk',
	ausente: 'afk',
	away: 'afk',
	afk: function(target, room, user, connection, cmd) {
		if (!this.canTalk) return false;
		var t = 'Away';
		switch (cmd) {
			case 'jugando':
			t = 'Јυԍаɴԁо';
			s = 'Jugando'
			break;
			case 'ocupado':
			t = 'Осυраԁо';
			s = 'Ocupado'
			break;
			default:
			t = 'Аυѕеɴте'
			s = 'Ausente'
			break;
		}

		if (!user.isAway) {
			user.originalName = user.name;
			var awayName = user.name + ' - '+t;
			//delete the user object with the new name in case it exists - if it does it can cause issues with forceRename
			delete Users.get(awayName);
			user.forceRename(awayName, undefined, true);

			if (user.isStaff) this.add('|raw|<b>-- <font color="#6c0000">' + Tools.escapeHTML(user.originalName) +'</font color></b> esta '+s.toLowerCase()+'. '+ (target ? " (" + escapeHTML(target) + ")" : ""));

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

			if (user.isStaff) this.add('|raw|<b>-- <font color="#6c0000">' + Tools.escapeHTML(newName) + '</font color></b> regreso.');

			user.originalName = '';
			user.isAway = false;
			user.blockChallenges = false;
		}
		else {
			return this.sendReply('Tu no estas ausente.');
		}

		user.updateIdentity();
	},

    regdate: function (target, room, user, connection) {
        if (!this.canBroadcast()) return;
        if (!target || target == "." || target == "," || target == "'") return this.parse('/help regdate');
        var username = target;
        target = target.replace(/\s+/g, '');

        var options = {
            host: "www.pokemonshowdown.com",
            port: 80,
            path: "/forum/~" + target
        };

        var content = "";
        var self = this;
        var req = http.request(options, function (res) {

            res.setEncoding("utf8");
            res.on("data", function (chunk) {
                content += chunk;
            });
            res.on("end", function () {
                content = content.split("<em");
                if (content[1]) {
                    content = content[1].split("</p>");
                    if (content[0]) {
                        content = content[0].split("</em>");
                        if (content[1]) {
                            regdate = content[1];
                            data = username + ' se registro en' + regdate + '.';
                        }
                    }
                } else {
                    data = username + ' no esta registrado.';
                }
                self.sendReplyBox(data);
                room.update();
            });
        });
        req.end();
    },

	img: 'image',
        image: function(target, room, user) {
                if (!user.can('declare', null, room)) return false;
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

    u: 'urbandefine',
    ud: 'urbandefine',
    urbandefine: function (target, room, user) {
        if (!this.canBroadcast()) return;
        if (!target) return this.parse('/help urbandefine')
        if (target > 50) return this.sendReply('La frase no puede contener mas de 50 caractares.');

        var self = this;
        var options = {
            url: 'http://www.urbandictionary.com/iphone/search/define',
            term: target,
            headers: {
                'Referer': 'http://m.urbandictionary.com'
            },
            qs: {
                'term': target
            }
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var page = JSON.parse(body);
                var definitions = page['list'];
                if (page['result_type'] == 'no_results') {
                    self.sendReplyBox('No hay resultados para <b>"' + Tools.escapeHTML(target) + '"</b>.');
                    return room.update();
                } else {
                    if (!definitions[0]['word'] || !definitions[0]['definition']) {
                        self.sendReplyBox('No hay resultados para <b>"' + Tools.escapeHTML(target) + '"</b>.');
                        return room.update();
                    }
                    var output = '<b>' + Tools.escapeHTML(definitions[0]['word']) + ':</b> ' + Tools.escapeHTML(definitions[0]['definition']).replace(/\r\n/g, '<br />').replace(/\n/g, ' ');
                    if (output.length > 400) output = output.slice(0, 400) + '...';
                    self.sendReplyBox(output);
                    return room.update();
                }
            }
        }
        request(options, callback);
    },

    def: 'define',
    define: function (target, room, user) {
        if (!this.canBroadcast()) return;
        if (!target) return this.parse('/help define');
        target = toId(target);
        if (target > 50) return this.sendReply('La palabra no puede contener mas de 50 caracteres.');

        var self = this;
        var options = {
            url: 'http://api.wordnik.com:80/v4/word.json/' + target + '/definitions?limit=3&sourceDictionaries=all' +
                '&useCanonical=false&includeTags=false&api_key=a2a73e7b926c924fad7001ca3111acd55af2ffabf50eb4ae5',
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                var page = JSON.parse(body);
                var output = '<b>Definiciones para ' + target + ':</b><br />';
                if (!page[0]) {
                    self.sendReplyBox('No hay resultados para <b>"' + target + '"</b>.');
                    return room.update();
                } else {
                    var count = 1;
                    for (var u in page) {
                        if (count > 3) break;
                        output += '(' + count + ') ' + page[u]['text'] + '<br />';
                        count++;
                    }
                    self.sendReplyBox(output);
                    return room.update();
                }
            }
        }
        request(options, callback);
    },

    masspm: 'pmall',
    pmall: function (target, room, user) {
        if (!this.can('pmall')) return;
        if (!target) return this.parse('/help pmall');

        var pmName = '~Hispano PM';

        for (var i in Users.users) {
            var message = '|pm|' + pmName + '|' + Users.users[i].getIdentity() + '|' + target;
            Users.users[i].send(message);
        }
    },
    
    medallas: 'medallas',
	medallas: function (target, room, user) {
		if (!this.canBroadcast()) return;
		if (!target) target = user.userid;
		target = target.toLowerCase();
		target = target.trim();
		var matched = false;
		var admin = '<img src="http://i.imgur.com/lfPYzFG.png" title="Administrador">';
		var dev = '<img src="http://i.imgur.com/oyv3aga.png" title="Developer ">';
		var owner = '<img src="http://www.smogon.com/media/forums/images/badges/sitestaff.png.v.W3Bw1cia4qYxYu9_y90uyw" title="Propietario del servidor">';
		var leader = '<img src="http://i.imgur.com/5Dy544w.png" title="Leader">';
		var mod = '<img src="http://i.imgur.com/z3W1EAh.png" title="Moderador">';
		var driver = '<img src="http://i.imgur.com/oeKdHgW.png" title="Driver">';
		var voice = '<img src="http://i.imgur.com/yPAXWE9.png" title="Vocero">';
		var artista = '<img src="http://www.smogon.com/forums/styles/default/xenforo/badges/artist.png" title="Artista">';
		if (target === 'list' || target === 'help') {
			matched = true;
			this.sendReplyBox('<center><b><font size="3">Lista de medallas obtenibles:</font></b>  ' + dev + '  ' + leader + '  ' + mod + '  ' + driver + ' ' + voice + '  ' + artista + '<hr>Al pasar el cursor por encima de la medalla revela lo que indica.</center>');
		}
		if (target === 'neonnnn' || target === 'neon') {
			matched = true;
			this.sendReplyBox('<center><b><font size="3">Neonnnn:</font></b>  ' + owner + '  ' + admin + '  ' + dev + '</center>')
		}
		if (!matched) {
			this.sendReplyBox('<center><font color="grey"><font size="1">El usuario <i>' + target + '</i> no tiene medallas.</font></font><hr><b><font size="3">Lista de medallas obtenibles:</font></b>  ' + dev + '  ' + leader + '  ' + mod + '  ' + driver + ' ' + voice + '  ' + artista + '<hr>Al pasar el cursor por encima de la medalla revela lo que indica.</center>');
		}
	},
	
	rankingtorneo: 'rankingtorneos',
    rankingtorneos: function (target, room, user) {
        if (!this.canBroadcast()) return;

        if (!target) target = 10;
        if (!/[0-9]/.test(target) && target.toLowerCase() !== 'all') target = -1;

        var ladder = Core.ladder(Number(target));
        if (ladder === 0) return this.sendReply('Nadie está clasificado.');

        return this.sendReply('|raw|<center>' + ladder + 'Para ver el ranking completo usa /rankingtorneos <em>Todos</em> o para ver una cierta cantidad de usuarios usa /rankingtorneos <em>Número</em></center>');

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

	roomlist: function (target, room, user) {
    if (!this.can('roomlist')) return;

    var rooms = Object.keys(Rooms.rooms),
        len = rooms.length,
        official = ['<b><font color="#1a5e00" size="2">Salas oficiales:</font></b><br><br>'],
        nonOfficial = ['<hr><b><font color="#000b5e" size="2">Salas no-oficiales:</font></b><br><br>'],
        privateRoom = ['<hr><b><font color="#5e0019" size="2">Salas privadas:</font></b><br><br>'];

    while (len--) {
        var _room = Rooms.rooms[rooms[(rooms.length - len) - 1]];
        if (_room.type === 'chat') {

            if (_room.isOfficial) {
                official.push(('<a href="/' + _room.title + '" class="ilink">' + _room.title + '</a> |'));
                continue;
            }
            if (_room.isPrivate) {
                privateRoom.push(('<a href="/' + _room.title + '" class="ilink">' + _room.title + '</a> |'));
                continue;
            }
            nonOfficial.push(('<a href="/' + _room.title + '" class="ilink">' + _room.title + '</a> |'));

        }
    }

    this.sendReplyBox(official.join(' ') + nonOfficial.join(' ') + privateRoom.join(' '));
},


};

Object.merge(CommandParser.commands, components);
