
var webrtc = require('webrtcsupport');


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
    this.connecting = {};
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
            //reconnect
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
                console.error(e);
            }
            if(data == null){
                //TODO
                return;
                
            }
            if(type == "sdp-req"){
                currentPc.setRemoteDescription(
                    new RTCSessionDescription(data)
                );
                currentPc.createAnswer(currentPc.remoteDescription,function(desc){
                    currentPc.setLocalDescription(desc);
                    this.ref.push({"from":this.localId,"to":remoteId,"type":"sdp-res","data":JSON.stringify(desc)});
                })
            }
            else if(type == "candidate"){ 
                currentPc.addIceCandidate(new RTCIceCandidate(data));
            }
         
            snap.ref().remove();   
            
        }
    },this);
}

PeerManager.prototype.getPeer = function (remoteId,callback,cancelcallback){
    var self = this;
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
            peer = this.peers[remoteId];
        }    
    }

    function oniceconnectionstatechange(){
        if(peer.iceConnectionState in ["connected","completed"]){
                callback(this.peers[remoteId]);
                
                return true;
        }
        return false;            
    }
    if(!oniceconnectionstatechange()){
        peer.addEventListener('iceconnectionstatechange',function(){
            if(oniceconnectionstatechange()){
                peer.removeEventListener("iceconnectionstatechange",oniceconnectionstatechange);    
            }
        });
        setTimeout(function(){
            peer.close();
            delete self.peers[remoteId];
            if(cancelcallback!=null){
                
                cancelcallback.call(self,new Error("Connection timeout"));
                        
            }
        },20000);
    } 
}

PeerManager.prototype.removePeer = function(remoteId){
    this.removePeer_(remoteId);
}
PeerManager.prototype.createPeer_ = function(remoteId,isCaller){
    var self = this;
    var pc = new RTCPeerConnection(this.config.peerConnectionConfig,this.config.peerConnectionConstraints);
    pc.addEventListener("icecandidate",
        function(ev){  
            var data = JSON.stringify(ev.candidate);
            self.ref.push({"from":this.localId,"to":remoteId,"type":"candidate","data":data});
        }   
    ) 
    if(isCaller){
        pc.createOffer(function(desc){
            pc.setLocalDescription(desc);
            self.ref.push({"from":this.localId,"to":remoteId,"type":"sdp-req","data":JSON.stringify(desc)});
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

module.exports = PeerManager;