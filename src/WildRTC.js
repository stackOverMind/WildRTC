var ConfigProvider = require('./ConfigProvider').ConfigProvider;
var PeerManager = require('./peerManager');
var WildStream = require('./WildStream');
var WildData = require('./WildData');
var events = require('events');

var isMozilla = window.mozRTCPeerConnection && !window.webkitRTCPeerConnection;
if (isMozilla) {
    window.URL = window.URL;
    navigator.GetUserMedia = navigator.mozGetUserMedia;
    window.RTCPeerConnection = window.mozRTCPeerConnection;
    window.RTCSessionDescription = window.mozRTCSessionDescription;
    window.RTCIceCandidate = window.mozRTCIceCandidate;
}

var isChrome = window.webkitRTCPeerConnection && !window.mozRTCPeerConnection;
if (isChrome) {
    window.URL = window.URL;
    navigator.GetUserMedia = navigator.webkitGetUserMedia;
    window.RTCPeerConnection = window.webkitRTCPeerConnection;
    window.RTCSessionDescription = window.RTCSessionDescription;
    window.RTCIceCandidate = window.RTCIceCandidate;
}

var WildRTC = function(ref) {
    this.WildEmitter = new events.EventEmitter();
    this.uid = ref.getAuth().uid;
    this.ref = ref;
    this.peerList = {};
    this.peerManager = null;
}

window.WildRTC = WildRTC;

WildRTC.prototype.join = function(callback) {
    var configProvider = new ConfigProvider(this.ref);
    var wildData = new WildData(this.ref);
    var self = this;
    wildData.join(this.uid, function(err) {
        if (err != null) {
            callback(err);
        }
    });
    configProvider.getConfig(function(configuration) {
        self.peerManager = new PeerManager(this.ref, self.uid, configuration);
        wildData.onUserAdd(function(remoteId) {
            self.peerManager.getPeer(remoteId, function(peer) {

                peer.onaddstream = function(evt) {
                    var wildStream = new WildStream(remoteId);
                    wildStream.setStream(evt.stream);
                    self.WildEmitter.emit('stream_added', wildStream);
                };
                peer.onremovestream = function(evt) {
                    self.WildEmitter.emit('stream_removed', remoteId);
                };
            })
        });
        wildData.onUserRemoved(function(remoteId) {
            self.peerManager.removePeer(remoteId);
        })
        callback();
    });
};

WildRTC.prototype.leave = function() {
    var wildData = new WildData(this.ref);
    wildData.leave(uid);
};

WildRTC.prototype.getLocalStream = function(options, callback, cancelCallback) {
    if (options !=null) {
        navigator.GetUserMedia(options, function(stream) {
            var wildStream = new WildStream(this.uid);
            wildStream[stream] = stream;
            callback(wildStream);
        }, function(err) {
            cancelCallback(err);
        })
    } else {
        navigator.GetUserMedia({
            'audio': true,
            'video': true
        }, function(stream) {
            var wildStream = new WildStream(this.uid);
            wildStream.setStream(stream);
            callback(wildStream);
        }, function(err) {
            cancelCallback(err);
        })
    }

};

WildRTC.prototype.addStream = function(WildStream, callback) {
    var stream = WildStream[stream]
    for (var peer in this.peerList) {
        peer.addStream(stream, function(err) {
            if (err) {
                callback(err);
            }
        })
    }
};

WildRTC.prototype.removeStream = function() {
    for (var peer in this.peerList) {
        peer.removeStream(stream, function(err) {
            if (err) {
                callback(err);
            }
        })
    }
};

WildRTC.prototype.on = function(string, callback, cancelCallback) {
    if (string != 'stream_added' && string != 'stream_removed') {
        cancelCallback();
    } else if (string == 'stream_added') {
        this.WildEmitter.on('stream_added', callback);
    } else if (string == 'stream_removed') {
        this.WildEmitter.on('stream_removed', callback);
    }
};

WildRTC.prototype.off = function(string) {
    this.WildEmitter.off(string);
};
