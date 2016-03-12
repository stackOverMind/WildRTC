var ConfigProvider = require('./ConfigProvider').ConfigProvider;
var PeerConnection = require('wild-peerconnection');
var WildStream = require('./WildStream');
var WildData = require('./WildData');
var events = require('events');

var WildRTC = function(ref, callback) {
    this.wildEmitter = new events.EventEmitter();
    this.uid = ref.getAuth().uid;
    this.ref = ref;
    this.localStream = null;
    this.isAddStream = false;
    this.hasStreamList = {};
    this.noStreamList = {};
    this.receivePeerList = {};
    this.sendPeerConnection = null;
    this.receivePeerConnection = null;

}

window.WildRTC = WildRTC;
WildRTC.prototype.join = function(callback) {
    var configProvider = new ConfigProvider(this.ref);
    var wildData = new WildData(this.ref);
    var self = this;
    wildData.join(self.uid, function(err) {
        if (err != null) {
            callback(err);
        }
        configProvider.getConfig(function(configuration) {
            wildData.onUserAdd(self.uid, function(remoteId) {
                var localSendRef = self.ref.child('users/' + self.uid + '/send/' + remoteId);
                var remoteReceiveRef = self.ref.child('users/' + remoteId + '/receive/' + self.uid);
                var localReceiveRef = self.ref.child('users/' + self.uid + '/receive/' + remoteId);
                var remoteSendRef = self.ref.child('users/' + remoteId + '/send/' + self.uid);
                self.sendPeerConnection = new PeerConnection(localSendRef, remoteReceiveRef, configuration);
                self.receivePeerConnection = new PeerConnection(localReceiveRef, remoteSendRef, configuration);
                self.receivePeerList[remoteId] = self.receivePeerConnection;
                if (self.isAddStream) {
                    if (self.localStream != null) {
                        self.sendPeerConnection.addStream(self.localStream, function(err) {
                            callback(err);
                        })
                    } else {
                        self.setLocalStream(null, function(wildStream) {
                            self.sendPeerConnection.addStream(wildStream.getStream(), function(err) {
                                callback(err);
                            })
                        })
                    }
                    self.hasStreamList[remoteId] = self.sendPeerConnection;
                } else {
                    self.noStreamList[remoteId] = self.sendPeerConnection;
                }
                self.receivePeerConnection.on('addstream', function(stream) {
                    var wildStream = new WildStream(remoteId);
                    wildStream.setStream(stream);
                    self.wildEmitter.emit('stream_added', wildStream);
                });
                self.receivePeerConnection.on('removestream', function() {
                    self.wildEmitter.emit('stream_removed', remoteId);
                });
            });
            wildData.onUserRemoved(self.uid, function(remoteId) {
                if (self.hasStreamList[remoteId]) {
                    self.hasStreamList[remoteId].close();
                    delete self.hasStreamList[remoteId];
                } else if (self.noStreamList[remoteId]) {
                    self.noStreamList[remoteId].close();
                    delete self.noStreamList[remoteId];
                };
                self.receivePeerList[remoteId].close();
            });
            callback();
        });
    });

}

WildRTC.prototype.leave = function() {
    var wildData = new WildData(this.ref);
    wildData.leave(this.uid);
};

WildRTC.prototype.setLocalStream = function(options, callback, cancelCallback) {
    if (options != null) {
        navigator.getUserMedia(options, function(stream) {
            var wildStream = new WildStream(this.uid);
            wildStream.setStream(stream);
            this.localStream = wildStream;
            callback(wildStream);
        }, function(err) {
            cancelCallback(err);
        })
    } else {
        navigator.getUserMedia({
            'audio': true,
            'video': true
        }, function(stream) {
            var wildStream = new WildStream(this.uid);
            wildStream.setStream(stream);
            this.localStream = wildStream;
            callback(wildStream);
        }, function(err) {
            cancelCallback(err);
        })
    }

};

WildRTC.prototype.addStream = function(callback) {
    var self = this;
    self.isAddStream = true;
    for (var peer in self.noStreamList) {
        self.noStreamList[peer].addStream(self.localStream, function(err) {
            if (!err) {
                self.hasStreamList[peer] = self.noStreamList[peer];
                delete self.noStreamList[peer];
            }
            callback(err);
        })
    }
};

WildRTC.prototype.removeStream = function() {
    this.isAddStream = false;
    for (var peer in this.hasStreamList) {
        this.hasStreamList[peer].close();
        this.noStreamList[peer] = this.hasStreamList[peer];
        delete this.hasStreamList[peer];
    }
};

WildRTC.prototype.on = function(string, callback, cancelCallback) {
    if (string != 'stream_added' && string != 'stream_removed') {
        cancelCallback();
    } else if (string == 'stream_added') {
        this.wildEmitter.on('stream_added', callback);
    } else if (string == 'stream_removed') {
        this.wildEmitter.on('stream_removed', callback);
    }
};

WildRTC.prototype.off = function(string) {

    if (string == 'stream_added' || string == 'stream_removed') {
        this.WildEmitter.off(string);
    }
};
