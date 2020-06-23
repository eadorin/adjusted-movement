const mod = 'adjusted-movement';
const modDisplayName = "AdjustedMovement"

class Socket {

    static async listen() {
        game.socket.on("module.adjusted-movement", async data => {
            switch (data.type) {
                case "requestMovement" :
                    if (game.user.isGM) {
                        // request received. ask to approve
                        let name = game.users.get(data.payload.user).data.name;
                        let response = await getConfirmation("Allow movement from " +name + "?");
                        Socket.approveDenyMovement({app:response,event:data.event});
                        //AdjustedMovement.Socket.approveDenyMovement(response);
                        
                        // let result = AdjustedMovement.Socket.approveDenyMovement();
                        // AdjustedMovement.Socket.approveDenyMovement();
                    }
                    break;
                case "approveDenyMovement" :
                        if (data.payload.approved == true) {
                            const ruler = canvas.controls.ruler;
                            let moved = ruler.moveToken(data.payload.event);
                            // if ( moved ) data.payload.event.preventDefault();
                        }
                    break;
                default:
                    // no idea how we got an unsolicited socket request
                    break;
            }
        });
    }
    static async requestMovementApproval(obj) {
        let res = await game.socket.emit("module.adjusted-movement", {
            type: "requestMovement",
            payload: {
                user: game.user.id,
                event: obj.event
            }
        });
        return res;
        // AdjustedMovement.converse("step2")
    }

    static approveDenyMovement(response) {
        game.socket.emit("module.adjusted-movement", {
            type: "approveDenyMovement",
            payload: {
                approved: response.app,
                event: response.event
            }
        });
    }
}


export class AdjustedMovement {


    static init() {


        game.settings.register(mod,'lock-all-tokens',{
            name: "adjusted-movement.options.lock-all-tokens.name",
            hint: "adjusted-movement.options.lock-all-tokens.hint",
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
            onChange: x => window.location.reload()
        });
        game.settings.register(mod,'skip-request',{
            name: "adjusted-movement.options.skip-request.name",
            hint: "adjusted-movement.options.skip-request.hint",
            scope: "world",
            config: true,
            default: false,
            type: Boolean,
            onChange: x => window.location.reload()
        });


        /* Monkey Patch the ruler to allow the ALT key to pause drawing */
        Ruler.prototype._onMouseMove = function(event) {
            const oe = event.data.originalEvent;
            const isAlt = oe.altKey;
            if ( this._state === Ruler.STATES.MOVING  || isAlt) return;
        
            // Extract event data
            const mt = event._measureTime || 0;
            const {origin, destination, originalEvent} = event.data;
        
            // Check measurement distance
            let dx = destination.x - origin.x,
                dy = destination.y - origin.y;
            if ( Math.hypot(dy, dx) >= canvas.dimensions.size / 2 ) {
        
              // Hide any existing Token HUD
              canvas.hud.token.clear();
              delete event.data.hudState;
        
              // Draw measurement updates
              if ( Date.now() - mt > 50 ) {
                this.measure(destination, {gridSpaces: !originalEvent.shiftKey});
                event._measureTime = Date.now();
                this._state = Ruler.STATES.MEASURING;
              }
            }
          }
    }


    
    static async handleMovementRequests() {
        Socket.listen();


        

        if (game.settings.get(mod,'lock-all-tokens')) {
            for ( let [i, token] of canvas.tokens.placeables.entries()){
                if (!(token instanceof Token) || !token.actor) { continue; }
                    token.data.locked = true;
            }
        }


        // save the original function
        const _oldKeyUp = KeyboardManager.prototype._onSpace;

        // monkey patch the onSpace handler
        KeyboardManager.prototype._onSpace = function(event, up, modifiers) {
            const ruler = canvas.controls.ruler;
            if ( up ) return;
            let oe = event.originalEvent;

            // Move along a measured ruler
            if ( canvas.ready && ruler.active ) {

                // ok we can move our character

                if(game.user.isGM) {
                        // Move along a measured ruler
                    let moved = ruler.moveToken(event);
                    if ( moved ) event.preventDefault();
                } else {
                
                    // our custom handler
                    (async () => {

                        let confirm = (game.settings.get(mod,"skip-request")) ? true : await getConfirmation("Request the movement?");
                        if (confirm) {
                            Socket.requestMovementApproval({userid:game.user.id,event:oe});
                        }
                    })();
                }
            }else if ( !modifiers.hasFocus && game.user.isGM ) {
                event.preventDefault();
                game.togglePause(null, true);
            }

            // Flag the keydown workflow as handled
            this._handled.add(modifiers.key);
        }
    }

    static controlToken(token, opt) {
        if (game.settings.get(mod,'lock-all-tokens')) {
            token.data.locked = (game.user.isGM) ? false : true;
        }
        
    }

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
            default:"ok"
        }).render(true);
    });
}

Hooks.on("init",AdjustedMovement.init);
Hooks.on("ready",AdjustedMovement.handleMovementRequests);
Hooks.on("controlToken",AdjustedMovement.controlToken);

