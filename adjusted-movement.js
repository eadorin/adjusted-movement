const mod = 'adjusted-movement';
const modDisplayName = "AdjustedMovement"
// import { AdjustedMovementSockets } from './src/Adjusted.js';



export class AdjustedMovement {

    
    static async handleMovementRequests() {
        // save the original function
        const _oldKeyUp = KeyboardManager.prototype._onSpace;
        AdjustedMovement.handlers();

        // monkey patch the onSpace handler
        KeyboardManager.prototype._onSpace = function(event, up, modifiers) {
            const ruler = canvas.controls.ruler;
            if ( up ) return;

            // Move along a measured ruler
            if ( canvas.ready && ruler.active ) {

                // ok we can move our character

                // our custom handler
                (async () => {
                    
                    let confirm = await getConfirmation("Request the movement?");

                    if (confirm) {
                        
                        // s.sendData('can-i-move', data => {
                        //     console.log("This also happened");
                        //     if (data.approved) { return;}
                        //     let moved = ruler.moveToken(event);
                        //     if ( moved ) event.preventDefault();
                        // });
                        // await AdjustedMovement.converse("start");
                        AdjustedMovement.Socket.requestMovementApproval({userid:game.user.id,event:event});
                                            
                    }

                })();

            }else if ( !modifiers.hasFocus && game.user.isGM ) {
                event.preventDefault();
                game.togglePause(null, true);
            }

            // Flag the keydown workflow as handled
            this._handled.add(modifiers.key);
        }
    }

    static async handlers() {
        // Allow and process incoming socket data
        game.socket.on("module.adjusted-movement", data => {
            switch (data.type) {
                case "requestMovement" :
                    if (game.user.isGM) {
                        // request received. ask to approve
                        let response = getConfirmation("Allow movement from " + game.user.id + "?");

                        AdjustedMovement.Socket.approveDenyMovement({app:response,event:data.event});
                        //AdjustedMovement.Socket.approveDenyMovement(response);
                        
                        // let result = AdjustedMovement.Socket.approveDenyMovement();
                        // AdjustedMovement.Socket.approveDenyMovement();
                    }
                    break;
                case "approveDenyMovement" :
                        if (data.payload.approved) {
                            const ruler = canvas.controls.ruler;
                            let moved = ruler.moveToken(data.event);
                            if ( moved ) data.event.preventDefault();
                        }
                    break;
                default:
                    // no idea how we got an unsolicited socket request
                    console.log("default");
                    break;
            }
        });
    }

    static async converse(step) {
        switch (step) {
            case "start" : 
                AdjustedMovement.Socket.requestMovementApproval(game.user.id);
                break;
            case "step2" :
                // await AdjustedMovement.
                break;
            
            case "sendApproveDeny" :

                break;
        }
    }

    /**
     * Client -> Asks Permission
     * Server -> receives Request
     * Server -> Responds
     * Client -> takes action
     */


}

function getConfirmation(prompt) {
    return new Promise(resolve => {
        new Dialog({
            title: prompt,
            content: '',
            buttons: {
                ok: {
                    label: "Yes",
                    callback: () => {
                        resolve(true);
                    }
                },
                no: {
                    label: "No",
                    callback: ()=> {
                        resolve(false);
                    }
                }
            },
            default:"no"
        }).render(true);
    });
}
Hooks.on("confirmMovement",async (x) => {
    // if (game.user.isGM) {
        return getConfirmation("Allow " + x + "to move?");
    // }
});





AdjustedMovement.Socket = class {
    static async requestMovementApproval(obj) {
        game.socket.emit("module.adjusted-movement", {
            type: "requestMovement",
            payload: {
                user: obj.userid,
                event: obj.event
            }
        });
        // AdjustedMovement.converse("step2")
    }

    static approveDenyMovement(response) {
        game.socket.emit("module.adjusted-movement", {
            type: "approveDenyMovement",
            payload: {
                approved: response.app,
                event: response.event
            }
        })
    }
};





Hooks.on("ready",AdjustedMovement.handleMovementRequests);

