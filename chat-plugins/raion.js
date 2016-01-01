//Comandos para la sala de Raion (Youtuber de Ultimate) 
//http://youtube.com/raionato 
//Hechos por @Bryan AA(Bryan-0)  

 exports.commands = {
    
	rh: 'raionh',
    raionhelp: function (target, room, user) {
	    if (room.id !== 'raion') return this.sendReply('Este comando solo puede ser utilizado en la sala de Raion.');  
	    if (!this.canBroadcast()) return;
	    this.sendReplyBox( 
	        '<strong>Ayuda de comandos para la sala de Raion</strong><br />' +
	        '- /raion - Muestra el canal de Raionato<br />' +
	        '- /raiont - Muestra el twitter de Raionato<br />' +
	        '- /raionb - Muestra el Blogspot de Raionato<br />' +
		    '<strong>Todos los comandos requieren rango de + % @ #, y pueden ser "!" Voceados</strong><br />' 
		);
    },  
	r: 'raion',
	raion: function (target, room, user) {
	    if (room.id !== 'raion') return this.sendReply('Este comando solo puede ser utilizado en la sala de Raion.');  
	    if (!this.canBroadcast()) return;
	    this.sendReplyBox( 
	        'Pasate por el canal de <a href=\"https://www.youtube.com/user/Raionato\">Raionato</a>!<br />' 
		);
    }, 
	rt: 'raiont',
	raiont: function (target, room, user) {
	    if (room.id !== 'raion') return this.sendReply('Este comando solo puede ser utilizado en la sala de Raion.');  
	    if (!this.canBroadcast()) return;
	    this.sendReplyBox( 
	        'Pasate por el twitter de <a href=\"https://twitter.com/PkmnRaion\">Raionato</a>!<br />' 
		);
    }, 
	raionb: function (target, room, user) {
	    if (room.id !== 'raion') return this.sendReply('Este comando solo puede ser utilizado en la sala de Raion.');  
	    if (!this.canBroadcast()) return;
	    this.sendReplyBox( 
	        'Pasate por el blogspot de <a href=\"http://historiasdepokecriador.blogspot.com\">Raionato</a>!<br />' 
		);
    }
};