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
                        Socket.approveDenyMovement({approval:response});
                    }
                    break;
                default:
                    // no idea how we got an unsolicited socket request
                    break;
            }
        });
    }
    static requestMovementApproval(obj) {
        game.socket.emit("module.adjusted-movement", {
            type: "requestMovement",
            payload: {
                user: game.user.id
            }
        });
    }

    static approveDenyMovement(response) {
        game.socket.emit("module.adjusted-movement", {
            type: "approveDenyMovement",
            payload: {
                approved: response.approval
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
            if ( this._state === Ruler.STATES.MOVING || isAlt || this.isLocked) return;
        
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


        // monkey patch the onSpace handler
        KeyboardManager.prototype._onSpace = function(event, up, modifiers) {
            const ruler = canvas.controls.ruler;
            if ( up ) return;

            // Move along a measured ruler
            if ( canvas.ready && ruler.active ) {
                // ok we can move our character
                if(game.user.isGM) {
                    // Move along a measured ruler
                    let moved = ruler.moveToken();
                    if ( moved ) event.preventDefault();
                } else {
                    // our custom handler
                    (async () => {
                        ruler.isLocked = true;
                        let clonedRuler = {...ruler};
                        let confirmed = (game.settings.get(mod,"skip-request")) ? true : await getConfirmation("Request the movement?");
                        if (confirmed) {
                            let approved = await getApproval();
                            if (approved) {
                                ruler.waypoints = clonedRuler.waypoints;
                                ruler.destination = clonedRuler.destination;
                                ruler.moveToken();
                            } else {
                                await showRejection();
                            }
                        }
                        ruler.isLocked = false;
                    })();
                }
            } else if ( !modifiers.hasFocus && game.user.isGM ) {
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

function showRejection() {
    return new Promise(resolve => {
        new Dialog({
            title: 'The DM rejected your move',
            content: '',
            buttons: {
                ok: {
                    label: "OK",
                    callback: () => {
                        resolve(true);
                    }
                }
            },
            default:"ok"
        }).render(true);
    });
}

function getApproval() {
    return new Promise(resolve => {
        Socket.requestMovementApproval({userid:game.user.id});
        game.socket.on("module.adjusted-movement", data => {
            if (data.type === "approveDenyMovement" ) {
                resolve(data.payload.approved === true);
            }
        });
    });
}

Hooks.on("init",AdjustedMovement.init);
Hooks.on("ready",AdjustedMovement.handleMovementRequests);
Hooks.on("controlToken",AdjustedMovement.controlToken);