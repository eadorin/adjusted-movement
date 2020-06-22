let socketQueueId = 0;
let socketQueue = {};



class SocketHelper {

    sendData(data, onReturnFunction) {
        socketQueueId++;
        if (typeof(returnFunc) == 'function'){
            // the 'i_' prefix is a good way to force string indices, 
            // believe me you'll want that in case your server side doesn't 
            // care and mixes both like PHP might do
            socketQueue['i_'+socketQueueId] = onReturnFunction;
        }
        let jsonData = JSON.stringify({'cmd_id':socketQueueId, 'json_data':data});
        try {
            game.socket.emit("module.adjusted-movement", jsonData);
            console.log('Sent');
        } catch(e) {
            console.log('Sending failed ... .disconnected failed');
        }
    }

    constructor() {
        
        game.socket.on("module.adjusted-movement", (e) => {
            game.socket.emit("module.adjusted-movement","yep");
            try{
                let data = JSON.parse(e.data);
            }catch(er){
                console.log('socket parse error: '+e.data);
            }

            if (typeof(data['cmd_id']) != 'undefined' && typeof(socketQueue['i_'+data['cmd_id']]) == 'function'){
                let execFunc = socketQueue['i_'+data['cmd_id']];
                
                execFunc(data['result']);
                delete socketQueue['i_'+data['cmd_id']]; // to free up memory.. and it is IMPORTANT thanks  Le Droid for the reminder
                return;
            } else {
                this.socketRecieveData(e.data);
            }
        });
    }
    socketRecieveData(data) {
        console.log(data);
    }
}
