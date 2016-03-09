(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// created by @HenrikJoreteg
var prefix;
var version;

if (window.mozRTCPeerConnection || navigator.mozGetUserMedia) {
    prefix = 'moz';
    version = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
} else if (window.webkitRTCPeerConnection || navigator.webkitGetUserMedia) {
    prefix = 'webkit';
    version = navigator.userAgent.match(/Chrom(e|ium)/) && parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
}

var PC = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
var IceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var SessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
var MediaStream = window.webkitMediaStream || window.MediaStream;
var screenSharing = window.location.protocol === 'https:' &&
    ((prefix === 'webkit' && version >= 26) ||
     (prefix === 'moz' && version >= 33))
var AudioContext = window.AudioContext || window.webkitAudioContext;
var videoEl = document.createElement('video');
var supportVp8 = videoEl && videoEl.canPlayType && videoEl.canPlayType('video/webm; codecs="vp8", vorbis') === "probably";
var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia || navigator.mozGetUserMedia;

// export support flags and constructors.prototype && PC
module.exports = {
    prefix: prefix,
    browserVersion: version,
    support: !!PC && !!getUserMedia,
    // new support style
    supportRTCPeerConnection: !!PC,
    supportVp8: supportVp8,
    supportGetUserMedia: !!getUserMedia,
    supportDataChannel: !!(PC && PC.prototype && PC.prototype.createDataChannel),
    supportWebAudio: !!(AudioContext && AudioContext.prototype.createMediaStreamSource),
    supportMediaStream: !!(MediaStream && MediaStream.prototype.removeTrack),
    supportScreenSharing: !!screenSharing,
    // constructors
    AudioContext: AudioContext,
    PeerConnection: PC,
    SessionDescription: SessionDescription,
    IceCandidate: IceCandidate,
    MediaStream: MediaStream,
    getUserMedia: getUserMedia
};

},{}],2:[function(require,module,exports){
var ConfigProvider = function(ref) {
    this.configuration = {};
};

ConfigProvider.prototype.getConfig = function(callback) {
    var token = ref.getAuth().token;
    var req = new XMLHttpRequest();

    req.open('GET', 'https://auth.wilddog.com/v1/webrtc/users/webrtc/secret?token=' + token, false);
    req.send(null);
    if (req.status == 200) {
        var message = JSON.parse(req.responseText);
        console.log(req.responseText);
        this.configuration = {};
        this.configuration.iceServers = message.iceServers;
        console.log("##############");
        console.log(this.configuration);
        callback(this.configuration);
    }
}

exports.ConfigProvider = ConfigProvider;
},{}],3:[function(require,module,exports){
var WildData = function(ref) {
    this.ref = ref;
}

WildData.prototype.onUserAdd = function(callback) {
    ref.child('users').on('child_added', function(snap){
    	callback(snap.key());
    });
};

WildData.prototype.onUserRemoved = function(callback) {
    ref.child('users').on('child_removed', function(snap){
    	callback(snap.key());
    });
};

// WildData.prototype.onUserState = function(callback) {
//     ref.child('userStates').on('child_changed', function(snap){
//     	callback(snap.key());
//     });
// };

WildData.prototype.join = function(uId, callback) {
    ref.child('users/' + uId).update({ 'state': 'created' }, function(err) {
        if (err == null) {
            ref.child('userStates').update({ uId: false }, function(err) {
                callback(err);
            })
        } else {
            callback(err);
        }
    })
};

WildData.prototype.leave = function(uId) {
    ref.child('users').off('child_added');
    ref.child('users').off('child_removed');
    ref.child('userStates').off('child_changed');
    ref.child('users/' + uId).remove();
    ref.child('userStates/' + uId).remove();
}

module.exports = WildData;
},{}],4:[function(require,module,exports){
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

},{"./ConfigProvider":2,"./WildData":3,"./WildStream":5,"./peerManager":6,"events":7}],5:[function(require,module,exports){
var WildStream = function(uId) {
    this.uId = uId;
    this.stream;
};

WildStream.prototype.getId = function() {
    return this.uId;
};

WildStream.prototype.setStream = function(stream) {
    this.stream = stream;
};

WildStream.prototype.bindToDOM = function(elementId) {
    var view = document.getElementById(elementId);
    view.src = URL.createObjectURL(this.stream);
}

module.exports = WildStream;

},{}],6:[function(require,module,exports){

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
    this.config = config;
    this.ref = ref;
    this.localId = localId;
    //listen to messaged send to me
    ref.orderByChild("to").equalTo(this.localId).on('child_added',function(snap){
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
                console.error(e);
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
            self.ref.push({"from":self.localId,"to":remoteId,"type":"candidate",data});
        }   
    ) 
    if(isCaller){
        pc.createOffer(function(desc){
            pc.setLocalDescription(desc);
            //TODO send sdp
            self.ref.push({"from":self.localId,"to":remoteId,"type":"sdp",desc});
        })
    }
    else{
        pc.createAnswer(pc.remoteDescription,function(desc){
            pc.setLocalDescription(desc);
            self.ref.push({"from":self.localId,"to":remoteId,"type":"sdp",desc});
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
},{"webrtcsupport":1}],7:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[4]);
