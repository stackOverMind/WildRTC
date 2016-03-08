
var webrtc = require('webrtcsupport');
var Emitter = require('wildemitter');

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
function PeerManager(ref,localId,config){
    this.peers = {};
    this.config = config;
    this.ref = ref;
    this.localId = localId;
    //listen to messaged send to me
    ref.orderByChild("to").equals(this.localId).on('child_added',function(snap){
        if(snap != null&&snap.val()!=null){
            var from = snap.val()["from"];
           
            var type = snap.val()["type"];
             
            //someone call me
            if(this.peers[from] == null){
                this.createPeer_(from,false)
            }
            else if(this.peers[from].iceConnectionState in ["closed","disconnected","failed"]){
                this.peers[from].close();
                delete this.peers[from];
                this.createPeer_(from,false);
            }
            var currentPc = this.peers[from];
            
            var data;
            try{
                data = JSON.parse(snap.val()["data"]); 
            }
            catch (e){
                
            }
            if(data == null){
                //TODO
                return;
                
            }
            if(type == "sdp"){
                currentPc.setRemoteDescription(
                    new RTCSessionDescription(data)
                );
            }
            else if(type == "candidate"){ 
                currentPc.addIceCandidate(new RTCIceCandidate(data));
            }
         
            snap.ref().remove();   
            
        }
    },this);
}
Emitter.mixin(PeerManager);
PeerManager.prototype.getPeer = function (remoteId,cb){
    var peer = this.peers[remoteId];
    if(peer == null){
        this.createPeer_(remoteId,true);
        peer = this.peers[remoteId];
    }
    else{
        if(peer.iceConnectionState in  ["closed","disconnected","failed"]){
            peer.close();
            delete this.peers[remoteId];
            this.createPeer_(remoteId,true);
        }    
    }
    cb(this.peers[remoteId]);
    
}

PeerManager.prototype.removePeer = function(remoteId){
    this.removePeer_(remoteId);
}
PeerManager.prototype.createPeer_ = function(remoteId,isCaller){
    var self = this;
    var pc = new RTCPeerConnection(this.config.peerConnectionConfig,this.config.peerConnectionConstraints);
    pc.onicecandidate = function(ev){
        
        var data = JSON.stringify(ev.candidate);
        self.ref.push({"from":this.localId,"to":remoteId,"type":"candidate",data});
    }
    if(isCaller){
        pc.createOffer(function(desc){
            pc.setLocalDescription(desc);
            //TODO send sdp
            self.ref.push({"from":this.localId,"to":remoteId,"type":"sdp",desc});
        })
    }
    else{
        pc.createAnswer(pc.remoteDescription,function(desc){
            pc.setLocalDescription(desc);
            self.ref.push({"from":this.localId,"to":remoteId,"type":"sdp",desc});
        })
    }

    this.peers[remoteId] = pc;
    
}
PeerManager.prototype.removePeer_ = function(remoteId){
    var peer = this.peers[remoteId];
    if(peer!=null){
        peer.close();
        delete this.peers[remoteId];
    }
}
