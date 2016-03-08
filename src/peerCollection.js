
/*
sample config

 {
    "iceServers": [
         {
            "urls": [
                "stun:107.167.189.134:3478",
                "stun:107.167.189.134:3478",
                "stun:107.167.189.134:3479",
                "stun:107.167.189.134:3479"
            ]
        },
         {
            "username":"1456639842:822719948",
            "credential":"wuvOQoNN6BMQAT/u0IV5eL6uwJY=",
            "urls": [
                "turn:107.167.189.134:3478?transport=udp",
                "turn:107.167.189.134:3478?transport=tcp",
                "turn:107.167.189.134:3479?transport=udp",
                "turn:107.167.189.134:3479?transport=tcp"
            ]
        }
    ]
}

*/
function PeerCollection(ref,config){
    this.peers = {};
    this.config = config;
}

PeerCollection.prototype.getPeer = function (uid,cb){
    
    
}

PeerCollection.prototype.removePeer = function(uid,cb){
    
    
}

